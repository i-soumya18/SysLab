/**
 * Base class for all component behavior models
 */

import { ComponentModel, ComponentConfig, SimulationRequest, SimulationResponse, ComponentMetrics, ComponentType } from '../../types';

export abstract class BaseComponentModel implements ComponentModel {
  public readonly id: string;
  public readonly type: ComponentType;
  public configuration: ComponentConfig;
  
  protected currentLoad: number = 0;
  protected queueDepth: number = 0;
  protected isHealthy: boolean = true;
  protected totalRequests: number = 0;
  protected successfulRequests: number = 0;
  protected lastMetricsReset: number = Date.now();

  constructor(id: string, type: ComponentType, configuration: ComponentConfig) {
    this.id = id;
    this.type = type;
    this.configuration = configuration;
  }

  /**
   * Process an incoming request - must be implemented by subclasses
   */
  abstract processRequest(request: SimulationRequest): Promise<SimulationResponse>;

  /**
   * Get current component metrics
   */
  getMetrics(): ComponentMetrics {
    const now = Date.now();
    const timeDelta = (now - this.lastMetricsReset) / 1000; // Convert to seconds
    const requestsPerSecond = timeDelta > 0 ? this.totalRequests / timeDelta : 0;
    const errorRate = this.totalRequests > 0 ? 1 - (this.successfulRequests / this.totalRequests) : 0;

    return {
      componentId: this.id,
      timestamp: now,
      requestsPerSecond,
      averageLatency: this.configuration.latency,
      errorRate,
      cpuUtilization: this.calculateCpuUtilization(),
      memoryUtilization: this.calculateMemoryUtilization(),
      queueDepth: this.queueDepth
    };
  }

  /**
   * Handle component failure
   */
  handleFailure(failureType: string): void {
    this.isHealthy = false;
    console.log(`Component ${this.id} failed: ${failureType}`);
  }

  /**
   * Recover from failure
   */
  recover(): void {
    this.isHealthy = true;
    console.log(`Component ${this.id} recovered`);
  }

  /**
   * Reset metrics counters
   */
  resetMetrics(): void {
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.lastMetricsReset = Date.now();
  }

  /**
   * Calculate CPU utilization based on current load
   */
  protected calculateCpuUtilization(): number {
    const utilizationRatio = this.currentLoad / this.configuration.capacity;
    return Math.min(0.95, utilizationRatio * 0.8); // Cap at 95%, scale by 80%
  }

  /**
   * Calculate memory utilization based on queue depth
   */
  protected calculateMemoryUtilization(): number {
    const maxQueue = this.configuration.capacity * 2; // Assume queue can hold 2x capacity
    const utilizationRatio = this.queueDepth / maxQueue;
    return Math.min(0.90, utilizationRatio * 0.7); // Cap at 90%, scale by 70%
  }

  /**
   * Calculate processing latency with load-based scaling
   */
  protected calculateLatency(): number {
    const baseLatency = this.configuration.latency;
    const loadFactor = Math.max(1, this.currentLoad / this.configuration.capacity);
    const randomVariation = 0.8 + Math.random() * 0.4; // ±20% variation
    
    return baseLatency * loadFactor * randomVariation;
  }

  /**
   * Determine if request should fail based on failure rate and health
   */
  protected shouldRequestFail(): boolean {
    if (!this.isHealthy) {
      return Math.random() < 0.8; // 80% failure rate when unhealthy
    }
    return Math.random() < this.configuration.failureRate;
  }

  /**
   * Create a successful response
   */
  protected createSuccessResponse(request: SimulationRequest, latency: number, payload?: any): SimulationResponse {
    this.successfulRequests++;
    return {
      requestId: request.id,
      timestamp: Date.now(),
      success: true,
      latency,
      payload
    };
  }

  /**
   * Create a failure response
   */
  protected createFailureResponse(request: SimulationRequest, latency: number, error: string): SimulationResponse {
    return {
      requestId: request.id,
      timestamp: Date.now(),
      success: false,
      latency,
      error
    };
  }

  /**
   * Simulate processing delay
   */
  protected async simulateProcessingDelay(latency: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, latency));
  }
}