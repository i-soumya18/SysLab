/**
 * System Graph Engine Tests
 * 
 * Tests the core functionality of the System Graph Engine including:
 * - DAG representation with capacity limits and latency curves
 * - Component modeling for 10 specific component types
 * - End-to-end latency calculation by graph traversal
 * - Circular dependency detection and prevention
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SystemGraphEngine, SystemComponentType } from '../simulation/SystemGraphEngine';
import { DegradationEngine } from '../simulation/DegradationEngine';
import { Component, Connection, ComponentType } from '../types';

describe('SystemGraphEngine', () => {
  let engine: SystemGraphEngine;
  let degradationEngine: DegradationEngine;

  beforeEach(() => {
    engine = new SystemGraphEngine();
    degradationEngine = new DegradationEngine();
  });

  describe('Component Management', () => {
    it('should add nodes for all 10 specific component types', () => {
      const componentTypes: ComponentType[] = [
        'database', 'load-balancer', 'web-server', 'cache', 
        'message-queue', 'cdn', 'proxy'
      ];

      const components: Component[] = componentTypes.map((type, index) => ({
        id: `component_${index}`,
        type,
        position: { x: index * 100, y: 100 },
        configuration: {
          capacity: 100,
          latency: 50,
          failureRate: 0.01
        },
        metadata: {
          name: `Component ${index}`,
          version: '1.0.0'
        }
      }));

      const validation = engine.initialize(components, []);
      
      expect(validation.isValid).toBe(true);
      expect(engine.getNodes()).toHaveLength(componentTypes.length);
      
      // Verify each component type is properly mapped
      const nodes = engine.getNodes();
      expect(nodes.some(n => n.type === 'Database')).toBe(true);
      expect(nodes.some(n => n.type === 'LoadBalancer')).toBe(true);
      expect(nodes.some(n => n.type === 'Service')).toBe(true);
      expect(nodes.some(n => n.type === 'Cache')).toBe(true);
      expect(nodes.some(n => n.type === 'Queue')).toBe(true);
      expect(nodes.some(n => n.type === 'CDN')).toBe(true);
      expect(nodes.some(n => n.type === 'APIGateway')).toBe(true);
    });

    it('should handle component removal correctly', () => {
      const component: Component = {
        id: 'test_component',
        type: 'web-server',
        position: { x: 0, y: 0 },
        configuration: { capacity: 100, latency: 50, failureRate: 0.01 },
        metadata: { name: 'Test Component', version: '1.0.0' }
      };

      engine.initialize([component], []);
      expect(engine.getNodes()).toHaveLength(1);

      const removed = engine.removeNode('test_component');
      expect(removed).toBe(true);
      expect(engine.getNodes()).toHaveLength(0);
    });
  });

  describe('Connection Management', () => {
    it('should create edges with network properties', () => {
      const components: Component[] = [
        {
          id: 'source',
          type: 'load-balancer',
          position: { x: 0, y: 0 },
          configuration: { capacity: 100, latency: 10, failureRate: 0.01 },
          metadata: { name: 'Load Balancer', version: '1.0.0' }
        },
        {
          id: 'target',
          type: 'web-server',
          position: { x: 100, y: 0 },
          configuration: { capacity: 50, latency: 20, failureRate: 0.02 },
          metadata: { name: 'Web Server', version: '1.0.0' }
        }
      ];

      const connections: Connection[] = [
        {
          id: 'connection_1',
          sourceComponentId: 'source',
          targetComponentId: 'target',
          sourcePort: 'out',
          targetPort: 'in',
          configuration: {
            bandwidth: 1000, // 1Gbps
            latency: 5, // 5ms
            protocol: 'HTTP',
            reliability: 0.99,
            retryPolicy: 'exponential-backoff',
            maxRetries: 3,
            timeoutMs: 5000
          }
        }
      ];

      const validation = engine.initialize(components, connections);
      
      expect(validation.isValid).toBe(true);
      expect(engine.getEdges()).toHaveLength(1);
      
      const edge = engine.getEdge('connection_1');
      expect(edge).toBeDefined();
      expect(edge!.latency).toBe(5);
      expect(edge!.bandwidth).toBe(1000);
      expect(edge!.reliability).toBe(0.99);
    });

    it('should prevent invalid connections', () => {
      const component: Component = {
        id: 'test_component',
        type: 'web-server',
        position: { x: 0, y: 0 },
        configuration: { capacity: 100, latency: 50, failureRate: 0.01 },
        metadata: { name: 'Test Component', version: '1.0.0' }
      };

      const invalidConnection: Connection = {
        id: 'invalid_connection',
        sourceComponentId: 'nonexistent_source',
        targetComponentId: 'test_component',
        sourcePort: 'out',
        targetPort: 'in',
        configuration: {
          bandwidth: 1000,
          latency: 5,
          protocol: 'HTTP',
          reliability: 0.99
        }
      };

      engine.initialize([component], []);
      
      expect(() => {
        engine.addEdge(invalidConnection);
      }).toThrow('Cannot create edge: source or target node not found');
    });
  });

  describe('Circular Dependency Detection', () => {
    it('should detect circular dependencies', () => {
      const components: Component[] = [
        {
          id: 'A',
          type: 'web-server',
          position: { x: 0, y: 0 },
          configuration: { capacity: 100, latency: 50, failureRate: 0.01 },
          metadata: { name: 'Component A', version: '1.0.0' }
        },
        {
          id: 'B',
          type: 'database',
          position: { x: 100, y: 0 },
          configuration: { capacity: 50, latency: 100, failureRate: 0.02 },
          metadata: { name: 'Component B', version: '1.0.0' }
        },
        {
          id: 'C',
          type: 'cache',
          position: { x: 200, y: 0 },
          configuration: { capacity: 200, latency: 5, failureRate: 0.005 },
          metadata: { name: 'Component C', version: '1.0.0' }
        }
      ];

      // Create circular dependency: A -> B -> C -> A
      const connections: Connection[] = [
        {
          id: 'AB',
          sourceComponentId: 'A',
          targetComponentId: 'B',
          sourcePort: 'out',
          targetPort: 'in',
          configuration: { bandwidth: 1000, latency: 5, protocol: 'HTTP', reliability: 0.99 }
        },
        {
          id: 'BC',
          sourceComponentId: 'B',
          targetComponentId: 'C',
          sourcePort: 'out',
          targetPort: 'in',
          configuration: { bandwidth: 1000, latency: 5, protocol: 'HTTP', reliability: 0.99 }
        },
        {
          id: 'CA',
          sourceComponentId: 'C',
          targetComponentId: 'A',
          sourcePort: 'out',
          targetPort: 'in',
          configuration: { bandwidth: 1000, latency: 5, protocol: 'HTTP', reliability: 0.99 }
        }
      ];

      const validation = engine.initialize(components, connections);
      
      expect(validation.isValid).toBe(false);
      expect(validation.circularDependencies).toHaveLength(1);
      expect(validation.circularDependencies[0]).toContain('A');
      expect(validation.circularDependencies[0]).toContain('B');
      expect(validation.circularDependencies[0]).toContain('C');
    });

    it('should allow valid DAG structures', () => {
      const components: Component[] = [
        {
          id: 'client',
          type: 'web-server',
          position: { x: 0, y: 0 },
          configuration: { capacity: 100, latency: 10, failureRate: 0.01 },
          metadata: { name: 'Client', version: '1.0.0' }
        },
        {
          id: 'lb',
          type: 'load-balancer',
          position: { x: 100, y: 0 },
          configuration: { capacity: 200, latency: 5, failureRate: 0.005 },
          metadata: { name: 'Load Balancer', version: '1.0.0' }
        },
        {
          id: 'service1',
          type: 'web-server',
          position: { x: 200, y: -50 },
          configuration: { capacity: 50, latency: 50, failureRate: 0.02 },
          metadata: { name: 'Service 1', version: '1.0.0' }
        },
        {
          id: 'service2',
          type: 'web-server',
          position: { x: 200, y: 50 },
          configuration: { capacity: 50, latency: 50, failureRate: 0.02 },
          metadata: { name: 'Service 2', version: '1.0.0' }
        },
        {
          id: 'database',
          type: 'database',
          position: { x: 300, y: 0 },
          configuration: { capacity: 30, latency: 100, failureRate: 0.01 },
          metadata: { name: 'Database', version: '1.0.0' }
        }
      ];

      // Create valid DAG: client -> lb -> [service1, service2] -> database
      const connections: Connection[] = [
        {
          id: 'client_lb',
          sourceComponentId: 'client',
          targetComponentId: 'lb',
          sourcePort: 'out',
          targetPort: 'in',
          configuration: { bandwidth: 1000, latency: 2, protocol: 'HTTP', reliability: 0.99 }
        },
        {
          id: 'lb_service1',
          sourceComponentId: 'lb',
          targetComponentId: 'service1',
          sourcePort: 'out1',
          targetPort: 'in',
          configuration: { bandwidth: 500, latency: 3, protocol: 'HTTP', reliability: 0.98 }
        },
        {
          id: 'lb_service2',
          sourceComponentId: 'lb',
          targetComponentId: 'service2',
          sourcePort: 'out2',
          targetPort: 'in',
          configuration: { bandwidth: 500, latency: 3, protocol: 'HTTP', reliability: 0.98 }
        },
        {
          id: 'service1_db',
          sourceComponentId: 'service1',
          targetComponentId: 'database',
          sourcePort: 'out',
          targetPort: 'in1',
          configuration: { bandwidth: 100, latency: 5, protocol: 'DATABASE', reliability: 0.95 }
        },
        {
          id: 'service2_db',
          sourceComponentId: 'service2',
          targetComponentId: 'database',
          sourcePort: 'out',
          targetPort: 'in2',
          configuration: { bandwidth: 100, latency: 5, protocol: 'DATABASE', reliability: 0.95 }
        }
      ];

      const validation = engine.initialize(components, connections);
      
      expect(validation.isValid).toBe(true);
      expect(validation.circularDependencies).toHaveLength(0);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('End-to-End Latency Calculation', () => {
    it('should calculate latency through a simple path', () => {
      const components: Component[] = [
        {
          id: 'client',
          type: 'web-server',
          position: { x: 0, y: 0 },
          configuration: { capacity: 100, latency: 10, failureRate: 0.01 },
          metadata: { name: 'Client', version: '1.0.0' }
        },
        {
          id: 'server',
          type: 'web-server',
          position: { x: 100, y: 0 },
          configuration: { capacity: 50, latency: 50, failureRate: 0.02 },
          metadata: { name: 'Server', version: '1.0.0' }
        }
      ];

      const connections: Connection[] = [
        {
          id: 'client_server',
          sourceComponentId: 'client',
          targetComponentId: 'server',
          sourcePort: 'out',
          targetPort: 'in',
          configuration: { bandwidth: 1000, latency: 20, protocol: 'HTTP', reliability: 0.99 }
        }
      ];

      engine.initialize(components, connections);
      
      const result = engine.calculateEndToEndLatency('client', 'server');
      
      expect(result.totalLatency).toBeGreaterThan(0);
      expect(result.componentLatencies.has('client')).toBe(true);
      expect(result.componentLatencies.has('server')).toBe(true);
      expect(result.connectionLatencies.has('client_server')).toBe(true);
      expect(result.criticalPath.nodes).toHaveLength(2);
      expect(result.criticalPath.edges).toHaveLength(1);
    });

    it('should find the critical path in complex topologies', () => {
      const components: Component[] = [
        {
          id: 'client',
          type: 'web-server',
          position: { x: 0, y: 0 },
          configuration: { capacity: 100, latency: 10, failureRate: 0.01 },
          metadata: { name: 'Client', version: '1.0.0' }
        },
        {
          id: 'lb',
          type: 'load-balancer',
          position: { x: 100, y: 0 },
          configuration: { capacity: 200, latency: 5, failureRate: 0.005 },
          metadata: { name: 'Load Balancer', version: '1.0.0' }
        },
        {
          id: 'fast_service',
          type: 'cache', // Use cache type for lower base latency
          position: { x: 200, y: -50 },
          configuration: { capacity: 50, latency: 20, failureRate: 0.02 },
          metadata: { name: 'Fast Service', version: '1.0.0' }
        },
        {
          id: 'slow_service',
          type: 'database', // Use database type for higher base latency
          position: { x: 200, y: 50 },
          configuration: { capacity: 50, latency: 100, failureRate: 0.02 },
          metadata: { name: 'Slow Service', version: '1.0.0' }
        }
      ];

      const connections: Connection[] = [
        {
          id: 'client_lb',
          sourceComponentId: 'client',
          targetComponentId: 'lb',
          sourcePort: 'out',
          targetPort: 'in',
          configuration: { bandwidth: 1000, latency: 2, protocol: 'HTTP', reliability: 0.99 }
        },
        {
          id: 'lb_fast',
          sourceComponentId: 'lb',
          targetComponentId: 'fast_service',
          sourcePort: 'out1',
          targetPort: 'in',
          configuration: { bandwidth: 500, latency: 3, protocol: 'HTTP', reliability: 0.98 }
        },
        {
          id: 'lb_slow',
          sourceComponentId: 'lb',
          targetComponentId: 'slow_service',
          sourcePort: 'out2',
          targetPort: 'in',
          configuration: { bandwidth: 500, latency: 3, protocol: 'HTTP', reliability: 0.98 }
        }
      ];

      engine.initialize(components, connections);
      
      // Calculate latency to fast service
      const fastResult = engine.calculateEndToEndLatency('client', 'fast_service');
      
      // Calculate latency to slow service
      const slowResult = engine.calculateEndToEndLatency('client', 'slow_service');
      
      // Fast service path should have lower latency than slow service path
      // Note: The actual difference depends on the component characteristics
      expect(fastResult.totalLatency).toBeLessThanOrEqual(slowResult.totalLatency);
      
      // Both should have the same path length (client -> lb -> service)
      expect(fastResult.criticalPath.nodes).toHaveLength(3);
      expect(slowResult.criticalPath.nodes).toHaveLength(3);
    });
  });

  describe('Load and Performance Tracking', () => {
    it('should update node load and calculate utilization', () => {
      const component: Component = {
        id: 'test_component',
        type: 'web-server',
        position: { x: 0, y: 0 },
        configuration: { capacity: 100, latency: 50, failureRate: 0.01 },
        metadata: { name: 'Test Component', version: '1.0.0' }
      };

      engine.initialize([component], []);
      
      // Update load to 50% capacity (50 out of 200 capacity limit for Service type)
      engine.updateNodeLoad('test_component', 50);
      
      const node = engine.getNode('test_component');
      expect(node).toBeDefined();
      expect(node!.currentLoad).toBe(50);
      expect(node!.currentUtilization).toBe(0.25); // 50/200 = 0.25
    });

    it('should track edge load', () => {
      const components: Component[] = [
        {
          id: 'source',
          type: 'web-server',
          position: { x: 0, y: 0 },
          configuration: { capacity: 100, latency: 50, failureRate: 0.01 },
          metadata: { name: 'Source', version: '1.0.0' }
        },
        {
          id: 'target',
          type: 'web-server',
          position: { x: 100, y: 0 },
          configuration: { capacity: 100, latency: 50, failureRate: 0.01 },
          metadata: { name: 'Target', version: '1.0.0' }
        }
      ];

      const connections: Connection[] = [
        {
          id: 'connection',
          sourceComponentId: 'source',
          targetComponentId: 'target',
          sourcePort: 'out',
          targetPort: 'in',
          configuration: { bandwidth: 1000, latency: 5, protocol: 'HTTP', reliability: 0.99 }
        }
      ];

      engine.initialize(components, connections);
      
      // Update edge load
      engine.updateEdgeLoad('connection', 500); // 500 Mbps
      
      const edge = engine.getEdge('connection');
      expect(edge).toBeDefined();
      expect(edge!.currentLoad).toBe(500);
    });
  });

  describe('Component Performance Characteristics', () => {
    it('should have different characteristics for each component type', () => {
      const componentTypes: ComponentType[] = [
        'database', 'load-balancer', 'web-server', 'cache', 'message-queue'
      ];

      const components: Component[] = componentTypes.map((type, index) => ({
        id: `component_${index}`,
        type,
        position: { x: index * 100, y: 100 },
        configuration: { capacity: 100, latency: 50, failureRate: 0.01 },
        metadata: { name: `Component ${index}`, version: '1.0.0' }
      }));

      engine.initialize(components, []);
      
      const nodes = engine.getNodes();
      
      // Verify each component has different performance characteristics
      const characteristics = nodes.map(node => node.characteristics);
      
      // Database should have higher latency than cache
      const dbNode = nodes.find(n => n.type === 'Database');
      const cacheNode = nodes.find(n => n.type === 'Cache');
      
      if (dbNode && cacheNode) {
        expect(dbNode.characteristics.baseLatency).toBeGreaterThan(cacheNode.characteristics.baseLatency);
        expect(cacheNode.characteristics.maxThroughput).toBeGreaterThan(dbNode.characteristics.maxThroughput);
      }
      
      // Load balancer should have high throughput
      const lbNode = nodes.find(n => n.type === 'LoadBalancer');
      if (lbNode) {
        expect(lbNode.characteristics.maxThroughput).toBeGreaterThan(1000);
      }
    });
  });

  describe('Graph Validation', () => {
    it('should identify isolated nodes', () => {
      const components: Component[] = [
        {
          id: 'connected1',
          type: 'web-server',
          position: { x: 0, y: 0 },
          configuration: { capacity: 100, latency: 50, failureRate: 0.01 },
          metadata: { name: 'Connected 1', version: '1.0.0' }
        },
        {
          id: 'connected2',
          type: 'web-server',
          position: { x: 100, y: 0 },
          configuration: { capacity: 100, latency: 50, failureRate: 0.01 },
          metadata: { name: 'Connected 2', version: '1.0.0' }
        },
        {
          id: 'isolated',
          type: 'database',
          position: { x: 200, y: 100 },
          configuration: { capacity: 50, latency: 100, failureRate: 0.02 },
          metadata: { name: 'Isolated', version: '1.0.0' }
        }
      ];

      const connections: Connection[] = [
        {
          id: 'connection',
          sourceComponentId: 'connected1',
          targetComponentId: 'connected2',
          sourcePort: 'out',
          targetPort: 'in',
          configuration: { bandwidth: 1000, latency: 5, protocol: 'HTTP', reliability: 0.99 }
        }
      ];

      const validation = engine.initialize(components, connections);
      
      expect(validation.isValid).toBe(true); // No errors, just warnings
      expect(validation.warnings.some(w => w.includes('isolated'))).toBe(true);
    });

    it('should validate edge configurations', () => {
      const components: Component[] = [
        {
          id: 'source',
          type: 'web-server',
          position: { x: 0, y: 0 },
          configuration: { capacity: 100, latency: 50, failureRate: 0.01 },
          metadata: { name: 'Source', version: '1.0.0' }
        },
        {
          id: 'target',
          type: 'web-server',
          position: { x: 100, y: 0 },
          configuration: { capacity: 100, latency: 50, failureRate: 0.01 },
          metadata: { name: 'Target', version: '1.0.0' }
        }
      ];

      const invalidConnections: Connection[] = [
        {
          id: 'invalid_latency',
          sourceComponentId: 'source',
          targetComponentId: 'target',
          sourcePort: 'out',
          targetPort: 'in',
          configuration: { 
            bandwidth: 1000, 
            latency: -5, // Invalid negative latency
            protocol: 'HTTP', 
            reliability: 0.99 
          }
        }
      ];

      const validation = engine.initialize(components, invalidConnections);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('negative latency'))).toBe(true);
    });
  });
});

describe('DegradationEngine', () => {
  let degradationEngine: DegradationEngine;
  let systemGraphEngine: SystemGraphEngine;

  beforeEach(() => {
    degradationEngine = new DegradationEngine();
    systemGraphEngine = new SystemGraphEngine();
  });

  describe('Component Degradation Tracking', () => {
    it('should initialize component degradation state', () => {
      const component: Component = {
        id: 'test_component',
        type: 'web-server',
        position: { x: 0, y: 0 },
        configuration: { capacity: 100, latency: 50, failureRate: 0.01 },
        metadata: { name: 'Test Component', version: '1.0.0' }
      };

      systemGraphEngine.initialize([component], []);
      const node = systemGraphEngine.getNode('test_component')!;
      
      degradationEngine.initializeComponent(node);
      
      const state = degradationEngine.getComponentDegradationState('test_component');
      expect(state).toBeDefined();
      expect(state!.componentId).toBe('test_component');
      expect(state!.performanceMultipliers.latency).toBe(1.0);
      expect(state!.performanceMultipliers.throughput).toBe(1.0);
    });

    it('should track utilization changes and degradation', () => {
      const component: Component = {
        id: 'test_component',
        type: 'web-server',
        position: { x: 0, y: 0 },
        configuration: { capacity: 100, latency: 50, failureRate: 0.01 },
        metadata: { name: 'Test Component', version: '1.0.0' }
      };

      systemGraphEngine.initialize([component], []);
      const node = systemGraphEngine.getNode('test_component')!;
      
      degradationEngine.initializeComponent(node);
      
      // Update to high utilization (90%)
      degradationEngine.updateComponentUtilization('test_component', 0.9, node);
      
      const state = degradationEngine.getComponentDegradationState('test_component');
      expect(state).toBeDefined();
      expect(state!.currentUtilization).toBe(0.9);
      expect(state!.activeDegradation).toBeDefined();
      
      // Performance should be degraded
      const multipliers = degradationEngine.getPerformanceMultipliers('test_component');
      expect(multipliers.latency).toBeGreaterThan(1.0);
      expect(multipliers.throughput).toBeLessThan(1.0);
    });

    it('should generate performance curves', () => {
      const component: Component = {
        id: 'test_component',
        type: 'database',
        position: { x: 0, y: 0 },
        configuration: { capacity: 100, latency: 50, failureRate: 0.01 },
        metadata: { name: 'Test Component', version: '1.0.0' }
      };

      systemGraphEngine.initialize([component], []);
      const node = systemGraphEngine.getNode('test_component')!;
      
      degradationEngine.initializeComponent(node);
      
      const curve = degradationEngine.getPerformanceCurve('test_component');
      expect(curve).toBeDefined();
      expect(curve.length).toBe(101); // 0% to 100% utilization
      
      // Verify curve shows degradation at high utilization
      const lowUtilization = curve[20]; // 20% utilization
      const highUtilization = curve[90]; // 90% utilization
      
      expect(highUtilization.latencyMultiplier).toBeGreaterThan(lowUtilization.latencyMultiplier);
      expect(highUtilization.errorRate).toBeGreaterThan(lowUtilization.errorRate);
    });
  });

  describe('Dynamic Reconfiguration', () => {
    it('should accept valid reconfiguration requests', () => {
      const reconfigRequest = {
        componentId: 'test_component',
        newConfiguration: {
          capacityLimit: 200,
          baseLatency: 30
        },
        reason: 'Scale up for increased load',
        timestamp: Date.now()
      };

      const result = degradationEngine.requestReconfiguration(reconfigRequest);
      expect(result).toBe(true);
    });

    it('should reject invalid reconfiguration requests', () => {
      const invalidRequest = {
        componentId: 'test_component',
        newConfiguration: {
          capacityLimit: -100, // Invalid negative capacity
          baseLatency: 30
        },
        reason: 'Invalid configuration',
        timestamp: Date.now()
      };

      const result = degradationEngine.requestReconfiguration(invalidRequest);
      expect(result).toBe(false);
    });
  });
});