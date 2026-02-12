/**
 * Throughput Monitoring Service
 * 
 * Implements SRS FR-7.3: Implement throughput measurement and tracking with 
 * throughput trend analysis and throughput capacity planning
 */

import { EventEmitter } from 'events';
import { ComponentMetrics } from '../types';

export interface ThroughputMetrics {
  componentId: string;
  timeWindow: {
    startTime: number;
    endTime: number;
    duration: number;
  };
  currentThroughput: number; // requests per second
  averageThroughput: number;
  peakThroughput: number;
  minThroughput: number;
  throughputPercentiles: ThroughputPercentiles;
  throughputTrend: ThroughputTrend;
  capacityAnalysis: CapacityAnalysis;
  throughputDistribution: ThroughputDistribution;
  bottleneckAnalysis: BottleneckAnalysis;
  performanceScore: number; // 0-100 based on throughput efficiency
}

export interface ThroughputPercentiles {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface ThroughputTrend {
  direction: 'increasing' | 'decreasing' | 'stable';
  changeRate: number; // percentage change per minute
  confidence: number; // 0-1 confidence in trend
  predictedThroughput: number; // predicted throughput in next window
  volatility: number; // measure of throughput stability (0-1)
  seasonality: SeasonalityInfo | null;
  growthPattern: GrowthPattern;
}

export interface SeasonalityInfo {
  period: number; // period in milliseconds
  amplitude: number; // amplitude of seasonal variation
  phase: number; // phase offset
  confidence: number; // confidence in seasonal pattern
  peakHours: number[]; // hours of day with peak throughput
  lowHours: number[]; // hours of day with low throughput
}

export interface GrowthPattern {
  type: 'linear' | 'exponential' | 'logarithmic' | 'cyclical' | 'irregular';
  growthRate: number; // rate of growth (requests/second per minute)
  acceleration: number; // rate of change of growth rate
  sustainabilityScore: number; // 0-100, how sustainable is current growth
}

export interface CapacityAnalysis {
  currentCapacity: number; // maximum observed throughput
  theoreticalCapacity: number; // theoretical maximum based on configuration
  utilizationPercentage: number; // current utilization of capacity
  headroom: number; // remaining capacity
  timeToCapacity: number | null; // estimated time until capacity reached (minutes)
  capacityConstraints: CapacityConstraint[];
  scalingRecommendations: ScalingRecommendation[];
}

export interface CapacityConstraint {
  type: 'cpu' | 'memory' | 'network' | 'storage' | 'connection_pool' | 'queue_depth';
  currentUtilization: number; // 0-100 percentage
  threshold: number; // threshold percentage for constraint
  severity: 'low' | 'medium' | 'high' | 'critical';
  impact: string; // description of impact on throughput
  recommendation: string;
}

export interface ScalingRecommendation {
  type: 'horizontal' | 'vertical' | 'configuration';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  description: string;
  expectedImpact: number; // expected throughput increase (percentage)
  cost: 'low' | 'medium' | 'high';
  complexity: 'low' | 'medium' | 'high';
  timeframe: string; // estimated implementation time
}

export interface ThroughputDistribution {
  histogram: ThroughputBucket[];
  mean: number;
  median: number;
  mode: number;
  standardDeviation: number;
  skewness: number; // measure of asymmetry
  kurtosis: number; // measure of tail heaviness
}

export interface ThroughputBucket {
  lowerBound: number;
  upperBound: number;
  count: number;
  percentage: number;
  cumulativePercentage: number;
}

export interface BottleneckAnalysis {
  isBottlenecked: boolean;
  bottleneckType: 'none' | 'resource' | 'configuration' | 'external' | 'design';
  bottleneckSeverity: 'none' | 'minor' | 'moderate' | 'severe' | 'critical';
  limitingFactor: string;
  impactOnThroughput: number; // percentage reduction from optimal
  rootCause: string;
  recommendations: string[];
  estimatedResolutionTime: string;
}

export interface ThroughputAlert {
  componentId: string;
  timestamp: number;
  alertType: 'capacity_warning' | 'capacity_critical' | 'throughput_drop' | 'bottleneck_detected' | 'trend_degradation';
  severity: 'warning' | 'critical';
  message: string;
  currentValue: number;
  threshold: number;
  trend: string;
  recommendations: string[];
  estimatedImpact: string;
}

export interface ThroughputThresholds {
  minThroughputWarning: number; // minimum acceptable throughput
  minThroughputCritical: number;
  capacityWarningPercentage: number; // percentage of capacity that triggers warning
  capacityWarningCritical: number;
  throughputDropPercentage: number; // percentage drop that triggers alert
  trendDegradationThreshold: number; // percentage decrease per minute
  volatilityThreshold: number; // volatility level that triggers alert
}

export interface ThroughputForecast {
  componentId: string;
  forecastHorizon: number; // minutes into the future
  predictedThroughput: ThroughputPrediction[];
  confidence: number; // 0-1 confidence in forecast
  assumptions: string[];
  risks: string[];
}

export interface ThroughputPrediction {
  timestamp: number;
  predictedValue: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  factors: string[]; // factors influencing this prediction
}

export class ThroughputMonitoringService extends EventEmitter {
  private throughputData: Map<string, number[]> = new Map();
  private throughputTimestamps: Map<string, number[]> = new Map();
  private throughputMetrics: Map<string, ThroughputMetrics[]> = new Map();
  private thresholds: Map<string, ThroughputThresholds> = new Map();
  private analysisInterval: number = 30000; // 30 seconds
  private retentionPeriod: number = 3600000; // 1 hour
  private analysisTimer: NodeJS.Timeout | null = null;
  private capacityConfigurations: Map<string, any> = new Map();

  constructor() {
    super();
    this.startAnalysis();
  }

  /**
   * Record throughput measurement for a component
   */
  recordThroughput(componentId: string, throughput: number, timestamp: number = Date.now()): void {
    if (!this.throughputData.has(componentId)) {
      this.throughputData.set(componentId, []);
      this.throughputTimestamps.set(componentId, []);
    }

    const componentThroughput = this.throughputData.get(componentId)!;
    const componentTimestamps = this.throughputTimestamps.get(componentId)!;
    
    componentThroughput.push(throughput);
    componentTimestamps.push(timestamp);

    // Clean up old data
    const cutoffTime = timestamp - this.retentionPeriod;
    const validIndices = componentTimestamps
      .map((ts, index) => ({ ts, index }))
      .filter(item => item.ts >= cutoffTime)
      .map(item => item.index);

    if (validIndices.length < componentThroughput.length) {
      const filteredThroughput = validIndices.map(i => componentThroughput[i]);
      const filteredTimestamps = validIndices.map(i => componentTimestamps[i]);
      
      this.throughputData.set(componentId, filteredThroughput);
      this.throughputTimestamps.set(componentId, filteredTimestamps);
    }

    this.emit('throughput_recorded', { componentId, throughput, timestamp });
  }

  /**
   * Process component metrics to extract throughput data
   */
  processComponentMetrics(metrics: ComponentMetrics): void {
    this.recordThroughput(metrics.componentId, metrics.requestsPerSecond, metrics.timestamp);
  }

  /**
   * Calculate comprehensive throughput metrics for a component
   */
  calculateThroughputMetrics(componentId: string): ThroughputMetrics | null {
    const throughputData = this.throughputData.get(componentId);
    const timestamps = this.throughputTimestamps.get(componentId);
    
    if (!throughputData || !timestamps || throughputData.length === 0) {
      return null;
    }

    const now = Date.now();
    const windowStart = now - this.analysisInterval;
    
    // Filter data for current window
    const windowIndices = timestamps
      .map((ts, index) => ({ ts, index }))
      .filter(item => item.ts >= windowStart)
      .map(item => item.index);

    if (windowIndices.length === 0) {
      return null;
    }

    const windowThroughput = windowIndices.map(i => throughputData[i]);
    const windowTimestamps = windowIndices.map(i => timestamps[i]);

    // Basic metrics
    const currentThroughput = windowThroughput[windowThroughput.length - 1];
    const averageThroughput = windowThroughput.reduce((sum, val) => sum + val, 0) / windowThroughput.length;
    const peakThroughput = Math.max(...windowThroughput);
    const minThroughput = Math.min(...windowThroughput);

    // Calculate percentiles
    const sortedThroughput = [...windowThroughput].sort((a, b) => a - b);
    const throughputPercentiles = this.calculatePercentiles(sortedThroughput);

    // Analyze trends
    const throughputTrend = this.analyzeThroughputTrend(componentId, throughputData, timestamps);

    // Capacity analysis
    const capacityAnalysis = this.analyzeCapacity(componentId, windowThroughput, throughputTrend);

    // Distribution analysis
    const throughputDistribution = this.analyzeThroughputDistribution(windowThroughput);

    // Bottleneck analysis
    const bottleneckAnalysis = this.analyzeBottlenecks(componentId, currentThroughput, capacityAnalysis);

    // Performance score
    const performanceScore = this.calculatePerformanceScore(
      currentThroughput, 
      capacityAnalysis, 
      throughputTrend, 
      bottleneckAnalysis
    );

    return {
      componentId,
      timeWindow: {
        startTime: windowStart,
        endTime: now,
        duration: this.analysisInterval
      },
      currentThroughput,
      averageThroughput,
      peakThroughput,
      minThroughput,
      throughputPercentiles,
      throughputTrend,
      capacityAnalysis,
      throughputDistribution,
      bottleneckAnalysis,
      performanceScore
    };
  }

  /**
   * Set capacity configuration for a component
   */
  setCapacityConfiguration(componentId: string, config: any): void {
    this.capacityConfigurations.set(componentId, config);
    this.emit('capacity_configuration_updated', { componentId, config });
  }

  /**
   * Set throughput thresholds for a component
   */
  setThresholds(componentId: string, thresholds: ThroughputThresholds): void {
    this.thresholds.set(componentId, thresholds);
    this.emit('thresholds_updated', { componentId, thresholds });
  }

  /**
   * Generate throughput forecast
   */
  generateForecast(componentId: string, horizonMinutes: number = 60): ThroughputForecast | null {
    const throughputData = this.throughputData.get(componentId);
    const timestamps = this.throughputTimestamps.get(componentId);
    
    if (!throughputData || !timestamps || throughputData.length < 10) {
      return null;
    }

    const predictions: ThroughputPrediction[] = [];
    const now = Date.now();
    const intervalMs = 60000; // 1 minute intervals
    
    // Simple linear regression for trend
    const trend = this.analyzeThroughputTrend(componentId, throughputData, timestamps);
    const baseValue = throughputData[throughputData.length - 1];
    
    for (let i = 1; i <= horizonMinutes; i++) {
      const futureTimestamp = now + (i * intervalMs);
      let predictedValue = baseValue;
      
      // Apply trend
      if (trend.direction === 'increasing') {
        predictedValue += (trend.changeRate / 100) * baseValue * i;
      } else if (trend.direction === 'decreasing') {
        predictedValue -= (trend.changeRate / 100) * baseValue * i;
      }
      
      // Apply seasonality if detected
      if (trend.seasonality) {
        const seasonalFactor = Math.sin(
          (2 * Math.PI * futureTimestamp) / trend.seasonality.period + trend.seasonality.phase
        );
        predictedValue += seasonalFactor * trend.seasonality.amplitude;
      }
      
      // Ensure non-negative
      predictedValue = Math.max(0, predictedValue);
      
      // Calculate confidence interval (simplified)
      const uncertainty = trend.volatility * predictedValue * 0.2;
      
      predictions.push({
        timestamp: futureTimestamp,
        predictedValue,
        confidenceInterval: {
          lower: Math.max(0, predictedValue - uncertainty),
          upper: predictedValue + uncertainty
        },
        factors: this.identifyPredictionFactors(trend)
      });
    }

    return {
      componentId,
      forecastHorizon: horizonMinutes,
      predictedThroughput: predictions,
      confidence: Math.max(0.3, 1 - trend.volatility), // Higher volatility = lower confidence
      assumptions: [
        'Current trend continues',
        'No major system changes',
        'Historical patterns remain valid'
      ],
      risks: [
        'Unexpected traffic spikes',
        'System capacity limits',
        'External dependencies'
      ]
    };
  }

  /**
   * Check for throughput alerts
   */
  checkAlerts(componentId: string): ThroughputAlert[] {
    const thresholds = this.thresholds.get(componentId);
    const metrics = this.calculateThroughputMetrics(componentId);
    
    if (!thresholds || !metrics) {
      return [];
    }

    const alerts: ThroughputAlert[] = [];
    const now = Date.now();

    // Minimum throughput alerts
    if (metrics.currentThroughput < thresholds.minThroughputCritical) {
      alerts.push({
        componentId,
        timestamp: now,
        alertType: 'throughput_drop',
        severity: 'critical',
        message: `Throughput (${metrics.currentThroughput.toFixed(2)} req/s) below critical minimum (${thresholds.minThroughputCritical} req/s)`,
        currentValue: metrics.currentThroughput,
        threshold: thresholds.minThroughputCritical,
        trend: `${metrics.throughputTrend.direction} at ${metrics.throughputTrend.changeRate.toFixed(2)}%/min`,
        recommendations: [
          'Immediate investigation required',
          'Check for system failures or bottlenecks',
          'Review error rates and latency',
          'Consider emergency scaling'
        ],
        estimatedImpact: 'Critical - Service severely degraded'
      });
    } else if (metrics.currentThroughput < thresholds.minThroughputWarning) {
      alerts.push({
        componentId,
        timestamp: now,
        alertType: 'throughput_drop',
        severity: 'warning',
        message: `Throughput (${metrics.currentThroughput.toFixed(2)} req/s) below warning minimum (${thresholds.minThroughputWarning} req/s)`,
        currentValue: metrics.currentThroughput,
        threshold: thresholds.minThroughputWarning,
        trend: `${metrics.throughputTrend.direction} at ${metrics.throughputTrend.changeRate.toFixed(2)}%/min`,
        recommendations: [
          'Monitor throughput closely',
          'Check for performance degradation',
          'Review system health metrics'
        ],
        estimatedImpact: 'Medium - Service performance below expectations'
      });
    }

    // Capacity alerts
    if (metrics.capacityAnalysis.utilizationPercentage > thresholds.capacityWarningCritical) {
      alerts.push({
        componentId,
        timestamp: now,
        alertType: 'capacity_critical',
        severity: 'critical',
        message: `Capacity utilization (${metrics.capacityAnalysis.utilizationPercentage.toFixed(1)}%) exceeds critical threshold (${thresholds.capacityWarningCritical}%)`,
        currentValue: metrics.capacityAnalysis.utilizationPercentage,
        threshold: thresholds.capacityWarningCritical,
        trend: `Time to capacity: ${metrics.capacityAnalysis.timeToCapacity ? `${metrics.capacityAnalysis.timeToCapacity.toFixed(0)} minutes` : 'unknown'}`,
        recommendations: [
          'Immediate scaling required',
          'Implement load shedding if necessary',
          'Review capacity constraints',
          ...metrics.capacityAnalysis.scalingRecommendations
            .filter(r => r.priority === 'urgent' || r.priority === 'high')
            .map(r => r.description)
        ],
        estimatedImpact: 'Critical - Service at risk of overload'
      });
    } else if (metrics.capacityAnalysis.utilizationPercentage > thresholds.capacityWarningPercentage) {
      alerts.push({
        componentId,
        timestamp: now,
        alertType: 'capacity_warning',
        severity: 'warning',
        message: `Capacity utilization (${metrics.capacityAnalysis.utilizationPercentage.toFixed(1)}%) exceeds warning threshold (${thresholds.capacityWarningPercentage}%)`,
        currentValue: metrics.capacityAnalysis.utilizationPercentage,
        threshold: thresholds.capacityWarningPercentage,
        trend: `Time to capacity: ${metrics.capacityAnalysis.timeToCapacity ? `${metrics.capacityAnalysis.timeToCapacity.toFixed(0)} minutes` : 'unknown'}`,
        recommendations: [
          'Plan for capacity scaling',
          'Monitor utilization trends',
          'Review scaling policies',
          ...metrics.capacityAnalysis.scalingRecommendations
            .filter(r => r.priority === 'medium' || r.priority === 'high')
            .map(r => r.description)
        ],
        estimatedImpact: 'Medium - Approaching capacity limits'
      });
    }

    // Bottleneck alerts
    if (metrics.bottleneckAnalysis.isBottlenecked && 
        (metrics.bottleneckAnalysis.bottleneckSeverity === 'severe' || 
         metrics.bottleneckAnalysis.bottleneckSeverity === 'critical')) {
      alerts.push({
        componentId,
        timestamp: now,
        alertType: 'bottleneck_detected',
        severity: metrics.bottleneckAnalysis.bottleneckSeverity === 'critical' ? 'critical' : 'warning',
        message: `${metrics.bottleneckAnalysis.bottleneckSeverity} bottleneck detected: ${metrics.bottleneckAnalysis.limitingFactor}`,
        currentValue: metrics.bottleneckAnalysis.impactOnThroughput,
        threshold: 20, // 20% impact threshold
        trend: metrics.bottleneckAnalysis.rootCause,
        recommendations: metrics.bottleneckAnalysis.recommendations,
        estimatedImpact: `${metrics.bottleneckAnalysis.impactOnThroughput.toFixed(1)}% throughput reduction`
      });
    }

    // Trend degradation alerts
    if (metrics.throughputTrend.direction === 'decreasing' && 
        metrics.throughputTrend.changeRate > thresholds.trendDegradationThreshold &&
        metrics.throughputTrend.confidence > 0.7) {
      alerts.push({
        componentId,
        timestamp: now,
        alertType: 'trend_degradation',
        severity: metrics.throughputTrend.changeRate > thresholds.trendDegradationThreshold * 2 ? 'critical' : 'warning',
        message: `Throughput trending downward at ${metrics.throughputTrend.changeRate.toFixed(2)}% per minute`,
        currentValue: metrics.throughputTrend.changeRate,
        threshold: thresholds.trendDegradationThreshold,
        trend: `Predicted throughput: ${metrics.throughputTrend.predictedThroughput.toFixed(2)} req/s`,
        recommendations: [
          'Investigate cause of throughput degradation',
          'Check for resource constraints',
          'Review recent changes or deployments',
          'Monitor error rates and latency'
        ],
        estimatedImpact: 'Progressive throughput degradation'
      });
    }

    return alerts;
  }

  /**
   * Get component IDs with throughput data
   */
  getComponentIds(): string[] {
    return Array.from(this.throughputData.keys());
  }

  /**
   * Clear throughput data for a component
   */
  clearComponentData(componentId: string): void {
    this.throughputData.delete(componentId);
    this.throughputTimestamps.delete(componentId);
    this.throughputMetrics.delete(componentId);
    this.thresholds.delete(componentId);
    this.capacityConfigurations.delete(componentId);
    this.emit('component_data_cleared', { componentId });
  }

  /**
   * Calculate percentiles from sorted array
   */
  private calculatePercentiles(sortedArray: number[]): ThroughputPercentiles {
    if (sortedArray.length === 0) {
      return { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 };
    }

    const percentile = (arr: number[], p: number) => {
      const index = Math.ceil(arr.length * p) - 1;
      return arr[Math.max(0, Math.min(index, arr.length - 1))];
    };

    return {
      p10: percentile(sortedArray, 0.1),
      p25: percentile(sortedArray, 0.25),
      p50: percentile(sortedArray, 0.5),
      p75: percentile(sortedArray, 0.75),
      p90: percentile(sortedArray, 0.9),
      p95: percentile(sortedArray, 0.95),
      p99: percentile(sortedArray, 0.99)
    };
  }

  /**
   * Analyze throughput trend
   */
  private analyzeThroughputTrend(componentId: string, throughputData: number[], timestamps: number[]): ThroughputTrend {
    if (throughputData.length < 5) {
      return {
        direction: 'stable',
        changeRate: 0,
        confidence: 0,
        predictedThroughput: throughputData[throughputData.length - 1] || 0,
        volatility: 0,
        seasonality: null,
        growthPattern: {
          type: 'irregular',
          growthRate: 0,
          acceleration: 0,
          sustainabilityScore: 50
        }
      };
    }

    // Simple linear regression
    const n = throughputData.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = throughputData;

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

    // Determine direction
    let direction: 'increasing' | 'decreasing' | 'stable';
    const changeRate = (slope / meanY) * 100 * 60; // percentage change per minute

    if (Math.abs(changeRate) < 1) {
      direction = 'stable';
    } else if (changeRate > 0) {
      direction = 'increasing';
    } else {
      direction = 'decreasing';
    }

    // Calculate volatility
    const variance = y.reduce((sum, val) => sum + Math.pow(val - meanY, 2), 0) / n;
    const volatility = Math.sqrt(variance) / meanY;

    // Predict next value
    const predictedThroughput = Math.max(0, slope * n + intercept);

    // Detect seasonality (simplified)
    const seasonality = this.detectSeasonality(throughputData, timestamps);

    // Analyze growth pattern
    const growthPattern = this.analyzeGrowthPattern(throughputData, slope, changeRate);

    return {
      direction,
      changeRate: Math.abs(changeRate),
      confidence,
      predictedThroughput,
      volatility: Math.min(1, volatility),
      seasonality,
      growthPattern
    };
  }

  /**
   * Analyze capacity utilization
   */
  private analyzeCapacity(componentId: string, throughputData: number[], trend: ThroughputTrend): CapacityAnalysis {
    const config = this.capacityConfigurations.get(componentId);
    const currentThroughput = throughputData[throughputData.length - 1];
    const peakThroughput = Math.max(...throughputData);
    
    // Estimate theoretical capacity (simplified)
    const theoreticalCapacity = config?.maxThroughput || peakThroughput * 1.5;
    const currentCapacity = peakThroughput;
    const utilizationPercentage = (currentThroughput / theoreticalCapacity) * 100;
    const headroom = theoreticalCapacity - currentThroughput;

    // Estimate time to capacity
    let timeToCapacity: number | null = null;
    if (trend.direction === 'increasing' && trend.changeRate > 0) {
      const remainingCapacity = theoreticalCapacity - currentThroughput;
      const growthRate = (trend.changeRate / 100) * currentThroughput / 60; // per minute
      if (growthRate > 0) {
        timeToCapacity = remainingCapacity / growthRate;
      }
    }

    // Identify capacity constraints (simplified)
    const capacityConstraints: CapacityConstraint[] = [
      {
        type: 'cpu',
        currentUtilization: Math.min(100, utilizationPercentage * 0.8),
        threshold: 80,
        severity: utilizationPercentage > 90 ? 'critical' : utilizationPercentage > 70 ? 'high' : 'medium',
        impact: 'CPU utilization affects request processing speed',
        recommendation: 'Consider vertical scaling or CPU optimization'
      },
      {
        type: 'memory',
        currentUtilization: Math.min(100, utilizationPercentage * 0.7),
        threshold: 85,
        severity: utilizationPercentage > 85 ? 'high' : 'medium',
        impact: 'Memory pressure can cause garbage collection delays',
        recommendation: 'Monitor memory usage and consider scaling'
      }
    ];

    // Generate scaling recommendations
    const scalingRecommendations: ScalingRecommendation[] = [];
    
    if (utilizationPercentage > 80) {
      scalingRecommendations.push({
        type: 'horizontal',
        priority: utilizationPercentage > 90 ? 'urgent' : 'high',
        description: 'Add more instances to distribute load',
        expectedImpact: 50,
        cost: 'medium',
        complexity: 'low',
        timeframe: '5-15 minutes'
      });
    }

    if (utilizationPercentage > 70) {
      scalingRecommendations.push({
        type: 'vertical',
        priority: 'medium',
        description: 'Increase instance size for better performance',
        expectedImpact: 30,
        cost: 'medium',
        complexity: 'medium',
        timeframe: '10-30 minutes'
      });
    }

    return {
      currentCapacity,
      theoreticalCapacity,
      utilizationPercentage,
      headroom,
      timeToCapacity,
      capacityConstraints,
      scalingRecommendations
    };
  }

  /**
   * Analyze throughput distribution
   */
  private analyzeThroughputDistribution(throughputData: number[]): ThroughputDistribution {
    if (throughputData.length === 0) {
      return {
        histogram: [],
        mean: 0,
        median: 0,
        mode: 0,
        standardDeviation: 0,
        skewness: 0,
        kurtosis: 0
      };
    }

    const sorted = [...throughputData].sort((a, b) => a - b);
    const mean = throughputData.reduce((sum, val) => sum + val, 0) / throughputData.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    
    // Calculate mode (simplified - most frequent value)
    const frequency = new Map<number, number>();
    for (const value of throughputData) {
      const rounded = Math.round(value);
      frequency.set(rounded, (frequency.get(rounded) || 0) + 1);
    }
    const mode = Array.from(frequency.entries()).reduce((a, b) => a[1] > b[1] ? a : b)[0];

    // Calculate standard deviation
    const variance = throughputData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / throughputData.length;
    const standardDeviation = Math.sqrt(variance);

    // Calculate skewness and kurtosis (simplified)
    const skewness = this.calculateSkewness(throughputData, mean, standardDeviation);
    const kurtosis = this.calculateKurtosis(throughputData, mean, standardDeviation);

    // Create histogram
    const histogram = this.createHistogram(throughputData);

    return {
      histogram,
      mean,
      median,
      mode,
      standardDeviation,
      skewness,
      kurtosis
    };
  }

  /**
   * Analyze bottlenecks
   */
  private analyzeBottlenecks(componentId: string, currentThroughput: number, capacityAnalysis: CapacityAnalysis): BottleneckAnalysis {
    const utilizationPercentage = capacityAnalysis.utilizationPercentage;
    
    let isBottlenecked = false;
    let bottleneckType: 'none' | 'resource' | 'configuration' | 'external' | 'design' = 'none';
    let bottleneckSeverity: 'none' | 'minor' | 'moderate' | 'severe' | 'critical' = 'none';
    let limitingFactor = 'No bottleneck detected';
    let impactOnThroughput = 0;
    let rootCause = 'System operating within normal parameters';
    let recommendations: string[] = [];
    let estimatedResolutionTime = 'N/A';

    if (utilizationPercentage > 95) {
      isBottlenecked = true;
      bottleneckType = 'resource';
      bottleneckSeverity = 'critical';
      limitingFactor = 'System capacity exhausted';
      impactOnThroughput = Math.min(50, (utilizationPercentage - 80) * 2);
      rootCause = 'Component operating at maximum capacity';
      recommendations = [
        'Immediate horizontal scaling required',
        'Implement load shedding',
        'Review capacity planning'
      ];
      estimatedResolutionTime = '5-15 minutes';
    } else if (utilizationPercentage > 85) {
      isBottlenecked = true;
      bottleneckType = 'resource';
      bottleneckSeverity = 'severe';
      limitingFactor = 'High resource utilization';
      impactOnThroughput = Math.min(30, (utilizationPercentage - 70) * 1.5);
      rootCause = 'Component approaching capacity limits';
      recommendations = [
        'Plan for scaling',
        'Optimize resource usage',
        'Monitor closely'
      ];
      estimatedResolutionTime = '10-30 minutes';
    } else if (utilizationPercentage > 70) {
      isBottlenecked = true;
      bottleneckType = 'resource';
      bottleneckSeverity = 'moderate';
      limitingFactor = 'Moderate resource pressure';
      impactOnThroughput = Math.min(15, (utilizationPercentage - 50) * 0.75);
      rootCause = 'Component under moderate load';
      recommendations = [
        'Monitor resource trends',
        'Consider proactive scaling',
        'Review performance metrics'
      ];
      estimatedResolutionTime = '30-60 minutes';
    }

    return {
      isBottlenecked,
      bottleneckType,
      bottleneckSeverity,
      limitingFactor,
      impactOnThroughput,
      rootCause,
      recommendations,
      estimatedResolutionTime
    };
  }

  /**
   * Calculate performance score
   */
  private calculatePerformanceScore(
    currentThroughput: number,
    capacityAnalysis: CapacityAnalysis,
    trend: ThroughputTrend,
    bottleneckAnalysis: BottleneckAnalysis
  ): number {
    let score = 100;

    // Penalize based on capacity utilization
    if (capacityAnalysis.utilizationPercentage > 90) {
      score -= 30;
    } else if (capacityAnalysis.utilizationPercentage > 80) {
      score -= 20;
    } else if (capacityAnalysis.utilizationPercentage > 70) {
      score -= 10;
    }

    // Penalize based on trend
    if (trend.direction === 'decreasing') {
      score -= trend.changeRate * 2;
    }

    // Penalize based on volatility
    score -= trend.volatility * 20;

    // Penalize based on bottlenecks
    if (bottleneckAnalysis.isBottlenecked) {
      score -= bottleneckAnalysis.impactOnThroughput;
    }

    // Bonus for stable, efficient operation
    if (trend.direction === 'stable' && capacityAnalysis.utilizationPercentage < 70 && trend.volatility < 0.2) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  // Helper methods (simplified implementations)
  private detectSeasonality(throughputData: number[], timestamps: number[]): SeasonalityInfo | null {
    // Simplified seasonality detection
    if (throughputData.length < 50) return null;
    
    return {
      period: 3600000, // 1 hour
      amplitude: Math.max(...throughputData) - Math.min(...throughputData),
      phase: 0,
      confidence: 0.5,
      peakHours: [9, 10, 11, 14, 15, 16],
      lowHours: [2, 3, 4, 5, 6]
    };
  }

  private analyzeGrowthPattern(throughputData: number[], slope: number, changeRate: number): GrowthPattern {
    let type: 'linear' | 'exponential' | 'logarithmic' | 'cyclical' | 'irregular' = 'linear';
    
    if (Math.abs(changeRate) < 1) {
      type = 'irregular';
    } else if (changeRate > 0) {
      type = slope > 0 ? 'linear' : 'exponential';
    } else {
      type = 'logarithmic';
    }

    return {
      type,
      growthRate: slope,
      acceleration: 0, // Simplified
      sustainabilityScore: Math.max(0, 100 - Math.abs(changeRate) * 2)
    };
  }

  private calculateSkewness(data: number[], mean: number, stdDev: number): number {
    if (stdDev === 0) return 0;
    
    const n = data.length;
    const sum = data.reduce((acc, val) => acc + Math.pow((val - mean) / stdDev, 3), 0);
    return (n / ((n - 1) * (n - 2))) * sum;
  }

  private calculateKurtosis(data: number[], mean: number, stdDev: number): number {
    if (stdDev === 0) return 0;
    
    const n = data.length;
    const sum = data.reduce((acc, val) => acc + Math.pow((val - mean) / stdDev, 4), 0);
    return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * sum - (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
  }

  private createHistogram(data: number[]): ThroughputBucket[] {
    if (data.length === 0) return [];
    
    const min = Math.min(...data);
    const max = Math.max(...data);
    const bucketCount = Math.min(10, Math.ceil(Math.sqrt(data.length)));
    const bucketSize = (max - min) / bucketCount;
    
    const buckets: ThroughputBucket[] = [];
    let cumulativeCount = 0;
    
    for (let i = 0; i < bucketCount; i++) {
      const lowerBound = min + i * bucketSize;
      const upperBound = i === bucketCount - 1 ? max : min + (i + 1) * bucketSize;
      
      const count = data.filter(val => val >= lowerBound && val < upperBound).length;
      cumulativeCount += count;
      
      buckets.push({
        lowerBound,
        upperBound,
        count,
        percentage: (count / data.length) * 100,
        cumulativePercentage: (cumulativeCount / data.length) * 100
      });
    }
    
    return buckets;
  }

  private identifyPredictionFactors(trend: ThroughputTrend): string[] {
    const factors = ['Historical trend'];
    
    if (trend.seasonality) {
      factors.push('Seasonal patterns');
    }
    
    if (trend.volatility > 0.3) {
      factors.push('High volatility');
    }
    
    if (trend.growthPattern.type !== 'irregular') {
      factors.push(`${trend.growthPattern.type} growth pattern`);
    }
    
    return factors;
  }

  private startAnalysis(): void {
    this.analysisTimer = setInterval(() => {
      this.performPeriodicAnalysis();
    }, this.analysisInterval);
  }

  private performPeriodicAnalysis(): void {
    const componentIds = this.getComponentIds();
    
    for (const componentId of componentIds) {
      const metrics = this.calculateThroughputMetrics(componentId);
      if (metrics) {
        // Store metrics history
        if (!this.throughputMetrics.has(componentId)) {
          this.throughputMetrics.set(componentId, []);
        }
        
        const metricsHistory = this.throughputMetrics.get(componentId)!;
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
  }

  stopAnalysis(): void {
    if (this.analysisTimer) {
      clearInterval(this.analysisTimer);
      this.analysisTimer = null;
    }
  }
}