pub mod captcha;
pub mod email;
pub mod jwt;
pub mod middleware;
pub mod models;
pub mod oauth;
pub mod routes;

pub use captcha::{create_verifier, CaptchaError, CaptchaVerifier};
pub use email::EmailService;
pub use jwt::{
    create_access_token, create_refresh_token, decode_token, generate_verification_code,
    hash_password, hash_verification_code, verify_password, verify_verification_code, Claims,
    Argon2Config, JwtConfig,
};
pub use middleware::{
    require_admin, require_super_admin, AuthDepot, AuthExtractor, OptionalAuthExtractor,
};
pub use models::*;
pub use oauth::{github_callback, github_login};
pub use routes::*;
