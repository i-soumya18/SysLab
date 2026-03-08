#!/bin/bash

# ============================================
# AWS ECS Deployment Setup Script
# ============================================
# This script sets up the AWS infrastructure for SysLab
# Prerequisites: AWS CLI v2, jq, and proper IAM permissions
# 
# Usage: bash infra/aws-deployment/setup-infrastructure.sh
# ============================================

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION=${AWS_REGION:-"us-east-1"}
PROJECT_NAME="syslab"
ENVIRONMENT="production"
AVAILABILITY_ZONES=("${AWS_REGION}a" "${AWS_REGION}b")

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}SysLab AWS Infrastructure Setup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check prerequisites
echo -e "${BLUE}[1/10] Checking prerequisites...${NC}"
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found. Please install AWS CLI v2${NC}"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo -e "${RED}❌ jq not found. Please install jq${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites check passed${NC}"

# Get AWS Account ID
echo -e "${BLUE}[2/10] Retrieving AWS Account ID...${NC}"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}✓ AWS Account ID: $AWS_ACCOUNT_ID${NC}"

# Step 1: Create ECR Repositories
echo -e "${BLUE}[3/10] Creating ECR repositories...${NC}"

create_ecr_repo() {
    local repo_name=$1
    
    if aws ecr describe-repositories --repository-names "$repo_name" --region "$AWS_REGION" 2>/dev/null | grep -q "$repo_name"; then
        echo -e "${YELLOW}ℹ Repository $repo_name already exists${NC}"
    else
        aws ecr create-repository \
            --repository-name "$repo_name" \
            --region "$AWS_REGION" \
            --image-tag-mutability MUTABLE \
            --image-scanning-configuration scanOnPush=true
        echo -e "${GREEN}✓ Created ECR repository: $repo_name${NC}"
    fi
}

create_ecr_repo "${PROJECT_NAME}-backend"
create_ecr_repo "${PROJECT_NAME}-frontend"

# Step 2: Create CloudWatch Log Groups
echo -e "${BLUE}[4/10] Creating CloudWatch Log Groups...${NC}"

create_log_group() {
    local log_group=$1
    
    if aws logs describe-log-groups --log-group-name-prefix "$log_group" --region "$AWS_REGION" 2>/dev/null | grep -q "$log_group"; then
        echo -e "${YELLOW}ℹ Log group $log_group already exists${NC}"
    else
        aws logs create-log-group \
            --log-group-name "$log_group" \
            --region "$AWS_REGION"
        aws logs put-retention-policy \
            --log-group-name "$log_group" \
            --retention-in-days 7 \
            --region "$AWS_REGION"
        echo -e "${GREEN}✓ Created log group: $log_group${NC}"
    fi
}

create_log_group "/ecs/${PROJECT_NAME}-backend"
create_log_group "/ecs/${PROJECT_NAME}-frontend"

# Step 3: Create RDS PostgreSQL Database
echo -e "${BLUE}[5/10] Creating RDS PostgreSQL instance...${NC}"

DB_INSTANCE_ID="${PROJECT_NAME}-db"
DB_NAME="system_design_simulator"

if aws rds describe-db-instances --db-instance-identifier "$DB_INSTANCE_ID" --region "$AWS_REGION" 2>/dev/null | grep -q "$DB_INSTANCE_ID"; then
    echo -e "${YELLOW}ℹ RDS instance $DB_INSTANCE_ID already exists${NC}"
else
    read -p "Enter a strong master password for RDS (min 8 chars, include special chars): " -s DB_PASSWORD
    echo ""
    
    aws rds create-db-instance \
        --db-instance-identifier "$DB_INSTANCE_ID" \
        --db-instance-class db.t3.micro \
        --engine postgres \
        --engine-version 15.4 \
        --master-username postgres \
        --master-user-password "$DB_PASSWORD" \
        --allocated-storage 20 \
        --storage-type gp3 \
        --storage-encrypted \
        --backup-retention-period 7 \
        --multi-az false \
        --publicly-accessible false \
        --enable-cloudwatch-logs-exports '["postgresql"]' \
        --region "$AWS_REGION"
    
    echo -e "${GREEN}✓ RDS instance creation initiated (this may take 10-15 minutes)${NC}"
    echo -e "${YELLOW}⏳ Waiting for RDS to be available...${NC}"
    
    aws rds wait db-instance-available \
        --db-instance-identifier "$DB_INSTANCE_ID" \
        --region "$AWS_REGION"
    
    echo -e "${GREEN}✓ RDS instance is now available${NC}"
fi

# Get RDS endpoint
RDS_ENDPOINT=$(aws rds describe-db-instances \
    --db-instance-identifier "$DB_INSTANCE_ID" \
    --region "$AWS_REGION" \
    --query 'DBInstances[0].Endpoint.Address' \
    --output text)

echo -e "${GREEN}✓ RDS Endpoint: $RDS_ENDPOINT${NC}"

# Step 4: Create ElastiCache Redis Cluster
echo -e "${BLUE}[6/10] Creating ElastiCache Redis cluster...${NC}"

REDIS_CLUSTER_ID="${PROJECT_NAME}-redis"

if aws elasticache describe-cache-clusters --cache-cluster-id "$REDIS_CLUSTER_ID" --region "$AWS_REGION" 2>/dev/null | grep -q "$REDIS_CLUSTER_ID"; then
    echo -e "${YELLOW}ℹ Redis cluster $REDIS_CLUSTER_ID already exists${NC}"
else
    aws elasticache create-cache-cluster \
        --cache-cluster-id "$REDIS_CLUSTER_ID" \
        --cache-node-type cache.t3.micro \
        --engine redis \
        --engine-version 7.0 \
        --num-cache-nodes 1 \
        --port 6379 \
        --automatic-failover-enabled \
        --at-rest-encryption-enabled \
        --region "$AWS_REGION"
    
    echo -e "${GREEN}✓ Redis cluster creation initiated${NC}"
    echo -e "${YELLOW}⏳ Waiting for Redis to be available...${NC}"
    
    aws elasticache wait cache-cluster-available \
        --cache-cluster-id "$REDIS_CLUSTER_ID" \
        --region "$AWS_REGION"
    
    echo -e "${GREEN}✓ Redis cluster is now available${NC}"
fi

# Get Redis endpoint
REDIS_ENDPOINT=$(aws elasticache describe-cache-clusters \
    --cache-cluster-id "$REDIS_CLUSTER_ID" \
    --region "$AWS_REGION" \
    --show-cache-node-info \
    --query 'CacheClusters[0].CacheNodes[0].Address' \
    --output text)

echo -e "${GREEN}✓ Redis Endpoint: $REDIS_ENDPOINT${NC}"

# Step 5: Create ECS Cluster
echo -e "${BLUE}[7/10] Creating ECS Cluster...${NC}"

CLUSTER_NAME="${PROJECT_NAME}-cluster"

if aws ecs describe-clusters --clusters "$CLUSTER_NAME" --region "$AWS_REGION" 2>/dev/null | grep -q "$CLUSTER_NAME"; then
    echo -e "${YELLOW}ℹ ECS cluster $CLUSTER_NAME already exists${NC}"
else
    aws ecs create-cluster \
        --cluster-name "$CLUSTER_NAME" \
        --capacity-providers FARGATE \
        --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1,base=1 \
        --region "$AWS_REGION"
    
    echo -e "${GREEN}✓ Created ECS cluster: $CLUSTER_NAME${NC}"
fi

# Step 6: Create IAM Role for ECS Task Execution
echo -e "${BLUE}[8/10] Creating IAM roles...${NC}"

ROLE_NAME="${PROJECT_NAME}-ecs-task-execution-role"
ASSUME_ROLE_POLICY='{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}'

if aws iam get-role --role-name "$ROLE_NAME" 2>/dev/null; then
    echo -e "${YELLOW}ℹ IAM role $ROLE_NAME already exists${NC}"
else
    aws iam create-role \
        --role-name "$ROLE_NAME" \
        --assume-role-policy-document "$ASSUME_ROLE_POLICY"
    
    aws iam attach-role-policy \
        --role-name "$ROLE_NAME" \
        --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
    
    aws iam attach-role-policy \
        --role-name "$ROLE_NAME" \
        --policy-arn arn:aws:iam::aws:policy/CloudWatchLogsFullAccess
    
    # Create inline policy for Secrets Manager access
    SECRETS_POLICY='{
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Action": [
            "secretsmanager:GetSecretValue"
          ],
          "Resource": "arn:aws:secretsmanager:'$AWS_REGION':'$AWS_ACCOUNT_ID':secret:syslab/*"
        }
      ]
    }'
    
    aws iam put-role-policy \
        --role-name "$ROLE_NAME" \
        --policy-name "${PROJECT_NAME}-secrets-policy" \
        --policy-document "$SECRETS_POLICY"
    
    echo -e "${GREEN}✓ Created IAM role: $ROLE_NAME${NC}"
fi

# Step 7: Store secrets in AWS Secrets Manager
echo -e "${BLUE}[9/10] Setting up AWS Secrets Manager...${NC}"

create_secret() {
    local secret_name=$1
    local secret_value=$2
    
    if aws secretsmanager get-secret-value --secret-id "$secret_name" --region "$AWS_REGION" 2>/dev/null | grep -q "ARN"; then
        echo -e "${YELLOW}ℹ Secret $secret_name already exists${NC}"
    else
        aws secretsmanager create-secret \
            --name "$secret_name" \
            --secret-string "$secret_value" \
            --region "$AWS_REGION"
        echo -e "${GREEN}✓ Created secret: $secret_name${NC}"
    fi
}

# Prompt for secrets
read -p "Enter JWT_SECRET (min 32 characters): " -s JWT_SECRET
echo ""
read -p "Enter JWT_REFRESH_SECRET (min 32 characters): " -s JWT_REFRESH_SECRET
echo ""

create_secret "syslab/jwt_secret" "$JWT_SECRET"
create_secret "syslab/jwt_refresh_secret" "$JWT_REFRESH_SECRET"
create_secret "syslab/db/password" "$DB_PASSWORD"

# Step 8: Output configuration file
echo -e "${BLUE}[10/10] Generating configuration files...${NC}"

CONFIG_FILE="infra/aws-deployment/aws-config.env"
cat > "$CONFIG_FILE" << EOF
# AWS Configuration - Generated on $(date)
# DO NOT commit this file to version control!

AWS_REGION=$AWS_REGION
AWS_ACCOUNT_ID=$AWS_ACCOUNT_ID

# ECR Configuration
ECR_REGISTRY=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
BACKEND_IMAGE_URI=\$ECR_REGISTRY/${PROJECT_NAME}-backend:latest
FRONTEND_IMAGE_URI=\$ECR_REGISTRY/${PROJECT_NAME}-frontend:latest

# ECS Configuration
ECS_CLUSTER_NAME=$CLUSTER_NAME
ECS_TASK_DEFINITION_FAMILY_BACKEND=${PROJECT_NAME}-backend-taskdef
ECS_TASK_DEFINITION_FAMILY_FRONTEND=${PROJECT_NAME}-frontend-taskdef

# RDS Configuration
RDS_ENDPOINT=$RDS_ENDPOINT
RDS_DB_NAME=$DB_NAME
RDS_DB_USER=postgres

# ElastiCache Configuration
REDIS_ENDPOINT=$REDIS_ENDPOINT
REDIS_PORT=6379

# CloudWatch
BACKEND_LOG_GROUP=/ecs/${PROJECT_NAME}-backend
FRONTEND_LOG_GROUP=/ecs/${PROJECT_NAME}-frontend

# IAM
ECS_TASK_EXECUTION_ROLE_ARN=arn:aws:iam::$AWS_ACCOUNT_ID:role/$ROLE_NAME

# Secrets Manager
JWT_SECRET_ARN=arn:aws:secretsmanager:$AWS_REGION:$AWS_ACCOUNT_ID:secret:syslab/jwt_secret
JWT_REFRESH_SECRET_ARN=arn:aws:secretsmanager:$AWS_REGION:$AWS_ACCOUNT_ID:secret:syslab/jwt_refresh_secret
DB_PASSWORD_ARN=arn:aws:secretsmanager:$AWS_REGION:$AWS_ACCOUNT_ID:secret:syslab/db/password
EOF

echo -e "${GREEN}✓ Configuration saved to: $CONFIG_FILE${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ AWS Infrastructure Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Configure GitHub Actions secrets:"
echo "   - AWS_ACCOUNT_ID: $AWS_ACCOUNT_ID"
echo "   - AWS_ACCESS_KEY_ID: [Your IAM user access key]"
echo "   - AWS_SECRET_ACCESS_KEY: [Your IAM user secret key]"
echo "   - ALB_DNS_NAME: [Get from AWS EC2 Load Balancers console]"
echo "   - VITE_API_URL: https://[ALB_DNS_NAME]/api/v1"
echo "   - VITE_WS_URL: https://[ALB_DNS_NAME]"
echo ""
echo "2. Register RDS security group to allow ECS tasks"
echo "3. Register ElastiCache security group to allow ECS tasks"
echo "4. Create ALB and target groups (see infra/aws-deployment/ALB_SETUP.md)"
echo "5. Register ECS task definitions (see infra/aws-deployment/ecs-task-definitions/)"
echo "6. Create ECS services and connect to ALB"
echo ""
echo -e "${BLUE}Important Configuration Files:${NC}"
echo "  - $CONFIG_FILE (generated configuration)"
echo "  - infra/aws-deployment/ecs-task-definitions/backend-task-def.json"
echo "  - infra/aws-deployment/ecs-task-definitions/frontend-task-def.json"
echo "  - .env.prod.template (environment variables)"
echo ""
