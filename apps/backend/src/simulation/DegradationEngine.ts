/**
 * Degradation Engine - Models realistic degradation patterns when capacity is exceeded
 * 
 * Implements Requirements 6.3, 6.5 from the SRS:
 * - Model degradation patterns when capacity is exceeded (increased latency, dropped requests, cascading failures)
 * - Add dynamic reconfiguration during simulation without restart
 * - Create performance curve modeling for each component type
 */

import { EventEmitter } from 'events';
import { SystemGraphNode, SystemComponentType, DegradationModel, DegradationThreshold } from './SystemGraphEngine';

// Degradation state for a component
export interface ComponentDegradationState {
  componentId: string;
  currentUtilization: number; // 0-1
  activeDegradation: DegradationThreshold | null;
  degradationHistory: DegradationEvent[];
  performanceMultipliers: PerformanceMultipliers;
  lastUpdated: number;
}

// Performance multipliers applied due to degradation
export interface PerformanceMultipliers {
  latency: number; // multiplier for base latency
  throughput: number; // multiplier for throughput
  errorRate: number; // additional error rate (0-1)
  availability: number; // availability multiplier (0-1)
}

// Degradation event for tracking history
export interface DegradationEvent {
  timestamp: number;
  utilizationPercent: number;
  degradationType: 'graceful' | 'cliff' | 'cascading';
  severity: 'mild' | 'moderate' | 'severe' | 'critical';
  multipliers: PerformanceMultipliers;
  triggerReason: string;
}

// Cascading failure propagation
export interface CascadingFailure {
  originComponentId: string;
  affectedComponents: string[];
  propagationPath: string[];
  severity: number; // 0-1
  startTime: number;
  isActive: boolean;
}

// Dynamic reconfiguration request
export interface ReconfigurationRequest {
  componentId: string;
  newConfiguration: Partial<ComponentConfiguration>;
  reason: string;
  timestamp: number;
}

// Component configuration that can be dynamically updated
export interface ComponentConfiguration {
  capacityLimit: number;
  baseLatency: number;
  maxThroughput: number;
  degradationThresholds: DegradationThreshold[];
  autoScalingEnabled: boolean;
  autoScalingThreshold: number; // utilization threshold for auto-scaling
}

// Performance curve calculation result
export interface PerformanceCurvePoint {
  utilization: number; // 0-1
  latencyMultiplier: number;
  throughputMultiplier: number;
  errorRate: number;
  availability: number;
}

/**
 * Degradation Engine - Manages component degradation and performance curves
 */
export class DegradationEngine extends EventEmitter {
  private componentStates: Map<string, ComponentDegradationState> = new Map();
  private cascadingFailures: Map<string, CascadingFailure> = new Map();
  private performanceCurves: Map<string, PerformanceCurvePoint[]> = new Map();
  private reconfigurationQueue: ReconfigurationRequest[] = [];
  private isRunning: boolean = false;

  constructor() {
    super();
  }

  /**
   * Initialize degradation tracking for a component
   */
  initializeComponent(node: SystemGraphNode): void {
    const state: ComponentDegradationState = {
      componentId: node.id,
      currentUtilization: node.currentUtilization,
      activeDegradation: null,
      degradationHistory: [],
      performanceMultipliers: {
        latency: 1.0,
        throughput: 1.0,
        errorRate: 0.0,
        availability: 1.0
      },
      lastUpdated: Date.now()
    };

    this.componentStates.set(node.id, state);
    
    // Pre-calculate performance curve for this component
    this.calculatePerformanceCurve(node);
    
    this.emit('component_initialized', { componentId: node.id, type: node.type });
  }

  /**
   * Update component utilization and recalculate degradation
   */
  updateComponentUtilization(componentId: string, utilization: number, node: SystemGraphNode): void {
    const state = this.componentStates.get(componentId);
    if (!state) return;

    const previousUtilization = state.currentUtilization;
    state.currentUtilization = utilization;
    state.lastUpdated = Date.now();

    // Calculate new degradation state
    const newDegradation = this.calculateDegradation(node, utilization);
    const previousDegradation = state.activeDegradation;

    // Check if degradation state changed
    if (this.isDegradationChanged(previousDegradation, newDegradation)) {
      state.activeDegradation = newDegradation;
      
      // Update performance multipliers
      if (newDegradation) {
        state.performanceMultipliers = {
          latency: newDegradation.latencyMultiplier,
          throughput: newDegradation.throughputMultiplier,
          errorRate: newDegradation.errorRateIncrease,
          availability: Math.max(0, 1 - newDegradation.errorRateIncrease)
        };
      } else {
        // Reset to baseline performance
        state.performanceMultipliers = {
          latency: 1.0,
          throughput: 1.0,
          errorRate: 0.0,
          availability: 1.0
        };
      }

      // Record degradation event
      const event: DegradationEvent = {
        timestamp: Date.now(),
        utilizationPercent: utilization * 100,
        degradationType: node.characteristics.degradationModel.type,
        severity: this.calculateSeverity(utilization),
        multipliers: { ...state.performanceMultipliers },
        triggerReason: this.getDegradationReason(previousUtilization, utilization)
      };

      state.degradationHistory.push(event);
      
      // Keep only last 100 events
      if (state.degradationHistory.length > 100) {
        state.degradationHistory = state.degradationHistory.slice(-100);
      }

      this.emit('degradation_changed', {
        componentId,
        previousDegradation,
        newDegradation,
        event
      });

      // Check for cascading failure conditions
      if (newDegradation && this.shouldTriggerCascadingFailure(node, newDegradation)) {
        this.triggerCascadingFailure(componentId, node, newDegradation);
      }
    }
  }

  /**
   * Get current degradation state for a component
   */
  getComponentDegradationState(componentId: string): ComponentDegradationState | null {
    return this.componentStates.get(componentId) || null;
  }

  /**
   * Get performance multipliers for a component
   */
  getPerformanceMultipliers(componentId: string): PerformanceMultipliers {
    const state = this.componentStates.get(componentId);
    return state ? state.performanceMultipliers : {
      latency: 1.0,
      throughput: 1.0,
      errorRate: 0.0,
      availability: 1.0
    };
  }

  /**
   * Get performance curve for a component
   */
  getPerformanceCurve(componentId: string): PerformanceCurvePoint[] {
    return this.performanceCurves.get(componentId) || [];
  }

  /**
   * Request dynamic reconfiguration of a component
   * Implements Requirement 6.5
   */
  requestReconfiguration(request: ReconfigurationRequest): boolean {
    // Validate the reconfiguration request
    if (!this.validateReconfigurationRequest(request)) {
      this.emit('reconfiguration_rejected', { request, reason: 'Invalid configuration' });
      return false;
    }

    this.reconfigurationQueue.push(request);
    
    this.emit('reconfiguration_requested', { request });
    
    // Process immediately if simulation is running
    if (this.isRunning) {
      this.processReconfigurationQueue();
    }
    
    return true;
  }

  /**
   * Apply dynamic reconfiguration without stopping simulation
   */
  applyReconfiguration(componentId: string, newConfig: Partial<ComponentConfiguration>, node: SystemGraphNode): boolean {
    try {
      // Update component characteristics
      if (newConfig.capacityLimit !== undefined) {
        node.characteristics.capacityLimit = newConfig.capacityLimit;
      }
      if (newConfig.baseLatency !== undefined) {
        node.characteristics.baseLatency = newConfig.baseLatency;
      }
      if (newConfig.maxThroughput !== undefined) {
        node.characteristics.maxThroughput = newConfig.maxThroughput;
      }
      if (newConfig.degradationThresholds !== undefined) {
        node.characteristics.degradationModel.thresholds = newConfig.degradationThresholds;
      }

      // Recalculate performance curve with new configuration
      this.calculatePerformanceCurve(node);
      
      // Update current degradation state
      const state = this.componentStates.get(componentId);
      if (state) {
        this.updateComponentUtilization(componentId, state.currentUtilization, node);
      }

      this.emit('reconfiguration_applied', {
        componentId,
        newConfig,
        timestamp: Date.now()
      });

      return true;
    } catch (error) {
      this.emit('reconfiguration_failed', {
        componentId,
        newConfig,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Get all active cascading failures
   */
  getActiveCascadingFailures(): CascadingFailure[] {
    return Array.from(this.cascadingFailures.values()).filter(failure => failure.isActive);
  }

  /**
   * Start the degradation engine
   */
  start(): void {
    this.isRunning = true;
    this.processReconfigurationQueue();
    this.emit('degradation_engine_started');
  }

  /**
   * Stop the degradation engine
   */
  stop(): void {
    this.isRunning = false;
    
    // Deactivate all cascading failures
    for (const failure of this.cascadingFailures.values()) {
      failure.isActive = false;
    }
    
    this.emit('degradation_engine_stopped');
  }

  /**
   * Clear all degradation state
   */
  clear(): void {
    this.componentStates.clear();
    this.cascadingFailures.clear();
    this.performanceCurves.clear();
    this.reconfigurationQueue = [];
    this.emit('degradation_engine_cleared');
  }

  // Private helper methods

  /**
   * Calculate degradation for a component at given utilization
   */
  private calculateDegradation(node: SystemGraphNode, utilization: number): DegradationThreshold | null {
    const utilizationPercent = utilization * 100;
    const thresholds = node.characteristics.degradationModel.thresholds;

    // Find the highest applicable threshold
    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (utilizationPercent >= thresholds[i].utilizationPercent) {
        return thresholds[i];
      }
    }

    return null;
  }

  /**
   * Check if degradation state has changed significantly
   */
  private isDegradationChanged(previous: DegradationThreshold | null, current: DegradationThreshold | null): boolean {
    if (previous === null && current === null) return false;
    if (previous === null || current === null) return true;
    
    return previous.utilizationPercent !== current.utilizationPercent ||
           previous.latencyMultiplier !== current.latencyMultiplier ||
           previous.throughputMultiplier !== current.throughputMultiplier ||
           previous.errorRateIncrease !== current.errorRateIncrease;
  }

  /**
   * Calculate severity based on utilization
   */
  private calculateSeverity(utilization: number): 'mild' | 'moderate' | 'severe' | 'critical' {
    if (utilization < 0.7) return 'mild';
    if (utilization < 0.85) return 'moderate';
    if (utilization < 0.95) return 'severe';
    return 'critical';
  }

  /**
   * Get degradation reason based on utilization change
   */
  private getDegradationReason(previousUtilization: number, currentUtilization: number): string {
    const change = currentUtilization - previousUtilization;
    
    if (change > 0.2) return 'Sudden load spike';
    if (change > 0.1) return 'Gradual load increase';
    if (change < -0.2) return 'Load drop - recovery';
    if (change < -0.1) return 'Load decrease';
    if (currentUtilization > 0.9) return 'High sustained load';
    if (currentUtilization > 0.8) return 'Elevated load';
    
    return 'Normal operation';
  }

  /**
   * Check if cascading failure should be triggered
   */
  private shouldTriggerCascadingFailure(node: SystemGraphNode, degradation: DegradationThreshold): boolean {
    return node.characteristics.degradationModel.type === 'cascading' &&
           degradation.utilizationPercent >= 85 &&
           degradation.errorRateIncrease >= 0.1;
  }

  /**
   * Trigger cascading failure
   */
  private triggerCascadingFailure(componentId: string, node: SystemGraphNode, degradation: DegradationThreshold): void {
    const cascadingFailure: CascadingFailure = {
      originComponentId: componentId,
      affectedComponents: [componentId],
      propagationPath: [componentId],
      severity: degradation.errorRateIncrease,
      startTime: Date.now(),
      isActive: true
    };

    // Find components that could be affected (connected components)
    const affectedComponents = this.findAffectedComponents(node);
    cascadingFailure.affectedComponents.push(...affectedComponents);

    this.cascadingFailures.set(`cascade_${componentId}_${Date.now()}`, cascadingFailure);

    this.emit('cascading_failure_triggered', {
      originComponent: componentId,
      affectedComponents,
      severity: cascadingFailure.severity
    });

    // Apply degradation to affected components
    for (const affectedId of affectedComponents) {
      const affectedState = this.componentStates.get(affectedId);
      if (affectedState) {
        // Increase utilization of affected components
        const additionalLoad = cascadingFailure.severity * 0.3; // 30% of severity as additional load
        affectedState.currentUtilization = Math.min(1.0, affectedState.currentUtilization + additionalLoad);
      }
    }
  }

  /**
   * Find components that could be affected by cascading failure
   */
  private findAffectedComponents(node: SystemGraphNode): string[] {
    const affected: string[] = [];
    
    // Add upstream components (those that send requests to this component)
    for (const edge of node.incomingEdges) {
      affected.push(edge.sourceNodeId);
    }
    
    // Add downstream components (those that receive requests from this component)
    for (const edge of node.outgoingEdges) {
      affected.push(edge.targetNodeId);
    }
    
    return affected;
  }

  /**
   * Calculate performance curve for a component
   */
  private calculatePerformanceCurve(node: SystemGraphNode): void {
    const curve: PerformanceCurvePoint[] = [];
    const steps = 100; // 100 points from 0% to 100% utilization

    for (let i = 0; i <= steps; i++) {
      const utilization = i / steps;
      const degradation = this.calculateDegradation(node, utilization);
      
      let latencyMultiplier = 1.0;
      let throughputMultiplier = 1.0;
      let errorRate = 0.0;
      let availability = 1.0;

      if (degradation) {
        latencyMultiplier = degradation.latencyMultiplier;
        throughputMultiplier = degradation.throughputMultiplier;
        errorRate = degradation.errorRateIncrease;
        availability = Math.max(0, 1 - errorRate);
      }

      curve.push({
        utilization,
        latencyMultiplier,
        throughputMultiplier,
        errorRate,
        availability
      });
    }

    this.performanceCurves.set(node.id, curve);
  }

  /**
   * Validate reconfiguration request
   */
  private validateReconfigurationRequest(request: ReconfigurationRequest): boolean {
    const { newConfiguration } = request;
    
    // Validate capacity limit
    if (newConfiguration.capacityLimit !== undefined) {
      if (newConfiguration.capacityLimit <= 0 || newConfiguration.capacityLimit > 100000) {
        return false;
      }
    }
    
    // Validate base latency
    if (newConfiguration.baseLatency !== undefined) {
      if (newConfiguration.baseLatency < 0 || newConfiguration.baseLatency > 60000) {
        return false;
      }
    }
    
    // Validate max throughput
    if (newConfiguration.maxThroughput !== undefined) {
      if (newConfiguration.maxThroughput <= 0 || newConfiguration.maxThroughput > 1000000) {
        return false;
      }
    }
    
    // Validate degradation thresholds
    if (newConfiguration.degradationThresholds !== undefined) {
      for (const threshold of newConfiguration.degradationThresholds) {
        if (threshold.utilizationPercent < 0 || threshold.utilizationPercent > 100 ||
            threshold.latencyMultiplier < 0.1 || threshold.latencyMultiplier > 100 ||
            threshold.throughputMultiplier < 0.01 || threshold.throughputMultiplier > 10 ||
            threshold.errorRateIncrease < 0 || threshold.errorRateIncrease > 1) {
          return false;
        }
      }
    }
    
    return true;
  }

  /**
   * Process pending reconfiguration requests
   */
  private processReconfigurationQueue(): void {
    while (this.reconfigurationQueue.length > 0) {
      const request = this.reconfigurationQueue.shift()!;
      
      this.emit('processing_reconfiguration', { request });
      
      // Note: Actual application requires access to the SystemGraphEngine
      // This would be handled by the parent engine that owns both components
    }
  }
}