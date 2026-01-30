# System Design Simulator

An interactive professional self-learning platform that enables users to learn, practice, and experiment with various system design components through hands-on simulation and parameter tuning.

## Features

- 🎨 **Interactive Canvas**: Drag-and-drop interface for building system architectures
- 🔧 **Component Library**: Comprehensive library of system design components (databases, load balancers, caches, etc.)
- 🔗 **Visual Wiring**: Connect components with visual wires representing data flow
- ⚙️ **Parameter Tuning**: Adjust component configurations and see real-time effects
- 📊 **Real-time Simulation**: Run simulations with realistic load patterns and performance metrics
- 📈 **Performance Analytics**: Visualize system performance through interactive charts and dashboards
- 🎯 **Learning Scenarios**: Guided exercises with specific objectives and challenges
- 💾 **Workspace Management**: Save, load, and share system designs

## Architecture

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL
- **Cache**: Redis
- **Real-time**: Socket.IO
- **Testing**: Vitest + fast-check (Property-Based Testing)

## Prerequisites

- Node.js 18+ 
- Docker and Docker Compose
- npm or yarn

## Quick Start

1. **Clone and setup the project:**
   ```bash
   git clone <repository-url>
   cd system-design-simulator
   ```

2. **Run the development setup script:**
   ```bash
   ./scripts/setup-dev.sh
   ```

3. **Start the development servers:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - Health Check: http://localhost:3000/health

## Manual Setup

If you prefer to set up manually:

1. **Start database services:**
   ```bash
   docker-compose up -d postgres redis
   ```

2. **Install dependencies:**
   ```bash
   npm install
   cd frontend && npm install && cd ..
   cd backend && npm install && cd ..
   ```

3. **Start development servers:**
   ```bash
   # Start both frontend and backend
   npm run dev

   # Or start individually
   npm run dev:frontend  # Frontend only
   npm run dev:backend   # Backend only
   ```

## Environment Configuration

Copy the example environment file and adjust as needed:

```bash
cp backend/.env.example backend/.env
```

Key environment variables:
- `PORT`: Backend server port (default: 3000)
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`: PostgreSQL configuration
- `REDIS_URL`: Redis connection URL
- `FRONTEND_URL`: Frontend URL for CORS configuration

## Database Services

The project uses Docker Compose to manage PostgreSQL and Redis:

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs postgres
docker-compose logs redis

# Connect to PostgreSQL
docker-compose exec postgres psql -U postgres -d system_design_simulator

# Connect to Redis
docker-compose exec redis redis-cli
```

## Development Scripts

```bash
# Development
npm run dev              # Start both frontend and backend
npm run dev:frontend     # Start frontend only
npm run dev:backend      # Start backend only

# Building
npm run build            # Build both frontend and backend
npm run build:frontend   # Build frontend only
npm run build:backend    # Build backend only

# Testing
npm run test             # Run all tests
npm run test:frontend    # Run frontend tests
npm run test:backend     # Run backend tests
```

## Project Structure

```
system-design-simulator/
├── frontend/                 # React frontend application
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── backend/                  # Node.js backend API
│   ├── src/
│   │   ├── config/          # Database and Redis configuration
│   │   ├── routes/          # API route handlers
│   │   ├── websocket/       # WebSocket event handlers
│   │   └── index.ts         # Main server file
│   ├── package.json
│   └── tsconfig.json
├── database/                 # Database initialization scripts
├── scripts/                  # Development and deployment scripts
├── docker-compose.yml        # Docker services configuration
└── package.json             # Root workspace configuration
```

## API Endpoints

- `GET /health` - Health check
- `GET /api/v1` - API information
- `GET /api/v1/workspaces` - List workspaces
- `POST /api/v1/workspaces` - Create workspace
- `GET /api/v1/workspaces/:id` - Get workspace
- `PUT /api/v1/workspaces/:id` - Update workspace
- `DELETE /api/v1/workspaces/:id` - Delete workspace

## WebSocket Events

- `join-workspace` - Join workspace for real-time updates
- `leave-workspace` - Leave workspace
- `simulation:start` - Start simulation
- `simulation:stop` - Stop simulation
- `canvas:component-added` - Component added to canvas
- `canvas:component-updated` - Component updated
- `canvas:connection-created` - Connection created

## Testing

The project uses a dual testing approach:

- **Unit Tests**: Specific examples and edge cases using Vitest
- **Property-Based Tests**: Universal properties using fast-check

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:frontend -- --watch
npm run test:backend -- --watch
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see LICENSE file for details