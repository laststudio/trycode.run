use axum::{
    extract::{Json, State},
    http::{HeaderMap, StatusCode},
};
use axum_extra::extract::CookieJar;
use chrono::{DateTime, Utc};
use std::sync::Arc;
use time::Duration as CookieDuration;
use tracing::{info, warn};
use uuid::Uuid;

use crate::{
    email::EmailService,
    jwt::{
        create_access_token, create_refresh_token, hash_password, hash_verification_code,
        verify_password, generate_verification_code, Claims, JwtConfig,
    },
    models::{
        AuthResponse, ChangePasswordRequest, EmailVerification, ForgotPasswordRequest,
        LoginRequest, RefreshTokenRequest, RegisterRequest, ResetPasswordRequest, Session, User,
        UserProfile, VerifyEmailRequest,
    },
    CaptchaVerifier,
};
use trycode_core::config::{AppConfig, CaptchaAction};
use trycode_core::{CoreError, Result};

pub type RateLimiterType = governor::DefaultKeyedRateLimiter<String>;

pub struct AuthState {
    pub config: AppConfig,
    pub db: sqlx::PgPool,
    pub redis: deadpool_redis::Pool,
    pub email_service: Arc<EmailService>,
    pub captcha_verifier: Box<dyn CaptchaVerifier>,
    pub login_limiter: Arc<RateLimiterType>,
    pub register_limiter: Arc<RateLimiterType>,
    pub execute_limiter: Arc<RateLimiterType>,
}

fn get_client_ip(headers: &HeaderMap) -> Option<String> {
    headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.split(',').next())
        .map(|s| s.trim().to_string())
        .or_else(|| {
            headers
                .get("x-real-ip")
                .and_then(|v| v.to_str().ok())
                .map(|s| s.to_string())
        })
}

pub fn set_auth_cookies(
    jar: CookieJar,
    access_token: &str,
    refresh_token: &str,
    config: &JwtConfig,
) -> CookieJar {
    let access_cookie = axum_extra::extract::cookie::Cookie::build((
        "access_token",
        access_token.to_string(),
    ))
    .http_only(true)
    .same_site(axum_extra::extract::cookie::SameSite::Lax)
    .path("/")
    .max_age(CookieDuration::seconds(config.access_token_ttl_secs as i64))
    .build();

    let refresh_cookie = axum_extra::extract::cookie::Cookie::build((
        "refresh_token",
        refresh_token.to_string(),
    ))
    .http_only(true)
    .same_site(axum_extra::extract::cookie::SameSite::Lax)
    .path("/api/auth")
    .max_age(CookieDuration::seconds(
        config.refresh_token_ttl_secs as i64,
    ))
    .build();

    jar.add(access_cookie).add(refresh_cookie)
}

pub fn clear_auth_cookies(jar: CookieJar) -> CookieJar {
    let access_cookie = axum_extra::extract::cookie::Cookie::build(("access_token", ""))
        .http_only(true)
        .same_site(axum_extra::extract::cookie::SameSite::Lax)
        .path("/")
        .max_age(CookieDuration::seconds(0))
        .build();

    let refresh_cookie = axum_extra::extract::cookie::Cookie::build(("refresh_token", ""))
        .http_only(true)
        .same_site(axum_extra::extract::cookie::SameSite::Lax)
        .path("/api/auth")
        .max_age(CookieDuration::seconds(0))
        .build();

    jar.add(access_cookie).add(refresh_cookie)
}

async fn insert_session(db: &sqlx::PgPool, user_id: Uuid, token_hash: &str, ip: Option<String>, ua: Option<&str>) -> Result<()> {
    sqlx::query(
        r#"
        INSERT INTO sessions (user_id, token_hash, expires_at, ip_address, user_agent)
        VALUES ($1, $2, NOW() + INTERVAL '7 days', $3::inet, $4)
        "#,
    )
    .bind(user_id)
    .bind(token_hash)
    .bind(ip)
    .bind(ua)
    .execute(db)
    .await?;
    Ok(())
}

pub async fn register(
    State(state): State<Arc<AuthState>>,
    headers: HeaderMap,
    Json(payload): Json<RegisterRequest>,
) -> Result<(StatusCode, CookieJar, Json<AuthResponse>)> {
    let client_ip = get_client_ip(&headers);

    // Check registration enabled
    if !state.config.features.registration_enabled {
        return Err(CoreError::Forbidden("Registration is disabled".to_string()));
    }

    // Rate limiting
    let key = client_ip.clone().unwrap_or_default();
    if state.register_limiter.check_key(&key).is_err() {
        return Err(CoreError::RateLimited("Too many registration attempts".to_string()));
    }

    // CAPTCHA verification
    if state.config.captcha.enabled
        && state.config.captcha.actions.contains(&CaptchaAction::Register)
    {
        let token = payload
            .captcha_token
            .ok_or_else(|| CoreError::Validation("CAPTCHA required".to_string()))?;
        let verified = state
            .captcha_verifier
            .verify(&token, Some(CaptchaAction::Register), client_ip.clone())
            .await
            .map_err(|e| CoreError::ExternalService(e.to_string()))?;
        if !verified {
            return Err(CoreError::Validation("CAPTCHA verification failed".to_string()));
        }
    }

    // Validate email format
    if !payload.email.contains('@') {
        return Err(CoreError::Validation("Invalid email format".to_string()));
    }

    // Validate password strength
    if payload.password.len() < 8 {
        return Err(CoreError::Validation(
            "Password must be at least 8 characters".to_string(),
        ));
    }

    // Check if user exists
    let existing: Option<(Uuid,)> =
        sqlx::query_as("SELECT id FROM users WHERE email = $1")
            .bind(&payload.email)
            .fetch_optional(&state.db)
            .await?;

    if existing.is_some() {
        return Err(CoreError::Conflict("Email already registered".to_string()));
    }

    // Hash password
    let password_hash = hash_password(&payload.password, &state.config.argon2)?;

    // Create user
    let user_id = Uuid::new_v4();
    let verification_code = generate_verification_code();
    let code_hash = hash_verification_code(&verification_code);

    let requires_verification = state.config.features.email_verification_required;
    let status = if requires_verification { "pending" } else { "active" };

    sqlx::query(
        r#"
        INSERT INTO users (id, email, password_hash, name, role, status, email_verified)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        "#,
    )
    .bind(user_id)
    .bind(&payload.email)
    .bind(&password_hash)
    .bind(&payload.name)
    .bind("user")
    .bind(status)
    .bind(!requires_verification)
    .execute(&state.db)
    .await?;

    // Store verification code
    if requires_verification {
        sqlx::query(
            r#"
            INSERT INTO email_verifications (email, code_hash, purpose, expires_at)
            VALUES ($1, $2, 'register', NOW() + INTERVAL '10 minutes')
            "#,
        )
        .bind(&payload.email)
        .bind(&code_hash)
        .execute(&state.db)
        .await?;

        // Send verification email
        if let Err(e) = state
            .email_service
            .send_verification_code(&payload.email, &verification_code, "register")
            .await
        {
            warn!("Failed to send verification email: {}", e);
        }
    }

    // Create tokens
    let access_token = create_access_token(
        user_id,
        payload.email.clone(),
        "user".to_string(),
        &state.config.jwt,
    )?;
    let refresh_token = create_refresh_token(
        user_id,
        payload.email.clone(),
        "user".to_string(),
        &state.config.jwt,
    )?;

    // Store refresh token
    let token_hash = hash_verification_code(&refresh_token);
    insert_session(
        &state.db,
        user_id,
        &token_hash,
        client_ip.as_deref().and_then(|s| s.parse().ok()),
        None,
    )
    .await?;

    let user = UserProfile {
        id: user_id,
        email: payload.email.clone(),
        name: payload.name.clone(),
        avatar_url: None,
        role: crate::models::UserRole::User,
        email_verified: !requires_verification,
        created_at: Utc::now(),
    };

    let jar = set_auth_cookies(CookieJar::new(), &access_token, &refresh_token, &state.config.jwt);

    info!("User registered: {}", user.id);

    Ok((
        StatusCode::CREATED,
        jar,
        Json(AuthResponse {
            access_token,
            refresh_token,
            token_type: "Bearer".to_string(),
            expires_in: state.config.jwt.access_token_ttl_secs,
            user,
        }),
    ))
}

pub async fn login(
    State(state): State<Arc<AuthState>>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(payload): Json<LoginRequest>,
) -> Result<(CookieJar, Json<AuthResponse>)> {
    let client_ip = get_client_ip(&headers);

    // Rate limiting
    let key = client_ip.clone().unwrap_or_default();
    if state.login_limiter.check_key(&key).is_err() {
        return Err(CoreError::RateLimited("Too many login attempts".to_string()));
    }

    // CAPTCHA verification
    if state.config.captcha.enabled
        && state.config.captcha.actions.contains(&CaptchaAction::Login)
    {
        let token = payload
            .captcha_token
            .clone()
            .ok_or_else(|| CoreError::Validation("CAPTCHA required".to_string()))?;
        let verified = state
            .captcha_verifier
            .verify(&token, Some(CaptchaAction::Login), client_ip.clone())
            .await
            .map_err(|e| CoreError::ExternalService(e.to_string()))?;
        if !verified {
            return Err(CoreError::Validation("CAPTCHA verification failed".to_string()));
        }
    }

    // Find user
    let user: Option<User> = sqlx::query_as("SELECT * FROM users WHERE email = $1")
        .bind(&payload.email)
        .fetch_optional(&state.db)
        .await?;

    let user = user.ok_or_else(|| CoreError::Unauthorized("Invalid credentials".to_string()))?;

    // Check account status
    match user.status {
        crate::models::UserStatus::Suspended => {
            return Err(CoreError::Forbidden("Account suspended".to_string()))
        }
        crate::models::UserStatus::Banned => {
            return Err(CoreError::Forbidden("Account banned".to_string()))
        }
        crate::models::UserStatus::Pending => {
            if state.config.features.email_verification_required && !user.email_verified {
                return Err(CoreError::Forbidden(
                    "Please verify your email first".to_string(),
                ));
            }
        }
        _ => {}
    }

    // Check if locked
    if let Some(locked_until) = user.locked_until {
        if locked_until > Utc::now() {
            return Err(CoreError::Forbidden("Account temporarily locked".to_string()));
        }
    }

    // Verify password
    if !verify_password(&payload.password, &user.password_hash)? {
        // Increment failed attempts
        let new_attempts = user.failed_login_attempts + 1;
        let locked_until: Option<DateTime<Utc>> = if new_attempts >= 5 {
            Some(Utc::now() + chrono::Duration::minutes(15))
        } else {
            None
        };

        sqlx::query(
            "UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3",
        )
        .bind(new_attempts)
        .bind(locked_until)
        .bind(user.id)
        .execute(&state.db)
        .await?;

        return Err(CoreError::Unauthorized("Invalid credentials".to_string()));
    }

    // Reset failed attempts on successful login
    sqlx::query(
        "UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = $1",
    )
    .bind(user.id)
    .execute(&state.db)
    .await?;

    // Check email verification
    if state.config.features.email_verification_required && !user.email_verified {
        return Err(CoreError::Forbidden(
            "Please verify your email first".to_string(),
        ));
    }

    // Create tokens
    let access_token = create_access_token(
        user.id,
        user.email.clone(),
        user.role.to_string().to_lowercase(),
        &state.config.jwt,
    )?;
    let refresh_token = create_refresh_token(
        user.id,
        user.email.clone(),
        user.role.to_string().to_lowercase(),
        &state.config.jwt,
    )?;

    // Store refresh token
    let token_hash = hash_verification_code(&refresh_token);
    insert_session(
        &state.db,
        user.id,
        &token_hash,
        client_ip.as_deref().and_then(|s| s.parse().ok()),
        headers.get("user-agent").and_then(|v| v.to_str().ok()),
    )
    .await?;

    let jar = set_auth_cookies(jar, &access_token, &refresh_token, &state.config.jwt);

    info!("User logged in: {}", user.id);

    Ok((
        jar,
        Json(AuthResponse {
            access_token,
            refresh_token,
            token_type: "Bearer".to_string(),
            expires_in: state.config.jwt.access_token_ttl_secs,
            user: user.into(),
        }),
    ))
}

pub async fn logout(
    State(state): State<Arc<AuthState>>,
    jar: CookieJar,
    claims: Claims,
) -> Result<CookieJar> {
    // Delete the session
    let refresh_token = jar.get("refresh_token").map(|c| c.value().to_string());
    if let Some(token) = refresh_token {
        let token_hash = hash_verification_code(&token);
        sqlx::query("DELETE FROM sessions WHERE token_hash = $1 AND user_id = $2")
            .bind(token_hash)
            .bind(&claims.sub)
            .execute(&state.db)
            .await?;
    }

    Ok(clear_auth_cookies(jar))
}

pub async fn refresh_token(
    State(state): State<Arc<AuthState>>,
    jar: CookieJar,
    Json(payload): Json<RefreshTokenRequest>,
) -> Result<(CookieJar, Json<AuthResponse>)> {
    let provided = payload
        .refresh_token
        .clone()
        .or_else(|| jar.get("refresh_token").map(|c| c.value().to_string()));
    let refresh_token = provided
        .ok_or_else(|| CoreError::Unauthorized("Refresh token required".to_string()))?;

    let token_hash = hash_verification_code(&refresh_token);

    // Find session
    let session: Option<Session> =
        sqlx::query_as("SELECT * FROM sessions WHERE token_hash = $1 AND expires_at > NOW()")
            .bind(&token_hash)
            .fetch_optional(&state.db)
            .await?;

    let session = session.ok_or_else(|| {
        CoreError::Unauthorized("Invalid or expired refresh token".to_string())
    })?;

    // Get user
    let user: User = sqlx::query_as("SELECT * FROM users WHERE id = $1")
        .bind(session.user_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| CoreError::Unauthorized("User not found".to_string()))?;

    // Check user status
    if user.status != crate::models::UserStatus::Active {
        return Err(CoreError::Forbidden("Account not active".to_string()));
    }

    // Create new tokens
    let access_token = create_access_token(
        user.id,
        user.email.clone(),
        user.role.to_string().to_lowercase(),
        &state.config.jwt,
    )?;
    let new_refresh_token = create_refresh_token(
        user.id,
        user.email.clone(),
        user.role.to_string().to_lowercase(),
        &state.config.jwt,
    )?;

    // Rotate refresh token - delete old, insert new
    let new_token_hash = hash_verification_code(&new_refresh_token);
    sqlx::query("DELETE FROM sessions WHERE token_hash = $1")
        .bind(&token_hash)
        .execute(&state.db)
        .await?;

    insert_session(&state.db, user.id, &new_token_hash, None, None).await?;

    let jar = set_auth_cookies(jar, &access_token, &new_refresh_token, &state.config.jwt);

    Ok((
        jar,
        Json(AuthResponse {
            access_token,
            refresh_token: new_refresh_token,
            token_type: "Bearer".to_string(),
            expires_in: state.config.jwt.access_token_ttl_secs,
            user: user.into(),
        }),
    ))
}

pub async fn verify_email(
    State(state): State<Arc<AuthState>>,
    Json(payload): Json<VerifyEmailRequest>,
) -> Result<Json<AuthResponse>> {
    let code_hash = hash_verification_code(&payload.code);

    // Find verification record
    let verification: Option<EmailVerification> = sqlx::query_as(
        r#"SELECT * FROM email_verifications
           WHERE email = $1 AND code_hash = $2 AND purpose = 'register' AND expires_at > NOW()"#,
    )
    .bind(&payload.email)
    .bind(&code_hash)
    .fetch_optional(&state.db)
    .await?;

    let verification = verification
        .ok_or_else(|| CoreError::Validation("Invalid or expired verification code".to_string()))?;

    // Update user
    let user: User = sqlx::query_as(
        r#"UPDATE users SET email_verified = TRUE, email_verified_at = NOW(), status = 'active'
           WHERE email = $1 RETURNING *"#,
    )
    .bind(&payload.email)
    .fetch_one(&state.db)
    .await?;

    // Delete verification record
    sqlx::query("DELETE FROM email_verifications WHERE id = $1")
        .bind(verification.id)
        .execute(&state.db)
        .await?;

    // Create tokens
    let access_token = create_access_token(
        user.id,
        user.email.clone(),
        user.role.to_string().to_lowercase(),
        &state.config.jwt,
    )?;
    let refresh_token = create_refresh_token(
        user.id,
        user.email.clone(),
        user.role.to_string().to_lowercase(),
        &state.config.jwt,
    )?;

    // Store refresh token
    let token_hash = hash_verification_code(&refresh_token);
    insert_session(&state.db, user.id, &token_hash, None, None).await?;

    // Send welcome email
    if let Err(e) = state.email_service.send_welcome(&user.email, &user.name).await {
        warn!("Failed to send welcome email: {}", e);
    }

    Ok(Json(AuthResponse {
        access_token,
        refresh_token,
        token_type: "Bearer".to_string(),
        expires_in: state.config.jwt.access_token_ttl_secs,
        user: user.into(),
    }))
}

pub async fn resend_verification(
    State(state): State<Arc<AuthState>>,
    headers: HeaderMap,
    Json(payload): Json<ForgotPasswordRequest>, // Reuse email-only payload
) -> Result<StatusCode> {
    let client_ip = get_client_ip(&headers);

    if state.config.captcha.enabled {
        let token = payload
            .captcha_token
            .clone()
            .ok_or_else(|| CoreError::Validation("CAPTCHA required".to_string()))?;
        let verified = state
            .captcha_verifier
            .verify(&token, Some(CaptchaAction::Register), client_ip.clone())
            .await
            .map_err(|e| CoreError::ExternalService(e.to_string()))?;
        if !verified {
            return Err(CoreError::Validation("CAPTCHA verification failed".to_string()));
        }
    }

    // Check if user exists and needs verification
    let user: Option<User> =
        sqlx::query_as("SELECT * FROM users WHERE email = $1 AND status = 'pending'")
            .bind(&payload.email)
            .fetch_optional(&state.db)
            .await?;

    if user.is_none() {
        // Don't reveal if email exists
        return Ok(StatusCode::OK);
    }

    // Generate new code
    let code = generate_verification_code();
    let code_hash = hash_verification_code(&code);

    // Update verification record
    sqlx::query(
        r#"
        INSERT INTO email_verifications (email, code_hash, purpose, expires_at)
        VALUES ($1, $2, 'register', NOW() + INTERVAL '10 minutes')
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(&payload.email)
    .bind(&code_hash)
    .execute(&state.db)
    .await?;

    // Send email
    if let Err(e) = state
        .email_service
        .send_verification_code(&payload.email, &code, "register")
        .await
    {
        warn!("Failed to send verification email: {}", e);
    }

    Ok(StatusCode::OK)
}

pub async fn forgot_password(
    State(state): State<Arc<AuthState>>,
    headers: HeaderMap,
    Json(payload): Json<ForgotPasswordRequest>,
) -> Result<StatusCode> {
    let client_ip = get_client_ip(&headers);

    if state.config.captcha.enabled {
        let token = payload
            .captcha_token
            .clone()
            .ok_or_else(|| CoreError::Validation("CAPTCHA required".to_string()))?;
        let verified = state
            .captcha_verifier
            .verify(&token, Some(CaptchaAction::Login), client_ip.clone())
            .await
            .map_err(|e| CoreError::ExternalService(e.to_string()))?;
        if !verified {
            return Err(CoreError::Validation("CAPTCHA verification failed".to_string()));
        }
    }

    let user: Option<User> = sqlx::query_as("SELECT * FROM users WHERE email = $1")
        .bind(&payload.email)
        .fetch_optional(&state.db)
        .await?;

    if user.is_none() {
        return Ok(StatusCode::OK); // Don't reveal
    }

    // Generate reset code
    let code = generate_verification_code();
    let code_hash = hash_verification_code(&code);

    sqlx::query(
        r#"
        INSERT INTO email_verifications (email, code_hash, purpose, expires_at)
        VALUES ($1, $2, 'reset_password', NOW() + INTERVAL '1 hour')
        "#,
    )
    .bind(&payload.email)
    .bind(&code_hash)
    .execute(&state.db)
    .await?;

    // Send reset email
    let reset_link = format!(
        "https://trycode.run/reset-password?email={}&code={}",
        payload.email, code
    );
    if let Err(e) = state
        .email_service
        .send_password_reset(&payload.email, &reset_link)
        .await
    {
        warn!("Failed to send password reset email: {}", e);
    }

    Ok(StatusCode::OK)
}

pub async fn reset_password(
    State(state): State<Arc<AuthState>>,
    Json(payload): Json<ResetPasswordRequest>,
) -> Result<StatusCode> {
    let code_hash = hash_verification_code(&payload.code);

    let verification: Option<EmailVerification> = sqlx::query_as(
        r#"SELECT * FROM email_verifications
           WHERE email = $1 AND code_hash = $2 AND purpose = 'reset_password' AND expires_at > NOW()"#,
    )
    .bind(&payload.email)
    .bind(&code_hash)
    .fetch_optional(&state.db)
    .await?;

    let _verification = verification
        .ok_or_else(|| CoreError::Validation("Invalid or expired reset code".to_string()))?;

    // Hash new password
    let password_hash = hash_password(&payload.new_password, &state.config.argon2)?;

    // Update user password
    sqlx::query(
        "UPDATE users SET password_hash = $1, failed_login_attempts = 0, locked_until = NULL WHERE email = $2",
    )
    .bind(password_hash)
    .bind(&payload.email)
    .execute(&state.db)
    .await?;

    // Delete all sessions for this user
    sqlx::query(
        "DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = $1)",
    )
    .bind(&payload.email)
    .execute(&state.db)
    .await?;

    // Delete verification record
    sqlx::query(
        "DELETE FROM email_verifications WHERE email = $1 AND purpose = 'reset_password'",
    )
    .bind(&payload.email)
    .execute(&state.db)
    .await?;

    Ok(StatusCode::OK)
}

pub async fn change_password(
    State(state): State<Arc<AuthState>>,
    claims: Claims,
    Json(payload): Json<ChangePasswordRequest>,
) -> Result<StatusCode> {
    let user_id: Uuid = claims
        .sub
        .parse()
        .map_err(|_| CoreError::Unauthorized("Invalid token subject".to_string()))?;

    let user: Option<User> = sqlx::query_as("SELECT * FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?;

    let user =
        user.ok_or_else(|| CoreError::Unauthorized("User not found".to_string()))?;

    // Verify current password
    if !verify_password(&payload.current_password, &user.password_hash)? {
        return Err(CoreError::Unauthorized(
            "Current password is incorrect".to_string(),
        ));
    }

    // Hash new password
    let password_hash = hash_password(&payload.new_password, &state.config.argon2)?;

    sqlx::query("UPDATE users SET password_hash = $1 WHERE id = $2")
        .bind(password_hash)
        .bind(user.id)
        .execute(&state.db)
        .await?;

    // Delete all other sessions
    sqlx::query(
        "DELETE FROM sessions WHERE user_id = $1 AND token_hash != (
            SELECT token_hash FROM sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1
        )",
    )
    .bind(user.id)
    .execute(&state.db)
    .await?;

    Ok(StatusCode::OK)
}

pub async fn me(
    claims: Claims,
    State(state): State<Arc<AuthState>>,
) -> Result<Json<UserProfile>> {
    let user_id: Uuid = claims
        .sub
        .parse()
        .map_err(|_| CoreError::Unauthorized("Invalid token subject".to_string()))?;

    let user: Option<User> = sqlx::query_as("SELECT * FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?;

    let user =
        user.ok_or_else(|| CoreError::Unauthorized("User not found".to_string()))?;

    Ok(Json(user.into()))
}
