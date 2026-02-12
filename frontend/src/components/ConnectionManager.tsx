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
  const validateConnection = useCallback((sourceComponent: Component, targetComponent: Component): { valid: boolean; reason?: string } => {
    // Prevent self-connections
    if (sourceComponent.id === targetComponent.id) {
      return { valid: false, reason: 'Cannot connect component to itself' };
    }

    // Check if connection already exists
    const existingConnection = connections.find(conn => 
      (conn.sourceComponentId === sourceComponent.id && conn.targetComponentId === targetComponent.id) ||
      (conn.sourceComponentId === targetComponent.id && conn.targetComponentId === sourceComponent.id)
    );
    
    if (existingConnection) {
      return { valid: false, reason: 'Connection already exists between these components' };
    }

    // Define compatible connection types with detailed rules
    const compatibilityMatrix: Record<string, { allowed: string[]; description: string }> = {
      'client': { 
        allowed: ['load-balancer', 'web-server', 'cdn', 'proxy'], 
        description: 'Clients can connect to load balancers, web servers, CDNs, or proxies' 
      },
      'web-server': { 
        allowed: ['database', 'cache', 'load-balancer', 'message-queue', 'client'], 
        description: 'Web servers can connect to databases, caches, load balancers, message queues, or serve clients' 
      },
      'load-balancer': { 
        allowed: ['web-server', 'proxy', 'client'], 
        description: 'Load balancers distribute traffic to web servers or proxies, and serve clients' 
      },
      'database': { 
        allowed: ['web-server', 'cache'], 
        description: 'Databases can be accessed by web servers or cached' 
      },
      'cache': { 
        allowed: ['web-server', 'database'], 
        description: 'Caches can serve web servers or cache database data' 
      },
      'message-queue': { 
        allowed: ['web-server', 'proxy'], 
        description: 'Message queues can be accessed by web servers or proxies' 
      },
      'cdn': { 
        allowed: ['web-server', 'proxy', 'client'], 
        description: 'CDNs can cache content from web servers/proxies and serve clients' 
      },
      'proxy': { 
        allowed: ['web-server', 'load-balancer', 'cdn', 'message-queue', 'client'], 
        description: 'Proxies can forward requests to various backend services and serve clients' 
      }
    };

    const sourceRules = compatibilityMatrix[sourceComponent.type];
    const targetRules = compatibilityMatrix[targetComponent.type];
    
    if (!sourceRules || !targetRules) {
      return { valid: false, reason: `Unknown component type: ${!sourceRules ? sourceComponent.type : targetComponent.type}` };
    }

    // Check if source can connect to target OR target can connect to source (bidirectional)
    const sourceCanConnectToTarget = sourceRules.allowed.includes(targetComponent.type);
    const targetCanConnectToSource = targetRules.allowed.includes(sourceComponent.type);
    
    if (!sourceCanConnectToTarget && !targetCanConnectToSource) {
      return { 
        valid: false, 
        reason: `${sourceComponent.type} and ${targetComponent.type} are not compatible. ${sourceRules.description}` 
      };
    }

    return { valid: true };
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
    const validation = validateConnection(sourceComponent, targetComponent);
    if (!validation.valid) {
      console.warn('Invalid connection attempt:', validation.reason);
      // TODO: Show user-friendly error message
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