#!/bin/bash

# System Design Simulator - Startup Script
# This script starts the entire application stack using Docker Compose

set -e

echo "🚀 Starting System Design Simulator..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker first."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null 2>&1; then
    echo "❌ Error: docker-compose is not installed."
    exit 1
fi

# Use docker compose or docker-compose depending on what's available
DOCKER_COMPOSE="docker compose"
if ! docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE="docker-compose"
fi

# Check if .env file exists, if not copy from .env.example
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "⚠️  Please update .env with your configuration before running in production!"
    echo ""
fi

# Pull latest images
echo "📥 Pulling latest images..."
$DOCKER_COMPOSE pull

# Build services
echo "🔨 Building services..."
$DOCKER_COMPOSE build --parallel

# Start services
echo "🎬 Starting services..."
$DOCKER_COMPOSE up -d

# Wait for services to be healthy
echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 5

# Check health
./scripts/health-check.sh

echo ""
echo "✅ System Design Simulator is running!"
echo ""
echo "🌐 Access the application at: http://localhost"
echo "📊 Grafana dashboard at: http://localhost:3001 (admin/admin)"
echo ""
echo "📝 Useful commands:"
echo "  - View logs: docker-compose logs -f"
echo "  - Stop: docker-compose down"
echo "  - Restart: docker-compose restart"
echo "  - View status: docker-compose ps"
echo ""
