use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Execution {
    pub id: Uuid,
    pub user_id: Uuid,
    pub project_id: Option<Uuid>,
    pub language: String,
    pub status: ExecutionStatus,
    pub source_code: String,
    pub stdin: Option<String>,
    pub stdout: Option<String>,
    pub stderr: Option<String>,
    pub exit_code: Option<i32>,
    pub cpu_time_ms: Option<i64>,
    pub wall_time_ms: Option<i64>,
    pub memory_peak_bytes: Option<i64>,
    pub disk_usage_bytes: Option<i64>,
    pub executor_worker_id: Option<i32>,
    pub wasm_attempted: bool,
    pub wasm_fallback_reason: Option<String>,
    pub error_message: Option<String>,
    pub queued_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "execution_status", rename_all = "snake_case")]
pub enum ExecutionStatus {
    Queued,
    Running,
    Completed,
    Failed,
    Timeout,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ExecutionFile {
    pub id: Uuid,
    pub execution_id: Uuid,
    pub path: String,
    pub content: String,
    pub is_main: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecuteRequest {
    pub code: String,
    pub language: String,
    pub stdin: Option<String>,
    pub files: Option<Vec<ExecuteFile>>,
    pub project_id: Option<Uuid>,
    pub timeout_secs: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecuteFile {
    pub path: String,
    pub content: String,
    pub is_main: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecuteResponse {
    pub execution_id: Uuid,
    pub status: ExecutionStatus,
    pub stdout: Option<String>,
    pub stderr: Option<String>,
    pub exit_code: Option<i32>,
    pub cpu_time_ms: Option<i64>,
    pub wall_time_ms: Option<i64>,
    pub memory_peak_mb: Option<f64>,
    pub wasm_fallback: bool,
    pub fallback_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionMetrics {
    pub language: String,
    pub status: String,
    pub duration_ms: i64,
    pub memory_peak_mb: f64,
    pub cpu_time_ms: i64,
    pub wasm_fallback: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueMessage {
    pub execution_id: Uuid,
    pub user_id: Uuid,
    pub language: String,
    pub priority: i32,
    pub timeout_secs: u32,
    pub created_at: DateTime<Utc>,
    pub payload: ExecutePayload,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutePayload {
    pub code: String,
    pub stdin: Option<String>,
    pub files: Vec<ExecuteFile>,
    pub project_id: Option<Uuid>,
    pub resource_limits: ResourceLimits,
    pub wasm_config: WasmConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceLimits {
    pub cpu_time_secs: u32,
    pub wall_time_secs: u32,
    pub memory_mb: u32,
    pub disk_mb: u32,
    pub cpu_quota: u64,
    pub memory_limit_mb: u64,
    pub pids_limit: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WasmConfig {
    pub enabled: bool,
    pub timeout_ms: u64,
    pub preload_languages: Vec<String>,
    pub fallback_triggers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkerInfo {
    pub id: i32,
    pub name: String,
    pub status: WorkerStatus,
    pub current_load: i32,
    pub max_load: i32,
    pub languages: Vec<String>,
    pub last_heartbeat: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum WorkerStatus {
    Healthy,
    Unhealthy,
    Draining,
    Offline,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub status: ExecutionStatus,
    pub stdout: Option<String>,
    pub stderr: Option<String>,
    pub exit_code: Option<i32>,
    pub cpu_time_ms: Option<i64>,
    pub wall_time_ms: Option<i64>,
    pub memory_peak_bytes: Option<i64>,
    pub disk_usage_bytes: Option<i64>,
    pub wasm_fallback: bool,
    pub fallback_reason: Option<String>,
    pub error_message: Option<String>,
}