# 🐳 Docker Setup Guide - System Design Simulator

Complete guide to run the System Design Simulation Platform locally using Docker.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Architecture Overview](#architecture-overview)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Accessing Services](#accessing-services)
- [Useful Commands](#useful-commands)
- [Troubleshooting](#troubleshooting)
- [Development Mode](#development-mode)

---

## Prerequisites

Before you begin, ensure you have the following installed:

- **Docker** (version 20.10 or higher)
- **Docker Compose** (version 2.0 or higher)
- **Git** (for cloning the repository)
- At least **4GB of RAM** available for Docker
- At least **10GB of disk space**

### Verify Installation

```bash
docker --version
docker-compose --version  # or: docker compose version
```

---

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd SysLab
```

### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your preferred settings (optional for local development)
nano .env  # or use your preferred editor
```

### 3. Start the Application

```bash
# Make scripts executable (first time only)
chmod +x scripts/*.sh

# Start all services
./scripts/start.sh
```

The startup script will:
- ✅ Pull required Docker images
- ✅ Build backend and frontend services
- ✅ Start all containers
- ✅ Run health checks
- ✅ Display access URLs

### 4. Access the Application

Open your browser and navigate to:
- **Main Application**: http://localhost
- **Grafana Dashboard**: http://localhost:3001 (admin/admin)

---

## Architecture Overview

The Docker setup includes the following services:

### Core Services

| Service | Container Name | Port | Description |
|---------|---------------|------|-------------|
| **Frontend** | `sds-frontend` | 80 (via gateway) | React-based UI with Vite |
| **Backend** | `sds-backend` | 3000 (internal) | Node.js/Express API server |
| **Backend Replica** | `sds-backend-replica` | 3000 (internal) | Backend replica for load balancing |
| **Gateway** | `sds-gateway` | 80 | Nginx reverse proxy and load balancer |

### Data Layer

| Service | Container Name | Port | Description |
|---------|---------------|------|-------------|
| **PostgreSQL** | `sds-postgres` | 5433 | Primary database |
| **Redis** | `sds-redis` | 6379 | Cache and session store |

### Monitoring & Operations

| Service | Container Name | Port | Description |
|---------|---------------|------|-------------|
| **Prometheus** | `sds-prometheus` | 9090 (internal) | Metrics collection |
| **Grafana** | `sds-grafana` | 3001 | Metrics visualization |
| **Postgres Backup** | `sds-postgres-backup` | N/A | Automated database backups |

### Network Architecture

```
                     ┌─────────────────┐
                     │   Nginx Gateway │ :80
                     │   (Load Balance)│
                     └────────┬────────┘
                              │
            ┌─────────────────┴─────────────────┐
            │                                   │
       ┌────▼────┐                        ┌────▼────┐
       │ Backend │                        │ Backend │
       │ Primary │                        │ Replica │
       └────┬────┘                        └────┬────┘
            │                                   │
            └─────────────────┬─────────────────┘
                              │
                 ┌────────────┴────────────┐
                 │                         │
            ┌────▼────┐              ┌─────▼─────┐
            │ Postgres│              │   Redis   │
            │   :5432 │              │   :6379   │
            └─────────┘              └───────────┘
```

---

## Configuration

### Environment Variables

#### Root `.env` (Docker Compose Configuration)

Key variables you may want to customize:

```env
# JWT Secret - CHANGE THIS!
JWT_SECRET=your-super-secret-jwt-key-change-me

# Database Credentials
DB_PASSWORD=postgres
DB_NAME=system_design_simulator

# Frontend URL
FRONTEND_URL=http://localhost:80

# Grafana Credentials
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin
```

#### Backend Configuration

Located in `backend/.env`:

```env
PORT=3000
NODE_ENV=production
DB_HOST=postgres
REDIS_HOST=redis
JWT_SECRET=<same-as-root-env>
```

#### Frontend Configuration

Located in `frontend/.env`:

```env
VITE_API_URL=http://localhost:80/api
VITE_WS_URL=ws://localhost:80

# Firebase Configuration (if using authentication)
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-domain.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
```

### Backup Configuration

Automated backups run every 6 hours by default. Configure in `.env`:

```env
BACKUP_SCHEDULE="0 */6 * * *"  # Cron format
BACKUP_KEEP_DAYS=7
BACKUP_KEEP_WEEKS=4
BACKUP_KEEP_MONTHS=6
```

---

## Running the Application

### Start Services

```bash
./scripts/start.sh
```

This command will:
1. Check Docker is running
2. Pull latest images
3. Build services
4. Start all containers
5. Run health checks

### Stop Services

```bash
./scripts/stop.sh
```

### Restart Services

```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart backend
```

### View Logs

```bash
# All services
./scripts/logs.sh

# Specific service
./scripts/logs.sh backend
./scripts/logs.sh frontend
./scripts/logs.sh postgres

# Follow logs for specific service
docker-compose logs -f backend
```

### Check Service Health

```bash
./scripts/health-check.sh
```

This script checks:
- ✅ All container health status
- ✅ HTTP endpoint availability
- ✅ Database connectivity
- ✅ Redis connectivity

---

## Accessing Services

### Main Application

- **URL**: http://localhost
- **Description**: Full React frontend with all features

### API Documentation

- **Health Check**: http://localhost/api/health
- **Base API**: http://localhost/api/*

Available endpoints:
- `/api/auth/*` - Authentication
- `/api/workspaces/*` - Workspace management
- `/api/simulations/*` - Simulation execution
- `/api/scenarios/*` - Learning scenarios
- `/api/users/*` - User management

### Monitoring Dashboards

#### Grafana
- **URL**: http://localhost:3001
- **Username**: `admin`
- **Password**: `admin` (default)

#### Prometheus (Internal)
- **URL**: http://localhost:9090 (not exposed by default)
- To expose: Add port mapping in docker-compose.yml

### Database Access

#### PostgreSQL

```bash
# Connect to database
docker exec -it sds-postgres psql -U postgres -d system_design_simulator

# Run SQL query
docker exec sds-postgres psql -U postgres -d system_design_simulator -c "SELECT * FROM users LIMIT 5;"
```

#### Redis

```bash
# Connect to Redis CLI
docker exec -it sds-redis redis-cli

# Check keys
docker exec sds-redis redis-cli KEYS "*"

# Get value
docker exec sds-redis redis-cli GET "some-key"
```

---

## Useful Commands

### Docker Compose Commands

```bash
# View running containers
docker-compose ps

# View container stats (CPU, memory)
docker stats

# Execute command in container
docker exec -it sds-backend sh

# View container logs
docker-compose logs <service-name>

# Rebuild specific service
docker-compose build backend

# Rebuild without cache
docker-compose build --no-cache

# Start in foreground (see all logs)
docker-compose up

# Start in background (detached)
docker-compose up -d
```

### Database Management

```bash
# Create manual backup
./scripts/backup.sh

# Restore from backup
./scripts/restore.sh backups/sds-backup-20240212-120000.sql

# List backups
ls -lh backups/

# View backup size
du -sh backups/
```

### Cleanup Commands

```bash
# Stop and remove containers
docker-compose down

# Stop and remove containers + volumes (⚠️  deletes data!)
docker-compose down -v

# Remove all stopped containers
docker container prune

# Remove unused images
docker image prune

# Remove unused volumes
docker volume prune

# Complete cleanup (⚠️  removes everything!)
docker system prune -a --volumes
```

---

## Troubleshooting

### Application Won't Start

#### Check Docker is Running

```bash
docker info
```

If not running, start Docker Desktop or Docker daemon.

#### Check Port Conflicts

```bash
# Check if port 80 is already in use
lsof -i :80  # Linux/Mac
netstat -ano | findstr :80  # Windows

# Check port 5433 (PostgreSQL)
lsof -i :5433

# Check port 6379 (Redis)
lsof -i :6379
```

Solution: Stop conflicting services or change ports in `docker-compose.yml`.

#### Check Disk Space

```bash
df -h  # Linux/Mac
```

Docker needs at least 10GB free space.

### Database Connection Issues

#### Check PostgreSQL Health

```bash
docker exec sds-postgres pg_isready -U postgres
```

#### View PostgreSQL Logs

```bash
docker-compose logs postgres
```

#### Reset Database

```bash
# Stop containers
docker-compose down

# Remove database volume
docker volume rm syslab_postgres_data

# Restart (will recreate database)
./scripts/start.sh
```

### Backend API Not Responding

#### Check Backend Logs

```bash
docker-compose logs backend
docker-compose logs backend-replica
```

#### Restart Backend

```bash
docker-compose restart backend backend-replica
```

#### Check Backend Health Directly

```bash
curl http://localhost/api/health
```

### Frontend Not Loading

#### Check Nginx Gateway

```bash
docker-compose logs gateway
```

#### Check Frontend Build

```bash
# Rebuild frontend
docker-compose build frontend

# Restart gateway and frontend
docker-compose restart gateway frontend
```

### Redis Connection Issues

#### Check Redis

```bash
docker exec sds-redis redis-cli ping
# Should return: PONG
```

#### View Redis Logs

```bash
docker-compose logs redis
```

### Out of Memory

If services crash due to memory:

```bash
# Check container memory usage
docker stats

# Increase Docker memory limit (Docker Desktop)
# Settings → Resources → Memory → Increase to 6GB or 8GB
```

### Port Already in Use

Change ports in `docker-compose.yml`:

```yaml
services:
  gateway:
    ports:
      - "8080:80"  # Use port 8080 instead of 80
```

Then access at: http://localhost:8080

---

## Development Mode

### Running Without Docker

For faster development iteration:

#### 1. Setup Development Environment

```bash
./scripts/dev-setup.sh
```

#### 2. Start Database Services Only

```bash
# Start only Postgres and Redis
docker-compose up -d postgres redis
```

#### 3. Run Backend Locally

```bash
cd backend
npm run dev  # Runs with hot-reload
```

#### 4. Run Frontend Locally

```bash
cd frontend
npm run dev  # Runs with hot-reload
```

Access at:
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3000

### Hybrid Development

Run some services in Docker, others locally:

```bash
# Start databases and monitoring
docker-compose up -d postgres redis prometheus grafana

# Run backend locally
cd backend && npm run dev

# Run frontend locally
cd frontend && npm run dev
```

### Hot Reload in Docker

To enable hot reload for backend in Docker:

1. Update `docker-compose.yml`:

```yaml
backend:
  command: npm run dev  # Instead of npm start
  volumes:
    - ./backend/src:/app/src  # Mount source code
```

2. Restart:

```bash
docker-compose restart backend
```

---

## Performance Optimization

### Increase Resource Limits

Edit `docker-compose.yml`:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G
```

### Enable Docker BuildKit

Add to `.env`:

```env
COMPOSE_DOCKER_CLI_BUILD=1
DOCKER_BUILDKIT=1
```

### Use Docker Layer Caching

Rebuild with cache:

```bash
docker-compose build --pull
```

---

## Backup & Restore

### Automated Backups

Automated backups run every 6 hours (configurable). Backups are stored in the `postgres_backups` Docker volume.

### Manual Backup

```bash
./scripts/backup.sh
```

Creates backup in `backups/` directory with timestamp.

### Restore from Backup

```bash
./scripts/restore.sh backups/sds-backup-20240212-120000.sql
```

⚠️  **Warning**: This will overwrite your current database!

### Export Backup to Host

```bash
# List backups in container
docker exec sds-postgres-backup ls -lh /backups/

# Copy backup to host
docker cp sds-postgres-backup:/backups/daily/system_design_simulator-20240212.sql.gz backups/
```

---

## Security Best Practices

### For Production Deployment

1. **Change Default Passwords**
   ```env
   DB_PASSWORD=<strong-random-password>
   JWT_SECRET=<strong-random-secret>
   GRAFANA_ADMIN_PASSWORD=<strong-password>
   ```

2. **Use Environment Variables for Secrets**
   - Never commit `.env` files
   - Use Docker secrets or secret management services

3. **Enable HTTPS**
   - Configure SSL/TLS certificates in nginx
   - Use Let's Encrypt for free certificates

4. **Restrict Network Access**
   - Don't expose database ports publicly
   - Use firewall rules

5. **Enable Authentication**
   - Configure Firebase authentication
   - Implement proper access controls

---

## Monitoring & Logs

### View Metrics in Grafana

1. Open http://localhost:3001
2. Login (admin/admin)
3. Navigate to Dashboards
4. View system metrics

### Prometheus Metrics

Available metrics:
- HTTP request rates
- Response times
- Error rates
- Database connection pool status
- Redis cache hit rates

### Log Aggregation

All container logs are available via:

```bash
docker-compose logs -f --tail=100
```

For production, consider:
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Grafana Loki
- Cloud logging services

---

## Next Steps

✅ Application is running!

Now you can:

1. **Explore the Application**
   - Create an account
   - Build your first system design
   - Run simulations

2. **Check the Documentation**
   - Read API documentation
   - Review architecture docs
   - Explore learning scenarios

3. **Development**
   - Make code changes
   - Run tests
   - Contribute features

4. **Monitoring**
   - Set up Grafana dashboards
   - Configure alerts
   - Monitor performance

---

## Support

### Getting Help

- **Documentation**: See `/docs` directory
- **Issues**: Report at GitHub Issues
- **Community**: Join our Discord/Slack

### Useful Links

- [Main README](../README.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [Architecture Overview](./ARCHITECTURE.md)
- [Contributing Guide](../CONTRIBUTING.md)

---

**Happy Simulating! 🚀**
