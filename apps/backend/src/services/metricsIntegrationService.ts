/**
 * Metrics Integration Service
 * 
 * Integrates all metrics services (latency, error rate, throughput, resource saturation)
 * and provides a unified interface for the metrics and observability system
 */

import { EventEmitter } from 'events';
import { ComponentMetrics } from '../types';
import { LatencyMetricsService } from './latencyMetricsService';
import { ErrorRateMonitoringService } from './errorRateMonitoringService';
import { ThroughputMonitoringService } from './throughputMonitoringService';
import { ResourceSaturationMonitoringService } from './resourceSaturationMonitoringService';
import { MetricsViewService } from './metricsViewService';
import { RealTimeMetricsService } from './realTimeMetricsService';

export interface MetricsIntegrationConfig {
  enableLatencyMetrics: boolean;
  enableErrorRateMonitoring: boolean;
  enableThroughputMonitoring: boolean;
  enableResourceSaturationMonitoring: boolean;
  enableRealTimeUpdates: boolean;
  updateInterval: number; // milliseconds
  retentionPeriod: number; // milliseconds
  alertingEnabled: boolean;
  dashboardEnabled: boolean;
}

export interface UnifiedMetrics {
  componentId: string;
  timestamp: number;
  latency: {
    p50: number;
    p95: number;
    p99: number;
    average: number;
    trend: 'improving' | 'degrading' | 'stable';
  };
  errorRate: {
    current: number;
    trend: 'improving' | 'degrading' | 'stable';
    categories: Record<string, number>;
  };
  throughput: {
    current: number;
    capacity: number;
    utilization: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
  resources: {
    cpu: number;
    memory: number;
    network: number;
    storage: number;
    overall: number;
  };
  health: {
    score: number; // 0-100
    status: 'healthy' | 'warning' | 'critical' | 'unknown';
    issues: string[];
  };
}

export interface SystemHealthSummary {
  timestamp: number;
  overallHealth: number; // 0-100
  systemStatus: 'healthy' | 'warning' | 'critical' | 'degraded';
  componentCount: number;
  healthyComponents: number;
  warningComponents: number;
  criticalComponents: number;
  totalAlerts: number;
  criticalAlerts: number;
  systemMetrics: {
    totalThroughput: number;
    averageLatency: number;
    systemErrorRate: number;
    resourceUtilization: number;
  };
  trends: {
    performance: 'improving' | 'degrading' | 'stable';
    capacity: 'increasing' | 'decreasing' | 'stable';
    reliability: 'improving' | 'degrading' | 'stable';
  };
}

export class MetricsIntegrationService extends EventEmitter {
  private config: MetricsIntegrationConfig;
  private latencyService!: LatencyMetricsService;
  private errorRateService!: ErrorRateMonitoringService;
  private throughputService!: ThroughputMonitoringService;
  private resourceService!: ResourceSaturationMonitoringService;
  private viewService!: MetricsViewService;
  private realTimeService!: RealTimeMetricsService;
  
  private isInitialized: boolean = false;
  private componentMetricsCache: Map<string, UnifiedMetrics> = new Map();
  private systemHealthCache: SystemHealthSummary | null = null;
  private updateTimer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<MetricsIntegrationConfig>) {
    super();
    
    this.config = {
      enableLatencyMetrics: true,
      enableErrorRateMonitoring: true,
      enableThroughputMonitoring: true,
      enableResourceSaturationMonitoring: true,
      enableRealTimeUpdates: true,
      updateInterval: 5000, // 5 seconds
      retentionPeriod: 3600000, // 1 hour
      alertingEnabled: true,
      dashboardEnabled: true,
      ...config
    };

    this.initializeServices();
  }

  /**
   * Initialize all metrics services
   */
  private initializeServices(): void {
    try {
      // Initialize core metrics services
      if (this.config.enableLatencyMetrics) {
        this.latencyService = new LatencyMetricsService();
        this.setupLatencyServiceEvents();
      }

      if (this.config.enableErrorRateMonitoring) {
        this.errorRateService = new ErrorRateMonitoringService();
        this.setupErrorRateServiceEvents();
      }

      if (this.config.enableThroughputMonitoring) {
        this.throughputService = new ThroughputMonitoringService();
        this.setupThroughputServiceEvents();
      }

      if (this.config.enableResourceSaturationMonitoring) {
        this.resourceService = new ResourceSaturationMonitoringService();
        this.setupResourceServiceEvents();
      }

      // Initialize view service
      if (this.config.dashboardEnabled) {
        this.viewService = new MetricsViewService({
          refreshInterval: this.config.updateInterval,
          retentionPeriod: this.config.retentionPeriod
        });
        this.setupViewServiceEvents();
      }

      // Initialize real-time service
      if (this.config.enableRealTimeUpdates) {
        this.realTimeService = new RealTimeMetricsService({
          updateInterval: Math.min(this.config.updateInterval, 1000), // Max 1 second for real-time
          bufferSize: 10,
          enableCompression: true,
          maxClientsPerWorkspace: 100
        });
        this.setupRealTimeServiceEvents();
      }

      this.isInitialized = true;
      this.startPeriodicUpdates();
      
      this.emit('initialized', {
        services: this.getEnabledServices(),
        config: this.config
      });

    } catch (error) {
      this.emit('initialization_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        config: this.config
      });
      throw error;
    }
  }

  /**
   * Process component metrics through all enabled services
   */
  processMetrics(metrics: ComponentMetrics): void {
    if (!this.isInitialized) {
      this.emit('error', { message: 'Service not initialized', componentId: metrics.componentId });
      return;
    }

    try {
      // Process through individual services
      if (this.config.enableLatencyMetrics && this.latencyService) {
        this.latencyService.processComponentMetrics(metrics);
      }

      if (this.config.enableErrorRateMonitoring && this.errorRateService) {
        this.errorRateService.processComponentMetrics(metrics);
      }

      if (this.config.enableThroughputMonitoring && this.throughputService) {
        this.throughputService.processComponentMetrics(metrics);
      }

      if (this.config.enableResourceSaturationMonitoring && this.resourceService) {
        this.resourceService.processComponentMetrics(metrics);
      }

      // Process through view service
      if (this.config.dashboardEnabled && this.viewService) {
        this.viewService.processComponentMetrics(metrics);
      }

      // Update unified metrics cache
      this.updateUnifiedMetrics(metrics.componentId);

      this.emit('metrics_processed', {
        componentId: metrics.componentId,
        timestamp: metrics.timestamp
      });

    } catch (error) {
      this.emit('processing_error', {
        componentId: metrics.componentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get unified metrics for a component
   */
  getUnifiedMetrics(componentId: string): UnifiedMetrics | null {
    return this.componentMetricsCache.get(componentId) || null;
  }

  /**
   * Get unified metrics for all components
   */
  getAllUnifiedMetrics(): Map<string, UnifiedMetrics> {
    return new Map(this.componentMetricsCache);
  }

  /**
   * Get system health summary
   */
  getSystemHealthSummary(): SystemHealthSummary | null {
    return this.systemHealthCache;
  }

  /**
   * Get component view (if dashboard enabled)
   */
  getComponentView(componentId: string) {
    if (!this.config.dashboardEnabled || !this.viewService) {
      return null;
    }
    return this.viewService.getComponentView(componentId);
  }

  /**
   * Get global system view (if dashboard enabled)
   */
  getGlobalView() {
    if (!this.config.dashboardEnabled || !this.viewService) {
      return null;
    }
    return this.viewService.getGlobalView();
  }

  /**
   * Get all active alerts across all services
   */
  getAllAlerts(): any[] {
    const alerts: any[] = [];

    try {
      // Collect alerts from all services
      const componentIds = this.getComponentIds();

      for (const componentId of componentIds) {
        if (this.config.enableLatencyMetrics && this.latencyService) {
          const latencyAlerts = this.latencyService.checkAlerts(componentId);
          alerts.push(...latencyAlerts.map(alert => ({ ...alert, service: 'latency' })));
        }

        if (this.config.enableErrorRateMonitoring && this.errorRateService) {
          const errorAlerts = this.errorRateService.checkAlerts(componentId);
          alerts.push(...errorAlerts.map(alert => ({ ...alert, service: 'error_rate' })));
        }

        if (this.config.enableThroughputMonitoring && this.throughputService) {
          const throughputAlerts = this.throughputService.checkAlerts(componentId);
          alerts.push(...throughputAlerts.map(alert => ({ ...alert, service: 'throughput' })));
        }

        if (this.config.enableResourceSaturationMonitoring && this.resourceService) {
          const resourceAlerts = this.resourceService.checkAlerts(componentId);
          alerts.push(...resourceAlerts.map(alert => ({ ...alert, service: 'resources' })));
        }
      }

      // Add system-level alerts from view service
      if (this.config.dashboardEnabled && this.viewService) {
        const systemAlerts = this.viewService.getSystemAlerts();
        alerts.push(...systemAlerts.map(alert => ({ ...alert, service: 'system' })));
      }

    } catch (error) {
      this.emit('alert_collection_error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return alerts;
  }

  /**
   * Get performance statistics for the integration service
   */
  getPerformanceStats() {
    const stats: any = {
      integration: {
        processedComponents: this.componentMetricsCache.size,
        cacheSize: this.componentMetricsCache.size,
        isInitialized: this.isInitialized,
        enabledServices: this.getEnabledServices()
      }
    };

    // Add stats from real-time service
    if (this.config.enableRealTimeUpdates && this.realTimeService) {
      stats.realTime = this.realTimeService.getPerformanceStats();
    }

    return stats;
  }

  /**
   * Update configuration
   */
  updateConfiguration(newConfig: Partial<MetricsIntegrationConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    // Handle service enable/disable
    if (oldConfig.enableRealTimeUpdates !== this.config.enableRealTimeUpdates) {
      if (this.config.enableRealTimeUpdates && !this.realTimeService) {
        this.realTimeService = new RealTimeMetricsService({
          updateInterval: Math.min(this.config.updateInterval, 1000),
          bufferSize: 10,
          enableCompression: true,
          maxClientsPerWorkspace: 100
        });
        this.setupRealTimeServiceEvents();
      } else if (!this.config.enableRealTimeUpdates && this.realTimeService) {
        this.realTimeService.cleanup();
        this.realTimeService = null as any;
      }
    }

    // Update view service configuration
    if (this.config.dashboardEnabled && this.viewService) {
      this.viewService.updateConfiguration({
        refreshInterval: this.config.updateInterval,
        retentionPeriod: this.config.retentionPeriod
      });
    }

    // Restart periodic updates if interval changed
    if (oldConfig.updateInterval !== this.config.updateInterval) {
      this.stopPeriodicUpdates();
      this.startPeriodicUpdates();
    }

    this.emit('configuration_updated', {
      oldConfig,
      newConfig: this.config
    });
  }

  /**
   * Clear all metrics data
   */
  clearAllData(): void {
    try {
      // Clear individual services
      if (this.latencyService) {
        this.latencyService.clearAllData();
      }

      if (this.errorRateService) {
        const componentIds = this.errorRateService.getComponentIds();
        componentIds.forEach(id => this.errorRateService.clearComponentData(id));
      }

      if (this.throughputService) {
        const componentIds = this.throughputService.getComponentIds();
        componentIds.forEach(id => this.throughputService.clearComponentData(id));
      }

      if (this.resourceService) {
        const componentIds = this.resourceService.getComponentIds();
        componentIds.forEach(id => this.resourceService.clearComponentData(id));
      }

      // Clear caches
      this.componentMetricsCache.clear();
      this.systemHealthCache = null;

      this.emit('data_cleared');

    } catch (error) {
      this.emit('clear_data_error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Cleanup and shutdown all services
   */
  cleanup(): void {
    try {
      this.stopPeriodicUpdates();

      // Cleanup individual services
      if (this.latencyService) {
        this.latencyService.stopAnalysis();
      }

      if (this.errorRateService) {
        this.errorRateService.stopAnalysis();
      }

      if (this.throughputService) {
        this.throughputService.stopAnalysis();
      }

      if (this.resourceService) {
        this.resourceService.stopAnalysis();
      }

      if (this.viewService) {
        this.viewService.cleanup();
      }

      if (this.realTimeService) {
        this.realTimeService.cleanup();
      }

      // Clear caches
      this.componentMetricsCache.clear();
      this.systemHealthCache = null;
      this.isInitialized = false;

      this.emit('cleanup_completed');

    } catch (error) {
      this.emit('cleanup_error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update unified metrics for a component
   */
  private updateUnifiedMetrics(componentId: string): void {
    try {
      const latencyMetrics = this.latencyService?.getLatencyDistribution(componentId);
      const errorMetrics = this.errorRateService?.calculateErrorRateMetrics(componentId);
      const throughputMetrics = this.throughputService?.calculateThroughputMetrics(componentId);
      const resourceMetrics = this.resourceService?.analyzeResourceSaturation(componentId);

      const unifiedMetrics: UnifiedMetrics = {
        componentId,
        timestamp: Date.now(),
        latency: {
          p50: latencyMetrics?.percentiles.p50 || 0,
          p95: latencyMetrics?.percentiles.p95 || 0,
          p99: latencyMetrics?.percentiles.p99 || 0,
          average: latencyMetrics?.histogram.meanLatency || 0,
          trend: latencyMetrics?.trendAnalysis.direction === 'degrading' ? 'degrading' : 
                 latencyMetrics?.trendAnalysis.direction === 'improving' ? 'improving' : 'stable'
        },
        errorRate: {
          current: errorMetrics?.overallErrorRate || 0,
          trend: errorMetrics?.errorTrend.direction === 'degrading' ? 'degrading' :
                 errorMetrics?.errorTrend.direction === 'improving' ? 'improving' : 'stable',
          categories: this.extractErrorCategories(errorMetrics)
        },
        throughput: {
          current: throughputMetrics?.currentThroughput || 0,
          capacity: throughputMetrics?.capacityAnalysis.theoreticalCapacity || 0,
          utilization: throughputMetrics?.capacityAnalysis.utilizationPercentage || 0,
          trend: throughputMetrics?.throughputTrend.direction || 'stable'
        },
        resources: {
          cpu: resourceMetrics?.criticalResources.find(r => r.type === 'cpu')?.currentUtilization || 0,
          memory: resourceMetrics?.criticalResources.find(r => r.type === 'memory')?.currentUtilization || 0,
          network: resourceMetrics?.criticalResources.find(r => r.type === 'network')?.currentUtilization || 0,
          storage: resourceMetrics?.criticalResources.find(r => r.type === 'storage')?.currentUtilization || 0,
          overall: resourceMetrics?.overallSaturation || 0
        },
        health: {
          score: this.calculateHealthScore(latencyMetrics, errorMetrics, throughputMetrics, resourceMetrics),
          status: this.determineHealthStatus(latencyMetrics, errorMetrics, throughputMetrics, resourceMetrics),
          issues: this.identifyHealthIssues(latencyMetrics, errorMetrics, throughputMetrics, resourceMetrics)
        }
      };

      this.componentMetricsCache.set(componentId, unifiedMetrics);

    } catch (error) {
      this.emit('unified_metrics_error', {
        componentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update system health summary
   */
  private updateSystemHealthSummary(): void {
    try {
      const allMetrics = Array.from(this.componentMetricsCache.values());
      
      if (allMetrics.length === 0) {
        this.systemHealthCache = null;
        return;
      }

      const healthyComponents = allMetrics.filter(m => m.health.status === 'healthy').length;
      const warningComponents = allMetrics.filter(m => m.health.status === 'warning').length;
      const criticalComponents = allMetrics.filter(m => m.health.status === 'critical').length;

      const overallHealth = allMetrics.reduce((sum, m) => sum + m.health.score, 0) / allMetrics.length;
      
      let systemStatus: 'healthy' | 'warning' | 'critical' | 'degraded';
      if (criticalComponents > 0) {
        systemStatus = 'critical';
      } else if (warningComponents > allMetrics.length * 0.3) {
        systemStatus = 'degraded';
      } else if (overallHealth >= 80) {
        systemStatus = 'healthy';
      } else {
        systemStatus = 'warning';
      }

      const allAlerts = this.getAllAlerts();
      const criticalAlerts = allAlerts.filter(a => a.severity === 'critical').length;

      this.systemHealthCache = {
        timestamp: Date.now(),
        overallHealth,
        systemStatus,
        componentCount: allMetrics.length,
        healthyComponents,
        warningComponents,
        criticalComponents,
        totalAlerts: allAlerts.length,
        criticalAlerts,
        systemMetrics: {
          totalThroughput: allMetrics.reduce((sum, m) => sum + m.throughput.current, 0),
          averageLatency: allMetrics.reduce((sum, m) => sum + m.latency.average, 0) / allMetrics.length,
          systemErrorRate: allMetrics.reduce((sum, m) => sum + m.errorRate.current, 0) / allMetrics.length,
          resourceUtilization: allMetrics.reduce((sum, m) => sum + m.resources.overall, 0) / allMetrics.length
        },
        trends: {
          performance: this.calculateSystemTrend(allMetrics, 'latency'),
          capacity: this.calculateCapacityTrend(allMetrics),
          reliability: this.calculateSystemTrend(allMetrics, 'errorRate')
        }
      };

    } catch (error) {
      this.emit('system_health_error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get all component IDs across all services
   */
  private getComponentIds(): string[] {
    const componentIds = new Set<string>();

    if (this.latencyService) {
      this.latencyService.getComponentIds().forEach(id => componentIds.add(id));
    }

    if (this.errorRateService) {
      this.errorRateService.getComponentIds().forEach(id => componentIds.add(id));
    }

    if (this.throughputService) {
      this.throughputService.getComponentIds().forEach(id => componentIds.add(id));
    }

    if (this.resourceService) {
      this.resourceService.getComponentIds().forEach(id => componentIds.add(id));
    }

    return Array.from(componentIds);
  }

  /**
   * Get list of enabled services
   */
  private getEnabledServices(): string[] {
    const services: string[] = [];
    
    if (this.config.enableLatencyMetrics) services.push('latency');
    if (this.config.enableErrorRateMonitoring) services.push('error_rate');
    if (this.config.enableThroughputMonitoring) services.push('throughput');
    if (this.config.enableResourceSaturationMonitoring) services.push('resources');
    if (this.config.enableRealTimeUpdates) services.push('real_time');
    if (this.config.dashboardEnabled) services.push('dashboard');

    return services;
  }

  // Helper methods for unified metrics calculation
  private extractErrorCategories(errorMetrics: any): Record<string, number> {
    if (!errorMetrics?.errorsByCategory) return {};
    
    const categories: Record<string, number> = {};
    for (const [categoryCode, categoryMetrics] of errorMetrics.errorsByCategory) {
      categories[categoryCode] = categoryMetrics.percentage;
    }
    return categories;
  }

  private calculateHealthScore(latency: any, errorRate: any, throughput: any, resources: any): number {
    let score = 100;

    // Latency impact
    if (latency?.percentiles.p95 > 1000) score -= 30;
    else if (latency?.percentiles.p95 > 500) score -= 20;
    else if (latency?.percentiles.p95 > 200) score -= 10;

    // Error rate impact
    if (errorRate?.overallErrorRate > 10) score -= 40;
    else if (errorRate?.overallErrorRate > 5) score -= 25;
    else if (errorRate?.overallErrorRate > 1) score -= 10;

    // Throughput impact
    if (throughput?.performanceScore) {
      score -= (100 - throughput.performanceScore) * 0.2;
    }

    // Resource impact
    if (resources?.healthScore) {
      score -= (100 - resources.healthScore) * 0.3;
    }

    return Math.max(0, Math.min(100, score));
  }

  private determineHealthStatus(latency: any, errorRate: any, throughput: any, resources: any): 'healthy' | 'warning' | 'critical' | 'unknown' {
    const score = this.calculateHealthScore(latency, errorRate, throughput, resources);
    
    if (score >= 80) return 'healthy';
    if (score >= 60) return 'warning';
    if (score >= 0) return 'critical';
    return 'unknown';
  }

  private identifyHealthIssues(latency: any, errorRate: any, throughput: any, resources: any): string[] {
    const issues: string[] = [];

    if (latency?.percentiles.p95 > 500) {
      issues.push('High latency detected');
    }

    if (errorRate?.overallErrorRate > 5) {
      issues.push('High error rate detected');
    }

    if (throughput?.capacityAnalysis.utilizationPercentage > 80) {
      issues.push('Approaching capacity limits');
    }

    if (resources?.overallSaturation > 80) {
      issues.push('High resource utilization');
    }

    return issues;
  }

  private calculateSystemTrend(metrics: UnifiedMetrics[], trendType: string): 'improving' | 'degrading' | 'stable' {
    // Simplified system trend calculation
    const degradingCount = metrics.filter(m => {
      switch (trendType) {
        case 'latency': return m.latency.trend === 'degrading';
        case 'throughput': return m.throughput.trend === 'decreasing';
        case 'errorRate': return m.errorRate.trend === 'degrading';
        default: return false;
      }
    }).length;

    const improvingCount = metrics.filter(m => {
      switch (trendType) {
        case 'latency': return m.latency.trend === 'improving';
        case 'throughput': return m.throughput.trend === 'increasing';
        case 'errorRate': return m.errorRate.trend === 'improving';
        default: return false;
      }
    }).length;

    if (degradingCount > improvingCount) return 'degrading';
    if (improvingCount > degradingCount) return 'improving';
    return 'stable';
  }

  private calculateCapacityTrend(metrics: UnifiedMetrics[]): 'increasing' | 'decreasing' | 'stable' {
    const decreasingCount = metrics.filter(m => m.throughput.trend === 'decreasing').length;
    const increasingCount = metrics.filter(m => m.throughput.trend === 'increasing').length;

    if (decreasingCount > increasingCount) return 'decreasing';
    if (increasingCount > decreasingCount) return 'increasing';
    return 'stable';
  }

  // Event handler setup methods
  private setupLatencyServiceEvents(): void {
    this.latencyService.on('alerts_generated', (data) => {
      this.emit('latency_alerts', data);
    });

    this.latencyService.on('analysis_completed', (data) => {
      this.emit('latency_analysis', data);
    });
  }

  private setupErrorRateServiceEvents(): void {
    this.errorRateService.on('alerts_generated', (data) => {
      this.emit('error_rate_alerts', data);
    });

    this.errorRateService.on('analysis_completed', (data) => {
      this.emit('error_rate_analysis', data);
    });
  }

  private setupThroughputServiceEvents(): void {
    this.throughputService.on('alerts_generated', (data) => {
      this.emit('throughput_alerts', data);
    });

    this.throughputService.on('analysis_completed', (data) => {
      this.emit('throughput_analysis', data);
    });
  }

  private setupResourceServiceEvents(): void {
    this.resourceService.on('alerts_generated', (data) => {
      this.emit('resource_alerts', data);
    });

    this.resourceService.on('analysis_completed', (data) => {
      this.emit('resource_analysis', data);
    });
  }

  private setupViewServiceEvents(): void {
    this.viewService.on('component_view_updated', (data) => {
      this.emit('component_view_updated', data);
    });

    this.viewService.on('global_view_updated', (data) => {
      this.emit('global_view_updated', data);
    });
  }

  private setupRealTimeServiceEvents(): void {
    this.realTimeService.on('client_subscribed', (data) => {
      this.emit('real_time_client_subscribed', data);
    });

    this.realTimeService.on('performance_warning', (data) => {
      this.emit('real_time_performance_warning', data);
    });
  }

  private startPeriodicUpdates(): void {
    this.updateTimer = setInterval(() => {
      this.updateSystemHealthSummary();
    }, this.config.updateInterval);
  }

  private stopPeriodicUpdates(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }
}