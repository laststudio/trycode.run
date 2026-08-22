#!/bin/bash
# TryCode Secret Initialization Script
# Run as systemd oneshot service on boot

set -euo pipefail

SECRETS_DIR="/opt/trycode/secrets"
mkdir -p "$SECRETS_DIR"
chmod 700 "$SECRETS_DIR"

declare -A SECRETS=(
    ["jwt_secret"]="openssl rand -hex 32"
    ["pg_password"]="openssl rand -hex 24"
    ["redis_password"]="openssl rand -hex 24"
    ["smtp_password"]=""
    ["captcha_secret"]=""
    ["ai_api_key"]=""
    ["github_oauth_secret"]=""
)

echo "Initializing TryCode secrets..."

for name in "${!SECRETS[@]}"; do
    file="$SECRETS_DIR/${name}.txt"
    
    if [[ ! -f "$file" ]]; then
        if [[ -n "${SECRETS[$name]}" ]]; then
            echo "Generating $name..."
            eval "${SECRETS[$name]}" > "$file"
        else
            echo "MANUAL REQUIRED: $file (please fill in manually)"
            touch "$file"
        fi
        chmod 600 "$file"
    else
        echo "Secret $name already exists, skipping"
    fi
done

# Create Docker secrets if in swarm mode
if docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null | grep -q active; then
    echo "Docker Swarm detected, creating secrets..."
    for name in "${!SECRETS[@]}"; do
        file="$SECRETS_DIR/${name}.txt"
        if [[ -s "$file" ]]; then
            docker secret create "$name" "$file" 2>/dev/null || echo "Secret $name already exists"
        fi
    done
fi

echo "Secret initialization complete"
echo "Secrets directory: $SECRETS_DIR"
ls -la "$SECRETS_DIR"