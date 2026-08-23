use axum::{
    extract::{ws::{Message, WebSocket, WebSocketUpgrade}, Path, Query, State},
    response::{IntoResponse, Response},
};
use chrono::Utc;
use futures::{SinkExt, StreamExt};
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

use crate::{
    models::{AwarenessState, CollabMessage},
    routes::CollabState,
};
use trycode_auth::OptionalAuthExtractor;
use trycode_core::{CoreError, Result};

#[derive(serde::Deserialize)]
pub struct CollabQuery {
    pub token: Option<String>,
}

pub async fn collab_websocket(
    ws: WebSocketUpgrade,
    Path(project_id): Path<Uuid>,
    Query(query): Query<CollabQuery>,
    auth: OptionalAuthExtractor,
    State(state): State<Arc<CollabState>>,
) -> Response {
    // Authenticate user
    let user = match (auth.user, query.token) {
        (Some(user), _) => user,
        (None, Some(token)) => {
            // Try to validate token from query param (for sharing)
            match validate_share_token(&state.db, &token, project_id).await {
                Some(user) => user,
                None => return CoreError::Unauthorized("Invalid or expired share token".to_string()).into_response(),
            }
        }
        _ => return CoreError::Unauthorized("Authentication required".to_string()).into_response(),
    };

    // Check project access
    if !check_project_access(&state.db, project_id, &user).await {
        return CoreError::Forbidden("Access denied to project".to_string()).into_response();
    }

    ws.on_upgrade(move |socket| handle_collab_socket(socket, project_id, user, state))
}

async fn validate_share_token(db: &PgPool, token: &str, project_id: Uuid) -> Option<trycode_auth::models::User> {
    // Validate share link token and return a temporary user or the owner
    sqlx::query_as::<_, trycode_auth::models::User>(
        "SELECT u.* FROM share_links sl JOIN users u ON sl.created_by = u.id WHERE sl.token = $1 AND sl.project_id = $2 AND (sl.expires_at IS NULL OR sl.expires_at > NOW())",
    )
    .bind(token)
    .bind(project_id)
    .fetch_optional(db)
    .await
    .ok()
    .flatten()
}

async fn check_project_access(db: &PgPool, project_id: Uuid, user: &trycode_auth::models::User) -> bool {
    // Check if user owns project
    let project = sqlx::query_as::<_, (Uuid, String)>("SELECT owner_id, visibility FROM projects WHERE id = $1")
        .bind(project_id)
        .fetch_optional(db)
        .await
        .ok()
        .flatten();

    if let Some(project) = project {
        if project.0 == user.id {
            return true;
        }

        // Check collaborator
        let collab = sqlx::query(
            "SELECT 1 FROM project_collaborators WHERE project_id = $1 AND user_id = $2 AND accepted_at IS NOT NULL",
        )
        .bind(project_id)
        .bind(user.id)
        .fetch_optional(db)
        .await
        .ok()
        .flatten();

        if collab.is_some() {
            return true;
        }

        // Check public visibility
        if project.1 == "public" {
            return true;
        }
    }

    false
}

async fn handle_collab_socket(
    socket: WebSocket,
    project_id: Uuid,
    user: trycode_auth::models::User,
    state: Arc<CollabState>,
) {
    let (sink, mut receiver) = socket.split();
    let sender = Arc::new(Mutex::new(sink));
    let (tx, mut rx) = mpsc::unbounded_channel();

    // Get or create document for the main file (or first file)
    let file_path = "main.rs"; // In real implementation, this would be determined by the client

    if let Err(e) = state.broker.get_or_create_document(project_id, file_path.to_string()).await {
        error!("Failed to get document: {}", e);
        let _ = sender.lock().await.send(Message::Close(None)).await;
        return;
    }

    // Join session
    let session_id = Uuid::new_v4();
    let awareness_state = AwarenessState {
        user_id: user.id,
        user_name: user.name.clone(),
        user_color: generate_user_color(user.id),
        cursor: None,
        selection: None,
        last_seen: Utc::now(),
    };

    if let Err(e) = state.broker.join_session(project_id, user.id, user.name.clone(), tx.clone()).await {
        error!("Failed to join session: {}", e);
        let _ = sender.lock().await.send(Message::Close(None)).await;
        return;
    }

    info!("User {} joined collab session for project {}", user.id, project_id);

    // Spawn task to send messages to client
    let send_task = {
        let sender = Arc::clone(&sender);
        tokio::spawn(async move {
            while let Some(msg) = rx.recv().await {
                let json = match serde_json::to_string(&msg) {
                    Ok(j) => j,
                    Err(e) => {
                        error!("Failed to serialize collab message: {}", e);
                        continue;
                    }
                };
                if sender.lock().await.send(Message::Text(json)).await.is_err() {
                    break;
                }
            }
        })
    };

    // Handle incoming messages
    let broker = state.broker.clone();
    let recv_task = {
        let sender = Arc::clone(&sender);
        tokio::spawn(async move {
            while let Some(msg) = receiver.next().await {
                match msg {
                    Ok(Message::Text(text)) => {
                        if let Ok(collab_msg) = serde_json::from_str::<CollabMessage>(&text) {
                            if let Err(e) = broker.handle_message(session_id, collab_msg).await {
                                warn!("Failed to handle collab message: {}", e);
                            }
                        }
                    }
                    Ok(Message::Binary(data)) => {
                        // Handle binary Yjs updates if needed
                        debug!("Received binary message: {} bytes", data.len());
                    }
                    Ok(Message::Close(_)) => break,
                    Ok(Message::Ping(data)) => {
                        let _ = sender.lock().await.send(Message::Pong(data)).await;
                    }
                    Ok(Message::Pong(_)) => {}
                    Err(e) => {
                        error!("WebSocket error: {}", e);
                        break;
                    }
                }
            }

            // Cleanup on disconnect
            let _ = broker.leave_session(session_id).await;
        })
    };

    // Wait for either task to complete
    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    }

    info!("User {} left collab session for project {}", user.id, project_id);
}

fn generate_user_color(user_id: Uuid) -> String {
    let hash = user_id.as_u128();
    let hue = (hash % 360) as u16;
    format!("hsl({}, 70%, 45%)", hue)
}