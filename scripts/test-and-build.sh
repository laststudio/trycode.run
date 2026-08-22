#!/bin/bash
# TryCode Automated Test & Build Pipeline
# Runs all tests, checks, and builds for the project

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[PASS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[FAIL]${NC} $1"; }

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

run_test() {
    local name="$1"
    local cmd="$2"
    
    log_info "Running: $name"
    if eval "$cmd"; then
        log_success "$name"
        ((TESTS_PASSED++))
        return 0
    else
        log_error "$name"
        ((TESTS_FAILED++))
        return 1
    fi
}

run_test_optional() {
    local name="$1"
    local cmd="$2"
    
    log_info "Running (optional): $name"
    if eval "$cmd"; then
        log_success "$name"
        ((TESTS_PASSED++))
        return 0
    else
        log_warn "$name (optional, skipped)"
        ((TESTS_SKIPPED++))
        return 1
    fi
}

echo "=========================================="
echo "TryCode Test & Build Pipeline"
echo "=========================================="

cd "$PROJECT_ROOT"

# ============================================================================
# BACKEND TESTS (Rust)
# ============================================================================
log_info "=== BACKEND TESTS ==="

cd "$PROJECT_ROOT/backend"

# Format check
run_test "Rust fmt check" "cargo fmt --all -- --check"

# Clippy lints
run_test "Rust clippy" "cargo clippy --workspace --all-targets -- -D warnings"

# Type check
run_test "Rust type check" "cargo check --workspace --all-targets"

# Unit tests
run_test "Rust unit tests" "cargo test --workspace --all-targets"

# Integration tests (requires DB)
if [ -n "${TEST_DATABASE_URL:-}" ]; then
    export DATABASE_URL="$TEST_DATABASE_URL"
    export REDIS_URL="${TEST_REDIS_URL:-redis://localhost:6379/0}"
    export JWT_SECRET="test-secret-key-for-testing-only-32-chars"
    export CONFIG_FILE="$PROJECT_ROOT/config/backend.test.toml"
    
    run_test "Rust integration tests" "cargo test --workspace --all-targets -- --test-threads=4"
else
    log_warn "Integration tests skipped (TEST_DATABASE_URL not set)"
    ((TESTS_SKIPPED++))
fi

# Build release
run_test "Rust release build" "cargo build --workspace --release"

# Check binary sizes
log_info "Binary sizes:"
ls -lh target/release/trycode-backend 2>/dev/null || true
ls -lh target/release/executor-daemon 2>/dev/null || true

cd "$PROJECT_ROOT"

# ============================================================================
# FRONTEND TESTS
# ============================================================================
log_info "=== FRONTEND TESTS ==="

cd "$PROJECT_ROOT/frontend"

# Install dependencies
run_test "Frontend npm install" "npm ci"

# Lint
run_test "Frontend ESLint" "npm run lint"

# Type check
run_test "Frontend TypeScript check" "npm run typecheck"

# Build
run_test "Frontend production build" "npm run build"

# Check build output size
log_info "Build output size:"
du -sh dist/ 2>/dev/null || true

# Test build output can be served
run_test_optional "Frontend preview server" "timeout 10 npx vite preview --port 4173 --host 0.0.0.0 & sleep 3 && curl -f http://localhost:4173/health && pkill -f 'vite preview'"

cd "$PROJECT_ROOT"

# ============================================================================
# DOCKER TESTS
# ============================================================================
log_info "=== DOCKER TESTS ==="

# Validate docker-compose
run_test "Docker Compose config validation" "docker compose config --quiet"

# Build images
run_test "Backend Docker build" "docker build -f backend/Dockerfile.all-in-one -t trycode/backend:test backend/"
run_test "Executor Docker build" "docker build -f executor/Dockerfile -t trycode/executor:test executor/"

# Test image sizes
log_info "Docker image sizes:"
docker images trycode/backend:test --format "{{.Repository}}:{{.Tag}} {{.Size}}"
docker images trycode/executor:test --format "{{.Repository}}:{{.Tag}} {{.Size}}"

# Security scan (optional)
run_test_optional "Trivy security scan (backend)" "trivy image --severity HIGH,CRITICAL --exit-code 1 trycode/backend:test"
run_test_optional "Trivy security scan (executor)" "trivy image --severity HIGH,CRITICAL --exit-code 1 trycode/executor:test"

# ============================================================================
# INTEGRATION TESTS (with docker-compose)
# ============================================================================
log_info "=== INTEGRATION TESTS ==="

# Start test stack
run_test "Start test stack" "docker compose -f docker-compose.yml -f docker-compose.test.yml up -d --build"

# Wait for services
log_info "Waiting for services to be healthy..."
sleep 30

# Health checks
run_test "Backend health check" "curl -f http://localhost:3000/health"
run_test "VictoriaMetrics health" "curl -f http://localhost:8428/health"
run_test "VictoriaLogs health" "curl -f http://localhost:9428/health"

# API tests
run_test "Auth register endpoint" "curl -f -X POST http://localhost:3000/api/auth/register -H 'Content-Type: application/json' -d '{\"email\":\"test@example.com\",\"password\":\"password123\",\"name\":\"Test User\"}'"
run_test "Execute endpoint" "curl -f -X POST http://localhost:3000/api/execute -H 'Content-Type: application/json' -d '{\"code\":\"print(1+1)\",\"language\":\"python\"}'"

# Stop test stack
run_test "Stop test stack" "docker compose -f docker-compose.yml -f docker-compose.test.yml down -v"

# ============================================================================
# SECURITY TESTS
# ============================================================================
log_info "=== SECURITY TESTS ==="

# Check for secrets in code
run_test "No hardcoded secrets" "! grep -r 'password.*=' --include='*.rs' --include='*.ts' --include='*.tsx' backend/ frontend/ | grep -v 'test' | grep -v 'example' | grep -v 'placeholder'"

# Check for SQL injection vulnerabilities
run_test "No raw SQL concatenation" "! grep -r 'format!' --include='*.rs' backend/ | grep -i 'select\\|insert\\|update\\|delete' | grep -v 'sqlx::query!'"

# Check dependencies for vulnerabilities
run_test_optional "Cargo audit" "cargo audit --deny warnings"

# ============================================================================
# PERFORMANCE TESTS (optional)
# ============================================================================
log_info "=== PERFORMANCE TESTS ==="

run_test_optional "k6 load test" "k6 run scripts/load-test.js"

# ============================================================================
# SUMMARY
# ============================================================================
echo ""
echo "=========================================="
echo "TEST SUMMARY"
echo "=========================================="
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo -e "${YELLOW}Skipped: $TESTS_SKIPPED${NC}"
echo ""

if [ $TESTS_FAILED -gt 0 ]; then
    log_error "Some tests failed!"
    exit 1
else
    log_success "All tests passed!"
    exit 0
fi