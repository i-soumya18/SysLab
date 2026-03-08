# AWS Deployment Quick Reference

## Quick Links

- **AWS Console**: https://console.aws.amazon.com
- **ECS Dashboard**: https://console.aws.amazon.com/ecs
- **ECR Repositories**: https://console.aws.amazon.com/ecr
- **RDS Databases**: https://console.aws.amazon.com/rds
- **ElastiCache**: https://console.aws.amazon.com/elasticache
- **CloudWatch Logs**: https://console.aws.amazon.com/logs
- **GitHub Secrets**: https://github.com/i-soumya18/SysLab/settings/secrets/actions

## Deployment Checklist

### Pre-Deployment

- [ ] AWS Account created and configured
- [ ] IAM user created with necessary permissions
- [ ] AWS CLI v2 installed and configured
- [ ] Docker Desktop running locally
- [ ] Code committed to `soumya` branch

### Phase 1: Infrastructure Setup

- [ ] Run: `bash infra/aws-deployment/setup-infrastructure.sh`
- [ ] Wait 15-20 minutes for RDS and Redis to initialize
- [ ] Verify: `source infra/aws-deployment/aws-config.env && echo $RDS_ENDPOINT`

### Phase 2: Networking

- [ ] Create Security Groups (ALB, Backend, Frontend, RDS, Redis)
- [ ] Create VPC and subnets if using private networking
- [ ] Create Application Load Balancer
- [ ] Create Target Groups (Backend port 3000, Frontend port 80)
- [ ] Get ALB DNS name

### Phase 3: Container Registry

- [ ] Build and push backend: `docker build -t [ECR_URI]/syslab-backend . -f apps/backend/Dockerfile && docker push [ECR_URI]/syslab-backend`
- [ ] Build and push frontend: `docker build -t [ECR_URI]/syslab-frontend . -f apps/frontend/Dockerfile && docker push [ECR_URI]/syslab-frontend`
- [ ] Verify images in ECR

### Phase 4: Database

- [ ] Register ECS task definitions
- [ ] Run: `bash infra/aws-deployment/init-database.sh`
- [ ] Verify tables created: `psql -h [RDS_ENDPOINT] -U postgres -d system_design_simulator -c "\\dt"`

### Phase 5: ECS

- [ ] Create ECS services (backend and frontend)
- [ ] Verify services are running: `bash infra/aws-deployment/ecs-helper.sh services`
- [ ] Check target health in ALB

### Phase 6: CI/CD

- [ ] Configure GitHub Actions secrets (see GITHUB_ACTIONS_SETUP.md)
- [ ] Test deployment by pushing to `soumya` branch
- [ ] Monitor workflow in GitHub Actions tab

### Post-Deployment

- [ ] Run health checks: `bash infra/aws-deployment/ecs-helper.sh health [ALB_DNS]`
- [ ] Test API: `curl https://[ALB_DNS]/api/health`
- [ ] Test frontend: Open https://[ALB_DNS] in browser
- [ ] Test auth: Try signing up and logging in
- [ ] View logs: `bash infra/aws-deployment/ecs-helper.sh logs backend`

## Common Commands

### Infrastructure

```bash
# Setup
bash infra/aws-deployment/setup-infrastructure.sh

# Load configuration
source infra/aws-deployment/aws-config.env

# View configuration
cat infra/aws-deployment/aws-config.env | grep -v "PASSWORD\|SECRET"

# Initialize database
bash infra/aws-deployment/init-database.sh
```

### Docker & ECR

```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_REGISTRY

# Build images
docker build -t $BACKEND_IMAGE_URI ./backend
docker build --build-arg VITE_API_URL=https://[ALB_DNS]/api/v1 -t $FRONTEND_IMAGE_URI ./frontend

# Push images
docker push $BACKEND_IMAGE_URI
docker push $FRONTEND_IMAGE_URI

# List ECR images
aws ecr describe-images --repository-name syslab-backend --region us-east-1
aws ecr describe-images --repository-name syslab-frontend --region us-east-1
```

### ECS Management

```bash
# View services
bash infra/aws-deployment/ecs-helper.sh services

# View tasks
bash infra/aws-deployment/ecs-helper.sh tasks

# View logs
bash infra/aws-deployment/ecs-helper.sh logs backend
bash infra/aws-deployment/ecs-helper.sh logs frontend

# Restart service
bash infra/aws-deployment/ecs-helper.sh restart backend
bash infra/aws-deployment/ecs-helper.sh restart frontend

# Scale service
bash infra/aws-deployment/ecs-helper.sh scale backend 3
bash infra/aws-deployment/ecs-helper.sh scale frontend 2

# Deploy new image
bash infra/aws-deployment/ecs-helper.sh deploy backend $ECR_REGISTRY/syslab-backend:v1.0.0

# Health check
bash infra/aws-deployment/ecs-helper.sh health [ALB_DNS]
```

### Database Management

```bash
# Connect to database
PGPASSWORD="$DB_PASSWORD" psql -h "$RDS_ENDPOINT" -U postgres -d system_design_simulator

# List tables
\dt

# Count users
SELECT COUNT(*) FROM users;

# View migrations
SELECT * FROM schema_migrations;

# Backup database
pg_dump -h "$RDS_ENDPOINT" -U postgres -d system_design_simulator > backup.sql

# Restore database
psql -h "$RDS_ENDPOINT" -U postgres -d system_design_simulator < backup.sql
```

### CloudWatch Logs

```bash
# Tail logs
aws logs tail /ecs/syslab-backend --follow --region us-east-1
aws logs tail /ecs/syslab-frontend --follow --region us-east-1

# Search for errors
aws logs filter-log-events \
    --log-group-name /ecs/syslab-backend \
    --filter-pattern "ERROR" \
    --region us-east-1

# Get recent logs
aws logs get-log-events \
    --log-group-name /ecs/syslab-backend \
    --log-stream-name ecs/syslab-apps/backend/xxxxx \
    --limit 50 \
    --region us-east-1
```

### Monitoring

```bash
# CPU Usage
aws cloudwatch get-metric-statistics \
    --namespace AWS/ECS \
    --metric-name CPUUtilization \
    --dimensions Name=ServiceName,Value=syslab-backend-service Name=ClusterName,Value=syslab-cluster \
    --start-time 2024-02-26T00:00:00Z \
    --end-time 2024-02-26T23:59:59Z \
    --period 300 \
    --statistics Average \
    --region us-east-1

# Memory Usage
aws cloudwatch get-metric-statistics \
    --namespace AWS/ECS \
    --metric-name MemoryUtilization \
    --dimensions Name=ServiceName,Value=syslab-backend-service Name=ClusterName,Value=syslab-cluster \
    --start-time 2024-02-26T00:00:00Z \
    --end-time 2024-02-26T23:59:59Z \
    --period 300 \
    --statistics Average \
    --region us-east-1

# ALB Request Count
aws cloudwatch get-metric-statistics \
    --namespace AWS/ApplicationELB \
    --metric-name RequestCount \
    --dimensions Name=LoadBalancer,Value=app/syslab-alb/xxxxx \
    --start-time 2024-02-26T00:00:00Z \
    --end-time 2024-02-26T23:59:59Z \
    --period 300 \
    --statistics Sum \
    --region us-east-1
```

### Secrets Management

```bash
# List secrets
aws secretsmanager list-secrets --region us-east-1

# Get secret value
aws secretsmanager get-secret-value \
    --secret-id syslab/jwt_secret \
    --region us-east-1 \
    --query SecretString \
    --output text

# Update secret
aws secretsmanager update-secret \
    --secret-id syslab/jwt_secret \
    --secret-string "new-secret-value" \
    --region us-east-1
```

### Troubleshooting

```bash
# View ECS task definition
aws ecs describe-task-definition \
    --task-definition syslab-backend-taskdef \
    --region us-east-1

# View service details
aws ecs describe-services \
    --cluster syslab-cluster \
    --services syslab-backend-service \
    --region us-east-1

# Check ALB target health
aws elbv2 describe-target-health \
    --target-group-arn arn:aws:elasticloadbalancing:us-east-1:ACCOUNT_ID:targetgroup/syslab-backend-tg/xxxxx \
    --region us-east-1

# View RDS status
aws rds describe-db-instances \
    --db-instance-identifier syslab-db \
    --region us-east-1

# View RDS logs
aws logs tail /aws/rds/instance/syslab-db/postgresql --follow --region us-east-1

# View ElastiCache status
aws elasticache describe-cache-clusters \
    --cache-cluster-id syslab-redis \
    --show-cache-node-info \
    --region us-east-1
```

### Cost Optimization

```bash
# Get cost estimate
aws ce get-cost-and-usage \
    --time-period Start=2024-02-01,End=2024-02-26 \
    --granularity MONTHLY \
    --metrics BlendedCost \
    --group-by Type=DIMENSION,Key=SERVICE \
    --region us-east-1

# View on-demand vs reserved capacity
aws ec2 describe-reserved-instances --region us-east-1
aws ec2 describe-reserved-instances-offerings --region us-east-1
```

## Environment Variables

### Development (docker-compose)
- Set in `.env` file at project root
- Automatically loaded by Docker Compose

### Production (AWS ECS)
- Backend: Loaded from task definition (environment + secrets)
- Frontend: Built into image at build time (VITE_* variables)
- Access via AWS Secrets Manager

### GitHub Actions
- Set in GitHub → Settings → Secrets
- Referenced as `${{ secrets.SECRET_NAME }}` in workflow

## File Structure

```
infra/aws-deployment/
├── AWS_DEPLOYMENT_GUIDE.md           # Complete deployment guide
├── GITHUB_ACTIONS_SETUP.md           # GitHub Actions secrets setup
├── aws-config.env                    # Generated configuration (source this)
├── setup-infrastructure.sh           # Automated infrastructure setup
├── init-database.sh                  # Database initialization script
├── ecs-helper.sh                     # ECS management helper
├── ecs-task-definitions/
│   ├── backend-task-def.json        # Backend ECS task definition
│   └── frontend-task-def.json       # Frontend ECS task definition
├── cloudformation/
│   └── (optional: CloudFormation templates for IaC)
└── infra/monitoring/
    └── (optional: monitoring and alerting configs)

.github/workflows/
└── deploy-aws.yml                    # GitHub Actions CI/CD workflow

.env.prod.template                    # Environment variables template
```

## Important Notes

⚠️ **Security**
- Never commit `.env.prod` or real credentials
- Rotate AWS credentials every 90 days
- Use Secrets Manager for sensitive values
- Grant IAM users minimum required permissions
- Enable MFA on AWS root account

⚠️ **Cost**
- RDS and ElastiCache have minimum hourly charges
- Data transfer between regions costs money
- CloudWatch logs retention incurs storage costs
- Monitor CloudWatch costs in Billing Dashboard

⚠️ **Production**
- Set `ENVIRONMENT=production` in task definitions
- Enable multi-AZ for RDS and ElastiCache in production
- Use NAT Gateway for private subnet outbound traffic
- Enable CloudTrail for audit logs
- Set up budget alerts in AWS Billing

## Support

For detailed instructions, see:
- `infra/aws-deployment/AWS_DEPLOYMENT_GUIDE.md` - Complete guide with all steps
- `infra/aws-deployment/GITHUB_ACTIONS_SETUP.md` - GitHub Actions configuration
- `infra/aws-deployment/ecs-helper.sh help` - ECS helper command options
- Official AWS documentation: https://docs.aws.amazon.com

## Estimated Timeline

| Phase | Task | Duration |
|-------|------|----------|
| 1 | Infrastructure setup | 20 min (+ 15 min waiting) |
| 2 | Networking & security | 15 min |
| 3 | Container images | 10 min |
| 4 | Database setup | 5 min |
| 5 | ECS services | 15 min |
| 6 | CI/CD configuration | 10 min |
| 7 | Testing & validation | 20 min |
| **Total** | | **~90 minutes** |

---

**Last Updated:** February 26, 2024
**AWS Region:** us-east-1
**Status:** Ready for deployment
