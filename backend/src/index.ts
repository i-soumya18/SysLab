import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { setupDatabase } from './config/database';
import { setupRedis } from './config/redis';
import { setupRoutes } from './routes';
import { setupWebSocket } from './websocket';

// Lazy-load auth service to avoid initialization issues
let authService: any;
function getAuthService() {
  if (!authService) {
    const { AuthService } = require('./services/authService');
    authService = new AuthService();
  }
  return authService;
}

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);

// Configure CORS origins for different environments
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:8080',  // Gateway in dev mode
  'http://localhost:5173',  // Direct frontend dev server
  'http://frontend:5173',   // Docker internal
  'http://frontend',         // Docker internal (production)
];

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST"],
    credentials: true
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(morgan('combined'));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function startServer() {
  try {
    // Initialize database connection
    await setupDatabase();
    console.log('✅ Database connected');

    // Initialize Redis connection
    await setupRedis();
    console.log('✅ Redis connected');

    // Lazy-load scalability services after database is ready
    const { horizontalScalingService, loadBalancerService, userMonitoringService } = require('./routes/scalabilityRoutes');
    const { createScalabilityMiddleware, scalabilityMiddleware } = require('./middleware/scalabilityMiddleware');

    // Initialize services explicitly with error handling
    console.log('⏳ Initializing services...');

    try {
      await horizontalScalingService.initialize();
      console.log('✅ Horizontal scaling service initialized');
    } catch (error) {
      console.warn('⚠️  Horizontal scaling service initialization failed (non-fatal):', error);
    }

    try {
      await loadBalancerService.initialize();
      console.log('✅ Load balancer service initialized');
    } catch (error) {
      console.warn('⚠️  Load balancer service initialization failed (non-fatal):', error);
    }

    try {
      await userMonitoringService.initialize();
      console.log('✅ User monitoring service initialized');
    } catch (error) {
      console.warn('⚠️  User monitoring service initialization failed (non-fatal):', error);
    }

    // Initialize simulation workload service
    try {
      const { simulationWorkloadService } = require('./services/simulationWorkloadService');
      await simulationWorkloadService.initialize();
      console.log('✅ Simulation workload service initialized');
    } catch (error) {
      console.warn('⚠️  Simulation workload service initialization failed (non-fatal):', error);
    }

    // Initialize scalability middleware
    const scalabilityMiddlewareInstance = createScalabilityMiddleware(
      loadBalancerService,
      userMonitoringService,
      horizontalScalingService,
      {
        enableLoadBalancing: process.env.ENABLE_LOAD_BALANCING !== 'false',
        enableUserTracking: process.env.ENABLE_USER_TRACKING !== 'false',
        enableMetricsCollection: process.env.ENABLE_METRICS_COLLECTION !== 'false',
        trackSimulationActivity: true,
        trackWorkspaceActivity: true
      }
    );

    // Apply scalability middleware
    app.use(...scalabilityMiddleware.fullStack(scalabilityMiddlewareInstance));

    // Setup API routes
    setupRoutes(app);
    console.log('✅ API routes configured');

    // Setup WebSocket handlers
    setupWebSocket(io);
    console.log('✅ WebSocket configured');

    // Setup periodic session cleanup
    setInterval(() => {
      getAuthService().cleanupExpiredSessions();
    }, 60 * 60 * 1000); // Clean up every hour
    console.log('✅ Session cleanup scheduled');

    // Start server
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

startServer();