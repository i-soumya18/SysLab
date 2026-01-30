/**
 * Interactive Canvas Component with Drag-and-Drop Support
 * Implements the main workspace for designing system architectures
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useDrop } from 'react-dnd';
import type { Component, ComponentType, Position, Connection, ConnectionConfig } from '../types';
import { componentLibrary } from './ComponentLibrary';
import { CanvasComponent } from './CanvasComponent';
import { ContextMenu } from './ContextMenu';
import { ConnectionWire } from './ConnectionWire';
import { useConnectionManager } from './ConnectionManager';
import { ConnectionConfigPanel } from './ConnectionConfigPanel';
import { ConnectionContextMenu } from './ConnectionContextMenu';
import { ComponentConfigPanel } from './ComponentConfigPanel';

// Drag item type for React DnD
export interface DragItem {
  type: string;
  componentType: ComponentType;
  componentKey: string;
}

// Canvas props interface
interface CanvasProps {
  width?: number;
  height?: number;
  onComponentAdd?: (component: Component) => void;
  onComponentSelect?: (component: Component | null) => void;
  onComponentUpdate?: (component: Component) => void;
  onComponentDelete?: (componentId: string) => void;
  onComponentCountChange?: (count: number) => void;
  onConnectionCreate?: (connection: Connection) => void;
  onConnectionDelete?: (connectionId: string) => void;
  onConnectionSelect?: (connection: Connection | null) => void;
}

// Canvas component
export const Canvas: React.FC<CanvasProps> = ({
  width = 1200,
  height = 800,
  onComponentAdd,
  onComponentSelect,
  onComponentUpdate,
  onComponentDelete,
  onComponentCountChange,
  onConnectionCreate,
  onConnectionDelete,
  onConnectionSelect
}) => {
  const [components, setComponents] = useState<Component[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [showConnectionConfig, setShowConnectionConfig] = useState(false);
  const [showComponentConfig, setShowComponentConfig] = useState(false);
  const [connectionContextMenu, setConnectionContextMenu] = useState<{
    connection: Connection;
    position: { x: number; y: number };
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    component: Component;
    position: { x: number; y: number };
  } | null>(null);

  // Initialize connection manager
  const connectionManager = useConnectionManager({
    components,
    connections,
    onConnectionCreate: (connection: Connection) => {
      setConnections(prev => [...prev, connection]);
      onConnectionCreate?.(connection);
    },
    onConnectionDelete: (connectionId: string) => {
      setConnections(prev => prev.filter(conn => conn.id !== connectionId));
      if (selectedConnection?.id === connectionId) {
        setSelectedConnection(null);
        onConnectionSelect?.(null);
      }
      onConnectionDelete?.(connectionId);
    },
    onConnectionSelect: (connection: Connection | null) => {
      setSelectedConnection(connection);
      onConnectionSelect?.(connection);
      if (connection) {
        setShowConnectionConfig(true);
      }
    },
    selectedConnection
  });

  // Drop handler for components from the palette
  const [{ isOver }, drop] = useDrop({
    accept: 'component',
    drop: (item: DragItem, monitor) => {
      const offset = monitor.getClientOffset();
      const canvasRect = (monitor.getDropResult() as any)?.getBoundingClientRect?.() || 
                        document.getElementById('canvas')?.getBoundingClientRect();
      
      if (offset && canvasRect) {
        const position: Position = {
          x: Math.max(0, Math.min(width - 100, offset.x - canvasRect.left)),
          y: Math.max(0, Math.min(height - 100, offset.y - canvasRect.top))
        };

        const newComponent = componentLibrary.createComponent(
          item.componentKey,
          item.componentType,
          position
        );

        if (newComponent) {
          setComponents(prev => {
            const updated = [...prev, newComponent];
            onComponentCountChange?.(updated.length);
            return updated;
          });
          onComponentAdd?.(newComponent);
        }
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver()
    })
  });

  // Handle component selection
  const handleComponentSelect = useCallback((component: Component | null) => {
    setSelectedComponent(component);
    onComponentSelect?.(component);
    if (component) {
      setShowComponentConfig(true);
    } else {
      setShowComponentConfig(false);
    }
  }, [onComponentSelect]);

  // Handle component position updates
  const handleComponentMove = useCallback((componentId: string, newPosition: Position) => {
    setComponents(prev => 
      prev.map(comp => 
        comp.id === componentId 
          ? { ...comp, position: newPosition }
          : comp
      )
    );

    // Update the selected component if it's the one being moved
    if (selectedComponent?.id === componentId) {
      const updatedComponent = { ...selectedComponent, position: newPosition };
      setSelectedComponent(updatedComponent);
      onComponentUpdate?.(updatedComponent);
    }
  }, [selectedComponent, onComponentUpdate]);

  // Handle component configuration updates
  const handleComponentUpdate = useCallback((updatedComponent: Component) => {
    setComponents(prev => 
      prev.map(comp => 
        comp.id === updatedComponent.id 
          ? updatedComponent
          : comp
      )
    );
    setSelectedComponent(updatedComponent);
    onComponentUpdate?.(updatedComponent);
  }, [onComponentUpdate]);

  // Handle connection context menu
  const handleConnectionContextMenu = useCallback((connection: Connection, position: { x: number; y: number }) => {
    setConnectionContextMenu({ connection, position });
    setSelectedConnection(connection);
    onConnectionSelect?.(connection);
  }, [onConnectionSelect]);

  // Handle connection configuration
  const handleConnectionConfigure = useCallback((connection: Connection) => {
    setSelectedConnection(connection);
    setShowConnectionConfig(true);
    setConnectionContextMenu(null);
  }, []);

  // Handle connection configuration updates
  const handleConnectionUpdate = useCallback((connectionId: string, config: ConnectionConfig) => {
    setConnections(prev => 
      prev.map(conn => 
        conn.id === connectionId 
          ? { ...conn, configuration: config }
          : conn
      )
    );
  }, []);

  // Handle canvas click (deselect components and connections)
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleComponentSelect(null);
      setSelectedConnection(null);
      setShowConnectionConfig(false);
      setShowComponentConfig(false);
      setConnectionContextMenu(null);
      onConnectionSelect?.(null);
      setContextMenu(null);
    }
    connectionManager.handleCanvasClick(e);
  }, [handleComponentSelect, onConnectionSelect, connectionManager]);

  // Handle context menu
  const handleContextMenu = useCallback((component: Component, position: { x: number; y: number }) => {
    setContextMenu({ component, position });
    handleComponentSelect(component);
  }, [handleComponentSelect]);

  // Handle component deletion
  const handleComponentDelete = useCallback((componentId: string) => {
    // Remove component
    setComponents(prev => {
      const updated = prev.filter(comp => comp.id !== componentId);
      onComponentCountChange?.(updated.length);
      return updated;
    });
    
    // Remove connections involving this component
    setConnections(prev => prev.filter(conn => 
      conn.sourceComponentId !== componentId && conn.targetComponentId !== componentId
    ));
    
    if (selectedComponent?.id === componentId) {
      setSelectedComponent(null);
      onComponentSelect?.(null);
    }
    onComponentDelete?.(componentId);
    setContextMenu(null);
  }, [selectedComponent, onComponentSelect, onComponentDelete, onComponentCountChange]);

  // Handle component duplication
  const handleComponentDuplicate = useCallback((component: Component) => {
    const duplicatedComponent = {
      ...component,
      id: crypto.randomUUID(),
      position: {
        x: component.position.x + 20,
        y: component.position.y + 20
      }
    };
    setComponents(prev => {
      const updated = [...prev, duplicatedComponent];
      onComponentCountChange?.(updated.length);
      return updated;
    });
    onComponentAdd?.(duplicatedComponent);
    setContextMenu(null);
  }, [onComponentAdd, onComponentCountChange]);

  // Handle component configuration
  const handleComponentConfigure = useCallback((component: Component) => {
    handleComponentSelect(component);
    setShowComponentConfig(true);
    setContextMenu(null);
  }, [handleComponentSelect]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedComponent) {
        switch (e.key) {
          case 'Delete':
          case 'Backspace':
            e.preventDefault();
            handleComponentDelete(selectedComponent.id);
            break;
          case 'd':
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              handleComponentDuplicate(selectedComponent);
            }
            break;
          case 'Escape':
            handleComponentSelect(null);
            setSelectedConnection(null);
            setShowConnectionConfig(false);
            setShowComponentConfig(false);
            setConnectionContextMenu(null);
            onConnectionSelect?.(null);
            setContextMenu(null);
            break;
        }
      } else if (selectedConnection) {
        switch (e.key) {
          case 'Delete':
          case 'Backspace':
            e.preventDefault();
            connectionManager.onConnectionDelete(selectedConnection.id);
            break;
          case 'Escape':
            setSelectedConnection(null);
            setShowConnectionConfig(false);
            setShowComponentConfig(false);
            setConnectionContextMenu(null);
            onConnectionSelect?.(null);
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedComponent, selectedConnection, handleComponentDelete, handleComponentDuplicate, handleComponentSelect, onConnectionSelect, connectionManager]);

  return (
    <div
      id="canvas"
      ref={drop as any}
      className={`canvas ${isOver ? 'canvas--drop-active' : ''}`}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        position: 'relative',
        border: '2px solid #e0e0e0',
        borderRadius: '8px',
        backgroundColor: isOver ? '#f0f8ff' : '#fafafa',
        backgroundImage: `
          radial-gradient(circle, #ddd 1px, transparent 1px)
        `,
        backgroundSize: '20px 20px',
        overflow: 'hidden',
        cursor: 'default'
      }}
      onClick={handleCanvasClick}
      onMouseMove={connectionManager.handleMouseMove}
    >
      {/* SVG layer for connections */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'auto',
          zIndex: 1
        }}
      >
        {/* Render existing connections */}
        {connections.map(connection => {
          const sourceComponent = components.find(c => c.id === connection.sourceComponentId);
          const targetComponent = components.find(c => c.id === connection.targetComponentId);
          
          if (!sourceComponent || !targetComponent) return null;
          
          return (
            <ConnectionWire
              key={connection.id}
              connection={connection}
              sourceComponent={sourceComponent}
              targetComponent={targetComponent}
              isSelected={selectedConnection?.id === connection.id}
              onSelect={connectionManager.onConnectionSelect}
              onDelete={connectionManager.onConnectionDelete}
              onContextMenu={handleConnectionContextMenu}
            />
          );
        })}
        
        {/* Wire preview during connection creation */}
        {connectionManager.wireInProgress && (
          (() => {
            const sourceComponent = components.find(c => c.id === connectionManager.wireInProgress!.sourceComponentId);
            if (!sourceComponent) return null;
            
            const sourcePoint = connectionManager.getConnectionPointPosition(sourceComponent, connectionManager.wireInProgress!.sourcePort);
            const targetPoint = connectionManager.wireInProgress!.currentPosition;
            
            return (
              <line
                x1={sourcePoint.x}
                y1={sourcePoint.y}
                x2={targetPoint.x}
                y2={targetPoint.y}
                stroke="#007bff"
                strokeWidth="2"
                strokeDasharray="5,5"
                opacity="0.7"
                style={{ pointerEvents: 'none' }}
              />
            );
          })()
        )}
      </svg>
      
      {/* Components layer */}
      {components.map(component => (
        <CanvasComponent
          key={component.id}
          component={component}
          isSelected={selectedComponent?.id === component.id}
          onSelect={handleComponentSelect}
          onMove={handleComponentMove}
          onContextMenu={handleContextMenu}
          onConnectionPointClick={connectionManager.handleConnectionPointClick}
          isConnecting={connectionManager.isConnecting}
          canConnect={(comp) => connectionManager.validateConnection(
            components.find(c => c.id === connectionManager.wireInProgress?.sourceComponentId) || comp,
            comp
          )}
        />
      ))}
      
      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          component={contextMenu.component}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onDelete={handleComponentDelete}
          onDuplicate={handleComponentDuplicate}
          onConfigure={handleComponentConfigure}
        />
      )}
      
      {/* Connection Context Menu */}
      {connectionContextMenu && (
        <ConnectionContextMenu
          connection={connectionContextMenu.connection}
          position={connectionContextMenu.position}
          onClose={() => setConnectionContextMenu(null)}
          onConfigure={handleConnectionConfigure}
          onDelete={(connectionId) => {
            connectionManager.onConnectionDelete(connectionId);
            setConnectionContextMenu(null);
          }}
        />
      )}
      
      {/* Drop zone indicator */}
      {isOver && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 123, 255, 0.1)',
            border: '2px dashed #007bff',
            borderRadius: '8px',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            color: '#007bff',
            fontWeight: 'bold',
            zIndex: 100
          }}
        >
          Drop component here
        </div>
      )}
      
      {/* Connection mode indicator */}
      {connectionManager.isConnecting && (
        <div
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            backgroundColor: 'rgba(0, 123, 255, 0.9)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 'bold',
            zIndex: 100
          }}
        >
          Click on a connection point to complete the wire
        </div>
      )}
      
      {/* Connection Configuration Panel */}
      {showConnectionConfig && selectedConnection && (
        <ConnectionConfigPanel
          connection={selectedConnection}
          onUpdate={handleConnectionUpdate}
          onClose={() => {
            setShowConnectionConfig(false);
            setSelectedConnection(null);
            onConnectionSelect?.(null);
          }}
        />
      )}
      
      {/* Component Configuration Panel */}
      {showComponentConfig && selectedComponent && (
        <ComponentConfigPanel
          component={selectedComponent}
          onUpdate={handleComponentUpdate}
          onClose={() => {
            setShowComponentConfig(false);
            setSelectedComponent(null);
            onComponentSelect?.(null);
          }}
        />
      )}
    </div>
  );
};