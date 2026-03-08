/**
 * Load Balancer Service
 * 
 * Implements intelligent request distribution across scaling nodes
 * Supports multiple load balancing algorithms and health checking
 */

import { EventEmitter } from 'events';
import { Request, Response, NextFunction } from 'express';
import { HorizontalScalingService, ScalingNode } from './horizontalScalingService';
import { getRedisClient } from '../config/redis';
import { RedisClientType } from 'redis';

export interface LoadBalancerStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  requestsPerSecond: number;
  nodeStats: Record<string, {
    requests: number;
    failures: number;
    averageResponseTime: number;
    lastUsed: Date;
  }>;
}

export interface RoutingRule {
  id: string;
  name: string;
  condition: {
    type: 'path' | 'header' | 'query' | 'method' | 'user_tier';
    key?: string;
    value: string;
    operator: 'equals' | 'contains' | 'starts_with' | 'regex';
  };
  target: {
    nodeType: string;
    specificNodeId?: string;
    weight?: number;
  };
  priority: number;
  enabled: boolean;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number; // milliseconds
  halfOpenMaxCalls: number;
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half_open';
  failureCount: number;
  lastFailureTime: Date | null;
  nextAttemptTime: Date | null;
  halfOpenCalls: number;
}

export class LoadBalancerService extends EventEmitter {
  private scalingService: HorizontalScalingService;
  private redis: RedisClientType;
  private stats: LoadBalancerStats;
  private routingRules: Map<string, RoutingRule> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private circuitBreakerConfig: CircuitBreakerConfig;
  private statsUpdateInterval: NodeJS.Timeout | null = null;
  private initialized: boolean = false;

  constructor(scalingService: HorizontalScalingService) {
    super();
    this.scalingService = scalingService;
    this.redis = getRedisClient();
    this.initialized = false;

    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      requestsPerSecond: 0,
      nodeStats: {}
    };

    this.circuitBreakerConfig = {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      halfOpenMaxCalls: 3
    };
  }

  /**
   * Initialize the service explicitly (must be called before use)
   */
  async initialize(): Promise<void> {
    if (!this.initialized) {
      await this.initializeService();
      this.initialized = true;
    }
  }

  /**
   * Initialize the load balancer service
   */
  private async initializeService(): Promise<void> {
    try {
      // Load routing rules from Redis
      await this.loadRoutingRules();
      
      // Start stats collection
      this.startStatsCollection();
      
      this.emit('service_initialized');
    } catch (error) {
      console.error('Failed to initialize load balancer service:', error);
      throw error;
    }
  }

  /**
   * Express middleware for load balancing
   */
  middleware(nodeType: string = 'api') {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const startTime = Date.now();

      try {
        // Check routing rules first
        const routingRule = this.findMatchingRoutingRule(req);
        let targetNodeType = nodeType;
        let specificNodeId: string | undefined;

        if (routingRule) {
          targetNodeType = routingRule.target.nodeType;
          specificNodeId = routingRule.target.specificNodeId;
        }

        // Select target node
        const targetNode = specificNodeId
          ? this.scalingService.getNodes().find(n => n.id === specificNodeId)
          : this.scalingService.selectNode(targetNodeType, {
              ip: req.ip,
              sessionId: (req as any).sessionID || (req as any).sessionId
            });

        if (!targetNode) {
          this.recordFailure(targetNodeType, startTime);
          res.status(503).json({
            error: 'Service temporarily unavailable',
            code: 'NO_AVAILABLE_NODES',
            nodeType: targetNodeType
          });
          return;
        }

        // Check circuit breaker
        if (this.isCircuitBreakerOpen(targetNode.id)) {
          this.recordFailure(targetNode.id, startTime);
          res.status(503).json({
            error: 'Service temporarily unavailable',
            code: 'CIRCUIT_BREAKER_OPEN',
            nodeId: targetNode.id
          });
          return;
        }

        // Add load balancer headers
        res.set({
          'X-Load-Balancer': 'system-design-simulator',
          'X-Target-Node': targetNode.id,
          'X-Node-Type': targetNode.type,
          'X-Node-Region': targetNode.region
        });

        // Store target node info for downstream middleware
        req.targetNode = targetNode;

        // Record successful routing
        this.recordSuccess(targetNode.id, startTime);

        next();

      } catch (error) {
        this.recordFailure(nodeType, startTime);
        console.error('Load balancer middleware error:', error);

        res.status(500).json({
          error: 'Load balancer error',
          code: 'LOAD_BALANCER_ERROR'
        });
      }
    };
  }

  /**
   * Proxy request to target node
   */
  async proxyRequest(req: Request, res: Response, targetNode: ScalingNode): Promise<void> {
    const startTime = Date.now();
    
    try {
      // In a real implementation, this would make an HTTP request to the target node
      // For now, we'll simulate the proxy behavior
      
      const proxyUrl = `${targetNode.endpoint}${req.path}`;
      
      // Simulate request forwarding
      const response = await this.forwardRequest(proxyUrl, {
        method: req.method,
        headers: req.headers,
        body: req.body,
        query: req.query
      });

      // Forward response
      res.status(response.status).json(response.data);
      
      this.recordSuccess(targetNode.id, startTime);
      
    } catch (error) {
      this.recordFailure(targetNode.id, startTime);
      this.updateCircuitBreaker(targetNode.id, false);
      
      console.error(`Proxy request failed for node ${targetNode.id}:`, error);
      
      res.status(502).json({
        error: 'Bad gateway',
        code: 'PROXY_ERROR',
        nodeId: targetNode.id
      });
    }
  }

  /**
   * Add routing rule
   */
  async addRoutingRule(rule: Omit<RoutingRule, 'id'>): Promise<string> {
    const ruleId = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const routingRule: RoutingRule = {
      ...rule,
      id: ruleId
    };

    this.routingRules.set(ruleId, routingRule);
    
    // Store in Redis
    await this.redis.hSet('load_balancer:routing_rules', ruleId, JSON.stringify(routingRule));
    
    this.emit('routing_rule_added', { ruleId, rule: routingRule });
    
    return ruleId;
  }

  /**
   * Remove routing rule
   */
  async removeRoutingRule(ruleId: string): Promise<void> {
    const rule = this.routingRules.get(ruleId);
    if (!rule) {
      throw new Error(`Routing rule ${ruleId} not found`);
    }

    this.routingRules.delete(ruleId);
    
    // Remove from Redis
    await this.redis.hDel('load_balancer:routing_rules', ruleId);
    
    this.emit('routing_rule_removed', { ruleId, rule });
  }

  /**
   * Get routing rules
   */
  getRoutingRules(): RoutingRule[] {
    return Array.from(this.routingRules.values())
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get load balancer statistics
   */
  getStats(): LoadBalancerStats {
    return { ...this.stats };
  }

  /**
   * Get circuit breaker states
   */
  getCircuitBreakerStates(): Record<string, CircuitBreakerState> {
    const states: Record<string, CircuitBreakerState> = {};
    
    for (const [nodeId, state] of this.circuitBreakers) {
      states[nodeId] = { ...state };
    }
    
    return states;
  }

  /**
   * Reset circuit breaker for a node
   */
  resetCircuitBreaker(nodeId: string): void {
    this.circuitBreakers.set(nodeId, {
      state: 'closed',
      failureCount: 0,
      lastFailureTime: null,
      nextAttemptTime: null,
      halfOpenCalls: 0
    });

    this.emit('circuit_breaker_reset', { nodeId });
  }

  /**
   * Get health status of all nodes
   */
  getHealthStatus(): Record<string, {
    healthy: boolean;
    circuitBreakerState: string;
    lastFailure?: Date;
    requestsPerMinute: number;
    errorRate: number;
  }> {
    const status: Record<string, any> = {};
    
    for (const node of this.scalingService.getNodes()) {
      const circuitBreaker = this.circuitBreakers.get(node.id);
      const nodeStats = this.stats.nodeStats[node.id];
      
      status[node.id] = {
        healthy: node.status === 'healthy' && (!circuitBreaker || circuitBreaker.state === 'closed'),
        circuitBreakerState: circuitBreaker?.state || 'closed',
        lastFailure: circuitBreaker?.lastFailureTime,
        requestsPerMinute: nodeStats ? nodeStats.requests : 0,
        errorRate: nodeStats ? (nodeStats.failures / Math.max(nodeStats.requests, 1)) * 100 : 0
      };
    }
    
    return status;
  }

  // Private methods

  /**
   * Load routing rules from Redis
   */
  private async loadRoutingRules(): Promise<void> {
    try {
      const rules = await this.redis.hGetAll('load_balancer:routing_rules');
      
      for (const [ruleId, ruleData] of Object.entries(rules)) {
        try {
          const rule: RoutingRule = JSON.parse(ruleData);
          this.routingRules.set(ruleId, rule);
        } catch (error) {
          console.error(`Failed to parse routing rule ${ruleId}:`, error);
        }
      }

      // Add default routing rules if none exist
      if (this.routingRules.size === 0) {
        await this.addDefaultRoutingRules();
      }

    } catch (error) {
      console.error('Failed to load routing rules:', error);
    }
  }

  /**
   * Add default routing rules
   */
  private async addDefaultRoutingRules(): Promise<void> {
    const defaultRules: Omit<RoutingRule, 'id'>[] = [
      {
        name: 'Simulation API Routes',
        condition: {
          type: 'path',
          value: '/api/simulations',
          operator: 'starts_with'
        },
        target: {
          nodeType: 'simulation'
        },
        priority: 100,
        enabled: true
      },
      {
        name: 'WebSocket Connections',
        condition: {
          type: 'header',
          key: 'upgrade',
          value: 'websocket',
          operator: 'equals'
        },
        target: {
          nodeType: 'websocket'
        },
        priority: 200,
        enabled: true
      },
      {
        name: 'Metrics API Routes',
        condition: {
          type: 'path',
          value: '/api/metrics',
          operator: 'starts_with'
        },
        target: {
          nodeType: 'metrics'
        },
        priority: 90,
        enabled: true
      },
      {
        name: 'Enterprise Users Priority',
        condition: {
          type: 'user_tier',
          value: 'enterprise',
          operator: 'equals'
        },
        target: {
          nodeType: 'api',
          weight: 2
        },
        priority: 150,
        enabled: true
      }
    ];

    for (const rule of defaultRules) {
      await this.addRoutingRule(rule);
    }
  }

  /**
   * Find matching routing rule for request
   */
  private findMatchingRoutingRule(req: Request): RoutingRule | null {
    const sortedRules = Array.from(this.routingRules.values())
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (this.matchesCondition(req, rule.condition)) {
        return rule;
      }
    }

    return null;
  }

  /**
   * Check if request matches routing condition
   */
  private matchesCondition(req: Request, condition: RoutingRule['condition']): boolean {
    let value: string;

    switch (condition.type) {
      case 'path':
        value = req.path;
        break;
      case 'header':
        value = req.get(condition.key!) || '';
        break;
      case 'query':
        value = req.query[condition.key!] as string || '';
        break;
      case 'method':
        value = req.method;
        break;
      case 'user_tier':
        value = (req as any).user?.subscriptionTier || 'free';
        break;
      default:
        return false;
    }

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'contains':
        return value.includes(condition.value);
      case 'starts_with':
        return value.startsWith(condition.value);
      case 'regex':
        try {
          const regex = new RegExp(condition.value);
          return regex.test(value);
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  /**
   * Check if circuit breaker is open for a node
   */
  private isCircuitBreakerOpen(nodeId: string): boolean {
    const circuitBreaker = this.circuitBreakers.get(nodeId);
    if (!circuitBreaker) {
      return false;
    }

    const now = new Date();

    switch (circuitBreaker.state) {
      case 'open':
        if (circuitBreaker.nextAttemptTime && now >= circuitBreaker.nextAttemptTime) {
          // Transition to half-open
          circuitBreaker.state = 'half_open';
          circuitBreaker.halfOpenCalls = 0;
          return false;
        }
        return true;

      case 'half_open':
        return circuitBreaker.halfOpenCalls >= this.circuitBreakerConfig.halfOpenMaxCalls;

      case 'closed':
      default:
        return false;
    }
  }

  /**
   * Update circuit breaker state
   */
  private updateCircuitBreaker(nodeId: string, success: boolean): void {
    let circuitBreaker = this.circuitBreakers.get(nodeId);
    
    if (!circuitBreaker) {
      circuitBreaker = {
        state: 'closed',
        failureCount: 0,
        lastFailureTime: null,
        nextAttemptTime: null,
        halfOpenCalls: 0
      };
      this.circuitBreakers.set(nodeId, circuitBreaker);
    }

    const now = new Date();

    if (success) {
      if (circuitBreaker.state === 'half_open') {
        circuitBreaker.halfOpenCalls++;
        
        if (circuitBreaker.halfOpenCalls >= this.circuitBreakerConfig.halfOpenMaxCalls) {
          // Transition back to closed
          circuitBreaker.state = 'closed';
          circuitBreaker.failureCount = 0;
          circuitBreaker.lastFailureTime = null;
          circuitBreaker.nextAttemptTime = null;
          circuitBreaker.halfOpenCalls = 0;
          
          this.emit('circuit_breaker_closed', { nodeId });
        }
      } else if (circuitBreaker.state === 'closed') {
        // Reset failure count on success
        circuitBreaker.failureCount = 0;
      }
    } else {
      circuitBreaker.failureCount++;
      circuitBreaker.lastFailureTime = now;

      if (circuitBreaker.state === 'closed' && 
          circuitBreaker.failureCount >= this.circuitBreakerConfig.failureThreshold) {
        // Transition to open
        circuitBreaker.state = 'open';
        circuitBreaker.nextAttemptTime = new Date(now.getTime() + this.circuitBreakerConfig.recoveryTimeout);
        
        this.emit('circuit_breaker_opened', { nodeId, failureCount: circuitBreaker.failureCount });
      } else if (circuitBreaker.state === 'half_open') {
        // Transition back to open
        circuitBreaker.state = 'open';
        circuitBreaker.nextAttemptTime = new Date(now.getTime() + this.circuitBreakerConfig.recoveryTimeout);
        circuitBreaker.halfOpenCalls = 0;
        
        this.emit('circuit_breaker_reopened', { nodeId });
      }
    }
  }

  /**
   * Record successful request
   */
  private recordSuccess(nodeId: string, startTime: number): void {
    const responseTime = Date.now() - startTime;
    
    this.stats.totalRequests++;
    this.stats.successfulRequests++;
    this.updateAverageResponseTime(responseTime);
    
    if (!this.stats.nodeStats[nodeId]) {
      this.stats.nodeStats[nodeId] = {
        requests: 0,
        failures: 0,
        averageResponseTime: 0,
        lastUsed: new Date()
      };
    }
    
    const nodeStats = this.stats.nodeStats[nodeId];
    nodeStats.requests++;
    nodeStats.lastUsed = new Date();
    nodeStats.averageResponseTime = (nodeStats.averageResponseTime * (nodeStats.requests - 1) + responseTime) / nodeStats.requests;
    
    this.updateCircuitBreaker(nodeId, true);
  }

  /**
   * Record failed request
   */
  private recordFailure(nodeId: string, startTime: number): void {
    const responseTime = Date.now() - startTime;
    
    this.stats.totalRequests++;
    this.stats.failedRequests++;
    this.updateAverageResponseTime(responseTime);
    
    if (!this.stats.nodeStats[nodeId]) {
      this.stats.nodeStats[nodeId] = {
        requests: 0,
        failures: 0,
        averageResponseTime: 0,
        lastUsed: new Date()
      };
    }
    
    const nodeStats = this.stats.nodeStats[nodeId];
    nodeStats.requests++;
    nodeStats.failures++;
    nodeStats.lastUsed = new Date();
    
    this.updateCircuitBreaker(nodeId, false);
  }

  /**
   * Update average response time
   */
  private updateAverageResponseTime(responseTime: number): void {
    this.stats.averageResponseTime = (
      this.stats.averageResponseTime * (this.stats.totalRequests - 1) + responseTime
    ) / this.stats.totalRequests;
  }

  /**
   * Start stats collection
   */
  private startStatsCollection(): void {
    this.statsUpdateInterval = setInterval(async () => {
      await this.updateRequestsPerSecond();
      await this.persistStats();
    }, 60000); // Update every minute
  }

  /**
   * Update requests per second metric
   */
  private async updateRequestsPerSecond(): Promise<void> {
    const key = 'load_balancer:requests_per_second';
    const now = Math.floor(Date.now() / 1000);
    
    // Get requests from the last minute
    const requestsLastMinute = await this.redis.zCount(key, now - 60, now);
    this.stats.requestsPerSecond = requestsLastMinute / 60;
    
    // Clean up old entries (keep last hour)
    await this.redis.zRemRangeByScore(key, 0, now - 3600);
  }

  /**
   * Persist stats to Redis
   */
  private async persistStats(): Promise<void> {
    try {
      await this.redis.hSet('load_balancer:stats', {
        totalRequests: this.stats.totalRequests.toString(),
        successfulRequests: this.stats.successfulRequests.toString(),
        failedRequests: this.stats.failedRequests.toString(),
        averageResponseTime: this.stats.averageResponseTime.toString(),
        requestsPerSecond: this.stats.requestsPerSecond.toString(),
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to persist load balancer stats:', error);
    }
  }

  /**
   * Simulate request forwarding (in real implementation, use HTTP client)
   */
  private async forwardRequest(url: string, options: any): Promise<{ status: number; data: any }> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    
    // Simulate success/failure
    if (Math.random() < 0.95) { // 95% success rate
      return {
        status: 200,
        data: { message: 'Request forwarded successfully', url, timestamp: new Date() }
      };
    } else {
      throw new Error('Simulated network error');
    }
  }

  /**
   * Cleanup service
   */
  cleanup(): void {
    if (this.statsUpdateInterval) {
      clearInterval(this.statsUpdateInterval);
    }
  }
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      targetNode?: ScalingNode;
    }
  }
}