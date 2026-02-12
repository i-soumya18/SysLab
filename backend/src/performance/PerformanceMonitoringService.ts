/**
 * Performance Monitoring and Alerting Service
 * 
 * Implements SRS NFR-1: Add performance monitoring and alerting per SRS NFR-1
 * Monitors simulation engine performance and provides real-time alerts
 */

import { EventEmitter } from 'events';
import { PerformanceOptimizer, PerformanceMetrics } from './PerformanceOptimizer';

export interface PerformanceAlert {
  id: string;
  type: 'warning' | 'critical' | 'info';
  category: 'latency' | 'memory' | 'cpu' | 'cache' | 'throughput';
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
  workspaceId?: string;
  componentId?: string;
  suggestions: string[];
}

export interface PerformanceThresholds {
  updateTime: {
    warning: number;
    critical: number;
  };
  cacheHitRate: {
    warning: number;
    critical: number;
  };
  memoryUsage: {
    warning: number; // MB
    critical: number; // MB
  };
  cpuUsage: {
    warning: number; // percentage
    critical: number; // percentage
  };
  throughputDrop: {
    warning: number; // percentage
    critical: number; // percentage
  };
}

export interface PerformanceDashboard {
  currentMetrics: PerformanceMetrics;
  alerts: PerformanceAlert[];
  trends: {
    updateTime: number[];
    cacheHitRate: number[];
    memoryUsage: number[];
    timestamps: number[];
  };
  systemHealth: 'healthy' | 'degraded' | 'critical';
  recommendations: string[];
}

export class PerformanceMonitoringService extends EventEmitter {
  private optimizer: PerformanceOptimizer;
  private thresholds: PerformanceThresholds;
  private alerts: Map<string, PerformanceAlert> = new Map();
  private metricsHistory: PerformanceMetrics[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private alertHistory: PerformanceAlert[] = [];
  private maxHistorySize: number = 1000;
  private isMonitoring: boolean = false;

  constructor(optimizer: PerformanceOptimizer, thresholds?: Partial<PerformanceThresholds>) {
    super();
    this.optimizer = optimizer;
    this.thresholds = {
      updateTime: {
        warning: 80, // 80ms warning (80% of 100ms target)
        critical: 100 // 100ms critical (SRS NFR-1 target)
      },
      cacheHitRate: {
        warning: 0.7, // 70% warning
        critical: 0.5 // 50% critical
      },
      memoryUsage: {
        warning: 400, // 400MB warning
        critical: 600 // 600MB critical
      },
      cpuUsage: {
        warning: 70, // 70% warning
        critical: 90 // 90% critical
      },
      throughputDrop: {
        warning: 20, // 20% drop warning
        critical: 40 // 40% drop critical
      },
      ...thresholds
    };

    this.setupOptimizerEvents();
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(intervalMs: number = 1000): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.collectAndAnalyzeMetrics();
    }, intervalMs);

    this.emit('monitoring_started', { interval: intervalMs });
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.emit('monitoring_stopped');
  }

  /**
   * Collect and analyze current performance metrics
   */
  private async collectAndAnalyzeMetrics(): Promise<void> {
    try {
      const metrics = this.optimizer.getPerformanceStats();
      
      // Store metrics history
      this.metricsHistory.push(metrics);
      if (this.metricsHistory.length > this.maxHistorySize) {
        this.metricsHistory.shift();
      }

      // Analyze metrics for alerts
      await this.analyzeMetrics(metrics);

      // Emit metrics update
      this.emit('metrics_updated', metrics);

    } catch (error) {
      this.emit('monitoring_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Analyze metrics and generate alerts
   */
  private async analyzeMetrics(metrics: PerformanceMetrics): Promise<void> {
    const timestamp = Date.now();
    const newAlerts: PerformanceAlert[] = [];

    // Check update time performance
    if (metrics.updateTime > this.thresholds.updateTime.critical) {
      newAlerts.push(this.createAlert(
        'critical',
        'latency',
        `Simulation update time (${metrics.updateTime.toFixed(1)}ms) exceeds critical threshold`,
        metrics.updateTime,
        this.thresholds.updateTime.critical,
        timestamp,
        ['Enable aggressive optimization', 'Reduce component count', 'Increase cache size']
      ));
    } else if (metrics.updateTime > this.thresholds.updateTime.warning) {
      newAlerts.push(this.createAlert(
        'warning',
        'latency',
        `Simulation update time (${metrics.updateTime.toFixed(1)}ms) exceeds warning threshold`,
        metrics.updateTime,
        this.thresholds.updateTime.warning,
        timestamp,
        ['Monitor system load', 'Consider optimization']
      ));
    }

    // Check cache hit rate
    if (metrics.cacheHitRate < this.thresholds.cacheHitRate.critical) {
      newAlerts.push(this.createAlert(
        'critical',
        'cache',
        `Cache hit rate (${(metrics.cacheHitRate * 100).toFixed(1)}%) is critically low`,
        metrics.cacheHitRate,
        this.thresholds.cacheHitRate.critical,
        timestamp,
        ['Increase cache size', 'Optimize cache TTL', 'Review caching strategy']
      ));
    } else if (metrics.cacheHitRate < this.thresholds.cacheHitRate.warning) {
      newAlerts.push(this.createAlert(
        'warning',
        'cache',
        `Cache hit rate (${(metrics.cacheHitRate * 100).toFixed(1)}%) is below optimal`,
        metrics.cacheHitRate,
        this.thresholds.cacheHitRate.warning,
        timestamp,
        ['Monitor cache usage patterns', 'Consider cache tuning']
      ));
    }

    // Check memory usage
    if (metrics.memoryUsage > this.thresholds.memoryUsage.critical) {
      newAlerts.push(this.createAlert(
        'critical',
        'memory',
        `Memory usage (${metrics.memoryUsage.toFixed(1)}MB) is critically high`,
        metrics.memoryUsage,
        this.thresholds.memoryUsage.critical,
        timestamp,
        ['Clear old metrics', 'Reduce cache size', 'Restart service if needed']
      ));
    } else if (metrics.memoryUsage > this.thresholds.memoryUsage.warning) {
      newAlerts.push(this.createAlert(
        'warning',
        'memory',
        `Memory usage (${metrics.memoryUsage.toFixed(1)}MB) is elevated`,
        metrics.memoryUsage,
        this.thresholds.memoryUsage.warning,
        timestamp,
        ['Monitor memory trends', 'Consider cleanup']
      ));
    }

    // Check CPU usage
    if (metrics.cpuUsage > this.thresholds.cpuUsage.critical) {
      newAlerts.push(this.createAlert(
        'critical',
        'cpu',
        `CPU usage (${metrics.cpuUsage.toFixed(1)}%) is critically high`,
        metrics.cpuUsage,
        this.thresholds.cpuUsage.critical,
        timestamp,
        ['Reduce simulation complexity', 'Scale horizontally', 'Optimize algorithms']
      ));
    } else if (metrics.cpuUsage > this.thresholds.cpuUsage.warning) {
      newAlerts.push(this.createAlert(
        'warning',
        'cpu',
        `CPU usage (${metrics.cpuUsage.toFixed(1)}%) is elevated`,
        metrics.cpuUsage,
        this.thresholds.cpuUsage.warning,
        timestamp,
        ['Monitor CPU trends', 'Consider optimization']
      ));
    }

    // Process new alerts
    for (const alert of newAlerts) {
      this.processAlert(alert);
    }

    // Check for resolved alerts
    this.checkResolvedAlerts(metrics);
  }

  /**
   * Create a performance alert
   */
  private createAlert(
    type: 'warning' | 'critical' | 'info',
    category: 'latency' | 'memory' | 'cpu' | 'cache' | 'throughput',
    message: string,
    value: number,
    threshold: number,
    timestamp: number,
    suggestions: string[],
    workspaceId?: string,
    componentId?: string
  ): PerformanceAlert {
    return {
      id: `${category}_${type}_${timestamp}`,
      type,
      category,
      message,
      value,
      threshold,
      timestamp,
      workspaceId,
      componentId,
      suggestions
    };
  }

  /**
   * Process and store alert
   */
  private processAlert(alert: PerformanceAlert): void {
    const existingAlert = this.alerts.get(`${alert.category}_${alert.type}`);
    
    // Only emit if this is a new alert or significantly different
    if (!existingAlert || Math.abs(existingAlert.value - alert.value) > alert.threshold * 0.1) {
      this.alerts.set(`${alert.category}_${alert.type}`, alert);
      this.alertHistory.push(alert);
      
      // Limit alert history
      if (this.alertHistory.length > this.maxHistorySize) {
        this.alertHistory.shift();
      }

      this.emit('performance_alert', alert);
    }
  }

  /**
   * Check for resolved alerts
   */
  private checkResolvedAlerts(metrics: PerformanceMetrics): void {
    const resolvedAlerts: string[] = [];

    // Check if update time alerts are resolved
    if (metrics.updateTime <= this.thresholds.updateTime.warning) {
      const alertKey = 'latency_warning';
      if (this.alerts.has(alertKey)) {
        this.alerts.delete(alertKey);
        resolvedAlerts.push(alertKey);
      }
    }

    if (metrics.updateTime <= this.thresholds.updateTime.critical) {
      const alertKey = 'latency_critical';
      if (this.alerts.has(alertKey)) {
        this.alerts.delete(alertKey);
        resolvedAlerts.push(alertKey);
      }
    }

    // Check if cache hit rate alerts are resolved
    if (metrics.cacheHitRate >= this.thresholds.cacheHitRate.warning) {
      const alertKey = 'cache_warning';
      if (this.alerts.has(alertKey)) {
        this.alerts.delete(alertKey);
        resolvedAlerts.push(alertKey);
      }
    }

    // Emit resolved alerts
    for (const alertKey of resolvedAlerts) {
      this.emit('alert_resolved', { alertKey, timestamp: Date.now() });
    }
  }

  /**
   * Get current performance dashboard
   */
  getPerformanceDashboard(): PerformanceDashboard {
    const currentMetrics = this.optimizer.getPerformanceStats();
    const activeAlerts = Array.from(this.alerts.values());
    
    // Calculate trends from recent history
    const recentHistory = this.metricsHistory.slice(-50); // Last 50 samples
    const trends = {
      updateTime: recentHistory.map(m => m.updateTime),
      cacheHitRate: recentHistory.map(m => m.cacheHitRate),
      memoryUsage: recentHistory.map(m => m.memoryUsage),
      timestamps: recentHistory.map((_, i) => Date.now() - (recentHistory.length - i) * 1000)
    };

    // Determine system health
    const systemHealth = this.calculateSystemHealth(activeAlerts);

    // Generate recommendations
    const recommendations = this.generateRecommendations(currentMetrics, activeAlerts);

    return {
      currentMetrics,
      alerts: activeAlerts,
      trends,
      systemHealth,
      recommendations
    };
  }

  /**
   * Calculate overall system health
   */
  private calculateSystemHealth(alerts: PerformanceAlert[]): 'healthy' | 'degraded' | 'critical' {
    const criticalAlerts = alerts.filter(a => a.type === 'critical');
    const warningAlerts = alerts.filter(a => a.type === 'warning');

    if (criticalAlerts.length > 0) {
      return 'critical';
    } else if (warningAlerts.length > 2) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(
    metrics: PerformanceMetrics, 
    alerts: PerformanceAlert[]
  ): string[] {
    const recommendations = new Set<string>();

    // Add suggestions from active alerts
    for (const alert of alerts) {
      alert.suggestions.forEach(suggestion => recommendations.add(suggestion));
    }

    // Add general recommendations based on metrics
    if (metrics.updateTime > 50) {
      recommendations.add('Consider enabling performance optimization');
    }

    if (metrics.cacheHitRate < 0.8) {
      recommendations.add('Review and optimize caching strategy');
    }

    if (metrics.memoryUsage > 200) {
      recommendations.add('Monitor memory usage trends');
    }

    // Add bottleneck-specific recommendations
    metrics.bottlenecks.forEach(bottleneck => {
      if (bottleneck.includes('memory')) {
        recommendations.add('Implement memory optimization techniques');
      }
      if (bottleneck.includes('cache')) {
        recommendations.add('Tune cache configuration');
      }
    });

    return Array.from(recommendations);
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit?: number): PerformanceAlert[] {
    const history = [...this.alertHistory].reverse(); // Most recent first
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Clear resolved alerts
   */
  clearResolvedAlerts(): void {
    this.alerts.clear();
    this.emit('alerts_cleared', { timestamp: Date.now() });
  }

  /**
   * Update performance thresholds
   */
  updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    this.emit('thresholds_updated', this.thresholds);
  }

  /**
   * Get current thresholds
   */
  getThresholds(): PerformanceThresholds {
    return { ...this.thresholds };
  }

  /**
   * Setup optimizer event handlers
   */
  private setupOptimizerEvents(): void {
    this.optimizer.on('performance_warning', (data) => {
      const alert = this.createAlert(
        'warning',
        'latency',
        `Performance warning: ${data.executionTime.toFixed(1)}ms execution time`,
        data.executionTime,
        data.target,
        Date.now(),
        ['Check system load', 'Consider optimization'],
        data.workspaceId
      );
      
      this.processAlert(alert);
    });

    this.optimizer.on('performance_alert', (data) => {
      const alert = this.createAlert(
        data.type === 'degradation' ? 'critical' : 'warning',
        'latency',
        `Performance alert: ${data.type}`,
        data.recentAverage || 0,
        data.target || 100,
        Date.now(),
        ['Investigate performance degradation', 'Check resource usage']
      );
      
      this.processAlert(alert);
    });

    this.optimizer.on('optimization_error', (data) => {
      const alert = this.createAlert(
        'critical',
        'cpu',
        `Optimization error: ${data.error}`,
        data.executionTime,
        100,
        Date.now(),
        ['Check system logs', 'Restart optimization service']
      );
      
      this.processAlert(alert);
    });
  }

  /**
   * Export performance data for analysis
   */
  exportPerformanceData(): {
    metrics: PerformanceMetrics[];
    alerts: PerformanceAlert[];
    thresholds: PerformanceThresholds;
    exportTime: number;
  } {
    return {
      metrics: [...this.metricsHistory],
      alerts: [...this.alertHistory],
      thresholds: { ...this.thresholds },
      exportTime: Date.now()
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stopMonitoring();
    this.alerts.clear();
    this.metricsHistory = [];
    this.alertHistory = [];
  }
}