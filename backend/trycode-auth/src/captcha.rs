use async_trait::async_trait;
use reqwest::Client;
use serde::Deserialize;
use std::collections::HashMap;

use trycode_core::config::{CaptchaAction, CaptchaConfig, CaptchaProvider};

#[derive(Debug, thiserror::Error)]
pub enum CaptchaError {
    #[error("CAPTCHA verification failed: {0}")]
    VerificationFailed(String),
    #[error("CAPTCHA provider not configured")]
    NotConfigured,
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("Configuration error: {0}")]
    Config(String),
}

#[async_trait]
pub trait CaptchaVerifier: Send + Sync {
    async fn verify(&self, token: &str, action: Option<CaptchaAction>, ip: Option<String>) -> Result<bool, CaptchaError>;
    fn provider_name(&self) -> &'static str;
}

pub struct TryCapVerifier {
    config: CaptchaConfig,
    client: Client,
}

impl TryCapVerifier {
    pub fn new(config: CaptchaConfig) -> Self {
        Self {
            config,
            client: Client::new(),
        }
    }
}

#[async_trait]
impl CaptchaVerifier for TryCapVerifier {
    async fn verify(&self, token: &str, action: Option<CaptchaAction>, ip: Option<String>) -> Result<bool, CaptchaError> {
        let mut body = HashMap::new();
        body.insert("token", token.to_string());
        if let Some(action) = action {
            body.insert("action", format!("{:?}", action).to_lowercase());
        }
        if let Some(ip) = ip {
            body.insert("ip", ip);
        }

        let response = self.client
            .post(&self.config.verify_url)
            .header("X-TryCap-Secret", self.config.secret_key.as_str())
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(CaptchaError::VerificationFailed(format!("HTTP {}", response.status())));
        }

        #[derive(Deserialize)]
        struct TryCapResponse {
            success: bool,
            #[allow(dead_code)]
            challenge_ts: Option<String>,
            #[allow(dead_code)]
            hostname: Option<String>,
            #[allow(dead_code)]
            error_codes: Option<Vec<String>>,
        }

        let result: TryCapResponse = response.json().await?;
        Ok(result.success)
    }

    fn provider_name(&self) -> &'static str {
        "trycap"
    }
}

pub struct TurnstileVerifier {
    config: CaptchaConfig,
    client: Client,
}

impl TurnstileVerifier {
    pub fn new(config: CaptchaConfig) -> Self {
        Self {
            config,
            client: Client::new(),
        }
    }
}

#[async_trait]
impl CaptchaVerifier for TurnstileVerifier {
    async fn verify(&self, token: &str, _action: Option<CaptchaAction>, ip: Option<String>) -> Result<bool, CaptchaError> {
        let mut body = HashMap::new();
        body.insert("secret", self.config.secret_key.clone());
        body.insert("response", token.to_string());
        if let Some(ip) = ip {
            body.insert("remoteip", ip);
        }

        let response = self.client
            .post("https://challenges.cloudflare.com/turnstile/v0/siteverify")
            .form(&body)
            .send()
            .await?;

        #[derive(Deserialize)]
        struct TurnstileResponse {
            success: bool,
            #[allow(dead_code)]
            error_codes: Option<Vec<String>>,
        }

        let result: TurnstileResponse = response.json().await?;
        Ok(result.success)
    }

    fn provider_name(&self) -> &'static str {
        "turnstile"
    }
}

pub struct HCaptchaVerifier {
    config: CaptchaConfig,
    client: Client,
}

impl HCaptchaVerifier {
    pub fn new(config: CaptchaConfig) -> Self {
        Self {
            config,
            client: Client::new(),
        }
    }
}

#[async_trait]
impl CaptchaVerifier for HCaptchaVerifier {
    async fn verify(&self, token: &str, _action: Option<CaptchaAction>, ip: Option<String>) -> Result<bool, CaptchaError> {
        let mut body = HashMap::new();
        body.insert("secret", self.config.secret_key.clone());
        body.insert("response", token.to_string());
        if let Some(ip) = ip {
            body.insert("remoteip", ip);
        }

        let response = self.client
            .post("https://hcaptcha.com/siteverify")
            .form(&body)
            .send()
            .await?;

        #[derive(Deserialize)]
        struct HCaptchaResponse {
            success: bool,
            #[allow(dead_code)]
            error_codes: Option<Vec<String>>,
        }

        let result: HCaptchaResponse = response.json().await?;
        Ok(result.success)
    }

    fn provider_name(&self) -> &'static str {
        "hcaptcha"
    }
}

pub struct ReCaptchaV3Verifier {
    config: CaptchaConfig,
    client: Client,
}

impl ReCaptchaV3Verifier {
    pub fn new(config: CaptchaConfig) -> Self {
        Self {
            config,
            client: Client::new(),
        }
    }
}

#[async_trait]
impl CaptchaVerifier for ReCaptchaV3Verifier {
    async fn verify(&self, token: &str, action: Option<CaptchaAction>, ip: Option<String>) -> Result<bool, CaptchaError> {
        let mut body = HashMap::new();
        body.insert("secret", self.config.secret_key.clone());
        body.insert("response", token.to_string());
        if let Some(ip) = ip {
            body.insert("remoteip", ip);
        }

        let response = self.client
            .post("https://www.google.com/recaptcha/api/siteverify")
            .form(&body)
            .send()
            .await?;

        #[derive(Deserialize)]
        struct ReCaptchaResponse {
            success: bool,
            score: Option<f32>,
            action: Option<String>,
            #[allow(dead_code)]
            error_codes: Option<Vec<String>>,
        }

        let result: ReCaptchaResponse = response.json().await?;
        // For v3, also check score
        let score_ok = result.score.map_or(true, |s| s >= 0.5);
        let action_ok = action.map_or(true, |a| {
            result.action.map_or(true, |ra| format!("{:?}", a).to_lowercase() == ra)
        });
        Ok(result.success && score_ok && action_ok)
    }

    fn provider_name(&self) -> &'static str {
        "recaptcha_v3"
    }
}

pub fn create_verifier(config: CaptchaConfig) -> Box<dyn CaptchaVerifier> {
    let provider = config.provider.clone();
    match provider {
        CaptchaProvider::Trycap => Box::new(TryCapVerifier::new(config)),
        CaptchaProvider::Turnstile => Box::new(TurnstileVerifier::new(config)),
        CaptchaProvider::HCaptcha => Box::new(HCaptchaVerifier::new(config)),
        CaptchaProvider::ReCaptchaV3 => Box::new(ReCaptchaV3Verifier::new(config)),
        CaptchaProvider::Custom { endpoint } => {
            // For custom, we'd need a generic HTTP verifier
            // For now, fall back to TryCap-like behavior
            let mut cfg = config;
            cfg.verify_url = endpoint.clone();
            Box::new(TryCapVerifier::new(cfg))
        }
    }
}