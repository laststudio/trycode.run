-- Migration: 002_seed_data.sql
-- Default configurations and seed data

-- ============================================================================
-- FEATURE FLAGS
-- ============================================================================

INSERT INTO feature_flags (key, enabled, description) VALUES
    ('registration_enabled', true, 'Allow new user registration'),
    ('email_verification_required', true, 'Require email verification after registration'),
    ('ai_enabled', true, 'Enable AI features (code explanation, review, etc.)'),
    ('collab_enabled', true, 'Enable real-time collaboration editing'),
    ('share_enabled', true, 'Enable project sharing via links'),
    ('maintenance_mode', false, 'Enable maintenance mode (read-only)'),
    ('exec_wasm_fallback', true, 'Enable WASM to backend fallback'),
    ('exec_queue_enabled', true, 'Enable execution queue'),
    ('captcha_enabled', true, 'Enable CAPTCHA verification'),
    ('oauth_enabled', true, 'Enable OAuth login')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- LANGUAGE CONFIGS (TIOBE Top 30)
-- ============================================================================

INSERT INTO language_configs (id, name, display_name, version, enabled, file_extensions, mime_types, compile_command, run_command, wasm_runtime, wasm_preload, resource_overrides) VALUES
    ('python', 'python', 'Python', '3.11', true, ARRAY['.py', '.pyw'], ARRAY['text/x-python'], '', 'python3 {file}', 'pyodide', true, '{"cpu_time_secs": 30, "memory_mb": 256}'::jsonb),
    ('javascript', 'javascript', 'JavaScript (Node.js)', '20', true, ARRAY['.js', '.mjs', '.cjs'], ARRAY['application/javascript'], '', 'node {file}', 'quickjs', true, '{"cpu_time_secs": 15, "memory_mb": 128}'::jsonb),
    ('typescript', 'typescript', 'TypeScript', '5.4', true, ARRAY['.ts', '.tsx'], ARRAY['application/typescript'], 'tsc {file}', 'node {file}', 'quickjs', true, '{"cpu_time_secs": 30, "memory_mb": 256}'::jsonb),
    ('rust', 'rust', 'Rust', '1.80', true, ARRAY['.rs'], ARRAY['text/rust'], 'rustc {file} -o {output}', '{output}', 'wasmer', false, '{"cpu_time_secs": 60, "memory_mb": 512}'::jsonb),
    ('go', 'go', 'Go', '1.22', true, ARRAY['.go'], ARRAY['text/x-go'], 'go build -o {output} {file}', '{output}', 'native', false, '{"cpu_time_secs": 45, "memory_mb": 384}'::jsonb),
    ('java', 'java', 'Java', '21', true, ARRAY['.java'], ARRAY['text/x-java'], 'javac {file}', 'java -cp {dir} {class}', 'native', false, '{"cpu_time_secs": 60, "memory_mb": 768}'::jsonb),
    ('cpp', 'cpp', 'C++', '13', true, ARRAY['.cpp', '.cc', '.cxx', '.hpp', '.h'], ARRAY['text/x-c++'], 'g++ -std=c++17 -O2 {file} -o {output}', '{output}', 'native', false, '{"cpu_time_secs": 60, "memory_mb": 512}'::jsonb),
    ('c', 'c', 'C', '13', true, ARRAY['.c', '.h'], ARRAY['text/x-c'], 'gcc -std=c11 -O2 {file} -o {output}', '{output}', 'native', false, '{"cpu_time_secs": 60, "memory_mb": 512}'::jsonb),
    ('csharp', 'csharp', 'C#', '8.0', true, ARRAY['.cs'], ARRAY['text/x-csharp'], 'dotnet build {project}', 'dotnet run --project {project}', 'native', false, '{"cpu_time_secs": 60, "memory_mb": 512}'::jsonb),
    ('php', 'php', 'PHP', '8.3', true, ARRAY['.php', '.phtml'], ARRAY['text/x-php'], '', 'php {file}', 'native', false, '{"cpu_time_secs": 30, "memory_mb": 256}'::jsonb),
    ('ruby', 'ruby', 'Ruby', '3.3', true, ARRAY['.rb'], ARRAY['text/x-ruby'], '', 'ruby {file}', 'native', false, '{"cpu_time_secs": 30, "memory_mb": 256}'::jsonb),
    ('swift', 'swift', 'Swift', '5.10', true, ARRAY['.swift'], ARRAY['text/x-swift'], 'swiftc {file} -o {output}', '{output}', 'native', false, '{"cpu_time_secs": 60, "memory_mb": 512}'::jsonb),
    ('kotlin', 'kotlin', 'Kotlin', '1.9', true, ARRAY['.kt', '.kts'], ARRAY['text/x-kotlin'], 'kotlinc {file} -include-runtime -d {output}.jar', 'java -jar {output}.jar', 'native', false, '{"cpu_time_secs": 60, "memory_mb": 512}'::jsonb),
    ('scala', 'scala', 'Scala', '3.4', true, ARRAY['.scala', '.sc'], ARRAY['text/x-scala'], 'scalac {file}', 'scala {class}', 'native', false, '{"cpu_time_secs": 60, "memory_mb": 512}'::jsonb),
    ('r', 'r', 'R', '4.4', true, ARRAY['.r', '.R'], ARRAY['text/x-r'], '', 'Rscript {file}', 'native', false, '{"cpu_time_secs": 60, "memory_mb": 512}'::jsonb),
    ('lua', 'lua', 'Lua', '5.4', true, ARRAY['.lua'], ARRAY['text/x-lua'], '', 'lua {file}', 'native', false, '{"cpu_time_secs": 15, "memory_mb": 64}'::jsonb),
    ('perl', 'perl', 'Perl', '5.38', true, ARRAY['.pl', '.pm'], ARRAY['text/x-perl'], '', 'perl {file}', 'native', false, '{"cpu_time_secs": 30, "memory_mb": 128}'::jsonb),
    ('dart', 'dart', 'Dart', '3.4', true, ARRAY['.dart'], ARRAY['application/dart'], 'dart compile exe {file} -o {output}', '{output}', 'native', false, '{"cpu_time_secs": 45, "memory_mb": 256}'::jsonb),
    ('zig', 'zig', 'Zig', '0.13', true, ARRAY['.zig'], ARRAY['text/x-zig'], 'zig build-exe {file} -O ReleaseFast', '{output}', 'native', false, '{"cpu_time_secs": 45, "memory_mb": 256}'::jsonb),
    ('julia', 'julia', 'Julia', '1.10', true, ARRAY['.jl'], ARRAY['text/x-julia'], '', 'julia {file}', 'native', false, '{"cpu_time_secs": 60, "memory_mb": 512}'::jsonb),
    ('haskell', 'haskell', 'Haskell', '9.8', true, ARRAY['.hs', '.lhs'], ARRAY['text/x-haskell'], 'ghc {file} -o {output}', '{output}', 'native', false, '{"cpu_time_secs": 60, "memory_mb": 512}'::jsonb),
    ('riscv', 'riscv', 'RISC-V Assembly', '1.0', true, ARRAY['.s', '.S'], ARRAY['text/x-asm'], 'riscv64-linux-gnu-gcc {file} -o {output}', '{output}', 'native', false, '{"cpu_time_secs": 30, "memory_mb": 128}'::jsonb),
    ('assembly', 'assembly', 'x86_64 Assembly', '1.0', true, ARRAY['.asm', '.s'], ARRAY['text/x-asm'], 'nasm -f elf64 {file} && ld {file}.o -o {output}', '{output}', 'native', false, '{"cpu_time_secs": 30, "memory_mb": 128}'::jsonb),
    ('fortran', 'fortran', 'Fortran', '13', true, ARRAY['.f90', '.f95', '.f03', '.f08'], ARRAY['text/x-fortran'], 'gfortran {file} -o {output}', '{output}', 'native', false, '{"cpu_time_secs": 60, "memory_mb": 256}'::jsonb),
    ('objectivec', 'objectivec', 'Objective-C', '13', true, ARRAY['.m', '.mm'], ARRAY['text/x-objective-c'], 'clang -fobjc-arc {file} -o {output}', '{output}', 'native', false, '{"cpu_time_secs": 60, "memory_mb": 256}'::jsonb),
    ('vbnet', 'vbnet', 'VB.NET', '8.0', true, ARRAY['.vb'], ARRAY['text/x-vb'], 'dotnet build {project}', 'dotnet run --project {project}', 'native', false, '{"cpu_time_secs": 60, "memory_mb": 512}'::jsonb),
    ('fsharp', 'fsharp', 'F#', '8.0', true, ARRAY['.fs', '.fsx'], ARRAY['text/x-fsharp'], 'dotnet build {project}', 'dotnet run --project {project}', 'native', false, '{"cpu_time_secs": 60, "memory_mb": 512}'::jsonb),
    ('groovy', 'groovy', 'Groovy', '4.0', true, ARRAY['.groovy', '.gvy', '.gy', '.gsh'], ARRAY['text/x-groovy'], '', 'groovy {file}', 'native', false, '{"cpu_time_secs": 60, "memory_mb": 512}'::jsonb),
    ('html', 'html', 'HTML/CSS/JS', '5', true, ARRAY['.html', '.htm', '.css', '.js'], ARRAY['text/html', 'text/css', 'application/javascript'], '', 'browser', 'browser', true, '{"cpu_time_secs": 10, "memory_mb": 64}'::jsonb),
    ('sql', 'sql', 'SQL (SQLite)', '3.45', true, ARRAY['.sql'], ARRAY['text/x-sql'], '', 'sqlite3 :memory: < {file}', 'native', false, '{"cpu_time_secs": 10, "memory_mb": 64}'::jsonb),
    ('bash', 'bash', 'Bash', '5.2', true, ARRAY['.sh', '.bash'], ARRAY['application/x-shellscript'], '', 'bash {file}', 'native', false, '{"cpu_time_secs": 15, "memory_mb": 64}'::jsonb),
    ('powershell', 'powershell', 'PowerShell', '7.4', true, ARRAY['.ps1', '.psm1', '.psd1'], ARRAY['text/x-powershell'], '', 'pwsh {file}', 'native', false, '{"cpu_time_secs": 15, "memory_mb": 128}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- EXECUTION CONFIGS
-- ============================================================================

-- Global default execution config
INSERT INTO execution_configs (id, config_type, target_id, max_concurrent, cpu_time_limit_secs, wall_time_limit_secs, memory_limit_mb, disk_limit_mb, daily_execution_limit, daily_cpu_time_limit_secs, queue_timeout_secs, priority, retry_config, wasm_fallback_config) VALUES
    ('global', 'global', null, 4, 30, 60, 256, 100, 500, 3600, 60, 1,
     '{"max_attempts": 3, "backoff_base_ms": 1000, "backoff_max_ms": 5000, "retryable_errors": ["network_error", "container_unhealthy", "sandbox_init_failed"], "non_retryable_errors": ["compile_error", "runtime_error", "timeout", "oom", "disk_quota_exceeded"]}'::jsonb,
     '{"enabled": true, "timeout_ms": 5000, "preload_languages": ["python", "javascript", "typescript"], "fallback_triggers": ["timeout", "oom", "missing_runtime", "compile_error", "network_error"]}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Language-specific overrides
INSERT INTO execution_configs (id, config_type, target_id, cpu_time_limit_secs, memory_limit_mb) VALUES
    ('language:rust', 'language', 'rust', 60, 512),
    ('language:java', 'language', 'java', 60, 768),
    ('language:cpp', 'language', 'cpp', 60, 512),
    ('language:c', 'language', 'c', 60, 512),
    ('language:csharp', 'language', 'csharp', 60, 512),
    ('language:go', 'language', 'go', 45, 384),
    ('language:python', 'language', 'python', 30, 256),
    ('language:javascript', 'language', 'javascript', 15, 128),
    ('language:typescript', 'language', 'typescript', 30, 256)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SYSTEM CONFIGS
-- ============================================================================

INSERT INTO system_configs (key, value, description, category, is_secret) VALUES
    ('database.host', '"pgdocker"'::jsonb, 'PostgreSQL host', 'database', false),
    ('database.port', '5432'::jsonb, 'PostgreSQL port', 'database', false),
    ('database.name', '"trycode"'::jsonb, 'PostgreSQL database name', 'database', false),
    ('database.user', '"trycode"'::jsonb, 'PostgreSQL username', 'database', false),
    ('redis.host', '"redisdocker"'::jsonb, 'Redis host', 'redis', false),
    ('redis.port', '6379'::jsonb, 'Redis port', 'redis', false),
    ('redis.db', '0'::jsonb, 'Redis database number', 'redis', false),
    ('smtp.host', '""'::jsonb, 'SMTP server host', 'smtp', false),
    ('smtp.port', '587'::jsonb, 'SMTP server port', 'smtp', false),
    ('smtp.username', '""'::jsonb, 'SMTP username', 'smtp', false),
    ('smtp.from', '"TryCode <noreply@trycode.run>"'::jsonb, 'SMTP from address', 'smtp', false),
    ('smtp.tls', '"starttls"'::jsonb, 'SMTP TLS mode (none, starttls, tls)', 'smtp', false),
    ('captcha.provider', '"trycap"'::jsonb, 'CAPTCHA provider', 'captcha', false),
    ('captcha.site_key', '""'::jsonb, 'CAPTCHA site key', 'captcha', false),
    ('captcha.verify_url', '"http://trycap:8080/api/v1/verify"'::jsonb, 'CAPTCHA verify URL', 'captcha', false),
    ('captcha.enabled', 'true'::jsonb, 'Enable CAPTCHA', 'captcha', false),
    ('captcha.actions', '["register", "login", "execute"]'::jsonb, 'Actions requiring CAPTCHA', 'captcha', false),
    ('oauth.github.enabled', 'false'::jsonb, 'Enable GitHub OAuth', 'oauth', false),
    ('oauth.github.client_id', '""'::jsonb, 'GitHub OAuth client ID', 'oauth', false),
    ('oauth.github.redirect_url', '"https://trycode.run/api/auth/oauth/github/callback"'::jsonb, 'GitHub OAuth redirect URL', 'oauth', false),
    ('oauth.github.scopes', '["read:user", "user:email"]'::jsonb, 'GitHub OAuth scopes', 'oauth', false),
    ('oauth.github.allowed_domains', '[]'::jsonb, 'Allowed email domains', 'oauth', false),
    ('oauth.github.auto_create_user', 'true'::jsonb, 'Auto-create user on OAuth login', 'oauth', false),
    ('oauth.github.default_role', '"user"'::jsonb, 'Default role for OAuth users', 'oauth', false),
    ('ai.enabled', 'true'::jsonb, 'Enable AI features', 'ai', false),
    ('ai.base_url', '"https://api.openai.com/v1"'::jsonb, 'OpenAI compatible API base URL', 'ai', false),
    ('ai.default_model', '"gpt-4o-mini"'::jsonb, 'Default AI model', 'ai', false),
    ('ai.max_tokens', '4096'::jsonb, 'Max tokens for AI responses', 'ai', false),
    ('ai.temperature', '0.3'::jsonb, 'AI temperature', 'ai', false),
    ('ai.timeout_secs', '30'::jsonb, 'AI request timeout', 'ai', false),
    ('execution.global_max_concurrent', '4'::jsonb, 'Global max concurrent executions', 'execution', false),
    ('execution.per_user_max_concurrent', '2'::jsonb, 'Per-user max concurrent executions', 'execution', false),
    ('execution.queue_timeout_secs', '60'::jsonb, 'Queue timeout in seconds', 'execution', false),
    ('execution.default_cpu_time_secs', '30'::jsonb, 'Default CPU time limit', 'execution', false),
    ('execution.default_memory_mb', '256'::jsonb, 'Default memory limit', 'execution', false),
    ('execution.default_disk_mb', '100'::jsonb, 'Default disk limit', 'execution', false),
    ('execution.default_wall_time_secs', '60'::jsonb, 'Default wall time limit', 'execution', false),
    ('execution.container_cpu_quota', '100000'::jsonb, 'Container CPU quota (CFS)', 'execution', false),
    ('execution.container_memory_mb', '768'::jsonb, 'Container memory limit', 'execution', false),
    ('execution.container_pids_limit', '100'::jsonb, 'Container pids limit', 'execution', false),
    ('execution.wasm_timeout_ms', '5000'::jsonb, 'WASM fallback timeout', 'execution', false),
    ('execution.wasm_preload', '["python", "javascript", "typescript"]'::jsonb, 'Languages to preload WASM', 'execution', false)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- CAPTCHA CONFIG (trycap.dev)
-- ============================================================================

INSERT INTO captcha_configs (id, provider, config, enabled, actions) VALUES
    ('trycap', 'trycap', '{"site_key": "", "secret_key": "", "verify_url": "http://trycap:8080/api/v1/verify"}'::jsonb, true, ARRAY['register', 'login', 'execute'])
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- OAUTH CONFIG (GitHub)
-- ============================================================================

INSERT INTO oauth_configs (provider, config, enabled) VALUES
    ('github', '{"client_id": "", "client_secret": "", "redirect_url": "https://trycode.run/api/auth/oauth/github/callback", "scopes": ["read:user", "user:email"], "allowed_domains": [], "auto_create_user": true, "default_role": "user"}'::jsonb, false)
ON CONFLICT (provider) DO NOTHING;

-- ============================================================================
-- AI CONFIG
-- ============================================================================

INSERT INTO ai_configs (id, config, enabled) VALUES
    ('default', '{"base_url": "https://api.openai.com/v1", "api_key": "", "default_model": "gpt-4o-mini", "max_tokens": 4096, "temperature": 0.3, "timeout_secs": 30}'::jsonb, true)
ON CONFLICT (id) DO NOTHING;