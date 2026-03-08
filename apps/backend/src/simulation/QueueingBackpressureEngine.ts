/**
 * Queueing and Backpressure Engine implementing SRS FR-4.3
 * 
 * Implements queueing theory calculations (M/M/1, M/M/c) per SRS FR-4.3
 * Creates backpressure propagation through system graph per SRS FR-4.3
 * Adds queue overflow and capacity handling per SRS FR-4.3
 */

import { EventScheduler, SimulationEvent } from './types';
import { SystemGraphEngine, SystemGraphNode } from './SystemGraphEngine';

// Queueing theory models
export type QueueModel = 'M/M/1' | 'M/M/c' | 'M/G/1' | 'G/M/1' | 'G/G/1';

// Queue configuration
export interface QueueConfiguration {
  model: QueueModel;
  serviceRate: number; // μ (requests per second)
  serverCount: number; // c (number of servers)
  maxQueueSize: number; // maximum queue capacity
  dropPolicy: 'tail-drop' | 'head-drop' | 'random-drop' | 'priority-drop';
  priorityLevels: number; // number of priority levels
}

// Queue state information
export interface QueueState {
  componentId: string;
  model: QueueModel;
  queueLength: number;
  maxCapacity: number;
  serviceRate: number;
  serverCount: number;
  arrivalRate: number; // λ (requests per second)
  utilization: number; // ρ = λ/(μ*c)
  averageWaitTime: number; // W (seconds)
  averageSystemTime: number; // T (seconds)
  averageQueueLength: number; // L (requests)
  averageSystemLength: number; // N (requests)
  throughput: number; // effective throughput
  droppedRequests: number;
  totalArrivals: number;
  totalDepartures: number;
  lastUpdate: number;
}

// Backpressure state
export interface BackpressureState {
  componentId: string;
  level: number; // 0-1 (0 = no backpressure, 1 = maximum backpressure)
  upstreamComponents: string[];
  downstreamComponents: string[];
  propagationDelay: number; // milliseconds
  throttleRate: number; // 0-1 (rate reduction factor)
  isActive: boolean;
  activationThreshold: number; // utilization threshold to activate backpressure
  deactivationThreshold: number; // utilization threshold to deactivate backpressure
  lastPropagation: number;
}

// Request priority information
export interface PriorityRequest {
  id: string;
  priority: number; // 0 = highest priority
  arrivalTime: number;
  serviceTime: number;
  deadline?: number;
}

// Queue overflow handling result
export interface OverflowHandlingResult {
  action: 'queued' | 'dropped' | 'redirected';
  droppedRequestId?: string;
  redirectTarget?: string;
  reason: string;
}

// Queueing metrics
export interface QueueingMetrics {
  componentId: string;
  timestamp: number;
  queueLength: number;
  utilization: number;
  waitTime: number;
  throughput: number;
  dropRate: number;
  responseTime: number;
}

/**
 * Queueing and Backpressure Engine
 * Implements SRS FR-4.3 requirements
 */
export class QueueingBackpressureEngine {
  private systemGraph: SystemGraphEngine;
  private eventScheduler: EventScheduler;
  private queueStates: Map<string, QueueState>;
  private backpressureStates: Map<string, BackpressureState>;
  private queueConfigurations: Map<string, QueueConfiguration>;
  private priorityQueues: Map<string, PriorityRequest[][]>; // componentId -> priority levels -> requests
  private metricsHistory: Map<string, QueueingMetrics[]>;

  constructor(systemGraph: SystemGraphEngine, eventScheduler: EventScheduler) {
    this.systemGraph = systemGraph;
    this.eventScheduler = eventScheduler;
    this.queueStates = new Map();
    this.backpressureStates = new Map();
    this.queueConfigurations = new Map();
    this.priorityQueues = new Map();
    this.metricsHistory = new Map();
  }

  /**
   * Initialize queueing and backpressure modeling
   * Implements SRS FR-4.3: Queueing theory calculations
   */
  initializeQueueing(): void {
    const allNodes = this.systemGraph.getAllComponents();
    
    for (const node of allNodes) {
      // Initialize queue configuration based on component type
      const queueConfig = this.createQueueConfiguration(node);
      this.queueConfigurations.set(node.id, queueConfig);
      
      // Initialize queue state
      const queueState = this.createInitialQueueState(node, queueConfig);
      this.queueStates.set(node.id, queueState);
      
      // Initialize backpressure state
      const backpressureState = this.createInitialBackpressureState(node);
      this.backpressureStates.set(node.id, backpressureState);
      
      // Initialize priority queues
      this.initializePriorityQueues(node.id, queueConfig.priorityLevels);
      
      // Initialize metrics history
      this.metricsHistory.set(node.id, []);
    }
  }

  /**
   * Process request arrival at a component queue
   * Implements SRS FR-4.3: Queue overflow and capacity handling
   */
  processRequestArrival(componentId: string, requestId: string, priority: number = 1, serviceTime?: number): OverflowHandlingResult {
    const queueState = this.queueStates.get(componentId);
    const queueConfig = this.queueConfigurations.get(componentId);
    
    if (!queueState || !queueConfig) {
      return {
        action: 'dropped',
        reason: `Queue not found for component ${componentId}`
      };
    }

    // Update arrival statistics
    queueState.totalArrivals++;
    queueState.arrivalRate = this.calculateArrivalRate(componentId);

    // Check if queue is at capacity
    if (queueState.queueLength >= queueState.maxCapacity) {
      return this.handleQueueOverflow(componentId, requestId, priority);
    }

    // Create priority request
    const priorityRequest: PriorityRequest = {
      id: requestId,
      priority,
      arrivalTime: Date.now(),
      serviceTime: serviceTime || this.calculateServiceTime(queueConfig)
    };

    // Add to appropriate priority queue
    const priorityQueues = this.priorityQueues.get(componentId);
    if (priorityQueues && priority < priorityQueues.length) {
      priorityQueues[priority].push(priorityRequest);
      queueState.queueLength++;
      
      // Update queue metrics
      this.updateQueueMetrics(componentId);
      
      // Check for backpressure activation
      this.checkBackpressureActivation(componentId);
      
      // Schedule service completion if servers are available
      this.scheduleServiceIfAvailable(componentId);
      
      return {
        action: 'queued',
        reason: `Request queued with priority ${priority}`
      };
    }

    return {
      action: 'dropped',
      reason: `Invalid priority level ${priority}`
    };
  }

  /**
   * Process request service completion
   */
  processServiceCompletion(componentId: string, requestId: string): void {
    const queueState = this.queueStates.get(componentId);
    if (!queueState) return;

    // Update departure statistics
    queueState.totalDepartures++;
    queueState.queueLength = Math.max(0, queueState.queueLength - 1);
    
    // Update queue metrics
    this.updateQueueMetrics(componentId);
    
    // Check for backpressure deactivation
    this.checkBackpressureDeactivation(componentId);
    
    // Schedule next service if queue is not empty
    this.scheduleServiceIfAvailable(componentId);
  }

  /**
   * Update queue metrics using queueing theory formulas
   * Implements SRS FR-4.3: M/M/1 and M/M/c queue calculations
   */
  private updateQueueMetrics(componentId: string): void {
    const queueState = this.queueStates.get(componentId);
    if (!queueState) return;

    const lambda = queueState.arrivalRate;
    const mu = queueState.serviceRate;
    const c = queueState.serverCount;
    const rho = lambda / (mu * c); // utilization

    queueState.utilization = Math.min(rho, 1.0);

    // Calculate metrics based on queue model
    switch (queueState.model) {
      case 'M/M/1':
        this.calculateMM1Metrics(queueState, lambda, mu);
        break;
      case 'M/M/c':
        this.calculateMMcMetrics(queueState, lambda, mu, c);
        break;
      case 'M/G/1':
        this.calculateMG1Metrics(queueState, lambda, mu);
        break;
      default:
        this.calculateApproximateMetrics(queueState, lambda, mu, c);
    }

    // Update throughput (effective service rate)
    queueState.throughput = Math.min(lambda, mu * c);

    // Store metrics for history
    this.storeQueueingMetrics(componentId, queueState);
    
    queueState.lastUpdate = Date.now();
  }

  /**
   * Calculate M/M/1 queue metrics
   */
  private calculateMM1Metrics(queueState: QueueState, lambda: number, mu: number): void {
    const rho = lambda / mu;
    
    if (rho >= 1) {
      // System is unstable
      queueState.averageWaitTime = Infinity;
      queueState.averageSystemTime = Infinity;
      queueState.averageQueueLength = Infinity;
      queueState.averageSystemLength = Infinity;
      return;
    }

    // Little's Law and M/M/1 formulas
    queueState.averageSystemLength = rho / (1 - rho); // N = ρ/(1-ρ)
    queueState.averageQueueLength = (rho * rho) / (1 - rho); // L = ρ²/(1-ρ)
    queueState.averageSystemTime = 1 / (mu - lambda); // T = 1/(μ-λ)
    queueState.averageWaitTime = rho / (mu - lambda); // W = ρ/(μ-λ)
  }

  /**
   * Calculate M/M/c queue metrics using Erlang-C formula
   */
  private calculateMMcMetrics(queueState: QueueState, lambda: number, mu: number, c: number): void {
    const rho = lambda / mu;
    const utilization = rho / c;
    
    if (utilization >= 1) {
      // System is unstable
      queueState.averageWaitTime = Infinity;
      queueState.averageSystemTime = Infinity;
      queueState.averageQueueLength = Infinity;
      queueState.averageSystemLength = Infinity;
      return;
    }

    // Calculate Erlang-C probability
    const erlangC = this.calculateErlangC(rho, c);
    
    // M/M/c formulas
    queueState.averageWaitTime = (erlangC / (c * mu - lambda)); // W = C(c,ρ)/(cμ-λ)
    queueState.averageSystemTime = queueState.averageWaitTime + (1 / mu); // T = W + 1/μ
    queueState.averageQueueLength = lambda * queueState.averageWaitTime; // L = λW
    queueState.averageSystemLength = lambda * queueState.averageSystemTime; // N = λT
  }

  /**
   * Calculate M/G/1 queue metrics using Pollaczek-Khinchine formula
   */
  private calculateMG1Metrics(queueState: QueueState, lambda: number, mu: number): void {
    const rho = lambda / mu;
    
    if (rho >= 1) {
      queueState.averageWaitTime = Infinity;
      queueState.averageSystemTime = Infinity;
      queueState.averageQueueLength = Infinity;
      queueState.averageSystemLength = Infinity;
      return;
    }

    // Assume coefficient of variation = 1 for exponential service times
    const cv2 = 1.0; // coefficient of variation squared
    
    // Pollaczek-Khinchine formula
    queueState.averageWaitTime = (rho * (1 + cv2)) / (2 * (1 - rho) * mu);
    queueState.averageSystemTime = queueState.averageWaitTime + (1 / mu);
    queueState.averageQueueLength = lambda * queueState.averageWaitTime;
    queueState.averageSystemLength = lambda * queueState.averageSystemTime;
  }

  /**
   * Calculate approximate metrics for general queues
   */
  private calculateApproximateMetrics(queueState: QueueState, lambda: number, mu: number, c: number): void {
    const rho = lambda / (mu * c);
    
    if (rho >= 1) {
      queueState.averageWaitTime = Infinity;
      queueState.averageSystemTime = Infinity;
      queueState.averageQueueLength = Infinity;
      queueState.averageSystemLength = Infinity;
      return;
    }

    // Simple approximations
    queueState.averageSystemTime = 1 / (mu - lambda / c);
    queueState.averageWaitTime = queueState.averageSystemTime - (1 / mu);
    queueState.averageQueueLength = lambda * queueState.averageWaitTime;
    queueState.averageSystemLength = lambda * queueState.averageSystemTime;
  }

  /**
   * Calculate Erlang-C probability for M/M/c queues
   */
  private calculateErlangC(rho: number, c: number): number {
    // Calculate (ρ^c / c!) / [sum(ρ^k / k!) for k=0 to c-1 + (ρ^c / c!) * c/(c-ρ)]
    
    let sum = 0;
    for (let k = 0; k < c; k++) {
      sum += Math.pow(rho, k) / this.factorial(k);
    }
    
    const rhoPowerC = Math.pow(rho, c);
    const cFactorial = this.factorial(c);
    const numerator = rhoPowerC / cFactorial;
    const denominator = sum + (numerator * c) / (c - rho);
    
    return numerator / denominator;
  }

  /**
   * Calculate factorial
   */
  private factorial(n: number): number {
    if (n <= 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) {
      result *= i;
    }
    return result;
  }

  /**
   * Handle queue overflow
   * Implements SRS FR-4.3: Queue overflow and capacity handling
   */
  private handleQueueOverflow(componentId: string, requestId: string, priority: number): OverflowHandlingResult {
    const queueConfig = this.queueConfigurations.get(componentId);
    const queueState = this.queueStates.get(componentId);
    
    if (!queueConfig || !queueState) {
      return {
        action: 'dropped',
        reason: 'Queue configuration not found'
      };
    }

    queueState.droppedRequests++;

    switch (queueConfig.dropPolicy) {
      case 'tail-drop':
        return {
          action: 'dropped',
          droppedRequestId: requestId,
          reason: 'Queue full - tail drop policy'
        };
        
      case 'head-drop':
        return this.handleHeadDrop(componentId, requestId, priority);
        
      case 'random-drop':
        return this.handleRandomDrop(componentId, requestId, priority);
        
      case 'priority-drop':
        return this.handlePriorityDrop(componentId, requestId, priority);
        
      default:
        return {
          action: 'dropped',
          droppedRequestId: requestId,
          reason: 'Queue full - default drop policy'
        };
    }
  }

  /**
   * Handle head drop policy
   */
  private handleHeadDrop(componentId: string, requestId: string, priority: number): OverflowHandlingResult {
    const priorityQueues = this.priorityQueues.get(componentId);
    if (!priorityQueues) {
      return { action: 'dropped', reason: 'Priority queues not found' };
    }

    // Drop the oldest request from the highest priority queue that has requests
    for (let p = 0; p < priorityQueues.length; p++) {
      if (priorityQueues[p].length > 0) {
        const droppedRequest = priorityQueues[p].shift();
        
        // Add new request to appropriate priority queue
        if (priority < priorityQueues.length) {
          priorityQueues[priority].push({
            id: requestId,
            priority,
            arrivalTime: Date.now(),
            serviceTime: this.calculateServiceTime(this.queueConfigurations.get(componentId)!)
          });
          
          return {
            action: 'queued',
            droppedRequestId: droppedRequest?.id,
            reason: 'Head drop - oldest request dropped'
          };
        }
        break;
      }
    }

    return {
      action: 'dropped',
      droppedRequestId: requestId,
      reason: 'Queue full - head drop failed'
    };
  }

  /**
   * Handle random drop policy
   */
  private handleRandomDrop(componentId: string, requestId: string, priority: number): OverflowHandlingResult {
    const priorityQueues = this.priorityQueues.get(componentId);
    if (!priorityQueues) {
      return { action: 'dropped', reason: 'Priority queues not found' };
    }

    // Find all requests across all priority levels
    const allRequests: { request: PriorityRequest, queueIndex: number, requestIndex: number }[] = [];
    
    for (let p = 0; p < priorityQueues.length; p++) {
      for (let r = 0; r < priorityQueues[p].length; r++) {
        allRequests.push({
          request: priorityQueues[p][r],
          queueIndex: p,
          requestIndex: r
        });
      }
    }

    if (allRequests.length > 0) {
      // Randomly select a request to drop
      const randomIndex = Math.floor(Math.random() * allRequests.length);
      const selectedRequest = allRequests[randomIndex];
      
      // Remove the selected request
      priorityQueues[selectedRequest.queueIndex].splice(selectedRequest.requestIndex, 1);
      
      // Add new request
      if (priority < priorityQueues.length) {
        priorityQueues[priority].push({
          id: requestId,
          priority,
          arrivalTime: Date.now(),
          serviceTime: this.calculateServiceTime(this.queueConfigurations.get(componentId)!)
        });
        
        return {
          action: 'queued',
          droppedRequestId: selectedRequest.request.id,
          reason: 'Random drop - randomly selected request dropped'
        };
      }
    }

    return {
      action: 'dropped',
      droppedRequestId: requestId,
      reason: 'Queue full - random drop failed'
    };
  }

  /**
   * Handle priority drop policy
   */
  private handlePriorityDrop(componentId: string, requestId: string, priority: number): OverflowHandlingResult {
    const priorityQueues = this.priorityQueues.get(componentId);
    if (!priorityQueues) {
      return { action: 'dropped', reason: 'Priority queues not found' };
    }

    // Try to drop a lower priority request
    for (let p = priorityQueues.length - 1; p > priority; p--) {
      if (priorityQueues[p].length > 0) {
        const droppedRequest = priorityQueues[p].pop();
        
        // Add new higher priority request
        priorityQueues[priority].push({
          id: requestId,
          priority,
          arrivalTime: Date.now(),
          serviceTime: this.calculateServiceTime(this.queueConfigurations.get(componentId)!)
        });
        
        return {
          action: 'queued',
          droppedRequestId: droppedRequest?.id,
          reason: 'Priority drop - lower priority request dropped'
        };
      }
    }

    return {
      action: 'dropped',
      droppedRequestId: requestId,
      reason: 'Queue full - no lower priority requests to drop'
    };
  }

  /**
   * Check and activate backpressure
   * Implements SRS FR-4.3: Backpressure propagation through system graph
   */
  private checkBackpressureActivation(componentId: string): void {
    const queueState = this.queueStates.get(componentId);
    const backpressureState = this.backpressureStates.get(componentId);
    
    if (!queueState || !backpressureState) return;

    if (!backpressureState.isActive && queueState.utilization >= backpressureState.activationThreshold) {
      this.activateBackpressure(componentId);
    }
  }

  /**
   * Check and deactivate backpressure
   */
  private checkBackpressureDeactivation(componentId: string): void {
    const queueState = this.queueStates.get(componentId);
    const backpressureState = this.backpressureStates.get(componentId);
    
    if (!queueState || !backpressureState) return;

    if (backpressureState.isActive && queueState.utilization <= backpressureState.deactivationThreshold) {
      this.deactivateBackpressure(componentId);
    }
  }

  /**
   * Activate backpressure for a component
   */
  private activateBackpressure(componentId: string): void {
    const backpressureState = this.backpressureStates.get(componentId);
    const queueState = this.queueStates.get(componentId);
    
    if (!backpressureState || !queueState) return;

    backpressureState.isActive = true;
    backpressureState.level = Math.min(1.0, queueState.utilization);
    backpressureState.throttleRate = Math.max(0.1, 1.0 - backpressureState.level);
    
    // Propagate backpressure to upstream components
    this.propagateBackpressure(componentId);
    
    // Schedule backpressure event
    this.eventScheduler.scheduleEvent({
      id: `backpressure_activated_${componentId}`,
      timestamp: Date.now(),
      type: 'load_change',
      componentId,
      data: {
        type: 'backpressure_activated',
        level: backpressureState.level,
        throttleRate: backpressureState.throttleRate
      }
    });
  }

  /**
   * Deactivate backpressure for a component
   */
  private deactivateBackpressure(componentId: string): void {
    const backpressureState = this.backpressureStates.get(componentId);
    
    if (!backpressureState) return;

    backpressureState.isActive = false;
    backpressureState.level = 0;
    backpressureState.throttleRate = 1.0;
    
    // Notify upstream components that backpressure is released
    this.releaseBackpressure(componentId);
    
    // Schedule backpressure release event
    this.eventScheduler.scheduleEvent({
      id: `backpressure_deactivated_${componentId}`,
      timestamp: Date.now(),
      type: 'load_change',
      componentId,
      data: {
        type: 'backpressure_deactivated'
      }
    });
  }

  /**
   * Propagate backpressure to upstream components
   */
  private propagateBackpressure(componentId: string): void {
    const backpressureState = this.backpressureStates.get(componentId);
    if (!backpressureState) return;

    const upstreamComponents = this.systemGraph.getUpstreamComponents(componentId);
    
    for (const upstreamComponent of upstreamComponents) {
      const upstreamBackpressure = this.backpressureStates.get(upstreamComponent.id);
      if (!upstreamBackpressure) continue;

      // Propagate backpressure with attenuation
      const propagatedLevel = backpressureState.level * 0.7; // 70% of original level
      
      if (propagatedLevel > upstreamBackpressure.level) {
        upstreamBackpressure.level = propagatedLevel;
        upstreamBackpressure.throttleRate = Math.max(0.1, 1.0 - propagatedLevel);
        
        // Schedule propagation event with delay
        this.eventScheduler.scheduleEvent({
          id: `backpressure_propagated_${upstreamComponent.id}`,
          timestamp: Date.now() + backpressureState.propagationDelay,
          type: 'load_change',
          componentId: upstreamComponent.id,
          data: {
            type: 'backpressure_propagated',
            sourceComponent: componentId,
            level: propagatedLevel,
            throttleRate: upstreamBackpressure.throttleRate
          }
        });
      }
    }
    
    backpressureState.lastPropagation = Date.now();
  }

  /**
   * Release backpressure from upstream components
   */
  private releaseBackpressure(componentId: string): void {
    const upstreamComponents = this.systemGraph.getUpstreamComponents(componentId);
    
    for (const upstreamComponent of upstreamComponents) {
      const upstreamBackpressure = this.backpressureStates.get(upstreamComponent.id);
      if (!upstreamBackpressure) continue;

      // Gradually release backpressure
      upstreamBackpressure.level = Math.max(0, upstreamBackpressure.level - 0.3);
      upstreamBackpressure.throttleRate = Math.min(1.0, upstreamBackpressure.throttleRate + 0.3);
      
      if (upstreamBackpressure.level <= 0.1) {
        upstreamBackpressure.isActive = false;
        upstreamBackpressure.level = 0;
        upstreamBackpressure.throttleRate = 1.0;
      }
    }
  }

  /**
   * Schedule service if servers are available
   */
  private scheduleServiceIfAvailable(componentId: string): void {
    const queueState = this.queueStates.get(componentId);
    const priorityQueues = this.priorityQueues.get(componentId);
    
    if (!queueState || !priorityQueues) return;

    // Check if there are available servers and requests in queue
    const busyServers = this.getBusyServerCount(componentId);
    const availableServers = queueState.serverCount - busyServers;
    
    if (availableServers > 0 && queueState.queueLength > 0) {
      // Find highest priority request
      for (let p = 0; p < priorityQueues.length; p++) {
        if (priorityQueues[p].length > 0) {
          const request = priorityQueues[p].shift()!;
          
          // Schedule service completion
          this.eventScheduler.scheduleEvent({
            id: `service_completion_${request.id}`,
            timestamp: Date.now() + request.serviceTime * 1000,
            type: 'request_completion',
            componentId,
            data: {
              requestId: request.id,
              priority: request.priority,
              serviceTime: request.serviceTime
            }
          });
          
          break;
        }
      }
    }
  }

  /**
   * Helper methods
   */
  private createQueueConfiguration(node: SystemGraphNode): QueueConfiguration {
    // Create configuration based on component type
    const baseConfig: QueueConfiguration = {
      model: 'M/M/c',
      serviceRate: node.characteristics.maxThroughput / node.characteristics.capacityLimit,
      serverCount: Math.max(1, Math.floor(node.characteristics.capacityLimit / 10)),
      maxQueueSize: node.characteristics.capacityLimit * 2,
      dropPolicy: 'tail-drop',
      priorityLevels: 3
    };

    // Adjust based on component type
    switch (node.type) {
      case 'Database':
        baseConfig.model = 'M/G/1';
        baseConfig.serverCount = Math.min(baseConfig.serverCount, 10);
        baseConfig.dropPolicy = 'priority-drop';
        break;
      case 'Cache':
        baseConfig.model = 'M/M/c';
        baseConfig.serverCount = Math.max(baseConfig.serverCount, 4);
        baseConfig.dropPolicy = 'random-drop';
        break;
      case 'Queue':
        baseConfig.maxQueueSize = node.characteristics.capacityLimit * 10;
        baseConfig.dropPolicy = 'tail-drop';
        break;
      case 'LoadBalancer':
        baseConfig.model = 'M/M/c';
        baseConfig.serverCount = Math.max(baseConfig.serverCount, 2);
        break;
    }

    return baseConfig;
  }

  private createInitialQueueState(node: SystemGraphNode, config: QueueConfiguration): QueueState {
    return {
      componentId: node.id,
      model: config.model,
      queueLength: 0,
      maxCapacity: config.maxQueueSize,
      serviceRate: config.serviceRate,
      serverCount: config.serverCount,
      arrivalRate: 0,
      utilization: 0,
      averageWaitTime: 0,
      averageSystemTime: 1 / config.serviceRate,
      averageQueueLength: 0,
      averageSystemLength: 0,
      throughput: 0,
      droppedRequests: 0,
      totalArrivals: 0,
      totalDepartures: 0,
      lastUpdate: Date.now()
    };
  }

  private createInitialBackpressureState(node: SystemGraphNode): BackpressureState {
    const upstreamComponents = this.systemGraph.getUpstreamComponents(node.id);
    const downstreamComponents = this.systemGraph.getDownstreamComponents(node.id);

    return {
      componentId: node.id,
      level: 0,
      upstreamComponents: upstreamComponents.map(c => c.id),
      downstreamComponents: downstreamComponents.map(c => c.id),
      propagationDelay: 100, // 100ms propagation delay
      throttleRate: 1.0,
      isActive: false,
      activationThreshold: 0.8, // Activate at 80% utilization
      deactivationThreshold: 0.6, // Deactivate at 60% utilization
      lastPropagation: 0
    };
  }

  private initializePriorityQueues(componentId: string, priorityLevels: number): void {
    const queues: PriorityRequest[][] = [];
    for (let i = 0; i < priorityLevels; i++) {
      queues.push([]);
    }
    this.priorityQueues.set(componentId, queues);
  }

  private calculateArrivalRate(componentId: string): number {
    const queueState = this.queueStates.get(componentId);
    if (!queueState) return 0;

    // Simple moving average over last 10 seconds
    const timeWindow = 10000; // 10 seconds
    const currentTime = Date.now();
    const recentArrivals = queueState.totalArrivals; // Simplified - should track time-windowed arrivals
    
    return recentArrivals / (timeWindow / 1000);
  }

  private calculateServiceTime(config: QueueConfiguration): number {
    // Exponential distribution with mean 1/μ
    const mean = 1 / config.serviceRate;
    return -Math.log(Math.random()) * mean;
  }

  private getBusyServerCount(componentId: string): number {
    // Simplified - should track actual busy servers
    const queueState = this.queueStates.get(componentId);
    if (!queueState) return 0;
    
    return Math.min(queueState.serverCount, queueState.queueLength);
  }

  private storeQueueingMetrics(componentId: string, queueState: QueueState): void {
    const metrics: QueueingMetrics = {
      componentId,
      timestamp: Date.now(),
      queueLength: queueState.queueLength,
      utilization: queueState.utilization,
      waitTime: queueState.averageWaitTime,
      throughput: queueState.throughput,
      dropRate: queueState.droppedRequests / Math.max(queueState.totalArrivals, 1),
      responseTime: queueState.averageSystemTime
    };

    const history = this.metricsHistory.get(componentId) || [];
    history.push(metrics);
    
    // Keep only last 1000 metrics
    if (history.length > 1000) {
      history.shift();
    }
    
    this.metricsHistory.set(componentId, history);
  }

  /**
   * Get queue state for a component
   */
  getQueueState(componentId: string): QueueState | undefined {
    return this.queueStates.get(componentId);
  }

  /**
   * Get backpressure state for a component
   */
  getBackpressureState(componentId: string): BackpressureState | undefined {
    return this.backpressureStates.get(componentId);
  }

  /**
   * Get queueing metrics history
   */
  getMetricsHistory(componentId: string): QueueingMetrics[] {
    return this.metricsHistory.get(componentId) || [];
  }

  /**
   * Get all queue states
   */
  getAllQueueStates(): Map<string, QueueState> {
    return new Map(this.queueStates);
  }

  /**
   * Get all backpressure states
   */
  getAllBackpressureStates(): Map<string, BackpressureState> {
    return new Map(this.backpressureStates);
  }

  /**
   * Clear all state
   */
  clear(): void {
    this.queueStates.clear();
    this.backpressureStates.clear();
    this.queueConfigurations.clear();
    this.priorityQueues.clear();
    this.metricsHistory.clear();
  }
}