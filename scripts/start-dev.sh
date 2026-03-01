#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="sds"
COMPOSE_FILES="-f docker-compose.yml -f docker-compose.dev.yml"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  System Design Simulator - Development Mode (Hot Reload)     ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker is not installed${NC}"
    exit 1
fi

# Check Docker daemon / compose connectivity
if ! docker info > /dev/null 2>&1; then
    if ! docker compose $COMPOSE_FILES ps > /dev/null 2>&1; then
        echo -e "${RED}✗ Docker daemon is not running${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓ Docker is running${NC}"

# Stop any existing containers (optional cleanup)
if docker compose $COMPOSE_FILES ps -q 2>/dev/null | grep -q .; then
    echo -e "${YELLOW}⚠ Stopping existing containers...${NC}"
    docker compose $COMPOSE_FILES down 2>/dev/null || true
fi

echo ""
echo -e "${YELLOW}Starting services...${NC}"
echo ""

# Start services
docker compose $COMPOSE_FILES up -d

echo ""
echo -e "${YELLOW}⏳ Waiting for services to be ready (30 seconds)...${NC}"

# Wait for backend health
max_attempts=30
attempt=0

echo -n "Backend: "
while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:8080/health > /dev/null 2>&1 || \
       curl -s http://localhost:8080/api/v1/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
        break
    fi
    echo -n "."
    sleep 1
    ((attempt++))
done

if [ $attempt -eq $max_attempts ]; then
    echo -e "${YELLOW}Backend is starting (may take a moment)${NC}"
fi

sleep 3

echo ""
echo -e "${GREEN}✓ Development environment started!${NC}"
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}📍 ACCESS POINTS${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "   Frontend:     ${GREEN}http://localhost:8080${NC}"
echo -e "   Backend API:  ${GREEN}http://localhost:8080/api/v1${NC}"
echo -e "   Grafana:      ${GREEN}http://localhost:3001${NC} (admin/admin)"
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}🔥 HOT RELOAD ENABLED${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "   Frontend:  Edit ${GREEN}frontend/src/**${NC} → Changes auto-refresh"
echo -e "   Backend:   Edit ${GREEN}backend/src/**${NC} → Server auto-restarts"
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}📝 USEFUL COMMANDS${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "   View logs:  ${GREEN}docker compose $COMPOSE_FILES logs -f${NC}"
echo -e "   Frontend:   ${GREEN}docker compose $COMPOSE_FILES logs -f frontend${NC}"
echo -e "   Backend:    ${GREEN}docker compose $COMPOSE_FILES logs -f backend${NC}"
echo -e "   Stop:       ${GREEN}./scripts/stop-dev.sh${NC}"
echo -e "   Clean:      ${GREEN}docker compose $COMPOSE_FILES down -v${NC}"
echo ""
echo -e "${BLUE}✨ Ready to code! Start editing and watch changes live. ✨${NC}"
echo ""
