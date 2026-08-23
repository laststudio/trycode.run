use crate::lsp::types::*;
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query, State,
    },
    response::Response,
    Json,
};
use futures::{SinkExt, StreamExt};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::mpsc;
use tokio::time::interval;
use tracing::{error, info, warn};

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
            connection_timeout_secs: 300,       // 5分钟无活动断开
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
        params: WSConnectParams,
        auth: Option<trycode_auth::AuthExtractor>,
    ) -> Response {
        // 验证参数
        let language_id = params.language_id.clone();

        // 如果指定了语言，检查是否支持
        if let Some(ref lang) = language_id {
            if !self.multiplexer.is_registered(lang).await {
                return Response::builder()
                    .status(400)
                    .body(axum::body::Body::from(format!(
                        "Language not supported: {}",
                        lang
                    )))
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
        info!(
            "New LSP WebSocket connection: client_id={}, language={:?}, user={:?}",
            client_id, language_id, user_id
        );

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
        if let Some(ref lang) = language_id {
            if let Err(e) = self.multiplexer.get_or_start_client(lang).await {
                error!("Failed to start LSP client for {}: {}", lang, e);
                let _ = tx.send(Message::Text(
                    serde_json::to_string(&LSPWSMessage::Error {
                        request_id: None,
                        code: -32603,
                        message: format!("Failed to start LSP server: {}", e),
                    })
                    .unwrap(),
                ));
            }
        }

        // 心跳定时器
        let heartbeat_tx = tx.clone();
        let heartbeat_interval_secs = self.config.heartbeat_interval_secs;
        let heartbeat_handle = tokio::spawn(async move {
            let mut ticker = interval(Duration::from_secs(heartbeat_interval_secs));
            loop {
                ticker.tick().await;
                if heartbeat_tx.send(Message::Ping(vec![])).is_err() {
                    break;
                }
            }
        });

        // 连接超时检查（简化版：依靠心跳保活，暂不实现主动断开）
        let timeout_handle = tokio::spawn(async move {
            let mut ticker = interval(Duration::from_secs(60));
            loop {
                ticker.tick().await;
                // TODO: 检查最后活动时间并断开超时连接
            }
        });

        // 处理接收消息
        let multiplexer = self.multiplexer.clone();

        while let Some(msg) = receiver.next().await {
            ctx.last_activity = Instant::now();

            match msg {
                Ok(Message::Text(text)) => {
                    handle_text_message(&text, &mut ctx, &multiplexer, &tx);
                }
                Ok(Message::Binary(_)) => {
                    // 不支持二进制消息
                    send_lsp_error(
                        &tx,
                        None,
                        -32600,
                        "Binary messages not supported".to_string(),
                    );
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

fn send_lsp_error(tx: &mpsc::UnboundedSender<Message>, request_id: Option<u64>, code: i32, message: String) {
    let payload = LSPWSMessage::Error {
        request_id,
        code,
        message,
    };
    if let Ok(json) = serde_json::to_string(&payload) {
        let _ = tx.send(Message::Text(json));
    }
}

fn handle_text_message(
    text: &str,
    ctx: &mut WSConnectionContext,
    multiplexer: &Arc<crate::lsp::multiplexer::LSPMultiplexer>,
    tx: &mpsc::UnboundedSender<Message>,
) {
    match serde_json::from_str::<LSPWSMessage>(text) {
        Ok(LSPWSMessage::Request {
            request_id,
            language_id,
            method,
            params,
        }) => {
            // 优先使用请求指定的语言，否则回落到连接默认语言
            let target_lang = if language_id.is_empty() {
                ctx.language_id.clone()
            } else {
                Some(language_id.clone())
            };

            if let Some(lang) = target_lang {
                ctx.language_id = Some(lang.clone());
                if let Some(client) = multiplexer.get_client(&lang) {
                    let tx = tx.clone();
                    // 在独立任务中执行请求并回发响应
                    tokio::spawn(async move {
                        match client.send_request(&method, params).await {
                            Ok(result) => {
                                let response = LSPWSMessage::Response {
                                    request_id,
                                    result: Some(result),
                                    error: None,
                                };
                                if let Ok(json) = serde_json::to_string(&response) {
                                    let _ = tx.send(Message::Text(json));
                                }
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
                                if let Ok(json) = serde_json::to_string(&response) {
                                    let _ = tx.send(Message::Text(json));
                                }
                            }
                        }
                    });
                } else {
                    send_lsp_error(
                        tx,
                        Some(request_id),
                        -32601,
                        "Language not supported or not running".to_string(),
                    );
                }
            } else {
                send_lsp_error(tx, Some(request_id), -32601, "No language specified".to_string());
            }
        }
        Ok(LSPWSMessage::Notification {
            language_id,
            method,
            params,
        }) => {
            let target_lang = if language_id.is_empty() {
                ctx.language_id.clone()
            } else {
                Some(language_id)
            };
            if let Some(lang) = target_lang {
                ctx.language_id = Some(lang.clone());
                if let Some(client) = multiplexer.get_client(&lang) {
                    // 通知为即发即忘；在同步上下文中使用 block_on 等待写入完成
                    let _ = futures::executor::block_on(client.send_notification(&method, params));
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
        Err(e) => {
            warn!("Failed to parse WebSocket message: {}", e);
            send_lsp_error(tx, None, -32700, "Parse error".to_string());
        }
    }
}

/// WebSocket 连接参数
#[derive(Debug, serde::Deserialize)]
pub struct WSConnectParams {
    pub language_id: Option<String>,
    pub token: Option<String>, // 用于认证的 token
}

/// LSP WebSocket 所需共享状态
#[derive(Clone)]
pub struct LspWSState {
    pub multiplexer: Arc<crate::lsp::multiplexer::LSPMultiplexer>,
}

/// WebSocket 处理器入口函数
pub async fn lsp_websocket_handler(
    ws: WebSocketUpgrade,
    Query(params): Query<WSConnectParams>,
    State(state): State<LspWSState>,
) -> Response {
    let multiplexer = state.multiplexer.clone();
    let config = WSProxyConfig::default();
    let handler = Arc::new(WSProxyHandler::new(multiplexer, config));

    handler.handle_upgrade(ws, params, None).await
}

/// 批量请求处理（用于批量发送多个请求）
pub async fn handle_batch_request(
    State(state): State<LspWSState>,
    Json(payload): Json<BatchLSPRequest>,
) -> std::result::Result<Json<BatchLSPResponse>, trycode_core::CoreError> {
    let multiplexer = state.multiplexer.clone();

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
