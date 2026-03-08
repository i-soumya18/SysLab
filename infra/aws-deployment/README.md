# AWS Deployment Module

This directory contains all scripts, configurations, and documentation for deploying SysLab to AWS.

## 📋 Contents

### Documentation

- **[AWS_DEPLOYMENT_GUIDE.md](AWS_DEPLOYMENT_GUIDE.md)** - Complete step-by-step deployment guide with prerequisites, architecture overview, and detailed instructions for each phase
- **[GITHUB_ACTIONS_SETUP.md](GITHUB_ACTIONS_SETUP.md)** - GitHub Actions CI/CD pipeline configuration and troubleshooting
- **[GITHUB_ACTIONS_EC2_SETUP.md](GITHUB_ACTIONS_EC2_SETUP.md)** - GitHub Actions CI/CD setup for EC2-based deployment
- **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Quick reference guide with common commands, deployment checklist, and troubleshooting tips

### Scripts

- **[setup-infrastructure.sh](setup-infrastructure.sh)** - Automated AWS infrastructure setup (ECR, RDS, ElastiCache, ECS, CloudWatch, IAM)
- **[init-database.sh](init-database.sh)** - Database initialization script for RDS PostgreSQL
- **[ecs-helper.sh](ecs-helper.sh)** - Helper utility for managing ECS services, tasks, and deployments
- **[deploy-ec2-remote.sh](deploy-ec2-remote.sh)** - Remote deploy script executed by GitHub Actions on EC2

### Configuration

- **[aws-config.env](aws-config.env)** - Generated configuration file (created by setup script, contains endpoints and ARNs)

### Task Definitions

- **[ecs-task-definitions/backend-task-def.json](ecs-task-definitions/backend-task-def.json)** - Backend ECS Fargate task definition
- **[ecs-task-definitions/frontend-task-def.json](ecs-task-definitions/frontend-task-def.json)** - Frontend ECS Fargate task definition

### Environment References

- **[../.env.prod.template](../.env.prod.template)** - Production environment variables template

---

## 🚀 Quick Start

### Prerequisites

```bash
# Check AWS CLI is installed and configured
aws sts get-caller-identity

# Output should show your AWS account details
# If not installed: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
```

### Deployment in 5 Steps

```bash
# 1. Run automated setup (takes ~20 minutes)
bash infra/aws-deployment/setup-infrastructure.sh

# 2. Load configuration
source infra/aws-deployment/aws-config.env

# 3. Create networking (ALB, target groups, security groups)
# Follow: infra/aws-deployment/AWS_DEPLOYMENT_GUIDE.md#networking--security-setup

# 4. Push Docker images to ECR
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY
docker build -t $BACKEND_IMAGE_URI ./backend && docker push $BACKEND_IMAGE_URI
docker build -t $FRONTEND_IMAGE_URI ./frontend && docker push $FRONTEND_IMAGE_URI

# 5. Initialize database and deploy services
bash infra/aws-deployment/init-database.sh
# Then create ECS services (see AWS_DEPLOYMENT_GUIDE.md#phase-6-create-ecs-services)
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     AWS Cloud                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────────────────────────────────┐     │
│  │      Application Load Balancer (ALB)         │     │
│  │  - SSL/TLS termination (ACM certificate)     │     │
│  │  - Path-based routing                        │     │
│  │  - Health checks                             │     │
│  └────────┬─────────────────────────────────────┘     │
│           │                                            │
│  ┌────────┴──────────────┐                            │
│  │                       │                            │
│  ▼                       ▼                            │
│  Frontend               Backend                       │
│  (ECS Fargate)         (ECS Fargate × 2)             │
│  - React SPA            - Node.js API                │
│  - Nginx                - Express.js                 │
│  - Port 80              - Port 3000                  │
│                          - Socket.IO                  │
│  │                       │                            │
│  └───────────┬───────────┘                           │
│              │                                        │
│              ▼                                        │
│    ┌────────────────────────┐                       │
│    │   Data Layer           │                       │
│    ├────────────────────────┤                       │
│    │ PostgreSQL 15 (RDS)    │                       │
│    │ Redis 7 (ElastiCache)  │                       │
│    └────────────────────────┘                       │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │  Monitoring & Logging                      │    │
│  │  - CloudWatch Logs (7-day retention)       │    │
│  │  - CloudWatch Metrics & Alarms             │    │
│  │  - CloudWatch Dashboards                   │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## 📝 File Descriptions

### setup-infrastructure.sh

Automated script that provisions:
- **ECR Repositories** - syslab-backend, syslab-frontend
- **CloudWatch Log Groups** - /ecs/syslab-backend, /ecs/syslab-frontend
- **RDS PostgreSQL 15** - db.t3.micro, single-AZ, encrypted, automated backups
- **ElastiCache Redis 7** - cache.t3.micro, single-AZ, encrypted
- **ECS Cluster** - Fargate capacity provider
- **IAM Roles** - ECS task execution role with Secrets Manager access
- **AWS Secrets Manager** - JWT secret, JWT refresh secret, DB password

**Output:**
- `infra/aws-deployment/aws-config.env` - Configuration file with endpoints and ARNs
- CloudWatch logs group
- Secrets stored in Secrets Manager

**Time:** ~20 minutes (mostly waiting for RDS and Redis to initialize)

### init-database.sh

Initializes PostgreSQL database:
1. Tests RDS connectivity
2. Creates `system_design_simulator` database
3. Runs `infra/database/init.sql` - Creates extensions and functions
4. Runs `infra/database/migrations/004_user_isolation_tables.sql` - Creates schema
5. Verifies schema creation

**Requirements:**
- `aws-config.env` exists (from setup-infrastructure.sh)
- PostgreSQL client tools (`psql`) installed
- AWS credentials configured
- RDS instance is accessible

**Time:** ~2 minutes

### ecs-helper.sh

Utility commands for ECS management:

```bash
# View running tasks
bash ecs-helper.sh tasks

# View service status
bash ecs-helper.sh services

# View logs
bash ecs-helper.sh logs backend
bash ecs-helper.sh logs frontend

# Restart a service
bash ecs-helper.sh restart backend

# Scale service
bash ecs-helper.sh scale backend 3
bash ecs-helper.sh scale frontend 2

# Health check
bash ecs-helper.sh health <alb_dns>

# Deploy new image
bash ecs-helper.sh deploy backend 123456789012.dkr.ecr.us-east-1.amazonaws.com/syslab-backend:v1.0.0
```

---

## 🔒 Security Considerations

### IAM Permissions
The setup script creates an IAM role with:
- ECS task definition registration and service management
- ECR access for pulling images
- Secrets Manager access for retrieving credentials
- CloudWatch Logs access for sending logs

### Secrets Management
Sensitive values stored in AWS Secrets Manager:
- `syslab/db/password` - RDS master password
- `syslab/jwt_secret` - JWT signing key
- `syslab/jwt_refresh_secret` - JWT refresh key

Access via:
```bash
aws secretsmanager get-secret-value --secret-id syslab/jwt_secret
```

### Network Security
- **ALB Security Group**: Allow inbound 80/443 from 0.0.0.0/0
- **ECS Security Groups**: Allow inbound from ALB only
- **RDS Security Group**: Allow inbound from ECS tasks only
- **ElastiCache Security Group**: Allow inbound from ECS tasks only

### Encryption
- RDS: Encrypted at rest (AWS KMS)
- ElastiCache: Encrypted at rest (AWS KMS)
- ECS images: Scanned for vulnerabilities
- Secrets: Encrypted by AWS Secrets Manager

---

## 💰 Cost Estimation (Monthly, Single-AZ)

| Service | Instance | Cost |
|---------|----------|------|
| ECS Fargate | 256 CPU, 512 MB × 3 | $25 |
| RDS PostgreSQL | db.t3.micro + 20 GB gp3 | $15 |
| ElastiCache Redis | cache.t3.micro | $20 |
| ALB | 1 Load Balancer | $20 |
| CloudWatch | Logs (7-day retention) | $5 |
| Data Transfer | Estimate | $10 |
| **TOTAL** | | **$95/month** |

**Cost Optimization Tips:**
- Use Fargate Spot for non-critical workloads (-50%)
- Use RDS Reserved Instances for 1-3 year commitment (-40%)
- Use CloudFront CDN for static assets (reduce data transfer)
- Monitor with AWS Billing alerts

---

## 📊 Monitoring & Alerts

### CloudWatch Dashboard
View metrics for:
- ECS task CPU/memory
- ALB request count and latency
- RDS CPU and database connections
- ElastiCache memory and cache hits

### CloudWatch Alarms (Recommended)
- High backend CPU (>80%)
- RDS high connections (>15)
- ALB 5xx errors (>5% of requests)
- ECS task unhealthy

### CloudWatch Logs
Query and analyze logs:
```bash
# View recent logs
aws logs tail /ecs/syslab-backend --follow

# Search for errors
aws logs filter-log-events \
    --log-group-name /ecs/syslab-backend \
    --filter-pattern "ERROR"
```

---

## 🔧 Troubleshooting

### Service Won't Start
```bash
# Check task definition
aws ecs describe-task-definition --task-definition syslab-backend-taskdef

# View service details
aws ecs describe-services --cluster syslab-cluster --services syslab-backend-service

# Check logs
aws logs tail /ecs/syslab-backend --follow
```

### Database Connection Issues
```bash
# Verify RDS endpoint
psql -h $RDS_ENDPOINT -U postgres -c "SELECT 1;"

# Check security group
aws ec2 describe-security-groups --group-ids sg-xxxxx
```

### Image Pull Failures
```bash
# Verify image exists in ECR
aws ecr describe-images --repository-name syslab-backend

# Check ECR push completed successfully
aws ecr list-images --repository-name syslab-backend --region us-east-1
```

### ALB Not Routing Traffic
```bash
# Check target health
aws elbv2 describe-target-health --target-group-arn arn:aws:...

# View ALB logs (enable in target group attributes)
aws s3 ls s3://syslab-alb-logs/
```

See [AWS_DEPLOYMENT_GUIDE.md#troubleshooting](AWS_DEPLOYMENT_GUIDE.md#troubleshooting) for detailed troubleshooting steps.

---

## 📚 Related Documentation

- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [AWS RDS Documentation](https://docs.aws.amazon.com/rds/)
- [AWS ElastiCache Documentation](https://docs.aws.amazon.com/elasticache/)
- [AWS ALB Documentation](https://docs.aws.amazon.com/elasticloadbalancing/)
- [AWS ECR Documentation](https://docs.aws.amazon.com/ecr/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

---

## 📞 Support

For deployment issues:
1. Check [QUICK_REFERENCE.md](QUICK_REFERENCE.md) for common commands
2. Review [AWS_DEPLOYMENT_GUIDE.md](AWS_DEPLOYMENT_GUIDE.md) for detailed steps
3. Check CloudWatch Logs for error messages
4. Verify security group rules and network connectivity
5. Check GitHub Actions workflow logs for CI/CD pipeline issues

---

## 🎯 Next Steps After Deployment

1. **Test Application**
   - Access frontend at ALB DNS
   - Sign up and create a simulation
   - Verify real-time features (Socket.IO)

2. **Configure Production Settings**
   - Set custom domain with Route 53
   - Enable HTTPS with ACM certificate
   - Configure CloudFront CDN for static assets

3. **Implement High Availability**
   - Scale to multi-AZ with RDS and ElastiCache replicas
   - Enable auto-scaling for ECS services
   - Set up backup and disaster recovery

4. **Optimize Performance**
   - Enable RDS query caching
   - Implement Redis sessions efficiently
   - Add CloudFront for static asset delivery
   - Monitor and tune database indexes

5. **Implement Security Policies**
   - Enable AWS WAF on ALB
   - Configure security groups as per principle of least privilege
   - Set up CloudTrail for audit logs
   - Enable GuardDuty for threat detection

---

**Version:** 1.0.0  
**Created:** February 26, 2024  
**Status:** Production Ready (Single-AZ MVP)
