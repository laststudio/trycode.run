use std::process::Command;
use tracing::{debug, info, warn};

/// gVisor runsc integration for secure container execution

#[derive(Debug, Clone)]
pub struct GVisorConfig {
    pub platform: GVisorPlatform,
    pub network: GVisorNetwork,
    pub filesystem: GVisorFilesystem,
    pub runtime_args: Vec<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum GVisorPlatform {
    Ptrace,
    Kvm,
}

#[derive(Debug, Clone, PartialEq)]
pub enum GVisorNetwork {
    None,
    Host,
    Bridge(String),
}

#[derive(Debug, Clone)]
pub struct GVisorFilesystem {
    pub rootfs_ro: bool,
    pub tmpfs_size: String,
    pub workspace_path: String,
}

impl Default for GVisorConfig {
    fn default() -> Self {
        Self {
            platform: GVisorPlatform::Ptrace,
            network: GVisorNetwork::None,
            filesystem: GVisorFilesystem {
                rootfs_ro: true,
                tmpfs_size: "400M".to_string(),
                workspace_path: "/workspace".to_string(),
            },
            runtime_args: vec![],
        }
    }
}

pub fn build_runsc_args(config: &GVisorConfig, container_name: &str, image: &str, cmd: &[String]) -> Vec<String> {
    let mut args = vec!["run".to_string()];

    // Platform
    match config.platform {
        GVisorPlatform::Ptrace => args.push("--platform=ptrace".to_string()),
        GVisorPlatform::Kvm => args.push("--platform=kvm".to_string()),
    }

    // Network
    match &config.network {
        GVisorNetwork::None => args.push("--network=none".to_string()),
        GVisorNetwork::Host => args.push("--network=host".to_string()),
        GVisorNetwork::Bridge(name) => args.push(format!("--network=bridge:{}", name)),
    }

    // Filesystem
    if config.filesystem.rootfs_ro {
        args.push("--rootfs=ro".to_string());
    }

    // Tmpfs
    args.push(format!("--tmpfs={}:size={},mode=1777", config.filesystem.workspace_path, config.filesystem.tmpfs_size));

    // Security
    args.push("--security=apparmor:unconfined".to_string()); // gVisor handles security
    args.push("--no-new-privileges".to_string());

    // Resource limits (will be set via Docker host config)
    // runsc doesn't directly manage cgroups - Docker does

    // Container name
    args.push("--name".to_string());
    args.push(container_name.to_string());

    // Image
    args.push(image.to_string());

    // Command
    args.extend(cmd.iter().cloned());

    // Additional runtime args
    args.extend(config.runtime_args.clone());

    args
}

pub fn validate_runsc_installation() -> Result<(), String> {
    let output = Command::new("runsc")
        .arg("--version")
        .output()
        .map_err(|e| format!("runsc not found: {}", e))?;

    if !output.status.success() {
        return Err("runsc version check failed".to_string());
    }

    let version = String::from_utf8_lossy(&output.stdout);
    info!("gVisor runsc version: {}", version.trim());

    Ok(())
}

pub fn check_kernel_compatibility() -> Result<(), String> {
    let output = Command::new("uname")
        .arg("-r")
        .output()
        .map_err(|e| format!("Failed to get kernel version: {}", e))?;

    let version_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
    info!("Host kernel version: {}", version_str);

    // Parse kernel version
    let parts: Vec<&str> = version_str.split('.').collect();
    if parts.len() >= 2 {
        let major: u32 = parts[0].parse().unwrap_or(0);
        let minor: u32 = parts[1].parse().unwrap_or(0);
        
        // gVisor ptrace platform works on kernel 4.14+
        // kvm platform needs 5.10+
        if major < 4 || (major == 4 && minor < 14) {
            warn!("Kernel version {} may not be compatible with gVisor ptrace platform", version_str);
        }
    }

    Ok(())
}

pub async fn run_with_gvisor(
    config: &GVisorConfig,
    container_name: &str,
    image: &str,
    cmd: &[String],
    timeout: std::time::Duration,
) -> Result<std::process::Output, String> {
    let args = build_runsc_args(config, container_name, image, cmd);
    
    debug!("Running runsc with args: {:?}", args);

    let mut child = tokio::process::Command::new("runsc")
        .args(&args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn runsc: {}", e))?;

    let result = tokio::time::timeout(timeout, child.wait_with_output()).await;

    match result {
        Ok(Ok(output)) => Ok(output),
        Ok(Err(e)) => Err(format!("runsc execution error: {}", e)),
        Err(_) => {
            // Timeout - kill the process
            warn!("gVisor execution timed out after {:?}, killing container", timeout);
            let _ = Command::new("runsc")
                .args(["kill", container_name])
                .output();
            Err("Execution timed out".to_string())
        }
    }
}

/// Generate Docker host config that works with gVisor
pub fn docker_host_config_for_gvisor(
    cpu_quota: i64,
    memory_bytes: i64,
    pids_limit: i64,
    disk_bytes: i64,
) -> bollard::models::HostConfig {
    use bollard::models::{Mount, MountTypeEnum, Resources, Ulimit};

    bollard::models::HostConfig {
        resources: Some(Resources {
            cpu_quota: Some(cpu_quota),
            memory: Some(memory_bytes),
            pids_limit: Some(pids_limit),
            ..Default::default()
        }),
        mounts: Some(vec![Mount {
            target: Some("/workspace".to_string()),
            source: Some("workspace".to_string()),
            typ: Some(MountTypeEnum::TMPFS),
            tmpfs: Some(bollard::models::TmpfsOptions {
                size_bytes: Some(disk_bytes as u64),
                mode: Some("1777".to_string()),
            }),
            ..Default::default()
        }]),
        network_mode: Some("none".to_string()), // gVisor handles network isolation
        read_only: Some(true),
        security_opt: Some(vec!["no-new-privileges:true".to_string()]),
        cap_drop: Some(vec!["ALL".to_string()]),
        cap_add: Some(vec!["SYS_PTRACE".to_string()]),
        ulimits: Some(vec![
            Ulimit {
                name: Some("nofile".to_string()),
                soft: Some(1024),
                hard: Some(1024),
            },
            Ulimit {
                name: Some("nproc".to_string()),
                soft: Some(pids_limit),
                hard: Some(pids_limit),
            },
        ]),
        ..Default::default()
    }
}