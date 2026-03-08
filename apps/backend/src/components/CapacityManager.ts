/**
 * Capacity Manager for System Design Simulator
 * Implements SRS FR-3.2: Component capacity limits, monitoring, and alerting
 */

import type { ComponentConfig, ComponentType } from '../types';

// Capacity limit interfaces
export interface CapacityLimits {
  maxThroughput: number;        // Maximum requests per second
  maxConnections: number;       // Maximum concurrent connections
  maxMemoryUsage: number;       // Maximum memory usage in MB
  maxCpuUsage: number;          // Maximum CPU usage percentage
  maxQueueDepth: number;        // Maximum queue depth
  maxStorageSize?: number;      // Maximum storage size in GB (for databases)
  maxBandwidth?: number;        // Maximum bandwidth in Mbps
}

export interface CapacityMetrics {
  currentThroughput: number;
  currentConnections: number;
  currentMemoryUsage: number;
  currentCpuUsage: number;
  currentQueueDepth: number;
  currentStorageUsage?: number;
  currentBandwidth?: number;
  utilizationPercentage: number;
  timestamp: number;
}

export interface CapacityAlert {
  id: string;
  componentId: string;
  componentType: ComponentType;
  alertType: 'warning' | 'critical' | 'capacity_exceeded';
  metric: keyof CapacityMetrics;
  currentValue: number;
  threshold: number;
  utilizationPercentage: number;
  message: string;
  timestamp: number;
  acknowledged: boolean;
}

export interface CapacityThresholds {
  warning: number;    // Percentage threshold for warning alerts (e.g., 70%)
  critical: number;   // Percentage threshold for critical alerts (e.g., 90%)
  maximum: number;    // Percentage threshold for capacity exceeded (e.g., 100%)
}

// Component-specific capacity limits per SRS FR-3.2
export class CapacityManager {
  private static instance: CapacityManager;
  private capacityLimits: Map<string, CapacityLimits>;
  private capacityMetrics: Map<string, CapacityMetrics>;
  private activeAlerts: Map<string, CapacityAlert[]>;
  private thresholds: CapacityThresholds;

  private constructor() {
    this.capacityLimits = new Map();
    this.capacityMetrics = new Map();
    this.activeAlerts = new Map();
    this.thresholds = {
      warning: 70,
      critical: 90,
      maximum: 100
    };
    this.initializeCapacityLimits();
  }

  public static getInstance(): CapacityManager {
    if (!CapacityManager.instance) {
      CapacityManager.instance = new CapacityManager();
    }
    return CapacityManager.instance;
  }

  private initializeCapacityLimits(): void {
    // Load Balancer capacity limits
    this.capacityLimits.set('load-balancer-nginx', {
      maxThroughput: 10000,
      maxConnections: 10000,
      maxMemoryUsage: 2048,
      maxCpuUsage: 80,
      maxQueueDepth: 1000,
      maxBandwidth: 1000
    });

    this.capacityLimits.set('load-balancer-haproxy', {
      maxThroughput: 8000,
      maxConnections: 8000,
      maxMemoryUsage: 1536,
      maxCpuUsage: 75,
      maxQueueDepth: 800,
      maxBandwidth: 800
    });

    this.capacityLimits.set('load-balancer-awsAlb', {
      maxThroughput: 50000,
      maxConnections: 50000,
      maxMemoryUsage: 8192,
      maxCpuUsage: 85,
      maxQueueDepth: 5000,
      maxBandwidth: 10000
    });

    // Database capacity limits with ACID considerations
    this.capacityLimits.set('database-mysql', {
      maxThroughput: 1000,
      maxConnections: 100,
      maxMemoryUsage: 4096,
      maxCpuUsage: 80,
      maxQueueDepth: 500,
      maxStorageSize: 1000,
      maxBandwidth: 500
    });

    this.capacityLimits.set('database-postgresql', {
      maxThroughput: 800,
      maxConnections: 200,
      maxMemoryUsage: 6144,
      maxCpuUsage: 85,
      maxQueueDepth: 400,
      maxStorageSize: 2000,
      maxBandwidth: 600
    });

    this.capacityLimits.set('database-mongodb', {
      maxThroughput: 1200,
      maxConnections: 150,
      maxMemoryUsage: 8192,
      maxCpuUsage: 75,
      maxQueueDepth: 600,
      maxStorageSize: 5000,
      maxBandwidth: 800
    });

    this.capacityLimits.set('database-redis', {
      maxThroughput: 5000,
      maxConnections: 1000,
      maxMemoryUsage: 8192,
      maxCpuUsage: 70,
      maxQueueDepth: 2500,
      maxBandwidth: 1000
    });

    // Cache capacity limits with eviction policy considerations
    this.capacityLimits.set('cache-memcached', {
      maxThroughput: 10000,
      maxConnections: 1000,
      maxMemoryUsage: 4096,
      maxCpuUsage: 60,
      maxQueueDepth: 5000,
      maxBandwidth: 2000
    });

    this.capacityLimits.set('cache-redis', {
      maxThroughput: 8000,
      maxConnections: 800,
      maxMemoryUsage: 8192,
      maxCpuUsage: 65,
      maxQueueDepth: 4000,
      maxBandwidth: 1500
    });

    this.capacityLimits.set('cache-varnish', {
      maxThroughput: 15000,
      maxConnections: 1500,
      maxMemoryUsage: 2048,
      maxCpuUsage: 70,
      maxQueueDepth: 7500,
      maxBandwidth: 3000
    });

    // Queue capacity limits with messaging pattern considerations
    this.capacityLimits.set('queue-kafka', {
      maxThroughput: 100000,
      maxConnections: 1000,
      maxMemoryUsage: 16384,
      maxCpuUsage: 80,
      maxQueueDepth: 1000000,
      maxStorageSize: 10000,
      maxBandwidth: 5000
    });

    this.capacityLimits.set('queue-rabbitmq', {
      maxThroughput: 50000,
      maxConnections: 500,
      maxMemoryUsage: 8192,
      maxCpuUsage: 75,
      maxQueueDepth: 500000,
      maxStorageSize: 5000,
      maxBandwidth: 2500
    });

    this.capacityLimits.set('queue-awsSqs', {
      maxThroughput: 300000,
      maxConnections: 10000,
      maxMemoryUsage: 32768,
      maxCpuUsage: 90,
      maxQueueDepth: 10000000,
      maxBandwidth: 10000
    });

    // CDN capacity limits with geographic distribution considerations
    this.capacityLimits.set('cdn-cloudflare', {
      maxThroughput: 1000000,
      maxConnections: 100000,
      maxMemoryUsage: 65536,
      maxCpuUsage: 85,
      maxQueueDepth: 500000,
      maxBandwidth: 100000
    });

    this.capacityLimits.set('cdn-awsCloudfront', {
      maxThroughput: 800000,
      maxConnections: 80000,
      maxMemoryUsage: 131072,
      maxCpuUsage: 90,
      maxQueueDepth: 400000,
      maxBandwidth: 200000
    });

    this.capacityLimits.set('cdn-fastly', {
      maxThroughput: 500000,
      maxConnections: 50000,
      maxMemoryUsage: 32768,
      maxCpuUsage: 80,
      maxQueueDepth: 250000,
      maxBandwidth: 50000
    });

    // Service capacity limits with scaling options considerations
    this.capacityLimits.set('service-nodejs', {
      maxThroughput: 3000,
      maxConnections: 1000,
      maxMemoryUsage: 2048,
      maxCpuUsage: 80,
      maxQueueDepth: 1500,
      maxBandwidth: 1000
    });

    this.capacityLimits.set('service-java', {
      maxThroughput: 2500,
      maxConnections: 2000,
      maxMemoryUsage: 4096,
      maxCpuUsage: 85,
      maxQueueDepth: 1250,
      maxBandwidth: 1200
    });

    this.capacityLimits.set('service-python', {
      maxThroughput: 2000,
      maxConnections: 500,
      maxMemoryUsage: 1024,
      maxCpuUsage: 75,
      maxQueueDepth: 1000,
      maxBandwidth: 800
    });
  }

  // Get capacity limits for a component
  public getCapacityLimits(componentKey: string): CapacityLimits | undefined {
    return this.capacityLimits.get(componentKey);
  }

  // Update capacity metrics for a component
  public updateCapacityMetrics(componentId: string, componentKey: string, metrics: Partial<CapacityMetrics>): void {
    const limits = this.getCapacityLimits(componentKey);
    if (!limits) return;

    const currentMetrics = this.capacityMetrics.get(componentId) || {
      currentThroughput: 0,
      currentConnections: 0,
      currentMemoryUsage: 0,
      currentCpuUsage: 0,
      currentQueueDepth: 0,
      utilizationPercentage: 0,
      timestamp: Date.now()
    };

    const updatedMetrics: CapacityMetrics = {
      ...currentMetrics,
      ...metrics,
      timestamp: Date.now()
    };

    // Calculate overall utilization percentage
    const utilizationMetrics = [
      updatedMetrics.currentThroughput / limits.maxThroughput,
      updatedMetrics.currentConnections / limits.maxConnections,
      updatedMetrics.currentMemoryUsage / limits.maxMemoryUsage,
      updatedMetrics.currentCpuUsage / limits.maxCpuUsage,
      updatedMetrics.currentQueueDepth / limits.maxQueueDepth
    ];

    updatedMetrics.utilizationPercentage = Math.max(...utilizationMetrics) * 100;

    this.capacityMetrics.set(componentId, updatedMetrics);

    // Check for capacity alerts
    this.checkCapacityAlerts(componentId, componentKey, updatedMetrics, limits);
  }

  // Check for capacity alerts and generate them if thresholds are exceeded
  private checkCapacityAlerts(
    componentId: string, 
    componentKey: string, 
    metrics: CapacityMetrics, 
    limits: CapacityLimits
  ): void {
    const componentType = componentKey.split('-')[0] as ComponentType;
    const alerts: CapacityAlert[] = [];

    // Check each metric against thresholds
    const metricsToCheck = [
      { metric: 'currentThroughput' as keyof CapacityMetrics, current: metrics.currentThroughput, max: limits.maxThroughput, name: 'Throughput' },
      { metric: 'currentConnections' as keyof CapacityMetrics, current: metrics.currentConnections, max: limits.maxConnections, name: 'Connections' },
      { metric: 'currentMemoryUsage' as keyof CapacityMetrics, current: metrics.currentMemoryUsage, max: limits.maxMemoryUsage, name: 'Memory Usage' },
      { metric: 'currentCpuUsage' as keyof CapacityMetrics, current: metrics.currentCpuUsage, max: limits.maxCpuUsage, name: 'CPU Usage' },
      { metric: 'currentQueueDepth' as keyof CapacityMetrics, current: metrics.currentQueueDepth, max: limits.maxQueueDepth, name: 'Queue Depth' }
    ];

    metricsToCheck.forEach(({ metric, current, max, name }) => {
      const utilizationPercentage = (current / max) * 100;

      if (utilizationPercentage >= this.thresholds.maximum) {
        alerts.push({
          id: `${componentId}-${metric}-${Date.now()}`,
          componentId,
          componentType,
          alertType: 'capacity_exceeded',
          metric,
          currentValue: current,
          threshold: max,
          utilizationPercentage,
          message: `${name} capacity exceeded: ${current}/${max} (${utilizationPercentage.toFixed(1)}%)`,
          timestamp: Date.now(),
          acknowledged: false
        });
      } else if (utilizationPercentage >= this.thresholds.critical) {
        alerts.push({
          id: `${componentId}-${metric}-${Date.now()}`,
          componentId,
          componentType,
          alertType: 'critical',
          metric,
          currentValue: current,
          threshold: max * (this.thresholds.critical / 100),
          utilizationPercentage,
          message: `${name} critical threshold reached: ${current}/${max} (${utilizationPercentage.toFixed(1)}%)`,
          timestamp: Date.now(),
          acknowledged: false
        });
      } else if (utilizationPercentage >= this.thresholds.warning) {
        alerts.push({
          id: `${componentId}-${metric}-${Date.now()}`,
          componentId,
          componentType,
          alertType: 'warning',
          metric,
          currentValue: current,
          threshold: max * (this.thresholds.warning / 100),
          utilizationPercentage,
          message: `${name} warning threshold reached: ${current}/${max} (${utilizationPercentage.toFixed(1)}%)`,
          timestamp: Date.now(),
          acknowledged: false
        });
      }
    });

    if (alerts.length > 0) {
      this.activeAlerts.set(componentId, alerts);
    }
  }

  // Get current capacity metrics for a component
  public getCapacityMetrics(componentId: string): CapacityMetrics | undefined {
    return this.capacityMetrics.get(componentId);
  }

  // Get active alerts for a component
  public getActiveAlerts(componentId: string): CapacityAlert[] {
    return this.activeAlerts.get(componentId) || [];
  }

  // Get all active alerts
  public getAllActiveAlerts(): Map<string, CapacityAlert[]> {
    return new Map(this.activeAlerts);
  }

  // Acknowledge an alert
  public acknowledgeAlert(componentId: string, alertId: string): boolean {
    const alerts = this.activeAlerts.get(componentId);
    if (!alerts) return false;

    const alert = alerts.find(a => a.id === alertId);
    if (!alert) return false;

    alert.acknowledged = true;
    return true;
  }

  // Clear acknowledged alerts
  public clearAcknowledgedAlerts(componentId: string): void {
    const alerts = this.activeAlerts.get(componentId);
    if (!alerts) return;

    const activeAlerts = alerts.filter(alert => !alert.acknowledged);
    if (activeAlerts.length === 0) {
      this.activeAlerts.delete(componentId);
    } else {
      this.activeAlerts.set(componentId, activeAlerts);
    }
  }

  // Check if component is at capacity
  public isAtCapacity(componentId: string, componentKey: string): boolean {
    const metrics = this.getCapacityMetrics(componentId);
    if (!metrics) return false;

    return metrics.utilizationPercentage >= this.thresholds.maximum;
  }

  // Get capacity utilization percentage
  public getCapacityUtilization(componentId: string): number {
    const metrics = this.getCapacityMetrics(componentId);
    return metrics?.utilizationPercentage || 0;
  }

  // Update capacity thresholds
  public updateThresholds(thresholds: Partial<CapacityThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  // Get current thresholds
  public getThresholds(): CapacityThresholds {
    return { ...this.thresholds };
  }

  // Performance modeling based on capacity
  public calculatePerformanceImpact(componentId: string, componentKey: string): {
    latencyMultiplier: number;
    throughputMultiplier: number;
    errorRateMultiplier: number;
    recommendations: string[];
  } {
    const metrics = this.getCapacityMetrics(componentId);
    const limits = this.getCapacityLimits(componentKey);
    
    if (!metrics || !limits) {
      return {
        latencyMultiplier: 1,
        throughputMultiplier: 1,
        errorRateMultiplier: 1,
        recommendations: []
      };
    }

    const utilization = metrics.utilizationPercentage / 100;
    const recommendations: string[] = [];

    // Calculate performance impact based on utilization
    let latencyMultiplier = 1;
    let throughputMultiplier = 1;
    let errorRateMultiplier = 1;

    if (utilization > 0.9) {
      latencyMultiplier = 1 + (utilization - 0.9) * 10; // Exponential latency increase
      throughputMultiplier = 0.5; // Significant throughput degradation
      errorRateMultiplier = 1 + (utilization - 0.9) * 20; // High error rate increase
      recommendations.push('Critical: Immediate scaling required');
      recommendations.push('Consider horizontal scaling or load distribution');
    } else if (utilization > 0.7) {
      latencyMultiplier = 1 + (utilization - 0.7) * 2;
      throughputMultiplier = 1 - (utilization - 0.7) * 0.5;
      errorRateMultiplier = 1 + (utilization - 0.7) * 2;
      recommendations.push('Warning: Plan for scaling');
      recommendations.push('Monitor performance closely');
    } else if (utilization > 0.5) {
      latencyMultiplier = 1 + (utilization - 0.5) * 0.5;
      throughputMultiplier = 1 - (utilization - 0.5) * 0.2;
      errorRateMultiplier = 1 + (utilization - 0.5) * 0.5;
      recommendations.push('Consider optimization opportunities');
    }

    return {
      latencyMultiplier,
      throughputMultiplier,
      errorRateMultiplier,
      recommendations
    };
  }
}

// Export singleton instance
export const capacityManager = CapacityManager.getInstance();