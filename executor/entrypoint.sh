#!/bin/bash
# Executor container entrypoint

set -e

WORKER_ID=${WORKER_ID:-1}
METRICS_PORT=${METRICS_PORT:-9090}

echo "Starting executor worker $WORKER_ID on port $METRICS_PORT"

# Start metrics exporter in background
executor-daemon --metrics-port $METRICS_PORT --worker-id $WORKER_ID &

METRICS_PID=$!

# Function to handle shutdown
shutdown() {
    echo "Shutting down..."
    kill $METRICS_PID 2>/dev/null || true
    wait $METRICS_PID 2>/dev/null || true
    exit 0
}

trap shutdown SIGTERM SIGINT

# Keep container running
wait $METRICS_PID