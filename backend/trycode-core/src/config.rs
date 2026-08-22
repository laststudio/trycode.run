use figment::{
    providers::{Env, Format, Toml},
    Figment,
};
use secrecy::{ExposeSecret, SecretString};
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
    #[serde(skip_serializing)]
    pub password: SecretString,
    pub max_connections: u32,
    pub min_connections: u32,
}

impl DatabaseConfig {
    pub fn url(&self) -> String {
        format!(
            "postgres://{}:{}@{}:{}/{}",
            self.user,
            self.password.expose_secret(),
            self.host,
            self.port,
            self.name
        )
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedisConfig {
    pub host: String,
    pub port: u16,
    #[serde(skip_serializing)]
    pub password: Option<SecretString>,
    pub db: i64,
    pub max_connections: u32,
}

impl RedisConfig {
    pub fn url(&self) -> String {
        match &self.password {
            Some(pwd) => format!(
                "redis://:{}@{}:{}/{}",
                pwd.expose_secret(),
                self.host,
                self.port,
                self.db
            ),
            None => format!("redis://{}:{}/{}", self.host, self.port, self.db),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmtpConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    #[serde(skip_serializing)]
    pub password: SecretString,
    pub from: String,
    pub tls: SmtpTlsMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SmtpTlsMode {
    None,
    Starttls,
    Tls,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptchaConfig {
    pub provider: CaptchaProvider,
    pub site_key: String,
    #[serde(skip_serializing)]
    pub secret_key: SecretString,
    pub verify_url: String,
    pub enabled: bool,
    pub actions: Vec<CaptchaAction>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum CaptchaProvider {
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthConfig {
    pub github: GitHubOAuthConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubOAuthConfig {
    pub enabled: bool,
    pub client_id: String,
    #[serde(skip_serializing)]
    pub client_secret: SecretString,
    pub redirect_url: String,
    pub scopes: Vec<String>,
    pub allowed_domains: Vec<String>,
    pub auto_create_user: bool,
    pub default_role: UserRole,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum UserRole {
    User,
    Admin,
    SuperAdmin,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiConfig {
    pub enabled: bool,
    pub base_url: String,
    #[serde(skip_serializing)]
    pub api_key: SecretString,
    pub default_model: String,
    pub max_tokens: u32,
    pub temperature: f32,
    pub timeout_secs: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionConfig {
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

/// LSP (Language Server Protocol) 配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LSPConfig {
    pub enabled: bool,
    pub websocket_port: u16,
    pub max_connections: usize,
    pub request_timeout_secs: u64,
    pub max_request_size: usize,
    pub enable_compression: bool,
    pub heartbeat_interval_secs: u64,
    pub max_message_size: usize,
    pub max_connections_per_language: usize,
}

impl Default for LSPConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            websocket_port: 3001,
            max_connections: 1000,
            request_timeout_secs: 30,
            max_request_size: 10 * 1024 * 1024,
            enable_compression: true,
            heartbeat_interval_secs: 30,
            max_message_size: 10 * 1024 * 1024,
            max_connections_per_language: 100,
        }
    }
}

/// LSP 语言服务器配置（动态配置覆盖）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LSPServerConfigOverride {
    pub language_id: String,
    pub enabled: bool,
    pub mode: String, // "resident", "on_demand", "hybrid"
    pub memory_limit_mb: Option<u64>,
    pub idle_timeout_secs: Option<u64>,
    pub max_restarts: Option<u32>,
    pub restart_delay_secs: Option<u64>,
    pub custom_args: Option<Vec<String>>,
    pub custom_env: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryConfig {
    pub max_attempts: u32,
    pub backoff_base_ms: u64,
    pub backoff_max_ms: u64,
    pub retryable_errors: Vec<String>,
    pub non_retryable_errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WasmFallbackConfig {
    pub enabled: bool,
    pub timeout_ms: u64,
    pub preload_languages: Vec<String>,
    pub fallback_triggers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub workers: usize,
    pub shutdown_timeout_secs: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JwtConfig {
    #[serde(skip_serializing)]
    pub secret: SecretString,
    pub access_token_ttl_secs: u64,
    pub refresh_token_ttl_secs: u64,
    pub issuer: String,
    pub audience: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Argon2Config {
    pub memory_kib: u32,
    pub iterations: u32,
    pub parallelism: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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
            .merge(Toml::file(std::env::var("CONFIG_FILE").unwrap_or_else(|_| "/config/backend.toml".to_string())))
            .merge(Env::prefixed("TRYCODE_").split("_"))
            .extract()
    }
}

/// Dynamic configuration loaded from database, supports hot reload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DynamicConfig {
    pub system: HashMap<String, serde_json::Value>,
    pub languages: HashMap<String, LanguageConfig>,
    pub execution_configs: HashMap<String, ExecutionConfigOverride>,
    pub feature_flags: HashMap<String, bool>,
    pub captcha: Option<CaptchaConfig>,
    pub oauth: Option<OAuthConfig>,
    pub ai: Option<AiConfig>,
    pub smtp: Option<SmtpConfig>,
    pub lsp: Option<LSPConfig>,
    pub lsp_servers: HashMap<String, LSPServerConfigOverride>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
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
    pub retry_config: Option<RetryConfig>,
    pub wasm_fallback_config: Option<WasmFallbackConfig>,
}

impl Default for DynamicConfig {
    fn default() -> Self {
        Self {
            system: HashMap::new(),
            languages: HashMap::new(),
            execution_configs: HashMap::new(),
            feature_flags: HashMap::new(),
            captcha: None,
            oauth: None,
            ai: None,
            smtp: None,
        }
    }
}

pub type SharedConfig = Arc<RwLock<DynamicConfig>>;

pub async fn load_dynamic_config(pool: &sqlx::PgPool) -> anyhow::Result<DynamicConfig> {
    let mut config = DynamicConfig::default();

    // Load system configs
    let rows = sqlx::query!("SELECT key, value FROM system_configs")
        .fetch_all(pool)
        .await?;
    for row in rows {
        config.system.insert(row.key, row.value);
    }

    // Load language configs
    let rows = sqlx::query!("SELECT * FROM language_configs WHERE enabled = true")
        .fetch_all(pool)
        .await?;
    for row in rows {
        config.languages.insert(
            row.id,
            LanguageConfig {
                id: row.id,
                name: row.name,
                display_name: row.display_name,
                version: row.version,
                enabled: row.enabled,
                file_extensions: row.file_extensions,
                mime_types: row.mime_types,
                compile_command: row.compile_command,
                run_command: row.run_command,
                wasm_runtime: row.wasm_runtime,
                wasm_preload: row.wasm_preload,
                resource_overrides: row.resource_overrides,
            },
        );
    }

    // Load execution configs
    let rows = sqlx::query!("SELECT * FROM execution_configs")
        .fetch_all(pool)
        .await?;
    for row in rows {
        config.execution_configs.insert(
            row.id,
            ExecutionConfigOverride {
                max_concurrent: row.max_concurrent,
                cpu_time_limit_secs: row.cpu_time_limit_secs,
                wall_time_limit_secs: row.wall_time_limit_secs,
                memory_limit_mb: row.memory_limit_mb,
                disk_limit_mb: row.disk_limit_mb,
                daily_execution_limit: row.daily_execution_limit,
                daily_cpu_time_limit_secs: row.daily_cpu_time_limit_secs,
                queue_timeout_secs: row.queue_timeout_secs,
                priority: row.priority,
                retry_config: row.retry_config,
                wasm_fallback_config: row.wasm_fallback_config,
            },
        );
    }

    // Load feature flags
    let rows = sqlx::query!("SELECT key, enabled FROM feature_flags")
        .fetch_all(pool)
        .await?;
    for row in rows {
        config.feature_flags.insert(row.key, row.enabled);
    }

    Ok(config)
}