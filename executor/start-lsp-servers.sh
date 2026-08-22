#!/bin/bash
# LSP Server Startup Script
# Starts language servers based on configuration

set -e

# Configuration
LSP_MODE="${LSP_MODE:-hybrid}"  # monaco, lsp, hybrid
WORKER_ID=${WORKER_ID:-1}

# Language server configurations
# Format: language_id:command:args:memory_limit_mb:idle_timeout_secs:startup_mode
declare -A LSP_SERVERS=(
    # Resident servers (always running)
    ["python"]="pyright-langserver --stdio:256:300:resident"
    ["typescript"]="typescript-language-server --stdio:200:300:resident"
    ["javascript"]="typescript-language-server --stdio:200:300:resident"
    
    # On-demand servers
    ["rust"]="rust-analyzer:300:600:on_demand"
    ["go"]="gopls serve:150:300:on_demand"
    ["cpp"]="clangd --background-index --clang-tidy:200:300:on_demand"
    ["c"]="clangd --background-index --clang-tidy:200:300:on_demand"
    ["java"]="java -Xmx512m -jar /opt/lsp-servers/jdt-language-server/plugins/org.eclipse.equinox.launcher_*.jar -configuration /opt/lsp-servers/jdt-language-server/config_linux -data /workspace/.jdt:400:900:on_demand"
    ["csharp"]="dotnet /opt/lsp-servers/omnisharp/OmniSharp.dll --languageserver --hostpid 0:300:600:on_demand"
    ["php"]="intelephense --stdio:150:300:on_demand"
    ["ruby"]="ruby-lsp:150:300:on_demand"
    ["swift"]="sourcekit-lsp:300:600:on_demand"
    ["kotlin"]="kotlin-language-server:300:600:on_demand"
    ["scala"]="metals:500:600:on_demand"
    ["go"]="gopls serve:150:300:on_demand"
    ["cpp"]="clangd --background-index --clang-tidy:200:300:on_demand"
    ["c"]="clangd --background-index --clang-tidy:200:300:on_demand"
    ["rust"]="rust-analyzer:300:600:on_demand"
    ["go"]="gopls serve:150:300:on_demand"
    ["julia"]="julia --project=@stdlib -e 'using LanguageServer; LanguageServer.runserver()':300:600:on_demand"
    ["haskell"]="haskell-language-server-wrapper --lsp:300:600:on_demand"
    ["fortran"]="fortls:150:300:on_demand"
    ["objectivec"]="clangd --background-index:200:300:on_demand"
    ["vbnet"]="dotnet /opt/lsp-servers/omnisharp/OmniSharp.dll --languageserver --hostpid 0:300:600:on_demand"
    ["fsharp"]="dotnet /opt/lsp-servers/ionide/FSharpLanguageServer.dll:300:600:on_demand"
    ["groovy"]="groovy-language-server:200:300:on_demand"
    ["html"]="vscode-html-languageserver --stdio:150:300:on_demand"
    ["css"]="vscode-css-languageserver --stdio:150:300:on_demand"
    ["yaml"]="yaml-language-server --stdio:100:300:on_demand"
    ["sql"]="sql-language-server --stdio:150:300:on_demand"
    ["bash"]="bash-language-server start:100:300:on_demand"
    ["powershell"]="powershell -NoProfile -Command Start-PowerShellEditorServices -Stdio:200:300:on_demand"
)

# LSP Server manager
LSP_PIDS=()

start_lsp_server() {
    local lang=$1
    local config=${LSP_SERVERS[$lang]}
    
    if [[ -z "$config" ]]; then
        echo "No LSP config for language: $lang"
        return 1
    fi
    
    IFS=':' read -r cmd mem_limit idle_timeout startup_mode <<< "$config"
    
    echo "Starting LSP server for $lang: $cmd"
    
    # Start the language server
    # Using a simple approach - in production you'd want proper process management
    eval "$cmd" &
    local pid=$!
    
    echo "Started $lang LSP server (PID: $pid)"
    LSP_SERVERS["${lang}_pid"]=$pid
    LSP_SERVERS["${lang}_mem_limit"]=$mem_limit
    LSP_SERVERS["${lang}_idle_timeout"]=$idle_timeout
    LSP_SERVERS["${lang}_startup_mode"]=$startup_mode
    LSP_SERVERS["${lang}_start_time"]=$(date +%s)
    
    return 0
}

stop_lsp_server() {
    local lang=$1
    local pid=${LSP_SERVERS["${lang}_pid"]}
    
    if [[ -n "$pid" ]]; then
        kill $pid 2>/dev/null || true
        wait $pid 2>/dev/null || true
        unset LSP_SERVERS["${lang}_pid"]
        unset LSP_SERVERS["${lang}_mem_limit"]
        unset LSP_SERVERS["${lang}_idle_timeout"]
        unset LSP_SERVERS["${lang}_startup_mode"]
        unset LSP_SERVERS["${lang}_start_time"]
        echo "Stopped LSP server for $lang"
    fi
}

monitor_lsp_servers() {
    while true; do
        sleep 30
        
        for lang in "${!LSP_SERVERS[@]}"; do
            # Skip non-pid keys
            [[ "$lang" == *"_pid" ]] || continue
            
            local lang_id="${lang%_pid}"
            local pid=${LSP_SERVERS[$lang]}
            local mem_limit=${LSP_SERVERS["${lang_id}_mem_limit"]}
            local idle_timeout=${LSP_SERVERS["${lang_id}_idle_timeout"]}
            local start_time=${LSP_SERVERS["${lang_id}_start_time"]}
            local startup_mode=${LSP_SERVERS["${lang_id}_startup_mode"]}
            
            if [[ -n "$pid" ]]; then
                # Check if process is still alive
                if ! kill -0 $pid 2>/dev/null; then
                    echo "LSP server for $lang_id died, restarting..."
                    unset LSP_SERVERS["${lang_id}_pid"]
                    # Restart logic here
                fi
                
                # Check memory limit
                if [[ -n "$mem_limit" ]]; then
                    local mem_usage=$(ps -o rss= -p $pid 2>/dev/null || echo 0)
                    local mem_mb=$((mem_usage / 1024))
                    if [[ $mem_mb -gt $mem_limit ]]; then
                        echo "LSP server $lang_id exceeded memory limit ($mem_mb MB > $mem_limit MB), restarting..."
                        kill $pid 2>/dev/null || true
                        unset LSP_SERVERS["${lang_id}_pid"]
                        # Restart logic here
                    fi
                fi
                
                # Check idle timeout for on_demand servers
                if [[ "$startup_mode" == "on_demand" && -n "$idle_timeout" ]]; then
                    local current_time=$(date +%s)
                    local elapsed=$((current_time - start_time))
                    if [[ $elapsed -gt $idle_timeout ]]; then
                        echo "LSP server $lang_id idle timeout reached ($elapsed > $idle_timeout), stopping..."
                        kill $pid 2>/dev/null || true
                        unset LSP_SERVERS["${lang_id}_pid"]
                    fi
                fi
            fi
        done
    done
}

# Signal handlers
cleanup() {
    echo "Shutting down LSP servers..."
    for lang in "${!LSP_SERVERS[@]}"; do
        if [[ "$lang" == *"_pid" ]]; then
            local lang_id="${lang%_pid}"
            stop_lsp_server "$lang_id"
        fi
    done
    exit 0
}

trap cleanup SIGTERM SIGINT

# Main
main() {
    echo "Starting LSP Server Manager"
    
    # Start resident servers
    echo "Starting resident LSP servers..."
    start_lsp_server "python"
    start_lsp_server "typescript"
    start_lsp_server "javascript"
    
    # Start monitoring
    monitor_lsp_servers &
    MONITOR_PID=$!
    
    # Wait for signals
    wait
}

# If script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi