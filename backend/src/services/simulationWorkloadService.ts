/**
 * Simulation Workload Service
 * 
 * Implements SRS NFR-5: Scale simulation workloads across multiple compute instances
 * Provides simulation load distribution, queuing, and resource management
 */

import { EventEmitter } from 'events';
import { getRedisClient } from '../config/redis';
import { getDatabase } from '../config/database';
import { Pool } from 'pg';
import { RedisClientType } from 'redis';
import { SimulationEngine } from '../simulation/SimulationEngine';
import { Workspace } from '../types';

export interface SimulationWorkload {
  id: string;
  workspaceId: string;
  userId: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  estimatedDuration: number; // seconds
  estimatedMemoryUsage: number; // MB
  estimatedCpuUsage: number; // CPU cores
  configuration: {
    userCount: number;
    duration: number;
    complexity: 'simple' | 'medium' | 'complex';
    enableRealTimeUpdates: boolean;
    enableFailureInjection: boolean;
    enableCostModeling: boolean;
  };
  status: 'queued' | 'assigned' | 'running' | 'completed' | 'failed' | 'cancelled';
  assignedNodeId?: string;
  queuedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  progress: number; // 0-100
  results?: any;
  error?: string;
}

export interface SimulationNode {
  id: string;
  endpoint: string;
  region: string;
  status: 'available' | 'busy' | 'overloaded' | 'maintenance';
  capacity: {
    maxConcurrentSimulations: number;
    maxMemoryMB: number;
    maxCpuCores: number;
  };
  currentLoad: {
    runningSimulations: number;
    memoryUsageMB: number;
    cpuUsage: number;
  };
  performance: {
    averageSimulationTime: number;
    successRate: number;
    lastHeartbeat: Date;
  };
  metadata: Record<string, any>;
}

export interface WorkloadQueue {
  name: string;
  priority: number;
  maxSize: number;
  currentSize: number;
  processingRate: number; // simulations per minute
  averageWaitTime: number; // seconds
}

export interface ResourceQuota {
  userId: string;
  subscriptionTier: string;
  limits: {
    maxConcurrentSimulations: number;
    maxSimulationDuration: number;
    maxMemoryPerSimulation: number;
    maxQueuedSimulations: number;
    dailySimulationLimit: number;
  };
  current: {
    runningSimulations: number;
    queuedSimulations: number;
    dailySimulationsUsed: number;
    lastReset: Date;
  };
}

export interface WorkloadMetrics {
  timestamp: Date;
  totalWorkloads: number;
  queuedWorkloads: number;
  runningWorkloads: number;
  completedWorkloads: number;
  failedWorkloads: number;
  averageQueueTime: number;
  averageExecutionTime: number;
  throughputPerMinute: number;
  resourceUtilization: {
    cpu: number;
    memory: number;
    nodes: number;
  };
  queuesByPriority: Record<string, number>;
}

export class SimulationWorkloadService extends EventEmitter {
  private db: Pool;
  private redis: RedisClientType;
  private simulationNodes: Map<string, SimulationNode> = new Map();
  private workloadQueues: Map<string, WorkloadQueue> = new Map();
  private resourceQuotas: Map<string, ResourceQuota> = new Map();
  private activeWorkloads: Map<string, SimulationWorkload> = new Map();
  private workloadSchedulerInterval: NodeJS.Timeout | null = null;
  private metricsCollectionInterval: NodeJS.Timeout | null = null;
  private nodeHealthCheckInterval: NodeJS.Timeout | null = null;
  private quotaResetInterval: NodeJS.Timeout | null = null;
  private initialized: boolean = false;

  constructor() {
    super();
    this.db = getDatabase();
    this.redis = getRedisClient();
    this.initialized = false;
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
   * Initialize the workload service with enhanced capabilities (SRS NFR-5)
   */
  private async initializeService(): Promise<void> {
    try {
      // Create database tables with enhanced schema
      await this.createEnhancedTables();
      
      // Initialize enhanced queues with fairness and load balancing
      await this.initializeEnhancedQueues();
      
      // Load simulation nodes with performance tracking
      await this.loadSimulationNodes();
      
      // Load resource quotas with dynamic adjustments
      await this.loadResourceQuotas();
      
      // Start enhanced background processes
      this.startEnhancedWorkloadScheduler();
      this.startEnhancedMetricsCollection();
      this.startNodeHealthChecking();
      this.startQuotaReset();
      this.startPerformanceOptimization();
      
      this.emit('service_initialized_enhanced', {
        queues: Array.from(this.workloadQueues.keys()),
        nodes: this.simulationNodes.size,
        timestamp: new Date()
      });
    } catch (error: any) {
      // If tables already exist (duplicate key error 23505), continue without crashing
      if (error?.code === '23505') {
        console.warn('Simulation workload tables already exist or being created by another instance, continuing...');
        // Try to continue with other initialization steps
        try {
          await this.loadSimulationNodes();
          await this.loadResourceQuotas();
          this.startEnhancedWorkloadScheduler();
          this.startEnhancedMetricsCollection();
          this.startNodeHealthChecking();
          this.startQuotaReset();
          this.startPerformanceOptimization();
        } catch (continueError) {
          console.error('Failed to continue initialization after table creation error:', continueError);
        }
      } else {
        console.error('Failed to initialize enhanced simulation workload service:', error);
        throw error;
      }
    }
  }

  /**
   * Create enhanced database tables (SRS NFR-5)
   */
  private async createEnhancedTables(): Promise<void> {
    // Enhanced workloads table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS simulation_workloads (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id UUID NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        priority VARCHAR(20) NOT NULL,
        estimated_duration INTEGER NOT NULL,
        estimated_memory_usage INTEGER NOT NULL,
        estimated_cpu_usage INTEGER NOT NULL,
        configuration JSONB NOT NULL,
        status VARCHAR(20) NOT NULL,
        assigned_node_id VARCHAR(255),
        queued_at TIMESTAMP WITH TIME ZONE NOT NULL,
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        progress INTEGER DEFAULT 0,
        results JSONB,
        error TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Enhanced nodes table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS simulation_nodes (
        id VARCHAR(255) PRIMARY KEY,
        endpoint VARCHAR(255) NOT NULL,
        region VARCHAR(100) NOT NULL,
        status VARCHAR(20) NOT NULL,
        capacity JSONB NOT NULL,
        current_load JSONB NOT NULL,
        performance JSONB NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}',
        health_score FLOAT DEFAULT 1.0,
        last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Enhanced quotas table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS simulation_resource_quotas (
        user_id VARCHAR(255) PRIMARY KEY,
        subscription_tier VARCHAR(50) NOT NULL,
        limits JSONB NOT NULL,
        current JSONB NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Enhanced events table for better tracking
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS simulation_workload_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workload_id VARCHAR(255) NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        details JSONB NOT NULL DEFAULT '{}',
        node_id VARCHAR(255),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Performance metrics table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS simulation_performance_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        metric_type VARCHAR(50) NOT NULL,
        node_id VARCHAR(255),
        workload_id VARCHAR(255),
        metrics JSONB NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Queue analytics table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS simulation_queue_analytics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        queue_name VARCHAR(50) NOT NULL,
        queue_size INTEGER NOT NULL,
        processing_rate FLOAT NOT NULL,
        average_wait_time FLOAT NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create enhanced indexes for performance
    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_simulation_workloads_user_status ON simulation_workloads(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_simulation_workloads_priority_queued ON simulation_workloads(priority, queued_at) WHERE status = 'queued';
      CREATE INDEX IF NOT EXISTS idx_simulation_workloads_node_running ON simulation_workloads(assigned_node_id) WHERE status = 'running';
      CREATE INDEX IF NOT EXISTS idx_simulation_workloads_workspace_completed ON simulation_workloads(workspace_id, completed_at) WHERE status = 'completed';
      CREATE INDEX IF NOT EXISTS idx_simulation_nodes_status_region ON simulation_nodes(status, region);
      CREATE INDEX IF NOT EXISTS idx_simulation_nodes_health_score ON simulation_nodes(health_score DESC);
      CREATE INDEX IF NOT EXISTS idx_simulation_workload_events_workload_type ON simulation_workload_events(workload_id, event_type);
      CREATE INDEX IF NOT EXISTS idx_simulation_workload_events_timestamp ON simulation_workload_events(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_simulation_performance_metrics_timestamp ON simulation_performance_metrics(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_simulation_queue_analytics_timestamp ON simulation_queue_analytics(timestamp DESC);
    `);
  }

  /**
   * Start enhanced workload scheduler with intelligent distribution (SRS NFR-5)
   */
  private startEnhancedWorkloadScheduler(): void {
    this.workloadSchedulerInterval = setInterval(async () => {
      await this.scheduleWorkloads();
      await this.optimizeQueueDistribution();
      await this.rebalanceNodeLoads();
    }, 3000); // More frequent scheduling for better responsiveness
  }

  /**
   * Start enhanced metrics collection (SRS NFR-5)
   */
  private startEnhancedMetricsCollection(): void {
    this.metricsCollectionInterval = setInterval(async () => {
      await this.collectEnhancedMetrics();
      await this.analyzePerformanceTrends();
      await this.updateQueueAnalytics();
    }, 15000); // More frequent metrics collection
  }

  /**
   * Start performance optimization background process (SRS NFR-5)
   */
  private startPerformanceOptimization(): void {
    setInterval(async () => {
      await this.optimizeSystemPerformance();
      await this.predictResourceNeeds();
      await this.adjustCapacityPlanning();
    }, 60000); // Every minute
  }

  /**
   * Optimize queue distribution for better load balancing (SRS NFR-5)
   */
  private async optimizeQueueDistribution(): Promise<void> {
    try {
      const queueSizes = await this.getQueueSizes();
      const totalQueued = Object.values(queueSizes).reduce((sum, size) => sum + size, 0);
      
      if (totalQueued === 0) return;
      
      // Identify overloaded queues
      const overloadedQueues = Object.entries(queueSizes).filter(([queueName, size]) => {
        const queue = this.workloadQueues.get(queueName);
        return queue && size > queue.maxSize * 0.8;
      });
      
      // Redistribute workloads from overloaded queues
      for (const [overloadedQueue, size] of overloadedQueues) {
        const redistributeCount = Math.min(5, Math.floor(size * 0.1)); // Redistribute 10% or max 5
        
        for (let i = 0; i < redistributeCount; i++) {
          const workloadId = await this.redis.lPop(`simulation_queue:${overloadedQueue}`);
          if (!workloadId) break;
          
          const workload = this.activeWorkloads.get(workloadId);
          if (!workload) continue;
          
          // Find alternative queue
          const alternativeQueue = await this.findAlternativeQueue(overloadedQueue, workload);
          if (alternativeQueue) {
            await this.redis.rPush(`simulation_queue:${alternativeQueue}`, workloadId);
            
            this.emit('workload_redistributed', {
              workloadId,
              fromQueue: overloadedQueue,
              toQueue: alternativeQueue,
              timestamp: new Date()
            });
          } else {
            // Put back if no alternative found
            await this.redis.lPush(`simulation_queue:${overloadedQueue}`, workloadId);
          }
        }
      }
    } catch (error) {
      console.error('Queue distribution optimization error:', error);
    }
  }

  /**
   * Rebalance node loads for optimal distribution (SRS NFR-5)
   */
  private async rebalanceNodeLoads(): Promise<void> {
    try {
      const nodes = Array.from(this.simulationNodes.values());
      if (nodes.length < 2) return;
      
      // Calculate load distribution
      const nodeLoads = nodes.map(node => ({
        node,
        loadPercentage: node.currentLoad.runningSimulations / node.capacity.maxConcurrentSimulations,
        healthScore: this.calculateNodeHealthScore(node)
      }));
      
      // Sort by load percentage
      nodeLoads.sort((a, b) => a.loadPercentage - b.loadPercentage);
      
      const underloadedNodes = nodeLoads.filter(nl => nl.loadPercentage < 0.3 && nl.healthScore > 0.8);
      const overloadedNodes = nodeLoads.filter(nl => nl.loadPercentage > 0.8);
      
      // If we have both underloaded and overloaded nodes, consider rebalancing
      if (underloadedNodes.length > 0 && overloadedNodes.length > 0) {
        this.emit('load_imbalance_detected', {
          underloadedNodes: underloadedNodes.length,
          overloadedNodes: overloadedNodes.length,
          timestamp: new Date()
        });
        
        // In a real implementation, this might trigger workload migration
        // For now, we'll just emit the event for monitoring
      }
    } catch (error) {
      console.error('Node load rebalancing error:', error);
    }
  }

  /**
   * Calculate node health score (SRS NFR-5)
   */
  private calculateNodeHealthScore(node: SimulationNode): number {
    const timeSinceHeartbeat = Date.now() - node.performance.lastHeartbeat.getTime();
    const heartbeatScore = Math.max(0, 1 - (timeSinceHeartbeat / (5 * 60 * 1000))); // 5 minutes max
    
    const successRateScore = node.performance.successRate;
    
    const speedScore = node.performance.averageSimulationTime > 0 ? 
      Math.min(1, 300000 / node.performance.averageSimulationTime) : 0.5; // 5 minutes baseline
    
    return (heartbeatScore * 0.4 + successRateScore * 0.4 + speedScore * 0.2);
  }

  /**
   * Collect enhanced metrics (SRS NFR-5)
   */
  private async collectEnhancedMetrics(): Promise<void> {
    try {
      // Update queue metrics with enhanced tracking
      for (const [queueName, queue] of this.workloadQueues) {
        const queueLength = await this.redis.lLen(`simulation_queue:${queueName}`);
        const queueMetadata = await this.redis.hGetAll(`queue_metadata:${queueName}`);
        
        queue.currentSize = queueLength;
        
        // Calculate processing rate
        const totalProcessed = parseInt(queueMetadata.totalProcessed || '0');
        const lastProcessed = parseInt(queueMetadata.lastTotalProcessed || '0');
        queue.processingRate = Math.max(0, (totalProcessed - lastProcessed) / 0.5); // Per 30 seconds
        
        // Update last processed count
        await this.redis.hSet(`queue_metadata:${queueName}`, 'lastTotalProcessed', totalProcessed.toString());
        
        // Store queue analytics
        await this.db.query(`
          INSERT INTO simulation_queue_analytics (queue_name, queue_size, processing_rate, average_wait_time)
          VALUES ($1, $2, $3, $4)
        `, [queueName, queueLength, queue.processingRate, queue.averageWaitTime]);
      }
      
      // Collect node health metrics
      for (const [nodeId, node] of this.simulationNodes) {
        const healthScore = this.calculateNodeHealthScore(node);
        
        await this.db.query(`
          UPDATE simulation_nodes SET health_score = $1, last_heartbeat = $2 WHERE id = $3
        `, [healthScore, node.performance.lastHeartbeat, nodeId]);
        
        // Store performance metrics
        await this.db.query(`
          INSERT INTO simulation_performance_metrics (metric_type, node_id, metrics)
          VALUES ($1, $2, $3)
        `, ['node_health', nodeId, JSON.stringify({
          healthScore,
          currentLoad: node.currentLoad,
          performance: node.performance
        })]);
      }
      
    } catch (error) {
      console.error('Enhanced metrics collection error:', error);
    }
  }

  /**
   * Analyze performance trends (SRS NFR-5)
   */
  private async analyzePerformanceTrends(): Promise<void> {
    try {
      // Analyze queue performance trends
      const queueTrends = await this.db.query(`
        SELECT 
          queue_name,
          AVG(queue_size) as avg_queue_size,
          AVG(processing_rate) as avg_processing_rate,
          AVG(average_wait_time) as avg_wait_time
        FROM simulation_queue_analytics 
        WHERE timestamp > NOW() - INTERVAL '1 hour'
        GROUP BY queue_name
      `);
      
      for (const trend of queueTrends.rows) {
        const queue = this.workloadQueues.get(trend.queue_name);
        if (queue) {
          queue.averageWaitTime = parseFloat(trend.avg_wait_time) || 0;
        }
      }
      
      // Analyze node performance trends
      const nodeTrends = await this.db.query(`
        SELECT 
          node_id,
          AVG((metrics->>'healthScore')::float) as avg_health_score,
          COUNT(*) as metric_count
        FROM simulation_performance_metrics 
        WHERE metric_type = 'node_health' AND timestamp > NOW() - INTERVAL '1 hour'
        GROUP BY node_id
      `);
      
      for (const trend of nodeTrends.rows) {
        const node = this.simulationNodes.get(trend.node_id);
        if (node && trend.avg_health_score < 0.5) {
          this.emit('node_performance_degraded', {
            nodeId: trend.node_id,
            healthScore: trend.avg_health_score,
            timestamp: new Date()
          });
        }
      }
      
    } catch (error) {
      console.error('Performance trend analysis error:', error);
    }
  }

  /**
   * Update queue analytics (SRS NFR-5)
   */
  private async updateQueueAnalytics(): Promise<void> {
    try {
      for (const [queueName, queue] of this.workloadQueues) {
        // Calculate average wait time based on recent completions
        const recentCompletions = await this.db.query(`
          SELECT AVG(EXTRACT(EPOCH FROM (started_at - queued_at))) as avg_wait_time
          FROM simulation_workloads 
          WHERE status IN ('completed', 'failed') 
            AND completed_at > NOW() - INTERVAL '1 hour'
            AND metadata->>'queueName' = $1
        `, [queueName]);
        
        if (recentCompletions.rows[0]?.avg_wait_time) {
          queue.averageWaitTime = parseFloat(recentCompletions.rows[0].avg_wait_time);
        }
      }
    } catch (error) {
      console.error('Queue analytics update error:', error);
    }
  }

  /**
   * Optimize system performance (SRS NFR-5)
   */
  private async optimizeSystemPerformance(): Promise<void> {
    try {
      const metrics = await this.getWorkloadMetrics();
      const systemLoad = metrics.resourceUtilization;
      
      // Auto-scaling recommendations
      if (systemLoad.cpu > 80 || systemLoad.memory > 80) {
        this.emit('scale_up_recommended', {
          currentLoad: systemLoad,
          recommendation: 'Add more simulation nodes',
          timestamp: new Date()
        });
      } else if (systemLoad.cpu < 20 && systemLoad.memory < 20 && systemLoad.nodes < 50) {
        this.emit('scale_down_recommended', {
          currentLoad: systemLoad,
          recommendation: 'Consider reducing simulation nodes',
          timestamp: new Date()
        });
      }
      
      // Queue optimization recommendations
      const queueSizes = await this.getQueueSizes();
      const totalQueued = Object.values(queueSizes).reduce((sum, size) => sum + size, 0);
      
      if (totalQueued > 1000) {
        this.emit('queue_optimization_recommended', {
          totalQueued,
          recommendation: 'Consider increasing processing capacity',
          timestamp: new Date()
        });
      }
      
    } catch (error) {
      console.error('System performance optimization error:', error);
    }
  }

  /**
   * Predict resource needs (SRS NFR-5)
   */
  private async predictResourceNeeds(): Promise<void> {
    try {
      // Simple trend-based prediction
      const hourlyMetrics = await this.db.query(`
        SELECT 
          DATE_TRUNC('hour', timestamp) as hour,
          AVG(total_workloads) as avg_workloads,
          AVG(queued_workloads) as avg_queued,
          AVG(running_workloads) as avg_running
        FROM (
          SELECT 
            timestamp,
            (metrics->>'totalWorkloads')::int as total_workloads,
            (metrics->>'queuedWorkloads')::int as queued_workloads,
            (metrics->>'runningWorkloads')::int as running_workloads
          FROM simulation_performance_metrics 
          WHERE metric_type = 'system_metrics' 
            AND timestamp > NOW() - INTERVAL '24 hours'
        ) subq
        GROUP BY hour
        ORDER BY hour DESC
        LIMIT 24
      `);
      
      if (hourlyMetrics.rows.length >= 3) {
        const recent = hourlyMetrics.rows.slice(0, 3);
        const avgGrowth = recent.reduce((sum, row, index) => {
          if (index === 0) return sum;
          const prev = recent[index - 1];
          return sum + (row.avg_workloads - prev.avg_workloads);
        }, 0) / (recent.length - 1);
        
        if (Math.abs(avgGrowth) > 5) {
          this.emit('resource_prediction', {
            trend: avgGrowth > 0 ? 'increasing' : 'decreasing',
            growthRate: avgGrowth,
            prediction: `Workload expected to ${avgGrowth > 0 ? 'increase' : 'decrease'} by ${Math.abs(avgGrowth)} per hour`,
            timestamp: new Date()
          });
        }
      }
      
    } catch (error) {
      console.error('Resource prediction error:', error);
    }
  }

  /**
   * Adjust capacity planning (SRS NFR-5)
   */
  private async adjustCapacityPlanning(): Promise<void> {
    try {
      const nodes = Array.from(this.simulationNodes.values());
      const totalCapacity = nodes.reduce((sum, node) => sum + node.capacity.maxConcurrentSimulations, 0);
      const currentRunning = nodes.reduce((sum, node) => sum + node.currentLoad.runningSimulations, 0);
      const utilizationRate = totalCapacity > 0 ? (currentRunning / totalCapacity) * 100 : 0;
      
      // Store capacity metrics
      await this.db.query(`
        INSERT INTO simulation_performance_metrics (metric_type, metrics)
        VALUES ($1, $2)
      `, ['capacity_planning', JSON.stringify({
        totalCapacity,
        currentRunning,
        utilizationRate,
        nodeCount: nodes.length,
        averageNodeUtilization: utilizationRate,
        timestamp: new Date()
      })]);
      
      // Emit capacity planning events
      if (utilizationRate > 85) {
        this.emit('capacity_warning', {
          utilizationRate,
          message: 'System approaching capacity limits',
          timestamp: new Date()
        });
      }
      
    } catch (error) {
      console.error('Capacity planning adjustment error:', error);
    }
  }

  /**
   * Submit a simulation workload with enhanced queuing and distribution (SRS NFR-5)
   */
  async submitWorkload(workload: Omit<SimulationWorkload, 'id' | 'status' | 'queuedAt' | 'progress'>): Promise<string> {
    return this.submitWorkloadWithEnhancedQueuing(workload);
  }

  /**
   * Cancel a workload
   */
  async cancelWorkload(workloadId: string, userId: string): Promise<void> {
    const workload = this.activeWorkloads.get(workloadId);
    if (!workload) {
      throw new Error('Workload not found');
    }

    if (workload.userId !== userId) {
      throw new Error('Access denied');
    }

    if (workload.status === 'completed' || workload.status === 'failed') {
      throw new Error('Cannot cancel completed workload');
    }

    // Check current status before updating
    const wasQueued = workload.status === 'queued';
    const wasRunning = workload.status === 'running';

    // Update status
    workload.status = 'cancelled';
    workload.completedAt = new Date();

    // Remove from queue if queued
    if (wasQueued) {
      const queueName = this.getQueueForWorkload(workload);
      await this.removeFromQueue(queueName, workloadId);
    }

    // Stop simulation if running
    if (wasRunning && workload.assignedNodeId) {
      await this.stopSimulationOnNode(workload.assignedNodeId, workloadId);
    }

    // Update database
    await this.updateWorkloadStatus(workloadId, 'cancelled');
    
    // Update user quota
    const quota = await this.getResourceQuota(userId);
    await this.updateResourceUsage(userId, {
      queuedSimulations: Math.max(0, quota.current.queuedSimulations - 1),
      runningSimulations: wasRunning ?
        Math.max(0, quota.current.runningSimulations - 1) : quota.current.runningSimulations
    });

    this.emit('workload_cancelled', { workloadId, workload });
  }

  /**
   * Get workload status
   */
  getWorkload(workloadId: string): SimulationWorkload | null {
    return this.activeWorkloads.get(workloadId) || null;
  }

  /**
   * Get user's workloads
   */
  getUserWorkloads(userId: string, status?: SimulationWorkload['status']): SimulationWorkload[] {
    const workloads = Array.from(this.activeWorkloads.values())
      .filter(w => w.userId === userId);
    
    return status ? workloads.filter(w => w.status === status) : workloads;
  }

  /**
   * Register a simulation node
   */
  async registerSimulationNode(node: Omit<SimulationNode, 'performance'>): Promise<void> {
    const simulationNode: SimulationNode = {
      ...node,
      performance: {
        averageSimulationTime: 0,
        successRate: 1.0,
        lastHeartbeat: new Date()
      }
    };

    this.simulationNodes.set(node.id, simulationNode);
    
    // Store in database
    await this.db.query(`
      INSERT INTO simulation_nodes (
        id, endpoint, region, status, capacity, current_load, performance, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO UPDATE SET
        endpoint = EXCLUDED.endpoint,
        region = EXCLUDED.region,
        status = EXCLUDED.status,
        capacity = EXCLUDED.capacity,
        current_load = EXCLUDED.current_load,
        performance = EXCLUDED.performance,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `, [
      node.id, node.endpoint, node.region, node.status,
      JSON.stringify(node.capacity), JSON.stringify(node.currentLoad),
      JSON.stringify(simulationNode.performance), JSON.stringify(node.metadata)
    ]);

    this.emit('node_registered', { nodeId: node.id, node: simulationNode });
  }

  /**
   * Update node metrics
   */
  async updateNodeMetrics(nodeId: string, metrics: {
    currentLoad: SimulationNode['currentLoad'];
    performance?: Partial<SimulationNode['performance']>;
    status?: SimulationNode['status'];
  }): Promise<void> {
    const node = this.simulationNodes.get(nodeId);
    if (!node) {
      throw new Error(`Simulation node ${nodeId} not found`);
    }

    // Update metrics
    node.currentLoad = metrics.currentLoad;
    
    if (metrics.performance) {
      Object.assign(node.performance, metrics.performance);
    }
    
    if (metrics.status) {
      node.status = metrics.status;
    }
    
    node.performance.lastHeartbeat = new Date();

    // Update in database
    await this.db.query(`
      UPDATE simulation_nodes SET 
        current_load = $1, performance = $2, status = $3, updated_at = NOW()
      WHERE id = $4
    `, [
      JSON.stringify(node.currentLoad),
      JSON.stringify(node.performance),
      node.status,
      nodeId
    ]);

    this.emit('node_metrics_updated', { nodeId, metrics });
  }

  /**
   * Get workload metrics
   */
  async getWorkloadMetrics(): Promise<WorkloadMetrics> {
    const workloads = Array.from(this.activeWorkloads.values());
    
    const queuedWorkloads = workloads.filter(w => w.status === 'queued');
    const runningWorkloads = workloads.filter(w => w.status === 'running');
    const completedWorkloads = workloads.filter(w => w.status === 'completed');
    const failedWorkloads = workloads.filter(w => w.status === 'failed');

    // Calculate average times
    const completedWithTimes = completedWorkloads.filter(w => w.startedAt && w.completedAt);
    const averageExecutionTime = completedWithTimes.length > 0 ?
      completedWithTimes.reduce((sum, w) => 
        sum + (w.completedAt!.getTime() - w.startedAt!.getTime()), 0
      ) / completedWithTimes.length / 1000 : 0;

    const startedWorkloads = workloads.filter(w => w.startedAt);
    const averageQueueTime = startedWorkloads.length > 0 ?
      startedWorkloads.reduce((sum, w) => 
        sum + (w.startedAt!.getTime() - w.queuedAt.getTime()), 0
      ) / startedWorkloads.length / 1000 : 0;

    // Calculate throughput (completed in last minute)
    const oneMinuteAgo = new Date(Date.now() - 60000);
    const recentlyCompleted = completedWorkloads.filter(w => 
      w.completedAt && w.completedAt >= oneMinuteAgo
    );

    // Calculate resource utilization
    const totalCapacity = Array.from(this.simulationNodes.values())
      .reduce((sum, node) => ({
        cpu: sum.cpu + node.capacity.maxCpuCores,
        memory: sum.memory + node.capacity.maxMemoryMB,
        nodes: sum.nodes + 1
      }), { cpu: 0, memory: 0, nodes: 0 });

    const currentUsage = Array.from(this.simulationNodes.values())
      .reduce((sum, node) => ({
        cpu: sum.cpu + node.currentLoad.cpuUsage,
        memory: sum.memory + node.currentLoad.memoryUsageMB,
        nodes: sum.nodes + (node.status === 'busy' ? 1 : 0)
      }), { cpu: 0, memory: 0, nodes: 0 });

    const resourceUtilization = {
      cpu: totalCapacity.cpu > 0 ? (currentUsage.cpu / totalCapacity.cpu) * 100 : 0,
      memory: totalCapacity.memory > 0 ? (currentUsage.memory / totalCapacity.memory) * 100 : 0,
      nodes: totalCapacity.nodes > 0 ? (currentUsage.nodes / totalCapacity.nodes) * 100 : 0
    };

    // Group queued workloads by priority
    const queuesByPriority = queuedWorkloads.reduce((acc, w) => {
      acc[w.priority] = (acc[w.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      timestamp: new Date(),
      totalWorkloads: workloads.length,
      queuedWorkloads: queuedWorkloads.length,
      runningWorkloads: runningWorkloads.length,
      completedWorkloads: completedWorkloads.length,
      failedWorkloads: failedWorkloads.length,
      averageQueueTime,
      averageExecutionTime,
      throughputPerMinute: recentlyCompleted.length,
      resourceUtilization,
      queuesByPriority
    };
  }

  /**
   * Get queue status
   */
  getQueueStatus(): WorkloadQueue[] {
    return Array.from(this.workloadQueues.values());
  }

  /**
   * Get simulation nodes
   */
  getSimulationNodes(): SimulationNode[] {
    return Array.from(this.simulationNodes.values());
  }

  /**
   * Enhanced resource quota management with dynamic scaling (SRS NFR-5)
   */
  async getResourceQuota(userId: string): Promise<ResourceQuota> {
    let quota = this.resourceQuotas.get(userId);
    
    if (!quota) {
      // Load from database or create default
      const result = await this.db.query(
        'SELECT * FROM simulation_resource_quotas WHERE user_id = $1',
        [userId]
      );

      if (result.rows.length > 0) {
        quota = this.mapQuotaFromDb(result.rows[0]);
      } else {
        // Create default quota with enhanced limits
        quota = await this.createEnhancedDefaultQuota(userId);
      }
      
      this.resourceQuotas.set(userId, quota);
    }

    // Dynamic quota adjustment based on system load and user behavior
    await this.adjustQuotaBasedOnSystemLoad(quota);

    return quota;
  }

  /**
   * Create enhanced default quota with dynamic scaling (SRS NFR-5)
   */
  private async createEnhancedDefaultQuota(userId: string): Promise<ResourceQuota> {
    // Get user subscription tier and usage history
    const subscriptionTier = await this.getUserSubscriptionTier(userId);
    const usageHistory = await this.getUserUsageHistory(userId);
    
    const baseLimits = {
      free: {
        maxConcurrentSimulations: 5, // Increased for testing
        maxSimulationDuration: 300, // 5 minutes
        maxMemoryPerSimulation: 100, // 100MB
        maxQueuedSimulations: 10, // Increased for testing
        dailySimulationLimit: 50 // Increased for testing
      },
      pro: {
        maxConcurrentSimulations: 10,
        maxSimulationDuration: 1800, // 30 minutes
        maxMemoryPerSimulation: 500, // 500MB
        maxQueuedSimulations: 20,
        dailySimulationLimit: 100
      },
      enterprise: {
        maxConcurrentSimulations: 50,
        maxSimulationDuration: 7200, // 2 hours
        maxMemoryPerSimulation: 2000, // 2GB
        maxQueuedSimulations: 100,
        dailySimulationLimit: 1000
      }
    };

    // Apply dynamic adjustments based on usage patterns
    const limits = { ...baseLimits[subscriptionTier as keyof typeof baseLimits] || baseLimits.free };
    
    // Bonus limits for consistent users
    if (usageHistory.consistentUsage) {
      limits.maxConcurrentSimulations = Math.floor(limits.maxConcurrentSimulations * 1.2);
      limits.dailySimulationLimit = Math.floor(limits.dailySimulationLimit * 1.1);
    }
    
    // Penalty for resource abuse
    if (usageHistory.resourceAbuse) {
      limits.maxConcurrentSimulations = Math.floor(limits.maxConcurrentSimulations * 0.8);
      limits.maxMemoryPerSimulation = Math.floor(limits.maxMemoryPerSimulation * 0.8);
    }

    const quota: ResourceQuota = {
      userId,
      subscriptionTier,
      limits,
      current: {
        runningSimulations: 0,
        queuedSimulations: 0,
        dailySimulationsUsed: 0,
        lastReset: new Date()
      }
    };

    // Store in database with enhanced tracking
    await this.db.query(`
      INSERT INTO simulation_resource_quotas (user_id, subscription_tier, limits, current, metadata)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      userId, 
      subscriptionTier, 
      JSON.stringify(quota.limits), 
      JSON.stringify(quota.current),
      JSON.stringify({
        createdAt: new Date(),
        adjustmentHistory: [],
        usagePattern: usageHistory
      })
    ]);

    return quota;
  }

  /**
   * Adjust quota based on system load (SRS NFR-5)
   */
  private async adjustQuotaBasedOnSystemLoad(quota: ResourceQuota): Promise<void> {
    const systemMetrics = await this.getWorkloadMetrics();
    const systemLoad = systemMetrics.resourceUtilization;
    
    // Calculate system stress level
    const stressLevel = (systemLoad.cpu + systemLoad.memory + systemLoad.nodes) / 3;
    
    // Temporary quota adjustments based on system load
    const originalLimits = { ...quota.limits };
    
    if (stressLevel > 80) {
      // High system load - reduce limits temporarily
      quota.limits.maxConcurrentSimulations = Math.max(1, Math.floor(originalLimits.maxConcurrentSimulations * 0.7));
      quota.limits.maxQueuedSimulations = Math.max(1, Math.floor(originalLimits.maxQueuedSimulations * 0.8));
    } else if (stressLevel < 30) {
      // Low system load - increase limits temporarily
      quota.limits.maxConcurrentSimulations = Math.floor(originalLimits.maxConcurrentSimulations * 1.2);
      quota.limits.maxQueuedSimulations = Math.floor(originalLimits.maxQueuedSimulations * 1.1);
    }
    
    // Emit quota adjustment event if limits changed
    if (JSON.stringify(originalLimits) !== JSON.stringify(quota.limits)) {
      this.emit('quota_adjusted', {
        userId: quota.userId,
        originalLimits,
        adjustedLimits: quota.limits,
        systemLoad: stressLevel,
        timestamp: new Date()
      });
    }
  }

  /**
   * Enhanced queue management with priority and fairness (SRS NFR-5)
   */
  private async initializeEnhancedQueues(): Promise<void> {
    const queues: Omit<WorkloadQueue, 'currentSize' | 'processingRate' | 'averageWaitTime'>[] = [
      { name: 'critical', priority: 1, maxSize: 100 },
      { name: 'high', priority: 2, maxSize: 500 },
      { name: 'normal', priority: 3, maxSize: 2000 },
      { name: 'low', priority: 4, maxSize: 5000 },
      // Add fairness queues for load balancing
      { name: 'fairness_boost', priority: 2.5, maxSize: 200 }, // For users who haven't run simulations recently
      { name: 'batch_processing', priority: 3.5, maxSize: 1000 } // For batch workloads
    ];

    for (const queueConfig of queues) {
      const queue: WorkloadQueue = {
        ...queueConfig,
        currentSize: 0,
        processingRate: 0,
        averageWaitTime: 0
      };
      
      this.workloadQueues.set(queue.name, queue);
      
      // Initialize Redis queue with enhanced features
      await this.redis.del(`simulation_queue:${queue.name}`);
      
      // Initialize queue metadata
      await this.redis.hSet(`queue_metadata:${queue.name}`, {
        priority: queue.priority.toString(),
        maxSize: queue.maxSize.toString(),
        createdAt: new Date().toISOString(),
        totalProcessed: '0',
        totalWaitTime: '0'
      });
    }
  }

  /**
   * Smart queue selection with fairness and load balancing (SRS NFR-5)
   */
  private async getSmartQueueForWorkload(workload: SimulationWorkload): Promise<string> {
    const baseQueue = workload.priority;
    
    // Check user's recent activity for fairness
    const userActivity = await this.getUserRecentActivity(workload.userId);
    
    // Fairness boost for users who haven't run simulations recently
    if (userActivity.daysSinceLastSimulation > 7 && baseQueue === 'normal') {
      return 'fairness_boost';
    }
    
    // Batch processing for similar workloads
    if (await this.shouldUseBatchProcessing(workload)) {
      return 'batch_processing';
    }
    
    // Load balancing - check queue sizes
    const queueSizes = await this.getQueueSizes();
    const baseQueueSize = queueSizes[baseQueue] || 0;
    const maxQueueSize = this.workloadQueues.get(baseQueue)?.maxSize || 1000;
    
    // If base queue is too full, try to use alternative queues
    if (baseQueueSize > maxQueueSize * 0.8) {
      const alternativeQueues = this.getAlternativeQueues(baseQueue);
      
      for (const altQueue of alternativeQueues) {
        const altQueueSize = queueSizes[altQueue] || 0;
        const altMaxSize = this.workloadQueues.get(altQueue)?.maxSize || 1000;
        
        if (altQueueSize < altMaxSize * 0.6) {
          this.emit('queue_load_balanced', {
            workloadId: workload.id,
            originalQueue: baseQueue,
            selectedQueue: altQueue,
            reason: 'load_balancing',
            timestamp: new Date()
          });
          
          return altQueue;
        }
      }
    }
    
    return baseQueue;
  }

  /**
   * Enhanced workload submission with intelligent queuing (SRS NFR-5)
   */
  async submitWorkloadWithEnhancedQueuing(workload: Omit<SimulationWorkload, 'id' | 'status' | 'queuedAt' | 'progress'>): Promise<string> {
    // Enhanced resource quota checking
    const quota = await this.getResourceQuota(workload.userId);
    if (!this.checkEnhancedResourceLimits(quota, workload)) {
      throw new Error(`Resource quota exceeded. Current: ${quota.current.runningSimulations}/${quota.limits.maxConcurrentSimulations} running, ${quota.current.queuedSimulations}/${quota.limits.maxQueuedSimulations} queued`);
    }

    // Generate workload ID with enhanced tracking
    const workloadId = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Enhanced workload estimation
    const enhancedWorkload = await this.enhanceWorkloadEstimation(workload);
    
    const simulationWorkload: SimulationWorkload = {
      ...enhancedWorkload,
      id: workloadId,
      status: 'queued',
      queuedAt: new Date(),
      progress: 0
    };

    // Store workload with enhanced tracking
    this.activeWorkloads.set(workloadId, simulationWorkload);
    
    // Smart queue selection
    const queueName = await this.getSmartQueueForWorkload(simulationWorkload);
    await this.addToEnhancedQueue(queueName, workloadId, simulationWorkload);
    
    // Store in database with enhanced metadata
    await this.storeEnhancedWorkload(simulationWorkload);
    
    // Update user quota with enhanced tracking
    await this.updateResourceUsage(workload.userId, {
      queuedSimulations: quota.current.queuedSimulations + 1
    });

    // Enhanced event emission
    this.emit('workload_submitted_enhanced', { 
      workloadId, 
      workload: simulationWorkload,
      queueName,
      estimatedWaitTime: await this.estimateQueueWaitTime(queueName),
      timestamp: new Date()
    });
    
    return workloadId;
  }

  /**
   * Enhanced resource limit checking (SRS NFR-5)
   */
  private checkEnhancedResourceLimits(quota: ResourceQuota, workload: Omit<SimulationWorkload, 'id' | 'status' | 'queuedAt' | 'progress'>): boolean {
    // Basic checks
    if (workload.estimatedDuration > quota.limits.maxSimulationDuration) {
      return false;
    }

    if (workload.estimatedMemoryUsage > quota.limits.maxMemoryPerSimulation) {
      return false;
    }

    if (quota.current.dailySimulationsUsed >= quota.limits.dailySimulationLimit) {
      return false;
    }

    // For queued simulations, be more lenient to allow testing
    if (quota.current.queuedSimulations >= quota.limits.maxQueuedSimulations) {
      return false;
    }

    return true;
  }

  /**
   * Enhance workload estimation with ML predictions (SRS NFR-5)
   */
  private async enhanceWorkloadEstimation(workload: Omit<SimulationWorkload, 'id' | 'status' | 'queuedAt' | 'progress'>): Promise<Omit<SimulationWorkload, 'id' | 'status' | 'queuedAt' | 'progress'>> {
    // Get historical data for similar workloads
    const historicalData = await this.getHistoricalWorkloadData(workload as SimulationWorkload);

    // Create a mutable copy
    const enhancedWorkload = { ...workload };

    // Adjust estimates based on historical performance
    if (historicalData.length > 0) {
      const avgActualDuration = historicalData.reduce((sum, w) => sum + w.actualDuration, 0) / historicalData.length;
      const avgActualMemory = historicalData.reduce((sum, w) => sum + w.actualMemoryUsage, 0) / historicalData.length;

      // Apply machine learning adjustments (simplified)
      const durationAdjustment = avgActualDuration / enhancedWorkload.estimatedDuration;
      const memoryAdjustment = avgActualMemory / enhancedWorkload.estimatedMemoryUsage;

      enhancedWorkload.estimatedDuration = Math.round(enhancedWorkload.estimatedDuration * Math.min(2, Math.max(0.5, durationAdjustment)));
      enhancedWorkload.estimatedMemoryUsage = Math.round(enhancedWorkload.estimatedMemoryUsage * Math.min(2, Math.max(0.5, memoryAdjustment)));
    }

    // Add complexity-based adjustments
    const complexityMultipliers = {
      simple: { duration: 0.8, memory: 0.9, cpu: 0.8 },
      medium: { duration: 1.0, memory: 1.0, cpu: 1.0 },
      complex: { duration: 1.5, memory: 1.3, cpu: 1.4 }
    };

    const multiplier = complexityMultipliers[enhancedWorkload.configuration.complexity];
    enhancedWorkload.estimatedDuration = Math.round(enhancedWorkload.estimatedDuration * multiplier.duration);
    enhancedWorkload.estimatedMemoryUsage = Math.round(enhancedWorkload.estimatedMemoryUsage * multiplier.memory);
    enhancedWorkload.estimatedCpuUsage = Math.round(enhancedWorkload.estimatedCpuUsage * multiplier.cpu);

    return enhancedWorkload;
  }

  /**
   * Add workload to enhanced queue with priority management (SRS NFR-5)
   */
  private async addToEnhancedQueue(queueName: string, workloadId: string, workload: SimulationWorkload): Promise<void> {
    const queue = this.workloadQueues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }
    
    // Check queue capacity
    const currentSize = await this.redis.lLen(`simulation_queue:${queueName}`);
    if (currentSize >= queue.maxSize) {
      // Try to move to alternative queue or reject
      const alternativeQueue = await this.findAlternativeQueue(queueName, workload);
      if (alternativeQueue) {
        return this.addToEnhancedQueue(alternativeQueue, workloadId, workload);
      } else {
        throw new Error(`Queue ${queueName} is full and no alternative available`);
      }
    }
    
    // Add to Redis queue with metadata
    await this.redis.rPush(`simulation_queue:${queueName}`, workloadId);
    
    // Update queue metadata
    await this.redis.hIncrBy(`queue_metadata:${queueName}`, 'totalQueued', 1);
    await this.redis.hSet(`queue_metadata:${queueName}`, 'lastQueued', new Date().toISOString());
    
    // Update in-memory queue size
    queue.currentSize = currentSize + 1;
    
    // Store workload metadata for queue management
    await this.redis.hSet(`workload_queue_metadata:${workloadId}`, {
      queueName,
      queuedAt: workload.queuedAt.toISOString(),
      priority: workload.priority,
      estimatedDuration: workload.estimatedDuration.toString(),
      userId: workload.userId
    });
  }

  // Helper methods for enhanced functionality

  private async getUserSubscriptionTier(userId: string): Promise<string> {
    // In a real implementation, this would query the user service
    // For now, return default
    return 'free';
  }

  private async getUserUsageHistory(userId: string): Promise<{ consistentUsage: boolean; resourceAbuse: boolean }> {
    // In a real implementation, this would analyze user's historical usage
    return { consistentUsage: false, resourceAbuse: false };
  }

  private async getUserRecentActivity(userId: string): Promise<{ daysSinceLastSimulation: number }> {
    // Query recent user activity
    const result = await this.db.query(`
      SELECT MAX(completed_at) as last_simulation 
      FROM simulation_workloads 
      WHERE user_id = $1 AND status = 'completed'
    `, [userId]);
    
    if (result.rows[0]?.last_simulation) {
      const daysSince = Math.floor((Date.now() - new Date(result.rows[0].last_simulation).getTime()) / (24 * 60 * 60 * 1000));
      return { daysSinceLastSimulation: daysSince };
    }
    
    return { daysSinceLastSimulation: 999 }; // New user
  }

  private async shouldUseBatchProcessing(workload: SimulationWorkload): Promise<boolean> {
    // Check if there are similar workloads that could be batched
    const similarWorkloads = Array.from(this.activeWorkloads.values()).filter(w => 
      w.status === 'queued' &&
      w.workspaceId === workload.workspaceId &&
      w.configuration.complexity === workload.configuration.complexity &&
      Math.abs(w.configuration.userCount - workload.configuration.userCount) < workload.configuration.userCount * 0.2
    );
    
    return similarWorkloads.length >= 2;
  }

  private getAlternativeQueues(baseQueue: string): string[] {
    const alternatives: Record<string, string[]> = {
      'critical': ['high'],
      'high': ['critical', 'normal', 'fairness_boost'],
      'normal': ['high', 'low', 'fairness_boost', 'batch_processing'],
      'low': ['normal', 'batch_processing']
    };
    
    return alternatives[baseQueue] || [];
  }

  private async findAlternativeQueue(fullQueue: string, workload: SimulationWorkload): Promise<string | null> {
    const alternatives = this.getAlternativeQueues(fullQueue);
    const queueSizes = await this.getQueueSizes();
    
    for (const altQueue of alternatives) {
      const queue = this.workloadQueues.get(altQueue);
      if (queue && queueSizes[altQueue] < queue.maxSize * 0.8) {
        return altQueue;
      }
    }
    
    return null;
  }

  private async estimateQueueWaitTime(queueName: string): Promise<number> {
    const queueSize = await this.redis.lLen(`simulation_queue:${queueName}`);
    const queue = this.workloadQueues.get(queueName);
    
    if (!queue || queueSize === 0) return 0;
    
    // Estimate based on queue size and processing rate
    const avgProcessingTime = 300; // 5 minutes average
    const concurrentProcessing = Math.min(queueSize, 5); // Assume max 5 concurrent per queue
    
    return Math.round((queueSize * avgProcessingTime) / concurrentProcessing);
  }

  private async getHistoricalWorkloadData(workload: SimulationWorkload): Promise<any[]> {
    // Query historical data for similar workloads
    const result = await this.db.query(`
      SELECT 
        estimated_duration,
        EXTRACT(EPOCH FROM (completed_at - started_at)) as actual_duration,
        estimated_memory_usage,
        (results->>'resourceUsage'->>'peakMemoryMB')::float as actual_memory_usage
      FROM simulation_workloads 
      WHERE 
        workspace_id = $1 
        AND configuration->>'complexity' = $2
        AND status = 'completed'
        AND completed_at > NOW() - INTERVAL '30 days'
      LIMIT 50
    `, [workload.workspaceId, workload.configuration.complexity]);
    
    return result.rows.map(row => ({
      estimatedDuration: row.estimated_duration,
      actualDuration: row.actual_duration,
      estimatedMemoryUsage: row.estimated_memory_usage,
      actualMemoryUsage: row.actual_memory_usage || row.estimated_memory_usage
    }));
  }

  private async storeEnhancedWorkload(workload: SimulationWorkload): Promise<void> {
    await this.db.query(`
      INSERT INTO simulation_workloads (
        id, workspace_id, user_id, priority, estimated_duration, estimated_memory_usage,
        estimated_cpu_usage, configuration, status, queued_at, progress, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      workload.id, workload.workspaceId, workload.userId, workload.priority,
      workload.estimatedDuration, workload.estimatedMemoryUsage, workload.estimatedCpuUsage,
      JSON.stringify(workload.configuration), workload.status, workload.queuedAt, workload.progress,
      JSON.stringify({
        enhancedEstimation: true,
        submissionTimestamp: new Date(),
        systemLoadAtSubmission: await this.getCurrentSystemLoad()
      })
    ]);
  }

  private async getCurrentSystemLoad(): Promise<{ cpu: number; memory: number; nodes: number }> {
    const metrics = await this.getWorkloadMetrics();
    return metrics.resourceUtilization;
  }

  // Private methods

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS simulation_workloads (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id UUID NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        priority VARCHAR(20) NOT NULL,
        estimated_duration INTEGER NOT NULL,
        estimated_memory_usage INTEGER NOT NULL,
        estimated_cpu_usage INTEGER NOT NULL,
        configuration JSONB NOT NULL,
        status VARCHAR(20) NOT NULL,
        assigned_node_id VARCHAR(255),
        queued_at TIMESTAMP WITH TIME ZONE NOT NULL,
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        progress INTEGER DEFAULT 0,
        results JSONB,
        error TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await this.db.query(`
      CREATE TABLE IF NOT EXISTS simulation_nodes (
        id VARCHAR(255) PRIMARY KEY,
        endpoint VARCHAR(255) NOT NULL,
        region VARCHAR(100) NOT NULL,
        status VARCHAR(20) NOT NULL,
        capacity JSONB NOT NULL,
        current_load JSONB NOT NULL,
        performance JSONB NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await this.db.query(`
      CREATE TABLE IF NOT EXISTS simulation_resource_quotas (
        user_id VARCHAR(255) PRIMARY KEY,
        subscription_tier VARCHAR(50) NOT NULL,
        limits JSONB NOT NULL,
        current JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await this.db.query(`
      CREATE TABLE IF NOT EXISTS simulation_workload_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workload_id VARCHAR(255) NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        details JSONB NOT NULL DEFAULT '{}',
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create indexes
    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_simulation_workloads_user_id ON simulation_workloads(user_id);
      CREATE INDEX IF NOT EXISTS idx_simulation_workloads_status ON simulation_workloads(status);
      CREATE INDEX IF NOT EXISTS idx_simulation_workloads_priority ON simulation_workloads(priority);
      CREATE INDEX IF NOT EXISTS idx_simulation_workloads_queued_at ON simulation_workloads(queued_at);
      CREATE INDEX IF NOT EXISTS idx_simulation_nodes_status ON simulation_nodes(status);
      CREATE INDEX IF NOT EXISTS idx_simulation_nodes_region ON simulation_nodes(region);
      CREATE INDEX IF NOT EXISTS idx_simulation_workload_events_workload_id ON simulation_workload_events(workload_id);
      CREATE INDEX IF NOT EXISTS idx_simulation_workload_events_timestamp ON simulation_workload_events(timestamp);
    `);
  }

  /**
   * Initialize workload queues
   */
  private async initializeQueues(): Promise<void> {
    const queues: Omit<WorkloadQueue, 'currentSize' | 'processingRate' | 'averageWaitTime'>[] = [
      { name: 'critical', priority: 1, maxSize: 100 },
      { name: 'high', priority: 2, maxSize: 500 },
      { name: 'normal', priority: 3, maxSize: 2000 },
      { name: 'low', priority: 4, maxSize: 5000 }
    ];

    for (const queueConfig of queues) {
      const queue: WorkloadQueue = {
        ...queueConfig,
        currentSize: 0,
        processingRate: 0,
        averageWaitTime: 0
      };
      
      this.workloadQueues.set(queue.name, queue);
      
      // Initialize Redis queue
      await this.redis.del(`simulation_queue:${queue.name}`);
    }
  }

  /**
   * Load simulation nodes from database
   */
  private async loadSimulationNodes(): Promise<void> {
    try {
      const result = await this.db.query('SELECT * FROM simulation_nodes');
      
      for (const row of result.rows) {
        const node: SimulationNode = {
          id: row.id,
          endpoint: row.endpoint,
          region: row.region,
          status: row.status,
          capacity: row.capacity,
          currentLoad: row.current_load,
          performance: row.performance,
          metadata: row.metadata
        };
        
        this.simulationNodes.set(node.id, node);
      }
    } catch (error) {
      console.error('Failed to load simulation nodes:', error);
    }
  }

  /**
   * Load resource quotas from database
   */
  private async loadResourceQuotas(): Promise<void> {
    try {
      const result = await this.db.query('SELECT * FROM simulation_resource_quotas');
      
      for (const row of result.rows) {
        const quota = this.mapQuotaFromDb(row);
        this.resourceQuotas.set(quota.userId, quota);
      }
    } catch (error) {
      console.error('Failed to load resource quotas:', error);
    }
  }

  /**
   * Start workload scheduler
   */
  private startWorkloadScheduler(): void {
    this.workloadSchedulerInterval = setInterval(async () => {
      await this.scheduleWorkloads();
    }, 5000); // Schedule every 5 seconds
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsCollectionInterval = setInterval(async () => {
      await this.collectMetrics();
    }, 30000); // Collect every 30 seconds
  }

  /**
   * Start node health checking
   */
  private startNodeHealthChecking(): void {
    this.nodeHealthCheckInterval = setInterval(async () => {
      await this.checkNodeHealth();
    }, 60000); // Check every minute
  }

  /**
   * Start quota reset
   */
  private startQuotaReset(): void {
    this.quotaResetInterval = setInterval(async () => {
      await this.resetDailyQuotas();
    }, 3600000); // Check every hour
  }

  /**
   * Schedule workloads to available nodes with advanced load distribution (SRS NFR-5)
   */
  private async scheduleWorkloads(): Promise<void> {
    try {
      // Get available nodes with enhanced filtering and load balancing
      const availableNodes = Array.from(this.simulationNodes.values())
        .filter(node => node.status === 'available' || node.status === 'busy')
        .filter(node => node.currentLoad.runningSimulations < node.capacity.maxConcurrentSimulations)
        .filter(node => {
          // Health check - ensure node responded recently
          const timeSinceHeartbeat = Date.now() - node.performance.lastHeartbeat.getTime();
          return timeSinceHeartbeat < 300000; // 5 minutes
        })
        .sort((a, b) => {
          // Advanced sorting: consider load, performance, and region
          const aScore = this.calculateNodeScore(a);
          const bScore = this.calculateNodeScore(b);
          return bScore - aScore; // Higher score first
        });

      if (availableNodes.length === 0) {
        this.emit('no_available_nodes', { timestamp: new Date() });
        return;
      }

      // Enhanced queue processing with load distribution
      const queueNames = ['critical', 'high', 'normal', 'low'];
      let totalScheduled = 0;
      const maxSchedulePerCycle = Math.min(10, availableNodes.length * 2); // Limit scheduling per cycle
      
      for (const queueName of queueNames) {
        if (totalScheduled >= maxSchedulePerCycle) break;
        
        // Process multiple workloads from each queue for better distribution
        const batchSize = Math.min(3, maxSchedulePerCycle - totalScheduled);
        
        for (let i = 0; i < batchSize; i++) {
          const workloadId = await this.redis.lPop(`simulation_queue:${queueName}`);
          if (!workloadId) break;

          const workload = this.activeWorkloads.get(workloadId);
          if (!workload || workload.status !== 'queued') continue;

          // Enhanced node selection with load distribution
          const bestNode = this.selectBestNodeWithLoadDistribution(availableNodes, workload);
          if (!bestNode) {
            // Put back in queue with exponential backoff
            await this.redis.lPush(`simulation_queue:${queueName}`, workloadId);
            
            // Update workload with retry information
            workload.progress = -1; // Indicate scheduling retry
            await this.updateWorkloadStatus(workloadId, 'queued');
            continue;
          }

          // Assign workload to node with enhanced tracking
          await this.assignWorkloadToNodeWithDistribution(workload, bestNode);
          totalScheduled++;
        }
      }

      // Emit scheduling metrics
      this.emit('workloads_scheduled', {
        totalScheduled,
        availableNodes: availableNodes.length,
        queueSizes: await this.getQueueSizes(),
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Workload scheduling error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit('scheduling_error', { error: errorMessage, timestamp: new Date() });
    }
  }

  /**
   * Enhanced node selection with load distribution (SRS NFR-5)
   */
  private selectBestNodeWithLoadDistribution(availableNodes: SimulationNode[], workload: SimulationWorkload): SimulationNode | null {
    // Filter nodes that can handle the workload
    const suitableNodes = availableNodes.filter(node => {
      const hasCapacity = (
        node.currentLoad.runningSimulations < node.capacity.maxConcurrentSimulations &&
        node.currentLoad.memoryUsageMB + workload.estimatedMemoryUsage <= node.capacity.maxMemoryMB &&
        node.currentLoad.cpuUsage + workload.estimatedCpuUsage <= node.capacity.maxCpuCores
      );
      
      // Additional checks for load distribution
      const loadPercentage = node.currentLoad.runningSimulations / node.capacity.maxConcurrentSimulations;
      const memoryPercentage = node.currentLoad.memoryUsageMB / node.capacity.maxMemoryMB;
      const cpuPercentage = node.currentLoad.cpuUsage / node.capacity.maxCpuCores;
      
      // Prefer nodes with lower overall utilization for better distribution
      const overallUtilization = (loadPercentage + memoryPercentage + cpuPercentage) / 3;
      
      return hasCapacity && overallUtilization < 0.8; // Don't overload nodes
    });

    if (suitableNodes.length === 0) {
      return null;
    }

    // Advanced selection algorithm considering multiple factors
    return suitableNodes.reduce((best, node) => {
      const nodeScore = this.calculateAdvancedNodeScore(node, workload);
      const bestScore = this.calculateAdvancedNodeScore(best, workload);
      return nodeScore > bestScore ? node : best;
    });
  }

  /**
   * Calculate advanced node score for load distribution (SRS NFR-5)
   */
  private calculateAdvancedNodeScore(node: SimulationNode, workload: SimulationWorkload): number {
    // Load factor (prefer less loaded nodes)
    const loadFactor = 1 - (node.currentLoad.runningSimulations / node.capacity.maxConcurrentSimulations);
    
    // Performance factor (prefer high-performing nodes)
    const performanceFactor = node.performance.successRate;
    
    // Speed factor (prefer faster nodes)
    const speedFactor = node.performance.averageSimulationTime > 0 ? 
      Math.min(1, 60000 / node.performance.averageSimulationTime) : 1; // Normalize to 1 minute baseline
    
    // Resource availability factor
    const memoryAvailability = 1 - (node.currentLoad.memoryUsageMB / node.capacity.maxMemoryMB);
    const cpuAvailability = 1 - (node.currentLoad.cpuUsage / node.capacity.maxCpuCores);
    const resourceFactor = (memoryAvailability + cpuAvailability) / 2;
    
    // Workload compatibility factor
    const compatibilityFactor = this.calculateWorkloadCompatibility(node, workload);
    
    // Regional preference (if applicable)
    const regionalFactor = this.calculateRegionalPreference(node, workload);
    
    // Weighted score calculation
    return (
      loadFactor * 0.25 +           // 25% - load distribution
      performanceFactor * 0.20 +    // 20% - node reliability
      speedFactor * 0.20 +          // 20% - execution speed
      resourceFactor * 0.15 +       // 15% - resource availability
      compatibilityFactor * 0.10 +  // 10% - workload compatibility
      regionalFactor * 0.10         // 10% - regional preference
    );
  }

  /**
   * Calculate workload compatibility with node
   */
  private calculateWorkloadCompatibility(node: SimulationNode, workload: SimulationWorkload): number {
    // Check if node has handled similar workloads successfully
    const nodeMetadata = node.metadata;
    
    // Complexity compatibility
    const complexityMatch = nodeMetadata.preferredComplexity === workload.configuration.complexity ? 1.0 : 0.7;
    
    // Size compatibility
    const sizeRatio = Math.min(1, node.capacity.maxMemoryMB / workload.estimatedMemoryUsage);
    const sizeMatch = sizeRatio > 2 ? 1.0 : sizeRatio / 2; // Prefer nodes with ample resources
    
    return (complexityMatch + sizeMatch) / 2;
  }

  /**
   * Calculate regional preference for workload
   */
  private calculateRegionalPreference(node: SimulationNode, workload: SimulationWorkload): number {
    // In a real implementation, this would consider user location, data locality, etc.
    // For now, return neutral score
    return 0.5;
  }

  /**
   * Enhanced workload assignment with distribution tracking (SRS NFR-5)
   */
  private async assignWorkloadToNodeWithDistribution(workload: SimulationWorkload, node: SimulationNode): Promise<void> {
    try {
      // Update workload status with assignment details
      workload.status = 'assigned';
      workload.assignedNodeId = node.id;
      workload.startedAt = new Date();
      
      // Enhanced node load tracking
      node.currentLoad.runningSimulations++;
      node.currentLoad.memoryUsageMB += workload.estimatedMemoryUsage;
      node.currentLoad.cpuUsage += workload.estimatedCpuUsage;
      
      // Update node status based on load
      const utilizationPercentage = (
        (node.currentLoad.runningSimulations / node.capacity.maxConcurrentSimulations) +
        (node.currentLoad.memoryUsageMB / node.capacity.maxMemoryMB) +
        (node.currentLoad.cpuUsage / node.capacity.maxCpuCores)
      ) / 3;
      
      if (utilizationPercentage >= 0.9) {
        node.status = 'overloaded';
      } else if (utilizationPercentage >= 0.7) {
        node.status = 'busy';
      } else {
        node.status = 'available';
      }

      // Start simulation on node with enhanced monitoring
      await this.startSimulationOnNodeWithMonitoring(node, workload);
      
      // Update database with distribution tracking
      await this.updateWorkloadStatus(workload.id, 'running');
      await this.updateNodeMetrics(node.id, {
        currentLoad: node.currentLoad,
        status: node.status
      });

      // Update user quota
      const quota = await this.getResourceQuota(workload.userId);
      await this.updateResourceUsage(workload.userId, {
        queuedSimulations: Math.max(0, quota.current.queuedSimulations - 1),
        runningSimulations: quota.current.runningSimulations + 1,
        dailySimulationsUsed: quota.current.dailySimulationsUsed + 1
      });

      // Enhanced event emission with distribution metrics
      this.emit('workload_assigned_with_distribution', { 
        workloadId: workload.id, 
        nodeId: node.id,
        nodeUtilization: utilizationPercentage,
        distributionScore: this.calculateAdvancedNodeScore(node, workload),
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error(`Failed to assign workload ${workload.id} to node ${node.id}:`, error);
      
      // Enhanced error recovery
      await this.revertWorkloadAssignment(workload, node, error);
    }
  }

  /**
   * Enhanced simulation start with monitoring (SRS NFR-5)
   */
  private async startSimulationOnNodeWithMonitoring(node: SimulationNode, workload: SimulationWorkload): Promise<void> {
    workload.status = 'running';
    
    // Enhanced simulation execution with performance monitoring
    const simulationStartTime = Date.now();
    
    // In a real implementation, this would make an HTTP request to the node
    // For now, we'll simulate with enhanced monitoring
    const simulationPromise = new Promise<void>((resolve, reject) => {
      const executionTime = workload.estimatedDuration * 1000;
      const monitoringInterval = Math.min(5000, executionTime / 10); // Monitor every 5s or 10% of execution
      
      let progressReports = 0;
      const maxProgressReports = Math.floor(executionTime / monitoringInterval);
      
      const progressTimer = setInterval(() => {
        progressReports++;
        const progress = Math.min(100, (progressReports / maxProgressReports) * 100);
        
        workload.progress = Math.round(progress);
        
        this.emit('simulation_progress', {
          workloadId: workload.id,
          nodeId: node.id,
          progress: workload.progress,
          elapsedTime: Date.now() - simulationStartTime,
          estimatedTimeRemaining: executionTime - (Date.now() - simulationStartTime),
          timestamp: new Date()
        });
        
        if (progress >= 100) {
          clearInterval(progressTimer);
        }
      }, monitoringInterval);
      
      setTimeout(async () => {
        clearInterval(progressTimer);
        
        try {
          // Simulate completion with enhanced result tracking
          const success = Math.random() > 0.05; // 95% success rate
          const actualExecutionTime = Date.now() - simulationStartTime;
          
          await this.completeWorkloadWithDistribution(workload.id, {
            success,
            results: { 
              simulationTime: actualExecutionTime,
              nodeId: node.id,
              nodeRegion: node.region,
              resourceUsage: {
                peakMemoryMB: workload.estimatedMemoryUsage * (0.8 + Math.random() * 0.4),
                avgCpuUsage: workload.estimatedCpuUsage * (0.7 + Math.random() * 0.3)
              }
            },
            performanceMetrics: {
              executionTime: actualExecutionTime,
              nodePerformance: node.performance.averageSimulationTime
            }
          });
          
          resolve();
        } catch (error) {
          reject(error);
        }
      }, executionTime);
    });

    this.emit('simulation_started_with_monitoring', { 
      workloadId: workload.id, 
      nodeId: node.id,
      estimatedDuration: workload.estimatedDuration,
      monitoringEnabled: true,
      timestamp: new Date()
    });
  }

  /**
   * Enhanced workload completion with distribution tracking (SRS NFR-5)
   */
  private async completeWorkloadWithDistribution(workloadId: string, result: { 
    success: boolean; 
    results?: any;
    performanceMetrics?: any;
  }): Promise<void> {
    const workload = this.activeWorkloads.get(workloadId);
    if (!workload) return;

    const node = workload.assignedNodeId ? this.simulationNodes.get(workload.assignedNodeId) : null;

    if (result.success) {
      workload.status = 'completed';
      workload.results = result.results;
      workload.progress = 100;
    } else {
      workload.status = 'failed';
      workload.error = 'Simulation failed during execution';
    }
    
    workload.completedAt = new Date();

    // Enhanced node load and performance tracking
    if (node) {
      node.currentLoad.runningSimulations--;
      node.currentLoad.memoryUsageMB -= workload.estimatedMemoryUsage;
      node.currentLoad.cpuUsage -= workload.estimatedCpuUsage;
      
      // Update node status based on new load
      const utilizationPercentage = (
        (node.currentLoad.runningSimulations / node.capacity.maxConcurrentSimulations) +
        (node.currentLoad.memoryUsageMB / node.capacity.maxMemoryMB) +
        (node.currentLoad.cpuUsage / node.capacity.maxCpuCores)
      ) / 3;
      
      if (utilizationPercentage < 0.3) {
        node.status = 'available';
      } else if (utilizationPercentage < 0.7) {
        node.status = 'busy';
      }

      // Enhanced performance metrics update
      const executionTime = workload.completedAt.getTime() - workload.startedAt!.getTime();
      const successRate = result.success ? 1 : 0;
      
      // Exponential moving average for performance metrics
      node.performance.averageSimulationTime = (
        node.performance.averageSimulationTime * 0.8 + executionTime * 0.2
      );
      
      node.performance.successRate = (
        node.performance.successRate * 0.9 + successRate * 0.1
      );
      
      await this.updateNodeMetrics(node.id, {
        currentLoad: node.currentLoad,
        status: node.status,
        performance: {
          averageSimulationTime: node.performance.averageSimulationTime,
          successRate: node.performance.successRate
        }
      });
    }

    // Update database with enhanced tracking
    await this.updateWorkloadStatus(workloadId, workload.status);
    
    // Update user quota
    const quota = await this.getResourceQuota(workload.userId);
    await this.updateResourceUsage(workload.userId, {
      runningSimulations: Math.max(0, quota.current.runningSimulations - 1)
    });

    // Enhanced completion event with distribution metrics
    this.emit('workload_completed_with_distribution', { 
      workloadId, 
      workload, 
      success: result.success,
      nodeId: node?.id,
      nodeRegion: node?.region,
      executionTime: workload.completedAt.getTime() - workload.startedAt!.getTime(),
      performanceMetrics: result.performanceMetrics,
      timestamp: new Date()
    });
  }

  /**
   * Revert workload assignment on failure
   */
  private async revertWorkloadAssignment(workload: SimulationWorkload, node: SimulationNode, error: any): Promise<void> {
    // Revert workload state
    workload.status = 'queued';
    workload.assignedNodeId = undefined;
    workload.startedAt = undefined;
    workload.error = `Assignment failed: ${error.message}`;
    
    // Revert node load
    node.currentLoad.runningSimulations = Math.max(0, node.currentLoad.runningSimulations - 1);
    node.currentLoad.memoryUsageMB = Math.max(0, node.currentLoad.memoryUsageMB - workload.estimatedMemoryUsage);
    node.currentLoad.cpuUsage = Math.max(0, node.currentLoad.cpuUsage - workload.estimatedCpuUsage);
    
    // Put back in appropriate queue with higher priority
    const queueName = workload.priority === 'low' ? 'normal' : workload.priority;
    await this.addToQueue(queueName, workload.id);
    
    this.emit('workload_assignment_reverted', {
      workloadId: workload.id,
      nodeId: node.id,
      error: error.message,
      timestamp: new Date()
    });
  }

  /**
   * Get current queue sizes for monitoring
   */
  private async getQueueSizes(): Promise<Record<string, number>> {
    const queueSizes: Record<string, number> = {};
    
    for (const queueName of ['critical', 'high', 'normal', 'low']) {
      queueSizes[queueName] = await this.redis.lLen(`simulation_queue:${queueName}`);
    }
    
    return queueSizes;
  }

  /**
   * Select best node for workload
   */
  private selectBestNode(availableNodes: SimulationNode[], workload: SimulationWorkload): SimulationNode | null {
    // Filter nodes that can handle the workload
    const suitableNodes = availableNodes.filter(node => {
      const hasCapacity = (
        node.currentLoad.runningSimulations < node.capacity.maxConcurrentSimulations &&
        node.currentLoad.memoryUsageMB + workload.estimatedMemoryUsage <= node.capacity.maxMemoryMB &&
        node.currentLoad.cpuUsage + workload.estimatedCpuUsage <= node.capacity.maxCpuCores
      );
      
      return hasCapacity;
    });

    if (suitableNodes.length === 0) {
      return null;
    }

    // Select node with best performance and lowest load
    return suitableNodes.reduce((best, node) => {
      const nodeScore = this.calculateNodeScore(node);
      const bestScore = this.calculateNodeScore(best);
      return nodeScore > bestScore ? node : best;
    });
  }

  /**
   * Calculate node score for selection
   */
  private calculateNodeScore(node: SimulationNode): number {
    const loadFactor = 1 - (node.currentLoad.runningSimulations / node.capacity.maxConcurrentSimulations);
    const performanceFactor = node.performance.successRate;
    const speedFactor = node.performance.averageSimulationTime > 0 ? 
      1 / node.performance.averageSimulationTime : 1;
    
    return loadFactor * 0.4 + performanceFactor * 0.4 + speedFactor * 0.2;
  }

  /**
   * Assign workload to node
   */
  private async assignWorkloadToNode(workload: SimulationWorkload, node: SimulationNode): Promise<void> {
    try {
      // Update workload status
      workload.status = 'assigned';
      workload.assignedNodeId = node.id;
      workload.startedAt = new Date();
      
      // Update node load
      node.currentLoad.runningSimulations++;
      node.currentLoad.memoryUsageMB += workload.estimatedMemoryUsage;
      node.currentLoad.cpuUsage += workload.estimatedCpuUsage;
      
      if (node.currentLoad.runningSimulations >= node.capacity.maxConcurrentSimulations) {
        node.status = 'busy';
      }

      // Start simulation on node
      await this.startSimulationOnNode(node, workload);
      
      // Update database
      await this.updateWorkloadStatus(workload.id, 'running');
      await this.updateNodeMetrics(node.id, {
        currentLoad: node.currentLoad,
        status: node.status
      });

      // Update user quota
      const quota = await this.getResourceQuota(workload.userId);
      await this.updateResourceUsage(workload.userId, {
        queuedSimulations: Math.max(0, quota.current.queuedSimulations - 1),
        runningSimulations: quota.current.runningSimulations + 1,
        dailySimulationsUsed: quota.current.dailySimulationsUsed + 1
      });

      this.emit('workload_assigned', { workloadId: workload.id, nodeId: node.id });
      
    } catch (error) {
      console.error(`Failed to assign workload ${workload.id} to node ${node.id}:`, error);
      
      // Revert changes
      workload.status = 'queued';
      workload.assignedNodeId = undefined;
      workload.startedAt = undefined;
      
      node.currentLoad.runningSimulations--;
      node.currentLoad.memoryUsageMB -= workload.estimatedMemoryUsage;
      node.currentLoad.cpuUsage -= workload.estimatedCpuUsage;
      
      // Put back in queue
      const queueName = this.getQueueForWorkload(workload);
      await this.addToQueue(queueName, workload.id);
    }
  }

  /**
   * Start simulation on node
   */
  private async startSimulationOnNode(node: SimulationNode, workload: SimulationWorkload): Promise<void> {
    // In a real implementation, this would make an HTTP request to the node
    // For now, we'll simulate the process
    
    workload.status = 'running';
    
    // Simulate simulation execution
    setTimeout(async () => {
      try {
        // Simulate completion
        await this.completeWorkload(workload.id, {
          success: Math.random() > 0.1, // 90% success rate
          results: { simulationTime: workload.estimatedDuration * 1000 }
        });
      } catch (error) {
        await this.failWorkload(workload.id, error instanceof Error ? error.message : 'Unknown error');
      }
    }, workload.estimatedDuration * 1000);

    this.emit('simulation_started', { workloadId: workload.id, nodeId: node.id });
  }

  /**
   * Stop simulation on node
   */
  private async stopSimulationOnNode(nodeId: string, workloadId: string): Promise<void> {
    // In a real implementation, this would make an HTTP request to stop the simulation
    this.emit('simulation_stopped', { workloadId, nodeId });
  }

  /**
   * Complete workload
   */
  private async completeWorkload(workloadId: string, result: { success: boolean; results?: any }): Promise<void> {
    const workload = this.activeWorkloads.get(workloadId);
    if (!workload) return;

    const node = workload.assignedNodeId ? this.simulationNodes.get(workload.assignedNodeId) : null;

    if (result.success) {
      workload.status = 'completed';
      workload.results = result.results;
      workload.progress = 100;
    } else {
      workload.status = 'failed';
      workload.error = 'Simulation failed';
    }
    
    workload.completedAt = new Date();

    // Update node load
    if (node) {
      node.currentLoad.runningSimulations--;
      node.currentLoad.memoryUsageMB -= workload.estimatedMemoryUsage;
      node.currentLoad.cpuUsage -= workload.estimatedCpuUsage;
      
      if (node.status === 'busy' && node.currentLoad.runningSimulations < node.capacity.maxConcurrentSimulations) {
        node.status = 'available';
      }

      // Update node performance
      const executionTime = workload.completedAt.getTime() - workload.startedAt!.getTime();
      node.performance.averageSimulationTime = (
        node.performance.averageSimulationTime * 0.9 + executionTime * 0.1
      );
      
      await this.updateNodeMetrics(node.id, {
        currentLoad: node.currentLoad,
        status: node.status,
        performance: { averageSimulationTime: node.performance.averageSimulationTime }
      });
    }

    // Update database
    await this.updateWorkloadStatus(workloadId, workload.status);
    
    // Update user quota
    const quota = await this.getResourceQuota(workload.userId);
    await this.updateResourceUsage(workload.userId, {
      runningSimulations: Math.max(0, quota.current.runningSimulations - 1)
    });

    this.emit('workload_completed', { workloadId, workload, success: result.success });
  }

  /**
   * Fail workload
   */
  private async failWorkload(workloadId: string, error: string): Promise<void> {
    await this.completeWorkload(workloadId, { success: false });
    
    const workload = this.activeWorkloads.get(workloadId);
    if (workload) {
      workload.error = error;
    }
  }

  /**
   * Helper methods
   */
  private getQueueForWorkload(workload: SimulationWorkload): string {
    return workload.priority;
  }

  private async addToQueue(queueName: string, workloadId: string): Promise<void> {
    await this.redis.rPush(`simulation_queue:${queueName}`, workloadId);
    
    const queue = this.workloadQueues.get(queueName);
    if (queue) {
      queue.currentSize++;
    }
  }

  private async removeFromQueue(queueName: string, workloadId: string): Promise<void> {
    await this.redis.lRem(`simulation_queue:${queueName}`, 1, workloadId);
    
    const queue = this.workloadQueues.get(queueName);
    if (queue) {
      queue.currentSize = Math.max(0, queue.currentSize - 1);
    }
  }

  private checkResourceLimits(quota: ResourceQuota, workload: SimulationWorkload): boolean {
    return (
      quota.current.queuedSimulations < quota.limits.maxQueuedSimulations &&
      quota.current.dailySimulationsUsed < quota.limits.dailySimulationLimit &&
      workload.estimatedDuration <= quota.limits.maxSimulationDuration &&
      workload.estimatedMemoryUsage <= quota.limits.maxMemoryPerSimulation
    );
  }

  private async storeWorkload(workload: SimulationWorkload): Promise<void> {
    await this.db.query(`
      INSERT INTO simulation_workloads (
        id, workspace_id, user_id, priority, estimated_duration, estimated_memory_usage,
        estimated_cpu_usage, configuration, status, queued_at, progress
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      workload.id, workload.workspaceId, workload.userId, workload.priority,
      workload.estimatedDuration, workload.estimatedMemoryUsage, workload.estimatedCpuUsage,
      JSON.stringify(workload.configuration), workload.status, workload.queuedAt, workload.progress
    ]);
  }

  private async updateWorkloadStatus(workloadId: string, status: SimulationWorkload['status']): Promise<void> {
    const workload = this.activeWorkloads.get(workloadId);
    if (!workload) return;

    await this.db.query(`
      UPDATE simulation_workloads SET 
        status = $1, 
        started_at = $2, 
        completed_at = $3, 
        progress = $4,
        results = $5,
        error = $6,
        updated_at = NOW()
      WHERE id = $7
    `, [
      status, workload.startedAt, workload.completedAt, workload.progress,
      workload.results ? JSON.stringify(workload.results) : null,
      workload.error, workloadId
    ]);
  }

  private async updateResourceUsage(userId: string, updates: Partial<ResourceQuota['current']>): Promise<void> {
    const quota = this.resourceQuotas.get(userId);
    if (!quota) return;

    Object.assign(quota.current, updates);

    await this.db.query(`
      UPDATE simulation_resource_quotas SET 
        current = $1, updated_at = NOW()
      WHERE user_id = $2
    `, [JSON.stringify(quota.current), userId]);
  }

  private async createDefaultQuota(userId: string): Promise<ResourceQuota> {
    // Get user subscription tier (would typically query user service)
    const subscriptionTier = 'free'; // Default

    const defaultLimits = {
      free: {
        maxConcurrentSimulations: 2,
        maxSimulationDuration: 300, // 5 minutes
        maxMemoryPerSimulation: 100, // 100MB
        maxQueuedSimulations: 5,
        dailySimulationLimit: 20
      },
      pro: {
        maxConcurrentSimulations: 10,
        maxSimulationDuration: 1800, // 30 minutes
        maxMemoryPerSimulation: 500, // 500MB
        maxQueuedSimulations: 20,
        dailySimulationLimit: 100
      },
      enterprise: {
        maxConcurrentSimulations: 50,
        maxSimulationDuration: 7200, // 2 hours
        maxMemoryPerSimulation: 2000, // 2GB
        maxQueuedSimulations: 100,
        dailySimulationLimit: 1000
      }
    };

    const quota: ResourceQuota = {
      userId,
      subscriptionTier,
      limits: defaultLimits[subscriptionTier as keyof typeof defaultLimits] || defaultLimits.free,
      current: {
        runningSimulations: 0,
        queuedSimulations: 0,
        dailySimulationsUsed: 0,
        lastReset: new Date()
      }
    };

    // Store in database
    await this.db.query(`
      INSERT INTO simulation_resource_quotas (user_id, subscription_tier, limits, current)
      VALUES ($1, $2, $3, $4)
    `, [userId, subscriptionTier, JSON.stringify(quota.limits), JSON.stringify(quota.current)]);

    return quota;
  }

  private mapQuotaFromDb(row: any): ResourceQuota {
    return {
      userId: row.user_id,
      subscriptionTier: row.subscription_tier,
      limits: row.limits,
      current: row.current
    };
  }

  private async collectMetrics(): Promise<void> {
    // Update queue metrics
    for (const [queueName, queue] of this.workloadQueues) {
      const queueLength = await this.redis.lLen(`simulation_queue:${queueName}`);
      queue.currentSize = queueLength;
    }
  }

  private async checkNodeHealth(): Promise<void> {
    const now = new Date();
    const healthTimeout = 5 * 60 * 1000; // 5 minutes

    for (const [nodeId, node] of this.simulationNodes) {
      const timeSinceHeartbeat = now.getTime() - node.performance.lastHeartbeat.getTime();
      
      if (timeSinceHeartbeat > healthTimeout && node.status !== 'maintenance') {
        node.status = 'overloaded';
        await this.updateNodeMetrics(nodeId, { currentLoad: node.currentLoad, status: 'overloaded' });
        
        this.emit('node_unhealthy', { nodeId, timeSinceHeartbeat });
      }
    }
  }

  private async resetDailyQuotas(): Promise<void> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    for (const [userId, quota] of this.resourceQuotas) {
      if (quota.current.lastReset < oneDayAgo) {
        quota.current.dailySimulationsUsed = 0;
        quota.current.lastReset = now;
        
        await this.updateResourceUsage(userId, { 
          dailySimulationsUsed: 0, 
          lastReset: now 
        });
      }
    }
  }

  /**
   * Cleanup service
   */
  cleanup(): void {
    if (this.workloadSchedulerInterval) {
      clearInterval(this.workloadSchedulerInterval);
    }
    
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
    }
    
    if (this.nodeHealthCheckInterval) {
      clearInterval(this.nodeHealthCheckInterval);
    }
    
    if (this.quotaResetInterval) {
      clearInterval(this.quotaResetInterval);
    }
  }
}

// Singleton export
export const simulationWorkloadService = new SimulationWorkloadService();