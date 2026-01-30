/**
 * Bottleneck reporting service for real-time analysis and notifications
 */

import { EventEmitter } from 'events';
import { BottleneckAnalyzer, BottleneckDetection, SystemBottleneckReport } from './BottleneckAnalyzer';
import { ComponentMetrics, Component, Connection } from '../types';
import { SystemMetrics } from './MetricsCollector';

export interface BottleneckAlert {
  id: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'new_bottleneck' | 'bottleneck_resolved' | 'bottleneck_escalated' | 'system_degraded';
  message: string;
  bottleneck?: BottleneckDetection;
  recommendations: string[];
}

export interface BottleneckReportConfig {
  analysisInterval: number; // milliseconds
  alertThreshold: 'low' | 'medium' | 'high' | 'critical';
  enableRealTimeAlerts: boolean;
  retainReportsFor: number; // milliseconds
}

export class BottleneckReporter extends EventEmitter {
  private analyzer: BottleneckAnalyzer;
  private config: BottleneckReportConfig;
  private reports: SystemBottleneckReport[] = [];
  private activeBottlenecks: Map<string, BottleneckDetection> = new Map();
  private analysisTimer: NodeJS.Timeout | null = null;
  private alertCounter = 0;

  constructor(config?: Partial<BottleneckReportConfig>) {
    super();
    this.analyzer = new BottleneckAnalyzer();
    this.config = {
      analysisInterval: 10000, // 10 seconds
      alertThreshold: 'medium',
      enableRealTimeAlerts: true,
      retainReportsFor: 3600000, // 1 hour
      ...config
    };
  }

  /**
   * Start bottleneck monitoring
   */
  start(): void {
    if (this.analysisTimer) {
      this.stop();
    }

    this.analysisTimer = setInterval(() => {
      this.emit('analysis_requested');
    }, this.config.analysisInterval);

    this.emit('monitoring_started');
  }

  /**
   * Stop bottleneck monitoring
   */
  stop(): void {
    if (this.analysisTimer) {
      clearInterval(this.analysisTimer);
      this.analysisTimer = null;
    }

    this.emit('monitoring_stopped');
  }

  /**
   * Analyze current system state and generate report
   */
  analyzeSystem(
    components: Component[],
    currentMetrics: Map<string, ComponentMetrics>,
    connections: Connection[],
    systemMetrics?: SystemMetrics
  ): SystemBottleneckReport {
    const report = this.analyzer.analyzeBottlenecks(
      components,
      currentMetrics,
      connections,
      systemMetrics
    );

    // Store the report
    this.reports.push(report);
    this.cleanupOldReports();

    // Process alerts if enabled
    if (this.config.enableRealTimeAlerts) {
      this.processAlerts(report);
    }

    this.emit('report_generated', report);
    return report;
  }

  /**
   * Get the latest bottleneck report
   */
  getLatestReport(): SystemBottleneckReport | null {
    return this.reports.length > 0 ? this.reports[this.reports.length - 1] : null;
  }

  /**
   * Get historical reports
   */
  getReports(startTime?: number, endTime?: number): SystemBottleneckReport[] {
    let filtered = this.reports;

    if (startTime || endTime) {
      filtered = this.reports.filter(report => {
        if (startTime && report.timestamp < startTime) return false;
        if (endTime && report.timestamp > endTime) return false;
        return true;
      });
    }

    return filtered;
  }

  /**
   * Get bottleneck trends over time
   */
  getBottleneckTrends(componentId?: string): {
    timestamps: number[];
    bottleneckCounts: number[];
    severityCounts: Record<string, number[]>;
    impactScores: number[];
  } {
    const timestamps: number[] = [];
    const bottleneckCounts: number[] = [];
    const severityCounts: Record<string, number[]> = {
      low: [],
      medium: [],
      high: [],
      critical: []
    };
    const impactScores: number[] = [];

    this.reports.forEach(report => {
      timestamps.push(report.timestamp);
      
      let filteredBottlenecks = report.bottlenecks;
      if (componentId) {
        filteredBottlenecks = report.bottlenecks.filter(b => b.componentId === componentId);
      }

      bottleneckCounts.push(filteredBottlenecks.length);
      impactScores.push(report.systemImpact);

      // Count by severity
      const severityCount = { low: 0, medium: 0, high: 0, critical: 0 };
      filteredBottlenecks.forEach(b => {
        severityCount[b.severity]++;
      });

      Object.keys(severityCount).forEach(severity => {
        severityCounts[severity].push(severityCount[severity as keyof typeof severityCount]);
      });
    });

    return {
      timestamps,
      bottleneckCounts,
      severityCounts,
      impactScores
    };
  }

  /**
   * Get component-specific bottleneck history
   */
  getComponentBottleneckHistory(componentId: string): {
    bottlenecks: BottleneckDetection[];
    timeline: { timestamp: number; count: number; maxSeverity: string }[];
  } {
    const bottlenecks: BottleneckDetection[] = [];
    const timeline: { timestamp: number; count: number; maxSeverity: string }[] = [];

    this.reports.forEach(report => {
      const componentBottlenecks = report.bottlenecks.filter(b => b.componentId === componentId);
      bottlenecks.push(...componentBottlenecks);

      if (componentBottlenecks.length > 0) {
        const maxSeverity = this.getMaxSeverity(componentBottlenecks.map(b => b.severity));
        timeline.push({
          timestamp: report.timestamp,
          count: componentBottlenecks.length,
          maxSeverity
        });
      }
    });

    return { bottlenecks, timeline };
  }

  /**
   * Generate optimization recommendations based on historical data
   */
  generateOptimizationRecommendations(): {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  } {
    const recentReports = this.reports.slice(-10); // Last 10 reports
    const allBottlenecks = recentReports.flatMap(r => r.bottlenecks);

    const immediate: string[] = [];
    const shortTerm: string[] = [];
    const longTerm: string[] = [];

    // Analyze patterns
    const bottlenecksByType = this.groupBottlenecksByType(allBottlenecks);
    const bottlenecksByComponent = this.groupBottlenecksByComponent(allBottlenecks);

    // Immediate recommendations (critical issues)
    const criticalBottlenecks = allBottlenecks.filter(b => b.severity === 'critical');
    if (criticalBottlenecks.length > 0) {
      immediate.push('Address critical bottlenecks immediately to prevent system failure');
      immediate.push(...criticalBottlenecks.slice(0, 3).flatMap(b => b.recommendations.slice(0, 2)));
    }

    // Short-term recommendations (recurring issues)
    const recurringComponents = Object.entries(bottlenecksByComponent)
      .filter(([_, bottlenecks]) => bottlenecks.length > 3)
      .map(([componentId, _]) => componentId);

    if (recurringComponents.length > 0) {
      shortTerm.push('Focus on components with recurring bottlenecks');
      shortTerm.push('Implement monitoring and auto-scaling for problematic components');
    }

    // Long-term recommendations (architectural improvements)
    if (bottlenecksByType.cpu && bottlenecksByType.cpu.length > 5) {
      longTerm.push('Consider system-wide architecture review for CPU optimization');
    }

    if (bottlenecksByType.latency && bottlenecksByType.latency.length > 3) {
      longTerm.push('Evaluate network topology and component placement');
    }

    longTerm.push('Implement predictive scaling based on historical patterns');
    longTerm.push('Consider microservices architecture for better scalability');

    return { immediate, shortTerm, longTerm };
  }

  /**
   * Process alerts for new bottlenecks
   */
  private processAlerts(report: SystemBottleneckReport): void {
    const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
    const alertThresholdLevel = severityOrder[this.config.alertThreshold];

    // Check for new bottlenecks
    report.bottlenecks.forEach(bottleneck => {
      const key = `${bottleneck.componentId}-${bottleneck.bottleneckType}`;
      const existing = this.activeBottlenecks.get(key);

      if (!existing && severityOrder[bottleneck.severity] >= alertThresholdLevel) {
        // New bottleneck
        this.activeBottlenecks.set(key, bottleneck);
        this.emitAlert({
          type: 'new_bottleneck',
          severity: bottleneck.severity,
          message: `New ${bottleneck.severity} bottleneck detected: ${bottleneck.description}`,
          bottleneck,
          recommendations: bottleneck.recommendations
        });
      } else if (existing && existing.severity !== bottleneck.severity) {
        // Bottleneck severity changed
        this.activeBottlenecks.set(key, bottleneck);
        
        if (severityOrder[bottleneck.severity] > severityOrder[existing.severity]) {
          this.emitAlert({
            type: 'bottleneck_escalated',
            severity: bottleneck.severity,
            message: `Bottleneck escalated from ${existing.severity} to ${bottleneck.severity}: ${bottleneck.description}`,
            bottleneck,
            recommendations: bottleneck.recommendations
          });
        }
      }
    });

    // Check for resolved bottlenecks
    const currentBottleneckKeys = new Set(
      report.bottlenecks.map(b => `${b.componentId}-${b.bottleneckType}`)
    );

    for (const [key, bottleneck] of this.activeBottlenecks) {
      if (!currentBottleneckKeys.has(key)) {
        this.activeBottlenecks.delete(key);
        this.emitAlert({
          type: 'bottleneck_resolved',
          severity: 'low',
          message: `Bottleneck resolved: ${bottleneck.description}`,
          bottleneck,
          recommendations: ['Continue monitoring to ensure stability']
        });
      }
    }

    // System-level alerts
    if (report.overallHealth === 'critical') {
      this.emitAlert({
        type: 'system_degraded',
        severity: 'critical',
        message: 'System health is critical - multiple bottlenecks detected',
        recommendations: report.recommendations
      });
    }
  }

  /**
   * Emit an alert
   */
  private emitAlert(alertData: Omit<BottleneckAlert, 'id' | 'timestamp'>): void {
    const alert: BottleneckAlert = {
      id: `alert-${++this.alertCounter}`,
      timestamp: Date.now(),
      ...alertData
    };

    this.emit('bottleneck_alert', alert);
  }

  /**
   * Clean up old reports
   */
  private cleanupOldReports(): void {
    const cutoffTime = Date.now() - this.config.retainReportsFor;
    this.reports = this.reports.filter(report => report.timestamp >= cutoffTime);
  }

  /**
   * Group bottlenecks by type
   */
  private groupBottlenecksByType(bottlenecks: BottleneckDetection[]): Record<string, BottleneckDetection[]> {
    return bottlenecks.reduce((acc, b) => {
      if (!acc[b.bottleneckType]) acc[b.bottleneckType] = [];
      acc[b.bottleneckType].push(b);
      return acc;
    }, {} as Record<string, BottleneckDetection[]>);
  }

  /**
   * Group bottlenecks by component
   */
  private groupBottlenecksByComponent(bottlenecks: BottleneckDetection[]): Record<string, BottleneckDetection[]> {
    return bottlenecks.reduce((acc, b) => {
      if (!acc[b.componentId]) acc[b.componentId] = [];
      acc[b.componentId].push(b);
      return acc;
    }, {} as Record<string, BottleneckDetection[]>);
  }

  /**
   * Get maximum severity from a list
   */
  private getMaxSeverity(severities: string[]): string {
    const order = { low: 1, medium: 2, high: 3, critical: 4 };
    return severities.reduce((max, current) => 
      order[current as keyof typeof order] > order[max as keyof typeof order] ? current : max
    );
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<BottleneckReportConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart monitoring if interval changed
    if (newConfig.analysisInterval && this.analysisTimer) {
      this.stop();
      this.start();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): BottleneckReportConfig {
    return { ...this.config };
  }
}