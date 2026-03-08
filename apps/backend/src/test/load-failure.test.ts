/**
 * Tests for load generation and failure modeling functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LoadGeneratorFactory, RealisticLoadGenerator } from '../simulation/LoadGenerator';
import { FailureManager, FailureManagerFactory } from '../simulation/FailureManager';
import { LoadPattern, FailureScenario } from '../types';

describe('Load Generation', () => {
  let loadGenerator: RealisticLoadGenerator;

  beforeEach(() => {
    loadGenerator = LoadGeneratorFactory.createGenerator('realistic') as RealisticLoadGenerator;
  });

  it('should generate constant load pattern', () => {
    const pattern: LoadPattern = {
      type: 'constant',
      baseLoad: 10
    };
    
    const duration = 60; // 60 seconds
    const loadPoints = loadGenerator.generateLoadPoints(pattern, duration);
    
    expect(loadPoints).toBeDefined();
    expect(loadPoints.length).toBeGreaterThan(0);
    expect(loadPoints[0].timestamp).toBe(0);
    
    // Check that load is approximately constant (within variation range)
    const avgLoad = loadPoints.reduce((sum, point) => sum + point.requestsPerSecond, 0) / loadPoints.length;
    expect(avgLoad).toBeCloseTo(pattern.baseLoad, 0); // Allow more tolerance for random variations
  });

  it('should generate ramp load pattern', () => {
    const pattern: LoadPattern = {
      type: 'ramp',
      baseLoad: 5,
      peakLoad: 20
    };
    
    const duration = 60;
    const loadPoints = loadGenerator.generateLoadPoints(pattern, duration);
    
    expect(loadPoints).toBeDefined();
    expect(loadPoints.length).toBeGreaterThan(0);
    
    // First point should be close to base load (allow for random variation)
    expect(loadPoints[0].requestsPerSecond).toBeCloseTo(pattern.baseLoad, 0);
    
    // Last point should be close to peak load (allow for random variation)
    const lastPoint = loadPoints[loadPoints.length - 1];
    expect(lastPoint.requestsPerSecond).toBeGreaterThan(pattern.baseLoad);
    expect(lastPoint.requestsPerSecond).toBeLessThan(pattern.peakLoad! * 1.2); // Allow 20% tolerance
  });

  it('should generate spike load pattern', () => {
    const pattern: LoadPattern = {
      type: 'spike',
      baseLoad: 10,
      peakLoad: 50
    };
    
    const duration = 300; // 5 minutes
    const loadPoints = loadGenerator.generateLoadPoints(pattern, duration);
    
    expect(loadPoints).toBeDefined();
    expect(loadPoints.length).toBeGreaterThan(0);
    
    // Should have some points with high load (spikes)
    const maxLoad = Math.max(...loadPoints.map(p => p.requestsPerSecond));
    expect(maxLoad).toBeGreaterThan(pattern.baseLoad * 2);
  });

  it('should generate realistic load pattern', () => {
    const pattern: LoadPattern = {
      type: 'realistic',
      baseLoad: 15
    };
    
    const duration = 3600; // 1 hour
    const loadPoints = loadGenerator.generateLoadPoints(pattern, duration);
    
    expect(loadPoints).toBeDefined();
    expect(loadPoints.length).toBeGreaterThan(0);
    
    // Should have variation in load
    const loads = loadPoints.map(p => p.requestsPerSecond);
    const minLoad = Math.min(...loads);
    const maxLoad = Math.max(...loads);
    expect(maxLoad).toBeGreaterThan(minLoad);
  });

  it('should handle custom pattern', () => {
    const customPattern = [5, 10, 15, 20, 15, 10, 5];
    const pattern: LoadPattern = {
      type: 'realistic',
      baseLoad: 10,
      pattern: customPattern
    };
    
    const duration = 60;
    const loadPoints = loadGenerator.generateLoadPoints(pattern, duration);
    
    expect(loadPoints).toBeDefined();
    expect(loadPoints.length).toBeGreaterThan(0);
    
    // Should follow the general shape of the custom pattern
    const avgLoad = loadPoints.reduce((sum, point) => sum + point.requestsPerSecond, 0) / loadPoints.length;
    const customAvg = customPattern.reduce((sum, val) => sum + val, 0) / customPattern.length;
    expect(avgLoad).toBeCloseTo(customAvg, 1);
  });
});

describe('Failure Management', () => {
  let failureManager: FailureManager;

  beforeEach(() => {
    failureManager = FailureManagerFactory.createManager();
  });

  it('should initialize component failure state', () => {
    const componentId = 'test-component';
    const componentType = 'web-server';
    
    failureManager.initializeComponent(componentId, componentType);
    
    const state = failureManager.getComponentState(componentId);
    expect(state).toBeDefined();
    expect(state!.componentId).toBe(componentId);
    expect(state!.isHealthy).toBe(true);
    expect(state!.currentFailures).toHaveLength(0);
  });

  it('should inject failure scenario', () => {
    const componentId = 'test-component';
    failureManager.initializeComponent(componentId, 'database');
    
    const scenario: FailureScenario = {
      componentId,
      failureType: 'performance',
      startTime: 1000,
      duration: 30000,
      severity: 0.7
    };
    
    const activeFailure = failureManager.injectFailure(scenario, 1000);
    
    expect(activeFailure).toBeDefined();
    expect(activeFailure!.type).toBe('performance');
    expect(activeFailure!.severity).toBe(0.7);
    
    const state = failureManager.getComponentState(componentId);
    expect(state!.isHealthy).toBe(false);
    expect(state!.currentFailures).toHaveLength(1);
  });

  it('should calculate failure impact on performance', () => {
    const componentId = 'test-component';
    failureManager.initializeComponent(componentId, 'web-server');
    
    // Initially healthy - no impact
    let impact = failureManager.getFailureImpact(componentId);
    expect(impact.performanceMultiplier).toBe(1.0);
    expect(impact.errorRateMultiplier).toBe(1.0);
    expect(impact.availabilityMultiplier).toBe(1.0);
    
    // Inject performance failure
    const scenario: FailureScenario = {
      componentId,
      failureType: 'performance',
      startTime: 1000,
      duration: 30000,
      severity: 0.5
    };
    
    failureManager.injectFailure(scenario, 1000);
    
    // Should have performance impact
    impact = failureManager.getFailureImpact(componentId);
    expect(impact.performanceMultiplier).toBeLessThan(1.0);
  });

  it('should process recovery', () => {
    const componentId = 'test-component';
    failureManager.initializeComponent(componentId, 'cache');
    
    const scenario: FailureScenario = {
      componentId,
      failureType: 'network',
      startTime: 1000,
      duration: 5000, // 5 seconds
      severity: 0.8
    };
    
    // Inject failure
    failureManager.injectFailure(scenario, 1000);
    expect(failureManager.getComponentState(componentId)!.isHealthy).toBe(false);
    
    // Process recovery after failure duration + recovery time
    // Network failure has 5 second recovery time, so check after failure end + recovery
    const failureEndTime = scenario.startTime + scenario.duration; // 6000
    const recoveryTime = failureEndTime + 6000; // Add extra time for recovery
    const hasRecovered = failureManager.processRecovery(componentId, recoveryTime);
    
    expect(hasRecovered).toBe(true);
    expect(failureManager.getComponentState(componentId)!.isHealthy).toBe(true);
  });

  it('should generate failure statistics', () => {
    const componentId = 'test-component';
    failureManager.initializeComponent(componentId, 'load-balancer');
    
    const stats = failureManager.getFailureStatistics(componentId);
    
    expect(stats).toBeDefined();
    expect(stats.totalFailures).toBe(0);
    expect(stats.reliability).toBeGreaterThan(0);
    expect(stats.availability).toBeGreaterThan(0);
  });

  it('should handle multiple concurrent failures', () => {
    const componentId = 'test-component';
    failureManager.initializeComponent(componentId, 'database');
    
    // Inject multiple failures
    const scenario1: FailureScenario = {
      componentId,
      failureType: 'performance',
      startTime: 1000,
      duration: 30000,
      severity: 0.3
    };
    
    const scenario2: FailureScenario = {
      componentId,
      failureType: 'network',
      startTime: 2000,
      duration: 20000,
      severity: 0.5
    };
    
    failureManager.injectFailure(scenario1, 1000);
    failureManager.injectFailure(scenario2, 2000);
    
    const state = failureManager.getComponentState(componentId);
    expect(state!.currentFailures).toHaveLength(2);
    
    // Impact should be cumulative
    const impact = failureManager.getFailureImpact(componentId);
    expect(impact.performanceMultiplier).toBeLessThan(0.8); // Significant impact from both failures
  });
});