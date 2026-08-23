use figment::{
    providers::{Env, Format, Toml},
    Figment,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfig {
    pub host: String,
    pub port: u16,
    pub name: String,
    pub user: String,
    #[serde(default)]
    pub password: String,
    #[serde(default = "default_max_conn")]
    pub max_connections: u32,
    #[serde(default = "default_min_conn")]
    pub min_connections: u32,
}

fn default_max_conn() -> u32 { 10 }
fn default_min_conn() -> u32 { 2 }

impl Default for DatabaseConfig {
    fn default() -> Self {
        Self {
            host: "pgdocker".into(),
            port: 5432,
            name: "trycode".into(),
            user: "trycode".into(),
            password: String::new(),
            max_connections: default_max_conn(),
            min_connections: default_min_conn(),
        }
    }
}

impl DatabaseConfig {
    pub fn url(&self) -> String {
        format!(
            "postgres://{}:{}@{}:{}/{}",
            self.user, self.password, self.host, self.port, self.name
        )
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedisConfig {
    pub host: String,
    pub port: u16,
    #[serde(default)]
    pub password: Option<String>,
    #[serde(default)]
    pub db: i64,
    #[serde(default = "default_redis_max")]
    pub max_connections: u32,
}

fn default_redis_max() -> u32 { 20 }

impl Default for RedisConfig {
    fn default() -> Self {
        Self {
            host: "redisdocker".into(),
            port: 6379,
            password: None,
            db: 0,
            max_connections: default_redis_max(),
        }
    }
}

impl RedisConfig {
    pub fn url(&self) -> String {
        match &self.password {
            Some(pwd) if !pwd.is_empty() => {
                format!("redis://:{}@{}:{}/{}", pwd, self.host, self.port, self.db)
            }
            _ => format!("redis://{}:{}/{}", self.host, self.port, self.db),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SmtpConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    #[serde(default)]
    pub password: String,
    pub from: String,
    #[serde(default = "default_tls")]
    pub tls: SmtpTlsMode,
}

fn default_tls() -> SmtpTlsMode { SmtpTlsMode::Starttls }

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum SmtpTlsMode {
    None,
    #[default]
    Starttls,
    Tls,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CaptchaConfig {
    #[serde(default)]
    pub provider: CaptchaProvider,
    #[serde(default)]
    pub site_key: String,
    #[serde(default)]
    pub secret_key: String,
    #[serde(default)]
    pub verify_url: String,
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub actions: Vec<CaptchaAction>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum CaptchaProvider {
    #[default]
    Trycap,
    Turnstile,
    HCaptcha,
    ReCaptchaV3,
    Custom { endpoint: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum CaptchaAction {
    Register,
    Login,
    Execute,
    Share,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OAuthConfig {
    #[serde(default)]
    pub github: GitHubOAuthConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GitHubOAuthConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub client_id: String,
    #[serde(default)]
    pub client_secret: String,
    #[serde(default = "default_github_redirect")]
    pub redirect_url: String,
    #[serde(default)]
    pub scopes: Vec<String>,
    #[serde(default)]
    pub allowed_domains: Vec<String>,
    #[serde(default = "default_true")]
    pub auto_create_user: bool,
    #[serde(default = "default_role")]
    pub default_role: UserRole,
}

fn default_github_redirect() -> String {
    "https://trycode.run/api/auth/oauth/github/callback".to_string()
}
fn default_true() -> bool { true }
fn default_role() -> UserRole { UserRole::User }

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum UserRole {
    #[default]
    User,
    Admin,
    SuperAdmin,
}

impl std::fmt::Display for UserRole {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            UserRole::User => write!(f, "user"),
            UserRole::Admin => write!(f, "admin"),
            UserRole::SuperAdmin => write!(f, "super_admin"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AiConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_openai_url")]
    pub base_url: String,
    #[serde(default)]
    pub api_key: String,
    #[serde(default = "default_model")]
    pub default_model: String,
    #[serde(default = "default_max_tokens")]
    pub max_tokens: u32,
    #[serde(default = "default_temperature")]
    pub temperature: f32,
    #[serde(default = "default_timeout")]
    pub timeout_secs: u64,
}

fn default_openai_url() -> String { "https://api.openai.com/v1".to_string() }
fn default_model() -> String { "gpt-4o-mini".to_string() }
fn default_max_tokens() -> u32 { 4096 }
fn default_temperature() -> f32 { 0.3 }
fn default_timeout() -> u64 { 30 }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct ExecutionConfig {
    pub worker_names: Vec<String>,
    pub docker_host: String,
    pub default_timeout_secs: u32,
    pub max_timeout_secs: u32,
    pub max_output_bytes: usize,
    pub disk_quota_mb: u32,
    pub global_max_concurrent: u32,
    pub per_user_max_concurrent: u32,
    pub queue_timeout_secs: u64,
    pub default_cpu_time_secs: u64,
    pub default_memory_mb: u64,
    pub default_disk_mb: u64,
    pub default_wall_time_secs: u64,
    pub container_cpu_quota: u64,
    pub container_memory_mb: u64,
    pub container_pids_limit: u64,
    pub wasm_timeout_ms: u64,
    pub wasm_preload: Vec<String>,
    pub retry: RetryConfig,
    pub wasm_fallback: WasmFallbackConfig,
}

impl Default for ExecutionConfig {
    fn default() -> Self {
        Self {
            worker_names: vec!["exec-worker-1".into(), "exec-worker-2".into()],
            docker_host: "unix:///var/run/docker.sock".into(),
            default_timeout_secs: 30,
            max_timeout_secs: 120,
            max_output_bytes: 1024 * 1024,
            disk_quota_mb: 500,
            global_max_concurrent: 4,
            per_user_max_concurrent: 2,
            queue_timeout_secs: 60,
            default_cpu_time_secs: 30,
            default_memory_mb: 256,
            default_disk_mb: 100,
            default_wall_time_secs: 60,
            container_cpu_quota: 100000,
            container_memory_mb: 768,
            container_pids_limit: 100,
            wasm_timeout_ms: 5000,
            wasm_preload: vec!["python".into(), "javascript".into(), "typescript".into()],
            retry: RetryConfig::default(),
            wasm_fallback: WasmFallbackConfig::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct RetryConfig {
    pub max_attempts: u32,
    pub backoff_base_ms: u64,
    pub backoff_max_ms: u64,
    pub retryable_errors: Vec<String>,
    pub non_retryable_errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct WasmFallbackConfig {
    pub enabled: bool,
    pub timeout_ms: u64,
    pub preload_languages: Vec<String>,
    pub fallback_triggers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub workers: usize,
    pub shutdown_timeout_secs: u64,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            host: "0.0.0.0".into(),
            port: 3000,
            workers: 4,
            shutdown_timeout_secs: 30,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct JwtConfig {
    pub secret: String,
    pub access_token_ttl_secs: u64,
    pub refresh_token_ttl_secs: u64,
    pub issuer: String,
    pub audience: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Argon2Config {
    pub memory_kib: u32,
    pub iterations: u32,
    pub parallelism: u32,
}

impl Default for Argon2Config {
    fn default() -> Self {
        Self { memory_kib: 65536, iterations: 3, parallelism: 4 }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct FeatureFlags {
    pub registration_enabled: bool,
    pub email_verification_required: bool,
    pub ai_enabled: bool,
    pub collab_enabled: bool,
    pub share_enabled: bool,
    pub maintenance_mode: bool,
    pub exec_wasm_fallback: bool,
    pub exec_queue_enabled: bool,
    pub captcha_enabled: bool,
    pub oauth_enabled: bool,
    pub exec_lsp_enabled: bool,
    pub ssr_enabled: bool,
    pub ssr_pre_render_routes: Option<Vec<String>>,
    pub ssr_cache_ttl_secs: Option<u64>,
    pub math_default_renderer: Option<String>,
    pub mermaid_security_level: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct LSPConfig {
    pub enabled: bool,
    pub websocket_port: u16,
    pub max_connections: usize,
    pub request_timeout_secs: u64,
    pub heartbeat_interval_secs: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct AppConfig {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub redis: RedisConfig,
    pub smtp: SmtpConfig,
    pub captcha: CaptchaConfig,
    pub oauth: OAuthConfig,
    pub ai: AiConfig,
    pub execution: ExecutionConfig,
    pub lsp: LSPConfig,
    pub jwt: JwtConfig,
    pub argon2: Argon2Config,
    pub features: FeatureFlags,
}

impl AppConfig {
    pub fn load() -> Result<Self, figment::Error> {
        Figment::new()
            .merge(Toml::file(
                std::env::var("CONFIG_FILE")
                    .unwrap_or_else(|_| "/config/backend.toml".to_string()),
            ))
            .merge(Env::prefixed("TRYCODE_").split("_"))
            .extract()
    }
}

/// 动态配置（数据库加载，支持热更新）
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct DynamicConfig {
    pub system: HashMap<String, serde_json::Value>,
    pub languages: HashMap<String, LanguageConfig>,
    pub execution_configs: HashMap<String, ExecutionConfigOverride>,
    pub feature_flags: HashMap<String, bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct LanguageConfig {
    pub id: String,
    pub name: String,
    pub display_name: String,
    pub version: String,
    pub enabled: bool,
    pub file_extensions: Vec<String>,
    pub mime_types: Vec<String>,
    pub compile_command: Option<String>,
    pub run_command: String,
    pub wasm_runtime: Option<String>,
    pub wasm_preload: bool,
    pub resource_overrides: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct ExecutionConfigOverride {
    pub max_concurrent: Option<u32>,
    pub cpu_time_limit_secs: Option<u64>,
    pub wall_time_limit_secs: Option<u64>,
    pub memory_limit_mb: Option<u64>,
    pub disk_limit_mb: Option<u64>,
    pub daily_execution_limit: Option<u32>,
    pub daily_cpu_time_limit_secs: Option<u64>,
    pub queue_timeout_secs: Option<u64>,
    pub priority: Option<i32>,
}

pub type SharedConfig = Arc<RwLock<DynamicConfig>>;

/// 从数据库加载动态配置（运行时查询，无编译期检查）
pub async fn load_dynamic_config(pool: &sqlx::PgPool) -> anyhow::Result<DynamicConfig> {
    let mut config = DynamicConfig::default();

    // system_configs
    let rows = sqlx::query_as::<_, (String, serde_json::Value)>(
        "SELECT key, value FROM system_configs",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();
    for (key, value) in rows {
        config.system.insert(key, value);
    }

    // language_configs
    let rows = sqlx::query_as::<_, (String, String, String, String, bool)>(
        "SELECT id, name, display_name, version, enabled FROM language_configs WHERE enabled = true",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();
    for (id, name, display_name, version, enabled) in rows {
        config.languages.insert(
            id.clone(),
            LanguageConfig {
                id,
                name,
                display_name,
                version,
                enabled,
                ..Default::default()
            },
        );
    }

    // feature_flags
    let rows =
        sqlx::query_as::<_, (String, bool)>("SELECT key, enabled FROM feature_flags")
            .fetch_all(pool)
            .await
            .unwrap_or_default();
    for (key, enabled) in rows {
        config.feature_flags.insert(key, enabled);
    }

    Ok(config)
}
