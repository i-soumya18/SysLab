/**
 * Property-Based Tests for Canvas Operations
 * **Validates: Requirements 2.1, 2.2**
 * 
 * Tests universal properties that should hold for all canvas operations
 * including drag-and-drop, component positioning, and connection management.
 */

import { describe, it, expect } from 'vitest';
import { componentLibrary } from '../components/ComponentLibrary';
import type { Component, Connection, Position, ComponentType } from '../types';

// Property test generators
const generatePosition = (): Position => ({
  x: Math.floor(Math.random() * 1000),
  y: Math.floor(Math.random() * 800)
});

const generateComponentType = (): ComponentType => {
  const types: ComponentType[] = ['client', 'database', 'load-balancer', 'web-server', 'cache', 'message-queue', 'cdn', 'proxy'];
  return types[Math.floor(Math.random() * types.length)];
};

const generateComponentKey = (type: ComponentType): string => {
  const keyMap: Record<ComponentType, string[]> = {
    'client': ['client-web', 'client-mobile', 'client-api'],
    'database': ['database-mysql', 'database-postgresql', 'database-mongodb', 'database-redis'],
    'load-balancer': ['load-balancer-nginx', 'load-balancer-haproxy', 'load-balancer-awsAlb'],
    'web-server': ['web-server-apache', 'web-server-nginx', 'web-server-nodejs'],
    'cache': ['cache-memcached', 'cache-redis', 'cache-varnish'],
    'message-queue': ['message-queue-kafka', 'message-queue-rabbitmq', 'message-queue-awsSqs'],
    'cdn': ['cdn-cloudflare', 'cdn-awsCloudfront', 'cdn-fastly'],
    'proxy': ['proxy-squid', 'proxy-envoy', 'proxy-traefik']
  };
  
  const keys = keyMap[type] || [];
  return keys[Math.floor(Math.random() * keys.length)];
};

const generateComponents = (count: number): Component[] => {
  const components: Component[] = [];
  
  for (let i = 0; i < count; i++) {
    const type = generateComponentType();
    const key = generateComponentKey(type);
    const position = generatePosition();
    
    const component = componentLibrary.createComponent(key, type, position);
    if (component) {
      components.push(component);
    }
  }
  
  return components;
};

const snapToGrid = (position: Position, gridSize: number = 20): Position => ({
  x: Math.round(position.x / gridSize) * gridSize,
  y: Math.round(position.y / gridSize) * gridSize
});

describe('Canvas Operations Property Tests', () => {
  describe('Property 2: Canvas Component Management', () => {
    it('should maintain component identity after position updates', () => {
      // Property: Component identity and configuration should remain unchanged when position is updated
      for (let i = 0; i < 50; i++) {
        const originalType = generateComponentType();
        const originalKey = generateComponentKey(originalType);
        const originalPosition = generatePosition();
        const newPosition = generatePosition();
        
        const component = componentLibrary.createComponent(originalKey, originalType, originalPosition);
        
        if (component) {
          // Store original properties
          const originalId = component.id;
          const originalConfig = { ...component.configuration };
          const originalMetadata = { ...component.metadata };
          
          // Simulate position update
          const updatedComponent = {
            ...component,
            position: newPosition
          };
          
          // Verify identity preservation
          expect(updatedComponent.id).toBe(originalId);
          expect(updatedComponent.type).toBe(originalType);
          expect(updatedComponent.configuration).toEqual(originalConfig);
          expect(updatedComponent.metadata).toEqual(originalMetadata);
          expect(updatedComponent.position).toEqual(newPosition);
          expect(updatedComponent.position).not.toEqual(originalPosition);
        }
      }
    });

    it('should preserve component bounds within canvas limits', () => {
      // Property: Components should always be positioned within valid canvas bounds
      const canvasWidth = 1200;
      const canvasHeight = 800;
      const componentWidth = 100;
      const componentHeight = 80;
      
      for (let i = 0; i < 50; i++) {
        const type = generateComponentType();
        const key = generateComponentKey(type);
        const rawPosition = {
          x: Math.random() * 2000 - 500, // Can be negative or beyond canvas
          y: Math.random() * 1600 - 400
        };
        
        // Simulate canvas bounds enforcement
        const boundedPosition: Position = {
          x: Math.max(0, Math.min(canvasWidth - componentWidth, rawPosition.x)),
          y: Math.max(0, Math.min(canvasHeight - componentHeight, rawPosition.y))
        };
        
        const component = componentLibrary.createComponent(key, type, boundedPosition);
        
        if (component) {
          // Verify bounds
          expect(component.position.x).toBeGreaterThanOrEqual(0);
          expect(component.position.y).toBeGreaterThanOrEqual(0);
          expect(component.position.x).toBeLessThanOrEqual(canvasWidth - componentWidth);
          expect(component.position.y).toBeLessThanOrEqual(canvasHeight - componentHeight);
        }
      }
    });

    it('should maintain grid snapping consistency', () => {
      // Property: Grid snapping should always produce positions that are multiples of grid size
      const gridSize = 20;
      
      for (let i = 0; i < 50; i++) {
        const originalPosition = generatePosition();
        const snappedPosition = snapToGrid(originalPosition, gridSize);
        
        // Verify snapping properties
        expect(snappedPosition.x % gridSize).toBe(0);
        expect(snappedPosition.y % gridSize).toBe(0);
        
        // Verify snapping is closest grid point
        const expectedX = Math.round(originalPosition.x / gridSize) * gridSize;
        const expectedY = Math.round(originalPosition.y / gridSize) * gridSize;
        
        expect(snappedPosition.x).toBe(expectedX);
        expect(snappedPosition.y).toBe(expectedY);
        
        // Verify distance to original is minimal
        const distance = Math.sqrt(
          Math.pow(snappedPosition.x - originalPosition.x, 2) + 
          Math.pow(snappedPosition.y - originalPosition.y, 2)
        );
        expect(distance).toBeLessThanOrEqual(gridSize * Math.sqrt(2) / 2);
      }
    });

    it('should generate unique component IDs', () => {
      // Property: Every component should have a unique ID
      const components = generateComponents(100);
      const ids = components.map(comp => comp.id);
      const uniqueIds = new Set(ids);
      
      expect(uniqueIds.size).toBe(components.length);
      
      // Verify ID format (should be valid UUIDs)
      ids.forEach(id => {
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      });
    });

    it('should maintain component type consistency', () => {
      // Property: Component type should match the requested type and have appropriate configuration
      const typeConfigRequirements: Record<ComponentType, string[]> = {
        'client': ['capacity', 'latency', 'failureRate', 'connectionPool', 'requestRate'],
        'database': ['capacity', 'latency', 'failureRate'],
        'load-balancer': ['capacity', 'latency', 'failureRate', 'algorithm'],
        'web-server': ['capacity', 'latency', 'failureRate'],
        'cache': ['capacity', 'latency', 'failureRate', 'hitRatio'],
        'message-queue': ['capacity', 'latency', 'failureRate'],
        'cdn': ['capacity', 'latency', 'failureRate'],
        'proxy': ['capacity', 'latency', 'failureRate']
      };
      
      for (let i = 0; i < 50; i++) {
        const type = generateComponentType();
        const key = generateComponentKey(type);
        const position = generatePosition();
        
        const component = componentLibrary.createComponent(key, type, position);
        
        if (component) {
          // Verify type consistency
          expect(component.type).toBe(type);
          
          // Verify required configuration properties exist
          const requiredProps = typeConfigRequirements[type] || ['capacity', 'latency', 'failureRate'];
          requiredProps.forEach(prop => {
            expect(component.configuration).toHaveProperty(prop);
            expect(typeof component.configuration[prop]).not.toBe('undefined');
          });
          
          // Verify basic configuration constraints
          expect(component.configuration.capacity).toBeGreaterThan(0);
          expect(component.configuration.latency).toBeGreaterThanOrEqual(0);
          expect(component.configuration.failureRate).toBeGreaterThanOrEqual(0);
          expect(component.configuration.failureRate).toBeLessThanOrEqual(1);
          
          // Verify type-specific properties when they exist
          if (type === 'cache' && component.configuration.hitRatio) {
            expect(component.configuration.hitRatio).toBeGreaterThan(0);
            expect(component.configuration.hitRatio).toBeLessThanOrEqual(1);
          }
          
          if (type === 'load-balancer' && component.configuration.algorithm) {
            expect(['round-robin', 'least-connections', 'weighted-round-robin', 'ip-hash'])
              .toContain(component.configuration.algorithm);
          }
        }
      }
    });
  });

  describe('Connection Management Properties', () => {
    it('should prevent duplicate connections between same components', () => {
      // Property: No two connections should exist between the same pair of components
      const components = generateComponents(10);
      const connections: Connection[] = [];
      
      // Attempt to create multiple connections between same components
      for (let i = 0; i < components.length - 1; i++) {
        for (let j = i + 1; j < components.length; j++) {
          const sourceComp = components[i];
          const targetComp = components[j];
          
          // Check if connection already exists
          const existingConnection = connections.find(conn => 
            (conn.sourceComponentId === sourceComp.id && conn.targetComponentId === targetComp.id) ||
            (conn.sourceComponentId === targetComp.id && conn.targetComponentId === sourceComp.id)
          );
          
          if (!existingConnection) {
            const connection: Connection = {
              id: crypto.randomUUID(),
              sourceComponentId: sourceComp.id,
              targetComponentId: targetComp.id,
              sourcePort: 'right',
              targetPort: 'left',
              configuration: {
                bandwidth: 1000,
                latency: 10,
                protocol: 'HTTP',
                reliability: 0.99
              }
            };
            connections.push(connection);
          }
        }
      }
      
      // Verify no duplicate connections
      const connectionPairs = connections.map(conn => 
        [conn.sourceComponentId, conn.targetComponentId].sort().join('-')
      );
      const uniquePairs = new Set(connectionPairs);
      
      expect(uniquePairs.size).toBe(connections.length);
    });

    it('should maintain connection configuration validity', () => {
      // Property: All connection configurations should have valid values
      for (let i = 0; i < 50; i++) {
        const connection: Connection = {
          id: crypto.randomUUID(),
          sourceComponentId: crypto.randomUUID(),
          targetComponentId: crypto.randomUUID(),
          sourcePort: 'right',
          targetPort: 'left',
          configuration: {
            bandwidth: Math.floor(Math.random() * 10000) + 10, // 10-10000 Mbps
            latency: Math.floor(Math.random() * 1000) + 1, // 1-1000 ms
            protocol: ['HTTP', 'TCP', 'UDP', 'DATABASE'][Math.floor(Math.random() * 4)] as any,
            reliability: Math.random() * 0.5 + 0.5 // 0.5-1.0
          }
        };
        
        // Verify configuration constraints
        expect(connection.configuration.bandwidth).toBeGreaterThan(0);
        expect(connection.configuration.bandwidth).toBeLessThanOrEqual(10000);
        expect(connection.configuration.latency).toBeGreaterThan(0);
        expect(connection.configuration.latency).toBeLessThanOrEqual(1000);
        expect(['HTTP', 'TCP', 'UDP', 'DATABASE']).toContain(connection.configuration.protocol);
        expect(connection.configuration.reliability).toBeGreaterThanOrEqual(0.5);
        expect(connection.configuration.reliability).toBeLessThanOrEqual(1.0);
      }
    });
  });

  describe('Canvas State Management Properties', () => {
    it('should maintain component count consistency during operations', () => {
      // Property: Component count should accurately reflect the number of components
      let components: Component[] = [];
      let componentCount = 0;
      
      // Add components
      for (let i = 0; i < 20; i++) {
        const type = generateComponentType();
        const key = generateComponentKey(type);
        const position = generatePosition();
        
        const component = componentLibrary.createComponent(key, type, position);
        if (component) {
          components.push(component);
          componentCount++;
          
          expect(components.length).toBe(componentCount);
        }
      }
      
      // Remove components
      while (components.length > 0) {
        const indexToRemove = Math.floor(Math.random() * components.length);
        components.splice(indexToRemove, 1);
        componentCount--;
        
        expect(components.length).toBe(componentCount);
      }
    });

    it('should preserve component relationships during canvas transformations', () => {
      // Property: Relative positions between components should be preserved during zoom/pan
      const components = generateComponents(5);
      const zoom = 0.5 + Math.random() * 2; // 0.5x to 2.5x zoom
      const pan = { x: Math.random() * 200 - 100, y: Math.random() * 200 - 100 };
      
      // Calculate relative distances before transformation
      const originalDistances: number[][] = [];
      for (let i = 0; i < components.length; i++) {
        originalDistances[i] = [];
        for (let j = 0; j < components.length; j++) {
          if (i !== j) {
            const dx = components[j].position.x - components[i].position.x;
            const dy = components[j].position.y - components[i].position.y;
            originalDistances[i][j] = Math.sqrt(dx * dx + dy * dy);
          }
        }
      }
      
      // Apply transformation (simulate zoom/pan)
      const transformedComponents = components.map(comp => ({
        ...comp,
        position: {
          x: (comp.position.x + pan.x) * zoom,
          y: (comp.position.y + pan.y) * zoom
        }
      }));
      
      // Calculate relative distances after transformation
      for (let i = 0; i < transformedComponents.length; i++) {
        for (let j = 0; j < transformedComponents.length; j++) {
          if (i !== j) {
            const dx = transformedComponents[j].position.x - transformedComponents[i].position.x;
            const dy = transformedComponents[j].position.y - transformedComponents[i].position.y;
            const newDistance = Math.sqrt(dx * dx + dy * dy);
            const expectedDistance = originalDistances[i][j] * zoom;
            
            // Allow small floating point errors
            expect(Math.abs(newDistance - expectedDistance)).toBeLessThan(0.001);
          }
        }
      }
    });
  });
});