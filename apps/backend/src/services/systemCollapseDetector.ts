/**
 * System Collapse Detection Service
 * 
 * Implements SRS FR-5.4: System failure detection algorithms, cascade failure modeling,
 * and system recovery monitoring
 */

import { EventEmitter } from 'events';
import { ComponentMetrics, SystemMetrics } from '../types';
import { AggregatedMetrics } from '../simulation/MetricsCollector';

export interface CollapseThreshold {
  metric: 'errorRate' | 'latency' | 'throughput' | 'availability';
  threshold: number;
  duration: number; // milliseconds
  weight: number; // 0-1, importance of this metric
}

export interface SystemCollapseConfig {
  thresholds: CollapseThreshold[];
  cascadeDetectionWindow: number; // milliseconds
  recoveryDetectionWindow: number; // milliseconds
  minComponentsForCollapse: number;
  collapseConfidenceThreshold: number; // 0-1
}

export interface CollapseEvent {
  id: string;
  timestamp: number;
  type: 'partial' | 'cascade' | 'total';
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedComponents: string[];
  triggerComponent?: string;
  rootCause: string;
  propagationPath: string[];
  estimatedRecoveryTime: number;
  confidence: number; // 0-1
}

export interface RecoveryEvent {
  id: string;
  timestamp: number;
  collapseEventId: string;
  recoveredComponents: string[];
  actualRecoveryTime: number;
  recoveryMethod: 'automatic' | 'manual' | 'partial';
  remainingIssues: string[];
}

export interface CascadeFailureModel {
  componentId: string;
  dependentComponents: string[];
  failureProbability: number;
  propagationDelay: number; // milliseconds
  impactSeverity: number; // 0-1
}

export class SystemCollapseDetector extends EventEmitter {
  private config: SystemCollapseConfig;
  private componentMetricsHistory: Map<string, ComponentMetrics[]> = new Map();
  private systemMetricsHistory: SystemMetrics[] = [];
  private activeCollapses: Map<string, CollapseEvent> = new Map();
  private cascadeModels: Map<string, CascadeFailureModel> = new Map();
  private thresholdViolations: Map<string, { count: number; firstViolation: number }> = new Map();
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<SystemCollapseConfig> = {}) {
    super();
    this.config = {
      thresholds: [
        { metric: 'errorRate', threshold: 0.1, duration: 30000, weight: 0.3 },
        { metric: 'latency', threshold: 5000, duration: 30000, weight: 0.25 },
        { metric: 'throughput', threshold: 0.1, duration: 30000, weight: 0.25 },
        { metric: 'availability', threshold: 0.8, duration: 30000, weight: 0.2 }
      ],
      cascadeDetectionWindow: 60000, // 1 minute
      recoveryDetectionWindow: 120000, // 2 minutes
      minComponentsForCollapse: 2,
      collapseConfidenceThreshold: 0.7,
      ...config
    };
  }

  /**
   * Start monitoring for system collapse
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.analyzeSystemHealth();
    }, 5000); // Check every 5 seconds

    this.emit('monitoring_started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.emit('monitoring_stopped');
  }

  /**
   * Update component metrics for analysis
   */
  updateComponentMetrics(metrics: ComponentMetrics): void {
    if (!this.componentMetricsHistory.has(metrics.componentId)) {
      this.componentMetricsHistory.set(metrics.componentId, []);
    }

    const history = this.componentMetricsHistory.get(metrics.componentId)!;
    history.push(metrics);

    // Keep only recent history (last 10 minutes)
    const cutoffTime = Date.now() - 600000;
    const filteredHistory = history.filter(m => m.timestamp > cutoffTime);
    this.componentMetricsHistory.set(metrics.componentId, filteredHistory);
  }

  /**
   * Update system metrics for analysis
   */
  updateSystemMetrics(metrics: SystemMetrics): void {
    this.systemMetricsHistory.push(metrics);

    // Keep only recent history (last 10 minutes)
    const cutoffTime = Date.now() - 600000;
    this.systemMetricsHistory = this.systemMetricsHistory.filter(m => m.timestamp > cutoffTime);
  }

  /**
   * Add cascade failure model for a component
   */
  addCascadeModel(model: CascadeFailureModel): void {
    this.cascadeModels.set(model.componentId, model);
  }

  /**
   * Remove cascade failure model
   */
  removeCascadeModel(componentId: string): void {
    this.cascadeModels.delete(componentId);
  }

  /**
   * Analyze system health and detect collapses
   */
  private analyzeSystemHealth(): void {
    const now = Date.now();
    
    // Check for threshold violations
    this.checkThresholdViolations(now);
    
    // Detect new collapses
    this.detectCollapses(now);
    
    // Check for cascade failures
    this.detectCascadeFailures(now);
    
    // Monitor recovery of existing collapses
    this.monitorRecovery(now);
  }

  /**
   * Check for threshold violations
   */
  private checkThresholdViolations(now: number): void {
    for (const [componentId, history] of this.componentMetricsHistory) {
      if (history.length === 0) continue;

      const latest = history[history.length - 1];
      
      for (const threshold of this.config.thresholds) {
        const violationKey = `${componentId}-${threshold.metric}`;
        const isViolating = this.isThresholdViolated(latest, threshold);
        
        if (isViolating) {
          if (!this.thresholdViolations.has(violationKey)) {
            this.thresholdViolations.set(violationKey, {
              count: 1,
              firstViolation: now
            });
          } else {
            const violation = this.thresholdViolations.get(violationKey)!;
            violation.count++;
          }
        } else {
          // Clear violation if threshold is no longer violated
          this.thresholdViolations.delete(violationKey);
        }
      }
    }
  }

  /**
   * Check if a threshold is violated
   */
  private isThresholdViolated(metrics: ComponentMetrics, threshold: CollapseThreshold): boolean {
    switch (threshold.metric) {
      case 'errorRate':
        return metrics.errorRate > threshold.threshold;
      case 'latency':
        return metrics.averageLatency > threshold.threshold;
      case 'throughput':
        return metrics.requestsPerSecond < threshold.threshold;
      case 'availability':
        return (1 - metrics.errorRate) < threshold.threshold;
      default:
        return false;
    }
  }

  /**
   * Detect system collapses
   */
  private detectCollapses(now: number): void {
    const violatingComponents = this.getViolatingComponents(now);
    
    if (violatingComponents.length < this.config.minComponentsForCollapse) {
      return;
    }

    // Calculate collapse confidence
    const confidence = this.calculateCollapseConfidence(violatingComponents, now);
    
    if (confidence < this.config.collapseConfidenceThreshold) {
      return;
    }

    // Determine collapse type and severity
    const collapseType = this.determineCollapseType(violatingComponents);
    const severity = this.calculateCollapseSeverity(violatingComponents, confidence);
    
    // Find root cause
    const rootCause = this.identifyRootCause(violatingComponents, now);
    
    // Create collapse event
    const collapseEvent: CollapseEvent = {
      id: `collapse-${now}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: now,
      type: collapseType,
      severity,
      affectedComponents: violatingComponents.map(v => v.componentId),
      triggerComponent: rootCause.componentId,
      rootCause: rootCause.description,
      propagationPath: this.tracePropagationPath(rootCause.componentId, violatingComponents),
      estimatedRecoveryTime: this.estimateRecoveryTime(collapseType, severity),
      confidence
    };

    this.activeCollapses.set(collapseEvent.id, collapseEvent);
    
    this.emit('collapse_detected', collapseEvent);
  }

  /**
   * Get components violating thresholds
   */
  private getViolatingComponents(now: number): Array<{
    componentId: string;
    violations: Array<{ metric: string; severity: number; duration: number }>;
  }> {
    const violating: Array<{
      componentId: string;
      violations: Array<{ metric: string; severity: number; duration: number }>;
    }> = [];

    for (const [violationKey, violation] of this.thresholdViolations) {
      const [componentId, metric] = violationKey.split('-');
      const duration = now - violation.firstViolation;
      
      const threshold = this.config.thresholds.find(t => t.metric === metric);
      if (!threshold || duration < threshold.duration) continue;

      // Calculate severity based on how much the threshold is exceeded
      const latest = this.getLatestMetrics(componentId);
      if (!latest) continue;

      const severity = this.calculateViolationSeverity(latest, threshold);
      
      let component = violating.find(v => v.componentId === componentId);
      if (!component) {
        component = { componentId, violations: [] };
        violating.push(component);
      }
      
      component.violations.push({ metric, severity, duration });
    }

    return violating;
  }

  /**
   * Calculate collapse confidence
   */
  private calculateCollapseConfidence(violatingComponents: any[], now: number): number {
    let totalWeight = 0;
    let weightedScore = 0;

    for (const component of violatingComponents) {
      for (const violation of component.violations) {
        const threshold = this.config.thresholds.find(t => t.metric === violation.metric);
        if (!threshold) continue;

        totalWeight += threshold.weight;
        weightedScore += threshold.weight * violation.severity;
      }
    }

    const baseConfidence = totalWeight > 0 ? weightedScore / totalWeight : 0;
    
    // Adjust confidence based on number of affected components
    const componentFactor = Math.min(1, violatingComponents.length / 5);
    
    // Adjust confidence based on system-wide metrics
    const systemFactor = this.getSystemHealthFactor();
    
    return Math.min(1, baseConfidence * componentFactor * systemFactor);
  }

  /**
   * Determine collapse type
   */
  private determineCollapseType(violatingComponents: any[]): 'partial' | 'cascade' | 'total' {
    const totalComponents = this.componentMetricsHistory.size;
    const affectedRatio = violatingComponents.length / totalComponents;
    
    if (affectedRatio >= 0.8) return 'total';
    if (affectedRatio >= 0.4) return 'cascade';
    return 'partial';
  }

  /**
   * Calculate collapse severity
   */
  private calculateCollapseSeverity(violatingComponents: any[], confidence: number): 'low' | 'medium' | 'high' | 'critical' {
    const avgSeverity = violatingComponents.reduce((sum, comp) => {
      const compSeverity = comp.violations.reduce((s: number, v: any) => s + v.severity, 0) / comp.violations.length;
      return sum + compSeverity;
    }, 0) / violatingComponents.length;

    const combinedScore = (avgSeverity + confidence) / 2;

    if (combinedScore >= 0.9) return 'critical';
    if (combinedScore >= 0.7) return 'high';
    if (combinedScore >= 0.5) return 'medium';
    return 'low';
  }

  /**
   * Identify root cause of collapse
   */
  private identifyRootCause(violatingComponents: any[], now: number): { componentId: string; description: string } {
    // Find component with earliest violation
    let earliestComponent = violatingComponents[0];
    let earliestTime = now;

    for (const component of violatingComponents) {
      for (const violation of component.violations) {
        const violationTime = now - violation.duration;
        if (violationTime < earliestTime) {
          earliestTime = violationTime;
          earliestComponent = component;
        }
      }
    }

    // Generate description based on primary violation
    const primaryViolation = earliestComponent.violations.reduce((max: any, v: any) => 
      v.severity > max.severity ? v : max
    );

    const description = this.generateRootCauseDescription(earliestComponent.componentId, primaryViolation);

    return {
      componentId: earliestComponent.componentId,
      description
    };
  }

  /**
   * Generate root cause description
   */
  private generateRootCauseDescription(componentId: string, violation: any): string {
    switch (violation.metric) {
      case 'errorRate':
        return `High error rate in ${componentId} causing system instability`;
      case 'latency':
        return `Excessive latency in ${componentId} creating bottleneck`;
      case 'throughput':
        return `Throughput degradation in ${componentId} limiting system capacity`;
      case 'availability':
        return `Availability issues in ${componentId} affecting system reliability`;
      default:
        return `Performance degradation in ${componentId}`;
    }
  }

  /**
   * Trace propagation path of failure
   */
  private tracePropagationPath(rootComponentId: string, violatingComponents: any[]): string[] {
    const path = [rootComponentId];
    const visited = new Set([rootComponentId]);

    // Use cascade models to trace propagation
    let currentComponents = [rootComponentId];
    
    while (currentComponents.length > 0) {
      const nextComponents: string[] = [];
      
      for (const componentId of currentComponents) {
        const model = this.cascadeModels.get(componentId);
        if (!model) continue;

        for (const dependent of model.dependentComponents) {
          if (!visited.has(dependent) && violatingComponents.some(v => v.componentId === dependent)) {
            path.push(dependent);
            visited.add(dependent);
            nextComponents.push(dependent);
          }
        }
      }
      
      currentComponents = nextComponents;
    }

    return path;
  }

  /**
   * Estimate recovery time
   */
  private estimateRecoveryTime(type: string, severity: string): number {
    const baseTime = {
      partial: 60000,    // 1 minute
      cascade: 300000,   // 5 minutes
      total: 900000      // 15 minutes
    }[type] || 60000;

    const severityMultiplier = {
      low: 0.5,
      medium: 1.0,
      high: 2.0,
      critical: 4.0
    }[severity] || 1.0;

    return baseTime * severityMultiplier;
  }

  /**
   * Detect cascade failures
   */
  private detectCascadeFailures(now: number): void {
    for (const [componentId, model] of this.cascadeModels) {
      const isComponentFailing = this.isComponentFailing(componentId, now);
      if (!isComponentFailing) continue;

      // Check if dependent components are starting to fail
      const cascadeComponents: string[] = [];
      
      for (const dependentId of model.dependentComponents) {
        const dependentMetrics = this.getLatestMetrics(dependentId);
        if (!dependentMetrics) continue;

        // Check if dependent is showing signs of failure
        const failureProbability = this.calculateFailureProbability(dependentMetrics, model);
        if (failureProbability > 0.5) {
          cascadeComponents.push(dependentId);
        }
      }

      if (cascadeComponents.length > 0) {
        this.emit('cascade_failure_detected', {
          triggerComponent: componentId,
          affectedComponents: cascadeComponents,
          timestamp: now,
          model
        });
      }
    }
  }

  /**
   * Monitor recovery of existing collapses
   */
  private monitorRecovery(now: number): void {
    for (const [collapseId, collapse] of this.activeCollapses) {
      const recoveredComponents = this.checkComponentRecovery(collapse.affectedComponents, now);
      
      if (recoveredComponents.length > 0) {
        const recoveryEvent: RecoveryEvent = {
          id: `recovery-${now}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: now,
          collapseEventId: collapseId,
          recoveredComponents,
          actualRecoveryTime: now - collapse.timestamp,
          recoveryMethod: this.determineRecoveryMethod(recoveredComponents),
          remainingIssues: collapse.affectedComponents.filter(c => !recoveredComponents.includes(c))
        };

        this.emit('recovery_detected', recoveryEvent);

        // Remove collapse if fully recovered
        if (recoveryEvent.remainingIssues.length === 0) {
          this.activeCollapses.delete(collapseId);
          this.emit('collapse_resolved', { collapseId, recoveryEvent });
        } else {
          // Update collapse with remaining components
          collapse.affectedComponents = recoveryEvent.remainingIssues;
        }
      }
    }
  }

  /**
   * Check if component is failing
   */
  private isComponentFailing(componentId: string, now: number): boolean {
    const violations = Array.from(this.thresholdViolations.keys())
      .filter(key => key.startsWith(`${componentId}-`));
    
    return violations.length > 0;
  }

  /**
   * Calculate failure probability for cascade
   */
  private calculateFailureProbability(metrics: ComponentMetrics, model: CascadeFailureModel): number {
    // Simple probability calculation based on metrics degradation
    const errorFactor = metrics.errorRate * 2;
    const latencyFactor = Math.min(1, metrics.averageLatency / 1000);
    const queueFactor = Math.min(1, metrics.queueDepth / 100);
    
    const baseProbability = (errorFactor + latencyFactor + queueFactor) / 3;
    return Math.min(1, baseProbability * model.failureProbability);
  }

  /**
   * Check component recovery
   */
  private checkComponentRecovery(affectedComponents: string[], now: number): string[] {
    const recovered: string[] = [];
    
    for (const componentId of affectedComponents) {
      const hasViolations = Array.from(this.thresholdViolations.keys())
        .some(key => key.startsWith(`${componentId}-`));
      
      if (!hasViolations) {
        recovered.push(componentId);
      }
    }
    
    return recovered;
  }

  /**
   * Determine recovery method
   */
  private determineRecoveryMethod(recoveredComponents: string[]): 'automatic' | 'manual' | 'partial' {
    // Simplified logic - in real implementation, this would analyze recovery patterns
    return recoveredComponents.length > 0 ? 'automatic' : 'manual';
  }

  /**
   * Helper methods
   */
  private getLatestMetrics(componentId: string): ComponentMetrics | null {
    const history = this.componentMetricsHistory.get(componentId);
    return history && history.length > 0 ? history[history.length - 1] : null;
  }

  private calculateViolationSeverity(metrics: ComponentMetrics, threshold: CollapseThreshold): number {
    let actualValue: number;
    
    switch (threshold.metric) {
      case 'errorRate':
        actualValue = metrics.errorRate;
        break;
      case 'latency':
        actualValue = metrics.averageLatency;
        break;
      case 'throughput':
        actualValue = metrics.requestsPerSecond;
        return Math.max(0, 1 - (actualValue / threshold.threshold)); // Inverted for throughput
      case 'availability':
        actualValue = 1 - metrics.errorRate;
        return Math.max(0, 1 - (actualValue / threshold.threshold)); // Inverted for availability
      default:
        return 0;
    }
    
    return Math.min(1, actualValue / threshold.threshold);
  }

  private getSystemHealthFactor(): number {
    if (this.systemMetricsHistory.length === 0) return 1;
    
    const latest = this.systemMetricsHistory[this.systemMetricsHistory.length - 1];
    const healthScore = (latest.healthyComponents / latest.activeComponents) || 1;
    
    return 1 - healthScore; // Invert so higher system issues increase confidence
  }

  /**
   * Get active collapses
   */
  getActiveCollapses(): CollapseEvent[] {
    return Array.from(this.activeCollapses.values());
  }

  /**
   * Get collapse by ID
   */
  getCollapse(collapseId: string): CollapseEvent | null {
    return this.activeCollapses.get(collapseId) || null;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.componentMetricsHistory.clear();
    this.systemMetricsHistory = [];
    this.activeCollapses.clear();
    this.thresholdViolations.clear();
  }
}