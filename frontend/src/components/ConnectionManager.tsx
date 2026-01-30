/**
 * Connection Manager Hook - Handles wire creation and management
 * Manages the process of creating connections between components
 */

import { useState, useCallback } from 'react';
import type { Connection, Component, ConnectionConfig } from '../types';

interface ConnectionManagerProps {
  components: Component[];
  connections: Connection[];
  onConnectionCreate: (connection: Connection) => void;
  onConnectionDelete: (connectionId: string) => void;
  onConnectionSelect: (connection: Connection | null) => void;
  selectedConnection: Connection | null;
}

interface WireInProgress {
  sourceComponentId: string;
  sourcePort: string;
  currentPosition: { x: number; y: number };
}

export const useConnectionManager = ({
  components,
  connections,
  onConnectionCreate,
  onConnectionDelete,
  onConnectionSelect,
  selectedConnection: _selectedConnection
}: ConnectionManagerProps) => {
  const [wireInProgress, setWireInProgress] = useState<WireInProgress | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Validate if two components can be connected
  const validateConnection = useCallback((sourceComponent: Component, targetComponent: Component): boolean => {
    // Prevent self-connections
    if (sourceComponent.id === targetComponent.id) {
      return false;
    }

    // Check if connection already exists
    const existingConnection = connections.find(conn => 
      (conn.sourceComponentId === sourceComponent.id && conn.targetComponentId === targetComponent.id) ||
      (conn.sourceComponentId === targetComponent.id && conn.targetComponentId === sourceComponent.id)
    );
    
    if (existingConnection) {
      return false;
    }

    // Define compatible connection types
    const compatibilityMatrix: Record<string, string[]> = {
      'web-server': ['database', 'cache', 'load-balancer', 'message-queue'],
      'load-balancer': ['web-server', 'proxy'],
      'database': ['web-server', 'cache'],
      'cache': ['web-server', 'database'],
      'message-queue': ['web-server', 'proxy'],
      'cdn': ['web-server', 'proxy'],
      'proxy': ['web-server', 'load-balancer', 'cdn', 'message-queue']
    };

    const sourceCompatible = compatibilityMatrix[sourceComponent.type] || [];
    return sourceCompatible.includes(targetComponent.type);
  }, [connections]);

  // Start connection creation
  const startConnection = useCallback((componentId: string, port: string, position: { x: number; y: number }) => {
    setWireInProgress({
      sourceComponentId: componentId,
      sourcePort: port,
      currentPosition: position
    });
    setIsConnecting(true);
  }, []);

  // Update wire position during dragging
  const updateWirePosition = useCallback((position: { x: number; y: number }) => {
    if (wireInProgress) {
      setWireInProgress(prev => prev ? { ...prev, currentPosition: position } : null);
    }
  }, [wireInProgress]);

  // Complete connection creation
  const completeConnection = useCallback((targetComponentId: string, targetPort: string) => {
    if (!wireInProgress) return;

    const sourceComponent = components.find(c => c.id === wireInProgress.sourceComponentId);
    const targetComponent = components.find(c => c.id === targetComponentId);

    if (!sourceComponent || !targetComponent) {
      setWireInProgress(null);
      setIsConnecting(false);
      return;
    }

    // Validate connection
    if (!validateConnection(sourceComponent, targetComponent)) {
      console.warn('Invalid connection attempt');
      setWireInProgress(null);
      setIsConnecting(false);
      return;
    }

    // Determine connection protocol based on component types
    const getConnectionProtocol = (source: Component, target: Component): ConnectionConfig['protocol'] => {
      if (source.type === 'database' || target.type === 'database') return 'DATABASE';
      if (source.type === 'load-balancer' || target.type === 'load-balancer') return 'TCP';
      if (source.type === 'message-queue' || target.type === 'message-queue') return 'TCP';
      return 'HTTP';
    };

    // Create new connection
    const newConnection: Connection = {
      id: crypto.randomUUID(),
      sourceComponentId: wireInProgress.sourceComponentId,
      targetComponentId: targetComponentId,
      sourcePort: wireInProgress.sourcePort,
      targetPort: targetPort,
      configuration: {
        bandwidth: 1000, // Default 1Gbps
        latency: 10, // Default 10ms
        protocol: getConnectionProtocol(sourceComponent, targetComponent),
        reliability: 0.99 // Default 99% reliability
      }
    };

    onConnectionCreate(newConnection);
    setWireInProgress(null);
    setIsConnecting(false);
  }, [wireInProgress, components, validateConnection, onConnectionCreate]);

  // Cancel connection creation
  const cancelConnection = useCallback(() => {
    setWireInProgress(null);
    setIsConnecting(false);
  }, []);

  // Handle connection point click
  const handleConnectionPointClick = useCallback((
    componentId: string, 
    port: string, 
    position: { x: number; y: number }
  ) => {
    if (!isConnecting) {
      // Start new connection
      startConnection(componentId, port, position);
    } else if (wireInProgress && wireInProgress.sourceComponentId !== componentId) {
      // Complete connection
      completeConnection(componentId, port);
    } else {
      // Cancel if clicking same component
      cancelConnection();
    }
  }, [isConnecting, wireInProgress, startConnection, completeConnection, cancelConnection]);

  // Handle mouse move for wire preview
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (wireInProgress) {
      const canvasRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      updateWirePosition({
        x: e.clientX - canvasRect.left,
        y: e.clientY - canvasRect.top
      });
    }
  }, [wireInProgress, updateWirePosition]);

  // Handle canvas click to cancel connection
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (isConnecting && e.target === e.currentTarget) {
      cancelConnection();
    }
  }, [isConnecting, cancelConnection]);

  // Get connection point position
  const getConnectionPointPosition = (component: Component, port: string) => {
    const baseX = component.position.x + 50;
    const baseY = component.position.y + 40;
    
    switch (port) {
      case 'top':
        return { x: baseX, y: component.position.y };
      case 'bottom':
        return { x: baseX, y: component.position.y + 80 };
      case 'left':
        return { x: component.position.x, y: baseY };
      case 'right':
        return { x: component.position.x + 100, y: baseY };
      default:
        return { x: baseX, y: baseY };
    }
  };

  return {
    isConnecting,
    wireInProgress,
    handleConnectionPointClick,
    handleMouseMove,
    handleCanvasClick,
    getConnectionPointPosition,
    validateConnection,
    onConnectionCreate,
    onConnectionDelete,
    onConnectionSelect
  };
};