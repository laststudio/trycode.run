use trycode_core::config::{DynamicConfig, ExecutionConfigOverride};
use crate::models::{ExecutionStatus, ResourceLimits, WasmConfig};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::warn;

pub struct LimitsEngine {
    config: Arc<DynamicConfig>,
}

impl LimitsEngine {
    pub fn new(config: Arc<DynamicConfig>) -> Self {
        Self { config }
    }

    /// Calculate effective resource limits for an execution
    /// Priority: Language override > User config > Global default
    pub fn calculate_limits(
        &self,
        language: &str,
        user_id: &str,
        user_role: &str,
        requested: Option<ResourceLimits>,
    ) -> ResourceLimits {
        let mut limits = self.get_global_defaults();

        // Apply language overrides
        if let Some(lang_config) = self.config.languages.get(language) {
            if let Some(cpu) = lang_config.resource_overrides.get("cpu_time_secs") {
                if let Some(cpu) = cpu.as_u64() {
                    limits.cpu_time_secs = cpu as u32;
                }
            }
            if let Some(mem) = lang_config.resource_overrides.get("memory_mb") {
                if let Some(mem) = mem.as_u64() {
                    limits.memory_mb = mem as u32;
                }
            }
            if let Some(disk) = lang_config.resource_overrides.get("disk_mb") {
                if let Some(disk) = disk.as_u64() {
                    limits.disk_mb = disk as u32;
                }
            }
        }

        // Apply execution config overrides (from database)
        // Check language-specific execution config
        let lang_config_key = format!("language:{}", language);
        if let Some(override_config) = self.config.execution_configs.get(&lang_config_key) {
            limits = self.apply_override(limits, override_config);
        }

        // Check user-specific execution config
        let user_config_key = format!("user:{}", user_id);
        if let Some(override_config) = self.config.execution_configs.get(&user_config_key) {
            limits = self.apply_override(limits, override_config);
        }

        // Check global execution config
        if let Some(override_config) = self.config.execution_configs.get("global") {
            limits = self.apply_override(limits, override_config);
        }

        // Apply requested limits (but don't exceed configured maximums)
        if let Some(req) = requested {
            limits.cpu_time_secs = limits.cpu_time_secs.min(req.cpu_time_secs);
            limits.wall_time_secs = limits.wall_time_secs.min(req.wall_time_secs);
            limits.memory_mb = limits.memory_mb.min(req.memory_mb);
            limits.disk_mb = limits.disk_mb.min(req.disk_mb);
        }

        // Container-level hard limits (from system config)
        limits.cpu_quota = self.config.system.get("execution.container_cpu_quota")
            .and_then(|v| v.as_u64())
            .unwrap_or(100000);
        limits.memory_limit_mb = self.config.system.get("execution.container_memory_mb")
            .and_then(|v| v.as_u64())
            .unwrap_or(768);
        limits.pids_limit = self.config.system.get("execution.container_pids_limit")
            .and_then(|v| v.as_u64())
            .unwrap_or(100);

        limits
    }

    fn get_global_defaults(&self) -> ResourceLimits {
        ResourceLimits {
            cpu_time_secs: self.config.system.get("execution.default_cpu_time_secs")
                .and_then(|v| v.as_u64())
                .unwrap_or(30) as u32,
            wall_time_secs: self.config.system.get("execution.default_wall_time_secs")
                .and_then(|v| v.as_u64())
                .unwrap_or(60) as u32,
            memory_mb: self.config.system.get("execution.default_memory_mb")
                .and_then(|v| v.as_u64())
                .unwrap_or(256) as u32,
            disk_mb: self.config.system.get("execution.default_disk_mb")
                .and_then(|v| v.as_u64())
                .unwrap_or(100) as u32,
            cpu_quota: 100000,
            memory_limit_mb: 768,
            pids_limit: 100,
        }
    }

    fn apply_override(&self, mut limits: ResourceLimits, override_config: &ExecutionConfigOverride) -> ResourceLimits {
        if let Some(cpu) = override_config.cpu_time_limit_secs {
            limits.cpu_time_secs = cpu as u32;
        }
        if let Some(wall) = override_config.wall_time_limit_secs {
            limits.wall_time_secs = wall as u32;
        }
        if let Some(mem) = override_config.memory_limit_mb {
            limits.memory_mb = mem as u32;
        }
        if let Some(disk) = override_config.disk_limit_mb {
            limits.disk_mb = disk as u32;
        }
        limits
    }

    /// Calculate WASM configuration for a language
    pub fn calculate_wasm_config(&self, language: &str) -> WasmConfig {
        let enabled = self.config.feature_flags.get("exec_wasm_fallback").copied().unwrap_or(true);
        let timeout_ms = self.config.system.get("execution.wasm_timeout_ms")
            .and_then(|v| v.as_u64())
            .unwrap_or(5000);
        let preload = self.config.system.get("execution.wasm_preload")
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or_else(|| vec!["python".to_string(), "javascript".to_string(), "typescript".to_string()]);
        let fallback_triggers = vec![
            "timeout".to_string(),
            "oom".to_string(),
            "missing_runtime".to_string(),
            "compile_error".to_string(),
            "network_error".to_string(),
        ];

        WasmConfig {
            enabled: enabled && preload.contains(&language.to_string()),
            timeout_ms,
            preload_languages: preload,
            fallback_triggers,
        }
    }

    /// Check if execution should be allowed based on current usage
    pub fn check_quotas(&self, user_id: &str, language: &str) -> Result<(), QuotaExceeded> {
        // This would check against Redis counters
        // For now, always allow
        Ok(())
    }

    /// Get retry configuration for a language
    pub fn get_retry_config(&self, language: &str) -> RetryConfig {
        let _lang_key = format!("language:{}", language);
        let _ = language;

        // Default retry config
        // (per-language retry overrides are not part of ExecutionConfigOverride yet)
        RetryConfig {
            max_attempts: 3,
            backoff_base_ms: 1000,
            backoff_max_ms: 5000,
            retryable_errors: vec![
                "network_error".to_string(),
                "container_unhealthy".to_string(),
                "sandbox_init_failed".to_string(),
            ],
            non_retryable_errors: vec![
                "compile_error".to_string(),
                "runtime_error".to_string(),
                "timeout".to_string(),
                "oom".to_string(),
                "disk_quota_exceeded".to_string(),
            ],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryConfig {
    pub max_attempts: u32,
    pub backoff_base_ms: u64,
    pub backoff_max_ms: u64,
    pub retryable_errors: Vec<String>,
    pub non_retryable_errors: Vec<String>,
}

#[derive(Debug, thiserror::Error)]
pub enum QuotaExceeded {
    #[error("Global concurrent execution limit reached")]
    GlobalLimit,
    #[error("User concurrent execution limit reached")]
    UserLimit,
    #[error("Language concurrent execution limit reached: {0}")]
    LanguageLimit(String),
    #[error("Daily execution limit reached")]
    DailyLimit,
    #[error("Daily CPU time limit reached")]
    DailyCpuLimit,
    #[error("Queue timeout")]
    QueueTimeout,
}

impl RetryConfig {
    pub fn is_retryable(&self, error: &str) -> bool {
        if self.non_retryable_errors.iter().any(|e| error.contains(e)) {
            return false;
        }
        self.retryable_errors.iter().any(|e| error.contains(e))
    }

    pub fn calculate_backoff(&self, attempt: u32) -> u64 {
        let backoff = self.backoff_base_ms * (2_u64.pow(attempt.min(10)));
        backoff.min(self.backoff_max_ms)
    }
}