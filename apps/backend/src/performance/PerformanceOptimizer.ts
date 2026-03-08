/**
 * Performance Optimizer for Sub-100ms Simulation Updates
 * 
 * Implements SRS NFR-1: Optimize simulation engine for <100ms updates
 * with efficient metric calculation and caching
 */

import { EventEmitter } from 'events';
import { ComponentMetrics, Workspace } from '../types';
import { AggregatedMetrics, SystemMetrics } from '../simulation/MetricsCollector';

export interface PerformanceConfig {
  targetUpdateTime: number; // milliseconds (default: 100ms per SRS NFR-1)
  cacheSize: number;
  enableProfiling: boolean;
  optimizationLevel: 'basic' | 'aggressive' | 'maximum';
  batchSize: number;
}

export interface PerformanceMetrics {
  updateTime: number;
  cacheHitRate: number;
  memoryUsage: number;
  cpuUsage: number;
  bottlenecks: string[];
  optimizationSuggestions: string[];
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccess: number;
}

/**
 * High-performance cache with LRU eviction and TTL
 */
export class PerformanceCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private ttl: number;
  private hitCount: number = 0;
  private missCount: number = 0;

  constructor(maxSize: number = 1000, ttl: number = 5000) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.missCount++;
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      this.missCount++;
      return null;
    }

    // Update access info
    entry.accessCount++;
    entry.lastAccess = Date.now();
    this.hitCount++;
    
    return entry.data;
  }

  set(key: string, data: T): void {
    const now = Date.now();
    
    // Remove expired entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictExpired();
      
      // If still full, evict LRU entries
      if (this.cache.size >= this.maxSize) {
        this.evictLRU();
      }
    }

    this.cache.set(key, {
      data,
      timestamp: now,
      accessCount: 1,
      lastAccess: now
    });
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Date.now();

    for (const [key, entry] of this.cache) {
      if (entry.lastAccess < oldestAccess) {
        oldestAccess = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  getHitRate(): number {
    const total = this.hitCount + this.missCount;
    return total > 0 ? this.hitCount / total : 0;
  }

  clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * Optimized metrics calculator with caching and batching
 */
export class OptimizedMetricsCalculator {
  private cache: PerformanceCache<any>;
  private batchProcessor: BatchProcessor;

  constructor(config: PerformanceConfig) {
    this.cache = new PerformanceCache(config.cacheSize, 1000); // 1s TTL for metrics
    this.batchProcessor = new BatchProcessor(config.batchSize);
  }

  /**
   * Calculate component metrics with caching
   */
  calculateComponentMetrics(componentId: string, rawData: any[]): ComponentMetrics | null {
    const cacheKey = `component_${componentId}_${this.getDataHash(rawData)}`;
    
    // Try cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Calculate metrics
    const startTime = performance.now();
    const metrics = this.performCalculation(componentId, rawData);
    const calculationTime = performance.now() - startTime;

    // Cache result if calculation was expensive (>10ms)
    if (calculationTime > 10) {
      this.cache.set(cacheKey, metrics);
    }

    return metrics;
  }

  /**
   * Calculate aggregated metrics with optimizations
   */
  calculateAggregatedMetrics(
    componentId: string, 
    rawMetrics: ComponentMetrics[], 
    timeWindow: number
  ): AggregatedMetrics | null {
    if (rawMetrics.length === 0) return null;

    const cacheKey = `aggregated_${componentId}_${timeWindow}_${rawMetrics.length}`;
    
    // Try cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Use optimized calculation
    const result = this.calculateAggregatedOptimized(componentId, rawMetrics, timeWindow);
    
    // Cache result
    this.cache.set(cacheKey, result);
    
    return result;
  }

  /**
   * Optimized aggregated metrics calculation using streaming algorithms
   */
  private calculateAggregatedOptimized(
    componentId: string,
    metrics: ComponentMetrics[],
    timeWindow: number
  ): AggregatedMetrics {
    const startTime = metrics[0]?.timestamp || Date.now();
    const endTime = startTime + timeWindow;

    // Use streaming statistics for better performance
    const rpsStats = new StreamingStats();
    const latencyStats = new StreamingStats();
    const errorRateStats = new StreamingStats();
    const cpuStats = new StreamingStats();
    const memStats = new StreamingStats();
    const queueStats = new StreamingStats();

    let totalRequests = 0;
    let totalErrors = 0;

    // Single pass through data
    for (const metric of metrics) {
      rpsStats.add(metric.requestsPerSecond);
      latencyStats.add(metric.averageLatency);
      errorRateStats.add(metric.errorRate);
      cpuStats.add(metric.cpuUtilization);
      memStats.add(metric.memoryUtilization);
      queueStats.add(metric.queueDepth);

      totalRequests += metric.requestsPerSecond;
      totalErrors += metric.requestsPerSecond * metric.errorRate;
    }

    return {
      componentId,
      timeWindow,
      startTime,
      endTime,
      requestsPerSecond: {
        min: rpsStats.min,
        max: rpsStats.max,
        avg: rpsStats.mean,
        p50: rpsStats.percentile(0.5),
        p95: rpsStats.percentile(0.95),
        p99: rpsStats.percentile(0.99)
      },
      latency: {
        min: latencyStats.min,
        max: latencyStats.max,
        avg: latencyStats.mean,
        p50: latencyStats.percentile(0.5),
        p95: latencyStats.percentile(0.95),
        p99: latencyStats.percentile(0.99)
      },
      errorRate: {
        min: errorRateStats.min,
        max: errorRateStats.max,
        avg: errorRateStats.mean
      },
      resourceUtilization: {
        cpu: {
          min: cpuStats.min,
          max: cpuStats.max,
          avg: cpuStats.mean
        },
        memory: {
          min: memStats.min,
          max: memStats.max,
          avg: memStats.mean
        }
      },
      queueDepth: {
        min: queueStats.min,
        max: queueStats.max,
        avg: queueStats.mean
      },
      totalRequests,
      totalErrors
    };
  }

  private performCalculation(componentId: string, rawData: any[]): ComponentMetrics {
    // Simplified calculation for demonstration
    const timestamp = Date.now();
    const rps = rawData.length > 0 ? rawData.reduce((sum, d) => sum + (d.requests || 0), 0) / rawData.length : 0;
    
    return {
      componentId,
      timestamp,
      requestsPerSecond: rps,
      averageLatency: 50 + Math.random() * 100,
      errorRate: Math.random() * 0.05,
      cpuUtilization: Math.random() * 0.8,
      memoryUtilization: Math.random() * 0.6,
      queueDepth: Math.floor(Math.random() * 10)
    };
  }

  private getDataHash(data: any[]): string {
    // Simple hash for cache key
    return data.length.toString() + '_' + (data[0]?.timestamp || '0');
  }

  getCacheStats(): { hitRate: number; size: number } {
    return {
      hitRate: this.cache.getHitRate(),
      size: this.cache.size()
    };
  }
}

/**
 * Streaming statistics calculator for efficient percentile computation
 */
class StreamingStats {
  private values: number[] = [];
  private _sum: number = 0;
  private _count: number = 0;
  private _min: number = Infinity;
  private _max: number = -Infinity;

  add(value: number): void {
    this.values.push(value);
    this._sum += value;
    this._count++;
    this._min = Math.min(this._min, value);
    this._max = Math.max(this._max, value);
  }

  get min(): number { return this._min === Infinity ? 0 : this._min; }
  get max(): number { return this._max === -Infinity ? 0 : this._max; }
  get mean(): number { return this._count > 0 ? this._sum / this._count : 0; }
  get count(): number { return this._count; }

  percentile(p: number): number {
    if (this.values.length === 0) return 0;
    
    const sorted = [...this.values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }
}

/**
 * Batch processor for efficient bulk operations
 */
class BatchProcessor {
  private batchSize: number;
  private pendingItems: any[] = [];
  private processingPromise: Promise<void> | null = null;

  constructor(batchSize: number = 100) {
    this.batchSize = batchSize;
  }

  async add(item: any): Promise<void> {
    this.pendingItems.push(item);
    
    if (this.pendingItems.length >= this.batchSize) {
      return this.processBatch();
    }
  }

  private async processBatch(): Promise<void> {
    if (this.processingPromise) {
      return this.processingPromise;
    }

    this.processingPromise = this.performBatchProcessing();
    await this.processingPromise;
    this.processingPromise = null;
  }

  private async performBatchProcessing(): Promise<void> {
    const batch = this.pendingItems.splice(0, this.batchSize);
    
    // Process batch efficiently
    // Implementation depends on specific use case
    await new Promise(resolve => setImmediate(resolve));
  }
}

/**
 * Main performance optimizer class
 */
export class PerformanceOptimizer extends EventEmitter {
  private config: PerformanceConfig;
  private metricsCalculator: OptimizedMetricsCalculator;
  private performanceMonitor: PerformanceMonitor;
  private alertThresholds: Map<string, number> = new Map();

  constructor(config: Partial<PerformanceConfig> = {}) {
    super();
    
    this.config = {
      targetUpdateTime: 100, // 100ms per SRS NFR-1
      cacheSize: 1000,
      enableProfiling: true,
      optimizationLevel: 'aggressive',
      batchSize: 50,
      ...config
    };

    this.metricsCalculator = new OptimizedMetricsCalculator(this.config);
    this.performanceMonitor = new PerformanceMonitor(this.config.targetUpdateTime);
    
    this.setupAlertThresholds();
    this.setupPerformanceMonitoring();
  }

  /**
   * Optimize simulation update cycle
   */
  async optimizeSimulationUpdate(
    workspace: Workspace,
    rawMetrics: Map<string, ComponentMetrics[]>
  ): Promise<{
    componentMetrics: Map<string, ComponentMetrics>;
    systemMetrics: SystemMetrics;
    performanceStats: PerformanceMetrics;
  }> {
    const startTime = performance.now();
    
    try {
      // Process component metrics in parallel
      const componentPromises = Array.from(rawMetrics.entries()).map(
        async ([componentId, metrics]) => {
          const latest = await this.metricsCalculator.calculateComponentMetrics(
            componentId, 
            metrics.slice(-10) // Only use last 10 data points for real-time
          );
          return [componentId, latest] as [string, ComponentMetrics];
        }
      );

      const componentResults = await Promise.all(componentPromises);
      const componentMetrics = new Map(
        componentResults.filter(([_, metrics]) => metrics !== null)
      );

      // Calculate system metrics
      const systemMetrics = this.calculateSystemMetrics(componentMetrics);

      // Record performance
      const executionTime = performance.now() - startTime;
      this.performanceMonitor.recordUpdate(executionTime);

      // Generate performance stats
      const performanceStats = this.generatePerformanceStats(executionTime);

      // Check for performance issues
      if (executionTime > this.config.targetUpdateTime) {
        this.emit('performance_warning', {
          executionTime,
          target: this.config.targetUpdateTime,
          componentCount: componentMetrics.size
        });
      }

      return {
        componentMetrics,
        systemMetrics,
        performanceStats
      };

    } catch (error) {
      this.emit('optimization_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: performance.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Calculate system-wide metrics efficiently
   */
  private calculateSystemMetrics(componentMetrics: Map<string, ComponentMetrics>): SystemMetrics {
    let totalThroughput = 0;
    let totalLatency = 0;
    let totalErrors = 0;
    let totalRequests = 0;
    let healthyComponents = 0;
    let totalQueueDepth = 0;

    for (const metrics of componentMetrics.values()) {
      totalThroughput += metrics.requestsPerSecond;
      totalLatency += metrics.averageLatency;
      totalRequests += metrics.requestsPerSecond;
      totalErrors += metrics.requestsPerSecond * metrics.errorRate;
      totalQueueDepth += metrics.queueDepth;

      if (metrics.errorRate < 0.05) {
        healthyComponents++;
      }
    }

    const activeComponents = componentMetrics.size;

    return {
      timestamp: Date.now(),
      totalThroughput,
      averageLatency: activeComponents > 0 ? totalLatency / activeComponents : 0,
      systemErrorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
      activeComponents,
      healthyComponents,
      totalQueueDepth,
      componentMetrics: new Map() // Simplified for performance
    };
  }

  /**
   * Generate performance statistics
   */
  private generatePerformanceStats(executionTime: number): PerformanceMetrics {
    const cacheStats = this.metricsCalculator.getCacheStats();
    const monitorStats = this.performanceMonitor.getStats();

    return {
      updateTime: executionTime,
      cacheHitRate: cacheStats.hitRate,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
      cpuUsage: process.cpuUsage().user / 1000, // Convert to ms
      bottlenecks: this.identifyBottlenecks(executionTime, monitorStats),
      optimizationSuggestions: this.generateOptimizationSuggestions(executionTime, cacheStats)
    };
  }

  /**
   * Identify performance bottlenecks
   */
  private identifyBottlenecks(executionTime: number, stats: any): string[] {
    const bottlenecks: string[] = [];

    if (executionTime > this.config.targetUpdateTime) {
      bottlenecks.push('Update time exceeds target');
    }

    if (stats.averageUpdateTime > this.config.targetUpdateTime * 0.8) {
      bottlenecks.push('Consistently slow updates');
    }

    const memUsage = process.memoryUsage().heapUsed / 1024 / 1024;
    if (memUsage > 500) { // 500MB threshold
      bottlenecks.push('High memory usage');
    }

    return bottlenecks;
  }

  /**
   * Generate optimization suggestions
   */
  private generateOptimizationSuggestions(executionTime: number, cacheStats: any): string[] {
    const suggestions: string[] = [];

    if (cacheStats.hitRate < 0.7) {
      suggestions.push('Increase cache size or TTL');
    }

    if (executionTime > this.config.targetUpdateTime) {
      suggestions.push('Enable aggressive optimization level');
      suggestions.push('Reduce batch size for faster processing');
    }

    if (cacheStats.size > this.config.cacheSize * 0.9) {
      suggestions.push('Consider increasing cache size');
    }

    return suggestions;
  }

  private setupAlertThresholds(): void {
    this.alertThresholds.set('update_time', this.config.targetUpdateTime);
    this.alertThresholds.set('cache_hit_rate', 0.7);
    this.alertThresholds.set('memory_usage', 500); // MB
  }

  private setupPerformanceMonitoring(): void {
    this.performanceMonitor.on('performance_degradation', (data) => {
      this.emit('performance_alert', {
        type: 'degradation',
        ...data
      });
    });
  }

  /**
   * Get current performance statistics
   */
  getPerformanceStats(): PerformanceMetrics {
    const cacheStats = this.metricsCalculator.getCacheStats();
    const monitorStats = this.performanceMonitor.getStats();

    return {
      updateTime: monitorStats.averageUpdateTime,
      cacheHitRate: cacheStats.hitRate,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
      cpuUsage: process.cpuUsage().user / 1000,
      bottlenecks: this.identifyBottlenecks(monitorStats.averageUpdateTime, monitorStats),
      optimizationSuggestions: this.generateOptimizationSuggestions(monitorStats.averageUpdateTime, cacheStats)
    };
  }
}

/**
 * Performance monitor for tracking update times
 */
class PerformanceMonitor extends EventEmitter {
  private updateTimes: number[] = [];
  private targetTime: number;
  private maxSamples: number = 100;

  constructor(targetTime: number) {
    super();
    this.targetTime = targetTime;
  }

  recordUpdate(timeMs: number): void {
    this.updateTimes.push(timeMs);
    
    if (this.updateTimes.length > this.maxSamples) {
      this.updateTimes.shift();
    }

    // Check for performance degradation
    if (this.updateTimes.length >= 10) {
      const recentAverage = this.updateTimes.slice(-10).reduce((a, b) => a + b, 0) / 10;
      if (recentAverage > this.targetTime * 1.5) {
        this.emit('performance_degradation', {
          recentAverage,
          target: this.targetTime,
          samples: 10
        });
      }
    }
  }

  getStats(): {
    averageUpdateTime: number;
    minUpdateTime: number;
    maxUpdateTime: number;
    p95UpdateTime: number;
    targetCompliance: number;
  } {
    if (this.updateTimes.length === 0) {
      return {
        averageUpdateTime: 0,
        minUpdateTime: 0,
        maxUpdateTime: 0,
        p95UpdateTime: 0,
        targetCompliance: 100
      };
    }

    const sorted = [...this.updateTimes].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const p95Index = Math.floor(sorted.length * 0.95);
    const underTarget = sorted.filter(time => time <= this.targetTime).length;

    return {
      averageUpdateTime: sum / sorted.length,
      minUpdateTime: sorted[0],
      maxUpdateTime: sorted[sorted.length - 1],
      p95UpdateTime: sorted[p95Index],
      targetCompliance: (underTarget / sorted.length) * 100
    };
  }
}