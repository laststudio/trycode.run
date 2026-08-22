use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{Html, Redirect},
};
use oauth2::{
    basic::BasicClient, AuthUrl, AuthorizationCode, ClientId, ClientSecret, CsrfToken, PkceCodeChallenge, PkceCodeVerifier,
    RedirectUrl, Scope, TokenResponse, TokenUrl,
};
use oauth2::reqwest::async_http_client;
use secrecy::ExposeSecret;
use serde::Deserialize;
use sqlx::PgPool;
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::{config::GitHubOAuthConfig, jwt::{create_access_token, create_refresh_token, hash_verification_code, Claims, JwtConfig}, models::{AuthResponse, User, UserRole}, routes::AuthState};

#[derive(Deserialize)]
pub struct OAuthCallbackQuery {
    code: Option<String>,
    state: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
}

pub fn create_github_client(config: &GitHubOAuthConfig) -> BasicClient {
    BasicClient::new(
        ClientId::new(config.client_id.clone()),
        Some(ClientSecret::new(config.client_secret.expose_secret().to_string())),
        AuthUrl::new("https://github.com/login/oauth/authorize".to_string()).unwrap(),
        Some(TokenUrl::new("https://github.com/login/oauth/access_token".to_string()).unwrap()),
    )
    .set_redirect_uri(RedirectUrl::new(config.redirect_url.clone()).unwrap())
}

pub async fn github_login(
    State(state): State<Arc<AuthState>>,
) -> Result<Redirect, StatusCode> {
    if !state.config.oauth.github.enabled {
        return Err(StatusCode::NOT_FOUND);
    }

    let client = create_github_client(&state.config.oauth.github);
    let (pkce_challenge, pkce_verifier) = PkceCodeChallenge::new_random_sha256();
    let (auth_url, csrf_token) = client
        .authorize_url(CsrfToken::new_random)
        .add_scope(Scope::new("read:user".to_string()))
        .add_scope(Scope::new("user:email".to_string()))
        .set_pkce_challenge(pkce_challenge)
        .url();

    // Store PKCE verifier and CSRF token in session/redis with short TTL
    // For simplicity, we'll encode them in the state parameter
    let state_data = format!("{}:{}", csrf_token.secret(), pkce_verifier.secret());
    let encoded_state = base64::encode(state_data);

    let auth_url_with_state = format!("{}&state={}", auth_url, encoded_state);
    Ok(Redirect::to(&auth_url_with_state))
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

    let code = query.code.ok_or_else(|| (StatusCode::BAD_REQUEST, "Missing code".to_string()))?;
    let state_param = query.state.ok_or_else(|| (StatusCode::BAD_REQUEST, "Missing state".to_string()))?;

    // Decode state to get CSRF token and PKCE verifier
    let decoded = base64::decode(&state_param)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid state".to_string()))?;
    let state_str = String::from_utf8(decoded)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid state encoding".to_string()))?;

    let parts: Vec<&str> = state_str.split(':').collect();
    if parts.len() != 2 {
        return Err((StatusCode::BAD_REQUEST, "Invalid state format".to_string()));
    }

    let _csrf_token = parts[0];
    let pkce_verifier = PkceCodeVerifier::new(parts[1].to_string());

    let client = create_github_client(&state.config.oauth.github);

    // Exchange code for token
    let token_result = client
        .exchange_code(AuthorizationCode::new(code))
        .set_pkce_verifier(pkce_verifier)
        .request_async(async_http_client)
        .await
        .map_err(|e| {
            error!("Token exchange failed: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Token exchange failed".to_string())
        })?;

    let access_token = token_result.access_token().secret().to_string();

    // Get user info from GitHub
    let github_user = get_github_user(&access_token).await
        .map_err(|e| {
            error!("Failed to get GitHub user: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to get user info".to_string())
        })?;

    // Check allowed domains
    if !state.config.oauth.github.allowed_domains.is_empty() {
        let email = github_user.email.as_deref().unwrap_or("");
        let allowed = state.config.oauth.github.allowed_domains.iter().any(|d| email.ends_with(&format!("@{}", d)));
        if !allowed {
            return Ok((jar, Html(oauth_error_page("Email domain not allowed"))));
        }
    }

    // Check if OAuth account exists
    let oauth_account = sqlx::query!(
        "SELECT * FROM oauth_accounts WHERE provider = 'github' AND provider_user_id = $1",
        github_user.id.to_string()
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        error!("DB error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Database error".to_string())
    })?;

    let user = if let Some(account) = oauth_account {
        // Existing OAuth account - get user
        sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", account.user_id)
            .fetch_one(&state.db)
            .await
            .map_err(|e| {
                error!("User not found: {}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "User not found".to_string())
            })?
    } else if state.config.oauth.github.auto_create_user {
        // Create new user
        let email = github_user.email.clone().unwrap_or_else(|| format!("github-{}@users.noreply.github.com", github_user.id));
        
        let existing_user = sqlx::query_as!(User, "SELECT * FROM users WHERE email = $1", email)
            .fetch_optional(&state.db)
            .await
            .map_err(|e| {
                error!("DB error: {}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "Database error".to_string())
            })?;

        let user = if let Some(user) = existing_user {
            // Link OAuth account to existing user
            sqlx::query!(
                r#"
                INSERT INTO oauth_accounts (user_id, provider, provider_user_id, provider_username, provider_email, access_token_encrypted, scope)
                VALUES ($1, 'github', $2, $3, $4, $5, $6)
                "#,
                user.id,
                github_user.id.to_string(),
                github_user.login,
                github_user.email,
                access_token,
                "read:user,user:email"
            )
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
            sqlx::query!(
                r#"
                INSERT INTO users (id, email, password_hash, name, role, status, email_verified, avatar_url)
                VALUES ($1, $2, '', $3, $4, 'active', TRUE, $5)
                "#,
                user_id,
                email,
                github_user.name.unwrap_or(github_user.login.clone()),
                state.config.oauth.github.default_role.to_string().to_lowercase(),
                github_user.avatar_url
            )
            .execute(&state.db)
            .await
            .map_err(|e| {
                error!("Failed to create user: {}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "Failed to create user".to_string())
            })?;

            sqlx::query!(
                r#"
                INSERT INTO oauth_accounts (user_id, provider, provider_user_id, provider_username, provider_email, access_token_encrypted, scope)
                VALUES ($1, 'github', $2, $3, $4, $5, $6)
                "#,
                user_id,
                github_user.id.to_string(),
                github_user.login,
                github_user.email,
                access_token,
                "read:user,user:email"
            )
            .execute(&state.db)
            .await
            .map_err(|e| {
                error!("Failed to create OAuth account: {}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "Failed to create OAuth account".to_string())
            })?;

            sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", user_id)
                .fetch_one(&state.db)
                .await
                .map_err(|e| {
                    error!("Failed to fetch new user: {}", e);
                    (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch user".to_string())
                })?
        };

        user
    } else {
        return Ok((jar, Html(oauth_error_page("Account not linked. Please register first."))));
    };

    // Create JWT tokens
    let access_token = create_access_token(user.id, user.email.clone(), user.role.to_string().to_lowercase(), &state.config.jwt)
        .map_err(|e| {
            error!("JWT creation failed: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Token creation failed".to_string())
        })?;

    let refresh_token = create_refresh_token(user.id, user.email.clone(), user.role.to_string().to_lowercase(), &state.config.jwt)
        .map_err(|e| {
            error!("Refresh token creation failed: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Token creation failed".to_string())
        })?;

    // Store refresh token
    let token_hash = hash_verification_code(&refresh_token);
    sqlx::query!(
        r#"
        INSERT INTO sessions (user_id, token_hash, expires_at)
        VALUES ($1, $2, NOW() + $3)
        "#,
        user.id,
        token_hash,
        chrono::Duration::seconds(state.config.jwt.refresh_token_ttl_secs as i64)
    )
    .execute(&state.db)
    .await
    .map_err(|e| {
        error!("Failed to store session: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Session storage failed".to_string())
    })?;

    // Set cookies and redirect to frontend
    let jar = crate::routes::set_auth_cookies(jar, &access_token, &refresh_token, &state.config.jwt);
    
    let html = format!(
        r#"<!DOCTYPE html>
        <html><head><title>Login Successful</title></head>
        <body style="font-family: system-ui; text-align: center; padding: 50px;">
            <h1>Login Successful</h1>
            <p>Redirecting to TryCode...</p>
            <script>window.location.href = "/";</script>
        </body></html>"#
    );

    Ok((jar, Html(html)))
}

async fn get_github_user(access_token: &str) -> anyhow::Result<GitHubUser> {
    let client = reqwest::Client::new();
    
    // Get user profile
    let user: GitHubUser = client
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

        let primary = emails.iter().find(|e| e.primary && e.verified);
        if let Some(email) = primary {
            return Ok(GitHubUser { email: Some(email.email.clone()), ..user });
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