# 🚀 Quick Reference Guide - System Design Simulator

## Starting the Application

```bash
# Start everything with one command
./scripts/start.sh

# Access the application
http://localhost
```

## Useful Scripts

| Script | Command | Description |
|--------|---------|-------------|
| **Start** | `./scripts/start.sh` | Start all services with health checks |
| **Stop** | `./scripts/stop.sh` | Stop all services |
| **Health** | `./scripts/health-check.sh` | Check if all services are healthy |
| **Logs** | `./scripts/logs.sh [service]` | View logs (all or specific service) |
| **Dev Setup** | `./scripts/dev-setup.sh` | Set up local development environment |
| **Backup** | `./scripts/backup.sh` | Create manual database backup |
| **Restore** | `./scripts/restore.sh <file>` | Restore database from backup |

## Access Points

| Service | URL | Credentials |
|---------|-----|-------------|
| **Main Application** | http://localhost | - |
| **API Health** | http://localhost/api/health | - |
| **Grafana** | http://localhost:3001 | admin / admin |
| **PostgreSQL** | localhost:5433 | postgres / postgres |
| **Redis** | localhost:6379 | - |

## API Endpoints

### Authentication (`/api/auth`)
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/reset-password` - Password reset
- `POST /api/auth/verify-email` - Email verification

### Users (`/api/users`)
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/progress` - Get learning progress
- `PUT /api/users/preferences` - Update preferences
- `DELETE /api/users/account` - Delete account
- `GET /api/users/subscription` - Get subscription status
- `PUT /api/users/subscription` - Update subscription

### Workspaces (`/api/workspaces`)
- `POST /api/workspaces` - Create new workspace
- `GET /api/workspaces` - List workspaces
- `GET /api/workspaces/:id` - Get workspace
- `PUT /api/workspaces/:id` - Save workspace
- `DELETE /api/workspaces/:id` - Delete workspace
- `GET /api/workspaces/:id/history` - Get version history
- `POST /api/workspaces/:id/rollback` - Rollback to version

### Collaboration (`/api/workspaces/:id`)
- `POST /api/workspaces/:id/share` - Share workspace
- `PUT /api/workspaces/:id/collaborate` - Enable collaboration
- `GET /api/workspaces/:id/collaborators` - List collaborators
- `DELETE /api/workspaces/:id/share/:userId` - Remove access
- `POST /api/workspaces/:id/invite` - Send invitation
- `PUT /api/workspaces/:id/permissions` - Update permissions

### Simulations (`/api/simulations` & `/api/workspaces/:id`)
- `POST /api/workspaces/:id/simulate` - Start simulation
- `PUT /api/simulations/:id/parameters` - Update parameters
- `DELETE /api/simulations/:id` - Stop simulation
- `GET /api/simulations/:id/metrics` - Get metrics
- `POST /api/simulations/:id/constraints` - Inject failures
- `GET /api/simulations/:id/bottlenecks` - Get bottlenecks

### Scale Simulation (`/api/simulations`)
- `POST /api/simulations/scale` - Start scale simulation (1-1B users)
- `PUT /api/simulations/:id/scale-parameters` - Update scale params
- `GET /api/simulations/:id/scale-results` - Get scaling analysis
- `POST /api/simulations/:id/scale-scenarios` - Run predefined scenarios
- `GET /api/simulations/:id/cost-analysis` - Get cost analysis

### Scenarios (`/api/scenarios`)
- `GET /api/scenarios` - List scenarios
- `GET /api/scenarios/:id` - Get scenario
- `POST /api/scenarios/:id/complete` - Mark complete
- `GET /api/scenarios/:id/hints` - Get hints
- `POST /api/scenarios/:id/feedback` - Submit feedback

### Learning & Progress (`/api/curriculum`)
- `GET /api/curriculum/paths` - Get learning paths
- `GET /api/curriculum/paths/:id` - Get specific path
- `POST /api/curriculum/progress` - Update progress
- `GET /api/curriculum/recommendations` - Get recommendations
- `PUT /api/curriculum/preferences` - Update learning preferences

### Analytics (`/api/analytics`)
- `GET /api/analytics/progress` - Get learning analytics
- `GET /api/analytics/skills` - Get skill assessment
- `GET /api/analytics/recommendations` - Get AI recommendations
- `POST /api/analytics/events` - Track events
- `GET /api/analytics/achievements` - Get achievements
- `GET /api/analytics/peers` - Get peer comparison

### Scalability (`/api/scalability`)
- `GET /api/scalability/metrics` - Get scalability metrics
- `POST /api/scalability/horizontal-scaling` - Configure horizontal scaling
- `GET /api/scalability/load-balancer` - Get load balancer status
- `POST /api/scalability/workload` - Submit simulation workload
- `GET /api/scalability/monitoring` - Get user monitoring data

### Failure Injection (`/api/failures`)
- `POST /api/failures/inject` - Inject failure
- `GET /api/failures/:id` - Get failure status
- `DELETE /api/failures/:id` - Remove failure
- `GET /api/failures/types` - List failure types

### Progressive Constraints (`/api/constraints`)
- `GET /api/constraints` - List constraints
- `POST /api/constraints/:id/apply` - Apply constraint
- `DELETE /api/constraints/:id` - Remove constraint

### Hints & Explanations (`/api/hints`)
- `GET /api/hints/scenarios/:scenarioId` - Get hints for scenario
- `POST /api/hints/usage` - Track hint usage

### Progress Tracking (`/api/progress`)
- `GET /api/progress` - Get user progress
- `POST /api/progress/scenario/:scenarioId` - Update scenario progress
- `GET /api/progress/achievements` - Get achievements

## Docker Commands

### Basic Operations
```bash
# View running containers
docker-compose ps

# View logs
docker-compose logs -f [service]

# Restart service
docker-compose restart [service]

# Rebuild service
docker-compose build [service]

# Stop and remove everything
docker-compose down

# Stop and remove including volumes
docker-compose down -v
```

### Database Operations
```bash
# Connect to PostgreSQL
docker exec -it sds-postgres psql -U postgres -d system_design_simulator

# Connect to Redis
docker exec -it sds-redis redis-cli

# Run SQL query
docker exec sds-postgres psql -U postgres -d system_design_simulator -c "SELECT * FROM users;"

# Backup database
docker exec sds-postgres pg_dump -U postgres system_design_simulator > backup.sql
```

### Container Operations
```bash
# Execute command in container
docker exec -it sds-backend sh

# View container stats
docker stats

# View container logs
docker logs -f sds-backend

# Inspect container
docker inspect sds-backend
```

## WebSocket Events

### Real-Time Collaboration
- `workspace:join` - User joins workspace
- `workspace:leave` - User leaves workspace
- `workspace:component-added` - Component added
- `workspace:component-updated` - Component modified
- `workspace:cursor-move` - Cursor movement

### Simulation Updates
- `scale-simulation:started` - Simulation started
- `scale-simulation:progress` - Real-time progress
- `scale-simulation:bottleneck` - Bottleneck detected
- `scale-simulation:cost-update` - Cost update
- `scale-simulation:failure-injected` - Failure injected
- `scale-simulation:recovery` - System recovery

### Learning Progress
- `learning:achievement-unlocked` - Achievement earned
- `learning:level-completed` - Level completed
- `learning:hint-available` - Hint available
- `learning:peer-activity` - Peer activity
- `learning:instructor-feedback` - Instructor feedback
- `learning:scenario-updated` - Scenario progress

## Environment Variables

### Backend (.env)
```env
PORT=3000
NODE_ENV=development
DB_HOST=postgres
DB_NAME=system_design_simulator
REDIS_HOST=redis
JWT_SECRET=your-secret-key
FRONTEND_URL=http://localhost:80
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:80/api
VITE_WS_URL=ws://localhost:80
VITE_FIREBASE_API_KEY=your-key
VITE_FIREBASE_PROJECT_ID=your-project
```

## Troubleshooting Quick Fixes

### Port Already in Use
```bash
# Find process using port 80
lsof -i :80
# Kill process
kill -9 <PID>
# Or change port in docker-compose.yml
```

### Database Connection Failed
```bash
# Restart database
docker-compose restart postgres
# Check database logs
docker-compose logs postgres
```

### Backend API Not Responding
```bash
# Check backend logs
docker-compose logs backend
# Restart backend
docker-compose restart backend backend-replica
```

### Out of Memory
```bash
# Check memory usage
docker stats
# Increase Docker memory in Docker Desktop settings
```

### Cache Issues
```bash
# Rebuild without cache
docker-compose build --no-cache
# Clear Docker cache
docker system prune -a
```

## Health Checks

### Manual Health Checks
```bash
# Backend API
curl http://localhost/api/health

# PostgreSQL
docker exec sds-postgres pg_isready -U postgres

# Redis
docker exec sds-redis redis-cli ping

# All services
./scripts/health-check.sh
```

## Development Tips

### Local Development (without Docker)
```bash
# Start databases only
docker-compose up -d postgres redis

# Run backend locally
cd backend && npm run dev

# Run frontend locally
cd frontend && npm run dev
```

### Hot Reload in Docker
```bash
# Mount source code as volume in docker-compose.yml
volumes:
  - ./backend/src:/app/src
```

### View Real-Time Metrics
- Visit: http://localhost:3001 (Grafana)
- Default credentials: admin / admin
- View dashboards for system metrics

---

**For detailed documentation, see:** [DOCKER_SETUP.md](./DOCKER_SETUP.md)
