use chrono::{DateTime, Utc};
use redis::AsyncCommands;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{Mutex, RwLock};
use tokio::time::interval;
use tracing::{debug, error, info, warn};

use crate::models::{Execution, ExecutionStatus, QueueMessage, ResourceLimits};
use crate::pool::ExecutorPool;
use trycode_core::{CoreError, Result};

pub struct ExecutionScheduler {
    pool: Arc<ExecutorPool>,
    redis: deadpool_redis::Pool,
    config: Arc<SchedulerConfig>,
    user_limits: Arc<RwLock<HashMap<String, UserLimit>>>,
    language_limits: Arc<RwLock<HashMap<String, LanguageLimit>>>,
}

#[derive(Debug, Clone)]
pub struct SchedulerConfig {
    pub global_max_concurrent: u32,
    pub per_user_max_concurrent: u32,
    pub queue_timeout_secs: u64,
    pub default_cpu_time_secs: u32,
    pub default_memory_mb: u32,
    pub default_disk_mb: u32,
    pub default_wall_time_secs: u32,
}

#[derive(Debug, Clone)]
struct UserLimit {
    current_executions: u32,
    daily_execution_count: u32,
    daily_cpu_time_secs: u64,
    last_reset: DateTime<Utc>,
}

#[derive(Debug, Clone)]
struct LanguageLimit {
    current_executions: u32,
    max_concurrent: u32,
}

impl ExecutionScheduler {
    pub fn new(
        pool: Arc<ExecutorPool>,
        redis: deadpool_redis::Pool,
        config: SchedulerConfig,
    ) -> Self {
        Self {
            pool,
            redis,
            config: Arc::new(config),
            user_limits: Arc::new(RwLock::new(HashMap::new())),
            language_limits: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn submit(&self, mut message: QueueMessage) -> Result<Uuid> {
        // Check user limits
        self.check_user_limits(&message.user_id).await?;

        // Check language limits
        self.check_language_limits(&message.language).await?;

        // Check queue timeout
        if message.created_at + chrono::Duration::seconds(self.config.queue_timeout_secs as i64) < Utc::now() {
            return Err(CoreError::RateLimited("Queue timeout".to_string()));
        }

        // Increment counters
        self.increment_user_counter(&message.user_id).await;
        self.increment_language_counter(&message.language).await;

        // Submit to queue
        self.pool.submit_execution(message.clone()).await?;

        Ok(message.execution_id)
    }

    async fn check_user_limits(&self, user_id: &Uuid) -> Result<()> {
        let limits = self.user_limits.read().await;
        if let Some(limit) = limits.get(&user_id.to_string()) {
            if limit.current_executions >= self.config.per_user_max_concurrent {
                return Err(CoreError::RateLimited("User concurrent execution limit reached".to_string()));
            }
        }
        Ok(())
    }

    async fn check_language_limits(&self, language: &str) -> Result<()> {
        let limits = self.language_limits.read().await;
        if let Some(limit) = limits.get(language) {
            if limit.current_executions >= limit.max_concurrent {
                return Err(CoreError::RateLimited(format!("Language {} concurrent limit reached", language)));
            }
        }
        Ok(())
    }

    async fn increment_user_counter(&self, user_id: &Uuid) {
        let mut limits = self.user_limits.write().await;
        let entry = limits.entry(user_id.to_string()).or_insert(UserLimit {
            current_executions: 0,
            daily_execution_count: 0,
            daily_cpu_time_secs: 0,
            last_reset: Utc::now(),
        });
        entry.current_executions += 1;
        entry.daily_execution_count += 1;
    }

    async fn increment_language_counter(&self, language: &str) {
        let mut limits = self.language_limits.write().await;
        let entry = limits.entry(language.to_string()).or_insert(LanguageLimit {
            current_executions: 0,
            max_concurrent: 10, // Default, would be loaded from config
        });
        entry.current_executions += 1;
    }

    pub async fn on_execution_complete(&self, user_id: &Uuid, language: &str, cpu_time_secs: u64) {
        // Decrement counters
        {
            let mut limits = self.user_limits.write().await;
            if let Some(limit) = limits.get_mut(&user_id.to_string()) {
                limit.current_executions = limit.current_executions.saturating_sub(1);
                limit.daily_cpu_time_secs += cpu_time_secs;
            }
        }

        {
            let mut limits = self.language_limits.write().await;
            if let Some(limit) = limits.get_mut(language) {
                limit.current_executions = limit.current_executions.saturating_sub(1);
            }
        }
    }

    pub async fn start_worker(&self, worker_id: i32) {
        let pool = self.pool.clone();
        let redis = self.redis.clone();
        
        tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(1));
            
            loop {
                interval.tick().await;
                
                match pool.get_next_job(worker_id).await {
                    Ok(Some(message)) => {
                        info!("Worker {} picked up job {}", worker_id, message.execution_id);
                        
                        // Update execution status to running
                        if let Err(e) = Self::update_execution_status(&redis, &message.execution_id, ExecutionStatus::Running).await {
                            error!("Failed to update execution status: {}", e);
                            continue;
                        }

                        // Execute
                        let result = pool.execute(message.clone()).await;

                        // Update execution with result
                        if let Err(e) = Self::update_execution_result(&redis, &message.execution_id, &result).await {
                            error!("Failed to update execution result: {}", e);
                        }

                        // Update metrics
                        if let Err(e) = Self::record_metrics(&redis, &message, &result).await {
                            error!("Failed to record metrics: {}", e);
                        }
                    }
                    Ok(None) => {
                        // No jobs available, continue
                    }
                    Err(e) => {
                        error!("Worker {} error getting job: {}", worker_id, e);
                    }
                }
            }
        });
    }

    async fn update_execution_status(redis: &deadpool_redis::Pool, execution_id: &Uuid, status: ExecutionStatus) -> Result<()> {
        let mut con = redis.get().await?;
        let key = format!("exec:status:{}", execution_id);
        let _: () = con.set(&key, serde_json::to_string(&status)?).await?;
        Ok(())
    }

    async fn update_execution_result(redis: &deadpool_redis::Pool, execution_id: &Uuid, result: &crate::pool::ExecutionResult) -> Result<()> {
        let mut con = redis.get().await?;
        let key = format!("exec:result:{}", execution_id);
        let _: () = con.set(&key, serde_json::to_string(result)?).await?;
        Ok(())
    }

    async fn record_metrics(redis: &deadpool_redis::Pool, message: &QueueMessage, result: &crate::pool::ExecutionResult) -> Result<()> {
        let mut con = redis.get().await?;
        
        let metrics = serde_json::json!({
            "language": message.language,
            "status": result.status,
            "duration_ms": result.wall_time_ms,
            "memory_peak_mb": result.memory_peak_bytes.map(|b| b as f64 / 1024.0 / 1024.0),
            "cpu_time_ms": result.cpu_time_ms,
            "wasm_fallback": result.wasm_fallback,
        });

        let _: () = con.lpush("exec:metrics", serde_json::to_string(&metrics)?).await?;
        let _: () = con.ltrim("exec:metrics", 0, 9999).await?; // Keep last 10000
        
        Ok(())
    }

    pub async fn cleanup_stale_executions(&self) -> Result<()> {
        // Find executions stuck in queued/running for too long
        // This would query the database and update statuses
        Ok(())
    }

    pub async fn get_queue_stats(&self) -> Result<QueueStats> {
        let mut con = self.redis.get().await?;
        
        let queued: u64 = con.xlen("exec:queue").await?;
        
        Ok(QueueStats {
            queued,
            running: 0, // Would need to track separately
            workers_available: self.config.global_max_concurrent,
        })
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct QueueStats {
    pub queued: u64,
    pub running: u64,
    pub workers_available: u32,
}