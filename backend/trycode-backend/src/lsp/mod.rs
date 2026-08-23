pub mod client;
pub mod multiplexer;
pub mod registry;
pub mod types;
pub mod ws_proxy;

use crate::lsp::registry::get_default_lsp_servers;
use crate::lsp::types::LSPMultiplexerConfig;
use anyhow::Result;
use std::sync::Arc;

/// 初始化 LSP 多路复用器
pub async fn init_lsp_multiplexer() -> Result<Arc<crate::lsp::multiplexer::LSPMultiplexer>> {
    let config = LSPMultiplexerConfig {
        websocket_port: 3001,
        max_connections: 1000,
        request_timeout_secs: 30,
        max_request_size: 10 * 1024 * 1024,
        enable_compression: true,
        heartbeat_interval_secs: 30,
        max_message_size: 10 * 1024 * 1024,
    };

    let multiplexer = Arc::new(crate::lsp::multiplexer::LSPMultiplexer::new(config));

    // 注册所有默认语言服务器
    for reg in get_default_lsp_servers() {
        if let Err(e) = multiplexer.register_server(reg).await {
            tracing::error!("Failed to register LSP server: {}", e);
        }
    }

    // 启动多路复用器
    multiplexer.start().await?;

    Ok(multiplexer)
}