/**
 * Basic simulation engine tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine, ComponentModelFactory } from '../simulation';
import { Workspace, ComponentType } from '../types';

describe('Simulation Engine', () => {
  let engine: SimulationEngine;
  let mockWorkspace: Workspace;

  beforeEach(() => {
    engine = new SimulationEngine();
    
    mockWorkspace = {
      id: 'test-workspace',
      name: 'Test Workspace',
      userId: 'test-user',
      components: [
        {
          id: 'web-server-1',
          type: 'web-server' as ComponentType,
          position: { x: 100, y: 100 },
          configuration: {
            capacity: 100,
            latency: 50,
            failureRate: 0.01,
            maxConnections: 1000,
            keepAliveTimeout: 30000,
            requestTimeout: 30000,
            staticContentRatio: 0.6,
            compressionEnabled: true
          },
          metadata: {
            name: 'Web Server',
            version: '1.0.0'
          }
        },
        {
          id: 'database-1',
          type: 'database' as ComponentType,
          position: { x: 300, y: 100 },
          configuration: {
            capacity: 50,
            latency: 100,
            failureRate: 0.005,
            connectionPoolSize: 10,
            cacheHitRatio: 0.8,
            queryComplexity: 'medium',
            indexEfficiency: 0.8
          },
          metadata: {
            name: 'Database',
            version: '1.0.0'
          }
        }
      ],
      connections: [
        {
          id: 'conn-1',
          sourceComponentId: 'web-server-1',
          targetComponentId: 'database-1',
          sourcePort: 'out',
          targetPort: 'in',
          configuration: {
            bandwidth: 1000,
            latency: 10,
            protocol: 'TCP',
            reliability: 0.99
          }
        }
      ],
      configuration: {
        duration: 60, // 60 seconds - longer duration
        loadPattern: {
          type: 'constant',
          baseLoad: 5 // 5 requests per second - lower load
        },
        failureScenarios: [],
        metricsCollection: {
          collectionInterval: 5000, // 5 seconds
          retentionPeriod: 3600,
          enabledMetrics: ['latency', 'throughput', 'errors']
        }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  });

  it('should initialize with workspace', () => {
    engine.initialize(mockWorkspace);
    const state = engine.getState();
    
    expect(state.isRunning).toBe(false);
    expect(state.components.size).toBe(2);
    expect(state.components.has('web-server-1')).toBe(true);
    expect(state.components.has('database-1')).toBe(true);
  });

  it('should start and stop simulation', async () => {
    engine.initialize(mockWorkspace);
    
    let simulationStarted = false;
    engine.on('started', () => {
      simulationStarted = true;
    });
    
    // Start simulation
    await engine.start();
    
    // Check if simulation started event was emitted
    expect(simulationStarted).toBe(true);
    expect(engine.getState().isRunning).toBe(true);
    
    // Stop simulation
    engine.stop();
    expect(engine.getState().isRunning).toBe(false);
  });

  it('should collect metrics during simulation', async () => {
    engine.initialize(mockWorkspace);
    
    let metricsCollected = false;
    engine.on('metrics_collected', () => {
      metricsCollected = true;
    });
    
    // Start simulation
    engine.start();
    
    // Wait for some metrics to be collected
    await new Promise(resolve => setTimeout(resolve, 200));
    
    engine.stop();
    
    // Check if metrics were collected
    const webServerMetrics = engine.getComponentMetrics('web-server-1');
    const databaseMetrics = engine.getComponentMetrics('database-1');
    
    expect(webServerMetrics).toBeDefined();
    expect(databaseMetrics).toBeDefined();
  });
});

describe('Component Model Factory', () => {
  it('should create database model', () => {
    const model = ComponentModelFactory.createModel('db-1', 'database', {
      capacity: 100,
      latency: 50,
      failureRate: 0.01
    });
    
    expect(model.id).toBe('db-1');
    expect(model.type).toBe('database');
  });

  it('should create web server model', () => {
    const model = ComponentModelFactory.createModel('web-1', 'web-server', {
      capacity: 100,
      latency: 50,
      failureRate: 0.01
    });
    
    expect(model.id).toBe('web-1');
    expect(model.type).toBe('web-server');
  });

  it('should create load balancer model', () => {
    const model = ComponentModelFactory.createModel('lb-1', 'load-balancer', {
      capacity: 100,
      latency: 50,
      failureRate: 0.01
    });
    
    expect(model.id).toBe('lb-1');
    expect(model.type).toBe('load-balancer');
  });

  it('should create cache model', () => {
    const model = ComponentModelFactory.createModel('cache-1', 'cache', {
      capacity: 100,
      latency: 50,
      failureRate: 0.01
    });
    
    expect(model.id).toBe('cache-1');
    expect(model.type).toBe('cache');
  });

  it('should throw error for unsupported component type', () => {
    expect(() => {
      ComponentModelFactory.createModel('test-1', 'unsupported' as ComponentType, {
        capacity: 100,
        latency: 50,
        failureRate: 0.01
      });
    }).toThrow('Unsupported component type: unsupported');
  });
});