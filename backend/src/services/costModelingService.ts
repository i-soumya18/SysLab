/**
 * Cost Modeling Service for System Design Simulator
 * Implements SRS FR-8: Cost Modeling Engine
 * 
 * This service provides comprehensive cost modeling capabilities including:
 * - Compute cost estimation (SRS FR-8.1)
 * - Storage cost modeling (SRS FR-8.2) 
 * - Network cost estimation (SRS FR-8.3)
 * - Traffic-based cost scaling (SRS FR-8.4)
 * - Cost vs performance tradeoff analysis (SRS FR-8.5)
 */

import type { Component, ComponentType, ComponentConfig } from '../types';

// Cost modeling interfaces implementing SRS FR-8
export interface ComputeCostModel {
  instanceType: string;
  vcpus: number;
  memory: number; // GB
  storage: number; // GB
  hourlyRate: number; // USD per hour
  region: string;
  provider: 'aws' | 'gcp' | 'azure' | 'generic';
}

export interface StorageCostModel {
  storageType: 'ssd' | 'hdd' | 'nvme' | 'object' | 'archive';
  pricePerGB: number; // USD per GB per month
  iopsRate?: number; // USD per IOPS per month
  throughputRate?: number; // USD per MB/s per month
  replicationFactor: number;
  backupCost?: number; // USD per GB per month
}

export interface NetworkCostModel {
  dataTransferIn: number; // USD per GB
  dataTransferOut: number; // USD per GB
  dataTransferIntraRegion: number; // USD per GB
  dataTransferInterRegion: number; // USD per GB
  bandwidthCost: number; // USD per Mbps per month
  cdnCost?: number; // USD per GB
}

export interface TrafficCostScaling {
  userCount: number;
  requestsPerUser: number;
  dataVolumePerUser: number; // MB
  peakMultiplier: number;
  averageMultiplier: number;
  sessionDuration: number; // minutes
}

export interface CostBreakdown {
  compute: number;
  storage: number;
  network: number;
  total: number;
  currency: string;
  period: 'hour' | 'day' | 'month' | 'year';
}

export interface CostOptimizationRecommendation {
  id: string;
  category: 'compute' | 'storage' | 'network' | 'architecture';
  title: string;
  description: string;
  potentialSavings: number; // USD per month
  savingsPercentage: number;
  implementationComplexity: 'low' | 'medium' | 'high';
  riskLevel: 'low' | 'medium' | 'high';
  timeToImplement: string;
  prerequisites: string[];
}

export interface PerformanceCostTradeoff {
  scenario: string;
  performanceMetrics: {
    latency: number; // ms
    throughput: number; // requests/sec
    availability: number; // percentage
    reliability: number; // percentage
  };
  costMetrics: CostBreakdown;
  efficiency: {
    costPerRequest: number;
    costPerUser: number;
    performancePerDollar: number;
  };
  recommendations: CostOptimizationRecommendation[];
}

// Cloud provider pricing data (simplified for educational purposes)
const CLOUD_PRICING = {
  aws: {
    compute: {
      't3.micro': { vcpus: 2, memory: 1, hourlyRate: 0.0104, storage: 8 },
      't3.small': { vcpus: 2, memory: 2, hourlyRate: 0.0208, storage: 8 },
      't3.medium': { vcpus: 2, memory: 4, hourlyRate: 0.0416, storage: 8 },
      't3.large': { vcpus: 2, memory: 8, hourlyRate: 0.0832, storage: 8 },
      'm5.large': { vcpus: 2, memory: 8, hourlyRate: 0.096, storage: 8 },
      'm5.xlarge': { vcpus: 4, memory: 16, hourlyRate: 0.192, storage: 8 },
      'm5.2xlarge': { vcpus: 8, memory: 32, hourlyRate: 0.384, storage: 8 },
      'c5.large': { vcpus: 2, memory: 4, hourlyRate: 0.085, storage: 8 },
      'c5.xlarge': { vcpus: 4, memory: 8, hourlyRate: 0.17, storage: 8 },
      'r5.large': { vcpus: 2, memory: 16, hourlyRate: 0.126, storage: 8 }
    },
    storage: {
      'gp3': { pricePerGB: 0.08, iopsRate: 0.005, throughputRate: 0.04 },
      'gp2': { pricePerGB: 0.10, iopsRate: 0, throughputRate: 0 },
      'io2': { pricePerGB: 0.125, iopsRate: 0.065, throughputRate: 0 },
      's3-standard': { pricePerGB: 0.023, iopsRate: 0, throughputRate: 0 },
      's3-ia': { pricePerGB: 0.0125, iopsRate: 0, throughputRate: 0 },
      's3-glacier': { pricePerGB: 0.004, iopsRate: 0, throughputRate: 0 }
    },
    network: {
      dataTransferIn: 0,
      dataTransferOut: 0.09,
      dataTransferIntraRegion: 0.01,
      dataTransferInterRegion: 0.02,
      bandwidthCost: 0,
      cdnCost: 0.085
    }
  },
  gcp: {
    compute: {
      'e2-micro': { vcpus: 2, memory: 1, hourlyRate: 0.008467, storage: 10 },
      'e2-small': { vcpus: 2, memory: 2, hourlyRate: 0.016934, storage: 10 },
      'e2-medium': { vcpus: 2, memory: 4, hourlyRate: 0.033869, storage: 10 },
      'n1-standard-1': { vcpus: 1, memory: 3.75, hourlyRate: 0.0475, storage: 10 },
      'n1-standard-2': { vcpus: 2, memory: 7.5, hourlyRate: 0.095, storage: 10 },
      'n1-standard-4': { vcpus: 4, memory: 15, hourlyRate: 0.19, storage: 10 }
    },
    storage: {
      'pd-standard': { pricePerGB: 0.04, iopsRate: 0, throughputRate: 0 },
      'pd-ssd': { pricePerGB: 0.17, iopsRate: 0, throughputRate: 0 },
      'pd-extreme': { pricePerGB: 0.65, iopsRate: 0, throughputRate: 0 },
      'cloud-storage': { pricePerGB: 0.02, iopsRate: 0, throughputRate: 0 }
    },
    network: {
      dataTransferIn: 0,
      dataTransferOut: 0.12,
      dataTransferIntraRegion: 0.01,
      dataTransferInterRegion: 0.05,
      bandwidthCost: 0,
      cdnCost: 0.08
    }
  },
  azure: {
    compute: {
      'B1s': { vcpus: 1, memory: 1, hourlyRate: 0.0104, storage: 4 },
      'B2s': { vcpus: 2, memory: 4, hourlyRate: 0.0416, storage: 8 },
      'D2s_v3': { vcpus: 2, memory: 8, hourlyRate: 0.096, storage: 16 },
      'D4s_v3': { vcpus: 4, memory: 16, hourlyRate: 0.192, storage: 32 }
    },
    storage: {
      'premium-ssd': { pricePerGB: 0.135, iopsRate: 0, throughputRate: 0 },
      'standard-ssd': { pricePerGB: 0.075, iopsRate: 0, throughputRate: 0 },
      'standard-hdd': { pricePerGB: 0.045, iopsRate: 0, throughputRate: 0 },
      'blob-storage': { pricePerGB: 0.0184, iopsRate: 0, throughputRate: 0 }
    },
    network: {
      dataTransferIn: 0,
      dataTransferOut: 0.087,
      dataTransferIntraRegion: 0.01,
      dataTransferInterRegion: 0.035,
      bandwidthCost: 0,
      cdnCost: 0.081
    }
  }
};

export class CostModelingService {
  private static instance: CostModelingService;
  private cloudPricing = CLOUD_PRICING;

  private constructor() {}

  public static getInstance(): CostModelingService {
    if (!CostModelingService.instance) {
      CostModelingService.instance = new CostModelingService();
    }
    return CostModelingService.instance;
  }

  /**
   * SRS FR-8.1: Implement compute cost estimation
   * Create compute cost calculation per SRS FR-8.1
   * Add instance type and sizing cost modeling per SRS FR-8.1
   * Implement auto-scaling cost implications per SRS FR-8.1
   */
  public calculateComputeCost(
    component: Component,
    userCount: number,
    provider: 'aws' | 'gcp' | 'azure' = 'aws',
    region: string = 'us-east-1'
  ): ComputeCostModel {
    const instanceType = this.selectOptimalInstanceType(component, userCount, provider);
    const pricing = (this.cloudPricing[provider].compute as any)[instanceType];
    
    if (!pricing) {
      throw new Error(`Instance type ${instanceType} not found for provider ${provider}`);
    }

    // Calculate auto-scaling implications
    const autoScalingMultiplier = this.calculateAutoScalingMultiplier(component, userCount);
    const adjustedHourlyRate = pricing.hourlyRate * autoScalingMultiplier;

    return {
      instanceType,
      vcpus: pricing.vcpus,
      memory: pricing.memory,
      storage: pricing.storage,
      hourlyRate: adjustedHourlyRate,
      region,
      provider
    };
  }

  /**
   * SRS FR-8.2: Add storage cost modeling
   * Implement storage cost calculation per SRS FR-8.2
   * Create data volume and replication cost modeling per SRS FR-8.2
   * Add storage tier and lifecycle cost analysis per SRS FR-8.2
   */
  public calculateStorageCost(
    component: Component,
    dataVolumeGB: number,
    provider: 'aws' | 'gcp' | 'azure' = 'aws'
  ): StorageCostModel {
    const storageType = this.selectOptimalStorageType(component, dataVolumeGB);
    const pricing = (this.cloudPricing[provider].storage as any)[storageType];
    
    if (!pricing) {
      throw new Error(`Storage type ${storageType} not found for provider ${provider}`);
    }

    // Get replication factor from component configuration
    const replicationFactor = this.getReplicationFactor(component);
    
    // Calculate backup costs for databases
    const backupCost = component.type === 'database' ? pricing.pricePerGB * 0.1 : 0;

    return {
      storageType: this.mapToStorageType(storageType),
      pricePerGB: pricing.pricePerGB,
      iopsRate: pricing.iopsRate,
      throughputRate: pricing.throughputRate,
      replicationFactor,
      backupCost
    };
  }

  /**
   * SRS FR-8.3: Create network cost estimation
   * Implement data transfer cost calculation per SRS FR-8.3
   * Add bandwidth and geographic cost modeling per SRS FR-8.3
   * Create CDN and edge cost analysis per SRS FR-8.3
   */
  public calculateNetworkCost(
    connections: Array<{ sourceComponent: Component; targetComponent: Component; dataVolumeGB: number }>,
    provider: 'aws' | 'gcp' | 'azure' = 'aws',
    regions: string[] = ['us-east-1']
  ): NetworkCostModel {
    const pricing = this.cloudPricing[provider].network;
    
    let totalDataTransferOut = 0;
    let totalDataTransferIntraRegion = 0;
    let totalDataTransferInterRegion = 0;
    let totalCdnCost = 0;

    connections.forEach(({ sourceComponent, targetComponent, dataVolumeGB }) => {
      if (sourceComponent.type === 'cdn' || targetComponent.type === 'cdn') {
        totalCdnCost += dataVolumeGB * pricing.cdnCost!;
      } else if (regions.length > 1) {
        totalDataTransferInterRegion += dataVolumeGB * pricing.dataTransferInterRegion;
      } else {
        totalDataTransferIntraRegion += dataVolumeGB * pricing.dataTransferIntraRegion;
      }
      
      totalDataTransferOut += dataVolumeGB * pricing.dataTransferOut;
    });

    return {
      dataTransferIn: pricing.dataTransferIn,
      dataTransferOut: totalDataTransferOut,
      dataTransferIntraRegion: totalDataTransferIntraRegion,
      dataTransferInterRegion: totalDataTransferInterRegion,
      bandwidthCost: pricing.bandwidthCost,
      cdnCost: totalCdnCost
    };
  }

  /**
   * SRS FR-8.4: Implement traffic-based cost scaling
   * Create cost scaling with user load per SRS FR-8.4
   * Add traffic pattern cost implications per SRS FR-8.4
   * Implement peak vs average cost analysis per SRS FR-8.4
   */
  public calculateTrafficBasedCostScaling(
    components: Component[],
    trafficScaling: TrafficCostScaling,
    provider: 'aws' | 'gcp' | 'azure' = 'aws'
  ): { peakCost: CostBreakdown; averageCost: CostBreakdown; scalingAnalysis: any } {
    const baseDataVolume = trafficScaling.dataVolumePerUser * trafficScaling.userCount;
    
    // Calculate peak costs
    const peakUserCount = trafficScaling.userCount * trafficScaling.peakMultiplier;
    const peakDataVolume = baseDataVolume * trafficScaling.peakMultiplier;
    const peakCost = this.calculateTotalCost(components, peakUserCount, peakDataVolume, provider);

    // Calculate average costs
    const averageUserCount = trafficScaling.userCount * trafficScaling.averageMultiplier;
    const averageDataVolume = baseDataVolume * trafficScaling.averageMultiplier;
    const averageCost = this.calculateTotalCost(components, averageUserCount, averageDataVolume, provider);

    // Scaling analysis
    const scalingAnalysis = {
      costVariability: ((peakCost.total - averageCost.total) / averageCost.total) * 100,
      peakToAverageRatio: peakCost.total / averageCost.total,
      trafficPatternImpact: {
        compute: ((peakCost.compute - averageCost.compute) / averageCost.compute) * 100,
        storage: ((peakCost.storage - averageCost.storage) / averageCost.storage) * 100,
        network: ((peakCost.network - averageCost.network) / averageCost.network) * 100
      },
      recommendations: this.generateTrafficScalingRecommendations(peakCost, averageCost, trafficScaling)
    };

    return { peakCost, averageCost, scalingAnalysis };
  }

  /**
   * SRS FR-8.5: Add cost vs performance tradeoff analysis
   * Create cost optimization recommendations per SRS FR-8.5
   * Implement performance vs cost comparison per SRS FR-8.5
   * Add cost-effective scaling strategy suggestions per SRS FR-8.5
   */
  public analyzePerformanceCostTradeoffs(
    components: Component[],
    userCount: number,
    performanceRequirements: {
      maxLatency: number;
      minThroughput: number;
      minAvailability: number;
    },
    provider: 'aws' | 'gcp' | 'azure' = 'aws'
  ): PerformanceCostTradeoff[] {
    const scenarios = [
      { name: 'cost-optimized', description: 'Minimize cost while meeting basic requirements' },
      { name: 'balanced', description: 'Balance cost and performance' },
      { name: 'performance-optimized', description: 'Maximize performance regardless of cost' }
    ];

    return scenarios.map(scenario => {
      const optimizedComponents = this.optimizeComponentsForScenario(components, scenario.name, userCount);
      const costMetrics = this.calculateTotalCost(optimizedComponents, userCount, userCount * 10, provider);
      const performanceMetrics = this.estimatePerformanceMetrics(optimizedComponents, userCount);
      
      return {
        scenario: scenario.name,
        performanceMetrics,
        costMetrics,
        efficiency: {
          costPerRequest: costMetrics.total / (performanceMetrics.throughput * 3600), // per hour
          costPerUser: costMetrics.total / userCount,
          performancePerDollar: performanceMetrics.throughput / costMetrics.total
        },
        recommendations: this.generateCostOptimizationRecommendations(optimizedComponents, costMetrics, performanceMetrics)
      };
    });
  }

  // Helper methods for cost calculations

  private selectOptimalInstanceType(component: Component, userCount: number, provider: 'aws' | 'gcp' | 'azure'): string {
    const instances = Object.keys(this.cloudPricing[provider].compute);
    
    // Simple heuristic based on component type and user count
    if (userCount < 100) {
      return instances[0]; // smallest instance
    } else if (userCount < 1000) {
      return instances[Math.min(2, instances.length - 1)];
    } else if (userCount < 10000) {
      return instances[Math.min(4, instances.length - 1)];
    } else {
      return instances[instances.length - 1]; // largest instance
    }
  }

  private calculateAutoScalingMultiplier(component: Component, userCount: number): number {
    // Auto-scaling multiplier based on component configuration and user count
    const config = component.configuration as any;
    
    if (config.scalingOptions?.autoScaling?.enabled) {
      const baseInstances = Math.max(1, Math.ceil(userCount / 1000));
      const maxInstances = config.scalingOptions.horizontal?.maxInstances || baseInstances * 3;
      return Math.min(baseInstances, maxInstances);
    }
    
    return 1; // No auto-scaling
  }

  private selectOptimalStorageType(component: Component, dataVolumeGB: number): string {
    switch (component.type) {
      case 'database':
        return dataVolumeGB > 1000 ? 'gp3' : 'gp2';
      case 'cache':
        return 'gp3'; // Use gp3 instead of premium-ssd for AWS
      case 'cdn':
        return 's3-standard';
      default:
        return 'gp2';
    }
  }

  private getReplicationFactor(component: Component): number {
    const config = component.configuration as any;
    return config.replicationFactor || config.replication || 1;
  }

  private mapToStorageType(storageType: string): 'ssd' | 'hdd' | 'nvme' | 'object' | 'archive' {
    if (storageType.includes('ssd') || storageType.includes('gp')) return 'ssd';
    if (storageType.includes('hdd')) return 'hdd';
    if (storageType.includes('nvme') || storageType.includes('io')) return 'nvme';
    if (storageType.includes('s3') || storageType.includes('blob') || storageType.includes('cloud')) return 'object';
    if (storageType.includes('glacier') || storageType.includes('archive')) return 'archive';
    return 'ssd';
  }

  /**
   * Calculate total cost for components (public method)
   */
  public calculateTotalCost(
    components: Component[],
    userCount: number,
    dataVolumeGB: number,
    provider: 'aws' | 'gcp' | 'azure'
  ): CostBreakdown {
    let totalCompute = 0;
    let totalStorage = 0;
    let totalNetwork = 0;

    components.forEach(component => {
      // Compute costs
      const computeCost = this.calculateComputeCost(component, userCount, provider);
      totalCompute += computeCost.hourlyRate;

      // Storage costs (monthly, convert to hourly)
      const storageCost = this.calculateStorageCost(component, dataVolumeGB / components.length, provider);
      totalStorage += (storageCost.pricePerGB * dataVolumeGB * storageCost.replicationFactor) / (30 * 24);
    });

    // Network costs (simplified)
    const connections = components.map((comp, i) => ({
      sourceComponent: comp,
      targetComponent: components[(i + 1) % components.length],
      dataVolumeGB: dataVolumeGB / components.length
    }));
    
    const networkCost = this.calculateNetworkCost(connections, provider);
    totalNetwork = networkCost.dataTransferOut + networkCost.dataTransferIntraRegion + (networkCost.cdnCost || 0);

    return {
      compute: totalCompute,
      storage: totalStorage,
      network: totalNetwork,
      total: totalCompute + totalStorage + totalNetwork,
      currency: 'USD',
      period: 'hour'
    };
  }

  /**
   * Estimate performance metrics (public method)
   */
  public estimatePerformanceMetrics(components: Component[], userCount: number) {
    // Simplified performance estimation based on component configurations
    const avgLatency = components.reduce((sum, comp) => sum + comp.configuration.latency, 0) / components.length;
    const totalCapacity = components.reduce((sum, comp) => sum + comp.configuration.capacity, 0);
    
    return {
      latency: avgLatency,
      throughput: Math.min(totalCapacity, userCount * 10), // requests per second
      availability: 99.9 - (components.length * 0.1), // simplified availability calculation
      reliability: 100 - (components.reduce((sum, comp) => sum + comp.configuration.failureRate, 0) * 100)
    };
  }

  /**
   * Optimize components for scenario (public method)
   */
  public optimizeComponentsForScenario(
    components: Component[],
    scenario: string,
    userCount: number
  ): Component[] {
    // Create optimized versions of components based on scenario
    return components.map(component => {
      const optimizedComponent = { ...component };
      
      switch (scenario) {
        case 'cost-optimized':
          // Reduce capacity and increase latency for cost savings
          optimizedComponent.configuration = {
            ...component.configuration,
            capacity: Math.max(component.configuration.capacity * 0.7, userCount),
            latency: component.configuration.latency * 1.2
          };
          break;
        case 'performance-optimized':
          // Increase capacity and reduce latency
          optimizedComponent.configuration = {
            ...component.configuration,
            capacity: component.configuration.capacity * 1.5,
            latency: component.configuration.latency * 0.8
          };
          break;
        default: // balanced
          // Keep original configuration
          break;
      }
      
      return optimizedComponent;
    });
  }

  private generateTrafficScalingRecommendations(
    peakCost: CostBreakdown,
    averageCost: CostBreakdown,
    trafficScaling: TrafficCostScaling
  ): string[] {
    const recommendations: string[] = [];
    const costVariability = ((peakCost.total - averageCost.total) / averageCost.total) * 100;

    if (costVariability > 50) {
      recommendations.push('Consider implementing auto-scaling to reduce costs during low-traffic periods');
      recommendations.push('Use spot instances or preemptible VMs for non-critical workloads');
    }

    if (trafficScaling.peakMultiplier > 3) {
      recommendations.push('Implement caching strategies to reduce backend load during peak traffic');
      recommendations.push('Consider using a CDN to reduce origin server costs');
    }

    if (peakCost.network > peakCost.compute) {
      recommendations.push('Optimize data transfer patterns to reduce network costs');
      recommendations.push('Consider regional deployment to minimize inter-region data transfer');
    }

    return recommendations;
  }

  private generateCostOptimizationRecommendations(
    components: Component[],
    costMetrics: CostBreakdown,
    performanceMetrics: any
  ): CostOptimizationRecommendation[] {
    const recommendations: CostOptimizationRecommendation[] = [];

    // Compute optimization recommendations
    if (costMetrics.compute > costMetrics.total * 0.6) {
      recommendations.push({
        id: 'right-size-instances',
        category: 'compute',
        title: 'Right-size compute instances',
        description: 'Analyze CPU and memory utilization to select optimal instance types',
        potentialSavings: costMetrics.compute * 0.2,
        savingsPercentage: 20,
        implementationComplexity: 'low',
        riskLevel: 'low',
        timeToImplement: '1-2 hours',
        prerequisites: ['Performance monitoring', 'Load testing']
      });
    }

    // Storage optimization recommendations
    if (costMetrics.storage > costMetrics.total * 0.3) {
      recommendations.push({
        id: 'optimize-storage-tiers',
        category: 'storage',
        title: 'Implement storage tiering',
        description: 'Move infrequently accessed data to cheaper storage tiers',
        potentialSavings: costMetrics.storage * 0.3,
        savingsPercentage: 30,
        implementationComplexity: 'medium',
        riskLevel: 'low',
        timeToImplement: '1-2 days',
        prerequisites: ['Data access pattern analysis', 'Backup strategy']
      });
    }

    // Network optimization recommendations
    if (costMetrics.network > costMetrics.total * 0.2) {
      recommendations.push({
        id: 'implement-caching',
        category: 'network',
        title: 'Implement comprehensive caching',
        description: 'Add caching layers to reduce data transfer and improve performance',
        potentialSavings: costMetrics.network * 0.4,
        savingsPercentage: 40,
        implementationComplexity: 'medium',
        riskLevel: 'medium',
        timeToImplement: '3-5 days',
        prerequisites: ['Cache invalidation strategy', 'Monitoring setup']
      });
    }

    return recommendations;
  }

  /**
   * Get real-time cost estimation for a workspace
   */
  public getRealTimeCostEstimate(
    components: Component[],
    userCount: number,
    provider: 'aws' | 'gcp' | 'azure' = 'aws'
  ): {
    hourly: CostBreakdown;
    daily: CostBreakdown;
    monthly: CostBreakdown;
    projections: { userCount: number; cost: number }[];
  } {
    const dataVolumeGB = userCount * 0.01; // 10MB per user
    const hourlyCost = this.calculateTotalCost(components, userCount, dataVolumeGB, provider);
    
    const dailyCost: CostBreakdown = {
      compute: hourlyCost.compute * 24,
      storage: hourlyCost.storage * 24,
      network: hourlyCost.network * 24,
      total: hourlyCost.total * 24,
      currency: 'USD',
      period: 'day'
    };

    const monthlyCost: CostBreakdown = {
      compute: hourlyCost.compute * 24 * 30,
      storage: hourlyCost.storage * 24 * 30,
      network: hourlyCost.network * 24 * 30,
      total: hourlyCost.total * 24 * 30,
      currency: 'USD',
      period: 'month'
    };

    // Cost projections for different user counts
    const projections = [100, 1000, 10000, 100000, 1000000].map(users => ({
      userCount: users,
      cost: this.calculateTotalCost(components, users, users * 0.01, provider).total * 24 * 30
    }));

    return {
      hourly: hourlyCost,
      daily: dailyCost,
      monthly: monthlyCost,
      projections
    };
  }
}

// Export singleton instance
export const costModelingService = CostModelingService.getInstance();

/**
 * Enhanced Storage Cost Modeling - SRS FR-8.2 Implementation
 * Additional storage-specific cost analysis and lifecycle management
 */

export interface StorageLifecyclePolicy {
  name: string;
  rules: StorageLifecycleRule[];
  estimatedSavings: number; // percentage
}

export interface StorageLifecycleRule {
  id: string;
  condition: {
    age: number; // days
    accessFrequency: 'frequent' | 'infrequent' | 'archive';
    size?: number; // GB threshold
  };
  action: {
    transition: 'standard' | 'infrequent' | 'archive' | 'delete';
    storageClass: string;
  };
}

export interface StorageTierAnalysis {
  currentTier: string;
  recommendedTier: string;
  currentCost: number;
  projectedCost: number;
  savings: number;
  accessPattern: {
    readFrequency: number; // requests per day
    writeFrequency: number; // requests per day
    dataRetention: number; // days
  };
  migrationComplexity: 'low' | 'medium' | 'high';
}

export interface DataVolumeProjection {
  timeframe: 'month' | 'quarter' | 'year';
  currentVolume: number; // GB
  projectedVolume: number; // GB
  growthRate: number; // percentage
  costImpact: {
    current: number;
    projected: number;
    increase: number;
  };
}

export class StorageCostAnalyzer {
  private costModelingService: CostModelingService;

  constructor(costModelingService: CostModelingService) {
    this.costModelingService = costModelingService;
  }

  /**
   * Analyze storage tiers and recommend optimal storage classes
   */
  public analyzeStorageTiers(
    component: Component,
    dataVolumeGB: number,
    accessPattern: {
      readFrequency: number;
      writeFrequency: number;
      dataRetention: number;
    },
    provider: 'aws' | 'gcp' | 'azure' = 'aws'
  ): StorageTierAnalysis {
    const currentStorageType = this.getCurrentStorageType(component);
    const recommendedStorageType = this.recommendOptimalStorageType(
      dataVolumeGB,
      accessPattern,
      provider
    );

    const currentCost = this.calculateStorageTierCost(currentStorageType, dataVolumeGB, accessPattern, provider);
    const projectedCost = this.calculateStorageTierCost(recommendedStorageType, dataVolumeGB, accessPattern, provider);

    return {
      currentTier: currentStorageType,
      recommendedTier: recommendedStorageType,
      currentCost,
      projectedCost,
      savings: currentCost - projectedCost,
      accessPattern,
      migrationComplexity: this.assessMigrationComplexity(currentStorageType, recommendedStorageType)
    };
  }

  /**
   * Generate storage lifecycle policies for cost optimization
   */
  public generateLifecyclePolicies(
    component: Component,
    dataVolumeGB: number,
    retentionRequirements: {
      hotData: number; // days
      warmData: number; // days
      coldData: number; // days
      archiveData: number; // days
    },
    provider: 'aws' | 'gcp' | 'azure' = 'aws'
  ): StorageLifecyclePolicy[] {
    const policies: StorageLifecyclePolicy[] = [];

    // Aggressive cost optimization policy
    policies.push({
      name: 'Aggressive Cost Optimization',
      rules: [
        {
          id: 'transition-to-ia',
          condition: { age: 30, accessFrequency: 'infrequent' },
          action: { transition: 'infrequent', storageClass: this.getInfrequentAccessClass(provider) }
        },
        {
          id: 'transition-to-archive',
          condition: { age: 90, accessFrequency: 'archive' },
          action: { transition: 'archive', storageClass: this.getArchiveClass(provider) }
        },
        {
          id: 'delete-old-data',
          condition: { age: retentionRequirements.archiveData, accessFrequency: 'archive' },
          action: { transition: 'delete', storageClass: 'deleted' }
        }
      ],
      estimatedSavings: 60
    });

    // Balanced policy
    policies.push({
      name: 'Balanced Performance and Cost',
      rules: [
        {
          id: 'transition-to-ia-balanced',
          condition: { age: 60, accessFrequency: 'infrequent' },
          action: { transition: 'infrequent', storageClass: this.getInfrequentAccessClass(provider) }
        },
        {
          id: 'transition-to-archive-balanced',
          condition: { age: 180, accessFrequency: 'archive' },
          action: { transition: 'archive', storageClass: this.getArchiveClass(provider) }
        }
      ],
      estimatedSavings: 35
    });

    // Performance-first policy
    policies.push({
      name: 'Performance First',
      rules: [
        {
          id: 'keep-hot-longer',
          condition: { age: 180, accessFrequency: 'infrequent' },
          action: { transition: 'infrequent', storageClass: this.getInfrequentAccessClass(provider) }
        }
      ],
      estimatedSavings: 15
    });

    return policies;
  }

  /**
   * Project data volume growth and cost impact
   */
  public projectDataVolumeGrowth(
    currentVolumeGB: number,
    historicalGrowthRate: number,
    timeframes: ('month' | 'quarter' | 'year')[],
    component: Component,
    provider: 'aws' | 'gcp' | 'azure' = 'aws'
  ): DataVolumeProjection[] {
    return timeframes.map(timeframe => {
      const months = timeframe === 'month' ? 1 : timeframe === 'quarter' ? 3 : 12;
      const projectedVolume = currentVolumeGB * Math.pow(1 + historicalGrowthRate / 100, months);
      
      const currentStorageCost = this.costModelingService.calculateStorageCost(component, currentVolumeGB, provider);
      const projectedStorageCost = this.costModelingService.calculateStorageCost(component, projectedVolume, provider);
      
      const currentMonthlyCost = currentStorageCost.pricePerGB * currentVolumeGB * currentStorageCost.replicationFactor;
      const projectedMonthlyCost = projectedStorageCost.pricePerGB * projectedVolume * projectedStorageCost.replicationFactor;

      return {
        timeframe,
        currentVolume: currentVolumeGB,
        projectedVolume,
        growthRate: ((projectedVolume - currentVolumeGB) / currentVolumeGB) * 100,
        costImpact: {
          current: currentMonthlyCost,
          projected: projectedMonthlyCost,
          increase: projectedMonthlyCost - currentMonthlyCost
        }
      };
    });
  }

  /**
   * Calculate replication costs across multiple regions
   */
  public calculateReplicationCosts(
    component: Component,
    dataVolumeGB: number,
    replicationStrategy: {
      regions: string[];
      replicationType: 'sync' | 'async';
      consistencyLevel: 'strong' | 'eventual';
    },
    provider: 'aws' | 'gcp' | 'azure' = 'aws'
  ): {
    storageCost: number;
    transferCost: number;
    totalCost: number;
    breakdown: Array<{ region: string; cost: number }>;
  } {
    const baseStorageCost = this.costModelingService.calculateStorageCost(component, dataVolumeGB, provider);
    const networkCost = this.costModelingService.calculateNetworkCost([], provider, replicationStrategy.regions);
    
    // Calculate storage cost for each region
    const regionCosts = replicationStrategy.regions.map(region => ({
      region,
      cost: baseStorageCost.pricePerGB * dataVolumeGB
    }));

    const totalStorageCost = regionCosts.reduce((sum, region) => sum + region.cost, 0);
    
    // Calculate inter-region transfer costs for replication
    const transferCost = replicationStrategy.replicationType === 'sync' 
      ? networkCost.dataTransferInterRegion * replicationStrategy.regions.length * 2 // bidirectional
      : networkCost.dataTransferInterRegion * replicationStrategy.regions.length; // unidirectional

    return {
      storageCost: totalStorageCost,
      transferCost,
      totalCost: totalStorageCost + transferCost,
      breakdown: regionCosts
    };
  }

  // Helper methods for storage cost analysis

  private getCurrentStorageType(component: Component): string {
    const config = component.configuration as any;
    return config.storageType || 'gp2';
  }

  private recommendOptimalStorageType(
    dataVolumeGB: number,
    accessPattern: { readFrequency: number; writeFrequency: number; dataRetention: number },
    provider: 'aws' | 'gcp' | 'azure'
  ): string {
    const totalAccess = accessPattern.readFrequency + accessPattern.writeFrequency;
    
    if (totalAccess > 1000) { // High access frequency
      return provider === 'aws' ? 'io2' : provider === 'gcp' ? 'pd-extreme' : 'premium-ssd';
    } else if (totalAccess > 100) { // Medium access frequency
      return provider === 'aws' ? 'gp3' : provider === 'gcp' ? 'pd-ssd' : 'standard-ssd';
    } else if (totalAccess > 10) { // Low access frequency
      return provider === 'aws' ? 'gp2' : provider === 'gcp' ? 'pd-standard' : 'standard-hdd';
    } else { // Very low access frequency
      return provider === 'aws' ? 's3-ia' : provider === 'gcp' ? 'cloud-storage' : 'blob-storage';
    }
  }

  private calculateStorageTierCost(
    storageType: string,
    dataVolumeGB: number,
    accessPattern: { readFrequency: number; writeFrequency: number; dataRetention: number },
    provider: 'aws' | 'gcp' | 'azure'
  ): number {
    const pricing = (CLOUD_PRICING[provider].storage as any)[storageType];
    if (!pricing) return 0;

    const storageCost = pricing.pricePerGB * dataVolumeGB;
    const iopsCost = (pricing.iopsRate || 0) * (accessPattern.readFrequency + accessPattern.writeFrequency);
    const throughputCost = (pricing.throughputRate || 0) * dataVolumeGB * 0.1; // Assume 10% throughput utilization

    return storageCost + iopsCost + throughputCost;
  }

  private assessMigrationComplexity(currentType: string, recommendedType: string): 'low' | 'medium' | 'high' {
    // Same storage class family
    if (currentType.includes('gp') && recommendedType.includes('gp')) return 'low';
    if (currentType.includes('s3') && recommendedType.includes('s3')) return 'low';
    
    // Different storage classes but same provider
    if ((currentType.includes('gp') || currentType.includes('io')) && 
        (recommendedType.includes('s3') || recommendedType.includes('glacier'))) return 'high';
    
    return 'medium';
  }

  private getInfrequentAccessClass(provider: 'aws' | 'gcp' | 'azure'): string {
    switch (provider) {
      case 'aws': return 's3-ia';
      case 'gcp': return 'cloud-storage-nearline';
      case 'azure': return 'blob-storage-cool';
      default: return 's3-ia';
    }
  }

  private getArchiveClass(provider: 'aws' | 'gcp' | 'azure'): string {
    switch (provider) {
      case 'aws': return 's3-glacier';
      case 'gcp': return 'cloud-storage-archive';
      case 'azure': return 'blob-storage-archive';
      default: return 's3-glacier';
    }
  }
}

// Add storage analyzer to the main service
export const storageCostAnalyzer = new StorageCostAnalyzer(costModelingService);
/**
 * Enhanced Network Cost Modeling - SRS FR-8.3 Implementation
 * Advanced network cost analysis with geographic distribution and CDN optimization
 */

export interface GeographicCostModel {
  region: string;
  dataTransferCosts: {
    inbound: number;
    outbound: number;
    interRegion: number;
    internetEgress: number;
  };
  latencyPenalty: number; // additional cost due to latency
  complianceCosts?: number; // data sovereignty costs
}

export interface CDNCostAnalysis {
  provider: 'cloudflare' | 'aws-cloudfront' | 'fastly' | 'azure-cdn';
  regions: string[];
  costBreakdown: {
    dataTransfer: number;
    requests: number;
    storage: number;
    features: number; // SSL, DDoS protection, etc.
  };
  performanceImpact: {
    latencyReduction: number; // ms
    cacheHitRatio: number; // percentage
    bandwidthSavings: number; // percentage
  };
  roi: {
    monthlySavings: number;
    paybackPeriod: number; // months
  };
}

export interface BandwidthOptimization {
  technique: string;
  description: string;
  potentialSavings: number; // percentage
  implementationCost: number;
  complexity: 'low' | 'medium' | 'high';
  prerequisites: string[];
}

export interface NetworkTopologyAnalysis {
  currentTopology: 'hub-spoke' | 'mesh' | 'hybrid';
  recommendedTopology: 'hub-spoke' | 'mesh' | 'hybrid';
  costComparison: {
    current: number;
    recommended: number;
    savings: number;
  };
  performanceImpact: {
    latencyChange: number;
    throughputChange: number;
    reliabilityChange: number;
  };
}

export class NetworkCostAnalyzer {
  private costModelingService: CostModelingService;

  constructor(costModelingService: CostModelingService) {
    this.costModelingService = costModelingService;
  }

  /**
   * Analyze geographic distribution costs and optimize regional deployment
   */
  public analyzeGeographicCosts(
    components: Component[],
    userDistribution: { region: string; userPercentage: number; dataVolumeGB: number }[],
    provider: 'aws' | 'gcp' | 'azure' = 'aws'
  ): {
    regionalCosts: GeographicCostModel[];
    totalCost: number;
    recommendations: string[];
  } {
    const regionalCosts: GeographicCostModel[] = [];
    let totalCost = 0;

    userDistribution.forEach(({ region, userPercentage, dataVolumeGB }) => {
      const regionMultiplier = this.getRegionCostMultiplier(region, provider);
      const baseNetworkCost = this.costModelingService.calculateNetworkCost(
        components.map((comp, i) => ({
          sourceComponent: comp,
          targetComponent: components[(i + 1) % components.length],
          dataVolumeGB: dataVolumeGB * (userPercentage / 100)
        })),
        provider,
        [region]
      );

      const regionalCost: GeographicCostModel = {
        region,
        dataTransferCosts: {
          inbound: 0, // Usually free
          outbound: baseNetworkCost.dataTransferOut * regionMultiplier,
          interRegion: baseNetworkCost.dataTransferInterRegion * regionMultiplier,
          internetEgress: baseNetworkCost.dataTransferOut * regionMultiplier * 1.2
        },
        latencyPenalty: this.calculateLatencyPenalty(region, userPercentage),
        complianceCosts: this.calculateComplianceCosts(region, dataVolumeGB)
      };

      regionalCosts.push(regionalCost);
      totalCost += Object.values(regionalCost.dataTransferCosts).reduce((sum, cost) => sum + cost, 0);
      totalCost += regionalCost.latencyPenalty + (regionalCost.complianceCosts || 0);
    });

    const recommendations = this.generateGeographicRecommendations(regionalCosts, userDistribution);

    return { regionalCosts, totalCost, recommendations };
  }

  /**
   * Analyze CDN cost-effectiveness and ROI
   */
  public analyzeCDNEffectiveness(
    components: Component[],
    trafficPattern: {
      totalRequests: number;
      dataVolumeGB: number;
      cacheablePercentage: number;
      globalDistribution: boolean;
    },
    provider: 'aws' | 'gcp' | 'azure' = 'aws'
  ): CDNCostAnalysis[] {
    const cdnProviders: ('cloudflare' | 'aws-cloudfront' | 'fastly' | 'azure-cdn')[] = 
      ['cloudflare', 'aws-cloudfront', 'fastly', 'azure-cdn'];

    return cdnProviders.map(cdnProvider => {
      const costBreakdown = this.calculateCDNCosts(cdnProvider, trafficPattern);
      const performanceImpact = this.estimateCDNPerformanceImpact(cdnProvider, trafficPattern);
      const roi = this.calculateCDNROI(costBreakdown, performanceImpact, trafficPattern);

      return {
        provider: cdnProvider,
        regions: this.getCDNRegions(cdnProvider),
        costBreakdown,
        performanceImpact,
        roi
      };
    });
  }

  /**
   * Generate bandwidth optimization recommendations
   */
  public generateBandwidthOptimizations(
    components: Component[],
    currentBandwidthCost: number,
    trafficPattern: { dataTypes: string[]; compressionRatio: number }
  ): BandwidthOptimization[] {
    const optimizations: BandwidthOptimization[] = [];

    // Compression optimization
    if (trafficPattern.compressionRatio < 0.7) {
      optimizations.push({
        technique: 'Advanced Compression',
        description: 'Implement gzip/brotli compression for text-based content',
        potentialSavings: 30,
        implementationCost: 500,
        complexity: 'low',
        prerequisites: ['Load balancer configuration', 'Content-Type analysis']
      });
    }

    // Image optimization
    if (trafficPattern.dataTypes.includes('images')) {
      optimizations.push({
        technique: 'Image Optimization',
        description: 'Implement WebP/AVIF formats and responsive images',
        potentialSavings: 40,
        implementationCost: 2000,
        complexity: 'medium',
        prerequisites: ['Image processing pipeline', 'Browser compatibility testing']
      });
    }

    // API response optimization
    if (trafficPattern.dataTypes.includes('api')) {
      optimizations.push({
        technique: 'API Response Optimization',
        description: 'Implement GraphQL, field selection, and response pagination',
        potentialSavings: 25,
        implementationCost: 5000,
        complexity: 'high',
        prerequisites: ['API redesign', 'Client application updates']
      });
    }

    // Caching strategy
    optimizations.push({
      technique: 'Intelligent Caching',
      description: 'Implement multi-layer caching with smart invalidation',
      potentialSavings: 50,
      implementationCost: 3000,
      complexity: 'medium',
      prerequisites: ['Cache invalidation strategy', 'Monitoring setup']
    });

    return optimizations;
  }

  /**
   * Analyze network topology and recommend optimizations
   */
  public analyzeNetworkTopology(
    components: Component[],
    connections: Array<{ source: string; target: string; dataVolumeGB: number }>,
    currentCost: number
  ): NetworkTopologyAnalysis {
    const currentTopology = this.identifyCurrentTopology(connections);
    const recommendedTopology = this.recommendOptimalTopology(components, connections);
    
    const currentTopologyCost = currentCost;
    const recommendedTopologyCost = this.calculateTopologyCost(recommendedTopology, connections);
    
    return {
      currentTopology,
      recommendedTopology,
      costComparison: {
        current: currentTopologyCost,
        recommended: recommendedTopologyCost,
        savings: currentTopologyCost - recommendedTopologyCost
      },
      performanceImpact: {
        latencyChange: this.estimateLatencyChange(currentTopology, recommendedTopology),
        throughputChange: this.estimateThroughputChange(currentTopology, recommendedTopology),
        reliabilityChange: this.estimateReliabilityChange(currentTopology, recommendedTopology)
      }
    };
  }

  /**
   * Calculate edge computing costs and benefits
   */
  public analyzeEdgeComputingCosts(
    components: Component[],
    userDistribution: { region: string; userCount: number }[],
    workloadCharacteristics: {
      computeIntensive: boolean;
      latencySensitive: boolean;
      dataLocality: boolean;
    }
  ): {
    edgeCost: number;
    centralizedCost: number;
    savings: number;
    performanceBenefits: string[];
    recommendations: string[];
  } {
    const edgeLocations = userDistribution.length;
    const totalUsers = userDistribution.reduce((sum, dist) => sum + dist.userCount, 0);
    
    // Calculate edge computing costs (simplified)
    const edgeCost = edgeLocations * 100 + (totalUsers * 0.01); // Base cost per edge + per user
    
    // Calculate centralized costs with network penalties
    const centralizedCost = totalUsers * 0.005; // Lower base cost
    const networkPenalty = userDistribution.reduce((penalty, dist) => {
      const distance = this.calculateDistanceFromCenter(dist.region);
      return penalty + (dist.userCount * distance * 0.001);
    }, 0);
    
    const totalCentralizedCost = centralizedCost + networkPenalty;
    
    const performanceBenefits: string[] = [];
    if (workloadCharacteristics.latencySensitive) {
      performanceBenefits.push('Reduced latency by 50-80%');
    }
    if (workloadCharacteristics.dataLocality) {
      performanceBenefits.push('Improved data locality and compliance');
    }
    if (workloadCharacteristics.computeIntensive) {
      performanceBenefits.push('Distributed compute load');
    }

    const recommendations: string[] = [];
    if (edgeCost < totalCentralizedCost) {
      recommendations.push('Edge computing is cost-effective for this workload');
    }
    if (workloadCharacteristics.latencySensitive && edgeCost < totalCentralizedCost * 1.5) {
      recommendations.push('Edge computing recommended for latency-sensitive workloads');
    }

    return {
      edgeCost,
      centralizedCost: totalCentralizedCost,
      savings: totalCentralizedCost - edgeCost,
      performanceBenefits,
      recommendations
    };
  }

  // Helper methods for network cost analysis

  private getRegionCostMultiplier(region: string, provider: 'aws' | 'gcp' | 'azure'): number {
    // Simplified regional cost multipliers
    const multipliers: Record<string, number> = {
      'us-east-1': 1.0,
      'us-west-2': 1.05,
      'eu-west-1': 1.1,
      'ap-southeast-1': 1.15,
      'ap-northeast-1': 1.2,
      'sa-east-1': 1.25,
      'af-south-1': 1.3
    };
    return multipliers[region] || 1.1;
  }

  private calculateLatencyPenalty(region: string, userPercentage: number): number {
    // Calculate additional costs due to latency (simplified)
    const baseLatency = this.getRegionBaseLatency(region);
    return (baseLatency / 100) * userPercentage * 10; // Penalty based on latency and user percentage
  }

  private calculateComplianceCosts(region: string, dataVolumeGB: number): number {
    // Data sovereignty and compliance costs (simplified)
    const complianceRegions = ['eu-west-1', 'eu-central-1', 'ca-central-1'];
    return complianceRegions.includes(region) ? dataVolumeGB * 0.01 : 0;
  }

  private getRegionBaseLatency(region: string): number {
    const latencies: Record<string, number> = {
      'us-east-1': 50,
      'us-west-2': 80,
      'eu-west-1': 120,
      'ap-southeast-1': 200,
      'ap-northeast-1': 180,
      'sa-east-1': 250,
      'af-south-1': 300
    };
    return latencies[region] || 150;
  }

  private generateGeographicRecommendations(
    regionalCosts: GeographicCostModel[],
    userDistribution: { region: string; userPercentage: number }[]
  ): string[] {
    const recommendations: string[] = [];
    
    const highCostRegions = regionalCosts.filter(cost => 
      Object.values(cost.dataTransferCosts).reduce((sum, c) => sum + c, 0) > 1000
    );
    
    if (highCostRegions.length > 0) {
      recommendations.push('Consider implementing regional caching for high-cost regions');
    }
    
    const highLatencyRegions = regionalCosts.filter(cost => cost.latencyPenalty > 100);
    if (highLatencyRegions.length > 0) {
      recommendations.push('Deploy edge servers in high-latency regions');
    }
    
    return recommendations;
  }

  private calculateCDNCosts(
    provider: 'cloudflare' | 'aws-cloudfront' | 'fastly' | 'azure-cdn',
    trafficPattern: any
  ) {
    // Simplified CDN cost calculation
    const baseCosts = {
      cloudflare: { dataTransfer: 0.08, requests: 0.0001, storage: 0.02, features: 20 },
      'aws-cloudfront': { dataTransfer: 0.085, requests: 0.0001, storage: 0.023, features: 0 },
      fastly: { dataTransfer: 0.12, requests: 0.0002, storage: 0.03, features: 50 },
      'azure-cdn': { dataTransfer: 0.081, requests: 0.0001, storage: 0.018, features: 0 }
    };

    const costs = baseCosts[provider];
    return {
      dataTransfer: trafficPattern.dataVolumeGB * costs.dataTransfer,
      requests: trafficPattern.totalRequests * costs.requests,
      storage: trafficPattern.dataVolumeGB * 0.1 * costs.storage, // 10% cached
      features: costs.features
    };
  }

  private estimateCDNPerformanceImpact(provider: string, trafficPattern: any) {
    return {
      latencyReduction: 150, // ms
      cacheHitRatio: 85, // percentage
      bandwidthSavings: 60 // percentage
    };
  }

  private calculateCDNROI(costBreakdown: any, performanceImpact: any, trafficPattern: any) {
    const totalCDNCost = Object.values(costBreakdown).reduce((sum: number, cost) => sum + (cost as number), 0);
    const bandwidthSavings = trafficPattern.dataVolumeGB * 0.09 * (performanceImpact.bandwidthSavings / 100);
    
    return {
      monthlySavings: (bandwidthSavings as number) - (totalCDNCost as number),
      paybackPeriod: (totalCDNCost as number) / Math.max((bandwidthSavings as number), 1)
    };
  }

  private getCDNRegions(provider: string): string[] {
    const regions = {
      cloudflare: ['Global - 200+ locations'],
      'aws-cloudfront': ['Global - 400+ locations'],
      fastly: ['Global - 100+ locations'],
      'azure-cdn': ['Global - 130+ locations']
    };
    return regions[provider as keyof typeof regions] || ['Global'];
  }

  private identifyCurrentTopology(connections: Array<{ source: string; target: string }>): 'hub-spoke' | 'mesh' | 'hybrid' {
    // Simplified topology identification
    const nodeConnections = new Map<string, number>();
    connections.forEach(conn => {
      nodeConnections.set(conn.source, (nodeConnections.get(conn.source) || 0) + 1);
      nodeConnections.set(conn.target, (nodeConnections.get(conn.target) || 0) + 1);
    });

    const maxConnections = Math.max(...Array.from(nodeConnections.values()));
    const avgConnections = Array.from(nodeConnections.values()).reduce((sum, count) => sum + count, 0) / nodeConnections.size;

    if (maxConnections > avgConnections * 2) return 'hub-spoke';
    if (avgConnections > nodeConnections.size * 0.7) return 'mesh';
    return 'hybrid';
  }

  private recommendOptimalTopology(components: Component[], connections: any[]): 'hub-spoke' | 'mesh' | 'hybrid' {
    // Simplified recommendation logic
    if (components.length < 5) return 'hub-spoke';
    if (components.length > 15) return 'hybrid';
    return 'mesh';
  }

  private calculateTopologyCost(topology: string, connections: any[]): number {
    // Simplified topology cost calculation
    const multipliers = { 'hub-spoke': 1.0, 'mesh': 1.3, 'hybrid': 1.15 };
    const baseCost = connections.length * 100;
    return baseCost * (multipliers[topology as keyof typeof multipliers] || 1.0);
  }

  private estimateLatencyChange(current: string, recommended: string): number {
    // Simplified latency change estimation (percentage)
    if (current === 'hub-spoke' && recommended === 'mesh') return -20;
    if (current === 'mesh' && recommended === 'hub-spoke') return 15;
    return 0;
  }

  private estimateThroughputChange(current: string, recommended: string): number {
    // Simplified throughput change estimation (percentage)
    if (current === 'hub-spoke' && recommended === 'mesh') return 25;
    if (current === 'mesh' && recommended === 'hub-spoke') return -10;
    return 0;
  }

  private estimateReliabilityChange(current: string, recommended: string): number {
    // Simplified reliability change estimation (percentage)
    if (current === 'hub-spoke' && recommended === 'mesh') return 30;
    if (current === 'mesh' && recommended === 'hub-spoke') return -15;
    return 0;
  }

  private calculateDistanceFromCenter(region: string): number {
    // Simplified distance calculation (arbitrary units)
    const distances: Record<string, number> = {
      'us-east-1': 1,
      'us-west-2': 2,
      'eu-west-1': 3,
      'ap-southeast-1': 5,
      'ap-northeast-1': 4,
      'sa-east-1': 6,
      'af-south-1': 7
    };
    return distances[region] || 3;
  }
}

// Add network analyzer to the main service
export const networkCostAnalyzer = new NetworkCostAnalyzer(costModelingService);
/**
 * Enhanced Traffic-Based Cost Scaling - SRS FR-8.4 Implementation
 * Advanced traffic pattern analysis and cost scaling with predictive modeling
 */

export interface TrafficPatternAnalysis {
  patternType: 'steady' | 'bursty' | 'seasonal' | 'event-driven' | 'geographic';
  characteristics: {
    baselineRPS: number;
    peakRPS: number;
    averageRPS: number;
    burstDuration: number; // minutes
    burstFrequency: number; // per day
    seasonalMultiplier: number;
  };
  costImplications: {
    baselineCost: number;
    peakCost: number;
    averageCost: number;
    costVariability: number; // percentage
  };
  scalingRecommendations: TrafficScalingRecommendation[];
}

export interface TrafficScalingRecommendation {
  strategy: 'auto-scaling' | 'pre-scaling' | 'over-provisioning' | 'load-shedding';
  description: string;
  costImpact: {
    implementation: number;
    ongoing: number;
    savings: number;
  };
  performanceImpact: {
    latencyChange: number;
    availabilityChange: number;
    userExperienceScore: number;
  };
  complexity: 'low' | 'medium' | 'high';
  timeToImplement: string;
}

export interface PeakVsAverageCostAnalysis {
  timeframe: 'daily' | 'weekly' | 'monthly' | 'yearly';
  peakPeriods: Array<{
    period: string;
    duration: number; // hours
    multiplier: number;
    cost: number;
  }>;
  averagePeriods: Array<{
    period: string;
    duration: number; // hours
    multiplier: number;
    cost: number;
  }>;
  costOptimizationOpportunities: {
    autoScaling: number; // potential savings
    spotInstances: number;
    reservedCapacity: number;
    loadShifting: number;
  };
  recommendations: string[];
}

export interface UserLoadCostCorrelation {
  userCount: number;
  requestsPerUser: number;
  dataPerUser: number; // MB
  sessionDuration: number; // minutes
  concurrentUsers: number;
  costBreakdown: {
    compute: number;
    storage: number;
    network: number;
    total: number;
  };
  marginalCost: number; // cost per additional user
  economiesOfScale: number; // cost reduction percentage at scale
}

export class TrafficCostScalingAnalyzer {
  private costModelingService: CostModelingService;

  constructor(costModelingService: CostModelingService) {
    this.costModelingService = costModelingService;
  }

  /**
   * Analyze traffic patterns and their cost implications
   */
  public analyzeTrafficPatterns(
    components: Component[],
    historicalTraffic: Array<{
      timestamp: Date;
      requestsPerSecond: number;
      userCount: number;
      dataVolumeGB: number;
    }>,
    provider: 'aws' | 'gcp' | 'azure' = 'aws'
  ): TrafficPatternAnalysis {
    const patternType = this.identifyTrafficPattern(historicalTraffic);
    const characteristics = this.calculateTrafficCharacteristics(historicalTraffic);
    
    // Calculate cost implications for different traffic levels
    const baselineCost = this.costModelingService.calculateTotalCost(
      components,
      characteristics.baselineRPS * 60, // Convert to users (simplified)
      characteristics.baselineRPS * 0.1, // Data volume estimation
      provider
    );

    const peakCost = this.costModelingService.calculateTotalCost(
      components,
      characteristics.peakRPS * 60,
      characteristics.peakRPS * 0.1,
      provider
    );

    const averageCost = this.costModelingService.calculateTotalCost(
      components,
      characteristics.averageRPS * 60,
      characteristics.averageRPS * 0.1,
      provider
    );

    const costImplications = {
      baselineCost: baselineCost.total,
      peakCost: peakCost.total,
      averageCost: averageCost.total,
      costVariability: ((peakCost.total - averageCost.total) / averageCost.total) * 100
    };

    const scalingRecommendations = this.generateTrafficScalingRecommendations(
      patternType,
      characteristics,
      costImplications
    );

    return {
      patternType,
      characteristics,
      costImplications,
      scalingRecommendations
    };
  }

  /**
   * Perform detailed peak vs average cost analysis
   */
  public analyzePeakVsAverageCosts(
    components: Component[],
    trafficData: Array<{
      hour: number;
      dayOfWeek: number;
      requestsPerSecond: number;
      userCount: number;
    }>,
    provider: 'aws' | 'gcp' | 'azure' = 'aws'
  ): PeakVsAverageCostAnalysis {
    // Identify peak and average periods
    const sortedTraffic = [...trafficData].sort((a, b) => b.requestsPerSecond - a.requestsPerSecond);
    const peakThreshold = sortedTraffic[Math.floor(sortedTraffic.length * 0.1)].requestsPerSecond; // Top 10%
    const averageRPS = trafficData.reduce((sum, data) => sum + data.requestsPerSecond, 0) / trafficData.length;

    const peakPeriods = trafficData
      .filter(data => data.requestsPerSecond >= peakThreshold)
      .map(data => ({
        period: `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][data.dayOfWeek]} ${data.hour}:00`,
        duration: 1,
        multiplier: data.requestsPerSecond / averageRPS,
        cost: this.costModelingService.calculateTotalCost(
          components,
          data.userCount,
          data.userCount * 0.01,
          provider
        ).total
      }));

    const averagePeriods = trafficData
      .filter(data => data.requestsPerSecond < peakThreshold)
      .map(data => ({
        period: `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][data.dayOfWeek]} ${data.hour}:00`,
        duration: 1,
        multiplier: data.requestsPerSecond / averageRPS,
        cost: this.costModelingService.calculateTotalCost(
          components,
          data.userCount,
          data.userCount * 0.01,
          provider
        ).total
      }));

    const totalPeakCost = peakPeriods.reduce((sum, period) => sum + period.cost, 0);
    const totalAverageCost = averagePeriods.reduce((sum, period) => sum + period.cost, 0);

    const costOptimizationOpportunities = {
      autoScaling: totalPeakCost * 0.3, // 30% savings with auto-scaling
      spotInstances: totalPeakCost * 0.6, // 60% savings with spot instances
      reservedCapacity: totalAverageCost * 0.2, // 20% savings with reserved instances
      loadShifting: totalPeakCost * 0.15 // 15% savings by shifting non-critical loads
    };

    const recommendations = this.generatePeakAverageRecommendations(
      peakPeriods,
      averagePeriods,
      costOptimizationOpportunities
    );

    return {
      timeframe: 'weekly',
      peakPeriods,
      averagePeriods,
      costOptimizationOpportunities,
      recommendations
    };
  }

  /**
   * Analyze cost correlation with user load scaling
   */
  public analyzeUserLoadCostCorrelation(
    components: Component[],
    userScales: number[], // [100, 1000, 10000, 100000, 1000000]
    userBehavior: {
      requestsPerUser: number;
      dataPerUser: number;
      sessionDuration: number;
      concurrencyRatio: number;
    },
    provider: 'aws' | 'gcp' | 'azure' = 'aws'
  ): UserLoadCostCorrelation[] {
    return userScales.map((userCount, index) => {
      const concurrentUsers = userCount * userBehavior.concurrencyRatio;
      const totalDataVolume = userCount * userBehavior.dataPerUser / 1000; // Convert MB to GB

      const costBreakdown = this.costModelingService.calculateTotalCost(
        components,
        userCount,
        totalDataVolume,
        provider
      );

      // Calculate marginal cost (cost per additional user)
      let marginalCost = 0;
      if (index > 0) {
        const previousUserCount = userScales[index - 1];
        const previousCost = this.costModelingService.calculateTotalCost(
          components,
          previousUserCount,
          previousUserCount * userBehavior.dataPerUser / 1000,
          provider
        ).total;
        marginalCost = (costBreakdown.total - previousCost) / (userCount - previousUserCount);
      }

      // Calculate economies of scale
      const baselineCostPerUser = userScales.length > 0 
        ? this.costModelingService.calculateTotalCost(components, userScales[0], userScales[0] * userBehavior.dataPerUser / 1000, provider).total / userScales[0]
        : 0;
      const currentCostPerUser = costBreakdown.total / userCount;
      const economiesOfScale = ((baselineCostPerUser - currentCostPerUser) / baselineCostPerUser) * 100;

      return {
        userCount,
        requestsPerUser: userBehavior.requestsPerUser,
        dataPerUser: userBehavior.dataPerUser,
        sessionDuration: userBehavior.sessionDuration,
        concurrentUsers,
        costBreakdown,
        marginalCost,
        economiesOfScale: Math.max(0, economiesOfScale)
      };
    });
  }

  /**
   * Generate predictive cost scaling models
   */
  public generatePredictiveCostModel(
    components: Component[],
    historicalData: UserLoadCostCorrelation[],
    projectedGrowth: {
      timeframe: 'month' | 'quarter' | 'year';
      growthRate: number; // percentage per period
      seasonalFactors: number[]; // monthly multipliers
    }
  ): {
    projections: Array<{
      period: string;
      userCount: number;
      projectedCost: number;
      confidence: number;
    }>;
    budgetRecommendations: {
      conservative: number;
      realistic: number;
      optimistic: number;
    };
    scalingMilestones: Array<{
      userCount: number;
      requiredActions: string[];
      costImpact: number;
    }>;
  } {
    const periods = projectedGrowth.timeframe === 'month' ? 12 : 
                   projectedGrowth.timeframe === 'quarter' ? 4 : 1;
    
    const projections = [];
    let currentUsers = historicalData[historicalData.length - 1]?.userCount || 1000;
    
    for (let i = 0; i < periods; i++) {
      const seasonalFactor = projectedGrowth.seasonalFactors[i % projectedGrowth.seasonalFactors.length];
      const projectedUsers = Math.floor(currentUsers * (1 + projectedGrowth.growthRate / 100) * seasonalFactor);
      
      // Interpolate cost based on historical data
      const projectedCost = this.interpolateCost(historicalData, projectedUsers);
      const confidence = this.calculatePredictionConfidence(historicalData, projectedUsers);
      
      projections.push({
        period: `Period ${i + 1}`,
        userCount: projectedUsers,
        projectedCost,
        confidence
      });
      
      currentUsers = projectedUsers;
    }

    const totalProjectedCost = projections.reduce((sum, proj) => sum + proj.projectedCost, 0);
    const budgetRecommendations = {
      conservative: totalProjectedCost * 1.3, // 30% buffer
      realistic: totalProjectedCost * 1.15,   // 15% buffer
      optimistic: totalProjectedCost * 1.05   // 5% buffer
    };

    const scalingMilestones = this.identifyScalingMilestones(projections, components);

    return {
      projections,
      budgetRecommendations,
      scalingMilestones
    };
  }

  // Helper methods for traffic cost scaling analysis

  private identifyTrafficPattern(
    historicalTraffic: Array<{ timestamp: Date; requestsPerSecond: number }>
  ): 'steady' | 'bursty' | 'seasonal' | 'event-driven' | 'geographic' {
    const rpsValues = historicalTraffic.map(data => data.requestsPerSecond);
    const mean = rpsValues.reduce((sum, val) => sum + val, 0) / rpsValues.length;
    const variance = rpsValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / rpsValues.length;
    const coefficientOfVariation = Math.sqrt(variance) / mean;

    if (coefficientOfVariation < 0.2) return 'steady';
    if (coefficientOfVariation > 1.0) return 'bursty';
    
    // Check for seasonal patterns (simplified)
    const hourlyAverages = new Array(24).fill(0);
    const hourlyCounts = new Array(24).fill(0);
    
    historicalTraffic.forEach(data => {
      const hour = data.timestamp.getHours();
      hourlyAverages[hour] += data.requestsPerSecond;
      hourlyCounts[hour]++;
    });
    
    const hourlyMeans = hourlyAverages.map((sum, i) => sum / Math.max(hourlyCounts[i], 1));
    const hourlyVariance = hourlyMeans.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / 24;
    
    if (hourlyVariance > variance * 0.5) return 'seasonal';
    
    return 'event-driven';
  }

  private calculateTrafficCharacteristics(
    historicalTraffic: Array<{ requestsPerSecond: number }>
  ) {
    const rpsValues = historicalTraffic.map(data => data.requestsPerSecond);
    const sortedRPS = [...rpsValues].sort((a, b) => a - b);
    
    return {
      baselineRPS: sortedRPS[Math.floor(sortedRPS.length * 0.1)], // 10th percentile
      peakRPS: sortedRPS[Math.floor(sortedRPS.length * 0.95)], // 95th percentile
      averageRPS: rpsValues.reduce((sum, val) => sum + val, 0) / rpsValues.length,
      burstDuration: 30, // Simplified
      burstFrequency: 5, // Simplified
      seasonalMultiplier: 1.5 // Simplified
    };
  }

  private generateTrafficScalingRecommendations(
    patternType: string,
    characteristics: any,
    costImplications: any
  ): TrafficScalingRecommendation[] {
    const recommendations: TrafficScalingRecommendation[] = [];

    if (patternType === 'bursty' || costImplications.costVariability > 50) {
      recommendations.push({
        strategy: 'auto-scaling',
        description: 'Implement horizontal auto-scaling to handle traffic bursts efficiently',
        costImpact: {
          implementation: 5000,
          ongoing: costImplications.averageCost * 0.1,
          savings: costImplications.costVariability * costImplications.averageCost * 0.01
        },
        performanceImpact: {
          latencyChange: -10,
          availabilityChange: 5,
          userExperienceScore: 85
        },
        complexity: 'medium',
        timeToImplement: '2-4 weeks'
      });
    }

    if (patternType === 'seasonal') {
      recommendations.push({
        strategy: 'pre-scaling',
        description: 'Pre-scale resources based on predictable seasonal patterns',
        costImpact: {
          implementation: 2000,
          ongoing: costImplications.averageCost * 0.05,
          savings: costImplications.peakCost * 0.2
        },
        performanceImpact: {
          latencyChange: -20,
          availabilityChange: 10,
          userExperienceScore: 90
        },
        complexity: 'low',
        timeToImplement: '1-2 weeks'
      });
    }

    return recommendations;
  }

  private generatePeakAverageRecommendations(
    peakPeriods: any[],
    averagePeriods: any[],
    optimizations: any
  ): string[] {
    const recommendations: string[] = [];
    
    if (peakPeriods.length > averagePeriods.length * 0.3) {
      recommendations.push('High peak frequency detected - implement aggressive auto-scaling');
    }
    
    if (optimizations.spotInstances > optimizations.autoScaling) {
      recommendations.push('Consider spot instances for non-critical workloads during peak periods');
    }
    
    if (optimizations.reservedCapacity > 1000) {
      recommendations.push('Purchase reserved capacity for baseline load to reduce costs');
    }
    
    return recommendations;
  }

  private interpolateCost(historicalData: UserLoadCostCorrelation[], targetUsers: number): number {
    if (historicalData.length === 0) return 0;
    
    // Find the two closest data points
    const sorted = [...historicalData].sort((a, b) => a.userCount - b.userCount);
    
    if (targetUsers <= sorted[0].userCount) {
      return sorted[0].costBreakdown.total;
    }
    
    if (targetUsers >= sorted[sorted.length - 1].userCount) {
      // Extrapolate based on the last marginal cost
      const lastPoint = sorted[sorted.length - 1];
      const extraUsers = targetUsers - lastPoint.userCount;
      return lastPoint.costBreakdown.total + (extraUsers * lastPoint.marginalCost);
    }
    
    // Interpolate between two points
    for (let i = 0; i < sorted.length - 1; i++) {
      if (targetUsers >= sorted[i].userCount && targetUsers <= sorted[i + 1].userCount) {
        const ratio = (targetUsers - sorted[i].userCount) / (sorted[i + 1].userCount - sorted[i].userCount);
        return sorted[i].costBreakdown.total + 
               ratio * (sorted[i + 1].costBreakdown.total - sorted[i].costBreakdown.total);
      }
    }
    
    return sorted[sorted.length - 1].costBreakdown.total;
  }

  private calculatePredictionConfidence(historicalData: UserLoadCostCorrelation[], targetUsers: number): number {
    // Simplified confidence calculation based on data coverage
    const minUsers = Math.min(...historicalData.map(d => d.userCount));
    const maxUsers = Math.max(...historicalData.map(d => d.userCount));
    
    if (targetUsers >= minUsers && targetUsers <= maxUsers) {
      return 0.9; // High confidence for interpolation
    } else if (targetUsers > maxUsers && targetUsers <= maxUsers * 2) {
      return 0.7; // Medium confidence for near extrapolation
    } else {
      return 0.4; // Low confidence for far extrapolation
    }
  }

  private identifyScalingMilestones(
    projections: any[],
    components: Component[]
  ): Array<{ userCount: number; requiredActions: string[]; costImpact: number }> {
    const milestones: Array<{ userCount: number; requiredActions: string[]; costImpact: number }> = [];
    
    // Define scaling thresholds
    const thresholds = [10000, 100000, 1000000, 10000000];
    
    thresholds.forEach(threshold => {
      const projection = projections.find(p => p.userCount >= threshold);
      if (projection) {
        const actions = [];
        let costImpact = 0;
        
        if (threshold >= 10000) {
          actions.push('Implement database sharding');
          costImpact += 10000;
        }
        
        if (threshold >= 100000) {
          actions.push('Deploy multi-region architecture');
          costImpact += 50000;
        }
        
        if (threshold >= 1000000) {
          actions.push('Implement microservices architecture');
          costImpact += 100000;
        }
        
        milestones.push({
          userCount: threshold,
          requiredActions: actions,
          costImpact
        });
      }
    });
    
    return milestones;
  }
}

// Add traffic cost scaling analyzer to the main service
export const trafficCostScalingAnalyzer = new TrafficCostScalingAnalyzer(costModelingService);
/**
 * Enhanced Cost vs Performance Tradeoff Analysis - SRS FR-8.5 Implementation
 * Multi-dimensional optimization and advanced tradeoff analysis
 */

export interface PerformanceCostMatrix {
  scenarios: PerformanceCostScenario[];
  paretoFrontier: PerformanceCostPoint[];
  recommendations: {
    costOptimal: PerformanceCostScenario;
    performanceOptimal: PerformanceCostScenario;
    balanced: PerformanceCostScenario;
    userRecommended: PerformanceCostScenario;
  };
  tradeoffAnalysis: TradeoffAnalysis;
}

export interface PerformanceCostScenario {
  id: string;
  name: string;
  description: string;
  components: Component[];
  metrics: {
    performance: PerformanceMetrics;
    cost: CostBreakdown;
    reliability: ReliabilityMetrics;
    scalability: ScalabilityMetrics;
  };
  score: {
    overall: number;
    costEfficiency: number;
    performanceScore: number;
    reliabilityScore: number;
  };
}

export interface PerformanceCostPoint {
  cost: number;
  performance: number;
  scenario: string;
  isOptimal: boolean;
}

export interface TradeoffAnalysis {
  costPerformanceRatio: number;
  diminishingReturns: {
    threshold: number;
    description: string;
  };
  sweetSpot: {
    cost: number;
    performance: number;
    reasoning: string;
  };
  riskAssessment: {
    overEngineering: number; // 0-100
    underProvisioning: number; // 0-100
    recommendations: string[];
  };
}

export interface PerformanceMetrics {
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: number;
  availability: number;
  reliability: number;
  scalability: number;
}

export interface ReliabilityMetrics {
  mtbf: number; // Mean Time Between Failures (hours)
  mttr: number; // Mean Time To Recovery (minutes)
  sla: number; // Service Level Agreement (percentage)
  redundancy: number; // Redundancy factor
}

export interface ScalabilityMetrics {
  horizontalScaling: number; // 0-100 score
  verticalScaling: number; // 0-100 score
  autoScaling: number; // 0-100 score
  elasticity: number; // 0-100 score
}

export interface CostEffectiveScalingStrategy {
  strategy: string;
  description: string;
  applicableScenarios: string[];
  costImpact: {
    initial: number;
    ongoing: number;
    savings: number;
  };
  performanceImpact: {
    latencyImprovement: number;
    throughputIncrease: number;
    availabilityIncrease: number;
  };
  implementationPlan: {
    phases: Array<{
      phase: string;
      duration: string;
      cost: number;
      deliverables: string[];
    }>;
    totalDuration: string;
    totalCost: number;
  };
  riskMitigation: string[];
}

export class CostPerformanceTradeoffAnalyzer {
  private costModelingService: CostModelingService;

  constructor(costModelingService: CostModelingService) {
    this.costModelingService = costModelingService;
  }

  /**
   * Generate comprehensive cost vs performance matrix
   */
  public generatePerformanceCostMatrix(
    baseComponents: Component[],
    userCount: number,
    requirements: {
      maxLatency: number;
      minThroughput: number;
      minAvailability: number;
      budgetConstraint?: number;
    },
    provider: 'aws' | 'gcp' | 'azure' = 'aws'
  ): PerformanceCostMatrix {
    // Generate multiple scenarios with different optimization strategies
    const scenarios = this.generateOptimizationScenarios(baseComponents, userCount, provider);
    
    // Calculate Pareto frontier
    const paretoFrontier = this.calculateParetoFrontier(scenarios);
    
    // Generate recommendations
    const recommendations = this.generateScenarioRecommendations(scenarios, requirements);
    
    // Perform tradeoff analysis
    const tradeoffAnalysis = this.analyzeTradeoffs(scenarios, requirements);

    return {
      scenarios,
      paretoFrontier,
      recommendations,
      tradeoffAnalysis
    };
  }

  /**
   * Generate cost-effective scaling strategies
   */
  public generateCostEffectiveScalingStrategies(
    components: Component[],
    currentUserCount: number,
    projectedUserCount: number,
    performanceRequirements: {
      maxLatency: number;
      minThroughput: number;
      targetAvailability: number;
    },
    budgetConstraints: {
      maxInitialInvestment: number;
      maxMonthlyBudget: number;
    }
  ): CostEffectiveScalingStrategy[] {
    const strategies: CostEffectiveScalingStrategy[] = [];

    // Horizontal scaling strategy
    strategies.push({
      strategy: 'Horizontal Scaling with Auto-scaling',
      description: 'Scale out by adding more instances with intelligent auto-scaling policies',
      applicableScenarios: ['high-traffic', 'variable-load', 'cost-sensitive'],
      costImpact: {
        initial: 5000,
        ongoing: this.calculateHorizontalScalingCost(components, projectedUserCount),
        savings: this.calculateScalingSavings('horizontal', components, projectedUserCount)
      },
      performanceImpact: {
        latencyImprovement: 15,
        throughputIncrease: 200,
        availabilityIncrease: 10
      },
      implementationPlan: {
        phases: [
          {
            phase: 'Setup Auto-scaling Groups',
            duration: '1 week',
            cost: 2000,
            deliverables: ['Auto-scaling configuration', 'Load balancer setup', 'Health checks']
          },
          {
            phase: 'Implement Monitoring',
            duration: '1 week',
            cost: 1500,
            deliverables: ['CloudWatch setup', 'Custom metrics', 'Alerting']
          },
          {
            phase: 'Testing and Optimization',
            duration: '1 week',
            cost: 1500,
            deliverables: ['Load testing', 'Performance tuning', 'Documentation']
          }
        ],
        totalDuration: '3 weeks',
        totalCost: 5000
      },
      riskMitigation: [
        'Implement gradual rollout',
        'Set up comprehensive monitoring',
        'Create rollback procedures'
      ]
    });

    // Vertical scaling strategy
    strategies.push({
      strategy: 'Vertical Scaling with Reserved Instances',
      description: 'Scale up by upgrading to larger instances with cost-effective reserved capacity',
      applicableScenarios: ['predictable-load', 'performance-critical', 'budget-constrained'],
      costImpact: {
        initial: 10000,
        ongoing: this.calculateVerticalScalingCost(components, projectedUserCount),
        savings: this.calculateScalingSavings('vertical', components, projectedUserCount)
      },
      performanceImpact: {
        latencyImprovement: 25,
        throughputIncrease: 150,
        availabilityIncrease: 5
      },
      implementationPlan: {
        phases: [
          {
            phase: 'Capacity Planning',
            duration: '1 week',
            cost: 3000,
            deliverables: ['Performance analysis', 'Instance sizing', 'Cost projections']
          },
          {
            phase: 'Reserved Instance Purchase',
            duration: '1 week',
            cost: 5000,
            deliverables: ['Reserved capacity', 'Migration plan', 'Backup strategy']
          },
          {
            phase: 'Migration and Validation',
            duration: '2 weeks',
            cost: 2000,
            deliverables: ['Zero-downtime migration', 'Performance validation', 'Cost tracking']
          }
        ],
        totalDuration: '4 weeks',
        totalCost: 10000
      },
      riskMitigation: [
        'Thorough capacity planning',
        'Staged migration approach',
        'Performance baseline establishment'
      ]
    });

    // Hybrid scaling strategy
    strategies.push({
      strategy: 'Hybrid Multi-Cloud Scaling',
      description: 'Combine multiple cloud providers and scaling approaches for optimal cost-performance',
      applicableScenarios: ['enterprise', 'high-availability', 'cost-optimization'],
      costImpact: {
        initial: 25000,
        ongoing: this.calculateHybridScalingCost(components, projectedUserCount),
        savings: this.calculateScalingSavings('hybrid', components, projectedUserCount)
      },
      performanceImpact: {
        latencyImprovement: 35,
        throughputIncrease: 300,
        availabilityIncrease: 25
      },
      implementationPlan: {
        phases: [
          {
            phase: 'Multi-cloud Architecture Design',
            duration: '3 weeks',
            cost: 10000,
            deliverables: ['Architecture blueprint', 'Provider selection', 'Integration plan']
          },
          {
            phase: 'Infrastructure Setup',
            duration: '4 weeks',
            cost: 10000,
            deliverables: ['Multi-cloud deployment', 'Network configuration', 'Security setup']
          },
          {
            phase: 'Optimization and Monitoring',
            duration: '2 weeks',
            cost: 5000,
            deliverables: ['Cost optimization', 'Performance monitoring', 'Operational procedures']
          }
        ],
        totalDuration: '9 weeks',
        totalCost: 25000
      },
      riskMitigation: [
        'Vendor lock-in prevention',
        'Comprehensive testing',
        'Disaster recovery planning'
      ]
    });

    // Filter strategies based on budget constraints
    return strategies.filter(strategy => 
      strategy.costImpact.initial <= budgetConstraints.maxInitialInvestment &&
      strategy.costImpact.ongoing <= budgetConstraints.maxMonthlyBudget
    );
  }

  /**
   * Analyze cost optimization opportunities with performance impact
   */
  public analyzeCostOptimizationOpportunities(
    components: Component[],
    currentCost: CostBreakdown,
    performanceBaseline: PerformanceMetrics,
    acceptablePerformanceDegradation: {
      latencyIncrease: number; // percentage
      throughputDecrease: number; // percentage
      availabilityDecrease: number; // percentage
    }
  ): Array<{
    opportunity: string;
    description: string;
    costSavings: number;
    performanceImpact: {
      latencyChange: number;
      throughputChange: number;
      availabilityChange: number;
    };
    feasibility: 'high' | 'medium' | 'low';
    implementationEffort: 'low' | 'medium' | 'high';
    recommendation: 'implement' | 'consider' | 'avoid';
  }> {
    const opportunities = [];

    // Right-sizing opportunities
    opportunities.push({
      opportunity: 'Instance Right-sizing',
      description: 'Optimize instance types based on actual resource utilization',
      costSavings: currentCost.compute * 0.25,
      performanceImpact: {
        latencyChange: 5,
        throughputChange: -10,
        availabilityChange: 0
      },
      feasibility: 'high' as const,
      implementationEffort: 'low' as const,
      recommendation: 'implement' as const
    });

    // Storage optimization
    if (currentCost.storage > currentCost.total * 0.2) {
      opportunities.push({
        opportunity: 'Storage Tier Optimization',
        description: 'Move infrequently accessed data to cheaper storage tiers',
        costSavings: currentCost.storage * 0.4,
        performanceImpact: {
          latencyChange: 10,
          throughputChange: -5,
          availabilityChange: 0
        },
        feasibility: 'medium' as const,
        implementationEffort: 'medium' as const,
        recommendation: 'consider' as const
      });
    }

    // Network optimization
    if (currentCost.network > currentCost.total * 0.15) {
      opportunities.push({
        opportunity: 'CDN Implementation',
        description: 'Implement CDN to reduce origin server load and data transfer costs',
        costSavings: currentCost.network * 0.6,
        performanceImpact: {
          latencyChange: -30,
          throughputChange: 20,
          availabilityChange: 5
        },
        feasibility: 'high' as const,
        implementationEffort: 'medium' as const,
        recommendation: 'implement' as const
      });
    }

    // Reserved capacity
    opportunities.push({
      opportunity: 'Reserved Instance Purchase',
      description: 'Purchase reserved instances for predictable workloads',
      costSavings: currentCost.compute * 0.3,
      performanceImpact: {
        latencyChange: 0,
        throughputChange: 0,
        availabilityChange: 0
      },
      feasibility: 'high' as const,
      implementationEffort: 'low' as const,
      recommendation: 'implement' as const
    });

    // Filter based on acceptable performance degradation
    return opportunities.filter(opp => {
      const latencyOk = opp.performanceImpact.latencyChange <= acceptablePerformanceDegradation.latencyIncrease;
      const throughputOk = Math.abs(opp.performanceImpact.throughputChange) <= acceptablePerformanceDegradation.throughputDecrease;
      const availabilityOk = Math.abs(opp.performanceImpact.availabilityChange) <= acceptablePerformanceDegradation.availabilityDecrease;
      
      return latencyOk && throughputOk && availabilityOk;
    });
  }

  // Helper methods for tradeoff analysis

  private generateOptimizationScenarios(
    baseComponents: Component[],
    userCount: number,
    provider: 'aws' | 'gcp' | 'azure'
  ): PerformanceCostScenario[] {
    const scenarios: PerformanceCostScenario[] = [];

    // Cost-optimized scenario
    const costOptimized = this.costModelingService.optimizeComponentsForScenario(baseComponents, 'cost-optimized', userCount);
    scenarios.push(this.createScenario('cost-optimized', 'Minimize costs while meeting basic requirements', costOptimized, userCount, provider));

    // Balanced scenario
    const balanced = this.costModelingService.optimizeComponentsForScenario(baseComponents, 'balanced', userCount);
    scenarios.push(this.createScenario('balanced', 'Balance cost and performance', balanced, userCount, provider));

    // Performance-optimized scenario
    const performanceOptimized = this.costModelingService.optimizeComponentsForScenario(baseComponents, 'performance-optimized', userCount);
    scenarios.push(this.createScenario('performance-optimized', 'Maximize performance regardless of cost', performanceOptimized, userCount, provider));

    // High-availability scenario
    const highAvailability = this.createHighAvailabilityScenario(baseComponents, userCount);
    scenarios.push(this.createScenario('high-availability', 'Optimize for maximum availability and reliability', highAvailability, userCount, provider));

    return scenarios;
  }

  private createScenario(
    id: string,
    description: string,
    components: Component[],
    userCount: number,
    provider: 'aws' | 'gcp' | 'azure'
  ): PerformanceCostScenario {
    const cost = this.costModelingService.calculateTotalCost(components, userCount, userCount * 0.01, provider);
    const performance = this.costModelingService.estimatePerformanceMetrics(components, userCount);
    
    return {
      id,
      name: id.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      description,
      components,
      metrics: {
        performance: {
          latency: {
            p50: performance.latency,
            p95: performance.latency * 1.5,
            p99: performance.latency * 2
          },
          throughput: performance.throughput,
          availability: performance.availability,
          reliability: performance.reliability,
          scalability: this.calculateScalabilityScore(components)
        },
        cost,
        reliability: this.calculateReliabilityMetrics(components),
        scalability: this.calculateScalabilityMetrics(components)
      },
      score: {
        overall: this.calculateOverallScore(cost, performance),
        costEfficiency: this.calculateCostEfficiency(cost, performance),
        performanceScore: this.calculatePerformanceScore(performance),
        reliabilityScore: this.calculateReliabilityScore(components)
      }
    };
  }

  private calculateParetoFrontier(scenarios: PerformanceCostScenario[]): PerformanceCostPoint[] {
    const points = scenarios.map(scenario => ({
      cost: scenario.metrics.cost.total,
      performance: scenario.score.performanceScore,
      scenario: scenario.id,
      isOptimal: false
    }));

    // Sort by cost
    points.sort((a, b) => a.cost - b.cost);

    // Find Pareto optimal points
    const paretoPoints: PerformanceCostPoint[] = [];
    let maxPerformance = -1;

    for (const point of points) {
      if (point.performance > maxPerformance) {
        point.isOptimal = true;
        paretoPoints.push(point);
        maxPerformance = point.performance;
      }
    }

    return paretoPoints;
  }

  private generateScenarioRecommendations(
    scenarios: PerformanceCostScenario[],
    requirements: any
  ) {
    const costOptimal = scenarios.reduce((min, scenario) => 
      scenario.metrics.cost.total < min.metrics.cost.total ? scenario : min
    );

    const performanceOptimal = scenarios.reduce((max, scenario) => 
      scenario.score.performanceScore > max.score.performanceScore ? scenario : max
    );

    const balanced = scenarios.find(s => s.id === 'balanced') || scenarios[0];

    // Find user recommended based on requirements
    const userRecommended = scenarios.find(scenario => {
      const meetsLatency = scenario.metrics.performance.latency.p95 <= requirements.maxLatency;
      const meetsThroughput = scenario.metrics.performance.throughput >= requirements.minThroughput;
      const meetsAvailability = scenario.metrics.performance.availability >= requirements.minAvailability;
      const withinBudget = !requirements.budgetConstraint || scenario.metrics.cost.total <= requirements.budgetConstraint;
      
      return meetsLatency && meetsThroughput && meetsAvailability && withinBudget;
    }) || balanced;

    return {
      costOptimal,
      performanceOptimal,
      balanced,
      userRecommended
    };
  }

  private analyzeTradeoffs(scenarios: PerformanceCostScenario[], requirements: any): TradeoffAnalysis {
    const costs = scenarios.map(s => s.metrics.cost.total);
    const performances = scenarios.map(s => s.score.performanceScore);
    
    const costRange = Math.max(...costs) - Math.min(...costs);
    const performanceRange = Math.max(...performances) - Math.min(...performances);
    
    const costPerformanceRatio = costRange / Math.max(performanceRange, 1);

    // Find diminishing returns threshold
    const sortedByPerformance = [...scenarios].sort((a, b) => a.score.performanceScore - b.score.performanceScore);
    let diminishingReturnsThreshold = 0;
    
    for (let i = 1; i < sortedByPerformance.length; i++) {
      const costIncrease = sortedByPerformance[i].metrics.cost.total - sortedByPerformance[i-1].metrics.cost.total;
      const performanceIncrease = sortedByPerformance[i].score.performanceScore - sortedByPerformance[i-1].score.performanceScore;
      
      if (costIncrease / Math.max(performanceIncrease, 1) > costPerformanceRatio * 2) {
        diminishingReturnsThreshold = sortedByPerformance[i-1].score.performanceScore;
        break;
      }
    }

    // Find sweet spot
    const sweetSpotScenario = scenarios.reduce((best, scenario) => {
      const efficiency = scenario.score.performanceScore / scenario.metrics.cost.total;
      const bestEfficiency = best.score.performanceScore / best.metrics.cost.total;
      return efficiency > bestEfficiency ? scenario : best;
    });

    return {
      costPerformanceRatio,
      diminishingReturns: {
        threshold: diminishingReturnsThreshold,
        description: 'Performance improvements beyond this point have significantly higher cost'
      },
      sweetSpot: {
        cost: sweetSpotScenario.metrics.cost.total,
        performance: sweetSpotScenario.score.performanceScore,
        reasoning: 'Optimal balance of cost efficiency and performance'
      },
      riskAssessment: {
        overEngineering: this.calculateOverEngineeringRisk(scenarios, requirements),
        underProvisioning: this.calculateUnderProvisioningRisk(scenarios, requirements),
        recommendations: this.generateRiskRecommendations(scenarios, requirements)
      }
    };
  }

  // Additional helper methods for calculations
  private createHighAvailabilityScenario(components: Component[], userCount: number): Component[] {
    return components.map(component => ({
      ...component,
      configuration: {
        ...component.configuration,
        capacity: component.configuration.capacity * 1.5,
        failureRate: component.configuration.failureRate * 0.5,
        replicationFactor: 3
      }
    }));
  }

  private calculateScalabilityScore(components: Component[]): number {
    // Simplified scalability score calculation
    return components.reduce((score, comp) => {
      const config = comp.configuration as any;
      let componentScore = 50; // Base score
      
      if (config.scalingOptions?.autoScaling?.enabled) componentScore += 20;
      if (config.scalingOptions?.horizontal?.enabled) componentScore += 15;
      if (config.scalingOptions?.vertical?.enabled) componentScore += 10;
      if (config.clustering) componentScore += 5;
      
      return score + componentScore;
    }, 0) / components.length;
  }

  private calculateReliabilityMetrics(components: Component[]): ReliabilityMetrics {
    const avgFailureRate = components.reduce((sum, comp) => sum + comp.configuration.failureRate, 0) / components.length;
    
    return {
      mtbf: 1 / (avgFailureRate * 24), // Convert to hours
      mttr: 15, // Simplified
      sla: 99.9 - (avgFailureRate * 100),
      redundancy: components.filter(comp => (comp.configuration as any).replicationFactor > 1).length / components.length
    };
  }

  private calculateScalabilityMetrics(components: Component[]): ScalabilityMetrics {
    return {
      horizontalScaling: this.calculateScalabilityScore(components),
      verticalScaling: this.calculateScalabilityScore(components) * 0.8,
      autoScaling: components.filter(comp => (comp.configuration as any).scalingOptions?.autoScaling?.enabled).length / components.length * 100,
      elasticity: this.calculateScalabilityScore(components) * 0.9
    };
  }

  private calculateOverallScore(cost: CostBreakdown, performance: any): number {
    const costScore = Math.max(0, 100 - (cost.total / 100)); // Simplified
    const performanceScore = this.calculatePerformanceScore(performance);
    return (costScore + performanceScore) / 2;
  }

  private calculateCostEfficiency(cost: CostBreakdown, performance: any): number {
    return (this.calculatePerformanceScore(performance) / Math.max(cost.total, 1)) * 100;
  }

  private calculatePerformanceScore(performance: any): number {
    const latencyScore = Math.max(0, 100 - performance.latency);
    const throughputScore = Math.min(100, performance.throughput / 100);
    const availabilityScore = performance.availability;
    const reliabilityScore = performance.reliability;
    
    return (latencyScore + throughputScore + availabilityScore + reliabilityScore) / 4;
  }

  private calculateReliabilityScore(components: Component[]): number {
    const avgFailureRate = components.reduce((sum, comp) => sum + comp.configuration.failureRate, 0) / components.length;
    return Math.max(0, 100 - (avgFailureRate * 10000));
  }

  private calculateHorizontalScalingCost(components: Component[], userCount: number): number {
    return components.length * userCount * 0.001; // Simplified
  }

  private calculateVerticalScalingCost(components: Component[], userCount: number): number {
    return components.length * userCount * 0.0015; // Simplified
  }

  private calculateHybridScalingCost(components: Component[], userCount: number): number {
    return components.length * userCount * 0.0008; // Simplified
  }

  private calculateScalingSavings(strategy: string, components: Component[], userCount: number): number {
    const baseCost = components.length * userCount * 0.002;
    const multipliers = { horizontal: 0.7, vertical: 0.8, hybrid: 0.6 };
    return baseCost * (1 - (multipliers[strategy as keyof typeof multipliers] || 0.8));
  }

  private calculateOverEngineeringRisk(scenarios: PerformanceCostScenario[], requirements: any): number {
    const maxRequiredPerformance = Math.max(requirements.minThroughput / 100, (100 - requirements.maxLatency));
    const maxScenarioPerformance = Math.max(...scenarios.map(s => s.score.performanceScore));
    
    return Math.min(100, Math.max(0, ((maxScenarioPerformance - maxRequiredPerformance) / maxRequiredPerformance) * 100));
  }

  private calculateUnderProvisioningRisk(scenarios: PerformanceCostScenario[], requirements: any): number {
    const minRequiredPerformance = Math.max(requirements.minThroughput / 100, (100 - requirements.maxLatency));
    const minScenarioPerformance = Math.min(...scenarios.map(s => s.score.performanceScore));
    
    return Math.min(100, Math.max(0, ((minRequiredPerformance - minScenarioPerformance) / minRequiredPerformance) * 100));
  }

  private generateRiskRecommendations(scenarios: PerformanceCostScenario[], requirements: any): string[] {
    const recommendations: string[] = [];
    
    const overEngineering = this.calculateOverEngineeringRisk(scenarios, requirements);
    const underProvisioning = this.calculateUnderProvisioningRisk(scenarios, requirements);
    
    if (overEngineering > 30) {
      recommendations.push('Consider reducing resource allocation to avoid over-engineering');
    }
    
    if (underProvisioning > 20) {
      recommendations.push('Increase resource allocation to meet performance requirements');
    }
    
    if (overEngineering < 10 && underProvisioning < 10) {
      recommendations.push('Current scenarios are well-balanced for the requirements');
    }
    
    return recommendations;
  }
}

// Add cost performance tradeoff analyzer to the main service
export const costPerformanceTradeoffAnalyzer = new CostPerformanceTradeoffAnalyzer(costModelingService);