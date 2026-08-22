use axum::{
    body::Body,
    extract::Request,
    http::{header, HeaderMap, HeaderValue, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use redis::AsyncCommands;
use std::sync::Arc;
use std::time::Duration;
use tracing::{debug, warn};

/// SSR 缓存中间件配置
#[derive(Debug, Clone)]
pub struct SSRCacheConfig {
    pub enabled: bool,
    pub default_ttl_secs: u64,
    pub max_cache_size: usize,
    pub excluded_paths: Vec<String>,
    pub cache_control_header: String,
}

impl Default for SSRCacheConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            default_ttl_secs: 300, // 5分钟
            max_cache_size: 100 * 1024 * 1024, // 100MB
            excluded_paths: vec![
                "/api/".to_string(),
                "/admin/".to_string(),
                "/editor".to_string(),
                "/settings".to_string(),
                "/login".to_string(),
                "/register".to_string(),
                "/api/".to_string(),
                "/ws".to_string(),
            ],
            cache_control_header: "public, max-age=300, stale-while-revalidate=60".to_string(),
        }
    }
}

/// SSR 缓存中间件
pub struct SSRCacheMiddleware {
    redis: deadpool_redis::Pool,
    config: SSRCacheConfig,
}

impl SSRCacheMiddleware {
    pub fn new(redis: deadpool_redis::Pool, config: SSRCacheConfig) -> Self {
        Self { redis, config }
    }

    /// 判断是否应该缓存
    fn should_cache(&self, path: &str, method: &str, headers: &HeaderMap) -> bool {
        if !self.config.enabled {
            return false;
        }

        // 只缓存 GET 请求
        if method != "GET" {
            return false;
        }

        // 检查排除路径
        for excluded in &self.config.excluded_paths {
            if path.starts_with(excluded) {
                return false;
            }
        }

        // 检查 Authorization 头（认证页面不缓存）
        if headers.get("authorization").is_some() {
            return false;
        }

        // 检查 Cookie 中的认证信息
        if let Some(cookie) = headers.get("cookie") {
            if cookie.to_str().unwrap_or("").contains("access_token") {
                return false;
            }
        }

        true
    }

    /// 生成缓存键
    fn cache_key(&self, path: &str, query: &str) -> String {
        if query.is_empty() {
            format!("ssr:page:{}", path)
        } else {
            format!("ssr:page:{}?{}", path, query)
        }
    }

    /// 处理请求
    pub async fn handle(
        &self,
        request: Request,
        next: Next,
    ) -> Result<Response, (StatusCode, String)> {
        let path = request.uri().path();
        let query = request.uri().query().unwrap_or("");
        let method = request.method().as_str();
        let headers = request.headers().clone();

        // 检查是否应该缓存
        if !self.should_cache(path, method, &headers) {
            return Ok(next.run(request).await);
        }

        let cache_key = self.cache_key(path, query);

        // 尝试从缓存获取
        let mut redis_conn = self.redis.get().await.map_err(|e| {
            warn!("Redis connection failed: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Redis connection failed".to_string())
        })?;

        if let Ok(cached) = redis_conn.get::<_, String>(&cache_key).await {
            if !cached.is_empty() {
                debug!("SSR cache hit: {}", cache_key);
                let mut response = Response::builder()
                    .status(StatusCode::OK)
                    .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
                    .header(header::CACHE_CONTROL, &self.config.cache_control_header)
                    .header("X-SSR-Cache", "HIT")
                    .body(Body::from(cached))
                    .map_err(|e| {
                        (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to build response: {}", e))
                    })?;
                return Ok(response);
            }
        }

        debug!("SSR cache miss: {}", cache_key);

        // 执行请求
        let mut response = next.run(request).await;

        // 检查响应是否可缓存
        if response.status().is_success() {
            let content_type = response.headers().get("content-type")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("");

            // 只缓存 HTML 响应
            if content_type.contains("text/html") {
                // 读取响应体
                let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX).await
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

                let body_str = String::from_utf8_lossy(&body_bytes).to_string();

                // 存入缓存
                let mut redis_conn = self.redis.get().await.ok();
                if let Some(mut conn) = redis_conn {
                    let ttl = self.config.default_ttl_secs;
                    let _ = conn.set_ex(&cache_key, &body_str.to_string(), ttl as usize).await;
                    debug!("Cached SSR page: {} (TTL: {}s)", cache_key, ttl);
                }

                // 重建响应
                let mut response = Response::builder()
                    .status(StatusCode::OK)
                    .header("content-type", "text/html; charset=utf-8")
                    .header("cache-control", &self.config.cache_control_header)
                    .header("x-ssr-cache", "MISS")
                    .body(Body::from(body_str))
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

                return Ok(response);
            }
        }

        // 添加缓存状态头
        response.headers_mut().insert(
            "X-SSR-Cache",
            HeaderValue::from_static("BYPASS"),
        );

        Ok(response)
    }
}

/// 创建 SSR 缓存中间件
pub fn create_ssr_cache_middleware(
    redis: deadpool_redis::Pool,
    config: SSRCacheConfig,
) -> axum::middleware::Middleware<axum::Router, fn(Request, Next) -> Result<Response, (StatusCode, String)>> {
    let middleware = SSRCacheMiddleware::new(redis, config);
    
    axum::middleware::from_fn(move |request, next| {
        let middleware = middleware.clone();
        async move {
            middleware.handle(request, next).await
        }
    })
}