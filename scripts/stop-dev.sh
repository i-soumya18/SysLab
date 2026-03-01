#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

COMPOSE_FILES="-f docker-compose.yml -f docker-compose.dev.yml"

echo -e "${BLUE}Stopping development environment...${NC}"
docker compose $COMPOSE_FILES down

echo ""
echo -e "${GREEN}✓ Development environment stopped${NC}"
echo ""
echo -e "${YELLOW}To start again: ./scripts/start-dev.sh${NC}"
echo ""

