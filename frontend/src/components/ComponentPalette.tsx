/**
 * Component Palette - Draggable component library
 * Provides a palette of system design components that can be dragged onto the canvas
 */

import React from 'react';
import { useDrag } from 'react-dnd';
import type { ComponentType } from '../types';

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
}

// Main component palette
export const ComponentPalette: React.FC<ComponentPaletteProps> = ({ className }) => {
  // Define the 4 MVLE components: Client, LB, Service, DB
  const mvleComponents = [
    { 
      componentType: 'client' as ComponentType, 
      componentKey: 'client-web', 
      name: 'Client', 
      icon: '👤', 
      color: '#6C63FF' 
    },
    { 
      componentType: 'load-balancer' as ComponentType, 
      componentKey: 'load-balancer-nginx', 
      name: 'Load Balancer', 
      icon: '⚖️', 
      color: '#2196F3' 
    },
    { 
      componentType: 'web-server' as ComponentType, 
      componentKey: 'web-server-nodejs', 
      name: 'Service', 
      icon: '🔧', 
      color: '#FF9800' 
    },
    { 
      componentType: 'database' as ComponentType, 
      componentKey: 'database-mysql', 
      name: 'Database', 
      icon: '🗄️', 
      color: '#4CAF50' 
    }
  ];

  return (
    <div 
      className={`component-palette ${className || ''}`}
      style={{
        width: '200px',
        height: '100%',
        backgroundColor: '#f8f9fa',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        padding: '16px',
        overflowY: 'auto'
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
        gap: '12px'
      }}>
        <div>
          <h4 style={{ fontSize: '12px', color: '#666', margin: '0 0 8px 0' }}>
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

        <div style={{
          marginTop: '16px',
          padding: '12px',
          backgroundColor: '#e3f2fd',
          borderRadius: '6px',
          fontSize: '11px',
          color: '#1976d2',
          lineHeight: '1.4'
        }}>
          <strong>Getting Started:</strong><br />
          Drag these 4 components onto the canvas to build your first system:
          <br />• Client → Load Balancer → Service → Database
        </div>
      </div>
    </div>
  );
};