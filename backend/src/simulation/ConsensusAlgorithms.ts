/**
 * Consensus Algorithms Implementation
 * 
 * Models consensus algorithms (Raft, PBFT) for distributed coordination scenarios.
 * Implements Requirement 8.5 from the SRS.
 * 
 * Key Features:
 * - Raft consensus algorithm with leader election and log replication
 * - PBFT (Practical Byzantine Fault Tolerance) for Byzantine fault scenarios
 * - Leader election and failover scenarios
 * - Byzantine fault tolerance modeling
 */

import { EventEmitter } from 'events';

// Consensus algorithm types
export type ConsensusAlgorithm = 'raft' | 'pbft';

// Node states in consensus algorithms
export type NodeState = 'follower' | 'candidate' | 'leader' | 'faulty' | 'byzantine';

// Consensus node representation
export interface ConsensusNode {
  id: string;
  state: NodeState;
  term: number; // Current term (Raft)
  votedFor?: string; // Who this node voted for in current term
  log: LogEntry[];
  commitIndex: number; // Index of highest log entry known to be committed
  lastApplied: number; // Index of highest log entry applied to state machine
  nextIndex?: Map<string, number>; // For leaders: next log entry to send to each server
  matchIndex?: Map<string, number>; // For leaders: highest log entry known to be replicated
  lastHeartbeat: number;
  isHealthy: boolean;
  isByzantine: boolean; // For PBFT scenarios
}

// Log entry for consensus algorithms
export interface LogEntry {
  term: number;
  index: number;
  command: any;
  timestamp: number;
  committed: boolean;
}

// Consensus message types
export type MessageType = 
  | 'request_vote'
  | 'vote_response'
  | 'append_entries'
  | 'append_entries_response'
  | 'prepare' // PBFT
  | 'commit' // PBFT
  | 'view_change' // PBFT
  | 'new_view'; // PBFT

// Consensus message
export interface ConsensusMessage {
  id: string;
  type: MessageType;
  from: string;
  to: string;
  term: number;
  data: any;
  timestamp: number;
}

// Election configuration
export interface ElectionConfig {
  electionTimeoutMin: number; // milliseconds
  electionTimeoutMax: number; // milliseconds
  heartbeatInterval: number; // milliseconds
  maxRetries: number;
}

// PBFT configuration
export interface PBFTConfig {
  viewTimeout: number; // milliseconds
  maxFaultyNodes: number; // f in 3f+1 formula
  messageTimeout: number; // milliseconds
}

// Leader election result
export interface LeaderElectionResult {
  newLeader: string;
  term: number;
  votesReceived: number;
  totalNodes: number;
  electionDuration: number;
  failedNodes: string[];
}

// Failover scenario
export interface FailoverScenario {
  id: string;
  triggeredBy: 'leader_failure' | 'network_partition' | 'byzantine_behavior';
  affectedNodes: string[];
  startTime: number;
  detectionTime?: number;
  recoveryTime?: number;
  newLeader?: string;
  dataLoss: boolean;
  performanceImpact: number; // 0-1
}

// Byzantine fault scenario
export interface ByzantineFaultScenario {
  id: string;
  byzantineNodes: string[];
  faultType: 'crash' | 'omission' | 'commission' | 'arbitrary';
  startTime: number;
  duration: number;
  impactOnConsensus: 'none' | 'delayed' | 'prevented';
  detectedBy: string[];
}

/**
 * Consensus Algorithms Engine
 */
export class ConsensusAlgorithms extends EventEmitter {
  private nodes: Map<string, ConsensusNode> = new Map();
  private algorithm: ConsensusAlgorithm = 'raft';
  private electionConfig: ElectionConfig;
  private pbftConfig: PBFTConfig;
  private currentLeader?: string;
  private currentTerm: number = 0;
  private activeElection?: string;
  private activeFailovers: Map<string, FailoverScenario> = new Map();
  private activeByzantineFaults: Map<string, ByzantineFaultScenario> = new Map();
  private messageQueue: ConsensusMessage[] = [];
  
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private electionTimeout: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(algorithm: ConsensusAlgorithm = 'raft') {
    super();
    this.algorithm = algorithm;
    
    // Default configurations
    this.electionConfig = {
      electionTimeoutMin: 150,
      electionTimeoutMax: 300,
      heartbeatInterval: 50,
      maxRetries: 3
    };
    
    this.pbftConfig = {
      viewTimeout: 1000,
      maxFaultyNodes: 1, // Supports up to 1 faulty node in 4-node cluster
      messageTimeout: 100
    };
  }

  /**
   * Initialize consensus with a set of nodes
   */
  initialize(nodeIds: string[], config?: Partial<ElectionConfig & PBFTConfig>): void {
    this.clear();
    
    if (config) {
      this.electionConfig = { ...this.electionConfig, ...config };
      this.pbftConfig = { ...this.pbftConfig, ...config };
    }

    // Initialize nodes
    for (const nodeId of nodeIds) {
      const node: ConsensusNode = {
        id: nodeId,
        state: 'follower',
        term: 0,
        log: [],
        commitIndex: -1,
        lastApplied: -1,
        lastHeartbeat: Date.now(),
        isHealthy: true,
        isByzantine: false
      };

      if (this.algorithm === 'raft') {
        node.nextIndex = new Map();
        node.matchIndex = new Map();
        
        // Initialize leader state for all nodes
        for (const otherId of nodeIds) {
          if (otherId !== nodeId) {
            node.nextIndex!.set(otherId, 0);
            node.matchIndex!.set(otherId, -1);
          }
        }
      }

      this.nodes.set(nodeId, node);
    }

    // Validate cluster size for PBFT
    if (this.algorithm === 'pbft') {
      const minNodes = 3 * this.pbftConfig.maxFaultyNodes + 1;
      if (nodeIds.length < minNodes) {
        throw new Error(`PBFT requires at least ${minNodes} nodes for ${this.pbftConfig.maxFaultyNodes} faulty nodes`);
      }
    }

    this.emit('consensus_initialized', {
      algorithm: this.algorithm,
      nodeCount: nodeIds.length,
      config: this.algorithm === 'raft' ? this.electionConfig : this.pbftConfig
    });
  }

  /**
   * Start the consensus algorithm
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.currentTerm = 1;

    if (this.algorithm === 'raft') {
      this.startRaftConsensus();
    } else if (this.algorithm === 'pbft') {
      this.startPBFTConsensus();
    }

    this.emit('consensus_started', { algorithm: this.algorithm });
  }

  /**
   * Stop the consensus algorithm
   */
  stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.electionTimeout) {
      clearTimeout(this.electionTimeout);
      this.electionTimeout = null;
    }

    this.emit('consensus_stopped');
  }

  /**
   * Trigger leader election
   */
  triggerLeaderElection(triggeringNodeId?: string): string {
    const electionId = `election-${Date.now()}`;
    this.activeElection = electionId;
    
    const startTime = Date.now();
    
    if (this.algorithm === 'raft') {
      this.conductRaftElection(electionId, triggeringNodeId);
    } else if (this.algorithm === 'pbft') {
      this.conductPBFTViewChange(electionId);
    }

    this.emit('leader_election_started', {
      electionId,
      algorithm: this.algorithm,
      triggeringNode: triggeringNodeId,
      candidateNodes: this.getHealthyNodes().map(n => n.id)
    });

    return electionId;
  }

  /**
   * Simulate node failure and trigger failover
   */
  simulateNodeFailure(nodeId: string, failureType: 'crash' | 'network' | 'byzantine' = 'crash'): string {
    const failoverId = `failover-${Date.now()}`;
    const node = this.nodes.get(nodeId);
    
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    const wasLeader = this.currentLeader === nodeId;
    
    // Mark node as unhealthy
    node.isHealthy = false;
    node.state = 'faulty';
    
    if (failureType === 'byzantine') {
      node.isByzantine = true;
    }

    const scenario: FailoverScenario = {
      id: failoverId,
      triggeredBy: failureType === 'byzantine' ? 'byzantine_behavior' : 'leader_failure',
      affectedNodes: [nodeId],
      startTime: Date.now(),
      dataLoss: wasLeader && this.calculateDataLoss(),
      performanceImpact: this.calculatePerformanceImpact([nodeId])
    };

    this.activeFailovers.set(failoverId, scenario);

    // If leader failed, trigger election
    if (wasLeader) {
      this.currentLeader = undefined;
      setTimeout(() => {
        const electionId = this.triggerLeaderElection();
        scenario.detectionTime = Date.now();
      }, Math.random() * 100 + 50); // 50-150ms detection delay
    }

    this.emit('node_failure_detected', {
      nodeId,
      failureType,
      wasLeader,
      failoverId
    });

    return failoverId;
  }

  /**
   * Simulate Byzantine fault scenario
   */
  simulateByzantineFault(nodeIds: string[], faultType: ByzantineFaultScenario['faultType'], duration: number): string {
    const scenarioId = `byzantine-${Date.now()}`;
    
    // Validate that we don't exceed fault tolerance
    if (nodeIds.length > this.pbftConfig.maxFaultyNodes) {
      throw new Error(`Cannot simulate ${nodeIds.length} Byzantine faults. Maximum allowed: ${this.pbftConfig.maxFaultyNodes}`);
    }

    const scenario: ByzantineFaultScenario = {
      id: scenarioId,
      byzantineNodes: nodeIds,
      faultType,
      startTime: Date.now(),
      duration,
      impactOnConsensus: this.calculateByzantineImpact(nodeIds.length),
      detectedBy: []
    };

    // Apply Byzantine behavior to nodes
    for (const nodeId of nodeIds) {
      const node = this.nodes.get(nodeId);
      if (node) {
        node.isByzantine = true;
        node.state = 'byzantine';
        this.applyByzantineBehavior(node, faultType);
      }
    }

    this.activeByzantineFaults.set(scenarioId, scenario);

    // Schedule recovery
    setTimeout(() => {
      this.recoverFromByzantineFault(scenarioId);
    }, duration);

    this.emit('byzantine_fault_triggered', scenario);

    return scenarioId;
  }

  /**
   * Recover a node from failure
   */
  recoverNode(nodeId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    node.isHealthy = true;
    node.isByzantine = false;
    node.state = 'follower';
    node.lastHeartbeat = Date.now();

    // Update active failovers
    for (const [failoverId, scenario] of this.activeFailovers) {
      if (scenario.affectedNodes.includes(nodeId)) {
        scenario.recoveryTime = Date.now();
        this.activeFailovers.delete(failoverId);
        
        this.emit('failover_completed', {
          failoverId,
          recoveredNode: nodeId,
          totalDuration: scenario.recoveryTime - scenario.startTime
        });
      }
    }

    this.emit('node_recovered', { nodeId });
    return true;
  }

  /**
   * Get current consensus state
   */
  getConsensusState(): {
    algorithm: ConsensusAlgorithm;
    currentLeader?: string;
    currentTerm: number;
    nodes: ConsensusNode[];
    activeElection?: string;
    activeFailovers: FailoverScenario[];
    activeByzantineFaults: ByzantineFaultScenario[];
  } {
    return {
      algorithm: this.algorithm,
      currentLeader: this.currentLeader,
      currentTerm: this.currentTerm,
      nodes: Array.from(this.nodes.values()),
      activeElection: this.activeElection,
      activeFailovers: Array.from(this.activeFailovers.values()),
      activeByzantineFaults: Array.from(this.activeByzantineFaults.values())
    };
  }

  /**
   * Get node by ID
   */
  getNode(nodeId: string): ConsensusNode | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Clear all state
   */
  clear(): void {
    this.stop();
    this.nodes.clear();
    this.currentLeader = undefined;
    this.currentTerm = 0;
    this.activeElection = undefined;
    this.activeFailovers.clear();
    this.activeByzantineFaults.clear();
    this.messageQueue = [];
  }

  // Private helper methods

  /**
   * Start Raft consensus algorithm
   */
  private startRaftConsensus(): void {
    // Start heartbeat for leader (if any)
    this.heartbeatInterval = setInterval(() => {
      if (this.currentLeader) {
        this.sendHeartbeats();
      }
      this.checkForElectionTimeout();
    }, this.electionConfig.heartbeatInterval);

    // Trigger initial election if no leader
    if (!this.currentLeader) {
      setTimeout(() => {
        this.triggerLeaderElection();
      }, this.getRandomElectionTimeout());
    }
  }

  /**
   * Start PBFT consensus algorithm
   */
  private startPBFTConsensus(): void {
    // PBFT uses view-based leadership
    this.currentLeader = this.selectInitialPBFTLeader();
    
    // Start view timeout monitoring
    this.heartbeatInterval = setInterval(() => {
      this.checkPBFTViewTimeout();
    }, this.pbftConfig.viewTimeout / 10);
  }

  /**
   * Conduct Raft leader election
   */
  private conductRaftElection(electionId: string, triggeringNodeId?: string): void {
    const candidates = this.getHealthyNodes().filter(n => n.state !== 'leader');
    
    if (candidates.length === 0) {
      this.emit('leader_election_failed', { electionId, reason: 'No healthy candidates' });
      return;
    }

    // Select candidate (triggering node or random)
    const candidate = triggeringNodeId 
      ? candidates.find(n => n.id === triggeringNodeId) || candidates[0]
      : candidates[Math.floor(Math.random() * candidates.length)];

    // Increment term and become candidate
    this.currentTerm++;
    candidate.term = this.currentTerm;
    candidate.state = 'candidate';
    candidate.votedFor = candidate.id;

    // Request votes from other nodes
    const votes = new Set([candidate.id]); // Vote for self
    const healthyNodes = this.getHealthyNodes();
    
    for (const node of healthyNodes) {
      if (node.id !== candidate.id && this.shouldGrantVote(node, candidate)) {
        votes.add(node.id);
        node.votedFor = candidate.id;
        node.term = this.currentTerm;
      }
    }

    const majority = Math.floor(healthyNodes.length / 2) + 1;
    
    if (votes.size >= majority) {
      // Election successful
      this.currentLeader = candidate.id;
      candidate.state = 'leader';
      
      // Initialize leader state
      for (const node of healthyNodes) {
        if (node.id !== candidate.id) {
          node.state = 'follower';
          candidate.nextIndex!.set(node.id, candidate.log.length);
          candidate.matchIndex!.set(node.id, -1);
        }
      }

      const result: LeaderElectionResult = {
        newLeader: candidate.id,
        term: this.currentTerm,
        votesReceived: votes.size,
        totalNodes: healthyNodes.length,
        electionDuration: Date.now() - parseInt(electionId.split('-')[1]),
        failedNodes: healthyNodes.filter(n => !n.isHealthy).map(n => n.id)
      };

      this.activeElection = undefined;
      this.emit('leader_elected', result);
    } else {
      // Election failed
      candidate.state = 'follower';
      this.emit('leader_election_failed', { 
        electionId, 
        reason: 'Insufficient votes',
        votesReceived: votes.size,
        votesNeeded: majority
      });
    }
  }

  /**
   * Conduct PBFT view change
   */
  private conductPBFTViewChange(electionId: string): void {
    const healthyNodes = this.getHealthyNodes();
    const newLeader = this.selectPBFTLeader(healthyNodes);
    
    if (newLeader) {
      this.currentLeader = newLeader.id;
      
      const result: LeaderElectionResult = {
        newLeader: newLeader.id,
        term: this.currentTerm,
        votesReceived: healthyNodes.length,
        totalNodes: healthyNodes.length,
        electionDuration: Date.now() - parseInt(electionId.split('-')[1]),
        failedNodes: []
      };

      this.activeElection = undefined;
      this.emit('leader_elected', result);
    } else {
      this.emit('leader_election_failed', { 
        electionId, 
        reason: 'No suitable PBFT leader found' 
      });
    }
  }

  /**
   * Send heartbeats from leader to followers
   */
  private sendHeartbeats(): void {
    const leader = this.nodes.get(this.currentLeader!);
    if (!leader || !leader.isHealthy) return;

    const healthyFollowers = this.getHealthyNodes().filter(n => n.id !== this.currentLeader);
    
    for (const follower of healthyFollowers) {
      follower.lastHeartbeat = Date.now();
      
      // Simulate heartbeat message
      const message: ConsensusMessage = {
        id: `heartbeat-${Date.now()}-${Math.random()}`,
        type: 'append_entries',
        from: leader.id,
        to: follower.id,
        term: this.currentTerm,
        data: { entries: [], heartbeat: true },
        timestamp: Date.now()
      };
      
      this.processMessage(message);
    }
  }

  /**
   * Check for election timeout
   */
  private checkForElectionTimeout(): void {
    const now = Date.now();
    const timeout = this.getRandomElectionTimeout();
    
    for (const node of this.nodes.values()) {
      if (node.isHealthy && node.state === 'follower') {
        if (now - node.lastHeartbeat > timeout) {
          // Trigger election
          this.triggerLeaderElection(node.id);
          break;
        }
      }
    }
  }

  /**
   * Check PBFT view timeout
   */
  private checkPBFTViewTimeout(): void {
    // Simplified PBFT view timeout check
    if (this.currentLeader) {
      const leader = this.nodes.get(this.currentLeader);
      if (!leader || !leader.isHealthy) {
        this.triggerLeaderElection();
      }
    }
  }

  /**
   * Process consensus message
   */
  private processMessage(message: ConsensusMessage): void {
    const targetNode = this.nodes.get(message.to);
    if (!targetNode || !targetNode.isHealthy) return;

    // Handle Byzantine nodes
    if (targetNode.isByzantine) {
      this.handleByzantineMessage(message, targetNode);
      return;
    }

    switch (message.type) {
      case 'append_entries':
        this.handleAppendEntries(message, targetNode);
        break;
      case 'request_vote':
        this.handleRequestVote(message, targetNode);
        break;
      // Add other message types as needed
    }
  }

  /**
   * Handle append entries message (Raft)
   */
  private handleAppendEntries(message: ConsensusMessage, node: ConsensusNode): void {
    node.lastHeartbeat = Date.now();
    
    if (message.data.heartbeat) {
      // Simple heartbeat acknowledgment
      node.term = Math.max(node.term, message.term);
      if (node.state === 'candidate') {
        node.state = 'follower';
      }
    }
  }

  /**
   * Handle request vote message (Raft)
   */
  private handleRequestVote(message: ConsensusMessage, node: ConsensusNode): void {
    const candidate = this.nodes.get(message.from);
    if (!candidate) return;

    const shouldVote = this.shouldGrantVote(node, candidate);
    
    if (shouldVote) {
      node.votedFor = candidate.id;
      node.term = message.term;
    }

    // Send vote response
    const response: ConsensusMessage = {
      id: `vote-response-${Date.now()}`,
      type: 'vote_response',
      from: node.id,
      to: candidate.id,
      term: node.term,
      data: { voteGranted: shouldVote },
      timestamp: Date.now()
    };

    this.messageQueue.push(response);
  }

  /**
   * Handle Byzantine message behavior
   */
  private handleByzantineMessage(message: ConsensusMessage, node: ConsensusNode): void {
    // Byzantine nodes may ignore, delay, or corrupt messages
    const behavior = Math.random();
    
    if (behavior < 0.3) {
      // Ignore message (30% chance)
      return;
    } else if (behavior < 0.6) {
      // Delay message (30% chance)
      setTimeout(() => {
        this.processMessage(message);
      }, Math.random() * 1000);
    } else {
      // Process normally (40% chance)
      // Remove Byzantine flag temporarily for normal processing
      const wasByzantine = node.isByzantine;
      node.isByzantine = false;
      this.processMessage(message);
      node.isByzantine = wasByzantine;
    }
  }

  /**
   * Determine if a node should grant vote to candidate
   */
  private shouldGrantVote(voter: ConsensusNode, candidate: ConsensusNode): boolean {
    // Basic Raft voting rules
    if (voter.term > candidate.term) return false;
    if (voter.votedFor && voter.votedFor !== candidate.id) return false;
    
    // Log comparison (simplified)
    const voterLastLogTerm = voter.log.length > 0 ? voter.log[voter.log.length - 1].term : 0;
    const candidateLastLogTerm = candidate.log.length > 0 ? candidate.log[candidate.log.length - 1].term : 0;
    
    if (candidateLastLogTerm > voterLastLogTerm) return true;
    if (candidateLastLogTerm === voterLastLogTerm && candidate.log.length >= voter.log.length) return true;
    
    return false;
  }

  /**
   * Get healthy nodes
   */
  private getHealthyNodes(): ConsensusNode[] {
    return Array.from(this.nodes.values()).filter(n => n.isHealthy);
  }

  /**
   * Get random election timeout
   */
  private getRandomElectionTimeout(): number {
    const min = this.electionConfig.electionTimeoutMin;
    const max = this.electionConfig.electionTimeoutMax;
    return Math.random() * (max - min) + min;
  }

  /**
   * Select initial PBFT leader
   */
  private selectInitialPBFTLeader(): string {
    const healthyNodes = this.getHealthyNodes();
    return healthyNodes.length > 0 ? healthyNodes[0].id : '';
  }

  /**
   * Select PBFT leader from healthy nodes
   */
  private selectPBFTLeader(nodes: ConsensusNode[]): ConsensusNode | null {
    // Simple round-robin selection
    const sortedNodes = nodes.sort((a, b) => a.id.localeCompare(b.id));
    return sortedNodes.length > 0 ? sortedNodes[0] : null;
  }

  /**
   * Apply Byzantine behavior to a node
   */
  private applyByzantineBehavior(node: ConsensusNode, faultType: ByzantineFaultScenario['faultType']): void {
    switch (faultType) {
      case 'crash':
        node.isHealthy = false;
        break;
      case 'omission':
        // Node omits sending some messages (handled in message processing)
        break;
      case 'commission':
        // Node sends incorrect messages (handled in message processing)
        break;
      case 'arbitrary':
        // Node exhibits arbitrary behavior
        break;
    }
  }

  /**
   * Calculate data loss probability
   */
  private calculateDataLoss(): boolean {
    // Simplified: 20% chance of data loss when leader fails
    return Math.random() < 0.2;
  }

  /**
   * Calculate performance impact of node failures
   */
  private calculatePerformanceImpact(failedNodes: string[]): number {
    const totalNodes = this.nodes.size;
    const failedCount = failedNodes.length;
    
    // Performance impact increases non-linearly with failed nodes
    return Math.min(0.8, (failedCount / totalNodes) * 1.5);
  }

  /**
   * Calculate Byzantine impact on consensus
   */
  private calculateByzantineImpact(byzantineCount: number): ByzantineFaultScenario['impactOnConsensus'] {
    if (byzantineCount === 0) return 'none';
    if (byzantineCount <= this.pbftConfig.maxFaultyNodes) return 'delayed';
    return 'prevented';
  }

  /**
   * Recover from Byzantine fault scenario
   */
  private recoverFromByzantineFault(scenarioId: string): void {
    const scenario = this.activeByzantineFaults.get(scenarioId);
    if (!scenario) return;

    // Restore Byzantine nodes to normal behavior
    for (const nodeId of scenario.byzantineNodes) {
      const node = this.nodes.get(nodeId);
      if (node) {
        node.isByzantine = false;
        node.state = 'follower';
        node.isHealthy = true;
      }
    }

    this.activeByzantineFaults.delete(scenarioId);

    this.emit('byzantine_fault_recovered', {
      scenarioId,
      recoveredNodes: scenario.byzantineNodes,
      duration: Date.now() - scenario.startTime
    });
  }
}