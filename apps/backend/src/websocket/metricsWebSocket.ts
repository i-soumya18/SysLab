/**
 * WebSocket handler for real-time metrics streaming
 * 
 * Implements SRS FR-5.2: Live metric streaming via WebSocket with sub-100ms updates
 */

import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { RealTimeMetricsService, MetricsSubscription } from '../services/realTimeMetricsService';
import { v4 as uuidv4 } from 'uuid';

export interface MetricsWebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping' | 'configure';
  data?: any;
  clientId?: string;
  timestamp?: number;
}

export interface MetricsWebSocketResponse {
  type: 'subscribed' | 'unsubscribed' | 'error' | 'pong' | 'metrics_update' | 'metrics_batch';
  data?: any;
  clientId?: string;
  timestamp: number;
}

export class MetricsWebSocketHandler {
  private wss: WebSocketServer;
  private metricsService: RealTimeMetricsService;
  private clients: Map<string, WebSocket> = new Map();
  private heartbeatInterval!: NodeJS.Timeout;

  constructor(port: number = 8081) {
    // Initialize real-time metrics service with optimized config for sub-100ms updates
    this.metricsService = new RealTimeMetricsService({
      updateInterval: 50, // 50ms updates (well under 100ms target)
      bufferSize: 1, // No buffering for real-time updates
      enableCompression: true,
      maxClientsPerWorkspace: 100
    });

    // Create WebSocket server
    this.wss = new WebSocketServer({ 
      port,
      perMessageDeflate: true, // Enable compression
      maxPayload: 1024 * 1024 // 1MB max payload
    });

    this.setupWebSocketServer();
    this.setupHeartbeat();
    this.setupMetricsServiceEvents();
  }

  /**
   * Setup WebSocket server event handlers
   */
  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      const clientId = uuidv4();
      this.clients.set(clientId, ws);

      console.log(`Metrics WebSocket client connected: ${clientId}`);

      // Setup client event handlers
      ws.on('message', (data: Buffer) => {
        this.handleMessage(clientId, ws, data);
      });

      ws.on('close', () => {
        console.log(`Metrics WebSocket client disconnected: ${clientId}`);
        this.clients.delete(clientId);
        this.metricsService.unsubscribe(clientId);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
        this.clients.delete(clientId);
        this.metricsService.unsubscribe(clientId);
      });

      // Send welcome message
      this.sendMessage(ws, {
        type: 'subscribed',
        clientId,
        data: { message: 'Connected to metrics stream' },
        timestamp: Date.now()
      });
    });

    this.wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });

    console.log(`Metrics WebSocket server listening on port ${this.wss.options.port}`);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(clientId: string, ws: WebSocket, data: Buffer): void {
    try {
      const message: MetricsWebSocketMessage = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(clientId, ws, message.data);
          break;
          
        case 'unsubscribe':
          this.handleUnsubscribe(clientId, ws);
          break;
          
        case 'ping':
          this.handlePing(clientId, ws);
          break;
          
        case 'configure':
          this.handleConfigure(clientId, ws, message.data);
          break;
          
        default:
          this.sendError(ws, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      this.sendError(ws, `Invalid message format: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle subscription request
   */
  private handleSubscribe(clientId: string, ws: WebSocket, subscriptionData: any): void {
    try {
      const subscription: MetricsSubscription = {
        workspaceId: subscriptionData.workspaceId,
        componentIds: subscriptionData.componentIds,
        updateTypes: subscriptionData.updateTypes || ['component', 'system', 'aggregated'],
        clientId
      };

      // Validate subscription data
      if (!subscription.workspaceId) {
        this.sendError(ws, 'workspaceId is required for subscription');
        return;
      }

      // Subscribe to metrics service
      this.metricsService.subscribe(ws, subscription);

      this.sendMessage(ws, {
        type: 'subscribed',
        clientId,
        data: {
          workspaceId: subscription.workspaceId,
          componentIds: subscription.componentIds,
          updateTypes: subscription.updateTypes
        },
        timestamp: Date.now()
      });

      console.log(`Client ${clientId} subscribed to workspace ${subscription.workspaceId}`);
    } catch (error) {
      this.sendError(ws, `Subscription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle unsubscribe request
   */
  private handleUnsubscribe(clientId: string, ws: WebSocket): void {
    this.metricsService.unsubscribe(clientId);
    
    this.sendMessage(ws, {
      type: 'unsubscribed',
      clientId,
      timestamp: Date.now()
    });

    console.log(`Client ${clientId} unsubscribed from metrics`);
  }

  /**
   * Handle ping request
   */
  private handlePing(clientId: string, ws: WebSocket): void {
    this.sendMessage(ws, {
      type: 'pong',
      clientId,
      timestamp: Date.now()
    });
  }

  /**
   * Handle configuration update
   */
  private handleConfigure(clientId: string, ws: WebSocket, configData: any): void {
    // Handle client-specific configuration if needed
    console.log(`Client ${clientId} configuration update:`, configData);
    
    this.sendMessage(ws, {
      type: 'subscribed', // Reuse subscribed type for acknowledgment
      clientId,
      data: { message: 'Configuration updated' },
      timestamp: Date.now()
    });
  }

  /**
   * Send message to WebSocket client
   */
  private sendMessage(ws: WebSocket, message: MetricsWebSocketResponse): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send WebSocket message:', error);
      }
    }
  }

  /**
   * Send error message to WebSocket client
   */
  private sendError(ws: WebSocket, errorMessage: string): void {
    this.sendMessage(ws, {
      type: 'error',
      data: { error: errorMessage },
      timestamp: Date.now()
    });
  }

  /**
   * Setup heartbeat to keep connections alive
   */
  private setupHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      });
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Setup metrics service event handlers
   */
  private setupMetricsServiceEvents(): void {
    this.metricsService.on('performance_warning', (data) => {
      console.warn(`Metrics performance warning:`, data);
      
      // Notify all clients about performance issues
      this.broadcast({
        type: 'error',
        data: {
          warning: 'Metrics update performance degraded',
          executionTime: data.executionTime,
          target: data.target
        },
        timestamp: Date.now()
      });
    });

    this.metricsService.on('metrics_collection_error', (data) => {
      console.error(`Metrics collection error:`, data);
      
      // Notify clients about collection errors
      this.broadcast({
        type: 'error',
        data: {
          error: 'Metrics collection failed',
          workspaceId: data.workspaceId,
          message: data.error
        },
        timestamp: Date.now()
      });
    });

    this.metricsService.on('client_subscribed', (data) => {
      console.log(`Metrics service: Client ${data.clientId} subscribed to workspace ${data.workspaceId}`);
    });

    this.metricsService.on('client_unsubscribed', (data) => {
      console.log(`Metrics service: Client ${data.clientId} unsubscribed`);
    });
  }

  /**
   * Broadcast message to all connected clients
   */
  private broadcast(message: MetricsWebSocketResponse): void {
    this.wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        this.sendMessage(ws, message);
      }
    });
  }

  /**
   * Get server statistics
   */
  getStats(): {
    connectedClients: number;
    activeWorkspaces: number;
    performanceStats: any;
  } {
    return {
      connectedClients: this.clients.size,
      activeWorkspaces: this.metricsService.getActiveClientCount(),
      performanceStats: this.metricsService.getPerformanceStats()
    };
  }

  /**
   * Shutdown the WebSocket server
   */
  shutdown(): void {
    console.log('Shutting down metrics WebSocket server...');
    
    // Clear heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all client connections
    this.wss.clients.forEach((ws) => {
      ws.close();
    });

    // Close server
    this.wss.close();

    // Cleanup metrics service
    this.metricsService.cleanup();

    console.log('Metrics WebSocket server shutdown complete');
  }
}