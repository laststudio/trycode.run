//! 指标记录（轻量实现，后续可替换为 prometheus-client）

pub fn init_metrics() -> anyhow::Result<()> {
    Ok(())
}

pub mod http_metrics {
    pub fn record_request(_method: &str, _path: &str, _status: u16, _duration: std::time::Duration) {}
}

pub mod exec_metrics {
    pub fn record_execution(
        _language: &str,
        _status: &str,
        _duration: std::time::Duration,
        _memory_peak: u64,
        _cpu_time_ms: u64,
    ) {
    }
    pub fn record_queue_depth(_depth: i64) {}
    pub fn record_active_executions(_count: i64) {}
    pub fn record_wasm_fallback(_language: &str, _reason: &str) {}
}

pub mod collab_metrics {
    pub fn set_active_collab_docs(_count: i64) {}
    pub fn set_connected_users(_count: i64) {}
}

pub mod auth_metrics {
    pub fn record_login(_provider: &str, _success: bool) {}
    pub fn record_registration(_success: bool) {}
    pub fn record_captcha_verification(_provider: &str, _success: bool) {}
}
