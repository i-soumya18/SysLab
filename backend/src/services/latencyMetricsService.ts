/**
 * Latency Metrics Service
 * 
 * Implements SRS FR-7.1: Create p50, p95, p99 latency tracking with histogram 
 * and distribution analysis, and latency trend monitoring
 */

import { EventEmitter } from 'events';
import { ComponentMetrics } from '../types';

export interface LatencyHistogram {
  buckets: LatencyBucket[];
  totalSamples: number;
  minLatency: number;
  maxLatency: number;
  meanLatency: number;
  standardDeviation: number;
}

export interface LatencyBucket {
  lowerBound: number;
  upperBound: number;
  count: number;
  percentage: number;
}

export interface LatencyPercentiles {
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  p99_9: number;
}

export interface LatencyDistribution {
  componentId: string;
  timeWindow: {
    startTime: number;
    endTime: number;
    duration: number;
  };
  percentiles: LatencyPercentiles;
  histogram: LatencyHistogram;
  trendAnalysis: LatencyTrend;
  anomalies: LatencyAnomaly[];
}

export interface LatencyTrend {
  direction: 'improving' | 'degrading' | 'stable';
  changeRate: number; // percentage change per minute
  confidence: number; // 0-1 confidence in trend direction
  predictedLatency: number; // predicted latency in next time window
  seasonality: SeasonalityPattern | null;
}

export interface SeasonalityPattern {
  period: number; // period in milliseconds
  amplitude: number; // amplitude of seasonal variation
  phase: number; // phase offset
  confidence: number; // confidence in seasonal pattern
}

export interface LatencyAnomaly {
  timestamp: number;
  actualLatency: number;
  expectedLatency: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'spike' | 'drop' | 'sustained_high' | 'sustained_low';
  duration: number;
  impact: number; // 0-100 percentage impact
}

export interface LatencyAlert {
  componentId: string;
  timestamp: number;
  alertType: 'threshold_exceeded' | 'trend_degradation' | 'anomaly_detected';
  severity: 'warning' | 'critical';
  message: string;
  currentValue: number;
  threshold: number;
  recommendations: string[];
}

export interface LatencyThresholds {
  p50Warning: number;
  p50Critical: number;
  p95Warning: number;
  p95Critical: number;
  p99Warning: number;
  p99Critical: number;
  trendDegradationThreshold: number; // percentage increase per minute
  anomalyDetectionSensitivity: number; // 0-1, higher = more sensitive
}

export class LatencyMetricsService extends EventEmitter {
  private latencyData: Map<string, number[]> = new Map();
  private latencyDistributions: Map<string, LatencyDistribution[]> = new Map();
  private thresholds: Map<string, LatencyThresholds> = new Map();
  private analysisInterval: number = 30000; // 30 seconds
  private retentionPeriod: number = 3600000; // 1 hour
  private analysisTimer: NodeJS.Timeout | null = null;
  private defaultBuckets: number[] = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

  constructor() {
    super();
    this.startAnalysis();
  }

  /**
   * Record latency measurement for a component
   */
  recordLatency(componentId: string, latency: number, timestamp: number = Date.now()): void {
    if (!this.latencyData.has(componentId)) {
      this.latencyData.set(componentId, []);
    }

    const componentLatencies = this.latencyData.get(componentId)!;
    componentLatencies.push(latency);

    // Clean up old data
    const cutoffTime = timestamp - this.retentionPeriod;
    const filteredLatencies = componentLatencies.filter((_, index) => {
      const dataTimestamp = timestamp - (componentLatencies.length - 1 - index) * 1000; // Approximate timestamp
      return dataTimestamp >= cutoffTime;
    });
    
    this.latencyData.set(componentId, filteredLatencies);

    this.emit('latency_recorded', { componentId, latency, timestamp });
  }

  /**
   * Process component metrics to extract latency data
   */
  processComponentMetrics(metrics: ComponentMetrics): void {
    this.recordLatency(metrics.componentId, metrics.averageLatency, metrics.timestamp);
  }

  /**
   * Calculate latency percentiles for a component
   */
  calculatePercentiles(componentId: string): LatencyPercentiles | null {
    const latencies = this.latencyData.get(componentId);
    if (!latencies || latencies.length === 0) {
      return null;
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    
    return {
      p50: this.percentile(sorted, 0.5),
      p90: this.percentile(sorted, 0.9),
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99),
      p99_9: this.percentile(sorted, 0.999)
    };
  }

  /**
   * Generate latency histogram for a component
   */
  generateHistogram(componentId: string, customBuckets?: number[]): LatencyHistogram | null {
    const latencies = this.latencyData.get(componentId);
    if (!latencies || latencies.length === 0) {
      return null;
    }

    const buckets = customBuckets || this.defaultBuckets;
    const histogramBuckets: LatencyBucket[] = [];
    const totalSamples = latencies.length;
    const minLatency = Math.min(...latencies);
    const maxLatency = Math.max(...latencies);
    const meanLatency = latencies.reduce((sum, lat) => sum + lat, 0) / totalSamples;
    
    // Calculate standard deviation
    const variance = latencies.reduce((sum, lat) => sum + Math.pow(lat - meanLatency, 2), 0) / totalSamples;
    const standardDeviation = Math.sqrt(variance);

    // Create histogram buckets
    for (let i = 0; i < buckets.length; i++) {
      const lowerBound = i === 0 ? 0 : buckets[i - 1];
      const upperBound = buckets[i];
      
      const count = latencies.filter(lat => lat >= lowerBound && lat < upperBound).length;
      const percentage = (count / totalSamples) * 100;

      histogramBuckets.push({
        lowerBound,
        upperBound,
        count,
        percentage
      });
    }

    // Add overflow bucket for values above the highest bucket
    const overflowCount = latencies.filter(lat => lat >= buckets[buckets.length - 1]).length;
    if (overflowCount > 0) {
      histogramBuckets.push({
        lowerBound: buckets[buckets.length - 1],
        upperBound: Infinity,
        count: overflowCount,
        percentage: (overflowCount / totalSamples) * 100
      });
    }

    return {
      buckets: histogramBuckets,
      totalSamples,
      minLatency,
      maxLatency,
      meanLatency,
      standardDeviation
    };
  }

  /**
   * Analyze latency trends for a component
   */
  analyzeTrends(componentId: string): LatencyTrend | null {
    const latencies = this.latencyData.get(componentId);
    if (!latencies || latencies.length < 10) {
      return null;
    }

    // Simple linear regression for trend analysis
    const n = latencies.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = latencies;

    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate correlation coefficient for confidence
    const meanX = sumX / n;
    const meanY = sumY / n;
    const numerator = x.reduce((sum, val, i) => sum + (val - meanX) * (y[i] - meanY), 0);
    const denomX = Math.sqrt(x.reduce((sum, val) => sum + Math.pow(val - meanX, 2), 0));
    const denomY = Math.sqrt(y.reduce((sum, val) => sum + Math.pow(val - meanY, 2), 0));
    const correlation = numerator / (denomX * denomY);
    const confidence = Math.abs(correlation);

    // Determine trend direction
    let direction: 'improving' | 'degrading' | 'stable';
    const changeRate = (slope / meanY) * 100 * 60; // percentage change per minute

    if (Math.abs(changeRate) < 1) {
      direction = 'stable';
    } else if (changeRate > 0) {
      direction = 'degrading';
    } else {
      direction = 'improving';
    }

    // Predict next value
    const predictedLatency = slope * n + intercept;

    // Detect seasonality (simplified)
    const seasonality = this.detectSeasonality(latencies);

    return {
      direction,
      changeRate: Math.abs(changeRate),
      confidence,
      predictedLatency: Math.max(0, predictedLatency),
      seasonality
    };
  }

  /**
   * Detect anomalies in latency data
   */
  detectAnomalies(componentId: string): LatencyAnomaly[] {
    const latencies = this.latencyData.get(componentId);
    if (!latencies || latencies.length < 20) {
      return [];
    }

    const anomalies: LatencyAnomaly[] = [];
    const windowSize = Math.min(20, Math.floor(latencies.length / 4));
    
    // Calculate rolling statistics
    for (let i = windowSize; i < latencies.length; i++) {
      const window = latencies.slice(i - windowSize, i);
      const mean = window.reduce((sum, val) => sum + val, 0) / window.length;
      const variance = window.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / window.length;
      const stdDev = Math.sqrt(variance);
      
      const currentLatency = latencies[i];
      const zScore = Math.abs((currentLatency - mean) / stdDev);
      
      // Detect anomalies using z-score threshold
      if (zScore > 3) {
        const severity = this.classifyAnomalySeverity(zScore);
        const type = this.classifyAnomalyType(currentLatency, mean, latencies, i);
        
        anomalies.push({
          timestamp: Date.now() - (latencies.length - 1 - i) * 1000, // Approximate timestamp
          actualLatency: currentLatency,
          expectedLatency: mean,
          severity,
          type,
          duration: 1000, // Simplified - would need more sophisticated duration calculation
          impact: Math.min(100, zScore * 10)
        });
      }
    }

    return anomalies;
  }

  /**
   * Get current latency distribution for a component
   */
  getLatencyDistribution(componentId: string): LatencyDistribution | null {
    const percentiles = this.calculatePercentiles(componentId);
    const histogram = this.generateHistogram(componentId);
    const trendAnalysis = this.analyzeTrends(componentId);
    const anomalies = this.detectAnomalies(componentId);

    if (!percentiles || !histogram || !trendAnalysis) {
      return null;
    }

    const now = Date.now();
    return {
      componentId,
      timeWindow: {
        startTime: now - this.analysisInterval,
        endTime: now,
        duration: this.analysisInterval
      },
      percentiles,
      histogram,
      trendAnalysis,
      anomalies
    };
  }

  /**
   * Set latency thresholds for a component
   */
  setThresholds(componentId: string, thresholds: LatencyThresholds): void {
    this.thresholds.set(componentId, thresholds);
    this.emit('thresholds_updated', { componentId, thresholds });
  }

  /**
   * Get latency thresholds for a component
   */
  getThresholds(componentId: string): LatencyThresholds | null {
    return this.thresholds.get(componentId) || null;
  }

  /**
   * Check for latency alerts
   */
  checkAlerts(componentId: string): LatencyAlert[] {
    const thresholds = this.thresholds.get(componentId);
    const distribution = this.getLatencyDistribution(componentId);
    
    if (!thresholds || !distribution) {
      return [];
    }

    const alerts: LatencyAlert[] = [];
    const now = Date.now();

    // Check percentile thresholds
    const { percentiles, trendAnalysis, anomalies } = distribution;

    // P50 alerts
    if (percentiles.p50 > thresholds.p50Critical) {
      alerts.push({
        componentId,
        timestamp: now,
        alertType: 'threshold_exceeded',
        severity: 'critical',
        message: `P50 latency (${percentiles.p50.toFixed(2)}ms) exceeds critical threshold (${thresholds.p50Critical}ms)`,
        currentValue: percentiles.p50,
        threshold: thresholds.p50Critical,
        recommendations: [
          'Check component resource utilization',
          'Review recent configuration changes',
          'Consider horizontal scaling'
        ]
      });
    } else if (percentiles.p50 > thresholds.p50Warning) {
      alerts.push({
        componentId,
        timestamp: now,
        alertType: 'threshold_exceeded',
        severity: 'warning',
        message: `P50 latency (${percentiles.p50.toFixed(2)}ms) exceeds warning threshold (${thresholds.p50Warning}ms)`,
        currentValue: percentiles.p50,
        threshold: thresholds.p50Warning,
        recommendations: [
          'Monitor component performance closely',
          'Review traffic patterns'
        ]
      });
    }

    // P95 alerts
    if (percentiles.p95 > thresholds.p95Critical) {
      alerts.push({
        componentId,
        timestamp: now,
        alertType: 'threshold_exceeded',
        severity: 'critical',
        message: `P95 latency (${percentiles.p95.toFixed(2)}ms) exceeds critical threshold (${thresholds.p95Critical}ms)`,
        currentValue: percentiles.p95,
        threshold: thresholds.p95Critical,
        recommendations: [
          'Immediate investigation required',
          'Check for system bottlenecks',
          'Consider emergency scaling'
        ]
      });
    } else if (percentiles.p95 > thresholds.p95Warning) {
      alerts.push({
        componentId,
        timestamp: now,
        alertType: 'threshold_exceeded',
        severity: 'warning',
        message: `P95 latency (${percentiles.p95.toFixed(2)}ms) exceeds warning threshold (${thresholds.p95Warning}ms)`,
        currentValue: percentiles.p95,
        threshold: thresholds.p95Warning,
        recommendations: [
          'Monitor tail latency closely',
          'Review slow queries or operations'
        ]
      });
    }

    // P99 alerts
    if (percentiles.p99 > thresholds.p99Critical) {
      alerts.push({
        componentId,
        timestamp: now,
        alertType: 'threshold_exceeded',
        severity: 'critical',
        message: `P99 latency (${percentiles.p99.toFixed(2)}ms) exceeds critical threshold (${thresholds.p99Critical}ms)`,
        currentValue: percentiles.p99,
        threshold: thresholds.p99Critical,
        recommendations: [
          'Critical tail latency issue detected',
          'Check for outlier requests',
          'Review timeout configurations'
        ]
      });
    } else if (percentiles.p99 > thresholds.p99Warning) {
      alerts.push({
        componentId,
        timestamp: now,
        alertType: 'threshold_exceeded',
        severity: 'warning',
        message: `P99 latency (${percentiles.p99.toFixed(2)}ms) exceeds warning threshold (${thresholds.p99Warning}ms)`,
        currentValue: percentiles.p99,
        threshold: thresholds.p99Warning,
        recommendations: [
          'Monitor tail latency trends',
          'Investigate slow operations'
        ]
      });
    }

    // Trend degradation alerts
    if (trendAnalysis.direction === 'degrading' && 
        trendAnalysis.changeRate > thresholds.trendDegradationThreshold &&
        trendAnalysis.confidence > 0.7) {
      alerts.push({
        componentId,
        timestamp: now,
        alertType: 'trend_degradation',
        severity: trendAnalysis.changeRate > thresholds.trendDegradationThreshold * 2 ? 'critical' : 'warning',
        message: `Latency trend degrading at ${trendAnalysis.changeRate.toFixed(2)}% per minute`,
        currentValue: trendAnalysis.changeRate,
        threshold: thresholds.trendDegradationThreshold,
        recommendations: [
          'Investigate root cause of performance degradation',
          'Check for resource constraints',
          'Review recent deployments or changes'
        ]
      });
    }

    // Anomaly alerts
    const criticalAnomalies = anomalies.filter(a => a.severity === 'critical' || a.severity === 'high');
    if (criticalAnomalies.length > 0) {
      alerts.push({
        componentId,
        timestamp: now,
        alertType: 'anomaly_detected',
        severity: 'critical',
        message: `${criticalAnomalies.length} critical latency anomalies detected`,
        currentValue: criticalAnomalies[0].actualLatency,
        threshold: criticalAnomalies[0].expectedLatency,
        recommendations: [
          'Investigate anomalous latency spikes',
          'Check for system instability',
          'Review error logs for correlation'
        ]
      });
    }

    return alerts;
  }

  /**
   * Get all component IDs with latency data
   */
  getComponentIds(): string[] {
    return Array.from(this.latencyData.keys());
  }

  /**
   * Clear latency data for a component
   */
  clearComponentData(componentId: string): void {
    this.latencyData.delete(componentId);
    this.latencyDistributions.delete(componentId);
    this.thresholds.delete(componentId);
    this.emit('component_data_cleared', { componentId });
  }

  /**
   * Clear all latency data
   */
  clearAllData(): void {
    this.latencyData.clear();
    this.latencyDistributions.clear();
    this.thresholds.clear();
    this.emit('all_data_cleared');
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
      const distribution = this.getLatencyDistribution(componentId);
      if (distribution) {
        // Store distribution history
        if (!this.latencyDistributions.has(componentId)) {
          this.latencyDistributions.set(componentId, []);
        }
        
        const distributions = this.latencyDistributions.get(componentId)!;
        distributions.push(distribution);
        
        // Keep only recent distributions
        const maxDistributions = Math.floor(this.retentionPeriod / this.analysisInterval);
        if (distributions.length > maxDistributions) {
          distributions.splice(0, distributions.length - maxDistributions);
        }
        
        // Check for alerts
        const alerts = this.checkAlerts(componentId);
        if (alerts.length > 0) {
          this.emit('alerts_generated', { componentId, alerts });
        }
        
        this.emit('analysis_completed', { componentId, distribution });
      }
    }
  }

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.ceil(sortedArray.length * percentile) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  /**
   * Detect seasonality in latency data (simplified implementation)
   */
  private detectSeasonality(latencies: number[]): SeasonalityPattern | null {
    if (latencies.length < 100) return null;
    
    // Simple autocorrelation-based seasonality detection
    // In production, would use more sophisticated methods like FFT
    const maxLag = Math.min(50, Math.floor(latencies.length / 4));
    let bestPeriod = 0;
    let bestCorrelation = 0;
    
    for (let lag = 2; lag <= maxLag; lag++) {
      const correlation = this.calculateAutocorrelation(latencies, lag);
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestPeriod = lag;
      }
    }
    
    if (bestCorrelation > 0.3) {
      return {
        period: bestPeriod * 1000, // Convert to milliseconds
        amplitude: this.calculateSeasonalAmplitude(latencies, bestPeriod),
        phase: 0, // Simplified
        confidence: bestCorrelation
      };
    }
    
    return null;
  }

  /**
   * Calculate autocorrelation for seasonality detection
   */
  private calculateAutocorrelation(data: number[], lag: number): number {
    if (lag >= data.length) return 0;
    
    const n = data.length - lag;
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      numerator += (data[i] - mean) * (data[i + lag] - mean);
    }
    
    for (let i = 0; i < data.length; i++) {
      denominator += Math.pow(data[i] - mean, 2);
    }
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Calculate seasonal amplitude
   */
  private calculateSeasonalAmplitude(data: number[], period: number): number {
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    let maxDeviation = 0;
    
    for (let i = 0; i < data.length; i++) {
      const deviation = Math.abs(data[i] - mean);
      maxDeviation = Math.max(maxDeviation, deviation);
    }
    
    return maxDeviation;
  }

  /**
   * Classify anomaly severity based on z-score
   */
  private classifyAnomalySeverity(zScore: number): 'low' | 'medium' | 'high' | 'critical' {
    if (zScore > 5) return 'critical';
    if (zScore > 4) return 'high';
    if (zScore > 3.5) return 'medium';
    return 'low';
  }

  /**
   * Classify anomaly type based on context
   */
  private classifyAnomalyType(
    currentLatency: number, 
    expectedLatency: number, 
    latencies: number[], 
    index: number
  ): 'spike' | 'drop' | 'sustained_high' | 'sustained_low' {
    const isHigh = currentLatency > expectedLatency;
    
    // Check if this is part of a sustained pattern
    const windowSize = 5;
    const start = Math.max(0, index - windowSize);
    const end = Math.min(latencies.length, index + windowSize);
    const window = latencies.slice(start, end);
    
    const sustainedCount = window.filter(lat => 
      isHigh ? lat > expectedLatency * 1.5 : lat < expectedLatency * 0.5
    ).length;
    
    const isSustained = sustainedCount > windowSize * 0.6;
    
    if (isHigh) {
      return isSustained ? 'sustained_high' : 'spike';
    } else {
      return isSustained ? 'sustained_low' : 'drop';
    }
  }
}