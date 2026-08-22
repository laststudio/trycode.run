use crate::lsp::types::*;
use anyhow::{anyhow, Context, Result};
use dashmap::DashMap;
use std::collections::VecDeque;
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child as TokioChild, Command as TokioCommand};
use tokio::sync::{mpsc, oneshot, Mutex, RwLock};
use tokio::time::{interval, timeout};
use tracing::{debug, error, info, warn};

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
    request_count: AtomicU64,
    error_count: AtomicU64,
    restart_count: Arc<RwLock<u32>>,
    last_error: Arc<RwLock<Option<String>>>,
    capabilities: Arc<RwLock<Option<serde_json::Value>>>,
    
    // 通信通道
    request_tx: mpsc::UnboundedSender<LSPRequest>,
    request_rx: Arc<Mutex<Option<mpsc::UnboundedReceiver<LSPRequest>>>>,
    shutdown_tx: mpsc::UnboundedSender<()>,
    shutdown_rx: Arc<Mutex<Option<oneshot::Receiver<()>>>>,
    
    // 监控任务
    monitor_handle: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
    idle_timer_handle: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
}

impl LSPClient {
    pub fn new(config: LSPServerConfig) -> Result<Self> {
        let (request_tx, request_rx) = mpsc::unbounded_channel();
        let (shutdown_tx, shutdown_rx) = mpsc::unbounded_channel();
        
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
            request_count: AtomicU64::new(0),
            error_count: AtomicU64::new(0),
            restart_count: Arc::new(RwLock::new(0)),
            last_error: Arc::new(RwLock::new(None)),
            capabilities: Arc::new(RwLock::new(None)),
            request_tx,
            request_rx: Arc::new(Mutex::new(Some(request_rx))),
            shutdown_tx,
            shutdown_rx: Arc::new(Mutex::new(Some(shutdown_rx))),
            monitor_handle: Arc::new(Mutex::new(None)),
            idle_timer_handle: Arc::new(Mutex::new(None)),
        }
    }

    /// 启动 LSP 服务器进程
    pub async fn start(&self) -> Result<()> {
        let mut status = self.status.write().await;
        if *status == LSPServerStatus::Running || *status == LSPServerStatus::Starting {
            return Ok(());
        }
        *status = LSPServerStatus::Starting;
        drop(status);

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
        
        // 设置工作目录
        cmd.current_dir("/workspace");

        // 启动进程
        let mut child = cmd.spawn()
            .with_context(|| format!("Failed to spawn LSP server: {}", self.config.command))?;

        let pid = child.id().unwrap_or(0);
        *self.pid.write().await = Some(pid);
        *self.start_time.write().await = Some(Instant::now());

        // 获取 stdin/stdout
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

        // 启动请求处理循环
        self.spawn_request_processor().await;

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
            "capabilities": {
                "textDocument": {
                    "completion": {
                        "dynamicRegistration": true,
                        "completionItem": {
                            "snippetSupport": true,
                            "documentationFormat": ["markdown", "plaintext"]
                        }
                    },
                    "hover": {
                        "dynamicRegistration": true,
                        "contentFormat": ["markdown", "plaintext"]
                    },
                    "definition": {
                        "dynamicRegistration": true
                    },
                    "references": {
                        "dynamicRegistration": true
                    },
                    "documentSymbol": {
                        "dynamicRegistration": true
                    },
                    "codeAction": {
                        "dynamicRegistration": true
                    },
                    "codeLens": {
                        "dynamicRegistration": true
                    },
                    "documentFormatting": {
                        "dynamicRegistration": true
                    },
                    "documentRangeFormatting": {
                        "dynamicRegistration": true
                    },
                    "rename": {
                        "dynamicRegistration": true
                    },
                    "signatureHelp": {
                        "dynamicRegistration": true,
                        "signatureInformation": {
                            "documentationFormat": ["markdown", "plaintext"]
                        }
                    },
                    "inlayHint": {
                        "dynamicRegistration": true
                    }
                },
                "workspace": {
                    "workspaceFolders": true,
                    "didChangeConfiguration": {
                        "dynamicRegistration": true
                    }
                }
            },
            "initializationOptions": {}
        });

        let response = self.send_request("initialize", Some(init_params)).await?;
        *self.capabilities.write().await = response.get("capabilities").cloned();

        // 发送 initialized 通知
        self.send_notification("initialized", Some(serde_json::json!({}))).await?;

        Ok(())
    }

    /// 发送请求并等待响应
    pub async fn send_request(&self, method: &str, params: Option<serde_json::Value>) -> Result<serde_json::Value> {
        let request_id = self.request_id.fetch_add(1, Ordering::SeqCst);
        
        let (tx, rx) = oneshot::channel();
        self.pending_requests.insert(request_id, PendingRequest {
            sender: tx,
            timestamp: Instant::now(),
        });

        let request = LSPRequest {
            jsonrpc: "2.0".to_string(),
            id: Some(serde_json::Value::Number(request_id.into())),
            method: method.to_string(),
            params,
        };

        self.send_lsp_message(&request).await?;

        // 等待响应，带超时
        let timeout_duration = Duration::from_secs(self.config.request_timeout_secs);
        let result = timeout(timeout_duration, rx).await
            .context("Request timeout")?
            .context("Request channel closed")?;

        self.request_count.fetch_add(1, Ordering::SeqCst);
        result
    }

    /// 发送通知（不等待响应）
    pub async fn send_notification(&self, method: &str, params: Option<serde_json::Value>) -> Result<()> {
        let notification = LSPNotification {
            jsonrpc: "2.0".to_string(),
            method: method.to_string(),
            params,
        };
        self.send_lsp_message(&notification).await
    }

    /// 发送 LSP 消息到 stdin
    async fn send_lsp_message<T: Serialize>(&self, message: &T) -> Result<()> {
        let json = serde_json::to_string(message)
            .context("Failed to serialize LSP message")?;
        let content_length = json.len();
        let message_with_header = format!(
            "Content-Length: {}\r\n\r\n{}",
            content_length, json
        );

        let mut stdin = self.stdin.lock().await;
        if let Some(stdin) = stdin.as_mut() {
            stdin.write_all(message_with_header.as_bytes()).await
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
                            if line.to_lowercase().contains("error") || 
                               line.to_lowercase().contains("panic") ||
                               line.to_lowercase().contains("fatal") {
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
        let capabilities = self.capabilities.clone();
        let status = self.status.clone();
        let request_count = self.request_count.clone();

        tokio::spawn(async move {
            let mut reader = {
                let mut guard = stdout_reader.lock().await;
                guard.take().expect("stdout reader not available")
            };
            let mut buffer = Vec::new();
            
            loop {
                // 读取 Content-Length
                let mut length_line = String::new();
                match reader.read_line(&mut line).await {
                    Ok(0) => break, // EOF
                    Ok(_) => {},
                    Err(e) => {
                        error!("[LSP:{}] stdout read error: {}", language_id, e);
                        break;
                    }
                }
                
                // 解析 Content-Length
                let line = line.trim();
                if line.starts_with("Content-Length:") {
                    let length_str = line["Content-Length:".len()..].trim();
                    if let Ok(length) = length_str.parse::<usize>() {
                        // 读取空行
                        let mut empty_line = String::new();
                        reader.read_line(&mut empty_line).await.ok();
                        
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
                                            let _ = pending.sender.send(Err(anyhow!("LSP error: {} - {}", error.code, error.message)));
                                        } else {
                                            let _ = pending.sender.send(Ok(response.result.unwrap_or(serde_json::Value::Null)));
                                        }
                                    }
                                }
                            }
                        } else if let Ok(notification) = serde_json::from_str::<LSPNotification>(&json_str) {
                            // 处理通知
                            debug!("[LSP:{}] notification: {}", language_id, notification.method);
                        } else {
                            warn!("[LSP:{}] unknown message: {}", language_id, json_str);
                        }
                    }
                }
            }
        });
    }

    /// 启动请求处理循环
    async fn spawn_request_processor(&self) {
        let language_id = self.language_id.clone();
        let request_rx = {
            let mut guard = self.request_rx.lock().await;
            guard.take().expect("request_rx already taken")
        };
        let stdin = self.stdin.clone();
        
        tokio::spawn(async move {
            let mut rx = request_rx;
            while let Some(request) = rx.recv().await {
                let json = match serde_json::to_string(&request) {
                    Ok(j) => j,
                    Err(e) => {
                        error!("[LSP:{}] serialize error: {}", language_id, e);
                        continue;
                    }
                };
                
                let content_length = json.len();
                let message = format!("Content-Length: {}\r\n\r\n{}", content_length, json);
                
                let mut stdin_guard = stdin.lock().await;
                if let Some(stdin) = stdin_guard.as_mut() {
                    if let Err(e) = stdin.write_all(message.as_bytes()).await {
                        error!("[LSP:{}] write error: {}", language_id, e);
                        break;
                    }
                    if let Err(e) = stdin.flush().await {
                        error!("[LSP:{}] flush error: {}", language_id, e);
                        break;
                    }
                }
            }
        });
    }

    /// 启动监控任务
    async fn spawn_monitor(&self) {
        let language_id = self.language_id.clone();
        let process = self.process.clone();
        let status = self.status.clone();
        let pid = self.pid.clone();
        let memory_usage_mb = self.memory_usage_mb.clone();
        let cpu_percent = self.cpu_percent.clone();
        let start_time = self.start_time.clone();
        let restart_count = self.restart_count.clone();
        let last_error = self.last_error.clone();
        let config = self.config.clone();
        let status_clone = self.status.clone();
        let stdin = self.stdin.clone();
        
        let handle = tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(10));
            
            loop {
                interval.tick().await;
                
                // 检查进程是否存活
                let mut process_guard = process.lock().await;
                let is_alive = if let Some(child) = process_guard.as_mut() {
                    match child.try_wait() {
                        Ok(Some(exit_status)) => {
                            error!("[LSP:{}] process exited with: {:?}", language_id, exit_status);
                            false
                        }
                        Ok(None) => true,
                        Err(e) => {
                            error!("[LSP:{}] wait error: {}", language_id, e);
                            false
                        }
                    } else {
                        false
                    }
                };
                drop(process_guard);
                
                if !is_alive {
                    *status.write().await = LSPServerStatus::Crashed;
                    
                    // 尝试重启
                    if config.max_restarts > 0 {
                        let mut count = restart_count.write().await;
                        if *count < config.max_restarts {
                            *count += 1;
                            warn!("[LSP:{}] restarting (attempt {}/{})", language_id, *count, config.max_restarts);
                            tokio::time::sleep(Duration::from_secs(config.restart_delay_secs)).await;
                            // 这里应该触发重启逻辑，但需要外部管理器协调
                            *status.write().await = LSPServerStatus::Restarting;
                        } else {
                            *status.write().await = LSPServerStatus::Crashed;
                        }
                    }
                    continue;
                }
                
                // 更新内存/CPU 使用情况
                if let Some(pid) = *pid.read().await {
                    if let Ok(mem) = Self::get_process_memory_mb(pid) {
                        *memory_usage_mb.write().await = mem;
                        
                        // 检查内存限制
                        if mem > config.memory_limit_mb {
                            warn!("[LSP:{}] memory limit exceeded: {}MB > {}MB", language_id, mem, config.memory_limit_mb);
                            // 可以选择重启或发送警告
                        }
                    }
                    
                    if let Ok(cpu) = Self::get_process_cpu_percent(pid) {
                        *cpu_percent.write().await = cpu;
                    }
                }
            }
        });
        
        *self.monitor_handle.lock().await = Some(handle);
    }

    /// 启动空闲计时器
    async fn start_idle_timer(&self) {
        let language_id = self.language_id.clone();
        let status = self.status.clone();
        let last_request = Arc::new(RwLock::new(Instant::now()));
        let idle_timeout = self.config.idle_timeout_secs;
        let status_clone = self.status.clone();
        let stdin = self.stdin.clone();
        
        // 更新最后请求时间
        let last_request_clone = last_request.clone();
        let request_rx = {
            let mut guard = self.request_rx.lock().await;
            guard.take()
        };
        
        // 这里需要一个机制来更新最后请求时间
        // 简化版：定期检查
        let handle = tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(30));
            
            loop {
                interval.tick().await;
                
                let elapsed = last_request.read().await.elapsed();
                if elapsed > Duration::from_secs(idle_timeout) {
                    info!("[LSP:{}] idle timeout reached, stopping", language_id);
                    // 发送 shutdown 请求
                    // 这里需要通过外部管理器来停止
                    break;
                }
            }
        });
        
        *self.idle_timer_handle.lock().await = Some(handle);
    }

    /// 更新最后活动时间
    pub async fn touch(&self) {
        // 实际实现需要共享 last_request 时间
    }

    /// 获取进程内存使用 (MB)
    fn get_process_memory_mb(pid: u32) -> Result<u64> {
        #[cfg(target_os = "linux")]
        {
            let statm = std::fs::read_to_string(format!("/proc/{}/statm", pid))?;
            let parts: Vec<&str> = statm.split_whitespace().collect();
            if parts.len() >= 2 {
                let pages = parts[1].parse::<u64>()?;
                let page_size = 4096; // 通常是 4KB
                return Ok(pages * page_size / 1024 / 1024);
            }
        }
        #[cfg(not(target_os = "linux"))]
        {
            // 非 Linux 系统返回估算值
            return Ok(0);
        }
        Ok(0)
    }

    /// 获取进程 CPU 使用率
    fn get_process_cpu_percent(pid: u32) -> Result<f32> {
        #[cfg(target_os = "linux")]
        {
            let stat = std::fs::read_to_string(format!("/proc/{}/stat", pid))?;
            let parts: Vec<&str> = stat.split_whitespace().collect();
            if parts.len() >= 17 {
                let utime: u64 = parts[13].parse()?;
                let stime: u64 = parts[14].parse()?;
                let total_time = utime + stime;
                // 简化计算，实际需要两次采样计算差值
                return Ok(0.0);
            }
        }
        Ok(0.0)
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
        let status = *self.status.read().await;
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