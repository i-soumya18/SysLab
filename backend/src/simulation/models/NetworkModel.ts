/**
 * Network component simulation model
 * Simulates network latency, bandwidth limitations, and packet loss
 * Note: This is used for connection modeling, not as a standalone component
 */

import { ComponentConfig, SimulationRequest, SimulationResponse, ComponentMetrics } from '../../types';

interface NetworkConfig {
  capacity: number;
  latency: number;
  failureRate: number;
  bandwidth: number; // Mbps
  packetLossRate: number; // 0-1
  jitter: number; // milliseconds variation
  mtu: number; // Maximum Transmission Unit in bytes
}

interface NetworkPacket {
  id: string;
  size: number;
  timestamp: number;
  retransmissions: number;
}

export class NetworkModel {
  public readonly id: string;
  public configuration: NetworkConfig;
  
  protected currentLoad: number = 0;
  protected queueDepth: number = 0;
  protected isHealthy: boolean = true;
  protected totalRequests: number = 0;
  protected successfulRequests: number = 0;
  protected lastMetricsReset: number = Date.now();

  private activeTransfers: Map<string, NetworkPacket> = new Map();
  private bandwidthUsage: number = 0; // Current bandwidth usage in Mbps

  constructor(id: string, configuration: NetworkConfig) {
    this.id = id;
    this.configuration = configuration;
  }

  async processRequest(request: SimulationRequest): Promise<SimulationResponse> {
    this.totalRequests++;
    this.currentLoad++;
    this.queueDepth++;

    try {
      const packetSize = this.estimatePacketSize(request);
      const networkLatency = this.calculateNetworkLatency(packetSize);
      const transmissionTime = this.calculateTransmissionTime(packetSize);
      
      // Check for packet loss
      if (this.shouldPacketDrop()) {
        this.currentLoad--;
        this.queueDepth--;
        return this.createFailureResponse(request, networkLatency, 'Packet dropped due to network congestion');
      }

      // Check bandwidth availability
      const requiredBandwidth = this.calculateRequiredBandwidth(packetSize);
      if (this.bandwidthUsage + requiredBandwidth > this.getNetworkConfig().bandwidth) {
        // Queue the request (simplified - in reality this would be more complex)
        const queueDelay = this.calculateQueueDelay();
        await this.simulateProcessingDelay(queueDelay);
      }

      // Reserve bandwidth
      this.bandwidthUsage += requiredBandwidth;

      // Create network packet
      const packet: NetworkPacket = {
        id: request.id,
        size: packetSize,
        timestamp: Date.now(),
        retransmissions: 0
      };

      this.activeTransfers.set(request.id, packet);

      // Simulate network transmission
      const totalLatency = networkLatency + transmissionTime;
      await this.simulateProcessingDelay(totalLatency);

      // Release bandwidth
      this.bandwidthUsage = Math.max(0, this.bandwidthUsage - requiredBandwidth);
      this.activeTransfers.delete(request.id);
      
      this.currentLoad--;
      this.queueDepth--;

      // Check for transmission failure
      if (this.shouldRequestFail()) {
        return this.createFailureResponse(request, totalLatency, 'Network transmission failed');
      }

      // Successful transmission
      const responsePayload = {
        packetSize,
        networkLatency,
        transmissionTime,
        totalLatency,
        retransmissions: packet.retransmissions,
        bandwidthUtilization: this.bandwidthUsage / this.getNetworkConfig().bandwidth
      };

      return this.createSuccessResponse(request, totalLatency, responsePayload);

    } catch (error) {
      this.currentLoad--;
      this.queueDepth--;
      return this.createFailureResponse(request, 0, `Network error: ${error}`);
    }
  }

  /**
   * Override metrics to include network-specific metrics
   */
  getMetrics() {
    const now = Date.now();
    const timeDelta = (now - this.lastMetricsReset) / 1000; // Convert to seconds
    const requestsPerSecond = timeDelta > 0 ? this.totalRequests / timeDelta : 0;
    const errorRate = this.totalRequests > 0 ? 1 - (this.successfulRequests / this.totalRequests) : 0;
    const config = this.getNetworkConfig();
    
    return {
      componentId: this.id,
      timestamp: now,
      requestsPerSecond,
      averageLatency: config.latency,
      errorRate,
      cpuUtilization: this.calculateCpuUtilization(),
      memoryUtilization: this.calculateMemoryUtilization(),
      queueDepth: this.queueDepth,
      bandwidthUtilization: this.bandwidthUsage / config.bandwidth,
      activeTransfers: this.activeTransfers.size,
      packetLossRate: config.packetLossRate,
      jitter: config.jitter,
      throughput: this.bandwidthUsage // Current throughput in Mbps
    };
  }

  /**
   * Handle network-specific failures
   */
  handleFailure(failureType: string): void {
    this.isHealthy = false;
    console.log(`Network ${this.id} failed: ${failureType}`);
    
    switch (failureType) {
      case 'congestion':
        // Simulate network congestion by reducing available bandwidth
        const config = this.getNetworkConfig();
        config.bandwidth *= 0.5; // Reduce bandwidth by 50%
        break;
      case 'high_latency':
        // Increase base latency
        this.configuration.latency *= 2;
        break;
      case 'packet_loss':
        // Increase packet loss rate
        const netConfig = this.getNetworkConfig();
        netConfig.packetLossRate = Math.min(0.5, netConfig.packetLossRate * 3);
        break;
      case 'link_failure':
        // Complete network failure
        this.activeTransfers.clear();
        this.bandwidthUsage = 0;
        break;
    }
  }

  /**
   * Simulate network recovery
   */
  recover(): void {
    this.isHealthy = true;
    
    // Reset network parameters to original values
    // In a real implementation, you'd store original values
    const config = this.getNetworkConfig();
    config.packetLossRate = Math.min(0.01, config.packetLossRate); // Reset to low packet loss
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

  /**
   * Calculate network latency including jitter
   */
  private calculateNetworkLatency(packetSize: number): number {
    const config = this.getNetworkConfig();
    const baseLatency = config.latency;
    
    // Add jitter (random variation)
    const jitterVariation = (Math.random() - 0.5) * 2 * config.jitter;
    
    // Add congestion-based latency
    const congestionMultiplier = 1 + (this.bandwidthUsage / config.bandwidth) * 0.5;
    
    return Math.max(0, baseLatency + jitterVariation) * congestionMultiplier;
  }

  /**
   * Calculate transmission time based on packet size and bandwidth
   */
  private calculateTransmissionTime(packetSize: number): number {
    const config = this.getNetworkConfig();
    const bitsPerSecond = config.bandwidth * 1_000_000; // Convert Mbps to bps
    const transmissionTimeSeconds = (packetSize * 8) / bitsPerSecond; // Convert bytes to bits
    
    return transmissionTimeSeconds * 1000; // Convert to milliseconds
  }

  /**
   * Calculate required bandwidth for packet
   */
  private calculateRequiredBandwidth(packetSize: number): number {
    // Simplified calculation: assume packet needs bandwidth for 100ms
    const transmissionDuration = 0.1; // 100ms in seconds
    const bitsPerSecond = (packetSize * 8) / transmissionDuration;
    
    return bitsPerSecond / 1_000_000; // Convert to Mbps
  }

  /**
   * Calculate queue delay when bandwidth is saturated
   */
  private calculateQueueDelay(): number {
    const config = this.getNetworkConfig();
    const utilizationRatio = this.bandwidthUsage / config.bandwidth;
    
    // Exponential backoff based on utilization
    return Math.min(1000, 10 * Math.pow(2, utilizationRatio * 5)); // Max 1 second delay
  }

  /**
   * Determine if packet should be dropped
   */
  private shouldPacketDrop(): boolean {
    const config = this.getNetworkConfig();
    const baseDropRate = config.packetLossRate;
    
    // Increase drop rate under congestion
    const congestionMultiplier = 1 + (this.bandwidthUsage / config.bandwidth);
    const effectiveDropRate = Math.min(0.5, baseDropRate * congestionMultiplier);
    
    return Math.random() < effectiveDropRate;
  }

  /**
   * Estimate packet size from request
   */
  private estimatePacketSize(request: SimulationRequest): number {
    const config = this.getNetworkConfig();
    
    // Estimate based on payload size
    const payloadSize = JSON.stringify(request.payload).length;
    const headerSize = 64; // TCP/IP headers
    const totalSize = payloadSize + headerSize;
    
    // Fragment if larger than MTU
    const packets = Math.ceil(totalSize / config.mtu);
    return Math.min(totalSize, config.mtu * packets);
  }

  /**
   * Get network-specific configuration
   */
  private getNetworkConfig(): NetworkConfig {
    return this.configuration as NetworkConfig;
  }

}