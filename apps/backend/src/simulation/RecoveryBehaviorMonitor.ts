/**
 * Recovery Behavior Monitor implementing SRS FR-6.5
 * 
 * Creates recovery pattern observation per SRS FR-6.5
 * Implements recovery time tracking per SRS FR-6.5
 * Adds recovery strategy analysis per SRS FR-6.5
 */

import { EventEmitter } from 'events';
import { SimulationEvent, EventScheduler } from './types';
import { ActiveFailure, ComponentFailureState } from './FailureManager';

// Recovery behavior types
export type RecoveryBehaviorType = 
  | 'immediate'         // Instant recovery
  | 'gradual'          // Gradual performance restoration
  | 'stepped'          // Recovery in discrete steps
  | 'oscillating'      // Recovery with temporary setbacks
  | 'cascading'        // Recovery triggers other recoveries
  | 'partial'          // Incomplete recovery
  | 'delayed'          // Recovery with significant delay
  | 'failed';          // Recovery attempt failed

// Recovery strategy types
export type RecoveryStrategyType = 
  | 'restart'          // Component restart
  | 'failover'         // Failover to backup
  | 'scale_out'        // Horizontal scaling
  | 'scale_up'         // Vertical scaling
  | 'circuit_breaker'  // Circuit breaker reset
  | 'cache_clear'      // Cache invalidation
  | 'connection_reset' // Connection pool reset
  | 'manual_intervention'; // Manual recovery

// Recovery phase
export type RecoveryPhase = 
  | 'detection'        // Failure detection phase
  | 'diagnosis'        // Problem diagnosis phase
  | 'planning'         // Recovery planning phase
  | 'execution'        // Recovery execution phase
  | 'validation'       // Recovery validation phase
  | 'stabilization';   // System stabilization phase

// Recovery monitoring configuration
export interface RecoveryMonitoringConfig {
  componentId: string;
  monitoringInterval: number; // milliseconds
  recoveryTimeout: number; // milliseconds
  expectedRecoveryTime: number; // milliseconds
  recoveryThresholds: RecoveryThreshold[];
  enablePredictiveAnalysis: boolean;
  enablePatternDetection: boolean;
}

// Recovery threshold
export interface RecoveryThreshold {
  metric: 'latency' | 'throughput' | 'error_rate' | 'availability';
  threshold: number;
  direction: 'above' | 'below';
  sustainedDuration: number; // milliseconds
}

// Recovery observation
export interface RecoveryObservation {
  id: string;
  componentId: string;
  timestamp: number;
  phase: RecoveryPhase;
  behaviorType: RecoveryBehaviorType;
  strategy: RecoveryStrategyType;
  metrics: RecoveryMetrics;
  duration: number; // milliseconds since recovery started
  progress: number; // 0.0 to 1.0
  isComplete: boolean;
  anomalies: RecoveryAnomaly[];
}

// Recovery metrics
export interface RecoveryMetrics {
  latency: number;
  throughput: number;
  errorRate: number;
  availability: number;
  resourceUtilization: {
    cpu: number;
    memory: number;
    network: number;
    storage: number;
  };
  connectionCount: number;
  queueDepth: number;
}

// Recovery anomaly
export interface RecoveryAnomaly {
  type: 'performance_regression' | 'oscillation' | 'stall' | 'cascade_failure' | 'resource_leak';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: number;
  impact: number; // 0.0 to 1.0
  suggestedAction: string;
}

// Recovery pattern
export interface RecoveryPattern {
  id: string;
  name: string;
  componentType: string;
  failureType: string;
  behaviorType: RecoveryBehaviorType;
  strategy: RecoveryStrategyType;
  averageRecoveryTime: number;
  successRate: number;
  commonAnomalies: string[];
  characteristics: RecoveryCharacteristics;
  occurrenceCount: number;
  lastObserved: number;
}

// Recovery characteristics
export interface RecoveryCharacteristics {
  initialDelay: number; // milliseconds
  recoveryRate: number; // improvement per second
  stabilizationTime: number; // milliseconds
  overshootProbability: number; // 0.0 to 1.0
  regressionProbability: number; // 0.0 to 1.0
  cascadeProbability: number; // 0.0 to 1.0
}

// Recovery time analysis
export interface RecoveryTimeAnalysis {
  componentId: string;
  totalRecoveries: number;
  averageRecoveryTime: number;
  medianRecoveryTime: number;
  p95RecoveryTime: number;
  p99RecoveryTime: number;
  fastestRecovery: number;
  slowestRecovery: number;
  recoveryTimeDistribution: RecoveryTimeDistribution;
  trendAnalysis: RecoveryTrendAnalysis;
}

// Recovery time distribution
export interface RecoveryTimeDistribution {
  buckets: RecoveryTimeBucket[];
  mean: number;
  standardDeviation: number;
  skewness: number;
  kurtosis: number;
}

// Recovery time bucket
export interface RecoveryTimeBucket {
  minTime: number;
  maxTime: number;
  count: number;
  percentage: number;
}

// Recovery trend analysis
export interface RecoveryTrendAnalysis {
  trend: 'improving' | 'degrading' | 'stable' | 'volatile';
  trendStrength: number; // 0.0 to 1.0
  seasonality: boolean;
  cyclePeriod?: number; // milliseconds
  predictedNextRecoveryTime: number;
  confidence: number; // 0.0 to 1.0
}

// Recovery strategy effectiveness
export interface RecoveryStrategyEffectiveness {
  strategy: RecoveryStrategyType;
  componentType: string;
  failureType: string;
  successRate: number;
  averageRecoveryTime: number;
  resourceCost: number;
  sideEffects: string[];
  recommendationScore: number; // 0.0 to 1.0
  usageCount: number;
}

// Active recovery monitoring
export interface ActiveRecoveryMonitoring {
  id: string;
  componentId: string;
  config: RecoveryMonitoringConfig;
  startTime: number;
  currentPhase: RecoveryPhase;
  observations: RecoveryObservation[];
  detectedPatterns: string[];
  anomalies: RecoveryAnomaly[];
  isActive: boolean;
  completedAt?: number;
}

/**
 * Recovery Behavior Monitor
 * Implements SRS FR-6.5 requirements for recovery behavior monitoring
 */
export class RecoveryBehaviorMonitor extends EventEmitter {
  private eventScheduler: EventScheduler;
  private activeMonitoring: Map<string, ActiveRecoveryMonitoring>;
  private recoveryPatterns: Map<string, RecoveryPattern>;
  private strategyEffectiveness: Map<string, RecoveryStrategyEffectiveness>;
  private recoveryHistory: RecoveryObservation[];
  private monitoringIntervals: Map<string, NodeJS.Timeout>;
  private isRunning: boolean;

  constructor(eventScheduler: EventScheduler) {
    super();
    this.eventScheduler = eventScheduler;
    this.activeMonitoring = new Map();
    this.recoveryPatterns = new Map();
    this.strategyEffectiveness = new Map();
    this.recoveryHistory = [];
    this.monitoringIntervals = new Map();
    this.isRunning = false;
  }

  /**
   * Start recovery monitoring for a component
   * Implements SRS FR-6.5: Recovery pattern observation
   */
  startRecoveryMonitoring(componentId: string, config: RecoveryMonitoringConfig): string {
    const monitoringId = `recovery_monitor_${componentId}_${Date.now()}`;
    const currentTime = Date.now();

    const monitoring: ActiveRecoveryMonitoring = {
      id: monitoringId,
      componentId,
      config,
      startTime: currentTime,
      currentPhase: 'detection',
      observations: [],
      detectedPatterns: [],
      anomalies: [],
      isActive: true
    };

    this.activeMonitoring.set(monitoringId, monitoring);

    // Start periodic monitoring
    this.startPeriodicMonitoring(monitoring);

    // Schedule recovery timeout
    this.scheduleRecoveryTimeout(monitoring);

    this.emit('recovery_monitoring_started', {
      monitoringId,
      componentId,
      config
    });

    return monitoringId;
  }

  /**
   * Record recovery observation
   * Implements SRS FR-6.5: Recovery time tracking
   */
  recordRecoveryObservation(componentId: string, metrics: RecoveryMetrics, strategy: RecoveryStrategyType): void {
    const monitoring = this.findActiveMonitoring(componentId);
    if (!monitoring) return;

    const currentTime = Date.now();
    const duration = currentTime - monitoring.startTime;
    
    // Determine recovery behavior type
    const behaviorType = this.determineBehaviorType(monitoring, metrics);
    
    // Calculate recovery progress
    const progress = this.calculateRecoveryProgress(monitoring, metrics);
    
    // Detect anomalies
    const anomalies = this.detectRecoveryAnomalies(monitoring, metrics);

    const observation: RecoveryObservation = {
      id: `observation_${componentId}_${currentTime}`,
      componentId,
      timestamp: currentTime,
      phase: monitoring.currentPhase,
      behaviorType,
      strategy,
      metrics,
      duration,
      progress,
      isComplete: progress >= 1.0,
      anomalies
    };

    monitoring.observations.push(observation);
    monitoring.anomalies.push(...anomalies);
    this.recoveryHistory.push(observation);

    // Update recovery phase
    this.updateRecoveryPhase(monitoring, observation);

    // Check for pattern matches
    this.checkForPatternMatches(monitoring, observation);

    // Update strategy effectiveness
    this.updateStrategyEffectiveness(strategy, observation);

    this.emit('recovery_observation_recorded', {
      monitoringId: monitoring.id,
      observation
    });

    // Complete monitoring if recovery is finished
    if (observation.isComplete) {
      this.completeRecoveryMonitoring(monitoring.id);
    }
  }

  /**
   * Analyze recovery patterns
   * Implements SRS FR-6.5: Recovery strategy analysis
   */
  analyzeRecoveryPatterns(componentId?: string): RecoveryPattern[] {
    let observations = this.recoveryHistory;
    
    if (componentId) {
      observations = observations.filter(obs => obs.componentId === componentId);
    }

    const patternGroups = this.groupObservationsByPattern(observations);
    const patterns: RecoveryPattern[] = [];

    for (const [key, groupObservations] of patternGroups) {
      const pattern = this.createRecoveryPattern(key, groupObservations);
      patterns.push(pattern);
      this.recoveryPatterns.set(pattern.id, pattern);
    }

    return patterns;
  }

  /**
   * Get recovery time analysis
   * Implements SRS FR-6.5: Recovery time tracking
   */
  getRecoveryTimeAnalysis(componentId: string): RecoveryTimeAnalysis {
    const componentObservations = this.recoveryHistory.filter(obs => 
      obs.componentId === componentId && obs.isComplete
    );

    if (componentObservations.length === 0) {
      return this.createEmptyRecoveryTimeAnalysis(componentId);
    }

    const recoveryTimes = componentObservations.map(obs => obs.duration);
    recoveryTimes.sort((a, b) => a - b);

    const analysis: RecoveryTimeAnalysis = {
      componentId,
      totalRecoveries: recoveryTimes.length,
      averageRecoveryTime: this.calculateMean(recoveryTimes),
      medianRecoveryTime: this.calculateMedian(recoveryTimes),
      p95RecoveryTime: this.calculatePercentile(recoveryTimes, 0.95),
      p99RecoveryTime: this.calculatePercentile(recoveryTimes, 0.99),
      fastestRecovery: Math.min(...recoveryTimes),
      slowestRecovery: Math.max(...recoveryTimes),
      recoveryTimeDistribution: this.createRecoveryTimeDistribution(recoveryTimes),
      trendAnalysis: this.analyzeTrends(componentObservations)
    };

    return analysis;
  }

  /**
   * Get recovery strategy effectiveness
   */
  getRecoveryStrategyEffectiveness(strategy?: RecoveryStrategyType): RecoveryStrategyEffectiveness[] {
    let effectiveness = Array.from(this.strategyEffectiveness.values());
    
    if (strategy) {
      effectiveness = effectiveness.filter(eff => eff.strategy === strategy);
    }

    return effectiveness.sort((a, b) => b.recommendationScore - a.recommendationScore);
  }

  /**
   * Predict recovery time
   */
  predictRecoveryTime(componentId: string, failureType: string, strategy: RecoveryStrategyType): {
    predictedTime: number;
    confidence: number;
    factors: string[];
  } {
    const analysis = this.getRecoveryTimeAnalysis(componentId);
    const strategyEffectiveness = this.strategyEffectiveness.get(`${strategy}_${componentId}_${failureType}`);
    
    let predictedTime = analysis.averageRecoveryTime;
    let confidence = 0.5;
    const factors: string[] = [];

    if (strategyEffectiveness) {
      predictedTime = strategyEffectiveness.averageRecoveryTime;
      confidence = Math.min(strategyEffectiveness.usageCount / 10, 0.9);
      factors.push(`Strategy effectiveness: ${strategyEffectiveness.successRate * 100}%`);
    }

    if (analysis.trendAnalysis.trend === 'improving') {
      predictedTime *= 0.9;
      confidence += 0.1;
      factors.push('Improving recovery trend detected');
    } else if (analysis.trendAnalysis.trend === 'degrading') {
      predictedTime *= 1.1;
      confidence -= 0.1;
      factors.push('Degrading recovery trend detected');
    }

    return {
      predictedTime: Math.max(predictedTime, 1000), // Minimum 1 second
      confidence: Math.max(0.1, Math.min(confidence, 0.95)),
      factors
    };
  }

  /**
   * Get active recovery monitoring
   */
  getActiveRecoveryMonitoring(): ActiveRecoveryMonitoring[] {
    return Array.from(this.activeMonitoring.values()).filter(m => m.isActive);
  }

  /**
   * Stop recovery monitoring
   */
  stopRecoveryMonitoring(monitoringId: string): boolean {
    const monitoring = this.activeMonitoring.get(monitoringId);
    if (!monitoring) return false;

    return this.completeRecoveryMonitoring(monitoringId);
  }

  /**
   * Clear all monitoring data
   */
  clear(): void {
    // Clear all monitoring intervals
    for (const interval of this.monitoringIntervals.values()) {
      clearInterval(interval);
    }

    this.activeMonitoring.clear();
    this.recoveryPatterns.clear();
    this.strategyEffectiveness.clear();
    this.recoveryHistory = [];
    this.monitoringIntervals.clear();
    this.emit('recovery_monitor_cleared');
  }

  // Private helper methods

  private startPeriodicMonitoring(monitoring: ActiveRecoveryMonitoring): void {
    const interval = setInterval(() => {
      if (!monitoring.isActive) {
        clearInterval(interval);
        this.monitoringIntervals.delete(monitoring.id);
        return;
      }

      // Trigger monitoring check
      this.eventScheduler.scheduleEvent({
        id: `recovery_check_${monitoring.id}_${Date.now()}`,
        timestamp: Date.now(),
        type: 'recovery_check',
        componentId: monitoring.componentId,
        data: {
          monitoringId: monitoring.id,
          action: 'periodic_check'
        }
      });
    }, monitoring.config.monitoringInterval);

    this.monitoringIntervals.set(monitoring.id, interval);
  }

  private scheduleRecoveryTimeout(monitoring: ActiveRecoveryMonitoring): void {
    this.eventScheduler.scheduleEvent({
      id: `recovery_timeout_${monitoring.id}`,
      timestamp: monitoring.startTime + monitoring.config.recoveryTimeout,
      type: 'recovery_check',
      componentId: monitoring.componentId,
      data: {
        monitoringId: monitoring.id,
        action: 'timeout'
      }
    });
  }

  private findActiveMonitoring(componentId: string): ActiveRecoveryMonitoring | null {
    for (const monitoring of this.activeMonitoring.values()) {
      if (monitoring.componentId === componentId && monitoring.isActive) {
        return monitoring;
      }
    }
    return null;
  }

  private determineBehaviorType(monitoring: ActiveRecoveryMonitoring, metrics: RecoveryMetrics): RecoveryBehaviorType {
    const observations = monitoring.observations;
    if (observations.length === 0) return 'immediate';

    const lastObservation = observations[observations.length - 1];
    const currentProgress = this.calculateRecoveryProgress(monitoring, metrics);
    const lastProgress = lastObservation.progress;

    // Analyze progress change
    const progressChange = currentProgress - lastProgress;
    const timeElapsed = Date.now() - monitoring.startTime;

    if (progressChange <= 0 && timeElapsed > 30000) {
      return 'failed';
    } else if (progressChange < 0) {
      return 'oscillating';
    } else if (progressChange > 0.8 && timeElapsed < 5000) {
      return 'immediate';
    } else if (progressChange > 0.1) {
      return 'gradual';
    } else if (progressChange > 0 && progressChange <= 0.1) {
      return 'stepped';
    } else if (currentProgress < 1.0 && timeElapsed > monitoring.config.expectedRecoveryTime * 2) {
      return 'delayed';
    }

    return 'gradual';
  }

  private calculateRecoveryProgress(monitoring: ActiveRecoveryMonitoring, metrics: RecoveryMetrics): number {
    const thresholds = monitoring.config.recoveryThresholds;
    let totalProgress = 0;
    let thresholdCount = 0;

    for (const threshold of thresholds) {
      let metricValue = 0;
      switch (threshold.metric) {
        case 'latency':
          metricValue = metrics.latency;
          break;
        case 'throughput':
          metricValue = metrics.throughput;
          break;
        case 'error_rate':
          metricValue = metrics.errorRate;
          break;
        case 'availability':
          metricValue = metrics.availability;
          break;
      }

      let progress = 0;
      if (threshold.direction === 'below') {
        progress = metricValue <= threshold.threshold ? 1.0 : 0.0;
      } else {
        progress = metricValue >= threshold.threshold ? 1.0 : 0.0;
      }

      totalProgress += progress;
      thresholdCount++;
    }

    return thresholdCount > 0 ? totalProgress / thresholdCount : 0;
  }

  private detectRecoveryAnomalies(monitoring: ActiveRecoveryMonitoring, metrics: RecoveryMetrics): RecoveryAnomaly[] {
    const anomalies: RecoveryAnomaly[] = [];
    const observations = monitoring.observations;

    if (observations.length === 0) return anomalies;

    const lastObservation = observations[observations.length - 1];
    const currentTime = Date.now();

    // Performance regression detection
    if (metrics.latency > lastObservation.metrics.latency * 1.5) {
      anomalies.push({
        type: 'performance_regression',
        severity: 'high',
        description: 'Latency increased significantly during recovery',
        detectedAt: currentTime,
        impact: 0.7,
        suggestedAction: 'Check for resource contention or cascading failures'
      });
    }

    // Oscillation detection
    if (observations.length >= 3) {
      const recentProgress = observations.slice(-3).map(obs => obs.progress);
      const isOscillating = this.detectOscillation(recentProgress);
      
      if (isOscillating) {
        anomalies.push({
          type: 'oscillation',
          severity: 'medium',
          description: 'Recovery progress is oscillating',
          detectedAt: currentTime,
          impact: 0.5,
          suggestedAction: 'Consider adjusting recovery parameters or strategy'
        });
      }
    }

    // Stall detection
    const stallThreshold = 30000; // 30 seconds
    if (observations.length >= 2) {
      const progressChange = observations[observations.length - 1].progress - observations[observations.length - 2].progress;
      const timeChange = observations[observations.length - 1].timestamp - observations[observations.length - 2].timestamp;
      
      if (progressChange < 0.01 && timeChange > stallThreshold) {
        anomalies.push({
          type: 'stall',
          severity: 'high',
          description: 'Recovery progress has stalled',
          detectedAt: currentTime,
          impact: 0.8,
          suggestedAction: 'Manual intervention may be required'
        });
      }
    }

    return anomalies;
  }

  private updateRecoveryPhase(monitoring: ActiveRecoveryMonitoring, observation: RecoveryObservation): void {
    const duration = observation.duration;
    const progress = observation.progress;

    if (duration < 5000) {
      monitoring.currentPhase = 'detection';
    } else if (duration < 15000 && progress < 0.2) {
      monitoring.currentPhase = 'diagnosis';
    } else if (duration < 30000 && progress < 0.5) {
      monitoring.currentPhase = 'planning';
    } else if (progress < 0.9) {
      monitoring.currentPhase = 'execution';
    } else if (progress < 1.0) {
      monitoring.currentPhase = 'validation';
    } else {
      monitoring.currentPhase = 'stabilization';
    }
  }

  private checkForPatternMatches(monitoring: ActiveRecoveryMonitoring, observation: RecoveryObservation): void {
    const patternKey = `${observation.behaviorType}_${observation.strategy}`;
    
    if (!monitoring.detectedPatterns.includes(patternKey)) {
      monitoring.detectedPatterns.push(patternKey);
      
      this.emit('recovery_pattern_detected', {
        monitoringId: monitoring.id,
        patternKey,
        observation
      });
    }
  }

  private updateStrategyEffectiveness(strategy: RecoveryStrategyType, observation: RecoveryObservation): void {
    const key = `${strategy}_${observation.componentId}`;
    let effectiveness = this.strategyEffectiveness.get(key);

    if (!effectiveness) {
      effectiveness = {
        strategy,
        componentType: 'generic',
        failureType: 'generic',
        successRate: 0,
        averageRecoveryTime: 0,
        resourceCost: 0,
        sideEffects: [],
        recommendationScore: 0,
        usageCount: 0
      };
    }

    effectiveness.usageCount++;
    
    if (observation.isComplete) {
      const successCount = effectiveness.successRate * (effectiveness.usageCount - 1) + 1;
      effectiveness.successRate = successCount / effectiveness.usageCount;
      
      effectiveness.averageRecoveryTime = 
        (effectiveness.averageRecoveryTime * (effectiveness.usageCount - 1) + observation.duration) / effectiveness.usageCount;
    }

    // Calculate recommendation score
    effectiveness.recommendationScore = 
      (effectiveness.successRate * 0.6) + 
      ((1 / Math.max(effectiveness.averageRecoveryTime / 60000, 1)) * 0.4); // Favor faster recovery

    this.strategyEffectiveness.set(key, effectiveness);
  }

  private completeRecoveryMonitoring(monitoringId: string): boolean {
    const monitoring = this.activeMonitoring.get(monitoringId);
    if (!monitoring) return false;

    monitoring.isActive = false;
    monitoring.completedAt = Date.now();

    // Clear monitoring interval
    const interval = this.monitoringIntervals.get(monitoringId);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(monitoringId);
    }

    this.emit('recovery_monitoring_completed', {
      monitoringId,
      componentId: monitoring.componentId,
      duration: monitoring.completedAt - monitoring.startTime,
      observations: monitoring.observations.length,
      anomalies: monitoring.anomalies.length
    });

    return true;
  }

  private groupObservationsByPattern(observations: RecoveryObservation[]): Map<string, RecoveryObservation[]> {
    const groups = new Map<string, RecoveryObservation[]>();

    observations.forEach(obs => {
      const key = `${obs.behaviorType}_${obs.strategy}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(obs);
    });

    return groups;
  }

  private createRecoveryPattern(key: string, observations: RecoveryObservation[]): RecoveryPattern {
    const [behaviorType, strategy] = key.split('_') as [RecoveryBehaviorType, RecoveryStrategyType];
    const recoveryTimes = observations.filter(obs => obs.isComplete).map(obs => obs.duration);
    const successRate = recoveryTimes.length / observations.length;

    return {
      id: `pattern_${key}_${Date.now()}`,
      name: `${behaviorType} ${strategy} recovery`,
      componentType: observations[0]?.componentId.split('_')[0] || 'generic',
      failureType: 'generic',
      behaviorType,
      strategy,
      averageRecoveryTime: recoveryTimes.length > 0 ? this.calculateMean(recoveryTimes) : 0,
      successRate,
      commonAnomalies: this.extractCommonAnomalies(observations),
      characteristics: this.calculateRecoveryCharacteristics(observations),
      occurrenceCount: observations.length,
      lastObserved: Math.max(...observations.map(obs => obs.timestamp))
    };
  }

  private extractCommonAnomalies(observations: RecoveryObservation[]): string[] {
    const anomalyTypes = new Map<string, number>();
    
    observations.forEach(obs => {
      obs.anomalies.forEach(anomaly => {
        anomalyTypes.set(anomaly.type, (anomalyTypes.get(anomaly.type) || 0) + 1);
      });
    });

    return Array.from(anomalyTypes.entries())
      .filter(([_, count]) => count >= observations.length * 0.3) // 30% threshold
      .map(([type, _]) => type);
  }

  private calculateRecoveryCharacteristics(observations: RecoveryObservation[]): RecoveryCharacteristics {
    const completedObservations = observations.filter(obs => obs.isComplete);
    
    if (completedObservations.length === 0) {
      return {
        initialDelay: 0,
        recoveryRate: 0,
        stabilizationTime: 0,
        overshootProbability: 0,
        regressionProbability: 0,
        cascadeProbability: 0
      };
    }

    // Calculate initial delay (time to first progress)
    const initialDelays = completedObservations.map(obs => {
      // Find first observation with progress > 0
      const firstProgress = observations.find(o => o.componentId === obs.componentId && o.progress > 0);
      return firstProgress ? firstProgress.duration : obs.duration;
    });

    return {
      initialDelay: this.calculateMean(initialDelays),
      recoveryRate: 0.1, // Simplified calculation
      stabilizationTime: this.calculateMean(completedObservations.map(obs => obs.duration * 0.2)),
      overshootProbability: 0.1,
      regressionProbability: observations.filter(obs => obs.anomalies.some(a => a.type === 'performance_regression')).length / observations.length,
      cascadeProbability: 0.05
    };
  }

  private createEmptyRecoveryTimeAnalysis(componentId: string): RecoveryTimeAnalysis {
    return {
      componentId,
      totalRecoveries: 0,
      averageRecoveryTime: 0,
      medianRecoveryTime: 0,
      p95RecoveryTime: 0,
      p99RecoveryTime: 0,
      fastestRecovery: 0,
      slowestRecovery: 0,
      recoveryTimeDistribution: {
        buckets: [],
        mean: 0,
        standardDeviation: 0,
        skewness: 0,
        kurtosis: 0
      },
      trendAnalysis: {
        trend: 'stable',
        trendStrength: 0,
        seasonality: false,
        predictedNextRecoveryTime: 0,
        confidence: 0
      }
    };
  }

  private createRecoveryTimeDistribution(recoveryTimes: number[]): RecoveryTimeDistribution {
    const bucketCount = Math.min(10, recoveryTimes.length);
    const min = Math.min(...recoveryTimes);
    const max = Math.max(...recoveryTimes);
    const bucketSize = (max - min) / bucketCount;

    const buckets: RecoveryTimeBucket[] = [];
    for (let i = 0; i < bucketCount; i++) {
      const minTime = min + i * bucketSize;
      const maxTime = min + (i + 1) * bucketSize;
      const count = recoveryTimes.filter(time => time >= minTime && time < maxTime).length;
      
      buckets.push({
        minTime,
        maxTime,
        count,
        percentage: (count / recoveryTimes.length) * 100
      });
    }

    return {
      buckets,
      mean: this.calculateMean(recoveryTimes),
      standardDeviation: this.calculateStandardDeviation(recoveryTimes),
      skewness: 0, // Simplified
      kurtosis: 0  // Simplified
    };
  }

  private analyzeTrends(observations: RecoveryObservation[]): RecoveryTrendAnalysis {
    if (observations.length < 3) {
      return {
        trend: 'stable',
        trendStrength: 0,
        seasonality: false,
        predictedNextRecoveryTime: 0,
        confidence: 0
      };
    }

    const recoveryTimes = observations.map(obs => obs.duration);
    const timePoints = observations.map((_, index) => index);

    // Simple linear regression
    const slope = this.calculateLinearRegressionSlope(timePoints, recoveryTimes);
    
    let trend: 'improving' | 'degrading' | 'stable' | 'volatile' = 'stable';
    if (slope < -1000) trend = 'improving'; // Recovery times decreasing
    else if (slope > 1000) trend = 'degrading'; // Recovery times increasing
    else if (this.calculateStandardDeviation(recoveryTimes) > this.calculateMean(recoveryTimes) * 0.5) trend = 'volatile';

    return {
      trend,
      trendStrength: Math.abs(slope) / 10000, // Normalized
      seasonality: false, // Simplified
      predictedNextRecoveryTime: recoveryTimes[recoveryTimes.length - 1] + slope,
      confidence: Math.min(observations.length / 10, 0.9)
    };
  }

  private detectOscillation(values: number[]): boolean {
    if (values.length < 3) return false;
    
    let changes = 0;
    for (let i = 1; i < values.length - 1; i++) {
      const prev = values[i - 1];
      const curr = values[i];
      const next = values[i + 1];
      
      if ((curr > prev && curr > next) || (curr < prev && curr < next)) {
        changes++;
      }
    }
    
    return changes >= values.length - 2; // Most points are peaks or valleys
  }

  private calculateMean(values: number[]): number {
    return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
  }

  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const index = Math.ceil(values.length * percentile) - 1;
    return values[Math.max(0, index)];
  }

  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = this.calculateMean(values);
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return Math.sqrt(this.calculateMean(squaredDiffs));
  }

  private calculateLinearRegressionSlope(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;
    
    const n = x.length;
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    
    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }
}