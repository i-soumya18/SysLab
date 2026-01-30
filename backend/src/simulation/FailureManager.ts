/**
 * Component failure and recovery modeling system
 */

import { FailureScenario } from '../types';
import { SimulationEvent } from './types';

export type FailureType = 
  | 'crash'           // Complete component failure
  | 'performance'     // Degraded performance
  | 'network'         // Network connectivity issues
  | 'resource'        // Resource exhaustion (CPU, memory)
  | 'dependency'      // Dependency failure
  | 'timeout'         // Request timeouts
  | 'partial';        // Partial functionality loss

export type RecoveryType = 
  | 'immediate'       // Instant recovery
  | 'gradual'         // Gradual performance restoration
  | 'restart'         // Component restart required
  | 'manual'          // Manual intervention required
  | 'cascading';      // Recovery affects other components

export interface FailureModel {
  type: FailureType;
  severity: number;        // 0.0 to 1.0 (0 = no impact, 1 = complete failure)
  duration: number;        // Duration in milliseconds
  recoveryType: RecoveryType;
  recoveryTime: number;    // Time to full recovery in milliseconds
  cascadeComponents?: string[]; // Components affected by this failure
  probability: number;     // Probability of this failure occurring (0.0 to 1.0)
}

export interface ComponentFailureState {
  componentId: string;
  isHealthy: boolean;
  currentFailures: ActiveFailure[];
  failureHistory: FailureEvent[];
  recoveryProgress: number; // 0.0 to 1.0
  lastFailureTime: number;
  mtbf: number; // Mean Time Between Failures (milliseconds)
  mttr: number; // Mean Time To Recovery (milliseconds)
}

export interface ActiveFailure {
  id: string;
  type: FailureType;
  severity: number;
  startTime: number;
  expectedEndTime: number;
  recoveryType: RecoveryType;
  affectedMetrics: string[];
}

export interface FailureEvent {
  id: string;
  componentId: string;
  type: FailureType;
  severity: number;
  startTime: number;
  endTime: number;
  recoveryTime: number;
  rootCause?: string;
  cascadedFrom?: string;
}

export class FailureManager {
  private componentStates: Map<string, ComponentFailureState> = new Map();
  private failureModels: Map<FailureType, FailureModel> = new Map();
  private activeFailures: Map<string, ActiveFailure> = new Map();

  constructor() {
    this.initializeFailureModels();
  }

  /**
   * Initialize predefined failure models
   */
  private initializeFailureModels(): void {
    const models: FailureModel[] = [
      {
        type: 'crash',
        severity: 1.0,
        duration: 30000, // 30 seconds
        recoveryType: 'restart',
        recoveryTime: 15000, // 15 seconds to restart
        probability: 0.001 // 0.1% chance
      },
      {
        type: 'performance',
        severity: 0.5,
        duration: 120000, // 2 minutes
        recoveryType: 'gradual',
        recoveryTime: 60000, // 1 minute gradual recovery
        probability: 0.01 // 1% chance
      },
      {
        type: 'network',
        severity: 0.8,
        duration: 45000, // 45 seconds
        recoveryType: 'immediate',
        recoveryTime: 5000, // 5 seconds
        probability: 0.005 // 0.5% chance
      },
      {
        type: 'resource',
        severity: 0.7,
        duration: 90000, // 1.5 minutes
        recoveryType: 'gradual',
        recoveryTime: 30000, // 30 seconds
        probability: 0.008 // 0.8% chance
      },
      {
        type: 'dependency',
        severity: 0.9,
        duration: 60000, // 1 minute
        recoveryType: 'cascading',
        recoveryTime: 20000, // 20 seconds
        probability: 0.003 // 0.3% chance
      },
      {
        type: 'timeout',
        severity: 0.3,
        duration: 30000, // 30 seconds
        recoveryType: 'immediate',
        recoveryTime: 1000, // 1 second
        probability: 0.02 // 2% chance
      },
      {
        type: 'partial',
        severity: 0.4,
        duration: 180000, // 3 minutes
        recoveryType: 'manual',
        recoveryTime: 300000, // 5 minutes manual intervention
        probability: 0.002 // 0.2% chance
      }
    ];

    models.forEach(model => {
      this.failureModels.set(model.type, model);
    });
  }

  /**
   * Initialize component failure state
   */
  initializeComponent(componentId: string, componentType: string): void {
    const mtbf = this.calculateMTBF(componentType);
    const mttr = this.calculateMTTR(componentType);

    this.componentStates.set(componentId, {
      componentId,
      isHealthy: true,
      currentFailures: [],
      failureHistory: [],
      recoveryProgress: 1.0,
      lastFailureTime: 0,
      mtbf,
      mttr
    });
  }

  /**
   * Inject a specific failure scenario
   */
  injectFailure(scenario: FailureScenario, currentTime: number): ActiveFailure | null {
    const componentState = this.componentStates.get(scenario.componentId);
    if (!componentState) {
      console.warn(`Component ${scenario.componentId} not found for failure injection`);
      return null;
    }

    const failureId = `failure_${scenario.componentId}_${currentTime}`;
    const failureModel = this.failureModels.get(scenario.failureType as FailureType);
    
    if (!failureModel) {
      console.warn(`Unknown failure type: ${scenario.failureType}`);
      return null;
    }

    const activeFailure: ActiveFailure = {
      id: failureId,
      type: scenario.failureType as FailureType,
      severity: scenario.severity,
      startTime: currentTime,
      expectedEndTime: currentTime + scenario.duration,
      recoveryType: failureModel.recoveryType,
      affectedMetrics: this.getAffectedMetrics(scenario.failureType as FailureType)
    };

    // Add to component's active failures
    componentState.currentFailures.push(activeFailure);
    componentState.isHealthy = false;
    componentState.lastFailureTime = currentTime;
    componentState.recoveryProgress = 0.0;

    // Track globally
    this.activeFailures.set(failureId, activeFailure);

    return activeFailure;
  }

  /**
   * Process failure recovery
   */
  processRecovery(componentId: string, currentTime: number): boolean {
    const componentState = this.componentStates.get(componentId);
    if (!componentState) return false;

    let hasRecovered = false;
    const completedFailures: string[] = [];

    // Check each active failure for recovery
    componentState.currentFailures.forEach(failure => {
      if (currentTime >= failure.expectedEndTime) {
        // Failure duration has ended, start recovery process
        const recoveryModel = this.failureModels.get(failure.type);
        if (recoveryModel) {
          const recoveryEndTime = failure.expectedEndTime + recoveryModel.recoveryTime;
          
          if (currentTime >= recoveryEndTime) {
            // Recovery complete
            completedFailures.push(failure.id);
            
            // Add to failure history
            const failureEvent: FailureEvent = {
              id: failure.id,
              componentId,
              type: failure.type,
              severity: failure.severity,
              startTime: failure.startTime,
              endTime: failure.expectedEndTime,
              recoveryTime: recoveryModel.recoveryTime
            };
            componentState.failureHistory.push(failureEvent);
            
            hasRecovered = true;
          } else {
            // Recovery in progress
            const recoveryProgress = (currentTime - failure.expectedEndTime) / recoveryModel.recoveryTime;
            componentState.recoveryProgress = Math.max(componentState.recoveryProgress, recoveryProgress);
          }
        }
      }
    });

    // Remove completed failures
    completedFailures.forEach(failureId => {
      componentState.currentFailures = componentState.currentFailures.filter(f => f.id !== failureId);
      this.activeFailures.delete(failureId);
    });

    // Update component health status
    if (componentState.currentFailures.length === 0) {
      componentState.isHealthy = true;
      componentState.recoveryProgress = 1.0;
    }

    return hasRecovered;
  }

  /**
   * Generate random failures based on component reliability
   */
  generateRandomFailures(componentId: string, currentTime: number): ActiveFailure[] {
    const componentState = this.componentStates.get(componentId);
    if (!componentState || !componentState.isHealthy) return [];

    const newFailures: ActiveFailure[] = [];
    
    // Check if enough time has passed since last failure (MTBF)
    if (currentTime - componentState.lastFailureTime < componentState.mtbf) {
      return newFailures;
    }

    // Check each failure type for random occurrence
    this.failureModels.forEach((model, type) => {
      if (Math.random() < model.probability) {
        const failureId = `random_${componentId}_${type}_${currentTime}`;
        
        const activeFailure: ActiveFailure = {
          id: failureId,
          type,
          severity: model.severity * (0.8 + Math.random() * 0.4), // ±20% variation
          startTime: currentTime,
          expectedEndTime: currentTime + model.duration * (0.8 + Math.random() * 0.4),
          recoveryType: model.recoveryType,
          affectedMetrics: this.getAffectedMetrics(type)
        };

        newFailures.push(activeFailure);
        
        // Add to component state
        componentState.currentFailures.push(activeFailure);
        componentState.isHealthy = false;
        componentState.lastFailureTime = currentTime;
        componentState.recoveryProgress = 0.0;
        
        // Track globally
        this.activeFailures.set(failureId, activeFailure);
      }
    });

    return newFailures;
  }

  /**
   * Get current failure impact on component performance
   */
  getFailureImpact(componentId: string): {
    performanceMultiplier: number;
    errorRateMultiplier: number;
    availabilityMultiplier: number;
  } {
    const componentState = this.componentStates.get(componentId);
    if (!componentState || componentState.isHealthy) {
      return {
        performanceMultiplier: 1.0,
        errorRateMultiplier: 1.0,
        availabilityMultiplier: 1.0
      };
    }

    let maxSeverity = 0;
    let totalPerformanceImpact = 0;
    let totalErrorImpact = 0;
    let totalAvailabilityImpact = 0;

    componentState.currentFailures.forEach(failure => {
      maxSeverity = Math.max(maxSeverity, failure.severity);
      
      switch (failure.type) {
        case 'crash':
          totalAvailabilityImpact += failure.severity;
          totalErrorImpact += failure.severity;
          break;
        case 'performance':
          totalPerformanceImpact += failure.severity;
          break;
        case 'network':
          totalPerformanceImpact += failure.severity * 0.8;
          totalErrorImpact += failure.severity * 0.3;
          break;
        case 'resource':
          totalPerformanceImpact += failure.severity * 0.9;
          totalErrorImpact += failure.severity * 0.2;
          break;
        case 'dependency':
          totalAvailabilityImpact += failure.severity * 0.7;
          totalErrorImpact += failure.severity * 0.5;
          break;
        case 'timeout':
          totalPerformanceImpact += failure.severity * 0.6;
          totalErrorImpact += failure.severity * 0.8;
          break;
        case 'partial':
          totalPerformanceImpact += failure.severity * 0.5;
          totalAvailabilityImpact += failure.severity * 0.3;
          break;
      }
    });

    // Apply recovery progress
    const recoveryFactor = componentState.recoveryProgress;
    
    return {
      performanceMultiplier: Math.max(0.1, 1.0 - totalPerformanceImpact * (1 - recoveryFactor)),
      errorRateMultiplier: 1.0 + totalErrorImpact * (1 - recoveryFactor),
      availabilityMultiplier: Math.max(0.0, 1.0 - totalAvailabilityImpact * (1 - recoveryFactor))
    };
  }

  /**
   * Get component failure state
   */
  getComponentState(componentId: string): ComponentFailureState | null {
    return this.componentStates.get(componentId) || null;
  }

  /**
   * Get all active failures
   */
  getActiveFailures(): ActiveFailure[] {
    return Array.from(this.activeFailures.values());
  }

  /**
   * Get failure statistics for a component
   */
  getFailureStatistics(componentId: string): {
    totalFailures: number;
    averageDowntime: number;
    reliability: number;
    availability: number;
  } {
    const componentState = this.componentStates.get(componentId);
    if (!componentState) {
      return { totalFailures: 0, averageDowntime: 0, reliability: 1.0, availability: 1.0 };
    }

    const totalFailures = componentState.failureHistory.length;
    const totalDowntime = componentState.failureHistory.reduce(
      (sum, failure) => sum + (failure.endTime - failure.startTime) + failure.recoveryTime, 0
    );
    const averageDowntime = totalFailures > 0 ? totalDowntime / totalFailures : 0;
    
    // Calculate reliability (MTBF / (MTBF + MTTR))
    const reliability = componentState.mtbf / (componentState.mtbf + componentState.mttr);
    
    // Calculate availability (uptime / total time)
    const currentTime = Date.now();
    const totalTime = currentTime - (componentState.failureHistory[0]?.startTime || currentTime);
    const availability = totalTime > 0 ? (totalTime - totalDowntime) / totalTime : 1.0;

    return {
      totalFailures,
      averageDowntime,
      reliability: Math.max(0, Math.min(1, reliability)),
      availability: Math.max(0, Math.min(1, availability))
    };
  }

  /**
   * Calculate Mean Time Between Failures based on component type
   */
  private calculateMTBF(componentType: string): number {
    const baseMTBF: Record<string, number> = {
      'database': 720000,      // 12 hours
      'web-server': 360000,    // 6 hours
      'load-balancer': 1440000, // 24 hours
      'cache': 480000,         // 8 hours
      'message-queue': 600000, // 10 hours
      'cdn': 2160000,          // 36 hours
      'proxy': 720000          // 12 hours
    };

    return baseMTBF[componentType] || 600000; // Default 10 hours
  }

  /**
   * Calculate Mean Time To Recovery based on component type
   */
  private calculateMTTR(componentType: string): number {
    const baseMTTR: Record<string, number> = {
      'database': 300000,      // 5 minutes
      'web-server': 120000,    // 2 minutes
      'load-balancer': 180000, // 3 minutes
      'cache': 60000,          // 1 minute
      'message-queue': 240000, // 4 minutes
      'cdn': 600000,           // 10 minutes
      'proxy': 150000          // 2.5 minutes
    };

    return baseMTTR[componentType] || 180000; // Default 3 minutes
  }

  /**
   * Get metrics affected by a specific failure type
   */
  private getAffectedMetrics(failureType: FailureType): string[] {
    const metricMap: Record<FailureType, string[]> = {
      'crash': ['availability', 'errorRate', 'responseTime'],
      'performance': ['responseTime', 'throughput', 'cpuUtilization'],
      'network': ['responseTime', 'errorRate', 'networkLatency'],
      'resource': ['responseTime', 'cpuUtilization', 'memoryUtilization'],
      'dependency': ['availability', 'errorRate', 'responseTime'],
      'timeout': ['responseTime', 'errorRate', 'throughput'],
      'partial': ['throughput', 'availability', 'responseTime']
    };

    return metricMap[failureType] || [];
  }
}

/**
 * Factory for creating failure managers with different configurations
 */
export class FailureManagerFactory {
  static createManager(config: {
    enableRandomFailures?: boolean;
    failureRate?: number;
    recoveryRate?: number;
  } = {}): FailureManager {
    const manager = new FailureManager();
    
    // Apply configuration if needed
    // This could be extended to customize failure models based on config
    
    return manager;
  }
}