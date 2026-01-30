import { useEffect, useState, useCallback, useRef } from 'react';
import { getWebSocketService, WebSocketService } from '../services/websocket';

interface UseWebSocketOptions {
  url?: string;
  token?: string;
  autoConnect?: boolean;
  workspaceId?: string;
  userId?: string;
}

interface ConnectionStatus {
  connected: boolean;
  connecting: boolean;
  error?: string;
  lastConnected?: Date;
}

interface SimulationMetrics {
  timestamp: string;
  type: 'component_metrics' | 'system_metrics';
  data: any;
}

interface SimulationEvent {
  type: string;
  data: any;
  timestamp: string;
}

interface SimulationProgress {
  currentTime: number;
  eventCount: number;
  isRunning: boolean;
  timestamp: string;
}

interface SimulationStatus {
  isRunning: boolean;
  currentTime: number;
  eventCount: number;
  systemMetrics?: any;
  timestamp: string;
}

interface CanvasUpdate {
  type: 'component-added' | 'component-updated' | 'component-removed' | 'connection-created' | 'connection-removed';
  data: any;
  updatedBy: string;
  timestamp: string;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    url = import.meta.env.VITE_WEBSOCKET_URL || 'http://localhost:3000',
    token,
    autoConnect = true,
    workspaceId,
    userId
  } = options;

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    connecting: false
  });
  const [simulationMetrics, setSimulationMetrics] = useState<SimulationMetrics | null>(null);
  const [simulationEvents, setSimulationEvents] = useState<SimulationEvent[]>([]);
  const [simulationProgress, setSimulationProgress] = useState<SimulationProgress | null>(null);
  const [simulationStatus, setSimulationStatus] = useState<SimulationStatus | null>(null);
  const [canvasUpdates, setCanvasUpdates] = useState<CanvasUpdate[]>([]);
  const [workspaceUsers, setWorkspaceUsers] = useState<Set<string>>(new Set());

  const webSocketService = useRef<WebSocketService | null>(null);
  const eventListenersRef = useRef<Map<string, Function>>(new Map());

  // Initialize WebSocket service
  useEffect(() => {
    if (!webSocketService.current) {
      webSocketService.current = getWebSocketService({ url, token });
    }
  }, [url, token]);

  // Setup event listeners
  useEffect(() => {
    if (!webSocketService.current) return;

    const service = webSocketService.current;

    // Connection status listener
    const connectionStatusListener = (status: ConnectionStatus) => {
      setConnectionStatus(status);
    };

    // Simulation metrics listener
    const simulationMetricsListener = (metrics: SimulationMetrics) => {
      setSimulationMetrics(metrics);
    };

    // Simulation events listener
    const simulationEventsListener = (event: SimulationEvent) => {
      setSimulationEvents(prev => [...prev.slice(-99), event]); // Keep last 100 events
    };

    // Simulation progress listener
    const simulationProgressListener = (progress: SimulationProgress) => {
      setSimulationProgress(progress);
    };

    // Simulation status listener
    const simulationStatusListener = (status: SimulationStatus) => {
      setSimulationStatus(status);
    };

    // Canvas update listener
    const canvasUpdateListener = (update: CanvasUpdate) => {
      setCanvasUpdates(prev => [...prev.slice(-99), update]); // Keep last 100 updates
    };

    // Workspace user events
    const userJoinedListener = (data: any) => {
      setWorkspaceUsers(prev => new Set([...prev, data.userId || data.socketId]));
    };

    const userLeftListener = (data: any) => {
      setWorkspaceUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.userId || data.socketId);
        return newSet;
      });
    };

    const userDisconnectedListener = (data: any) => {
      setWorkspaceUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.userId || data.socketId);
        return newSet;
      });
    };

    // Register listeners
    service.on('connection:status', connectionStatusListener);
    service.on('simulation:metrics', simulationMetricsListener);
    service.on('simulation:event', simulationEventsListener);
    service.on('simulation:progress', simulationProgressListener);
    service.on('simulation:status', simulationStatusListener);
    service.on('canvas:update', canvasUpdateListener);
    service.on('workspace:user-joined', userJoinedListener);
    service.on('workspace:user-left', userLeftListener);
    service.on('workspace:user-disconnected', userDisconnectedListener);

    // Store listeners for cleanup
    eventListenersRef.current.set('connection:status', connectionStatusListener);
    eventListenersRef.current.set('simulation:metrics', simulationMetricsListener);
    eventListenersRef.current.set('simulation:event', simulationEventsListener);
    eventListenersRef.current.set('simulation:progress', simulationProgressListener);
    eventListenersRef.current.set('simulation:status', simulationStatusListener);
    eventListenersRef.current.set('canvas:update', canvasUpdateListener);
    eventListenersRef.current.set('workspace:user-joined', userJoinedListener);
    eventListenersRef.current.set('workspace:user-left', userLeftListener);
    eventListenersRef.current.set('workspace:user-disconnected', userDisconnectedListener);

    return () => {
      // Cleanup listeners
      eventListenersRef.current.forEach((listener, event) => {
        service.off(event, listener);
      });
      eventListenersRef.current.clear();
    };
  }, []);

  // Auto-connect
  useEffect(() => {
    if (autoConnect && webSocketService.current && !connectionStatus.connected && !connectionStatus.connecting) {
      connect();
    }
  }, [autoConnect, connectionStatus.connected, connectionStatus.connecting]);

  // Auto-join workspace
  useEffect(() => {
    if (workspaceId && connectionStatus.connected && webSocketService.current) {
      const currentWorkspaceId = webSocketService.current.getCurrentWorkspaceId();
      if (currentWorkspaceId !== workspaceId) {
        joinWorkspace(workspaceId, userId);
      }
    }
  }, [workspaceId, userId, connectionStatus.connected]);

  // Connection methods
  const connect = useCallback(async () => {
    if (!webSocketService.current) return;
    
    try {
      await webSocketService.current.connect();
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (!webSocketService.current) return;
    webSocketService.current.disconnect();
    setWorkspaceUsers(new Set());
    setCanvasUpdates([]);
    setSimulationMetrics(null);
  }, []);

  // Workspace methods
  const joinWorkspace = useCallback(async (workspaceId: string, userId?: string) => {
    if (!webSocketService.current) return;
    
    try {
      await webSocketService.current.joinWorkspace(workspaceId, userId);
      setWorkspaceUsers(new Set()); // Reset users list for new workspace
      setCanvasUpdates([]); // Reset canvas updates for new workspace
    } catch (error) {
      console.error('Failed to join workspace:', error);
      throw error;
    }
  }, []);

  const leaveWorkspace = useCallback(async () => {
    if (!webSocketService.current) return;
    
    try {
      await webSocketService.current.leaveWorkspace();
      setWorkspaceUsers(new Set());
      setCanvasUpdates([]);
      setSimulationEvents([]);
      setSimulationMetrics(null);
      setSimulationProgress(null);
      setSimulationStatus(null);
    } catch (error) {
      console.error('Failed to leave workspace:', error);
      throw error;
    }
  }, []);

  // Simulation methods
  const startSimulation = useCallback(async (parameters?: any) => {
    if (!webSocketService.current) return;
    
    try {
      await webSocketService.current.controlSimulation('start', parameters);
    } catch (error) {
      console.error('Failed to start simulation:', error);
      throw error;
    }
  }, []);

  const stopSimulation = useCallback(async () => {
    if (!webSocketService.current) return;
    
    try {
      await webSocketService.current.controlSimulation('stop');
    } catch (error) {
      console.error('Failed to stop simulation:', error);
      throw error;
    }
  }, []);

  const pauseSimulation = useCallback(async () => {
    if (!webSocketService.current) return;
    
    try {
      await webSocketService.current.controlSimulation('pause');
    } catch (error) {
      console.error('Failed to pause simulation:', error);
      throw error;
    }
  }, []);

  const resumeSimulation = useCallback(async () => {
    if (!webSocketService.current) return;
    
    try {
      await webSocketService.current.controlSimulation('resume');
    } catch (error) {
      console.error('Failed to resume simulation:', error);
      throw error;
    }
  }, []);

  // Canvas methods
  const updateCanvas = useCallback(async (type: CanvasUpdate['type'], data: any) => {
    if (!webSocketService.current) return;
    
    try {
      await webSocketService.current.updateCanvas(type, data);
    } catch (error) {
      console.error('Failed to update canvas:', error);
      throw error;
    }
  }, []);

  // Event subscription method
  const subscribe = useCallback((event: string, listener: Function) => {
    if (!webSocketService.current) return () => {};
    
    webSocketService.current.on(event, listener);
    
    return () => {
      if (webSocketService.current) {
        webSocketService.current.off(event, listener);
      }
    };
  }, []);

  // Clear canvas updates
  const clearCanvasUpdates = useCallback(() => {
    setCanvasUpdates([]);
  }, []);

  // Clear simulation data
  const clearSimulationData = useCallback(() => {
    setSimulationEvents([]);
    setSimulationMetrics(null);
    setSimulationProgress(null);
    setSimulationStatus(null);
  }, []);

  return {
    // Connection state
    connectionStatus,
    isConnected: connectionStatus.connected,
    isConnecting: connectionStatus.connecting,
    connectionError: connectionStatus.error,
    
    // Data
    simulationMetrics,
    simulationEvents,
    simulationProgress,
    simulationStatus,
    canvasUpdates,
    workspaceUsers: Array.from(workspaceUsers),
    
    // Connection methods
    connect,
    disconnect,
    
    // Workspace methods
    joinWorkspace,
    leaveWorkspace,
    currentWorkspaceId: webSocketService.current?.getCurrentWorkspaceId() || null,
    
    // Simulation methods
    startSimulation,
    stopSimulation,
    pauseSimulation,
    resumeSimulation,
    
    // Canvas methods
    updateCanvas,
    clearCanvasUpdates,
    
    // Simulation data methods
    clearSimulationData,
    
    // Event subscription
    subscribe
  };
}

export default useWebSocket;