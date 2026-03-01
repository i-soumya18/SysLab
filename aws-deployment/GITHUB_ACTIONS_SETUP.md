# GitHub Actions Setup Guide (EC2 Auto-Deploy)

This repository is configured to auto-deploy to EC2 using:
- Workflow: `.github/workflows/deploy-ec2.yml`
- Branch trigger: `main`
- GitHub Environment: `production`

## Required GitHub Environment

Create environment:
- Repository -> `Settings` -> `Environments` -> `New environment`
- Name: `production`

Recommended protection rules:
- Required reviewers: at least 1
- Deployment branches: `main`

## Required Secrets (Environment: `production`)

Add these at:
`Settings -> Environments -> production -> Add secret`

| Secret | Required | Purpose |
|---|---|---|
| `EC2_HOST` | Yes | EC2 public IP or DNS |
| `EC2_USER` | Yes | SSH user (usually `ubuntu`) |
| `EC2_SSH_PRIVATE_KEY` | Yes | Private SSH key used by GitHub Actions |
| `EC2_SSH_KNOWN_HOSTS` | Yes | Pinned host key from `ssh-keyscan -H <host>` |
| `APP_URL` | Yes | Public app base URL used by smoke checks |
| `PUBLIC_HOST` | Yes | Host injected into runtime config |
| `JWT_SECRET` | Yes | JWT signing secret |
| `JWT_REFRESH_SECRET` | Yes | Refresh token signing secret |

Generate JWT values:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

Generate known_hosts value:

```bash
ssh-keyscan -H <EC2_HOST>
```

## What Runs on Push to `main`

1. `quality-checks` job:
- `npm ci`
- `npm run test:frontend`
- `npm run test:backend:ci`
- `docker compose -f aws-deployment/docker-compose.ec2.yml config`

2. `deploy` job:
- Strict SSH setup (`known_hosts` enforced)
- `rsync --delete` sync to `/home/ubuntu/SysLab`
- Executes `aws-deployment/deploy-ec2-remote.sh` on EC2
- Smoke tests:
  - `GET $APP_URL/health`
  - `GET $APP_URL/api/v1`

## Manual Deployment

You can run deployment manually from GitHub Actions:
- Workflow: `Deploy to AWS EC2`
- Input: `skip_checks`
  - `false` (default): normal deployment
  - `true`: emergency deploy without tests

## Notes About `deploy-aws.yml`

`.github/workflows/deploy-aws.yml` is an ECS workflow and **does not auto-deploy on push**.
It remains manual (`workflow_dispatch`) and separate from the EC2 pipeline.

## Troubleshooting

### SSH failure
- Verify `EC2_HOST`, `EC2_USER`, `EC2_SSH_PRIVATE_KEY`, `EC2_SSH_KNOWN_HOSTS`

### Health check failure
Run on EC2:

```bash
cd /home/ubuntu/SysLab/aws-deployment
docker compose -f docker-compose.ec2.yml ps
docker compose -f docker-compose.ec2.yml logs --tail=200 gateway backend frontend
```

### Docker permission issue

```bash
sudo usermod -aG docker ubuntu
```

## Security Best Practices

1. Keep deploy secrets only at environment level (`production`), not in repository secrets.
2. Rotate SSH keys and JWT secrets periodically.
3. Keep `StrictHostKeyChecking=yes` and pinned `known_hosts`.
