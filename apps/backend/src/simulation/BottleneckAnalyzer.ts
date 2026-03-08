/**
 * Bottleneck detection and performance analysis system
 */

import { ComponentMetrics, Component, Connection } from '../types';
import { AggregatedMetrics, SystemMetrics } from './MetricsCollector';

export interface BottleneckDetection {
  componentId: string;
  componentName: string;
  componentType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  bottleneckType: 'cpu' | 'memory' | 'latency' | 'throughput' | 'queue' | 'error_rate';
  currentValue: number;
  threshold: number;
  impact: number; // 0-1 scale representing impact on system performance
  description: string;
  recommendations: string[];
  timestamp: number;
}

export interface SystemBottleneckReport {
  timestamp: number;
  overallHealth: 'healthy' | 'degraded' | 'critical';
  bottlenecks: BottleneckDetection[];
  systemImpact: number; // 0-1 scale
  primaryBottleneck: BottleneckDetection | null;
  recommendations: string[];
  performanceTrends: {
    throughputTrend: 'improving' | 'stable' | 'degrading';
    latencyTrend: 'improving' | 'stable' | 'degrading';
    errorTrend: 'improving' | 'stable' | 'degrading';
  };
}

export interface BottleneckThresholds {
  cpu: { warning: number; critical: number };
  memory: { warning: number; critical: number };
  latency: { warning: number; critical: number };
  errorRate: { warning: number; critical: number };
  queueDepth: { warning: number; critical: number };
  throughputDrop: { warning: number; critical: number };
}

export class BottleneckAnalyzer {
  private thresholds: BottleneckThresholds;
  private historicalMetrics: Map<string, ComponentMetrics[]> = new Map();
  private historicalSystemMetrics: SystemMetrics[] = [];

  constructor(thresholds?: Partial<BottleneckThresholds>) {
    this.thresholds = {
      cpu: { warning: 0.7, critical: 0.9 },
      memory: { warning: 0.8, critical: 0.95 },
      latency: { warning: 500, critical: 1000 }, // milliseconds
      errorRate: { warning: 0.05, critical: 0.1 }, // 5% and 10%
      queueDepth: { warning: 50, critical: 100 },
      throughputDrop: { warning: 0.2, critical: 0.4 }, // 20% and 40% drop
      ...thresholds
    };
  }

  /**
   * Analyze current metrics and detect bottlenecks
   */
  analyzeBottlenecks(
    components: Component[],
    currentMetrics: Map<string, ComponentMetrics>,
    connections: Connection[],
    systemMetrics?: SystemMetrics
  ): SystemBottleneckReport {
    const bottlenecks: BottleneckDetection[] = [];
    const timestamp = Date.now();

    // Analyze each component for bottlenecks
    for (const component of components) {
      const metrics = currentMetrics.get(component.id);
      if (!metrics) continue;

      const componentBottlenecks = this.analyzeComponentBottlenecks(component, metrics);
      bottlenecks.push(...componentBottlenecks);
    }

    // Sort bottlenecks by severity and impact
    bottlenecks.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.impact - a.impact;
    });

    // Determine overall system health
    const overallHealth = this.determineSystemHealth(bottlenecks);
    
    // Calculate system impact
    const systemImpact = this.calculateSystemImpact(bottlenecks);

    // Get primary bottleneck
    const primaryBottleneck = bottlenecks.length > 0 ? bottlenecks[0] : null;

    // Generate system-level recommendations
    const recommendations = this.generateSystemRecommendations(bottlenecks, components, connections);

    // Analyze performance trends
    const performanceTrends = this.analyzePerformanceTrends(systemMetrics);

    return {
      timestamp,
      overallHealth,
      bottlenecks,
      systemImpact,
      primaryBottleneck,
      recommendations,
      performanceTrends
    };
  }

  /**
   * Analyze bottlenecks for a specific component
   */
  private analyzeComponentBottlenecks(component: Component, metrics: ComponentMetrics): BottleneckDetection[] {
    const bottlenecks: BottleneckDetection[] = [];

    // CPU bottleneck detection
    if (metrics.cpuUtilization >= this.thresholds.cpu.warning) {
      bottlenecks.push({
        componentId: component.id,
        componentName: component.metadata.name,
        componentType: component.type,
        severity: metrics.cpuUtilization >= this.thresholds.cpu.critical ? 'critical' : 'high',
        bottleneckType: 'cpu',
        currentValue: metrics.cpuUtilization,
        threshold: this.thresholds.cpu.warning,
        impact: this.calculateCpuImpact(metrics.cpuUtilization),
        description: `High CPU utilization (${(metrics.cpuUtilization * 100).toFixed(1)}%)`,
        recommendations: this.getCpuRecommendations(component, metrics),
        timestamp: metrics.timestamp
      });
    }

    // Memory bottleneck detection
    if (metrics.memoryUtilization >= this.thresholds.memory.warning) {
      bottlenecks.push({
        componentId: component.id,
        componentName: component.metadata.name,
        componentType: component.type,
        severity: metrics.memoryUtilization >= this.thresholds.memory.critical ? 'critical' : 'high',
        bottleneckType: 'memory',
        currentValue: metrics.memoryUtilization,
        threshold: this.thresholds.memory.warning,
        impact: this.calculateMemoryImpact(metrics.memoryUtilization),
        description: `High memory utilization (${(metrics.memoryUtilization * 100).toFixed(1)}%)`,
        recommendations: this.getMemoryRecommendations(component, metrics),
        timestamp: metrics.timestamp
      });
    }

    // Latency bottleneck detection
    if (metrics.averageLatency >= this.thresholds.latency.warning) {
      bottlenecks.push({
        componentId: component.id,
        componentName: component.metadata.name,
        componentType: component.type,
        severity: metrics.averageLatency >= this.thresholds.latency.critical ? 'critical' : 'high',
        bottleneckType: 'latency',
        currentValue: metrics.averageLatency,
        threshold: this.thresholds.latency.warning,
        impact: this.calculateLatencyImpact(metrics.averageLatency),
        description: `High response latency (${metrics.averageLatency.toFixed(1)}ms)`,
        recommendations: this.getLatencyRecommendations(component, metrics),
        timestamp: metrics.timestamp
      });
    }

    // Error rate bottleneck detection
    if (metrics.errorRate >= this.thresholds.errorRate.warning) {
      bottlenecks.push({
        componentId: component.id,
        componentName: component.metadata.name,
        componentType: component.type,
        severity: metrics.errorRate >= this.thresholds.errorRate.critical ? 'critical' : 'high',
        bottleneckType: 'error_rate',
        currentValue: metrics.errorRate,
        threshold: this.thresholds.errorRate.warning,
        impact: this.calculateErrorRateImpact(metrics.errorRate),
        description: `High error rate (${(metrics.errorRate * 100).toFixed(2)}%)`,
        recommendations: this.getErrorRateRecommendations(component, metrics),
        timestamp: metrics.timestamp
      });
    }

    // Queue depth bottleneck detection
    if (metrics.queueDepth >= this.thresholds.queueDepth.warning) {
      bottlenecks.push({
        componentId: component.id,
        componentName: component.metadata.name,
        componentType: component.type,
        severity: metrics.queueDepth >= this.thresholds.queueDepth.critical ? 'critical' : 'medium',
        bottleneckType: 'queue',
        currentValue: metrics.queueDepth,
        threshold: this.thresholds.queueDepth.warning,
        impact: this.calculateQueueImpact(metrics.queueDepth),
        description: `High queue depth (${metrics.queueDepth} requests)`,
        recommendations: this.getQueueRecommendations(component, metrics),
        timestamp: metrics.timestamp
      });
    }

    return bottlenecks;
  }

  /**
   * Calculate impact scores for different bottleneck types
   */
  private calculateCpuImpact(cpuUtilization: number): number {
    return Math.min(1, (cpuUtilization - this.thresholds.cpu.warning) / (1 - this.thresholds.cpu.warning));
  }

  private calculateMemoryImpact(memoryUtilization: number): number {
    return Math.min(1, (memoryUtilization - this.thresholds.memory.warning) / (1 - this.thresholds.memory.warning));
  }

  private calculateLatencyImpact(latency: number): number {
    return Math.min(1, (latency - this.thresholds.latency.warning) / (this.thresholds.latency.critical - this.thresholds.latency.warning));
  }

  private calculateErrorRateImpact(errorRate: number): number {
    return Math.min(1, errorRate / this.thresholds.errorRate.critical);
  }

  private calculateQueueImpact(queueDepth: number): number {
    return Math.min(1, (queueDepth - this.thresholds.queueDepth.warning) / (this.thresholds.queueDepth.critical - this.thresholds.queueDepth.warning));
  }

  /**
   * Generate component-specific recommendations
   */
  private getCpuRecommendations(component: Component, metrics: ComponentMetrics): string[] {
    const recommendations = [
      'Consider scaling horizontally by adding more instances',
      'Optimize application code to reduce CPU-intensive operations',
      'Review and optimize database queries if applicable'
    ];

    if (component.type === 'web-server') {
      recommendations.push('Enable caching to reduce processing overhead');
      recommendations.push('Consider using a CDN for static content');
    } else if (component.type === 'database') {
      recommendations.push('Add read replicas to distribute query load');
      recommendations.push('Optimize database indexes');
    }

    return recommendations;
  }

  private getMemoryRecommendations(component: Component, metrics: ComponentMetrics): string[] {
    const recommendations = [
      'Increase memory allocation for this component',
      'Implement memory-efficient data structures',
      'Add memory monitoring and garbage collection tuning'
    ];

    if (component.type === 'cache') {
      recommendations.push('Review cache eviction policies');
      recommendations.push('Consider distributed caching');
    }

    return recommendations;
  }

  private getLatencyRecommendations(component: Component, metrics: ComponentMetrics): string[] {
    const recommendations = [
      'Optimize component processing logic',
      'Add caching layers to reduce processing time',
      'Consider geographic distribution for reduced network latency'
    ];

    if (component.type === 'database') {
      recommendations.push('Optimize database queries and indexes');
      recommendations.push('Consider database connection pooling');
    } else if (component.type === 'load-balancer') {
      recommendations.push('Review load balancing algorithm');
      recommendations.push('Check backend server health');
    }

    return recommendations;
  }

  private getErrorRateRecommendations(component: Component, metrics: ComponentMetrics): string[] {
    return [
      'Investigate error logs for root cause analysis',
      'Implement circuit breaker patterns',
      'Add retry mechanisms with exponential backoff',
      'Review component health checks',
      'Consider graceful degradation strategies'
    ];
  }

  private getQueueRecommendations(component: Component, metrics: ComponentMetrics): string[] {
    return [
      'Increase processing capacity',
      'Implement queue prioritization',
      'Add auto-scaling based on queue depth',
      'Consider asynchronous processing patterns',
      'Review queue configuration and limits'
    ];
  }

  /**
   * Determine overall system health based on bottlenecks
   */
  private determineSystemHealth(bottlenecks: BottleneckDetection[]): 'healthy' | 'degraded' | 'critical' {
    const criticalCount = bottlenecks.filter(b => b.severity === 'critical').length;
    const highCount = bottlenecks.filter(b => b.severity === 'high').length;

    if (criticalCount > 0) return 'critical';
    if (highCount > 2 || bottlenecks.length > 5) return 'degraded';
    return 'healthy';
  }

  /**
   * Calculate overall system impact
   */
  private calculateSystemImpact(bottlenecks: BottleneckDetection[]): number {
    if (bottlenecks.length === 0) return 0;

    const totalImpact = bottlenecks.reduce((sum, b) => sum + b.impact, 0);
    return Math.min(1, totalImpact / bottlenecks.length);
  }

  /**
   * Generate system-level recommendations
   */
  private generateSystemRecommendations(
    bottlenecks: BottleneckDetection[],
    components: Component[],
    connections: Connection[]
  ): string[] {
    const recommendations: string[] = [];

    if (bottlenecks.length === 0) {
      recommendations.push('System is performing well - no immediate action required');
      return recommendations;
    }

    // Group bottlenecks by type
    const bottlenecksByType = bottlenecks.reduce((acc, b) => {
      if (!acc[b.bottleneckType]) acc[b.bottleneckType] = [];
      acc[b.bottleneckType].push(b);
      return acc;
    }, {} as Record<string, BottleneckDetection[]>);

    // Generate recommendations based on bottleneck patterns
    if (bottlenecksByType.cpu && bottlenecksByType.cpu.length > 1) {
      recommendations.push('Multiple components showing high CPU usage - consider system-wide scaling');
    }

    if (bottlenecksByType.latency && bottlenecksByType.latency.length > 1) {
      recommendations.push('System-wide latency issues detected - review network configuration and component placement');
    }

    if (bottlenecksByType.error_rate && bottlenecksByType.error_rate.length > 0) {
      recommendations.push('Error rates elevated - implement comprehensive monitoring and alerting');
    }

    // Add general recommendations
    if (bottlenecks.some(b => b.severity === 'critical')) {
      recommendations.push('Critical bottlenecks detected - immediate attention required');
      recommendations.push('Consider implementing auto-scaling policies');
    }

    return recommendations;
  }

  /**
   * Analyze performance trends
   */
  private analyzePerformanceTrends(systemMetrics?: SystemMetrics): {
    throughputTrend: 'improving' | 'stable' | 'degrading';
    latencyTrend: 'improving' | 'stable' | 'degrading';
    errorTrend: 'improving' | 'stable' | 'degrading';
  } {
    // This would analyze historical data in a real implementation
    // For now, return stable trends
    return {
      throughputTrend: 'stable',
      latencyTrend: 'stable',
      errorTrend: 'stable'
    };
  }

  /**
   * Update thresholds
   */
  updateThresholds(newThresholds: Partial<BottleneckThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
  }

  /**
   * Get current thresholds
   */
  getThresholds(): BottleneckThresholds {
    return { ...this.thresholds };
  }
}