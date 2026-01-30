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
  // Define available components with their display properties
  const paletteComponents = [
    // Databases
    { 
      componentType: 'database' as ComponentType, 
      componentKey: 'database-mysql', 
      name: 'MySQL', 
      icon: '🗄️', 
      color: '#4CAF50' 
    },
    { 
      componentType: 'database' as ComponentType, 
      componentKey: 'database-postgresql', 
      name: 'PostgreSQL', 
      icon: '🗄️', 
      color: '#336791' 
    },
    { 
      componentType: 'database' as ComponentType, 
      componentKey: 'database-mongodb', 
      name: 'MongoDB', 
      icon: '🗄️', 
      color: '#47A248' 
    },
    { 
      componentType: 'database' as ComponentType, 
      componentKey: 'database-redis', 
      name: 'Redis', 
      icon: '🗄️', 
      color: '#DC382D' 
    },

    // Load Balancers
    { 
      componentType: 'load-balancer' as ComponentType, 
      componentKey: 'load-balancer-nginx', 
      name: 'Nginx LB', 
      icon: '⚖️', 
      color: '#2196F3' 
    },
    { 
      componentType: 'load-balancer' as ComponentType, 
      componentKey: 'load-balancer-haproxy', 
      name: 'HAProxy', 
      icon: '⚖️', 
      color: '#1976D2' 
    },
    { 
      componentType: 'load-balancer' as ComponentType, 
      componentKey: 'load-balancer-awsAlb', 
      name: 'AWS ALB', 
      icon: '⚖️', 
      color: '#FF9900' 
    },

    // Web Servers
    { 
      componentType: 'web-server' as ComponentType, 
      componentKey: 'web-server-apache', 
      name: 'Apache', 
      icon: '🖥️', 
      color: '#FF9800' 
    },
    { 
      componentType: 'web-server' as ComponentType, 
      componentKey: 'web-server-nginx', 
      name: 'Nginx', 
      icon: '🖥️', 
      color: '#009639' 
    },
    { 
      componentType: 'web-server' as ComponentType, 
      componentKey: 'web-server-nodejs', 
      name: 'Node.js', 
      icon: '🖥️', 
      color: '#339933' 
    },

    // Caches
    { 
      componentType: 'cache' as ComponentType, 
      componentKey: 'cache-memcached', 
      name: 'Memcached', 
      icon: '💾', 
      color: '#9C27B0' 
    },
    { 
      componentType: 'cache' as ComponentType, 
      componentKey: 'cache-redis', 
      name: 'Redis Cache', 
      icon: '💾', 
      color: '#DC382D' 
    },
    { 
      componentType: 'cache' as ComponentType, 
      componentKey: 'cache-varnish', 
      name: 'Varnish', 
      icon: '💾', 
      color: '#673AB7' 
    },

    // Message Queues
    { 
      componentType: 'message-queue' as ComponentType, 
      componentKey: 'message-queue-kafka', 
      name: 'Kafka', 
      icon: '📬', 
      color: '#F44336' 
    },
    { 
      componentType: 'message-queue' as ComponentType, 
      componentKey: 'message-queue-rabbitmq', 
      name: 'RabbitMQ', 
      icon: '📬', 
      color: '#FF6600' 
    },
    { 
      componentType: 'message-queue' as ComponentType, 
      componentKey: 'message-queue-awsSqs', 
      name: 'AWS SQS', 
      icon: '📬', 
      color: '#FF9900' 
    },

    // CDNs
    { 
      componentType: 'cdn' as ComponentType, 
      componentKey: 'cdn-cloudflare', 
      name: 'Cloudflare', 
      icon: '🌐', 
      color: '#00BCD4' 
    },
    { 
      componentType: 'cdn' as ComponentType, 
      componentKey: 'cdn-awsCloudfront', 
      name: 'CloudFront', 
      icon: '🌐', 
      color: '#FF9900' 
    },
    { 
      componentType: 'cdn' as ComponentType, 
      componentKey: 'cdn-fastly', 
      name: 'Fastly', 
      icon: '🌐', 
      color: '#FF282D' 
    },

    // Proxies
    { 
      componentType: 'proxy' as ComponentType, 
      componentKey: 'proxy-squid', 
      name: 'Squid', 
      icon: '🔀', 
      color: '#795548' 
    },
    { 
      componentType: 'proxy' as ComponentType, 
      componentKey: 'proxy-envoy', 
      name: 'Envoy', 
      icon: '🔀', 
      color: '#AC6199' 
    },
    { 
      componentType: 'proxy' as ComponentType, 
      componentKey: 'proxy-traefik', 
      name: 'Traefik', 
      icon: '🔀', 
      color: '#24A1C1' 
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
        {/* Group components by type */}
        <div>
          <h4 style={{ fontSize: '12px', color: '#666', margin: '0 0 8px 0' }}>Databases</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {paletteComponents
              .filter(comp => comp.componentType === 'database')
              .map(comp => (
                <PaletteItem key={comp.componentKey} {...comp} />
              ))
            }
          </div>
        </div>

        <div>
          <h4 style={{ fontSize: '12px', color: '#666', margin: '0 0 8px 0' }}>Load Balancers</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {paletteComponents
              .filter(comp => comp.componentType === 'load-balancer')
              .map(comp => (
                <PaletteItem key={comp.componentKey} {...comp} />
              ))
            }
          </div>
        </div>

        <div>
          <h4 style={{ fontSize: '12px', color: '#666', margin: '0 0 8px 0' }}>Web Servers</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {paletteComponents
              .filter(comp => comp.componentType === 'web-server')
              .map(comp => (
                <PaletteItem key={comp.componentKey} {...comp} />
              ))
            }
          </div>
        </div>

        <div>
          <h4 style={{ fontSize: '12px', color: '#666', margin: '0 0 8px 0' }}>Caches</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {paletteComponents
              .filter(comp => comp.componentType === 'cache')
              .map(comp => (
                <PaletteItem key={comp.componentKey} {...comp} />
              ))
            }
          </div>
        </div>

        <div>
          <h4 style={{ fontSize: '12px', color: '#666', margin: '0 0 8px 0' }}>Message Queues</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {paletteComponents
              .filter(comp => comp.componentType === 'message-queue')
              .map(comp => (
                <PaletteItem key={comp.componentKey} {...comp} />
              ))
            }
          </div>
        </div>

        <div>
          <h4 style={{ fontSize: '12px', color: '#666', margin: '0 0 8px 0' }}>CDNs</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {paletteComponents
              .filter(comp => comp.componentType === 'cdn')
              .map(comp => (
                <PaletteItem key={comp.componentKey} {...comp} />
              ))
            }
          </div>
        </div>

        <div>
          <h4 style={{ fontSize: '12px', color: '#666', margin: '0 0 8px 0' }}>Proxies</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {paletteComponents
              .filter(comp => comp.componentType === 'proxy')
              .map(comp => (
                <PaletteItem key={comp.componentKey} {...comp} />
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
};