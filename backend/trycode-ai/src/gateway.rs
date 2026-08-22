use chrono::Utc;
use reqwest::Client;
use secrecy::ExposeSecret;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::mpsc;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

use crate::models::{
    AiMessage, AiRequest, AiResponse, AiRole, AiStreamChunk, AiUsage, AiUsageLog,
    ExplainCodeRequest, ExplainCodeResponse, GenerateTestsRequest, GenerateTestsResponse,
    ReviewCodeRequest, ReviewCodeResponse, CodeIssue, IssueSeverity,
};
use trycode_core::{CoreError, Result};

#[derive(Debug, Clone)]
pub struct AiGateway {
    client: Client,
    config: AiConfig,
}

#[derive(Debug, Clone)]
pub struct AiConfig {
    pub base_url: String,
    pub api_key: String,
    pub default_model: String,
    pub max_tokens: u32,
    pub temperature: f32,
    pub timeout_secs: u64,
}

impl AiGateway {
    pub fn new(config: AiConfig) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_secs))
            .build()
            .expect("Failed to create HTTP client");

        Self { client, config }
    }

    pub async fn chat(&self, request: AiRequest) -> Result<AiResponse> {
        let start = Instant::now();
        
        let model = request.model.unwrap_or_else(|| self.config.default_model.clone());
        let temperature = request.temperature.unwrap_or(self.config.temperature);
        let max_tokens = request.max_tokens.unwrap_or(self.config.max_tokens);

        let messages: Vec<OpenAiMessage> = request.context.unwrap_or_default()
            .into_iter()
            .map(|m| OpenAiMessage {
                role: match m.role {
                    AiRole::System => "system",
                    AiRole::User => "user",
                    AiRole::Assistant => "assistant",
                }.to_string(),
                content: m.content,
            })
            .collect();

        let payload = OpenAiRequest {
            model,
            messages,
            temperature: Some(temperature),
            max_tokens: Some(max_tokens),
            stream: Some(false),
        };

        let response = self.client
            .post(&format!("{}/chat/completions", self.config.base_url))
            .header("Authorization", format!("Bearer {}", self.config.api_key))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
            .map_err(|e| CoreError::ExternalService(format!("AI request failed: {}", e)))?;

        let latency_ms = start.elapsed().as_millis() as u32;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            error!("AI API error: {} - {}", response.status(), error_text);
            
            // Log failed usage
            let log = AiUsageLog {
                id: Uuid::new_v4(),
                user_id: Uuid::nil(), // Will be set by caller
                request_type: crate::models::AiRequestType::Chat,
                model: payload.model.clone(),
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
                latency_ms,
                success: false,
                error_message: Some(error_text.clone()),
                created_at: Utc::now(),
            };
            
            return Err(CoreError::ExternalService(format!("AI API error: {}", error_text)));
        }

        let ai_response: OpenAiResponse = response.json().await
            .map_err(|e| CoreError::ExternalService(format!("Failed to parse AI response: {}", e)))?;

        let choice = ai_response.choices.first()
            .ok_or(CoreError::ExternalService("No response from AI".to_string()))?;

        let usage = ai_response.usage.map(|u| AiUsage {
            prompt_tokens: u.prompt_tokens,
            completion_tokens: u.completion_tokens,
            total_tokens: u.total_tokens,
        });

        // Log successful usage
        let log = AiUsageLog {
            id: Uuid::new_v4(),
            user_id: Uuid::nil(), // Will be set by caller
            request_type: crate::models::AiRequestType::Chat,
            model: payload.model.clone(),
            prompt_tokens: usage.as_ref().map(|u| u.prompt_tokens).unwrap_or(0),
            completion_tokens: usage.as_ref().map(|u| u.completion_tokens).unwrap_or(0),
            total_tokens: usage.as_ref().map(|u| u.total_tokens).unwrap_or(0),
            latency_ms,
            success: true,
            error_message: None,
            created_at: Utc::now(),
        };

        Ok(AiResponse {
            content: choice.message.content.clone(),
            model: ai_response.model,
            usage,
            finish_reason: choice.finish_reason.clone(),
        })
    }

    pub async fn stream_chat(&self, request: AiRequest, sender: mpsc::UnboundedSender<AiStreamChunk>) -> Result<()> {
        let model = request.model.unwrap_or_else(|| self.config.default_model.clone());
        let temperature = request.temperature.unwrap_or(self.config.temperature);
        let max_tokens = request.max_tokens.unwrap_or(self.config.max_tokens);

        let messages: Vec<OpenAiMessage> = request.context.unwrap_or_default()
            .into_iter()
            .map(|m| OpenAiMessage {
                role: match m.role {
                    AiRole::System => "system",
                    AiRole::User => "user",
                    AiRole::Assistant => "assistant",
                }.to_string(),
                content: m.content,
            })
            .collect();

        let payload = OpenAiRequest {
            model,
            messages,
            temperature: Some(temperature),
            max_tokens: Some(max_tokens),
            stream: Some(true),
        };

        let response = self.client
            .post(&format!("{}/chat/completions", self.config.base_url))
            .header("Authorization", format!("Bearer {}", self.config.api_key))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
            .map_err(|e| CoreError::ExternalService(format!("AI stream request failed: {}", e)))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(CoreError::ExternalService(format!("AI API error: {}", error_text)));
        }

        let mut stream = response.bytes_stream();
        let mut buffer = String::new();

        while let Some(chunk) = futures::StreamExt::next(&mut stream).await {
            match chunk {
                Ok(bytes) => {
                    buffer.push_str(&String::from_utf8_lossy(&bytes));
                    
                    // Parse SSE lines
                    while let Some(line_end) = buffer.find('\n') {
                        let line = buffer[..line_end].trim().to_string();
                        buffer = buffer[line_end + 1..].to_string();

                        if line.starts_with("data: ") {
                            let data = &line[6..];
                            if data == "[DONE]" {
                                let _ = sender.send(AiStreamChunk {
                                    content: String::new(),
                                    done: true,
                                    model: payload.model.clone(),
                                });
                                return Ok(());
                            }

                            if let Ok(chunk) = serde_json::from_str::<OpenAiStreamChunk>(data) {
                                if let Some(delta) = chunk.choices.first().and_then(|c| c.delta.content.clone()) {
                                    let _ = sender.send(AiStreamChunk {
                                        content: delta,
                                        done: false,
                                        model: chunk.model.clone(),
                                    });
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    error!("Stream error: {}", e);
                    break;
                }
            }
        }

        Ok(())
    }

    pub async fn explain_code(&self, request: ExplainCodeRequest) -> Result<ExplainCodeResponse> {
        let detail = request.detail_level.unwrap_or(crate::models::DetailLevel::Standard);
        
        let prompt = match detail {
            crate::models::DetailLevel::Brief => format!(
                "Explain this {} code briefly in 2-3 sentences:\n\n```{}\n{}\n```",
                request.language, request.language, request.code
            ),
            crate::models::DetailLevel::Standard => format!(
                "Explain this {} code in detail. Cover the main logic, key functions, and any notable patterns:\n\n```{}\n{}\n```",
                request.language, request.language, request.code
            ),
            crate::models::DetailLevel::Detailed => format!(
                "Provide a comprehensive explanation of this {} code. Include:\n1. Overall purpose\n2. Step-by-step logic flow\n3. Key functions/classes and their roles\n4. Data structures used\n5. Any algorithms or patterns\n6. Potential edge cases\n7. Time/space complexity if applicable\n\n```{}\n{}\n```",
                request.language, request.language, request.code
            ),
        };

        let ai_request = AiRequest {
            prompt,
            context: Some(vec![AiMessage {
                role: AiRole::System,
                content: "You are an expert programmer and code explainer. Provide clear, accurate explanations tailored to the requested detail level.".to_string(),
            }]),
            model: Some(self.config.default_model.clone()),
            temperature: Some(0.3),
            max_tokens: Some(2048),
            stream: Some(false),
        };

        let response = self.chat(ai_request).await?;

        // Parse key concepts from response (simplified)
        let key_concepts = extract_key_concepts(&response.content);

        Ok(ExplainCodeResponse {
            explanation: response.content,
            key_concepts,
            complexity: None,
        })
    }

    pub async fn review_code(&self, request: ReviewCodeRequest) -> Result<ReviewCodeResponse> {
        let focus = request.focus_areas.unwrap_or_else(|| vec![
            crate::models::ReviewFocus::Security,
            crate::models::ReviewFocus::Performance,
            crate::models::ReviewFocus::Readability,
            crate::models::ReviewFocus::BestPractices,
            crate::models::ReviewFocus::Bugs,
        ]);

        let focus_str = focus.iter()
            .map(|f| format!("{:?}", f))
            .collect::<Vec<_>>()
            .join(", ");

        let prompt = format!(
            "Review this {} code focusing on: {}. Provide:\n1. A brief summary\n2. List of issues with severity (Critical/High/Medium/Low/Info)\n3. Specific suggestions for improvement\n4. Overall score (0-100)\n\n```{}\n{}\n```",
            request.language, focus_str, request.language, request.code
        );

        let ai_request = AiRequest {
            prompt,
            context: Some(vec![AiMessage {
                role: AiRole::System,
                content: "You are an expert code reviewer. Provide thorough, actionable code reviews with specific line references when possible.".to_string(),
            }]),
            model: Some(self.config.default_model.clone()),
            temperature: Some(0.2),
            max_tokens: Some(3072),
            stream: Some(false),
        };

        let response = self.chat(ai_request).await?;

        // Parse response into structured format (simplified)
        let (summary, issues, suggestions, score) = parse_review_response(&response.content);

        Ok(ReviewCodeResponse {
            summary,
            issues,
            suggestions,
            score,
        })
    }

    pub async fn generate_tests(&self, request: GenerateTestsRequest) -> Result<GenerateTestsResponse> {
        let framework = request.framework.unwrap_or_else(|| default_test_framework(&request.language));

        let prompt = format!(
            "Generate comprehensive tests for this {} code using {} framework. Include:\n1. Unit tests for all functions\n2. Edge case tests\n3. Integration test examples if applicable\n4. Test fixtures/mocks as needed\n\n```{}\n{}\n```",
            request.language, framework, request.language, request.code
        );

        let ai_request = AiRequest {
            prompt,
            context: Some(vec![AiMessage {
                role: AiRole::System,
                content: format!("You are an expert {} developer. Write clean, maintainable tests following best practices for {}.", request.language, framework).to_string(),
            }]),
            model: Some(self.config.default_model.clone()),
            temperature: Some(0.3),
            max_tokens: Some(4096),
            stream: Some(false),
        };

        let response = self.chat(ai_request).await?;

        Ok(GenerateTestsResponse {
            tests: response.content,
            framework,
            coverage_estimate: None,
        })
    }
}

#[derive(Serialize, Deserialize)]
struct OpenAiMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct OpenAiRequest {
    model: String,
    messages: Vec<OpenAiMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stream: Option<bool>,
}

#[derive(Deserialize)]
struct OpenAiResponse {
    choices: Vec<OpenAiChoice>,
    usage: Option<OpenAiUsage>,
    model: String,
}

#[derive(Deserialize)]
struct OpenAiChoice {
    message: OpenAiMessage,
    finish_reason: Option<String>,
    index: u32,
}

#[derive(Deserialize)]
struct OpenAiUsage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

#[derive(Deserialize)]
struct OpenAiStreamChunk {
    choices: Vec<OpenAiStreamChoice>,
    model: String,
}

#[derive(Deserialize)]
struct OpenAiStreamChoice {
    delta: OpenAiDelta,
    finish_reason: Option<String>,
    index: u32,
}

#[derive(Deserialize)]
struct OpenAiDelta {
    content: Option<String>,
    role: Option<String>,
}

fn extract_key_concepts(content: &str) -> Vec<String> {
    // Simplified extraction - in reality would use NLP
    content.split_whitespace()
        .filter(|w| w.len() > 5)
        .take(10)
        .map(|s| s.trim_matches(|c: char| !c.is_alphanumeric()).to_string())
        .collect()
}

fn parse_review_response(content: &str) -> (String, Vec<CodeIssue>, Vec<String>, Option<u8>) {
    // Simplified parsing - in reality would use structured output
    let lines: Vec<&str> = content.lines().collect();
    
    let summary = lines.first().unwrap_or(&"").to_string();
    let mut issues = Vec::new();
    let mut suggestions = Vec::new();
    let mut score = None;

    for line in lines {
        if line.to_lowercase().contains("score") {
            if let Some(num_str) = line.split_whitespace().find(|w| w.chars().all(|c| c.is_ascii_digit())) {
                score = num_str.parse().ok();
            }
        }
        if line.to_lowercase().contains("issue") || line.to_lowercase().contains("problem") {
            issues.push(CodeIssue {
                severity: IssueSeverity::Medium,
                category: "General".to_string(),
                line: None,
                message: line.to_string(),
                suggestion: None,
            });
        }
        if line.to_lowercase().contains("suggest") || line.to_lowercase().contains("recommend") {
            suggestions.push(line.to_string());
        }
    }

    (summary, issues, suggestions, score)
}

fn default_test_framework(language: &str) -> String {
    match language {
        "python" => "pytest",
        "javascript" | "typescript" => "jest",
        "rust" => "cargo test",
        "go" => "testing",
        "java" => "junit",
        "cpp" => "googletest",
        "csharp" => "xunit",
        "php" => "phpunit",
        "ruby" => "rspec",
        "swift" => "xctest",
        "kotlin" => "junit",
        "scala" => "scalatest",
        _ => "default",
    }.to_string()
}