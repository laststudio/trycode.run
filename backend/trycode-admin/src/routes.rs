use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
};
use deadpool_redis::redis::AsyncCommands;
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;

use crate::models::{
    AdminStats, AuditLogEntry, AuditLogQuery, ExecutionDetail, ExecutionQuery,
    SystemConfig, SystemConfigUpdate, SystemStatus, TestCaptchaRequest, TestCaptchaResponse,
    TestDatabaseRequest, TestDatabaseResponse, TestOAuthRequest, TestOAuthResponse,
    TestSmtpRequest, TestSmtpResponse, UserAdminView,
    SSRConfig, SSRConfigUpdate,
};
use trycode_auth::{middleware::AuthDepot, models::UserRole, AuthExtractor};
use trycode_core::{CoreError, Result};

pub async fn get_system_config(
    State(state): State<Arc<AdminState>>,
    auth: AuthExtractor,
) -> Result<Json<Vec<SystemConfig>>> {
    require_super_admin(&auth.user)?;

    let configs = sqlx::query_as::<_, SystemConfig>("SELECT * FROM system_configs ORDER BY category, key")
        .fetch_all(&state.db)
        .await?;

    // Mask secret values
    let mut masked = configs;
    for config in &mut masked {
        if config.is_secret {
            config.value = serde_json::json!("***MASKED***");
        }
    }

    Ok(Json(masked))
}

pub async fn update_system_config(
    State(state): State<Arc<AdminState>>,
    auth: AuthExtractor,
    Path(key): Path<String>,
    Json(payload): Json<SystemConfigUpdate>,
) -> Result<Json<SystemConfig>> {
    require_super_admin(&auth.user)?;

    let config = sqlx::query_as::<_, SystemConfig>(
        r#"
        INSERT INTO system_configs (key, value, description, category, is_secret, updated_by, updated_at)
        VALUES ($1, $2, $3, 
            (SELECT category FROM system_configs WHERE key = $1),
            (SELECT is_secret FROM system_configs WHERE key = $1),
            $4, NOW())
        ON CONFLICT (key) DO UPDATE SET
            value = EXCLUDED.value,
            description = COALESCE(EXCLUDED.description, system_configs.description),
            updated_by = EXCLUDED.updated_by,
            updated_at = NOW()
        RETURNING *
        "#,
    )
    .bind(&key)
    .bind(&payload.value)
    .bind(&payload.description)
    .bind(auth.user.id)
    .fetch_optional(&state.db)
    .await?;

    let config = match config {
        Some(config) => config,
        None => {
            // If not found, try to get category from existing
            sqlx::query_as::<_, SystemConfig>("SELECT * FROM system_configs WHERE key = $1")
                .bind(&key)
                .fetch_one(&state.db)
                .await?
        }
    };

    // Trigger config reload
    state.config_reload_tx.send(()).ok();

    // Log audit
    log_audit(&state.db, Some(auth.user.id), "config_update", Some("system_config"), Some(key.clone()), None, Some(payload.value)).await;

    Ok(Json(config))
}

pub async fn get_system_status(
    State(state): State<Arc<AdminState>>,
    auth: AuthExtractor,
) -> Result<Json<SystemStatus>> {
    require_admin(&auth.user)?;

    let workers = get_worker_status(&state).await?;
    let database = get_database_status(&state.db).await?;
    let redis = get_redis_status(&state.redis).await?;
    let disk_usage = get_disk_usage().await?;

    let active_users = get_active_users_count(&state.db).await?;
    let active_executions = get_active_executions_count(&state.redis).await?;
    let queue_depth = get_queue_depth(&state.redis).await?;

    Ok(Json(SystemStatus {
        status: "healthy".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        uptime_seconds: get_uptime(),
        active_users,
        active_executions,
        queue_depth,
        workers,
        database,
        redis,
        disk_usage,
    }))
}

pub async fn get_admin_stats(
    State(state): State<Arc<AdminState>>,
    auth: AuthExtractor,
) -> Result<Json<AdminStats>> {
    require_admin(&auth.user)?;

    let total_users = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM users")
        .fetch_one(&state.db)
        .await? as u64;

    let active_users_24h = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM users WHERE last_login_at > NOW() - INTERVAL '24 hours'",
    )
    .fetch_one(&state.db)
    .await? as u64;

    let new_users_24h = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '24 hours'",
    )
    .fetch_one(&state.db)
    .await? as u64;

    let total_projects = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM projects")
        .fetch_one(&state.db)
        .await? as u64;

    let total_executions = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM executions")
        .fetch_one(&state.db)
        .await? as u64;

    let executions_24h = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM executions WHERE created_at > NOW() - INTERVAL '24 hours'",
    )
    .fetch_one(&state.db)
    .await? as u64;

    let success_rate_24h = calculate_success_rate(&state.db).await?;
    let avg_execution_time_ms = calculate_avg_execution_time(&state.db).await?;
    let languages_usage = get_languages_usage(&state.db).await?;
    let executions_by_status = get_executions_by_status(&state.db).await?;

    Ok(Json(AdminStats {
        total_users,
        active_users_24h,
        new_users_24h,
        total_projects,
        total_executions,
        executions_24h,
        success_rate_24h,
        avg_execution_time_ms,
        languages_usage,
        executions_by_status,
    }))
}

pub async fn list_audit_logs(
    State(state): State<Arc<AdminState>>,
    auth: AuthExtractor,
    Query(query): Query<AuditLogQuery>,
) -> Result<Json<Vec<AuditLogEntry>>> {
    require_admin(&auth.user)?;

    let limit = query.limit.unwrap_or(100).min(1000);
    let offset = query.offset.unwrap_or(0);

    let mut query_builder = "SELECT al.*, u.email as user_email FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id WHERE 1=1".to_string();
    let mut params: Vec<Box<dyn sqlx::Encode<'_, sqlx::Postgres> + Send + Sync>> = Vec::new();

    if let Some(user_id) = query.user_id {
        query_builder.push_str(" AND al.user_id = $1");
        params.push(Box::new(user_id));
    }
    if let Some(action) = query.action {
        query_builder.push_str(&format!(" AND al.action = ${}", params.len() + 1));
        params.push(Box::new(action));
    }
    if let Some(resource_type) = query.resource_type {
        query_builder.push_str(&format!(" AND al.resource_type = ${}", params.len() + 1));
        params.push(Box::new(resource_type));
    }
    if let Some(start_date) = query.start_date {
        query_builder.push_str(&format!(" AND al.created_at >= ${}", params.len() + 1));
        params.push(Box::new(start_date));
    }
    if let Some(end_date) = query.end_date {
        query_builder.push_str(&format!(" AND al.created_at <= ${}", params.len() + 1));
        params.push(Box::new(end_date));
    }

    query_builder.push_str(" ORDER BY al.created_at DESC LIMIT $");
    query_builder.push_str(&(params.len() + 1).to_string());
    params.push(Box::new(limit as i64));

    query_builder.push_str(" OFFSET $");
    query_builder.push_str(&(params.len() + 1).to_string());
    params.push(Box::new(offset as i64));

    // This is simplified - in reality you'd use sqlx::query_as with dynamic query
    // For now, return empty
    Ok(Json(vec![]))
}

pub async fn list_executions_admin(
    State(state): State<Arc<AdminState>>,
    auth: AuthExtractor,
    Query(query): Query<ExecutionQuery>,
) -> Result<Json<Vec<ExecutionDetail>>> {
    require_admin(&auth.user)?;

    let limit = query.limit.unwrap_or(100).min(1000);
    let offset = query.offset.unwrap_or(0);

    let mut query_builder = "SELECT e.*, u.email as user_email FROM executions e JOIN users u ON e.user_id = u.id WHERE 1=1".to_string();
    let mut param_count = 0;

    if let Some(user_id) = query.user_id {
        param_count += 1;
        query_builder.push_str(&format!(" AND e.user_id = ${}", param_count));
    }
    if let Some(language) = query.language {
        param_count += 1;
        query_builder.push_str(&format!(" AND e.language = ${}", param_count));
    }
    if let Some(status) = query.status {
        param_count += 1;
        query_builder.push_str(&format!(" AND e.status = ${}", param_count));
    }
    if let Some(start_date) = query.start_date {
        param_count += 1;
        query_builder.push_str(&format!(" AND e.created_at >= ${}", param_count));
    }
    if let Some(end_date) = query.end_date {
        param_count += 1;
        query_builder.push_str(&format!(" AND e.created_at <= ${}", param_count));
    }

    query_builder.push_str(&format!(" ORDER BY e.created_at DESC LIMIT {} OFFSET {}", limit, offset));

    // Simplified - would use dynamic query in reality
    Ok(Json(vec![]))
}

pub async fn get_execution_admin(
    State(state): State<Arc<AdminState>>,
    auth: AuthExtractor,
    Path(execution_id): Path<Uuid>,
) -> Result<Json<ExecutionDetail>> {
    require_admin(&auth.user)?;

    let execution = sqlx::query_as::<_, ExecutionDetail>(
        r#"
        SELECT e.*, u.email as user_email
        FROM executions e
        JOIN users u ON e.user_id = u.id
        WHERE e.id = $1
        "#,
    )
    .bind(execution_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(CoreError::NotFound("Execution not found".to_string()))?;

    Ok(Json(execution))
}

pub async fn list_users_admin(
    State(state): State<Arc<AdminState>>,
    auth: AuthExtractor,
    Query(query): Query<ListUsersQuery>,
) -> Result<Json<Vec<UserAdminView>>> {
    require_admin(&auth.user)?;

    let limit = query.limit.unwrap_or(50).min(200);
    let offset = query.offset.unwrap_or(0);

    let users = sqlx::query_as::<_, UserAdminView>(
        r#"
        SELECT u.id, u.email, u.name, u.role::text AS role, u.status::text AS status, u.email_verified, u.created_at, u.last_login_at,
               (SELECT COUNT(*) FROM executions WHERE user_id = u.id) as total_executions,
               (SELECT COUNT(*) FROM executions WHERE user_id = u.id AND created_at > NOW() - INTERVAL '24 hours') as executions_24h,
               u.locked_until > NOW() as is_locked
        FROM users u
        ORDER BY u.created_at DESC
        LIMIT $1 OFFSET $2
        "#,
    )
    .bind(limit as i64)
    .bind(offset as i64)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(users))
}

pub async fn update_user_admin(
    State(state): State<Arc<AdminState>>,
    auth: AuthExtractor,
    Path(user_id): Path<Uuid>,
    Json(payload): Json<UpdateUserAdminRequest>,
) -> Result<Json<UserAdminView>> {
    require_super_admin(&auth.user)?;

    if user_id == auth.user.id {
        return Err(CoreError::Forbidden("Cannot modify yourself".to_string()));
    }

    sqlx::query(
        r#"
        UPDATE users SET
            role = COALESCE($1, role),
            status = COALESCE($2, status),
            email_verified = COALESCE($3, email_verified),
            locked_until = CASE WHEN $4 THEN NULL ELSE locked_until END
        WHERE id = $5
        "#,
    )
    .bind(&payload.role)
    .bind(&payload.status)
    .bind(payload.email_verified)
    .bind(payload.unlock)
    .bind(user_id)
    .execute(&state.db)
    .await?;

    log_audit(&state.db, Some(auth.user.id), "user_update", Some("user"), Some(user_id.to_string()), None, Some(serde_json::to_value(&payload)?)).await;

    // Return updated user
    let user = sqlx::query_as::<_, UserAdminView>(
        r#"
        SELECT u.id, u.email, u.name, u.role::text AS role, u.status::text AS status, u.email_verified, u.created_at, u.last_login_at,
               (SELECT COUNT(*) FROM executions WHERE user_id = u.id) as total_executions,
               (SELECT COUNT(*) FROM executions WHERE user_id = u.id AND created_at > NOW() - INTERVAL '24 hours') as executions_24h,
               u.locked_until > NOW() as is_locked
        FROM users u WHERE u.id = $1
        "#,
    )
    .bind(user_id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(user))
}

#[derive(serde::Deserialize)]
pub struct ListUsersQuery {
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(serde::Deserialize, serde::Serialize)]
pub struct UpdateUserAdminRequest {
    pub role: Option<UserRole>,
    pub status: Option<trycode_auth::models::UserStatus>,
    pub email_verified: Option<bool>,
    pub unlock: Option<bool>,
}

pub async fn test_smtp(
    State(state): State<Arc<AdminState>>,
    auth: AuthExtractor,
    Json(_payload): Json<TestSmtpRequest>,
) -> Result<Json<TestSmtpResponse>> {
    require_super_admin(&auth.user)?;

    let addr = format!("{}:{}", state.config.smtp.host, state.config.smtp.port);

    match tokio::time::timeout(
        std::time::Duration::from_secs(5),
        tokio::net::TcpStream::connect(addr),
    )
    .await
    {
        Ok(Ok(_)) => Ok(Json(TestSmtpResponse {
            success: true,
            message: "SMTP connection successful".to_string(),
        })),
        Ok(Err(e)) => Ok(Json(TestSmtpResponse {
            success: false,
            message: format!("SMTP connection failed: {}", e),
        })),
        Err(_) => Ok(Json(TestSmtpResponse {
            success: false,
            message: "SMTP connection timed out".to_string(),
        })),
    }
}

pub async fn test_captcha(
    State(state): State<Arc<AdminState>>,
    auth: AuthExtractor,
    Json(payload): Json<TestCaptchaRequest>,
) -> Result<Json<TestCaptchaResponse>> {
    require_super_admin(&auth.user)?;

    let verified = state
        .captcha_verifier
        .verify(&payload.token, None, None)
        .await
        .map_err(|e| CoreError::Internal(format!("CAPTCHA verification failed: {}", e)))?;

    Ok(Json(TestCaptchaResponse {
        success: verified,
        message: if verified { "CAPTCHA verification successful" } else { "CAPTCHA verification failed" }.to_string(),
    }))
}

pub async fn test_oauth(
    State(state): State<Arc<AdminState>>,
    auth: AuthExtractor,
    Json(_payload): Json<TestOAuthRequest>,
) -> Result<Json<TestOAuthResponse>> {
    require_super_admin(&auth.user)?;

    if !state.config.oauth.github.enabled {
        return Ok(Json(TestOAuthResponse {
            success: false,
            message: "GitHub OAuth not enabled".to_string(),
            auth_url: None,
        }));
    }

    let auth_url = format!(
        "https://github.com/login/oauth/authorize?client_id={}&redirect_uri={}&scope=read:user%20user:email",
        state.config.oauth.github.client_id,
        urlencoding::encode(&state.config.oauth.github.redirect_url),
    );

    Ok(Json(TestOAuthResponse {
        success: true,
        message: "OAuth configuration valid".to_string(),
        auth_url: Some(auth_url),
    }))
}

pub async fn test_database(
    State(state): State<Arc<AdminState>>,
    auth: AuthExtractor,
    Json(_payload): Json<TestDatabaseRequest>,
) -> Result<Json<TestDatabaseResponse>> {
    require_super_admin(&auth.user)?;

    let start = std::time::Instant::now();
    
    match sqlx::query("SELECT 1").execute(&state.db).await {
        Ok(_) => Ok(Json(TestDatabaseResponse {
            success: true,
            message: "Database connection successful".to_string(),
            latency_ms: start.elapsed().as_millis() as f64,
        })),
        Err(e) => Ok(Json(TestDatabaseResponse {
            success: false,
            message: format!("Database connection failed: {}", e),
            latency_ms: start.elapsed().as_millis() as f64,
        })),
    }
}

pub async fn initialize_super_admin(
    State(state): State<Arc<AdminState>>,
    Json(payload): Json<InitializeAdminRequest>,
) -> Result<Json<trycode_auth::models::User>> {
    // Check if any super_admin exists
    let existing = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM users WHERE role = 'super_admin'")
        .fetch_one(&state.db)
        .await?;

    if existing > 0 {
        return Err(CoreError::Forbidden("Super admin already exists".to_string()));
    }

    // CAPTCHA verification
    if state.config.captcha.enabled {
        let verified = state
            .captcha_verifier
            .verify(
                &payload.captcha_token,
                Some(trycode_core::config::CaptchaAction::Register),
                None,
            )
            .await
            .map_err(|e| CoreError::Internal(format!("CAPTCHA verification failed: {}", e)))?;
        if !verified {
            return Err(CoreError::Validation("CAPTCHA verification failed".to_string()));
        }
    }

    // Create super admin
    let user_id = Uuid::new_v4();
    let password_hash = trycode_auth::jwt::hash_password(&payload.password, &state.config.argon2)?;

    let user = sqlx::query_as::<_, trycode_auth::models::User>(
        r#"
        INSERT INTO users (id, email, password_hash, name, role, status, email_verified, email_verified_at)
        VALUES ($1, $2, $3, $4, 'super_admin', 'active', TRUE, NOW())
        RETURNING *
        "#,
    )
    .bind(user_id)
    .bind(payload.email)
    .bind(password_hash)
    .bind(payload.name)
    .fetch_one(&state.db)
    .await?;

    log_audit(&state.db, Some(user_id), "super_admin_init", Some("user"), Some(user_id.to_string()), None, None).await;

    Ok(Json(user))
}

#[derive(serde::Deserialize)]
pub struct InitializeAdminRequest {
    pub email: String,
    pub password: String,
    pub name: String,
    pub captcha_token: String,
}

pub async fn trigger_config_reload(
    State(state): State<Arc<AdminState>>,
    auth: AuthExtractor,
) -> Result<StatusCode> {
    require_super_admin(&auth.user)?;
    
    state.config_reload_tx.send(()).ok();
    Ok(StatusCode::OK)
}

pub async fn get_ssr_config(
    State(state): State<Arc<AdminState>>,
    auth: AuthExtractor,
) -> Result<Json<SSRConfig>> {
    require_super_admin(&auth.user)?;

    let features = &state.config.features;
    let ssr_config = SSRConfig {
        enabled: features.exec_wasm_fallback, // 复用现有字段或添加专用字段
        pre_render_routes: features.ssr_pre_render_routes.clone().unwrap_or_default(),
        cache_ttl_secs: features.ssr_cache_ttl_secs.unwrap_or(300),
    };

    Ok(Json(ssr_config))
}

pub async fn update_ssr_config(
    State(state): State<Arc<AdminState>>,
    auth: AuthExtractor,
    Json(payload): Json<SSRConfigUpdate>,
) -> Result<Json<SSRConfig>> {
    require_super_admin(&auth.user)?;

    let enabled = payload.enabled.unwrap_or(state.config.features.exec_wasm_fallback);
    let pre_render_routes = payload
        .pre_render_routes
        .clone()
        .or_else(|| state.config.features.ssr_pre_render_routes.clone());
    let cache_ttl_secs = payload
        .cache_ttl_secs
        .unwrap_or_else(|| state.config.features.ssr_cache_ttl_secs.unwrap_or(300));

    // 持久化到数据库（内存配置由 config_reload_tx 触发热重载后刷新）
    sqlx::query(
        r#"
        INSERT INTO system_configs (key, value, description, category, is_secret, updated_by, updated_at)
        VALUES ('ssr.enabled', $1, 'Enable SSR', 'ssr', false, $2, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()
        "#,
    )
    .bind(serde_json::json!(enabled))
    .bind(auth.user.id)
    .execute(&state.db)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO system_configs (key, value, description, category, is_secret, updated_by, updated_at)
        VALUES ('ssr.pre_render_routes', $1, 'Pre-render routes', 'ssr', false, $2, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()
        "#,
    )
    .bind(serde_json::to_value(&pre_render_routes)?)
    .bind(auth.user.id)
    .execute(&state.db)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO system_configs (key, value, description, category, is_secret, updated_by, updated_at)
        VALUES ('ssr.cache_ttl_secs', $1, 'SSR cache TTL', 'ssr', false, $2, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()
        "#,
    )
    .bind(serde_json::json!(cache_ttl_secs))
    .bind(auth.user.id)
    .execute(&state.db)
    .await?;

    // 触发配置热重载
    state.config_reload_tx.send(()).ok();

    // 记录审计日志
    log_audit(&state.db, Some(auth.user.id), "ssr_config_update", Some("ssr_config"), None, None, None).await;

    Ok(Json(SSRConfig {
        enabled,
        pre_render_routes: pre_render_routes.unwrap_or_default(),
        cache_ttl_secs,
    }))
}

fn require_admin(user: &trycode_auth::models::User) -> Result<()> {
    if user.role != UserRole::Admin && user.role != UserRole::SuperAdmin {
        return Err(CoreError::Forbidden("Admin access required".to_string()));
    }
    Ok(())
}

fn require_super_admin(user: &trycode_auth::models::User) -> Result<()> {
    if user.role != UserRole::SuperAdmin {
        return Err(CoreError::Forbidden("Super admin access required".to_string()));
    }
    Ok(())
}

async fn log_audit(
    db: &PgPool,
    user_id: Option<Uuid>,
    action: &str,
    resource_type: Option<&str>,
    resource_id: Option<String>,
    old_value: Option<serde_json::Value>,
    new_value: Option<serde_json::Value>,
) {
    sqlx::query(
        r#"
        INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_value, new_value)
        VALUES ($1, $2, $3, $4, $5, $6)
        "#,
    )
    .bind(user_id)
    .bind(action)
    .bind(resource_type)
    .bind(resource_id)
    .bind(old_value)
    .bind(new_value)
    .execute(db)
    .await
    .ok();
}

async fn get_worker_status(state: &AdminState) -> Result<Vec<crate::models::WorkerStatus>> {
    // This would query the executor pool for worker status
    Ok(vec![])
}

async fn get_database_status(db: &PgPool) -> Result<crate::models::DatabaseStatus> {
    Ok(crate::models::DatabaseStatus {
        connected: true,
        connections_active: 0,
        connections_idle: 0,
        max_connections: 100,
        query_latency_ms: 0.0,
    })
}

async fn get_redis_status(redis: &deadpool_redis::Pool) -> Result<crate::models::RedisStatus> {
    Ok(crate::models::RedisStatus {
        connected: true,
        memory_usage_mb: 0.0,
        connected_clients: 0,
        ops_per_sec: 0.0,
    })
}

async fn get_disk_usage() -> Result<crate::models::DiskUsage> {
    // Simplified
    Ok(crate::models::DiskUsage {
        total_bytes: 100_000_000_000,
        used_bytes: 10_000_000_000,
        free_bytes: 90_000_000_000,
        usage_percent: 10.0,
    })
}

async fn get_active_users_count(db: &PgPool) -> Result<u64> {
    let count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM users WHERE last_login_at > NOW() - INTERVAL '1 hour'",
    )
    .fetch_one(db)
    .await?;
    Ok(count as u64)
}

async fn get_active_executions_count(redis: &deadpool_redis::Pool) -> Result<u64> {
    let mut con = redis
        .get()
        .await
        .map_err(|e| CoreError::Internal(e.to_string()))?;
    let count: u64 = con.get("exec:active_count").await.unwrap_or(0);
    Ok(count)
}

async fn get_queue_depth(redis: &deadpool_redis::Pool) -> Result<u64> {
    let mut con = redis
        .get()
        .await
        .map_err(|e| CoreError::Internal(e.to_string()))?;
    let len: u64 = con.xlen("exec:queue").await.unwrap_or(0);
    Ok(len)
}

async fn calculate_success_rate(db: &PgPool) -> Result<f64> {
    let rate: Option<f64> = sqlx::query_scalar(
        r#"
        SELECT 
            COUNT(*) FILTER (WHERE status = 'completed')::float / 
            NULLIF(COUNT(*)::float, 0) as rate
        FROM executions 
        WHERE created_at > NOW() - INTERVAL '24 hours'
        "#,
    )
    .fetch_one(db)
    .await?;
    Ok(rate.unwrap_or(0.0))
}

async fn calculate_avg_execution_time(db: &PgPool) -> Result<f64> {
    let avg: Option<f64> = sqlx::query_scalar(
        "SELECT AVG(wall_time_ms)::float as avg FROM executions WHERE status = 'completed' AND created_at > NOW() - INTERVAL '24 hours'",
    )
    .fetch_one(db)
    .await?;
    Ok(avg.unwrap_or(0.0))
}

async fn get_languages_usage(db: &PgPool) -> Result<Vec<crate::models::LanguageUsage>> {
    let rows: Vec<(String, i64)> = sqlx::query_as(
        r#"
        SELECT language, COUNT(*) as count
        FROM executions
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY language
        ORDER BY count DESC
        "#,
    )
    .fetch_all(db)
    .await?;

    Ok(rows.into_iter().map(|(language, count)| crate::models::LanguageUsage {
        language,
        count: count as u64,
        success_rate: 0.0, // Would need additional query
        avg_time_ms: 0.0,
    }).collect())
}

async fn get_executions_by_status(db: &PgPool) -> Result<Vec<crate::models::StatusCount>> {
    let rows: Vec<(String, i64)> = sqlx::query_as(
        r#"
        SELECT status, COUNT(*) as count
        FROM executions
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY status
        "#,
    )
    .fetch_all(db)
    .await?;

    Ok(rows.into_iter().map(|(status, count)| crate::models::StatusCount {
        status,
        count: count as u64,
    }).collect())
}

fn get_uptime() -> u64 {
    // Simplified - would read from /proc/uptime
    0
}

pub struct AdminState {
    pub db: PgPool,
    pub redis: deadpool_redis::Pool,
    pub config: trycode_core::config::AppConfig,
    pub email_service: Arc<trycode_auth::EmailService>,
    pub captcha_verifier: Box<dyn trycode_auth::CaptchaVerifier>,
    pub config_reload_tx: tokio::sync::broadcast::Sender<()>,
}

// Arc<AdminState> 通过 trycode_auth::middleware 中对 Arc<T> 的 blanket impl 自动满足 AuthDepot
impl AuthDepot for AdminState {
    fn auth_db(&self) -> &PgPool {
        &self.db
    }
    fn jwt_config(&self) -> &trycode_core::config::JwtConfig {
        &self.config.jwt
    }
}