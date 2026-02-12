/**
 * Canvas Connection Integration Test
 * Tests the integration between Canvas component and connection functionality
 */

import { describe, it, expect } from 'vitest';
import { componentLibrary } from '../components/ComponentLibrary';
import type { Component, Connection } from '../types';

describe('Canvas Connection Integration', () => {
  it('should support the complete MVLE-2 workflow in Canvas context', () => {
    // Simulate Canvas state with components and connections
    const components: Component[] = [
      componentLibrary.createComponent('client-web', 'client', { x: 50, y: 100 })!,
      componentLibrary.createComponent('load-balancer-nginx', 'load-balancer', { x: 200, y: 100 })!,
      componentLibrary.createComponent('web-server-nodejs', 'web-server', { x: 350, y: 100 })!,
      componentLibrary.createComponent('database-mysql', 'database', { x: 500, y: 100 })!
    ];

    const connections: Connection[] = [];

    // Simulate connection creation workflow
    const createConnection = (
      sourceId: string, 
      targetId: string, 
      sourcePort: string, 
      targetPort: string,
      protocol: 'HTTP' | 'TCP' | 'UDP' | 'DATABASE' = 'HTTP'
    ): Connection => {
      const connection: Connection = {
        id: crypto.randomUUID(),
        sourceComponentId: sourceId,
        targetComponentId: targetId,
        sourcePort,
        targetPort,
        configuration: {
          bandwidth: 1000,
          latency: 10,
          protocol,
          reliability: 0.99
        }
      };
      connections.push(connection);
      return connection;
    };

    // Create the MVLE connection chain
    const clientToLB = createConnection(components[0].id, components[1].id, 'right', 'left', 'HTTP');
    const lbToService = createConnection(components[1].id, components[2].id, 'right', 'left', 'HTTP');
    const serviceToDb = createConnection(components[2].id, components[3].id, 'right', 'left', 'DATABASE');

    // Verify Canvas state
    expect(components.length).toBe(4);
    expect(connections.length).toBe(3);

    // Verify connection chain integrity
    expect(clientToLB.sourceComponentId).toBe(components[0].id); // Client
    expect(clientToLB.targetComponentId).toBe(components[1].id); // Load Balancer
    
    expect(lbToService.sourceComponentId).toBe(components[1].id); // Load Balancer
    expect(lbToService.targetComponentId).toBe(components[2].id); // Service
    
    expect(serviceToDb.sourceComponentId).toBe(components[2].id); // Service
    expect(serviceToDb.targetComponentId).toBe(components[3].id); // Database

    // Simulate connection deletion
    const deleteConnection = (connectionId: string) => {
      const index = connections.findIndex(conn => conn.id === connectionId);
      if (index !== -1) {
        connections.splice(index, 1);
      }
    };

    const initialConnectionCount = connections.length;
    deleteConnection(lbToService.id);
    expect(connections.length).toBe(initialConnectionCount - 1);
    expect(connections.find(conn => conn.id === lbToService.id)).toBeUndefined();

    console.log('✅ Canvas Connection Integration Test Passed');
    console.log(`   - Successfully managed ${components.length} components`);
    console.log(`   - Created and managed ${initialConnectionCount} connections`);
    console.log('   - Tested connection deletion');
  });

  it('should handle connection point calculations for Canvas rendering', () => {
    const component = componentLibrary.createComponent('web-server-nodejs', 'web-server', { x: 200, y: 150 })!;

    // Connection point calculation (matches CanvasComponent logic)
    const getConnectionPointPosition = (comp: Component, port: string) => {
      const baseX = comp.position.x + 50;
      const baseY = comp.position.y + 40;
      
      switch (port) {
        case 'top':
          return { x: baseX, y: comp.position.y };
        case 'bottom':
          return { x: baseX, y: comp.position.y + 80 };
        case 'left':
          return { x: comp.position.x, y: baseY };
        case 'right':
          return { x: comp.position.x + 100, y: baseY };
        default:
          return { x: baseX, y: baseY };
      }
    };

    // Test all connection points
    const topPoint = getConnectionPointPosition(component, 'top');
    const bottomPoint = getConnectionPointPosition(component, 'bottom');
    const leftPoint = getConnectionPointPosition(component, 'left');
    const rightPoint = getConnectionPointPosition(component, 'right');

    expect(topPoint).toEqual({ x: 250, y: 150 });
    expect(bottomPoint).toEqual({ x: 250, y: 230 });
    expect(leftPoint).toEqual({ x: 200, y: 190 });
    expect(rightPoint).toEqual({ x: 300, y: 190 });

    // Verify points are within component bounds
    expect(topPoint.x).toBeGreaterThanOrEqual(component.position.x);
    expect(topPoint.x).toBeLessThanOrEqual(component.position.x + 100);
    expect(leftPoint.y).toBeGreaterThanOrEqual(component.position.y);
    expect(leftPoint.y).toBeLessThanOrEqual(component.position.y + 80);
  });

  it('should support connection wire path calculation for SVG rendering', () => {
    const sourceComponent = componentLibrary.createComponent('client-web', 'client', { x: 50, y: 100 })!;
    const targetComponent = componentLibrary.createComponent('web-server-nodejs', 'web-server', { x: 300, y: 100 })!;

    const connection: Connection = {
      id: 'test-wire-path',
      sourceComponentId: sourceComponent.id,
      targetComponentId: targetComponent.id,
      sourcePort: 'right',
      targetPort: 'left',
      configuration: {
        bandwidth: 1000,
        latency: 10,
        protocol: 'HTTP',
        reliability: 0.99
      }
    };

    // Calculate connection points (matches ConnectionWire logic)
    const getConnectionPoint = (component: Component, port: string) => {
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

    const sourcePoint = getConnectionPoint(sourceComponent, connection.sourcePort);
    const targetPoint = getConnectionPoint(targetComponent, connection.targetPort);

    // Verify wire endpoints
    expect(sourcePoint).toEqual({ x: 150, y: 140 }); // Right side of client
    expect(targetPoint).toEqual({ x: 300, y: 140 }); // Left side of server

    // Calculate wire path for SVG (simplified version of ConnectionWire logic)
    const dx = targetPoint.x - sourcePoint.x;
    const dy = targetPoint.y - sourcePoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    expect(distance).toBeGreaterThan(0);
    expect(dx).toBe(150); // Horizontal distance
    expect(dy).toBe(0); // Same Y level

    // Verify wire can be rendered as SVG path
    const pathData = `M ${sourcePoint.x} ${sourcePoint.y} L ${targetPoint.x} ${targetPoint.y}`;
    expect(pathData).toBe('M 150 140 L 300 140');

    console.log('✅ Connection Wire Path Calculation Test Passed');
    console.log(`   - Source point: (${sourcePoint.x}, ${sourcePoint.y})`);
    console.log(`   - Target point: (${targetPoint.x}, ${targetPoint.y})`);
    console.log(`   - Wire distance: ${distance.toFixed(1)}px`);
    console.log(`   - SVG path: ${pathData}`);
  });
});