# GitHub Actions EC2 CI/CD Setup

This guide configures CI/CD for the EC2 deployment workflow:

- Workflow file: `.github/workflows/deploy-ec2.yml`
- Remote deploy script: `aws-deployment/deploy-ec2-remote.sh`

## 1. Create a GitHub Environment

1. Open your repo: `Settings -> Environments`
2. Create environment: `production`
3. Enable protection rules (recommended):
- Required reviewers: at least 1 (you)
- Deployment branches: `main`

## 2. Add Environment Secrets (production)

Add these under `Settings -> Environments -> production -> Add secret`.

| Secret | Example | Notes |
|---|---|---|
| `EC2_HOST` | `3.84.4.71` | Public IPv4 or DNS of your EC2 instance |
| `EC2_USER` | `ubuntu` | Default Ubuntu AMI user |
| `EC2_SSH_PRIVATE_KEY` | `-----BEGIN OPENSSH PRIVATE KEY-----...` | Private key used to SSH from Actions |
| `EC2_SSH_KNOWN_HOSTS` | `3.84.4.71 ssh-ed25519 AAAAC3...` | Output from `ssh-keyscan -H` |
| `APP_URL` | `http://3.84.4.71` | Public URL used by smoke tests |
| `PUBLIC_HOST` | `3.84.4.71` | Host/IP injected into frontend/backend runtime config |
| `JWT_SECRET` | long random string | Minimum 32+ chars |
| `JWT_REFRESH_SECRET` | long random string | Minimum 32+ chars |

Generate secure JWT values:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

Generate known hosts value:

```bash
ssh-keyscan -H 3.84.4.71
```

## 3. Trigger Deployment

Automatic:
- Push to `main`.

Manual:
- `Actions -> Deploy to AWS EC2 -> Run workflow`
- Keep `skip_checks=false` for normal deployments.
- Use `skip_checks=true` only for emergency rollouts.

## 4. What the Pipeline Does

1. Runs quality checks:
- `npm ci`
- frontend tests
- backend CI tests (`npm run test:backend:ci`)
- compose config validation

2. Deploys to EC2:
- Strict SSH host verification
- `rsync --delete` sync for reproducible state
- Runs `aws-deployment/deploy-ec2-remote.sh`
- Builds and starts containers with compose

3. Verifies health:
- `GET /health`
- `GET /api/v1`

## 5. Troubleshooting

### SSH failure
- Verify `EC2_SSH_PRIVATE_KEY`, `EC2_USER`, `EC2_HOST`
- Regenerate and update `EC2_SSH_KNOWN_HOSTS`

### Deploy succeeds but app not healthy
- SSH to EC2 and inspect:

```bash
cd /home/ubuntu/SysLab/aws-deployment
docker compose -f docker-compose.ec2.yml ps
docker compose -f docker-compose.ec2.yml logs --tail=200 gateway backend
```

### Permission denied to Docker on EC2
- Ensure deploy user is in docker group:

```bash
sudo usermod -aG docker ubuntu
```

## 6. Security Notes

- Keep all deploy credentials in environment-level secrets (not repo-level secrets).
- Rotate `EC2_SSH_PRIVATE_KEY` and JWT secrets periodically.
- Use environment approvals for production.
- Keep `StrictHostKeyChecking=yes` and pinned known hosts.
