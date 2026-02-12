/**
 * Resource Saturation Monitoring Service
 * 
 * Implements SRS FR-7.4: Implement CPU, memory, network, storage monitoring with 
 * resource utilization visualization and resource saturation alerting
 */

import { EventEmitter } from 'events';
import { ComponentMetrics } from '../types';

export interface ResourceMetrics {
  componentId: string;
  timestamp: number;
  cpu: CPUMetrics;
  memory: MemoryMetrics;
  network: NetworkMetrics;
  storage: StorageMetrics;
  connections: ConnectionMetrics;
  queues: QueueMetrics;
}

export interface CPUMetrics {
  utilization: number; // 0-100 percentage
  loadAverage: {
    oneMinute: number;
    fiveMinute: number;
    fifteenMinute: number;
  };
  coreCount: number;
  frequency: number; // MHz
  temperature?: number; // Celsius
  throttling: boolean;
  processes: {
    total: number;
    running: number;
    waiting: number;
  };
}

export interface MemoryMetrics {
  utilization: number; // 0-100 percentage
  total: number; // bytes
  used: number; // bytes
  available: number; // bytes
  cached: number; // bytes
  buffers: number; // bytes
  swapTotal: number; // bytes
  swapUsed: number; // bytes
  pageFaults: number; // per second
  gcPressure?: number; // 0-100 for garbage collection pressure
}

export interface NetworkMetrics {
  utilization: number; // 0-100 percentage of bandwidth
  bandwidth: {
    total: number; // bits per second
    used: number; // bits per second
    available: number; // bits per second
  };
  throughput: {
    inbound: number; // bytes per second
    outbound: number; // bytes per second
  };
  packets: {
    inbound: number; // packets per second
    outbound: number; // packets per second
    dropped: number; // packets per second
    errors: number; // packets per second
  };
  connections: {
    active: number;
    established: number;
    timeWait: number;
    closeWait: number;
  };
  latency: {
    average: number; // milliseconds
    p95: number;
    p99: number;
  };
}

export interface StorageMetrics {
  utilization: number; // 0-100 percentage of capacity
  capacity: {
    total: number; // bytes
    used: number; // bytes
    available: number; // bytes
  };
  iops: {
    read: number; // operations per second
    write: number; // operations per second
    total: number; // operations per second
  };
  throughput: {
    read: number; // bytes per second
    write: number; // bytes per second
    total: number; // bytes per second
  };
  latency: {
    read: number; // milliseconds
    write: number; // milliseconds
    average: number; // milliseconds
  };
  queueDepth: number;
  errorRate: number; // 0-1 percentage
}

export interface ConnectionMetrics {
  utilization: number; // 0-100 percentage of pool
  poolSize: {
    total: number;
    active: number;
    idle: number;
    waiting: number;
  };
  connectionRate: {
    created: number; // connections per second
    closed: number; // connections per second
    failed: number; // connections per second
  };
  averageLifetime: number; // seconds
  timeouts: number; // timeouts per second
}

export interface QueueMetrics {
  utilization: number; // 0-100 percentage of capacity
  depth: {
    current: number;
    maximum: number;
    average: number;
  };
  throughput: {
    enqueue: number; // messages per second
    dequeue: number; // messages per second
    processed: number; // messages per second
  };
  latency: {
    enqueue: number; // milliseconds
    dequeue: number; // milliseconds
    processing: number; // milliseconds
  };
  backlog: number; // unprocessed messages
  deadLetters: number; // failed messages
}

export interface ResourceSaturationAnalysis {
  componentId: string;
  timestamp: number;
  overallSaturation: number; // 0-100 overall resource pressure
  criticalResources: CriticalResource[];
  saturationTrend: SaturationTrend;
  bottlenecks: ResourceBottleneck[];
  recommendations: ResourceRecommendation[];
  healthScore: number; // 0-100 resource health
  riskAssessment: RiskAssessment;
}

export interface CriticalResource {
  type: 'cpu' | 'memory' | 'network' | 'storage' | 'connections' | 'queues';
  currentUtilization: number;
  threshold: number;
  severity: 'warning' | 'critical';
  timeInState: number; // milliseconds
  impact: string;
  projectedExhaustion?: number; // minutes until exhaustion
}

export interface SaturationTrend {
  direction: 'increasing' | 'decreasing' | 'stable';
  rate: number; // percentage change per minute
  confidence: number; // 0-1
  predictedSaturation: number; // predicted saturation in next window
  volatility: number; // 0-1 measure of stability
  seasonality?: {
    period: number;
    amplitude: number;
    nextPeak: number; // timestamp
  };
}

export interface ResourceBottleneck {
  resource: 'cpu' | 'memory' | 'network' | 'storage' | 'connections' | 'queues';
  severity: 'minor' | 'moderate' | 'severe' | 'critical';
  description: string;
  impact: number; // 0-100 impact on performance
  rootCause: string;
  symptoms: string[];
  resolution: string[];
  estimatedTime: string;
}

export interface ResourceRecommendation {
  type: 'scaling' | 'optimization' | 'configuration' | 'architecture';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  resource: 'cpu' | 'memory' | 'network' | 'storage' | 'connections' | 'queues';
  action: string;
  expectedImpact: number; // 0-100 expected improvement
  cost: 'low' | 'medium' | 'high';
  complexity: 'low' | 'medium' | 'high';
  timeframe: string;
  prerequisites?: string[];
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: RiskFactor[];
  mitigationStrategies: string[];
  timeToAction: number; // minutes before action required
  businessImpact: string;
}

export interface RiskFactor {
  factor: string;
  probability: number; // 0-1
  impact: number; // 0-100
  riskScore: number; // probability * impact
  mitigation: string;
}

export interface ResourceAlert {
  componentId: string;
  timestamp: number;
  alertType: 'saturation_warning' | 'saturation_critical' | 'bottleneck_detected' | 'trend_degradation' | 'resource_exhaustion';
  severity: 'warning' | 'critical';
  resource: 'cpu' | 'memory' | 'network' | 'storage' | 'connections' | 'queues';
  message: string;
  currentValue: number;
  threshold: number;
  trend: string;
  recommendations: string[];
  estimatedImpact: string;
  timeToAction?: number; // minutes
}

export interface ResourceThresholds {
  cpu: {
    warningThreshold: number;
    criticalThreshold: number;
    loadAverageThreshold: number;
  };
  memory: {
    warningThreshold: number;
    criticalThreshold: number;
    swapWarningThreshold: number;
    gcPressureThreshold?: number;
  };
  network: {
    warningThreshold: number;
    criticalThreshold: number;
    packetLossThreshold: number;
    latencyThreshold: number;
  };
  storage: {
    warningThreshold: number;
    criticalThreshold: number;
    iopsThreshold: number;
    latencyThreshold: number;
  };
  connections: {
    warningThreshold: number;
    criticalThreshold: number;
    timeoutThreshold: number;
  };
  queues: {
    warningThreshold: number;
    criticalThreshold: number;
    backlogThreshold: number;
    latencyThreshold: number;
  };
}

export class ResourceSaturationMonitoringService extends EventEmitter {
  private resourceMetrics: Map<string, ResourceMetrics[]> = new Map();
  private saturationAnalysis: Map<string, ResourceSaturationAnalysis[]> = new Map();
  private thresholds: Map<string, ResourceThresholds> = new Map();
  private analysisInterval: number = 30000; // 30 seconds
  private retentionPeriod: number = 3600000; // 1 hour
  private analysisTimer: NodeJS.Timeout | null = null;
  private defaultThresholds: ResourceThresholds;

  constructor() {
    super();
    this.defaultThresholds = this.createDefaultThresholds();
    this.startAnalysis();
  }

  /**
   * Record resource metrics for a component
   */
  recordResourceMetrics(metrics: ResourceMetrics): void {
    if (!this.resourceMetrics.has(metrics.componentId)) {
      this.resourceMetrics.set(metrics.componentId, []);
    }

    const componentMetrics = this.resourceMetrics.get(metrics.componentId)!;
    componentMetrics.push(metrics);

    // Clean up old metrics
    const cutoffTime = metrics.timestamp - this.retentionPeriod;
    const filteredMetrics = componentMetrics.filter(m => m.timestamp >= cutoffTime);
    this.resourceMetrics.set(metrics.componentId, filteredMetrics);

    this.emit('resource_metrics_recorded', metrics);
  }

  /**
   * Process component metrics to extract resource data
   */
  processComponentMetrics(metrics: ComponentMetrics): void {
    // Convert basic component metrics to detailed resource metrics
    const resourceMetrics: ResourceMetrics = {
      componentId: metrics.componentId,
      timestamp: metrics.timestamp,
      cpu: {
        utilization: metrics.cpuUtilization * 100,
        loadAverage: {
          oneMinute: metrics.cpuUtilization * 2,
          fiveMinute: metrics.cpuUtilization * 1.8,
          fifteenMinute: metrics.cpuUtilization * 1.5
        },
        coreCount: 4, // Default assumption
        frequency: 2400, // MHz
        throttling: metrics.cpuUtilization > 0.9,
        processes: {
          total: Math.floor(metrics.requestsPerSecond * 2),
          running: Math.floor(metrics.requestsPerSecond * 0.3),
          waiting: Math.floor(metrics.queueDepth)
        }
      },
      memory: {
        utilization: metrics.memoryUtilization * 100,
        total: 8 * 1024 * 1024 * 1024, // 8GB default
        used: metrics.memoryUtilization * 8 * 1024 * 1024 * 1024,
        available: (1 - metrics.memoryUtilization) * 8 * 1024 * 1024 * 1024,
        cached: metrics.memoryUtilization * 0.2 * 8 * 1024 * 1024 * 1024,
        buffers: metrics.memoryUtilization * 0.1 * 8 * 1024 * 1024 * 1024,
        swapTotal: 2 * 1024 * 1024 * 1024, // 2GB swap
        swapUsed: Math.max(0, (metrics.memoryUtilization - 0.8) * 2 * 1024 * 1024 * 1024),
        pageFaults: metrics.memoryUtilization > 0.8 ? metrics.requestsPerSecond * 0.1 : 0,
        gcPressure: metrics.memoryUtilization > 0.7 ? (metrics.memoryUtilization - 0.7) * 100 / 0.3 : 0
      },
      network: {
        utilization: Math.min(100, (metrics.requestsPerSecond / 1000) * 100),
        bandwidth: {
          total: 1000 * 1024 * 1024, // 1Gbps
          used: metrics.requestsPerSecond * 1024, // Assume 1KB per request
          available: 1000 * 1024 * 1024 - (metrics.requestsPerSecond * 1024)
        },
        throughput: {
          inbound: metrics.requestsPerSecond * 512, // bytes/sec
          outbound: metrics.requestsPerSecond * 512
        },
        packets: {
          inbound: metrics.requestsPerSecond,
          outbound: metrics.requestsPerSecond,
          dropped: metrics.errorRate * metrics.requestsPerSecond,
          errors: metrics.errorRate * metrics.requestsPerSecond * 0.5
        },
        connections: {
          active: Math.floor(metrics.requestsPerSecond * 2),
          established: Math.floor(metrics.requestsPerSecond * 1.5),
          timeWait: Math.floor(metrics.requestsPerSecond * 0.3),
          closeWait: Math.floor(metrics.requestsPerSecond * 0.1)
        },
        latency: {
          average: metrics.averageLatency,
          p95: metrics.averageLatency * 1.5,
          p99: metrics.averageLatency * 2
        }
      },
      storage: {
        utilization: Math.min(100, (metrics.requestsPerSecond / 500) * 100),
        capacity: {
          total: 100 * 1024 * 1024 * 1024, // 100GB
          used: 50 * 1024 * 1024 * 1024, // 50GB used
          available: 50 * 1024 * 1024 * 1024
        },
        iops: {
          read: metrics.requestsPerSecond * 0.7,
          write: metrics.requestsPerSecond * 0.3,
          total: metrics.requestsPerSecond
        },
        throughput: {
          read: metrics.requestsPerSecond * 0.7 * 4096, // 4KB per read
          write: metrics.requestsPerSecond * 0.3 * 4096,
          total: metrics.requestsPerSecond * 4096
        },
        latency: {
          read: metrics.averageLatency * 0.3,
          write: metrics.averageLatency * 0.5,
          average: metrics.averageLatency * 0.4
        },
        queueDepth: metrics.queueDepth * 0.2,
        errorRate: metrics.errorRate
      },
      connections: {
        utilization: Math.min(100, (metrics.requestsPerSecond / 100) * 100),
        poolSize: {
          total: 100,
          active: Math.floor(metrics.requestsPerSecond * 0.5),
          idle: Math.floor(100 - metrics.requestsPerSecond * 0.5),
          waiting: Math.floor(metrics.queueDepth * 0.3)
        },
        connectionRate: {
          created: metrics.requestsPerSecond * 0.1,
          closed: metrics.requestsPerSecond * 0.1,
          failed: metrics.errorRate * metrics.requestsPerSecond * 0.1
        },
        averageLifetime: 300, // 5 minutes
        timeouts: metrics.errorRate * metrics.requestsPerSecond * 0.05
      },
      queues: {
        utilization: Math.min(100, (metrics.queueDepth / 1000) * 100),
        depth: {
          current: metrics.queueDepth,
          maximum: 1000,
          average: metrics.queueDepth * 0.8
        },
        throughput: {
          enqueue: metrics.requestsPerSecond,
          dequeue: metrics.requestsPerSecond * (1 - metrics.errorRate),
          processed: metrics.requestsPerSecond * (1 - metrics.errorRate)
        },
        latency: {
          enqueue: 1, // 1ms
          dequeue: 2, // 2ms
          processing: metrics.averageLatency * 0.6
        },
        backlog: Math.max(0, metrics.queueDepth - 100),
        deadLetters: metrics.errorRate * metrics.requestsPerSecond * 0.01
      }
    };

    this.recordResourceMetrics(resourceMetrics);
  }

  /**
   * Analyze resource saturation for a component
   */
  analyzeResourceSaturation(componentId: string): ResourceSaturationAnalysis | null {
    const metrics = this.resourceMetrics.get(componentId);
    if (!metrics || metrics.length === 0) {
      return null;
    }

    const latestMetrics = metrics[metrics.length - 1];
    const thresholds = this.thresholds.get(componentId) || this.defaultThresholds;

    // Calculate overall saturation
    const resourceUtilizations = [
      latestMetrics.cpu.utilization,
      latestMetrics.memory.utilization,
      latestMetrics.network.utilization,
      latestMetrics.storage.utilization,
      latestMetrics.connections.utilization,
      latestMetrics.queues.utilization
    ];
    const overallSaturation = Math.max(...resourceUtilizations);

    // Identify critical resources
    const criticalResources = this.identifyCriticalResources(latestMetrics, thresholds);

    // Analyze saturation trend
    const saturationTrend = this.analyzeSaturationTrend(componentId, metrics);

    // Detect bottlenecks
    const bottlenecks = this.detectResourceBottlenecks(latestMetrics, thresholds);

    // Generate recommendations
    const recommendations = this.generateResourceRecommendations(latestMetrics, criticalResources, bottlenecks);

    // Calculate health score
    const healthScore = this.calculateResourceHealthScore(latestMetrics, criticalResources, saturationTrend);

    // Assess risk
    const riskAssessment = this.assessResourceRisk(latestMetrics, criticalResources, saturationTrend);

    return {
      componentId,
      timestamp: latestMetrics.timestamp,
      overallSaturation,
      criticalResources,
      saturationTrend,
      bottlenecks,
      recommendations,
      healthScore,
      riskAssessment
    };
  }

  /**
   * Set resource thresholds for a component
   */
  setThresholds(componentId: string, thresholds: ResourceThresholds): void {
    this.thresholds.set(componentId, thresholds);
    this.emit('thresholds_updated', { componentId, thresholds });
  }

  /**
   * Check for resource alerts
   */
  checkAlerts(componentId: string): ResourceAlert[] {
    const analysis = this.analyzeResourceSaturation(componentId);
    if (!analysis) {
      return [];
    }

    const alerts: ResourceAlert[] = [];
    const now = Date.now();

    // Critical resource alerts
    for (const criticalResource of analysis.criticalResources) {
      const alertType = criticalResource.severity === 'critical' ? 'saturation_critical' : 'saturation_warning';
      
      alerts.push({
        componentId,
        timestamp: now,
        alertType,
        severity: criticalResource.severity,
        resource: criticalResource.type,
        message: `${criticalResource.type.toUpperCase()} utilization (${criticalResource.currentUtilization.toFixed(1)}%) exceeds ${criticalResource.severity} threshold (${criticalResource.threshold}%)`,
        currentValue: criticalResource.currentUtilization,
        threshold: criticalResource.threshold,
        trend: `${analysis.saturationTrend.direction} at ${analysis.saturationTrend.rate.toFixed(2)}%/min`,
        recommendations: this.getResourceAlertRecommendations(criticalResource),
        estimatedImpact: criticalResource.impact,
        timeToAction: criticalResource.projectedExhaustion
      });
    }

    // Bottleneck alerts
    for (const bottleneck of analysis.bottlenecks) {
      if (bottleneck.severity === 'severe' || bottleneck.severity === 'critical') {
        alerts.push({
          componentId,
          timestamp: now,
          alertType: 'bottleneck_detected',
          severity: bottleneck.severity === 'critical' ? 'critical' : 'warning',
          resource: bottleneck.resource,
          message: `${bottleneck.severity} ${bottleneck.resource} bottleneck: ${bottleneck.description}`,
          currentValue: bottleneck.impact,
          threshold: 20, // 20% impact threshold
          trend: bottleneck.rootCause,
          recommendations: bottleneck.resolution,
          estimatedImpact: `${bottleneck.impact}% performance impact`
        });
      }
    }

    // Trend degradation alerts
    if (analysis.saturationTrend.direction === 'increasing' && 
        analysis.saturationTrend.rate > 5 && // 5% per minute
        analysis.saturationTrend.confidence > 0.7) {
      alerts.push({
        componentId,
        timestamp: now,
        alertType: 'trend_degradation',
        severity: analysis.saturationTrend.rate > 10 ? 'critical' : 'warning',
        resource: 'cpu', // Simplified - would determine primary resource
        message: `Resource saturation trending upward at ${analysis.saturationTrend.rate.toFixed(2)}% per minute`,
        currentValue: analysis.saturationTrend.rate,
        threshold: 5,
        trend: `Predicted saturation: ${analysis.saturationTrend.predictedSaturation.toFixed(1)}%`,
        recommendations: [
          'Monitor resource trends closely',
          'Prepare for scaling actions',
          'Review capacity planning'
        ],
        estimatedImpact: 'Progressive resource exhaustion'
      });
    }

    // Resource exhaustion alerts
    if (analysis.riskAssessment.overallRisk === 'critical' || analysis.riskAssessment.overallRisk === 'high') {
      alerts.push({
        componentId,
        timestamp: now,
        alertType: 'resource_exhaustion',
        severity: analysis.riskAssessment.overallRisk === 'critical' ? 'critical' : 'warning',
        resource: 'cpu', // Simplified
        message: `${analysis.riskAssessment.overallRisk} risk of resource exhaustion`,
        currentValue: analysis.overallSaturation,
        threshold: 80,
        trend: analysis.riskAssessment.businessImpact,
        recommendations: analysis.riskAssessment.mitigationStrategies,
        estimatedImpact: analysis.riskAssessment.businessImpact,
        timeToAction: analysis.riskAssessment.timeToAction
      });
    }

    return alerts;
  }

  /**
   * Get component IDs with resource data
   */
  getComponentIds(): string[] {
    return Array.from(this.resourceMetrics.keys());
  }

  /**
   * Clear resource data for a component
   */
  clearComponentData(componentId: string): void {
    this.resourceMetrics.delete(componentId);
    this.saturationAnalysis.delete(componentId);
    this.thresholds.delete(componentId);
    this.emit('component_data_cleared', { componentId });
  }

  /**
   * Create default resource thresholds
   */
  private createDefaultThresholds(): ResourceThresholds {
    return {
      cpu: {
        warningThreshold: 70,
        criticalThreshold: 90,
        loadAverageThreshold: 2.0
      },
      memory: {
        warningThreshold: 80,
        criticalThreshold: 95,
        swapWarningThreshold: 50,
        gcPressureThreshold: 70
      },
      network: {
        warningThreshold: 70,
        criticalThreshold: 90,
        packetLossThreshold: 1, // 1%
        latencyThreshold: 100 // 100ms
      },
      storage: {
        warningThreshold: 80,
        criticalThreshold: 95,
        iopsThreshold: 1000,
        latencyThreshold: 50 // 50ms
      },
      connections: {
        warningThreshold: 80,
        criticalThreshold: 95,
        timeoutThreshold: 5 // 5 timeouts per second
      },
      queues: {
        warningThreshold: 70,
        criticalThreshold: 90,
        backlogThreshold: 1000,
        latencyThreshold: 1000 // 1 second
      }
    };
  }

  /**
   * Identify critical resources
   */
  private identifyCriticalResources(metrics: ResourceMetrics, thresholds: ResourceThresholds): CriticalResource[] {
    const criticalResources: CriticalResource[] = [];

    // Check CPU
    if (metrics.cpu.utilization > thresholds.cpu.warningThreshold) {
      criticalResources.push({
        type: 'cpu',
        currentUtilization: metrics.cpu.utilization,
        threshold: metrics.cpu.utilization > thresholds.cpu.criticalThreshold ? 
          thresholds.cpu.criticalThreshold : thresholds.cpu.warningThreshold,
        severity: metrics.cpu.utilization > thresholds.cpu.criticalThreshold ? 'critical' : 'warning',
        timeInState: 30000, // Simplified
        impact: 'High CPU usage affects request processing speed',
        projectedExhaustion: metrics.cpu.utilization > 95 ? 5 : undefined
      });
    }

    // Check Memory
    if (metrics.memory.utilization > thresholds.memory.warningThreshold) {
      criticalResources.push({
        type: 'memory',
        currentUtilization: metrics.memory.utilization,
        threshold: metrics.memory.utilization > thresholds.memory.criticalThreshold ? 
          thresholds.memory.criticalThreshold : thresholds.memory.warningThreshold,
        severity: metrics.memory.utilization > thresholds.memory.criticalThreshold ? 'critical' : 'warning',
        timeInState: 30000,
        impact: 'High memory usage can cause garbage collection delays',
        projectedExhaustion: metrics.memory.utilization > 90 ? 10 : undefined
      });
    }

    // Check Network
    if (metrics.network.utilization > thresholds.network.warningThreshold) {
      criticalResources.push({
        type: 'network',
        currentUtilization: metrics.network.utilization,
        threshold: metrics.network.utilization > thresholds.network.criticalThreshold ? 
          thresholds.network.criticalThreshold : thresholds.network.warningThreshold,
        severity: metrics.network.utilization > thresholds.network.criticalThreshold ? 'critical' : 'warning',
        timeInState: 30000,
        impact: 'Network saturation causes increased latency and packet loss'
      });
    }

    // Check Storage
    if (metrics.storage.utilization > thresholds.storage.warningThreshold) {
      criticalResources.push({
        type: 'storage',
        currentUtilization: metrics.storage.utilization,
        threshold: metrics.storage.utilization > thresholds.storage.criticalThreshold ? 
          thresholds.storage.criticalThreshold : thresholds.storage.warningThreshold,
        severity: metrics.storage.utilization > thresholds.storage.criticalThreshold ? 'critical' : 'warning',
        timeInState: 30000,
        impact: 'Storage bottleneck affects data access performance'
      });
    }

    // Check Connections
    if (metrics.connections.utilization > thresholds.connections.warningThreshold) {
      criticalResources.push({
        type: 'connections',
        currentUtilization: metrics.connections.utilization,
        threshold: metrics.connections.utilization > thresholds.connections.criticalThreshold ? 
          thresholds.connections.criticalThreshold : thresholds.connections.warningThreshold,
        severity: metrics.connections.utilization > thresholds.connections.criticalThreshold ? 'critical' : 'warning',
        timeInState: 30000,
        impact: 'Connection pool exhaustion blocks new requests'
      });
    }

    // Check Queues
    if (metrics.queues.utilization > thresholds.queues.warningThreshold) {
      criticalResources.push({
        type: 'queues',
        currentUtilization: metrics.queues.utilization,
        threshold: metrics.queues.utilization > thresholds.queues.criticalThreshold ? 
          thresholds.queues.criticalThreshold : thresholds.queues.warningThreshold,
        severity: metrics.queues.utilization > thresholds.queues.criticalThreshold ? 'critical' : 'warning',
        timeInState: 30000,
        impact: 'Queue saturation increases processing latency'
      });
    }

    return criticalResources;
  }

  /**
   * Analyze saturation trend
   */
  private analyzeSaturationTrend(componentId: string, metrics: ResourceMetrics[]): SaturationTrend {
    if (metrics.length < 5) {
      return {
        direction: 'stable',
        rate: 0,
        confidence: 0,
        predictedSaturation: 0,
        volatility: 0
      };
    }

    // Calculate overall saturation for each time point
    const saturations = metrics.map(m => Math.max(
      m.cpu.utilization,
      m.memory.utilization,
      m.network.utilization,
      m.storage.utilization,
      m.connections.utilization,
      m.queues.utilization
    ));

    // Simple linear regression
    const n = saturations.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = saturations;

    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate correlation for confidence
    const meanX = sumX / n;
    const meanY = sumY / n;
    const numerator = x.reduce((sum, val, i) => sum + (val - meanX) * (y[i] - meanY), 0);
    const denomX = Math.sqrt(x.reduce((sum, val) => sum + Math.pow(val - meanX, 2), 0));
    const denomY = Math.sqrt(y.reduce((sum, val) => sum + Math.pow(val - meanY, 2), 0));
    const correlation = numerator / (denomX * denomY);
    const confidence = Math.abs(correlation);

    // Determine direction
    let direction: 'increasing' | 'decreasing' | 'stable';
    const rate = (slope / meanY) * 100 * 60; // percentage change per minute

    if (Math.abs(rate) < 1) {
      direction = 'stable';
    } else if (rate > 0) {
      direction = 'increasing';
    } else {
      direction = 'decreasing';
    }

    // Calculate volatility
    const variance = y.reduce((sum, val) => sum + Math.pow(val - meanY, 2), 0) / n;
    const volatility = Math.sqrt(variance) / meanY;

    // Predict next value
    const predictedSaturation = Math.max(0, Math.min(100, slope * n + intercept));

    return {
      direction,
      rate: Math.abs(rate),
      confidence,
      predictedSaturation,
      volatility: Math.min(1, volatility)
    };
  }

  /**
   * Detect resource bottlenecks
   */
  private detectResourceBottlenecks(metrics: ResourceMetrics, thresholds: ResourceThresholds): ResourceBottleneck[] {
    const bottlenecks: ResourceBottleneck[] = [];

    // CPU bottleneck
    if (metrics.cpu.utilization > 85) {
      bottlenecks.push({
        resource: 'cpu',
        severity: metrics.cpu.utilization > 95 ? 'critical' : 'severe',
        description: 'High CPU utilization limiting request processing',
        impact: Math.min(80, (metrics.cpu.utilization - 70) * 2),
        rootCause: 'CPU-intensive operations or insufficient compute capacity',
        symptoms: ['High response times', 'Request queuing', 'System sluggishness'],
        resolution: ['Scale vertically (more CPU)', 'Scale horizontally (more instances)', 'Optimize CPU-intensive code'],
        estimatedTime: '5-30 minutes'
      });
    }

    // Memory bottleneck
    if (metrics.memory.utilization > 85 || (metrics.memory.gcPressure && metrics.memory.gcPressure > 70)) {
      bottlenecks.push({
        resource: 'memory',
        severity: metrics.memory.utilization > 95 ? 'critical' : 'severe',
        description: 'Memory pressure causing performance degradation',
        impact: Math.min(70, (metrics.memory.utilization - 70) * 1.5),
        rootCause: 'Memory leaks, large object allocations, or insufficient memory',
        symptoms: ['Frequent garbage collection', 'Swap usage', 'Out of memory errors'],
        resolution: ['Increase memory allocation', 'Fix memory leaks', 'Optimize memory usage'],
        estimatedTime: '10-60 minutes'
      });
    }

    // Network bottleneck
    if (metrics.network.utilization > 80 || metrics.network.packets.dropped > 10) {
      bottlenecks.push({
        resource: 'network',
        severity: metrics.network.utilization > 90 ? 'critical' : 'moderate',
        description: 'Network bandwidth or packet processing limitations',
        impact: Math.min(60, (metrics.network.utilization - 60) * 1.2),
        rootCause: 'Bandwidth saturation or network configuration issues',
        symptoms: ['Increased latency', 'Packet drops', 'Connection timeouts'],
        resolution: ['Upgrade network capacity', 'Optimize data transfer', 'Implement compression'],
        estimatedTime: '15-120 minutes'
      });
    }

    // Storage bottleneck
    if (metrics.storage.iops.total > 800 || metrics.storage.latency.average > 50) {
      bottlenecks.push({
        resource: 'storage',
        severity: metrics.storage.latency.average > 100 ? 'severe' : 'moderate',
        description: 'Storage I/O performance limitations',
        impact: Math.min(50, (metrics.storage.latency.average - 20) * 1.5),
        rootCause: 'Disk I/O saturation or slow storage subsystem',
        symptoms: ['High I/O wait times', 'Slow database queries', 'File access delays'],
        resolution: ['Upgrade to faster storage', 'Implement caching', 'Optimize queries'],
        estimatedTime: '30-180 minutes'
      });
    }

    return bottlenecks;
  }

  /**
   * Generate resource recommendations
   */
  private generateResourceRecommendations(
    metrics: ResourceMetrics, 
    criticalResources: CriticalResource[], 
    bottlenecks: ResourceBottleneck[]
  ): ResourceRecommendation[] {
    const recommendations: ResourceRecommendation[] = [];

    // CPU recommendations
    if (metrics.cpu.utilization > 80) {
      recommendations.push({
        type: 'scaling',
        priority: metrics.cpu.utilization > 90 ? 'urgent' : 'high',
        resource: 'cpu',
        action: 'Scale CPU resources vertically or horizontally',
        expectedImpact: Math.min(80, (metrics.cpu.utilization - 50) * 1.5),
        cost: 'medium',
        complexity: 'low',
        timeframe: '5-15 minutes'
      });
    }

    // Memory recommendations
    if (metrics.memory.utilization > 80) {
      recommendations.push({
        type: 'scaling',
        priority: metrics.memory.utilization > 90 ? 'urgent' : 'high',
        resource: 'memory',
        action: 'Increase memory allocation or optimize memory usage',
        expectedImpact: Math.min(70, (metrics.memory.utilization - 60) * 1.2),
        cost: 'medium',
        complexity: 'low',
        timeframe: '10-30 minutes'
      });
    }

    // Queue recommendations
    if (metrics.queues.utilization > 70) {
      recommendations.push({
        type: 'configuration',
        priority: 'medium',
        resource: 'queues',
        action: 'Increase queue capacity or add more workers',
        expectedImpact: Math.min(60, (metrics.queues.utilization - 50) * 1.0),
        cost: 'low',
        complexity: 'medium',
        timeframe: '15-45 minutes'
      });
    }

    return recommendations;
  }

  /**
   * Calculate resource health score
   */
  private calculateResourceHealthScore(
    metrics: ResourceMetrics, 
    criticalResources: CriticalResource[], 
    trend: SaturationTrend
  ): number {
    let score = 100;

    // Penalize based on resource utilization
    const utilizationPenalty = Math.max(
      Math.max(0, metrics.cpu.utilization - 70) * 0.5,
      Math.max(0, metrics.memory.utilization - 70) * 0.4,
      Math.max(0, metrics.network.utilization - 70) * 0.3,
      Math.max(0, metrics.storage.utilization - 70) * 0.3,
      Math.max(0, metrics.connections.utilization - 70) * 0.2,
      Math.max(0, metrics.queues.utilization - 70) * 0.2
    );
    score -= utilizationPenalty;

    // Penalize based on critical resources
    score -= criticalResources.length * 10;

    // Penalize based on trend
    if (trend.direction === 'increasing') {
      score -= trend.rate * 2;
    }

    // Penalize based on volatility
    score -= trend.volatility * 15;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Assess resource risk
   */
  private assessResourceRisk(
    metrics: ResourceMetrics, 
    criticalResources: CriticalResource[], 
    trend: SaturationTrend
  ): RiskAssessment {
    const riskFactors: RiskFactor[] = [];

    // High utilization risk
    const maxUtilization = Math.max(
      metrics.cpu.utilization,
      metrics.memory.utilization,
      metrics.network.utilization,
      metrics.storage.utilization
    );

    if (maxUtilization > 80) {
      riskFactors.push({
        factor: 'High resource utilization',
        probability: Math.min(1, (maxUtilization - 70) / 30),
        impact: Math.min(100, (maxUtilization - 50) * 2),
        riskScore: 0,
        mitigation: 'Scale resources or optimize usage'
      });
    }

    // Trend risk
    if (trend.direction === 'increasing' && trend.rate > 5) {
      riskFactors.push({
        factor: 'Increasing resource pressure',
        probability: trend.confidence,
        impact: Math.min(100, trend.rate * 10),
        riskScore: 0,
        mitigation: 'Monitor trends and prepare scaling actions'
      });
    }

    // Calculate risk scores
    for (const factor of riskFactors) {
      factor.riskScore = factor.probability * factor.impact;
    }

    // Determine overall risk
    const maxRiskScore = Math.max(...riskFactors.map(f => f.riskScore), 0);
    let overallRisk: 'low' | 'medium' | 'high' | 'critical';
    
    if (maxRiskScore > 80) {
      overallRisk = 'critical';
    } else if (maxRiskScore > 60) {
      overallRisk = 'high';
    } else if (maxRiskScore > 30) {
      overallRisk = 'medium';
    } else {
      overallRisk = 'low';
    }

    // Calculate time to action
    let timeToAction = 60; // Default 60 minutes
    if (overallRisk === 'critical') {
      timeToAction = 5;
    } else if (overallRisk === 'high') {
      timeToAction = 15;
    } else if (overallRisk === 'medium') {
      timeToAction = 30;
    }

    return {
      overallRisk,
      riskFactors,
      mitigationStrategies: riskFactors.map(f => f.mitigation),
      timeToAction,
      businessImpact: this.getBusinessImpactDescription(overallRisk)
    };
  }

  /**
   * Get business impact description
   */
  private getBusinessImpactDescription(risk: 'low' | 'medium' | 'high' | 'critical'): string {
    const impacts = {
      low: 'Minimal impact on service performance',
      medium: 'Potential service quality degradation',
      high: 'Significant risk of service disruption',
      critical: 'Imminent risk of service failure'
    };
    return impacts[risk];
  }

  /**
   * Get resource alert recommendations
   */
  private getResourceAlertRecommendations(resource: CriticalResource): string[] {
    const recommendations: Record<string, string[]> = {
      cpu: [
        'Scale CPU resources vertically or horizontally',
        'Optimize CPU-intensive operations',
        'Review and tune application performance'
      ],
      memory: [
        'Increase memory allocation',
        'Investigate memory leaks',
        'Optimize memory usage patterns'
      ],
      network: [
        'Upgrade network bandwidth',
        'Implement data compression',
        'Optimize network protocols'
      ],
      storage: [
        'Upgrade to faster storage',
        'Implement caching strategies',
        'Optimize database queries'
      ],
      connections: [
        'Increase connection pool size',
        'Optimize connection lifecycle',
        'Implement connection pooling'
      ],
      queues: [
        'Increase queue capacity',
        'Add more queue workers',
        'Optimize message processing'
      ]
    };

    return recommendations[resource.type] || ['Monitor resource usage closely'];
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
   * Perform periodic analysis for all components
   */
  private performPeriodicAnalysis(): void {
    const componentIds = this.getComponentIds();
    
    for (const componentId of componentIds) {
      const analysis = this.analyzeResourceSaturation(componentId);
      if (analysis) {
        // Store analysis history
        if (!this.saturationAnalysis.has(componentId)) {
          this.saturationAnalysis.set(componentId, []);
        }
        
        const analysisHistory = this.saturationAnalysis.get(componentId)!;
        analysisHistory.push(analysis);
        
        // Keep only recent analysis
        const maxAnalysis = Math.floor(this.retentionPeriod / this.analysisInterval);
        if (analysisHistory.length > maxAnalysis) {
          analysisHistory.splice(0, analysisHistory.length - maxAnalysis);
        }
        
        // Check for alerts
        const alerts = this.checkAlerts(componentId);
        if (alerts.length > 0) {
          this.emit('alerts_generated', { componentId, alerts });
        }
        
        this.emit('analysis_completed', { componentId, analysis });
      }
    }
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
}