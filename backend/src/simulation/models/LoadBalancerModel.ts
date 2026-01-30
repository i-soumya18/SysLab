/**
 * Load Balancer component simulation model
 * Implements different load balancing algorithms and health checking
 */

import { BaseComponentModel } from './BaseComponentModel';
import { SimulationRequest, SimulationResponse } from '../../types';

type LoadBalancingAlgorithm = 'round-robin' | 'least-connections' | 'weighted-round-robin' | 'ip-hash';

interface LoadBalancerConfig {
  capacity: number;
  latency: number;
  failureRate: number;
  algorithm: LoadBalancingAlgorithm;
  healthCheckInterval: number; // milliseconds
  backendTargets: BackendTarget[];
}

interface BackendTarget {
  id: string;
  weight: number;
  isHealthy: boolean;
  currentConnections: number;
  maxConnections: number;
}

export class LoadBalancerModel extends BaseComponentModel {
  private backendTargets: BackendTarget[] = [];
  private roundRobinIndex: number = 0;
  private healthCheckTimer: NodeJS.Timeout | null = null;

  constructor(id: string, configuration: LoadBalancerConfig) {
    super(id, 'load-balancer', configuration);
    this.backendTargets = configuration.backendTargets || this.createDefaultBackends();
    this.startHealthChecking();
  }

  async processRequest(request: SimulationRequest): Promise<SimulationResponse> {
    this.totalRequests++;
    this.currentLoad++;
    this.queueDepth++;

    try {
      // Select backend target based on algorithm
      const selectedTarget = this.selectBackendTarget(request);
      
      if (!selectedTarget) {
        this.currentLoad--;
        this.queueDepth--;
        return this.createFailureResponse(request, 0, 'No healthy backend targets available');
      }

      // Calculate load balancer processing latency
      const lbLatency = this.calculateLatency();
      
      // Simulate load balancer processing
      await this.simulateProcessingDelay(lbLatency);

      // Update target connection count
      selectedTarget.currentConnections++;

      // Simulate backend processing (simplified)
      const backendLatency = this.simulateBackendProcessing(selectedTarget);
      const totalLatency = lbLatency + backendLatency;

      // Release connection
      selectedTarget.currentConnections = Math.max(0, selectedTarget.currentConnections - 1);
      this.currentLoad--;
      this.queueDepth--;

      // Check for failure
      if (this.shouldRequestFail() || !selectedTarget.isHealthy) {
        return this.createFailureResponse(request, totalLatency, 'Backend target failed');
      }

      // Successful response
      const responsePayload = {
        selectedBackend: selectedTarget.id,
        algorithm: this.getLoadBalancerConfig().algorithm,
        totalLatency,
        loadBalancerLatency: lbLatency,
        backendLatency
      };

      return this.createSuccessResponse(request, totalLatency, responsePayload);

    } catch (error) {
      this.currentLoad--;
      this.queueDepth--;
      return this.createFailureResponse(request, 0, `Load balancer error: ${error}`);
    }
  }

  /**
   * Select backend target based on configured algorithm
   */
  private selectBackendTarget(request: SimulationRequest): BackendTarget | null {
    const healthyTargets = this.backendTargets.filter(target => 
      target.isHealthy && target.currentConnections < target.maxConnections
    );

    if (healthyTargets.length === 0) {
      return null;
    }

    const config = this.getLoadBalancerConfig();

    switch (config.algorithm) {
      case 'round-robin':
        return this.selectRoundRobin(healthyTargets);
      
      case 'least-connections':
        return this.selectLeastConnections(healthyTargets);
      
      case 'weighted-round-robin':
        return this.selectWeightedRoundRobin(healthyTargets);
      
      case 'ip-hash':
        return this.selectIpHash(healthyTargets, request);
      
      default:
        return healthyTargets[0];
    }
  }

  /**
   * Round-robin selection
   */
  private selectRoundRobin(targets: BackendTarget[]): BackendTarget {
    const target = targets[this.roundRobinIndex % targets.length];
    this.roundRobinIndex = (this.roundRobinIndex + 1) % targets.length;
    return target;
  }

  /**
   * Least connections selection
   */
  private selectLeastConnections(targets: BackendTarget[]): BackendTarget {
    return targets.reduce((least, current) => 
      current.currentConnections < least.currentConnections ? current : least
    );
  }

  /**
   * Weighted round-robin selection
   */
  private selectWeightedRoundRobin(targets: BackendTarget[]): BackendTarget {
    const totalWeight = targets.reduce((sum, target) => sum + target.weight, 0);
    let randomWeight = Math.random() * totalWeight;
    
    for (const target of targets) {
      randomWeight -= target.weight;
      if (randomWeight <= 0) {
        return target;
      }
    }
    
    return targets[0]; // Fallback
  }

  /**
   * IP hash selection (simplified using request ID)
   */
  private selectIpHash(targets: BackendTarget[], request: SimulationRequest): BackendTarget {
    const hash = this.simpleHash(request.id);
    return targets[hash % targets.length];
  }

  /**
   * Simple hash function for IP hash algorithm
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Simulate backend processing time
   */
  private simulateBackendProcessing(target: BackendTarget): number {
    const baseLatency = 50; // Base backend latency
    const loadFactor = target.currentConnections / target.maxConnections;
    const randomVariation = 0.8 + Math.random() * 0.4;
    
    return baseLatency * (1 + loadFactor) * randomVariation;
  }

  /**
   * Start health checking for backend targets
   */
  private startHealthChecking(): void {
    const config = this.getLoadBalancerConfig();
    
    this.healthCheckTimer = setInterval(() => {
      this.performHealthChecks();
    }, config.healthCheckInterval);
  }

  /**
   * Perform health checks on all backend targets
   */
  private performHealthChecks(): void {
    this.backendTargets.forEach(target => {
      // Simulate health check - random failure based on overall health
      const healthCheckSuccess = Math.random() > 0.05; // 5% chance of health check failure
      
      if (!healthCheckSuccess && target.isHealthy) {
        target.isHealthy = false;
        console.log(`Backend target ${target.id} marked as unhealthy`);
      } else if (healthCheckSuccess && !target.isHealthy) {
        // Recovery logic - gradual recovery
        if (Math.random() > 0.7) { // 30% chance of recovery per check
          target.isHealthy = true;
          console.log(`Backend target ${target.id} recovered`);
        }
      }
    });
  }

  /**
   * Create default backend targets if none provided
   */
  private createDefaultBackends(): BackendTarget[] {
    return [
      {
        id: 'backend-1',
        weight: 1,
        isHealthy: true,
        currentConnections: 0,
        maxConnections: 100
      },
      {
        id: 'backend-2',
        weight: 1,
        isHealthy: true,
        currentConnections: 0,
        maxConnections: 100
      },
      {
        id: 'backend-3',
        weight: 2, // Higher weight
        isHealthy: true,
        currentConnections: 0,
        maxConnections: 150
      }
    ];
  }

  /**
   * Get load balancer specific configuration
   */
  private getLoadBalancerConfig(): LoadBalancerConfig {
    return this.configuration as LoadBalancerConfig;
  }

  /**
   * Override metrics to include load balancer specific metrics
   */
  getMetrics() {
    const baseMetrics = super.getMetrics();
    const healthyTargets = this.backendTargets.filter(t => t.isHealthy).length;
    const totalConnections = this.backendTargets.reduce((sum, t) => sum + t.currentConnections, 0);
    
    return {
      ...baseMetrics,
      healthyBackends: healthyTargets,
      totalBackends: this.backendTargets.length,
      totalBackendConnections: totalConnections,
      algorithm: this.getLoadBalancerConfig().algorithm,
      backendTargets: this.backendTargets.map(t => ({
        id: t.id,
        isHealthy: t.isHealthy,
        currentConnections: t.currentConnections,
        utilization: t.currentConnections / t.maxConnections
      }))
    };
  }

  /**
   * Handle load balancer specific failures
   */
  handleFailure(failureType: string): void {
    super.handleFailure(failureType);
    
    switch (failureType) {
      case 'backend_failure':
        // Mark random backend as unhealthy
        const healthyTargets = this.backendTargets.filter(t => t.isHealthy);
        if (healthyTargets.length > 0) {
          const randomTarget = healthyTargets[Math.floor(Math.random() * healthyTargets.length)];
          randomTarget.isHealthy = false;
        }
        break;
      case 'health_check_failure':
        // Disable health checking temporarily
        if (this.healthCheckTimer) {
          clearInterval(this.healthCheckTimer);
          this.healthCheckTimer = null;
        }
        break;
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }
}