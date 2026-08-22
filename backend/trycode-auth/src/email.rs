use lettre::{
    transport::smtp::authentication::Credentials,
    transport::smtp::client::{Tls, TlsParameters},
    AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
};
use secrecy::ExposeSecret;
use std::sync::Arc;
use tera::{Context, Tera};
use tracing::{error, info};

use crate::config::SmtpConfig;

#[derive(Clone)]
pub struct EmailService {
    mailer: AsyncSmtpTransport<Tokio1Executor>,
    from: String,
    templates: Arc<Tera>,
}

impl EmailService {
    pub fn new(config: SmtpConfig) -> anyhow::Result<Self> {
        let creds = Credentials::new(config.username.clone(), config.password.expose_secret().to_string());

        let tls = match config.tls {
            crate::config::SmtpTlsMode::None => None,
            crate::config::SmtpTlsMode::Starttls => Some(TlsParameters::new(config.host.clone())?),
            crate::config::SmtpTlsMode::Tls => Some(TlsParameters::new(config.host.clone())?),
        };

        let mut builder = AsyncSmtpTransport::<Tokio1Executor>::relay(&config.host)?
            .port(config.port)
            .credentials(creds);

        if let Some(tls) = tls {
            builder = builder.tls(tls);
        }

        let mailer = builder.build();

        let mut templates = Tera::default();
        templates.add_raw_template("verification", include_str!("../../templates/verification.html"))?;
        templates.add_raw_template("password_reset", include_str!("../../templates/password_reset.html"))?;
        templates.add_raw_template("welcome", include_str!("../../templates/welcome.html"))?;

        Ok(Self {
            mailer,
            from: config.from,
            templates: Arc::new(templates),
        }
    }

    pub async fn send_verification_code(&self, to: &str, code: &str, purpose: &str) -> anyhow::Result<()> {
        let mut context = Context::new();
        context.insert("code", code);
        context.insert("purpose", purpose);
        context.insert("expires_minutes", "10");

        let html = self.templates.render("verification", &context)?;

        let email = Message::builder()
            .from(self.from.parse()?)
            .to(to.parse()?)
            .subject("TryCode - Your Verification Code")
            .html(html)
            .body(String::new())?;

        self.mailer.send(email).await?;
        info!("Verification email sent to {}", to);
        Ok(())
    }

    pub async fn send_password_reset(&self, to: &str, reset_link: &str) -> anyhow::Result<()> {
        let mut context = Context::new();
        context.insert("reset_link", reset_link);
        context.insert("expires_hours", "1");

        let html = self.templates.render("password_reset", &context)?;

        let email = Message::builder()
            .from(self.from.parse()?)
            .to(to.parse()?)
            .subject("TryCode - Password Reset Request")
            .html(html)
            .body(String::new())?;

        self.mailer.send(email).await?;
        info!("Password reset email sent to {}", to);
        Ok(())
    }

    pub async fn send_welcome(&self, to: &str, name: &str) -> anyhow::Result<()> {
        let mut context = Context::new();
        context.insert("name", name);

        let html = self.templates.render("welcome", &context)?;

        let email = Message::builder()
            .from(self.from.parse()?)
            .to(to.parse()?)
            .subject("Welcome to TryCode!")
            .html(html)
            .body(String::new())?;

        self.mailer.send(email).await?;
        info!("Welcome email sent to {}", to);
        Ok(())
    }

    pub async fn test_connection(&self) -> anyhow::Result<()> {
        // Just test by trying to connect
        let test_email = Message::builder()
            .from(self.from.parse()?)
            .to(self.from.parse()?)
            .subject("TryCode SMTP Test")
            .body("SMTP connection test successful".to_string())?;

        self.mailer.send(test_email).await?;
        Ok(())
    }
}

pub fn create_email_service(config: SmtpConfig) -> anyhow::Result<Arc<EmailService>> {
    Ok(Arc::new(EmailService::new(config)?))
}