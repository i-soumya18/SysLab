#!/bin/bash

# System Design Simulator - Development Mode with Hot Reload
# This script starts all services in development mode with hot reload enabled

set -e

echo "🔥 Starting System Design Simulator in DEVELOPMENT MODE with Hot Reload..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running"
    echo "Please start Docker and try again."
    exit 1
fi

echo "� Starting System Design Simulator in DEVELOPMENT MODE with Hot Reload..."
echo ""
echo "ℹ️  Using production images with dev mode overrides (no rebuild needed!)"
echo ""

echo "🎬 Starting services in development mode..."
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

echo ""
echo "⏳ Waiting for services to start..."
sleep 5

echo ""
echo "✅ Development environment started!"
echo ""
echo "📍 Access Points:"
echo "   - Frontend (Dev Server): http://localhost:8080"
echo "   - Backend API: http://localhost:8080/api"
echo "   - Grafana: http://localhost:3001"
echo ""
echo "🔥 Hot Reload Enabled:"
echo "   - Frontend: Edit files in frontend/src/ - changes auto-refresh"
echo "   - Backend: Edit files in backend/src/ - server auto-restarts"
echo ""
echo "📝 View Logs:"
echo "   - All services: docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f"
echo "   - Frontend: docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f frontend"
echo "   - Backend: docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f backend"
echo ""
echo "🛑 Stop Development Mode:"
echo "   ./scripts/stop-dev.sh"
echo ""
