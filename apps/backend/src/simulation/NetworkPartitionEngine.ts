/**
 * Network Partition Engine implementing SRS FR-6.3
 * 
 * Implements network partition scenarios per SRS FR-6.3
 * Creates split-brain condition modeling per SRS FR-6.3
 * Adds partition recovery simulation per SRS FR-6.3
 */

import { EventEmitter } from 'events';
import { SimulationEvent, EventScheduler } from './types';

// Network partition types
export type PartitionType = 
  | 'complete'      // Complete network isolation
  | 'partial'       // Partial connectivity loss
  | 'asymmetric'    // One-way communication failure
  | 'intermittent'  // Intermittent connectivity issues
  | 'cascading'     // Cascading partition failures
  | 'split_brain';  // Split-brain scenario

// Partition configuration
export interface NetworkPartitionConfig {
  type: PartitionType;
  partitionGroups: string[][]; // Groups of components that can communicate
  duration: number; // milliseconds
  recoveryType: 'automatic' | 'manual' | 'gradual';
  recoveryDuration?: number; // milliseconds for gradual recovery
  asymmetricConfig?: AsymmetricPartitionConfig;
  intermittentConfig?: IntermittentPartitionConfig;
  splitBrainConfig?: SplitBrainConfig;
}

// Asymmetric partition configuration
export interface AsymmetricPartitionConfig {
  sourceGroups: string[]; // Groups that can send but not receive
  targetGroups: string[]; // Groups that can receive but not send
  affectedConnections: string[];
}

// Intermittent partition configuration
export interface IntermittentPartitionConfig {
  connectivityPattern: {
    connectedDuration: number; // ms
    disconnectedDuration: number; // ms
    cycles: number;
  };
  connectivityProbability: number; // 0.0 to 1.0
}

// Split-brain configuration
export interface SplitBrainConfig {
  leaderElectionEnabled: boolean;
  consensusAlgorithm: 'raft' | 'paxos' | 'pbft' | 'none';
  quorumSize: number;
  partitionTolerance: number; // Number of partitions that can be tolerated
  conflictResolution: 'last_write_wins' | 'vector_clock' | 'manual';
}

// Active network partition
export interface ActiveNetworkPartition {
  id: string;
  type: PartitionType;
  config: NetworkPartitionConfig;
  startTime: number;
  endTime: number;
  isActive: boolean;
  partitionGroups: PartitionGroup[];
  affectedConnections: string[];
  splitBrainState?: SplitBrainState;
  statistics: PartitionStatistics;
}

// Partition group
export interface PartitionGroup {
  id: string;
  componentIds: string[];
  isIsolated: boolean;
  canCommunicateWith: string[]; // Other group IDs
  leaderComponent?: string; // For split-brain scenarios
  consensusState?: ConsensusState;
}

// Split-brain state
export interface SplitBrainState {
  activeLeaders: Map<string, string>; // groupId -> leaderId
  conflictingOperations: ConflictingOperation[];
  consensusStatus: Map<string, ConsensusState>;
  partitionTolerance: number;
  isResolved: boolean;
}

// Consensus state
export interface ConsensusState {
  term: number;
  votedFor?: string;
  log: ConsensusLogEntry[];
  commitIndex: number;
  lastApplied: number;
  state: 'follower' | 'candidate' | 'leader';
}

// Consensus log entry
export interface ConsensusLogEntry {
  term: number;
  index: number;
  operation: string;
  timestamp: number;
  committed: boolean;
}

// Conflicting operation
export interface ConflictingOperation {
  id: string;
  operation: string;
  sourceGroup: string;
  timestamp: number;
  conflictsWith: string[];
  resolved: boolean;
  resolution?: string;
}

// Partition statistics
export interface PartitionStatistics {
  totalRequests: number;
  failedRequests: number;
  partitionedRequests: number;
  splitBrainConflicts: number;
  consensusFailures: number;
  recoveryTime: number;
  dataInconsistencies: number;
}

// Connection partition state
export interface ConnectionPartitionState {
  connectionId: string;
  sourceComponentId: string;
  targetComponentId: string;
  isPartitioned: boolean;
  partitionType: 'bidirectional' | 'source_to_target' | 'target_to_source';
  partitionStartTime: number;
  lastSuccessfulCommunication: number;
  failedAttempts: number;
  queuedMessages: QueuedMessage[];
}

// Queued message during partition
export interface QueuedMessage {
  id: string;
  sourceComponent: string;
  targetComponent: string;
  message: any;
  timestamp: number;
  attempts: number;
  priority: number;
}

// Partition recovery event
export interface PartitionRecoveryEvent {
  partitionId: string;
  recoveryType: 'connection_restored' | 'leader_elected' | 'consensus_reached' | 'conflict_resolved';
  affectedComponents: string[];
  timestamp: number;
  details: any;
}

/**
 * Network Partition Engine
 * Implements SRS FR-6.3 requirements for network partition simulation
 */
export class NetworkPartitionEngine extends EventEmitter {
  private eventScheduler: EventScheduler;
  private activePartitions: Map<string, ActiveNetworkPartition>;
  private connectionStates: Map<string, ConnectionPartitionState>;
  private componentGroups: Map<string, string>; // componentId -> groupId
  private partitionHistory: ActiveNetworkPartition[];
  private isRunning: boolean;

  constructor(eventScheduler: EventScheduler) {
    super();
    this.eventScheduler = eventScheduler;
    this.activePartitions = new Map();
    this.connectionStates = new Map();
    this.componentGroups = new Map();
    this.partitionHistory = [];
    this.isRunning = false;
  }

  /**
   * Initialize connection for partition simulation
   */
  initializeConnection(connectionId: string, sourceComponentId: string, targetComponentId: string): void {
    const state: ConnectionPartitionState = {
      connectionId,
      sourceComponentId,
      targetComponentId,
      isPartitioned: false,
      partitionType: 'bidirectional',
      partitionStartTime: 0,
      lastSuccessfulCommunication: Date.now(),
      failedAttempts: 0,
      queuedMessages: []
    };

    this.connectionStates.set(connectionId, state);
    this.emit('connection_initialized', { connectionId, sourceComponentId, targetComponentId });
  }

  /**
   * Create network partition
   * Implements SRS FR-6.3: Network partition scenarios
   */
  createNetworkPartition(config: NetworkPartitionConfig): string {
    const partitionId = `partition_${Date.now()}`;
    const currentTime = Date.now();
    const endTime = currentTime + config.duration;

    // Create partition groups
    const partitionGroups: PartitionGroup[] = config.partitionGroups.map((componentIds, index) => ({
      id: `group_${index}`,
      componentIds,
      isIsolated: false,
      canCommunicateWith: [],
      consensusState: config.type === 'split_brain' ? this.initializeConsensusState() : undefined
    }));

    // Determine which groups can communicate with each other
    this.configureGroupCommunication(partitionGroups, config);

    const partition: ActiveNetworkPartition = {
      id: partitionId,
      type: config.type,
      config,
      startTime: currentTime,
      endTime,
      isActive: true,
      partitionGroups,
      affectedConnections: this.findAffectedConnections(partitionGroups),
      splitBrainState: config.type === 'split_brain' ? this.initializeSplitBrainState(config.splitBrainConfig) : undefined,
      statistics: {
        totalRequests: 0,
        failedRequests: 0,
        partitionedRequests: 0,
        splitBrainConflicts: 0,
        consensusFailures: 0,
        recoveryTime: 0,
        dataInconsistencies: 0
      }
    };

    this.activePartitions.set(partitionId, partition);

    // Update component group mappings
    partitionGroups.forEach(group => {
      group.componentIds.forEach(componentId => {
        this.componentGroups.set(componentId, group.id);
      });
    });

    // Apply partition to connections
    this.applyPartitionToConnections(partition);

    // Schedule partition-specific behavior
    this.schedulePartitionBehavior(partition);

    // Schedule partition recovery
    this.schedulePartitionRecovery(partition);

    this.emit('network_partition_created', {
      partitionId,
      type: config.type,
      partitionGroups: partitionGroups.map(g => g.componentIds),
      duration: config.duration
    });

    return partitionId;
  }

  /**
   * Create split-brain scenario
   * Implements SRS FR-6.3: Split-brain condition modeling
   */
  createSplitBrainScenario(components: string[], splitBrainConfig: SplitBrainConfig): string {
    // Divide components into two groups to create split-brain
    const midpoint = Math.ceil(components.length / 2);
    const group1 = components.slice(0, midpoint);
    const group2 = components.slice(midpoint);

    const partitionConfig: NetworkPartitionConfig = {
      type: 'split_brain',
      partitionGroups: [group1, group2],
      duration: 300000, // 5 minutes default
      recoveryType: 'manual',
      splitBrainConfig
    };

    const partitionId = this.createNetworkPartition(partitionConfig);
    
    // Trigger leader election in both groups
    setTimeout(() => {
      this.triggerLeaderElection(partitionId, 'group_0');
      this.triggerLeaderElection(partitionId, 'group_1');
    }, 1000); // 1 second delay

    return partitionId;
  }

  /**
   * Simulate partition recovery
   * Implements SRS FR-6.3: Partition recovery simulation
   */
  simulatePartitionRecovery(partitionId: string, recoveryConfig?: {
    recoveryType?: 'immediate' | 'gradual' | 'partial';
    recoveryOrder?: string[]; // Order of connection recovery
    conflictResolution?: 'automatic' | 'manual';
  }): boolean {
    const partition = this.activePartitions.get(partitionId);
    if (!partition || !partition.isActive) return false;

    const config = recoveryConfig || { recoveryType: 'immediate' };
    const recoveryStartTime = Date.now();

    this.emit('partition_recovery_started', {
      partitionId,
      recoveryType: config.recoveryType,
      startTime: recoveryStartTime
    });

    switch (config.recoveryType) {
      case 'immediate':
        this.executeImmediateRecovery(partition);
        break;
      case 'gradual':
        this.executeGradualRecovery(partition, config.recoveryOrder);
        break;
      case 'partial':
        this.executePartialRecovery(partition);
        break;
      default:
        this.executeImmediateRecovery(partition);
    }

    // Handle split-brain resolution
    if (partition.type === 'split_brain' && partition.splitBrainState) {
      this.resolveSplitBrain(partition, config.conflictResolution || 'automatic');
    }

    partition.statistics.recoveryTime = Date.now() - recoveryStartTime;

    return true;
  }

  /**
   * Check if communication is allowed between components
   */
  canCommunicate(sourceComponentId: string, targetComponentId: string): boolean {
    const sourceGroup = this.componentGroups.get(sourceComponentId);
    const targetGroup = this.componentGroups.get(targetComponentId);

    // If components are not in any partition group, they can communicate
    if (!sourceGroup || !targetGroup) return true;

    // If components are in the same group, they can communicate
    if (sourceGroup === targetGroup) return true;

    // Check if the groups can communicate with each other
    for (const partition of this.activePartitions.values()) {
      if (!partition.isActive) continue;

      const sourcePartitionGroup = partition.partitionGroups.find(g => g.id === sourceGroup);
      if (sourcePartitionGroup && !sourcePartitionGroup.canCommunicateWith.includes(targetGroup)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Process message during partition
   */
  processPartitionedMessage(sourceComponentId: string, targetComponentId: string, message: any): {
    delivered: boolean;
    queued: boolean;
    reason: string;
  } {
    if (this.canCommunicate(sourceComponentId, targetComponentId)) {
      return { delivered: true, queued: false, reason: 'Communication allowed' };
    }

    // Find the connection
    const connectionId = this.findConnectionId(sourceComponentId, targetComponentId);
    if (!connectionId) {
      return { delivered: false, queued: false, reason: 'Connection not found' };
    }

    const connectionState = this.connectionStates.get(connectionId);
    if (!connectionState) {
      return { delivered: false, queued: false, reason: 'Connection state not found' };
    }

    // Queue the message
    const queuedMessage: QueuedMessage = {
      id: `msg_${Date.now()}_${Math.random()}`,
      sourceComponent: sourceComponentId,
      targetComponent: targetComponentId,
      message,
      timestamp: Date.now(),
      attempts: 0,
      priority: 1
    };

    connectionState.queuedMessages.push(queuedMessage);
    connectionState.failedAttempts++;

    // Update partition statistics
    this.updatePartitionStatistics(sourceComponentId, targetComponentId, 'message_queued');

    return { delivered: false, queued: true, reason: 'Network partition active' };
  }

  /**
   * Get partition status
   */
  getPartitionStatus(partitionId: string): ActiveNetworkPartition | null {
    return this.activePartitions.get(partitionId) || null;
  }

  /**
   * Get active partitions
   */
  getActivePartitions(): ActiveNetworkPartition[] {
    return Array.from(this.activePartitions.values()).filter(p => p.isActive);
  }

  /**
   * Get split-brain conflicts
   */
  getSplitBrainConflicts(partitionId: string): ConflictingOperation[] {
    const partition = this.activePartitions.get(partitionId);
    return partition?.splitBrainState?.conflictingOperations || [];
  }

  /**
   * Resolve split-brain conflict
   */
  resolveSplitBrainConflict(partitionId: string, conflictId: string, resolution: string): boolean {
    const partition = this.activePartitions.get(partitionId);
    if (!partition?.splitBrainState) return false;

    const conflict = partition.splitBrainState.conflictingOperations.find(c => c.id === conflictId);
    if (!conflict) return false;

    conflict.resolved = true;
    conflict.resolution = resolution;

    this.emit('split_brain_conflict_resolved', {
      partitionId,
      conflictId,
      resolution
    });

    return true;
  }

  /**
   * Get connection partition state
   */
  getConnectionState(connectionId: string): ConnectionPartitionState | null {
    return this.connectionStates.get(connectionId) || null;
  }

  /**
   * Clear all partitions
   */
  clear(): void {
    this.activePartitions.clear();
    this.connectionStates.clear();
    this.componentGroups.clear();
    this.partitionHistory = [];
    this.emit('partition_engine_cleared');
  }

  // Private helper methods

  private configureGroupCommunication(partitionGroups: PartitionGroup[], config: NetworkPartitionConfig): void {
    switch (config.type) {
      case 'complete':
        // No groups can communicate with each other
        partitionGroups.forEach(group => {
          group.isIsolated = true;
          group.canCommunicateWith = [];
        });
        break;

      case 'partial':
        // Some groups can communicate (configure based on specific requirements)
        partitionGroups.forEach((group, index) => {
          group.canCommunicateWith = partitionGroups
            .filter((_, i) => i !== index && Math.random() > 0.5) // 50% chance of communication
            .map(g => g.id);
        });
        break;

      case 'asymmetric':
        // Configure asymmetric communication based on config
        if (config.asymmetricConfig) {
          this.configureAsymmetricCommunication(partitionGroups, config.asymmetricConfig);
        }
        break;

      case 'split_brain':
        // Groups are completely isolated from each other
        partitionGroups.forEach(group => {
          group.isIsolated = true;
          group.canCommunicateWith = [];
        });
        break;

      default:
        // Default: complete isolation
        partitionGroups.forEach(group => {
          group.isIsolated = true;
          group.canCommunicateWith = [];
        });
    }
  }

  private configureAsymmetricCommunication(partitionGroups: PartitionGroup[], asymmetricConfig: AsymmetricPartitionConfig): void {
    partitionGroups.forEach(group => {
      if (asymmetricConfig.sourceGroups.includes(group.id)) {
        // This group can send but not receive from target groups
        group.canCommunicateWith = partitionGroups
          .filter(g => !asymmetricConfig.targetGroups.includes(g.id))
          .map(g => g.id);
      } else if (asymmetricConfig.targetGroups.includes(group.id)) {
        // This group can receive but not send to source groups
        group.canCommunicateWith = partitionGroups
          .filter(g => !asymmetricConfig.sourceGroups.includes(g.id))
          .map(g => g.id);
      } else {
        // Normal communication for other groups
        group.canCommunicateWith = partitionGroups
          .filter(g => g.id !== group.id)
          .map(g => g.id);
      }
    });
  }

  private findAffectedConnections(partitionGroups: PartitionGroup[]): string[] {
    const affectedConnections: string[] = [];

    for (const [connectionId, connectionState] of this.connectionStates) {
      const sourceGroup = this.findComponentGroup(connectionState.sourceComponentId, partitionGroups);
      const targetGroup = this.findComponentGroup(connectionState.targetComponentId, partitionGroups);

      if (sourceGroup && targetGroup && sourceGroup.id !== targetGroup.id) {
        if (!sourceGroup.canCommunicateWith.includes(targetGroup.id)) {
          affectedConnections.push(connectionId);
        }
      }
    }

    return affectedConnections;
  }

  private findComponentGroup(componentId: string, partitionGroups: PartitionGroup[]): PartitionGroup | null {
    return partitionGroups.find(group => group.componentIds.includes(componentId)) || null;
  }

  private applyPartitionToConnections(partition: ActiveNetworkPartition): void {
    partition.affectedConnections.forEach(connectionId => {
      const connectionState = this.connectionStates.get(connectionId);
      if (connectionState) {
        connectionState.isPartitioned = true;
        connectionState.partitionStartTime = partition.startTime;
        connectionState.partitionType = this.determinePartitionType(connectionState, partition);
      }
    });
  }

  private determinePartitionType(connectionState: ConnectionPartitionState, partition: ActiveNetworkPartition): 'bidirectional' | 'source_to_target' | 'target_to_source' {
    if (partition.type === 'asymmetric' && partition.config.asymmetricConfig) {
      const sourceGroup = this.componentGroups.get(connectionState.sourceComponentId);
      const targetGroup = this.componentGroups.get(connectionState.targetComponentId);
      const asymmetricConfig = partition.config.asymmetricConfig;

      if (asymmetricConfig.sourceGroups.includes(sourceGroup!) && asymmetricConfig.targetGroups.includes(targetGroup!)) {
        return 'source_to_target';
      } else if (asymmetricConfig.targetGroups.includes(sourceGroup!) && asymmetricConfig.sourceGroups.includes(targetGroup!)) {
        return 'target_to_source';
      }
    }

    return 'bidirectional';
  }

  private schedulePartitionBehavior(partition: ActiveNetworkPartition): void {
    switch (partition.type) {
      case 'intermittent':
        this.scheduleIntermittentBehavior(partition);
        break;
      case 'cascading':
        this.scheduleCascadingFailures(partition);
        break;
      case 'split_brain':
        this.scheduleSplitBrainEvents(partition);
        break;
    }
  }

  private scheduleIntermittentBehavior(partition: ActiveNetworkPartition): void {
    const intermittentConfig = partition.config.intermittentConfig;
    if (!intermittentConfig) return;

    const pattern = intermittentConfig.connectivityPattern;
    let currentTime = partition.startTime;
    const cycleTime = pattern.connectedDuration + pattern.disconnectedDuration;

    for (let cycle = 0; cycle < pattern.cycles && currentTime < partition.endTime; cycle++) {
      // Schedule connection restoration
      this.eventScheduler.scheduleEvent({
        id: `intermittent_connect_${partition.id}_${cycle}`,
        timestamp: currentTime,
        type: 'failure_injection',
        componentId: `partition_${partition.id}`,
        data: {
          action: 'restore_intermittent_connection',
          partitionId: partition.id,
          duration: pattern.connectedDuration
        }
      });

      // Schedule disconnection
      this.eventScheduler.scheduleEvent({
        id: `intermittent_disconnect_${partition.id}_${cycle}`,
        timestamp: currentTime + pattern.connectedDuration,
        type: 'failure_injection',
        componentId: `partition_${partition.id}`,
        data: {
          action: 'apply_intermittent_partition',
          partitionId: partition.id,
          duration: pattern.disconnectedDuration
        }
      });

      currentTime += cycleTime;
    }
  }

  private scheduleCascadingFailures(partition: ActiveNetworkPartition): void {
    // Schedule cascading failures with delays
    partition.partitionGroups.forEach((group, index) => {
      const cascadeDelay = index * 5000; // 5 second delay between cascades
      
      this.eventScheduler.scheduleEvent({
        id: `cascade_failure_${partition.id}_${group.id}`,
        timestamp: partition.startTime + cascadeDelay,
        type: 'failure_injection',
        componentId: `group_${group.id}`,
        data: {
          action: 'apply_cascading_partition',
          partitionId: partition.id,
          groupId: group.id
        }
      });
    });
  }

  private scheduleSplitBrainEvents(partition: ActiveNetworkPartition): void {
    // Schedule leader election attempts
    partition.partitionGroups.forEach(group => {
      this.eventScheduler.scheduleEvent({
        id: `leader_election_${partition.id}_${group.id}`,
        timestamp: partition.startTime + 2000, // 2 second delay
        type: 'failure_injection',
        componentId: `group_${group.id}`,
        data: {
          action: 'trigger_leader_election',
          partitionId: partition.id,
          groupId: group.id
        }
      });
    });

    // Schedule conflict detection
    this.eventScheduler.scheduleEvent({
      id: `conflict_detection_${partition.id}`,
      timestamp: partition.startTime + 10000, // 10 second delay
      type: 'failure_injection',
      componentId: `partition_${partition.id}`,
      data: {
        action: 'detect_split_brain_conflicts',
        partitionId: partition.id
      }
    });
  }

  private schedulePartitionRecovery(partition: ActiveNetworkPartition): void {
    if (partition.config.recoveryType === 'automatic') {
      this.eventScheduler.scheduleEvent({
        id: `partition_recovery_${partition.id}`,
        timestamp: partition.endTime,
        type: 'recovery_check',
        componentId: `partition_${partition.id}`,
        data: {
          action: 'recover_partition',
          partitionId: partition.id
        }
      });
    }
  }

  private executeImmediateRecovery(partition: ActiveNetworkPartition): void {
    // Restore all connections immediately
    partition.affectedConnections.forEach(connectionId => {
      const connectionState = this.connectionStates.get(connectionId);
      if (connectionState) {
        connectionState.isPartitioned = false;
        this.deliverQueuedMessages(connectionState);
      }
    });

    // Update partition groups
    partition.partitionGroups.forEach(group => {
      group.isIsolated = false;
      group.canCommunicateWith = partition.partitionGroups
        .filter(g => g.id !== group.id)
        .map(g => g.id);
    });

    this.completePartitionRecovery(partition);
  }

  private executeGradualRecovery(partition: ActiveNetworkPartition, recoveryOrder?: string[]): void {
    const connections = recoveryOrder || partition.affectedConnections;
    const recoveryDelay = 2000; // 2 seconds between connection recoveries

    connections.forEach((connectionId, index) => {
      setTimeout(() => {
        const connectionState = this.connectionStates.get(connectionId);
        if (connectionState) {
          connectionState.isPartitioned = false;
          this.deliverQueuedMessages(connectionState);
          
          this.emit('connection_recovered', {
            partitionId: partition.id,
            connectionId,
            recoveryIndex: index + 1,
            totalConnections: connections.length
          });
        }

        // Complete recovery when all connections are restored
        if (index === connections.length - 1) {
          this.completePartitionRecovery(partition);
        }
      }, index * recoveryDelay);
    });
  }

  private executePartialRecovery(partition: ActiveNetworkPartition): void {
    // Recover only 50% of connections
    const connectionsToRecover = partition.affectedConnections.slice(0, Math.ceil(partition.affectedConnections.length / 2));
    
    connectionsToRecover.forEach(connectionId => {
      const connectionState = this.connectionStates.get(connectionId);
      if (connectionState) {
        connectionState.isPartitioned = false;
        this.deliverQueuedMessages(connectionState);
      }
    });

    // Update partition groups partially
    partition.partitionGroups.forEach((group, index) => {
      if (index < Math.ceil(partition.partitionGroups.length / 2)) {
        group.isIsolated = false;
        group.canCommunicateWith = partition.partitionGroups
          .filter((g, i) => g.id !== group.id && i < Math.ceil(partition.partitionGroups.length / 2))
          .map(g => g.id);
      }
    });

    this.emit('partial_recovery_completed', {
      partitionId: partition.id,
      recoveredConnections: connectionsToRecover.length,
      totalConnections: partition.affectedConnections.length
    });
  }

  private deliverQueuedMessages(connectionState: ConnectionPartitionState): void {
    const queuedMessages = [...connectionState.queuedMessages];
    connectionState.queuedMessages = [];

    queuedMessages.forEach(message => {
      this.emit('queued_message_delivered', {
        messageId: message.id,
        sourceComponent: message.sourceComponent,
        targetComponent: message.targetComponent,
        queueTime: Date.now() - message.timestamp
      });
    });
  }

  private completePartitionRecovery(partition: ActiveNetworkPartition): void {
    partition.isActive = false;
    partition.endTime = Date.now();

    // Clear component group mappings
    partition.partitionGroups.forEach(group => {
      group.componentIds.forEach(componentId => {
        this.componentGroups.delete(componentId);
      });
    });

    // Move to history
    this.partitionHistory.push(partition);
    this.activePartitions.delete(partition.id);

    this.emit('partition_recovery_completed', {
      partitionId: partition.id,
      recoveryTime: partition.statistics.recoveryTime,
      statistics: partition.statistics
    });
  }

  private initializeConsensusState(): ConsensusState {
    return {
      term: 0,
      log: [],
      commitIndex: -1,
      lastApplied: -1,
      state: 'follower'
    };
  }

  private initializeSplitBrainState(config?: SplitBrainConfig): SplitBrainState {
    return {
      activeLeaders: new Map(),
      conflictingOperations: [],
      consensusStatus: new Map(),
      partitionTolerance: config?.partitionTolerance || 1,
      isResolved: false
    };
  }

  private triggerLeaderElection(partitionId: string, groupId: string): void {
    const partition = this.activePartitions.get(partitionId);
    if (!partition?.splitBrainState) return;

    const group = partition.partitionGroups.find(g => g.id === groupId);
    if (!group || !group.consensusState) return;

    // Simple leader election - first component becomes leader
    const leaderId = group.componentIds[0];
    group.leaderComponent = leaderId;
    group.consensusState.state = 'leader';
    group.consensusState.term++;

    partition.splitBrainState.activeLeaders.set(groupId, leaderId);

    this.emit('leader_elected', {
      partitionId,
      groupId,
      leaderId,
      term: group.consensusState.term
    });

    // Check for split-brain conflicts
    if (partition.splitBrainState.activeLeaders.size > 1) {
      this.detectSplitBrainConflicts(partition);
    }
  }

  private detectSplitBrainConflicts(partition: ActiveNetworkPartition): void {
    if (!partition.splitBrainState) return;

    const leaders = Array.from(partition.splitBrainState.activeLeaders.entries());
    
    if (leaders.length > 1) {
      const conflictId = `conflict_${partition.id}_${Date.now()}`;
      const conflict: ConflictingOperation = {
        id: conflictId,
        operation: 'leader_election',
        sourceGroup: leaders[0][0],
        timestamp: Date.now(),
        conflictsWith: leaders.slice(1).map(([groupId]) => groupId),
        resolved: false
      };

      partition.splitBrainState.conflictingOperations.push(conflict);
      partition.statistics.splitBrainConflicts++;

      this.emit('split_brain_conflict_detected', {
        partitionId: partition.id,
        conflictId,
        conflictingLeaders: leaders
      });
    }
  }

  private resolveSplitBrain(partition: ActiveNetworkPartition, resolutionType: string): void {
    if (!partition.splitBrainState) return;

    switch (resolutionType) {
      case 'automatic':
        this.automaticSplitBrainResolution(partition);
        break;
      case 'manual':
        // Manual resolution requires external intervention
        this.emit('manual_split_brain_resolution_required', {
          partitionId: partition.id,
          conflicts: partition.splitBrainState.conflictingOperations
        });
        break;
    }
  }

  private automaticSplitBrainResolution(partition: ActiveNetworkPartition): void {
    if (!partition.splitBrainState) return;

    // Simple resolution: largest group wins
    const largestGroup = partition.partitionGroups.reduce((largest, current) => 
      current.componentIds.length > largest.componentIds.length ? current : largest
    );

    // Demote leaders in other groups
    partition.partitionGroups.forEach(group => {
      if (group.id !== largestGroup.id && group.consensusState) {
        group.consensusState.state = 'follower';
        group.leaderComponent = undefined;
        partition.splitBrainState!.activeLeaders.delete(group.id);
      }
    });

    // Mark conflicts as resolved
    partition.splitBrainState.conflictingOperations.forEach(conflict => {
      conflict.resolved = true;
      conflict.resolution = `Resolved in favor of group ${largestGroup.id}`;
    });

    partition.splitBrainState.isResolved = true;

    this.emit('split_brain_resolved', {
      partitionId: partition.id,
      winningGroup: largestGroup.id,
      resolution: 'largest_group_wins'
    });
  }

  private findConnectionId(sourceComponentId: string, targetComponentId: string): string | null {
    for (const [connectionId, connectionState] of this.connectionStates) {
      if ((connectionState.sourceComponentId === sourceComponentId && connectionState.targetComponentId === targetComponentId) ||
          (connectionState.sourceComponentId === targetComponentId && connectionState.targetComponentId === sourceComponentId)) {
        return connectionId;
      }
    }
    return null;
  }

  private updatePartitionStatistics(sourceComponentId: string, targetComponentId: string, eventType: string): void {
    const sourceGroup = this.componentGroups.get(sourceComponentId);
    const targetGroup = this.componentGroups.get(targetComponentId);

    if (!sourceGroup || !targetGroup) return;

    for (const partition of this.activePartitions.values()) {
      if (!partition.isActive) continue;

      const sourcePartitionGroup = partition.partitionGroups.find(g => g.id === sourceGroup);
      const targetPartitionGroup = partition.partitionGroups.find(g => g.id === targetGroup);

      if (sourcePartitionGroup && targetPartitionGroup) {
        partition.statistics.totalRequests++;
        
        if (eventType === 'message_queued') {
          partition.statistics.partitionedRequests++;
        } else if (eventType === 'message_failed') {
          partition.statistics.failedRequests++;
        }
      }
    }
  }
}