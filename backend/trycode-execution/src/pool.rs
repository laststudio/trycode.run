use bollard::{
    container::{Config, CreateContainerOptions, StartContainerOptions, WaitContainerOptions},
    models::{HostConfig, Mount, MountTypeEnum, Resources, Ulimit},
    network::ConnectNetworkOptions,
    secret::ContainerCreateResponse,
    Docker,
};
use chrono::Utc;
use futures::stream::StreamExt;
use redis::AsyncCommands;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{Mutex, Semaphore};
use tracing::{error, info, warn};

use crate::models::{Execution, ExecutionResult, ExecutionStatus, QueueMessage, ResourceLimits, WorkerInfo, WorkerStatus};
use trycode_core::{CoreError, Result};

pub struct ExecutorPool {
    docker: Arc<Docker>,
    workers: Arc<Mutex<Vec<WorkerInfo>>>,
    redis: deadpool_redis::Pool,
    config: Arc<ExecutorConfig>,
    semaphore: Arc<Semaphore>,
}

#[derive(Debug, Clone)]
pub struct ExecutorConfig {
    pub worker_names: Vec<String>,
    pub default_timeout_secs: u32,
    pub max_timeout_secs: u32,
    pub max_output_bytes: usize,
    pub cpu_quota: i64,
    pub memory_limit_bytes: i64,
    pub pids_limit: i64,
    pub disk_limit_bytes: i64,
    pub global_max_concurrent: u32,
}

impl ExecutorPool {
    pub fn new(
        docker: Docker,
        redis: deadpool_redis::Pool,
        config: ExecutorConfig,
    ) -> Self {
        let semaphore = Arc::new(Semaphore::new(config.global_max_concurrent as usize));
        
        let workers = config.worker_names.iter().enumerate().map(|(i, name)| WorkerInfo {
            id: i as i32 + 1,
            name: name.clone(),
            status: WorkerStatus::Healthy,
            current_load: 0,
            max_load: 2,
            languages: vec![], // Will be populated from language configs
            last_heartbeat: Utc::now(),
        }).collect();

        Self {
            docker: Arc::new(docker),
            workers: Arc::new(Mutex::new(workers)),
            redis,
            config: Arc::new(config),
            semaphore,
        }
    }

    pub async fn submit_execution(&self, message: QueueMessage) -> Result<()> {
        let mut con = self.redis.get().await?;
        let payload = serde_json::to_vec(&message)?;
        con.xadd("exec:queue", "*", &[("data", payload)]).await?;
        Ok(())
    }

    pub async fn get_next_job(&self, worker_id: i32) -> Result<Option<QueueMessage>> {
        let mut con = self.redis.get().await?;
        
        // Try to claim a job using consumer group
        let result: Option<redis::streams::StreamReadReply> = con
            .xread_group(
                "exec-workers",
                &format!("worker-{}", worker_id),
                &[("exec:queue", ">")],
                &[("COUNT", "1"), ("BLOCK", "5000")],
            )
            .await?;

        if let Some(reply) = result {
            for stream in reply.keys {
                for entry in stream.entries {
                    if let Some(data) = entry.map.get("data") {
                        let message: QueueMessage = serde_json::from_slice(data)?;
                        // Acknowledge the message
                        let _: () = con.xack("exec:queue", "exec-workers", &[entry.id]).await?;
                        return Ok(Some(message));
                    }
                }
            }
        }

        Ok(None)
    }

    pub async fn execute(&self, message: QueueMessage) -> Result<ExecutionResult> {
        let _permit = self.semaphore.acquire().await.map_err(|_| CoreError::Internal("Semaphore closed".to_string()))?;
        
        // Update worker load
        self.increment_worker_load(message.payload.resource_limits.max_concurrent.unwrap_or(1) as i32).await;

        let worker = self.select_worker().await?;
        
        let result = self.run_in_container(&worker, &message).await;

        self.decrement_worker_load(message.payload.resource_limits.max_concurrent.unwrap_or(1) as i32).await;

        result
    }

    async fn select_worker(&self) -> Result<WorkerInfo> {
        let workers = self.workers.lock().await;
        let healthy_workers: Vec<_> = workers.iter()
            .filter(|w| w.status == WorkerStatus::Healthy && w.current_load < w.max_load)
            .collect();

        if healthy_workers.is_empty() {
            return Err(CoreError::Internal("No healthy workers available".to_string()));
        }

        // Select worker with least load
        let selected = healthy_workers.iter()
            .min_by_key(|w| w.current_load)
            .unwrap();

        Ok(selected.clone())
    }

    async fn increment_worker_load(&self, load: i32) {
        let mut workers = self.workers.lock().await;
        // In a real implementation, we'd track per-worker load
    }

    async fn decrement_worker_load(&self, load: i32) {
        let mut workers = self.workers.lock().await;
        // In a real implementation, we'd track per-worker load
    }

    async fn run_in_container(&self, worker: &WorkerInfo, message: &QueueMessage) -> Result<ExecutionResult> {
        let container_name = format!("exec-{}-{}", message.execution_id, Uuid::new_v4());
        
        // Build container config
        let config = self.build_container_config(&message.payload).await?;
        
        let host_config = self.build_host_config(&message.payload.resource_limits).await?;

        // Create container
        let container = self.docker
            .create_container(
                Some(CreateContainerOptions { name: container_name.clone() }),
                config,
            )
            .await
            .map_err(|e| CoreError::Internal(format!("Container create failed: {}", e)))?;

        // Start container
        self.docker
            .start_container(&container.id, None::<StartContainerOptions>)
            .await
            .map_err(|e| CoreError::Internal(format!("Container start failed: {}", e)))?;

        // Wait for completion with timeout
        let timeout = Duration::from_secs(message.payload.resource_limits.wall_time_secs as u64 + 10);
        
        let wait_result = tokio::time::timeout(timeout, async {
            let mut wait_stream = self.docker.wait_container(&container.id, None::<WaitContainerOptions>);
            while let Some(result) = wait_stream.next().await {
                match result {
                    Ok(status) => return Ok(status.status_code),
                    Err(e) => return Err(e),
                }
            }
            Err(bollard::errors::Error::from("Container wait stream ended"))
        }).await;

        let exit_code = match wait_result {
            Ok(Ok(code)) => code,
            Ok(Err(e)) => return Err(CoreError::Internal(format!("Container wait error: {}", e))),
            Err(_) => {
                // Timeout - kill container
                let _ = self.docker.kill_container(&container_name, None).await;
                return Ok(ExecutionResult {
                    status: ExecutionStatus::Timeout,
                    stdout: None,
                    stderr: Some("Execution timed out".to_string()),
                    exit_code: None,
                    cpu_time_ms: None,
                    wall_time_ms: None,
                    memory_peak_bytes: None,
                    disk_usage_bytes: None,
                    wasm_fallback: false,
                    fallback_reason: None,
                    error_message: Some("Execution timed out".to_string()),
                });
            }
        };

        // Get logs
        let stdout = self.get_container_logs(&container.id, true).await?;
        let stderr = self.get_container_logs(&container.id, false).await?;

        // Get stats
        let (cpu_time, memory_peak, disk_usage) = self.get_container_stats(&container.id).await?;

        // Cleanup
        let _ = self.docker.remove_container(&container.id, None).await;

        let status = if exit_code == 0 { ExecutionStatus::Completed } else { ExecutionStatus::Failed };

        Ok(ExecutionResult {
            status,
            stdout: Some(stdout),
            stderr: Some(stderr),
            exit_code: Some(exit_code as i32),
            cpu_time_ms: Some(cpu_time),
            wall_time_ms: None,
            memory_peak_bytes: Some(memory_peak),
            disk_usage_bytes: Some(disk_usage),
            wasm_fallback: false,
            fallback_reason: None,
            error_message: if exit_code != 0 { Some("Execution failed".to_string()) } else { None },
        })
    }

    async fn build_container_config(&self, payload: &crate::models::ExecutePayload) -> Result<Config> {
        let mut env = vec![];
        
        // Add environment variables
        env.push("HOME=/workspace".to_string());
        env.push("PATH=/usr/local/bin:/usr/bin:/bin".to_string());

        // Prepare the execution command based on language
        let cmd = self.build_execution_command(&payload).await?;

        Ok(Config {
            image: Some("trycode/executor:latest".to_string()),
            cmd: Some(vec!["sh".to_string(), "-c".to_string(), cmd]),
            env: Some(env),
            working_dir: Some("/workspace".to_string()),
            user: Some("1000:1000".to_string()),
            attach_stdout: Some(true),
            attach_stderr: Some(true),
            ..Default::default()
        })
    }

    async fn build_execution_command(&self, payload: &crate::models::ExecutePayload) -> Result<String> {
        let lang_config = self.get_language_config(&payload.language).await?;
        
        // Write files to workspace
        let mut commands = vec![];
        
        for file in &payload.files {
            let escaped_content = file.content.replace('"', "\\\"").replace('$', "\\$").replace('`', "\\`");
            commands.push(format!("cat > '{}' << 'EOF'\n{}\nEOF", file.path, escaped_content));
        }

        // Add compile command if needed
        if let Some(compile_cmd) = lang_config.compile_command {
            commands.push(compile_cmd.replace("{file}", &payload.files[0].path).replace("{output}", "/workspace/a.out"));
        }

        // Add run command
        let run_cmd = lang_config.run_command
            .replace("{file}", &payload.files[0].path)
            .replace("{output}", "/workspace/a.out")
            .replace("{dir}", "/workspace")
            .replace("{class}", "Main");

        commands.push(run_cmd);

        Ok(commands.join(" && "))
    }

    async fn get_language_config(&self, language: &str) -> Result<LanguageRuntimeConfig> {
        // This would be loaded from the database/config
        // For now, return a default
        Ok(LanguageRuntimeConfig {
            compile_command: None,
            run_command: format!("echo 'Language {} not configured'", language),
        })
    }

    async fn build_host_config(&self, limits: &ResourceLimits) -> Result<HostConfig> {
        let mut ulimits = vec![
            Ulimit {
                name: Some("nofile".to_string()),
                soft: Some(1024),
                hard: Some(1024),
            },
            Ulimit {
                name: Some("nproc".to_string()),
                soft: Some(limits.pids_limit as i64),
                hard: Some(limits.pids_limit as i64),
            },
        ];

        Ok(HostConfig {
            resources: Some(Resources {
                cpu_quota: Some(limits.cpu_quota as i64),
                memory: Some(limits.memory_limit_mb * 1024 * 1024),
                pids_limit: Some(limits.pids_limit as i64),
                ..Default::default()
            }),
            ulimits: Some(ulimits),
            mounts: Some(vec![Mount {
                target: Some("/workspace".to_string()),
                source: Some("workspace".to_string()),
                typ: Some(MountTypeEnum::TMPFS),
                tmpfs: Some(bollard::models::TmpfsOptions {
                    size_bytes: Some(limits.disk_mb as u64 * 1024 * 1024),
                    mode: Some("1777".to_string()),
                }),
                ..Default::default()
            }]),
            network_mode: Some("none".to_string()),
            read_only: Some(true),
            security_opt: Some(vec!["no-new-privileges:true".to_string()]),
            cap_drop: Some(vec!["ALL".to_string()]),
            cap_add: Some(vec!["SYS_PTRACE".to_string()]),
            ..Default::default()
        })
    }

    async fn get_container_logs(&self, container_id: &str, stdout: bool) -> Result<String> {
        let mut stream = self.docker.logs(
            container_id,
            Some(bollard::container::LogsOptions {
                stdout,
                stderr: !stdout,
                follow: false,
                tail: "all".to_string(),
                ..Default::default()
            }),
        );

        let mut output = String::new();
        while let Some(chunk) = stream.next().await {
            match chunk {
                Ok(bollard::container::LogOutput::StdOut { message }) => output.push_str(&String::from_utf8_lossy(&message)),
                Ok(bollard::container::LogOutput::StdErr { message }) => output.push_str(&String::from_utf8_lossy(&message)),
                _ => {}
            }
        }

        // Truncate if too large
        if output.len() > self.config.max_output_bytes {
            output.truncate(self.config.max_output_bytes);
            output.push_str("\n... [output truncated]");
        }

        Ok(output)
    }

    async fn get_container_stats(&self, container_id: &str) -> Result<(i64, i64, i64)> {
        // In a real implementation, this would parse docker stats
        // For now, return dummy values
        Ok((100, 64 * 1024 * 1024, 10 * 1024 * 1024))
    }

    pub async fn health_check(&self) -> Result<Vec<WorkerInfo>> {
        let mut workers = self.workers.lock().await;
        
        for worker in workers.iter_mut() {
            // Check if worker container is responsive
            // This is a simplified check
            worker.last_heartbeat = Utc::now();
        }

        Ok(workers.clone())
    }
}

#[derive(Debug, Clone)]
struct LanguageRuntimeConfig {
    compile_command: Option<String>,
    run_command: String,
}