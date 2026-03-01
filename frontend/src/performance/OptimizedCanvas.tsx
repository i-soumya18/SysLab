/**
 * Optimized Canvas Component for Real-Time UI Responsiveness
 * 
 * Implements SRS NFR-2: Optimize UI interactions for real-time feel with
 * optimistic updates and rollback capabilities
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { Component, Position, Connection } from '../types';
import { Canvas } from '../components/Canvas';
import { generateUUID } from '../utils/uuid';

// Performance optimization configuration
interface OptimizationConfig {
  enableVirtualization: boolean;
  enableOptimisticUpdates: boolean;
  enableBatching: boolean;
  renderThrottleMs: number;
  updateThrottleMs: number;
  maxVisibleComponents: number;
}

// Optimistic update state
interface OptimisticUpdate {
  id: string;
  type: 'component_move' | 'component_add' | 'component_delete' | 'connection_create';
  timestamp: number;
  data: any;
  rollback?: () => void;
}

// Performance metrics
interface PerformanceMetrics {
  renderTime: number;
  updateTime: number;
  frameRate: number;
  droppedFrames: number;
  optimisticUpdates: number;
  rollbacks: number;
}

interface OptimizedCanvasProps {
  width?: number;
  height?: number;
  onComponentAdd?: (component: Component) => void;
  onComponentSelect?: (component: Component | null) => void;
  onComponentUpdate?: (component: Component) => void;
  onComponentDelete?: (componentId: string) => void;
  onConnectionCreate?: (connection: Connection) => void;
  onConnectionDelete?: (connectionId: string) => void;
  optimizationConfig?: Partial<OptimizationConfig>;
  enablePerformanceMonitoring?: boolean;
}

export const OptimizedCanvas: React.FC<OptimizedCanvasProps> = ({
  width = 1200,
  height = 800,
  onComponentAdd,
  onComponentSelect,
  onComponentUpdate,
  onComponentDelete,
  onConnectionCreate,
  onConnectionDelete,
  optimizationConfig = {},
  enablePerformanceMonitoring = true
}) => {
  const config: OptimizationConfig = {
    enableVirtualization: true,
    enableOptimisticUpdates: true,
    enableBatching: true,
    renderThrottleMs: 16, // 60 FPS target
    updateThrottleMs: 50,
    maxVisibleComponents: 100,
    ...optimizationConfig
  };

  // State management
  const [components, setComponents] = useState<Component[]>([]);
  const [optimisticUpdates, setOptimisticUpdates] = useState<OptimisticUpdate[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    updateTime: 0,
    frameRate: 60,
    droppedFrames: 0,
    optimisticUpdates: 0,
    rollbacks: 0
  });

  // Refs for performance tracking
  const renderTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(performance.now());
  const updateBatchRef = useRef<Array<() => void>>([]);
  const renderRequestRef = useRef<number | null>(null);

  // Viewport state for virtualization
  const [viewport] = useState({
    x: 0,
    y: 0,
    width: width,
    height: height,
    zoom: 1
  });

  /**
   * Optimistic update system - SRS NFR-2
   */
  const createOptimisticUpdate = useCallback((
    type: OptimisticUpdate['type'],
    data: any,
    rollback?: () => void
  ): string => {
    const id = generateUUID();
    const update: OptimisticUpdate = {
      id,
      type,
      timestamp: performance.now(),
      data,
      rollback
    };

    setOptimisticUpdates(prev => [...prev, update]);
    setPerformanceMetrics(prev => ({
      ...prev,
      optimisticUpdates: prev.optimisticUpdates + 1
    }));

    return id;
  }, []);


  /**
   * Confirm optimistic update
   */
  const confirmOptimisticUpdate = useCallback((updateId: string) => {
    setOptimisticUpdates(prev => prev.filter(u => u.id !== updateId));
  }, []);

  /**
   * Batched render system for performance
   */
  const scheduleRender = useCallback(() => {
    if (renderRequestRef.current) return;

    renderRequestRef.current = requestAnimationFrame(() => {
      const startTime = performance.now();
      
      // Execute batched updates
      const updates = updateBatchRef.current.splice(0);
      updates.forEach(update => update());

      // Track render performance
      const renderTime = performance.now() - startTime;
      renderTimeRef.current = renderTime;

      // Update frame rate tracking
      const now = performance.now();
      const deltaTime = now - lastFrameTimeRef.current;
      frameCountRef.current++;
      
      if (deltaTime >= 1000) { // Update FPS every second
        const fps = Math.round((frameCountRef.current * 1000) / deltaTime);
        setPerformanceMetrics(prev => ({
          ...prev,
          renderTime,
          frameRate: fps,
          droppedFrames: fps < 55 ? prev.droppedFrames + 1 : prev.droppedFrames
        }));
        
        frameCountRef.current = 0;
        lastFrameTimeRef.current = now;
      }

      renderRequestRef.current = null;
    });
  }, []);

  /**
   * Optimized component movement with immediate visual feedback
   */
  const handleOptimisticComponentMove = useCallback((componentId: string, newPosition: Position) => {
    const originalComponent = components.find(c => c.id === componentId);
    if (!originalComponent) return;

    // Immediate visual update (optimistic)
    const updateId = createOptimisticUpdate(
      'component_move',
      { componentId, newPosition },
      () => {
        // Rollback function
        setComponents(prev => 
          prev.map(comp => 
            comp.id === componentId 
              ? { ...comp, position: originalComponent.position }
              : comp
          )
        );
      }
    );

    // Apply optimistic update immediately
    setComponents(prev => 
      prev.map(comp => 
        comp.id === componentId 
          ? { ...comp, position: newPosition }
          : comp
      )
    );

    // Schedule actual update
    setTimeout(() => {
      onComponentUpdate?.({ ...originalComponent, position: newPosition });
      confirmOptimisticUpdate(updateId);
    }, config.updateThrottleMs);

    scheduleRender();
  }, [components, createOptimisticUpdate, confirmOptimisticUpdate, onComponentUpdate, config.updateThrottleMs, scheduleRender]);

  /**
   * Optimized component addition
   */
  const handleOptimisticComponentAdd = useCallback((component: Component) => {
    // Immediate visual update
    const updateId = createOptimisticUpdate(
      'component_add',
      component,
      () => {
        setComponents(prev => prev.filter(c => c.id !== component.id));
      }
    );

    setComponents(prev => [...prev, component]);

    // Confirm with server
    setTimeout(() => {
      onComponentAdd?.(component);
      confirmOptimisticUpdate(updateId);
    }, config.updateThrottleMs);

    scheduleRender();
  }, [createOptimisticUpdate, confirmOptimisticUpdate, onComponentAdd, config.updateThrottleMs, scheduleRender]);

  /**
   * Viewport-based component virtualization
   */
  const visibleComponents = useMemo(() => {
    if (!config.enableVirtualization) return components;

    const buffer = 100; // Extra buffer around viewport
    const viewportBounds = {
      left: viewport.x - buffer,
      top: viewport.y - buffer,
      right: viewport.x + viewport.width + buffer,
      bottom: viewport.y + viewport.height + buffer
    };

    return components.filter(component => {
      const compBounds = {
        left: component.position.x,
        top: component.position.y,
        right: component.position.x + 100, // Assuming 100px component width
        bottom: component.position.y + 80   // Assuming 80px component height
      };

      return !(compBounds.right < viewportBounds.left ||
               compBounds.left > viewportBounds.right ||
               compBounds.bottom < viewportBounds.top ||
               compBounds.top > viewportBounds.bottom);
    }).slice(0, config.maxVisibleComponents);
  }, [components, viewport, config.enableVirtualization, config.maxVisibleComponents]);

  /**
   * Throttled event handlers
   */
  const throttledHandlers = useMemo(() => {
    const throttle = <T extends (...args: any[]) => void>(fn: T, delay: number): T => {
      let timeoutId: NodeJS.Timeout | null = null;
      let lastArgs: Parameters<T> | null = null;

      return ((...args: Parameters<T>) => {
        lastArgs = args;
        
        if (!timeoutId) {
          timeoutId = setTimeout(() => {
            if (lastArgs) {
              fn(...lastArgs);
            }
            timeoutId = null;
            lastArgs = null;
          }, delay);
        }
      }) as T;
    };

    return {
      onComponentMove: throttle(handleOptimisticComponentMove, config.renderThrottleMs),
      onComponentAdd: throttle(handleOptimisticComponentAdd, config.renderThrottleMs)
    };
  }, [handleOptimisticComponentMove, handleOptimisticComponentAdd, config.renderThrottleMs]);

  /**
   * Performance monitoring
   */
  useEffect(() => {
    if (!enablePerformanceMonitoring) return;

    const interval = setInterval(() => {
      // Clean up old optimistic updates (older than 5 seconds)
      const now = performance.now();
      setOptimisticUpdates(prev => {
        const expired = prev.filter(update => now - update.timestamp > 5000);
        expired.forEach(update => {
          if (update.rollback) {
            update.rollback();
            setPerformanceMetrics(metrics => ({
              ...metrics,
              rollbacks: metrics.rollbacks + 1
            }));
          }
        });
        return prev.filter(update => now - update.timestamp <= 5000);
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [enablePerformanceMonitoring]);

  /**
   * Performance warning system
   */
  useEffect(() => {
    if (performanceMetrics.frameRate < 30) {
      console.warn('Canvas performance degraded: FPS =', performanceMetrics.frameRate);
    }
    if (performanceMetrics.renderTime > 16) {
      console.warn('Canvas render time exceeded 16ms:', performanceMetrics.renderTime);
    }
  }, [performanceMetrics.frameRate, performanceMetrics.renderTime]);

  return (
    <div className="optimized-canvas-container">
      {/* Performance Monitor */}
      {enablePerformanceMonitoring && (
        <div className="performance-monitor" style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '8px',
          borderRadius: '4px',
          fontSize: '10px',
          zIndex: 1000,
          fontFamily: 'monospace'
        }}>
          <div>FPS: {performanceMetrics.frameRate}</div>
          <div>Render: {performanceMetrics.renderTime.toFixed(1)}ms</div>
          <div>Components: {visibleComponents.length}/{components.length}</div>
          <div>Optimistic: {optimisticUpdates.length}</div>
          <div>Rollbacks: {performanceMetrics.rollbacks}</div>
        </div>
      )}

      {/* Optimistic Updates Indicator */}
      {optimisticUpdates.length > 0 && (
        <div className="optimistic-updates-indicator" style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          backgroundColor: 'rgba(255, 193, 7, 0.9)',
          color: 'black',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 1000
        }}>
          Syncing changes... ({optimisticUpdates.length})
        </div>
      )}

      {/* Main Canvas */}
      <Canvas
        width={width}
        height={height}
        onComponentAdd={config.enableOptimisticUpdates ? throttledHandlers.onComponentAdd : onComponentAdd}
        onComponentSelect={onComponentSelect}
        onComponentUpdate={onComponentUpdate}
        onComponentDelete={onComponentDelete}
        onConnectionCreate={onConnectionCreate}
        onConnectionDelete={onConnectionDelete}
        enableGridSnapping={true}
        gridSize={20}
        enableZoom={true}
        minZoom={0.25}
        maxZoom={3.0}
      />
    </div>
  );
};

/**
 * Performance monitoring hook
 */
export const useCanvasPerformance = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    updateTime: 0,
    frameRate: 60,
    droppedFrames: 0,
    optimisticUpdates: 0,
    rollbacks: 0
  });

  const recordRenderTime = useCallback((time: number) => {
    setMetrics(prev => ({ ...prev, renderTime: time }));
  }, []);

  const recordUpdateTime = useCallback((time: number) => {
    setMetrics(prev => ({ ...prev, updateTime: time }));
  }, []);

  const recordFrameRate = useCallback((fps: number) => {
    setMetrics(prev => ({ 
      ...prev, 
      frameRate: fps,
      droppedFrames: fps < 55 ? prev.droppedFrames + 1 : prev.droppedFrames
    }));
  }, []);

  return {
    metrics,
    recordRenderTime,
    recordUpdateTime,
    recordFrameRate
  };
};
