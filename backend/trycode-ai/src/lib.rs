pub mod gateway;
pub mod models;
pub mod routes;

use trycode_core::Result;

pub use gateway::AiGateway;
pub use models::*;
pub use routes::{AiState, ai_chat, ai_stream_chat, ai_explain_code, ai_review_code, ai_generate_tests};