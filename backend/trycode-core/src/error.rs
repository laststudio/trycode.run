use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum CoreError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Redis error: {0}")]
    Redis(#[from] redis::RedisError),

    #[error("Configuration error: {0}")]
    Config(#[from] figment::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Forbidden: {0}")]
    Forbidden(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Rate limited: {0}")]
    RateLimited(String),

    #[error("Internal error: {0}")]
    Internal(String),

    #[error("External service error: {0}")]
    ExternalService(String),

    #[error(transparent)]
    Anyhow(#[from] anyhow::Error),
}

pub type Result<T> = std::result::Result<T, CoreError>;

impl IntoResponse for CoreError {
    fn into_response(self) -> Response {
        let (status, code) = match &self {
            CoreError::Database(_) | CoreError::Redis(_) => (StatusCode::INTERNAL_SERVER_ERROR, "internal_error"),
            CoreError::Config(_) | CoreError::Serialization(_) => (StatusCode::INTERNAL_SERVER_ERROR, "internal_error"),
            CoreError::NotFound(_) => (StatusCode::NOT_FOUND, "not_found"),
            CoreError::Validation(_) => (StatusCode::BAD_REQUEST, "validation_error"),
            CoreError::Unauthorized(_) => (StatusCode::UNAUTHORIZED, "unauthorized"),
            CoreError::Forbidden(_) => (StatusCode::FORBIDDEN, "forbidden"),
            CoreError::Conflict(_) => (StatusCode::CONFLICT, "conflict"),
            CoreError::RateLimited(_) => (StatusCode::TOO_MANY_REQUESTS, "rate_limited"),
            CoreError::Internal(_) | CoreError::ExternalService(_) | CoreError::Anyhow(_) => (StatusCode::INTERNAL_SERVER_ERROR, "internal_error"),
        };

        // 不向外泄露内部错误细节（数据库/配置等），只返回通用信息
        let message = match &self {
            CoreError::NotFound(m)
            | CoreError::Validation(m)
            | CoreError::Unauthorized(m)
            | CoreError::Forbidden(m)
            | CoreError::Conflict(m)
            | CoreError::RateLimited(m)
            | CoreError::Internal(m)
            | CoreError::ExternalService(m) => m.clone(),
            _ => "An internal error occurred".to_string(),
        };

        let body = Json(serde_json::json!({
            "error": { "code": code, "message": message }
        }));

        (status, body).into_response()
    }
}