use clap::Parser;
use prometheus::{Encoder, TextEncoder};
use prometheus_client::encoding::text::encode;
use prometheus_client::metrics::counter::Counter;
use prometheus_client::metrics::gauge::Gauge;
use prometheus_client::metrics::histogram::{exponential_buckets, Histogram};
use prometheus_client::registry::Registry;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use sysinfo::{System, SystemExt, CpuExt, ProcessExt, PidExt};
use tokio::signal;
use tokio::time::interval;
use tracing::{info, error};

#[derive(Parser, Debug)]
#[command(name = "executor-daemon")]
struct Args {
    #[arg(long, default_value = "9090")]
    metrics_port: u16,

    #[arg(long, default_value = "1")]
    worker_id: u32,
}

#[derive(Clone)]
struct Metrics {
    registry: Arc<Registry>,
    executions_total: Counter,
    executions_active: Gauge,
    execution_duration: Histogram,
    cpu_usage: Gauge,
    memory_usage: Gauge,
    disk_usage: Gauge,
    queue_depth: Gauge,
}

impl Metrics {
    fn new(worker_id: u32) -> Self {
        let registry = Arc::new(Registry::default());

        let executions_total = Counter::default();
        let executions_active = Gauge::default();
        let execution_duration = Histogram::new(exponential_buckets(0.01, 2.0, 20).unwrap());
        let cpu_usage = Gauge::default();
        let memory_usage = Gauge::default();
        let disk_usage = Gauge::default();
        let queue_depth = Gauge::default();

        registry.register(
            "executions_total",
            "Total number of executions",
            executions_total.clone(),
        );
        registry.register(
            "executions_active",
            "Currently active executions",
            executions_active.clone(),
        );
        registry.register(
            "execution_duration_seconds",
            "Execution duration in seconds",
            execution_duration.clone(),
        );
        registry.register(
            "cpu_usage_percent",
            "CPU usage percentage",
            cpu_usage.clone(),
        );
        registry.register(
            "memory_usage_bytes",
            "Memory usage in bytes",
            memory_usage.clone(),
        );
        registry.register(
            "disk_usage_bytes",
            "Disk usage in bytes",
            disk_usage.clone(),
        );
        registry.register(
            "queue_depth",
            "Execution queue depth",
            queue_depth.clone(),
        );

        Self {
            registry,
            executions_total,
            executions_active,
            execution_duration,
            cpu_usage,
            memory_usage,
            disk_usage,
            queue_depth,
        }
    }

    fn record_execution(&self, duration: Duration, success: bool) {
        self.executions_total.inc();
        self.execution_duration.observe(duration.as_secs_f64());
    }

    fn set_active(&self, count: i64) {
        self.executions_active.set(count);
    }

    fn set_queue_depth(&self, depth: i64) {
        self.queue_depth.set(depth);
    }

    async fn collect_system_metrics(&self) {
        let mut sys = System::new_all();
        sys.refresh_all();

        // CPU usage
        let cpu_usage = sys.global_cpu_info().cpu_usage() as i64;
        self.cpu_usage.set(cpu_usage);

        // Memory usage
        let used_memory = sys.used_memory() as i64;
        self.memory_usage.set(used_memory);

        // Disk usage (for /workspace)
        if let Ok(output) = std::process::Command::new("df")
            .args(["-B1", "/workspace"])
            .output()
        {
            if let Ok(output_str) = String::from_utf8(output.stdout) {
                for line in output_str.lines().skip(1) {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 3 {
                        if let Ok(used) = parts[2].parse::<i64>() {
                            self.disk_usage.set(used);
                        }
                    }
                }
            }
        }
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .json()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let args = Args::parse();

    info!("Starting executor-daemon worker_id={} metrics_port={}", args.worker_id, args.metrics_port);

    let metrics = Arc::new(Metrics::new(args.worker_id));

    // Start metrics collection task
    let metrics_clone = metrics.clone();
    tokio::spawn(async move {
        let mut interval = interval(Duration::from_secs(10));
        loop {
            interval.tick().await;
            metrics_clone.collect_system_metrics().await;
        }
    });

    // Start HTTP server for metrics
    let metrics_clone = metrics.clone();
    let metrics_addr = format!("0.0.0.0:{}", args.metrics_port);
    let listener = tokio::net::TcpListener::bind(&metrics_addr).await?;
    info!("Metrics server listening on {}", metrics_addr);

    loop {
        tokio::select! {
            result = listener.accept() => {
                match result {
                    Ok((stream, _)) => {
                        let metrics = metrics_clone.clone();
                        tokio::spawn(async move {
                            if let Err(e) = handle_metrics_request(stream, metrics).await {
                                error!("Metrics request error: {}", e);
                            }
                        });
                    }
                    Err(e) => {
                        error!("Accept error: {}", e);
                    }
                }
            }
            _ = signal::ctrl_c() => {
                info!("Shutdown signal received");
                break;
            }
        }
    }

    Ok(())
}

async fn handle_metrics_request(
    stream: tokio::net::TcpStream,
    metrics: Arc<Metrics>,
) -> anyhow::Result<()> {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    let mut stream = stream;
    let mut buf = [0; 1024];
    let n = stream.read(&mut buf).await?;
    let request = String::from_utf8_lossy(&buf[..n]);

    if request.starts_with("GET /metrics") {
        let mut buffer = String::new();
        encode(&mut buffer, &metrics.registry).unwrap();

        let response = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: text/plain; version=0.0.4; charset=utf-8\r\nContent-Length: {}\r\n\r\n{}",
            buffer.len(),
            buffer
        );
        stream.write_all(response.as_bytes()).await?;
    } else if request.starts_with("GET /health") {
        let response = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 12\r\n\r\n{\"status\":\"ok\"}";
        stream.write_all(response.as_bytes()).await?;
    } else {
        let response = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n";
        stream.write_all(response.as_bytes()).await?;
    }

    stream.flush().await?;
    Ok(())
}