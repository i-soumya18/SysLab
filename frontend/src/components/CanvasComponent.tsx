/**
 * Canvas Component - Individual draggable component on the canvas
 * Handles component rendering, selection, and positioning
 */

import React, { useRef } from 'react';
import { useDrag } from 'react-dnd';
import type { Component, Position } from '../types';

interface CanvasComponentProps {
  component: Component;
  isSelected: boolean;
  onSelect: (component: Component | null) => void;
  onMove: (componentId: string, newPosition: Position) => void;
  onContextMenu?: (component: Component, position: { x: number; y: number }) => void;
  onConnectionPointClick?: (componentId: string, port: string, position: { x: number; y: number }) => void;
  isConnecting?: boolean;
  canConnect?: (component: Component) => boolean;
}

export const CanvasComponent: React.FC<CanvasComponentProps> = ({
  component,
  isSelected,
  onSelect,
  onMove,
  onContextMenu,
  onConnectionPointClick,
  isConnecting = false,
  canConnect: _canConnect = () => true
}) => {
  const ref = useRef<HTMLDivElement>(null);

  // Drag functionality for moving components on canvas
  const [{ isDragging }, drag] = useDrag({
    type: 'canvas-component',
    item: { id: component.id, type: 'canvas-component' },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    }),
    end: (_item, monitor) => {
      const offset = monitor.getClientOffset();
      const canvasRect = document.getElementById('canvas')?.getBoundingClientRect();
      
      if (offset && canvasRect) {
        const newPosition: Position = {
          x: Math.max(0, offset.x - canvasRect.left - 50), // Center the component
          y: Math.max(0, offset.y - canvasRect.top - 25)
        };
        onMove(component.id, newPosition);
      }
    }
  });

  drag(ref);

  // Handle component click for selection
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(isSelected ? null : component);
  };

  // Handle right-click for context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onContextMenu) {
      onContextMenu(component, { x: e.clientX, y: e.clientY });
    }
  };

  // Get component icon based on type
  const getComponentIcon = (type: string): string => {
    const icons: Record<string, string> = {
      'database': '🗄️',
      'load-balancer': '⚖️',
      'web-server': '🖥️',
      'cache': '💾',
      'message-queue': '📬',
      'cdn': '🌐',
      'proxy': '🔀'
    };
    return icons[type] || '📦';
  };

  // Get component color based on type
  const getComponentColor = (type: string): string => {
    const colors: Record<string, string> = {
      'database': '#4CAF50',
      'load-balancer': '#2196F3',
      'web-server': '#FF9800',
      'cache': '#9C27B0',
      'message-queue': '#F44336',
      'cdn': '#00BCD4',
      'proxy': '#795548'
    };
    return colors[type] || '#607D8B';
  };

  // Handle connection point click
  const handleConnectionPointClick = (port: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onConnectionPointClick) {
      const position = getConnectionPointPosition(port);
      onConnectionPointClick(component.id, port, position);
    }
  };

  // Get connection point position
  const getConnectionPointPosition = (port: string) => {
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

  const componentColor = getComponentColor(component.type);
  const componentIcon = getComponentIcon(component.type);
  const showConnectionPoints = isSelected || isConnecting;

  return (
    <div
      ref={ref as any}
      className={`canvas-component ${isSelected ? 'canvas-component--selected' : ''}`}
      style={{
        position: 'absolute',
        left: `${component.position.x}px`,
        top: `${component.position.y}px`,
        width: '100px',
        height: '80px',
        backgroundColor: componentColor,
        border: isSelected ? '3px solid #007bff' : '2px solid #fff',
        borderRadius: '8px',
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.5 : 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: '12px',
        fontWeight: 'bold',
        textAlign: 'center',
        padding: '4px',
        boxShadow: isSelected 
          ? '0 4px 12px rgba(0, 123, 255, 0.3)' 
          : '0 2px 8px rgba(0, 0, 0, 0.1)',
        transition: 'all 0.2s ease',
        userSelect: 'none',
        zIndex: isSelected ? 10 : 1
      }}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      {/* Selection indicator overlay */}
      {isSelected && (
        <div
          style={{
            position: 'absolute',
            top: '-6px',
            left: '-6px',
            right: '-6px',
            bottom: '-6px',
            border: '2px dashed #007bff',
            borderRadius: '10px',
            pointerEvents: 'none',
            animation: 'pulse-selection 2s infinite'
          }}
        />
      )}
      
      <div style={{ fontSize: '24px', marginBottom: '4px' }}>
        {componentIcon}
      </div>
      <div style={{ 
        fontSize: '10px', 
        lineHeight: '1.2',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        width: '90px'
      }}>
        {component.metadata.name}
      </div>
      
      {/* Connection points */}
      <div
        className="connection-point connection-point--top"
        style={{
          position: 'absolute',
          top: '-4px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '8px',
          height: '8px',
          backgroundColor: '#fff',
          border: '2px solid ' + componentColor,
          borderRadius: '50%',
          opacity: showConnectionPoints ? 1 : 0,
          transition: 'opacity 0.2s ease',
          cursor: isConnecting ? 'crosshair' : 'pointer',
          zIndex: 20
        }}
        onClick={handleConnectionPointClick('top')}
      />
      <div
        className="connection-point connection-point--bottom"
        style={{
          position: 'absolute',
          bottom: '-4px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '8px',
          height: '8px',
          backgroundColor: '#fff',
          border: '2px solid ' + componentColor,
          borderRadius: '50%',
          opacity: showConnectionPoints ? 1 : 0,
          transition: 'opacity 0.2s ease',
          cursor: isConnecting ? 'crosshair' : 'pointer',
          zIndex: 20
        }}
        onClick={handleConnectionPointClick('bottom')}
      />
      <div
        className="connection-point connection-point--left"
        style={{
          position: 'absolute',
          left: '-4px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '8px',
          height: '8px',
          backgroundColor: '#fff',
          border: '2px solid ' + componentColor,
          borderRadius: '50%',
          opacity: showConnectionPoints ? 1 : 0,
          transition: 'opacity 0.2s ease',
          cursor: isConnecting ? 'crosshair' : 'pointer',
          zIndex: 20
        }}
        onClick={handleConnectionPointClick('left')}
      />
      <div
        className="connection-point connection-point--right"
        style={{
          position: 'absolute',
          right: '-4px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '8px',
          height: '8px',
          backgroundColor: '#fff',
          border: '2px solid ' + componentColor,
          borderRadius: '50%',
          opacity: showConnectionPoints ? 1 : 0,
          transition: 'opacity 0.2s ease',
          cursor: isConnecting ? 'crosshair' : 'pointer',
          zIndex: 20
        }}
        onClick={handleConnectionPointClick('right')}
      />
    </div>
  );
};