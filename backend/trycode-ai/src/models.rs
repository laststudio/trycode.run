use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiRequest {
    pub prompt: String,
    pub context: Option<Vec<AiMessage>>,
    pub model: Option<String>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub stream: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiMessage {
    pub role: AiRole,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AiRole {
    System,
    User,
    Assistant,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiResponse {
    pub content: String,
    pub model: String,
    pub usage: Option<AiUsage>,
    pub finish_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiStreamChunk {
    pub content: String,
    pub done: bool,
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExplainCodeRequest {
    pub code: String,
    pub language: String,
    pub detail_level: Option<DetailLevel>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewCodeRequest {
    pub code: String,
    pub language: String,
    pub focus_areas: Option<Vec<ReviewFocus>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateTestsRequest {
    pub code: String,
    pub language: String,
    pub framework: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DetailLevel {
    Brief,
    Standard,
    Detailed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ReviewFocus {
    Security,
    Performance,
    Readability,
    BestPractices,
    Bugs,
    Testing,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExplainCodeResponse {
    pub explanation: String,
    pub key_concepts: Vec<String>,
    pub complexity: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewCodeResponse {
    pub summary: String,
    pub issues: Vec<CodeIssue>,
    pub suggestions: Vec<String>,
    pub score: Option<u8>, // 0-100
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeIssue {
    pub severity: IssueSeverity,
    pub category: String,
    pub line: Option<u32>,
    pub message: String,
    pub suggestion: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum IssueSeverity {
    Critical,
    High,
    Medium,
    Low,
    Info,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateTestsResponse {
    pub tests: String,
    pub framework: String,
    pub coverage_estimate: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AiUsageLog {
    pub id: Uuid,
    pub user_id: Uuid,
    pub request_type: AiRequestType,
    pub model: String,
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
    pub latency_ms: u32,
    pub success: bool,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "ai_request_type", rename_all = "snake_case")]
pub enum AiRequestType {
    Chat,
    Explain,
    Review,
    GenerateTests,
    Complete,
}