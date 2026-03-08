#!/bin/bash

# System Design Simulator - Logs Viewer
# This script helps view logs for different services

set -e

# Use docker compose or docker-compose depending on what's available
DOCKER_COMPOSE="docker compose"
if ! docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE="docker-compose"
fi
COMPOSE_FILES="-f infra/compose/docker-compose.yml"

# Check if a service name is provided
if [ -z "$1" ]; then
    echo "📋 Viewing logs for all services (press Ctrl+C to exit)..."
    echo ""
    $DOCKER_COMPOSE $COMPOSE_FILES logs -f
else
    service=$1
    echo "📋 Viewing logs for $service (press Ctrl+C to exit)..."
    echo ""
    $DOCKER_COMPOSE $COMPOSE_FILES logs -f "$service"
fi
