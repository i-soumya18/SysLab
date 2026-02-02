/**
 * Load Propagation Engine implementing SRS FR-4.2
 * 
 * Creates system graph traversal for load distribution per SRS FR-4.2
 * Implements realistic load propagation through components per SRS FR-4.2
 * Adds load balancing and routing logic per SRS FR-4.2
 */

import { EventScheduler, SimulationEvent } from './types';
import { SystemGraphEngine, SystemGraphNode, SystemGraphEdge } from './SystemGraphEngine';

// Load propagation configuration
export interface LoadPropagationConfig {
  propagationStrategy: 'breadth-first' | 'depth-first' | 'weighted' | 'priority-based';
  loadBalancingAlgorithm: 'round-robin' | 'weighted-round-robin' | 'least-connections' | 'least-response-time';
  routingPolicy: 'shortest-path' | 'least-latency' | 'highest-capacity' | 'load-aware';
  enableBackpressure: boolean;
  maxPropagationDepth: number;
}

// Request routing information
export interface RequestRoute {
  requestId: string;
  sourceNodeId: string;
  targetNodeId: string;
  path: SystemGraphNode[];
  edges: SystemGraphEdge[];
  totalLatency: number;
  priority: 'low' | 'normal' | 'high';
  timestamp: number;
}

// Load balancing state for a component
export interface LoadBalancingState {
  componentId: string;
  algorithm: string;
  targets: LoadBalancingTarget[];
  currentIndex: number; // for round-robin
  totalWeight: number; // for weighted algorithms
  lastUpdate: number;
}

export interface LoadBalancingTarget {
  nodeId: string;
  weight: number;
  currentConnections: number;
  averageResponseTime: number;
  isHealthy: boolean;
  capacity: number;
  currentLoad: number;
}

// Load propagation result
export interface LoadPropagationResult {
  requestId: string;
  propagationPath: RequestRoute[];
  totalPropagationTime: number;
  bottlenecks: string[];
  droppedRequests: number;
  successfulPropagations: number;
}

// Routing decision information
export interface RoutingDecision {
  requestId: string;
  sourceNodeId: string;
  availableTargets: string[];
  selectedTarget: string;
  reason: string;
  metrics: RoutingMetrics;
}

export interface RoutingMetrics {
  latency: number;
  capacity: number;
  currentLoad: number;
  reliability: number;
  cost: number;
}

/**
 * Load Propagation Engine
 * Implements SRS FR-4.2 requirements for load propagation
 */
export class LoadPropagationEngine {
  private systemGraph: SystemGraphEngine;
  private eventScheduler: EventScheduler;
  private config: LoadPropagationConfig;
  private loadBalancingStates: Map<string, LoadBalancingState>;
  private activeRoutes: Map<string, RequestRoute>;
  private routingDecisions: Map<string, RoutingDecision>;
  private propagationStats: Map<string, number>;

  constructor(systemGraph: SystemGraphEngine, eventScheduler: EventScheduler) {
    this.systemGraph = systemGraph;
    this.eventScheduler = eventScheduler;
    this.loadBalancingStates = new Map();
    this.activeRoutes = new Map();
    this.routingDecisions = new Map();
    this.propagationStats = new Map();
    
    // Default configuration
    this.config = {
      propagationStrategy: 'weighted',
      loadBalancingAlgorithm: 'least-connections',
      routingPolicy: 'load-aware',
      enableBackpressure: true,
      maxPropagationDepth: 10
    };
  }

  /**
   * Initialize load propagation with configuration
   * Implements SRS FR-4.2: System graph traversal for load distribution
   */
  initializeLoadPropagation(config: Partial<LoadPropagationConfig>): void {
    this.config = { ...this.config, ...config };
    this.loadBalancingStates.clear();
    this.activeRoutes.clear();
    this.routingDecisions.clear();
    this.propagationStats.clear();

    // Initialize load balancing states for all components
    this.initializeLoadBalancingStates();
  }

  /**
   * Propagate load from a source component through the system graph
   * Implements SRS FR-4.2: Realistic load propagation through components
   */
  propagateLoad(requestId: string, sourceNodeId: string, load: number, priority: 'low' | 'normal' | 'high' = 'normal'): LoadPropagationResult {
    const sourceNode = this.systemGraph.getNode(sourceNodeId);
    if (!sourceNode) {
      throw new Error(`Source node ${sourceNodeId} not found`);
    }

    const result: LoadPropagationResult = {
      requestId,
      propagationPath: [],
      totalPropagationTime: 0,
      bottlenecks: [],
      droppedRequests: 0,
      successfulPropagations: 0
    };

    // Start propagation from source node
    this.propagateFromNode(requestId, sourceNode, load, priority, result, 0);

    return result;
  }

  /**
   * Propagate load from a specific node
   */
  private propagateFromNode(
    requestId: string, 
    node: SystemGraphNode, 
    load: number, 
    priority: 'low' | 'normal' | 'high',
    result: LoadPropagationResult,
    depth: number
  ): void {
    // Check max propagation depth
    if (depth >= this.config.maxPropagationDepth) {
      return;
    }

    // Check if node can handle the load
    if (!this.canNodeHandleLoad(node, load)) {
      result.bottlenecks.push(node.id);
      if (this.config.enableBackpressure) {
        this.applyBackpressure(node.id, load);
      }
      result.droppedRequests++;
      return;
    }

    // Update node load
    this.systemGraph.updateNodeLoad(node.id, node.currentLoad + load);

    // Get downstream targets based on routing policy
    const targets = this.getDownstreamTargets(node, priority);
    
    if (targets.length === 0) {
      // End of propagation path
      result.successfulPropagations++;
      return;
    }

    // Apply load balancing to distribute load among targets
    const loadDistribution = this.distributeLoad(node.id, targets, load);

    // Propagate to each target
    for (const distribution of loadDistribution) {
      const targetNode = this.systemGraph.getNode(distribution.targetNodeId);
      if (!targetNode) continue;

      // Create route information
      const route: RequestRoute = {
        requestId: `${requestId}_${distribution.targetNodeId}`,
        sourceNodeId: node.id,
        targetNodeId: distribution.targetNodeId,
        path: [node, targetNode],
        edges: this.getEdgesBetweenNodes(node.id, distribution.targetNodeId),
        totalLatency: this.calculateRouteLatency(node, targetNode),
        priority,
        timestamp: Date.now()
      };

      result.propagationPath.push(route);
      this.activeRoutes.set(route.requestId, route);

      // Schedule propagation event
      this.scheduleLoadPropagationEvent(route, distribution.load);

      // Continue propagation recursively
      this.propagateFromNode(
        route.requestId,
        targetNode,
        distribution.load,
        priority,
        result,
        depth + 1
      );
    }
  }

  /**
   * Get downstream targets based on routing policy
   * Implements SRS FR-4.2: Load balancing and routing logic
   */
  private getDownstreamTargets(node: SystemGraphNode, priority: 'low' | 'normal' | 'high'): SystemGraphNode[] {
    const downstreamNodes = this.systemGraph.getDownstreamComponents(node.id);
    
    if (downstreamNodes.length === 0) {
      return [];
    }

    // Apply routing policy
    switch (this.config.routingPolicy) {
      case 'shortest-path':
        return this.selectShortestPathTargets(downstreamNodes);
      case 'least-latency':
        return this.selectLeastLatencyTargets(downstreamNodes);
      case 'highest-capacity':
        return this.selectHighestCapacityTargets(downstreamNodes);
      case 'load-aware':
        return this.selectLoadAwareTargets(downstreamNodes, priority);
      default:
        return downstreamNodes;
    }
  }

  /**
   * Distribute load among targets using load balancing algorithm
   */
  private distributeLoad(sourceNodeId: string, targets: SystemGraphNode[], totalLoad: number): LoadDistribution[] {
    const loadBalancingState = this.loadBalancingStates.get(sourceNodeId);
    if (!loadBalancingState) {
      // Equal distribution as fallback
      const loadPerTarget = totalLoad / targets.length;
      return targets.map(target => ({
        targetNodeId: target.id,
        load: loadPerTarget
      }));
    }

    switch (loadBalancingState.algorithm) {
      case 'round-robin':
        return this.distributeRoundRobin(loadBalancingState, targets, totalLoad);
      case 'weighted-round-robin':
        return this.distributeWeightedRoundRobin(loadBalancingState, targets, totalLoad);
      case 'least-connections':
        return this.distributeLeastConnections(loadBalancingState, targets, totalLoad);
      case 'least-response-time':
        return this.distributeLeastResponseTime(loadBalancingState, targets, totalLoad);
      default:
        const loadPerTarget = totalLoad / targets.length;
        return targets.map(target => ({
          targetNodeId: target.id,
          load: loadPerTarget
        }));
    }
  }

  /**
   * Round-robin load distribution
   */
  private distributeRoundRobin(state: LoadBalancingState, targets: SystemGraphNode[], totalLoad: number): LoadDistribution[] {
    if (targets.length === 0) return [];

    const selectedTarget = targets[state.currentIndex % targets.length];
    state.currentIndex = (state.currentIndex + 1) % targets.length;

    return [{
      targetNodeId: selectedTarget.id,
      load: totalLoad
    }];
  }

  /**
   * Weighted round-robin load distribution
   */
  private distributeWeightedRoundRobin(state: LoadBalancingState, targets: SystemGraphNode[], totalLoad: number): LoadDistribution[] {
    const distributions: LoadDistribution[] = [];
    
    for (const target of targets) {
      const targetState = state.targets.find(t => t.nodeId === target.id);
      if (!targetState || !targetState.isHealthy) continue;

      const weightRatio = targetState.weight / state.totalWeight;
      const targetLoad = totalLoad * weightRatio;

      distributions.push({
        targetNodeId: target.id,
        load: targetLoad
      });
    }

    return distributions;
  }

  /**
   * Least connections load distribution
   */
  private distributeLeastConnections(state: LoadBalancingState, targets: SystemGraphNode[], totalLoad: number): LoadDistribution[] {
    // Find target with least connections
    let selectedTarget: SystemGraphNode | null = null;
    let minConnections = Infinity;

    for (const target of targets) {
      const targetState = state.targets.find(t => t.nodeId === target.id);
      if (!targetState || !targetState.isHealthy) continue;

      if (targetState.currentConnections < minConnections) {
        minConnections = targetState.currentConnections;
        selectedTarget = target;
      }
    }

    if (!selectedTarget) return [];

    // Update connection count
    const targetState = state.targets.find(t => t.nodeId === selectedTarget!.id);
    if (targetState) {
      targetState.currentConnections++;
    }

    return [{
      targetNodeId: selectedTarget.id,
      load: totalLoad
    }];
  }

  /**
   * Least response time load distribution
   */
  private distributeLeastResponseTime(state: LoadBalancingState, targets: SystemGraphNode[], totalLoad: number): LoadDistribution[] {
    // Find target with least average response time
    let selectedTarget: SystemGraphNode | null = null;
    let minResponseTime = Infinity;

    for (const target of targets) {
      const targetState = state.targets.find(t => t.nodeId === target.id);
      if (!targetState || !targetState.isHealthy) continue;

      if (targetState.averageResponseTime < minResponseTime) {
        minResponseTime = targetState.averageResponseTime;
        selectedTarget = target;
      }
    }

    if (!selectedTarget) return [];

    return [{
      targetNodeId: selectedTarget.id,
      load: totalLoad
    }];
  }

  /**
   * Select targets based on shortest path routing
   */
  private selectShortestPathTargets(targets: SystemGraphNode[]): SystemGraphNode[] {
    // For simplicity, return all direct targets (shortest path = 1 hop)
    return targets;
  }

  /**
   * Select targets based on least latency
   */
  private selectLeastLatencyTargets(targets: SystemGraphNode[]): SystemGraphNode[] {
    if (targets.length <= 1) return targets;

    // Sort by base latency and return top 50%
    const sorted = targets.sort((a, b) => a.characteristics.baseLatency - b.characteristics.baseLatency);
    const topHalf = Math.ceil(sorted.length / 2);
    return sorted.slice(0, topHalf);
  }

  /**
   * Select targets based on highest capacity
   */
  private selectHighestCapacityTargets(targets: SystemGraphNode[]): SystemGraphNode[] {
    if (targets.length <= 1) return targets;

    // Sort by capacity and return top 50%
    const sorted = targets.sort((a, b) => b.characteristics.capacityLimit - a.characteristics.capacityLimit);
    const topHalf = Math.ceil(sorted.length / 2);
    return sorted.slice(0, topHalf);
  }

  /**
   * Select targets based on load-aware routing
   */
  private selectLoadAwareTargets(targets: SystemGraphNode[], priority: 'low' | 'normal' | 'high'): SystemGraphNode[] {
    const availableTargets = targets.filter(target => {
      // Check if target can handle additional load
      const utilizationThreshold = this.getUtilizationThreshold(priority);
      return target.currentUtilization < utilizationThreshold && target.isHealthy;
    });

    if (availableTargets.length === 0) {
      // If no targets available, return least loaded targets
      const sorted = targets.sort((a, b) => a.currentUtilization - b.currentUtilization);
      return sorted.slice(0, Math.ceil(sorted.length / 2));
    }

    return availableTargets;
  }

  /**
   * Get utilization threshold based on priority
   */
  private getUtilizationThreshold(priority: 'low' | 'normal' | 'high'): number {
    switch (priority) {
      case 'high': return 0.9; // High priority can use up to 90% utilization
      case 'normal': return 0.8; // Normal priority up to 80%
      case 'low': return 0.7; // Low priority up to 70%
    }
  }

  /**
   * Check if a node can handle additional load
   */
  private canNodeHandleLoad(node: SystemGraphNode, additionalLoad: number): boolean {
    const newLoad = node.currentLoad + additionalLoad;
    const newUtilization = newLoad / node.characteristics.capacityLimit;
    
    // Consider node healthy if utilization is below 95%
    return newUtilization < 0.95 && node.isHealthy;
  }

  /**
   * Apply backpressure to upstream components
   */
  private applyBackpressure(nodeId: string, blockedLoad: number): void {
    const upstreamNodes = this.systemGraph.getUpstreamComponents(nodeId);
    
    for (const upstreamNode of upstreamNodes) {
      // Reduce upstream node's effective capacity
      const backpressureReduction = blockedLoad * 0.5; // 50% of blocked load
      const newLoad = Math.max(0, upstreamNode.currentLoad - backpressureReduction);
      this.systemGraph.updateNodeLoad(upstreamNode.id, newLoad);
      
      // Schedule backpressure event
      this.eventScheduler.scheduleEvent({
        id: `backpressure_${upstreamNode.id}_${Date.now()}`,
        timestamp: Date.now(),
        type: 'load_change',
        componentId: upstreamNode.id,
        data: {
          type: 'backpressure',
          originalLoad: upstreamNode.currentLoad,
          reducedLoad: newLoad,
          reason: `Backpressure from ${nodeId}`
        }
      });
    }
  }

  /**
   * Initialize load balancing states for all components
   */
  private initializeLoadBalancingStates(): void {
    const allNodes = this.systemGraph.getAllComponents();
    
    for (const node of allNodes) {
      const downstreamNodes = this.systemGraph.getDownstreamComponents(node.id);
      
      if (downstreamNodes.length > 0) {
        const targets: LoadBalancingTarget[] = downstreamNodes.map(target => ({
          nodeId: target.id,
          weight: this.calculateNodeWeight(target),
          currentConnections: 0,
          averageResponseTime: target.characteristics.baseLatency,
          isHealthy: target.isHealthy,
          capacity: target.characteristics.capacityLimit,
          currentLoad: target.currentLoad
        }));

        const totalWeight = targets.reduce((sum, target) => sum + target.weight, 0);

        this.loadBalancingStates.set(node.id, {
          componentId: node.id,
          algorithm: this.config.loadBalancingAlgorithm,
          targets,
          currentIndex: 0,
          totalWeight,
          lastUpdate: Date.now()
        });
      }
    }
  }

  /**
   * Calculate weight for a node based on its characteristics
   */
  private calculateNodeWeight(node: SystemGraphNode): number {
    // Weight based on capacity and inverse of latency
    const capacityWeight = node.characteristics.capacityLimit / 1000; // Normalize capacity
    const latencyWeight = 1000 / Math.max(node.characteristics.baseLatency, 1); // Inverse latency
    const healthWeight = node.isHealthy ? 1.0 : 0.1;
    
    return capacityWeight * latencyWeight * healthWeight;
  }

  /**
   * Get edges between two nodes
   */
  private getEdgesBetweenNodes(sourceNodeId: string, targetNodeId: string): SystemGraphEdge[] {
    const sourceNode = this.systemGraph.getNode(sourceNodeId);
    if (!sourceNode) return [];

    return sourceNode.outgoingEdges.filter(edge => edge.targetNodeId === targetNodeId);
  }

  /**
   * Calculate route latency between two nodes
   */
  private calculateRouteLatency(sourceNode: SystemGraphNode, targetNode: SystemGraphNode): number {
    const sourceLatency = this.calculateNodeLatency(sourceNode);
    const targetLatency = this.calculateNodeLatency(targetNode);
    
    // Add connection latency
    const edges = this.getEdgesBetweenNodes(sourceNode.id, targetNode.id);
    const connectionLatency = edges.reduce((sum, edge) => sum + edge.latency, 0);
    
    return sourceLatency + connectionLatency + targetLatency;
  }

  /**
   * Calculate current latency for a node
   */
  private calculateNodeLatency(node: SystemGraphNode): number {
    const baseLatency = node.characteristics.baseLatency;
    const utilization = node.currentUtilization;
    
    // Simple latency curve: latency increases with utilization
    const latencyMultiplier = 1 + (utilization * 2); // 2x latency at 100% utilization
    
    return baseLatency * latencyMultiplier;
  }

  /**
   * Schedule load propagation event
   */
  private scheduleLoadPropagationEvent(route: RequestRoute, load: number): void {
    this.eventScheduler.scheduleEvent({
      id: `load_propagation_${route.requestId}`,
      timestamp: Date.now() + route.totalLatency,
      type: 'request_arrival',
      componentId: route.targetNodeId,
      data: {
        requestId: route.requestId,
        sourceNodeId: route.sourceNodeId,
        load,
        priority: route.priority,
        route
      }
    });
  }

  /**
   * Update load balancing target health
   */
  updateTargetHealth(sourceNodeId: string, targetNodeId: string, isHealthy: boolean): void {
    const state = this.loadBalancingStates.get(sourceNodeId);
    if (!state) return;

    const target = state.targets.find(t => t.nodeId === targetNodeId);
    if (target) {
      target.isHealthy = isHealthy;
      
      // Recalculate total weight if needed
      if (state.algorithm === 'weighted-round-robin') {
        state.totalWeight = state.targets
          .filter(t => t.isHealthy)
          .reduce((sum, t) => sum + t.weight, 0);
      }
    }
  }

  /**
   * Update target response time
   */
  updateTargetResponseTime(sourceNodeId: string, targetNodeId: string, responseTime: number): void {
    const state = this.loadBalancingStates.get(sourceNodeId);
    if (!state) return;

    const target = state.targets.find(t => t.nodeId === targetNodeId);
    if (target) {
      // Exponential moving average
      const alpha = 0.1;
      target.averageResponseTime = (1 - alpha) * target.averageResponseTime + alpha * responseTime;
    }
  }

  /**
   * Get load propagation statistics
   */
  getLoadPropagationStatistics(): LoadPropagationStatistics {
    const totalRoutes = this.activeRoutes.size;
    const totalDecisions = this.routingDecisions.size;
    
    const algorithmUsage = new Map<string, number>();
    for (const state of this.loadBalancingStates.values()) {
      const count = algorithmUsage.get(state.algorithm) || 0;
      algorithmUsage.set(state.algorithm, count + 1);
    }

    return {
      totalActiveRoutes: totalRoutes,
      totalRoutingDecisions: totalDecisions,
      loadBalancingAlgorithmUsage: Object.fromEntries(algorithmUsage),
      averageRouteLatency: this.calculateAverageRouteLatency(),
      propagationStrategy: this.config.propagationStrategy,
      routingPolicy: this.config.routingPolicy
    };
  }

  /**
   * Calculate average route latency
   */
  private calculateAverageRouteLatency(): number {
    const routes = Array.from(this.activeRoutes.values());
    if (routes.length === 0) return 0;

    const totalLatency = routes.reduce((sum, route) => sum + route.totalLatency, 0);
    return totalLatency / routes.length;
  }

  /**
   * Clear all propagation state
   */
  clear(): void {
    this.loadBalancingStates.clear();
    this.activeRoutes.clear();
    this.routingDecisions.clear();
    this.propagationStats.clear();
  }
}

// Supporting interfaces
interface LoadDistribution {
  targetNodeId: string;
  load: number;
}

export interface LoadPropagationStatistics {
  totalActiveRoutes: number;
  totalRoutingDecisions: number;
  loadBalancingAlgorithmUsage: Record<string, number>;
  averageRouteLatency: number;
  propagationStrategy: string;
  routingPolicy: string;
}