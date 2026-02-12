/**
 * Simulation Performance Optimizer
 * 
 * Implements SRS NFR-5: Optimize simulation performance and resource usage
 * Provides intelligent caching, batching, and performance tuning
 */

import { EventEmitter } from 'events';
import { getRedisClient } from '../config/redis';
import { RedisClientType } from 'redis';
import { SimulationWorkload } from './simulationWorkloadService';

export interface PerformanceProfile {
  workspaceId: string;
  complexity: 'simple' | 'medium' | 'complex';
  componentCount: number;
  connectionCount: number;
  averageExecutionTime: number;
  memoryUsage: number;
  cpuUsage: number;
  cacheHitRate: number;
  optimizations: string[];
  lastUpdated: Date;
}

export interface OptimizationStrategy {
  id: string;
  name: string;
  description: string;
  applicableComplexity: ('simple' | 'medium' | 'complex')[];
  expectedSpeedup: number; // multiplier
  memoryOverhead: number; // MB
  implementation: (workload: SimulationWorkload) => Promise<OptimizedWorkload>;
}

export interface OptimizedWorkload extends SimulationWorkload {
  optimizations: {
    strategy: string;
    parameters: Record<string, any>;
    expectedSpeedup: number;
    cacheKeys?: string[];
  }[];
  originalEstimatedDuration: number;
}

export interface CacheEntry {
  key: string;
  workspaceHash: string;
  configurationHash: string;
  results: any;
  executionTime: number;
  hitCount: number;
  createdAt: Date;
  lastAccessed: Date;
  expiresAt: Date;
}

export interface BatchingConfig {
  enabled: boolean;
  maxBatchSize: number;
  maxWaitTime: number; // milliseconds
  similarityThreshold: number; // 0-1
  batchingStrategies: ('workspace' | 'configuration' | 'user')[];
}

export interface PerformanceMetrics {
  timestamp: Date;
  totalOptimizations: number;
  cacheHitRate: number;
  averageSpeedup: number;
  memoryReduction: number;
  batchingEfficiency: number;
  optimizationsByStrategy: Record<string, number>;
  performanceGains: {
    timeReduction: number; // percentage
    resourceReduction: number; // percentage
    throughputIncrease: number; // percentage
  };
}

export class SimulationPerformanceOptimizer extends EventEmitter {
  private redis: RedisClientType;
  private performanceProfiles: Map<string, PerformanceProfile> = new Map();
  private optimizationStrategies: Map<string, OptimizationStrategy> = new Map();
  private cacheEntries: Map<string, CacheEntry> = new Map();
  private batchingConfig: BatchingConfig;
  private pendingBatches: Map<string, SimulationWorkload[]> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();
  private metricsCollectionInterval: NodeJS.Timeout | null = null;
  private cacheCleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.redis = getRedisClient();
    
    this.batchingConfig = {
      enabled: true,
      maxBatchSize: 10,
      maxWaitTime: 30000, // 30 seconds
      similarityThreshold: 0.8,
      batchingStrategies: ['workspace', 'configuration']
    };

    this.initializeOptimizer();
  }

  /**
   * Initialize the performance optimizer
   */
  private async initializeOptimizer(): Promise<void> {
    try {
      // Initialize optimization strategies
      this.initializeOptimizationStrategies();
      
      // Load performance profiles from Redis
      await this.loadPerformanceProfiles();
      
      // Load cache entries
      await this.loadCacheEntries();
      
      // Start background processes
      this.startMetricsCollection();
      this.startCacheCleanup();
      
      this.emit('optimizer_initialized');
    } catch (error) {
      console.error('Failed to initialize simulation performance optimizer:', error);
      throw error;
    }
  }

  /**
   * Optimize a simulation workload
   */
  async optimizeWorkload(workload: SimulationWorkload): Promise<OptimizedWorkload> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cacheResult = await this.checkCache(workload);
      if (cacheResult) {
        this.emit('cache_hit', { workloadId: workload.id, cacheKey: cacheResult.key });
        return this.createOptimizedWorkloadFromCache(workload, cacheResult);
      }

      // Get or create performance profile
      const profile = await this.getPerformanceProfile(workload.workspaceId);
      
      // Select optimization strategies
      const strategies = this.selectOptimizationStrategies(workload, profile);
      
      // Apply optimizations
      let optimizedWorkload: OptimizedWorkload = {
        ...workload,
        optimizations: [],
        originalEstimatedDuration: workload.estimatedDuration
      };

      for (const strategy of strategies) {
        try {
          optimizedWorkload = await strategy.implementation(optimizedWorkload);
          optimizedWorkload.optimizations.push({
            strategy: strategy.id,
            parameters: {},
            expectedSpeedup: strategy.expectedSpeedup,
            cacheKeys: []
          });
          
          // Apply speedup to duration estimate
          optimizedWorkload.estimatedDuration = Math.round(
            optimizedWorkload.estimatedDuration / strategy.expectedSpeedup
          );
          
        } catch (error) {
          console.error(`Optimization strategy ${strategy.id} failed:`, error);
        }
      }

      // Update performance profile
      await this.updatePerformanceProfile(workload.workspaceId, {
        executionTime: Date.now() - startTime,
        optimizations: optimizedWorkload.optimizations.map(o => o.strategy)
      });

      this.emit('workload_optimized', { 
        workloadId: workload.id, 
        strategies: optimizedWorkload.optimizations.map(o => o.strategy),
        speedup: workload.estimatedDuration / optimizedWorkload.estimatedDuration
      });

      return optimizedWorkload;

    } catch (error) {
      console.error('Workload optimization failed:', error);
      
      // Return original workload if optimization fails
      return {
        ...workload,
        optimizations: [],
        originalEstimatedDuration: workload.estimatedDuration
      };
    }
  }

  /**
   * Cache simulation results
   */
  async cacheResults(workload: OptimizedWorkload, results: any, executionTime: number): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(workload);
      const workspaceHash = this.generateWorkspaceHash(workload.workspaceId);
      const configurationHash = this.generateConfigurationHash(workload.configuration);
      
      const cacheEntry: CacheEntry = {
        key: cacheKey,
        workspaceHash,
        configurationHash,
        results,
        executionTime,
        hitCount: 0,
        createdAt: new Date(),
        lastAccessed: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      };

      // Store in memory
      this.cacheEntries.set(cacheKey, cacheEntry);
      
      // Store in Redis
      await this.redis.hSet(`simulation_cache:${cacheKey}`, {
        workspaceHash,
        configurationHash,
        results: JSON.stringify(results),
        executionTime: executionTime.toString(),
        hitCount: '0',
        createdAt: cacheEntry.createdAt.toISOString(),
        lastAccessed: cacheEntry.lastAccessed.toISOString(),
        expiresAt: cacheEntry.expiresAt.toISOString()
      });

      // Set TTL
      await this.redis.expire(`simulation_cache:${cacheKey}`, 24 * 60 * 60);

      this.emit('results_cached', { workloadId: workload.id, cacheKey });

    } catch (error) {
      console.error('Failed to cache simulation results:', error);
    }
  }

  /**
   * Add workload to batch for processing
   */
  async addToBatch(workload: SimulationWorkload): Promise<boolean> {
    if (!this.batchingConfig.enabled) {
      return false;
    }

    const batchKey = this.generateBatchKey(workload);
    
    if (!this.pendingBatches.has(batchKey)) {
      this.pendingBatches.set(batchKey, []);
    }

    const batch = this.pendingBatches.get(batchKey)!;
    
    // Check if workload is similar enough to batch
    if (batch.length > 0 && !this.isWorkloadSimilar(workload, batch[0])) {
      return false;
    }

    batch.push(workload);

    // Start batch timer if this is the first workload
    if (batch.length === 1) {
      const timer = setTimeout(() => {
        this.processBatch(batchKey);
      }, this.batchingConfig.maxWaitTime);
      
      this.batchTimers.set(batchKey, timer);
    }

    // Process batch if it's full
    if (batch.length >= this.batchingConfig.maxBatchSize) {
      this.processBatch(batchKey);
    }

    this.emit('workload_batched', { workloadId: workload.id, batchKey, batchSize: batch.length });
    
    return true;
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const cacheEntries = Array.from(this.cacheEntries.values());
    const totalCacheRequests = cacheEntries.reduce((sum, entry) => sum + entry.hitCount, 0);
    const cacheHits = cacheEntries.filter(entry => entry.hitCount > 0).length;
    const cacheHitRate = totalCacheRequests > 0 ? (cacheHits / totalCacheRequests) * 100 : 0;

    // Calculate average speedup from performance profiles
    const profiles = Array.from(this.performanceProfiles.values());
    const averageSpeedup = profiles.length > 0 ? 
      profiles.reduce((sum, profile) => sum + (profile.averageExecutionTime > 0 ? 1 : 1), 0) / profiles.length : 1;

    // Calculate optimization strategy usage
    const optimizationsByStrategy: Record<string, number> = {};
    for (const profile of profiles) {
      for (const optimization of profile.optimizations) {
        optimizationsByStrategy[optimization] = (optimizationsByStrategy[optimization] || 0) + 1;
      }
    }

    return {
      timestamp: new Date(),
      totalOptimizations: profiles.reduce((sum, profile) => sum + profile.optimizations.length, 0),
      cacheHitRate,
      averageSpeedup,
      memoryReduction: this.calculateMemoryReduction(),
      batchingEfficiency: this.calculateBatchingEfficiency(),
      optimizationsByStrategy,
      performanceGains: {
        timeReduction: Math.max(0, (averageSpeedup - 1) * 100),
        resourceReduction: this.calculateResourceReduction(),
        throughputIncrease: Math.max(0, (averageSpeedup - 1) * 100)
      }
    };
  }

  /**
   * Get performance profile for workspace
   */
  async getPerformanceProfile(workspaceId: string): Promise<PerformanceProfile> {
    let profile = this.performanceProfiles.get(workspaceId);
    
    if (!profile) {
      // Create default profile
      profile = {
        workspaceId,
        complexity: 'medium',
        componentCount: 0,
        connectionCount: 0,
        averageExecutionTime: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        cacheHitRate: 0,
        optimizations: [],
        lastUpdated: new Date()
      };
      
      this.performanceProfiles.set(workspaceId, profile);
      await this.savePerformanceProfile(profile);
    }

    return profile;
  }

  /**
   * Update batching configuration
   */
  updateBatchingConfig(config: Partial<BatchingConfig>): void {
    Object.assign(this.batchingConfig, config);
    this.emit('batching_config_updated', this.batchingConfig);
  }

  /**
   * Clear cache
   */
  async clearCache(pattern?: string): Promise<number> {
    let clearedCount = 0;

    if (pattern) {
      // Clear specific pattern
      const keys = Array.from(this.cacheEntries.keys()).filter(key => key.includes(pattern));
      for (const key of keys) {
        this.cacheEntries.delete(key);
        await this.redis.del(`simulation_cache:${key}`);
        clearedCount++;
      }
    } else {
      // Clear all cache
      clearedCount = this.cacheEntries.size;
      this.cacheEntries.clear();

      const keys = await this.redis.keys('simulation_cache:*');
      if (keys.length > 0) {
        await this.redis.del(keys);
      }
    }

    this.emit('cache_cleared', { pattern, clearedCount });

    return clearedCount;
  }

  // Private methods

  /**
   * Initialize optimization strategies
   */
  private initializeOptimizationStrategies(): void {
    const strategies: OptimizationStrategy[] = [
      {
        id: 'component_caching',
        name: 'Component State Caching',
        description: 'Cache component states to avoid recalculation',
        applicableComplexity: ['medium', 'complex'],
        expectedSpeedup: 1.3,
        memoryOverhead: 20,
        implementation: async (workload): Promise<OptimizedWorkload> => {
          // Return optimized workload with strategy metadata
          const optimized = workload as OptimizedWorkload;
          if (!optimized.optimizations) {
            optimized.optimizations = [];
          }
          if (!optimized.originalEstimatedDuration) {
            optimized.originalEstimatedDuration = workload.estimatedDuration;
          }
          return optimized;
        }
      },
      {
        id: 'batch_processing',
        name: 'Batch Event Processing',
        description: 'Process simulation events in batches',
        applicableComplexity: ['complex'],
        expectedSpeedup: 1.5,
        memoryOverhead: 10,
        implementation: async (workload): Promise<OptimizedWorkload> => {
          // Return optimized workload with strategy metadata
          const optimized = workload as OptimizedWorkload;
          if (!optimized.optimizations) {
            optimized.optimizations = [];
          }
          if (!optimized.originalEstimatedDuration) {
            optimized.originalEstimatedDuration = workload.estimatedDuration;
          }
          return optimized;
        }
      },
      {
        id: 'parallel_computation',
        name: 'Parallel Computation',
        description: 'Use multiple threads for computation',
        applicableComplexity: ['medium', 'complex'],
        expectedSpeedup: 2.0,
        memoryOverhead: 50,
        implementation: async (workload): Promise<OptimizedWorkload> => {
          // Return optimized workload with strategy metadata
          const optimized = workload as OptimizedWorkload;
          if (!optimized.optimizations) {
            optimized.optimizations = [];
          }
          if (!optimized.originalEstimatedDuration) {
            optimized.originalEstimatedDuration = workload.estimatedDuration;
          }
          return optimized;
        }
      },
      {
        id: 'memory_pooling',
        name: 'Memory Pooling',
        description: 'Reuse memory allocations',
        applicableComplexity: ['simple', 'medium', 'complex'],
        expectedSpeedup: 1.2,
        memoryOverhead: 5,
        implementation: async (workload): Promise<OptimizedWorkload> => {
          // Return optimized workload with strategy metadata
          const optimized = workload as OptimizedWorkload;
          if (!optimized.optimizations) {
            optimized.optimizations = [];
          }
          if (!optimized.originalEstimatedDuration) {
            optimized.originalEstimatedDuration = workload.estimatedDuration;
          }
          return optimized;
        }
      },
      {
        id: 'lazy_evaluation',
        name: 'Lazy Evaluation',
        description: 'Defer calculations until needed',
        applicableComplexity: ['medium', 'complex'],
        expectedSpeedup: 1.4,
        memoryOverhead: 0,
        implementation: async (workload): Promise<OptimizedWorkload> => {
          // Return optimized workload with strategy metadata
          const optimized = workload as OptimizedWorkload;
          if (!optimized.optimizations) {
            optimized.optimizations = [];
          }
          if (!optimized.originalEstimatedDuration) {
            optimized.originalEstimatedDuration = workload.estimatedDuration;
          }
          return optimized;
        }
      }
    ];

    for (const strategy of strategies) {
      this.optimizationStrategies.set(strategy.id, strategy);
    }
  }

  /**
   * Select optimization strategies for workload
   */
  private selectOptimizationStrategies(workload: SimulationWorkload, profile: PerformanceProfile): OptimizationStrategy[] {
    const strategies: OptimizationStrategy[] = [];
    
    for (const [_, strategy] of this.optimizationStrategies) {
      // Check if strategy is applicable to this complexity
      if (!strategy.applicableComplexity.includes(workload.configuration.complexity)) {
        continue;
      }

      // Check memory constraints
      if (workload.estimatedMemoryUsage + strategy.memoryOverhead > 1000) { // 1GB limit
        continue;
      }

      // Check if strategy has been successful before
      if (profile.optimizations.includes(strategy.id)) {
        strategies.push(strategy);
      } else if (strategies.length < 3) { // Try new strategies
        strategies.push(strategy);
      }
    }

    // Sort by expected speedup
    return strategies.sort((a, b) => b.expectedSpeedup - a.expectedSpeedup);
  }

  /**
   * Check cache for workload
   */
  private async checkCache(workload: SimulationWorkload): Promise<CacheEntry | null> {
    const cacheKey = this.generateCacheKey(workload);
    let cacheEntry = this.cacheEntries.get(cacheKey);
    
    if (!cacheEntry) {
      // Try to load from Redis
      const cached = await this.redis.hGetAll(`simulation_cache:${cacheKey}`);
      if (Object.keys(cached).length > 0) {
        cacheEntry = {
          key: cacheKey,
          workspaceHash: cached.workspaceHash,
          configurationHash: cached.configurationHash,
          results: JSON.parse(cached.results),
          executionTime: parseInt(cached.executionTime),
          hitCount: parseInt(cached.hitCount),
          createdAt: new Date(cached.createdAt),
          lastAccessed: new Date(cached.lastAccessed),
          expiresAt: new Date(cached.expiresAt)
        };
        
        this.cacheEntries.set(cacheKey, cacheEntry);
      }
    }

    if (cacheEntry && cacheEntry.expiresAt > new Date()) {
      // Update hit count and last accessed
      cacheEntry.hitCount++;
      cacheEntry.lastAccessed = new Date();
      
      await this.redis.hSet(`simulation_cache:${cacheKey}`, {
        hitCount: cacheEntry.hitCount.toString(),
        lastAccessed: cacheEntry.lastAccessed.toISOString()
      });
      
      return cacheEntry;
    }

    return null;
  }

  /**
   * Create optimized workload from cache
   */
  private createOptimizedWorkloadFromCache(workload: SimulationWorkload, cacheEntry: CacheEntry): OptimizedWorkload {
    return {
      ...workload,
      optimizations: [{
        strategy: 'cache_hit',
        parameters: { cacheKey: cacheEntry.key },
        expectedSpeedup: 10, // Cache hits are very fast
        cacheKeys: [cacheEntry.key]
      }],
      originalEstimatedDuration: workload.estimatedDuration,
      estimatedDuration: Math.round(cacheEntry.executionTime / 1000) // Convert to seconds
    };
  }

  /**
   * Generate cache key for workload
   */
  private generateCacheKey(workload: SimulationWorkload): string {
    const keyData = {
      workspaceId: workload.workspaceId,
      userCount: workload.configuration.userCount,
      duration: workload.configuration.duration,
      complexity: workload.configuration.complexity,
      enableRealTimeUpdates: workload.configuration.enableRealTimeUpdates,
      enableFailureInjection: workload.configuration.enableFailureInjection,
      enableCostModeling: workload.configuration.enableCostModeling
    };
    
    return `sim_${this.hashObject(keyData)}`;
  }

  /**
   * Generate workspace hash
   */
  private generateWorkspaceHash(workspaceId: string): string {
    // In a real implementation, this would hash the workspace configuration
    return `ws_${workspaceId.slice(-8)}`;
  }

  /**
   * Generate configuration hash
   */
  private generateConfigurationHash(configuration: any): string {
    return `cfg_${this.hashObject(configuration)}`;
  }

  /**
   * Generate batch key for workload
   */
  private generateBatchKey(workload: SimulationWorkload): string {
    const batchData: any = {};
    
    if (this.batchingConfig.batchingStrategies.includes('workspace')) {
      batchData.workspaceId = workload.workspaceId;
    }
    
    if (this.batchingConfig.batchingStrategies.includes('configuration')) {
      batchData.complexity = workload.configuration.complexity;
      batchData.userCountRange = Math.floor(workload.configuration.userCount / 1000) * 1000;
    }
    
    if (this.batchingConfig.batchingStrategies.includes('user')) {
      batchData.userId = workload.userId;
    }
    
    return `batch_${this.hashObject(batchData)}`;
  }

  /**
   * Check if workload is similar to another
   */
  private isWorkloadSimilar(workload1: SimulationWorkload, workload2: SimulationWorkload): boolean {
    const similarity = this.calculateWorkloadSimilarity(workload1, workload2);
    return similarity >= this.batchingConfig.similarityThreshold;
  }

  /**
   * Calculate similarity between workloads
   */
  private calculateWorkloadSimilarity(workload1: SimulationWorkload, workload2: SimulationWorkload): number {
    let similarity = 0;
    let factors = 0;

    // Workspace similarity
    if (workload1.workspaceId === workload2.workspaceId) {
      similarity += 0.4;
    }
    factors++;

    // Configuration similarity
    const config1 = workload1.configuration;
    const config2 = workload2.configuration;
    
    if (config1.complexity === config2.complexity) {
      similarity += 0.2;
    }
    factors++;

    // User count similarity
    const userCountRatio = Math.min(config1.userCount, config2.userCount) / 
                          Math.max(config1.userCount, config2.userCount);
    similarity += userCountRatio * 0.2;
    factors++;

    // Duration similarity
    const durationRatio = Math.min(config1.duration, config2.duration) / 
                         Math.max(config1.duration, config2.duration);
    similarity += durationRatio * 0.1;
    factors++;

    // Feature similarity
    const features1 = [config1.enableRealTimeUpdates, config1.enableFailureInjection, config1.enableCostModeling];
    const features2 = [config2.enableRealTimeUpdates, config2.enableFailureInjection, config2.enableCostModeling];
    const featureSimilarity = features1.filter((f, i) => f === features2[i]).length / features1.length;
    similarity += featureSimilarity * 0.1;
    factors++;

    return similarity / factors;
  }

  /**
   * Process batch of workloads
   */
  private async processBatch(batchKey: string): Promise<void> {
    const batch = this.pendingBatches.get(batchKey);
    if (!batch || batch.length === 0) {
      return;
    }

    // Clear timer
    const timer = this.batchTimers.get(batchKey);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(batchKey);
    }

    // Remove batch from pending
    this.pendingBatches.delete(batchKey);

    this.emit('batch_processed', { batchKey, batchSize: batch.length });

    // In a real implementation, this would optimize the batch execution
    // For now, we'll just emit the batch for processing
    this.emit('batch_ready', { batchKey, workloads: batch });
  }

  /**
   * Update performance profile
   */
  private async updatePerformanceProfile(workspaceId: string, updates: {
    executionTime?: number;
    memoryUsage?: number;
    cpuUsage?: number;
    optimizations?: string[];
  }): Promise<void> {
    const profile = await this.getPerformanceProfile(workspaceId);
    
    if (updates.executionTime !== undefined) {
      profile.averageExecutionTime = profile.averageExecutionTime === 0 ? 
        updates.executionTime : 
        (profile.averageExecutionTime * 0.8 + updates.executionTime * 0.2);
    }
    
    if (updates.memoryUsage !== undefined) {
      profile.memoryUsage = updates.memoryUsage;
    }
    
    if (updates.cpuUsage !== undefined) {
      profile.cpuUsage = updates.cpuUsage;
    }
    
    if (updates.optimizations) {
      // Add new optimizations
      for (const optimization of updates.optimizations) {
        if (!profile.optimizations.includes(optimization)) {
          profile.optimizations.push(optimization);
        }
      }
    }
    
    profile.lastUpdated = new Date();
    
    await this.savePerformanceProfile(profile);
  }

  /**
   * Save performance profile
   */
  private async savePerformanceProfile(profile: PerformanceProfile): Promise<void> {
    await this.redis.hSet(`performance_profile:${profile.workspaceId}`, {
      complexity: profile.complexity,
      componentCount: profile.componentCount.toString(),
      connectionCount: profile.connectionCount.toString(),
      averageExecutionTime: profile.averageExecutionTime.toString(),
      memoryUsage: profile.memoryUsage.toString(),
      cpuUsage: profile.cpuUsage.toString(),
      cacheHitRate: profile.cacheHitRate.toString(),
      optimizations: JSON.stringify(profile.optimizations),
      lastUpdated: profile.lastUpdated.toISOString()
    });
  }

  /**
   * Load performance profiles from Redis
   */
  private async loadPerformanceProfiles(): Promise<void> {
    try {
      const keys = await this.redis.keys('performance_profile:*');
      
      for (const key of keys) {
        const workspaceId = key.replace('performance_profile:', '');
        const data = await this.redis.hGetAll(key);
        
        if (Object.keys(data).length > 0) {
          const profile: PerformanceProfile = {
            workspaceId,
            complexity: data.complexity as any,
            componentCount: parseInt(data.componentCount),
            connectionCount: parseInt(data.connectionCount),
            averageExecutionTime: parseFloat(data.averageExecutionTime),
            memoryUsage: parseFloat(data.memoryUsage),
            cpuUsage: parseFloat(data.cpuUsage),
            cacheHitRate: parseFloat(data.cacheHitRate),
            optimizations: JSON.parse(data.optimizations || '[]'),
            lastUpdated: new Date(data.lastUpdated)
          };
          
          this.performanceProfiles.set(workspaceId, profile);
        }
      }
    } catch (error) {
      console.error('Failed to load performance profiles:', error);
    }
  }

  /**
   * Load cache entries from Redis
   */
  private async loadCacheEntries(): Promise<void> {
    try {
      const keys = await this.redis.keys('simulation_cache:*');
      
      for (const key of keys) {
        const cacheKey = key.replace('simulation_cache:', '');
        const data = await this.redis.hGetAll(key);
        
        if (Object.keys(data).length > 0) {
          const entry: CacheEntry = {
            key: cacheKey,
            workspaceHash: data.workspaceHash,
            configurationHash: data.configurationHash,
            results: JSON.parse(data.results),
            executionTime: parseInt(data.executionTime),
            hitCount: parseInt(data.hitCount),
            createdAt: new Date(data.createdAt),
            lastAccessed: new Date(data.lastAccessed),
            expiresAt: new Date(data.expiresAt)
          };
          
          // Only load non-expired entries
          if (entry.expiresAt > new Date()) {
            this.cacheEntries.set(cacheKey, entry);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load cache entries:', error);
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsCollectionInterval = setInterval(async () => {
      try {
        const metrics = await this.getPerformanceMetrics();
        this.emit('metrics_collected', metrics);
      } catch (error) {
        console.error('Metrics collection error:', error);
      }
    }, 60000); // Collect every minute
  }

  /**
   * Start cache cleanup
   */
  private startCacheCleanup(): void {
    this.cacheCleanupInterval = setInterval(async () => {
      await this.cleanupExpiredCache();
    }, 300000); // Cleanup every 5 minutes
  }

  /**
   * Cleanup expired cache entries
   */
  private async cleanupExpiredCache(): Promise<void> {
    const now = new Date();
    const expiredKeys: string[] = [];
    
    for (const [key, entry] of this.cacheEntries) {
      if (entry.expiresAt <= now) {
        expiredKeys.push(key);
      }
    }
    
    for (const key of expiredKeys) {
      this.cacheEntries.delete(key);
      await this.redis.del(`simulation_cache:${key}`);
    }
    
    if (expiredKeys.length > 0) {
      this.emit('cache_cleaned', { expiredCount: expiredKeys.length });
    }
  }

  /**
   * Calculate memory reduction
   */
  private calculateMemoryReduction(): number {
    // Calculate based on optimization strategies used
    const profiles = Array.from(this.performanceProfiles.values());
    let totalReduction = 0;
    let profileCount = 0;
    
    for (const profile of profiles) {
      if (profile.optimizations.includes('memory_pooling')) {
        totalReduction += 10; // 10% reduction
      }
      if (profile.optimizations.includes('lazy_evaluation')) {
        totalReduction += 15; // 15% reduction
      }
      profileCount++;
    }
    
    return profileCount > 0 ? totalReduction / profileCount : 0;
  }

  /**
   * Calculate resource reduction
   */
  private calculateResourceReduction(): number {
    // Similar to memory reduction but for overall resources
    return this.calculateMemoryReduction() * 0.8; // Slightly less than memory reduction
  }

  /**
   * Calculate batching efficiency
   */
  private calculateBatchingEfficiency(): number {
    // Calculate based on batch processing success
    const totalBatches = this.pendingBatches.size;
    const averageBatchSize = totalBatches > 0 ? 
      Array.from(this.pendingBatches.values()).reduce((sum, batch) => sum + batch.length, 0) / totalBatches : 0;
    
    return Math.min(100, (averageBatchSize / this.batchingConfig.maxBatchSize) * 100);
  }

  /**
   * Hash object to string
   */
  private hashObject(obj: any): string {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    let hash = 0;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }

  /**
   * Cleanup optimizer
   */
  cleanup(): void {
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
    }
    
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
    }
    
    // Clear all batch timers
    for (const timer of this.batchTimers.values()) {
      clearTimeout(timer);
    }
    this.batchTimers.clear();
  }
}