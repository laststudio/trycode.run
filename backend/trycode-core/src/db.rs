use deadpool_postgres::{Config, Pool, Runtime};
use deadpool_redis::{Config as RedisConfig, Pool as RedisPool};
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::time::Duration;

pub async fn create_pg_pool(config: &crate::config::DatabaseConfig) -> anyhow::Result<PgPool> {
    let pool = PgPoolOptions::new()
        .max_connections(config.max_connections)
        .min_connections(config.min_connections)
        .acquire_timeout(Duration::from_secs(30))
        .idle_timeout(Duration::from_secs(600))
        .max_lifetime(Duration::from_secs(1800))
        .connect(&config.url())
        .await?;

    // Run migrations
    sqlx::migrate!("./migrations").run(&pool).await?;

    Ok(pool)
}

pub async fn create_deadpool_pg_pool(config: &crate::config::DatabaseConfig) -> anyhow::Result<Pool> {
    let mut pg_config = Config::new();
    pg_config.host = Some(config.host.clone());
    pg_config.port = Some(config.port);
    pg_config.dbname = Some(config.name.clone());
    pg_config.user = Some(config.user.clone());
    pg_config.password = Some(config.password.expose_secret().to_string());
    pg_config.manager = Some(deadpool_postgres::ManagerConfig {
        recycling_method: deadpool_postgres::RecyclingMethod::Fast,
    });

    let pool = pg_config.create_pool(Some(Runtime::Tokio1), tokio_postgres::NoTls)?;
    Ok(pool)
}

pub async fn create_redis_pool(config: &crate::config::RedisConfig) -> anyhow::Result<RedisPool> {
    let mut redis_config = RedisConfig::default();
    redis_config.url = Some(config.url());
    redis_config.max_size = Some(config.max_connections);
    let pool = redis_config.create_pool(Some(Runtime::Tokio1))?;
    Ok(pool)
}