/**
 * Metrics View Service
 * 
 * Implements SRS FR-7.5: Implement component-specific metrics and system-wide 
 * performance dashboards with drill-down capabilities from global to component level
 */

import { EventEmitter } from 'events';
import { ComponentMetrics } from '../types';
import { LatencyMetricsService, LatencyDistribution } from './latencyMetricsService';
import { ErrorRateMonitoringService, ErrorRateMetrics } from './errorRateMonitoringService';
import { ThroughputMonitoringService, ThroughputMetrics } from './throughputMonitoringService';
import { ResourceSaturationMonitoringService, ResourceSaturationAnalysis } from './resourceSaturationMonitoringService';

export interface ComponentView {
  componentId: string;
  componentType: string;
  timestamp: number;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  healthScore: number; // 0-100 overall component health
  summary: ComponentSummary;
  detailedMetrics: ComponentDetailedMetrics;
  alerts: ComponentAlert[];
  trends: ComponentTrends;
  recommendations: ComponentRecommendation[];
}

export interface ComponentSummary {
  currentThroughput: number;
  averageLatency: number;
  errorRate: number;
  resourceUtilization: number;
  queueDepth: number;
  uptime: number; // seconds
  lastUpdated: number;
}

export interface ComponentDetailedMetrics {
  latency: LatencyDistribution | null;
  errorRate: ErrorRateMetrics | null;
  throughput: ThroughputMetrics | null;
  resources: ResourceSaturationAnalysis | null;
  performance: PerformanceMetrics;
  capacity: CapacityMetrics;
}

export interface PerformanceMetrics {
  responseTime: {
    current: number;
    average: number;
    p50: number;
    p95: number;
    p99: number;
  };
  availability: {
    current: number; // 0-100 percentage
    sla: number; // target SLA
    uptime: number; // seconds
    downtime: number; // seconds
  };
  reliability: {
    mtbf: number; // mean time between failures (seconds)
    mttr: number; // mean time to recovery (seconds)
    failureRate: number; // failures per hour
  };
}

export interface CapacityMetrics {
  current: number;
  maximum: number;
  utilization: number; // 0-100 percentage
  headroom: number;
  timeToCapacity: number | null; // minutes
  scalingTriggers: ScalingTrigger[];
}

export interface ScalingTrigger {
  metric: string;
  threshold: number;
  currentValue: number;
  triggered: boolean;
  action: 'scale_up' | 'scale_down' | 'scale_out' | 'scale_in';
}

export interface ComponentAlert {
  id: string;
  type: 'latency' | 'error_rate' | 'throughput' | 'resource' | 'capacity';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: number;
  acknowledged: boolean;
  resolvedAt?: number;
}

export interface ComponentTrends {
  latency: TrendData;
  throughput: TrendData;
  errorRate: TrendData;
  resourceUtilization: TrendData;
}

export interface TrendData {
  direction: 'improving' | 'degrading' | 'stable';
  changeRate: number; // percentage change per minute
  confidence: number; // 0-1
  forecast: ForecastPoint[];
}

export interface ForecastPoint {
  timestamp: number;
  value: number;
  confidence: number;
}

export interface ComponentRecommendation {
  type: 'performance' | 'capacity' | 'reliability' | 'cost';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  expectedImpact: string;
  effort: 'low' | 'medium' | 'high';
  timeframe: string;
}

export interface GlobalView {
  timestamp: number;
  systemStatus: 'healthy' | 'warning' | 'critical' | 'degraded';
  systemHealthScore: number; // 0-100 overall system health
  summary: GlobalSummary;
  componentOverview: ComponentOverview[];
  systemMetrics: SystemMetrics;
  alerts: SystemAlert[];
  trends: SystemTrends;
  insights: SystemInsight[];
}

export interface GlobalSummary {
  totalComponents: number;
  healthyComponents: number;
  warningComponents: number;
  criticalComponents: number;
  totalThroughput: number;
  averageLatency: number;
  systemErrorRate: number;
  systemUptime: number; // seconds
}

export interface ComponentOverview {
  componentId: string;
  componentType: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  healthScore: number;
  primaryMetric: {
    name: string;
    value: number;
    unit: string;
    status: 'good' | 'warning' | 'critical';
  };
  alertCount: number;
  lastUpdated: number;
}

export interface SystemMetrics {
  performance: {
    totalThroughput: number;
    averageLatency: number;
    p95Latency: number;
    p99Latency: number;
    systemErrorRate: number;
  };
  capacity: {
    overallUtilization: number;
    bottlenecks: string[];
    timeToCapacity: number | null;
    scalingRecommendations: string[];
  };
  reliability: {
    systemAvailability: number;
    componentFailures: number;
    cascadeRisk: number; // 0-100 risk of cascade failure
    recoveryTime: number; // average recovery time in seconds
  };
  efficiency: {
    resourceEfficiency: number; // 0-100 how efficiently resources are used
    costEfficiency: number; // 0-100 cost vs performance ratio
    energyEfficiency?: number; // 0-100 energy usage efficiency
  };
}

export interface SystemAlert {
  id: string;
  type: 'system' | 'cascade' | 'capacity' | 'performance' | 'reliability';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  affectedComponents: string[];
  timestamp: number;
  acknowledged: boolean;
  estimatedImpact: string;
  recommendedActions: string[];
}

export interface SystemTrends {
  performance: {
    throughput: TrendData;
    latency: TrendData;
    errorRate: TrendData;
  };
  capacity: {
    utilization: TrendData;
    growth: TrendData;
  };
  reliability: {
    availability: TrendData;
    failureRate: TrendData;
  };
}

export interface SystemInsight {
  type: 'optimization' | 'risk' | 'opportunity' | 'anomaly';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  evidence: string[];
  recommendations: string[];
  potentialImpact: string;
}

export interface DrillDownContext {
  fromView: 'global' | 'component';
  targetComponent?: string;
  timeRange: {
    start: number;
    end: number;
  };
  focusMetric?: string;
  filters?: Record<string, any>;
}

export interface ViewConfiguration {
  refreshInterval: number; // milliseconds
  retentionPeriod: number; // milliseconds
  aggregationLevel: 'raw' | 'minute' | 'hour' | 'day';
  enabledMetrics: string[];
  alertThresholds: Record<string, number>;
  customDashboards: CustomDashboard[];
}

export interface CustomDashboard {
  id: string;
  name: string;
  description: string;
  widgets: DashboardWidget[];
  layout: DashboardLayout;
  filters: DashboardFilter[];
}

export interface DashboardWidget {
  id: string;
  type: 'chart' | 'metric' | 'alert' | 'table' | 'heatmap';
  title: string;
  dataSource: string;
  configuration: Record<string, any>;
  position: { x: number; y: number; width: number; height: number };
}

export interface DashboardLayout {
  columns: number;
  rows: number;
  responsive: boolean;
}

export interface DashboardFilter {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'between';
  value: any;
  label: string;
}

export class MetricsViewService extends EventEmitter {
  private latencyService: LatencyMetricsService;
  private errorRateService: ErrorRateMonitoringService;
  private throughputService: ThroughputMonitoringService;
  private resourceService: ResourceSaturationMonitoringService;
  
  private componentViews: Map<string, ComponentView> = new Map();
  private globalView: GlobalView | null = null;
  private viewConfiguration: ViewConfiguration;
  private updateTimer: NodeJS.Timeout | null = null;
  private alertCounter: number = 0;

  constructor(config?: Partial<ViewConfiguration>) {
    super();
    
    this.latencyService = new LatencyMetricsService();
    this.errorRateService = new ErrorRateMonitoringService();
    this.throughputService = new ThroughputMonitoringService();
    this.resourceService = new ResourceSaturationMonitoringService();
    
    this.viewConfiguration = {
      refreshInterval: 5000, // 5 seconds
      retentionPeriod: 3600000, // 1 hour
      aggregationLevel: 'minute',
      enabledMetrics: ['latency', 'throughput', 'errorRate', 'resources'],
      alertThresholds: {
        latency_p95: 500,
        error_rate: 5,
        throughput_min: 10,
        cpu_utilization: 80,
        memory_utilization: 85
      },
      customDashboards: [],
      ...config
    };

    this.startPeriodicUpdates();
    this.setupServiceEventHandlers();
  }

  /**
   * Get component-specific view with detailed metrics
   */
  getComponentView(componentId: string, drillDownContext?: DrillDownContext): ComponentView | null {
    const view = this.componentViews.get(componentId);
    if (!view) {
      return null;
    }

    // Apply drill-down context if provided
    if (drillDownContext) {
      return this.applyDrillDownContext(view, drillDownContext);
    }

    return view;
  }

  /**
   * Get global system view with component overview
   */
  getGlobalView(): GlobalView | null {
    return this.globalView;
  }

  /**
   * Get component overview for global dashboard
   */
  getComponentOverview(): ComponentOverview[] {
    return Array.from(this.componentViews.values()).map(view => ({
      componentId: view.componentId,
      componentType: view.componentType,
      status: view.status,
      healthScore: view.healthScore,
      primaryMetric: this.getPrimaryMetric(view),
      alertCount: view.alerts.filter(a => !a.acknowledged).length,
      lastUpdated: view.timestamp
    }));
  }

  /**
   * Drill down from global view to component view
   */
  drillDownToComponent(componentId: string, context: DrillDownContext): ComponentView | null {
    const view = this.getComponentView(componentId, context);
    if (view) {
      this.emit('drill_down', {
        from: 'global',
        to: 'component',
        componentId,
        context
      });
    }
    return view;
  }

  /**
   * Get system-wide metrics aggregation
   */
  getSystemMetrics(): SystemMetrics | null {
    return this.globalView?.systemMetrics || null;
  }

  /**
   * Get all active alerts across the system
   */
  getSystemAlerts(): SystemAlert[] {
    return this.globalView?.alerts || [];
  }

  /**
   * Get component alerts for a specific component
   */
  getComponentAlerts(componentId: string): ComponentAlert[] {
    const view = this.componentViews.get(componentId);
    return view?.alerts || [];
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, componentId?: string): boolean {
    if (componentId) {
      const view = this.componentViews.get(componentId);
      if (view) {
        const alert = view.alerts.find(a => a.id === alertId);
        if (alert) {
          alert.acknowledged = true;
          this.emit('alert_acknowledged', { alertId, componentId });
          return true;
        }
      }
    } else {
      // System alert
      if (this.globalView) {
        const alert = this.globalView.alerts.find(a => a.id === alertId);
        if (alert) {
          alert.acknowledged = true;
          this.emit('alert_acknowledged', { alertId });
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Update view configuration
   */
  updateConfiguration(config: Partial<ViewConfiguration>): void {
    this.viewConfiguration = { ...this.viewConfiguration, ...config };
    
    // Restart periodic updates with new interval
    if (config.refreshInterval) {
      this.stopPeriodicUpdates();
      this.startPeriodicUpdates();
    }
    
    this.emit('configuration_updated', this.viewConfiguration);
  }

  /**
   * Create custom dashboard
   */
  createCustomDashboard(dashboard: CustomDashboard): void {
    this.viewConfiguration.customDashboards.push(dashboard);
    this.emit('dashboard_created', dashboard);
  }

  /**
   * Get custom dashboards
   */
  getCustomDashboards(): CustomDashboard[] {
    return this.viewConfiguration.customDashboards;
  }

  /**
   * Process component metrics and update views
   */
  processComponentMetrics(metrics: ComponentMetrics): void {
    // Update individual metric services
    this.latencyService.processComponentMetrics(metrics);
    this.errorRateService.processComponentMetrics(metrics);
    this.throughputService.processComponentMetrics(metrics);
    this.resourceService.processComponentMetrics(metrics);

    // Update component view
    this.updateComponentView(metrics.componentId);
  }

  /**
   * Update component view with latest metrics
   */
  private updateComponentView(componentId: string): void {
    const latencyMetrics = this.latencyService.getLatencyDistribution(componentId);
    const errorMetrics = this.errorRateService.calculateErrorRateMetrics(componentId);
    const throughputMetrics = this.throughputService.calculateThroughputMetrics(componentId);
    const resourceMetrics = this.resourceService.analyzeResourceSaturation(componentId);

    // Calculate component health score
    const healthScore = this.calculateComponentHealthScore(
      latencyMetrics,
      errorMetrics,
      throughputMetrics,
      resourceMetrics
    );

    // Determine component status
    const status = this.determineComponentStatus(healthScore);

    // Get component type (simplified)
    const componentType = 'service'; // Would be determined from component configuration

    // Create component summary
    const summary: ComponentSummary = {
      currentThroughput: throughputMetrics?.currentThroughput || 0,
      averageLatency: latencyMetrics?.percentiles.p50 || 0,
      errorRate: errorMetrics?.overallErrorRate || 0,
      resourceUtilization: resourceMetrics?.overallSaturation || 0,
      queueDepth: resourceMetrics?.criticalResources.find(r => r.type === 'queues')?.currentUtilization || 0,
      uptime: 3600, // Simplified - 1 hour uptime
      lastUpdated: Date.now()
    };

    // Create detailed metrics
    const detailedMetrics: ComponentDetailedMetrics = {
      latency: latencyMetrics,
      errorRate: errorMetrics,
      throughput: throughputMetrics,
      resources: resourceMetrics,
      performance: this.calculatePerformanceMetrics(latencyMetrics, errorMetrics),
      capacity: this.calculateCapacityMetrics(throughputMetrics, resourceMetrics)
    };

    // Collect alerts
    const alerts = this.collectComponentAlerts(componentId);

    // Calculate trends
    const trends = this.calculateComponentTrends(componentId);

    // Generate recommendations
    const recommendations = this.generateComponentRecommendations(
      detailedMetrics,
      alerts,
      trends
    );

    const componentView: ComponentView = {
      componentId,
      componentType,
      timestamp: Date.now(),
      status,
      healthScore,
      summary,
      detailedMetrics,
      alerts,
      trends,
      recommendations
    };

    this.componentViews.set(componentId, componentView);
    this.emit('component_view_updated', componentView);
  }

  /**
   * Update global view with system-wide metrics
   */
  private updateGlobalView(): void {
    const componentViews = Array.from(this.componentViews.values());
    
    if (componentViews.length === 0) {
      return;
    }

    // Calculate system summary
    const summary: GlobalSummary = {
      totalComponents: componentViews.length,
      healthyComponents: componentViews.filter(v => v.status === 'healthy').length,
      warningComponents: componentViews.filter(v => v.status === 'warning').length,
      criticalComponents: componentViews.filter(v => v.status === 'critical').length,
      totalThroughput: componentViews.reduce((sum, v) => sum + v.summary.currentThroughput, 0),
      averageLatency: componentViews.reduce((sum, v) => sum + v.summary.averageLatency, 0) / componentViews.length,
      systemErrorRate: componentViews.reduce((sum, v) => sum + v.summary.errorRate, 0) / componentViews.length,
      systemUptime: Math.min(...componentViews.map(v => v.summary.uptime))
    };

    // Calculate system health score
    const systemHealthScore = componentViews.reduce((sum, v) => sum + v.healthScore, 0) / componentViews.length;

    // Determine system status
    const systemStatus = this.determineSystemStatus(summary, systemHealthScore);

    // Create component overview
    const componentOverview = this.getComponentOverview();

    // Calculate system metrics
    const systemMetrics = this.calculateSystemMetrics(componentViews);

    // Collect system alerts
    const alerts = this.collectSystemAlerts(componentViews);

    // Calculate system trends
    const trends = this.calculateSystemTrends(componentViews);

    // Generate system insights
    const insights = this.generateSystemInsights(componentViews, systemMetrics, trends);

    this.globalView = {
      timestamp: Date.now(),
      systemStatus,
      systemHealthScore,
      summary,
      componentOverview,
      systemMetrics,
      alerts,
      trends,
      insights
    };

    this.emit('global_view_updated', this.globalView);
  }

  /**
   * Calculate component health score
   */
  private calculateComponentHealthScore(
    latency: LatencyDistribution | null,
    errorRate: ErrorRateMetrics | null,
    throughput: ThroughputMetrics | null,
    resources: ResourceSaturationAnalysis | null
  ): number {
    let score = 100;

    // Latency impact
    if (latency) {
      if (latency.percentiles.p95 > 1000) score -= 30;
      else if (latency.percentiles.p95 > 500) score -= 20;
      else if (latency.percentiles.p95 > 200) score -= 10;
    }

    // Error rate impact
    if (errorRate) {
      if (errorRate.overallErrorRate > 10) score -= 40;
      else if (errorRate.overallErrorRate > 5) score -= 25;
      else if (errorRate.overallErrorRate > 1) score -= 10;
    }

    // Throughput impact
    if (throughput) {
      score -= (100 - throughput.performanceScore) * 0.2;
    }

    // Resource impact
    if (resources) {
      score -= (100 - resources.healthScore) * 0.3;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Determine component status based on health score
   */
  private determineComponentStatus(healthScore: number): 'healthy' | 'warning' | 'critical' | 'unknown' {
    if (healthScore >= 80) return 'healthy';
    if (healthScore >= 60) return 'warning';
    if (healthScore >= 0) return 'critical';
    return 'unknown';
  }

  /**
   * Determine system status
   */
  private determineSystemStatus(
    summary: GlobalSummary, 
    healthScore: number
  ): 'healthy' | 'warning' | 'critical' | 'degraded' {
    if (summary.criticalComponents > 0) return 'critical';
    if (summary.warningComponents > summary.totalComponents * 0.3) return 'degraded';
    if (healthScore >= 80) return 'healthy';
    return 'warning';
  }

  /**
   * Get primary metric for component overview
   */
  private getPrimaryMetric(view: ComponentView): ComponentOverview['primaryMetric'] {
    // Choose the most relevant metric based on component status
    if (view.summary.errorRate > 1) {
      return {
        name: 'Error Rate',
        value: view.summary.errorRate,
        unit: '%',
        status: view.summary.errorRate > 5 ? 'critical' : 'warning'
      };
    }

    if (view.summary.averageLatency > 500) {
      return {
        name: 'Latency',
        value: view.summary.averageLatency,
        unit: 'ms',
        status: view.summary.averageLatency > 1000 ? 'critical' : 'warning'
      };
    }

    return {
      name: 'Throughput',
      value: view.summary.currentThroughput,
      unit: 'req/s',
      status: 'good'
    };
  }

  /**
   * Apply drill-down context to component view
   */
  private applyDrillDownContext(view: ComponentView, context: DrillDownContext): ComponentView {
    // Filter metrics based on time range and focus metric
    const filteredView = { ...view };
    
    if (context.focusMetric) {
      // Highlight specific metric in the view
      filteredView.summary = { ...view.summary };
      // Additional filtering logic would go here
    }

    return filteredView;
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformanceMetrics(
    latency: LatencyDistribution | null,
    errorRate: ErrorRateMetrics | null
  ): PerformanceMetrics {
    return {
      responseTime: {
        current: latency?.percentiles.p50 || 0,
        average: latency?.percentiles.p50 || 0,
        p50: latency?.percentiles.p50 || 0,
        p95: latency?.percentiles.p95 || 0,
        p99: latency?.percentiles.p99 || 0
      },
      availability: {
        current: errorRate ? (100 - errorRate.overallErrorRate) : 100,
        sla: 99.9,
        uptime: 3600,
        downtime: 0
      },
      reliability: {
        mtbf: 86400, // 24 hours
        mttr: 300, // 5 minutes
        failureRate: errorRate?.overallErrorRate || 0
      }
    };
  }

  /**
   * Calculate capacity metrics
   */
  private calculateCapacityMetrics(
    throughput: ThroughputMetrics | null,
    resources: ResourceSaturationAnalysis | null
  ): CapacityMetrics {
    return {
      current: throughput?.currentThroughput || 0,
      maximum: throughput?.capacityAnalysis.theoreticalCapacity || 100,
      utilization: throughput?.capacityAnalysis.utilizationPercentage || 0,
      headroom: throughput?.capacityAnalysis.headroom || 0,
      timeToCapacity: throughput?.capacityAnalysis.timeToCapacity || null,
      scalingTriggers: []
    };
  }

  /**
   * Collect component alerts
   */
  private collectComponentAlerts(componentId: string): ComponentAlert[] {
    const alerts: ComponentAlert[] = [];

    // Collect alerts from all services
    const latencyAlerts = this.latencyService.checkAlerts(componentId);
    const errorAlerts = this.errorRateService.checkAlerts(componentId);
    const throughputAlerts = this.throughputService.checkAlerts(componentId);
    const resourceAlerts = this.resourceService.checkAlerts(componentId);

    // Convert to component alerts
    latencyAlerts.forEach(alert => {
      alerts.push({
        id: `lat_${this.alertCounter++}`,
        type: 'latency',
        severity: alert.severity === 'critical' ? 'critical' : 'warning',
        message: alert.message,
        timestamp: alert.timestamp,
        acknowledged: false
      });
    });

    errorAlerts.forEach(alert => {
      alerts.push({
        id: `err_${this.alertCounter++}`,
        type: 'error_rate',
        severity: alert.severity === 'critical' ? 'critical' : 'warning',
        message: alert.message,
        timestamp: alert.timestamp,
        acknowledged: false
      });
    });

    throughputAlerts.forEach(alert => {
      alerts.push({
        id: `thr_${this.alertCounter++}`,
        type: 'throughput',
        severity: alert.severity === 'critical' ? 'critical' : 'warning',
        message: alert.message,
        timestamp: alert.timestamp,
        acknowledged: false
      });
    });

    resourceAlerts.forEach(alert => {
      alerts.push({
        id: `res_${this.alertCounter++}`,
        type: 'resource',
        severity: alert.severity === 'critical' ? 'critical' : 'warning',
        message: alert.message,
        timestamp: alert.timestamp,
        acknowledged: false
      });
    });

    return alerts;
  }

  /**
   * Calculate component trends
   */
  private calculateComponentTrends(componentId: string): ComponentTrends {
    // Simplified trend calculation
    return {
      latency: {
        direction: 'stable',
        changeRate: 0,
        confidence: 0.5,
        forecast: []
      },
      throughput: {
        direction: 'stable',
        changeRate: 0,
        confidence: 0.5,
        forecast: []
      },
      errorRate: {
        direction: 'stable',
        changeRate: 0,
        confidence: 0.5,
        forecast: []
      },
      resourceUtilization: {
        direction: 'stable',
        changeRate: 0,
        confidence: 0.5,
        forecast: []
      }
    };
  }

  /**
   * Generate component recommendations
   */
  private generateComponentRecommendations(
    metrics: ComponentDetailedMetrics,
    alerts: ComponentAlert[],
    trends: ComponentTrends
  ): ComponentRecommendation[] {
    const recommendations: ComponentRecommendation[] = [];

    // High latency recommendations
    if (metrics.latency && metrics.latency.percentiles.p95 > 500) {
      recommendations.push({
        type: 'performance',
        priority: metrics.latency.percentiles.p95 > 1000 ? 'urgent' : 'high',
        title: 'Optimize Response Time',
        description: 'High P95 latency detected. Consider optimizing slow operations or scaling resources.',
        expectedImpact: 'Reduce P95 latency by 30-50%',
        effort: 'medium',
        timeframe: '1-2 weeks'
      });
    }

    // High error rate recommendations
    if (metrics.errorRate && metrics.errorRate.overallErrorRate > 5) {
      recommendations.push({
        type: 'reliability',
        priority: 'urgent',
        title: 'Reduce Error Rate',
        description: 'High error rate detected. Investigate root causes and implement error handling.',
        expectedImpact: 'Reduce error rate to <1%',
        effort: 'high',
        timeframe: '3-5 days'
      });
    }

    // Capacity recommendations
    if (metrics.throughput && metrics.throughput.capacityAnalysis.utilizationPercentage > 80) {
      recommendations.push({
        type: 'capacity',
        priority: 'high',
        title: 'Scale Resources',
        description: 'Component approaching capacity limits. Plan for horizontal or vertical scaling.',
        expectedImpact: 'Increase capacity by 50-100%',
        effort: 'medium',
        timeframe: '1-3 days'
      });
    }

    return recommendations;
  }

  /**
   * Calculate system metrics
   */
  private calculateSystemMetrics(componentViews: ComponentView[]): SystemMetrics {
    const totalThroughput = componentViews.reduce((sum, v) => sum + v.summary.currentThroughput, 0);
    const avgLatency = componentViews.reduce((sum, v) => sum + v.summary.averageLatency, 0) / componentViews.length;
    const systemErrorRate = componentViews.reduce((sum, v) => sum + v.summary.errorRate, 0) / componentViews.length;

    return {
      performance: {
        totalThroughput,
        averageLatency: avgLatency,
        p95Latency: avgLatency * 1.5, // Simplified
        p99Latency: avgLatency * 2,
        systemErrorRate
      },
      capacity: {
        overallUtilization: componentViews.reduce((sum, v) => sum + v.summary.resourceUtilization, 0) / componentViews.length,
        bottlenecks: componentViews.filter(v => v.summary.resourceUtilization > 80).map(v => v.componentId),
        timeToCapacity: null,
        scalingRecommendations: []
      },
      reliability: {
        systemAvailability: 100 - systemErrorRate,
        componentFailures: componentViews.filter(v => v.status === 'critical').length,
        cascadeRisk: componentViews.filter(v => v.status === 'critical').length * 20,
        recoveryTime: 300
      },
      efficiency: {
        resourceEfficiency: 100 - (componentViews.reduce((sum, v) => sum + v.summary.resourceUtilization, 0) / componentViews.length),
        costEfficiency: 75, // Simplified
        energyEfficiency: 80
      }
    };
  }

  /**
   * Collect system alerts
   */
  private collectSystemAlerts(componentViews: ComponentView[]): SystemAlert[] {
    const alerts: SystemAlert[] = [];

    // System-wide capacity alert
    const highUtilizationComponents = componentViews.filter(v => v.summary.resourceUtilization > 80);
    if (highUtilizationComponents.length > componentViews.length * 0.5) {
      alerts.push({
        id: `sys_${this.alertCounter++}`,
        type: 'capacity',
        severity: 'warning',
        message: 'Multiple components approaching capacity limits',
        affectedComponents: highUtilizationComponents.map(v => v.componentId),
        timestamp: Date.now(),
        acknowledged: false,
        estimatedImpact: 'System-wide performance degradation risk',
        recommendedActions: ['Plan system-wide scaling', 'Review capacity planning']
      });
    }

    // Cascade failure risk
    const criticalComponents = componentViews.filter(v => v.status === 'critical');
    if (criticalComponents.length > 1) {
      alerts.push({
        id: `sys_${this.alertCounter++}`,
        type: 'cascade',
        severity: 'critical',
        message: 'Multiple critical components detected - cascade failure risk',
        affectedComponents: criticalComponents.map(v => v.componentId),
        timestamp: Date.now(),
        acknowledged: false,
        estimatedImpact: 'High risk of system-wide failure',
        recommendedActions: ['Immediate investigation', 'Implement circuit breakers', 'Prepare rollback plan']
      });
    }

    return alerts;
  }

  /**
   * Calculate system trends
   */
  private calculateSystemTrends(componentViews: ComponentView[]): SystemTrends {
    // Simplified system trend calculation
    return {
      performance: {
        throughput: { direction: 'stable', changeRate: 0, confidence: 0.5, forecast: [] },
        latency: { direction: 'stable', changeRate: 0, confidence: 0.5, forecast: [] },
        errorRate: { direction: 'stable', changeRate: 0, confidence: 0.5, forecast: [] }
      },
      capacity: {
        utilization: { direction: 'stable', changeRate: 0, confidence: 0.5, forecast: [] },
        growth: { direction: 'stable', changeRate: 0, confidence: 0.5, forecast: [] }
      },
      reliability: {
        availability: { direction: 'stable', changeRate: 0, confidence: 0.5, forecast: [] },
        failureRate: { direction: 'stable', changeRate: 0, confidence: 0.5, forecast: [] }
      }
    };
  }

  /**
   * Generate system insights
   */
  private generateSystemInsights(
    componentViews: ComponentView[],
    systemMetrics: SystemMetrics,
    trends: SystemTrends
  ): SystemInsight[] {
    const insights: SystemInsight[] = [];

    // Resource optimization insight
    if (systemMetrics.efficiency.resourceEfficiency < 70) {
      insights.push({
        type: 'optimization',
        priority: 'medium',
        title: 'Resource Optimization Opportunity',
        description: 'System resources are not being used efficiently across components',
        evidence: [
          `Resource efficiency: ${systemMetrics.efficiency.resourceEfficiency}%`,
          `${componentViews.filter(v => v.summary.resourceUtilization < 30).length} underutilized components`
        ],
        recommendations: [
          'Consolidate underutilized components',
          'Implement auto-scaling policies',
          'Review resource allocation'
        ],
        potentialImpact: 'Reduce infrastructure costs by 20-30%'
      });
    }

    // Performance bottleneck insight
    if (systemMetrics.capacity.bottlenecks.length > 0) {
      insights.push({
        type: 'risk',
        priority: 'high',
        title: 'Performance Bottlenecks Detected',
        description: 'Multiple components are experiencing resource constraints',
        evidence: [
          `${systemMetrics.capacity.bottlenecks.length} bottlenecked components`,
          `Overall utilization: ${systemMetrics.capacity.overallUtilization}%`
        ],
        recommendations: [
          'Scale bottlenecked components',
          'Implement load balancing',
          'Optimize resource-intensive operations'
        ],
        potentialImpact: 'Prevent system-wide performance degradation'
      });
    }

    return insights;
  }

  /**
   * Setup event handlers for metric services
   */
  private setupServiceEventHandlers(): void {
    this.latencyService.on('alerts_generated', (data) => {
      this.emit('component_alerts', data);
    });

    this.errorRateService.on('alerts_generated', (data) => {
      this.emit('component_alerts', data);
    });

    this.throughputService.on('alerts_generated', (data) => {
      this.emit('component_alerts', data);
    });

    this.resourceService.on('alerts_generated', (data) => {
      this.emit('component_alerts', data);
    });
  }

  /**
   * Start periodic view updates
   */
  private startPeriodicUpdates(): void {
    this.updateTimer = setInterval(() => {
      this.updateGlobalView();
    }, this.viewConfiguration.refreshInterval);
  }

  /**
   * Stop periodic view updates
   */
  private stopPeriodicUpdates(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stopPeriodicUpdates();
    this.latencyService.stopAnalysis();
    this.errorRateService.stopAnalysis();
    this.throughputService.stopAnalysis();
    this.resourceService.stopAnalysis();
  }
}