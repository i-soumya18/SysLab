# System Design Simulator - Setup & Usage Guide

## Overview

The System Design Simulator is an educational platform for learning system design through hands-on simulation. It implements a complete learning loop: Design → Simulate → Observe Bottlenecks → Fix → Iterate.

## System Architecture

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **Real-time**: WebSocket (Socket.IO)

## Prerequisites

- Node.js 18+ with npm
- Docker and Docker Compose V2
- 4GB+ RAM available

## Quick Start

### 1. Start Infrastructure

```bash
cd /home/aspire/Projects/SysLab
docker compose up -d
```

This starts:
- PostgreSQL on port 5433
- Redis on port 6379

### 2. Start Backend

```bash
cd backend
npm install
npm run seed  # Populate demo user and scenarios
npm run dev   # Start backend on port 3000
```

Backend will be available at: http://localhost:3000

Health check: http://localhost:3000/health

### 3. Start Frontend

```bash
cd frontend
npm install
npm run dev   # Start frontend on port 5173
```

Frontend will be available at: http://localhost:5173

## Demo Credentials

After running the seed script, use these credentials:

- **Email**: demo@example.com
- **Password**: DemoPass123
- **Subscription**: Pro (full access)

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/logout` - Logout
- `GET /api/v1/auth/me` - Get current user

### Workspaces
- `GET /api/v1/workspaces` - List user workspaces
- `POST /api/v1/workspaces` - Create workspace
- `GET /api/v1/workspaces/:id` - Get workspace
- `PUT /api/v1/workspaces/:id` - Update workspace
- `DELETE /api/v1/workspaces/:id` - Delete workspace

### Scenarios
- `GET /api/v1/scenarios` - List all scenarios
- `GET /api/v1/scenarios/:id` - Get scenario details
- `POST /api/v1/scenarios/:id/load` - Load scenario into workspace
- `GET /api/v1/scenarios/difficulty/:level` - Filter by difficulty (beginner/intermediate/advanced)

### Simulation
- `POST /api/v1/simulation/start` - Start simulation
- `POST /api/v1/simulation/stop` - Stop simulation
- `GET /api/v1/simulation/status/:id` - Get simulation status
- `GET /api/v1/simulation/metrics/:id` - Get detailed metrics
- `GET /api/v1/simulation/active` - List active simulations

### Versions
- `POST /api/v1/versions` - Create workspace version
- `GET /api/v1/versions?workspaceId=xxx` - List versions (workspaceId optional)
- `GET /api/v1/versions/:id` - Get version details
- `POST /api/v1/versions/compare` - Compare two versions

## Core Features (MVLE 1-8)

### MVLE-1: Drag Components onto Canvas

Add system components to your design:
- Load Balancers
- Web Servers
- Databases
- Caches (Redis, Memcached)
- Message Queues (Kafka, RabbitMQ)
- CDN
- Storage (S3, object storage)

### MVLE-2: Connect Components

Draw connections between components to define data flow.

### MVLE-3: Set Traffic Scale

Use the slider to set concurrent users (100 to 1M):
- 100-1K: Small application
- 1K-10K: Medium application
- 10K-100K: Large application
- 100K-1M: Massive scale

### MVLE-4: Run Simulation

Click "Run Simulation" to execute the design. The backend:
1. Calculates traffic load (users × avg requests/sec)
2. Simulates discrete events
3. Tracks component metrics
4. Detects bottlenecks

### MVLE-5: Visual Bottleneck Indicators

Overloaded components show:
- Red pulsing glow
- Severity badge (LOW/MEDIUM/HIGH/CRITICAL)
- Based on latency, CPU, queue depth, error rate

### MVLE-6: Metrics Dashboard

Real-time metrics display (bottom-right):
- **System Overview**: Throughput, latency, error rate
- **Component Performance**: Per-component metrics
- **Bottleneck List**: Sorted by severity with recommendations
- **Elapsed Time**: Simulation runtime

### MVLE-7: Fix Issues

Add optimization components:
- Add cache to reduce database load
- Add read replicas for read-heavy workloads
- Add horizontal scaling (more server instances)
- Add load balancer for distribution

### MVLE-8: Re-run and Compare

Run simulation again to see improvements:
- Compare metrics before/after
- Version history to track iterations
- Performance reports showing optimization impact

## Testing the System

### 1. Test Registration

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123","firstName":"Test","lastName":"User"}'
```

### 2. Test Login

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"DemoPass123"}'
```

### 3. List Scenarios

```bash
curl http://localhost:3000/api/v1/scenarios
```

### 4. Start Simulation

```bash
TOKEN="your-jwt-token"

curl -X POST http://localhost:3000/api/v1/simulation/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "workspaceId": "workspace-id",
    "workspace": {
      "name": "Test Workspace",
      "components": [
        {
          "id": "lb-1",
          "type": "load-balancer",
          "position": {"x": 100, "y": 200},
          "configuration": {"algorithm": "round-robin"},
          "metadata": {"name": "Load Balancer"}
        },
        {
          "id": "web-1",
          "type": "web-server",
          "position": {"x": 300, "y": 200},
          "configuration": {"replicas": 2},
          "metadata": {"name": "Web Server"}
        },
        {
          "id": "db-1",
          "type": "database",
          "position": {"x": 500, "y": 200},
          "configuration": {"type": "postgresql"},
          "metadata": {"name": "Database"}
        }
      ],
      "connections": [
        {"source": "lb-1", "target": "web-1"},
        {"source": "web-1", "target": "db-1"}
      ],
      "configuration": {
        "duration": 60,
        "loadPattern": {"type": "constant", "baseLoad": 1000}
      }
    },
    "userCount": 500,
    "duration": 60
  }'
```

### 5. Check Simulation Status

```bash
SIMULATION_ID="sim-id-from-start-response"

curl http://localhost:3000/api/v1/simulation/status/$SIMULATION_ID
```

### 6. Get Metrics

```bash
curl http://localhost:3000/api/v1/simulation/metrics/$SIMULATION_ID
```

## Sample Scenarios (Seeded)

The database includes 5 pre-configured scenarios:

1. **Simple Web Application** (Beginner)
   - Basic 3-tier architecture
   - Learn fundamentals
   - 3 components

2. **High-Traffic E-commerce** (Intermediate)
   - 50K concurrent users
   - CDN + caching + load balancing
   - 6 components

3. **Social Media Feed System** (Intermediate)
   - 100K concurrent users
   - Real-time feeds + message queues
   - 6 components

4. **Video Streaming Service** (Advanced)
   - 200K concurrent users
   - Multi-region CDN + origin servers
   - 6 components

5. **Real-Time Collaboration Tool** (Advanced)
   - 10K concurrent users
   - WebSocket + conflict resolution
   - 6 components

## Bottleneck Detection Algorithm

Components are flagged as bottlenecks when they exceed thresholds:

### Database
- Latency > 100ms
- CPU > 80%
- Queue depth > 50
- Error rate > 5%

### Load Balancer
- Latency > 10ms
- CPU > 70%
- Queue depth > 100
- Error rate > 1%

### Web Server
- Latency > 50ms
- CPU > 75%
- Queue depth > 75
- Error rate > 3%

### Cache
- Latency > 5ms
- CPU > 60%
- Queue depth > 25
- Error rate > 1%

### Severity Levels
- **Critical**: > 3x threshold
- **High**: > 2x threshold
- **Medium**: > 1.5x threshold
- **Low**: > 1x threshold

## Troubleshooting

### Backend won't start
- Check PostgreSQL is running: `docker ps`
- Check environment variables in `backend/.env`
- Check logs: `cd backend && npm run dev`

### Database connection errors
- Verify port 5433 is free: `lsof -i :5433`
- Check Docker container health: `docker compose ps`
- Reset database: `docker compose down -v && docker compose up -d`

### Frontend can't reach backend
- Verify backend is on port 3000: `curl http://localhost:3000/health`
- Check browser console for CORS errors
- Verify `frontend/src/services/*Api.ts` use port 3000

### Simulation not starting
- Check simulation logs in backend console
- Verify workspace has components
- Check SimulationEngine initialization

### Seed script fails
- Ensure database is initialized first
- Check demo user doesn't already exist
- Run: `cd backend && npm run seed`

## Development

### Run Tests

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

### Database Migrations

```bash
# View schema
docker exec -it postgres psql -U postgres -d system_design_simulator -c "\d"

# Run custom migration
docker exec -i postgres psql -U postgres -d system_design_simulator < migration.sql
```

### Re-seed Database

```bash
cd backend
npm run seed
```

## Architecture Decisions

### Why PostgreSQL on Port 5433?
Port 5432 was already in use by local PostgreSQL. Changed to 5433 to avoid conflicts.

### Why Optional workspaceId in Version Listing?
Users should be able to browse all versions without being tied to a specific workspace.

### Why Simulation Polling Instead of WebSocket?
Simpler implementation with 2-second polling interval. Future optimization can switch to WebSocket push.

### Why Auto-Verify Emails in Seed?
Demo environment doesn't need email verification complexity. Production would require email service integration.

## Next Steps

### Recommended Improvements
1. Add email verification service (nodemailer)
2. Implement WebSocket-based metrics streaming
3. Add A/B testing for design comparisons
4. Implement progressive constraints (unlock features)
5. Add guided hints system
6. Create performance reports generator
7. Implement workspace collaboration (real-time editing)
8. Add failure injection scenarios

### Known Limitations
- Scenarios route returns hardcoded data (not from database yet)
- Component routes are stubs
- No email service configured
- WebSocket for metrics not fully integrated
- No UI for workspace sharing

## Support

For issues or questions:
1. Check logs: Backend console and browser DevTools
2. Review this guide
3. Check specifications in `.kiro/specs/`
4. File issues with detailed reproduction steps

## License

Educational project - MIT License
