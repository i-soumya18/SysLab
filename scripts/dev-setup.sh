#!/bin/bash

# System Design Simulator - Development Setup Script
# This script sets up the development environment

set -e

echo "🔧 Setting up development environment..."
echo ""

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed. Please install Node.js 20 or higher."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Error: Node.js version 20 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"
echo ""

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd apps/backend
npm install
echo "✅ Backend dependencies installed"
cd ../..

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd apps/frontend
npm install
echo "✅ Frontend dependencies installed"
cd ../..

# Create .env files if they don't exist
echo ""
echo "📝 Setting up environment files..."

if [ ! -f apps/backend/.env ]; then
    cp apps/backend/.env.example apps/backend/.env
    echo "✅ Created apps/backend/.env from apps/backend/.env.example"
else
    echo "⏭️  apps/backend/.env already exists"
fi

if [ ! -f apps/frontend/.env ]; then
    cp apps/frontend/.env.example apps/frontend/.env
    echo "✅ Created apps/frontend/.env from apps/frontend/.env.example"
else
    echo "⏭️  apps/frontend/.env already exists"
fi

if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Created .env from .env.example"
else
    echo "⏭️  .env already exists"
fi

echo ""
echo "✅ Development environment setup complete!"
echo ""
echo "📝 Next steps:"
echo "  1. Update .env files with your configuration"
echo "  2. Start Docker services: ./scripts/start.sh"
echo "  3. Or run locally:"
echo "     - Backend: cd apps/backend && npm run dev"
echo "     - Frontend: cd apps/frontend && npm run dev"
echo ""
