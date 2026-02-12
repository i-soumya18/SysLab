# Scripts Directory

Helper scripts for operating the System Design Simulator with Docker.

## Available Scripts

### `start.sh`
**Description:** Start all services with health checks
**Usage:** `./scripts/start.sh`
**What it does:**
- Checks if Docker is running
- Creates .env file if missing
- Pulls latest images
- Builds services
- Starts all containers
- Runs health checks
- Displays access URLs

### `stop.sh`
**Description:** Stop all running containers
**Usage:** `./scripts/stop.sh`
**What it does:**
- Stops all Docker containers
- Preserves volumes and data

**To remove volumes as well:**
```bash
docker-compose down -v
```

### `health-check.sh`
**Description:** Check health of all services
**Usage:** `./scripts/health-check.sh`
**What it checks:**
- Docker container health status
- HTTP endpoint availability
- Database connectivity
- Redis connectivity

**Exit codes:**
- 0: All services healthy
- 1: Some services unhealthy

### `logs.sh`
**Description:** View logs for services
**Usage:**
```bash
./scripts/logs.sh              # All services
./scripts/logs.sh backend      # Specific service
./scripts/logs.sh postgres     # Database logs
```

**Available services:**
- `backend`
- `backend-replica`
- `frontend`
- `postgres`
- `redis`
- `gateway`
- `prometheus`
- `grafana`

### `dev-setup.sh`
**Description:** Set up local development environment
**Usage:** `./scripts/dev-setup.sh`
**What it does:**
- Checks Node.js version (requires v20+)
- Installs backend dependencies
- Installs frontend dependencies
- Creates .env files from .env.example
- Prepares development environment

### `backup.sh`
**Description:** Create manual database backup
**Usage:** `./scripts/backup.sh`
**What it does:**
- Creates `backups/` directory if missing
- Exports PostgreSQL database
- Saves with timestamp: `backups/sds-backup-YYYYMMDD-HHMMSS.sql`

**Example output:**
```
backups/sds-backup-20240212-143022.sql
```

### `restore.sh`
**Description:** Restore database from backup
**Usage:** `./scripts/restore.sh <backup-file>`
**Example:** `./scripts/restore.sh backups/sds-backup-20240212-120000.sql`
**What it does:**
- Validates backup file exists
- Prompts for confirmation (⚠️ overwrites current database)
- Restores database from backup

**⚠️ Warning:** This will overwrite your current database!

## Quick Reference

```bash
# First time setup
./scripts/dev-setup.sh

# Start the application
./scripts/start.sh

# Check if everything is healthy
./scripts/health-check.sh

# View all logs
./scripts/logs.sh

# View specific service logs
./scripts/logs.sh backend

# Create a backup
./scripts/backup.sh

# Restore from backup
./scripts/restore.sh backups/sds-backup-20240212-120000.sql

# Stop the application
./scripts/stop.sh
```

## Making Scripts Executable

If you get "Permission denied" errors:

```bash
chmod +x scripts/*.sh
```

## Environment Requirements

- **Docker**: v20.10 or higher
- **Docker Compose**: v2.0 or higher
- **Node.js**: v20 or higher (for dev-setup.sh)
- **Bash**: Available on Linux/Mac/WSL

## Script Locations

All scripts are located in the `scripts/` directory at the project root:

```
SysLab/
├── scripts/
│   ├── start.sh
│   ├── stop.sh
│   ├── health-check.sh
│   ├── logs.sh
│   ├── dev-setup.sh
│   ├── backup.sh
│   └── restore.sh
├── docker-compose.yml
├── .env.example
└── ...
```

## Troubleshooting

### Script won't execute
```bash
# Make executable
chmod +x scripts/<script-name>.sh

# Run with bash explicitly
bash scripts/<script-name>.sh
```

### Docker not found
```bash
# Check Docker is installed
docker --version

# Check Docker is running
docker info
```

### Permission errors
```bash
# Run Docker commands need sudo? Add user to docker group
sudo usermod -aG docker $USER
# Then logout and login again
```

## Exit Codes

All scripts follow standard exit code conventions:
- `0`: Success
- `1`: Error or failure

This makes them suitable for use in CI/CD pipelines and automation.

## For More Information

- [DOCKER_SETUP.md](../DOCKER_SETUP.md) - Complete Docker guide
- [QUICK_REFERENCE.md](../QUICK_REFERENCE.md) - API and command reference
- [LOCAL_SETUP_COMPLETE.md](../LOCAL_SETUP_COMPLETE.md) - Setup completion guide
