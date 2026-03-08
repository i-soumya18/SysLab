#!/bin/bash

# System Design Simulator - Development Setup Script

echo "🚀 Setting up System Design Simulator development environment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed (V2 uses 'docker compose')
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Start PostgreSQL and Redis containers
echo "📦 Starting PostgreSQL and Redis containers..."
if command -v docker-compose &> /dev/null; then
    docker-compose -f infra/compose/docker-compose.yml up -d postgres redis
else
    docker compose -f infra/compose/docker-compose.yml up -d postgres redis
fi

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check if PostgreSQL is ready
echo "🔍 Checking PostgreSQL connection..."
if command -v docker-compose &> /dev/null; then
    until docker-compose -f infra/compose/docker-compose.yml exec postgres pg_isready -U postgres; do
        echo "Waiting for PostgreSQL..."
        sleep 2
    done
else
    until docker compose -f infra/compose/docker-compose.yml exec postgres pg_isready -U postgres; do
        echo "Waiting for PostgreSQL..."
        sleep 2
    done
fi

# Check if Redis is ready
echo "🔍 Checking Redis connection..."
if command -v docker-compose &> /dev/null; then
    until docker-compose -f infra/compose/docker-compose.yml exec redis redis-cli ping; do
        echo "Waiting for Redis..."
        sleep 2
    done
else
    until docker compose -f infra/compose/docker-compose.yml exec redis redis-cli ping; do
        echo "Waiting for Redis..."
        sleep 2
    done
fi

echo "✅ Database services are ready!"

# Install dependencies if not already installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing root dependencies..."
    npm install
fi

if [ ! -d "apps/frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd apps/frontend && npm install && cd ../..
fi

if [ ! -d "apps/backend/node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    cd apps/backend && npm install && cd ../..
fi

echo "🎉 Development environment setup complete!"
echo ""
echo "To start the development servers:"
echo "  npm run dev"
echo ""
echo "To stop the database services:"
echo "  docker compose -f infra/compose/docker-compose.yml down"
echo ""
echo "Database URLs:"
echo "  PostgreSQL: postgresql://postgres:postgres@localhost:5432/system_design_simulator"
echo "  Redis: redis://localhost:6379"
