/**
 * Horizontal Scaling Service
 * 
 * Implements SRS NFR-4: Support thousands of concurrent users with horizontal scaling
 * Provides auto-scaling, load balancing, and concurrent user monitoring
 */

import { EventEmitter } from 'events';
import { getRedisClient } from '../config/redis';
import { getDatabase } from '../config/database';
import { Pool } from 'pg';
import { RedisClientType } from 'redis';

export interface ScalingNode {
  id: string;
  type: 'simulation' | 'api' | 'websocket' | 'metrics';
  status: 'healthy' | 'unhealthy' | 'starting' | 'stopping';
  capacity: number;
  currentLoad: number;
  cpuUsage: number;
  memoryUsage: number;
  lastHeartbeat: Date;
  endpoint: string;
  region: string;
  metadata: Record<string, any>;
}

export interface LoadBalancerConfig {
  algorithm: 'round_robin' | 'least_connections' | 'weighted_round_robin' | 'ip_hash';
  healthCheckInterval: number; // milliseconds
  healthCheckTimeout: number; // milliseconds
  maxRetries: number;
  stickySession: boolean;
  weights?: Record<string, number>;
}

export interface AutoScalingPolicy {
  enabled: boolean;
  minNodes: number;
  maxNodes: number;
  targetCpuUtilization: number;
  targetMemoryUtilization: number;
  targetConnectionsPerNode: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  scaleUpCooldown: number; // seconds
  scaleDownCooldown: number; // seconds
  evaluationPeriod: number; // seconds
}

export interface ConcurrentUserMetrics {
  totalUsers: number;
  activeUsers: number;
  peakUsers: number;
  usersByRegion: Record<string, number>;
  usersByTier: Record<string, number>;
  connectionsPerSecond: number;
  averageSessionDuration: number;
  timestamp: Date;
}

export interface ScalingEvent {
  id: string;
  type: 'scale_up' | 'scale_down' | 'node_added' | 'node_removed' | 'health_check_failed';
  nodeId?: string;
  nodeType: string;
  reason: string;
  metrics: Record<string, number>;
  timestamp: Date;
  success: boolean;
  error?: string;
}

export class HorizontalScalingService extends EventEmitter {
  private db: Pool;
  private redis: RedisClientType;
  private nodes: Map<string, ScalingNode> = new Map();
  private loadBalancerConfig: LoadBalancerConfig;
  private autoScalingPolicies: Map<string, AutoScalingPolicy> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metricsCollectionInterval: NodeJS.Timeout | null = null;
  private autoScalingInterval: NodeJS.Timeout | null = null;
  private currentUserCount: number = 0;
  private peakUserCount: number = 0;
  private lastScalingAction: Map<string, Date> = new Map();
  private initialized: boolean = false;

  constructor() {
    super();
    this.db = getDatabase();
    this.redis = getRedisClient();
    this.initialized = false;

    // Default load balancer configuration
    this.loadBalancerConfig = {
      algorithm: 'least_connections',
      healthCheckInterval: 30000, // 30 seconds
      healthCheckTimeout: 5000, // 5 seconds
      maxRetries: 3,
      stickySession: false
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
   * Initialize the horizontal scaling service
   */
  private async initializeService(): Promise<void> {
    try {
      // Load existing nodes from database
      await this.loadNodesFromDatabase();
      
      // Load auto-scaling policies
      await this.loadAutoScalingPolicies();
      
      // Start health checking
      this.startHealthChecking();
      
      // Start metrics collection
      this.startMetricsCollection();
      
      // Start auto-scaling evaluation
      this.startAutoScaling();
      
      this.emit('service_initialized');
    } catch (error) {
      console.error('Failed to initialize horizontal scaling service:', error);
      throw error;
    }
  }

  /**
   * Register a new scaling node
   */
  async registerNode(node: Omit<ScalingNode, 'id' | 'lastHeartbeat'>): Promise<string> {
    const nodeId = `node_${node.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const scalingNode: ScalingNode = {
      ...node,
      id: nodeId,
      lastHeartbeat: new Date()
    };

    // Store in memory
    this.nodes.set(nodeId, scalingNode);
    
    // Store in database
    await this.db.query(
      `INSERT INTO scaling_nodes (
        id, type, status, capacity, current_load, cpu_usage, memory_usage,
        last_heartbeat, endpoint, region, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        capacity = EXCLUDED.capacity,
        current_load = EXCLUDED.current_load,
        cpu_usage = EXCLUDED.cpu_usage,
        memory_usage = EXCLUDED.memory_usage,
        last_heartbeat = EXCLUDED.last_heartbeat,
        endpoint = EXCLUDED.endpoint,
        region = EXCLUDED.region,
        metadata = EXCLUDED.metadata`,
      [
        nodeId, scalingNode.type, scalingNode.status, scalingNode.capacity,
        scalingNode.currentLoad, scalingNode.cpuUsage, scalingNode.memoryUsage,
        scalingNode.lastHeartbeat, scalingNode.endpoint, scalingNode.region,
        JSON.stringify(scalingNode.metadata)
      ]
    );

    // Store in Redis for fast access
    await this.redis.hSet(`scaling:nodes:${nodeId}`, {
      type: scalingNode.type,
      status: scalingNode.status,
      capacity: scalingNode.capacity.toString(),
      currentLoad: scalingNode.currentLoad.toString(),
      endpoint: scalingNode.endpoint,
      region: scalingNode.region,
      lastHeartbeat: scalingNode.lastHeartbeat.toISOString()
    });

    this.emit('node_registered', { nodeId, node: scalingNode });
    
    // Trigger auto-scaling evaluation
    this.evaluateAutoScaling(scalingNode.type);
    
    return nodeId;
  }

  /**
   * Update node metrics (heartbeat)
   */
  async updateNodeMetrics(nodeId: string, metrics: {
    currentLoad: number;
    cpuUsage: number;
    memoryUsage: number;
    status?: 'healthy' | 'unhealthy' | 'starting' | 'stopping';
  }): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    // Update node metrics
    node.currentLoad = metrics.currentLoad;
    node.cpuUsage = metrics.cpuUsage;
    node.memoryUsage = metrics.memoryUsage;
    node.lastHeartbeat = new Date();
    
    if (metrics.status) {
      node.status = metrics.status;
    }

    // Update in database
    await this.db.query(
      `UPDATE scaling_nodes SET 
        current_load = $1, cpu_usage = $2, memory_usage = $3, 
        last_heartbeat = $4, status = $5
       WHERE id = $6`,
      [metrics.currentLoad, metrics.cpuUsage, metrics.memoryUsage, 
       node.lastHeartbeat, node.status, nodeId]
    );

    // Update in Redis
    await this.redis.hSet(`scaling:nodes:${nodeId}`, {
      currentLoad: metrics.currentLoad.toString(),
      cpuUsage: metrics.cpuUsage.toString(),
      memoryUsage: metrics.memoryUsage.toString(),
      lastHeartbeat: node.lastHeartbeat.toISOString(),
      status: node.status
    });

    this.emit('node_metrics_updated', { nodeId, metrics });
  }

  /**
   * Remove a scaling node
   */
  async removeNode(nodeId: string): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    // Remove from memory
    this.nodes.delete(nodeId);
    
    // Remove from database
    await this.db.query('DELETE FROM scaling_nodes WHERE id = $1', [nodeId]);
    
    // Remove from Redis
    await this.redis.del(`scaling:nodes:${nodeId}`);

    this.emit('node_removed', { nodeId, node });
    
    // Trigger auto-scaling evaluation
    this.evaluateAutoScaling(node.type);
  }

  /**
   * Get the best node for load balancing
   */
  selectNode(nodeType: string, clientInfo?: { ip?: string; sessionId?: string }): ScalingNode | null {
    const availableNodes = Array.from(this.nodes.values())
      .filter(node => 
        node.type === nodeType && 
        node.status === 'healthy' &&
        node.currentLoad < node.capacity
      );

    if (availableNodes.length === 0) {
      return null;
    }

    switch (this.loadBalancerConfig.algorithm) {
      case 'round_robin':
        return this.selectRoundRobin(availableNodes, nodeType);
      
      case 'least_connections':
        return this.selectLeastConnections(availableNodes);
      
      case 'weighted_round_robin':
        return this.selectWeightedRoundRobin(availableNodes, nodeType);
      
      case 'ip_hash':
        return this.selectIpHash(availableNodes, clientInfo?.ip);
      
      default:
        return this.selectLeastConnections(availableNodes);
    }
  }

  /**
   * Update concurrent user count
   */
  async updateConcurrentUsers(count: number): Promise<void> {
    this.currentUserCount = count;
    this.peakUserCount = Math.max(this.peakUserCount, count);
    
    // Store in Redis for real-time access
    await this.redis.set('scaling:concurrent_users', count.toString());
    await this.redis.set('scaling:peak_users', this.peakUserCount.toString());
    
    this.emit('concurrent_users_updated', { current: count, peak: this.peakUserCount });
    
    // Trigger auto-scaling evaluation for all node types
    for (const nodeType of ['simulation', 'api', 'websocket', 'metrics']) {
      this.evaluateAutoScaling(nodeType);
    }
  }

  /**
   * Get concurrent user metrics
   */
  async getConcurrentUserMetrics(): Promise<ConcurrentUserMetrics> {
    // Get user distribution by region and tier from Redis
    const usersByRegion = await this.getUsersByRegion();
    const usersByTier = await this.getUsersByTier();
    
    // Calculate connections per second
    const connectionsPerSecond = await this.getConnectionsPerSecond();
    
    // Calculate average session duration
    const averageSessionDuration = await this.getAverageSessionDuration();

    return {
      totalUsers: this.currentUserCount,
      activeUsers: await this.getActiveUserCount(),
      peakUsers: this.peakUserCount,
      usersByRegion,
      usersByTier,
      connectionsPerSecond,
      averageSessionDuration,
      timestamp: new Date()
    };
  }

  /**
   * Set auto-scaling policy for a node type
   */
  async setAutoScalingPolicy(nodeType: string, policy: AutoScalingPolicy): Promise<void> {
    this.autoScalingPolicies.set(nodeType, policy);
    
    // Store in database
    await this.db.query(
      `INSERT INTO auto_scaling_policies (node_type, policy) 
       VALUES ($1, $2)
       ON CONFLICT (node_type) DO UPDATE SET 
         policy = EXCLUDED.policy, updated_at = NOW()`,
      [nodeType, JSON.stringify(policy)]
    );

    this.emit('auto_scaling_policy_updated', { nodeType, policy });
  }

  /**
   * Get auto-scaling policy for a node type
   */
  getAutoScalingPolicy(nodeType: string): AutoScalingPolicy | null {
    return this.autoScalingPolicies.get(nodeType) || null;
  }

  /**
   * Get all scaling nodes
   */
  getNodes(nodeType?: string): ScalingNode[] {
    const nodes = Array.from(this.nodes.values());
    return nodeType ? nodes.filter(node => node.type === nodeType) : nodes;
  }

  /**
   * Get scaling events
   */
  async getScalingEvents(limit: number = 100): Promise<ScalingEvent[]> {
    const result = await this.db.query(
      `SELECT * FROM scaling_events 
       ORDER BY timestamp DESC 
       LIMIT $1`,
      [limit]
    );

    return result.rows.map(row => ({
      id: row.id,
      type: row.type,
      nodeId: row.node_id,
      nodeType: row.node_type,
      reason: row.reason,
      metrics: row.metrics,
      timestamp: row.timestamp,
      success: row.success,
      error: row.error
    }));
  }

  /**
   * Get system capacity metrics
   */
  getSystemCapacity(): {
    totalCapacity: Record<string, number>;
    currentLoad: Record<string, number>;
    utilization: Record<string, number>;
    healthyNodes: Record<string, number>;
    totalNodes: Record<string, number>;
  } {
    const nodeTypes = ['simulation', 'api', 'websocket', 'metrics'];
    const totalCapacity: Record<string, number> = {};
    const currentLoad: Record<string, number> = {};
    const utilization: Record<string, number> = {};
    const healthyNodes: Record<string, number> = {};
    const totalNodes: Record<string, number> = {};

    for (const nodeType of nodeTypes) {
      const nodes = this.getNodes(nodeType);
      const healthy = nodes.filter(n => n.status === 'healthy');
      
      totalCapacity[nodeType] = nodes.reduce((sum, n) => sum + n.capacity, 0);
      currentLoad[nodeType] = nodes.reduce((sum, n) => sum + n.currentLoad, 0);
      utilization[nodeType] = totalCapacity[nodeType] > 0 ? 
        (currentLoad[nodeType] / totalCapacity[nodeType]) * 100 : 0;
      healthyNodes[nodeType] = healthy.length;
      totalNodes[nodeType] = nodes.length;
    }

    return {
      totalCapacity,
      currentLoad,
      utilization,
      healthyNodes,
      totalNodes
    };
  }

  // Private methods

  /**
   * Load nodes from database
   */
  private async loadNodesFromDatabase(): Promise<void> {
    try {
      // Create scaling_nodes table if it doesn't exist
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS scaling_nodes (
          id VARCHAR(255) PRIMARY KEY,
          type VARCHAR(50) NOT NULL,
          status VARCHAR(20) NOT NULL,
          capacity INTEGER NOT NULL,
          current_load INTEGER NOT NULL DEFAULT 0,
          cpu_usage DECIMAL(5,2) NOT NULL DEFAULT 0,
          memory_usage DECIMAL(5,2) NOT NULL DEFAULT 0,
          last_heartbeat TIMESTAMP WITH TIME ZONE NOT NULL,
          endpoint VARCHAR(255) NOT NULL,
          region VARCHAR(100) NOT NULL,
          metadata JSONB NOT NULL DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // Create auto_scaling_policies table
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS auto_scaling_policies (
          node_type VARCHAR(50) PRIMARY KEY,
          policy JSONB NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // Create scaling_events table
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS scaling_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          type VARCHAR(50) NOT NULL,
          node_id VARCHAR(255),
          node_type VARCHAR(50) NOT NULL,
          reason TEXT NOT NULL,
          metrics JSONB NOT NULL DEFAULT '{}',
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          success BOOLEAN NOT NULL DEFAULT true,
          error TEXT
        );
      `);

      // Load existing nodes
      const result = await this.db.query('SELECT * FROM scaling_nodes');
      
      for (const row of result.rows) {
        const node: ScalingNode = {
          id: row.id,
          type: row.type,
          status: row.status,
          capacity: row.capacity,
          currentLoad: row.current_load,
          cpuUsage: parseFloat(row.cpu_usage),
          memoryUsage: parseFloat(row.memory_usage),
          lastHeartbeat: row.last_heartbeat,
          endpoint: row.endpoint,
          region: row.region,
          metadata: row.metadata
        };
        
        this.nodes.set(node.id, node);
      }

    } catch (error) {
      console.error('Failed to load nodes from database:', error);
    }
  }

  /**
   * Load auto-scaling policies from database
   */
  private async loadAutoScalingPolicies(): Promise<void> {
    try {
      const result = await this.db.query('SELECT * FROM auto_scaling_policies');
      
      for (const row of result.rows) {
        this.autoScalingPolicies.set(row.node_type, row.policy);
      }

      // Set default policies if none exist
      const defaultPolicies: Record<string, AutoScalingPolicy> = {
        simulation: {
          enabled: true,
          minNodes: 2,
          maxNodes: 20,
          targetCpuUtilization: 70,
          targetMemoryUtilization: 80,
          targetConnectionsPerNode: 100,
          scaleUpThreshold: 80,
          scaleDownThreshold: 30,
          scaleUpCooldown: 300, // 5 minutes
          scaleDownCooldown: 600, // 10 minutes
          evaluationPeriod: 60 // 1 minute
        },
        api: {
          enabled: true,
          minNodes: 3,
          maxNodes: 50,
          targetCpuUtilization: 60,
          targetMemoryUtilization: 70,
          targetConnectionsPerNode: 1000,
          scaleUpThreshold: 75,
          scaleDownThreshold: 25,
          scaleUpCooldown: 180, // 3 minutes
          scaleDownCooldown: 300, // 5 minutes
          evaluationPeriod: 30 // 30 seconds
        },
        websocket: {
          enabled: true,
          minNodes: 2,
          maxNodes: 30,
          targetCpuUtilization: 65,
          targetMemoryUtilization: 75,
          targetConnectionsPerNode: 5000,
          scaleUpThreshold: 80,
          scaleDownThreshold: 20,
          scaleUpCooldown: 120, // 2 minutes
          scaleDownCooldown: 300, // 5 minutes
          evaluationPeriod: 30 // 30 seconds
        },
        metrics: {
          enabled: true,
          minNodes: 1,
          maxNodes: 10,
          targetCpuUtilization: 70,
          targetMemoryUtilization: 80,
          targetConnectionsPerNode: 500,
          scaleUpThreshold: 85,
          scaleDownThreshold: 30,
          scaleUpCooldown: 300, // 5 minutes
          scaleDownCooldown: 600, // 10 minutes
          evaluationPeriod: 60 // 1 minute
        }
      };

      for (const [nodeType, policy] of Object.entries(defaultPolicies)) {
        if (!this.autoScalingPolicies.has(nodeType)) {
          await this.setAutoScalingPolicy(nodeType, policy);
        }
      }

    } catch (error) {
      console.error('Failed to load auto-scaling policies:', error);
    }
  }

  /**
   * Start health checking
   */
  private startHealthChecking(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.loadBalancerConfig.healthCheckInterval);
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsCollectionInterval = setInterval(async () => {
      await this.collectSystemMetrics();
    }, 30000); // Collect every 30 seconds
  }

  /**
   * Start auto-scaling evaluation
   */
  private startAutoScaling(): void {
    this.autoScalingInterval = setInterval(async () => {
      for (const nodeType of this.autoScalingPolicies.keys()) {
        await this.evaluateAutoScaling(nodeType);
      }
    }, 30000); // Evaluate every 30 seconds
  }

  /**
   * Perform health checks on all nodes
   */
  private async performHealthChecks(): Promise<void> {
    const healthCheckPromises = Array.from(this.nodes.values()).map(async (node) => {
      try {
        // Check if node has sent heartbeat recently
        const timeSinceHeartbeat = Date.now() - node.lastHeartbeat.getTime();
        const isStale = timeSinceHeartbeat > (this.loadBalancerConfig.healthCheckInterval * 2);
        
        if (isStale && node.status === 'healthy') {
          node.status = 'unhealthy';
          await this.updateNodeStatus(node.id, 'unhealthy');
          
          this.emit('node_unhealthy', { nodeId: node.id, reason: 'Stale heartbeat' });
          
          await this.recordScalingEvent({
            type: 'health_check_failed',
            nodeId: node.id,
            nodeType: node.type,
            reason: `Node heartbeat stale: ${timeSinceHeartbeat}ms`,
            metrics: { timeSinceHeartbeat },
            success: false
          });
        }
        
      } catch (error) {
        console.error(`Health check failed for node ${node.id}:`, error);
      }
    });

    await Promise.allSettled(healthCheckPromises);
  }

  /**
   * Collect system metrics
   */
  private async collectSystemMetrics(): Promise<void> {
    try {
      const capacity = this.getSystemCapacity();
      const userMetrics = await this.getConcurrentUserMetrics();
      
      // Store metrics in Redis
      await this.redis.hSet('scaling:system_metrics', {
        timestamp: new Date().toISOString(),
        totalUsers: userMetrics.totalUsers.toString(),
        activeUsers: userMetrics.activeUsers.toString(),
        peakUsers: userMetrics.peakUsers.toString(),
        connectionsPerSecond: userMetrics.connectionsPerSecond.toString(),
        ...Object.fromEntries(
          Object.entries(capacity.utilization).map(([k, v]) => [`${k}_utilization`, v.toString()])
        )
      });

      this.emit('system_metrics_collected', { capacity, userMetrics });
      
    } catch (error) {
      console.error('Failed to collect system metrics:', error);
    }
  }

  /**
   * Evaluate auto-scaling for a node type
   */
  private async evaluateAutoScaling(nodeType: string): Promise<void> {
    const policy = this.autoScalingPolicies.get(nodeType);
    if (!policy || !policy.enabled) {
      return;
    }

    const nodes = this.getNodes(nodeType);
    const healthyNodes = nodes.filter(n => n.status === 'healthy');
    
    if (healthyNodes.length === 0) {
      return;
    }

    // Check cooldown period
    const lastAction = this.lastScalingAction.get(nodeType);
    if (lastAction) {
      const timeSinceLastAction = (Date.now() - lastAction.getTime()) / 1000;
      if (timeSinceLastAction < policy.scaleUpCooldown) {
        return; // Still in cooldown
      }
    }

    // Calculate average metrics
    const avgCpuUsage = healthyNodes.reduce((sum, n) => sum + n.cpuUsage, 0) / healthyNodes.length;
    const avgMemoryUsage = healthyNodes.reduce((sum, n) => sum + n.memoryUsage, 0) / healthyNodes.length;
    const avgLoad = healthyNodes.reduce((sum, n) => sum + n.currentLoad, 0) / healthyNodes.length;
    const totalCapacity = healthyNodes.reduce((sum, n) => sum + n.capacity, 0);
    const totalLoad = healthyNodes.reduce((sum, n) => sum + n.currentLoad, 0);
    const loadUtilization = totalCapacity > 0 ? (totalLoad / totalCapacity) * 100 : 0;

    // Determine if scaling is needed
    const shouldScaleUp = (
      avgCpuUsage > policy.scaleUpThreshold ||
      avgMemoryUsage > policy.scaleUpThreshold ||
      loadUtilization > policy.scaleUpThreshold
    ) && healthyNodes.length < policy.maxNodes;

    const shouldScaleDown = (
      avgCpuUsage < policy.scaleDownThreshold &&
      avgMemoryUsage < policy.scaleDownThreshold &&
      loadUtilization < policy.scaleDownThreshold
    ) && healthyNodes.length > policy.minNodes;

    if (shouldScaleUp) {
      await this.scaleUp(nodeType, policy, {
        avgCpuUsage,
        avgMemoryUsage,
        loadUtilization,
        currentNodes: healthyNodes.length
      });
    } else if (shouldScaleDown) {
      await this.scaleDown(nodeType, policy, {
        avgCpuUsage,
        avgMemoryUsage,
        loadUtilization,
        currentNodes: healthyNodes.length
      });
    }
  }

  /**
   * Scale up nodes for a node type
   */
  private async scaleUp(nodeType: string, policy: AutoScalingPolicy, metrics: any): Promise<void> {
    try {
      // Calculate how many nodes to add (simple strategy: add 1 node)
      const nodesToAdd = 1;
      
      this.emit('scaling_up', { 
        nodeType, 
        nodesToAdd, 
        reason: 'High resource utilization',
        metrics 
      });

      // Record scaling event
      await this.recordScalingEvent({
        type: 'scale_up',
        nodeType,
        reason: `High utilization: CPU=${metrics.avgCpuUsage}%, Memory=${metrics.avgMemoryUsage}%, Load=${metrics.loadUtilization}%`,
        metrics,
        success: true
      });

      // Update last scaling action
      this.lastScalingAction.set(nodeType, new Date());

      // In a real implementation, this would trigger node provisioning
      // For now, we'll emit an event that external systems can listen to
      this.emit('provision_nodes_requested', {
        nodeType,
        count: nodesToAdd,
        reason: 'auto_scaling_up'
      });

    } catch (error) {
      console.error(`Failed to scale up ${nodeType}:`, error);
      
      await this.recordScalingEvent({
        type: 'scale_up',
        nodeType,
        reason: 'Scale up failed',
        metrics,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Scale down nodes for a node type
   */
  private async scaleDown(nodeType: string, policy: AutoScalingPolicy, metrics: any): Promise<void> {
    try {
      const nodes = this.getNodes(nodeType).filter(n => n.status === 'healthy');
      
      if (nodes.length <= policy.minNodes) {
        return;
      }

      // Find the node with the lowest load to remove
      const nodeToRemove = nodes.reduce((min, node) => 
        node.currentLoad < min.currentLoad ? node : min
      );

      this.emit('scaling_down', { 
        nodeType, 
        nodeId: nodeToRemove.id,
        reason: 'Low resource utilization',
        metrics 
      });

      // Record scaling event
      await this.recordScalingEvent({
        type: 'scale_down',
        nodeId: nodeToRemove.id,
        nodeType,
        reason: `Low utilization: CPU=${metrics.avgCpuUsage}%, Memory=${metrics.avgMemoryUsage}%, Load=${metrics.loadUtilization}%`,
        metrics,
        success: true
      });

      // Update last scaling action
      this.lastScalingAction.set(nodeType, new Date());

      // In a real implementation, this would trigger node deprovisioning
      this.emit('deprovision_node_requested', {
        nodeId: nodeToRemove.id,
        nodeType,
        reason: 'auto_scaling_down'
      });

    } catch (error) {
      console.error(`Failed to scale down ${nodeType}:`, error);
      
      await this.recordScalingEvent({
        type: 'scale_down',
        nodeType,
        reason: 'Scale down failed',
        metrics,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Load balancing algorithms
   */
  private selectRoundRobin(nodes: ScalingNode[], nodeType: string): ScalingNode {
    // Simple round-robin implementation
    const key = `round_robin_${nodeType}`;
    const currentIndex = parseInt(this.redis.get(key) as any || '0') % nodes.length;
    this.redis.set(key, ((currentIndex + 1) % nodes.length).toString());
    return nodes[currentIndex];
  }

  private selectLeastConnections(nodes: ScalingNode[]): ScalingNode {
    return nodes.reduce((min, node) => 
      node.currentLoad < min.currentLoad ? node : min
    );
  }

  private selectWeightedRoundRobin(nodes: ScalingNode[], nodeType: string): ScalingNode {
    // Use capacity as weight
    const totalWeight = nodes.reduce((sum, node) => sum + node.capacity, 0);
    const random = Math.random() * totalWeight;
    
    let currentWeight = 0;
    for (const node of nodes) {
      currentWeight += node.capacity;
      if (random <= currentWeight) {
        return node;
      }
    }
    
    return nodes[0]; // Fallback
  }

  private selectIpHash(nodes: ScalingNode[], ip?: string): ScalingNode {
    if (!ip) {
      return this.selectLeastConnections(nodes);
    }
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < ip.length; i++) {
      hash = ((hash << 5) - hash + ip.charCodeAt(i)) & 0xffffffff;
    }
    
    const index = Math.abs(hash) % nodes.length;
    return nodes[index];
  }

  /**
   * Helper methods
   */
  private async updateNodeStatus(nodeId: string, status: string): Promise<void> {
    await this.db.query(
      'UPDATE scaling_nodes SET status = $1, updated_at = NOW() WHERE id = $2',
      [status, nodeId]
    );
    
    await this.redis.hSet(`scaling:nodes:${nodeId}`, 'status', status);
  }

  private async recordScalingEvent(event: Omit<ScalingEvent, 'id' | 'timestamp'>): Promise<void> {
    await this.db.query(
      `INSERT INTO scaling_events (type, node_id, node_type, reason, metrics, success, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [event.type, event.nodeId, event.nodeType, event.reason, 
       JSON.stringify(event.metrics), event.success, event.error]
    );
  }

  private async getUsersByRegion(): Promise<Record<string, number>> {
    // This would typically query active sessions by region
    // For now, return mock data
    return {
      'us-east-1': Math.floor(this.currentUserCount * 0.4),
      'us-west-2': Math.floor(this.currentUserCount * 0.3),
      'eu-west-1': Math.floor(this.currentUserCount * 0.2),
      'ap-southeast-1': Math.floor(this.currentUserCount * 0.1)
    };
  }

  private async getUsersByTier(): Promise<Record<string, number>> {
    // This would typically query active sessions by subscription tier
    return {
      'free': Math.floor(this.currentUserCount * 0.7),
      'pro': Math.floor(this.currentUserCount * 0.25),
      'enterprise': Math.floor(this.currentUserCount * 0.05)
    };
  }

  private async getConnectionsPerSecond(): Promise<number> {
    // This would calculate based on recent connection events
    return Math.floor(this.currentUserCount * 0.1); // Mock: 10% of users connect per second
  }

  private async getAverageSessionDuration(): Promise<number> {
    // This would calculate from session data
    return 1800; // Mock: 30 minutes average
  }

  private async getActiveUserCount(): Promise<number> {
    // This would count users with recent activity
    return Math.floor(this.currentUserCount * 0.8); // Mock: 80% are active
  }

  /**
   * Cleanup service
   */
  cleanup(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
    }
    
    if (this.autoScalingInterval) {
      clearInterval(this.autoScalingInterval);
    }
  }
}