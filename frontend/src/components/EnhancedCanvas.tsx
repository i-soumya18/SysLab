/**
 * Enhanced Canvas Component with Performance Optimizations
 * Interactive canvas for designing system architectures with advanced features
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useDrop } from 'react-dnd';
import { CanvasComponent } from './CanvasComponent';
import { ConnectionWire } from './ConnectionWire';
import { ContextMenu } from './ContextMenu';
import { ComponentConfigPanel } from './ComponentConfigPanel';
import { ConnectionConfigPanel } from './ConnectionConfigPanel';
import type { Component, Connection } from '../types';
import { debounce, throttle, getVisibleComponents, getVisibleConnections, PerformanceMetrics } from '../utils/performance';
import { ErrorFactory, GlobalErrorHandler } from '../utils/errorHandling';
import { useLoadingState, LoadingOperations } from '../utils/loadingStates';

interface EnhancedCanvasProps {
  width: number;
  height: number;
  onComponentAdd: (component: Component) => void;
  onComponentSelect: (component: Component | null) => void;
  onComponentUpdate: (component: Component) => void;
  onComponentDelete: (componentId: string) => void;
  onComponentCountChange: (count: number) => void;
}

export const EnhancedCanvas: React.FC<EnhancedCanvasProps> = ({
  width,
  height,
  onComponentAdd,
  onComponentSelect,
  onComponentUpdate,
  onComponentDelete,
  onComponentCountChange
}) => {
  // State management
  const [components, setComponents] = useState<Component[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; component?: Component } | null>(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, width, height, zoom: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Refs
  const canvasRef = useRef<HTMLDivElement>(null);
  const performanceMetrics = useRef(new PerformanceMetrics());
  const errorHandler = GlobalErrorHandler.getInstance();
  const renderLoadingState = useLoadingState(LoadingOperations.CANVAS_RENDER);

  // Performance optimizations
  const visibleComponents = useMemo(() => {
    const startTime = performance.now();
    const visible = getVisibleComponents(components, viewport);
    const renderTime = performance.now() - startTime;
    performanceMetrics.current.recordRenderTime(renderTime);
    return visible;
  }, [components, viewport]);

  const visibleConnections = useMemo(() => {
    return getVisibleConnections(connections, visibleComponents);
  }, [connections, visibleComponents]);

  // Debounced handlers for performance
  const debouncedComponentUpdate = useCallback(
    debounce((component: Component) => {
      onComponentUpdate(component);
    }, 300),
    [onComponentUpdate]
  );

  const throttledViewportUpdate = useCallback(
    throttle((newViewport: typeof viewport) => {
      setViewport(newViewport);
    }, 16), // 60fps
    []
  );

  // Drop functionality
  const [{ isOver }, drop] = useDrop({
    accept: 'component',
    drop: (item: { type: string; componentType: string }, monitor) => {
      try {
        const clientOffset = monitor.getClientOffset();
        
        if (clientOffset && canvasRef.current) {
          const canvasRect = canvasRef.current.getBoundingClientRect();
          const x = (clientOffset.x - canvasRect.left - viewport.x) / viewport.zoom;
          const y = (clientOffset.y - canvasRect.top - viewport.y) / viewport.zoom;

          const newComponent: Component = {
            id: `${item.componentType}-${Date.now()}`,
            type: item.componentType as any,
            position: { x: Math.max(0, x), y: Math.max(0, y) },
            configuration: getDefaultConfiguration(item.componentType),
            metadata: {
              name: getComponentDisplayName(item.componentType),
              description: `${getComponentDisplayName(item.componentType)} component`,
              version: '1.0.0'
            }
          };

          handleComponentAdd(newComponent);
        }
      } catch (error) {
        const appError = ErrorFactory.createCanvasError(
          'Failed to add component to canvas',
          'Canvas drop handler'
        );
        errorHandler.handleError(appError);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver()
    })
  });

  // Component management
  const handleComponentAdd = useCallback((component: Component) => {
    try {
      setComponents(prev => {
        const updated = [...prev, component];
        onComponentCountChange(updated.length);
        return updated;
      });
      onComponentAdd(component);
    } catch (error) {
      const appError = ErrorFactory.createCanvasError(
        'Failed to add component',
        'Component addition'
      );
      errorHandler.handleError(appError);
    }
  }, [onComponentAdd, onComponentCountChange]);

  const handleComponentSelect = useCallback((component: Component | null) => {
    try {
      setSelectedComponent(component);
      setSelectedConnection(null);
      onComponentSelect(component);
    } catch (error) {
      const appError = ErrorFactory.createCanvasError(
        'Failed to select component',
        'Component selection'
      );
      errorHandler.handleError(appError);
    }
  }, [onComponentSelect]);

  const handleComponentUpdate = useCallback((updatedComponent: Component) => {
    try {
      setComponents(prev => 
        prev.map(comp => comp.id === updatedComponent.id ? updatedComponent : comp)
      );
      
      if (selectedComponent?.id === updatedComponent.id) {
        setSelectedComponent(updatedComponent);
      }
      
      debouncedComponentUpdate(updatedComponent);
    } catch (error) {
      const appError = ErrorFactory.createCanvasError(
        'Failed to update component',
        'Component update'
      );
      errorHandler.handleError(appError);
    }
  }, [selectedComponent, debouncedComponentUpdate]);

  const handleComponentDelete = useCallback((componentId: string) => {
    try {
      setComponents(prev => {
        const updated = prev.filter(comp => comp.id !== componentId);
        onComponentCountChange(updated.length);
        return updated;
      });
      
      // Remove connections involving this component
      setConnections(prev => 
        prev.filter(conn => 
          conn.sourceComponentId !== componentId && 
          conn.targetComponentId !== componentId
        )
      );

      if (selectedComponent?.id === componentId) {
        setSelectedComponent(null);
      }

      onComponentDelete(componentId);
    } catch (error) {
      const appError = ErrorFactory.createCanvasError(
        'Failed to delete component',
        'Component deletion'
      );
      errorHandler.handleError(appError);
    }
  }, [selectedComponent, onComponentDelete, onComponentCountChange]);

  // Context menu handling
  const handleContextMenu = useCallback((e: React.MouseEvent, component?: Component) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      component
    });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Viewport management
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(3, viewport.zoom * zoomFactor));
    
    throttledViewportUpdate({
      ...viewport,
      zoom: newZoom
    });
  }, [viewport, throttledViewportUpdate]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.ctrlKey)) { // Middle mouse or Ctrl+click
      setIsDragging(true);
      setDragOffset({ x: e.clientX, y: e.clientY });
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      const deltaX = e.clientX - dragOffset.x;
      const deltaY = e.clientY - dragOffset.y;
      
      throttledViewportUpdate({
        ...viewport,
        x: viewport.x + deltaX,
        y: viewport.y + deltaY
      });
      
      setDragOffset({ x: e.clientX, y: e.clientY });
    }
  }, [isDragging, dragOffset, viewport, throttledViewportUpdate]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Performance monitoring
  useEffect(() => {
    const metrics = performanceMetrics.current.getMetrics();
    if (metrics.isPerformanceDegraded) {
      console.warn('Canvas performance degraded:', metrics);
    }
  }, [visibleComponents.length]);

  // Render optimization - only render visible components
  const renderComponents = useMemo(() => {
    const startTime = performance.now();
    
    const rendered = visibleComponents.map(component => (
      <CanvasComponent
        key={component.id}
        component={component}
        isSelected={selectedComponent?.id === component.id}
        onSelect={handleComponentSelect}
        onUpdate={handleComponentUpdate}
        onDelete={handleComponentDelete}
        onContextMenu={handleContextMenu}
        zoom={viewport.zoom}
      />
    ));
    
    const renderTime = performance.now() - startTime;
    performanceMetrics.current.recordRenderTime(renderTime);
    
    return rendered;
  }, [visibleComponents, selectedComponent, viewport.zoom, handleComponentSelect, handleComponentUpdate, handleComponentDelete, handleContextMenu]);

  const renderConnections = useMemo(() => {
    return visibleConnections.map(connection => {
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
          onSelect={setSelectedConnection}
          zoom={viewport.zoom}
        />
      );
    });
  }, [visibleConnections, components, selectedConnection, viewport.zoom]);

  return (
    <div
      ref={(node) => {
        canvasRef.current = node;
        drop(node);
      }}
      style={{
        width,
        height,
        border: '2px solid #e0e0e0',
        borderRadius: '8px',
        backgroundColor: isOver ? '#f0f8ff' : '#fafafa',
        position: 'relative',
        overflow: 'hidden',
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => handleContextMenu(e)}
      onClick={handleCloseContextMenu}
    >
      {/* Performance indicator */}
      {performanceMetrics.current.isPerformanceDegraded() && (
        <div style={{
          position: 'absolute',
          top: 10,
          right: 10,
          background: 'orange',
          color: 'white',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 1000
        }}>
          Performance Warning
        </div>
      )}

      {/* Canvas content */}
      <div
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
          width: '100%',
          height: '100%'
        }}
      >
        {/* Connections layer */}
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 1
          }}
        >
          {renderConnections}
        </svg>

        {/* Components layer */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          {renderComponents}
        </div>

        {/* Empty state */}
        {components.length === 0 && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            color: '#666',
            fontSize: '18px',
            pointerEvents: 'none'
          }}>
            <div>Drop components here to start designing</div>
            <div style={{ fontSize: '14px', marginTop: '8px' }}>
              Drag components from the palette on the left
            </div>
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          component={contextMenu.component}
          onClose={handleCloseContextMenu}
          onDelete={contextMenu.component ? () => handleComponentDelete(contextMenu.component!.id) : undefined}
        />
      )}

      {/* Configuration panels */}
      {selectedComponent && (
        <ComponentConfigPanel
          component={selectedComponent}
          onUpdate={handleComponentUpdate}
          onClose={() => setSelectedComponent(null)}
        />
      )}

      {selectedConnection && (
        <ConnectionConfigPanel
          connection={selectedConnection}
          onUpdate={(updatedConnection) => {
            setConnections(prev => 
              prev.map(conn => conn.id === updatedConnection.id ? updatedConnection : conn)
            );
            setSelectedConnection(updatedConnection);
          }}
          onClose={() => setSelectedConnection(null)}
        />
      )}

      {/* Status info */}
      <div style={{
        position: 'absolute',
        bottom: 10,
        left: 10,
        background: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px'
      }}>
        Components: {components.length} | Visible: {visibleComponents.length} | Zoom: {Math.round(viewport.zoom * 100)}%
      </div>
    </div>
  );
};

// Helper functions
function getDefaultConfiguration(componentType: string) {
  const configs = {
    'database': { capacity: 1000, latency: 20, failureRate: 0.001, connectionPoolSize: 100, queryTimeoutMs: 5000, cacheHitRatio: 0.8 },
    'load-balancer': { capacity: 2000, latency: 10, failureRate: 0.0005, algorithm: 'round-robin', healthCheckInterval: 5000 },
    'web-server': { capacity: 1000, latency: 50, failureRate: 0.002, cpuCores: 4, memoryGB: 8, maxConnections: 1000 },
    'cache': { capacity: 500, latency: 5, failureRate: 0.0001, maxMemoryMB: 512, evictionPolicy: 'LRU', hitRatio: 0.85 },
    'message-queue': { capacity: 10000, latency: 15, failureRate: 0.001, maxQueueSize: 100000, processingRate: 1000 },
    'cdn': { capacity: 5000, latency: 30, failureRate: 0.0002, cacheSize: 1000, ttl: 3600 }
  };
  
  return configs[componentType as keyof typeof configs] || { capacity: 1000, latency: 50, failureRate: 0.001 };
}

function getComponentDisplayName(componentType: string): string {
  const names = {
    'database': 'Database',
    'load-balancer': 'Load Balancer',
    'web-server': 'Web Server',
    'cache': 'Cache',
    'message-queue': 'Message Queue',
    'cdn': 'CDN'
  };
  
  return names[componentType as keyof typeof names] || componentType;
}