/**
 * Distributed Systems Behavior Library (DSBL) Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DistributedSystemsBehaviorLibrary, ConsensusAlgorithms } from '../simulation';

describe('Distributed Systems Behavior Library', () => {
  let dsbl: DistributedSystemsBehaviorLibrary;

  beforeEach(() => {
    dsbl = new DistributedSystemsBehaviorLibrary();
  });

  afterEach(() => {
    dsbl.stop();
  });

  describe('Consistency Level Configuration', () => {
    it('should configure strong consistency with appropriate performance characteristics', () => {
      const nodeIds = ['node1', 'node2', 'node3'];
      dsbl.initialize(nodeIds);
      
      const replicationConfig = {
        replicationFactor: 3,
        replicationStrategy: 'sync' as const,
        consistencyLevel: 'strong' as const,
        quorumSize: 2
      };

      dsbl.configureConsistencyLevel('node1', 'strong', replicationConfig);

      const consistencyModel = dsbl.getConsistencyModel('strong');
      expect(consistencyModel).toBeDefined();
      expect(consistencyModel!.level).toBe('strong');
      expect(consistencyModel!.readLatency).toBeGreaterThan(0);
      expect(consistencyModel!.writeLatency).toBeGreaterThan(consistencyModel!.readLatency);
      expect(consistencyModel!.availabilityScore).toBeLessThan(1);
    });

    it('should configure eventual consistency with better availability', () => {
      const nodeIds = ['node1', 'node2', 'node3'];
      dsbl.initialize(nodeIds);
      
      const replicationConfig = {
        replicationFactor: 3,
        replicationStrategy: 'async' as const,
        consistencyLevel: 'eventual' as const,
        quorumSize: 1
      };

      dsbl.configureConsistencyLevel('node1', 'eventual', replicationConfig);

      const consistencyModel = dsbl.getConsistencyModel('eventual');
      expect(consistencyModel).toBeDefined();
      expect(consistencyModel!.level).toBe('eventual');
      expect(consistencyModel!.availabilityScore).toBeGreaterThan(0.9);
      expect(consistencyModel!.readLatency).toBeLessThan(20);
    });
  });

  describe('Replication and Split-Brain Scenarios', () => {
    it('should simulate replication lag', () => {
      const nodeIds = ['node1', 'node2', 'node3'];
      dsbl.initialize(nodeIds);
      
      const replicationConfig = {
        replicationFactor: 3,
        replicationStrategy: 'async' as const,
        consistencyLevel: 'eventual' as const,
        quorumSize: 2
      };

      dsbl.configureConsistencyLevel('node1', 'eventual', replicationConfig);
      dsbl.simulateReplicationLag('node1-replica-1', 2000); // 2 second lag

      const replicationState = dsbl.getReplicationState('node1-replica-1');
      expect(replicationState).toBeDefined();
      expect(replicationState!.replicationLag).toBe(2000);
    });

    it('should trigger split-brain scenario', () => {
      const nodeIds = ['node1', 'node2', 'node3'];
      dsbl.initialize(nodeIds);
      
      const affectedNodes = ['node1', 'node2'];
      const scenarioId = dsbl.triggerSplitBrainScenario(affectedNodes, 5000);

      expect(scenarioId).toBeDefined();
      expect(scenarioId).toMatch(/^split-brain-/);

      const scenarios = dsbl.getActiveSplitBrainScenarios();
      expect(scenarios).toHaveLength(1);
      expect(scenarios[0].affectedNodes).toEqual(affectedNodes);
    });
  });

  describe('Sharding Strategies', () => {
    it('should configure hash-based sharding', () => {
      dsbl.initialize();
      
      const shardingConfig = {
        strategy: 'hash-based' as const,
        shardCount: 4,
        rebalanceThreshold: 0.3,
        hotspotDetectionEnabled: true
      };

      dsbl.configureSharding('component1', shardingConfig);

      const config = dsbl.getShardingConfig('component1');
      expect(config).toBeDefined();
      expect(config!.strategy).toBe('hash-based');
      expect(config!.shardCount).toBe(4);
    });

    it('should detect hotspots in shards', () => {
      dsbl.initialize();
      
      const shardingConfig = {
        strategy: 'hash-based' as const,
        shardCount: 2,
        rebalanceThreshold: 0.2,
        hotspotDetectionEnabled: true
      };

      dsbl.configureSharding('component1', shardingConfig);

      // Simulate many accesses to create hotspot
      for (let i = 0; i < 100; i++) {
        dsbl.recordShardAccess('component1', 'hotkey');
      }

      // Access other keys less frequently
      for (let i = 0; i < 10; i++) {
        dsbl.recordShardAccess('component1', `coldkey${i}`);
      }

      const hotspots = dsbl.getDetectedHotspots();
      expect(hotspots.length).toBeGreaterThan(0);
    });

    it('should configure range-based sharding', () => {
      dsbl.initialize();
      
      const shardingConfig = {
        strategy: 'range-based' as const,
        shardCount: 3,
        rebalanceThreshold: 0.4,
        hotspotDetectionEnabled: false
      };

      dsbl.configureSharding('component2', shardingConfig);

      const shardId = dsbl.recordShardAccess('component2', 'aa-key');
      expect(shardId).toMatch(/^component2-shard-/);
    });
  });

  describe('Network Partition Simulation', () => {
    it('should simulate complete network partition', () => {
      dsbl.initialize();
      
      const affectedNodes = ['node1', 'node2'];
      const partitionId = dsbl.simulateNetworkPartition(affectedNodes, 'complete', 3000);

      expect(partitionId).toBeDefined();
      expect(partitionId).toMatch(/^partition-/);

      const partitions = dsbl.getActiveNetworkPartitions();
      expect(partitions).toHaveLength(1);
      expect(partitions[0].partitionType).toBe('complete');
      expect(partitions[0].affectedNodes).toEqual(affectedNodes);
    });

    it('should calculate consistency and availability impact', () => {
      dsbl.initialize();
      
      const affectedNodes = ['node1', 'node2', 'node3'];
      const partitionId = dsbl.simulateNetworkPartition(affectedNodes, 'partial', 2000);

      const partitions = dsbl.getActiveNetworkPartitions();
      const partition = partitions[0];

      expect(partition.impactOnConsistency.level).toBeDefined();
      expect(partition.impactOnAvailability.level).toBeDefined();
      expect(partition.impactOnAvailability.degradedPerformance).toBeGreaterThanOrEqual(0);
      expect(partition.impactOnAvailability.degradedPerformance).toBeLessThanOrEqual(1);
    });
  });

  describe('Consensus Algorithm Integration', () => {
    it('should configure Raft consensus algorithm', () => {
      const nodeIds = ['node1', 'node2', 'node3'];
      dsbl.initialize(nodeIds);
      
      dsbl.configureConsensusAlgorithm('raft', nodeIds);

      const consensusState = dsbl.getConsensusState();
      expect(consensusState.algorithm).toBe('raft');
      expect(consensusState.nodes).toHaveLength(3);
    });

    it('should trigger leader election', () => {
      const nodeIds = ['node1', 'node2', 'node3'];
      dsbl.initialize(nodeIds);
      
      dsbl.configureConsensusAlgorithm('raft', nodeIds);
      const electionId = dsbl.triggerConsensusLeaderElection();

      expect(electionId).toBeDefined();
      expect(electionId).toMatch(/^election-/);
    });

    it('should simulate node failure and failover', () => {
      const nodeIds = ['node1', 'node2', 'node3'];
      dsbl.initialize(nodeIds);
      
      dsbl.configureConsensusAlgorithm('raft', nodeIds);
      const failoverId = dsbl.simulateConsensusNodeFailure('node1', 'crash');

      expect(failoverId).toBeDefined();
      expect(failoverId).toMatch(/^failover-/);

      const consensusState = dsbl.getConsensusState();
      const failedNode = consensusState.nodes.find(n => n.id === 'node1');
      expect(failedNode?.isHealthy).toBe(false);
    });

    it('should simulate Byzantine fault', () => {
      const nodeIds = ['node1', 'node2', 'node3', 'node4'];
      dsbl.initialize(nodeIds);
      
      dsbl.configureConsensusAlgorithm('pbft', nodeIds);
      const scenarioId = dsbl.simulateConsensusByzantineFault(['node1'], 'arbitrary', 2000);

      expect(scenarioId).toBeDefined();
      expect(scenarioId).toMatch(/^byzantine-/);

      const consensusState = dsbl.getConsensusState();
      const byzantineNode = consensusState.nodes.find(n => n.id === 'node1');
      expect(byzantineNode?.isByzantine).toBe(true);
    });
  });

  describe('DSBL Lifecycle', () => {
    it('should start and stop properly', () => {
      const nodeIds = ['node1', 'node2'];
      dsbl.initialize(nodeIds);
      
      expect(() => dsbl.start()).not.toThrow();
      expect(() => dsbl.stop()).not.toThrow();
    });

    it('should clear all state', () => {
      const nodeIds = ['node1', 'node2'];
      dsbl.initialize(nodeIds);
      
      dsbl.configureConsistencyLevel('node1', 'strong', {
        replicationFactor: 2,
        replicationStrategy: 'sync',
        consistencyLevel: 'strong',
        quorumSize: 1
      });

      dsbl.clear();

      expect(dsbl.getReplicationState('node1')).toBeUndefined();
      expect(dsbl.getActiveSplitBrainScenarios()).toHaveLength(0);
      expect(dsbl.getActiveNetworkPartitions()).toHaveLength(0);
    });
  });
});

describe('Consensus Algorithms', () => {
  let consensus: ConsensusAlgorithms;

  beforeEach(() => {
    consensus = new ConsensusAlgorithms('raft');
  });

  afterEach(() => {
    consensus.stop();
  });

  describe('Raft Consensus', () => {
    it('should initialize with Raft algorithm', () => {
      const nodeIds = ['node1', 'node2', 'node3'];
      consensus.initialize(nodeIds);

      const state = consensus.getConsensusState();
      expect(state.algorithm).toBe('raft');
      expect(state.nodes).toHaveLength(3);
      expect(state.nodes.every(n => n.state === 'follower')).toBe(true);
    });

    it('should trigger leader election', () => {
      const nodeIds = ['node1', 'node2', 'node3'];
      consensus.initialize(nodeIds);
      consensus.start();

      const electionId = consensus.triggerLeaderElection();
      expect(electionId).toBeDefined();
      expect(electionId).toMatch(/^election-/);
    });

    it('should handle node failure', () => {
      const nodeIds = ['node1', 'node2', 'node3'];
      consensus.initialize(nodeIds);

      const failoverId = consensus.simulateNodeFailure('node1');
      expect(failoverId).toBeDefined();

      const node = consensus.getNode('node1');
      expect(node?.isHealthy).toBe(false);
    });

    it('should recover failed node', () => {
      const nodeIds = ['node1', 'node2', 'node3'];
      consensus.initialize(nodeIds);

      consensus.simulateNodeFailure('node1');
      const recovered = consensus.recoverNode('node1');

      expect(recovered).toBe(true);
      const node = consensus.getNode('node1');
      expect(node?.isHealthy).toBe(true);
    });
  });

  describe('PBFT Consensus', () => {
    it('should initialize with PBFT algorithm', () => {
      const pbftConsensus = new ConsensusAlgorithms('pbft');
      const nodeIds = ['node1', 'node2', 'node3', 'node4'];
      pbftConsensus.initialize(nodeIds);

      const state = pbftConsensus.getConsensusState();
      expect(state.algorithm).toBe('pbft');
      expect(state.nodes).toHaveLength(4);

      pbftConsensus.stop();
    });

    it('should handle Byzantine faults', () => {
      const pbftConsensus = new ConsensusAlgorithms('pbft');
      const nodeIds = ['node1', 'node2', 'node3', 'node4'];
      pbftConsensus.initialize(nodeIds);

      const scenarioId = pbftConsensus.simulateByzantineFault(['node1'], 'arbitrary', 1000);
      expect(scenarioId).toBeDefined();

      const state = pbftConsensus.getConsensusState();
      const byzantineNode = state.nodes.find(n => n.id === 'node1');
      expect(byzantineNode?.isByzantine).toBe(true);

      pbftConsensus.stop();
    });

    it('should validate minimum node count for PBFT', () => {
      const pbftConsensus = new ConsensusAlgorithms('pbft');
      const nodeIds = ['node1', 'node2']; // Too few nodes for PBFT

      expect(() => pbftConsensus.initialize(nodeIds)).toThrow();
      pbftConsensus.stop();
    });
  });
});