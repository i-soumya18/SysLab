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
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173"
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