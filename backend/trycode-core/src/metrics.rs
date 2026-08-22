use metrics::{counter, gauge, histogram, Counter, Gauge, Histogram, Key, KeyName};
use metrics_exporter_prometheus::PrometheusBuilder;
use once_cell::sync::Lazy;
use std::sync::Arc;

static METRICS_INIT: std::sync::Once = std::sync::Once::new();

pub fn init_metrics() -> anyhow::Result<()> {
    METRICS_INIT.call_once(|| {
        let builder = PrometheusBuilder::new()
            .with_http_listener(([0, 0, 0, 0], 3000).into())
            .install()
            .expect("Failed to install Prometheus exporter");
    });
    Ok(())
}

pub fn init_metrics_with_addr(addr: std::net::SocketAddr) -> anyhow::Result<()> {
    METRICS_INIT.call_once(|| {
        let builder = PrometheusBuilder::new()
            .with_http_listener(addr)
            .install()
            .expect("Failed to install Prometheus exporter");
    });
    Ok(())
}

pub mod http_metrics {
    use metrics::{counter, histogram};
    use std::time::Instant;

    pub fn record_request(method: &str, path: &str, status: u16, duration: std::time::Duration) {
        let labels = [
            ("method", method.to_string()),
            ("path", path.to_string()),
            ("status", status.to_string()),
        ];
        counter!("http_requests_total", &labels).increment(1);
        histogram!("http_request_duration_seconds", &labels).record(duration.as_secs_f64());
    }
}

pub mod exec_metrics {
    use metrics::{counter, gauge, histogram};

    pub fn record_execution(language: &str, status: &str, duration: std::time::Duration, memory_peak: u64, cpu_time_ms: u64) {
        let labels = [
            ("language", language.to_string()),
            ("status", status.to_string()),
        ];
        counter!("executions_total", &labels).increment(1);
        histogram!("execution_duration_seconds", &labels).record(duration.as_secs_f64());
        gauge!("execution_memory_peak_bytes", &labels).set(memory_peak as f64);
        gauge!("execution_cpu_time_ms", &labels).set(cpu_time_ms as f64);
    }

    pub fn record_queue_depth(language: &str, depth: i64) {
        gauge!("execution_queue_depth", &[("language", language.to_string())]).set(depth as f64);
    }

    pub fn record_active_executions(count: i64) {
        gauge!("executions_active").set(count as f64);
    }

    pub fn record_wasm_fallback(language: &str, reason: &str) {
        counter!("wasm_fallback_total", &[
            ("language", language.to_string()),
            ("reason", reason.to_string()),
        ]).increment(1);
    }
}

pub mod collab_metrics {
    use metrics::{counter, gauge};

    pub fn record_collab_session_started(project_id: &str) {
        counter!("collab_sessions_started_total", &[("project_id", project_id.to_string())]).increment(1);
    }

    pub fn record_collab_session_ended(project_id: &str, duration: std::time::Duration) {
        counter!("collab_sessions_ended_total", &[("project_id", project_id.to_string())]).increment(1);
    }

    pub fn set_active_collab_docs(count: i64) {
        gauge!("collab_active_documents").set(count as f64);
    }

    pub fn set_connected_users(count: i64) {
        gauge!("collab_connected_users").set(count as f64);
    }
}

pub mod auth_metrics {
    use metrics::counter;

    pub fn record_login(provider: &str, success: bool) {
        let status = if success { "success" } else { "failure" };
        counter!("auth_login_total", &[
            ("provider", provider.to_string()),
            ("status", status.to_string()),
        ]).increment(1);
    }

    pub fn record_registration(success: bool) {
        let status = if success { "success" } else { "failure" };
        counter!("auth_registration_total", &[("status", status.to_string())]).increment(1);
    }

    pub fn record_captcha_verification(provider: &str, success: bool) {
        let status = if success { "success" } else { "failure" };
        counter!("captcha_verification_total", &[
            ("provider", provider.to_string()),
            ("status", status.to_string()),
        ]).increment(1);
    }
}