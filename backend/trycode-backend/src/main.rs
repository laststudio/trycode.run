mod lsp;

use axum::{
    extract::DefaultBodyLimit,
    http::{HeaderValue, Method},
    middleware as axum_middleware,
    routing::{get, post, put},
    Router,
};
use clap::Parser;
use std::sync::Arc;
use std::time::Duration;
use tokio::signal;
use tower::ServiceBuilder;
use tower_http::{
    cors::CorsLayer,
    trace::TraceLayer,
};
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use trycode_admin::{
    get_system_config, get_system_status, initialize_super_admin, list_audit_logs,
    list_executions_admin, list_users_admin, test_database, test_smtp, trigger_config_reload,
    update_system_config, update_user_admin, AdminState,
};
use trycode_ai::{ai_chat, ai_explain_code, ai_generate_tests, ai_review_code, ai_stream_chat};
use trycode_auth::{
    change_password, create_verifier, forgot_password, github_callback, github_login, login,
    logout, me, refresh_token, register, resend_verification, reset_password, verify_email,
    AuthState, EmailService,
};
use trycode_collab::{collab_websocket, create_collab_document, get_collab_document, CollabState};
use trycode_core::config::{load_dynamic_config, AppConfig, DynamicConfig};
use trycode_core::db::{create_pg_pool, create_redis_pool};
use trycode_core::metrics::init_metrics;
use trycode_execution::{
    execute_code, get_execution, get_execution_status, list_executions, ExecutorConfig,
    ExecutorPool, ExecutionScheduler, SchedulerConfig,
};
use trycode_projects::ProjectsState;

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

type SharedDynamicConfig = Arc<tokio::sync::RwLock<DynamicConfig>>;

fn make_keyed_limiter(per_minute: u32) -> Arc<trycode_auth::routes::RateLimiterType> {
    Arc::new(governor::RateLimiter::keyed(governor::Quota::per_minute(
        std::num::NonZeroU32::new(per_minute).unwrap(),
    )))
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
    let config = AppConfig::load().map_err(|e| anyhow::anyhow!("config load error: {}", e))?;

    // Initialize metrics
    init_metrics()?;

    // Create database pools
    let pg_pool = create_pg_pool(&config.database).await?;
    let redis_pool = create_redis_pool(&config.redis).await?;

    // Run migrations if requested
    if args.migrate || matches!(args.command, Command::Migrate) {
        info!("Running database migrations...");
        sqlx::migrate!("../migrations").run(&pg_pool).await?;
        info!("Migrations completed");
        return Ok(());
    }

    // Initialize dynamic config from database
    let dynamic_config: SharedDynamicConfig =
        Arc::new(tokio::sync::RwLock::new(load_dynamic_config(&pg_pool).await?));

    // Start background tasks
    start_background_tasks(pg_pool.clone(), dynamic_config.clone()).await;

    // Initialize services
    let email_service = Arc::new(EmailService::new(config.smtp.clone())?);
    let captcha_verifier = create_verifier(config.captcha.clone());

    let auth_state = Arc::new(AuthState {
        config: config.clone(),
        db: pg_pool.clone(),
        redis: redis_pool.clone(),
        email_service: email_service.clone(),
        captcha_verifier,
        login_limiter: make_keyed_limiter(10),
        register_limiter: make_keyed_limiter(5),
        execute_limiter: make_keyed_limiter(30),
    });

    // Initialize executor pool
    let executor_config = ExecutorConfig {
        worker_names: config.execution.worker_names.clone(),
        default_timeout_secs: config.execution.default_timeout_secs,
        max_timeout_secs: config.execution.max_timeout_secs,
        max_output_bytes: config.execution.max_output_bytes,
        cpu_quota: config.execution.container_cpu_quota as i64,
        memory_limit_bytes: (config.execution.container_memory_mb * 1024 * 1024) as i64,
        pids_limit: config.execution.container_pids_limit as i64,
        disk_limit_bytes: (config.execution.disk_quota_mb * 1024 * 1024) as i64,
        global_max_concurrent: config.execution.global_max_concurrent,
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
        default_cpu_time_secs: config.execution.default_cpu_time_secs as u32,
        default_memory_mb: config.execution.default_memory_mb as u32,
        default_disk_mb: config.execution.default_disk_mb as u32,
        default_wall_time_secs: config.execution.default_wall_time_secs as u32,
    };

    let scheduler = Arc::new(ExecutionScheduler::new(
        executor_pool.clone(),
        redis_pool.clone(),
        scheduler_config,
    ));

    // Start scheduler workers
    for worker_id in 1..=config.execution.worker_names.len().max(1) {
        scheduler.start_worker(worker_id as i32).await;
    }

    // Initialize limits engine（LimitsEngine 接受 Arc<DynamicConfig> 快照）
    let limits_engine = {
        let snapshot = Arc::new(dynamic_config.read().await.clone());
        Arc::new(trycode_execution::LimitsEngine::new(snapshot))
    };

    // Initialize file system
    let fs = Arc::new(trycode_projects::FileSystem::new(
        pg_pool.clone(),
        10 * 1024 * 1024,   // 10MB max file
        100 * 1024 * 1024,  // 100MB max project
    ));

    // Initialize collab broker
    let collab_broker = Arc::new(trycode_collab::YrsBroker::new(
        pg_pool.clone(),
        Duration::from_secs(30),
    ));

    // Initialize LSP Multiplexer
    let lsp_multiplexer = lsp::init_lsp_multiplexer().await?;

    // Build application router
    let server_port = config.server.port;
    let app = build_router(BuildRouterArgs {
        config,
        pg_pool,
        redis_pool,
        dynamic_config,
        auth_state,
        executor_pool,
        scheduler,
        limits_engine,
        fs,
        collab_broker,
        email_service,
        lsp_multiplexer,
    })
    .await;

    let listener = tokio::net::TcpListener::bind(("0.0.0.0", server_port)).await?;
    info!("Server listening on http://0.0.0.0:{}", server_port);

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

struct BuildRouterArgs {
    config: AppConfig,
    pg_pool: sqlx::PgPool,
    redis_pool: deadpool_redis::Pool,
    dynamic_config: SharedDynamicConfig,
    auth_state: Arc<AuthState>,
    executor_pool: Arc<ExecutorPool>,
    scheduler: Arc<ExecutionScheduler>,
    limits_engine: Arc<trycode_execution::LimitsEngine>,
    fs: Arc<trycode_projects::FileSystem>,
    collab_broker: Arc<trycode_collab::YrsBroker>,
    email_service: Arc<EmailService>,
    lsp_multiplexer: Arc<lsp::multiplexer::LSPMultiplexer>,
}

async fn build_router(a: BuildRouterArgs) -> Router {
    let config = a.config;

    let cors = CorsLayer::new()
        .allow_origin([HeaderValue::from_static("*")])
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::PATCH,
            Method::OPTIONS,
        ])
        .allow_headers(tower_http::cors::Any)
        .max_age(Duration::from_secs(3600));

    let jwt = config.jwt.clone();

    // Execution state
    let execution_state = Arc::new(trycode_execution::ExecutionState {
        db: a.pg_pool.clone(),
        redis: a.redis_pool.clone(),
        pool: a.executor_pool.clone(),
        scheduler: a.scheduler.clone(),
        limits_engine: a.limits_engine,
        dynamic_config: a.dynamic_config.clone(),
        jwt: jwt.clone(),
    });

    // Exec WebSocket state
    let exec_ws_state = trycode_execution::ExecWSState {
        pool: a.executor_pool.clone(),
        scheduler: a.scheduler.clone(),
        redis: a.redis_pool.clone(),
    };

    // Projects state
    let projects_state = ProjectsState {
        db: a.pg_pool.clone(),
        fs: a.fs.clone(),
        jwt: jwt.clone(),
    };

    // Collab state
    let collab_state = Arc::new(CollabState {
        db: a.pg_pool.clone(),
        broker: a.collab_broker.clone(),
        jwt: jwt.clone(),
    });

    // AI state（在 build_router 内直接构造 gateway，避免部分移动后的借用冲突）
    let ai_gateway = {
        let cfg = trycode_ai::gateway::AiConfig {
            base_url: config.ai.base_url.clone(),
            api_key: config.ai.api_key.clone(),
            default_model: config.ai.default_model.clone(),
            max_tokens: config.ai.max_tokens,
            temperature: config.ai.temperature,
            timeout_secs: config.ai.timeout_secs,
        };
        Arc::new(trycode_ai::AiGateway::new(cfg))
    };
    let ai_state = Arc::new(trycode_ai::AiState {
        db: a.pg_pool.clone(),
        gateway: ai_gateway,
        config: config.clone(),
    });

    // Admin state
    let admin_state = Arc::new(AdminState {
        db: a.pg_pool.clone(),
        redis: a.redis_pool.clone(),
        config: config.clone(),
        email_service: a.email_service.clone(),
        captcha_verifier: create_verifier(config.captcha.clone()),
        config_reload_tx: CONFIG_RELOAD_TX
            .get_or_init(|| tokio::sync::broadcast::channel(16).0)
            .clone(),
    });

    // LSP websocket state
    let lsp_ws_state = lsp::ws_proxy::LspWSState {
        multiplexer: a.lsp_multiplexer.clone(),
    };

    let auth_router = auth_routes().with_state(a.auth_state.clone());
    let execution_router = execution_routes().with_state(execution_state);
    let projects_router = project_routes().with_state(projects_state);
    let collab_router = collab_routes().with_state(collab_state);
    let ai_router = ai_routes().with_state(ai_state);
    let admin_router = admin_routes().with_state(admin_state);

    Router::new()
        .route("/health", get(health_check))
        .route(
            "/api/lsp/ws",
            get(lsp::ws_proxy::lsp_websocket_handler).with_state(lsp_ws_state),
        )
        .route(
            "/api/execute/ws/:execution_id",
            get(trycode_execution::exec_websocket_handler).with_state(exec_ws_state),
        )
        .nest("/api/auth", auth_router)
        .nest("/api/execute", execution_router)
        .nest("/api/projects", projects_router)
        .nest("/api/collab", collab_router)
        .nest("/api/ai", ai_router)
        .nest("/api/admin", admin_router)
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(axum_middleware::from_fn(http_metrics_middleware))
                .layer(cors)
                .layer(DefaultBodyLimit::max(10 * 1024 * 1024)), // 10MB
        )
}

static CONFIG_RELOAD_TX: std::sync::OnceLock<tokio::sync::broadcast::Sender<()>> =
    std::sync::OnceLock::new();

async fn http_metrics_middleware(
    req: axum::extract::Request,
    next: axum::middleware::Next,
) -> axum::response::Response {
    let method = req.method().to_string();
    let path = req.uri().path().to_string();
    let start = std::time::Instant::now();
    let resp = next.run(req).await;
    trycode_core::metrics::http_metrics::record_request(
        &method,
        &path,
        resp.status().as_u16(),
        start.elapsed(),
    );
    resp
}

fn auth_routes() -> Router<Arc<AuthState>> {
    use trycode_auth::*;
    Router::new()
        .route("/register", post(register))
        .route("/login", post(login))
        .route("/logout", post(logout))
        .route("/refresh", post(refresh_token))
        .route("/verify", post(verify_email))
        .route("/resend-verification", post(resend_verification))
        .route("/forgot-password", post(forgot_password))
        .route("/reset-password", post(reset_password))
        .route("/change-password", post(change_password))
        .route("/me", get(me))
        .route("/oauth/github", get(github_login))
        .route("/oauth/github/callback", get(github_callback))
}

fn execution_routes() -> Router<Arc<trycode_execution::ExecutionState>> {
    Router::new()
        .route("/", post(execute_code))
        .route("/:id", get(get_execution))
        .route("/", get(list_executions))
        .route("/:id/status", get(get_execution_status))
        .route("/:id/stream", get(trycode_execution::stream_execution))
}

fn project_routes() -> Router<trycode_projects::ProjectsState> {
    use trycode_projects::*;
    Router::new()
        .route("/", post(create_project).get(list_projects))
        .route(
            "/:id",
            get(get_project)
                .put(update_project)
                .delete(delete_project),
        )
        .route("/:id/fork", post(fork_project))
        .route("/:id/files", get(list_files).post(create_file))
        .route(
            "/:id/files/:file_id",
            get(get_file).put(update_file).delete(delete_file),
        )
        .route("/:id/files/:file_id/move", post(move_file))
        .route("/:id/share", post(create_share_link))
        .route("/share/:token", get(get_share_link))
        .route("/share/:token/verify", post(verify_share_password))
        .route(
            "/:id/collaborators",
            get(list_collaborators).post(invite_collaborator),
        )
        .route(
            "/:id/collaborators/:user_id",
            put(update_collaborator).delete(remove_collaborator),
        )
}

fn collab_routes() -> Router<Arc<CollabState>> {
    Router::new()
        .route("/ws/:project_id", get(collab_websocket))
        .route(
            "/documents/:project_id/:file_path",
            get(get_collab_document).post(create_collab_document),
        )
}

fn ai_routes() -> Router<Arc<trycode_ai::AiState>> {
    Router::new()
        .route("/chat", post(ai_chat))
        .route("/chat/stream", post(ai_stream_chat))
        .route("/explain", post(ai_explain_code))
        .route("/review", post(ai_review_code))
        .route("/generate-tests", post(ai_generate_tests))
}

fn admin_routes() -> Router<Arc<AdminState>> {
    Router::new()
        .route("/config", get(get_system_config))
        .route("/config/:key", put(update_system_config))
        .route("/status", get(get_system_status))
        .route("/audit-logs", get(list_audit_logs))
        .route("/executions", get(list_executions_admin))
        .route("/users", get(list_users_admin))
        .route("/users/:id", put(update_user_admin))
        .route("/test/smtp", post(test_smtp))
        .route("/test/database", post(test_database))
        .route("/init-super-admin", post(initialize_super_admin))
        .route("/reload-config", post(trigger_config_reload))
}

async fn health_check() -> &'static str {
    "OK"
}

async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("Failed to install Ctrl+C handler");
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

async fn start_background_tasks(pg_pool: sqlx::PgPool, dynamic_config: SharedDynamicConfig) {
    // Cleanup stale sessions / verifications / share links every 5 minutes
    let pg_cleanup = pg_pool.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(300));
        loop {
            interval.tick().await;
            for sql in [
                "DELETE FROM sessions WHERE expires_at < NOW()",
                "DELETE FROM email_verifications WHERE expires_at < NOW()",
                "DELETE FROM share_links WHERE expires_at < NOW()",
            ] {
                if let Err(e) = sqlx::query(sql).execute(&pg_cleanup).await {
                    tracing::warn!("cleanup query failed: {}", e);
                }
            }
        }
    });

    // Cleanup inactive collab sessions hourly
    // （broker 在请求路径中按需创建，此处跳过全局清理以避免重复实例）

    // Periodic dynamic config reload from DB
    let pg_reload = pg_pool.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(30));
        loop {
            interval.tick().await;
            if let Ok(new_config) = load_dynamic_config(&pg_reload).await {
                *dynamic_config.write().await = new_config;
            }
        }
    });
}

// 保持 HashSet 导入被使用（validation 集合等未来扩展点）
