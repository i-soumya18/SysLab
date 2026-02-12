/**
 * Simulation Service - Manages simulation execution and lifecycle
 * Implements core MVLE features: simulation execution, bottleneck detection, metrics collection
 */

import { EventEmitter } from 'events';
import { SimulationEngine } from '../simulation/SimulationEngine';
import { Workspace, Component, Connection, LoadPattern } from '../types';

interface SimulationInstance {
  id: string;
  workspaceId: string;
  engine: SimulationEngine;
  startTime: number;
  status: 'running' | 'stopped' | 'completed' | 'failed';
  trafficLoad: number; // requests per second
  userCount: number; // number of concurrent users
}

interface SimulationResult {
  simulationId: string;
  workspaceId: string;
  duration: number;
  metrics: {
    components: Map<string, ComponentMetrics>;  system: SystemMetrics;
    bottlenecks: BottleneckInfo[];
  };
  status: 'completed' | 'failed';
  error?: string;
}

interface ComponentMetrics {
  componentId: string;
  componentType: string;
  componentName: string;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  throughput: number;
  errorRate: number;
  queueDepth: number;
  cpuUtilization: number;
  memoryUtilization: number;
  isBottleneck: boolean;
  bottleneckSeverity?: 'low' | 'medium' | 'high' | 'critical';
}

interface SystemMetrics {
  totalThroughput: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  totalErrorRate: number;
  activeComponents: number;
  healthyComponents: number;
  overloadedComponents: number;
}

interface BottleneckInfo {
  componentId: string;
  componentType: string;
  componentName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'latency' | 'throughput' | 'resource' | 'queue';
  description: string;
  impact: number; // 0-100 percentage
  currentValue: number;
  threshold: number;
  recommendations: string[];
}

export class SimulationService extends EventEmitter {
  private simulations: Map<string, SimulationInstance> = new Map();

  constructor() {
    super();
  }

  /**
   * Start a new simulation
   */
  async startSimulation(
    workspaceId: string,
    workspace: Workspace,
    options: {
      userCount?: number;
      duration?: number;
      loadPattern?: LoadPattern;
    } = {}
  ): Promise<{
    simulationId: string;
    status: string;
    message: string;
  }> {
    // Generate simulation ID
    const simulationId = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Calculate traffic load based on user count
    const userCount = options.userCount || 100;
    const trafficLoad = this.calculateTrafficLoad(userCount, workspace);

    // Set default duration if not provided
    if (!workspace.configuration.duration) {
      workspace.configuration.duration = options.duration || 60; // default 60 seconds
    }

    // Set load pattern if not provided
    if (!workspace.configuration.loadPattern) {
      workspace.configuration.loadPattern = options.loadPattern || {
        type: 'constant',
        baseLoad: trafficLoad
      };
    } else {
      workspace.configuration.loadPattern.baseLoad = trafficLoad;
    }

    // Create new simulation engine
    const engine = new SimulationEngine();

    // Initialize with workspace
    engine.initialize(workspace);

    // Create simulation instance
    const instance: SimulationInstance = {
      id: simulationId,
      workspaceId,
      engine,
      startTime: Date.now(),
      status: 'running',
      trafficLoad,
      userCount
    };

    this.simulations.set(simulationId, instance);

    // Set up event listeners
    this.setupEngineListeners(simulationId, instance);

    // Start the simulation
    try {
      await engine.start();

      this.emit('simulation:started', {
        simulationId,
        workspaceId,
        userCount,
        trafficLoad
      });

      return {
        simulationId,
        status: 'running',
        message: `Simulation started for ${userCount} users`
      };
    } catch (error) {
      instance.status = 'failed';
      this.emit('simulation:failed', {
        simulationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Stop a running simulation
   */
  async stopSimulation(simulationId: string): Promise<{
    simulationId: string;
    status: string;
    duration: number;
  }> {
    const instance = this.simulations.get(simulationId);

    if (!instance) {
      throw new Error(`Simulation ${simulationId} not found`);
    }

    if (instance.status !== 'running') {
      throw new Error(`Simulation ${simulationId} is not running (status: ${instance.status})`);
    }

    // Stop the engine
    instance.engine.stop();
    instance.status = 'stopped';

    const duration = Date.now() - instance.startTime;

    this.emit('simulation:stopped', {
      simulationId,
      workspaceId: instance.workspaceId,
      duration
    });

    return {
      simulationId,
      status: 'stopped',
      duration
    };
  }

  /**
   * Get simulation status
   */
  getSimulationStatus(simulationId: string): {
    simulationId: string;
    workspaceId: string;
    status: string;
    userCount: number;
    trafficLoad: number;
    elapsedTime: number;
    metrics?: any;
    bottlenecks?: BottleneckInfo[];
  } {
    const instance = this.simulations.get(simulationId);

    if (!instance) {
      throw new Error(`Simulation ${simulationId} not found`);
    }

    const elapsedTime = Date.now() - instance.startTime;
    const systemMetrics = instance.engine.getRealtimeSystemMetrics();
    const bottleneckReport = instance.engine.getCurrentBottleneckReport();

    return {
      simulationId,
      workspaceId: instance.workspaceId,
      status: instance.status,
      userCount: instance.userCount,
      trafficLoad: instance.trafficLoad,
      elapsedTime,
      metrics: systemMetrics,
      bottlenecks: this.formatBottlenecks(bottleneckReport)
    };
  }

  /**
   * Get detailed metrics for a simulation
   */
  getSimulationMetrics(simulationId: string): {
    components: ComponentMetrics[];
    system: SystemMetrics;
    bottlenecks: BottleneckInfo[];
  } {
    const instance = this.simulations.get(simulationId);

    if (!instance) {
      throw new Error(`Simulation ${simulationId} not found`);
    }

    const workspace = instance.engine['workspace']; // Access private field
    
    if (!workspace) {
      throw new Error(`Workspace not found for simulation ${simulationId}`);
    }
    
    const componentMetrics: ComponentMetrics[] = [];

    // Collect metrics for each component
    workspace.components.forEach(component => {
      const metrics = instance.engine.getRealtimeMetrics(component.id);
      const failureInfo = instance.engine.getComponentFailureInfo(component.id);

      if (metrics) {
        const isBottleneck = this.isComponentBottleneck(metrics, component.type);
        const bottleneckSeverity = isBottleneck
          ? this.calculateBottleneckSeverity(metrics, component.type)
          : undefined;

        componentMetrics.push({
          componentId: component.id,
          componentType: component.type,
          componentName: component.metadata.name,
          averageLatency: metrics.latency.avg,
          p95Latency: metrics.latency.p95,
          p99Latency: metrics.latency.p99,
          throughput: metrics.requestsPerSecond.avg,
          errorRate: metrics.errorRate.avg,
          queueDepth: metrics.queueDepth.avg,
          cpuUtilization: metrics.resourceUtilization.cpu.avg,
          memoryUtilization: metrics.resourceUtilization.memory.avg,
          isBottleneck,
          bottleneckSeverity
        });
      }
    });

    // Get system metrics
    const systemMetricsRaw = instance.engine.getRealtimeSystemMetrics();
    const systemMetrics: SystemMetrics = systemMetricsRaw ? {
      totalThroughput: systemMetricsRaw.totalThroughput,
      averageLatency: systemMetricsRaw.averageLatency,
      p95Latency: 0, // Calculate from component metrics
      p99Latency: 0, // Calculate from component metrics
      totalErrorRate: systemMetricsRaw.systemErrorRate,
      activeComponents: systemMetricsRaw.activeComponents,
      healthyComponents: systemMetricsRaw.healthyComponents,
      overloadedComponents: componentMetrics.filter(c => c.isBottleneck).length
    } : {
      totalThroughput: 0,
      averageLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      totalErrorRate: 0,
      activeComponents: workspace.components.length,
      healthyComponents: workspace.components.length,
      overloadedComponents: 0
    };

    // Get bottlenecks
    const bottleneckReport = instance.engine.getCurrentBottleneckReport();
    const bottlenecks = this.formatBottlenecks(bottleneckReport);

    return {
      components: componentMetrics,
      system: systemMetrics,
      bottlenecks
    };
  }

  /**
   * Clean up completed simulations
   */
  clearSimulation(simulationId: string): void {
    const instance = this.simulations.get(simulationId);
    if (instance && instance.status !== 'running') {
      this.simulations.delete(simulationId);
    }
  }

  /**
   * Get all active simulations
   */
  getActiveSimulations(): string[] {
    return Array.from(this.simulations.entries())
      .filter(([_, instance]) => instance.status === 'running')
      .map(([id, _]) => id);
  }

  // Private helper methods

  private setupEngineListeners(simulationId: string, instance: SimulationInstance): void {
    const engine = instance.engine;

    engine.on('stopped', () => {
      instance.status = 'completed';
      this.emit('simulation:completed', {
        simulationId,
        workspaceId: instance.workspaceId
      });
    });

    engine.on('bottleneck_alert', (alert: any) => {
      this.emit('simulation:bottleneck', {
        simulationId,
        workspaceId: instance.workspaceId,
        bottleneck: alert
      });
    });

    engine.on('error', (error: Error) => {
      instance.status = 'failed';
      this.emit('simulation:failed', {
        simulationId,
        workspaceId: instance.workspaceId,
        error: error.message
      });
    });
  }

  private calculateTrafficLoad(userCount: number, workspace: Workspace): number {
    // Calculate requests per second based on user count
    // Average user makes 1-5 requests per second depending on system type
    const requestsPerUser = 2; // Conservative estimate
    return userCount * requestsPerUser;
  }

  private isComponentBottleneck(metrics: any, componentType: string): boolean {
    // Define bottleneck thresholds by component type
    const thresholds: Record<string, { latency: number; errorRate: number; queueDepth: number; cpu: number }> = {
      'database': { latency: 100, errorRate: 0.05, queueDepth: 50, cpu: 0.8 },
      'load-balancer': { latency: 10, errorRate: 0.01, queueDepth: 100, cpu: 0.7 },
      'web-server': { latency: 50, errorRate: 0.03, queueDepth: 75, cpu: 0.75 },
      'cache': { latency: 5, errorRate: 0.01, queueDepth: 25, cpu: 0.6 },
      'message-queue': { latency: 20, errorRate: 0.02, queueDepth: 200, cpu: 0.7 },
      'default': { latency: 100, errorRate: 0.05, queueDepth: 100, cpu: 0.8 }
    };

    const threshold = thresholds[componentType] || thresholds['default'];

    return (
      metrics.latency.avg > threshold.latency ||
      metrics.errorRate.avg > threshold.errorRate ||
      metrics.queueDepth.avg > threshold.queueDepth ||
      metrics.resourceUtilization.cpu.avg > threshold.cpu
    );
  }

  private calculateBottleneckSeverity(metrics: any, componentType: string): 'low' | 'medium' | 'high' | 'critical' {
    const thresholds: Record<string, { latency: number; errorRate: number; cpu: number }> = {
      'database': { latency: 100, errorRate: 0.05, cpu: 0.8 },
      'default': { latency: 100, errorRate: 0.05, cpu: 0.8 }
    };

    const threshold = thresholds[componentType] || thresholds['default'];

    const latencyRatio = metrics.latency.avg / threshold.latency;
    const errorRatio = metrics.errorRate.avg / threshold.errorRate;
    const cpuRatio = metrics.resourceUtilization.cpu.avg / threshold.cpu;

    const maxRatio = Math.max(latencyRatio, errorRatio, cpuRatio);

    if (maxRatio > 3) return 'critical';
    if (maxRatio > 2) return 'high';
    if (maxRatio > 1.5) return 'medium';
    return 'low';
  }

  private formatBottlenecks(bottleneckReport: any): BottleneckInfo[] {
    if (!bottleneckReport || !bottleneckReport.bottlenecks) {
      return [];
    }

    return bottleneckReport.bottlenecks.map((b: any) => ({
      componentId: b.componentId,
      componentType: b.componentType || 'unknown',
      componentName: b.componentName || b.componentId,
      severity: b.severity || 'medium',
      type: b.type || 'resource',
      description: b.description || `Component ${b.componentId} is experiencing high load`,
      impact: b.impact || 50,
      currentValue: b.currentValue || 0,
      threshold: b.threshold || 0,
      recommendations: b.recommendations || this.generateRecommendations(b)
    }));
  }

  private generateRecommendations(bottleneck: any): string[] {
    const recommendations: string[] = [];

    if (bottleneck.type === 'latency' || bottleneck.severity === 'high' || bottleneck.severity === 'critical') {
      recommendations.push('Add horizontal scaling (replicas)');
      recommendations.push('Implement caching layer');
      recommendations.push('Optimize database queries');
    }

    if (bottleneck.componentType === 'database') {
      recommendations.push('Add read replicas');
      recommendations.push('Implement database sharding');
      recommendations.push('Add connection pooling');
    }

    if (bottleneck.type === 'queue') {
      recommendations.push('Increase queue capacity');
      recommendations.push('Add more consumer workers');
      recommendations.push('Implement backpressure handling');
    }

    return recommendations.length > 0 ? recommendations : [
      'Consider scaling this component',
      'Monitor resource utilization',
      'Review component configuration'
    ];
  }
}

// Singleton instance
export const simulationService = new SimulationService();
