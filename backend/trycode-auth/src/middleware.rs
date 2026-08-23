use axum::{
    async_trait,
    extract::{FromRequestParts, Request},
    http::{header::AUTHORIZATION, request::Parts, StatusCode},
    middleware::Next,
    response::Response,
};
use axum_extra::extract::CookieJar;
use std::sync::Arc;

use crate::{jwt::decode_token, jwt::Claims, models::User};
use trycode_core::config::JwtConfig;

/// 状态需提供的认证依赖。各 crate 的 State 实现此 trait 即可使用认证提取器。
pub trait AuthDepot: Send + Sync {
    fn auth_db(&self) -> &sqlx::PgPool;
    fn jwt_config(&self) -> &JwtConfig;
}

fn unauthorized(msg: &str) -> Response {
    let mut resp = Response::new(axum::body::Body::from(msg.to_string()));
    *resp.status_mut() = StatusCode::UNAUTHORIZED;
    resp
}

fn forbidden(msg: &str) -> Response {
    let mut resp = Response::new(axum::body::Body::from(msg.to_string()));
    *resp.status_mut() = StatusCode::FORBIDDEN;
    resp
}

fn extract_token(parts: &Parts) -> Option<String> {
    let jar = CookieJar::from_headers(&parts.headers);
    jar.get("access_token")
        .map(|c| c.value().to_string())
        .or_else(|| {
            parts
                .headers
                .get(AUTHORIZATION)
                .and_then(|h| h.to_str().ok())
                .and_then(|s| s.strip_prefix("Bearer "))
                .map(|s| s.to_string())
        })
}

#[derive(Clone)]
pub struct AuthExtractor {
    pub claims: Claims,
    pub user: User,
}

#[async_trait]
impl<S> FromRequestParts<S> for AuthExtractor
where
    S: Send + Sync + AuthDepot,
{
    type Rejection = Response;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let token = extract_token(parts).ok_or_else(|| unauthorized("Unauthorized"))?;

        let claims =
            decode_token(&token, state.jwt_config()).map_err(|_| unauthorized("Invalid token"))?;

        let user: Option<User> =
            sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
                .bind(&claims.sub)
                .fetch_optional(state.auth_db())
                .await
                .map_err(|_| {
                    let mut resp =
                        Response::new(axum::body::Body::from("Database error"));
                    *resp.status_mut() = StatusCode::INTERNAL_SERVER_ERROR;
                    resp
                })?;

        let user = user.ok_or_else(|| unauthorized("User not found"))?;

        Ok(Self { claims, user })
    }
}

#[derive(Clone)]
pub struct OptionalAuthExtractor {
    pub claims: Option<Claims>,
    pub user: Option<User>,
}

#[async_trait]
impl<S> FromRequestParts<S> for OptionalAuthExtractor
where
    S: Send + Sync + AuthDepot,
{
    type Rejection = std::convert::Infallible;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &S,
    ) -> Result<Self, Self::Rejection> {
        let Some(token) = extract_token(parts) else {
            return Ok(Self { claims: None, user: None });
        };

        let Ok(claims) = decode_token(&token, state.jwt_config()) else {
            return Ok(Self { claims: None, user: None });
        };

        let user: Option<User> =
            sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
                .bind(&claims.sub)
                .fetch_optional(state.auth_db())
                .await
                .ok()
                .flatten();

        Ok(Self { claims: Some(claims), user })
    }
}

#[async_trait]
impl<S> FromRequestParts<S> for Claims
where
    S: Send + Sync + AuthDepot,
{
    type Rejection = Response;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Claims, Self::Rejection> {
        let token = extract_token(parts).ok_or_else(|| unauthorized("Unauthorized"))?;
        let claims =
            decode_token(&token, state.jwt_config()).map_err(|_| unauthorized("Invalid token"))?;
        Ok(claims)
    }
}

impl<T> AuthDepot for Arc<T>
where
    T: AuthDepot,
{
    fn auth_db(&self) -> &sqlx::PgPool {
        (**self).auth_db()
    }
    fn jwt_config(&self) -> &JwtConfig {
        (**self).jwt_config()
    }
}

impl AuthDepot for crate::routes::AuthState {
    fn auth_db(&self) -> &sqlx::PgPool {
        &self.db
    }
    fn jwt_config(&self) -> &JwtConfig {
        &self.config.jwt
    }
}

pub async fn require_admin(
    auth: AuthExtractor,
    request: Request,
    next: Next,
) -> Result<Response, Response> {
    if auth.user.role != crate::models::UserRole::Admin
        && auth.user.role != crate::models::UserRole::SuperAdmin
    {
        return Err(forbidden("Forbidden: Admin required"));
    }
    Ok(next.run(request).await)
}

pub async fn require_super_admin(
    auth: AuthExtractor,
    request: Request,
    next: Next,
) -> Result<Response, Response> {
    if auth.user.role != crate::models::UserRole::SuperAdmin {
        return Err(forbidden("Forbidden: Super admin required"));
    }
    Ok(next.run(request).await)
}
