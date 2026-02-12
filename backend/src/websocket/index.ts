import { Server, Socket } from 'socket.io';
import { SimulationEngine } from '../simulation/SimulationEngine';
import { AuthService } from '../services/authService';
import { CollaborationService } from '../services/collaborationService';

// Lazy-load services to avoid initialization issues
let authService: AuthService;
let collaborationService: CollaborationService;

function getAuthService(): AuthService {
  if (!authService) {
    authService = new AuthService();
  }
  return authService;
}

function getCollaborationService(): CollaborationService {
  if (!collaborationService) {
    collaborationService = new CollaborationService();
  }
  return collaborationService;
}

interface AuthenticatedSocket extends Socket {
  userId?: string;
  workspaceId?: string;
}

interface WorkspaceJoinData {
  workspaceId: string;
  userId?: string;
}

interface SimulationControlData {
  workspaceId: string;
  action: 'start' | 'stop' | 'pause' | 'resume';
  parameters?: any;
}

interface CanvasUpdateData {
  workspaceId: string;
  type: 'component-added' | 'component-updated' | 'component-removed' | 'connection-created' | 'connection-removed';
  data: any;
}

interface CollaborationData {
  workspaceId: string;
  operation: {
    type: 'component-add' | 'component-update' | 'component-delete' | 'connection-create' | 'connection-delete';
    data: any;
  };
}

interface CursorData {
  workspaceId: string;
  position: { x: number; y: number };
}

interface SelectionData {
  workspaceId: string;
  selectedIds: string[];
}

// Store active simulation engines per workspace
const activeSimulations = new Map<string, SimulationEngine>();

export function setupWebSocket(io: Server): void {
  // Middleware for authentication
  io.use(async (socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization;
    
    if (token) {
      try {
        // Extract token if it's in Bearer format
        const actualToken = token.startsWith('Bearer ') ? token.substring(7) : token;
        
        // Verify token using auth service
        const verification = await getAuthService().verifyToken(actualToken);
        
        if (verification.valid && verification.user) {
          socket.userId = verification.user.id;
          console.log(`Authenticated WebSocket connection for user: ${verification.user.email}`);
        } else {
          console.log('Invalid token provided for WebSocket connection');
        }
      } catch (error) {
        console.log('WebSocket authentication error:', error);
      }
    } else {
      console.log('No authentication token provided for WebSocket connection');
    }
    
    // Allow connection regardless of authentication status
    // Individual operations will check authentication as needed
    next();
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`Client connected: ${socket.id}`);
    
    // Send connection confirmation
    socket.emit('connection:established', {
      socketId: socket.id,
      timestamp: new Date().toISOString()
    });

    // Join workspace room for real-time updates and collaboration
    socket.on('join-workspace', async (data: WorkspaceJoinData, callback) => {
      try {
        const { workspaceId, userId } = data;
        
        if (!workspaceId) {
          callback?.({ error: 'Workspace ID is required' });
          return;
        }

        // Leave previous workspace if any
        if (socket.workspaceId) {
          socket.leave(`workspace-${socket.workspaceId}`);
          
          // End collaboration session for previous workspace
          if (socket.userId) {
            await getCollaborationService().endSession(socket.workspaceId, socket.userId);
          }
        }

        // Join new workspace
        socket.join(`workspace-${workspaceId}`);
        socket.workspaceId = workspaceId;
        socket.userId = userId;

        console.log(`Client ${socket.id} joined workspace ${workspaceId}`);
        
        // Start collaboration session if user is authenticated
        if (userId) {
          try {
            const session = await getCollaborationService().startSession(workspaceId, userId, socket.id);
            
            // Send presence info to joining user
            const presenceInfo = getCollaborationService().getPresenceInfo(workspaceId);
            socket.emit('collaboration:presence', {
              participants: presenceInfo,
              timestamp: new Date().toISOString()
            });

            // Notify other clients about new participant
            socket.to(`workspace-${workspaceId}`).emit('collaboration:participant-joined', {
              userId,
              socketId: socket.id,
              color: presenceInfo.find(p => p.userId === userId)?.color,
              timestamp: new Date().toISOString()
            });
          } catch (error) {
            console.error('Failed to start collaboration session:', error);
            // Continue without collaboration features
          }
        }
        
        // Notify other clients in the workspace
        socket.to(`workspace-${workspaceId}`).emit('user:joined', {
          socketId: socket.id,
          userId,
          timestamp: new Date().toISOString()
        });

        // Send current simulation status if one exists
        const simulation = activeSimulations.get(workspaceId);
        if (simulation) {
          const state = simulation.getState();
          const systemMetrics = simulation.getRealtimeSystemMetrics();
          
          socket.emit('simulation:status', {
            isRunning: state.isRunning,
            currentTime: state.currentTime,
            eventCount: state.eventCount,
            systemMetrics,
            timestamp: new Date().toISOString()
          });
        }

        callback?.({ success: true, workspaceId });
      } catch (error) {
        console.error('Error joining workspace:', error);
        callback?.({ error: 'Failed to join workspace' });
      }
    });

    // Leave workspace room
    socket.on('leave-workspace', async (workspaceId: string, callback) => {
      try {
        socket.leave(`workspace-${workspaceId}`);
        
        // End collaboration session
        if (socket.userId) {
          await getCollaborationService().endSession(workspaceId, socket.userId);
        }
        
        // Notify other clients
        socket.to(`workspace-${workspaceId}`).emit('user:left', {
          socketId: socket.id,
          userId: socket.userId,
          timestamp: new Date().toISOString()
        });

        socket.to(`workspace-${workspaceId}`).emit('collaboration:participant-left', {
          userId: socket.userId,
          socketId: socket.id,
          timestamp: new Date().toISOString()
        });

        if (socket.workspaceId === workspaceId) {
          socket.workspaceId = undefined;
        }

        console.log(`Client ${socket.id} left workspace ${workspaceId}`);
        callback?.({ success: true });
      } catch (error) {
        console.error('Error leaving workspace:', error);
        callback?.({ error: 'Failed to leave workspace' });
      }
    });

    // Handle simulation control events
    socket.on('simulation:control', async (data: SimulationControlData, callback) => {
      try {
        console.log(`Simulation ${data.action} requested for workspace ${data.workspaceId}`);
        
        // Validate workspace access
        if (socket.workspaceId !== data.workspaceId) {
          callback?.({ error: 'Not authorized for this workspace' });
          return;
        }

        let simulation = activeSimulations.get(data.workspaceId);

        switch (data.action) {
          case 'start':
            if (simulation && simulation.getState().isRunning) {
              callback?.({ error: 'Simulation is already running' });
              return;
            }

            // Create new simulation if none exists
            if (!simulation) {
              simulation = new SimulationEngine();
              activeSimulations.set(data.workspaceId, simulation);
              setupSimulationEventHandlers(simulation, data.workspaceId, io);
            }

            // Initialize and start simulation with workspace data
            if (data.parameters?.workspace) {
              simulation.initialize(data.parameters.workspace);
              await simulation.start();
            } else {
              callback?.({ error: 'Workspace configuration required to start simulation' });
              return;
            }
            break;

          case 'stop':
            if (!simulation || !simulation.getState().isRunning) {
              callback?.({ error: 'No running simulation to stop' });
              return;
            }
            simulation.stop();
            break;

          case 'pause':
            if (!simulation || !simulation.getState().isRunning) {
              callback?.({ error: 'No running simulation to pause' });
              return;
            }
            simulation.pause();
            break;

          case 'resume':
            if (!simulation || simulation.getState().isRunning) {
              callback?.({ error: 'No paused simulation to resume' });
              return;
            }
            simulation.resume();
            break;
        }

        // Broadcast simulation control to all clients in workspace
        socket.to(`workspace-${data.workspaceId}`).emit('simulation:control', {
          action: data.action,
          parameters: data.parameters,
          initiatedBy: socket.userId || socket.id,
          timestamp: new Date().toISOString()
        });

        callback?.({ success: true, action: data.action });
      } catch (error) {
        console.error('Error handling simulation control:', error);
        callback?.({ error: 'Failed to process simulation control' });
      }
    });

    // Handle canvas updates
    socket.on('canvas:update', (data: CanvasUpdateData, callback) => {
      try {
        console.log(`Canvas update: ${data.type} in workspace ${data.workspaceId}`);
        
        // Validate workspace access
        if (socket.workspaceId !== data.workspaceId) {
          callback?.({ error: 'Not authorized for this workspace' });
          return;
        }

        // Broadcast to other clients in the same workspace
        socket.to(`workspace-${data.workspaceId}`).emit('canvas:update', {
          type: data.type,
          data: data.data,
          updatedBy: socket.userId || socket.id,
          timestamp: new Date().toISOString()
        });

        callback?.({ success: true, type: data.type });
      } catch (error) {
        console.error('Error handling canvas update:', error);
        callback?.({ error: 'Failed to process canvas update' });
      }
    });

    // Handle collaborative operations with operational transformation
    socket.on('collaboration:operation', async (data: CollaborationData, callback) => {
      try {
        console.log(`Collaboration operation: ${data.operation.type} in workspace ${data.workspaceId}`);
        
        // Validate workspace access
        if (socket.workspaceId !== data.workspaceId || !socket.userId) {
          callback?.({ error: 'Not authorized for this workspace or not authenticated' });
          return;
        }

        // Apply operation with operational transformation
        const transformedOperation = await getCollaborationService().applyOperation(data.workspaceId, {
          sessionId: '', // Will be set by service
          userId: socket.userId,
          type: data.operation.type,
          data: data.operation.data
        });

        // Broadcast transformed operation to all clients in workspace
        io.to(`workspace-${data.workspaceId}`).emit('collaboration:operation-applied', {
          operation: transformedOperation,
          timestamp: new Date().toISOString()
        });

        callback?.({ 
          success: true, 
          operationId: transformedOperation.id,
          wasTransformed: transformedOperation.transformedFrom !== undefined
        });
      } catch (error) {
        console.error('Error handling collaboration operation:', error);
        callback?.({ error: 'Failed to process collaboration operation' });
      }
    });

    // Handle cursor movement
    socket.on('collaboration:cursor', async (data: CursorData, callback) => {
      try {
        // Validate workspace access
        if (socket.workspaceId !== data.workspaceId || !socket.userId) {
          callback?.({ error: 'Not authorized for this workspace or not authenticated' });
          return;
        }

        // Update cursor position
        await getCollaborationService().updateCursor(data.workspaceId, socket.userId, data.position);

        // Broadcast cursor update to other clients (not to sender)
        socket.to(`workspace-${data.workspaceId}`).emit('collaboration:cursor-updated', {
          userId: socket.userId,
          position: data.position,
          timestamp: new Date().toISOString()
        });

        callback?.({ success: true });
      } catch (error) {
        console.error('Error handling cursor update:', error);
        callback?.({ error: 'Failed to update cursor' });
      }
    });

    // Handle selection changes
    socket.on('collaboration:selection', async (data: SelectionData, callback) => {
      try {
        // Validate workspace access
        if (socket.workspaceId !== data.workspaceId || !socket.userId) {
          callback?.({ error: 'Not authorized for this workspace or not authenticated' });
          return;
        }

        // Update selection
        await getCollaborationService().updateSelection(data.workspaceId, socket.userId, data.selectedIds);

        // Broadcast selection update to other clients (not to sender)
        socket.to(`workspace-${data.workspaceId}`).emit('collaboration:selection-updated', {
          userId: socket.userId,
          selectedIds: data.selectedIds,
          timestamp: new Date().toISOString()
        });

        callback?.({ success: true });
      } catch (error) {
        console.error('Error handling selection update:', error);
        callback?.({ error: 'Failed to update selection' });
      }
    });

    // Handle presence requests
    socket.on('collaboration:get-presence', (workspaceId: string, callback) => {
      try {
        if (socket.workspaceId !== workspaceId) {
          callback?.({ error: 'Not authorized for this workspace' });
          return;
        }

        const presenceInfo = getCollaborationService().getPresenceInfo(workspaceId);
        callback?.({ success: true, participants: presenceInfo });
      } catch (error) {
        console.error('Error getting presence info:', error);
        callback?.({ error: 'Failed to get presence info' });
      }
    });

    // Handle ping for connection health check
    socket.on('ping', (callback) => {
      callback?.({ 
        pong: true, 
        timestamp: new Date().toISOString(),
        socketId: socket.id 
      });
    });

    // Handle disconnect
    socket.on('disconnect', async (reason) => {
      console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
      
      // End collaboration session if user was in a workspace
      if (socket.workspaceId && socket.userId) {
        try {
          await getCollaborationService().endSession(socket.workspaceId, socket.userId);
          
          // Notify workspace members
          socket.to(`workspace-${socket.workspaceId}`).emit('collaboration:participant-left', {
            userId: socket.userId,
            socketId: socket.id,
            reason,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          console.error('Error ending collaboration session on disconnect:', error);
        }
      }
      
      // Notify workspace members if user was in a workspace
      if (socket.workspaceId) {
        socket.to(`workspace-${socket.workspaceId}`).emit('user:disconnected', {
          socketId: socket.id,
          userId: socket.userId,
          reason,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Handle connection errors
    socket.on('error', (error) => {
      console.error(`Socket error for client ${socket.id}:`, error);
    });
  });

  // Handle server-level errors
  io.engine.on('connection_error', (err) => {
    console.error('WebSocket connection error:', err);
  });

  console.log('WebSocket handlers configured with authentication and error handling');
}

/**
 * Set up event handlers for simulation engine to broadcast real-time updates
 */
function setupSimulationEventHandlers(simulation: SimulationEngine, workspaceId: string, io: Server): void {
  // Simulation lifecycle events
  simulation.on('started', (data) => {
    io.to(`workspace-${workspaceId}`).emit('simulation:started', {
      ...data,
      timestamp: new Date().toISOString()
    });
  });

  simulation.on('stopped', (data) => {
    io.to(`workspace-${workspaceId}`).emit('simulation:stopped', {
      ...data,
      timestamp: new Date().toISOString()
    });
    
    // Clean up simulation instance
    activeSimulations.delete(workspaceId);
  });

  simulation.on('error', (error) => {
    io.to(`workspace-${workspaceId}`).emit('simulation:error', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
  });

  // Real-time metrics updates
  simulation.on('metrics_collected', (metrics) => {
    io.to(`workspace-${workspaceId}`).emit('simulation:metrics', {
      type: 'component_metrics',
      data: metrics,
      timestamp: new Date().toISOString()
    });
  });

  // System-wide metrics updates
  simulation.getMetricsCollector().on('metrics_aggregated', (data) => {
    io.to(`workspace-${workspaceId}`).emit('simulation:metrics', {
      type: 'system_metrics',
      data: data.systemMetrics,
      timestamp: new Date().toISOString()
    });
  });

  // Component events
  simulation.on('request_arrived', (data) => {
    io.to(`workspace-${workspaceId}`).emit('simulation:event', {
      type: 'request_arrived',
      data,
      timestamp: new Date().toISOString()
    });
  });

  simulation.on('request_completed', (data) => {
    io.to(`workspace-${workspaceId}`).emit('simulation:event', {
      type: 'request_completed',
      data,
      timestamp: new Date().toISOString()
    });
  });

  simulation.on('component_failed', (data) => {
    io.to(`workspace-${workspaceId}`).emit('simulation:event', {
      type: 'component_failed',
      data,
      timestamp: new Date().toISOString()
    });
  });

  simulation.on('component_recovered', (data) => {
    io.to(`workspace-${workspaceId}`).emit('simulation:event', {
      type: 'component_recovered',
      data,
      timestamp: new Date().toISOString()
    });
  });

  // Bottleneck analysis events
  simulation.on('bottleneck_report', (report) => {
    io.to(`workspace-${workspaceId}`).emit('simulation:bottleneck', {
      type: 'bottleneck_report',
      data: report,
      timestamp: new Date().toISOString()
    });
  });

  simulation.on('bottleneck_alert', (alert) => {
    io.to(`workspace-${workspaceId}`).emit('simulation:bottleneck', {
      type: 'bottleneck_alert',
      data: alert,
      timestamp: new Date().toISOString()
    });
  });

  // Load pattern events
  simulation.on('load_pattern_scheduled', (data) => {
    io.to(`workspace-${workspaceId}`).emit('simulation:load', {
      type: 'load_pattern_scheduled',
      data,
      timestamp: new Date().toISOString()
    });
  });

  simulation.on('load_changed', (data) => {
    io.to(`workspace-${workspaceId}`).emit('simulation:load', {
      type: 'load_changed',
      data,
      timestamp: new Date().toISOString()
    });
  });

  // Failure events
  simulation.on('failure_injected', (data) => {
    io.to(`workspace-${workspaceId}`).emit('simulation:failure', {
      type: 'failure_injected',
      data,
      timestamp: new Date().toISOString()
    });
  });

  simulation.on('random_failure_occurred', (data) => {
    io.to(`workspace-${workspaceId}`).emit('simulation:failure', {
      type: 'random_failure_occurred',
      data,
      timestamp: new Date().toISOString()
    });
  });

  // Event processing updates (throttled to avoid spam)
  let lastEventUpdate = 0;
  simulation.on('event_processed', (event) => {
    const now = Date.now();
    if (now - lastEventUpdate > 1000) { // Throttle to once per second
      const state = simulation.getState();
      io.to(`workspace-${workspaceId}`).emit('simulation:progress', {
        currentTime: state.currentTime,
        eventCount: state.eventCount,
        isRunning: state.isRunning,
        timestamp: new Date().toISOString()
      });
      lastEventUpdate = now;
    }
  });
}