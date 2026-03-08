/**
 * Scaling Manager for System Design Simulator
 * Implements SRS FR-3.3: Vertical scaling, horizontal scaling, and auto-scaling policies
 */

import type { ComponentConfig, ComponentType } from '../types';
import { capacityManager } from './CapacityManager';

// Scaling strategy interfaces
export interface VerticalScalingConfig {
  enabled: boolean;
  minCpu: number;
  maxCpu: number;
  minMemory: string;
  maxMemory: string;
  cpuStep: number;
  memoryStep: string;
  scaleUpThreshold: number;    // CPU/Memory utilization percentage
  scaleDownThreshold: number;  // CPU/Memory utilization percentage
  cooldownPeriod: number;      // Seconds between scaling operations
}

export interface HorizontalScalingConfig {
  enabled: boolean;
  minInstances: number;
  maxInstances: number;
  targetCpuUtilization: number;
  targetMemoryUtilization: number;
  scaleUpCooldown: number;     // Seconds
  scaleDownCooldown: number;   // Seconds
  instanceWarmupTime: number;  // Seconds for new instance to be ready
  scaleUpPolicy: 'aggressive' | 'moderate' | 'conservative';
  scaleDownPolicy: 'aggressive' | 'moderate' | 'conservative';
}

export interface AutoScalingPolicy {
  enabled: boolean;
  metrics: ('cpu' | 'memory' | 'requests' | 'latency' | 'queue-depth')[];
  thresholds: Record<string, number>;
  evaluationPeriod: number;    // Seconds
  dataPointsToAlarm: number;   // Number of consecutive data points
  scaleUpActions: ScalingAction[];
  scaleDownActions: ScalingAction[];
  notifications: NotificationConfig[];
}

export interface ScalingAction {
  type: 'vertical' | 'horizontal';
  adjustment: number;          // For vertical: CPU/Memory increase, for horizontal: instance count change
  adjustmentType: 'absolute' | 'percentage' | 'step';
  cooldown: number;           // Seconds
  priority: number;           // Higher priority actions execute first
}

export interface NotificationConfig {
  type: 'email' | 'webhook' | 'slack';
  endpoint: string;
  events: ('scale-up' | 'scale-down' | 'scale-failed' | 'threshold-breach')[];
}

export interface ScalingEvent {
  id: string;
  componentId: string;
  componentType: ComponentType;
  eventType: 'scale-up' | 'scale-down' | 'scale-failed';
  scalingType: 'vertical' | 'horizontal';
  trigger: string;
  oldConfiguration: ComponentConfig;
  newConfiguration: ComponentConfig;
  timestamp: number;
  duration: number;
  success: boolean;
  reason: string;
  metrics: Record<string, number>;
}

export interface ScalingRecommendation {
  componentId: string;
  componentType: ComponentType;
  recommendationType: 'vertical' | 'horizontal' | 'both';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  currentMetrics: Record<string, number>;
  projectedMetrics: Record<string, number>;
  estimatedCost: number;
  estimatedPerformanceGain: number;
  reasoning: string[];
  suggestedActions: ScalingAction[];
  timeframe: string;
}

// Component-specific scaling configurations per SRS FR-3.3
export class ScalingManager {
  private static instance: ScalingManager;
  private verticalConfigs: Map<string, VerticalScalingConfig>;
  private horizontalConfigs: Map<string, HorizontalScalingConfig>;
  private autoScalingPolicies: Map<string, AutoScalingPolicy>;
  private scalingEvents: Map<string, ScalingEvent[]>;
  private activeScalingOperations: Map<string, NodeJS.Timeout>;

  private constructor() {
    this.verticalConfigs = new Map();
    this.horizontalConfigs = new Map();
    this.autoScalingPolicies = new Map();
    this.scalingEvents = new Map();
    this.activeScalingOperations = new Map();
    this.initializeScalingConfigurations();
  }

  public static getInstance(): ScalingManager {
    if (!ScalingManager.instance) {
      ScalingManager.instance = new ScalingManager();
    }
    return ScalingManager.instance;
  }

  private initializeScalingConfigurations(): void {
    // Load Balancer scaling configurations
    this.verticalConfigs.set('load-balancer-nginx', {
      enabled: true,
      minCpu: 1,
      maxCpu: 8,
      minMemory: '1GB',
      maxMemory: '16GB',
      cpuStep: 1,
      memoryStep: '2GB',
      scaleUpThreshold: 75,
      scaleDownThreshold: 30,
      cooldownPeriod: 300
    });

    this.horizontalConfigs.set('load-balancer-nginx', {
      enabled: true,
      minInstances: 1,
      maxInstances: 5,
      targetCpuUtilization: 70,
      targetMemoryUtilization: 80,
      scaleUpCooldown: 300,
      scaleDownCooldown: 600,
      instanceWarmupTime: 60,
      scaleUpPolicy: 'moderate',
      scaleDownPolicy: 'conservative'
    });

    // Database scaling configurations
    this.verticalConfigs.set('database-mysql', {
      enabled: true,
      minCpu: 2,
      maxCpu: 32,
      minMemory: '4GB',
      maxMemory: '128GB',
      cpuStep: 2,
      memoryStep: '8GB',
      scaleUpThreshold: 80,
      scaleDownThreshold: 40,
      cooldownPeriod: 600
    });

    this.horizontalConfigs.set('database-mysql', {
      enabled: false, // Read replicas only
      minInstances: 1,
      maxInstances: 3,
      targetCpuUtilization: 75,
      targetMemoryUtilization: 85,
      scaleUpCooldown: 900,
      scaleDownCooldown: 1800,
      instanceWarmupTime: 300,
      scaleUpPolicy: 'conservative',
      scaleDownPolicy: 'conservative'
    });

    this.verticalConfigs.set('database-postgresql', {
      enabled: true,
      minCpu: 2,
      maxCpu: 64,
      minMemory: '8GB',
      maxMemory: '256GB',
      cpuStep: 4,
      memoryStep: '16GB',
      scaleUpThreshold: 85,
      scaleDownThreshold: 35,
      cooldownPeriod: 600
    });

    this.horizontalConfigs.set('database-postgresql', {
      enabled: true,
      minInstances: 1,
      maxInstances: 5,
      targetCpuUtilization: 80,
      targetMemoryUtilization: 85,
      scaleUpCooldown: 900,
      scaleDownCooldown: 1800,
      instanceWarmupTime: 300,
      scaleUpPolicy: 'conservative',
      scaleDownPolicy: 'conservative'
    });

    this.verticalConfigs.set('database-mongodb', {
      enabled: true,
      minCpu: 2,
      maxCpu: 48,
      minMemory: '8GB',
      maxMemory: '192GB',
      cpuStep: 4,
      memoryStep: '16GB',
      scaleUpThreshold: 75,
      scaleDownThreshold: 40,
      cooldownPeriod: 600
    });

    this.horizontalConfigs.set('database-mongodb', {
      enabled: true,
      minInstances: 3, // Replica set minimum
      maxInstances: 15,
      targetCpuUtilization: 70,
      targetMemoryUtilization: 80,
      scaleUpCooldown: 600,
      scaleDownCooldown: 1200,
      instanceWarmupTime: 180,
      scaleUpPolicy: 'moderate',
      scaleDownPolicy: 'conservative'
    });

    // Cache scaling configurations
    this.verticalConfigs.set('cache-redis', {
      enabled: true,
      minCpu: 1,
      maxCpu: 16,
      minMemory: '2GB',
      maxMemory: '64GB',
      cpuStep: 2,
      memoryStep: '4GB',
      scaleUpThreshold: 70,
      scaleDownThreshold: 30,
      cooldownPeriod: 300
    });

    this.horizontalConfigs.set('cache-redis', {
      enabled: true,
      minInstances: 1,
      maxInstances: 10,
      targetCpuUtilization: 65,
      targetMemoryUtilization: 75,
      scaleUpCooldown: 300,
      scaleDownCooldown: 600,
      instanceWarmupTime: 60,
      scaleUpPolicy: 'moderate',
      scaleDownPolicy: 'moderate'
    });

    // Queue scaling configurations
    this.verticalConfigs.set('queue-kafka', {
      enabled: true,
      minCpu: 4,
      maxCpu: 32,
      minMemory: '8GB',
      maxMemory: '128GB',
      cpuStep: 4,
      memoryStep: '8GB',
      scaleUpThreshold: 80,
      scaleDownThreshold: 40,
      cooldownPeriod: 600
    });

    this.horizontalConfigs.set('queue-kafka', {
      enabled: true,
      minInstances: 3, // Minimum for fault tolerance
      maxInstances: 20,
      targetCpuUtilization: 75,
      targetMemoryUtilization: 80,
      scaleUpCooldown: 600,
      scaleDownCooldown: 1200,
      instanceWarmupTime: 120,
      scaleUpPolicy: 'moderate',
      scaleDownPolicy: 'conservative'
    });

    // Service scaling configurations
    this.verticalConfigs.set('service-nodejs', {
      enabled: true,
      minCpu: 0.5,
      maxCpu: 8,
      minMemory: '512MB',
      maxMemory: '16GB',
      cpuStep: 0.5,
      memoryStep: '1GB',
      scaleUpThreshold: 70,
      scaleDownThreshold: 30,
      cooldownPeriod: 300
    });

    this.horizontalConfigs.set('service-nodejs', {
      enabled: true,
      minInstances: 1,
      maxInstances: 20,
      targetCpuUtilization: 70,
      targetMemoryUtilization: 80,
      scaleUpCooldown: 300,
      scaleDownCooldown: 600,
      instanceWarmupTime: 30,
      scaleUpPolicy: 'moderate',
      scaleDownPolicy: 'moderate'
    });

    this.verticalConfigs.set('service-java', {
      enabled: true,
      minCpu: 1,
      maxCpu: 16,
      minMemory: '2GB',
      maxMemory: '32GB',
      cpuStep: 1,
      memoryStep: '2GB',
      scaleUpThreshold: 75,
      scaleDownThreshold: 35,
      cooldownPeriod: 600
    });

    this.horizontalConfigs.set('service-java', {
      enabled: true,
      minInstances: 2,
      maxInstances: 25,
      targetCpuUtilization: 75,
      targetMemoryUtilization: 85,
      scaleUpCooldown: 600,
      scaleDownCooldown: 900,
      instanceWarmupTime: 90,
      scaleUpPolicy: 'moderate',
      scaleDownPolicy: 'conservative'
    });

    // Initialize auto-scaling policies
    this.initializeAutoScalingPolicies();
  }

  private initializeAutoScalingPolicies(): void {
    // Default auto-scaling policy for services
    const defaultServicePolicy: AutoScalingPolicy = {
      enabled: true,
      metrics: ['cpu', 'memory', 'requests'],
      thresholds: {
        cpu: 70,
        memory: 80,
        requests: 1000
      },
      evaluationPeriod: 300,
      dataPointsToAlarm: 2,
      scaleUpActions: [
        {
          type: 'horizontal',
          adjustment: 1,
          adjustmentType: 'absolute',
          cooldown: 300,
          priority: 1
        }
      ],
      scaleDownActions: [
        {
          type: 'horizontal',
          adjustment: -1,
          adjustmentType: 'absolute',
          cooldown: 600,
          priority: 1
        }
      ],
      notifications: []
    };

    this.autoScalingPolicies.set('service-nodejs', defaultServicePolicy);
    this.autoScalingPolicies.set('service-java', defaultServicePolicy);
    this.autoScalingPolicies.set('service-python', defaultServicePolicy);

    // Database-specific auto-scaling policy
    const databasePolicy: AutoScalingPolicy = {
      enabled: true,
      metrics: ['cpu', 'memory', 'queue-depth'],
      thresholds: {
        cpu: 80,
        memory: 85,
        'queue-depth': 100
      },
      evaluationPeriod: 600,
      dataPointsToAlarm: 3,
      scaleUpActions: [
        {
          type: 'vertical',
          adjustment: 25,
          adjustmentType: 'percentage',
          cooldown: 900,
          priority: 1
        }
      ],
      scaleDownActions: [
        {
          type: 'vertical',
          adjustment: -15,
          adjustmentType: 'percentage',
          cooldown: 1800,
          priority: 1
        }
      ],
      notifications: []
    };

    this.autoScalingPolicies.set('database-mysql', databasePolicy);
    this.autoScalingPolicies.set('database-postgresql', databasePolicy);
  }

  // Get vertical scaling configuration
  public getVerticalScalingConfig(componentKey: string): VerticalScalingConfig | undefined {
    return this.verticalConfigs.get(componentKey);
  }

  // Get horizontal scaling configuration
  public getHorizontalScalingConfig(componentKey: string): HorizontalScalingConfig | undefined {
    return this.horizontalConfigs.get(componentKey);
  }

  // Get auto-scaling policy
  public getAutoScalingPolicy(componentKey: string): AutoScalingPolicy | undefined {
    return this.autoScalingPolicies.get(componentKey);
  }

  // Update vertical scaling configuration
  public updateVerticalScalingConfig(componentKey: string, config: Partial<VerticalScalingConfig>): void {
    const currentConfig = this.verticalConfigs.get(componentKey);
    if (currentConfig) {
      this.verticalConfigs.set(componentKey, { ...currentConfig, ...config });
    }
  }

  // Update horizontal scaling configuration
  public updateHorizontalScalingConfig(componentKey: string, config: Partial<HorizontalScalingConfig>): void {
    const currentConfig = this.horizontalConfigs.get(componentKey);
    if (currentConfig) {
      this.horizontalConfigs.set(componentKey, { ...currentConfig, ...config });
    }
  }

  // Update auto-scaling policy
  public updateAutoScalingPolicy(componentKey: string, policy: Partial<AutoScalingPolicy>): void {
    const currentPolicy = this.autoScalingPolicies.get(componentKey);
    if (currentPolicy) {
      this.autoScalingPolicies.set(componentKey, { ...currentPolicy, ...policy });
    }
  }

  // Evaluate scaling needs for a component
  public evaluateScalingNeeds(componentId: string, componentKey: string): ScalingRecommendation | null {
    const metrics = capacityManager.getCapacityMetrics(componentId);
    const verticalConfig = this.getVerticalScalingConfig(componentKey);
    const horizontalConfig = this.getHorizontalScalingConfig(componentKey);
    const autoScalingPolicy = this.getAutoScalingPolicy(componentKey);

    if (!metrics || (!verticalConfig && !horizontalConfig)) {
      return null;
    }

    const componentType = componentKey.split('-')[0] as ComponentType;
    const currentMetrics = {
      cpu: metrics.currentCpuUsage,
      memory: metrics.currentMemoryUsage,
      throughput: metrics.currentThroughput,
      queueDepth: metrics.currentQueueDepth,
      utilization: metrics.utilizationPercentage
    };

    const recommendations: ScalingRecommendation = {
      componentId,
      componentType,
      recommendationType: 'vertical',
      urgency: 'low',
      currentMetrics,
      projectedMetrics: { ...currentMetrics },
      estimatedCost: 0,
      estimatedPerformanceGain: 0,
      reasoning: [],
      suggestedActions: [],
      timeframe: 'immediate'
    };

    // Evaluate vertical scaling needs
    if (verticalConfig?.enabled) {
      if (currentMetrics.cpu > verticalConfig.scaleUpThreshold || 
          currentMetrics.memory > verticalConfig.scaleUpThreshold) {
        recommendations.urgency = currentMetrics.utilization > 90 ? 'critical' : 'high';
        recommendations.reasoning.push(`CPU (${currentMetrics.cpu}%) or Memory usage above threshold (${verticalConfig.scaleUpThreshold}%)`);
        recommendations.suggestedActions.push({
          type: 'vertical',
          adjustment: 25,
          adjustmentType: 'percentage',
          cooldown: verticalConfig.cooldownPeriod,
          priority: 1
        });
      }
    }

    // Evaluate horizontal scaling needs
    if (horizontalConfig?.enabled) {
      if (currentMetrics.cpu > horizontalConfig.targetCpuUtilization || 
          currentMetrics.throughput > 80) {
        if (recommendations.urgency === 'low') {
          recommendations.urgency = 'medium';
        }
        recommendations.recommendationType = recommendations.recommendationType === 'vertical' ? 'both' : 'horizontal';
        recommendations.reasoning.push(`High throughput or CPU utilization suggests need for horizontal scaling`);
        recommendations.suggestedActions.push({
          type: 'horizontal',
          adjustment: 1,
          adjustmentType: 'absolute',
          cooldown: horizontalConfig.scaleUpCooldown,
          priority: 2
        });
      }
    }

    // Calculate projected improvements
    if (recommendations.suggestedActions.length > 0) {
      recommendations.projectedMetrics.cpu = Math.max(currentMetrics.cpu * 0.7, 30);
      recommendations.projectedMetrics.memory = Math.max(currentMetrics.memory * 0.8, 40);
      recommendations.projectedMetrics.utilization = Math.max(currentMetrics.utilization * 0.75, 50);
      recommendations.estimatedPerformanceGain = (currentMetrics.utilization - recommendations.projectedMetrics.utilization) / currentMetrics.utilization * 100;
    }

    return recommendations.suggestedActions.length > 0 ? recommendations : null;
  }

  // Execute scaling action
  public async executeScalingAction(
    componentId: string, 
    componentKey: string, 
    action: ScalingAction,
    currentConfig: ComponentConfig
  ): Promise<ScalingEvent> {
    const componentType = componentKey.split('-')[0] as ComponentType;
    const scalingEvent: ScalingEvent = {
      id: `${componentId}-${Date.now()}`,
      componentId,
      componentType,
      eventType: action.adjustment > 0 ? 'scale-up' : 'scale-down',
      scalingType: action.type,
      trigger: 'manual',
      oldConfiguration: { ...currentConfig },
      newConfiguration: { ...currentConfig },
      timestamp: Date.now(),
      duration: 0,
      success: false,
      reason: '',
      metrics: {}
    };

    const startTime = Date.now();

    try {
      if (action.type === 'vertical') {
        await this.executeVerticalScaling(componentKey, action, scalingEvent);
      } else if (action.type === 'horizontal') {
        await this.executeHorizontalScaling(componentKey, action, scalingEvent);
      }

      scalingEvent.success = true;
      scalingEvent.reason = `Successfully executed ${action.type} scaling`;
    } catch (error) {
      scalingEvent.success = false;
      scalingEvent.reason = error instanceof Error ? error.message : 'Unknown error';
      scalingEvent.eventType = 'scale-failed';
    }

    scalingEvent.duration = Date.now() - startTime;

    // Store scaling event
    const events = this.scalingEvents.get(componentId) || [];
    events.push(scalingEvent);
    this.scalingEvents.set(componentId, events);

    return scalingEvent;
  }

  private async executeVerticalScaling(
    componentKey: string, 
    action: ScalingAction, 
    scalingEvent: ScalingEvent
  ): Promise<void> {
    const config = this.getVerticalScalingConfig(componentKey);
    if (!config) {
      throw new Error('Vertical scaling not configured for this component');
    }

    // Simulate scaling operation
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Update configuration based on action
    if (action.adjustmentType === 'percentage') {
      const cpuIncrease = scalingEvent.oldConfiguration.capacity * (action.adjustment / 100);
      scalingEvent.newConfiguration.capacity = Math.min(
        scalingEvent.oldConfiguration.capacity + cpuIncrease,
        config.maxCpu * 1000 // Assuming capacity correlates with CPU
      );
    } else if (action.adjustmentType === 'absolute') {
      scalingEvent.newConfiguration.capacity = scalingEvent.oldConfiguration.capacity + action.adjustment;
    }

    scalingEvent.reason = `Vertical scaling: CPU increased by ${action.adjustment}${action.adjustmentType === 'percentage' ? '%' : ' units'}`;
  }

  private async executeHorizontalScaling(
    componentKey: string, 
    action: ScalingAction, 
    scalingEvent: ScalingEvent
  ): Promise<void> {
    const config = this.getHorizontalScalingConfig(componentKey);
    if (!config) {
      throw new Error('Horizontal scaling not configured for this component');
    }

    // Simulate instance provisioning/termination
    const warmupTime = action.adjustment > 0 ? config.instanceWarmupTime * 1000 : 1000;
    await new Promise(resolve => setTimeout(resolve, warmupTime));

    // Update configuration to reflect new instance count
    const currentInstances = scalingEvent.oldConfiguration.instances || 1;
    const newInstances = Math.max(
      config.minInstances,
      Math.min(config.maxInstances, currentInstances + action.adjustment)
    );

    scalingEvent.newConfiguration.instances = newInstances;
    scalingEvent.newConfiguration.capacity = scalingEvent.oldConfiguration.capacity * (newInstances / currentInstances);

    scalingEvent.reason = `Horizontal scaling: Instance count changed from ${currentInstances} to ${newInstances}`;
  }

  // Get scaling events for a component
  public getScalingEvents(componentId: string): ScalingEvent[] {
    return this.scalingEvents.get(componentId) || [];
  }

  // Get all scaling events
  public getAllScalingEvents(): Map<string, ScalingEvent[]> {
    return new Map(this.scalingEvents);
  }

  // Check if component can scale
  public canScale(componentKey: string, scalingType: 'vertical' | 'horizontal'): boolean {
    if (scalingType === 'vertical') {
      const config = this.getVerticalScalingConfig(componentKey);
      return config?.enabled || false;
    } else {
      const config = this.getHorizontalScalingConfig(componentKey);
      return config?.enabled || false;
    }
  }

  // Get scaling capabilities for a component
  public getScalingCapabilities(componentKey: string): {
    vertical: boolean;
    horizontal: boolean;
    autoScaling: boolean;
    maxVerticalCapacity: number;
    maxHorizontalInstances: number;
  } {
    const verticalConfig = this.getVerticalScalingConfig(componentKey);
    const horizontalConfig = this.getHorizontalScalingConfig(componentKey);
    const autoScalingPolicy = this.getAutoScalingPolicy(componentKey);

    return {
      vertical: verticalConfig?.enabled || false,
      horizontal: horizontalConfig?.enabled || false,
      autoScaling: autoScalingPolicy?.enabled || false,
      maxVerticalCapacity: verticalConfig?.maxCpu || 0,
      maxHorizontalInstances: horizontalConfig?.maxInstances || 1
    };
  }
}

// Export singleton instance
export const scalingManager = ScalingManager.getInstance();