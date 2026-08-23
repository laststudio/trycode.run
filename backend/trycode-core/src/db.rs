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

    Ok(pool)
}

pub async fn create_redis_pool(config: &crate::config::RedisConfig) -> anyhow::Result<deadpool_redis::Pool> {
    let cfg = deadpool_redis::Config::from_url(config.url());
    let pool = cfg.create_pool(Some(deadpool_redis::Runtime::Tokio1))?;
    Ok(pool)
}
