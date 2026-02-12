import { io, Socket } from 'socket.io-client';

interface WebSocketConfig {
  url: string;
  token?: string;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
}

interface ConnectionStatus {
  connected: boolean;
  connecting: boolean;
  error?: string;
  lastConnected?: Date;
}

interface SimulationMetrics {
  timestamp: string;
  latency: number;
  throughput: number;
  errorRate: number;
  resourceUtilization: {
    cpu: number;
    memory: number;
    network: number;
  };
}

interface CanvasUpdate {
  type: 'component-added' | 'component-updated' | 'component-removed' | 'connection-created' | 'connection-removed';
  data: any;
  updatedBy: string;
  timestamp: string;
}

export interface CollaborationOperation {
  type: 'component-add' | 'component-update' | 'component-delete' | 'connection-create' | 'connection-delete';
  data: any;
}

export interface CursorPosition {
  x: number;
  y: number;
}

export interface ParticipantInfo {
  userId: string;
  socketId: string;
  cursor: CursorPosition;
  selection: string[];
  color: string;
  isActive: boolean;
  lastSeen: Date;
}

interface CollaborationEvent {
  operation?: {
    id: string;
    userId: string;
    type: string;
    data: any;
    timestamp: Date;
    wasTransformed?: boolean;
  };
  userId?: string;
  position?: CursorPosition;
  selectedIds?: string[];
  participants?: ParticipantInfo[];
  timestamp: string;
}

export class WebSocketService {
  private socket: Socket | null = null;
  private config: WebSocketConfig;
  private connectionStatus: ConnectionStatus = {
    connected: false,
    connecting: false
  };
  private currentWorkspaceId: string | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;

  // Event listeners
  private listeners: Map<string, Set<Function>> = new Map();

  constructor(config: WebSocketConfig) {
    this.config = {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      ...config
    };
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    if (this.socket?.connected) {
      return;
    }

    this.connectionStatus.connecting = true;
    this.connectionStatus.error = undefined;

    try {
      this.socket = io(this.config.url, {
        auth: {
          token: this.config.token
        },
        reconnection: true,
        reconnectionAttempts: this.config.reconnectionAttempts,
        reconnectionDelay: this.config.reconnectionDelay,
        timeout: 10000
      });

      this.setupEventHandlers();
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        this.socket!.on('connect', () => {
          clearTimeout(timeout);
          this.connectionStatus.connected = true;
          this.connectionStatus.connecting = false;
          this.connectionStatus.lastConnected = new Date();
          this.startPingInterval();
          this.emit('connection:status', this.connectionStatus);
          resolve();
        });

        this.socket!.on('connect_error', (error) => {
          clearTimeout(timeout);
          this.connectionStatus.connecting = false;
          this.connectionStatus.error = error.message;
          this.emit('connection:status', this.connectionStatus);
          reject(error);
        });
      });
    } catch (error) {
      this.connectionStatus.connecting = false;
      this.connectionStatus.error = error instanceof Error ? error.message : 'Unknown error';
      this.emit('connection:status', this.connectionStatus);
      throw error;
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.connectionStatus.connected = false;
    this.connectionStatus.connecting = false;
    this.currentWorkspaceId = null;
    this.emit('connection:status', this.connectionStatus);
  }

  /**
   * Join a workspace for real-time updates
   */
  async joinWorkspace(workspaceId: string, userId?: string): Promise<void> {
    if (!this.socket?.connected) {
      throw new Error('WebSocket not connected');
    }

    return new Promise((resolve, reject) => {
      this.socket!.emit('join-workspace', { workspaceId, userId }, (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          this.currentWorkspaceId = workspaceId;
          this.emit('workspace:joined', { workspaceId, userId });
          resolve();
        }
      });
    });
  }

  /**
   * Leave current workspace
   */
  async leaveWorkspace(): Promise<void> {
    if (!this.socket?.connected || !this.currentWorkspaceId) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.socket!.emit('leave-workspace', this.currentWorkspaceId, (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          const leftWorkspaceId = this.currentWorkspaceId;
          this.currentWorkspaceId = null;
          this.emit('workspace:left', { workspaceId: leftWorkspaceId });
          resolve();
        }
      });
    });
  }

  /**
   * Send simulation control command
   */
  async controlSimulation(action: 'start' | 'stop' | 'pause' | 'resume', parameters?: any): Promise<void> {
    if (!this.socket?.connected || !this.currentWorkspaceId) {
      throw new Error('WebSocket not connected or no workspace joined');
    }

    return new Promise((resolve, reject) => {
      this.socket!.emit('simulation:control', {
        workspaceId: this.currentWorkspaceId,
        action,
        parameters
      }, (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Send canvas update
   */
  async updateCanvas(type: CanvasUpdate['type'], data: any): Promise<void> {
    if (!this.socket?.connected || !this.currentWorkspaceId) {
      throw new Error('WebSocket not connected or no workspace joined');
    }

    return new Promise((resolve, reject) => {
      this.socket!.emit('canvas:update', {
        workspaceId: this.currentWorkspaceId,
        type,
        data
      }, (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Send collaborative operation
   */
  async sendCollaborationOperation(operation: CollaborationOperation): Promise<void> {
    if (!this.socket?.connected || !this.currentWorkspaceId) {
      throw new Error('WebSocket not connected or no workspace joined');
    }

    return new Promise((resolve, reject) => {
      this.socket!.emit('collaboration:operation', {
        workspaceId: this.currentWorkspaceId,
        operation
      }, (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Update cursor position
   */
  async updateCursor(position: CursorPosition): Promise<void> {
    if (!this.socket?.connected || !this.currentWorkspaceId) {
      return; // Silently fail for cursor updates
    }

    this.socket.emit('collaboration:cursor', {
      workspaceId: this.currentWorkspaceId,
      position
    });
  }

  /**
   * Update selection
   */
  async updateSelection(selectedIds: string[]): Promise<void> {
    if (!this.socket?.connected || !this.currentWorkspaceId) {
      return; // Silently fail for selection updates
    }

    this.socket.emit('collaboration:selection', {
      workspaceId: this.currentWorkspaceId,
      selectedIds
    });
  }

  /**
   * Get current presence information
   */
  async getPresenceInfo(): Promise<ParticipantInfo[]> {
    if (!this.socket?.connected || !this.currentWorkspaceId) {
      return [];
    }

    return new Promise((resolve, reject) => {
      this.socket!.emit('collaboration:get-presence', this.currentWorkspaceId, (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response.participants || []);
        }
      });
    });
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return { ...this.connectionStatus };
  }

  /**
   * Get current workspace ID
   */
  getCurrentWorkspaceId(): string | null {
    return this.currentWorkspaceId;
  }

  /**
   * Add event listener
   */
  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  /**
   * Remove event listener
   */
  off(event: string, listener: Function): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener);
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, data?: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in WebSocket event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.connectionStatus.connected = true;
      this.connectionStatus.connecting = false;
      this.connectionStatus.error = undefined;
      this.connectionStatus.lastConnected = new Date();
      this.emit('connection:status', this.connectionStatus);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.connectionStatus.connected = false;
      this.emit('connection:status', this.connectionStatus);
      
      // Attempt reconnection for certain disconnect reasons
      if (reason === 'io server disconnect') {
        this.scheduleReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.connectionStatus.connecting = false;
      this.connectionStatus.error = error.message;
      this.emit('connection:status', this.connectionStatus);
      this.scheduleReconnect();
    });

    // Workspace events
    this.socket.on('user:joined', (data) => {
      this.emit('workspace:user-joined', data);
    });

    this.socket.on('user:left', (data) => {
      this.emit('workspace:user-left', data);
    });

    this.socket.on('user:disconnected', (data) => {
      this.emit('workspace:user-disconnected', data);
    });

    // Simulation events
    this.socket.on('simulation:started', (data) => {
      this.emit('simulation:started', data);
    });

    this.socket.on('simulation:stopped', (data) => {
      this.emit('simulation:stopped', data);
    });

    this.socket.on('simulation:status', (data) => {
      this.emit('simulation:status', data);
    });

    this.socket.on('simulation:control', (data) => {
      this.emit('simulation:control', data);
    });

    this.socket.on('simulation:metrics', (data: SimulationMetrics) => {
      this.emit('simulation:metrics', data);
    });

    this.socket.on('simulation:event', (data) => {
      this.emit('simulation:event', data);
    });

    this.socket.on('simulation:progress', (data) => {
      this.emit('simulation:progress', data);
    });

    this.socket.on('simulation:bottleneck', (data) => {
      this.emit('simulation:bottleneck', data);
    });

    this.socket.on('simulation:load', (data) => {
      this.emit('simulation:load', data);
    });

    this.socket.on('simulation:failure', (data) => {
      this.emit('simulation:failure', data);
    });

    this.socket.on('simulation:completed', (data) => {
      this.emit('simulation:completed', data);
    });

    this.socket.on('simulation:error', (data) => {
      this.emit('simulation:error', data);
    });

    // Canvas events
    this.socket.on('canvas:update', (data: CanvasUpdate) => {
      this.emit('canvas:update', data);
    });

    // Collaboration events
    this.socket.on('collaboration:presence', (data: CollaborationEvent) => {
      this.emit('collaboration:presence', data);
    });

    this.socket.on('collaboration:participant-joined', (data: CollaborationEvent) => {
      this.emit('collaboration:participant-joined', data);
    });

    this.socket.on('collaboration:participant-left', (data: CollaborationEvent) => {
      this.emit('collaboration:participant-left', data);
    });

    this.socket.on('collaboration:operation-applied', (data: CollaborationEvent) => {
      this.emit('collaboration:operation-applied', data);
    });

    this.socket.on('collaboration:cursor-updated', (data: CollaborationEvent) => {
      this.emit('collaboration:cursor-updated', data);
    });

    this.socket.on('collaboration:selection-updated', (data: CollaborationEvent) => {
      this.emit('collaboration:selection-updated', data);
    });

    // Connection confirmation
    this.socket.on('connection:established', (data) => {
      console.log('WebSocket connection established:', data);
      this.emit('connection:established', data);
    });
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.socket?.connected) {
        console.log('Attempting to reconnect WebSocket...');
        this.connect().catch(error => {
          console.error('Reconnection failed:', error);
        });
      }
    }, this.config.reconnectionDelay);
  }

  /**
   * Start ping interval to keep connection alive
   */
  private startPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.pingInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping', (response: any) => {
          if (!response?.pong) {
            console.warn('Ping response not received, connection may be unstable');
          }
        });
      }
    }, 30000); // Ping every 30 seconds
  }
}

// Singleton instance
let webSocketService: WebSocketService | null = null;

/**
 * Get WebSocket service instance
 */
export function getWebSocketService(config?: WebSocketConfig): WebSocketService {
  if (!webSocketService && config) {
    webSocketService = new WebSocketService(config);
  }
  
  if (!webSocketService) {
    throw new Error('WebSocket service not initialized. Provide config on first call.');
  }
  
  return webSocketService;
}

/**
 * Initialize WebSocket service
 */
export function initializeWebSocket(config: WebSocketConfig): WebSocketService {
  webSocketService = new WebSocketService(config);
  return webSocketService;
}