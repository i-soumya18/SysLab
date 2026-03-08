/**
 * React hook for real-time metrics streaming
 * 
 * Implements SRS FR-5.2: Real-time performance monitoring with live metric streaming
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ComponentMetrics, AggregatedMetrics, SystemMetrics } from '../types';

export interface RealTimeMetricsConfig {
  workspaceId: string;
  componentIds?: string[];
  updateTypes?: ('component' | 'system' | 'aggregated')[];
  autoReconnect?: boolean;
  reconnectInterval?: number;
}

export interface RealTimeMetricsState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  lastUpdate: number;
  componentMetrics: Map<string, ComponentMetrics>;
  systemMetrics: SystemMetrics | null;
  aggregatedMetrics: Map<string, AggregatedMetrics>;
  performanceStats: {
    updateLatency: number;
    updateCount: number;
    droppedUpdates: number;
  };
}

export interface UseRealTimeMetricsReturn extends RealTimeMetricsState {
  connect: () => void;
  disconnect: () => void;
  subscribe: (config: RealTimeMetricsConfig) => void;
  unsubscribe: () => void;
  getComponentMetrics: (componentId: string) => ComponentMetrics | null;
  getLatestSystemMetrics: () => SystemMetrics | null;
}

const WEBSOCKET_URL = process.env.REACT_APP_METRICS_WS_URL || 'ws://localhost:8081';

export const useRealTimeMetrics = (initialConfig?: RealTimeMetricsConfig): UseRealTimeMetricsReturn => {
  const [state, setState] = useState<RealTimeMetricsState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    lastUpdate: 0,
    componentMetrics: new Map(),
    systemMetrics: null,
    aggregatedMetrics: new Map(),
    performanceStats: {
      updateLatency: 0,
      updateCount: 0,
      droppedUpdates: 0
    }
  });

  const wsRef = useRef<WebSocket | null>(null);
  const configRef = useRef<RealTimeMetricsConfig | null>(initialConfig || null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const performanceRef = useRef({
    lastUpdateTime: 0,
    updateCount: 0,
    droppedUpdates: 0,
    latencySum: 0
  });

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const ws = new WebSocket(WEBSOCKET_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Connected to metrics WebSocket');
        setState(prev => ({ 
          ...prev, 
          isConnected: true, 
          isConnecting: false, 
          error: null 
        }));

        // Subscribe if config is available
        if (configRef.current) {
          subscribe(configRef.current);
        }
      };

      ws.onmessage = (event) => {
        handleMessage(event.data);
      };

      ws.onclose = (event) => {
        console.log('Disconnected from metrics WebSocket:', event.code, event.reason);
        setState(prev => ({ 
          ...prev, 
          isConnected: false, 
          isConnecting: false 
        }));

        // Auto-reconnect if enabled
        if (configRef.current?.autoReconnect !== false) {
          const interval = configRef.current?.reconnectInterval || 5000;
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, interval);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setState(prev => ({ 
          ...prev, 
          error: 'WebSocket connection error',
          isConnecting: false 
        }));
      };

    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Connection failed',
        isConnecting: false 
      }));
    }
  }, []);

  /**
   * Disconnect from WebSocket server
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setState(prev => ({ 
      ...prev, 
      isConnected: false, 
      isConnecting: false 
    }));
  }, []);

  /**
   * Subscribe to metrics for a workspace
   */
  const subscribe = useCallback((config: RealTimeMetricsConfig) => {
    configRef.current = config;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = {
        type: 'subscribe',
        data: {
          workspaceId: config.workspaceId,
          componentIds: config.componentIds,
          updateTypes: config.updateTypes || ['component', 'system', 'aggregated']
        }
      };

      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  /**
   * Unsubscribe from metrics
   */
  const unsubscribe = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = { type: 'unsubscribe' };
      wsRef.current.send(JSON.stringify(message));
    }

    configRef.current = null;
  }, []);

  /**
   * Handle incoming WebSocket messages
   */
  const handleMessage = useCallback((data: string) => {
    try {
      const message = JSON.parse(data);
      const now = Date.now();

      switch (message.type) {
        case 'metrics_update':
          handleMetricsUpdate(message.update, now);
          break;

        case 'metrics_batch':
          message.updates.forEach((update: any) => {
            handleMetricsUpdate(update, now);
          });
          break;

        case 'error':
          setState(prev => ({ 
            ...prev, 
            error: message.data?.error || 'Unknown error' 
          }));
          break;

        case 'subscribed':
          console.log('Subscribed to metrics:', message.data);
          break;

        case 'unsubscribed':
          console.log('Unsubscribed from metrics');
          setState(prev => ({
            ...prev,
            componentMetrics: new Map(),
            systemMetrics: null,
            aggregatedMetrics: new Map()
          }));
          break;

        case 'pong':
          // Handle heartbeat response
          break;

        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }, []);

  /**
   * Handle individual metrics update
   */
  const handleMetricsUpdate = useCallback((update: any, receivedTime: number) => {
    const updateLatency = receivedTime - update.timestamp;
    
    // Update performance stats
    performanceRef.current.updateCount++;
    performanceRef.current.latencySum += updateLatency;
    
    if (updateLatency > 1000) { // Consider updates older than 1s as dropped
      performanceRef.current.droppedUpdates++;
      return; // Skip old updates
    }

    setState(prev => {
      const newState = { ...prev };

      switch (update.type) {
        case 'component':
          const componentMetrics = new Map(prev.componentMetrics);
          componentMetrics.set(update.data.componentId, update.data);
          newState.componentMetrics = componentMetrics;
          break;

        case 'system':
          newState.systemMetrics = update.data;
          break;

        case 'aggregated':
          const aggregatedMetrics = new Map(prev.aggregatedMetrics);
          aggregatedMetrics.set(update.data.componentId, update.data);
          newState.aggregatedMetrics = aggregatedMetrics;
          break;
      }

      // Update performance stats
      const avgLatency = performanceRef.current.latencySum / performanceRef.current.updateCount;
      newState.performanceStats = {
        updateLatency: avgLatency,
        updateCount: performanceRef.current.updateCount,
        droppedUpdates: performanceRef.current.droppedUpdates
      };

      newState.lastUpdate = receivedTime;
      return newState;
    });
  }, []);

  /**
   * Get metrics for a specific component
   */
  const getComponentMetrics = useCallback((componentId: string): ComponentMetrics | null => {
    return state.componentMetrics.get(componentId) || null;
  }, [state.componentMetrics]);

  /**
   * Get latest system metrics
   */
  const getLatestSystemMetrics = useCallback((): SystemMetrics | null => {
    return state.systemMetrics;
  }, [state.systemMetrics]);

  // Auto-connect on mount if initial config provided
  useEffect(() => {
    if (initialConfig) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [initialConfig, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    getComponentMetrics,
    getLatestSystemMetrics
  };
};