pub mod captcha;
pub mod email;
pub mod jwt;
pub mod middleware;
pub mod models;
pub mod oauth;
pub mod routes;

use trycode_core::Result;

pub use captcha::{create_verifier, CaptchaVerifier, CaptchaError};
pub use email::EmailService;
pub use jwt::{create_access_token, create_refresh_token, decode_token, hash_password, verify_password, Claims, JwtConfig, Argon2Config};
pub use middleware::{AuthExtractor, OptionalAuthExtractor, require_admin, require_super_admin};
pub use models::*;
pub use oauth::{github_callback, github_login};
pub use routes::*;