/**
 * Latency Injection Engine implementing SRS FR-6.2
 * 
 * Creates configurable network latency injection per SRS FR-6.2
 * Adds latency spike simulation per SRS FR-6.2
 * Implements jitter and packet loss modeling per SRS FR-6.2
 */

import { EventEmitter } from 'events';
import { SimulationEvent, EventScheduler } from './types';

// Latency injection types
export type LatencyInjectionType = 
  | 'constant'      // Constant additional latency
  | 'spike'         // Sudden latency spikes
  | 'gradual'       // Gradual latency increase
  | 'intermittent'  // Intermittent latency issues
  | 'jitter'        // Network jitter simulation
  | 'packet_loss';  // Packet loss with retransmission delays

// Latency injection configuration
export interface LatencyInjectionConfig {
  type: LatencyInjectionType;
  baseLatencyIncrease: number; // milliseconds
  duration: number; // milliseconds
  affectedConnections: string[]; // connection IDs
  parameters: LatencyParameters;
}

// Type-specific latency parameters
export interface LatencyParameters {
  // Spike parameters
  spikeIntensity?: number; // multiplier for spike latency
  spikeFrequency?: number; // spikes per minute
  spikeDuration?: number; // milliseconds per spike
  
  // Gradual parameters
  gradualRate?: number; // ms increase per second
  maxLatency?: number; // maximum latency cap
  
  // Intermittent parameters
  intermittentPattern?: {
    onDuration: number; // ms
    offDuration: number; // ms
    cycles: number;
  };
  
  // Jitter parameters
  jitterRange?: number; // ±ms variation
  jitterDistribution?: 'uniform' | 'normal' | 'exponential';
  
  // Packet loss parameters
  packetLossRate?: number; // 0.0 to 1.0
  retransmissionDelay?: number; // ms delay for retransmissions
  maxRetransmissions?: number;
}

// Active latency injection
export interface ActiveLatencyInjection {
  id: string;
  connectionId: string;
  type: LatencyInjectionType;
  config: LatencyInjectionConfig;
  startTime: number;
  endTime: number;
  currentLatencyIncrease: number;
  isActive: boolean;
  statistics: LatencyInjectionStatistics;
}

// Latency injection statistics
export interface LatencyInjectionStatistics {
  totalRequests: number;
  affectedRequests: number;
  averageLatencyIncrease: number;
  maxLatencyIncrease: number;
  packetLossCount: number;
  retransmissionCount: number;
  jitterVariance: number;
}

// Connection latency state
export interface ConnectionLatencyState {
  connectionId: string;
  baseLatency: number;
  currentAdditionalLatency: number;
  activeInjections: string[];
  latencyHistory: LatencyMeasurement[];
  packetLossRate: number;
  jitterState: JitterState;
}

// Latency measurement
export interface LatencyMeasurement {
  timestamp: number;
  latency: number;
  injectionContribution: number;
  packetLoss: boolean;
  retransmissions: number;
}

// Jitter state tracking
export interface JitterState {
  currentJitter: number;
  jitterHistory: number[];
  distribution: 'uniform' | 'normal' | 'exponential';
  range: number;
}

// Latency spike event
export interface LatencySpikeEvent {
  connectionId: string;
  spikeLatency: number;
  duration: number;
  startTime: number;
  endTime: number;
  intensity: number;
}

/**
 * Latency Injection Engine
 * Implements SRS FR-6.2 requirements for network latency injection
 */
export class LatencyInjectionEngine extends EventEmitter {
  private eventScheduler: EventScheduler;
  private activeInjections: Map<string, ActiveLatencyInjection>;
  private connectionStates: Map<string, ConnectionLatencyState>;
  private spikeEvents: Map<string, LatencySpikeEvent>;
  private isRunning: boolean;

  constructor(eventScheduler: EventScheduler) {
    super();
    this.eventScheduler = eventScheduler;
    this.activeInjections = new Map();
    this.connectionStates = new Map();
    this.spikeEvents = new Map();
    this.isRunning = false;
  }

  /**
   * Initialize connection for latency injection
   */
  initializeConnection(connectionId: string, baseLatency: number): void {
    const state: ConnectionLatencyState = {
      connectionId,
      baseLatency,
      currentAdditionalLatency: 0,
      activeInjections: [],
      latencyHistory: [],
      packetLossRate: 0,
      jitterState: {
        currentJitter: 0,
        jitterHistory: [],
        distribution: 'uniform',
        range: 0
      }
    };

    this.connectionStates.set(connectionId, state);
    this.emit('connection_initialized', { connectionId, baseLatency });
  }

  /**
   * Inject latency on a connection
   * Implements SRS FR-6.2: Configurable network latency injection
   */
  injectLatency(connectionId: string, config: LatencyInjectionConfig): string {
    const injectionId = `latency_${connectionId}_${Date.now()}`;
    const currentTime = Date.now();
    const endTime = currentTime + config.duration;

    const injection: ActiveLatencyInjection = {
      id: injectionId,
      connectionId,
      type: config.type,
      config,
      startTime: currentTime,
      endTime,
      currentLatencyIncrease: config.baseLatencyIncrease,
      isActive: true,
      statistics: {
        totalRequests: 0,
        affectedRequests: 0,
        averageLatencyIncrease: 0,
        maxLatencyIncrease: 0,
        packetLossCount: 0,
        retransmissionCount: 0,
        jitterVariance: 0
      }
    };

    this.activeInjections.set(injectionId, injection);

    // Update connection state
    const connectionState = this.connectionStates.get(connectionId);
    if (connectionState) {
      connectionState.activeInjections.push(injectionId);
      this.updateConnectionLatency(connectionId);
    }

    // Schedule injection-specific behavior
    this.scheduleInjectionBehavior(injection);

    // Schedule injection end
    this.eventScheduler.scheduleEvent({
      id: `latency_injection_end_${injectionId}`,
      timestamp: endTime,
      type: 'failure_injection',
      componentId: connectionId,
      data: {
        action: 'end_latency_injection',
        injectionId
      }
    });

    this.emit('latency_injection_started', {
      injectionId,
      connectionId,
      type: config.type,
      config
    });

    return injectionId;
  }

  /**
   * Inject latency spike
   * Implements SRS FR-6.2: Latency spike simulation
   */
  injectLatencySpike(connectionId: string, spikeConfig: {
    intensity: number;
    duration: number;
    frequency?: number;
    count?: number;
  }): string[] {
    const spikeIds: string[] = [];
    const currentTime = Date.now();
    const count = spikeConfig.count || 1;
    const frequency = spikeConfig.frequency || 0; // ms between spikes

    for (let i = 0; i < count; i++) {
      const spikeId = `spike_${connectionId}_${currentTime}_${i}`;
      const spikeStartTime = currentTime + (i * frequency);
      const spikeEndTime = spikeStartTime + spikeConfig.duration;

      const spikeEvent: LatencySpikeEvent = {
        connectionId,
        spikeLatency: spikeConfig.intensity * 1000, // Convert to ms
        duration: spikeConfig.duration,
        startTime: spikeStartTime,
        endTime: spikeEndTime,
        intensity: spikeConfig.intensity
      };

      this.spikeEvents.set(spikeId, spikeEvent);
      spikeIds.push(spikeId);

      // Schedule spike start
      this.eventScheduler.scheduleEvent({
        id: `spike_start_${spikeId}`,
        timestamp: spikeStartTime,
        type: 'failure_injection',
        componentId: connectionId,
        data: {
          action: 'start_latency_spike',
          spikeId,
          spikeLatency: spikeEvent.spikeLatency
        }
      });

      // Schedule spike end
      this.eventScheduler.scheduleEvent({
        id: `spike_end_${spikeId}`,
        timestamp: spikeEndTime,
        type: 'failure_injection',
        componentId: connectionId,
        data: {
          action: 'end_latency_spike',
          spikeId
        }
      });
    }

    this.emit('latency_spikes_scheduled', {
      connectionId,
      spikeIds,
      config: spikeConfig
    });

    return spikeIds;
  }

  /**
   * Inject network jitter
   * Implements SRS FR-6.2: Jitter modeling
   */
  injectJitter(connectionId: string, jitterConfig: {
    range: number;
    distribution: 'uniform' | 'normal' | 'exponential';
    duration: number;
  }): string {
    const injectionConfig: LatencyInjectionConfig = {
      type: 'jitter',
      baseLatencyIncrease: 0, // Jitter doesn't add constant latency
      duration: jitterConfig.duration,
      affectedConnections: [connectionId],
      parameters: {
        jitterRange: jitterConfig.range,
        jitterDistribution: jitterConfig.distribution
      }
    };

    const injectionId = this.injectLatency(connectionId, injectionConfig);

    // Update connection jitter state
    const connectionState = this.connectionStates.get(connectionId);
    if (connectionState) {
      connectionState.jitterState.range = jitterConfig.range;
      connectionState.jitterState.distribution = jitterConfig.distribution;
    }

    return injectionId;
  }

  /**
   * Inject packet loss
   * Implements SRS FR-6.2: Packet loss modeling
   */
  injectPacketLoss(connectionId: string, packetLossConfig: {
    lossRate: number;
    retransmissionDelay: number;
    maxRetransmissions: number;
    duration: number;
  }): string {
    const injectionConfig: LatencyInjectionConfig = {
      type: 'packet_loss',
      baseLatencyIncrease: 0,
      duration: packetLossConfig.duration,
      affectedConnections: [connectionId],
      parameters: {
        packetLossRate: packetLossConfig.lossRate,
        retransmissionDelay: packetLossConfig.retransmissionDelay,
        maxRetransmissions: packetLossConfig.maxRetransmissions
      }
    };

    const injectionId = this.injectLatency(connectionId, injectionConfig);

    // Update connection packet loss rate
    const connectionState = this.connectionStates.get(connectionId);
    if (connectionState) {
      connectionState.packetLossRate = packetLossConfig.lossRate;
    }

    return injectionId;
  }

  /**
   * Calculate current latency for a connection
   */
  calculateCurrentLatency(connectionId: string, requestId: string): number {
    const connectionState = this.connectionStates.get(connectionId);
    if (!connectionState) {
      return 0;
    }

    let totalLatency = connectionState.baseLatency;
    let injectionContribution = 0;
    const currentTime = Date.now();

    // Add latency from active injections
    for (const injectionId of connectionState.activeInjections) {
      const injection = this.activeInjections.get(injectionId);
      if (!injection || !injection.isActive) continue;

      const latencyIncrease = this.calculateInjectionLatency(injection, currentTime);
      injectionContribution += latencyIncrease;
    }

    // Add spike latency if active
    const spikeLatency = this.calculateSpikeLatency(connectionId, currentTime);
    injectionContribution += spikeLatency;

    // Add jitter
    const jitter = this.calculateJitter(connectionState);
    injectionContribution += jitter;

    totalLatency += injectionContribution;

    // Record measurement
    const measurement: LatencyMeasurement = {
      timestamp: currentTime,
      latency: totalLatency,
      injectionContribution,
      packetLoss: this.shouldDropPacket(connectionState),
      retransmissions: 0
    };

    // Handle packet loss
    if (measurement.packetLoss) {
      const retransmissionLatency = this.handlePacketLoss(connectionState, requestId);
      totalLatency += retransmissionLatency;
      measurement.retransmissions = Math.floor(retransmissionLatency / (connectionState.packetLossRate * 1000));
    }

    connectionState.latencyHistory.push(measurement);
    
    // Keep only last 1000 measurements
    if (connectionState.latencyHistory.length > 1000) {
      connectionState.latencyHistory = connectionState.latencyHistory.slice(-1000);
    }

    // Update injection statistics
    this.updateInjectionStatistics(connectionState, measurement);

    return Math.max(0, totalLatency);
  }

  /**
   * Stop latency injection
   */
  stopLatencyInjection(injectionId: string): boolean {
    const injection = this.activeInjections.get(injectionId);
    if (!injection) return false;

    injection.isActive = false;
    injection.endTime = Date.now();

    // Remove from connection state
    const connectionState = this.connectionStates.get(injection.connectionId);
    if (connectionState) {
      connectionState.activeInjections = connectionState.activeInjections.filter(id => id !== injectionId);
      this.updateConnectionLatency(injection.connectionId);
    }

    this.emit('latency_injection_stopped', {
      injectionId,
      connectionId: injection.connectionId,
      statistics: injection.statistics
    });

    return true;
  }

  /**
   * Get active injections for a connection
   */
  getActiveInjections(connectionId?: string): ActiveLatencyInjection[] {
    const injections = Array.from(this.activeInjections.values())
      .filter(injection => injection.isActive);

    if (connectionId) {
      return injections.filter(injection => injection.connectionId === connectionId);
    }

    return injections;
  }

  /**
   * Get connection latency state
   */
  getConnectionState(connectionId: string): ConnectionLatencyState | null {
    return this.connectionStates.get(connectionId) || null;
  }

  /**
   * Get latency statistics for a connection
   */
  getLatencyStatistics(connectionId: string): {
    averageLatency: number;
    p95Latency: number;
    p99Latency: number;
    jitterVariance: number;
    packetLossRate: number;
  } {
    const connectionState = this.connectionStates.get(connectionId);
    if (!connectionState || connectionState.latencyHistory.length === 0) {
      return {
        averageLatency: 0,
        p95Latency: 0,
        p99Latency: 0,
        jitterVariance: 0,
        packetLossRate: 0
      };
    }

    const latencies = connectionState.latencyHistory.map(m => m.latency).sort((a, b) => a - b);
    const packetLosses = connectionState.latencyHistory.filter(m => m.packetLoss).length;

    const p95Index = Math.floor(latencies.length * 0.95);
    const p99Index = Math.floor(latencies.length * 0.99);

    const averageLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
    const jitterValues = connectionState.jitterState.jitterHistory;
    const jitterVariance = jitterValues.length > 0 ? 
      this.calculateVariance(jitterValues) : 0;

    return {
      averageLatency,
      p95Latency: latencies[p95Index] || 0,
      p99Latency: latencies[p99Index] || 0,
      jitterVariance,
      packetLossRate: packetLosses / connectionState.latencyHistory.length
    };
  }

  /**
   * Clear all latency injections
   */
  clear(): void {
    this.activeInjections.clear();
    this.connectionStates.clear();
    this.spikeEvents.clear();
    this.emit('latency_engine_cleared');
  }

  // Private helper methods

  private scheduleInjectionBehavior(injection: ActiveLatencyInjection): void {
    const { type, config } = injection;

    switch (type) {
      case 'spike':
        this.scheduleSpikePattern(injection);
        break;
      case 'gradual':
        this.scheduleGradualIncrease(injection);
        break;
      case 'intermittent':
        this.scheduleIntermittentPattern(injection);
        break;
      case 'jitter':
        this.scheduleJitterUpdates(injection);
        break;
      case 'packet_loss':
        // Packet loss is handled per-request, no scheduling needed
        break;
      default:
        // Constant latency, no additional scheduling needed
        break;
    }
  }

  private scheduleSpikePattern(injection: ActiveLatencyInjection): void {
    const { parameters } = injection.config;
    if (!parameters.spikeFrequency || !parameters.spikeDuration) return;

    const spikeInterval = 60000 / parameters.spikeFrequency; // Convert frequency to interval
    const spikesCount = Math.floor(injection.config.duration / spikeInterval);

    for (let i = 0; i < spikesCount; i++) {
      const spikeTime = injection.startTime + (i * spikeInterval);
      
      this.eventScheduler.scheduleEvent({
        id: `spike_${injection.id}_${i}`,
        timestamp: spikeTime,
        type: 'failure_injection',
        componentId: injection.connectionId,
        data: {
          action: 'apply_latency_spike',
          injectionId: injection.id,
          spikeIntensity: parameters.spikeIntensity || 2,
          duration: parameters.spikeDuration
        }
      });
    }
  }

  private scheduleGradualIncrease(injection: ActiveLatencyInjection): void {
    const { parameters } = injection.config;
    if (!parameters.gradualRate) return;

    const updateInterval = 1000; // Update every second
    const updates = Math.floor(injection.config.duration / updateInterval);

    for (let i = 0; i < updates; i++) {
      const updateTime = injection.startTime + (i * updateInterval);
      
      this.eventScheduler.scheduleEvent({
        id: `gradual_update_${injection.id}_${i}`,
        timestamp: updateTime,
        type: 'failure_injection',
        componentId: injection.connectionId,
        data: {
          action: 'update_gradual_latency',
          injectionId: injection.id,
          increment: parameters.gradualRate,
          maxLatency: parameters.maxLatency || 10000
        }
      });
    }
  }

  private scheduleIntermittentPattern(injection: ActiveLatencyInjection): void {
    const { parameters } = injection.config;
    if (!parameters.intermittentPattern) return;

    const pattern = parameters.intermittentPattern;
    const cycleTime = pattern.onDuration + pattern.offDuration;
    let currentTime = injection.startTime;

    for (let cycle = 0; cycle < pattern.cycles && currentTime < injection.endTime; cycle++) {
      // Schedule ON period
      this.eventScheduler.scheduleEvent({
        id: `intermittent_on_${injection.id}_${cycle}`,
        timestamp: currentTime,
        type: 'failure_injection',
        componentId: injection.connectionId,
        data: {
          action: 'enable_intermittent_latency',
          injectionId: injection.id
        }
      });

      // Schedule OFF period
      this.eventScheduler.scheduleEvent({
        id: `intermittent_off_${injection.id}_${cycle}`,
        timestamp: currentTime + pattern.onDuration,
        type: 'failure_injection',
        componentId: injection.connectionId,
        data: {
          action: 'disable_intermittent_latency',
          injectionId: injection.id
        }
      });

      currentTime += cycleTime;
    }
  }

  private scheduleJitterUpdates(injection: ActiveLatencyInjection): void {
    const updateInterval = 100; // Update jitter every 100ms
    const updates = Math.floor(injection.config.duration / updateInterval);

    for (let i = 0; i < updates; i++) {
      const updateTime = injection.startTime + (i * updateInterval);
      
      this.eventScheduler.scheduleEvent({
        id: `jitter_update_${injection.id}_${i}`,
        timestamp: updateTime,
        type: 'failure_injection',
        componentId: injection.connectionId,
        data: {
          action: 'update_jitter',
          injectionId: injection.id
        }
      });
    }
  }

  private calculateInjectionLatency(injection: ActiveLatencyInjection, currentTime: number): number {
    if (!injection.isActive || currentTime < injection.startTime || currentTime > injection.endTime) {
      return 0;
    }

    switch (injection.type) {
      case 'constant':
        return injection.config.baseLatencyIncrease;
      
      case 'gradual':
        const elapsed = currentTime - injection.startTime;
        const rate = injection.config.parameters.gradualRate || 0;
        const maxLatency = injection.config.parameters.maxLatency || 10000;
        return Math.min(injection.config.baseLatencyIncrease + (elapsed / 1000) * rate, maxLatency);
      
      case 'intermittent':
        // This would be controlled by scheduled events
        return injection.currentLatencyIncrease;
      
      default:
        return injection.config.baseLatencyIncrease;
    }
  }

  private calculateSpikeLatency(connectionId: string, currentTime: number): number {
    let spikeLatency = 0;

    for (const spike of this.spikeEvents.values()) {
      if (spike.connectionId === connectionId && 
          currentTime >= spike.startTime && 
          currentTime <= spike.endTime) {
        spikeLatency += spike.spikeLatency;
      }
    }

    return spikeLatency;
  }

  private calculateJitter(connectionState: ConnectionLatencyState): number {
    const jitterState = connectionState.jitterState;
    if (jitterState.range === 0) return 0;

    let jitter = 0;

    switch (jitterState.distribution) {
      case 'uniform':
        jitter = (Math.random() - 0.5) * 2 * jitterState.range;
        break;
      case 'normal':
        jitter = this.generateNormalRandom() * jitterState.range;
        break;
      case 'exponential':
        jitter = this.generateExponentialRandom() * jitterState.range;
        break;
    }

    jitterState.currentJitter = jitter;
    jitterState.jitterHistory.push(jitter);
    
    // Keep only last 100 jitter values
    if (jitterState.jitterHistory.length > 100) {
      jitterState.jitterHistory = jitterState.jitterHistory.slice(-100);
    }

    return jitter;
  }

  private shouldDropPacket(connectionState: ConnectionLatencyState): boolean {
    return Math.random() < connectionState.packetLossRate;
  }

  private handlePacketLoss(connectionState: ConnectionLatencyState, requestId: string): number {
    const retransmissionDelay = 1000; // Default 1 second
    const maxRetransmissions = 3;
    
    // Simulate retransmission attempts
    let retransmissions = 0;
    let totalDelay = 0;

    while (retransmissions < maxRetransmissions && this.shouldDropPacket(connectionState)) {
      retransmissions++;
      totalDelay += retransmissionDelay * Math.pow(2, retransmissions - 1); // Exponential backoff
    }

    return totalDelay;
  }

  private updateConnectionLatency(connectionId: string): void {
    const connectionState = this.connectionStates.get(connectionId);
    if (!connectionState) return;

    let totalAdditionalLatency = 0;

    for (const injectionId of connectionState.activeInjections) {
      const injection = this.activeInjections.get(injectionId);
      if (injection && injection.isActive) {
        totalAdditionalLatency += injection.currentLatencyIncrease;
      }
    }

    connectionState.currentAdditionalLatency = totalAdditionalLatency;
  }

  private updateInjectionStatistics(connectionState: ConnectionLatencyState, measurement: LatencyMeasurement): void {
    for (const injectionId of connectionState.activeInjections) {
      const injection = this.activeInjections.get(injectionId);
      if (!injection) continue;

      injection.statistics.totalRequests++;
      
      if (measurement.injectionContribution > 0) {
        injection.statistics.affectedRequests++;
        injection.statistics.averageLatencyIncrease = 
          (injection.statistics.averageLatencyIncrease * (injection.statistics.affectedRequests - 1) + 
           measurement.injectionContribution) / injection.statistics.affectedRequests;
        injection.statistics.maxLatencyIncrease = 
          Math.max(injection.statistics.maxLatencyIncrease, measurement.injectionContribution);
      }

      if (measurement.packetLoss) {
        injection.statistics.packetLossCount++;
      }

      injection.statistics.retransmissionCount += measurement.retransmissions;
    }
  }

  private generateNormalRandom(): number {
    // Box-Muller transform for normal distribution
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  private generateExponentialRandom(): number {
    return -Math.log(1 - Math.random());
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }
}