#!/bin/bash

# System Design Simulator - Health Check Script
# This script checks the health of all services

set -e

echo "🏥 Checking service health..."
echo ""

# Function to check if a service is healthy
check_service() {
    local service=$1
    local url=$2
    local name=$3

    if curl -sf "$url" > /dev/null 2>&1; then
        echo "✅ $name is healthy"
        return 0
    else
        echo "❌ $name is not responding"
        return 1
    fi
}

# Function to check Docker container health
check_container() {
    local container=$1
    local name=$2

    if [ "$(docker inspect -f '{{.State.Health.Status}}' "$container" 2>/dev/null)" == "healthy" ]; then
        echo "✅ $name is healthy"
        return 0
    elif [ "$(docker inspect -f '{{.State.Status}}' "$container" 2>/dev/null)" == "running" ]; then
        echo "⚠️  $name is running (no health check configured)"
        return 0
    else
        echo "❌ $name is not healthy"
        return 1
    fi
}

all_healthy=true

# Check Docker containers
echo "📦 Docker Containers:"
check_container "sds-postgres" "PostgreSQL" || all_healthy=false
check_container "sds-redis" "Redis" || all_healthy=false
check_container "sds-backend" "Backend API" || all_healthy=false
check_container "sds-frontend" "Frontend" || all_healthy=false
check_container "sds-gateway" "Nginx Gateway" || all_healthy=false
check_container "sds-prometheus" "Prometheus" || all_healthy=false
check_container "sds-grafana" "Grafana" || all_healthy=false

echo ""
echo "🌐 HTTP Endpoints:"
check_service backend "http://localhost:8080/health" "Backend API" || all_healthy=false
check_service frontend "http://localhost:8080/" "Frontend" || all_healthy=false
check_service grafana "http://localhost:3001/" "Grafana Dashboard" || all_healthy=false

echo ""
if [ "$all_healthy" = true ]; then
    echo "✅ All services are healthy!"
    exit 0
else
    echo "❌ Some services are not healthy. Check logs with: docker-compose logs"
    exit 1
fi
