/**
 * MVLE-4 Test: User clicks "Run" and simulation executes
 * 
 * This test verifies that:
 * 1. User can start a simulation with workspace data
 * 2. Simulation executes and returns a simulation ID
 * 3. Metrics can be retrieved during simulation
 * 4. Simulation can be stopped
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { simulationService } from '../services/simulationService';
import type { Workspace, Component, Connection } from '../types';

describe('MVLE-4: Simulation Execution', () => {
  let testWorkspace: Workspace;
  let simulationId: string;

  beforeAll(() => {
    // Create a simple test workspace with Client -> LB -> Service -> DB
    const components: Component[] = [
      {
        id: 'client-1',
        type: 'service',
        position: { x: 100, y: 100 },
        configuration: {
          capacity: 1000,
          latency: 10,
          failureRate: 0.001
        },
        metadata: {
          name: 'Client',
          description: 'Client component',
          version: '1.0.0'
        }
      },
      {
        id: 'lb-1',
        type: 'load-balancer',
        position: { x: 300, y: 100 },
        configuration: {
          capacity: 2000,
          latency: 5,
          failureRate: 0.0005
        },
        metadata: {
          name: 'Load Balancer',
          description: 'Load balancer component',
          version: '1.0.0'
        }
      },
      {
        id: 'service-1',
        type: 'service',
        position: { x: 500, y: 100 },
        configuration: {
          capacity: 500,
          latency: 50,
          failureRate: 0.002
        },
        metadata: {
          name: 'Web Service',
          description: 'Web service component',
          version: '1.0.0'
        }
      },
      {
        id: 'db-1',
        type: 'database',
        position: { x: 700, y: 100 },
        configuration: {
          capacity: 100,
          latency: 20,
          failureRate: 0.001
        },
        metadata: {
          name: 'Database',
          description: 'Database component',
          version: '1.0.0'
        }
      }
    ];

    const connections: Connection[] = [
      {
        id: 'conn-1',
        sourceComponentId: 'client-1',
        targetComponentId: 'lb-1',
        sourcePort: 'out',
        targetPort: 'in',
        configuration: {
          bandwidth: 1000,
          latency: 5,
          protocol: 'HTTP',
          reliability: 0.99
        }
      },
      {
        id: 'conn-2',
        sourceComponentId: 'lb-1',
        targetComponentId: 'service-1',
        sourcePort: 'out',
        targetPort: 'in',
        configuration: {
          bandwidth: 1000,
          latency: 5,
          protocol: 'HTTP',
          reliability: 0.99
        }
      },
      {
        id: 'conn-3',
        sourceComponentId: 'service-1',
        targetComponentId: 'db-1',
        sourcePort: 'out',
        targetPort: 'in',
        configuration: {
          bandwidth: 500,
          latency: 2,
          protocol: 'DATABASE',
          reliability: 0.999
        }
      }
    ];

    testWorkspace = {
      id: 'test-workspace-mvle4',
      name: 'MVLE-4 Test Workspace',
      description: 'Test workspace for MVLE-4',
      userId: 'test-user',
      components,
      connections,
      configuration: {
        duration: 30, // 30 seconds for test
        loadPattern: {
          type: 'constant',
          baseLoad: 200 // 200 requests per second (100 users * 2 req/sec)
        },
        failureScenarios: [],
        metricsCollection: {
          collectionInterval: 1000,
          retentionPeriod: 300,
          enabledMetrics: ['latency', 'throughput', 'errorRate', 'resourceUtilization']
        }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  });

  afterAll(async () => {
    // Clean up simulation if it's still running
    if (simulationId) {
      try {
        await simulationService.stopSimulation(simulationId);
        simulationService.clearSimulation(simulationId);
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
  });

  it('should start a simulation with workspace data', async () => {
    // Start simulation
    const result = await simulationService.startSimulation(
      testWorkspace.id,
      testWorkspace,
      {
        userCount: 100,
        duration: 30
      }
    );

    expect(result).toBeDefined();
    expect(result.simulationId).toBeDefined();
    expect(result.status).toBe('running');
    expect(result.message).toContain('100 users');

    simulationId = result.simulationId;

    console.log('✅ MVLE-4: Simulation started successfully');
    console.log(`   Simulation ID: ${simulationId}`);
  });

  it('should retrieve simulation status', async () => {
    expect(simulationId).toBeDefined();

    const status = simulationService.getSimulationStatus(simulationId);

    expect(status).toBeDefined();
    expect(status.simulationId).toBe(simulationId);
    expect(status.workspaceId).toBe(testWorkspace.id);
    expect(['running', 'completed']).toContain(status.status);
    expect(status.userCount).toBe(100);
    expect(status.trafficLoad).toBeGreaterThan(0);

    console.log('✅ MVLE-4: Simulation status retrieved successfully');
    console.log(`   Status: ${status.status}`);
    console.log(`   User count: ${status.userCount}`);
    console.log(`   Traffic load: ${status.trafficLoad} req/sec`);
  });

  it('should retrieve simulation metrics', async () => {
    expect(simulationId).toBeDefined();

    // Wait a bit for metrics to be collected
    await new Promise(resolve => setTimeout(resolve, 1500));

    const metrics = simulationService.getSimulationMetrics(simulationId);

    expect(metrics).toBeDefined();
    expect(metrics.components).toBeDefined();
    expect(metrics.system).toBeDefined();
    expect(metrics.bottlenecks).toBeDefined();

    // Metrics might be empty if simulation completed too quickly, but structure should exist
    expect(Array.isArray(metrics.components)).toBe(true);
    expect(metrics.system.activeComponents).toBeGreaterThanOrEqual(0);

    console.log('✅ MVLE-4: Simulation metrics retrieved successfully');
    console.log(`   Components tracked: ${metrics.components.length}`);
    console.log(`   System throughput: ${metrics.system.totalThroughput.toFixed(2)} req/sec`);
    console.log(`   Average latency: ${metrics.system.averageLatency.toFixed(2)} ms`);
    console.log(`   Bottlenecks detected: ${metrics.bottlenecks.length}`);

    // Log component metrics if available
    if (metrics.components.length > 0) {
      metrics.components.forEach(comp => {
        console.log(`   - ${comp.componentName}: ${comp.throughput.toFixed(2)} req/sec, ${comp.averageLatency.toFixed(2)} ms latency`);
      });
    }
  });

  it('should stop the simulation or verify it completed', async () => {
    expect(simulationId).toBeDefined();

    const status = simulationService.getSimulationStatus(simulationId);

    if (status.status === 'running') {
      const result = await simulationService.stopSimulation(simulationId);

      expect(result).toBeDefined();
      expect(result.simulationId).toBe(simulationId);
      expect(result.status).toBe('stopped');
      expect(result.duration).toBeGreaterThan(0);

      console.log('✅ MVLE-4: Simulation stopped successfully');
      console.log(`   Duration: ${(result.duration / 1000).toFixed(1)} seconds`);
    } else {
      console.log('✅ MVLE-4: Simulation already completed');
      console.log(`   Status: ${status.status}`);
    }
  });

  it('should verify simulation is in stopped or completed state', () => {
    expect(simulationId).toBeDefined();

    const status = simulationService.getSimulationStatus(simulationId);

    expect(['stopped', 'completed']).toContain(status.status);

    console.log('✅ MVLE-4: Simulation state verified');
    console.log(`   Final status: ${status.status}`);
  });
});
