/**
 * Component Palette - Draggable component library
 * Provides a palette of system design components that can be dragged onto the canvas
 */

import React, { useMemo, useState, useRef } from 'react';
import { useDrag } from 'react-dnd';
import type { ComponentType } from '../types';
import { componentLibrary } from './ComponentLibrary';

// Draggable palette item interface
interface PaletteItemProps {
  componentType: ComponentType;
  componentKey: string;
  name: string;
  icon: string;
  color: string;
}

// Individual draggable palette item
const PaletteItem: React.FC<PaletteItemProps> = ({
  componentType,
  componentKey,
  name,
  icon,
  color
}) => {
  const [{ isDragging }, drag] = useDrag({
    type: 'component',
    item: { 
      type: 'component',
      componentType,
      componentKey
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  });

  return (
    <div
      ref={drag as any}
      className={`palette-item ${isDragging ? 'palette-item--dragging' : ''}`}
      style={{
        width: '80px',
        height: '70px',
        backgroundColor: color,
        border: '2px solid #fff',
        borderRadius: '6px',
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.5 : 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: '10px',
        fontWeight: 'bold',
        textAlign: 'center',
        padding: '4px',
        margin: '4px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        transition: 'all 0.2s ease',
        userSelect: 'none'
      }}
    >
      <div style={{ fontSize: '20px', marginBottom: '2px' }}>
        {icon}
      </div>
      <div style={{ 
        fontSize: '8px', 
        lineHeight: '1.1',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        width: '70px'
      }}>
        {name}
      </div>
    </div>
  );
};

// Component palette interface
interface ComponentPaletteProps {
  className?: string;
  width?: number;
  height?: number;
  onWidthChange?: (width: number) => void;
  onHeightChange?: (height: number) => void;
}

// Component category configuration
const COMPONENT_CATEGORIES: Record<string, { icon: string; color: string }> = {
  'client': { icon: '👤', color: '#6C63FF' },
  'load-balancer': { icon: '⚖️', color: '#2196F3' },
  'web-server': { icon: '🔧', color: '#FF9800' },
  'database': { icon: '🗄️', color: '#4CAF50' },
  'cache': { icon: '⚡', color: '#FFC107' },
  'message-queue': { icon: '📨', color: '#9C27B0' },
  'cdn': { icon: '🌍', color: '#00BCD4' },
  'proxy': { icon: '🔄', color: '#795548' },
  'api-gateway': { icon: '🚪', color: '#E91E63' },
  'search-engine': { icon: '🔍', color: '#3F51B5' },
  'object-storage': { icon: '📦', color: '#009688' },
  'service-mesh': { icon: '🕸️', color: '#FF5722' },
  'rate-limiter': { icon: '⏱️', color: '#607D8B' },
  'circuit-breaker': { icon: '🔌', color: '#F44336' },
  'auth-service': { icon: '🔐', color: '#673AB7' },
  'monitoring': { icon: '📊', color: '#00ACC1' },
  'logging': { icon: '📝', color: '#8BC34A' }
};

// Component display names
const COMPONENT_DISPLAY_NAMES: Record<string, string> = {
  'client': 'Client',
  'load-balancer': 'Load Balancer',
  'web-server': 'Service',
  'database': 'Database',
  'cache': 'Cache',
  'message-queue': 'Message Queue',
  'cdn': 'CDN',
  'proxy': 'Proxy',
  'api-gateway': 'API Gateway',
  'search-engine': 'Search Engine',
  'object-storage': 'Object Storage',
  'service-mesh': 'Service Mesh',
  'rate-limiter': 'Rate Limiter',
  'circuit-breaker': 'Circuit Breaker',
  'auth-service': 'Auth Service',
  'monitoring': 'Monitoring',
  'logging': 'Logging'
};

// Main component palette
export const ComponentPalette: React.FC<ComponentPaletteProps> = ({ 
  className,
  width: externalWidth,
  height: externalHeight,
  onWidthChange,
  onHeightChange
}) => {
  // Resizable dimensions state - use external if provided, otherwise use internal state
  const [internalWidth, setInternalWidth] = useState<number>(200);
  const [internalHeight, setInternalHeight] = useState<number>(600);
  
  const width = externalWidth ?? internalWidth;
  const height = externalHeight ?? internalHeight;
  
  const setWidth = (newWidth: number) => {
    if (onWidthChange) {
      onWidthChange(newWidth);
    } else {
      setInternalWidth(newWidth);
    }
  };
  
  const setHeight = (newHeight: number) => {
    if (onHeightChange) {
      onHeightChange(newHeight);
    } else {
      setInternalHeight(newHeight);
    }
  };
  
  // Resize constraints
  const minWidth = 150;
  const maxWidth = 500;
  const minHeight = 300;
  // If height is externally controlled, use a large max; otherwise use a reasonable max
  const maxHeight = externalHeight ? 2000 : 1200;
  
  // Resize state refs
  const isResizingRef = useRef<'width' | 'height' | 'both' | null>(null);
  const startXRef = useRef<number>(0);
  const startYRef = useRef<number>(0);
  const startWidthRef = useRef<number>(200);
  const startHeightRef = useRef<number>(600);

  // Handle horizontal resize (right edge)
  const handleHorizontalResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = 'width';
    startXRef.current = e.clientX;
    startWidthRef.current = width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (isResizingRef.current !== 'width' && isResizingRef.current !== 'both') return;
      const deltaX = moveEvent.clientX - startXRef.current;
      const newWidth = Math.min(
        Math.max(startWidthRef.current + deltaX, minWidth),
        maxWidth
      );
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizingRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Handle vertical resize (bottom edge)
  const handleVerticalResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = 'height';
    startYRef.current = e.clientY;
    startHeightRef.current = height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (isResizingRef.current !== 'height' && isResizingRef.current !== 'both') return;
      const deltaY = moveEvent.clientY - startYRef.current;
      const newHeight = Math.min(
        Math.max(startHeightRef.current + deltaY, minHeight),
        maxHeight
      );
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      isResizingRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Handle diagonal resize (corner)
  const handleDiagonalResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = 'both';
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    startWidthRef.current = width;
    startHeightRef.current = height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (isResizingRef.current !== 'both') return;
      const deltaX = moveEvent.clientX - startXRef.current;
      const deltaY = moveEvent.clientY - startYRef.current;
      
      const newWidth = Math.min(
        Math.max(startWidthRef.current + deltaX, minWidth),
        maxWidth
      );
      const newHeight = Math.min(
        Math.max(startHeightRef.current + deltaY, minHeight),
        maxHeight
      );
      
      setWidth(newWidth);
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      isResizingRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Get all available components from the library
  const allComponents = useMemo(() => {
    const componentTypes: ComponentType[] = [
      'client',
      'load-balancer',
      'web-server',
      'database',
      'cache',
      'message-queue',
      'cdn',
      'proxy',
      'api-gateway',
      'search-engine',
      'object-storage',
      'service-mesh',
      'rate-limiter',
      'circuit-breaker',
      'auth-service',
      'monitoring',
      'logging'
    ];

    const components: Array<{
      componentType: ComponentType;
      componentKey: string;
      name: string;
      icon: string;
      color: string;
    }> = [];

    componentTypes.forEach(type => {
      const componentKeys = componentLibrary.getComponentsByType(type);
      const category = COMPONENT_CATEGORIES[type] || { icon: '📦', color: '#9E9E9E' };
      const displayName = COMPONENT_DISPLAY_NAMES[type] || type;

      // Get the first component of each type as the default
      if (componentKeys.length > 0) {
        const metadata = componentLibrary.getComponentMetadata(componentKeys[0]);
        components.push({
          componentType: type,
          componentKey: componentKeys[0],
          name: metadata?.name || displayName,
          icon: category.icon,
          color: category.color
        });
      }
    });

    return components;
  }, []);

  // Essential components (MVLE)
  const mvleComponents = useMemo(() => {
    return allComponents.filter(comp => 
      ['client', 'load-balancer', 'web-server', 'database'].includes(comp.componentType)
    );
  }, [allComponents]);

  // Other components
  const otherComponents = useMemo(() => {
    return allComponents.filter(comp => 
      !['client', 'load-balancer', 'web-server', 'database'].includes(comp.componentType)
    );
  }, [allComponents]);

  return (
    <div 
      className={`component-palette ${className || ''}`}
      style={{
        position: 'relative',
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: '#f8f9fa',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        padding: '16px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <h3 style={{
        margin: '0 0 16px 0',
        fontSize: '16px',
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'center'
      }}>
        Component Library
      </h3>
      
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden'
      }}>
        <div>
          <h4 style={{ fontSize: '12px', color: '#666', margin: '0 0 8px 0', fontWeight: 'bold' }}>
            Essential Components
          </h4>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr',
            gap: '8px' 
          }}>
            {mvleComponents.map(comp => (
              <PaletteItem key={comp.componentKey} {...comp} />
            ))}
          </div>
        </div>

        {otherComponents.length > 0 && (
          <div>
            <h4 style={{ fontSize: '12px', color: '#666', margin: '0 0 8px 0', fontWeight: 'bold' }}>
              Additional Components
            </h4>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr',
              gap: '8px' 
            }}>
              {otherComponents.map(comp => (
                <PaletteItem key={comp.componentKey} {...comp} />
              ))}
            </div>
          </div>
        )}

        <div style={{
          marginTop: '8px',
          padding: '12px',
          backgroundColor: '#e3f2fd',
          borderRadius: '6px',
          fontSize: '11px',
          color: '#1976d2',
          lineHeight: '1.4'
        }}>
          <strong>Getting Started:</strong><br />
          Drag components onto the canvas to build your system:
          <br />• Client → Load Balancer → Service → Database
        </div>
      </div>

      {/* Horizontal resize handle (right edge) */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize width"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '4px',
          height: '100%',
          cursor: 'col-resize',
          backgroundColor: 'transparent',
          zIndex: 10
        }}
        onMouseDown={handleHorizontalResize}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      />

      {/* Vertical resize handle (bottom edge) */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize height"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: '4px',
          cursor: 'row-resize',
          backgroundColor: 'transparent',
          zIndex: 10
        }}
        onMouseDown={handleVerticalResize}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      />

      {/* Diagonal resize handle (corner) */}
      <div
        role="separator"
        aria-label="Resize both dimensions"
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: '12px',
          height: '12px',
          cursor: 'nwse-resize',
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          borderTopLeftRadius: '8px',
          zIndex: 11
        }}
        onMouseDown={handleDiagonalResize}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
        }}
      />
    </div>
  );
};