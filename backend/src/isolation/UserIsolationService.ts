/**
 * User Isolation Service
 * 
 * Implements SRS NFR-3: Create complete user simulation isolation with
 * resource quotas, limits, and tenant-scoped data access
 */

import { EventEmitter } from 'events';
import { Pool } from 'pg';
import { getDatabase } from '../config/database';
import { SimulationEngine } from '../simulation/SimulationEngine';
import { MetricsCollector } from '../simulation/MetricsCollector';
import { MetricsStorage } from '../simulation/MetricsStorage';

export interface UserResourceQuota {
  userId: string;
  maxSimulations: number;
  maxComponents: number;
  maxConnections: number;
  maxWorkspaces: number;
  maxSimulationDuration: number; // seconds
  maxMemoryUsage: number; // MB
  maxCpuTime: number; // seconds
  maxStorageSize: number; // MB
  maxConcurrentSessions: number;
  subscriptionTier: string;
  quotaResetInterval: number; // seconds
  lastReset: Date;
}

export interface UserResourceUsage {
  userId: string;
  currentSimulations: number;
  currentComponents: number;
  currentConnections: number;
  currentWorkspaces: number;
  currentMemoryUsage: number;
  currentCpuTime: number;
  currentStorageSize: number;
  currentSessions: number;
  lastUpdated: Date;
}

export interface IsolationContext {
  userId: string;
  sessionId: string;
  workspaceId?: string;
  simulationId?: string;
  resourceLimits: UserResourceQuota;
  currentUsage: UserResourceUsage;
  isolatedResources: {
    simulationEngine?: SimulationEngine;
    metricsCollector?: MetricsCollector;
    metricsStorage?: MetricsStorage;
    memoryPool?: MemoryPool;
    cpuQuota?: CpuQuota;
  };
}

export interface ResourceViolation {
  userId: string;
  resourceType: string;
  currentValue: number;
  limitValue: number;
  violationType: 'quota_exceeded' | 'rate_limit' | 'concurrent_limit';
  timestamp: Date;
  action: 'block' | 'throttle' | 'warn';
}

/**
 * Memory pool for user isolation
 */
class MemoryPool {
  private maxSize: number;
  private currentSize: number = 0;
  private allocations: Map<string, number> = new Map();

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  allocate(key: string, size: number): boolean {
    if (this.currentSize + size > this.maxSize) {
      return false;
    }

    const existing = this.allocations.get(key) || 0;
    this.allocations.set(key, existing + size);
    this.currentSize += size;
    return true;
  }

  deallocate(key: string, size?: number): void {
    const allocated = this.allocations.get(key) || 0;
    const toFree = size || allocated;
    
    this.allocations.set(key, Math.max(0, allocated - toFree));
    this.currentSize = Math.max(0, this.currentSize - toFree);
  }

  getUsage(): { current: number; max: number; utilization: number } {
    return {
      current: this.currentSize,
      max: this.maxSize,
      utilization: this.currentSize / this.maxSize
    };
  }

  clear(): void {
    this.allocations.clear();
    this.currentSize = 0;
  }
}

/**
 * CPU quota manager for user isolation
 */
class CpuQuota {
  private maxTime: number;
  private usedTime: number = 0;
  private startTime: number = 0;
  private isRunning: boolean = false;

  constructor(maxTime: number) {
    this.maxTime = maxTime;
  }

  start(): boolean {
    if (this.usedTime >= this.maxTime) {
      return false;
    }

    this.startTime = Number(process.hrtime.bigint());
    this.isRunning = true;
    return true;
  }

  stop(): number {
    if (!this.isRunning) return 0;

    const endTime = Number(process.hrtime.bigint());
    const elapsed = (endTime - this.startTime) / 1000000; // Convert to milliseconds

    this.usedTime += elapsed;
    this.isRunning = false;

    return elapsed;
  }

  getRemainingTime(): number {
    return Math.max(0, this.maxTime - this.usedTime);
  }

  getUsage(): { used: number; max: number; utilization: number } {
    return {
      used: this.usedTime,
      max: this.maxTime,
      utilization: this.usedTime / this.maxTime
    };
  }

  reset(): void {
    this.usedTime = 0;
    this.isRunning = false;
  }
}

export class UserIsolationService extends EventEmitter {
  private db: Pool;
  private userContexts: Map<string, IsolationContext> = new Map();
  private resourceViolations: Map<string, ResourceViolation[]> = new Map();
  private quotaResetInterval: NodeJS.Timeout | null = null;
  private usageMonitorInterval: NodeJS.Timeout | null = null;

  // Default quotas by subscription tier
  private defaultQuotas: Record<string, Partial<UserResourceQuota>> = {
    free: {
      maxSimulations: 3,
      maxComponents: 20,
      maxConnections: 30,
      maxWorkspaces: 5,
      maxSimulationDuration: 300, // 5 minutes
      maxMemoryUsage: 50, // 50MB
      maxCpuTime: 30, // 30 seconds
      maxStorageSize: 10, // 10MB
      maxConcurrentSessions: 2,
      quotaResetInterval: 3600 // 1 hour
    },
    pro: {
      maxSimulations: 10,
      maxComponents: 100,
      maxConnections: 200,
      maxWorkspaces: 25,
      maxSimulationDuration: 1800, // 30 minutes
      maxMemoryUsage: 200, // 200MB
      maxCpuTime: 300, // 5 minutes
      maxStorageSize: 100, // 100MB
      maxConcurrentSessions: 5,
      quotaResetInterval: 3600 // 1 hour
    },
    enterprise: {
      maxSimulations: 50,
      maxComponents: 500,
      maxConnections: 1000,
      maxWorkspaces: 100,
      maxSimulationDuration: 7200, // 2 hours
      maxMemoryUsage: 1000, // 1GB
      maxCpuTime: 1800, // 30 minutes
      maxStorageSize: 1000, // 1GB
      maxConcurrentSessions: 20,
      quotaResetInterval: 3600 // 1 hour
    }
  };

  constructor() {
    super();
    this.db = getDatabase();
    this.startQuotaResetScheduler();
    this.startUsageMonitoring();
  }

  /**
   * Create isolated context for user
   */
  async createUserContext(userId: string, sessionId: string, subscriptionTier: string = 'free'): Promise<IsolationContext> {
    // Get or create user resource quota
    const resourceLimits = await this.getUserResourceQuota(userId, subscriptionTier);
    
    // Get current usage
    const currentUsage = await this.getUserResourceUsage(userId);

    // Check concurrent session limit
    if (currentUsage.currentSessions >= resourceLimits.maxConcurrentSessions) {
      throw new Error(`Concurrent session limit exceeded: ${currentUsage.currentSessions}/${resourceLimits.maxConcurrentSessions}`);
    }

    // Create isolated resources
    const memoryPool = new MemoryPool(resourceLimits.maxMemoryUsage * 1024 * 1024); // Convert MB to bytes
    const cpuQuota = new CpuQuota(resourceLimits.maxCpuTime * 1000); // Convert seconds to milliseconds

    const context: IsolationContext = {
      userId,
      sessionId,
      resourceLimits,
      currentUsage,
      isolatedResources: {
        memoryPool,
        cpuQuota
      }
    };

    // Store context
    this.userContexts.set(sessionId, context);

    // Update session count
    await this.updateResourceUsage(userId, { currentSessions: currentUsage.currentSessions + 1 });

    this.emit('context_created', { userId, sessionId, resourceLimits });
    return context;
  }

  /**
   * Get user context by session ID
   */
  getUserContext(sessionId: string): IsolationContext | null {
    return this.userContexts.get(sessionId) || null;
  }

  /**
   * Create isolated simulation engine for user
   */
  async createIsolatedSimulationEngine(sessionId: string, workspaceId: string): Promise<SimulationEngine> {
    const context = this.userContexts.get(sessionId);
    if (!context) {
      throw new Error('User context not found');
    }

    // Check simulation limits
    if (context.currentUsage.currentSimulations >= context.resourceLimits.maxSimulations) {
      this.recordViolation(context.userId, 'simulations', context.currentUsage.currentSimulations, 
                          context.resourceLimits.maxSimulations, 'quota_exceeded', 'block');
      throw new Error(`Simulation limit exceeded: ${context.currentUsage.currentSimulations}/${context.resourceLimits.maxSimulations}`);
    }

    // Create isolated simulation engine
    const simulationEngine = new SimulationEngine();
    
    // Wrap simulation engine methods with resource monitoring
    const originalStart = simulationEngine.start.bind(simulationEngine);
    simulationEngine.start = async () => {
      if (!context.isolatedResources.cpuQuota?.start()) {
        throw new Error('CPU quota exceeded');
      }
      return originalStart();
    };

    const originalStop = simulationEngine.stop.bind(simulationEngine);
    simulationEngine.stop = () => {
      context.isolatedResources.cpuQuota?.stop();
      return originalStop();
    };

    // Store in context
    context.isolatedResources.simulationEngine = simulationEngine;
    context.workspaceId = workspaceId;

    // Update usage
    await this.updateResourceUsage(context.userId, { 
      currentSimulations: context.currentUsage.currentSimulations + 1 
    });

    this.emit('simulation_created', { userId: context.userId, sessionId, workspaceId });
    return simulationEngine;
  }

  /**
   * Create isolated metrics storage for user
   */
  async createIsolatedMetricsStorage(sessionId: string): Promise<MetricsStorage> {
    const context = this.userContexts.get(sessionId);
    if (!context) {
      throw new Error('User context not found');
    }

    // Create metrics storage with memory limits
    const metricsStorage = new MetricsStorage({
      maxRawMetrics: Math.min(1000, context.resourceLimits.maxMemoryUsage * 10), // Scale with memory quota
      maxAggregatedMetrics: Math.min(500, context.resourceLimits.maxMemoryUsage * 5),
      maxSystemMetrics: Math.min(100, context.resourceLimits.maxMemoryUsage),
      compressionEnabled: true
    });

    // Store in context
    context.isolatedResources.metricsStorage = metricsStorage;

    return metricsStorage;
  }

  /**
   * Check resource limits before operation
   */
  async checkResourceLimits(sessionId: string, operation: string, resourceRequirement: Partial<UserResourceUsage>): Promise<boolean> {
    const context = this.userContexts.get(sessionId);
    if (!context) {
      throw new Error('User context not found');
    }

    const violations: string[] = [];

    // Check each resource requirement
    if (resourceRequirement.currentComponents !== undefined) {
      const newTotal = context.currentUsage.currentComponents + resourceRequirement.currentComponents;
      if (newTotal > context.resourceLimits.maxComponents) {
        violations.push(`Components: ${newTotal}/${context.resourceLimits.maxComponents}`);
        this.recordViolation(context.userId, 'components', newTotal, 
                            context.resourceLimits.maxComponents, 'quota_exceeded', 'block');
      }
    }

    if (resourceRequirement.currentConnections !== undefined) {
      const newTotal = context.currentUsage.currentConnections + resourceRequirement.currentConnections;
      if (newTotal > context.resourceLimits.maxConnections) {
        violations.push(`Connections: ${newTotal}/${context.resourceLimits.maxConnections}`);
        this.recordViolation(context.userId, 'connections', newTotal, 
                            context.resourceLimits.maxConnections, 'quota_exceeded', 'block');
      }
    }

    if (resourceRequirement.currentMemoryUsage !== undefined) {
      const newTotal = context.currentUsage.currentMemoryUsage + resourceRequirement.currentMemoryUsage;
      if (newTotal > context.resourceLimits.maxMemoryUsage) {
        violations.push(`Memory: ${newTotal}MB/${context.resourceLimits.maxMemoryUsage}MB`);
        this.recordViolation(context.userId, 'memory', newTotal, 
                            context.resourceLimits.maxMemoryUsage, 'quota_exceeded', 'block');
      }
    }

    if (violations.length > 0) {
      this.emit('resource_limit_exceeded', {
        userId: context.userId,
        sessionId,
        operation,
        violations
      });
      return false;
    }

    return true;
  }

  /**
   * Update resource usage for user
   */
  async updateResourceUsage(userId: string, usage: Partial<UserResourceUsage>): Promise<void> {
    try {
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      // Build dynamic update query
      Object.entries(usage).forEach(([key, value]) => {
        if (value !== undefined) {
          const dbField = this.camelToSnakeCase(key);
          updateFields.push(`${dbField} = $${paramIndex++}`);
          updateValues.push(value);
        }
      });

      if (updateFields.length === 0) return;

      updateFields.push(`last_updated = $${paramIndex++}`);
      updateValues.push(new Date());
      updateValues.push(userId);

      await this.db.query(
        `UPDATE user_resource_usage 
         SET ${updateFields.join(', ')} 
         WHERE user_id = $${paramIndex}`,
        updateValues
      );

      // Update context if exists
      for (const context of this.userContexts.values()) {
        if (context.userId === userId) {
          Object.assign(context.currentUsage, usage);
        }
      }

    } catch (error) {
      console.error('Failed to update resource usage:', error);
    }
  }

  /**
   * Get user resource quota
   */
  async getUserResourceQuota(userId: string, subscriptionTier: string): Promise<UserResourceQuota> {
    try {
      const result = await this.db.query(
        'SELECT * FROM user_resource_quotas WHERE user_id = $1',
        [userId]
      );

      if (result.rows.length > 0) {
        return this.mapQuotaFromDb(result.rows[0]);
      }

      // Create default quota for new user
      const defaultQuota = this.defaultQuotas[subscriptionTier] || this.defaultQuotas.free;
      const quota: UserResourceQuota = {
        userId,
        subscriptionTier,
        lastReset: new Date(),
        ...defaultQuota
      } as UserResourceQuota;

      await this.createUserResourceQuota(quota);
      return quota;

    } catch (error) {
      console.error('Failed to get user resource quota:', error);
      throw error;
    }
  }

  /**
   * Get user resource usage
   */
  async getUserResourceUsage(userId: string): Promise<UserResourceUsage> {
    try {
      const result = await this.db.query(
        'SELECT * FROM user_resource_usage WHERE user_id = $1',
        [userId]
      );

      if (result.rows.length > 0) {
        return this.mapUsageFromDb(result.rows[0]);
      }

      // Create default usage for new user
      const usage: UserResourceUsage = {
        userId,
        currentSimulations: 0,
        currentComponents: 0,
        currentConnections: 0,
        currentWorkspaces: 0,
        currentMemoryUsage: 0,
        currentCpuTime: 0,
        currentStorageSize: 0,
        currentSessions: 0,
        lastUpdated: new Date()
      };

      await this.createUserResourceUsage(usage);
      return usage;

    } catch (error) {
      console.error('Failed to get user resource usage:', error);
      throw error;
    }
  }

  /**
   * Record resource violation
   */
  private recordViolation(
    userId: string,
    resourceType: string,
    currentValue: number,
    limitValue: number,
    violationType: 'quota_exceeded' | 'rate_limit' | 'concurrent_limit',
    action: 'block' | 'throttle' | 'warn'
  ): void {
    const violation: ResourceViolation = {
      userId,
      resourceType,
      currentValue,
      limitValue,
      violationType,
      timestamp: new Date(),
      action
    };

    if (!this.resourceViolations.has(userId)) {
      this.resourceViolations.set(userId, []);
    }

    const userViolations = this.resourceViolations.get(userId)!;
    userViolations.push(violation);

    // Keep only recent violations (last 100)
    if (userViolations.length > 100) {
      userViolations.shift();
    }

    this.emit('resource_violation', violation);
  }

  /**
   * Cleanup user context
   */
  async cleanupUserContext(sessionId: string): Promise<void> {
    const context = this.userContexts.get(sessionId);
    if (!context) return;

    // Stop any running simulations
    if (context.isolatedResources.simulationEngine) {
      context.isolatedResources.simulationEngine.stop();
    }

    // Clear memory pools
    if (context.isolatedResources.memoryPool) {
      context.isolatedResources.memoryPool.clear();
    }

    // Reset CPU quota
    if (context.isolatedResources.cpuQuota) {
      context.isolatedResources.cpuQuota.reset();
    }

    // Update session count
    await this.updateResourceUsage(context.userId, { 
      currentSessions: Math.max(0, context.currentUsage.currentSessions - 1) 
    });

    // Remove context
    this.userContexts.delete(sessionId);

    this.emit('context_cleaned', { userId: context.userId, sessionId });
  }

  /**
   * Start quota reset scheduler
   */
  private startQuotaResetScheduler(): void {
    this.quotaResetInterval = setInterval(async () => {
      await this.resetExpiredQuotas();
    }, 60000); // Check every minute
  }

  /**
   * Start usage monitoring
   */
  private startUsageMonitoring(): void {
    this.usageMonitorInterval = setInterval(async () => {
      await this.monitorResourceUsage();
    }, 30000); // Monitor every 30 seconds
  }

  /**
   * Reset expired quotas
   */
  private async resetExpiredQuotas(): Promise<void> {
    try {
      const now = new Date();
      
      // Find quotas that need reset
      const result = await this.db.query(
        `SELECT user_id, quota_reset_interval, last_reset 
         FROM user_resource_quotas 
         WHERE last_reset + INTERVAL '1 second' * quota_reset_interval < $1`,
        [now]
      );

      for (const row of result.rows) {
        // Reset usage for this user
        await this.db.query(
          `UPDATE user_resource_usage 
           SET current_simulations = 0, current_cpu_time = 0, last_updated = $1
           WHERE user_id = $2`,
          [now, row.user_id]
        );

        // Update last reset time
        await this.db.query(
          'UPDATE user_resource_quotas SET last_reset = $1 WHERE user_id = $2',
          [now, row.user_id]
        );

        this.emit('quota_reset', { userId: row.user_id, timestamp: now });
      }

    } catch (error) {
      console.error('Failed to reset quotas:', error);
    }
  }

  /**
   * Monitor resource usage
   */
  private async monitorResourceUsage(): Promise<void> {
    for (const context of this.userContexts.values()) {
      try {
        // Update memory usage from memory pool
        if (context.isolatedResources.memoryPool) {
          const memoryUsage = context.isolatedResources.memoryPool.getUsage();
          const memoryMB = memoryUsage.current / 1024 / 1024;
          
          await this.updateResourceUsage(context.userId, {
            currentMemoryUsage: memoryMB
          });
        }

        // Update CPU usage from CPU quota
        if (context.isolatedResources.cpuQuota) {
          const cpuUsage = context.isolatedResources.cpuQuota.getUsage();
          
          await this.updateResourceUsage(context.userId, {
            currentCpuTime: cpuUsage.used / 1000 // Convert to seconds
          });
        }

      } catch (error) {
        console.error(`Failed to monitor usage for user ${context.userId}:`, error);
      }
    }
  }

  /**
   * Create user resource quota in database
   */
  private async createUserResourceQuota(quota: UserResourceQuota): Promise<void> {
    await this.db.query(
      `INSERT INTO user_resource_quotas (
        user_id, max_simulations, max_components, max_connections, max_workspaces,
        max_simulation_duration, max_memory_usage, max_cpu_time, max_storage_size,
        max_concurrent_sessions, subscription_tier, quota_reset_interval, last_reset
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        quota.userId, quota.maxSimulations, quota.maxComponents, quota.maxConnections,
        quota.maxWorkspaces, quota.maxSimulationDuration, quota.maxMemoryUsage,
        quota.maxCpuTime, quota.maxStorageSize, quota.maxConcurrentSessions,
        quota.subscriptionTier, quota.quotaResetInterval, quota.lastReset
      ]
    );
  }

  /**
   * Create user resource usage in database
   */
  private async createUserResourceUsage(usage: UserResourceUsage): Promise<void> {
    await this.db.query(
      `INSERT INTO user_resource_usage (
        user_id, current_simulations, current_components, current_connections,
        current_workspaces, current_memory_usage, current_cpu_time, current_storage_size,
        current_sessions, last_updated
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        usage.userId, usage.currentSimulations, usage.currentComponents, usage.currentConnections,
        usage.currentWorkspaces, usage.currentMemoryUsage, usage.currentCpuTime,
        usage.currentStorageSize, usage.currentSessions, usage.lastUpdated
      ]
    );
  }

  /**
   * Map database row to UserResourceQuota
   */
  private mapQuotaFromDb(row: any): UserResourceQuota {
    return {
      userId: row.user_id,
      maxSimulations: row.max_simulations,
      maxComponents: row.max_components,
      maxConnections: row.max_connections,
      maxWorkspaces: row.max_workspaces,
      maxSimulationDuration: row.max_simulation_duration,
      maxMemoryUsage: row.max_memory_usage,
      maxCpuTime: row.max_cpu_time,
      maxStorageSize: row.max_storage_size,
      maxConcurrentSessions: row.max_concurrent_sessions,
      subscriptionTier: row.subscription_tier,
      quotaResetInterval: row.quota_reset_interval,
      lastReset: row.last_reset
    };
  }

  /**
   * Map database row to UserResourceUsage
   */
  private mapUsageFromDb(row: any): UserResourceUsage {
    return {
      userId: row.user_id,
      currentSimulations: row.current_simulations,
      currentComponents: row.current_components,
      currentConnections: row.current_connections,
      currentWorkspaces: row.current_workspaces,
      currentMemoryUsage: row.current_memory_usage,
      currentCpuTime: row.current_cpu_time,
      currentStorageSize: row.current_storage_size,
      currentSessions: row.current_sessions,
      lastUpdated: row.last_updated
    };
  }

  /**
   * Convert camelCase to snake_case
   */
  private camelToSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  /**
   * Get resource violations for user
   */
  getResourceViolations(userId: string): ResourceViolation[] {
    return this.resourceViolations.get(userId) || [];
  }

  /**
   * Get all active user contexts
   */
  getActiveContexts(): IsolationContext[] {
    return Array.from(this.userContexts.values());
  }

  /**
   * Cleanup service
   */
  cleanup(): void {
    if (this.quotaResetInterval) {
      clearInterval(this.quotaResetInterval);
    }
    
    if (this.usageMonitorInterval) {
      clearInterval(this.usageMonitorInterval);
    }

    // Cleanup all user contexts
    for (const sessionId of this.userContexts.keys()) {
      this.cleanupUserContext(sessionId);
    }
  }
}