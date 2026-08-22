use axum::{
    async_trait,
    extract::{FromRequestParts, OptionalFromRequestParts, Request, State},
    http::{header::AUTHORIZATION, request::Parts, StatusCode},
    middleware::Next,
    response::Response,
};
use axum_extra::extract::CookieJar;
use std::sync::Arc;

use crate::{jwt::{decode_token, Claims}, models::User, CoreError, Result};

#[derive(Clone)]
pub struct AuthExtractor {
    pub claims: Claims,
    pub user: User,
}

#[async_trait]
impl<S> FromRequestParts<S> for AuthExtractor
where
    S: Send + Sync,
{
    type Rejection = Response;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> std::result::Result<Self, Self::Rejection> {
        let jar = CookieJar::from_headers(&parts.headers);
        
        // Try to get token from cookie first
        let token = jar.get("access_token")
            .map(|c| c.value().to_string())
            .or_else(|| {
                parts.headers.get(AUTHORIZATION)
                    .and_then(|h| h.to_str().ok())
                    .and_then(|s| s.strip_prefix("Bearer "))
                    .map(|s| s.to_string())
            })
            .ok_or_else(|| {
                let mut resp = Response::new(axum::body::Body::from("Unauthorized"));
                *resp.status_mut() = StatusCode::UNAUTHORIZED;
                resp
            })?;

        // Get config from state (assuming state is Arc<AuthState>)
        let config = {
            let state = state as &Arc<crate::routes::AuthState>;
            &state.config.jwt
        };

        let claims = decode_token(&token, config)
            .map_err(|_| {
                let mut resp = Response::new(axum::body::Body::from("Invalid token"));
                *resp.status_mut() = StatusCode::UNAUTHORIZED;
                resp
            })?;

        // Get user from database
        let db = {
            let state = state as &Arc<crate::routes::AuthState>;
            &state.db
        };

        let user = sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", claims.sub)
            .fetch_optional(db)
            .await
            .map_err(|_| {
                let mut resp = Response::new(axum::body::Body::from("Database error"));
                *resp.status_mut() = StatusCode::INTERNAL_SERVER_ERROR;
                resp
            })?
            .ok_or_else(|| {
                let mut resp = Response::new(axum::body::Body::from("User not found"));
                *resp.status_mut() = StatusCode::UNAUTHORIZED;
                resp
            })?;

        Ok(Self { claims, user })
    }
}

#[derive(Clone)]
pub struct OptionalAuthExtractor {
    pub claims: Option<Claims>,
    pub user: Option<User>,
}

#[async_trait]
impl<S> OptionalFromRequestParts<S> for OptionalAuthExtractor
where
    S: Send + Sync,
{
    type Rejection = Response;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> std::result::Result<Self, Self::Rejection> {
        let jar = CookieJar::from_headers(&parts.headers);
        
        let token = jar.get("access_token")
            .map(|c| c.value().to_string())
            .or_else(|| {
                parts.headers.get(AUTHORIZATION)
                    .and_then(|h| h.to_str().ok())
                    .and_then(|s| s.strip_prefix("Bearer "))
                    .map(|s| s.to_string())
            });

        if token.is_none() {
            return Ok(Self { claims: None, user: None });
        }

        let token = token.unwrap();

        let config = {
            let state = state as &Arc<crate::routes::AuthState>;
            &state.config.jwt
        };

        let claims = match decode_token(&token, config) {
            Ok(c) => Some(c),
            Err(_) => return Ok(Self { claims: None, user: None }),
        };

        if let Some(ref claims) = claims {
            let db = {
                let state = state as &Arc<crate::routes::AuthState>;
                &state.db
            };

            let user = sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", claims.sub)
                .fetch_optional(db)
                .await
                .ok()
                .flatten();

            Ok(Self { claims, user })
        } else {
            Ok(Self { claims: None, user: None })
        }
    }
}

pub async fn require_admin(
    auth: AuthExtractor,
    State(state): State<Arc<crate::routes::AuthState>>,
    request: Request,
    next: Next,
) -> Result<Response, Response> {
    if auth.user.role != crate::models::UserRole::Admin && auth.user.role != crate::models::UserRole::SuperAdmin {
        return Err({
            let mut resp = Response::new(axum::body::Body::from("Forbidden: Admin required"));
            *resp.status_mut() = StatusCode::FORBIDDEN;
            resp
        });
    }
    Ok(next.run(request).await)
}

pub async fn require_super_admin(
    auth: AuthExtractor,
    State(state): State<Arc<crate::routes::AuthState>>,
    request: Request,
    next: Next,
) -> Result<Response, Response> {
    if auth.user.role != crate::models::UserRole::SuperAdmin {
        return Err({
            let mut resp = Response::new(axum::body::Body::from("Forbidden: Super admin required"));
            *resp.status_mut() = StatusCode::FORBIDDEN;
            resp
        });
    }
    Ok(next.run(request).await)
}