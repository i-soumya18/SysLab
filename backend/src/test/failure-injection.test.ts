/**
 * Failure Injection Tests
 * Tests for SRS FR-6 implementation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FailureManager } from '../simulation/FailureManager';
import { LatencyInjectionEngine } from '../simulation/LatencyInjectionEngine';
import { NetworkPartitionEngine } from '../simulation/NetworkPartitionEngine';
import { RegionalOutageEngine } from '../simulation/RegionalOutageEngine';
import { RecoveryBehaviorMonitor } from '../simulation/RecoveryBehaviorMonitor';
import { EventScheduler } from '../simulation/types';

// Mock event scheduler
class MockEventScheduler implements EventScheduler {
  private events: any[] = [];
  private currentTime = Date.now();

  scheduleEvent(event: any): void {
    this.events.push(event);
  }

  getNextEvent(): any {
    return this.events.shift() || null;
  }

  hasEvents(): boolean {
    return this.events.length > 0;
  }

  clear(): void {
    this.events = [];
  }

  getCurrentTime(): number {
    return this.currentTime;
  }

  setCurrentTime(time: number): void {
    this.currentTime = time;
  }
}

describe('Failure Injection System (SRS FR-6)', () => {
  let failureManager: FailureManager;
  let eventScheduler: MockEventScheduler;
  let latencyEngine: LatencyInjectionEngine;
  let partitionEngine: NetworkPartitionEngine;
  let outageEngine: RegionalOutageEngine;
  let recoveryMonitor: RecoveryBehaviorMonitor;

  beforeEach(() => {
    failureManager = new FailureManager();
    eventScheduler = new MockEventScheduler();
    latencyEngine = new LatencyInjectionEngine(eventScheduler);
    partitionEngine = new NetworkPartitionEngine(eventScheduler);
    outageEngine = new RegionalOutageEngine(eventScheduler, failureManager);
    recoveryMonitor = new RecoveryBehaviorMonitor(eventScheduler);
  });

  afterEach(() => {
    failureManager = null as any;
    eventScheduler = null as any;
    latencyEngine = null as any;
    partitionEngine = null as any;
    outageEngine = null as any;
    recoveryMonitor = null as any;
  });

  describe('SRS FR-6.1: Component Failure Injection', () => {
    it('should initialize component for failure injection', () => {
      const componentId = 'test-component';
      const componentType = 'database';

      failureManager.initializeComponent(componentId, componentType);
      const state = failureManager.getComponentState(componentId);

      expect(state).toBeDefined();
      expect(state?.componentId).toBe(componentId);
      expect(state?.isHealthy).toBe(true);
      expect(state?.currentFailures).toHaveLength(0);
    });

    it('should inject component failure with correct severity', () => {
      const componentId = 'test-component';
      const componentType = 'database';
      
      failureManager.initializeComponent(componentId, componentType);
      
      const failureScenario = {
        componentId,
        failureType: 'crash',
        startTime: Date.now(),
        duration: 30000,
        severity: 0.8
      };

      const activeFailure = failureManager.injectFailure(failureScenario, Date.now());

      expect(activeFailure).toBeDefined();
      expect(activeFailure?.severity).toBe(0.8);
      expect(activeFailure?.type).toBe('crash');

      const state = failureManager.getComponentState(componentId);
      expect(state?.isHealthy).toBe(false);
      expect(state?.currentFailures).toHaveLength(1);
    });

    it('should calculate failure impact on component performance', () => {
      const componentId = 'test-component';
      failureManager.initializeComponent(componentId, 'database');
      
      const failureScenario = {
        componentId,
        failureType: 'performance',
        startTime: Date.now(),
        duration: 30000,
        severity: 0.5
      };

      failureManager.injectFailure(failureScenario, Date.now());
      const impact = failureManager.getFailureImpact(componentId);

      expect(impact.performanceMultiplier).toBeLessThan(1.0);
      expect(impact.errorRateMultiplier).toBeGreaterThanOrEqual(1.0);
    });
  });

  describe('SRS FR-6.2: Latency Injection', () => {
    it('should initialize connection for latency injection', () => {
      const connectionId = 'test-connection';
      const baseLatency = 10; // 10ms

      latencyEngine.initializeConnection(connectionId, baseLatency);
      const state = latencyEngine.getConnectionState(connectionId);

      expect(state).toBeDefined();
      expect(state?.connectionId).toBe(connectionId);
      expect(state?.baseLatency).toBe(baseLatency);
      expect(state?.currentAdditionalLatency).toBe(0);
    });

    it('should inject constant latency', () => {
      const connectionId = 'test-connection';
      latencyEngine.initializeConnection(connectionId, 10);

      const config = {
        type: 'constant' as const,
        baseLatencyIncrease: 50, // 50ms additional
        duration: 30000,
        affectedConnections: [connectionId],
        parameters: {}
      };

      const injectionId = latencyEngine.injectLatency(connectionId, config);
      expect(injectionId).toBeDefined();

      const activeInjections = latencyEngine.getActiveInjections(connectionId);
      expect(activeInjections).toHaveLength(1);
      expect(activeInjections[0].config.baseLatencyIncrease).toBe(50);
    });

    it('should inject latency spikes', () => {
      const connectionId = 'test-connection';
      latencyEngine.initializeConnection(connectionId, 10);

      const spikeConfig = {
        intensity: 5, // 5x multiplier
        duration: 1000, // 1 second
        count: 3
      };

      const spikeIds = latencyEngine.injectLatencySpike(connectionId, spikeConfig);
      expect(spikeIds).toHaveLength(3);
    });

    it('should inject network jitter', () => {
      const connectionId = 'test-connection';
      latencyEngine.initializeConnection(connectionId, 10);

      const jitterConfig = {
        range: 20, // ±20ms
        distribution: 'uniform' as const,
        duration: 30000
      };

      const injectionId = latencyEngine.injectJitter(connectionId, jitterConfig);
      expect(injectionId).toBeDefined();

      const state = latencyEngine.getConnectionState(connectionId);
      expect(state?.jitterState.range).toBe(20);
      expect(state?.jitterState.distribution).toBe('uniform');
    });

    it('should inject packet loss', () => {
      const connectionId = 'test-connection';
      latencyEngine.initializeConnection(connectionId, 10);

      const packetLossConfig = {
        lossRate: 0.1, // 10% packet loss
        retransmissionDelay: 1000,
        maxRetransmissions: 3,
        duration: 30000
      };

      const injectionId = latencyEngine.injectPacketLoss(connectionId, packetLossConfig);
      expect(injectionId).toBeDefined();

      const state = latencyEngine.getConnectionState(connectionId);
      expect(state?.packetLossRate).toBe(0.1);
    });
  });

  describe('SRS FR-6.3: Network Partition Simulation', () => {
    it('should initialize connection for partition simulation', () => {
      const connectionId = 'test-connection';
      const sourceComponent = 'component-a';
      const targetComponent = 'component-b';

      partitionEngine.initializeConnection(connectionId, sourceComponent, targetComponent);
      const state = partitionEngine.getConnectionState(connectionId);

      expect(state).toBeDefined();
      expect(state?.connectionId).toBe(connectionId);
      expect(state?.sourceComponentId).toBe(sourceComponent);
      expect(state?.targetComponentId).toBe(targetComponent);
      expect(state?.isPartitioned).toBe(false);
    });

    it('should create network partition', () => {
      const config = {
        type: 'complete' as const,
        partitionGroups: [
          ['component-a', 'component-b'],
          ['component-c', 'component-d']
        ],
        duration: 60000,
        recoveryType: 'automatic' as const
      };

      const partitionId = partitionEngine.createNetworkPartition(config);
      expect(partitionId).toBeDefined();

      const partition = partitionEngine.getPartitionStatus(partitionId);
      expect(partition).toBeDefined();
      expect(partition?.type).toBe('complete');
      expect(partition?.partitionGroups).toHaveLength(2);
    });

    it('should create split-brain scenario', () => {
      const components = ['leader-1', 'leader-2', 'follower-1', 'follower-2'];
      const splitBrainConfig = {
        leaderElectionEnabled: true,
        consensusAlgorithm: 'raft' as const,
        quorumSize: 2,
        partitionTolerance: 1,
        conflictResolution: 'last_write_wins' as const
      };

      const partitionId = partitionEngine.createSplitBrainScenario(components, splitBrainConfig);
      expect(partitionId).toBeDefined();

      const partition = partitionEngine.getPartitionStatus(partitionId);
      expect(partition?.type).toBe('split_brain');
      expect(partition?.splitBrainState).toBeDefined();
    });

    it('should check communication during partition', () => {
      // Initialize connections
      partitionEngine.initializeConnection('conn-1', 'comp-a', 'comp-c');
      
      const config = {
        type: 'complete' as const,
        partitionGroups: [['comp-a'], ['comp-c']],
        duration: 60000,
        recoveryType: 'automatic' as const
      };

      partitionEngine.createNetworkPartition(config);

      // Components in different groups should not be able to communicate
      const canCommunicate = partitionEngine.canCommunicate('comp-a', 'comp-c');
      expect(canCommunicate).toBe(false);
    });
  });

  describe('SRS FR-6.4: Regional Outage Simulation', () => {
    it('should initialize component location', () => {
      const componentId = 'test-component';
      const location = {
        componentId,
        coordinate: { latitude: 37.7749, longitude: -122.4194, region: 'us-west' },
        region: 'us-west',
        zone: 'us-west-1a',
        datacenter: 'dc-1',
        availabilityZone: 'az-1'
      };

      outageEngine.initializeComponentLocation(componentId, location);
      // Test passes if no error is thrown
      expect(true).toBe(true);
    });

    it('should simulate regional outage', () => {
      // Initialize component locations
      const components = ['comp-1', 'comp-2', 'comp-3'];
      components.forEach(compId => {
        outageEngine.initializeComponentLocation(compId, {
          componentId: compId,
          coordinate: { latitude: 37.7749, longitude: -122.4194, region: 'us-west' },
          region: 'us-west',
          zone: 'us-west-1a',
          datacenter: 'dc-1',
          availabilityZone: 'az-1'
        });
      });

      const config = {
        region: 'us-west',
        outageType: 'power_outage' as const,
        failurePattern: 'simultaneous' as const,
        duration: 300000, // 5 minutes
        severity: 1.0,
        affectedComponents: components
      };

      const outageId = outageEngine.simulateRegionalOutage(config);
      expect(outageId).toBeDefined();

      const outage = outageEngine.getRegionalOutageStatus(outageId);
      expect(outage).toBeDefined();
      expect(outage?.region).toBe('us-west');
      expect(outage?.outageType).toBe('power_outage');
    });

    it('should simulate natural disaster', () => {
      const disasterConfig = {
        type: 'earthquake' as const,
        epicenter: { latitude: 37.7749, longitude: -122.4194, region: 'us-west' },
        magnitude: 7.0,
        radius: 100, // 100km
        duration: 600000 // 10 minutes
      };

      const outageId = outageEngine.simulateNaturalDisaster(disasterConfig);
      expect(outageId).toBeDefined();
    });

    it('should simulate datacenter outage', () => {
      const datacenterConfig = {
        datacenterId: 'dc-1',
        outageType: 'infrastructure' as const,
        duration: 300000,
        cascadeToOtherDatacenters: false
      };

      const outageId = outageEngine.simulateDatacenterOutage(datacenterConfig);
      expect(outageId).toBeDefined();
    });
  });

  describe('SRS FR-6.5: Recovery Behavior Monitoring', () => {
    it('should start recovery monitoring', () => {
      const componentId = 'test-component';
      const config = {
        componentId,
        monitoringInterval: 1000,
        recoveryTimeout: 60000,
        expectedRecoveryTime: 30000,
        recoveryThresholds: [
          {
            metric: 'latency' as const,
            threshold: 100,
            direction: 'below' as const,
            sustainedDuration: 5000
          }
        ],
        enablePredictiveAnalysis: true,
        enablePatternDetection: true
      };

      const monitoringId = recoveryMonitor.startRecoveryMonitoring(componentId, config);
      expect(monitoringId).toBeDefined();

      const activeMonitoring = recoveryMonitor.getActiveRecoveryMonitoring();
      expect(activeMonitoring).toHaveLength(1);
      expect(activeMonitoring[0].componentId).toBe(componentId);
    });

    it('should record recovery observation', () => {
      const componentId = 'test-component';
      const config = {
        componentId,
        monitoringInterval: 1000,
        recoveryTimeout: 60000,
        expectedRecoveryTime: 30000,
        recoveryThresholds: [
          {
            metric: 'availability' as const,
            threshold: 0.95,
            direction: 'above' as const,
            sustainedDuration: 5000
          }
        ],
        enablePredictiveAnalysis: true,
        enablePatternDetection: true
      };

      recoveryMonitor.startRecoveryMonitoring(componentId, config);

      const metrics = {
        latency: 50,
        throughput: 1000,
        errorRate: 0.01,
        availability: 0.99,
        resourceUtilization: {
          cpu: 0.5,
          memory: 0.6,
          network: 0.3,
          storage: 0.4
        },
        connectionCount: 100,
        queueDepth: 5
      };

      recoveryMonitor.recordRecoveryObservation(componentId, metrics, 'restart');
      
      // Test passes if no error is thrown
      expect(true).toBe(true);
    });

    it('should analyze recovery patterns', () => {
      const patterns = recoveryMonitor.analyzeRecoveryPatterns();
      expect(Array.isArray(patterns)).toBe(true);
    });

    it('should get recovery time analysis', () => {
      const componentId = 'test-component';
      const analysis = recoveryMonitor.getRecoveryTimeAnalysis(componentId);
      
      expect(analysis).toBeDefined();
      expect(analysis.componentId).toBe(componentId);
      expect(typeof analysis.totalRecoveries).toBe('number');
      expect(typeof analysis.averageRecoveryTime).toBe('number');
    });

    it('should predict recovery time', () => {
      const componentId = 'test-component';
      const prediction = recoveryMonitor.predictRecoveryTime(componentId, 'crash', 'restart');
      
      expect(prediction).toBeDefined();
      expect(typeof prediction.predictedTime).toBe('number');
      expect(typeof prediction.confidence).toBe('number');
      expect(Array.isArray(prediction.factors)).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should handle multiple concurrent failure injections', () => {
      const componentId = 'test-component';
      failureManager.initializeComponent(componentId, 'database');

      // Inject multiple failures
      const failures = [
        {
          componentId,
          failureType: 'performance',
          startTime: Date.now(),
          duration: 30000,
          severity: 0.3
        },
        {
          componentId,
          failureType: 'network',
          startTime: Date.now() + 5000,
          duration: 20000,
          severity: 0.5
        }
      ];

      failures.forEach(failure => {
        failureManager.injectFailure(failure, failure.startTime);
      });

      const state = failureManager.getComponentState(componentId);
      expect(state?.currentFailures.length).toBeGreaterThan(0);
    });

    it('should coordinate failure injection with recovery monitoring', () => {
      const componentId = 'test-component';
      
      // Start recovery monitoring
      const monitoringConfig = {
        componentId,
        monitoringInterval: 1000,
        recoveryTimeout: 60000,
        expectedRecoveryTime: 30000,
        recoveryThresholds: [],
        enablePredictiveAnalysis: false,
        enablePatternDetection: false
      };

      const monitoringId = recoveryMonitor.startRecoveryMonitoring(componentId, monitoringConfig);
      
      // Initialize and inject failure
      failureManager.initializeComponent(componentId, 'database');
      const failureScenario = {
        componentId,
        failureType: 'crash',
        startTime: Date.now(),
        duration: 10000,
        severity: 1.0
      };

      failureManager.injectFailure(failureScenario, Date.now());

      expect(monitoringId).toBeDefined();
      const activeMonitoring = recoveryMonitor.getActiveRecoveryMonitoring();
      expect(activeMonitoring).toHaveLength(1);
    });
  });
});