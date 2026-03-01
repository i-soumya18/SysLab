# AWS Deployment Guide for SysLab

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Step-by-Step Deployment](#step-by-step-deployment)
4. [Networking & Security Setup](#networking--security-setup)
5. [GitHub Actions CI/CD Setup](#github-actions-cicd-setup)
6. [Monitoring & Logging](#monitoring--logging)
7. [Troubleshooting](#troubleshooting)
8. [Post-Deployment Validation](#post-deployment-validation)

---

## Prerequisites

### Required Tools

- AWS CLI v2 with configured credentials
- jq (JSON query tool)
- Docker & Docker Compose (for local testing)
- Git with GitHub CLI (optional)
- curl or Postman (for API testing)

### AWS Account Setup

1. **Create AWS Account** if you don't have one
2. **Create an IAM User** with the following permissions:
   - ECS (full access)
   - ECR (full access)
   - RDS (full access)
   - ElastiCache (full access)
   - IAM (limited: create roles, attach policies)
   - CloudWatch (full access)
   - SecretsManager (full access)
   - EC2 (for ALB, security groups, VPC)
   - ApplicationAutoScaling (for ECS auto-scaling)

3. **Generate Access Keys** for the IAM user
4. **Configure AWS CLI**:
   ```bash
   aws configure
   # or: aws configure --profile syslab
   # Enter: Access Key ID, Secret Access Key, Region (e.g., us-east-1), Output format (json)
   ```

### Verify Setup

```bash
# Check AWS CLI is configured
aws sts get-caller-identity

# Expected output:
# {
#   "UserId": "AIDAI...",
#   "Account": "123456789012",
#   "Arn": "arn:aws:iam::123456789012:user/your-username"
# }
```

---

## Architecture Overview

### AWS Services Used

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Browsers                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │  AWS Certificate Manager (ACM) │ (HTTPS/SSL)
        └────────────────┬───────────────┘
                         │
                         ▼
        ┌─────────────────────────────────────┐
        │   Application Load Balancer (ALB)   │ Port 80/443
        │   - Health checks                   │
        │   - Path-based routing              │
        │   - Sticky sessions (Socket.IO)     │
        └────────┬─────────────────────────────┘
                 │
        ┌────────┴──────────┐
        │                   │
        ▼                   ▼
   ┌────────────┐    ┌────────────────┐
   │  Frontend  │    │  Backend       │
   │  Tasks     │    │  Tasks (2)     │
   │  (ECS)     │    │  (ECS Fargate) │
   └────┬───────┘    └────┬───────────┘
        │                 │
        │                 │
        │       ┌─────────┼──────────┐
        │       │         │          │
        │       ▼         ▼          ▼
        │   ┌───────┐ ┌──────┐  ┌──────────┐
        │   │  RDS  │ │Redis │  │CloudWatch│
        │   │  DB   │ │Cache │  │  Logs    │
        │   └───────┘ └──────┘  └──────────┘
        │
        └─────► CloudWatch Logs & Metrics
```

### Service Breakdown

| Service | Type | Instance Type | Purpose |
|---------|------|---------------|---------|
| **ALB** | Network | - | Reverse proxy, SSL/TLS, load balancing |
| **Backend** | ECS Fargate | 256 CPU, 512 MB RAM | Node.js API, 2 tasks for resilience |
| **Frontend** | ECS Fargate | 128 CPU, 256 MB RAM | React SPA via Nginx |
| **RDS PostgreSQL** | Managed DB | db.t3.micro | User data, simulation records, subscriptions |
| **ElastiCache Redis** | Managed Cache | cache.t3.micro | Session management, real-time state |
| **CloudWatch** | Logging | 7-day retention | Application & infrastructure logs |

---

## Step-by-Step Deployment

### Phase 1: Run Automated Infrastructure Setup

```bash
cd /path/to/SysLab

# Make the setup script executable
chmod +x aws-deployment/setup-infrastructure.sh

# Run the setup script
bash aws-deployment/setup-infrastructure.sh
```

**What This Does:**
- ✓ Creates ECR repositories
- ✓ Creates CloudWatch log groups
- ✓ Creates RDS PostgreSQL instance
- ✓ Creates ElastiCache Redis cluster
- ✓ Creates ECS cluster
- ✓ Creates IAM roles
- ✓ Stores secrets in Secrets Manager
- ✓ Generates `aws-deployment/aws-config.env`

**Wait Time:** 15-20 minutes (mostly RDS and Redis setup)

### Phase 2: Create Application Load Balancer (ALB)

The setup script creates the infrastructure, but you need to manually create the ALB and connect it to your ECS services.

#### 2.1: Create ALB

```bash
# Set variables
ALB_NAME="syslab-alb"
ALB_SUBNET_1="subnet-xxxxx"  # Public subnet 1
ALB_SUBNET_2="subnet-yyyyy"  # Public subnet 2 (optional for HA)
ALB_SECURITY_GROUP="sg-xxxxx" # Allow inbound 80/443

# Create ALB using AWS CLI
aws elbv2 create-load-balancer \
    --name "$ALB_NAME" \
    --subnets "$ALB_SUBNET_1" "$ALB_SUBNET_2" \
    --security-groups "$ALB_SECURITY_GROUP" \
    --scheme internet-facing \
    --type application \
    --ip-address-type ipv4 \
    --region us-east-1
```

Or use AWS Console:
1. Go to EC2 → Load Balancers
2. Click "Create Load Balancer" → Application Load Balancer
3. Configure:
   - Name: `syslab-alb`
   - Scheme: Internet-facing
   - IP address type: IPv4
   - VPC: Select your VPC
   - Availability Zones: Select 2 public subnets
4. Security Group: Allow inbound 80, 443 from `0.0.0.0/0`
5. Listener: HTTP:80, HTTPS:443 (with ACM certificate)
6. Click "Create"

#### 2.2: Create Target Groups

```bash
# Backend Target Group
aws elbv2 create-target-group \
    --name syslab-backend-tg \
    --protocol HTTP \
    --port 3000 \
    --vpc-id vpc-xxxxx \
    --health-check-protocol HTTP \
    --health-check-path /health \
    --health-check-interval-seconds 15 \
    --health-check-timeout-seconds 5 \
    --healthy-threshold-count 3 \
    --unhealthy-threshold-count 3 \
    --matcher HttpCode=200 \
    --target-type ip \
    --region us-east-1

# Frontend Target Group
aws elbv2 create-target-group \
    --name syslab-frontend-tg \
    --protocol HTTP \
    --port 80 \
    --vpc-id vpc-xxxxx \
    --health-check-protocol HTTP \
    --health-check-path / \
    --health-check-interval-seconds 15 \
    --health-check-timeout-seconds 5 \
    --healthy-threshold-count 2 \
    --unhealthy-threshold-count 2 \
    --matcher HttpCode=200 \
    --target-type ip \
    --region us-east-1
```

#### 2.3: Configure ALB Listener Rules

1. Go to EC2 → Load Balancers → `syslab-alb`
2. Listeners → Edit rules
3. Add rules:
   - **Rule 1**: Path `/api/*` → Forward to `syslab-backend-tg` (sticky sessions enabled)
   - **Rule 2**: Path `/socket.io/*` → Forward to `syslab-backend-tg`
   - **Rule 3**: Default → Forward to `syslab-frontend-tg`

**Enable Sticky Sessions for Backend:**
1. Select `syslab-backend-tg`
2. Attributes → Stickiness: Enable with duration 86400 (required for Socket.IO)

#### 2.4: Register ACM Certificate

1. AWS Certificate Manager → Request certificate
2. Domain: `your-domain.com` (e.g., `syslab.yourdomain.com`)
3. Validation: DNS or Email
4. Once issued, attach to ALB HTTPS listener (port 443)

### Phase 3: Push Docker Images to ECR

```bash
# Load AWS config
source aws-deployment/aws-config.env

# Log in to ECR
aws ecr get-login-password --region $AWS_REGION | \
    docker login --username AWS --password-stdin $ECR_REGISTRY

# Build and push Backend
cd backend
docker build -t $BACKEND_IMAGE_URI .
docker push $BACKEND_IMAGE_URI
cd ..

# Build and push Frontend (with build args)
cd frontend
docker build \
    --build-arg VITE_API_URL=https://your-domain.com/api/v1 \
    --build-arg VITE_WS_URL=https://your-domain.com \
    --build-arg VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    --build-arg VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN \
    --build-arg VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID \
    -t $FRONTEND_IMAGE_URI .
docker push $FRONTEND_IMAGE_URI
cd ..
```

Verify images in ECR Console or CLI:
```bash
aws ecr describe-images --repository-name ${PROJECT_NAME}-backend --region $AWS_REGION
aws ecr describe-images --repository-name ${PROJECT_NAME}-frontend --region $AWS_REGION
```

### Phase 4: Register ECS Task Definitions

```bash
# Update task definition templates with actual values
# Edit: aws-deployment/ecs-task-definitions/backend-task-def.json
# Replace:
#   - ACCOUNT_ID with $AWS_ACCOUNT_ID
#   - REGION with $AWS_REGION
#   - RDS_ENDPOINT_HERE with RDS endpoint from aws-config.env
#   - ELASTICACHE_ENDPOINT_HERE with Redis endpoint

# Register Backend Task Definition
aws ecs register-task-definition \
    --cli-input-json file://aws-deployment/ecs-task-definitions/backend-task-def.json \
    --region $AWS_REGION

# Register Frontend Task Definition
aws ecs register-task-definition \
    --cli-input-json file://aws-deployment/ecs-task-definitions/frontend-task-def.json \
    --region $AWS_REGION
```

### Phase 5: Create RDS Database and Schema

```bash
# Get RDS password from Secrets Manager
DB_PASSWORD=$(aws secretsmanager get-secret-value \
    --secret-id syslab/db/password \
    --region $AWS_REGION \
    --query SecretString \
    --output text)

# Get RDS endpoint
RDS_ENDPOINT=$(aws rds describe-db-instances \
    --db-instance-identifier syslab-db \
    --region $AWS_REGION \
    --query 'DBInstances[0].Endpoint.Address' \
    --output text)

# Wait for RDS to be accessible (may need to wait a few minutes)
echo "Waiting for RDS to be accessible..."
sleep 30

# Connect to RDS and initialize database
PGPASSWORD="$DB_PASSWORD" psql \
    -h "$RDS_ENDPOINT" \
    -U postgres \
    -c "CREATE DATABASE system_design_simulator;"

# Run init script
PGPASSWORD="$DB_PASSWORD" psql \
    -h "$RDS_ENDPOINT" \
    -U postgres \
    -d system_design_simulator \
    -f database/init.sql

# Run migrations
PGPASSWORD="$DB_PASSWORD" psql \
    -h "$RDS_ENDPOINT" \
    -U postgres \
    -d system_design_simulator \
    -f database/migrations/004_user_isolation_tables.sql

echo "✓ Database initialized successfully"
```

### Phase 6: Create ECS Services

```bash
# Get ALB details
ALB_ARN=$(aws elbv2 describe-load-balancers \
    --names syslab-alb \
    --query 'LoadBalancers[0].LoadBalancerArn' \
    --output text \
    --region $AWS_REGION)

BACKEND_TG_ARN=$(aws elbv2 describe-target-groups \
    --names syslab-backend-tg \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text \
    --region $AWS_REGION)

FRONTEND_TG_ARN=$(aws elbv2 describe-target-groups \
    --names syslab-frontend-tg \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text \
    --region $AWS_REGION)

# Get ECS task execution role
TASK_EXECUTION_ROLE=$(aws iam get-role \
    --role-name syslab-ecs-task-execution-role \
    --query 'Role.Arn' \
    --output text)

# Create Backend Service
aws ecs create-service \
    --cluster syslab-cluster \
    --service-name syslab-backend-service \
    --task-definition syslab-backend-taskdef:1 \
    --desired-count 2 \
    --launch-type FARGATE \
    --load-balancers targetGroupArn=$BACKEND_TG_ARN,containerName=syslab-backend,containerPort=3000 \
    --network-configuration "awsvpcConfiguration={subnets=[subnet-xxxxx,subnet-yyyyy],securityGroups=[sg-backend],assignPublicIp=DISABLED}" \
    --deployment-configuration maximumPercent=200,minimumHealthyPercent=100 \
    --region $AWS_REGION

# Create Frontend Service
aws ecs create-service \
    --cluster syslab-cluster \
    --service-name syslab-frontend-service \
    --task-definition syslab-frontend-taskdef:1 \
    --desired-count 1 \
    --launch-type FARGATE \
    --load-balancers targetGroupArn=$FRONTEND_TG_ARN,containerName=syslab-frontend,containerPort=80 \
    --network-configuration "awsvpcConfiguration={subnets=[subnet-xxxxx,subnet-yyyyy],securityGroups=[sg-frontend],assignPublicIp=DISABLED}" \
    --deployment-configuration maximumPercent=200,minimumHealthyPercent=100 \
    --region $AWS_REGION
```

### Phase 7: Configure GitHub Actions Secrets

Go to GitHub → Settings → Secrets and variables → Actions → New repository secret

Add the following secrets:

| Secret Name | Value | Where to Get |
|-------------|-------|--------------|
| `AWS_ACCOUNT_ID` | Your AWS account ID | AWS Console → Account settings |
| `AWS_ACCESS_KEY_ID` | IAM user access key | IAM Console → Users → Security credentials |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key | IAM Console → Users → Security credentials |
| `ALB_DNS_NAME` | Load Balancer DNS | AWS Console → EC2 → Load Balancers |
| `VITE_API_URL` | `https://[ALB_DNS]/api/v1` | Construct from ALB DNS |
| `VITE_WS_URL` | `https://[ALB_DNS]` | Construct from ALB DNS |
| `VITE_FIREBASE_API_KEY` | Your Firebase API key | Firebase Console |
| `VITE_FIREBASE_AUTH_DOMAIN` | Your Firebase auth domain | Firebase Console |
| `VITE_FIREBASE_PROJECT_ID` | Your Firebase project ID | Firebase Console |

---

## Networking & Security Setup

### VPC Configuration

Required subnets:
- **Public subnets (2):** For ALB endpoints
- **Private subnets (2):** For ECS tasks (optional, recommended for production)

### Security Groups

#### 1. ALB Security Group

```bash
aws ec2 create-security-group \
    --group-name syslab-alb-sg \
    --description "Security group for SysLab ALB" \
    --vpc-id vpc-xxxxx

# Allow inbound HTTP/HTTPS
aws ec2 authorize-security-group-ingress \
    --group-id sg-xxxxx \
    --protocol tcp \
    --port 80 \
    --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
    --group-id sg-xxxxx \
    --protocol tcp \
    --port 443 \
    --cidr 0.0.0.0/0
```

#### 2. Backend ECS Security Group

```bash
aws ec2 create-security-group \
    --group-name syslab-backend-sg \
    --description "Security group for SysLab Backend" \
    --vpc-id vpc-xxxxx

# Allow inbound from ALB on port 3000
aws ec2 authorize-security-group-ingress \
    --group-id sg-backend \
    --protocol tcp \
    --port 3000 \
    --source-security-group-id sg-alb
```

#### 3. Frontend ECS Security Group

```bash
aws ec2 create-security-group \
    --group-name syslab-frontend-sg \
    --description "Security group for SysLab Frontend" \
    --vpc-id vpc-xxxxx

# Allow inbound from ALB on port 80
aws ec2 authorize-security-group-ingress \
    --group-id sg-frontend \
    --protocol tcp \
    --port 80 \
    --source-security-group-id sg-alb
```

#### 4. RDS Security Group

```bash
aws ec2 create-security-group \
    --group-name syslab-rds-sg \
    --description "Security group for SysLab RDS" \
    --vpc-id vpc-xxxxx

# Allow inbound from Backend on port 5432
aws ec2 authorize-security-group-ingress \
    --group-id sg-rds \
    --protocol tcp \
    --port 5432 \
    --source-security-group-id sg-backend
```

#### 5. ElastiCache Security Group

```bash
aws ec2 create-security-group \
    --group-name syslab-redis-sg \
    --description "Security group for SysLab Redis" \
    --vpc-id vpc-xxxxx

# Allow inbound from Backend on port 6379
aws ec2 authorize-security-group-ingress \
    --group-id sg-redis \
    --protocol tcp \
    --port 6379 \
    --source-security-group-id sg-backend
```

### Route 53 DNS (Optional)

```bash
# Create Route 53 hosted zone or use existing one
HOSTED_ZONE_ID="Zxxxxxxxxxxxxx"

# Get ALB DNS
ALB_DNS=$(aws elbv2 describe-load-balancers \
    --names syslab-alb \
    --query 'LoadBalancers[0].DNSName' \
    --output text)

# Create A record
aws route53 change-resource-record-sets \
    --hosted-zone-id $HOSTED_ZONE_ID \
    --change-batch '{
      "Changes": [{
        "Action": "CREATE",
        "ResourceRecordSet": {
          "Name": "syslab.yourdomain.com",
          "Type": "A",
          "AliasTarget": {
            "HostedZoneId": "Z35SXDOTRQ7X7K",
            "DNSName": "'$ALB_DNS'",
            "EvaluateTargetHealth": false
          }
        }
      }]
    }'
```

---

## GitHub Actions CI/CD Setup

The workflow file (`.github/workflows/deploy-aws.yml`) is already created. Here's how it works:

### Workflow Trigger

```yaml
on:
  push:
    branches:
      - soumya
  workflow_dispatch:  # Manual trigger
```

### Workflow Steps

1. **Build Images**: 
   - Builds Backend and Frontend Docker images
   - Pushes to ECR with tags: `latest` and git SHA
   
2. **Deploy Backend**:
   - Gets current task definition
   - Updates image URI
   - Deploys to ECS service
   - Waits for stabilization

3. **Deploy Frontend**:
   - Same as backend

4. **Smoke Tests**:
   - Tests `/api/health` endpoint
   - Tests frontend homepage loads

### Manual Deployment

Push to `soumya` branch:
```bash
git add .
git commit -m "Update: deployment changes"
git push origin soumya
```

Monitor deployment:
1. Go to GitHub → Actions
2. Select the workflow run
3. View logs in real-time

---

## Monitoring & Logging

### CloudWatch Dashboard

Create dashboard at CloudWatch Console:

```bash
aws cloudwatch put-dashboard \
    --dashboard-name syslab-dashboard \
    --dashboard-body file://aws-deployment/monitoring/dashboard.json
```

Dashboard metrics:
- ECS task CPU/Memory
- ALB request count/latency
- RDS CPU/connections
- ElastiCache memory/cache hits
- Error rates (5xx responses)

### CloudWatch Alarms

```bash
# High Backend CPU
aws cloudwatch put-metric-alarm \
    --alarm-name syslab-backend-high-cpu \
    --alarm-description "Alert when backend CPU > 80%" \
    --metric-name CPUUtilization \
    --namespace AWS/ECS \
    --statistic Average \
    --period 300 \
    --threshold 80 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 2 \
    --alarm-actions arn:aws:sns:us-east-1:ACCOUNT_ID:syslab-alerts

# RDS High Connections
aws cloudwatch put-metric-alarm \
    --alarm-name syslab-rds-high-connections \
    --alarm-description "Alert when RDS connections > 15" \
    --metric-name DatabaseConnections \
    --namespace AWS/RDS \
    --statistic Average \
    --period 300 \
    --threshold 15 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 2 \
    --alarm-actions arn:aws:sns:us-east-1:ACCOUNT_ID:syslab-alerts
```

### Viewing Logs

```bash
# Tail Backend logs
aws logs tail /ecs/syslab-backend --follow

# Tail Frontend logs
aws logs tail /ecs/syslab-frontend --follow

# Query for errors
aws logs filter-log-events \
    --log-group-name /ecs/syslab-backend \
    --filter-pattern "ERROR"
```

### Application Metrics

Backend exposes Prometheus metrics at `/metrics` endpoint. Query via CloudWatch Metrics:

```bash
# Get backend request count
aws cloudwatch get-metric-statistics \
    --namespace CustomMetrics \
    --metric-name RequestCount \
    --start-time 2024-02-26T00:00:00Z \
    --end-time 2024-02-26T23:59:59Z \
    --period 3600 \
    --statistics Sum
```

---

## Troubleshooting

### Services Not Starting

```bash
# Check ECS cluster status
aws ecs describe-services \
    --cluster syslab-cluster \
    --services syslab-backend-service \
    --region us-east-1

# Check task definition
aws ecs describe-task-definition \
    --task-definition syslab-backend-taskdef \
    --region us-east-1

# View task logs
aws logs tail /ecs/syslab-backend --follow
```

### RDS Connection Issues

```bash
# Test RDS connectivity
psql -h ENDPOINT -U postgres -d system_design_simulator

# Check RDS security group
aws ec2 describe-security-groups \
    --group-ids sg-xxxxx \
    --region us-east-1

# Check RDS status
aws rds describe-db-instances \
    --db-instance-identifier syslab-db \
    --region us-east-1
```

### Redis Connection Issues

```bash
# Connect to Redis
redis-cli -h ENDPOINT -p 6379 ping

# Check ElastiCache status
aws elasticache describe-cache-clusters \
    --cache-cluster-id syslab-redis \
    --show-cache-node-info \
    --region us-east-1
```

### Load Balancer Issues

```bash
# Check target health
aws elbv2 describe-target-health \
    --target-group-arn arn:aws:elasticloadbalancing:... \
    --region us-east-1

# View ALB logs (enable in target group attributes)
aws s3 ls s3://syslab-alb-logs/
```

### Image Pull Errors

```bash
# Verify task execution role has ECR permissions
aws iam get-role \
    --role-name syslab-ecs-task-execution-role

# Verify image exists in ECR
aws ecr describe-images \
    --repository-name syslab-backend \
    --region us-east-1
```

---

## Post-Deployment Validation

### 1. Health Checks

```bash
# Backend health
curl https://syslab.yourdomain.com/api/health

# Frontend
curl -I https://syslab.yourdomain.com/

# Expected responses:
# Backend: {"status":"ok"}
# Frontend: HTTP 200 (with HTML content)
```

### 2. Database Connectivity

```bash
# Verify users table exists
PGPASSWORD="$PASSWORD" psql \
    -h "$RDS_ENDPOINT" \
    -U postgres \
    -d system_design_simulator \
    -c "\dt"

# Should show tables: users, user_sessions, user_subscriptions, etc.
```

### 3. Redis Connectivity

```bash
# Verify Redis is accessible
redis-cli -h "$REDIS_ENDPOINT" -p 6379 PING

# Expected response: PONG
```

### 4. ECS Task Status

```bash
# List running tasks
aws ecs list-tasks \
    --cluster syslab-cluster \
    --service-name syslab-backend-service \
    --region us-east-1

# Should show 2 running tasks (desired count)
```

### 5. Application Testing

1. **Sign up/Login**: Register new user and login
2. **Create Simulation**: Create a system design and run simulation
3. **Real-time Features**: Test Socket.IO connections and real-time updates
4. **Data Persistence**: Verify data is saved in RDS
5. **Session Management**: Verify JWT tokens work and Redis caching works

### 6. Monitoring

```bash
# Check CloudWatch metrics
aws cloudwatch get-metric-statistics \
    --namespace AWS/ECS \
    --metric-name CPUUtilization \
    --dimensions Name=ServiceName,Value=syslab-backend-service Name=ClusterName,Value=syslab-cluster \
    --start-time 2024-02-26T00:00:00Z \
    --end-time 2024-02-26T23:59:59Z \
    --period 300 \
    --statistics Average
```

---

## Cost Estimation (Monthly)

| Service | Instance Type | Monthly Cost | Notes |
|---------|---------------|--------------|-------|
| **ECS Fargate** | 256CPU, 512MB × 3 tasks | ~$25 | Backend (2) + Frontend (1) |
| **RDS** | db.t3.micro | ~$15 | Single-AZ, gp3 storage |
| **ElastiCache** | cache.t3.micro | ~$20 | Single-AZ |
| **ALB** | 1 Load Balancer | ~$20 | Fixed cost |
| **Data Transfer** | - | Variable | ~$5-20 depending on usage |
| **CloudWatch** | Logs & Metrics | ~$5 | 7-day retention |
| **TOTAL** | - | **~$90-120/month** | For single-AZ MVP |

**Cost optimization tips:**
- Use Fargate Spot for non-critical workloads (-50% cost)
- Use RDS Reserved Instances for 1-3 year commitment (-40% cost)
- Use CloudFront CDN for static assets (reduce data transfer)
- Implement auto-scaling to match demand

---

## Next Steps

1. ✅ Run AWS infrastructure setup script
2. ✅ Create ALB and target groups
3. ✅ Push Docker images to ECR
4. ✅ Register ECS task definitions
5. ✅ Initialize RDS database
6. ✅ Create ECS services
7. ✅ Configure GitHub Actions secrets
8. ✅ Test deployment
9. **In Progress:** Scale to multi-AZ
10. **In Progress:** Implement auto-scaling policies
11. **In Progress:** Set up CloudFront CDN
12. **In Progress:** Enable cross-region backup

---

For detailed AWS documentation, see:
- [ECS Getting Started](https://docs.aws.amazon.com/ecs/latest/developerguide/getting-started.html)
- [RDS Documentation](https://docs.aws.amazon.com/rds/)
- [ElastiCache Documentation](https://docs.aws.amazon.com/elasticache/)
- [ALB Documentation](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/)
