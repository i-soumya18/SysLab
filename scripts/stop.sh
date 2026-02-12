#!/bin/bash

# System Design Simulator - Stop Script
# This script stops all running containers

set -e

echo "🛑 Stopping System Design Simulator..."

# Use docker compose or docker-compose depending on what's available
DOCKER_COMPOSE="docker compose"
if ! docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE="docker-compose"
fi

# Stop all services
$DOCKER_COMPOSE down

echo "✅ All services stopped."
echo ""
echo "💡 To remove volumes as well, run: docker-compose down -v"
echo ""
