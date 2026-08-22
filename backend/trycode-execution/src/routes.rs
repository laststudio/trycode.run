use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
};
use chrono::Utc;
use redis::AsyncCommands;
use sqlx::PgPool;
use std::sync::Arc;
use tracing::{info, warn};
use uuid::Uuid;

use crate::{
    models::{ExecuteRequest, ExecuteResponse, Execution, ExecutionStatus},
    pool::ExecutorPool,
    scheduler::ExecutionScheduler,
};
use trycode_auth::AuthExtractor;
use trycode_core::{CoreError, Result};

#[derive(serde::Deserialize)]
pub struct ExecuteQuery {
    pub wait: Option<bool>,
    pub timeout: Option<u32>,
}

pub async fn execute_code(
    State(state): State<Arc<ExecutionState>>,
    auth: AuthExtractor,
    Query(query): Query<ExecuteQuery>,
    Json(payload): Json<ExecuteRequest>,
) -> Result<Json<ExecuteResponse>> {
    // Validate language
    let lang_config = state.dynamic_config.read().await.languages.get(&payload.language).cloned()
        .ok_or(CoreError::Validation(format!("Language '{}' not supported or disabled", payload.language)))?;

    // Create execution record
    let execution_id = Uuid::new_v4();
    let now = Utc::now();

    // Calculate resource limits
    let limits = state.limits_engine.calculate_limits(
        &payload.language,
        &auth.user.id.to_string(),
        &auth.user.role.to_string().to_lowercase(),
        payload.timeout_secs.map(|t| crate::models::ResourceLimits {
            cpu_time_secs: t,
            wall_time_secs: t + 10,
            ..Default::default()
        }),
    );

    // Prepare files
    let files = payload.files.unwrap_or_else(|| vec![crate::models::ExecuteFile {
        path: "main".to_string() + &get_file_extension(&payload.language),
        content: payload.code,
        is_main: true,
    }]);

    let execution = Execution {
        id: execution_id,
        user_id: auth.user.id,
        project_id: payload.project_id,
        language: payload.language.clone(),
        status: ExecutionStatus::Queued,
        source_code: payload.code.clone(),
        stdin: payload.stdin,
        stdout: None,
        stderr: None,
        exit_code: None,
        cpu_time_ms: None,
        wall_time_ms: None,
        memory_peak_bytes: None,
        disk_usage_bytes: None,
        executor_worker_id: None,
        wasm_attempted: false,
        wasm_fallback_reason: None,
        error_message: None,
        queued_at: now,
        started_at: None,
        completed_at: None,
        created_at: now,
    };

    // Store in database
    sqlx::query!(
        r#"
        INSERT INTO executions (id, user_id, project_id, language, status, source_code, stdin, queued_at, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        "#,
        execution.id,
        execution.user_id,
        execution.project_id,
        execution.language,
        execution.status as _,
        execution.source_code,
        execution.stdin,
        execution.queued_at,
        execution.created_at
    )
    .execute(&state.db)
    .await?;

    // Store additional files
    for file in &files {
        sqlx::query!(
            r#"
            INSERT INTO execution_files (execution_id, path, content, is_main)
            VALUES ($1, $2, $3, $4)
            "#,
            execution_id,
            file.path,
            file.content,
            file.is_main
        )
        .execute(&state.db)
        .await?;
    }

    // Create queue message
    let queue_message = crate::models::QueueMessage {
        execution_id,
        user_id: auth.user.id,
        language: payload.language.clone(),
        priority: 1,
        timeout_secs: limits.wall_time_secs,
        created_at: now,
        payload: crate::models::ExecutePayload {
            code: payload.code,
            stdin: payload.stdin,
            files: files.clone(),
            project_id: payload.project_id,
            resource_limits: limits.clone(),
            wasm_config: state.limits_engine.calculate_wasm_config(&payload.language),
        },
    };

    // Submit to scheduler
    state.scheduler.submit(queue_message).await?;

    info!("Execution {} queued for user {}", execution_id, auth.user.id);

    if query.wait.unwrap_or(false) {
        // Wait for completion (polling)
        let result = wait_for_execution(&state.redis, &state.db, execution_id, query.timeout.unwrap_or(120)).await?;
        return Ok(Json(result));
    }

    Ok(Json(ExecuteResponse {
        execution_id,
        status: ExecutionStatus::Queued,
        stdout: None,
        stderr: None,
        exit_code: None,
        cpu_time_ms: None,
        wall_time_ms: None,
        memory_peak_mb: None,
        wasm_fallback: false,
        fallback_reason: None,
    }))
}

async fn wait_for_execution(
    redis: &deadpool_redis::Pool,
    db: &PgPool,
    execution_id: Uuid,
    timeout_secs: u32,
) -> Result<ExecuteResponse> {
    let mut con = redis.get().await?;
    let status_key = format!("exec:status:{}", execution_id);
    let result_key = format!("exec:result:{}", execution_id);

    let start = std::time::Instant::now();
    let timeout = std::time::Duration::from_secs(timeout_secs as u64);

    loop {
        if start.elapsed() > timeout {
            return Err(CoreError::Internal("Wait timeout".to_string()));
        }

        // Check status
        let status: Option<String> = con.get(&status_key).await?;
        if let Some(status_str) = status {
            let status: ExecutionStatus = serde_json::from_str(&status_str)?;
            if status == ExecutionStatus::Completed || status == ExecutionStatus::Failed || status == ExecutionStatus::Timeout || status == ExecutionStatus::Cancelled {
                // Get result
                let result: Option<String> = con.get(&result_key).await?;
                if let Some(result_str) = result {
                    let exec_result: crate::pool::ExecutionResult = serde_json::from_str(&result_str)?;
                    
                    // Also fetch from DB for complete info
                    let execution = sqlx::query_as!(Execution, "SELECT * FROM executions WHERE id = $1", execution_id)
                        .fetch_one(db)
                        .await?;

                    return Ok(ExecuteResponse {
                        execution_id,
                        status: execution.status,
                        stdout: exec_result.stdout,
                        stderr: exec_result.stderr,
                        exit_code: exec_result.exit_code,
                        cpu_time_ms: exec_result.cpu_time_ms,
                        wall_time_ms: exec_result.wall_time_ms,
                        memory_peak_mb: exec_result.memory_peak_bytes.map(|b| b as f64 / 1024.0 / 1024.0),
                        wasm_fallback: exec_result.wasm_fallback,
                        fallback_reason: exec_result.fallback_reason,
                    });
                }
            }
        }

        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    }
}

pub async fn get_execution(
    State(state): State<Arc<ExecutionState>>,
    auth: AuthExtractor,
    Path(execution_id): Path<Uuid>,
) -> Result<Json<ExecuteResponse>> {
    let execution = sqlx::query_as!(Execution, "SELECT * FROM executions WHERE id = $1 AND user_id = $2", execution_id, auth.user.id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(CoreError::NotFound("Execution not found".to_string()))?;

    Ok(Json(ExecuteResponse {
        execution_id: execution.id,
        status: execution.status,
        stdout: execution.stdout,
        stderr: execution.stderr,
        exit_code: execution.exit_code,
        cpu_time_ms: execution.cpu_time_ms,
        wall_time_ms: execution.wall_time_ms,
        memory_peak_mb: execution.memory_peak_bytes.map(|b| b as f64 / 1024.0 / 1024.0),
        wasm_fallback: execution.wasm_attempted && execution.wasm_fallback_reason.is_some(),
        fallback_reason: execution.wasm_fallback_reason,
    }))
}

pub async fn list_executions(
    State(state): State<Arc<ExecutionState>>,
    auth: AuthExtractor,
    Query(query): Query<ListExecutionsQuery>,
) -> Result<Json<Vec<ExecuteResponse>>> {
    let limit = query.limit.unwrap_or(50).min(100);
    let offset = query.offset.unwrap_or(0);

    let executions = sqlx::query_as!(
        Execution,
        "SELECT * FROM executions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
        auth.user.id,
        limit as i64,
        offset as i64
    )
    .fetch_all(&state.db)
    .await?;

    let responses = executions.into_iter().map(|e| ExecuteResponse {
        execution_id: e.id,
        status: e.status,
        stdout: e.stdout,
        stderr: e.stderr,
        exit_code: e.exit_code,
        cpu_time_ms: e.cpu_time_ms,
        wall_time_ms: e.wall_time_ms,
        memory_peak_mb: e.memory_peak_bytes.map(|b| b as f64 / 1024.0 / 1024.0),
        wasm_fallback: e.wasm_attempted && e.wasm_fallback_reason.is_some(),
        fallback_reason: e.wasm_fallback_reason,
    }).collect();

    Ok(Json(responses))
}

#[derive(serde::Deserialize)]
pub struct ListExecutionsQuery {
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

pub async fn get_execution_status(
    State(state): State<Arc<ExecutionState>>,
    Path(execution_id): Path<Uuid>,
) -> Result<Json<ExecutionStatusResponse>> {
    let mut con = state.redis.get().await?;
    let status_key = format!("exec:status:{}", execution_id);
    
    let status: Option<String> = con.get(&status_key).await?;
    let status = status.map(|s| serde_json::from_str(&s).unwrap_or(ExecutionStatus::Queued))
        .unwrap_or(ExecutionStatus::Queued);

    Ok(Json(ExecutionStatusResponse { execution_id, status }))
}

#[derive(serde::Serialize)]
pub struct ExecutionStatusResponse {
    pub execution_id: Uuid,
    pub status: ExecutionStatus,
}

fn get_file_extension(language: &str) -> &'static str {
    match language {
        "python" => ".py",
        "javascript" => ".js",
        "typescript" => ".ts",
        "rust" => ".rs",
        "go" => ".go",
        "java" => ".java",
        "cpp" => ".cpp",
        "c" => ".c",
        "csharp" => ".cs",
        "php" => ".php",
        "ruby" => ".rb",
        "swift" => ".swift",
        "kotlin" => ".kt",
        "scala" => ".scala",
        "r" => ".r",
        "lua" => ".lua",
        "perl" => ".pl",
        "dart" => ".dart",
        "zig" => ".zig",
        "julia" => ".jl",
        "haskell" => ".hs",
        "fortran" => ".f90",
        "objectivec" => ".m",
        "vbnet" => ".vb",
        "fsharp" => ".fs",
        "groovy" => ".groovy",
        "html" => ".html",
        "sql" => ".sql",
        "bash" => ".sh",
        "powershell" => ".ps1",
        _ => ".txt",
    }
}

pub struct ExecutionState {
    pub db: PgPool,
    pub redis: deadpool_redis::Pool,
    pub pool: Arc<ExecutorPool>,
    pub scheduler: Arc<ExecutionScheduler>,
    pub limits_engine: Arc<crate::limits::LimitsEngine>,
    pub dynamic_config: Arc<tokio::sync::RwLock<crate::config::DynamicConfig>>,
}