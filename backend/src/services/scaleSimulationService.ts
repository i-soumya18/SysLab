/**
 * Scale Simulation Service
 * 
 * Implements SRS FR-5.1: Dynamic scale adjustment from 1 user to 1 billion users
 * with real-time parameter updates and bottleneck detection
 */

import { EventEmitter } from 'events';
import { SimulationEngine } from '../simulation/SimulationEngine';
import { LoadSimulationEngine } from '../simulation/LoadSimulationEngine';
import { SystemGraphEngine } from '../simulation/SystemGraphEngine';
import { Workspace, LoadPattern, ComponentMetrics } from '../types';

export interface ScaleSimulationConfig {
  workspaceId: string;
  initialScale: number;
  targetScale: number;
  duration: number; // seconds
  updateInterval: number; // milliseconds
  enableRealTimeUpdates: boolean;
}

export interface ScaleSimulationResult {
  timestamp: number;
  userCount: number;
  qps: number;
  systemMetrics: {
    totalThroughput: number;
    averageLatency: number;
    errorRate: number;
    bottlenecks: BottleneckInfo[];
  };
  componentMetrics: Map<string, ComponentMetrics>;
  recommendations: ScalingRecommendation[];
}

export interface BottleneckInfo {
  componentId: string;
  componentType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  utilizationPercent: number;
  limitingFactor: 'cpu' | 'memory' | 'network' | 'connections' | 'storage';
  impact: string;
  suggestedFix: string;
}

export interface ScalingRecommendation {
  type: 'scale_up' | 'scale_out' | 'add_cache' | 'add_replica' | 'optimize_query';
  componentId: string;
  description: string;
  estimatedImpact: string;
  priority: 'low' | 'medium' | 'high';
}

export class ScaleSimulationService extends EventEmitter {
  private simulationEngine: SimulationEngine;
  private loadEngine: LoadSimulationEngine;
  private systemGraph: SystemGraphEngine;
  private currentSimulation: ScaleSimulationConfig | null = null;
  private simulationInterval: NodeJS.Timeout | null = null;
  private currentScale: number = 1;
  private isRunning: boolean = false;

  constructor() {
    super();
    this.simulationEngine = new SimulationEngine();
    this.systemGraph = new SystemGraphEngine();
    this.loadEngine = new LoadSimulationEngine(this.systemGraph, this.simulationEngine['scheduler']);
    
    // Connect simulation engine events
    this.simulationEngine.on('metrics_collected', (metrics) => {
      this.handleMetricsUpdate(metrics);
    });
    
    this.simulationEngine.on('bottleneck_alert', (alert) => {
      this.handleBottleneckAlert(alert);
    });
  }

  /**
   * Start scale simulation with dynamic scaling
   */
  async startScaleSimulation(config: ScaleSimulationConfig, workspace: Workspace): Promise<void> {
    if (this.isRunning) {
      throw new Error('Scale simulation is already running');
    }

    this.currentSimulation = config;
    this.currentScale = config.initialScale;
    this.isRunning = true;

    // Initialize simulation engines
    this.systemGraph.initialize(workspace.components, workspace.connections);
    this.simulationEngine.initialize(workspace);

    // Configure load pattern for initial scale
    const loadPattern = this.createLoadPatternForScale(config.initialScale);
    this.loadEngine.initializeLoadSimulation(loadPattern, config.initialScale);

    // Start simulation engine
    await this.simulationEngine.start();

    // Start real-time updates if enabled
    if (config.enableRealTimeUpdates) {
      this.startRealTimeUpdates(config.updateInterval);
    }

    this.emit('simulation_started', {
      workspaceId: config.workspaceId,
      initialScale: config.initialScale,
      targetScale: config.targetScale
    });
  }

  /**
   * Stop scale simulation
   */
  stopScaleSimulation(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.simulationEngine.stop();
    
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }

    this.emit('simulation_stopped', {
      workspaceId: this.currentSimulation?.workspaceId,
      finalScale: this.currentScale
    });

    this.currentSimulation = null;
  }

  /**
   * Update scale in real-time (SRS FR-5.1)
   */
  updateScale(newScale: number): void {
    if (!this.isRunning || !this.currentSimulation) {
      throw new Error('No active scale simulation');
    }

    const previousScale = this.currentScale;
    this.currentScale = newScale;

    // Update load pattern for new scale
    const loadPattern = this.createLoadPatternForScale(newScale);
    this.loadEngine.initializeLoadSimulation(loadPattern, newScale);

    // Apply load multiplier based on scale change
    const scaleMultiplier = newScale / previousScale;
    this.loadEngine.applyLoadMultiplier(scaleMultiplier);

    this.emit('scale_updated', {
      workspaceId: this.currentSimulation.workspaceId,
      previousScale,
      newScale,
      scaleMultiplier
    });
  }

  /**
   * Get current simulation state
   */
  getCurrentSimulationState(): ScaleSimulationResult | null {
    if (!this.isRunning || !this.currentSimulation) return null;

    const systemMetrics = this.simulationEngine.getRealtimeSystemMetrics();
    const bottleneckReport = this.simulationEngine.getCurrentBottleneckReport();
    
    // Collect component metrics
    const componentMetrics = new Map<string, ComponentMetrics>();
    if (systemMetrics?.componentMetrics) {
      for (const [componentId, metrics] of systemMetrics.componentMetrics) {
        const realtimeMetrics = this.simulationEngine.getRealtimeMetrics(componentId);
        if (realtimeMetrics) {
          componentMetrics.set(componentId, {
            componentId,
            timestamp: Date.now(),
            requestsPerSecond: realtimeMetrics.requestsPerSecond.avg,
            averageLatency: realtimeMetrics.latency.avg,
            errorRate: realtimeMetrics.errorRate.avg,
            cpuUtilization: realtimeMetrics.resourceUtilization.cpu.avg,
            memoryUtilization: realtimeMetrics.resourceUtilization.memory.avg,
            queueDepth: realtimeMetrics.queueDepth.avg
          });
        }
      }
    }

    // Generate bottleneck information
    const bottlenecks = this.generateBottleneckInfo(bottleneckReport);
    
    // Generate scaling recommendations
    const recommendations = this.generateScalingRecommendations(bottlenecks, this.currentScale);

    return {
      timestamp: Date.now(),
      userCount: this.currentScale,
      qps: this.calculateQPS(this.currentScale),
      systemMetrics: {
        totalThroughput: systemMetrics?.totalThroughput || 0,
        averageLatency: systemMetrics?.averageLatency || 0,
        errorRate: systemMetrics?.systemErrorRate || 0,
        bottlenecks
      },
      componentMetrics,
      recommendations
    };
  }

  /**
   * Get scale simulation history
   */
  getSimulationHistory(): ScaleSimulationResult[] {
    // In a real implementation, this would return stored historical data
    // For now, return current state as single point
    const currentState = this.getCurrentSimulationState();
    return currentState ? [currentState] : [];
  }

  /**
   * Check if simulation is running
   */
  isSimulationRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get current scale
   */
  getCurrentScale(): number {
    return this.currentScale;
  }

  // Private methods

  /**
   * Create load pattern for specific scale
   */
  private createLoadPatternForScale(userCount: number): LoadPattern {
    // Calculate base load based on user count
    const baseLoad = Math.max(1, Math.floor(userCount * 0.1)); // 10% of users active at once
    
    return {
      type: 'constant',
      baseLoad,
      peakMultiplier: 1.5,
      duration: 300, // 5 minutes
      rampUpTime: 30,
      rampDownTime: 30
    };
  }

  /**
   * Calculate QPS based on user count
   */
  private calculateQPS(userCount: number): number {
    // Realistic QPS calculation: assume each user makes 0.1 requests per second on average
    return Math.round(userCount * 0.1);
  }

  /**
   * Start real-time updates
   */
  private startRealTimeUpdates(intervalMs: number): void {
    this.simulationInterval = setInterval(() => {
      if (!this.isRunning) return;

      const currentState = this.getCurrentSimulationState();
      if (currentState) {
        this.emit('real_time_update', currentState);
      }
    }, intervalMs);
  }

  /**
   * Handle metrics update from simulation engine
   */
  private handleMetricsUpdate(metrics: any): void {
    if (!this.isRunning) return;

    this.emit('metrics_updated', {
      workspaceId: this.currentSimulation?.workspaceId,
      scale: this.currentScale,
      metrics
    });
  }

  /**
   * Handle bottleneck alert from simulation engine
   */
  private handleBottleneckAlert(alert: any): void {
    if (!this.isRunning) return;

    this.emit('bottleneck_detected', {
      workspaceId: this.currentSimulation?.workspaceId,
      scale: this.currentScale,
      alert
    });
  }

  /**
   * Generate bottleneck information from bottleneck report
   */
  private generateBottleneckInfo(bottleneckReport: any): BottleneckInfo[] {
    if (!bottleneckReport) return [];

    const bottlenecks: BottleneckInfo[] = [];
    
    // Process bottleneck report and convert to BottleneckInfo format
    if (bottleneckReport.componentBottlenecks) {
      for (const [componentId, bottleneck] of Object.entries(bottleneckReport.componentBottlenecks)) {
        const info = bottleneck as any;
        
        bottlenecks.push({
          componentId,
          componentType: info.componentType || 'unknown',
          severity: this.calculateSeverity(info.utilizationPercent || 0),
          utilizationPercent: info.utilizationPercent || 0,
          limitingFactor: info.limitingFactor || 'cpu',
          impact: this.generateImpactDescription(info),
          suggestedFix: this.generateSuggestedFix(info)
        });
      }
    }

    return bottlenecks;
  }

  /**
   * Calculate bottleneck severity based on utilization
   */
  private calculateSeverity(utilizationPercent: number): 'low' | 'medium' | 'high' | 'critical' {
    if (utilizationPercent >= 95) return 'critical';
    if (utilizationPercent >= 85) return 'high';
    if (utilizationPercent >= 70) return 'medium';
    return 'low';
  }

  /**
   * Generate impact description for bottleneck
   */
  private generateImpactDescription(bottleneck: any): string {
    const utilization = bottleneck.utilizationPercent || 0;
    
    if (utilization >= 95) {
      return 'System is at capacity limit. Requests may be dropped or severely delayed.';
    } else if (utilization >= 85) {
      return 'High resource utilization causing increased latency and potential instability.';
    } else if (utilization >= 70) {
      return 'Moderate resource pressure. Performance may degrade under additional load.';
    } else {
      return 'Resource utilization is within acceptable limits.';
    }
  }

  /**
   * Generate suggested fix for bottleneck
   */
  private generateSuggestedFix(bottleneck: any): string {
    const limitingFactor = bottleneck.limitingFactor || 'cpu';
    const componentType = bottleneck.componentType || 'service';
    
    switch (limitingFactor) {
      case 'cpu':
        return `Scale up ${componentType} with more CPU cores or scale out with additional instances.`;
      case 'memory':
        return `Increase memory allocation for ${componentType} or implement memory optimization.`;
      case 'network':
        return `Upgrade network bandwidth or implement connection pooling for ${componentType}.`;
      case 'connections':
        return `Increase connection pool size or implement connection multiplexing for ${componentType}.`;
      case 'storage':
        return `Optimize storage performance or add read replicas for ${componentType}.`;
      default:
        return `Consider scaling ${componentType} horizontally or vertically.`;
    }
  }

  /**
   * Generate scaling recommendations based on bottlenecks
   */
  private generateScalingRecommendations(bottlenecks: BottleneckInfo[], currentScale: number): ScalingRecommendation[] {
    const recommendations: ScalingRecommendation[] = [];
    
    for (const bottleneck of bottlenecks) {
      if (bottleneck.severity === 'high' || bottleneck.severity === 'critical') {
        // Generate specific recommendations based on component type and bottleneck
        const recommendation = this.createRecommendationForBottleneck(bottleneck, currentScale);
        if (recommendation) {
          recommendations.push(recommendation);
        }
      }
    }

    // Add general scaling recommendations for high user counts
    if (currentScale >= 1000000) { // 1M+ users
      recommendations.push({
        type: 'add_cache',
        componentId: 'system',
        description: 'Add distributed caching layer to reduce database load at scale',
        estimatedImpact: 'Reduce database load by 60-80%',
        priority: 'high'
      });
    }

    if (currentScale >= 10000000) { // 10M+ users
      recommendations.push({
        type: 'scale_out',
        componentId: 'system',
        description: 'Implement horizontal scaling across multiple regions',
        estimatedImpact: 'Distribute load geographically, improve latency',
        priority: 'high'
      });
    }

    return recommendations;
  }

  /**
   * Create specific recommendation for a bottleneck
   */
  private createRecommendationForBottleneck(bottleneck: BottleneckInfo, currentScale: number): ScalingRecommendation | null {
    switch (bottleneck.limitingFactor) {
      case 'cpu':
        return {
          type: 'scale_up',
          componentId: bottleneck.componentId,
          description: `Increase CPU resources for ${bottleneck.componentType}`,
          estimatedImpact: 'Reduce CPU utilization by 40-60%',
          priority: bottleneck.severity === 'critical' ? 'high' : 'medium'
        };
        
      case 'memory':
        return {
          type: 'scale_up',
          componentId: bottleneck.componentId,
          description: `Increase memory allocation for ${bottleneck.componentType}`,
          estimatedImpact: 'Reduce memory pressure and improve caching',
          priority: bottleneck.severity === 'critical' ? 'high' : 'medium'
        };
        
      case 'connections':
        if (bottleneck.componentType === 'database') {
          return {
            type: 'add_replica',
            componentId: bottleneck.componentId,
            description: 'Add read replicas to distribute database connections',
            estimatedImpact: 'Distribute read load, reduce connection pressure',
            priority: 'high'
          };
        } else {
          return {
            type: 'scale_out',
            componentId: bottleneck.componentId,
            description: `Add more instances of ${bottleneck.componentType}`,
            estimatedImpact: 'Distribute connection load across instances',
            priority: 'medium'
          };
        }
        
      default:
        return {
          type: 'scale_out',
          componentId: bottleneck.componentId,
          description: `Scale out ${bottleneck.componentType} horizontally`,
          estimatedImpact: 'Distribute load across multiple instances',
          priority: bottleneck.severity === 'critical' ? 'high' : 'medium'
        };
    }
  }
}