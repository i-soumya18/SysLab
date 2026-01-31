/**
 * Traffic Pattern Generation Tests
 * 
 * Tests for enhanced traffic pattern generation functionality in Load Simulation Engine
 * Requirement 7.5: Add burst traffic patterns and gradual ramp-up scenarios
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LoadSimulationEngine } from '../simulation/LoadSimulationEngine';
import { SystemGraphEngine } from '../simulation/SystemGraphEngine';
import { PriorityQueueEventScheduler } from '../simulation/EventScheduler';
import { 
  TrafficBurst, 
  GradualRampUp, 
  RealisticUserBehavior, 
  GeographicDistribution,
  TrafficPattern,
  LoadPattern,
  Component
} from '../types';

describe('Traffic Pattern Generation', () => {
  let loadEngine: LoadSimulationEngine;
  let systemGraph: SystemGraphEngine;
  let eventScheduler: PriorityQueueEventScheduler;

  beforeEach(() => {
    systemGraph = new SystemGraphEngine();
    eventScheduler = new PriorityQueueEventScheduler();
    loadEngine = new LoadSimulationEngine(systemGraph, eventScheduler);

    // Add a simple component for testing
    const testComponent: Component = {
      id: 'test-component',
      type: 'web-server', // Using legacy type that maps to Service
      position: { x: 0, y: 0 },
      configuration: { capacity: 100, latency: 50, failureRate: 0.01 },
      metadata: { name: 'Test Component', version: '1.0' }
    };
    
    systemGraph.addNode(testComponent);
  });

  describe('Burst Traffic Patterns', () => {
    it('should handle spike pattern burst traffic', () => {
      const burst: TrafficBurst = {
        startTime: 1000,
        duration: 5000,
        multiplier: 3.0,
        pattern: 'spike'
      };

      loadEngine.addEnhancedTrafficBurst(burst);
      
      // Verify events were scheduled
      expect(eventScheduler.hasEvents()).toBe(true);
    });

    it('should handle plateau pattern burst traffic', () => {
      const burst: TrafficBurst = {
        startTime: 1000,
        duration: 10000,
        multiplier: 2.5,
        pattern: 'plateau'
      };

      loadEngine.addEnhancedTrafficBurst(burst);
      
      // Should schedule multiple events for gradual rise and fall
      expect(eventScheduler.hasEvents()).toBe(true);
    });

    it('should handle wave pattern burst traffic', () => {
      const burst: TrafficBurst = {
        startTime: 1000,
        duration: 8000,
        multiplier: 2.0,
        pattern: 'wave'
      };

      loadEngine.addEnhancedTrafficBurst(burst);
      
      // Should schedule multiple events for wave pattern
      expect(eventScheduler.hasEvents()).toBe(true);
    });
  });

  describe('Gradual Ramp-Up Scenarios', () => {
    it('should handle linear ramp-up', () => {
      const rampUp: GradualRampUp = {
        startTime: 1000,
        duration: 10000,
        startMultiplier: 1.0,
        endMultiplier: 5.0,
        curve: 'linear'
      };

      loadEngine.addGradualRampUp(rampUp);
      
      // Should schedule multiple ramp steps
      expect(eventScheduler.hasEvents()).toBe(true);
    });

    it('should handle exponential ramp-up', () => {
      const rampUp: GradualRampUp = {
        startTime: 2000,
        duration: 15000,
        startMultiplier: 0.5,
        endMultiplier: 4.0,
        curve: 'exponential'
      };

      loadEngine.addGradualRampUp(rampUp);
      
      expect(eventScheduler.hasEvents()).toBe(true);
    });

    it('should handle logarithmic ramp-up', () => {
      const rampUp: GradualRampUp = {
        startTime: 3000,
        duration: 12000,
        startMultiplier: 1.0,
        endMultiplier: 3.0,
        curve: 'logarithmic'
      };

      loadEngine.addGradualRampUp(rampUp);
      
      expect(eventScheduler.hasEvents()).toBe(true);
    });
  });

  describe('Realistic User Behavior Modeling', () => {
    it('should set realistic user behavior with daily patterns', () => {
      const behavior: RealisticUserBehavior = {
        dailyPattern: Array.from({ length: 24 }, (_, i) => 
          0.5 + 0.5 * Math.sin((i - 6) * Math.PI / 12) // Peak at noon, low at midnight
        ),
        weeklyPattern: [0.8, 1.0, 1.0, 1.0, 1.0, 1.2, 0.9], // Weekend patterns
        seasonalEvents: [
          {
            name: 'Black Friday',
            startDate: new Date('2024-11-29'),
            endDate: new Date('2024-11-30'),
            trafficMultiplier: 5.0,
            pattern: 'sudden'
          }
        ],
        userSessionDuration: 1800, // 30 minutes
        concurrentSessionRatio: 0.3,
        retryBehavior: {
          maxRetries: 3,
          backoffMultiplier: 2.0,
          retryProbability: 0.7
        }
      };

      loadEngine.setRealisticUserBehavior(behavior);
      
      // Should schedule daily and weekly pattern events
      expect(eventScheduler.hasEvents()).toBe(true);
    });

    it('should handle seasonal events', () => {
      const behavior: RealisticUserBehavior = {
        dailyPattern: Array(24).fill(1.0),
        weeklyPattern: Array(7).fill(1.0),
        seasonalEvents: [
          {
            name: 'Holiday Sale',
            startDate: new Date(Date.now() + 86400000), // Tomorrow
            endDate: new Date(Date.now() + 172800000), // Day after tomorrow
            trafficMultiplier: 3.0,
            pattern: 'gradual'
          }
        ],
        userSessionDuration: 900,
        concurrentSessionRatio: 0.25,
        retryBehavior: {
          maxRetries: 2,
          backoffMultiplier: 1.5,
          retryProbability: 0.6
        }
      };

      loadEngine.setRealisticUserBehavior(behavior);
      
      expect(eventScheduler.hasEvents()).toBe(true);
    });
  });

  describe('Geographic Distribution Simulation', () => {
    it('should set geographic distribution with multiple regions', () => {
      const distribution: GeographicDistribution = {
        regions: [
          {
            id: 'us-east',
            name: 'US East',
            userPercentage: 40,
            peakHours: [9, 10, 11, 14, 15, 16],
            baseLatency: 50,
            networkQuality: 'excellent'
          },
          {
            id: 'eu-west',
            name: 'EU West',
            userPercentage: 35,
            peakHours: [8, 9, 10, 13, 14, 15],
            baseLatency: 80,
            networkQuality: 'good'
          },
          {
            id: 'asia-pacific',
            name: 'Asia Pacific',
            userPercentage: 25,
            peakHours: [7, 8, 9, 12, 13, 14],
            baseLatency: 120,
            networkQuality: 'fair'
          }
        ],
        timeZoneOffsets: [-5, 1, 8], // EST, CET, JST
        latencyMatrix: [
          [0, 100, 200],    // US East to others
          [100, 0, 150],    // EU West to others
          [200, 150, 0]     // Asia Pacific to others
        ],
        loadBalancing: 'geographic'
      };

      loadEngine.setGeographicDistribution(distribution);
      
      // Should redistribute load and schedule regional events
      expect(eventScheduler.hasEvents()).toBe(true);
    });

    it('should handle different network qualities', () => {
      const distribution: GeographicDistribution = {
        regions: [
          {
            id: 'region-excellent',
            name: 'Excellent Network',
            userPercentage: 30,
            peakHours: [12],
            baseLatency: 20,
            networkQuality: 'excellent'
          },
          {
            id: 'region-poor',
            name: 'Poor Network',
            userPercentage: 20,
            peakHours: [12],
            baseLatency: 200,
            networkQuality: 'poor'
          }
        ],
        timeZoneOffsets: [0, 0],
        latencyMatrix: [[0, 300], [300, 0]],
        loadBalancing: 'latency-based'
      };

      loadEngine.setGeographicDistribution(distribution);
      
      expect(eventScheduler.hasEvents()).toBe(true);
    });
  });

  describe('Traffic Pattern Management', () => {
    it('should add and manage multiple traffic patterns', () => {
      const burstPattern: TrafficPattern = {
        id: 'burst-1',
        name: 'Morning Rush',
        type: 'burst',
        configuration: {
          startTime: 1000,
          duration: 3600000, // 1 hour
          multiplier: 2.5,
          pattern: 'plateau'
        } as TrafficBurst,
        isActive: true,
        priority: 1
      };

      const rampPattern: TrafficPattern = {
        id: 'ramp-1',
        name: 'Gradual Growth',
        type: 'ramp',
        configuration: {
          startTime: 5000,
          duration: 7200000, // 2 hours
          startMultiplier: 1.0,
          endMultiplier: 3.0,
          curve: 'exponential'
        } as GradualRampUp,
        isActive: true,
        priority: 2
      };

      loadEngine.addTrafficPattern(burstPattern);
      loadEngine.addTrafficPattern(rampPattern);

      const activePatterns = loadEngine.getActiveTrafficPatterns();
      expect(activePatterns).toHaveLength(2);
      expect(activePatterns.find(p => p.id === 'burst-1')).toBeDefined();
      expect(activePatterns.find(p => p.id === 'ramp-1')).toBeDefined();
    });

    it('should remove traffic patterns', () => {
      const pattern: TrafficPattern = {
        id: 'test-pattern',
        name: 'Test Pattern',
        type: 'burst',
        configuration: {
          startTime: 1000,
          duration: 5000,
          multiplier: 2.0
        } as TrafficBurst,
        isActive: true,
        priority: 1
      };

      loadEngine.addTrafficPattern(pattern);
      expect(loadEngine.getActiveTrafficPatterns()).toHaveLength(1);

      loadEngine.removeTrafficPattern('test-pattern');
      expect(loadEngine.getActiveTrafficPatterns()).toHaveLength(0);
    });
  });

  describe('Load Simulation Integration', () => {
    it('should initialize load simulation and apply traffic patterns', () => {
      const loadPattern: LoadPattern = {
        type: 'constant',
        baseLoad: 100
      };

      loadEngine.initializeLoadSimulation(loadPattern, 1000);

      // Add a burst pattern
      const burst: TrafficBurst = {
        startTime: 2000,
        duration: 5000,
        multiplier: 3.0,
        pattern: 'spike'
      };

      loadEngine.addEnhancedTrafficBurst(burst);

      // Simulate some steps
      const result1 = loadEngine.step(1000);
      expect(result1.timestamp).toBe(1000);

      const result2 = loadEngine.step(1500); // Should trigger burst
      expect(result2.timestamp).toBe(2500);
    });

    it('should reset all traffic patterns on reset', () => {
      const pattern: TrafficPattern = {
        id: 'reset-test',
        name: 'Reset Test',
        type: 'burst',
        configuration: {
          startTime: 1000,
          duration: 5000,
          multiplier: 2.0
        } as TrafficBurst,
        isActive: true,
        priority: 1
      };

      loadEngine.addTrafficPattern(pattern);
      expect(loadEngine.getActiveTrafficPatterns()).toHaveLength(1);

      loadEngine.reset();
      expect(loadEngine.getActiveTrafficPatterns()).toHaveLength(0);
    });
  });
});