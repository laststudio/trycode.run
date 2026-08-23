use axum::{
    extract::{State, Query},
    response::{sse::{Event, Sse}, Json},
};
use futures::{stream::Stream, StreamExt};
use std::sync::Arc;
use std::convert::Infallible;
use tokio::sync::mpsc;
use tokio_stream::wrappers::UnboundedReceiverStream;
use tracing::error;
use uuid::Uuid;

use crate::models::{
    AiRequest, AiResponse, ExplainCodeRequest, ExplainCodeResponse,
    ReviewCodeRequest, ReviewCodeResponse, GenerateTestsRequest, GenerateTestsResponse,
    AiStreamChunk,
};
use trycode_auth::AuthExtractor;
use trycode_core::{CoreError, Result};

pub async fn ai_chat(
    State(state): State<Arc<AiState>>,
    auth: AuthExtractor,
    Json(payload): Json<AiRequest>,
) -> Result<Json<AiResponse>> {
    if !state.config.ai.enabled {
        return Err(CoreError::Forbidden("AI features are disabled".to_string()));
    }

    // Check user's AI quota
    check_ai_quota(&state.db, auth.user.id).await?;

    let response = state.gateway.chat(payload).await?;

    // Log usage
    log_ai_usage(&state.db, auth.user.id, &response).await?;

    Ok(Json(response))
}

pub async fn ai_stream_chat(
    State(state): State<Arc<AiState>>,
    auth: AuthExtractor,
    Json(payload): Json<AiRequest>,
) -> Sse<impl Stream<Item = std::result::Result<Event, Infallible>>> {
    let (tx, rx) = mpsc::unbounded_channel();

    if !state.config.ai.enabled {
        let _ = tx.send(AiStreamChunk {
            content: "AI features disabled".to_string(),
            done: true,
            model: String::new(),
        });
    } else {
        let gateway = state.gateway.clone();
        let payload_clone = payload.clone();

        tokio::spawn(async move {
            if let Err(e) = gateway.stream_chat(payload_clone, tx).await {
                error!("AI stream error: {}", e);
            }
        });
    }

    let stream = UnboundedReceiverStream::new(rx)
        .map(|chunk| {
            Ok(Event::default()
                .data(serde_json::to_string(&chunk).unwrap_or_default())
                .event("chunk"))
        });

    Sse::new(stream)
}

pub async fn ai_explain_code(
    State(state): State<Arc<AiState>>,
    auth: AuthExtractor,
    Json(payload): Json<ExplainCodeRequest>,
) -> Result<Json<ExplainCodeResponse>> {
    if !state.config.ai.enabled {
        return Err(CoreError::Forbidden("AI features are disabled".to_string()));
    }

    check_ai_quota(&state.db, auth.user.id).await?;

    let response = state.gateway.explain_code(payload).await?;

    log_ai_usage(&state.db, auth.user.id, &response).await?;

    Ok(Json(response))
}

pub async fn ai_review_code(
    State(state): State<Arc<AiState>>,
    auth: AuthExtractor,
    Json(payload): Json<ReviewCodeRequest>,
) -> Result<Json<ReviewCodeResponse>> {
    if !state.config.ai.enabled {
        return Err(CoreError::Forbidden("AI features are disabled".to_string()));
    }

    check_ai_quota(&state.db, auth.user.id).await?;

    let response = state.gateway.review_code(payload).await?;

    log_ai_usage(&state.db, auth.user.id, &response).await?;

    Ok(Json(response))
}

pub async fn ai_generate_tests(
    State(state): State<Arc<AiState>>,
    auth: AuthExtractor,
    Json(payload): Json<GenerateTestsRequest>,
) -> Result<Json<GenerateTestsResponse>> {
    if !state.config.ai.enabled {
        return Err(CoreError::Forbidden("AI features are disabled".to_string()));
    }

    check_ai_quota(&state.db, auth.user.id).await?;

    let response = state.gateway.generate_tests(payload).await?;

    log_ai_usage(&state.db, auth.user.id, &response).await?;

    Ok(Json(response))
}

async fn check_ai_quota(db: &sqlx::PgPool, user_id: Uuid) -> Result<()> {
    // Check daily AI request limit
    let count: i64 = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM ai_usage_logs WHERE user_id = $1 AND created_at > NOW() - INTERVAL '24 hours'",
    )
    .bind(user_id)
    .fetch_one(db)
    .await?;

    if count >= 100 {
        return Err(CoreError::RateLimited("Daily AI request limit exceeded".to_string()));
    }

    Ok(())
}

async fn log_ai_usage<T>(db: &sqlx::PgPool, user_id: Uuid, response: &T) -> Result<()> {
    // This would log the actual usage with tokens
    // Simplified for now
    Ok(())
}

pub struct AiState {
    pub db: sqlx::PgPool,
    pub gateway: Arc<crate::gateway::AiGateway>,
    pub config: trycode_core::config::AppConfig,
}

impl trycode_auth::middleware::AuthDepot for AiState {
    fn auth_db(&self) -> &sqlx::PgPool {
        &self.db
    }
    fn jwt_config(&self) -> &trycode_core::config::JwtConfig {
        &self.config.jwt
    }
}