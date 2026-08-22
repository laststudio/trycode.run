use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// LSP 请求/响应基础类型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LSPRequest {
    pub jsonrpc: String,
    pub id: Option<serde_json::Value>,
    pub method: String,
    pub params: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LSPResponse {
    pub jsonrpc: String,
    pub id: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<LSPError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LSPError {
    pub code: i32,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LSPNotification {
    pub jsonrpc: String,
    pub method: String,
    pub params: Option<serde_json::Value>,
}

/// WebSocket 消息类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum LSPWSMessage {
    #[serde(rename = "request")]
    Request {
        request_id: u64,
        language_id: String,
        method: String,
        params: Option<serde_json::Value>,
    },
    #[serde(rename = "notification")]
    Notification {
        language_id: String,
        method: String,
        params: Option<serde_json::Value>,
    },
    #[serde(rename = "response")]
    Response {
        request_id: u64,
        #[serde(skip_serializing_if = "Option::is_none")]
        result: Option<serde_json::Value>,
        #[serde(skip_serializing_if = "Option::is_none")]
        error: Option<LSPError>,
    },
    #[serde(rename = "error")]
    Error {
        request_id: Option<u64>,
        code: i32,
        message: String,
    },
    #[serde(rename = "ping")]
    Ping,
    #[serde(rename = "pong")]
    Pong,
}

/// LSP 服务器配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LSPServerConfig {
    pub language_id: String,
    pub command: String,
    pub args: Vec<String>,
    pub env: Option<HashMap<String, String>>,
    pub memory_limit_mb: u64,
    pub startup_mode: StartupMode,
    pub idle_timeout_secs: u64,
    pub max_restarts: u32,
    pub restart_delay_secs: u64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum StartupMode {
    Resident,
    OnDemand,
}

/// LSP 服务器状态
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum LSPServerStatus {
    Stopped,
    Starting,
    Running,
    Restarting,
    Stopping,
    Crashed,
    Unhealthy,
}

/// LSP 服务器运行时信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LSPServerInfo {
    pub language_id: String,
    pub status: LSPServerStatus,
    pub pid: Option<u32>,
    pub memory_usage_mb: u64,
    pub cpu_percent: f32,
    pub uptime_secs: u64,
    pub last_request_secs: u64,
    pub request_count: u64,
    pub error_count: u64,
    pub restart_count: u32,
    pub last_error: Option<String>,
    pub capabilities: Option<serde_json::Value>,
}

/// LSP 多路复用器配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LSPMultiplexerConfig {
    pub websocket_port: u16,
    pub max_connections: usize,
    pub request_timeout_secs: u64,
    pub max_request_size: usize,
    pub enable_compression: bool,
    pub heartbeat_interval_secs: u64,
    pub max_message_size: usize,
}

impl Default for LSPMultiplexerConfig {
    fn default() -> Self {
        Self {
            websocket_port: 3001,
            max_connections: 1000,
            request_timeout_secs: 30,
            max_request_size: 10 * 1024 * 1024, // 10MB
            enable_compression: true,
            heartbeat_interval_secs: 30,
            max_message_size: 10 * 1024 * 1024,
        }
    }
}

/// LSP 请求上下文
#[derive(Debug, Clone)]
pub struct LSPRequestContext {
    pub request_id: u64,
    pub language_id: String,
    pub client_id: u64,
    pub timestamp: std::time::Instant,
}

/// LSP 服务器注册信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LSPServerRegistration {
    pub language_id: String,
    pub config: LSPServerConfig,
    pub priority: i32, // 优先级，数值越大越优先
}