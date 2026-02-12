#!/bin/bash

# System Design Simulator - Stop Development Mode
# This script stops all development services

set -e

echo "🛑 Stopping development environment..."

docker compose -f docker-compose.yml -f docker-compose.dev.yml down

echo ""
echo "✅ Development environment stopped!"
echo ""
echo "To start again: ./scripts/start-dev.sh"
echo ""
