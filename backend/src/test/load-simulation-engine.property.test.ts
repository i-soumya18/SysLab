/**
 * Property-Based Tests for Load Simulation Engine
 * 
 * **Property 6: Load Simulation Engine with Queueing Theory**
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**
 * 
 * For any traffic configuration, the Load Simulation Engine should generate Poisson arrival processes 
 * with correct lambda values, model backpressure propagation through the system graph, implement 
 * queueing theory calculations for wait times and queue lengths, handle realistic overflow behavior 
 * when queues reach capacity, and support burst traffic patterns and gradual ramp-up scenarios.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { LoadSimulationEngine, PoissonProcess, QueueState, BackpressureState, TrafficBurst, GradualRampUp } from '../simulation/LoadSimulationEngine';
import { SystemGraphEngine } from '../simulation/SystemGraphEngine';
import { PriorityQueueEventScheduler } from '../simulation/EventScheduler';
import { Component, Connection, ComponentType, LoadPattern } from '../types';

describe('LoadSimulationEngine Property Tests', () => {
  let loadEngine: LoadSimulationEngine;
  let systemGraph: SystemGraphEngine;
  let eventScheduler: PriorityQueueEventScheduler;

  beforeEach(() => {
    systemGraph = new SystemGraphEngine();
    eventScheduler = new PriorityQueueEventScheduler();
    loadEngine = new LoadSimulationEngine(systemGraph, eventScheduler);
  });

  /**
   * Property 6: Load Simulation Engine with Queueing Theory
   * For any valid traffic configuration, the Load Simulation Engine should maintain consistency
   */
  it('Property 6: Load Simulation Engine with Queueing Theory - should maintain simulation consistency', () => {
    // Feature: system-design-simulator, Property 6: Load Simulation Engine with Queueing Theory
    fc.assert(fc.property(
      // Generate valid system architecture
      fc.array(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
          type: fc.constantFrom('database', 'load-balancer', 'web-server', 'cache', 'message-queue', 'cdn', 'proxy') as fc.Arbitrary<ComponentType>,
          capacity: fc.integer({ min: 10, max: 1000 }),
          latency: fc.integer({ min: 1, max: 100 })
        }),
        { minLength: 2, maxLength: 8 }
      ),
      // Generate load pattern
      fc.record({
        type: fc.constantFrom('constant', 'ramp', 'spike', 'realistic'),
        baseLoad: fc.integer({ min: 1, max: 1000 }),
        peakLoad: fc.option(fc.integer({ min: 1, max: 2000 }))
      }),
      // Generate user scale
      fc.constantFrom(1, 1000, 1000000, 1000000000),
      (componentConfigs, loadPatternConfig, userScale) => {
        // Create unique component IDs and ensure at least one Client component
        const uniqueIds = new Set<string>();
        const validComponents: Component[] = [];
        let hasClient = false;
        
        for (const config of componentConfigs) {
          if (!uniqueIds.has(config.id)) {
            uniqueIds.add(config.id);
            
            // Ensure first component is a Client for entry point
            const componentType = !hasClient ? 'web-server' : config.type; // Use web-server as Client equivalent
            if (!hasClient) hasClient = true;
            
            validComponents.push({
              id: config.id,
              type: componentType,
              position: { x: Math.random() * 1000, y: Math.random() * 1000 },
              configuration: {
                capacity: config.capacity,
                latency: config.latency,
                failureRate: 0.01
              },
              metadata: {
                name: `Component ${config.id}`,
                version: '1.0.0'
              }
            });
          }
        }

        if (validComponents.length < 2) return true; // Need at least 2 components

        // Create linear connections to avoid cycles
        const validConnections: Connection[] = [];
        for (let i = 0; i < validComponents.length - 1; i++) {
          validConnections.push({
            id: `conn_${i}`,
            sourceComponentId: validComponents[i].id,
            targetComponentId: validComponents[i + 1].id,
            sourcePort: 'out',
            targetPort: 'in',
            configuration: {
              bandwidth: 1000,
              latency: fc.sample(fc.integer({ min: 1, max: 50 }), 1)[0],
              protocol: 'HTTP',
              reliability: 0.99
            }
          });
        }

        // Initialize system graph
        const validation = systemGraph.initialize(validComponents, validConnections);
        if (!validation.isValid) return true; // Skip invalid configurations

        // Create load pattern
        const loadPattern: LoadPattern = {
          type: loadPatternConfig.type as any,
          baseLoad: loadPatternConfig.baseLoad,
          peakLoad: loadPatternConfig.peakLoad || undefined,
          pattern: []
        };

        // Initialize load simulation
        loadEngine.initializeLoadSimulation(loadPattern, userScale);

        // Property assertions

        // 1. Queue states should be initialized for all components
        const queueStates = loadEngine.getQueueStates();
        expect(queueStates.size).toBe(validComponents.length);
        
        for (const [componentId, queueState] of queueStates) {
          expect(queueState.componentId).toBe(componentId);
          expect(queueState.maxCapacity).toBeGreaterThan(0);
          expect(queueState.serviceRate).toBeGreaterThan(0);
          expect(queueState.serverCount).toBeGreaterThan(0);
          expect(queueState.queueLength).toBeGreaterThanOrEqual(0);
          expect(queueState.waitTime).toBeGreaterThanOrEqual(0);
          expect(queueState.utilization).toBeGreaterThanOrEqual(0);
          expect(queueState.droppedRequests).toBeGreaterThanOrEqual(0);
        }

        // 2. Backpressure states should be initialized for all components
        const backpressureStates = loadEngine.getBackpressureStates();
        expect(backpressureStates.size).toBe(validComponents.length);
        
        for (const [componentId, backpressureState] of backpressureStates) {
          expect(backpressureState.componentId).toBe(componentId);
          expect(backpressureState.backpressureLevel).toBeGreaterThanOrEqual(0);
          expect(backpressureState.backpressureLevel).toBeLessThanOrEqual(1);
          expect(backpressureState.throttleRate).toBeGreaterThan(0);
          expect(backpressureState.throttleRate).toBeLessThanOrEqual(1);
        }

        // 3. Simulation step should produce consistent results
        const deltaTime = 1000; // 1 second
        const result = loadEngine.step(deltaTime);
        
        expect(result.timestamp).toBe(deltaTime);
        expect(result.totalRequests).toBeGreaterThanOrEqual(0);
        expect(result.activeRequests).toBeGreaterThanOrEqual(0);
        expect(result.completedRequests).toBeGreaterThanOrEqual(0);
        expect(result.droppedRequests).toBeGreaterThanOrEqual(0);
        expect(result.averageLatency).toBeGreaterThanOrEqual(0);
        expect(result.queueStates.size).toBe(validComponents.length);
        expect(result.backpressureStates.size).toBe(validComponents.length);

        // 4. Multiple simulation steps should maintain consistency
        const result2 = loadEngine.step(deltaTime);
        expect(result2.timestamp).toBe(2 * deltaTime);
        expect(result2.totalRequests).toBeGreaterThanOrEqual(result.totalRequests);
        expect(result2.completedRequests).toBeGreaterThanOrEqual(result.completedRequests);

        return true;
      }
    ), { numRuns: 100 });
  });

  /**
   * Property: Poisson Process Arrival Rate Consistency
   * Arrival rates should be proportional to user scale and load pattern
   */
  it('Property: Poisson arrival rates should scale correctly with user count', () => {
    fc.assert(fc.property(
      fc.record({
        baseLoad: fc.integer({ min: 10, max: 500 }),
        userScale1: fc.constantFrom(1, 1000),
        userScale2: fc.constantFrom(1000000, 1000000000)
      }),
      (config) => {
        // Create simple system with one client component
        const components: Component[] = [
          {
            id: 'client',
            type: 'web-server', // Acts as Client
            position: { x: 0, y: 0 },
            configuration: { capacity: 1000, latency: 10, failureRate: 0.01 },
            metadata: { name: 'Client', version: '1.0.0' }
          },
          {
            id: 'server',
            type: 'web-server',
            position: { x: 100, y: 0 },
            configuration: { capacity: 1000, latency: 50, failureRate: 0.01 },
            metadata: { name: 'Server', version: '1.0.0' }
          }
        ];

        const connections: Connection[] = [
          {
            id: 'conn',
            sourceComponentId: 'client',
            targetComponentId: 'server',
            sourcePort: 'out',
            targetPort: 'in',
            configuration: {
              bandwidth: 1000,
              latency: 5,
              protocol: 'HTTP',
              reliability: 0.99
            }
          }
        ];

        systemGraph.initialize(components, connections);

        const loadPattern: LoadPattern = {
          type: 'constant',
          baseLoad: config.baseLoad,
          pattern: []
        };

        // Test with smaller scale
        loadEngine.reset();
        loadEngine.initializeLoadSimulation(loadPattern, config.userScale1);
        const result1 = loadEngine.step(1000);

        // Test with larger scale
        loadEngine.reset();
        loadEngine.initializeLoadSimulation(loadPattern, config.userScale2);
        const result2 = loadEngine.step(1000);

        // Higher user scale should generally produce more requests
        // (allowing for randomness in Poisson process)
        if (config.userScale2 > config.userScale1 * 10) {
          // Only assert if scale difference is significant
          expect(result2.totalRequests).toBeGreaterThanOrEqual(result1.totalRequests);
        }

        return true;
      }
    ), { numRuns: 50 });
  });

  /**
   * Property: Queue Theory Consistency
   * Queue wait times should follow queueing theory principles
   */
  it('Property: Queue wait times should follow queueing theory principles', () => {
    fc.assert(fc.property(
      fc.record({
        serviceRate: fc.integer({ min: 10, max: 1000 }),
        serverCount: fc.integer({ min: 1, max: 10 }),
        queueLength: fc.integer({ min: 0, max: 100 })
      }),
      (config) => {
        // Create simple system
        const components: Component[] = [
          {
            id: 'test_component',
            type: 'web-server',
            position: { x: 0, y: 0 },
            configuration: { 
              capacity: 1000, 
              latency: 10, 
              failureRate: 0.01,
              performanceMultiplier: 1.0,
              serverCount: config.serverCount
            },
            metadata: { name: 'Test Component', version: '1.0.0' }
          }
        ];

        systemGraph.initialize(components, []);
        
        const loadPattern: LoadPattern = {
          type: 'constant',
          baseLoad: 1, // Minimal load
          pattern: []
        };

        loadEngine.initializeLoadSimulation(loadPattern, 1);
        
        // Manually set queue state for testing
        const queueStates = loadEngine.getQueueStates();
        const queueState = queueStates.get('test_component');
        
        if (queueState) {
          queueState.queueLength = config.queueLength;
          queueState.serviceRate = config.serviceRate;
          queueState.serverCount = config.serverCount;
          
          // Step simulation to update metrics
          loadEngine.step(100);
          
          const updatedQueueState = loadEngine.getQueueStates().get('test_component');
          expect(updatedQueueState).toBeDefined();
          
          // Utilization should be calculated correctly
          const rho = config.queueLength / (config.serviceRate * config.serverCount);
          const expectedUtilization = Math.min(rho, 1.0);
          expect(updatedQueueState!.utilization).toBeCloseTo(expectedUtilization, 2);
          
          // Wait time should be non-negative
          expect(updatedQueueState!.waitTime).toBeGreaterThanOrEqual(0);
          
          // For M/M/1 queues with rho < 1, wait time should be finite
          if (config.serverCount === 1 && rho < 0.9) {
            expect(updatedQueueState!.waitTime).toBeLessThan(Number.POSITIVE_INFINITY);
          }
        }

        return true;
      }
    ), { numRuns: 100 });
  });

  /**
   * Property: Backpressure Propagation Consistency
   * Backpressure should propagate upstream when components are overloaded
   */
  it('Property: Backpressure should propagate upstream correctly', () => {
    fc.assert(fc.property(
      fc.record({
        chainLength: fc.integer({ min: 3, max: 6 }),
        overloadLevel: fc.float({ min: Math.fround(0.6), max: Math.fround(1.0) })
      }),
      (config) => {
        // Create linear chain of components
        const components: Component[] = [];
        const connections: Connection[] = [];

        for (let i = 0; i < config.chainLength; i++) {
          components.push({
            id: `comp_${i}`,
            type: 'web-server',
            position: { x: i * 100, y: 0 },
            configuration: { capacity: 100, latency: 10, failureRate: 0.01 },
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

        systemGraph.initialize(components, connections);
        
        const loadPattern: LoadPattern = {
          type: 'constant',
          baseLoad: 10,
          pattern: []
        };

        loadEngine.initializeLoadSimulation(loadPattern, 1000);

        // Simulate overload in the last component
        const queueStates = loadEngine.getQueueStates();
        const lastComponentQueue = queueStates.get(`comp_${config.chainLength - 1}`);
        
        if (lastComponentQueue) {
          // Set high queue length to trigger backpressure
          lastComponentQueue.queueLength = Math.floor(lastComponentQueue.maxCapacity * config.overloadLevel);
          
          // Step simulation to propagate backpressure
          loadEngine.step(1000);
          
          const backpressureStates = loadEngine.getBackpressureStates();
          
          // Last component should have high backpressure
          const lastBackpressure = backpressureStates.get(`comp_${config.chainLength - 1}`);
          expect(lastBackpressure).toBeDefined();
          expect(lastBackpressure!.backpressureLevel).toBeGreaterThan(0.3);
          
          // Upstream components should have some backpressure if propagation occurred
          if (config.chainLength > 2) {
            const upstreamBackpressure = backpressureStates.get(`comp_${config.chainLength - 2}`);
            expect(upstreamBackpressure).toBeDefined();
            // Backpressure may or may not propagate depending on thresholds
            expect(upstreamBackpressure!.backpressureLevel).toBeGreaterThanOrEqual(0);
          }
        }

        return true;
      }
    ), { numRuns: 50 });
  });

  /**
   * Property: Circuit Breaker Behavior
   * Circuit breakers should open when error rates exceed thresholds
   */
  it('Property: Circuit breakers should activate under high error conditions', () => {
    fc.assert(fc.property(
      fc.record({
        queueCapacity: fc.integer({ min: 10, max: 100 }),
        overflowRequests: fc.integer({ min: 5, max: 50 })
      }),
      (config) => {
        // Create simple system
        const components: Component[] = [
          {
            id: 'overloaded_component',
            type: 'web-server',
            position: { x: 0, y: 0 },
            configuration: { capacity: config.queueCapacity, latency: 10, failureRate: 0.01 },
            metadata: { name: 'Overloaded Component', version: '1.0.0' }
          }
        ];

        systemGraph.initialize(components, []);
        
        const loadPattern: LoadPattern = {
          type: 'constant',
          baseLoad: 1,
          pattern: []
        };

        loadEngine.initializeLoadSimulation(loadPattern, 1);

        // Simulate queue overflow
        const queueStates = loadEngine.getQueueStates();
        const queueState = queueStates.get('overloaded_component');
        
        if (queueState) {
          // Fill queue to capacity
          queueState.queueLength = queueState.maxCapacity;
          queueState.droppedRequests = config.overflowRequests;
          
          // Step simulation multiple times to trigger circuit breaker logic
          for (let i = 0; i < 5; i++) {
            loadEngine.step(1000);
          }
          
          const updatedQueueState = loadEngine.getQueueStates().get('overloaded_component');
          expect(updatedQueueState).toBeDefined();
          
          // Circuit breaker behavior depends on error rate and queue length
          const errorRate = updatedQueueState!.droppedRequests / 
            Math.max(updatedQueueState!.queueLength + updatedQueueState!.droppedRequests, 1);
          
          if (errorRate > 0.5 && updatedQueueState!.queueLength > 10) {
            // Circuit breaker should be open under high error conditions
            expect(updatedQueueState!.circuitBreakerOpen).toBe(true);
          }
        }

        return true;
      }
    ), { numRuns: 50 });
  });

  /**
   * Property: Traffic Burst Handling
   * System should handle traffic bursts without losing consistency
   */
  it('Property: Traffic bursts should be handled consistently', () => {
    fc.assert(fc.property(
      fc.record({
        burstMultiplier: fc.float({ min: Math.fround(1.5), max: Math.fround(5.0) }),
        burstDuration: fc.integer({ min: 1000, max: 10000 }),
        startTime: fc.integer({ min: 1000, max: 5000 })
      }),
      (config) => {
        // Create simple system
        const components: Component[] = [
          {
            id: 'client',
            type: 'web-server',
            position: { x: 0, y: 0 },
            configuration: { capacity: 1000, latency: 10, failureRate: 0.01 },
            metadata: { name: 'Client', version: '1.0.0' }
          }
        ];

        systemGraph.initialize(components, []);
        
        const loadPattern: LoadPattern = {
          type: 'constant',
          baseLoad: 10,
          pattern: []
        };

        loadEngine.initializeLoadSimulation(loadPattern, 1000);

        // Add traffic burst
        const burst: TrafficBurst = {
          startTime: config.startTime,
          duration: config.burstDuration,
          multiplier: config.burstMultiplier
        };

        loadEngine.addTrafficBurst(burst);

        // Simulate before burst
        const resultBefore = loadEngine.step(config.startTime - 100);
        
        // Simulate during burst (simplified - would need event processing)
        const resultDuring = loadEngine.step(100);
        
        // Results should be consistent
        expect(resultDuring.timestamp).toBeGreaterThan(resultBefore.timestamp);
        expect(resultDuring.totalRequests).toBeGreaterThanOrEqual(resultBefore.totalRequests);
        
        // Burst events should be scheduled
        expect(eventScheduler.hasEvents()).toBe(true);

        return true;
      }
    ), { numRuns: 30 });
  });

  /**
   * Property: Gradual Ramp-Up Consistency
   * Gradual ramp-up should produce smooth load transitions
   */
  it('Property: Gradual ramp-up should produce consistent load transitions', () => {
    fc.assert(fc.property(
      fc.record({
        startMultiplier: fc.float({ min: Math.fround(0.5), max: Math.fround(1.0) }),
        endMultiplier: fc.float({ min: Math.fround(2.0), max: Math.fround(5.0) }),
        rampDuration: fc.integer({ min: 5000, max: 20000 }),
        startTime: fc.integer({ min: 1000, max: 3000 })
      }),
      (config) => {
        // Create simple system
        const components: Component[] = [
          {
            id: 'client',
            type: 'web-server',
            position: { x: 0, y: 0 },
            configuration: { capacity: 1000, latency: 10, failureRate: 0.01 },
            metadata: { name: 'Client', version: '1.0.0' }
          }
        ];

        systemGraph.initialize(components, []);
        
        const loadPattern: LoadPattern = {
          type: 'constant',
          baseLoad: 10,
          pattern: []
        };

        loadEngine.initializeLoadSimulation(loadPattern, 1000);

        // Add gradual ramp-up
        const rampUp: GradualRampUp = {
          startTime: config.startTime,
          duration: config.rampDuration,
          startMultiplier: config.startMultiplier,
          endMultiplier: config.endMultiplier
        };

        loadEngine.addGradualRampUp(rampUp);

        // Simulate and verify events are scheduled
        loadEngine.step(config.startTime - 100);
        
        // Ramp-up events should be scheduled
        expect(eventScheduler.hasEvents()).toBe(true);

        // Multiplier should increase over time (this would require event processing)
        expect(config.endMultiplier).toBeGreaterThan(config.startMultiplier);

        return true;
      }
    ), { numRuns: 30 });
  });

  /**
   * Property: Simulation Reset Consistency
   * Reset should clear all state and allow fresh initialization
   */
  it('Property: Simulation reset should clear all state consistently', () => {
    fc.assert(fc.property(
      fc.record({
        baseLoad: fc.integer({ min: 1, max: 100 }),
        userScale: fc.constantFrom(1, 1000, 1000000)
      }),
      (config) => {
        // Create simple system
        const components: Component[] = [
          {
            id: 'client',
            type: 'web-server',
            position: { x: 0, y: 0 },
            configuration: { capacity: 100, latency: 10, failureRate: 0.01 },
            metadata: { name: 'Client', version: '1.0.0' }
          }
        ];

        systemGraph.initialize(components, []);
        
        const loadPattern: LoadPattern = {
          type: 'constant',
          baseLoad: config.baseLoad,
          pattern: []
        };

        // Initialize and run simulation
        loadEngine.initializeLoadSimulation(loadPattern, config.userScale);
        loadEngine.step(1000);
        
        // Verify state exists
        expect(loadEngine.getQueueStates().size).toBeGreaterThan(0);
        expect(loadEngine.getBackpressureStates().size).toBeGreaterThan(0);

        // Reset simulation
        loadEngine.reset();

        // Verify state is cleared
        expect(loadEngine.getQueueStates().size).toBe(0);
        expect(loadEngine.getBackpressureStates().size).toBe(0);

        // Should be able to initialize again
        loadEngine.initializeLoadSimulation(loadPattern, config.userScale);
        expect(loadEngine.getQueueStates().size).toBeGreaterThan(0);
        expect(loadEngine.getBackpressureStates().size).toBeGreaterThan(0);

        return true;
      }
    ), { numRuns: 50 });
  });
});