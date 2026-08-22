use crate::lsp::types::*;
use anyhow::{anyhow, Context, Result};
use axum::{
    extract::{ws::{Message, WebSocket, WebSocketUpgrade}, Query, State},
    response::Response,
};
use futures::{SinkExt, StreamExt};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::mpsc;
use tracing::{debug, error, info, warn};

/// WebSocket 连接上下文
#[derive(Debug)]
struct WSConnectionContext {
    client_id: u64,
    language_id: Option<String>,
    authenticated: bool,
    user_id: Option<String>,
    last_activity: Instant,
}

/// WebSocket 代理处理器
pub struct WSProxyHandler {
    multiplexer: Arc<crate::lsp::multiplexer::LSPMultiplexer>,
    config: WSProxyConfig,
}

#[derive(Debug, Clone)]
pub struct WSProxyConfig {
    pub max_connections: usize,
    pub heartbeat_interval_secs: u64,
    pub request_timeout_secs: u64,
    pub max_message_size: usize,
    pub connection_timeout_secs: u64,
}

impl Default for WSProxyConfig {
    fn default() -> Self {
        Self {
            max_connections: 1000,
            heartbeat_interval_secs: 30,
            request_timeout_secs: 30,
            max_message_size: 10 * 1024 * 1024, // 10MB
            connection_timeout_secs: 300, // 5分钟无活动断开
        }
    }
}

impl WSProxyHandler {
    pub fn new(
        multiplexer: Arc<crate::lsp::multiplexer::LSPMultiplexer>,
        config: WSProxyConfig,
    ) -> Self {
        Self { multiplexer, config }
    }

    /// 处理 WebSocket 升级请求
    pub async fn handle_upgrade(
        self: Arc<Self>,
        ws: WebSocketUpgrade,
        Query(params): Query<WSConnectParams>,
        auth: Option<crate::auth::AuthExtractor>,
    ) -> Response {
        // 验证参数
        let language_id = params.language_id.clone();
        
        // 如果指定了语言，检查是否支持
        if let Some(ref lang) = language_id {
            if !self.multiplexer.is_registered(lang) {
                return Response::builder()
                    .status(400)
                    .body(format!("Language not supported: {}", lang).into())
                    .unwrap();
            }
        }

        // 认证检查（可选）
        let user_id = auth.map(|a| a.user.id.to_string());
        
        ws.on_upgrade(move |socket| self.handle_connection(socket, language_id, user_id))
    }

    /// 处理 WebSocket 连接
    async fn handle_connection(
        self: Arc<Self>,
        socket: WebSocket,
        language_id: Option<String>,
        user_id: Option<String>,
    ) {
        let client_id = self.multiplexer.next_client_id();
        info!("New LSP WebSocket connection: client_id={}, language={:?}, user={:?}", 
            client_id, language_id, user_id);

        let (mut sender, mut receiver) = socket.split();
        let (tx, mut rx) = mpsc::unbounded_channel::<Message>();

        // 发送任务
        let send_task = tokio::spawn(async move {
            while let Some(msg) = rx.recv().await {
                if sender.send(msg).await.is_err() {
                    break;
                }
            }
        });

        // 连接上下文
        let mut ctx = WSConnectionContext {
            client_id,
            language_id: language_id.clone(),
            authenticated: user_id.is_some(),
            user_id,
            last_activity: Instant::now(),
        };

        // 如果指定了语言，尝试获取/启动客户端
        let mut lsp_client = None;
        if let Some(ref lang) = language_id {
            match self.multiplexer.get_or_start_client(lang).await {
                Ok(client) => {
                    lsp_client = Some(client);
                    ctx.language_id = Some(lang.clone());
                }
                Err(e) => {
                    error!("Failed to start LSP client for {}: {}", lang, e);
                    let _ = tx.send(Message::Text(serde_json::to_string(&LSPWSMessage::Error {
                        request_id: None,
                        code: -32603,
                        message: format!("Failed to start LSP server: {}", e),
                    }).unwrap()));
                }
            }
        }

        // 心跳定时器
        let heartbeat_tx = tx.clone();
        let heartbeat_interval = self.config.heartbeat_interval_secs;
        let heartbeat_handle = tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(heartbeat_interval));
            loop {
                interval.tick().await;
                if heartbeat_tx.send(Message::Ping(vec![])).is_err() {
                    break;
                }
            }
        });

        // 连接超时检查
        let connection_timeout = self.config.connection_timeout_secs;
        let tx_clone = tx.clone();
        let timeout_handle = tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(60));
            loop {
                interval.tick().await;
                // 这里需要一种机制来检查最后活动时间
                // 简化版：依靠心跳和接收超时
            }
        });

        // 处理接收消息
        let multiplexer = self.multiplexer.clone();
        let config = self.config.clone();
        let mut request_id_counter = 0u64;

        while let Some(msg) = receiver.next().await {
            ctx.last_activity = Instant::now();
            
            match msg {
                Ok(Message::Text(text)) => {
                    match serde_json::from_str::<LSPWSMessage>(&text) {
                        Ok(LSPWSMessage::Request { request_id, language_id, method, params }) => {
                            // 处理请求
                            let target_lang = language_id.or_else(|| ctx.language_id.clone());
                            if let Some(lang) = target_lang {
                                if let Some(client) = multiplexer.get_client(&lang) {
                                    ctx.language_id = Some(lang.clone());
                                    
                                    match client.send_request(&method, params).await {
                                        Ok(result) => {
                                            let response = LSPWSMessage::Response {
                                                request_id,
                                                result: Some(result),
                                                error: None,
                                            };
                                            let _ = tx.send(Message::Text(serde_json::to_string(&response).unwrap()));
                                        }
                                        Err(e) => {
                                            let response = LSPWSMessage::Response {
                                                request_id,
                                                result: None,
                                                error: Some(LSPError {
                                                    code: -32603,
                                                    message: e.to_string(),
                                                    data: None,
                                                }),
                                            };
                                            let _ = tx.send(Message::Text(serde_json::to_string(&response).unwrap()));
                                        }
                                    }
                                } else {
                                    let response = LSPWSMessage::Error {
                                        request_id: Some(request_id),
                                        code: -32601,
                                        message: "Language not supported or not running".to_string(),
                                    };
                                    let _ = tx.send(Message::Text(serde_json::to_string(&response).unwrap()));
                                }
                            } else {
                                let response = LSPWSMessage::Error {
                                    request_id: Some(request_id),
                                    code: -32601,
                                    message: "No language specified".to_string(),
                                };
                                let _ = tx.send(Message::Text(serde_json::to_string(&response).unwrap()));
                            }
                        }
                        Ok(LSPWSMessage::Notification { language_id, method, params }) => {
                            let target_lang = language_id.or_else(|| ctx.language_id.clone());
                            if let Some(lang) = target_lang {
                                if let Some(client) = multiplexer.get_client(&lang) {
                                    ctx.language_id = Some(lang.clone());
                                    let _ = client.send_notification(&method, params).await;
                                }
                            }
                        }
                        Ok(LSPWSMessage::Response { .. }) => {
                            // 忽略响应（我们是客户端代理）
                        }
                        Ok(LSPWSMessage::Error { .. }) => {
                            // 忽略错误消息
                        }
                        Ok(LSPWSMessage::Ping) => {
                            let _ = tx.send(Message::Pong(vec![]));
                        }
                        Ok(LSPWSMessage::Pong) => {
                            // 心跳响应，更新活动时间
                        }
                    }
                    Err(e) => {
                        warn!("Failed to parse WebSocket message: {}", e);
                        let _ = tx.send(Message::Text(serde_json::to_string(&LSPWSMessage::Error {
                            request_id: None,
                            code: -32700,
                            message: "Parse error".to_string(),
                        }).unwrap()));
                    }
                }
                Ok(Message::Binary(_)) => {
                    // 不支持二进制消息
                    let _ = tx.send(Message::Text(serde_json::to_string(&LSPWSMessage::Error {
                        request_id: None,
                        code: -32600,
                        message: "Binary messages not supported".to_string(),
                    }).unwrap()));
                }
                Ok(Message::Ping(data)) => {
                    let _ = tx.send(Message::Pong(data));
                }
                Ok(Message::Pong(_)) => {
                    // 心跳响应
                }
                Ok(Message::Close(_)) => {
                    break;
                }
                Err(e) => {
                    error!("WebSocket error: {}", e);
                    break;
                }
            }
        }

        // 清理
        heartbeat_handle.abort();
        timeout_handle.abort();
        send_task.abort();
        
        // 如果有语言客户端，考虑是否需要减少引用计数
        info!("LSP WebSocket connection closed: client_id={}", client_id);
    }
}

/// WebSocket 连接参数
#[derive(Debug, serde::Deserialize)]
pub struct WSConnectParams {
    pub language_id: Option<String>,
    pub token: Option<String>, // 用于认证的 token
}

/// WebSocket 处理器入口函数
pub async fn lsp_websocket_handler(
    ws: WebSocketUpgrade,
    Query(params): Query<WSConnectParams>,
    State(state): State<Arc<crate::AppState>>,
) -> Response {
    let multiplexer = state.lsp_multiplexer.clone();
    let config = WSProxyConfig::default();
    let handler = Arc::new(WSProxyHandler::new(multiplexer, config));
    
    handler.handle_upgrade(ws, Query(params), None).await
}

/// 批量请求处理（用于批量发送多个请求）
pub async fn handle_batch_request(
    State(state): State<Arc<crate::AppState>>,
    Json(payload): Json<BatchLSPRequest>,
) -> Result<Json<BatchLSPResponse>, crate::CoreError> {
    let multiplexer = state.lsp_multiplexer.clone();
    
    let mut results = Vec::new();
    
    for req in payload.requests {
        if let Some(client) = multiplexer.get_client(&req.language_id) {
            match client.send_request(&req.method, req.params).await {
                Ok(result) => {
                    results.push(BatchLSPResult {
                        request_id: req.request_id,
                        success: true,
                        result: Some(result),
                        error: None,
                    });
                }
                Err(e) => {
                    results.push(BatchLSPResult {
                        request_id: req.request_id,
                        success: false,
                        result: None,
                        error: Some(e.to_string()),
                    });
                }
            }
        } else {
            results.push(BatchLSPResult {
                request_id: req.request_id,
                success: false,
                result: None,
                error: Some(format!("Language not available: {}", req.language_id)),
            });
        }
    }
    
    Ok(Json(BatchLSPResponse { results }))
}

/// 批量请求
#[derive(Debug, serde::Deserialize)]
pub struct BatchLSPRequest {
    pub requests: Vec<SingleLSPRequest>,
}

#[derive(Debug, serde::Deserialize)]
pub struct SingleLSPRequest {
    pub request_id: String,
    pub language_id: String,
    pub method: String,
    pub params: Option<serde_json::Value>,
}

#[derive(Debug, serde::Serialize)]
pub struct BatchLSPResponse {
    pub results: Vec<BatchLSPResult>,
}

#[derive(Debug, serde::Serialize)]
pub struct BatchLSPResult {
    pub request_id: String,
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}