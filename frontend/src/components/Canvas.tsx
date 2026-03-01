/**
 * Interactive Canvas Component with Drag-and-Drop Support
 * Implements the main workspace for designing system architectures
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDrop } from 'react-dnd';
import type { Component, ComponentType, Position, Connection, ConnectionConfig, BottleneckInfo } from '../types';
import { componentLibrary } from './ComponentLibrary';
import { CanvasComponent } from './CanvasComponent';
import { ContextMenu } from './ContextMenu';
import { ConnectionWire } from './ConnectionWire';
import { useConnectionManager } from './ConnectionManager';
import { ConnectionConfigPanel } from './ConnectionConfigPanel';
import { ConnectionContextMenu } from './ConnectionContextMenu';
import { generateUUID } from '../utils/uuid';

// Drag item type for React DnD
export interface DragItem {
  type: string;
  componentType: ComponentType;
  componentKey: string;
}

// Component group interface
interface ComponentGroup {
  id: string;
  name: string;
  componentIds: string[];
  color: string;
  position: Position;
  size: { width: number; height: number };
  collapsed: boolean;
}

// Canvas props interface
interface CanvasProps {
  width?: number;
  height?: number;
  initialComponents?: Component[];
  initialConnections?: Connection[];
  onComponentAdd?: (component: Component) => void;
  onComponentSelect?: (component: Component | null) => void;
  onComponentUpdate?: (component: Component) => void;
  onComponentDelete?: (componentId: string) => void;
  onComponentCountChange?: (count: number) => void;
  onComponentConfigure?: (component: Component) => void;
  onConnectionCreate?: (connection: Connection) => void;
  onConnectionDelete?: (connectionId: string) => void;
  onConnectionSelect?: (connection: Connection | null) => void;
  enableGridSnapping?: boolean;
  gridSize?: number;
  enableZoom?: boolean;
  minZoom?: number;
  maxZoom?: number;
  bottlenecks?: Map<string, BottleneckInfo>;
}

// Canvas component
export const Canvas: React.FC<CanvasProps> = ({
  width = 1200,
  height = 800,
  initialComponents,
  initialConnections,
  onComponentAdd,
  onComponentSelect,
  onComponentUpdate,
  onComponentDelete,
  onComponentCountChange,
  onComponentConfigure,
  onConnectionCreate,
  onConnectionDelete,
  onConnectionSelect,
  enableGridSnapping = true,
  gridSize = 20,
  enableZoom = true,
  minZoom = 0.25,
  maxZoom = 3.0,
  bottlenecks = new Map()
}) => {
  const [components, setComponents] = useState<Component[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [showConnectionConfig, setShowConnectionConfig] = useState(false);
  const [connectionContextMenu, setConnectionContextMenu] = useState<{
    connection: Connection;
    position: { x: number; y: number };
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    component: Component;
    position: { x: number; y: number };
  } | null>(null);
  
  // Grouping state
  const [groups, setGroups] = useState<ComponentGroup[]>([]);
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{
    start: Position;
    end: Position;
  } | null>(null);
  
  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

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

  // Initialize from parent-provided workspace state when present (e.g. loaded or imported workspace)
  // Compare component IDs to avoid unnecessary updates
  const prevInitialComponentsRef = useRef<string>('');
  useEffect(() => {
    if (!initialComponents || initialComponents.length === 0) {
      return;
    }
    
    // Create a signature from component IDs to detect actual changes
    const componentIds = initialComponents.map(c => c.id).sort().join(',');
    if (componentIds === prevInitialComponentsRef.current) {
      // Components haven't actually changed, skip update
      return;
    }
    
    prevInitialComponentsRef.current = componentIds;
    setComponents(initialComponents);
    // Don't call onComponentCountChange here - it will be called by the effect that watches components.length
  }, [initialComponents]);

  useEffect(() => {
    if (initialConnections && initialConnections.length > 0) {
      setConnections(initialConnections);
    }
  }, [initialConnections]);

  // Grid snapping helper function
  const snapToGrid = useCallback((position: Position): Position => {
    if (!enableGridSnapping) return position;
    
    return {
      x: Math.round(position.x / gridSize) * gridSize,
      y: Math.round(position.y / gridSize) * gridSize
    };
  }, [enableGridSnapping, gridSize]);

  // Check if a position overlaps with existing components
  const checkCollision = useCallback((position: Position, excludeId?: string): boolean => {
    const componentWidth = 100;
    const componentHeight = 80;
    const padding = 20; // Minimum spacing between components

    return components.some(comp => {
      if (excludeId && comp.id === excludeId) return false;
      
      const compRight = comp.position.x + componentWidth + padding;
      const compBottom = comp.position.y + componentHeight + padding;
      const newRight = position.x + componentWidth + padding;
      const newBottom = position.y + componentHeight + padding;

      return (
        position.x < compRight &&
        newRight > comp.position.x &&
        position.y < compBottom &&
        newBottom > comp.position.y
      );
    });
  }, [components]);

  // Find next available position without collision
  const findAvailablePosition = useCallback((startPosition: Position): Position => {
    const componentWidth = 100;
    const componentHeight = 80;
    const spacing = 120; // Grid spacing for new components
    let currentPos = { ...startPosition };
    let attempts = 0;
    const maxAttempts = 200; // Increased attempts for larger canvases

    // Try to find a nearby position that doesn't collide
    while (checkCollision(currentPos) && attempts < maxAttempts) {
      // Try moving right first
      currentPos.x += spacing;
      if (currentPos.x + componentWidth + 20 > width) {
        // Move to next row
        currentPos.x = 20; // Start with some padding from left
        currentPos.y += spacing;
        if (currentPos.y + componentHeight + 20 > height) {
          // Wrap around to top, but shift right
          currentPos.y = 20;
          currentPos.x += spacing * 2; // Try a different column
          if (currentPos.x + componentWidth > width) {
            currentPos.x = 20; // Reset to start
          }
        }
      }
      attempts++;
    }

    // Ensure position is within bounds
    const finalPos = {
      x: Math.max(0, Math.min(width - componentWidth - 20, currentPos.x)),
      y: Math.max(0, Math.min(height - componentHeight - 20, currentPos.y))
    };

    return snapToGrid(finalPos);
  }, [checkCollision, snapToGrid, width, height]);

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = useCallback((screenX: number, screenY: number): Position => {
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return { x: screenX, y: screenY };
    
    return {
      x: (screenX - canvasRect.left - pan.x) / zoom,
      y: (screenY - canvasRect.top - pan.y) / zoom
    };
  }, [pan, zoom]);

  // Zoom handling with non-passive event listener to allow preventDefault
  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement || !enableZoom) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(minZoom, Math.min(maxZoom, zoom * delta));
      
      // Zoom towards mouse position
      const canvasRect = canvasElement.getBoundingClientRect();
      if (canvasRect) {
        const mouseX = e.clientX - canvasRect.left;
        const mouseY = e.clientY - canvasRect.top;
        
        const zoomRatio = newZoom / zoom;
        const newPan = {
          x: mouseX - (mouseX - pan.x) * zoomRatio,
          y: mouseY - (mouseY - pan.y) * zoomRatio
        };
        
        setZoom(newZoom);
        setPan(newPan);
      }
    };

    // Add event listener with passive: false to allow preventDefault
    canvasElement.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      canvasElement.removeEventListener('wheel', handleWheel);
    };
  }, [enableZoom, zoom, minZoom, maxZoom, pan]);

  // Selection box handling
  const handleSelectionStart = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && e.shiftKey && !isPanning) {
      const canvasPosition = screenToCanvas(e.clientX, e.clientY);
      setIsSelecting(true);
      setSelectionBox({
        start: canvasPosition,
        end: canvasPosition
      });
    }
  }, [screenToCanvas, isPanning]);

  const handleSelectionMove = useCallback((e: React.MouseEvent) => {
    if (isSelecting && selectionBox) {
      const canvasPosition = screenToCanvas(e.clientX, e.clientY);
      setSelectionBox(prev => prev ? { ...prev, end: canvasPosition } : null);
    }
  }, [isSelecting, selectionBox, screenToCanvas]);

  // Pan handling
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.ctrlKey)) { // Middle mouse or Ctrl+click
      e.preventDefault();
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    } else if (e.button === 0 && e.shiftKey) { // Shift+click for selection
      handleSelectionStart(e);
    }
  }, [handleSelectionStart]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      const deltaX = e.clientX - lastPanPoint.x;
      const deltaY = e.clientY - lastPanPoint.y;
      
      setPan(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    }
    
    // Handle selection box
    if (isSelecting) {
      handleSelectionMove(e);
    }
    
    // Pass through to connection manager
    connectionManager.handleMouseMove(e);
  }, [isPanning, lastPanPoint, connectionManager, isSelecting, handleSelectionMove]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    
    // End selection if we were selecting
    if (isSelecting && selectionBox) {
      const selectedIds = components
        .filter(component => {
          const compX = component.position.x;
          const compY = component.position.y;
          const compRight = compX + 100;
          const compBottom = compY + 80;
          
          const selLeft = Math.min(selectionBox.start.x, selectionBox.end.x);
          const selTop = Math.min(selectionBox.start.y, selectionBox.end.y);
          const selRight = Math.max(selectionBox.start.x, selectionBox.end.x);
          const selBottom = Math.max(selectionBox.start.y, selectionBox.end.y);
          
          return compX < selRight && compRight > selLeft && compY < selBottom && compBottom > selTop;
        })
        .map(comp => comp.id);
      
      setSelectedComponents(selectedIds);
      setIsSelecting(false);
      setSelectionBox(null);
    }
  }, [isSelecting, selectionBox, components]);

  // Group management functions
  const createGroup = useCallback((componentIds: string[], name: string = 'New Group') => {
    if (componentIds.length < 2) return;
    
    const groupComponents = components.filter(comp => componentIds.includes(comp.id));
    if (groupComponents.length === 0) return;
    
    // Calculate group bounds
    const minX = Math.min(...groupComponents.map(comp => comp.position.x));
    const minY = Math.min(...groupComponents.map(comp => comp.position.y));
    const maxX = Math.max(...groupComponents.map(comp => comp.position.x + 100));
    const maxY = Math.max(...groupComponents.map(comp => comp.position.y + 80));
    
    const newGroup: ComponentGroup = {
      id: generateUUID(),
      name,
      componentIds,
      color: `hsl(${Math.random() * 360}, 70%, 85%)`,
      position: { x: minX - 10, y: minY - 30 },
      size: { width: maxX - minX + 20, height: maxY - minY + 40 },
      collapsed: false
    };
    
    setGroups(prev => [...prev, newGroup]);
    setSelectedComponents([]);
  }, [components]);

  const updateGroupName = useCallback((groupId: string, newName: string) => {
    setGroups(prev => prev.map(group => 
      group.id === groupId ? { ...group, name: newName } : group
    ));
  }, []);

  const deleteGroup = useCallback((groupId: string) => {
    setGroups(prev => prev.filter(group => group.id !== groupId));
  }, []);

  const toggleGroupCollapse = useCallback((groupId: string) => {
    setGroups(prev => prev.map(group =>
      group.id === groupId ? { ...group, collapsed: !group.collapsed } : group
    ));
  }, []);

  // Drop handler for components from the palette
  const [{ isOver }, drop] = useDrop({
    accept: 'component',
    drop: (item: DragItem, monitor) => {
      const offset = monitor.getClientOffset();
      const canvasRect = canvasRef.current?.getBoundingClientRect();

      if (offset && canvasRect) {
        const canvasPosition = screenToCanvas(offset.x, offset.y);
        const initialPosition = snapToGrid({
          x: Math.max(0, Math.min(width - 100, canvasPosition.x)),
          y: Math.max(0, Math.min(height - 100, canvasPosition.y))
        });

        // Find a position without collision
        const finalPosition = checkCollision(initialPosition)
          ? findAvailablePosition(initialPosition)
          : initialPosition;

        const newComponent = componentLibrary.createComponent(
          item.componentKey,
          item.componentType,
          finalPosition
        );

        if (newComponent) {
          setComponents(prev => [...prev, newComponent]);
          onComponentAdd?.(newComponent);
        }
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver()
    })
  });

  // Handle component selection (without auto-opening config panel)
  const handleComponentSelect = useCallback((component: Component | null) => {
    setSelectedComponent(component);
    onComponentSelect?.(component);
    // Don't auto-open config panel - user must click "Configure" from menu
  }, [onComponentSelect]);

  // Handle component position updates
  const handleComponentMove = useCallback((componentId: string, newPosition: Position) => {
    const snappedPosition = snapToGrid(newPosition);
    
    // Check for collision, but allow slight overlap during drag (user can adjust)
    // Only prevent if there's significant overlap
    const hasCollision = checkCollision(snappedPosition, componentId);
    
    // If collision detected, try to find nearby available position
    const finalPosition = hasCollision
      ? findAvailablePosition(snappedPosition)
      : snappedPosition;
    
    setComponents(prev => 
      prev.map(comp => 
        comp.id === componentId 
          ? { ...comp, position: finalPosition }
          : comp
      )
    );

    // Update the selected component if it's the one being moved
    if (selectedComponent?.id === componentId) {
      const updatedComponent = { ...selectedComponent, position: finalPosition };
      setSelectedComponent(updatedComponent);
      onComponentUpdate?.(updatedComponent);
    }
  }, [selectedComponent, onComponentUpdate, snapToGrid, checkCollision, findAvailablePosition]);

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
      setConnectionContextMenu(null);
      onConnectionSelect?.(null);
      setContextMenu(null);
    }
    connectionManager.handleCanvasClick(e);
  }, [handleComponentSelect, onConnectionSelect, connectionManager]);

  // Handle context menu (for both left-click and right-click)
  const handleContextMenu = useCallback((component: Component, position: { x: number; y: number }) => {
    setContextMenu({ component, position });
    handleComponentSelect(component);
  }, [handleComponentSelect]);

  // Handle component click - show menu instead of opening config panel
  const handleComponentClick = useCallback((component: Component, position: { x: number; y: number }) => {
    setContextMenu({ component, position });
    handleComponentSelect(component);
  }, [handleComponentSelect]);

  // Keep parent informed of component count without mutating it during render
  useEffect(() => {
    onComponentCountChange?.(components.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [components.length]);

  // Handle component deletion
  const handleComponentDelete = useCallback((componentId: string) => {
    // Remove component
    setComponents(prev => prev.filter(comp => comp.id !== componentId));
    
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
      id: generateUUID(),
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

  // Handle component configuration - delegate to parent
  const handleComponentConfigure = useCallback((component: Component) => {
    handleComponentSelect(component);
    onComponentConfigure?.(component);
    setContextMenu(null);
  }, [handleComponentSelect, onComponentConfigure]);

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
            setConnectionContextMenu(null);
            onConnectionSelect?.(null);
            setContextMenu(null);
            setSelectedComponents([]);
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
            setConnectionContextMenu(null);
            onConnectionSelect?.(null);
            break;
        }
      } else if (selectedComponents.length > 0) {
        switch (e.key) {
          case 'g':
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              const groupName = prompt('Enter group name:', 'New Group');
              if (groupName) {
                createGroup(selectedComponents, groupName);
              }
            }
            break;
          case 'Escape':
            setSelectedComponents([]);
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedComponent, selectedConnection, selectedComponents, handleComponentDelete, handleComponentDuplicate, handleComponentSelect, onConnectionSelect, connectionManager, createGroup]);

  return (
    <div
      id="canvas"
      ref={(node) => {
        // Use Object.defineProperty to work around readonly constraint
        if (node) {
          Object.defineProperty(canvasRef, 'current', {
            value: node,
            writable: false,
            enumerable: true,
            configurable: true
          });
          drop(node);
        }
      }}
      className={`canvas ${isOver ? 'canvas--drop-active' : ''}`}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        position: 'relative',
        border: '2px solid #e0e0e0',
        borderRadius: '8px',
        backgroundColor: isOver ? '#f0f8ff' : '#fafafa',
        backgroundImage: enableGridSnapping ? `
          radial-gradient(circle, #ddd 1px, transparent 1px)
        ` : 'none',
        backgroundSize: enableGridSnapping ? `${gridSize * zoom}px ${gridSize * zoom}px` : 'auto',
        backgroundPosition: `${pan.x % (gridSize * zoom)}px ${pan.y % (gridSize * zoom)}px`,
        overflow: 'hidden',
        cursor: isPanning ? 'grabbing' : (enableZoom ? 'grab' : 'default')
      }}
      onClick={handleCanvasClick}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      {/* Canvas content with zoom and pan transform */}
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          width: '100%',
          height: '100%',
          position: 'relative'
        }}
      >
        {/* Groups layer (behind components) */}
        {groups.map(group => (
          <div
            key={group.id}
            style={{
              position: 'absolute',
              left: `${group.position.x}px`,
              top: `${group.position.y}px`,
              width: `${group.size.width}px`,
              height: `${group.size.height}px`,
              backgroundColor: group.color,
              border: '2px dashed #666',
              borderRadius: '8px',
              zIndex: 0,
              pointerEvents: 'none'
            }}
          >
            {/* Group label */}
            <div
              style={{
                position: 'absolute',
                top: '-25px',
                left: '0px',
                backgroundColor: '#666',
                color: 'white',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 'bold',
                pointerEvents: 'auto',
                cursor: 'pointer'
              }}
              onClick={() => {
                const newName = prompt('Enter new group name:', group.name);
                if (newName) updateGroupName(group.id, newName);
              }}
              onDoubleClick={() => toggleGroupCollapse(group.id)}
              title="Click to rename, double-click to collapse/expand"
            >
              {group.collapsed ? '▶' : '▼'} {group.name}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteGroup(group.id);
                }}
                style={{
                  marginLeft: '8px',
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '10px'
                }}
                title="Delete group"
              >
                ×
              </button>
            </div>
          </div>
        ))}
        
        {/* Selection box */}
        {isSelecting && selectionBox && (
          <div
            style={{
              position: 'absolute',
              left: `${Math.min(selectionBox.start.x, selectionBox.end.x)}px`,
              top: `${Math.min(selectionBox.start.y, selectionBox.end.y)}px`,
              width: `${Math.abs(selectionBox.end.x - selectionBox.start.x)}px`,
              height: `${Math.abs(selectionBox.end.y - selectionBox.start.y)}px`,
              border: '2px dashed #007bff',
              backgroundColor: 'rgba(0, 123, 255, 0.1)',
              pointerEvents: 'none',
              zIndex: 50
            }}
          />
        )}
        
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
        {components.map(component => {
          // Get connection validation for this component if we're connecting
          let connectionValidation;
          if (connectionManager.isConnecting && connectionManager.wireInProgress) {
            const sourceComponent = components.find(c => c.id === connectionManager.wireInProgress!.sourceComponentId);
            if (sourceComponent && sourceComponent.id !== component.id) {
              connectionValidation = connectionManager.validateConnection(sourceComponent, component);
            }
          }
          
          // Check if component is in a collapsed group
          const parentGroup = groups.find(group => group.componentIds.includes(component.id));
          const isInCollapsedGroup = parentGroup?.collapsed;
          
          if (isInCollapsedGroup) return null; // Don't render components in collapsed groups
          
          return (
            <CanvasComponent
              key={component.id}
              component={component}
              isSelected={selectedComponent?.id === component.id || selectedComponents.includes(component.id)}
              onSelect={(comp, event) => {
                if (comp && selectedComponents.length > 0) {
                  // If we have multiple selected and clicking on one, select just that one
                  setSelectedComponents([]);
                }
                // Show context menu on click instead of opening config panel
                if (comp && event) {
                  handleComponentClick(comp, { x: event.clientX, y: event.clientY });
                } else if (!comp) {
                  // Deselect if clicking on nothing
                  handleComponentSelect(null);
                  setContextMenu(null);
                }
              }}
              onMove={handleComponentMove}
              onContextMenu={handleContextMenu}
              onConnectionPointClick={connectionManager.handleConnectionPointClick}
              isConnecting={connectionManager.isConnecting}
              canConnect={(comp) => {
                const validation = connectionManager.validateConnection(
                  components.find(c => c.id === connectionManager.wireInProgress?.sourceComponentId) || comp,
                  comp
                );
                return validation.valid;
              }}
              connectionValidation={connectionValidation}
              isBottleneck={bottlenecks.has(component.id)}
              bottleneckSeverity={bottlenecks.get(component.id)?.severity || 'low'}
            />
          );
        })}
      </div>
      
      {/* UI Overlays (not affected by zoom/pan) */}
      
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
      
      {/* Grouping Controls */}
      {selectedComponents.length > 1 && (
        <div
          style={{
            position: 'absolute',
            top: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid #ddd',
            borderRadius: '6px',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            zIndex: 100,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
          }}
        >
          <span style={{ fontSize: '12px', color: '#666' }}>
            {selectedComponents.length} components selected
          </span>
          <button
            onClick={() => {
              const groupName = prompt('Enter group name:', 'New Group');
              if (groupName) {
                createGroup(selectedComponents, groupName);
              }
            }}
            style={{
              padding: '4px 8px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
            title="Create Group (Ctrl+G)"
          >
            📦 Group
          </button>
          <button
            onClick={() => setSelectedComponents([])}
            style={{
              padding: '4px 8px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Clear
          </button>
        </div>
      )}
      
      {/* Empty canvas guidance */}
      {components.length === 0 && !connectionManager.isConnecting && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            color: 'white',
            padding: '16px 20px',
            borderRadius: '12px',
            boxShadow: '0 20px 45px rgba(15, 23, 42, 0.65)',
            maxWidth: '360px',
            textAlign: 'left',
            zIndex: 120
          }}
        >
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a5b4fc' }}>
            First step
          </div>
          <div style={{ marginTop: '4px', fontSize: '16px', fontWeight: 600 }}>
            Drag a Load Balancer to start.
          </div>
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#e5e7eb' }}>
            Then add a Web Server and Database from the left panel. Wire them together to create your
            first production-style system.
          </div>
        </div>
      )}

      {/* Instructions */}
      {components.length > 0 && selectedComponents.length === 0 && !connectionManager.isConnecting && (
        <div
          style={{
            position: 'absolute',
            bottom: '50px',
            left: '10px',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            border: '1px solid #ddd',
            borderRadius: '4px',
            padding: '8px',
            fontSize: '11px',
            color: '#666',
            maxWidth: '200px',
            zIndex: 100
          }}
        >
          <div><strong>Canvas Controls:</strong></div>
          <div>• Shift+Drag: Select multiple</div>
          <div>• Ctrl+G: Group selected</div>
          <div>• Ctrl+Wheel: Zoom</div>
          <div>• Middle-drag: Pan</div>
        </div>
      )}
      
      {/* Zoom and Grid Controls */}
      <div
        style={{
          position: 'absolute',
          bottom: '10px',
          right: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          zIndex: 100
        }}
      >
        {/* Zoom Controls */}
        {enableZoom && (
          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              border: '1px solid #ddd',
              borderRadius: '4px',
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <button
              onClick={() => setZoom(prev => Math.min(maxZoom, prev * 1.2))}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '16px',
                cursor: 'pointer',
                padding: '2px 6px'
              }}
              title="Zoom In"
            >
              +
            </button>
            <div style={{ fontSize: '10px', color: '#666' }}>
              {Math.round(zoom * 100)}%
            </div>
            <button
              onClick={() => setZoom(prev => Math.max(minZoom, prev / 1.2))}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '16px',
                cursor: 'pointer',
                padding: '2px 6px'
              }}
              title="Zoom Out"
            >
              -
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '10px',
                cursor: 'pointer',
                padding: '2px 4px',
                marginTop: '4px'
              }}
              title="Reset View"
            >
              Reset
            </button>
          </div>
        )}
        
        {/* Grid Toggle */}
        {enableGridSnapping && (
          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              border: '1px solid #ddd',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '10px',
              color: '#666'
            }}
          >
            Grid: {gridSize}px
          </div>
        )}
      </div>
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
      
    </div>
  );
};
