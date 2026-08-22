use axum::{
    extract::DefaultBodyLimit,
    http::{HeaderValue, Method},
    middleware,
    routing::{get, post},
    Router,
};
use axum_extra::extract::CookieJar;
use clap::Parser;
use std::sync::Arc;
use std::time::Duration;
use tokio::signal;
use tower::ServiceBuilder;
use tower_http::{
    cors::{Any, CorsLayer},
    compression::CompressionLayer,
    trace::TraceLayer,
};
use tracing::{info, warn};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use trycode_admin::{AdminState, get_system_config, update_system_config, get_system_status, get_admin_stats, list_audit_logs, list_executions_admin, get_execution_admin, list_users_admin, update_user_admin, test_smtp, test_captcha, test_oauth, test_database, initialize_super_admin, trigger_config_reload};
use trycode_ai::{AiState, ai_chat, ai_stream_chat, ai_explain_code, ai_review_code, ai_generate_tests};
use trycode_auth::{AuthState, register, login, logout, refresh_token, verify_email, resend_verification, forgot_password, reset_password, change_password, me, github_login, github_callback, AuthExtractor};
use trycode_collab::{CollabState, collab_websocket, get_collab_document, create_collab_document};
use trycode_core::{config::{load_dynamic_config, DynamicConfig, AppConfig}, db::{create_pg_pool, create_redis_pool}, metrics::init_metrics};
use trycode_execution::{ExecutionState, execute_code, get_execution, list_executions, get_execution_status, ExecutorPool, ExecutorConfig, ExecutionScheduler, SchedulerConfig};
use trycode_projects::{ProjectsState, create_project, get_project, update_project, delete_project, list_projects, fork_project, list_files, get_file, create_file, update_file, delete_file, move_file, create_share_link, get_share_link, verify_share_password, invite_collaborator, list_collaborators, update_collaborator, remove_collaborator};
use trycode_backend::lsp::{init_lsp_multiplexer, lsp_websocket_handler};

#[derive(Parser, Debug)]
#[command(name = "trycode-backend", version, about = "TryCode Backend API Server")]
struct Args {
    #[arg(long, default_value = "/config/backend.toml")]
    config: String,

    #[arg(long, default_value = "serve")]
    command: Command,

    #[arg(long)]
    migrate: bool,
}

#[derive(Debug, Clone, clap::ValueEnum)]
enum Command {
    Serve,
    Migrate,
    InitAdmin,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let args = Args::parse();

    // Initialize tracing
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::from_default_env())
        .with(tracing_subscriber::fmt::layer().json())
        .init();

    // Load configuration
    std::env::set_var("CONFIG_FILE", &args.config);
    let config = AppConfig::load()?;

    // Initialize metrics
    init_metrics()?;

    // Create database pools
    let pg_pool = create_pg_pool(&config.database).await?;
    let redis_pool = create_redis_pool(&config.redis).await?;

    // Run migrations if requested
    if args.migrate || args.command == Command::Migrate {
        info!("Running database migrations...");
        sqlx::migrate!("./migrations").run(&pg_pool).await?;
        info!("Migrations completed");
        return Ok(());
    }

    // Initialize dynamic config from database
    let dynamic_config = load_dynamic_config(&pg_pool).await?;
    let dynamic_config = Arc::new(tokio::sync::RwLock::new(dynamic_config));

    // Start config hot-reload listener
    let (config_reload_tx, mut config_reload_rx) = tokio::sync::broadcast::channel(16);
    let dynamic_config_clone = dynamic_config.clone();
    let pg_pool_clone = pg_pool.clone();
    tokio::spawn(async move {
        // Listen for PostgreSQL NOTIFY
        let mut pg_notify = pg_pool_clone.acquire().await?;
        sqlx::query("LISTEN config_changes").execute(&mut *pg_notify).await?;
        
        loop {
            tokio::select! {
                _ = config_reload_rx.recv() => {
                    info!("Config reload triggered via channel");
                    if let Ok(new_config) = load_dynamic_config(&pg_pool_clone).await {
                        *dynamic_config_clone.write().await = new_config;
                        info!("Dynamic config reloaded");
                    }
                }
                Ok(notification) = pg_notify.try_recv() => {
                    if notification.channel() == "config_changes" {
                        info!("Config change notification received");
                        if let Ok(new_config) = load_dynamic_config(&pg_pool_clone).await {
                            *dynamic_config_clone.write().await = new_config;
                            info!("Dynamic config reloaded from NOTIFY");
                        }
                    }
                }
            }
        }
    });

    // Initialize services
    let email_service = Arc::new(trycode_auth::EmailService::new(config.smtp.clone())?);
    let captcha_verifier = trycode_auth::create_verifier(config.captcha.clone());
    let auth_config = config.clone();

    let auth_state = Arc::new(AuthState {
        config: auth_config,
        db: pg_pool.clone(),
        redis: redis_pool.clone(),
        email_service: email_service.clone(),
        captcha_verifier,
        login_limiter: Arc::new(governor::RateLimiter::direct(
            governor::Quota::per_minute(std::num::NonZeroU32::new(10).unwrap())
        )),
        register_limiter: Arc::new(governor::RateLimiter::direct(
            governor::Quota::per_minute(std::num::NonZeroU32::new(5).unwrap())
        )),
        execute_limiter: Arc::new(governor::RateLimiter::direct(
            governor::Quota::per_minute(std::num::NonZeroU32::new(30).unwrap())
        )),
    });

    // Initialize executor pool
    let executor_config = ExecutorConfig {
        worker_names: config.executor.worker_names.clone(),
        default_timeout_secs: config.executor.default_timeout_secs,
        max_timeout_secs: config.executor.max_timeout_secs,
        max_output_bytes: config.executor.max_output_bytes,
        cpu_quota: config.executor.container_cpu_quota as i64,
        memory_limit_bytes: (config.executor.container_memory_mb * 1024 * 1024) as i64,
        pids_limit: config.executor.container_pids_limit as i64,
        disk_limit_bytes: (config.executor.disk_quota_mb * 1024 * 1024) as i64,
        global_max_concurrent: config.executor.global_max_concurrent as u32,
    };

    let executor_pool = Arc::new(ExecutorPool::new(
        bollard::Docker::connect_with_local_defaults()?,
        redis_pool.clone(),
        executor_config,
    ));

    // Initialize scheduler
    let scheduler_config = SchedulerConfig {
        global_max_concurrent: config.execution.global_max_concurrent,
        per_user_max_concurrent: config.execution.per_user_max_concurrent,
        queue_timeout_secs: config.execution.queue_timeout_secs,
        default_cpu_time_secs: config.execution.default_cpu_time_secs,
        default_memory_mb: config.execution.default_memory_mb,
        default_disk_mb: config.execution.default_disk_mb,
        default_wall_time_secs: config.execution.default_wall_time_secs,
    };

    let scheduler = Arc::new(trycode_execution::ExecutionScheduler::new(
        executor_pool.clone(),
        redis_pool.clone(),
        scheduler_config,
    ));

    // Start scheduler workers
    for worker_id in 1..=config.executor.worker_names.len() {
        scheduler.start_worker(worker_id as i32).await;
    }

    // Initialize limits engine
    let limits_engine = Arc::new(trycode_execution::LimitsEngine::new(dynamic_config.clone()));

    // Initialize file system
    let fs = Arc::new(trycode_projects::FileSystem::new(
        pg_pool.clone(),
        10 * 1024 * 1024, // 10MB max file
        100 * 1024 * 1024, // 100MB max project
    ));

    // Initialize collab broker
    let collab_broker = Arc::new(trycode_collab::YrsBroker::new(
        pg_pool.clone(),
        Duration::from_secs(30),
    ));

    // Initialize LSP Multiplexer
    let lsp_multiplexer = Arc::new(init_lsp_multiplexer().await?);

    // Initialize AI gateway
    let ai_config = trycode_ai::gateway::AiConfig {
        base_url: config.ai.base_url.clone(),
        api_key: config.ai.api_key.expose_secret().to_string(),
        default_model: config.ai.default_model.clone(),
        max_tokens: config.ai.max_tokens,
        temperature: config.ai.temperature,
        timeout_secs: config.ai.timeout_secs,
    };
    let ai_gateway = Arc::new(trycode_ai::AiGateway::new(ai_config));

    // Start background tasks
    start_background_tasks(pg_pool.clone(), redis_pool.clone(), dynamic_config.clone()).await;

    // Build application router
    let app = create_router(
        pg_pool.clone(),
        redis_pool.clone(),
        dynamic_config.clone(),
        auth_state,
        executor_pool,
        scheduler,
        limits_engine,
        fs,
        collab_broker,
        ai_gateway,
        email_service,
        config,
        config_reload_tx,
        lsp_multiplexer,
    ).await;

    // Start server
    let listener = tokio::net::TcpListener::bind((config.server.host.as_str(), config.server.port)).await?;
    info!("Server listening on http://{}:{}", config.server.host, config.server.port);

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

async fn create_router(
    pg_pool: sqlx::PgPool,
    redis_pool: deadpool_redis::Pool,
    dynamic_config: Arc<tokio::sync::RwLock<trycode_core::config::DynamicConfig>>,
    auth_state: Arc<trycode_auth::AuthState>,
    executor_pool: Arc<trycode_execution::ExecutorPool>,
    scheduler: Arc<trycode_execution::ExecutionScheduler>,
    limits_engine: Arc<trycode_execution::LimitsEngine>,
    fs: Arc<trycode_projects::FileSystem>,
    collab_broker: Arc<trycode_collab::YrsBroker>,
    ai_gateway: Arc<trycode_ai::AiGateway>,
    email_service: Arc<trycode_auth::EmailService>,
    config: trycode_core::config::AppConfig,
    config_reload_tx: tokio::sync::broadcast::Sender<()>,
    lsp_multiplexer: Arc<trycode_backend::lsp::multiplexer::LSPMultiplexer>,
) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(config.server.host.parse::<HeaderValue>().unwrap_or(HeaderValue::from_static("*")))
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::PATCH, Method::OPTIONS])
        .allow_headers(Any)
        .allow_credentials(true)
        .max_age(Duration::from_secs(3600));

    // Auth state
    let auth_state = Arc::new(AuthState {
        config: config.clone(),
        db: pg_pool.clone(),
        redis: redis_pool.clone(),
        email_service: email_service.clone(),
        captcha_verifier: trycode_auth::create_verifier(config.captcha.clone()),
        login_limiter: Arc::new(governor::RateLimiter::direct(
            governor::Quota::per_minute(std::num::NonZeroU32::new(10).unwrap())
        )),
        register_limiter: Arc::new(governor::RateLimiter::direct(
            governor::Quota::per_minute(std::num::NonZeroU32::new(5).unwrap())
        )),
        execute_limiter: Arc::new(governor::RateLimiter::direct(
            governor::Quota::per_minute(std::num::NonZeroU32::new(30).unwrap())
        )),
    });

    let auth_state_for_admin = auth_state.clone();

    // Execution state
    let execution_state = Arc::new(trycode_execution::ExecutionState {
        db: pg_pool.clone(),
        redis: redis_pool.clone(),
        pool: executor_pool,
        scheduler,
        limits_engine,
        dynamic_config: dynamic_config.clone(),
    });

    // Projects state
    let projects_state = Arc::new(trycode_projects::ProjectsState {
        db: pg_pool.clone(),
        fs: fs.clone(),
    });

    // Collab state
    let collab_state = Arc::new(trycode_collab::CollabState {
        db: pg_pool.clone(),
        broker: collab_broker,
    });

    // AI state
    let ai_state = Arc::new(trycode_ai::AiState {
        db: pg_pool.clone(),
        gateway: ai_gateway,
        config: config.clone(),
    });

    // Admin state
    let admin_state = Arc::new(trycode_admin::AdminState {
        db: pg_pool.clone(),
        redis: redis_pool.clone(),
        config: config.clone(),
        email_service: email_service.clone(),
        captcha_verifier: trycode_auth::create_verifier(config.captcha.clone()),
        config_reload_tx,
    });

    Router::new()
        .route("/health", get(health_check))
        .route("/api/lsp/ws", get(lsp_websocket_handler))
        .nest("/api/auth", auth_routes())
        .nest("/api/execute", execution_routes())
        .nest("/api/projects", project_routes())
        .nest("/api/collab", collab_routes())
        .nest("/api/ai", ai_routes())
        .nest("/api/admin", admin_routes())
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(CompressionLayer::new())
                .layer(cors)
                .layer(DefaultBodyLimit::max(10 * 1024 * 1024)) // 10MB
        )
        .with_state(())
}

fn auth_routes() -> Router<()> {
    Router::new()
        .route("/register", post(trycode_auth::register))
        .route("/login", post(trycode_auth::login))
        .route("/logout", post(trycode_auth::logout))
        .route("/refresh", post(trycode_auth::refresh_token))
        .route("/verify", post(trycode_auth::verify_email))
        .route("/resend-verification", post(trycode_auth::resend_verification))
        .route("/forgot-password", post(trycode_auth::forgot_password))
        .route("/reset-password", post(trycode_auth::reset_password))
        .route("/change-password", post(trycode_auth::change_password))
        .route("/me", get(trycode_auth::me))
        .route("/oauth/github", get(trycode_auth::github_login))
        .route("/oauth/github/callback", get(trycode_auth::github_callback))
}

fn execution_routes() -> Router<()> {
    Router::new()
        .route("/", post(trycode_execution::execute_code))
        .route("/:id", get(trycode_execution::get_execution))
        .route("/", get(trycode_execution::list_executions))
        .route("/:id/status", get(trycode_execution::get_execution_status))
}

fn project_routes() -> Router<()> {
    Router::new()
        .route("/", post(trycode_projects::create_project).get(trycode_projects::list_projects))
        .route("/:id", get(trycode_projects::get_project).put(trycode_projects::update_project).delete(trycode_projects::delete_project))
        .route("/:id/fork", post(trycode_projects::fork_project))
        .route("/:id/files", get(trycode_projects::list_files))
        .route("/:id/files", post(trycode_projects::create_file))
        .route("/:id/files/:file_id", get(trycode_projects::get_file).put(trycode_projects::update_file).delete(trycode_projects::delete_file))
        .route("/:id/files/:file_id/move", post(trycode_projects::move_file))
        .route("/:id/share", post(trycode_projects::create_share_link))
        .route("/share/:token", get(trycode_projects::get_share_link))
        .route("/share/:token/verify", post(trycode_projects::verify_share_password))
        .route("/:id/collaborators", get(trycode_projects::list_collaborators).post(trycode_projects::invite_collaborator))
        .route("/:id/collaborators/:user_id", put(trycode_projects::update_collaborator).delete(trycode_projects::remove_collaborator))
}

fn collab_routes() -> Router<()> {
    Router::new()
        .route("/ws/:project_id", get(trycode_collab::collab_websocket))
        .route("/documents/:project_id/:file_path", get(trycode_collab::get_collab_document))
        .route("/documents/:project_id/:file_path", post(trycode_collab::create_collab_document))
}

fn ai_routes() -> Router<()> {
    Router::new()
        .route("/chat", post(trycode_ai::ai_chat))
        .route("/chat/stream", post(trycode_ai::ai_stream_chat))
        .route("/explain", post(trycode_ai::ai_explain_code))
        .route("/review", post(trycode_ai::ai_review_code))
        .route("/generate-tests", post(trycode_ai::ai_generate_tests))
}

fn admin_routes() -> Router<()> {
    Router::new()
        .route("/config", get(trycode_admin::get_system_config))
        .route("/config/:key", put(trycode_admin::update_system_config))
        .route("/status", get(trycode_admin::get_system_status))
        .route("/stats", get(trycode_admin::get_admin_stats))
        .route("/audit-logs", get(trycode_admin::list_audit_logs))
        .route("/executions", get(trycode_admin::list_executions_admin))
        .route("/executions/:id", get(trycode_admin::get_execution_admin))
        .route("/users", get(trycode_admin::list_users_admin))
        .route("/users/:id", put(trycode_admin::update_user_admin))
        .route("/test/smtp", post(trycode_admin::test_smtp))
        .route("/test/captcha", post(trycode_admin::test_captcha))
        .route("/test/oauth", post(trycode_admin::test_oauth))
        .route("/test/database", post(trycode_admin::test_database))
        .route("/init-super-admin", post(trycode_admin::initialize_super_admin))
        .route("/reload-config", post(trycode_admin::trigger_config_reload))
}

async fn health_check() -> &'static str {
    "OK"
}

async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c().await.expect("Failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("Failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => info!("Received Ctrl+C, shutting down"),
        _ = terminate => info!("Received SIGTERM, shutting down"),
    }
}

async fn start_background_tasks(
    pg_pool: sqlx::PgPool,
    redis_pool: deadpool_redis::Pool,
    dynamic_config: Arc<tokio::sync::RwLock<trycode_core::config::DynamicConfig>>,
) {
    // Cleanup stale sessions
    let pg_cleanup = pg_pool.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(300)); // 5 minutes
        loop {
            interval.tick().await;
            // Cleanup expired sessions
            sqlx::query!("DELETE FROM sessions WHERE expires_at < NOW()")
                .execute(&pg_cleanup)
                .await
                .ok();
            
            // Cleanup expired email verifications
            sqlx::query!("DELETE FROM email_verifications WHERE expires_at < NOW()")
                .execute(&pg_cleanup)
                .await
                .ok();
            
            // Cleanup expired share links
            sqlx::query!("DELETE FROM share_links WHERE expires_at < NOW()")
                .execute(&pg_cleanup)
                .await
                .ok();
        }
    });

    // Cleanup collab sessions
    let collab_broker = trycode_collab::YrsBroker::new(pg_pool.clone(), Duration::from_secs(30));
    let broker = Arc::new(collab_broker);
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(300));
        loop {
            interval.tick().await;
            broker.cleanup_inactive_sessions(Duration::from_secs(3600)).await; // 1 hour
        }
    });

    // Periodic config reload from DB
    let pg_reload = pg_pool.clone();
    let dynamic_config_reload = dynamic_config.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(30));
        loop {
            interval.tick().await;
            if let Ok(new_config) = trycode_core::config::load_dynamic_config(&pg_reload).await {
                *dynamic_config_reload.write().await = new_config;
            }
        }
    });
}