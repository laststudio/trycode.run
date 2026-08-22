use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use secrecy::{ExposeSecret, SecretString};
use serde::{Deserialize, Serialize};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JwtConfig {
    pub secret: SecretString,
    pub access_token_ttl_secs: u64,
    pub refresh_token_ttl_secs: u64,
    pub issuer: String,
    pub audience: String,
}

#[derive(Debug, Serialize, Deserialize)]
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
    let token = encode(&Header::default(), &claims, &EncodingKey::from_secret(config.secret.expose_secret().as_bytes()))?;
    Ok(token)
}

pub fn create_refresh_token(user_id: Uuid, email: String, role: String, config: &JwtConfig) -> anyhow::Result<String> {
    let claims = Claims::new(user_id, email, role, config, "refresh");
    let token = encode(&Header::default(), &claims, &EncodingKey::from_secret(config.secret.expose_secret().as_bytes()))?;
    Ok(token)
}

pub fn decode_token(token: &str, config: &JwtConfig) -> anyhow::Result<Claims> {
    let mut validation = Validation::default();
    validation.iss = Some(config.issuer.clone());
    validation.aud = Some(vec![config.audience.clone()]);

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(config.secret.expose_secret().as_bytes()),
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
        )?,
    );

    let salt = SaltString::generate(&mut OsRng);
    let password_hash = argon2.hash_password(password.as_bytes(), &salt)?;
    Ok(password_hash.to_string())
}

pub fn verify_password(password: &str, hash: &str) -> anyhow::Result<bool> {
    let parsed_hash = PasswordHash::new(hash)?;
    let argon2 = Argon2::default();
    Ok(argon2.verify_password(password.as_bytes(), &parsed_hash).is_ok())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Argon2Config {
    pub memory_kib: u32,
    pub iterations: u32,
    pub parallelism: u32,
}

impl Default for Argon2Config {
    fn default() -> Self {
        Self {
            memory_kib: 65536,
            iterations: 3,
            parallelism: 4,
        }
    }
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