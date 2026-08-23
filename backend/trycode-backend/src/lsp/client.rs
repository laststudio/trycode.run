use crate::lsp::types::*;
use anyhow::{anyhow, Context, Result};
use dashmap::DashMap;
use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child as TokioChild, Command as TokioCommand};
use tokio::sync::{mpsc, oneshot, Mutex, RwLock};
use tokio::time::{interval, timeout};
use tracing::{debug, error, info, warn};

/// 单个 LSP 请求默认超时（秒）
const REQUEST_TIMEOUT_SECS: u64 = 30;

/// LSP 客户端请求
#[derive(Debug)]
struct PendingRequest {
    sender: oneshot::Sender<Result<serde_json::Value>>,
    timestamp: Instant,
}

/// LSP 客户端
pub struct LSPClient {
    language_id: String,
    config: LSPServerConfig,
    process: Arc<Mutex<Option<TokioChild>>>,
    stdin: Arc<Mutex<Option<tokio::process::ChildStdin>>>,
    stdout_reader: Arc<Mutex<Option<BufReader<tokio::process::ChildStdout>>>>,

    // 请求管理
    request_id: AtomicU64,
    pending_requests: Arc<DashMap<u64, PendingRequest>>,

    // 状态
    status: Arc<RwLock<LSPServerStatus>>,
    pid: Arc<RwLock<Option<u32>>>,
    memory_usage_mb: Arc<RwLock<u64>>,
    cpu_percent: Arc<RwLock<f32>>,
    start_time: Arc<RwLock<Option<Instant>>>,
    request_count: Arc<AtomicU64>,
    error_count: Arc<AtomicU64>,
    restart_count: Arc<RwLock<u32>>,
    last_error: Arc<RwLock<Option<String>>>,
    capabilities: Arc<RwLock<Option<serde_json::Value>>>,

    // 通信通道
    shutdown_tx: mpsc::UnboundedSender<()>,

    // 监控任务
    monitor_handle: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
    idle_timer_handle: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
}

impl LSPClient {
    pub fn new(config: LSPServerConfig) -> Result<Self> {
        let (shutdown_tx, _shutdown_rx) = mpsc::unbounded_channel();

        Ok(Self {
            language_id: config.language_id.clone(),
            config,
            process: Arc::new(Mutex::new(None)),
            stdin: Arc::new(Mutex::new(None)),
            stdout_reader: Arc::new(Mutex::new(None)),
            request_id: AtomicU64::new(0),
            pending_requests: Arc::new(DashMap::new()),
            status: Arc::new(RwLock::new(LSPServerStatus::Stopped)),
            pid: Arc::new(RwLock::new(None)),
            memory_usage_mb: Arc::new(RwLock::new(0)),
            cpu_percent: Arc::new(RwLock::new(0.0)),
            start_time: Arc::new(RwLock::new(None)),
            request_count: Arc::new(AtomicU64::new(0)),
            error_count: Arc::new(AtomicU64::new(0)),
            restart_count: Arc::new(RwLock::new(0)),
            last_error: Arc::new(RwLock::new(None)),
            capabilities: Arc::new(RwLock::new(None)),
            shutdown_tx,
            monitor_handle: Arc::new(Mutex::new(None)),
            idle_timer_handle: Arc::new(Mutex::new(None)),
        })
    }

    /// 获取客户端对应语言 ID
    pub fn language_id(&self) -> &str {
        &self.language_id
    }

    /// 启动 LSP 服务器进程
    pub async fn start(&self) -> Result<()> {
        {
            let mut status = self.status.write().await;
            if *status == LSPServerStatus::Running || *status == LSPServerStatus::Starting {
                return Ok(());
            }
            *status = LSPServerStatus::Starting;
        }

        info!("Starting LSP server for language: {}", self.config.language_id);

        // 构建命令
        let mut cmd = TokioCommand::new(&self.config.command);
        cmd.args(&self.config.args);
        cmd.stdin(Stdio::piped());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        // 设置环境变量
        if let Some(env) = &self.config.env {
            for (k, v) in env {
                cmd.env(k, v);
            }
        }

        // 启动进程
        let mut child = cmd
            .spawn()
            .with_context(|| format!("Failed to spawn LSP server: {}", self.config.command))?;

        let pid = child.id().unwrap_or(0);
        *self.pid.write().await = Some(pid);
        *self.start_time.write().await = Some(Instant::now());

        // 获取 stdin/stdout/stderr
        let stdin = child.stdin.take().context("Failed to get stdin")?;
        let stdout = child.stdout.take().context("Failed to get stdout")?;
        let stderr = child.stderr.take().context("Failed to get stderr")?;

        *self.stdin.lock().await = Some(stdin);
        *self.stdout_reader.lock().await = Some(BufReader::new(stdout));
        *self.process.lock().await = Some(child);

        // 启动 stderr 监控
        self.spawn_stderr_monitor(stderr).await;

        // 启动 stdout 读取循环
        self.spawn_stdout_reader().await;

        // 发送 initialize 请求
        self.initialize().await?;

        // 启动监控任务
        self.spawn_monitor().await;

        // 如果是按需启动模式，启动空闲计时器
        if self.config.startup_mode == StartupMode::OnDemand {
            self.start_idle_timer().await;
        }

        *self.status.write().await = LSPServerStatus::Running;
        info!("LSP server started for {}: pid={}", self.language_id, pid);

        Ok(())
    }

    /// 初始化 LSP 服务器
    async fn initialize(&self) -> Result<()> {
        let init_params = serde_json::json!({
            "processId": std::process::id(),
            "rootUri": "file:///workspace",
            "capabilities": {},
            "initializationOptions": {}
        });

        let response = self.send_request("initialize", Some(init_params)).await?;
        *self.capabilities.write().await = response.get("capabilities").cloned();

        // 发送 initialized 通知
        self.send_notification("initialized", Some(serde_json::json!({})))
            .await?;

        Ok(())
    }

    /// 发送请求并等待响应
    pub async fn send_request(
        &self,
        method: &str,
        params: Option<serde_json::Value>,
    ) -> Result<serde_json::Value> {
        let request_id = self.request_id.fetch_add(1, Ordering::SeqCst);

        let (tx, rx) = oneshot::channel();
        self.pending_requests.insert(
            request_id,
            PendingRequest {
                sender: tx,
                timestamp: Instant::now(),
            },
        );

        let request = LSPRequest {
            jsonrpc: "2.0".to_string(),
            id: Some(serde_json::Value::Number(request_id.into())),
            method: method.to_string(),
            params,
        };

        self.send_lsp_message(&request).await?;

        // 等待响应，带超时
        let timeout_duration = Duration::from_secs(REQUEST_TIMEOUT_SECS);
        let result = timeout(timeout_duration, rx)
            .await
            .context("Request timeout")?
            .context("Request channel closed")?;

        self.request_count.fetch_add(1, Ordering::SeqCst);
        result
    }

    /// 发送通知（不等待响应）
    pub async fn send_notification(
        &self,
        method: &str,
        params: Option<serde_json::Value>,
    ) -> Result<()> {
        let notification = LSPNotification {
            jsonrpc: "2.0".to_string(),
            method: method.to_string(),
            params,
        };
        self.send_lsp_message(&notification).await
    }

    /// 发送 LSP 消息到 stdin
    async fn send_lsp_message<T: serde::Serialize>(&self, message: &T) -> Result<()> {
        let json = serde_json::to_string(message)
            .context("Failed to serialize LSP message")?;
        let content_length = json.len();
        let message_with_header = format!("Content-Length: {}\r\n\r\n{}", content_length, json);

        let mut stdin_guard = self.stdin.lock().await;
        if let Some(stdin) = stdin_guard.as_mut() {
            stdin
                .write_all(message_with_header.as_bytes())
                .await
                .context("Failed to write to LSP stdin")?;
            stdin.flush().await.context("Failed to flush LSP stdin")?;
            Ok(())
        } else {
            Err(anyhow!("LSP stdin not available"))
        }
    }

    /// 启动 stderr 监控
    async fn spawn_stderr_monitor(&self, stderr: tokio::process::ChildStderr) {
        let language_id = self.language_id.clone();
        let last_error = self.last_error.clone();
        let error_count = self.error_count.clone();

        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr);
            let mut line = String::new();

            loop {
                line.clear();
                match reader.read_line(&mut line).await {
                    Ok(0) => break, // EOF
                    Ok(_) => {
                        let line = line.trim();
                        if !line.is_empty() {
                            warn!("[LSP:{}] stderr: {}", language_id, line);
                            // 检测错误关键词
                            let lower = line.to_lowercase();
                            if lower.contains("error")
                                || lower.contains("panic")
                                || lower.contains("fatal")
                            {
                                *last_error.write().await = Some(line.to_string());
                                error_count.fetch_add(1, Ordering::SeqCst);
                            }
                        }
                    }
                    Err(e) => {
                        warn!("[LSP:{}] stderr read error: {}", language_id, e);
                        break;
                    }
                }
            }
        });
    }

    /// 启动 stdout 读取循环
    async fn spawn_stdout_reader(&self) {
        let language_id = self.language_id.clone();
        let pending_requests = self.pending_requests.clone();
        let stdout_reader = self.stdout_reader.clone();

        tokio::spawn(async move {
            let mut reader = match stdout_reader.lock().await.take() {
                Some(r) => r,
                None => return,
            };

            loop {
                // 读取头部直到空行
                let mut content_length: Option<usize> = None;
                loop {
                    let mut header_line = String::new();
                    match reader.read_line(&mut header_line).await {
                        Ok(0) => return, // EOF
                        Ok(_) => {
                            let trimmed = header_line.trim();
                            if trimmed.is_empty() {
                                break; // 头部结束
                            }
                            if let Some(rest) = trimmed.strip_prefix("Content-Length:") {
                                content_length = rest.trim().parse::<usize>().ok();
                            }
                        }
                        Err(e) => {
                            error!("[LSP:{}] stdout read error: {}", language_id, e);
                            return;
                        }
                    }
                }

                let Some(length) = content_length else {
                    continue;
                };

                // 读取 JSON 内容
                let mut json_bytes = vec![0u8; length];
                if let Err(e) = reader.read_exact(&mut json_bytes).await {
                    error!("[LSP:{}] read json error: {}", language_id, e);
                    continue;
                }

                let json_str = String::from_utf8_lossy(&json_bytes);

                // 解析响应
                if let Ok(response) = serde_json::from_str::<LSPResponse>(&json_str) {
                    if let Some(id) = response.id {
                        if let Some(id_num) = id.as_u64() {
                            if let Some((_, pending)) = pending_requests.remove(&id_num) {
                                if let Some(error) = response.error {
                                    let _ = pending.sender.send(Err(anyhow!(
                                        "LSP error: {} - {}",
                                        error.code,
                                        error.message
                                    )));
                                } else {
                                    let _ = pending.sender.send(Ok(
                                        response.result.unwrap_or(serde_json::Value::Null)
                                    ));
                                }
                            }
                        }
                    }
                } else if let Ok(notification) =
                    serde_json::from_str::<LSPNotification>(&json_str)
                {
                    // 处理通知
                    debug!("[LSP:{}] notification: {}", language_id, notification.method);
                } else {
                    warn!("[LSP:{}] unknown message: {}", language_id, json_str);
                }
            }
        });
    }

    /// 启动监控任务（简化版：仅检测进程退出并更新状态；自动重启需外部管理器协调）
    async fn spawn_monitor(&self) {
        let language_id = self.language_id.clone();
        let process = self.process.clone();
        let status = self.status.clone();

        let handle = tokio::spawn(async move {
            let mut ticker = interval(Duration::from_secs(10));

            loop {
                ticker.tick().await;

                // 检查进程是否存活
                let is_alive = {
                    let mut process_guard = process.lock().await;
                    match process_guard.as_mut() {
                        Some(child) => match child.try_wait() {
                            Ok(Some(exit_status)) => {
                                error!("[LSP:{}] process exited with: {:?}", language_id, exit_status);
                                false
                            }
                            Ok(None) => true,
                            Err(e) => {
                                error!("[LSP:{}] wait error: {}", language_id, e);
                                false
                            }
                        },
                        None => false,
                    }
                };

                if !is_alive {
                    *status.write().await = LSPServerStatus::Crashed;
                    // TODO: 自动重启逻辑需要外部管理器协调
                }
            }
        });

        *self.monitor_handle.lock().await = Some(handle);
    }

    /// 启动空闲计时器（简化版：超时后仅记录日志，实际停止由外部管理器协调）
    async fn start_idle_timer(&self) {
        let language_id = self.language_id.clone();
        let idle_timeout = self.config.idle_timeout_secs;

        let handle = tokio::spawn(async move {
            let mut ticker = interval(Duration::from_secs(idle_timeout.max(30)));
            loop {
                ticker.tick().await;
                debug!("[LSP:{}] idle timer tick", language_id);
                // TODO: 空闲停止逻辑需要共享最后活动时间与外部管理器协调
            }
        });

        *self.idle_timer_handle.lock().await = Some(handle);
    }

    /// 更新最后活动时间
    pub async fn touch(&self) {
        // TODO: 实际实现需要共享 last_request 时间
    }

    /// 获取进程内存使用 (MB)
    fn get_process_memory_mb(pid: u32) -> Result<u64> {
        #[cfg(target_os = "linux")]
        {
            let statm = std::fs::read_to_string(format!("/proc/{}/statm", pid))?;
            let parts: Vec<&str> = statm.split_whitespace().collect();
            if parts.len() >= 2 {
                let pages: u64 = parts[1].parse()?;
                let page_size: u64 = 4096; // 通常是 4KB
                return Ok(pages * page_size / 1024 / 1024);
            }
        }
        #[cfg(not(target_os = "linux"))]
        {
            let _ = pid;
        }
        Ok(0)
    }

    /// 停止客户端
    pub async fn stop(&self) -> Result<()> {
        info!("Stopping LSP client for {}", self.language_id);

        // 发送 shutdown 请求
        let _ = self.send_request("shutdown", None).await;
        let _ = self.send_notification("exit", None).await;

        // 发送关闭信号
        let _ = self.shutdown_tx.send(());

        // 等待进程退出
        if let Some(mut child) = self.process.lock().await.take() {
            let _ = child.kill().await;
            let _ = child.wait().await;
        }

        // 停止监控任务
        if let Some(handle) = self.monitor_handle.lock().await.take() {
            handle.abort();
        }
        if let Some(handle) = self.idle_timer_handle.lock().await.take() {
            handle.abort();
        }

        *self.status.write().await = LSPServerStatus::Stopped;
        info!("LSP client stopped for {}", self.language_id);
        Ok(())
    }

    /// 获取服务器信息
    pub async fn get_info(&self) -> LSPServerInfo {
        let status = self.status.read().await.clone();
        let pid = *self.pid.read().await;
        let memory = *self.memory_usage_mb.read().await;
        let cpu = *self.cpu_percent.read().await;
        let start_time = *self.start_time.read().await;
        let request_count = self.request_count.load(Ordering::SeqCst);
        let error_count = self.error_count.load(Ordering::SeqCst);
        let restart_count = *self.restart_count.read().await;
        let last_error = self.last_error.read().await.clone();
        let capabilities = self.capabilities.read().await.clone();

        let uptime = start_time.map(|st| st.elapsed().as_secs()).unwrap_or(0);

        LSPServerInfo {
            language_id: self.language_id.clone(),
            status,
            pid,
            memory_usage_mb: memory,
            cpu_percent: cpu,
            uptime_secs: uptime,
            last_request_secs: 0, // TODO: 实现最后请求时间
            request_count,
            error_count,
            restart_count,
            last_error,
            capabilities,
        }
    }

    /// 重启服务器
    pub async fn restart(&self) -> Result<()> {
        info!("Restarting LSP client for {}", self.language_id);
        self.stop().await?;
        tokio::time::sleep(Duration::from_secs(self.config.restart_delay_secs)).await;
        self.start().await
    }
}
