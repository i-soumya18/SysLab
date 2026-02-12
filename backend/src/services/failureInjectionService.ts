/**
 * Failure Injection Service implementing SRS FR-6
 * 
 * Implements component disable functionality per SRS FR-6.1
 * Adds partial failure and degraded mode simulation per SRS FR-6.1
 * Creates failure impact propagation per SRS FR-6.1
 */

import { Request, Response } from 'express';
import { FailureManager, FailureType, ActiveFailure, ComponentFailureState } from '../simulation/FailureManager';
import { FailureScenario } from '../types';

// Enhanced failure types for SRS FR-6
export type EnhancedFailureType = 
  | 'component_disable'     // Complete component shutdown per SRS FR-6.1
  | 'partial_failure'       // Partial functionality loss per SRS FR-6.1
  | 'degraded_mode'         // Performance degradation per SRS FR-6.1
  | 'network_latency'       // Network latency injection per SRS FR-6.2
  | 'latency_spike'         // Sudden latency increases per SRS FR-6.2
  | 'packet_loss'           // Network packet loss per SRS FR-6.2
  | 'jitter'                // Network jitter per SRS FR-6.2
  | 'network_partition'     // Network partition per SRS FR-6.3
  | 'split_brain'           // Split-brain condition per SRS FR-6.3
  | 'partition_recovery'    // Partition recovery per SRS FR-6.3
  | 'regional_outage'       // Multi-component regional failure per SRS FR-6.4
  | 'geographic_failure'    // Geographic failure pattern per SRS FR-6.4
  | 'disaster_recovery';    // Disaster recovery scenario per SRS FR-6.4

// Failure injection configuration
export interface FailureInjectionConfig {
  componentId: string;
  failureType: EnhancedFailureType;
  severity: number; // 0.0 to 1.0
  duration: number; // milliseconds
  startDelay?: number; // milliseconds before failure starts
  recoveryType: 'automatic' | 'manual' | 'gradual';
  recoveryDuration?: number; // milliseconds for gradual recovery
  cascadeToComponents?: string[]; // components affected by cascade
  metadata?: {
    description?: string;
    reason?: string;
    expectedImpact?: string;
    mitigationSteps?: string[];
  };
}

// Partial failure configuration
export interface PartialFailureConfig {
  affectedFunctions: string[]; // which functions are affected
  functionalityReduction: number; // 0.0 to 1.0 - how much functionality is lost
  errorRateIncrease: number; // additional error rate
  performanceImpact: number; // performance degradation multiplier
  intermittentFailure: boolean; // whether failure is intermittent
  intermittentPattern?: {
    failureDuration: number; // ms
    recoveryDuration: number; // ms
    cycles: number; // how many fail/recover cycles
  };
}

// Degraded mode configuration
export interface DegradedModeConfig {
  performanceReduction: number; // 0.0 to 1.0 - performance reduction
  featureDisabling: string[]; // features to disable
  resourceLimitation: {
    cpu?: number; // CPU limit multiplier
    memory?: number; // Memory limit multiplier
    network?: number; // Network bandwidth multiplier
    storage?: number; // Storage IOPS multiplier
  };
  gracefulDegradation: boolean; // whether to degrade gracefully
  fallbackBehavior?: string; // fallback behavior description
}

// Network failure configuration
export interface NetworkFailureConfig {
  latencyIncrease: number; // additional latency in ms
  packetLossRate: number; // 0.0 to 1.0
  jitterRange: number; // jitter range in ms
  bandwidthReduction: number; // 0.0 to 1.0 - bandwidth reduction
  affectedConnections: string[]; // connection IDs affected
  bidirectional: boolean; // whether failure affects both directions
}

// Regional outage configuration
export interface RegionalOutageConfig {
  region: string; // region identifier
  affectedComponents: string[]; // components in the region
  outageType: 'power' | 'network' | 'datacenter' | 'natural_disaster';
  cascadeDelay: number; // ms delay between component failures
  recoveryOrder: string[]; // order of component recovery
  partialRecovery: boolean; // whether recovery is partial initially
}

// Failure injection result
export interface FailureInjectionResult {
  injectionId: string;
  componentId: string;
  failureType: EnhancedFailureType;
  status: 'scheduled' | 'active' | 'recovering' | 'completed' | 'failed';
  startTime: number;
  expectedEndTime: number;
  actualEndTime?: number;
  impactedComponents: string[];
  metrics: {
    requestsAffected: number;
    errorRateIncrease: number;
    latencyIncrease: number;
    throughputReduction: number;
  };
  recoveryProgress: number; // 0.0 to 1.0
}

// Failure impact propagation
export interface FailureImpactPropagation {
  originComponent: string;
  propagationPath: string[];
  impactedComponents: Map<string, {
    impactType: 'direct' | 'indirect' | 'cascade';
    severity: number;
    delay: number; // ms delay from origin failure
    recoveryDependency: string[]; // components that must recover first
  }>;
  totalImpactRadius: number; // number of components affected
  criticalPathAffected: boolean; // whether critical path is affected
}

/**
 * Failure Injection Service
 * Implements SRS FR-6.1, FR-6.2, FR-6.3, FR-6.4, FR-6.5
 */
export class FailureInjectionService {
  private failureManager: FailureManager;
  private activeInjections: Map<string, FailureInjectionResult>;
  private injectionHistory: FailureInjectionResult[];
  private componentDependencies: Map<string, string[]>;
  private regionalMappings: Map<string, string[]>;

  constructor() {
    this.failureManager = new FailureManager();
    this.activeInjections = new Map();
    this.injectionHistory = [];
    this.componentDependencies = new Map();
    this.regionalMappings = new Map();
  }

  /**
   * Inject component failure per SRS FR-6.1
   * Implements component disable functionality, partial failure, and degraded mode simulation
   */
  public static async injectComponentFailure(req: Request, res: Response): Promise<void> {
    try {
      const { componentId } = req.params;
      const config: FailureInjectionConfig = req.body;

      if (!componentId || !config) {
        res.status(400).json({
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: 'Component ID and failure configuration are required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      // Validate failure configuration
      const validationError = FailureInjectionService.validateFailureConfig(config);
      if (validationError) {
        res.status(400).json({
          error: {
            code: 'INVALID_CONFIGURATION',
            message: validationError,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const service = FailureInjectionService.getInstance();
      const result = await service.executeFailureInjection(componentId, config);

      res.json({
        success: true,
        injectionId: result.injectionId,
        componentId,
        failureType: config.failureType,
        result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INJECTION_FAILED',
          message: 'Failed to inject component failure',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  /**
   * Inject network latency per SRS FR-6.2
   * Creates configurable network latency injection, latency spikes, and packet loss
   */
  public static async injectNetworkLatency(req: Request, res: Response): Promise<void> {
    try {
      const { componentId } = req.params;
      const networkConfig: NetworkFailureConfig = req.body;

      if (!componentId || !networkConfig) {
        res.status(400).json({
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: 'Component ID and network failure configuration are required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const service = FailureInjectionService.getInstance();
      const result = await service.executeNetworkFailureInjection(componentId, networkConfig);

      res.json({
        success: true,
        injectionId: result.injectionId,
        componentId,
        failureType: 'network_latency',
        networkConfig,
        result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'NETWORK_INJECTION_FAILED',
          message: 'Failed to inject network latency',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  /**
   * Simulate network partition per SRS FR-6.3
   * Implements network partition scenarios and split-brain condition modeling
   */
  public static async simulateNetworkPartition(req: Request, res: Response): Promise<void> {
    try {
      const { partitionConfig } = req.body;

      if (!partitionConfig || !partitionConfig.partitionGroups) {
        res.status(400).json({
          error: {
            code: 'MISSING_PARTITION_CONFIG',
            message: 'Partition configuration with partition groups is required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const service = FailureInjectionService.getInstance();
      const result = await service.executeNetworkPartition(partitionConfig);

      res.json({
        success: true,
        partitionId: result.injectionId,
        partitionGroups: partitionConfig.partitionGroups,
        result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'PARTITION_FAILED',
          message: 'Failed to simulate network partition',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  /**
   * Simulate regional outage per SRS FR-6.4
   * Creates multi-component regional failure and geographic failure patterns
   */
  public static async simulateRegionalOutage(req: Request, res: Response): Promise<void> {
    try {
      const { region } = req.params;
      const outageConfig: RegionalOutageConfig = req.body;

      if (!region || !outageConfig) {
        res.status(400).json({
          error: {
            code: 'MISSING_OUTAGE_CONFIG',
            message: 'Region and outage configuration are required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const service = FailureInjectionService.getInstance();
      const result = await service.executeRegionalOutage(region, outageConfig);

      res.json({
        success: true,
        outageId: result.injectionId,
        region,
        outageType: outageConfig.outageType,
        affectedComponents: outageConfig.affectedComponents,
        result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'REGIONAL_OUTAGE_FAILED',
          message: 'Failed to simulate regional outage',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  /**
   * Get failure injection status
   */
  public static getInjectionStatus(req: Request, res: Response): void {
    try {
      const { injectionId } = req.params;

      if (!injectionId) {
        res.status(400).json({
          error: {
            code: 'MISSING_INJECTION_ID',
            message: 'Injection ID is required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const service = FailureInjectionService.getInstance();
      const status = service.getInjectionStatus(injectionId);

      if (!status) {
        res.status(404).json({
          error: {
            code: 'INJECTION_NOT_FOUND',
            message: `Failure injection '${injectionId}' not found`,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      res.json({
        injectionId,
        status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'STATUS_RETRIEVAL_FAILED',
          message: 'Failed to retrieve injection status',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  /**
   * Stop failure injection
   */
  public static async stopInjection(req: Request, res: Response): Promise<void> {
    try {
      const { injectionId } = req.params;
      const { recoveryType = 'automatic' } = req.body;

      if (!injectionId) {
        res.status(400).json({
          error: {
            code: 'MISSING_INJECTION_ID',
            message: 'Injection ID is required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const service = FailureInjectionService.getInstance();
      const result = await service.stopInjection(injectionId, recoveryType);

      res.json({
        success: true,
        injectionId,
        recoveryType,
        result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'STOP_INJECTION_FAILED',
          message: 'Failed to stop failure injection',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  /**
   * Get active injections
   */
  public static getActiveInjections(req: Request, res: Response): void {
    try {
      const service = FailureInjectionService.getInstance();
      const activeInjections = service.getActiveInjections();

      res.json({
        activeInjections: Array.from(activeInjections.values()),
        count: activeInjections.size,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'ACTIVE_INJECTIONS_FAILED',
          message: 'Failed to retrieve active injections',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  /**
   * Get failure impact analysis per SRS FR-6.5
   * Creates recovery pattern observation and recovery time tracking
   */
  public static getFailureImpactAnalysis(req: Request, res: Response): void {
    try {
      const { componentId } = req.params;

      if (!componentId) {
        res.status(400).json({
          error: {
            code: 'MISSING_COMPONENT_ID',
            message: 'Component ID is required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const service = FailureInjectionService.getInstance();
      const analysis = service.getFailureImpactAnalysis(componentId);

      res.json({
        componentId,
        analysis,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'IMPACT_ANALYSIS_FAILED',
          message: 'Failed to retrieve failure impact analysis',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  // Private implementation methods

  private static instance: FailureInjectionService;

  private static getInstance(): FailureInjectionService {
    if (!FailureInjectionService.instance) {
      FailureInjectionService.instance = new FailureInjectionService();
    }
    return FailureInjectionService.instance;
  }

  private static validateFailureConfig(config: FailureInjectionConfig): string | null {
    if (!config.componentId) return 'Component ID is required';
    if (!config.failureType) return 'Failure type is required';
    if (config.severity < 0 || config.severity > 1) return 'Severity must be between 0 and 1';
    if (config.duration <= 0) return 'Duration must be positive';
    if (config.startDelay && config.startDelay < 0) return 'Start delay cannot be negative';
    if (config.recoveryDuration && config.recoveryDuration <= 0) return 'Recovery duration must be positive';
    return null;
  }

  private async executeFailureInjection(componentId: string, config: FailureInjectionConfig): Promise<FailureInjectionResult> {
    const injectionId = `injection_${componentId}_${Date.now()}`;
    const currentTime = Date.now();
    const startTime = currentTime + (config.startDelay || 0);
    const expectedEndTime = startTime + config.duration;

    // Create failure scenario for the failure manager
    const failureScenario: FailureScenario = {
      componentId,
      failureType: this.mapToBasicFailureType(config.failureType),
      startTime,
      duration: config.duration,
      severity: config.severity
    };

    // Initialize component in failure manager if not already done
    this.failureManager.initializeComponent(componentId, 'generic');

    // Inject the failure
    const activeFailure = this.failureManager.injectFailure(failureScenario, startTime);

    if (!activeFailure) {
      throw new Error(`Failed to inject failure for component ${componentId}`);
    }

    // Calculate impact propagation
    const impactPropagation = this.calculateFailureImpactPropagation(componentId, config);

    // Create injection result
    const result: FailureInjectionResult = {
      injectionId,
      componentId,
      failureType: config.failureType,
      status: config.startDelay ? 'scheduled' : 'active',
      startTime,
      expectedEndTime,
      impactedComponents: Array.from(impactPropagation.impactedComponents.keys()),
      metrics: {
        requestsAffected: 0,
        errorRateIncrease: config.severity,
        latencyIncrease: config.severity * 1000, // ms
        throughputReduction: config.severity * 0.5
      },
      recoveryProgress: 0
    };

    // Store active injection
    this.activeInjections.set(injectionId, result);

    // Schedule failure start if delayed
    if (config.startDelay) {
      setTimeout(() => {
        const injection = this.activeInjections.get(injectionId);
        if (injection) {
          injection.status = 'active';
        }
      }, config.startDelay);
    }

    // Schedule failure end and recovery
    setTimeout(() => {
      this.startFailureRecovery(injectionId, config);
    }, (config.startDelay || 0) + config.duration);

    return result;
  }

  private async executeNetworkFailureInjection(componentId: string, networkConfig: NetworkFailureConfig): Promise<FailureInjectionResult> {
    const injectionId = `network_injection_${componentId}_${Date.now()}`;
    const currentTime = Date.now();

    // Create network failure configuration
    const config: FailureInjectionConfig = {
      componentId,
      failureType: 'network_latency',
      severity: Math.max(
        networkConfig.latencyIncrease / 1000, // normalize latency to 0-1
        networkConfig.packetLossRate,
        networkConfig.bandwidthReduction
      ),
      duration: 60000, // Default 1 minute
      recoveryType: 'automatic'
    };

    return this.executeFailureInjection(componentId, config);
  }

  private async executeNetworkPartition(partitionConfig: any): Promise<FailureInjectionResult> {
    const injectionId = `partition_${Date.now()}`;
    const currentTime = Date.now();

    // Simulate network partition by injecting failures on connections between partition groups
    const partitionGroups = partitionConfig.partitionGroups as string[][];
    const affectedComponents: string[] = [];

    // For each pair of partition groups, inject network failures
    for (let i = 0; i < partitionGroups.length; i++) {
      for (let j = i + 1; j < partitionGroups.length; j++) {
        const group1 = partitionGroups[i];
        const group2 = partitionGroups[j];
        
        // Add all components from both groups to affected list
        affectedComponents.push(...group1, ...group2);
      }
    }

    const result: FailureInjectionResult = {
      injectionId,
      componentId: 'network_partition',
      failureType: 'network_partition',
      status: 'active',
      startTime: currentTime,
      expectedEndTime: currentTime + (partitionConfig.duration || 300000), // 5 minutes default
      impactedComponents: [...new Set(affectedComponents)], // remove duplicates
      metrics: {
        requestsAffected: 0,
        errorRateIncrease: 0.8, // High error rate during partition
        latencyIncrease: 30000, // 30 second timeout
        throughputReduction: 0.9 // Severe throughput reduction
      },
      recoveryProgress: 0
    };

    this.activeInjections.set(injectionId, result);
    return result;
  }

  private async executeRegionalOutage(region: string, outageConfig: RegionalOutageConfig): Promise<FailureInjectionResult> {
    const injectionId = `regional_outage_${region}_${Date.now()}`;
    const currentTime = Date.now();

    // Inject failures on all components in the region with cascade delay
    const cascadePromises = outageConfig.affectedComponents.map((componentId, index) => {
      const delay = index * outageConfig.cascadeDelay;
      
      return new Promise<void>((resolve) => {
        setTimeout(async () => {
          const componentConfig: FailureInjectionConfig = {
            componentId,
            failureType: 'component_disable',
            severity: 1.0, // Complete failure
            duration: 600000, // 10 minutes default
            recoveryType: 'manual'
          };
          
          await this.executeFailureInjection(componentId, componentConfig);
          resolve();
        }, delay);
      });
    });

    const result: FailureInjectionResult = {
      injectionId,
      componentId: `region_${region}`,
      failureType: 'regional_outage',
      status: 'active',
      startTime: currentTime,
      expectedEndTime: currentTime + 600000, // 10 minutes
      impactedComponents: outageConfig.affectedComponents,
      metrics: {
        requestsAffected: 0,
        errorRateIncrease: 1.0, // Complete failure
        latencyIncrease: 0, // No latency, complete failure
        throughputReduction: 1.0 // Complete throughput loss
      },
      recoveryProgress: 0
    };

    this.activeInjections.set(injectionId, result);

    // Execute cascade failures
    Promise.all(cascadePromises).catch(error => {
      console.error('Error during regional outage cascade:', error);
    });

    return result;
  }

  private startFailureRecovery(injectionId: string, config: FailureInjectionConfig): void {
    const injection = this.activeInjections.get(injectionId);
    if (!injection) return;

    injection.status = 'recovering';
    injection.actualEndTime = Date.now();

    if (config.recoveryType === 'automatic') {
      // Immediate recovery
      setTimeout(() => {
        this.completeRecovery(injectionId);
      }, 1000); // 1 second recovery time
    } else if (config.recoveryType === 'gradual' && config.recoveryDuration) {
      // Gradual recovery
      this.startGradualRecovery(injectionId, config.recoveryDuration);
    }
    // Manual recovery requires explicit call to stopInjection
  }

  private startGradualRecovery(injectionId: string, recoveryDuration: number): void {
    const injection = this.activeInjections.get(injectionId);
    if (!injection) return;

    const recoverySteps = 10;
    const stepDuration = recoveryDuration / recoverySteps;

    let currentStep = 0;
    const recoveryInterval = setInterval(() => {
      currentStep++;
      injection.recoveryProgress = currentStep / recoverySteps;

      if (currentStep >= recoverySteps) {
        clearInterval(recoveryInterval);
        this.completeRecovery(injectionId);
      }
    }, stepDuration);
  }

  private completeRecovery(injectionId: string): void {
    const injection = this.activeInjections.get(injectionId);
    if (!injection) return;

    injection.status = 'completed';
    injection.recoveryProgress = 1.0;
    injection.actualEndTime = Date.now();

    // Move to history
    this.injectionHistory.push(injection);
    this.activeInjections.delete(injectionId);

    // Process recovery in failure manager
    this.failureManager.processRecovery(injection.componentId, Date.now());
  }

  private calculateFailureImpactPropagation(componentId: string, config: FailureInjectionConfig): FailureImpactPropagation {
    const impactedComponents = new Map<string, any>();
    const propagationPath = [componentId];

    // Add direct impact
    impactedComponents.set(componentId, {
      impactType: 'direct',
      severity: config.severity,
      delay: 0,
      recoveryDependency: []
    });

    // Add cascade components if specified
    if (config.cascadeToComponents) {
      config.cascadeToComponents.forEach((cascadeId, index) => {
        impactedComponents.set(cascadeId, {
          impactType: 'cascade',
          severity: config.severity * 0.7, // Reduced severity for cascade
          delay: (index + 1) * 5000, // 5 second delay between cascades
          recoveryDependency: [componentId]
        });
        propagationPath.push(cascadeId);
      });
    }

    // Add dependent components from dependency map
    const dependencies = this.componentDependencies.get(componentId) || [];
    dependencies.forEach(depId => {
      if (!impactedComponents.has(depId)) {
        impactedComponents.set(depId, {
          impactType: 'indirect',
          severity: config.severity * 0.5, // Reduced severity for indirect impact
          delay: 2000, // 2 second delay for indirect impact
          recoveryDependency: [componentId]
        });
        propagationPath.push(depId);
      }
    });

    return {
      originComponent: componentId,
      propagationPath,
      impactedComponents,
      totalImpactRadius: impactedComponents.size,
      criticalPathAffected: this.isCriticalPathAffected(Array.from(impactedComponents.keys()))
    };
  }

  private mapToBasicFailureType(enhancedType: EnhancedFailureType): string {
    const mapping: Record<EnhancedFailureType, string> = {
      'component_disable': 'crash',
      'partial_failure': 'partial',
      'degraded_mode': 'performance',
      'network_latency': 'network',
      'latency_spike': 'network',
      'packet_loss': 'network',
      'jitter': 'network',
      'network_partition': 'network',
      'split_brain': 'dependency',
      'partition_recovery': 'network',
      'regional_outage': 'crash',
      'geographic_failure': 'dependency',
      'disaster_recovery': 'crash'
    };
    return mapping[enhancedType] || 'crash';
  }

  private isCriticalPathAffected(componentIds: string[]): boolean {
    // Simple heuristic: if more than 2 components are affected, consider critical path affected
    return componentIds.length > 2;
  }

  // Public methods for service instance

  public getInjectionStatus(injectionId: string): FailureInjectionResult | null {
    return this.activeInjections.get(injectionId) || 
           this.injectionHistory.find(h => h.injectionId === injectionId) || null;
  }

  public async stopInjection(injectionId: string, recoveryType: string): Promise<FailureInjectionResult | null> {
    const injection = this.activeInjections.get(injectionId);
    if (!injection) return null;

    if (recoveryType === 'immediate') {
      this.completeRecovery(injectionId);
    } else {
      injection.status = 'recovering';
      this.startGradualRecovery(injectionId, 10000); // 10 second gradual recovery
    }

    return injection;
  }

  public getActiveInjections(): Map<string, FailureInjectionResult> {
    return new Map(this.activeInjections);
  }

  public getFailureImpactAnalysis(componentId: string): any {
    const componentState = this.failureManager.getComponentState(componentId);
    const statistics = this.failureManager.getFailureStatistics(componentId);
    const activeFailures = this.failureManager.getActiveFailures()
      .filter(f => f.id.includes(componentId));

    return {
      componentState,
      statistics,
      activeFailures,
      recoveryPatterns: this.getRecoveryPatterns(componentId),
      impactRadius: this.getImpactRadius(componentId)
    };
  }

  private getRecoveryPatterns(componentId: string): any {
    const relevantHistory = this.injectionHistory.filter(h => 
      h.componentId === componentId || h.impactedComponents.includes(componentId)
    );

    return {
      averageRecoveryTime: this.calculateAverageRecoveryTime(relevantHistory),
      recoverySuccessRate: this.calculateRecoverySuccessRate(relevantHistory),
      commonRecoveryPatterns: this.identifyRecoveryPatterns(relevantHistory)
    };
  }

  private getImpactRadius(componentId: string): any {
    const dependencies = this.componentDependencies.get(componentId) || [];
    const reverseDependencies = Array.from(this.componentDependencies.entries())
      .filter(([_, deps]) => deps.includes(componentId))
      .map(([comp, _]) => comp);

    return {
      directDependencies: dependencies,
      reverseDependencies,
      totalImpactRadius: dependencies.length + reverseDependencies.length
    };
  }

  private calculateAverageRecoveryTime(history: FailureInjectionResult[]): number {
    if (history.length === 0) return 0;
    
    const recoveryTimes = history
      .filter(h => h.actualEndTime && h.startTime)
      .map(h => h.actualEndTime! - h.startTime);
    
    return recoveryTimes.reduce((sum, time) => sum + time, 0) / recoveryTimes.length;
  }

  private calculateRecoverySuccessRate(history: FailureInjectionResult[]): number {
    if (history.length === 0) return 1.0;
    
    const successfulRecoveries = history.filter(h => h.status === 'completed').length;
    return successfulRecoveries / history.length;
  }

  private identifyRecoveryPatterns(history: FailureInjectionResult[]): string[] {
    // Simple pattern identification
    const patterns: string[] = [];
    
    if (history.length > 0) {
      const avgRecoveryTime = this.calculateAverageRecoveryTime(history);
      if (avgRecoveryTime < 10000) patterns.push('fast-recovery');
      else if (avgRecoveryTime > 60000) patterns.push('slow-recovery');
      else patterns.push('normal-recovery');
    }
    
    return patterns;
  }
}