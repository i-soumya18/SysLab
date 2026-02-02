/**
 * Metrics storage and retrieval system
 */

import { ComponentMetrics } from '../types';
import { AggregatedMetrics, SystemMetrics } from './MetricsCollector';

export interface MetricsQuery {
  componentIds?: string[];
  startTime?: number;
  endTime?: number;
  aggregationLevel?: 'raw' | 'aggregated' | 'system';
  limit?: number;
}

export interface MetricsStorageConfig {
  maxRawMetrics: number;
  maxAggregatedMetrics: number;
  maxSystemMetrics: number;
  compressionEnabled: boolean;
}

/**
 * In-memory metrics storage with configurable retention
 * In production, this would be backed by a time-series database like InfluxDB or TimescaleDB
 */
export class MetricsStorage {
  private rawMetrics: Map<string, ComponentMetrics[]> = new Map();
  private aggregatedMetrics: Map<string, AggregatedMetrics[]> = new Map();
  private systemMetrics: SystemMetrics[] = [];
  private config: MetricsStorageConfig;

  constructor(config: Partial<MetricsStorageConfig> = {}) {
    this.config = {
      maxRawMetrics: 10000,
      maxAggregatedMetrics: 1000,
      maxSystemMetrics: 1000,
      compressionEnabled: false,
      ...config
    };
  }

  /**
   * Store raw component metrics
   */
  storeRawMetrics(metrics: ComponentMetrics): void {
    if (!this.rawMetrics.has(metrics.componentId)) {
      this.rawMetrics.set(metrics.componentId, []);
    }

    const componentMetrics = this.rawMetrics.get(metrics.componentId)!;
    componentMetrics.push(metrics);

    // Enforce retention limits
    if (componentMetrics.length > this.config.maxRawMetrics) {
      componentMetrics.splice(0, componentMetrics.length - this.config.maxRawMetrics);
    }
  }

  /**
   * Store aggregated metrics
   */
  storeAggregatedMetrics(metrics: AggregatedMetrics): void {
    if (!this.aggregatedMetrics.has(metrics.componentId)) {
      this.aggregatedMetrics.set(metrics.componentId, []);
    }

    const componentMetrics = this.aggregatedMetrics.get(metrics.componentId)!;
    componentMetrics.push(metrics);

    // Enforce retention limits
    if (componentMetrics.length > this.config.maxAggregatedMetrics) {
      componentMetrics.splice(0, componentMetrics.length - this.config.maxAggregatedMetrics);
    }
  }

  /**
   * Store system metrics
   */
  storeSystemMetrics(metrics: SystemMetrics): void {
    this.systemMetrics.push(metrics);

    // Enforce retention limits
    if (this.systemMetrics.length > this.config.maxSystemMetrics) {
      this.systemMetrics.splice(0, this.systemMetrics.length - this.config.maxSystemMetrics);
    }
  }

  /**
   * Query raw metrics
   */
  queryRawMetrics(query: MetricsQuery): ComponentMetrics[] {
    const results: ComponentMetrics[] = [];

    const componentIds = query.componentIds || Array.from(this.rawMetrics.keys());

    for (const componentId of componentIds) {
      const metrics = this.rawMetrics.get(componentId) || [];
      
      const filtered = metrics.filter(m => {
        if (query.startTime && m.timestamp < query.startTime) return false;
        if (query.endTime && m.timestamp > query.endTime) return false;
        return true;
      });

      results.push(...filtered);
    }

    // Sort by timestamp
    results.sort((a, b) => a.timestamp - b.timestamp);

    // Apply limit
    if (query.limit && results.length > query.limit) {
      return results.slice(-query.limit);
    }

    return results;
  }

  /**
   * Query aggregated metrics
   */
  queryAggregatedMetrics(query: MetricsQuery): AggregatedMetrics[] {
    const results: AggregatedMetrics[] = [];

    const componentIds = query.componentIds || Array.from(this.aggregatedMetrics.keys());

    for (const componentId of componentIds) {
      const metrics = this.aggregatedMetrics.get(componentId) || [];
      
      const filtered = metrics.filter(m => {
        if (query.startTime && m.endTime < query.startTime) return false;
        if (query.endTime && m.startTime > query.endTime) return false;
        return true;
      });

      results.push(...filtered);
    }

    // Sort by end time
    results.sort((a, b) => a.endTime - b.endTime);

    // Apply limit
    if (query.limit && results.length > query.limit) {
      return results.slice(-query.limit);
    }

    return results;
  }

  /**
   * Query system metrics
   */
  querySystemMetrics(query: MetricsQuery): SystemMetrics[] {
    let filtered = this.systemMetrics.filter(m => {
      if (query.startTime && m.timestamp < query.startTime) return false;
      if (query.endTime && m.timestamp > query.endTime) return false;
      return true;
    });

    // Apply limit
    if (query.limit && filtered.length > query.limit) {
      filtered = filtered.slice(-query.limit);
    }

    return filtered;
  }

  /**
   * Get latest metrics for a component
   */
  getLatestRawMetrics(componentId: string): ComponentMetrics | null {
    const metrics = this.rawMetrics.get(componentId);
    return metrics && metrics.length > 0 ? metrics[metrics.length - 1] : null;
  }

  /**
   * Get latest aggregated metrics for a component
   */
  getLatestAggregatedMetrics(componentId: string): AggregatedMetrics | null {
    const metrics = this.aggregatedMetrics.get(componentId);
    return metrics && metrics.length > 0 ? metrics[metrics.length - 1] : null;
  }

  /**
   * Get latest system metrics
   */
  getLatestSystemMetrics(): SystemMetrics | null {
    return this.systemMetrics.length > 0 ? this.systemMetrics[this.systemMetrics.length - 1] : null;
  }

  /**
   * Get metrics summary for all components
   */
  getMetricsSummary(): {
    componentCount: number;
    totalRawMetrics: number;
    totalAggregatedMetrics: number;
    totalSystemMetrics: number;
    timeRange: { start: number; end: number } | null;
  } {
    let totalRawMetrics = 0;
    let totalAggregatedMetrics = 0;
    let earliestTime = Number.MAX_SAFE_INTEGER;
    let latestTime = 0;

    // Count raw metrics
    for (const metrics of this.rawMetrics.values()) {
      totalRawMetrics += metrics.length;
      if (metrics.length > 0) {
        earliestTime = Math.min(earliestTime, metrics[0].timestamp);
        latestTime = Math.max(latestTime, metrics[metrics.length - 1].timestamp);
      }
    }

    // Count aggregated metrics
    for (const metrics of this.aggregatedMetrics.values()) {
      totalAggregatedMetrics += metrics.length;
      if (metrics.length > 0) {
        earliestTime = Math.min(earliestTime, metrics[0].startTime);
        latestTime = Math.max(latestTime, metrics[metrics.length - 1].endTime);
      }
    }

    // Check system metrics
    if (this.systemMetrics.length > 0) {
      earliestTime = Math.min(earliestTime, this.systemMetrics[0].timestamp);
      latestTime = Math.max(latestTime, this.systemMetrics[this.systemMetrics.length - 1].timestamp);
    }

    return {
      componentCount: this.rawMetrics.size,
      totalRawMetrics,
      totalAggregatedMetrics,
      totalSystemMetrics: this.systemMetrics.length,
      timeRange: earliestTime < Number.MAX_SAFE_INTEGER ? { start: earliestTime, end: latestTime } : null
    };
  }

  /**
   * Clear all stored metrics
   */
  clear(): void {
    this.rawMetrics.clear();
    this.aggregatedMetrics.clear();
    this.systemMetrics = [];
  }

  /**
   * Clear metrics for a specific component
   */
  clearComponent(componentId: string): void {
    this.rawMetrics.delete(componentId);
    this.aggregatedMetrics.delete(componentId);
  }

  /**
   * Get all component IDs with stored metrics
   */
  getComponentIds(): string[] {
    const rawIds = Array.from(this.rawMetrics.keys());
    const aggIds = Array.from(this.aggregatedMetrics.keys());
    return Array.from(new Set([...rawIds, ...aggIds]));
  }

  /**
   * Export metrics data for backup or analysis
   */
  exportMetrics(): {
    rawMetrics: Record<string, ComponentMetrics[]>;
    aggregatedMetrics: Record<string, AggregatedMetrics[]>;
    systemMetrics: SystemMetrics[];
    exportTime: number;
  } {
    const rawMetrics: Record<string, ComponentMetrics[]> = {};
    const aggregatedMetrics: Record<string, AggregatedMetrics[]> = {};

    for (const [componentId, metrics] of this.rawMetrics) {
      rawMetrics[componentId] = [...metrics];
    }

    for (const [componentId, metrics] of this.aggregatedMetrics) {
      aggregatedMetrics[componentId] = [...metrics];
    }

    return {
      rawMetrics,
      aggregatedMetrics,
      systemMetrics: [...this.systemMetrics],
      exportTime: Date.now()
    };
  }

  /**
   * Import metrics data from backup
   */
  importMetrics(data: {
    rawMetrics: Record<string, ComponentMetrics[]>;
    aggregatedMetrics: Record<string, AggregatedMetrics[]>;
    systemMetrics: SystemMetrics[];
  }): void {
    // Clear existing data
    this.clear();

    // Import raw metrics
    for (const [componentId, metrics] of Object.entries(data.rawMetrics)) {
      this.rawMetrics.set(componentId, [...metrics]);
    }

    // Import aggregated metrics
    for (const [componentId, metrics] of Object.entries(data.aggregatedMetrics)) {
      this.aggregatedMetrics.set(componentId, [...metrics]);
    }

    // Import system metrics
    this.systemMetrics = [...data.systemMetrics];
  }

  /**
   * Get latest raw metrics for all components in a workspace
   */
  getLatestRawMetricsForWorkspace(workspaceId: string): Map<string, ComponentMetrics> {
    const result = new Map<string, ComponentMetrics>();
    
    for (const [componentId, metrics] of this.rawMetrics) {
      if (metrics.length > 0) {
        const latest = metrics[metrics.length - 1];
        result.set(componentId, latest);
      }
    }
    
    return result;
  }

  /**
   * Get latest aggregated metrics for all components in a workspace
   */
  getLatestAggregatedMetricsForWorkspace(workspaceId: string): Map<string, AggregatedMetrics> {
    const result = new Map<string, AggregatedMetrics>();
    
    for (const [componentId, metrics] of this.aggregatedMetrics) {
      if (metrics.length > 0) {
        const latest = metrics[metrics.length - 1];
        result.set(componentId, latest);
      }
    }
    
    return result;
  }
}