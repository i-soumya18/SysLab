/**
 * Metrics collection system for real-time performance monitoring
 */

import { EventEmitter } from 'events';
import { ComponentMetrics } from '../types';

export interface AggregatedMetrics {
  componentId: string;
  timeWindow: number; // milliseconds
  startTime: number;
  endTime: number;
  requestsPerSecond: {
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
  latency: {
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
  errorRate: {
    min: number;
    max: number;
    avg: number;
  };
  resourceUtilization: {
    cpu: {
      min: number;
      max: number;
      avg: number;
    };
    memory: {
      min: number;
      max: number;
      avg: number;
    };
  };
  queueDepth: {
    min: number;
    max: number;
    avg: number;
  };
  totalRequests: number;
  totalErrors: number;
}

export interface SystemMetrics {
  timestamp: number;
  totalThroughput: number;
  averageLatency: number;
  systemErrorRate: number;
  activeComponents: number;
  healthyComponents: number;
  totalQueueDepth: number;
  componentMetrics: Map<string, AggregatedMetrics>;
}

export class MetricsCollector extends EventEmitter {
  private rawMetrics: Map<string, ComponentMetrics[]> = new Map();
  private aggregatedMetrics: Map<string, AggregatedMetrics[]> = new Map();
  private systemMetricsHistory: SystemMetrics[] = [];
  private aggregationInterval: number = 5000; // 5 seconds
  private retentionPeriod: number = 300000; // 5 minutes
  private aggregationTimer: NodeJS.Timeout | null = null;

  constructor(aggregationInterval: number = 5000, retentionPeriod: number = 300000) {
    super();
    this.aggregationInterval = aggregationInterval;
    this.retentionPeriod = retentionPeriod;
  }

  /**
   * Start metrics collection and aggregation
   */
  start(): void {
    this.aggregationTimer = setInterval(() => {
      this.aggregateMetrics();
      this.cleanupOldMetrics();
    }, this.aggregationInterval);

    this.emit('started');
  }

  /**
   * Stop metrics collection
   */
  stop(): void {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = null;
    }

    this.emit('stopped');
  }

  /**
   * Add raw metrics data point
   */
  addMetrics(metrics: ComponentMetrics): void {
    if (!this.rawMetrics.has(metrics.componentId)) {
      this.rawMetrics.set(metrics.componentId, []);
    }

    this.rawMetrics.get(metrics.componentId)!.push(metrics);
    this.emit('metrics_added', metrics);
  }

  /**
   * Get raw metrics for a component
   */
  getRawMetrics(componentId: string, startTime?: number, endTime?: number): ComponentMetrics[] {
    const metrics = this.rawMetrics.get(componentId) || [];
    
    if (!startTime && !endTime) {
      return metrics;
    }

    return metrics.filter(m => {
      if (startTime && m.timestamp < startTime) return false;
      if (endTime && m.timestamp > endTime) return false;
      return true;
    });
  }

  /**
   * Get aggregated metrics for a component
   */
  getAggregatedMetrics(componentId: string, startTime?: number, endTime?: number): AggregatedMetrics[] {
    const metrics = this.aggregatedMetrics.get(componentId) || [];
    
    if (!startTime && !endTime) {
      return metrics;
    }

    return metrics.filter(m => {
      if (startTime && m.endTime < startTime) return false;
      if (endTime && m.startTime > endTime) return false;
      return true;
    });
  }

  /**
   * Get system-wide metrics
   */
  getSystemMetrics(startTime?: number, endTime?: number): SystemMetrics[] {
    if (!startTime && !endTime) {
      return this.systemMetricsHistory;
    }

    return this.systemMetricsHistory.filter(m => {
      if (startTime && m.timestamp < startTime) return false;
      if (endTime && m.timestamp > endTime) return false;
      return true;
    });
  }

  /**
   * Get latest system metrics
   */
  getLatestSystemMetrics(): SystemMetrics | null {
    return this.systemMetricsHistory.length > 0 
      ? this.systemMetricsHistory[this.systemMetricsHistory.length - 1]
      : null;
  }

  /**
   * Get all component IDs with metrics
   */
  getComponentIds(): string[] {
    return Array.from(this.rawMetrics.keys());
  }

  /**
   * Clear all metrics data
   */
  clear(): void {
    this.rawMetrics.clear();
    this.aggregatedMetrics.clear();
    this.systemMetricsHistory = [];
    this.emit('cleared');
  }

  /**
   * Aggregate raw metrics into time windows
   */
  private aggregateMetrics(): void {
    const currentTime = Date.now();
    const windowStart = currentTime - this.aggregationInterval;

    // Aggregate metrics for each component
    for (const [componentId, rawMetrics] of this.rawMetrics) {
      const windowMetrics = rawMetrics.filter(m => 
        m.timestamp >= windowStart && m.timestamp < currentTime
      );

      if (windowMetrics.length === 0) continue;

      const aggregated = this.calculateAggregatedMetrics(
        componentId, 
        windowMetrics, 
        windowStart, 
        currentTime
      );

      if (!this.aggregatedMetrics.has(componentId)) {
        this.aggregatedMetrics.set(componentId, []);
      }

      this.aggregatedMetrics.get(componentId)!.push(aggregated);
    }

    // Calculate system-wide metrics
    const systemMetrics = this.calculateSystemMetrics(currentTime);
    this.systemMetricsHistory.push(systemMetrics);

    this.emit('metrics_aggregated', {
      timestamp: currentTime,
      componentCount: this.rawMetrics.size,
      systemMetrics
    });
  }

  /**
   * Calculate aggregated metrics for a component
   */
  private calculateAggregatedMetrics(
    componentId: string,
    metrics: ComponentMetrics[],
    startTime: number,
    endTime: number
  ): AggregatedMetrics {
    const rps = metrics.map(m => m.requestsPerSecond).sort((a, b) => a - b);
    const latencies = metrics.map(m => m.averageLatency).sort((a, b) => a - b);
    const errorRates = metrics.map(m => m.errorRate).sort((a, b) => a - b);
    const cpuUtils = metrics.map(m => m.cpuUtilization).sort((a, b) => a - b);
    const memUtils = metrics.map(m => m.memoryUtilization).sort((a, b) => a - b);
    const queueDepths = metrics.map(m => m.queueDepth).sort((a, b) => a - b);

    return {
      componentId,
      timeWindow: endTime - startTime,
      startTime,
      endTime,
      requestsPerSecond: {
        min: Math.min(...rps),
        max: Math.max(...rps),
        avg: this.average(rps),
        p50: this.percentile(rps, 0.5),
        p95: this.percentile(rps, 0.95),
        p99: this.percentile(rps, 0.99)
      },
      latency: {
        min: Math.min(...latencies),
        max: Math.max(...latencies),
        avg: this.average(latencies),
        p50: this.percentile(latencies, 0.5),
        p95: this.percentile(latencies, 0.95),
        p99: this.percentile(latencies, 0.99)
      },
      errorRate: {
        min: Math.min(...errorRates),
        max: Math.max(...errorRates),
        avg: this.average(errorRates)
      },
      resourceUtilization: {
        cpu: {
          min: Math.min(...cpuUtils),
          max: Math.max(...cpuUtils),
          avg: this.average(cpuUtils)
        },
        memory: {
          min: Math.min(...memUtils),
          max: Math.max(...memUtils),
          avg: this.average(memUtils)
        }
      },
      queueDepth: {
        min: Math.min(...queueDepths),
        max: Math.max(...queueDepths),
        avg: this.average(queueDepths)
      },
      totalRequests: metrics.reduce((sum, m) => sum + m.requestsPerSecond, 0),
      totalErrors: metrics.reduce((sum, m) => sum + (m.requestsPerSecond * m.errorRate), 0)
    };
  }

  /**
   * Calculate system-wide metrics
   */
  private calculateSystemMetrics(timestamp: number): SystemMetrics {
    const componentMetrics = new Map<string, AggregatedMetrics>();
    let totalThroughput = 0;
    let totalLatency = 0;
    let totalErrors = 0;
    let totalRequests = 0;
    let activeComponents = 0;
    let healthyComponents = 0;
    let totalQueueDepth = 0;

    // Get latest aggregated metrics for each component
    for (const [componentId, aggregatedList] of this.aggregatedMetrics) {
      if (aggregatedList.length === 0) continue;

      const latest = aggregatedList[aggregatedList.length - 1];
      componentMetrics.set(componentId, latest);

      totalThroughput += latest.requestsPerSecond.avg;
      totalLatency += latest.latency.avg;
      totalErrors += latest.totalErrors;
      totalRequests += latest.totalRequests;
      totalQueueDepth += latest.queueDepth.avg;
      activeComponents++;

      // Consider component healthy if error rate is below 5%
      if (latest.errorRate.avg < 0.05) {
        healthyComponents++;
      }
    }

    return {
      timestamp,
      totalThroughput,
      averageLatency: activeComponents > 0 ? totalLatency / activeComponents : 0,
      systemErrorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
      activeComponents,
      healthyComponents,
      totalQueueDepth,
      componentMetrics
    };
  }

  /**
   * Clean up old metrics data
   */
  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - this.retentionPeriod;

    // Clean raw metrics
    for (const [componentId, metrics] of this.rawMetrics) {
      const filtered = metrics.filter(m => m.timestamp >= cutoffTime);
      this.rawMetrics.set(componentId, filtered);
    }

    // Clean aggregated metrics
    for (const [componentId, metrics] of this.aggregatedMetrics) {
      const filtered = metrics.filter(m => m.endTime >= cutoffTime);
      this.aggregatedMetrics.set(componentId, filtered);
    }

    // Clean system metrics
    this.systemMetricsHistory = this.systemMetricsHistory.filter(
      m => m.timestamp >= cutoffTime
    );
  }

  /**
   * Calculate average of an array
   */
  private average(values: number[]): number {
    return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
  }

  /**
   * Calculate percentile of a sorted array
   */
  private percentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    
    const index = Math.ceil(sortedValues.length * percentile) - 1;
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
  }
}