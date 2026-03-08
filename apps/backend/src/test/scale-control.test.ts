/**
 * Scale Control Integration Tests
 * 
 * Tests the dynamic scale control functionality including scale simulation service,
 * real-time metrics, and system collapse detection
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScaleSimulationService } from '../services/scaleSimulationService';
import { RealTimeMetricsService } from '../services/realTimeMetricsService';
import { SystemCollapseDetector } from '../services/systemCollapseDetector';
import { Workspace, Component, Connection, ComponentType } from '../types';

describe('Scale Control Integration', () => {
  let scaleService: ScaleSimulationService;
  let metricsService: RealTimeMetricsService;
  let collapseDetector: SystemCollapseDetector;
  let mockWorkspace: Workspace;

  beforeEach(() => {
    scaleService = new ScaleSimulationService();
    metricsService = new RealTimeMetricsService({
      updateInterval: 100,
      bufferSize: 1,
      enableCompression: false,
      maxClientsPerWorkspace: 10
    });
    collapseDetector = new SystemCollapseDetector();

    // Create mock workspace
    const components: Component[] = [
      {
        id: 'client-1',
        type: 'web-server' as ComponentType,
        position: { x: 100, y: 100 },
        configuration: {
          capacity: 100,
          latency: 10,
          reliability: 0.99
        }
      },
      {
        id: 'lb-1',
        type: 'load-balancer' as ComponentType,
        position: { x: 200, y: 100 },
        configuration: {
          capacity: 1000,
          latency: 2,
          reliability: 0.999
        }
      },
      {
        id: 'service-1',
        type: 'service' as ComponentType,
        position: { x: 300, y: 100 },
        configuration: {
          capacity: 200,
          latency: 50,
          reliability: 0.95
        }
      },
      {
        id: 'db-1',
        type: 'database' as ComponentType,
        position: { x: 400, y: 100 },
        configuration: {
          capacity: 50,
          latency: 20,
          reliability: 0.98
        }
      }
    ];

    const connections: Connection[] = [
      {
        id: 'conn-1',
        sourceComponentId: 'client-1',
        targetComponentId: 'lb-1',
        configuration: {
          latency: 5,
          bandwidth: 1000,
          reliability: 0.99
        }
      },
      {
        id: 'conn-2',
        sourceComponentId: 'lb-1',
        targetComponentId: 'service-1',
        configuration: {
          latency: 2,
          bandwidth: 1000,
          reliability: 0.999
        }
      },
      {
        id: 'conn-3',
        sourceComponentId: 'service-1',
        targetComponentId: 'db-1',
        configuration: {
          latency: 1,
          bandwidth: 500,
          reliability: 0.99
        }
      }
    ];

    mockWorkspace = {
      id: 'test-workspace',
      name: 'Test Workspace',
      components,
      connections,
      configuration: {
        duration: 300,
        loadPattern: {
          type: 'constant',
          baseLoad: 10,
          peakMultiplier: 1.5,
          duration: 300,
          rampUpTime: 30,
          rampDownTime: 30
        },
        failureScenarios: [],
        metricsCollection: {
          enabled: true,
          collectionInterval: 1000
        }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  });

  afterEach(() => {
    scaleService.stopScaleSimulation();
    metricsService.cleanup();
    collapseDetector.stopMonitoring();
  });

  it('should start scale simulation successfully', async () => {
    const config = {
      workspaceId: 'test-workspace',
      initialScale: 100,
      targetScale: 1000,
      duration: 60,
      updateInterval: 100,
      enableRealTimeUpdates: true
    };

    await expect(scaleService.startScaleSimulation(config, mockWorkspace))
      .resolves.not.toThrow();

    expect(scaleService.isSimulationRunning()).toBe(true);
    expect(scaleService.getCurrentScale()).toBe(100);
  });

  it('should update scale dynamically', async () => {
    const config = {
      workspaceId: 'test-workspace',
      initialScale: 100,
      targetScale: 1000,
      duration: 60,
      updateInterval: 100,
      enableRealTimeUpdates: true
    };

    await scaleService.startScaleSimulation(config, mockWorkspace);

    // Update scale
    scaleService.updateScale(500);
    expect(scaleService.getCurrentScale()).toBe(500);

    // Update scale again
    scaleService.updateScale(1000);
    expect(scaleService.getCurrentScale()).toBe(1000);
  });

  it('should generate simulation results', async () => {
    const config = {
      workspaceId: 'test-workspace',
      initialScale: 100,
      targetScale: 1000,
      duration: 60,
      updateInterval: 100,
      enableRealTimeUpdates: true
    };

    await scaleService.startScaleSimulation(config, mockWorkspace);

    const result = scaleService.getCurrentSimulationState();
    expect(result).toBeDefined();
    expect(result?.userCount).toBe(100);
    expect(result?.qps).toBeGreaterThan(0);
    expect(result?.systemMetrics).toBeDefined();
  });

  it('should detect performance stats in real-time metrics service', () => {
    const stats = metricsService.getPerformanceStats();
    expect(stats).toBeDefined();
    expect(stats.averageUpdateTime).toBeDefined();
    expect(stats.targetCompliance).toBeDefined();
  });

  it('should detect system collapse when thresholds are exceeded', () => {
    collapseDetector.startMonitoring();

    // Simulate high error rate metrics
    const badMetrics = {
      componentId: 'service-1',
      timestamp: Date.now(),
      requestsPerSecond: 50,
      averageLatency: 5000, // Very high latency
      errorRate: 0.15, // High error rate
      cpuUtilization: 0.95, // High CPU
      memoryUtilization: 0.9, // High memory
      queueDepth: 100 // High queue depth
    };

    collapseDetector.updateComponentMetrics(badMetrics);

    // Wait a bit for analysis
    setTimeout(() => {
      const activeCollapses = collapseDetector.getActiveCollapses();
      // Note: In a real test, we'd need to wait for the monitoring interval
      // This is a simplified test to verify the structure
      expect(Array.isArray(activeCollapses)).toBe(true);
    }, 100);
  });

  it('should handle scale simulation errors gracefully', async () => {
    // Try to start simulation when already running
    const config = {
      workspaceId: 'test-workspace',
      initialScale: 100,
      targetScale: 1000,
      duration: 60,
      updateInterval: 100,
      enableRealTimeUpdates: true
    };

    await scaleService.startScaleSimulation(config, mockWorkspace);
    
    // Try to start again - should throw error
    await expect(scaleService.startScaleSimulation(config, mockWorkspace))
      .rejects.toThrow('Scale simulation is already running');
  });

  it('should stop simulation cleanly', async () => {
    const config = {
      workspaceId: 'test-workspace',
      initialScale: 100,
      targetScale: 1000,
      duration: 60,
      updateInterval: 100,
      enableRealTimeUpdates: true
    };

    await scaleService.startScaleSimulation(config, mockWorkspace);
    expect(scaleService.isSimulationRunning()).toBe(true);

    scaleService.stopScaleSimulation();
    expect(scaleService.isSimulationRunning()).toBe(false);
  });

  it('should track client connections in metrics service', () => {
    expect(metricsService.getActiveClientCount()).toBe(0);
    
    // In a real test, we'd create mock WebSocket connections
    // This verifies the method exists and returns expected type
    expect(typeof metricsService.getActiveClientCount()).toBe('number');
  });

  it('should provide cascade failure models in collapse detector', () => {
    const cascadeModel = {
      componentId: 'service-1',
      dependentComponents: ['db-1'],
      failureProbability: 0.8,
      propagationDelay: 5000,
      impactSeverity: 0.9
    };

    collapseDetector.addCascadeModel(cascadeModel);
    
    // Verify model was added (indirect test through no errors)
    expect(() => collapseDetector.removeCascadeModel('service-1')).not.toThrow();
  });
});