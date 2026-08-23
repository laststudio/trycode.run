use lettre::{
    transport::smtp::authentication::Credentials, AsyncSmtpTransport, AsyncTransport, Message,
    Tokio1Executor,
};
use std::sync::Arc;
use tracing::{info, warn};

use trycode_core::config::SmtpConfig;

#[derive(Clone)]
pub struct EmailService {
    mailer: Option<Arc<AsyncSmtpTransport<Tokio1Executor>>>,
    from: String,
}

impl EmailService {
    pub fn new(config: SmtpConfig) -> anyhow::Result<Self> {
        if config.host.is_empty() {
            // SMTP 未配置时返回禁用状态的服务（发送时记录警告）
            return Ok(Self { mailer: None, from: config.from });
        }

        let creds = Credentials::new(config.username.clone(), config.password.clone());

        let builder = if config.port == 465 {
            AsyncSmtpTransport::<Tokio1Executor>::relay(&config.host)?
        } else {
            AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&config.host)?
        };

        let mailer = builder.port(config.port).credentials(creds).build();

        Ok(Self {
            mailer: Some(Arc::new(mailer)),
            from: config.from,
        })
    }

    fn make_email(&self, to: &str, subject: &str, html: String) -> anyhow::Result<Message> {
        Ok(Message::builder()
            .from(self.from.parse()?)
            .to(to.parse()?)
            .subject(subject)
            .header(lettre::message::header::ContentType::TEXT_HTML)
            .body(html)?)
    }

    async fn send(&self, email: Message) -> anyhow::Result<()> {
        match &self.mailer {
            Some(mailer) => {
                mailer.send(email).await?;
                Ok(())
            }
            None => {
                warn!("SMTP not configured; skipping email send");
                Ok(())
            }
        }
    }

    pub async fn send_verification_code(
        &self,
        to: &str,
        code: &str,
        purpose: &str,
    ) -> anyhow::Result<()> {
        let html = format!(
            "<h2>TryCode 验证码</h2><p>您正在进行 <b>{purpose}</b> 操作，验证码为：</p>\
             <p style=\"font-size:32px;font-weight:bold;letter-spacing:8px;\">{code}</p>\
             <p>验证码 10 分钟内有效。如非本人操作请忽略此邮件。</p>"
        );
        let email = self.make_email(to, "TryCode - 验证码", html)?;
        self.send(email).await?;
        info!("Verification email sent to {}", to);
        Ok(())
    }

    pub async fn send_password_reset(&self, to: &str, reset_link: &str) -> anyhow::Result<()> {
        let html = format!(
            "<h2>TryCode 密码重置</h2><p>您请求了密码重置，请点击以下链接：</p>\
             <p><a href=\"{reset_link}\">{reset_link}</a></p>\
             <p>链接 1 小时内有效。如非本人操作请忽略此邮件。</p>"
        );
        let email = self.make_email(to, "TryCode - 密码重置", html)?;
        self.send(email).await?;
        info!("Password reset email sent to {}", to);
        Ok(())
    }

    pub async fn send_welcome(&self, to: &str, name: &str) -> anyhow::Result<()> {
        let html = format!(
            "<h2>欢迎加入 TryCode，{name}！</h2>\
             <p>您的账号已激活，现在可以开始编写和运行代码了。</p>\
             <p><a href=\"https://trycode.run\">访问 TryCode</a></p>"
        );
        let email = self.make_email(to, "TryCode - 欢迎加入", html)?;
        self.send(email).await?;
        info!("Welcome email sent to {}", to);
        Ok(())
    }
}
