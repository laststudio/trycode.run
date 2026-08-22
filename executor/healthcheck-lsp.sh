#!/bin/bash
# LSP Server Health Check Script

set -e

LSP_SOCKET_DIR="${LSP_SOCKET_DIR:-/tmp/lsp-sockets}"
WORKER_ID="${WORKER_ID:-1}"

check_lsp_server() {
    local lang=$1
    local socket="${LSP_SOCKET_DIR}/${lang}.sock"
    
    if [[ ! -S "$socket" ]]; then
        echo "FAIL: Socket not found for $lang"
        return 1
    fi
    
    # Try to send a simple LSP initialize request
    # This is a simplified check - in reality you'd use a proper LSP client
    if command -v nc &> /dev/null; then
        # Try to connect to the socket
        if nc -U "$socket" -w 2 < /dev/null > /dev/null 2>&1; then
            echo "OK: $lang"
            return 0
        fi
    fi
    
    # Fallback: check if process is running
    if pgrep -f "language.*server.*$1" > /dev/null; then
        echo "OK: $lang (process found)"
        return 0
    fi
    
    echo "FAIL: $lang not running"
    return 1
}

# Check specific language or all
if [[ -n "$1" ]]; then
    check_lsp_server "$1"
else
    # Check all known languages
    languages=("python" "typescript" "javascript" "rust" "go" "cpp" "c" "java" "csharp" "php" "ruby" "swift" "kotlin" "scala" "go" "julia" "haskell" "fortran" "objectivec" "vbnet" "fsharp" "groovy" "html" "css" "sql" "bash" "powershell" "dart" "zig" "julia" "lua" "perl" "r" "vbnet" "fsharp" "groovy")
    
    all_ok=true
    for lang in "${languages[@]}"; do
        if check_lsp_server "$lang"; then
            echo "✓ $lang"
        else
            echo "✗ $lang"
            all_ok=false
        fi
    done
    
    if [[ "$all_ok" == "true" ]]; then
        echo "All LSP servers healthy"
        exit 0
    else
        exit 1
    fi
fi