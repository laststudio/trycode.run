use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{Html, Redirect},
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use serde::Deserialize;
use tracing::{error, info};
use uuid::Uuid;

use crate::{
    jwt::{create_access_token, create_refresh_token, hash_verification_code},
    models::User,
    routes::{set_auth_cookies, AuthState},
};
use std::sync::Arc;

#[derive(Deserialize)]
pub struct OAuthCallbackQuery {
    code: Option<String>,
    state: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
}

pub async fn github_login(
    State(state): State<Arc<AuthState>>,
) -> Result<Redirect, StatusCode> {
    if !state.config.oauth.github.enabled {
        return Err(StatusCode::NOT_FOUND);
    }

    // 简化实现：state 参数携带随机 nonce（生产建议配合 Redis 存储 CSRF）
    let nonce = Uuid::new_v4();
    let encoded_state = URL_SAFE_NO_PAD.encode(format!("trycode:{nonce}"));

    let auth_url = format!(
        "https://github.com/login/oauth/authorize?client_id={}&redirect_uri={}&scope=read:user%20user:email&state={}",
        state.config.oauth.github.client_id,
        urlencoding::encode(&state.config.oauth.github.redirect_url),
        encoded_state,
    );

    Ok(Redirect::to(&auth_url))
}

pub async fn github_callback(
    State(state): State<Arc<AuthState>>,
    Query(query): Query<OAuthCallbackQuery>,
    jar: axum_extra::extract::CookieJar,
) -> Result<(axum_extra::extract::CookieJar, Html<String>), (StatusCode, String)> {
    if !state.config.oauth.github.enabled {
        return Err((StatusCode::NOT_FOUND, "OAuth not enabled".to_string()));
    }

    // Handle OAuth errors
    if let Some(error) = query.error {
        let desc = query.error_description.unwrap_or_default();
        error!("GitHub OAuth error: {} - {}", error, desc);
        return Ok((jar, Html(oauth_error_page(&format!("{}: {}", error, desc)))));
    }

    let code = query
        .code
        .ok_or_else(|| (StatusCode::BAD_REQUEST, "Missing code".to_string()))?;

    // Exchange code for token (直接调用 GitHub API)
    let client = reqwest::Client::new();
    #[derive(Deserialize)]
    struct TokenResponse {
        access_token: Option<String>,
        error_description: Option<String>,
    }

    let token_resp: TokenResponse = client
        .post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .json(&serde_json::json!({
            "client_id": state.config.oauth.github.client_id,
            "client_secret": state.config.oauth.github.client_secret,
            "code": code,
            "redirect_uri": state.config.oauth.github.redirect_url,
        }))
        .send()
        .await
        .map_err(|e| {
            error!("Token exchange failed: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Token exchange failed".to_string())
        })?
        .json()
        .await
        .map_err(|e| {
            error!("Token exchange parse failed: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Token exchange failed".to_string())
        })?;

    let access_token = token_resp.access_token.ok_or_else(|| {
        let desc = token_resp.error_description.unwrap_or_default();
        error!("GitHub token error: {}", desc);
        (StatusCode::UNAUTHORIZED, "Token exchange denied".to_string())
    })?;

    // Get user info from GitHub
    let github_user = get_github_user(&access_token).await.map_err(|e| {
        error!("Failed to get GitHub user: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Failed to get user info".to_string())
    })?;

    // Check allowed domains
    if !state.config.oauth.github.allowed_domains.is_empty() {
        let email = github_user.email.as_deref().unwrap_or("");
        let allowed = state
            .config
            .oauth
            .github
            .allowed_domains
            .iter()
            .any(|d| email.ends_with(&format!("@{}", d)));
        if !allowed {
            return Ok((jar, Html(oauth_error_page("Email domain not allowed"))));
        }
    }

    // Check if OAuth account exists
    let oauth_account: Option<(Uuid,)> =
        sqlx::query_as(
            "SELECT user_id FROM oauth_accounts WHERE provider = 'github' AND provider_user_id = $1",
        )
        .bind(github_user.id.to_string())
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            error!("DB error: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Database error".to_string())
        })?;

    let user = if let Some((existing_user_id,)) = oauth_account {
        // Existing OAuth account - get user
        sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
            .bind(existing_user_id)
            .fetch_one(&state.db)
            .await
            .map_err(|e| {
                error!("User not found: {}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "User not found".to_string())
            })?
    } else if state.config.oauth.github.auto_create_user {
        // Create new user
        let email = github_user
            .email
            .clone()
            .unwrap_or_else(|| format!("github-{}@users.noreply.github.com", github_user.id));

        let existing_user: Option<User> =
            sqlx::query_as("SELECT * FROM users WHERE email = $1")
                .bind(&email)
                .fetch_optional(&state.db)
                .await
                .map_err(|e| {
                    error!("DB error: {}", e);
                    (StatusCode::INTERNAL_SERVER_ERROR, "Database error".to_string())
                })?;

        if let Some(user) = existing_user {
            // Link OAuth account to existing user
            sqlx::query(
                r#"
                INSERT INTO oauth_accounts (user_id, provider, provider_user_id, provider_username, provider_email, access_token_encrypted, scope)
                VALUES ($1, 'github', $2, $3, $4, $5, $6)
                "#,
            )
            .bind(user.id)
            .bind(github_user.id.to_string())
            .bind(&github_user.login)
            .bind(&github_user.email)
            .bind(&access_token)
            .bind("read:user,user:email")
            .execute(&state.db)
            .await
            .map_err(|e| {
                error!("Failed to link OAuth: {}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "Failed to link account".to_string())
            })?;
            user
        } else {
            // Create new user
            let user_id = Uuid::new_v4();
            sqlx::query(
                r#"
                INSERT INTO users (id, email, password_hash, name, role, status, email_verified, avatar_url)
                VALUES ($1, $2, '', $3, $4, 'active', TRUE, $5)
                "#,
            )
            .bind(user_id)
            .bind(&email)
            .bind(github_user.name.clone().unwrap_or_else(|| github_user.login.clone()))
            .bind(state.config.oauth.github.default_role.to_string().to_lowercase())
            .bind(&github_user.avatar_url)
            .execute(&state.db)
            .await
            .map_err(|e| {
                error!("Failed to create user: {}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "Failed to create user".to_string())
            })?;

            sqlx::query(
                r#"
                INSERT INTO oauth_accounts (user_id, provider, provider_user_id, provider_username, provider_email, access_token_encrypted, scope)
                VALUES ($1, 'github', $2, $3, $4, $5, $6)
                "#,
            )
            .bind(user_id)
            .bind(github_user.id.to_string())
            .bind(&github_user.login)
            .bind(&github_user.email)
            .bind(&access_token)
            .bind("read:user,user:email")
            .execute(&state.db)
            .await
            .map_err(|e| {
                error!("Failed to create OAuth account: {}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "Failed to create OAuth account".to_string())
            })?;

            sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
                .bind(user_id)
                .fetch_one(&state.db)
                .await
                .map_err(|e| {
                    error!("Failed to fetch new user: {}", e);
                    (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch user".to_string())
                })?
        }
    } else {
        return Ok((
            jar,
            Html(oauth_error_page("Account not linked. Please register first.")),
        ));
    };

    let access_jwt = create_access_token(
        user.id,
        user.email.clone(),
        user.role.to_string().to_lowercase(),
        &state.config.jwt,
    )
    .map_err(|e| {
        error!("JWT creation failed: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Token creation failed".to_string())
    })?;

    let refresh_jwt = create_refresh_token(
        user.id,
        user.email.clone(),
        user.role.to_string().to_lowercase(),
        &state.config.jwt,
    )
    .map_err(|e| {
        error!("Refresh token creation failed: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Token creation failed".to_string())
    })?;

    // Store refresh token
    let token_hash = hash_verification_code(&refresh_jwt);
    sqlx::query(
        r#"
        INSERT INTO sessions (user_id, token_hash, expires_at)
        VALUES ($1, $2, NOW() + INTERVAL '7 days')
        "#,
    )
    .bind(user.id)
    .bind(token_hash)
    .execute(&state.db)
    .await
    .map_err(|e| {
        error!("Failed to store session: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Session storage failed".to_string())
    })?;

    // Set cookies and redirect to frontend
    let jar = set_auth_cookies(jar, &access_jwt, &refresh_jwt, &state.config.jwt);

    info!("GitHub OAuth login success for user {}", user.id);

    Ok((jar, Html(login_success_page())))
}

async fn get_github_user(access_token: &str) -> anyhow::Result<GitHubUser> {
    let client = reqwest::Client::new();

    // Get user profile
    let mut user: GitHubUser = client
        .get("https://api.github.com/user")
        .bearer_auth(access_token)
        .header("User-Agent", "TryCode")
        .send()
        .await?
        .json()
        .await?;

    // Get emails if not public
    if user.email.is_none() {
        let emails: Vec<GitHubEmail> = client
            .get("https://api.github.com/user/emails")
            .bearer_auth(access_token)
            .header("User-Agent", "TryCode")
            .send()
            .await?
            .json()
            .await?;

        if let Some(email) = emails.iter().find(|e| e.primary && e.verified) {
            user.email = Some(email.email.clone());
        }
    }

    Ok(user)
}

#[derive(Deserialize)]
struct GitHubUser {
    id: u64,
    login: String,
    name: Option<String>,
    email: Option<String>,
    avatar_url: Option<String>,
}

#[derive(Deserialize)]
struct GitHubEmail {
    email: String,
    primary: bool,
    verified: bool,
}

fn oauth_error_page(message: &str) -> String {
    format!(
        r#"<!DOCTYPE html>
        <html><head><title>Login Error</title></head>
        <body style="font-family: system-ui; text-align: center; padding: 50px;">
            <h1>Login Failed</h1>
            <p>{}</p>
            <a href="/login">Try Again</a>
        </body></html>"#,
        message
    )
}

fn login_success_page() -> String {
    r#"<!DOCTYPE html>
    <html><head><title>Login Successful</title></head>
    <body style="font-family: system-ui; text-align: center; padding: 50px;">
        <h1>Login Successful</h1>
        <p>Redirecting to TryCode...</p>
        <script>window.location.href = "/";</script>
    </body></html>"#
    .to_string()
}
