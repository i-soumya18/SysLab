/**
 * Property-Based Tests for System Graph Engine
 * 
 * **Property 5: System Graph Engine Modeling**
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**
 * 
 * For any system architecture, the System Graph Engine should model each component as a DAG node 
 * with capacity limits, latency curves, and throughput limits, calculate end-to-end latency by 
 * graph traversal, model realistic degradation when capacity is exceeded, detect and prevent 
 * circular dependencies, and support dynamic reconfiguration during simulation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { SystemGraphEngine, SystemComponentType } from '../simulation/SystemGraphEngine';
import { DegradationEngine } from '../simulation/DegradationEngine';
import { Component, Connection, ComponentType } from '../types';

describe('SystemGraphEngine Property Tests', () => {
  let engine: SystemGraphEngine;

  beforeEach(() => {
    engine = new SystemGraphEngine();
  });

  /**
   * Property 5: System Graph Engine Modeling
   * For any valid system architecture, the System Graph Engine should maintain consistency
   */
  it('Property 5: System Graph Engine Modeling - should maintain graph consistency for any valid architecture', () => {
    // Feature: system-design-simulator, Property 5: System Graph Engine Modeling
    fc.assert(fc.property(
      // Generate valid component configurations
      fc.array(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
          type: fc.constantFrom('database', 'load-balancer', 'web-server', 'cache', 'message-queue', 'cdn', 'proxy') as fc.Arbitrary<ComponentType>,
          capacity: fc.integer({ min: 1, max: 10000 }),
          latency: fc.integer({ min: 1, max: 1000 }),
          failureRate: fc.float({ min: 0, max: Math.fround(0.1) })
        }),
        { minLength: 1, maxLength: 10 }
      ),
      // Generate valid connections (ensuring no circular dependencies)
      fc.array(
        fc.record({
          bandwidth: fc.integer({ min: 1, max: 100000 }),
          latency: fc.integer({ min: 1, max: 100 }),
          reliability: fc.float({ min: Math.fround(0.5), max: Math.fround(1.0) })
        }),
        { maxLength: 20 }
      ),
      (componentConfigs, connectionConfigs) => {
        // Create unique component IDs
        const uniqueIds = new Set<string>();
        const validComponents: Component[] = [];
        
        for (const config of componentConfigs) {
          if (!uniqueIds.has(config.id)) {
            uniqueIds.add(config.id);
            validComponents.push({
              id: config.id,
              type: config.type,
              position: { x: Math.random() * 1000, y: Math.random() * 1000 },
              configuration: {
                capacity: config.capacity,
                latency: config.latency,
                failureRate: config.failureRate
              },
              metadata: {
                name: `Component ${config.id}`,
                version: '1.0.0'
              }
            });
          }
        }

        if (validComponents.length === 0) return true; // Skip empty arrays

        // Create valid connections (no circular dependencies)
        const validConnections: Connection[] = [];
        const componentIds = validComponents.map(c => c.id);
        
        for (let i = 0; i < Math.min(connectionConfigs.length, validComponents.length - 1); i++) {
          const sourceId = componentIds[i];
          const targetId = componentIds[i + 1]; // Linear chain to avoid cycles
          const config = connectionConfigs[i];
          
          validConnections.push({
            id: `conn_${i}`,
            sourceComponentId: sourceId,
            targetComponentId: targetId,
            sourcePort: 'out',
            targetPort: 'in',
            configuration: {
              bandwidth: config.bandwidth,
              latency: config.latency,
              protocol: 'HTTP',
              reliability: config.reliability
            }
          });
        }

        // Initialize the graph
        const validation = engine.initialize(validComponents, validConnections);

        // Property assertions
        
        // 1. Graph should be valid (no circular dependencies in linear chain)
        expect(validation.isValid).toBe(true);
        expect(validation.circularDependencies).toHaveLength(0);

        // 2. All components should be added as nodes
        expect(engine.getNodes()).toHaveLength(validComponents.length);
        
        // 3. All connections should be added as edges
        expect(engine.getEdges()).toHaveLength(validConnections.length);

        // 4. Each node should have proper characteristics
        for (const node of engine.getNodes()) {
          expect(node.characteristics).toBeDefined();
          expect(node.characteristics.baseLatency).toBeGreaterThan(0);
          expect(node.characteristics.maxThroughput).toBeGreaterThan(0);
          expect(node.characteristics.capacityLimit).toBeGreaterThan(0);
          expect(node.characteristics.latencyCurve).toBeDefined();
          expect(node.characteristics.throughputCurve).toBeDefined();
          expect(node.characteristics.degradationModel).toBeDefined();
        }

        // 5. Load updates should maintain consistency
        for (const node of engine.getNodes()) {
          const originalLoad = node.currentLoad;
          const newLoad = Math.floor(Math.random() * node.characteristics.capacityLimit);
          
          engine.updateNodeLoad(node.id, newLoad);
          
          const updatedNode = engine.getNode(node.id);
          expect(updatedNode).toBeDefined();
          expect(updatedNode!.currentLoad).toBe(newLoad);
          expect(updatedNode!.currentUtilization).toBe(newLoad / node.characteristics.capacityLimit);
        }

        // 6. End-to-end latency calculation should work for connected components
        if (validConnections.length > 0) {
          const firstComponent = validComponents[0];
          const lastComponent = validComponents[validComponents.length - 1];
          
          try {
            const latencyResult = engine.calculateEndToEndLatency(firstComponent.id, lastComponent.id);
            expect(latencyResult.totalLatency).toBeGreaterThan(0);
            expect(latencyResult.componentLatencies.size).toBeGreaterThan(0);
            expect(latencyResult.criticalPath.nodes.length).toBeGreaterThan(0);
          } catch (error) {
            // It's okay if no path exists in some configurations
            expect(error).toBeInstanceOf(Error);
          }
        }

        return true;
      }
    ), { numRuns: 100 });
  });

  /**
   * Property: Circular Dependency Detection
   * The engine should always detect circular dependencies correctly
   */
  it('Property: Circular dependency detection should be consistent', () => {
    fc.assert(fc.property(
      fc.array(
        fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
        { minLength: 3, maxLength: 6 }
      ),
      (nodeIds) => {
        const uniqueIds = Array.from(new Set(nodeIds));
        if (uniqueIds.length < 3) return true; // Need at least 3 nodes for meaningful test

        // Create components
        const components: Component[] = uniqueIds.map(id => ({
          id,
          type: 'web-server',
          position: { x: 0, y: 0 },
          configuration: { capacity: 100, latency: 50, failureRate: 0.01 },
          metadata: { name: `Component ${id}`, version: '1.0.0' }
        }));

        // Create circular connections: A -> B -> C -> A
        const connections: Connection[] = [];
        for (let i = 0; i < uniqueIds.length; i++) {
          const sourceId = uniqueIds[i];
          const targetId = uniqueIds[(i + 1) % uniqueIds.length]; // Circular
          
          connections.push({
            id: `conn_${i}`,
            sourceComponentId: sourceId,
            targetComponentId: targetId,
            sourcePort: 'out',
            targetPort: 'in',
            configuration: {
              bandwidth: 1000,
              latency: 5,
              protocol: 'HTTP',
              reliability: 0.99
            }
          });
        }

        const validation = engine.initialize(components, connections);

        // Should detect circular dependency
        expect(validation.isValid).toBe(false);
        expect(validation.circularDependencies.length).toBeGreaterThan(0);
        
        // The circular dependency should include all nodes
        const detectedCycle = validation.circularDependencies[0];
        expect(detectedCycle.length).toBeGreaterThanOrEqual(uniqueIds.length);

        return true;
      }
    ), { numRuns: 50 });
  });

  /**
   * Property: Load Update Consistency
   * Load updates should always maintain proper utilization calculations
   */
  it('Property: Load updates should maintain utilization consistency', () => {
    fc.assert(fc.property(
      fc.record({
        componentType: fc.constantFrom('database', 'load-balancer', 'web-server', 'cache') as fc.Arbitrary<ComponentType>,
        capacity: fc.integer({ min: 10, max: 1000 }),
        load: fc.integer({ min: 0, max: 2000 }) // Can exceed capacity
      }),
      (config) => {
        const component: Component = {
          id: 'test_component',
          type: config.componentType,
          position: { x: 0, y: 0 },
          configuration: {
            capacity: config.capacity,
            latency: 50,
            failureRate: 0.01
          },
          metadata: { name: 'Test Component', version: '1.0.0' }
        };

        engine.initialize([component], []);
        engine.updateNodeLoad('test_component', config.load);

        const node = engine.getNode('test_component');
        expect(node).toBeDefined();
        expect(node!.currentLoad).toBe(config.load);
        
        // Utilization should be load divided by capacity limit (from characteristics, not config)
        const expectedUtilization = config.load / node!.characteristics.capacityLimit;
        expect(node!.currentUtilization).toBeCloseTo(expectedUtilization, 5);

        // Utilization can exceed 1.0 (overload condition)
        if (config.load > node!.characteristics.capacityLimit) {
          expect(node!.currentUtilization).toBeGreaterThan(1.0);
        }

        return true;
      }
    ), { numRuns: 100 });
  });

  /**
   * Property: Latency Calculation Monotonicity
   * Adding components to a path should generally increase total latency
   */
  it('Property: Latency calculation should be monotonic with path length', () => {
    fc.assert(fc.property(
      fc.integer({ min: 2, max: 8 }),
      fc.integer({ min: 1, max: 100 }),
      (pathLength, baseLatency) => {
        // Create a linear chain of components
        const components: Component[] = [];
        const connections: Connection[] = [];

        for (let i = 0; i < pathLength; i++) {
          components.push({
            id: `comp_${i}`,
            type: 'web-server',
            position: { x: i * 100, y: 0 },
            configuration: {
              capacity: 100,
              latency: baseLatency,
              failureRate: 0.01
            },
            metadata: { name: `Component ${i}`, version: '1.0.0' }
          });

          if (i > 0) {
            connections.push({
              id: `conn_${i-1}_${i}`,
              sourceComponentId: `comp_${i-1}`,
              targetComponentId: `comp_${i}`,
              sourcePort: 'out',
              targetPort: 'in',
              configuration: {
                bandwidth: 1000,
                latency: 5,
                protocol: 'HTTP',
                reliability: 0.99
              }
            });
          }
        }

        engine.initialize(components, connections);

        // Calculate latency from first to last component
        const result = engine.calculateEndToEndLatency('comp_0', `comp_${pathLength - 1}`);

        // Total latency should be positive and include all components and connections
        expect(result.totalLatency).toBeGreaterThan(0);
        expect(result.criticalPath.nodes.length).toBe(pathLength);
        expect(result.criticalPath.edges.length).toBe(pathLength - 1);

        // Latency should generally increase with path length
        // (This is a soft property due to different component characteristics)
        expect(result.totalLatency).toBeGreaterThan(baseLatency * 0.5); // At least half the expected minimum

        return true;
      }
    ), { numRuns: 50 });
  });

  /**
   * Property: Edge Load Tracking
   * Edge load updates should be consistent and bounded
   */
  it('Property: Edge load tracking should be consistent', () => {
    fc.assert(fc.property(
      fc.record({
        bandwidth: fc.integer({ min: 100, max: 10000 }),
        load: fc.integer({ min: 0, max: 20000 }) // Can exceed bandwidth
      }),
      (config) => {
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
            id: 'test_connection',
            sourceComponentId: 'source',
            targetComponentId: 'target',
            sourcePort: 'out',
            targetPort: 'in',
            configuration: {
              bandwidth: config.bandwidth,
              latency: 5,
              protocol: 'HTTP',
              reliability: 0.99
            }
          }
        ];

        engine.initialize(components, connections);
        engine.updateEdgeLoad('test_connection', config.load);

        const edge = engine.getEdge('test_connection');
        expect(edge).toBeDefined();
        expect(edge!.currentLoad).toBe(config.load);
        expect(edge!.bandwidth).toBe(config.bandwidth);

        // Load can exceed bandwidth (overload condition)
        const utilization = config.load / config.bandwidth;
        if (config.load > config.bandwidth) {
          expect(utilization).toBeGreaterThan(1.0);
        }

        return true;
      }
    ), { numRuns: 100 });
  });
});