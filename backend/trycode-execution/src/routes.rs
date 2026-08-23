use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{sse::{Event, KeepAlive, Sse}, Json},
};
use chrono::{DateTime, Utc};
use futures::{stream::Stream, StreamExt};
use redis::AsyncCommands;
use sqlx::PgPool;
use std::convert::Infallible;
use std::sync::Arc;
use std::time::Instant;
use tracing::{info, warn};
use uuid::Uuid;

use crate::{
    models::{ExecuteRequest, ExecuteResponse, Execution, ExecutionStatus},
    pool::ExecutorPool,
    scheduler::ExecutionScheduler,
};
use trycode_auth::models::UserRole;
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
        content: payload.code.clone(),
        is_main: true,
    }]);

    let execution = Execution {
        id: execution_id,
        user_id: auth.user.id,
        project_id: payload.project_id,
        language: payload.language.clone(),
        status: ExecutionStatus::Queued,
        source_code: payload.code.clone(),
        stdin: payload.stdin.clone(),
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
    sqlx::query(
        r#"
        INSERT INTO executions (id, user_id, project_id, language, status, source_code, stdin, queued_at, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        "#,
    )
    .bind(execution.id)
    .bind(execution.user_id)
    .bind(execution.project_id)
    .bind(execution.language)
    .bind(execution.status)
    .bind(execution.source_code)
    .bind(execution.stdin)
    .bind(execution.queued_at)
    .bind(execution.created_at)
    .execute(&state.db)
    .await?;

    // Store additional files
    for file in &files {
        sqlx::query(
            r#"
            INSERT INTO execution_files (execution_id, path, content, is_main)
            VALUES ($1, $2, $3, $4)
            "#,
        )
        .bind(execution_id)
        .bind(&file.path)
        .bind(&file.content)
        .bind(file.is_main)
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
    let mut con = redis
        .get()
        .await
        .map_err(|e| CoreError::Internal(e.to_string()))?;
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
                    let exec_result: crate::models::ExecutionResult = serde_json::from_str(&result_str)?;
                    
                    // Also fetch from DB for complete info
                    let execution = sqlx::query_as::<_, Execution>(
                        "SELECT * FROM executions WHERE id = $1",
                    )
                    .bind(execution_id)
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
    let execution = sqlx::query_as::<_, Execution>(
        "SELECT * FROM executions WHERE id = $1 AND user_id = $2",
    )
    .bind(execution_id)
    .bind(auth.user.id)
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

    let executions = sqlx::query_as::<_, Execution>(
        "SELECT * FROM executions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
    )
    .bind(auth.user.id)
    .bind(limit as i64)
    .bind(offset as i64)
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
    let mut con = state
        .redis
        .get()
        .await
        .map_err(|e| CoreError::Internal(e.to_string()))?;
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

const STREAM_POLL_INTERVAL: std::time::Duration = std::time::Duration::from_millis(500);
const STREAM_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(300);

#[derive(sqlx::FromRow)]
struct ExecutionStreamRow {
    status: ExecutionStatus,
    stdout: Option<String>,
    stderr: Option<String>,
    exit_code: Option<i32>,
    error_message: Option<String>,
    completed_at: Option<DateTime<Utc>>,
}

struct StreamState {
    db: PgPool,
    execution_id: Uuid,
    last_status: Option<ExecutionStatus>,
    deadline: Instant,
    finished: bool,
}

pub async fn stream_execution(
    State(state): State<Arc<ExecutionState>>,
    Path(execution_id): Path<Uuid>,
    auth: AuthExtractor,
) -> std::result::Result<Sse<impl Stream<Item = std::result::Result<Event, Infallible>>>, CoreError> {
    let execution = sqlx::query_as::<_, Execution>(
        "SELECT * FROM executions WHERE id = $1",
    )
    .bind(execution_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(CoreError::NotFound("Execution not found".to_string()))?;

    let is_admin = auth.user.role == UserRole::Admin || auth.user.role == UserRole::SuperAdmin;
    if execution.user_id != auth.user.id && !is_admin {
        return Err(CoreError::Forbidden("You do not have access to this execution".to_string()));
    }

    let event_stream = futures::stream::unfold(
        StreamState {
            db: state.db.clone(),
            execution_id,
            last_status: None,
            deadline: Instant::now() + STREAM_TIMEOUT,
            finished: false,
        },
        |mut st| async move {
            loop {
                if st.finished {
                    return None;
                }

                tokio::time::sleep(STREAM_POLL_INTERVAL).await;

                if Instant::now() >= st.deadline {
                    st.finished = true;
                    let timeout_event = Event::default()
                        .event("error")
                        .data(r#"{"message":"stream timeout"}"#);
                    return Some((futures::stream::iter(vec![Ok(timeout_event)]), st));
                }

                let row = match sqlx::query_as::<_, ExecutionStreamRow>(
                    "SELECT status, stdout, stderr, exit_code, error_message, completed_at FROM executions WHERE id = $1",
                )
                .bind(st.execution_id)
                .fetch_optional(&st.db)
                .await
                {
                    Ok(row) => row,
                    Err(e) => {
                        warn!("Failed to poll execution {} for stream: {}", st.execution_id, e);
                        continue;
                    }
                };

                let Some(row) = row else {
                    warn!("Execution {} disappeared during stream", st.execution_id);
                    st.finished = true;
                    let missing_event = Event::default()
                        .event("error")
                        .data(serde_json::json!({"message": "execution not found"}).to_string());
                    return Some((futures::stream::iter(vec![Ok(missing_event)]), st));
                };

                let status_changed = st.last_status.as_ref() != Some(&row.status);
                let is_terminal =
                    !matches!(row.status, ExecutionStatus::Queued | ExecutionStatus::Running);
                st.last_status = Some(row.status.clone());

                if is_terminal {
                    st.finished = true;
                    let mut events: Vec<std::result::Result<Event, Infallible>> = Vec::new();
                    if status_changed {
                        events.push(Ok(status_event(&row)));
                    }

                    match sqlx::query_as::<_, (Option<i64>, Option<i64>, Option<i64>)>(
                        "SELECT cpu_time_ms, wall_time_ms, memory_peak_bytes FROM executions WHERE id = $1",
                    )
                    .bind(st.execution_id)
                    .fetch_one(&st.db)
                    .await
                    {
                        Ok((cpu_time_ms, wall_time_ms, memory_peak_bytes)) => events.push(Ok(
                            Event::default().event("result").data(
                                result_json(&row, cpu_time_ms, wall_time_ms, memory_peak_bytes)
                                    .to_string(),
                            )
                        )),
                        Err(e) => {
                            warn!(
                                "Failed to load final result of execution {}: {}",
                                st.execution_id, e
                            );
                            events.push(Ok(Event::default()
                                .event("error")
                                .data(
                                    serde_json::json!({"message": "failed to load execution result"})
                                        .to_string(),
                                )));
                        }
                    }
                    return Some((futures::stream::iter(events), st));
                }

                if status_changed {
                    return Some((futures::stream::iter(vec![Ok(status_event(&row))]), st));
                }
            }
        },
    )
    .flatten();

    Ok(Sse::new(event_stream).keep_alive(KeepAlive::default()))
}

fn status_event(row: &ExecutionStreamRow) -> Event {
    Event::default()
        .event("status")
        .data(serde_json::json!({ "status": row.status }).to_string())
}

fn result_json(
    row: &ExecutionStreamRow,
    cpu_time_ms: Option<i64>,
    wall_time_ms: Option<i64>,
    memory_peak_bytes: Option<i64>,
) -> serde_json::Value {
    serde_json::json!({
        "status": row.status,
        "stdout": row.stdout,
        "stderr": row.stderr,
        "exit_code": row.exit_code,
        "cpu_time_ms": cpu_time_ms,
        "wall_time_ms": wall_time_ms,
        "memory_peak_bytes": memory_peak_bytes,
        "error_message": row.error_message,
        "completed_at": row.completed_at,
    })
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
    pub dynamic_config: Arc<tokio::sync::RwLock<trycode_core::config::DynamicConfig>>,
    pub jwt: trycode_core::config::JwtConfig,
}

impl trycode_auth::middleware::AuthDepot for ExecutionState {
    fn auth_db(&self) -> &PgPool {
        &self.db
    }
    fn jwt_config(&self) -> &trycode_core::config::JwtConfig {
        &self.jwt
    }
}