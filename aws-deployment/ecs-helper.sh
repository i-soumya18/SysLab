#!/bin/bash

# ============================================
# ECS Deployment Helper Script
# ============================================
# Helper commands for managing ECS deployments
#
# Usage: bash aws-deployment/ecs-helper.sh [command]
# ============================================

# Load AWS config
if [ ! -f "aws-deployment/aws-config.env" ]; then
    echo "❌ aws-deployment/aws-config.env not found"
    exit 1
fi

source aws-deployment/aws-config.env

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Functions

# View tasks
view_tasks() {
    echo -e "${BLUE}Backend Tasks:${NC}"
    aws ecs list-tasks \
        --cluster "$ECS_CLUSTER_NAME" \
        --service-name syslab-backend-service \
        --region "$AWS_REGION" \
        --query 'taskArns[]' \
        --output text

    echo ""
    echo -e "${BLUE}Frontend Tasks:${NC}"
    aws ecs list-tasks \
        --cluster "$ECS_CLUSTER_NAME" \
        --service-name syslab-frontend-service \
        --region "$AWS_REGION" \
        --query 'taskArns[]' \
        --output text
}

# View service status
view_services() {
    echo -e "${BLUE}ECS Services Status:${NC}"
    aws ecs describe-services \
        --cluster "$ECS_CLUSTER_NAME" \
        --services syslab-backend-service syslab-frontend-service \
        --region "$AWS_REGION" \
        --query 'services[*].[serviceName,desiredCount,runningCount,status]' \
        --output table
}

# View logs
view_logs() {
    local service=$1
    if [ -z "$service" ]; then
        echo -e "${YELLOW}Specify service: backend or frontend${NC}"
        return
    fi

    case $service in
        backend)
            echo -e "${BLUE}Backend Logs (last 100 lines):${NC}"
            aws logs tail /ecs/syslab-backend --follow --max-items 100 --region "$AWS_REGION"
            ;;
        frontend)
            echo -e "${BLUE}Frontend Logs (last 100 lines):${NC}"
            aws logs tail /ecs/syslab-frontend --follow --max-items 100 --region "$AWS_REGION"
            ;;
        *)
            echo -e "${RED}Unknown service: $service${NC}"
            ;;
    esac
}

# Restart service
restart_service() {
    local service=$1
    if [ -z "$service" ]; then
        echo -e "${YELLOW}Specify service: backend or frontend${NC}"
        return
    fi

    case $service in
        backend)
            echo -e "${BLUE}Restarting backend service...${NC}"
            aws ecs update-service \
                --cluster "$ECS_CLUSTER_NAME" \
                --service syslab-backend-service \
                --force-new-deployment \
                --region "$AWS_REGION"
            echo -e "${GREEN}✓ Backend service restart initiated${NC}"
            ;;
        frontend)
            echo -e "${BLUE}Restarting frontend service...${NC}"
            aws ecs update-service \
                --cluster "$ECS_CLUSTER_NAME" \
                --service syslab-frontend-service \
                --force-new-deployment \
                --region "$AWS_REGION"
            echo -e "${GREEN}✓ Frontend service restart initiated${NC}"
            ;;
        *)
            echo -e "${RED}Unknown service: $service${NC}"
            ;;
    esac
}

# Scale service
scale_service() {
    local service=$1
    local count=$2
    
    if [ -z "$service" ] || [ -z "$count" ]; then
        echo -e "${RED}Usage: scale_service <backend|frontend> <count>${NC}"
        return
    fi

    case $service in
        backend)
            echo -e "${BLUE}Scaling backend to $count tasks...${NC}"
            aws ecs update-service \
                --cluster "$ECS_CLUSTER_NAME" \
                --service syslab-backend-service \
                --desired-count "$count" \
                --region "$AWS_REGION"
            echo -e "${GREEN}✓ Backend scaling initiated${NC}"
            ;;
        frontend)
            echo -e "${BLUE}Scaling frontend to $count tasks...${NC}"
            aws ecs update-service \
                --cluster "$ECS_CLUSTER_NAME" \
                --service syslab-frontend-service \
                --desired-count "$count" \
                --region "$AWS_REGION"
            echo -e "${GREEN}✓ Frontend scaling initiated${NC}"
            ;;
        *)
            echo -e "${RED}Unknown service: $service${NC}"
            ;;
    esac
}

# Health check
health_check() {
    echo -e "${BLUE}Checking service health...${NC}"
    
    local alb_dns=$1
    if [ -z "$alb_dns" ]; then
        echo -e "${RED}Usage: health_check <alb_dns_name>${NC}"
        echo -e "${YELLOW}Example: health_check syslab-alb-123456.us-east-1.elb.amazonaws.com${NC}"
        return
    fi

    echo -e "${BLUE}Testing Backend Health...${NC}"
    if curl -s "http://$alb_dns/api/health" | grep -q "ok"; then
        echo -e "${GREEN}✓ Backend Health: OK${NC}"
    else
        echo -e "${RED}✗ Backend Health: FAILED${NC}"
    fi

    echo ""
    echo -e "${BLUE}Testing Frontend...${NC}"
    if curl -s "http://$alb_dns/" | grep -q "html"; then
        echo -e "${GREEN}✓ Frontend: OK${NC}"
    else
        echo -e "${RED}✗ Frontend: FAILED${NC}"
    fi
}

# Deploy specific image
deploy_image() {
    local service=$1
    local image=$2

    if [ -z "$service" ] || [ -z "$image" ]; then
        echo -e "${RED}Usage: deploy_image <backend|frontend> <image_uri>${NC}"
        return
    fi

    case $service in
        backend)
            echo -e "${BLUE}Deploying backend image: $image${NC}"
            
            # Get current task definition
            aws ecs describe-task-definition \
                --task-definition "$ECS_TASK_DEFINITION_FAMILY_BACKEND" \
                --region "$AWS_REGION" \
                --query taskDefinition \
                --output json > /tmp/task-def.json

            # Update image in task definition
            sed -i.bak "s|\"image\": \".*\"|\"image\": \"$image\"|g" /tmp/task-def.json

            # Register new task definition
            aws ecs register-task-definition \
                --cli-input-json file:///tmp/task-def.json \
                --region "$AWS_REGION" > /dev/null

            # Update service
            aws ecs update-service \
                --cluster "$ECS_CLUSTER_NAME" \
                --service syslab-backend-service \
                --task-definition "$ECS_TASK_DEFINITION_FAMILY_BACKEND" \
                --region "$AWS_REGION" > /dev/null

            echo -e "${GREEN}✓ Backend deployment initiated${NC}"
            ;;
        frontend)
            echo -e "${BLUE}Deploying frontend image: $image${NC}"
            
            # Get current task definition
            aws ecs describe-task-definition \
                --task-definition "$ECS_TASK_DEFINITION_FAMILY_FRONTEND" \
                --region "$AWS_REGION" \
                --query taskDefinition \
                --output json > /tmp/task-def.json

            # Update image in task definition
            sed -i.bak "s|\"image\": \".*\"|\"image\": \"$image\"|g" /tmp/task-def.json

            # Register new task definition
            aws ecs register-task-definition \
                --cli-input-json file:///tmp/task-def.json \
                --region "$AWS_REGION" > /dev/null

            # Update service
            aws ecs update-service \
                --cluster "$ECS_CLUSTER_NAME" \
                --service syslab-frontend-service \
                --task-definition "$ECS_TASK_DEFINITION_FAMILY_FRONTEND" \
                --region "$AWS_REGION" > /dev/null

            echo -e "${GREEN}✓ Frontend deployment initiated${NC}"
            ;;
        *)
            echo -e "${RED}Unknown service: $service${NC}"
            ;;
    esac

    rm -f /tmp/task-def.json /tmp/task-def.json.bak
}

# Show help
show_help() {
    cat << 'EOF'
ECS Deployment Helper

Usage: bash aws-deployment/ecs-helper.sh [command] [args]

Commands:
  tasks                    - List running tasks
  services                 - Show service status
  logs <backend|frontend>  - View service logs
  restart <backend|frontend> - Restart a service
  scale <backend|frontend> <count> - Scale service to N tasks
  health <alb_dns>         - Perform health checks
  deploy <backend|frontend> <image_uri> - Deploy new image
  help                     - Show this help message

Examples:
  bash aws-deployment/ecs-helper.sh tasks
  bash aws-deployment/ecs-helper.sh logs backend
  bash aws-deployment/ecs-helper.sh scale backend 3
  bash aws-deployment/ecs-helper.sh health syslab-alb-123.us-east-1.elb.amazonaws.com
  bash aws-deployment/ecs-helper.sh deploy backend 123456789012.dkr.ecr.us-east-1.amazonaws.com/syslab-backend:v1.0.0

EOF
}

# Main
case "$1" in
    tasks)
        view_tasks
        ;;
    services)
        view_services
        ;;
    logs)
        view_logs "$2"
        ;;
    restart)
        restart_service "$2"
        ;;
    scale)
        scale_service "$2" "$3"
        ;;
    health)
        health_check "$2"
        ;;
    deploy)
        deploy_image "$2" "$3"
        ;;
    help|--help|-h|"")
        show_help
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        show_help
        exit 1
        ;;
esac
