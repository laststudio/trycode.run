use crate::models::ExecuteWSQuery;
use crate::pool::ExecutorPool;
use crate::scheduler::ExecutionScheduler;
use axum::{
    extract::{
        ws::{Message, WebSocketUpgrade},
        Path, State,
    },
    response::Response,
};
use futures::{SinkExt, StreamExt};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tracing::{error, info};

/// 执行 WebSocket 所需共享状态
#[derive(Clone)]
pub struct ExecWSState {
    pub pool: Arc<ExecutorPool>,
    pub scheduler: Arc<ExecutionScheduler>,
    pub redis: deadpool_redis::Pool,
}

#[derive(Debug, Clone)]
pub struct ExecWSConfig {
    pub max_connections: usize,
    pub heartbeat_interval_secs: u64,
    pub request_timeout_secs: u64,
    pub max_message_size: usize,
    pub connection_timeout_secs: u64,
}

impl Default for ExecWSConfig {
    fn default() -> Self {
        Self {
            max_connections: 1000,
            heartbeat_interval_secs: 30,
            request_timeout_secs: 30,
            max_message_size: 10 * 1024 * 1024,
            connection_timeout_secs: 300,
        }
    }
}

struct WSConnectionContext {
    execution_id: String,
    authenticated: bool,
    last_activity: Instant,
}

async fn handle_connection(state: ExecWSState, socket: axum::extract::ws::WebSocket, execution_id: String) {
    let (mut sender, mut receiver) = socket.split();
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<Message>();

    // TODO: 通过独立 Redis PubSub 连接订阅 exec:events:{id}
    // （当前连接池使用 connection-manager，无法直接转 PubSub；事件推送后续接入）

    // 发送任务：从 channel 转发到 websocket
    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sender.send(msg).await.is_err() {
                break;
            }
        }
    });

    // 初始状态事件
    let _ = tx.send(Message::Text(
        serde_json::to_string(&serde_json::json!({
            "type": "event",
            "event_type": "status",
            "execution_id": execution_id,
            "data": { "status": "connecting" },
            "timestamp": chrono::Utc::now().timestamp_millis()
        }))
        .unwrap(),
    ));

    // 接收任务：处理客户端消息（stdin/resize 等）
    let recv_task = {
        let tx = tx.clone();
        tokio::spawn(async move {
            while let Some(Ok(msg)) = receiver.next().await {
                match msg {
                    Message::Text(text) => {
                        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) {
                            match v.get("method").and_then(|m| m.as_str()) {
                                Some("stdin") => { /* TODO: 转发到执行容器 */ }
                                Some("resize") => { /* TODO: 终端尺寸调整 */ }
                                _ => {}
                            }
                        }
                    }
                    Message::Ping(data) => {
                        let _ = tx.send(Message::Pong(data));
                    }
                    Message::Close(_) => break,
                    _ => {}
                }
            }
        })
    };

    // 心跳任务
    let heartbeat_handle = {
        let tx = tx.clone();
        tokio::spawn(async move {
            let mut interval =
                tokio::time::interval(Duration::from_secs(ExecWSConfig::default().heartbeat_interval_secs));
            loop {
                interval.tick().await;
                if tx.send(Message::Ping(vec![])).is_err() {
                    break;
                }
            }
        })
    };

    // 客户端断开即结束
    let _ = recv_task.await;

    heartbeat_handle.abort();
    send_task.abort();
    info!("Execution WebSocket connection closed: {}", execution_id);
}

/// GET /api/execute/ws/:execution_id
pub async fn exec_websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<ExecWSState>,
    Path(execution_id): Path<String>,
) -> Response {
    ws.on_upgrade(move |socket| handle_connection(state, socket, execution_id))
}
