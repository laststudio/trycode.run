# TryCode.run - Online Code Runner

A full-stack online code execution platform supporting 30+ programming languages with WASM-first execution, intelligent fallback, real-time collaboration, and comprehensive admin panel.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TryCode.run Architecture                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌─────────────────────┐     ┌─────────────────────┐  │
│  │   Frontend   │────▶│    Backend API      │────▶│   Executor Pool     │  │
│  │  (React+Vite)│     │    (Rust+Axum)      │     │   (2x gVisor)       │  │
│  └──────────────┘     └─────────────────────┘     └─────────────────────┘  │
│         │                      │                        │                   │
│         ▼                      ▼                        ▼                   │
│  ┌──────────────┐     ┌─────────────────────┐     ┌─────────────────────┐  │
│  │   Monaco     │     │  PostgreSQL + Redis │     │  Debian 12 + 30     │  │
│  │   Editor +   │     │  (1panel-network)   │     │  Languages + gVisor │  │
│  │   Yjs Collab │     │                     │     │                     │  │
│  └──────────────┘     └─────────────────────┘     └─────────────────────┘  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Observability Stack (VictoriaLogs + VictoriaMetrics)│   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## ✨ Features

### 🚀 Multi-Language Execution (30+ Languages)
- **Tier 1 (WASM-native)**: Python (Pyodide), JavaScript/TypeScript (QuickJS), HTML/CSS/JS (Browser), Rust (wasmer), Lua, SQL
- **Tier 2 (Native compiled)**: Go, Rust, C/C++, Java, C#, PHP, Ruby, Swift, Kotlin, Scala, R, Dart, Zig, Julia, Haskell, Fortran, Objective-C, VB.NET, F#, Groovy
- **Tier 3 (Shell)**: Bash, PowerShell, SQL

### ⚡ Smart WASM-First Execution
- **5-second timeout** for WASM execution in browser
- **Automatic fallback** to backend on timeout, OOM, missing runtime, compile errors
- **Preloading** of common language runtimes (Python, JS, TS)
- **Resource quotas** per user/language (CPU time, memory, disk, wall time)

### 🤝 Real-time Collaboration
- **Yjs CRDT** for conflict-free concurrent editing
- **WebSocket** awareness (cursors, selections, user presence)
- **Permission system**: Owner, Editor, Viewer roles
- **Persistence** to PostgreSQL with incremental sync

### 🔐 Authentication & Security
- **JWT** (15min access + 30d refresh, HttpOnly cookies)
- **Argon2id** password hashing (configurable parameters)
- **Email verification** with 6-digit codes
- **CAPTCHA** (trycap.dev self-hosted, Turnstile/hCaptcha/reCAPTCHA fallback)
- **GitHub OAuth** with domain restrictions
- **Rate limiting** (IP, user, API key tiers)
- **gVisor** (ptrace platform) for strong sandbox isolation

### 📊 Admin Panel
- **System monitoring**: Users, executions, success rates, language stats
- **User management**: Roles, status, locking, execution quotas
- **Execution logs**: Filtering, WASM fallback tracking
- **Dynamic config**: Hot-reload via PostgreSQL NOTIFY
- **System tests**: SMTP, CAPTCHA, OAuth, Database
- **Audit logs**: All admin actions tracked

### 📁 Project Management
- **Virtual filesystem** with folders, files, rename, move, delete
- **Sharing**: Time-limited, password-protected, permission-controlled links
- **Forking**: Full project copy with history
- **Templates**: Language-specific starter templates

### 🤖 AI Assistant (OpenAI-compatible)
- **Code explanation** (brief/standard/detailed)
- **Code review** (security, performance, readability, bugs)
- **Test generation** (pytest, jest, cargo test, etc.)
- **Chat** with code context
- **Configurable** endpoint, model, temperature

## 🐳 Deployment (3 Containers)

```yaml
# docker-compose.yml - 3 services only!
services:
  backend:        # Rust API + VictoriaMetrics + VictoriaLogs + Vector (s6-overlay)
  exec-worker-1:  # Debian 12 + 30 languages + gVisor
  exec-worker-2:  # Debian 12 + 30 languages + gVisor
```

**External dependencies** (on 1panel-network):
- PostgreSQL (`pgdocker:5432`)
- Redis (`redisdocker:6379`)

**Resource budget** (4 CPU cores):
| Container | CPU | Memory |
|-----------|-----|--------|
| backend | 1.5 cores | 1.5 GB |
| exec-worker-1 | 1.0 core | 768 MB |
| exec-worker-2 | 1.0 core | 768 MB |

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- PostgreSQL & Redis (on `1panel-network`)
- Domain with SSL (OpenResty terminates TLS)

### 1. Initialize Secrets
```bash
# On server (run once)
sudo systemctl start trycode-init-secrets
# Or manually:
mkdir -p /opt/trycode/secrets
openssl rand -hex 32 > /opt/trycode/secrets/jwt_secret.txt
openssl rand -hex 24 > /opt/trycode/secrets/pg_password.txt
# ... etc (see scripts/init-secrets.sh)
```

### 2. Configure
```bash
cp /opt/trycode/config/backend.toml.example /opt/trycode/config/backend.toml
# Edit with your SMTP, CAPTCHA, OAuth, AI settings
```

### 3. Deploy
```bash
cd /opt/trycode
TAG=v1.0.0 docker compose pull
TAG=v1.0.0 docker compose up -d --remove-orphans
```

### 4. Initialize Super Admin
```bash
# Visit https://trycode.run/admin
# First visit creates super admin account
```

## 📁 Project Structure

```
trycode.run/
├── docker-compose.yml              # 3-container orchestration
├── config/
│   ├── backend.toml                # Backend config (hot-reload)
│   ├── vector.toml                 # Vector log collector config
│   ├── vm-scrape.yml               # VictoriaMetrics scrape config
│   └── trycode.run.conf            # OpenResty template
├── backend/
│   ├── Cargo.toml                  # Rust workspace
│   ├── Dockerfile.all-in-one       # s6-overlay multi-process image
│   ├── migrations/                 # SQLx migrations (PostgreSQL)
│   ├── trycode-backend/            # Main binary
│   ├── trycode-core/               # Shared config, DB, metrics
│   ├── trycode-auth/               # JWT, Argon2id, CAPTCHA, OAuth
│   ├── trycode-execution/          # Queue, scheduler, gVisor, limits
│   ├── trycode-collab/             # Yjs WebSocket broker
│   ├── trycode-projects/           # Projects, files, sharing
│   ├── trycode-admin/              # Admin panel, config, tests
│   └── trycode-ai/                 # AI gateway (OpenAI-compatible)
├── executor/
│   ├── Dockerfile                  # Debian 12 + 30 langs + gVisor
│   ├── entrypoint.sh               # Metrics exporter entrypoint
│   └── Cargo.toml                  # Executor daemon (metrics)
├── frontend/
│   ├── package.json                # React + Vite + TS
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── src/
│       ├── components/             # Editor, Terminal, FileTree, Collab, AI
│       ├── pages/                  # Editor, Project, Auth, Admin, Share
│       ├── hooks/                  # useAuth, useTheme, useCollab
│       ├── stores/                 # Zustand (editor, execution, UI)
│       └── utils/                  # API client, language config
├── scripts/
│   ├── init-secrets.sh             # Secret generator
│   └── trycode-init-secrets.service # systemd oneshot
├── .github/workflows/              # CI/CD (build, test, deploy)
└── README.md
```

## 🔧 Configuration

### Backend (`config/backend.toml`)
```toml
[server]
host = "0.0.0.0"
port = 3000

[database]
url = "postgres://trycode:pass@pgdocker:5432/trycode"

[redis]
host = "redisdocker"
port = 6379

[smtp]
host = "smtp.example.com"
port = 587
username = "noreply@trycode.run"
password = "secret"  # From Docker Secret
from = "TryCode <noreply@trycode.run>"
tls = "starttls"

[captcha]
provider = "trycap"
site_key = "your-site-key"
secret_key = "secret"  # From Docker Secret
verify_url = "http://trycap:8080/api/v1/verify"
enabled = true
actions = ["register", "login", "execute"]

[oauth.github]
enabled = true
client_id = "github-client-id"
client_secret = "secret"  # From Docker Secret
redirect_url = "https://trycode.run/api/auth/oauth/github/callback"

[ai]
enabled = true
base_url = "https://api.openai.com/v1"
api_key = "sk-..."  # From Docker Secret
default_model = "gpt-4o-mini"

[execution]
global_max_concurrent = 4
per_user_max_concurrent = 2
queue_timeout_secs = 60
default_cpu_time_secs = 30
default_memory_mb = 256
```

### Frontend (`.env`)
```bash
VITE_API_BASE=/api
VITE_WS_BASE=ws://localhost:3000
```

## 🧪 Development

### Backend
```bash
cd backend
cargo test --workspace
cargo run --bin trycode-backend serve
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# http://localhost:5173
```

### Full Stack (Docker Compose)
```bash
docker compose -f docker-compose.yml up -d
# Backend: http://localhost:3000
# Frontend: http://localhost:5173 (dev)
# Metrics: http://localhost:8428
# Logs: http://localhost:9428
```

## 📊 Monitoring

- **Metrics**: VictoriaMetrics at `:8428` (PromQL, 30d retention)
- **Logs**: VictoriaLogs at `:9428` (LogSQL, 7d/30d retention)
- **Vector** collects Docker logs → VictoriaLogs
- **Health**: `GET /health` (checks PG, Redis, VM, VL, executors)

## 🔒 Security Hardening

- **gVisor** ptrace platform (kernel 7.x compatible)
- **No network** in execution containers (`network_mode: none`)
- **Read-only rootfs**, tmpfs for workspace
- **Resource limits**: CPU, memory, pids, disk
- **Secrets**: Docker Secrets (JWT, DB, SMTP, CAPTCHA, AI, OAuth)
- **Rate limiting**: Per-IP, per-user, per-API-key
- **CSP, HSTS, X-Frame-Options** via OpenResty

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Run tests: `cargo test --workspace` / `npm test`
4. Submit PR

## 📞 Support

- Issues: GitHub Issues
- Discussions: GitHub Discussions
- Email: support@trycode.run