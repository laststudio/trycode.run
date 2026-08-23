use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

pub use trycode_core::config::{Argon2Config, JwtConfig};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub email: String,
    pub role: String,
    pub iat: u64,
    pub exp: u64,
    pub iss: String,
    pub aud: String,
    pub token_type: String,
    pub jti: String,
}

impl Claims {
    pub fn new(user_id: Uuid, email: String, role: String, config: &JwtConfig, token_type: &str) -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let ttl = match token_type {
            "access" => config.access_token_ttl_secs,
            "refresh" => config.refresh_token_ttl_secs,
            _ => config.access_token_ttl_secs,
        };

        Self {
            sub: user_id.to_string(),
            email,
            role,
            iat: now,
            exp: now + ttl,
            iss: config.issuer.clone(),
            aud: config.audience.clone(),
            token_type: token_type.to_string(),
            jti: Uuid::new_v4().to_string(),
        }
    }
}

pub fn create_access_token(user_id: Uuid, email: String, role: String, config: &JwtConfig) -> anyhow::Result<String> {
    let claims = Claims::new(user_id, email, role, config, "access");
    let token = encode(&Header::default(), &claims, &EncodingKey::from_secret(config.secret.as_bytes()))?;
    Ok(token)
}

pub fn create_refresh_token(user_id: Uuid, email: String, role: String, config: &JwtConfig) -> anyhow::Result<String> {
    let claims = Claims::new(user_id, email, role, config, "refresh");
    let token = encode(&Header::default(), &claims, &EncodingKey::from_secret(config.secret.as_bytes()))?;
    Ok(token)
}

pub fn decode_token(token: &str, config: &JwtConfig) -> anyhow::Result<Claims> {
    use std::collections::HashSet;

    let mut validation = Validation::default();
    let mut iss = HashSet::new();
    iss.insert(config.issuer.clone());
    validation.iss = Some(iss);
    let mut aud = HashSet::new();
    aud.insert(config.audience.clone());
    validation.aud = Some(aud);

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(config.secret.as_bytes()),
        &validation,
    )?;

    Ok(token_data.claims)
}

pub fn hash_password(password: &str, config: &Argon2Config) -> anyhow::Result<String> {
    let argon2 = Argon2::new(
        argon2::Algorithm::Argon2id,
        argon2::Version::V0x13,
        argon2::Params::new(
            config.memory_kib,
            config.iterations,
            config.parallelism,
            None,
        )
        .map_err(|e| anyhow::anyhow!("argon2 params error: {}", e))?,
    );

    let salt = SaltString::generate(&mut OsRng);
    let password_hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| anyhow::anyhow!("hash error: {}", e))?;
    Ok(password_hash.to_string())
}

pub fn verify_password(password: &str, hash: &str) -> anyhow::Result<bool> {
    let parsed_hash =
        PasswordHash::new(hash).map_err(|e| anyhow::anyhow!("invalid hash: {}", e))?;
    let argon2 = Argon2::default();
    Ok(argon2
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}

pub fn generate_verification_code() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    (0..6).map(|_| rng.gen_range(0..10).to_string()).collect()
}

pub fn hash_verification_code(code: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(code.as_bytes());
    format!("{:x}", hasher.finalize())
}

pub fn verify_verification_code(code: &str, hash: &str) -> bool {
    hash_verification_code(code) == hash
}

pub fn default_jwt_config() -> JwtConfig {
    JwtConfig {
        secret: "change-me-in-production".to_string(),
        access_token_ttl_secs: 900,
        refresh_token_ttl_secs: 60 * 60 * 24 * 7,
        issuer: "trycode".to_string(),
        audience: "trycode".to_string(),
    }
}
