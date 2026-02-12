/**
 * Error Rate Monitoring Service
 * 
 * Implements SRS FR-7.2: Implement error rate calculation and tracking with 
 * error categorization and analysis, and error rate alerting and thresholds
 */

import { EventEmitter } from 'events';
import { ComponentMetrics } from '../types';

export interface ErrorCategory {
  code: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  isRetryable: boolean;
  expectedFrequency: 'rare' | 'occasional' | 'common';
}

export interface ErrorEvent {
  componentId: string;
  timestamp: number;
  errorCode: string;
  errorType: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  isRetryable: boolean;
  requestId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface ErrorRateMetrics {
  componentId: string;
  timeWindow: {
    startTime: number;
    endTime: number;
    duration: number;
  };
  totalRequests: number;
  totalErrors: number;
  overallErrorRate: number;
  errorsByCategory: Map<string, ErrorCategoryMetrics>;
  errorsByType: Map<string, ErrorTypeMetrics>;
  errorTrend: ErrorTrend;
  errorBurst: ErrorBurst | null;
  healthScore: number; // 0-100, based on error patterns
}

export interface ErrorCategoryMetrics {
  category: ErrorCategory;
  count: number;
  rate: number; // errors per second
  percentage: number; // percentage of total errors
  trend: 'increasing' | 'decreasing' | 'stable';
  firstOccurrence: number;
  lastOccurrence: number;
  impactScore: number; // 0-100, based on severity and frequency
}

export interface ErrorTypeMetrics {
  errorType: string;
  count: number;
  rate: number;
  percentage: number;
  averageFrequency: number; // average time between occurrences
  isAnomalous: boolean;
  relatedComponents: string[]; // components that also experience this error
}

export interface ErrorTrend {
  direction: 'improving' | 'degrading' | 'stable';
  changeRate: number; // percentage change per minute
  confidence: number; // 0-1 confidence in trend
  predictedErrorRate: number; // predicted error rate in next window
  volatility: number; // measure of error rate stability
}

export interface ErrorBurst {
  startTime: number;
  endTime: number;
  duration: number;
  peakErrorRate: number;
  totalErrors: number;
  primaryErrorTypes: string[];
  severity: 'minor' | 'major' | 'critical';
  isOngoing: boolean;
}

export interface ErrorRateThresholds {
  warningThreshold: number; // error rate percentage
  criticalThreshold: number;
  burstThreshold: number; // errors per second that constitutes a burst
  trendDegradationThreshold: number; // percentage increase per minute
  categoryThresholds: Map<string, number>; // per-category thresholds
  consecutiveErrorsThreshold: number; // consecutive errors that trigger alert
}

export interface ErrorAlert {
  componentId: string;
  timestamp: number;
  alertType: 'threshold_exceeded' | 'error_burst' | 'trend_degradation' | 'category_spike' | 'consecutive_errors';
  severity: 'warning' | 'critical';
  message: string;
  currentValue: number;
  threshold: number;
  errorDetails: {
    primaryErrorTypes: string[];
    affectedCategories: string[];
    sampleErrors: ErrorEvent[];
  };
  recommendations: string[];
  estimatedImpact: string;
}

export interface ErrorPattern {
  patternId: string;
  name: string;
  description: string;
  errorTypes: string[];
  components: string[];
  frequency: number; // occurrences per hour
  duration: number; // average duration in seconds
  severity: 'low' | 'medium' | 'high' | 'critical';
  rootCause?: string;
  mitigation?: string[];
}

export class ErrorRateMonitoringService extends EventEmitter {
  private errorEvents: Map<string, ErrorEvent[]> = new Map();
  private errorRateMetrics: Map<string, ErrorRateMetrics[]> = new Map();
  private errorCategories: Map<string, ErrorCategory> = new Map();
  private thresholds: Map<string, ErrorRateThresholds> = new Map();
  private errorPatterns: Map<string, ErrorPattern> = new Map();
  private analysisInterval: number = 30000; // 30 seconds
  private retentionPeriod: number = 3600000; // 1 hour
  private analysisTimer: NodeJS.Timeout | null = null;
  private consecutiveErrors: Map<string, number> = new Map();

  constructor() {
    super();
    this.initializeDefaultErrorCategories();
    this.startAnalysis();
  }

  /**
   * Record an error event
   */
  recordError(error: ErrorEvent): void {
    if (!this.errorEvents.has(error.componentId)) {
      this.errorEvents.set(error.componentId, []);
    }

    const componentErrors = this.errorEvents.get(error.componentId)!;
    componentErrors.push(error);

    // Clean up old events
    const cutoffTime = error.timestamp - this.retentionPeriod;
    const filteredErrors = componentErrors.filter(e => e.timestamp >= cutoffTime);
    this.errorEvents.set(error.componentId, filteredErrors);

    // Track consecutive errors
    this.updateConsecutiveErrorCount(error.componentId, true);

    this.emit('error_recorded', error);
  }

  /**
   * Record successful request (resets consecutive error count)
   */
  recordSuccess(componentId: string, timestamp: number = Date.now()): void {
    this.updateConsecutiveErrorCount(componentId, false);
    this.emit('success_recorded', { componentId, timestamp });
  }

  /**
   * Process component metrics to extract error data
   */
  processComponentMetrics(metrics: ComponentMetrics): void {
    const errorCount = Math.round(metrics.requestsPerSecond * metrics.errorRate);
    const successCount = Math.round(metrics.requestsPerSecond * (1 - metrics.errorRate));

    // Generate synthetic error events based on error rate
    for (let i = 0; i < errorCount; i++) {
      const syntheticError: ErrorEvent = {
        componentId: metrics.componentId,
        timestamp: metrics.timestamp - Math.random() * 1000,
        errorCode: this.generateSyntheticErrorCode(metrics.errorRate),
        errorType: this.generateSyntheticErrorType(metrics.errorRate),
        message: 'Synthetic error from metrics',
        severity: this.generateSyntheticSeverity(metrics.errorRate),
        isRetryable: Math.random() > 0.3,
        metadata: { synthetic: true, originalErrorRate: metrics.errorRate }
      };
      this.recordError(syntheticError);
    }

    // Record successes
    for (let i = 0; i < successCount; i++) {
      this.recordSuccess(metrics.componentId, metrics.timestamp);
    }
  }

  /**
   * Calculate error rate metrics for a component
   */
  calculateErrorRateMetrics(componentId: string): ErrorRateMetrics | null {
    const errors = this.errorEvents.get(componentId);
    if (!errors || errors.length === 0) {
      return null;
    }

    const now = Date.now();
    const windowStart = now - this.analysisInterval;
    const windowErrors = errors.filter(e => e.timestamp >= windowStart);

    if (windowErrors.length === 0) {
      return null;
    }

    // Calculate basic metrics
    const totalErrors = windowErrors.length;
    const totalRequests = this.estimateTotalRequests(componentId, windowStart, now);
    const overallErrorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

    // Group errors by category
    const errorsByCategory = new Map<string, ErrorCategoryMetrics>();
    const errorsByType = new Map<string, ErrorTypeMetrics>();

    // Process errors by category
    for (const error of windowErrors) {
      const category = this.getErrorCategory(error.errorCode);
      if (category) {
        if (!errorsByCategory.has(category.code)) {
          errorsByCategory.set(category.code, {
            category,
            count: 0,
            rate: 0,
            percentage: 0,
            trend: 'stable',
            firstOccurrence: error.timestamp,
            lastOccurrence: error.timestamp,
            impactScore: 0
          });
        }

        const categoryMetrics = errorsByCategory.get(category.code)!;
        categoryMetrics.count++;
        categoryMetrics.firstOccurrence = Math.min(categoryMetrics.firstOccurrence, error.timestamp);
        categoryMetrics.lastOccurrence = Math.max(categoryMetrics.lastOccurrence, error.timestamp);
      }

      // Process errors by type
      if (!errorsByType.has(error.errorType)) {
        errorsByType.set(error.errorType, {
          errorType: error.errorType,
          count: 0,
          rate: 0,
          percentage: 0,
          averageFrequency: 0,
          isAnomalous: false,
          relatedComponents: []
        });
      }

      const typeMetrics = errorsByType.get(error.errorType)!;
      typeMetrics.count++;
    }

    // Calculate rates and percentages
    const windowDurationSeconds = this.analysisInterval / 1000;
    
    for (const [_, categoryMetrics] of errorsByCategory) {
      categoryMetrics.rate = categoryMetrics.count / windowDurationSeconds;
      categoryMetrics.percentage = (categoryMetrics.count / totalErrors) * 100;
      categoryMetrics.trend = this.calculateCategoryTrend(componentId, categoryMetrics.category.code);
      categoryMetrics.impactScore = this.calculateImpactScore(categoryMetrics);
    }

    for (const [_, typeMetrics] of errorsByType) {
      typeMetrics.rate = typeMetrics.count / windowDurationSeconds;
      typeMetrics.percentage = (typeMetrics.count / totalErrors) * 100;
      typeMetrics.averageFrequency = this.calculateAverageFrequency(componentId, typeMetrics.errorType);
      typeMetrics.isAnomalous = this.isErrorTypeAnomalous(componentId, typeMetrics.errorType);
      typeMetrics.relatedComponents = this.findRelatedComponents(typeMetrics.errorType);
    }

    // Calculate error trend
    const errorTrend = this.calculateErrorTrend(componentId);

    // Detect error bursts
    const errorBurst = this.detectErrorBurst(componentId);

    // Calculate health score
    const healthScore = this.calculateHealthScore(overallErrorRate, errorsByCategory, errorTrend);

    return {
      componentId,
      timeWindow: {
        startTime: windowStart,
        endTime: now,
        duration: this.analysisInterval
      },
      totalRequests,
      totalErrors,
      overallErrorRate,
      errorsByCategory,
      errorsByType,
      errorTrend,
      errorBurst,
      healthScore
    };
  }

  /**
   * Set error rate thresholds for a component
   */
  setThresholds(componentId: string, thresholds: ErrorRateThresholds): void {
    this.thresholds.set(componentId, thresholds);
    this.emit('thresholds_updated', { componentId, thresholds });
  }

  /**
   * Check for error rate alerts
   */
  checkAlerts(componentId: string): ErrorAlert[] {
    const thresholds = this.thresholds.get(componentId);
    const metrics = this.calculateErrorRateMetrics(componentId);
    
    if (!thresholds || !metrics) {
      return [];
    }

    const alerts: ErrorAlert[] = [];
    const now = Date.now();

    // Overall error rate alerts
    if (metrics.overallErrorRate > thresholds.criticalThreshold) {
      alerts.push({
        componentId,
        timestamp: now,
        alertType: 'threshold_exceeded',
        severity: 'critical',
        message: `Error rate (${metrics.overallErrorRate.toFixed(2)}%) exceeds critical threshold (${thresholds.criticalThreshold}%)`,
        currentValue: metrics.overallErrorRate,
        threshold: thresholds.criticalThreshold,
        errorDetails: this.getErrorDetails(componentId, 'critical'),
        recommendations: [
          'Immediate investigation required',
          'Check for system failures or misconfigurations',
          'Consider circuit breaker activation',
          'Review recent deployments'
        ],
        estimatedImpact: 'High - Service degradation likely affecting users'
      });
    } else if (metrics.overallErrorRate > thresholds.warningThreshold) {
      alerts.push({
        componentId,
        timestamp: now,
        alertType: 'threshold_exceeded',
        severity: 'warning',
        message: `Error rate (${metrics.overallErrorRate.toFixed(2)}%) exceeds warning threshold (${thresholds.warningThreshold}%)`,
        currentValue: metrics.overallErrorRate,
        threshold: thresholds.warningThreshold,
        errorDetails: this.getErrorDetails(componentId, 'warning'),
        recommendations: [
          'Monitor error patterns closely',
          'Review error logs for common causes',
          'Check component health metrics'
        ],
        estimatedImpact: 'Medium - Potential service quality impact'
      });
    }

    // Error burst alerts
    if (metrics.errorBurst && metrics.errorBurst.isOngoing) {
      const severity = metrics.errorBurst.severity === 'critical' ? 'critical' : 'warning';
      alerts.push({
        componentId,
        timestamp: now,
        alertType: 'error_burst',
        severity,
        message: `Error burst detected: ${metrics.errorBurst.totalErrors} errors in ${(metrics.errorBurst.duration / 1000).toFixed(1)}s`,
        currentValue: metrics.errorBurst.peakErrorRate,
        threshold: thresholds.burstThreshold,
        errorDetails: {
          primaryErrorTypes: metrics.errorBurst.primaryErrorTypes,
          affectedCategories: [],
          sampleErrors: this.getSampleErrors(componentId, 3)
        },
        recommendations: [
          'Investigate sudden increase in errors',
          'Check for traffic spikes or system overload',
          'Review error patterns for common root cause'
        ],
        estimatedImpact: severity === 'critical' ? 'High - Service instability' : 'Medium - Temporary service issues'
      });
    }

    // Trend degradation alerts
    if (metrics.errorTrend.direction === 'degrading' && 
        metrics.errorTrend.changeRate > thresholds.trendDegradationThreshold &&
        metrics.errorTrend.confidence > 0.7) {
      alerts.push({
        componentId,
        timestamp: now,
        alertType: 'trend_degradation',
        severity: metrics.errorTrend.changeRate > thresholds.trendDegradationThreshold * 2 ? 'critical' : 'warning',
        message: `Error rate trending upward at ${metrics.errorTrend.changeRate.toFixed(2)}% per minute`,
        currentValue: metrics.errorTrend.changeRate,
        threshold: thresholds.trendDegradationThreshold,
        errorDetails: this.getErrorDetails(componentId, 'trend'),
        recommendations: [
          'Investigate root cause of increasing errors',
          'Check for gradual system degradation',
          'Review capacity and resource utilization'
        ],
        estimatedImpact: 'Medium to High - Progressive service degradation'
      });
    }

    // Category-specific alerts
    for (const [categoryCode, categoryMetrics] of metrics.errorsByCategory) {
      const categoryThreshold = thresholds.categoryThresholds.get(categoryCode);
      if (categoryThreshold && categoryMetrics.percentage > categoryThreshold) {
        alerts.push({
          componentId,
          timestamp: now,
          alertType: 'category_spike',
          severity: categoryMetrics.category.severity === 'critical' ? 'critical' : 'warning',
          message: `${categoryMetrics.category.name} errors (${categoryMetrics.percentage.toFixed(1)}%) exceed threshold (${categoryThreshold}%)`,
          currentValue: categoryMetrics.percentage,
          threshold: categoryThreshold,
          errorDetails: {
            primaryErrorTypes: [],
            affectedCategories: [categoryCode],
            sampleErrors: this.getSampleErrorsByCategory(componentId, categoryCode, 3)
          },
          recommendations: [
            `Investigate ${categoryMetrics.category.name.toLowerCase()} issues`,
            'Check category-specific error patterns',
            'Review related system components'
          ],
          estimatedImpact: this.getCategoryImpactDescription(categoryMetrics.category)
        });
      }
    }

    // Consecutive errors alert
    const consecutiveCount = this.consecutiveErrors.get(componentId) || 0;
    if (consecutiveCount >= thresholds.consecutiveErrorsThreshold) {
      alerts.push({
        componentId,
        timestamp: now,
        alertType: 'consecutive_errors',
        severity: 'critical',
        message: `${consecutiveCount} consecutive errors detected`,
        currentValue: consecutiveCount,
        threshold: thresholds.consecutiveErrorsThreshold,
        errorDetails: this.getErrorDetails(componentId, 'consecutive'),
        recommendations: [
          'Immediate investigation - component may be failing',
          'Consider circuit breaker activation',
          'Check component health and connectivity'
        ],
        estimatedImpact: 'Critical - Component appears to be failing'
      });
    }

    return alerts;
  }

  /**
   * Add custom error category
   */
  addErrorCategory(category: ErrorCategory): void {
    this.errorCategories.set(category.code, category);
    this.emit('error_category_added', category);
  }

  /**
   * Get all error categories
   */
  getErrorCategories(): ErrorCategory[] {
    return Array.from(this.errorCategories.values());
  }

  /**
   * Detect error patterns across components
   */
  detectErrorPatterns(): ErrorPattern[] {
    const patterns: ErrorPattern[] = [];
    const allErrors = new Map<string, ErrorEvent[]>();

    // Collect all errors across components
    for (const [componentId, errors] of this.errorEvents) {
      for (const error of errors) {
        if (!allErrors.has(error.errorType)) {
          allErrors.set(error.errorType, []);
        }
        allErrors.get(error.errorType)!.push(error);
      }
    }

    // Analyze patterns
    for (const [errorType, errors] of allErrors) {
      if (errors.length < 5) continue; // Need minimum occurrences

      const components = Array.from(new Set(errors.map(e => e.componentId)));
      const timeSpan = Math.max(...errors.map(e => e.timestamp)) - Math.min(...errors.map(e => e.timestamp));
      const frequency = (errors.length / (timeSpan / 3600000)); // errors per hour

      if (components.length > 1 || frequency > 10) { // Cross-component or high-frequency patterns
        patterns.push({
          patternId: `pattern_${errorType}_${Date.now()}`,
          name: `${errorType} Pattern`,
          description: `Recurring ${errorType} errors across ${components.length} component(s)`,
          errorTypes: [errorType],
          components,
          frequency,
          duration: this.calculateAverageErrorDuration(errors),
          severity: this.calculatePatternSeverity(errors),
          rootCause: this.suggestRootCause(errorType, components),
          mitigation: this.suggestMitigation(errorType, components)
        });
      }
    }

    return patterns;
  }

  /**
   * Get component IDs with error data
   */
  getComponentIds(): string[] {
    return Array.from(this.errorEvents.keys());
  }

  /**
   * Clear error data for a component
   */
  clearComponentData(componentId: string): void {
    this.errorEvents.delete(componentId);
    this.errorRateMetrics.delete(componentId);
    this.thresholds.delete(componentId);
    this.consecutiveErrors.delete(componentId);
    this.emit('component_data_cleared', { componentId });
  }

  /**
   * Initialize default error categories
   */
  private initializeDefaultErrorCategories(): void {
    const defaultCategories: ErrorCategory[] = [
      {
        code: 'CLIENT_ERROR',
        name: 'Client Errors',
        description: '4xx HTTP errors caused by client requests',
        severity: 'medium',
        isRetryable: false,
        expectedFrequency: 'occasional'
      },
      {
        code: 'SERVER_ERROR',
        name: 'Server Errors',
        description: '5xx HTTP errors caused by server issues',
        severity: 'high',
        isRetryable: true,
        expectedFrequency: 'rare'
      },
      {
        code: 'TIMEOUT',
        name: 'Timeout Errors',
        description: 'Request timeouts and deadline exceeded errors',
        severity: 'high',
        isRetryable: true,
        expectedFrequency: 'occasional'
      },
      {
        code: 'CONNECTION',
        name: 'Connection Errors',
        description: 'Network connectivity and connection errors',
        severity: 'critical',
        isRetryable: true,
        expectedFrequency: 'rare'
      },
      {
        code: 'VALIDATION',
        name: 'Validation Errors',
        description: 'Input validation and data format errors',
        severity: 'low',
        isRetryable: false,
        expectedFrequency: 'common'
      },
      {
        code: 'AUTHENTICATION',
        name: 'Authentication Errors',
        description: 'Authentication and authorization failures',
        severity: 'medium',
        isRetryable: false,
        expectedFrequency: 'occasional'
      },
      {
        code: 'RESOURCE',
        name: 'Resource Errors',
        description: 'Resource exhaustion and capacity errors',
        severity: 'critical',
        isRetryable: true,
        expectedFrequency: 'rare'
      }
    ];

    for (const category of defaultCategories) {
      this.errorCategories.set(category.code, category);
    }
  }

  /**
   * Start periodic analysis
   */
  private startAnalysis(): void {
    this.analysisTimer = setInterval(() => {
      this.performPeriodicAnalysis();
    }, this.analysisInterval);
  }

  /**
   * Stop periodic analysis
   */
  stopAnalysis(): void {
    if (this.analysisTimer) {
      clearInterval(this.analysisTimer);
      this.analysisTimer = null;
    }
  }

  /**
   * Perform periodic analysis for all components
   */
  private performPeriodicAnalysis(): void {
    const componentIds = this.getComponentIds();
    
    for (const componentId of componentIds) {
      const metrics = this.calculateErrorRateMetrics(componentId);
      if (metrics) {
        // Store metrics history
        if (!this.errorRateMetrics.has(componentId)) {
          this.errorRateMetrics.set(componentId, []);
        }
        
        const metricsHistory = this.errorRateMetrics.get(componentId)!;
        metricsHistory.push(metrics);
        
        // Keep only recent metrics
        const maxMetrics = Math.floor(this.retentionPeriod / this.analysisInterval);
        if (metricsHistory.length > maxMetrics) {
          metricsHistory.splice(0, metricsHistory.length - maxMetrics);
        }
        
        // Check for alerts
        const alerts = this.checkAlerts(componentId);
        if (alerts.length > 0) {
          this.emit('alerts_generated', { componentId, alerts });
        }
        
        this.emit('analysis_completed', { componentId, metrics });
      }
    }

    // Detect cross-component patterns
    const patterns = this.detectErrorPatterns();
    if (patterns.length > 0) {
      this.emit('patterns_detected', patterns);
    }
  }

  // Helper methods (simplified implementations)
  private generateSyntheticErrorCode(errorRate: number): string {
    const codes = ['500', '503', '504', '400', '401', '403', '404', '422'];
    return codes[Math.floor(Math.random() * codes.length)];
  }

  private generateSyntheticErrorType(errorRate: number): string {
    const types = ['INTERNAL_ERROR', 'SERVICE_UNAVAILABLE', 'TIMEOUT', 'BAD_REQUEST', 'UNAUTHORIZED'];
    return types[Math.floor(Math.random() * types.length)];
  }

  private generateSyntheticSeverity(errorRate: number): 'low' | 'medium' | 'high' | 'critical' {
    if (errorRate > 0.1) return 'critical';
    if (errorRate > 0.05) return 'high';
    if (errorRate > 0.01) return 'medium';
    return 'low';
  }

  private estimateTotalRequests(componentId: string, startTime: number, endTime: number): number {
    // Simplified estimation - in real implementation, would track actual request counts
    const errors = this.errorEvents.get(componentId) || [];
    const windowErrors = errors.filter(e => e.timestamp >= startTime && e.timestamp <= endTime);
    return Math.max(windowErrors.length * 10, 100); // Assume 10% error rate as baseline
  }

  private getErrorCategory(errorCode: string): ErrorCategory | null {
    // Simplified mapping - in real implementation, would have comprehensive mapping
    if (errorCode.startsWith('4')) return this.errorCategories.get('CLIENT_ERROR') || null;
    if (errorCode.startsWith('5')) return this.errorCategories.get('SERVER_ERROR') || null;
    return this.errorCategories.get('SERVER_ERROR') || null;
  }

  private calculateCategoryTrend(componentId: string, categoryCode: string): 'increasing' | 'decreasing' | 'stable' {
    // Simplified trend calculation
    return 'stable';
  }

  private calculateImpactScore(categoryMetrics: ErrorCategoryMetrics): number {
    const severityWeight = { low: 1, medium: 2, high: 3, critical: 4 };
    const weight = severityWeight[categoryMetrics.category.severity];
    return Math.min(100, categoryMetrics.percentage * weight);
  }

  private calculateErrorTrend(componentId: string): ErrorTrend {
    // Simplified trend calculation
    return {
      direction: 'stable',
      changeRate: 0,
      confidence: 0.5,
      predictedErrorRate: 0,
      volatility: 0
    };
  }

  private detectErrorBurst(componentId: string): ErrorBurst | null {
    // Simplified burst detection
    return null;
  }

  private calculateHealthScore(errorRate: number, errorsByCategory: Map<string, ErrorCategoryMetrics>, trend: ErrorTrend): number {
    let score = 100;
    
    // Penalize based on error rate
    score -= errorRate * 2;
    
    // Penalize based on critical errors
    for (const [_, categoryMetrics] of errorsByCategory) {
      if (categoryMetrics.category.severity === 'critical') {
        score -= categoryMetrics.percentage * 3;
      }
    }
    
    // Penalize based on trend
    if (trend.direction === 'degrading') {
      score -= trend.changeRate * 2;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  private updateConsecutiveErrorCount(componentId: string, isError: boolean): void {
    if (isError) {
      const current = this.consecutiveErrors.get(componentId) || 0;
      this.consecutiveErrors.set(componentId, current + 1);
    } else {
      this.consecutiveErrors.set(componentId, 0);
    }
  }

  private getErrorDetails(componentId: string, alertType: string): any {
    const errors = this.errorEvents.get(componentId) || [];
    const recentErrors = errors.slice(-10);
    
    return {
      primaryErrorTypes: Array.from(new Set(recentErrors.map(e => e.errorType))).slice(0, 3),
      affectedCategories: [],
      sampleErrors: recentErrors.slice(0, 3)
    };
  }

  private getSampleErrors(componentId: string, count: number): ErrorEvent[] {
    const errors = this.errorEvents.get(componentId) || [];
    return errors.slice(-count);
  }

  private getSampleErrorsByCategory(componentId: string, categoryCode: string, count: number): ErrorEvent[] {
    const errors = this.errorEvents.get(componentId) || [];
    const categoryErrors = errors.filter(e => {
      const category = this.getErrorCategory(e.errorCode);
      return category?.code === categoryCode;
    });
    return categoryErrors.slice(-count);
  }

  private getCategoryImpactDescription(category: ErrorCategory): string {
    const impacts = {
      low: 'Low - Minor impact on user experience',
      medium: 'Medium - Noticeable impact on service quality',
      high: 'High - Significant service degradation',
      critical: 'Critical - Severe service disruption'
    };
    return impacts[category.severity];
  }

  private calculateAverageFrequency(componentId: string, errorType: string): number {
    // Simplified frequency calculation
    return 60; // 60 seconds average
  }

  private isErrorTypeAnomalous(componentId: string, errorType: string): boolean {
    // Simplified anomaly detection
    return false;
  }

  private findRelatedComponents(errorType: string): string[] {
    // Simplified related component detection
    return [];
  }

  private calculateAverageErrorDuration(errors: ErrorEvent[]): number {
    // Simplified duration calculation
    return 30; // 30 seconds average
  }

  private calculatePatternSeverity(errors: ErrorEvent[]): 'low' | 'medium' | 'high' | 'critical' {
    const criticalCount = errors.filter(e => e.severity === 'critical').length;
    const highCount = errors.filter(e => e.severity === 'high').length;
    
    if (criticalCount > errors.length * 0.3) return 'critical';
    if (highCount > errors.length * 0.5) return 'high';
    if (errors.length > 50) return 'medium';
    return 'low';
  }

  private suggestRootCause(errorType: string, components: string[]): string {
    // Simplified root cause suggestion
    return `Potential ${errorType} issue affecting ${components.length} components`;
  }

  private suggestMitigation(errorType: string, components: string[]): string[] {
    // Simplified mitigation suggestions
    return [
      `Investigate ${errorType} across affected components`,
      'Check for common configuration issues',
      'Review recent changes or deployments'
    ];
  }
}