use crate::lsp::types::*;
use anyhow::{anyhow, Context, Result};
use dashmap::DashMap;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, Mutex, RwLock};
use tokio::time::interval;
use tracing::{debug, error, info, warn};

/// LSP 多路复用器 - 管理所有语言服务器
pub struct LSPMultiplexer {
    config: LSPMultiplexerConfig,
    clients: Arc<DashMap<String, Arc<LSPClient>>>,
    server_configs: Arc<RwLock<HashMap<String, LSPServerConfig>>>,
    server_registrations: Arc<RwLock<Vec<LSPServerRegistration>>>,
    request_counter: Arc<tokio::sync::AtomicU64>,
    client_counter: Arc<tokio::sync::AtomicU64>,
    shutdown_tx: mpsc::UnboundedSender<()>,
    shutdown_rx: Arc<Mutex<Option<oneshot::Receiver<()>>>>,
    monitor_handle: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
}

impl LSPMultiplexer {
    pub fn new(config: LSPMultiplexerConfig) -> Self {
        let (shutdown_tx, shutdown_rx) = mpsc::unbounded_channel();
        
        Self {
            config,
            clients: Arc::new(DashMap::new()),
            server_configs: Arc::new(RwLock::new(HashMap::new())),
            server_registrations: Arc::new(RwLock::new(Vec::new())),
            request_counter: Arc::new(tokio::sync::AtomicU64::new(0)),
            client_counter: Arc::new(tokio::sync::AtomicU64::new(0)),
            shutdown_tx,
            shutdown_rx: Arc::new(Mutex::new(Some(shutdown_rx))),
            monitor_handle: Arc::new(Mutex::new(None)),
        }
    }

    /// 注册语言服务器
    pub async fn register_server(&self, registration: LSPServerRegistration) -> Result<()> {
        let language_id = registration.config.language_id.clone();
        
        // 存储配置
        self.server_configs.write().await.insert(language_id.clone(), registration.config.clone());
        
        // 存储注册信息
        let mut registrations = self.server_registrations.write().await;
        registrations.retain(|r| r.language_id != language_id);
        registrations.push(registration);
        registrations.sort_by_key(|r| -r.priority);
        
        info!("Registered LSP server for language: {}", language_id);
        Ok(())
    }

    /// 注销语言服务器
    pub async fn unregister_server(&self, language_id: &str) -> Result<()> {
        self.stop_server(language_id).await?;
        self.server_configs.write().await.remove(language_id);
        self.server_registrations.write().await.retain(|r| r.language_id != language_id);
        info!("Unregistered LSP server for language: {}", language_id);
        Ok(())
    }

    /// 获取或启动语言服务器客户端
    pub async fn get_or_start_client(&self, language_id: &str) -> Result<Arc<LSPClient>> {
        // 检查是否已存在
        if let Some(client) = self.clients.get(language_id) {
            return Ok(client.clone());
        }

        // 获取配置
        let config = self.server_configs.read().await
            .get(language_id)
            .cloned()
            .ok_or_else(|| anyhow!("LSP server not registered for language: {}", language_id))?;

        // 创建新客户端
        let client = Arc::new(LSPClient::new(config)?);
        
        // 启动客户端
        client.start().await?;
        
        // 存储并返回
        self.clients.insert(language_id.to_string(), client.clone());
        info!("Started LSP client for language: {}", language_id);
        
        Ok(client)
    }

    /// 停止语言服务器
    pub async fn stop_server(&self, language_id: &str) -> Result<()> {
        if let Some((_, client)) = self.clients.remove(language_id) {
            client.stop().await?;
            info!("Stopped LSP server for language: {}", language_id);
        }
        Ok(())
    }

    /// 重启语言服务器
    pub async fn restart_server(&self, language_id: &str) -> Result<()> {
        self.stop_server(language_id).await?;
        tokio::time::sleep(Duration::from_secs(1)).await;
        self.get_or_start_client(language_id).await?;
        Ok(())
    }

    /// 获取客户端（不自动启动）
    pub fn get_client(&self, language_id: &str) -> Option<Arc<LSPClient>> {
        self.clients.get(language_id).map(|c| c.clone())
    }

    /// 检查语言是否已注册
    pub fn is_registered(&self, language_id: &str) -> bool {
        self.server_configs.read().await.contains_key(language_id)
    }

    /// 获取所有已注册的语言
    pub async fn get_registered_languages(&self) -> Vec<String> {
        self.server_configs.read().await.keys().cloned().collect()
    }

    /// 获取所有运行中的客户端
    pub async fn get_running_clients(&self) -> Vec<Arc<LSPClient>> {
        self.clients.iter().map(|c| c.clone()).collect()
    }

    /// 获取所有服务器状态
    pub async fn get_all_status(&self) -> Vec<LSPServerInfo> {
        let mut infos = Vec::new();
        for client in self.clients.iter() {
            infos.push(client.get_info().await);
        }
        infos
    }

    /// 启动多路复用器
    pub async fn start(&self) -> Result<()> {
        info!("Starting LSP Multiplexer on port {}", self.config.websocket_port);
        
        // 启动常驻语言服务器
        self.start_resident_servers().await?;
        
        // 启动监控任务
        self.spawn_monitor().await;
        
        info!("LSP Multiplexer started successfully");
        Ok(())
    }

    /// 启动常驻语言服务器
    async fn start_resident_servers(&self) -> Result<()> {
        let configs = self.server_configs.read().await;
        for (lang, config) in configs.iter() {
            if config.startup_mode == StartupMode::Resident {
                info!("Starting resident LSP server for {}", lang);
                if let Err(e) = self.get_or_start_client(lang).await {
                    error!("Failed to start resident LSP server for {}: {}", lang, e);
                }
            }
        }
        Ok(())
    }

    /// 停止所有服务器
    pub async fn stop_all(&self) -> Result<()> {
        info!("Stopping all LSP servers...");
        
        // 发送关闭信号
        let _ = self.shutdown_tx.send(());
        
        // 停止所有客户端
        for client in self.clients.iter() {
            if let Err(e) = client.stop().await {
                error!("Error stopping client for {}: {}", client.language_id, e);
            }
        }
        
        self.clients.clear();
        info!("All LSP servers stopped");
        Ok(())
    }

    /// 启动监控任务
    fn spawn_monitor(&self) {
        let clients = self.clients.clone();
        let configs = self.server_configs.clone();
        
        let handle = tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(30));
            
            loop {
                interval.tick().await;
                
                // 检查所有客户端健康状态
                for client in clients.iter() {
                    let info = client.get_info().await;
                    
                    // 检查内存限制
                    let config = configs.read().await.get(&info.language_id);
                    if let Some(config) = config {
                        if info.memory_usage_mb > config.memory_limit_mb {
                            warn!("LSP server {} memory limit exceeded: {}MB > {}MB", 
                                info.language_id, info.memory_usage_mb, config.memory_limit_mb);
                            // 可以选择重启
                        }
                    }
                    
                    // 检查状态
                    if info.status == LSPServerStatus::Crashed || info.status == LSPServerStatus::Unhealthy {
                        warn!("LSP server {} is unhealthy: {:?}", info.language_id, info.status);
                        // 可以触发重启逻辑
                    }
                }
            }
        });
        
        *self.monitor_handle.lock().await = Some(handle);
    }

    /// 获取语言服务器配置
    pub async fn get_config(&self, language_id: &str) -> Option<LSPServerConfig> {
        self.server_configs.read().await.get(language_id).cloned()
    }

    /// 更新语言服务器配置
    pub async fn update_config(&self, language_id: &str, config: LSPServerConfig) -> Result<()> {
        let mut configs = self.server_configs.write().await;
        configs.insert(language_id.to_string(), config.clone());
        
        // 更新注册信息
        let mut registrations = self.server_registrations.write().await;
        if let Some(reg) = registrations.iter_mut().find(|r| r.language_id == language_id) {
            reg.config = config;
        }
        
        // 如果服务器正在运行，可能需要重启以应用新配置
        if let Some(client) = self.clients.get(language_id) {
            // 标记需要重启
            info!("Config updated for {}, restart recommended", language_id);
        }
        
        Ok(())
    }

    /// 获取请求 ID
    pub fn next_request_id(&self) -> u64 {
        self.request_counter.fetch_add(1, std::sync::atomic::Ordering::SeqCst)
    }

    /// 获取客户端 ID
    pub fn next_client_id(&self) -> u64 {
        self.client_counter.fetch_add(1, std::sync::atomic::Ordering::SeqCst)
    }

    /// 停止多路复用器
    pub async fn shutdown(&self) -> Result<()> {
        info!("Shutting down LSP Multiplexer...");
        
        // 发送关闭信号
        let _ = self.shutdown_tx.send(());
        
        // 停止所有客户端
        self.stop_all().await?;
        
        // 停止监控任务
        if let Some(handle) = self.monitor_handle.lock().await.take() {
            handle.abort();
        }
        
        info!("LSP Multiplexer shut down complete");
        Ok(())
    }
}

/// LSP 多路复用器构建器
pub struct LSPMultiplexerBuilder {
    config: LSPMultiplexerConfig,
    server_registrations: Vec<LSPServerRegistration>,
}

impl LSPMultiplexerBuilder {
    pub fn new() -> Self {
        Self {
            config: LSPMultiplexerConfig::default(),
            server_registrations: Vec::new(),
        }
    }

    pub fn with_config(mut self, config: LSPMultiplexerConfig) -> Self {
        self.config = config;
        self
    }

    pub fn with_websocket_port(mut self, port: u16) -> Self {
        self.config.websocket_port = port;
        self
    }

    pub fn register_server(mut self, registration: LSPServerRegistration) -> Self {
        self.server_registrations.push(registration);
        self
    }

    pub fn register_servers(mut self, registrations: Vec<LSPServerRegistration>) -> Self {
        self.server_registrations.extend(registrations);
        self
    }

    pub fn build(self) -> LSPMultiplexer {
        let multiplexer = LSPMultiplexer::new(self.config);
        
        // 注册所有服务器
        for reg in self.server_registrations {
            if let Err(e) = multiplexer.register_server(reg).await {
                error!("Failed to register server: {}", e);
            }
        }
        
        multiplexer
    }
}