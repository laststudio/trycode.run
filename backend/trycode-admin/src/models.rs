use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SystemConfig {
    pub key: String,
    pub value: serde_json::Value,
    pub description: Option<String>,
    pub category: String,
    pub is_secret: bool,
    pub updated_by: Option<Uuid>,
    pub updated_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemConfigUpdate {
    pub value: serde_json::Value,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemStatus {
    pub status: String,
    pub version: String,
    pub uptime_seconds: u64,
    pub active_users: u64,
    pub active_executions: u64,
    pub queue_depth: u64,
    pub workers: Vec<WorkerStatus>,
    pub database: DatabaseStatus,
    pub redis: RedisStatus,
    pub disk_usage: DiskUsage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkerStatus {
    pub id: i32,
    pub name: String,
    pub status: String,
    pub current_load: i32,
    pub max_load: i32,
    pub languages: Vec<String>,
    pub last_heartbeat: DateTime<Utc>,
    pub cpu_usage: Option<f64>,
    pub memory_usage_mb: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseStatus {
    pub connected: bool,
    pub connections_active: u32,
    pub connections_idle: u32,
    pub max_connections: u32,
    pub query_latency_ms: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedisStatus {
    pub connected: bool,
    pub memory_usage_mb: f64,
    pub connected_clients: u32,
    pub ops_per_sec: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskUsage {
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub free_bytes: u64,
    pub usage_percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SSRConfig {
    pub enabled: bool,
    pub pre_render_routes: Vec<String>,
    pub cache_ttl_secs: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SSRConfigUpdate {
    pub enabled: Option<bool>,
    pub pre_render_routes: Option<Vec<String>>,
    pub cache_ttl_secs: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestSmtpRequest {}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestSmtpResponse {
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestCaptchaRequest {
    pub token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestCaptchaResponse {
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestOAuthRequest {}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestOAuthResponse {
    pub success: bool,
    pub message: String,
    pub auth_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestDatabaseRequest {}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestDatabaseResponse {
    pub success: bool,
    pub message: String,
    pub latency_ms: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdminStats {
    pub total_users: u64,
    pub active_users_24h: u64,
    pub new_users_24h: u64,
    pub total_projects: u64,
    pub total_executions: u64,
    pub executions_24h: u64,
    pub success_rate_24h: f64,
    pub avg_execution_time_ms: f64,
    pub languages_usage: Vec<LanguageUsage>,
    pub executions_by_status: Vec<StatusCount>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanguageUsage {
    pub language: String,
    pub count: u64,
    pub success_rate: f64,
    pub avg_time_ms: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusCount {
    pub status: String,
    pub count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLogEntry {
    pub id: i64,
    pub user_id: Option<Uuid>,
    pub user_email: Option<String>,
    pub action: String,
    pub resource_type: Option<String>,
    pub resource_id: Option<String>,
    pub old_value: Option<serde_json::Value>,
    pub new_value: Option<serde_json::Value>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLogQuery {
    pub user_id: Option<Uuid>,
    pub action: Option<String>,
    pub resource_type: Option<String>,
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionQuery {
    pub user_id: Option<Uuid>,
    pub language: Option<String>,
    pub status: Option<String>,
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ExecutionDetail {
    pub id: Uuid,
    pub user_id: Uuid,
    pub user_email: String,
    pub project_id: Option<Uuid>,
    pub language: String,
    pub status: String,
    pub source_code: String,
    pub stdout: Option<String>,
    pub stderr: Option<String>,
    pub exit_code: Option<i32>,
    pub cpu_time_ms: Option<i64>,
    pub wall_time_ms: Option<i64>,
    pub memory_peak_mb: Option<f64>,
    pub executor_worker_id: Option<i32>,
    pub wasm_attempted: bool,
    pub wasm_fallback_reason: Option<String>,
    pub error_message: Option<String>,
    pub queued_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct UserAdminView {
    pub id: Uuid,
    pub email: String,
    pub name: String,
    pub role: String,
    pub status: String,
    pub email_verified: bool,
    pub created_at: DateTime<Utc>,
    pub last_login_at: Option<DateTime<Utc>>,
    pub total_executions: i64,
    pub executions_24h: i64,
    pub is_locked: bool,
}