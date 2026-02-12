/**
 * Traffic Generation Engine implementing SRS FR-4.1
 * 
 * Implements user count and QPS configuration per SRS FR-4.1
 * Creates traffic pattern generation (steady, bursty) per SRS FR-4.1
 * Adds realistic user behavior modeling per SRS FR-4.1
 */

import { EventScheduler, SimulationEvent } from './types';

// Traffic generation configuration interfaces
export interface TrafficGenerationConfig {
  userCount: number;
  qpsTarget: number;
  pattern: TrafficPatternType;
  duration: number; // simulation duration in seconds
  userBehavior: UserBehaviorConfig;
}

export type TrafficPatternType = 'steady' | 'bursty' | 'realistic' | 'ramp-up' | 'spike';

export interface UserBehaviorConfig {
  sessionDuration: number; // average session duration in seconds
  requestsPerSession: number; // average requests per user session
  thinkTime: number; // average time between requests in seconds
  retryProbability: number; // probability of retrying failed requests (0-1)
  abandonmentRate: number; // probability of abandoning after failure (0-1)
  concurrencyFactor: number; // how many concurrent sessions per user (0-1)
}

export interface TrafficBurstConfig {
  intensity: number; // burst intensity multiplier (1.0 = normal, 2.0 = double traffic)
  duration: number; // burst duration in seconds
  frequency: number; // average time between bursts in seconds
  pattern: 'spike' | 'plateau' | 'wave';
}

export interface TrafficRampConfig {
  startMultiplier: number; // starting traffic multiplier
  endMultiplier: number; // ending traffic multiplier
  rampDuration: number; // duration of ramp in seconds
  curve: 'linear' | 'exponential' | 'logarithmic';
}

export interface RealisticTrafficConfig {
  dailyPattern: number[]; // 24-hour multipliers (0-2.0)
  weeklyPattern: number[]; // 7-day multipliers (0-2.0)
  seasonalVariation: number; // seasonal variation factor (0-1)
  flashCrowdProbability: number; // probability of flash crowd events
  maintenanceWindows: MaintenanceWindow[];
}

export interface MaintenanceWindow {
  startHour: number; // hour of day (0-23)
  duration: number; // duration in hours
  trafficReduction: number; // traffic reduction factor (0-1)
}

export interface GeneratedTrafficEvent {
  id: string;
  timestamp: number;
  userId: string;
  sessionId: string;
  requestType: 'initial' | 'follow-up' | 'retry';
  expectedLatency: number;
  priority: 'low' | 'normal' | 'high';
}

/**
 * Traffic Generation Engine
 * Implements SRS FR-4.1 requirements for traffic generation
 */
export class TrafficGenerationEngine {
  private eventScheduler: EventScheduler;
  private config: TrafficGenerationConfig | null = null;
  private activeUsers: Map<string, UserSession>;
  private trafficEvents: GeneratedTrafficEvent[];
  private currentTime: number;
  private requestCounter: number;

  constructor(eventScheduler: EventScheduler) {
    this.eventScheduler = eventScheduler;
    this.activeUsers = new Map();
    this.trafficEvents = [];
    this.currentTime = 0;
    this.requestCounter = 0;
  }

  /**
   * Initialize traffic generation with configuration
   * Implements SRS FR-4.1: User count and QPS configuration
   */
  initializeTrafficGeneration(config: TrafficGenerationConfig): void {
    this.config = config;
    this.activeUsers.clear();
    this.trafficEvents = [];
    this.requestCounter = 0;

    if (!this.config) {
      throw new Error('Traffic generation configuration is required');
    }

    // Generate traffic events based on pattern type
    switch (config.pattern) {
      case 'steady':
        this.generateSteadyTraffic();
        break;
      case 'bursty':
        this.generateBurstyTraffic();
        break;
      case 'realistic':
        this.generateRealisticTraffic();
        break;
      case 'ramp-up':
        this.generateRampUpTraffic();
        break;
      case 'spike':
        this.generateSpikeTraffic();
        break;
    }

    // Schedule all generated events
    this.scheduleTrafficEvents();
  }

  /**
   * Generate steady traffic pattern
   * Implements SRS FR-4.1: Steady traffic pattern generation
   */
  private generateSteadyTraffic(): void {
    if (!this.config) return;
    
    const { userCount, qpsTarget, duration, userBehavior } = this.config;
    
    // Calculate requests per user to achieve target QPS
    const totalRequests = qpsTarget * duration;
    const requestsPerUser = Math.ceil(totalRequests / userCount);
    
    // Generate user sessions
    for (let userId = 0; userId < userCount; userId++) {
      const userSession = this.createUserSession(`user_${userId}`, userBehavior);
      this.activeUsers.set(userSession.userId, userSession);
      
      // Generate requests for this user
      this.generateUserRequests(userSession, requestsPerUser, duration);
    }
  }

  /**
   * Generate bursty traffic pattern
   * Implements SRS FR-4.1: Bursty traffic pattern generation
   */
  private generateBurstyTraffic(): void {
    if (!this.config) return;
    
    const { userCount, qpsTarget, duration } = this.config;
    
    // Define burst configuration
    const burstConfig: TrafficBurstConfig = {
      intensity: 3.0, // 3x normal traffic during bursts
      duration: 30, // 30-second bursts
      frequency: 300, // burst every 5 minutes
      pattern: 'spike'
    };

    // Calculate base traffic level (lower than target to accommodate bursts)
    const baseQPS = qpsTarget * 0.4; // 40% of target during normal periods
    const burstQPS = qpsTarget * burstConfig.intensity;

    // Generate burst schedule
    const bursts = this.generateBurstSchedule(duration, burstConfig);
    
    // Generate traffic with bursts
    for (let second = 0; second < duration; second++) {
      const isBurstPeriod = bursts.some(burst => 
        second >= burst.startTime && second < burst.startTime + burst.duration
      );
      
      const currentQPS = isBurstPeriod ? burstQPS : baseQPS;
      const usersActiveThisSecond = Math.min(userCount, Math.ceil(currentQPS / 2));
      
      // Generate requests for active users this second
      for (let i = 0; i < usersActiveThisSecond; i++) {
        const userId = `user_${i % userCount}`;
        const requestsThisSecond = Math.ceil(currentQPS / usersActiveThisSecond);
        
        for (let req = 0; req < requestsThisSecond; req++) {
          const timestamp = second * 1000 + (req / requestsThisSecond) * 1000;
          this.generateTrafficEvent(userId, timestamp, 'initial');
        }
      }
    }
  }

  /**
   * Generate realistic traffic pattern
   * Implements SRS FR-4.1: Realistic user behavior modeling
   */
  private generateRealisticTraffic(): void {
    if (!this.config) return;
    
    const { userCount, qpsTarget, duration } = this.config;
    
    // Default realistic traffic configuration
    const realisticConfig: RealisticTrafficConfig = {
      dailyPattern: this.getDefaultDailyPattern(),
      weeklyPattern: this.getDefaultWeeklyPattern(),
      seasonalVariation: 0.2,
      flashCrowdProbability: 0.001, // 0.1% chance per minute
      maintenanceWindows: [
        { startHour: 2, duration: 2, trafficReduction: 0.3 } // 2-4 AM maintenance
      ]
    };

    // Generate traffic with realistic patterns
    for (let second = 0; second < duration; second++) {
      const timeOfDay = (second / 3600) % 24; // hour of day
      const dayOfWeek = Math.floor(second / (24 * 3600)) % 7;
      
      // Calculate traffic multipliers
      const dailyMultiplier = this.interpolatePattern(realisticConfig.dailyPattern, timeOfDay);
      const weeklyMultiplier = realisticConfig.weeklyPattern[dayOfWeek];
      const maintenanceMultiplier = this.getMaintenanceMultiplier(timeOfDay, realisticConfig.maintenanceWindows);
      
      // Check for flash crowd events
      const flashCrowdMultiplier = Math.random() < realisticConfig.flashCrowdProbability ? 5.0 : 1.0;
      
      const totalMultiplier = dailyMultiplier * weeklyMultiplier * maintenanceMultiplier * flashCrowdMultiplier;
      const currentQPS = qpsTarget * totalMultiplier;
      
      // Generate user sessions for this second
      this.generateRealisticUserSessions(second * 1000, currentQPS, userCount);
    }
  }

  /**
   * Generate ramp-up traffic pattern
   */
  private generateRampUpTraffic(): void {
    if (!this.config) return;
    
    const { userCount, qpsTarget, duration } = this.config;
    
    const rampConfig: TrafficRampConfig = {
      startMultiplier: 0.1, // Start at 10% of target
      endMultiplier: 2.0,   // End at 200% of target
      rampDuration: duration,
      curve: 'exponential'
    };

    for (let second = 0; second < duration; second++) {
      const progress = second / duration;
      let multiplier: number;
      
      switch (rampConfig.curve) {
        case 'exponential':
          multiplier = rampConfig.startMultiplier + 
            (rampConfig.endMultiplier - rampConfig.startMultiplier) * Math.pow(progress, 2);
          break;
        case 'logarithmic':
          multiplier = rampConfig.startMultiplier + 
            (rampConfig.endMultiplier - rampConfig.startMultiplier) * Math.sqrt(progress);
          break;
        default: // linear
          multiplier = rampConfig.startMultiplier + 
            (rampConfig.endMultiplier - rampConfig.startMultiplier) * progress;
      }
      
      const currentQPS = qpsTarget * multiplier;
      this.generateTrafficForSecond(second * 1000, currentQPS, userCount);
    }
  }

  /**
   * Generate spike traffic pattern
   */
  private generateSpikeTraffic(): void {
    if (!this.config) return;
    
    const { userCount, qpsTarget, duration } = this.config;
    
    // Generate base traffic at 50% of target
    const baseQPS = qpsTarget * 0.5;
    
    // Generate 3 major spikes during the simulation
    const spikeCount = 3;
    const spikeDuration = 60; // 60 seconds per spike
    const spikeIntensity = 5.0; // 5x normal traffic
    
    const spikes = [];
    for (let i = 0; i < spikeCount; i++) {
      const spikeStart = (duration / (spikeCount + 1)) * (i + 1);
      spikes.push({
        startTime: spikeStart,
        duration: spikeDuration,
        intensity: spikeIntensity
      });
    }

    for (let second = 0; second < duration; second++) {
      const isSpikePeriod = spikes.some(spike => 
        second >= spike.startTime && second < spike.startTime + spike.duration
      );
      
      const currentQPS = isSpikePeriod ? qpsTarget * spikeIntensity : baseQPS;
      this.generateTrafficForSecond(second * 1000, currentQPS, userCount);
    }
  }

  /**
   * Create a user session with realistic behavior
   */
  private createUserSession(userId: string, userBehavior: UserBehaviorConfig): UserSession {
    return {
      userId,
      sessionId: `session_${userId}_${Date.now()}`,
      startTime: this.currentTime,
      duration: this.sampleFromDistribution(userBehavior.sessionDuration, 0.3),
      requestsRemaining: this.sampleFromDistribution(userBehavior.requestsPerSession, 0.4),
      thinkTime: userBehavior.thinkTime,
      retryProbability: userBehavior.retryProbability,
      abandonmentRate: userBehavior.abandonmentRate,
      isActive: true,
      lastRequestTime: 0
    };
  }

  /**
   * Generate requests for a specific user session
   */
  private generateUserRequests(userSession: UserSession, maxRequests: number, duration: number): void {
    const requestCount = Math.min(maxRequests, userSession.requestsRemaining);
    const sessionDuration = Math.min(userSession.duration, duration * 1000);
    
    let currentTime = userSession.startTime;
    
    for (let i = 0; i < requestCount; i++) {
      // Add think time between requests
      if (i > 0) {
        currentTime += this.sampleFromDistribution(userSession.thinkTime * 1000, 0.5);
      }
      
      // Check if we're still within session duration
      if (currentTime - userSession.startTime > sessionDuration) {
        break;
      }
      
      this.generateTrafficEvent(userSession.userId, currentTime, 'initial');
      userSession.lastRequestTime = currentTime;
    }
  }

  /**
   * Generate a traffic event
   */
  private generateTrafficEvent(userId: string, timestamp: number, requestType: 'initial' | 'follow-up' | 'retry'): void {
    const event: GeneratedTrafficEvent = {
      id: `req_${this.requestCounter++}`,
      timestamp,
      userId,
      sessionId: `session_${userId}`,
      requestType,
      expectedLatency: this.calculateExpectedLatency(requestType),
      priority: this.calculateRequestPriority(requestType)
    };
    
    this.trafficEvents.push(event);
  }

  /**
   * Generate traffic for a specific second
   */
  private generateTrafficForSecond(timestamp: number, qps: number, userCount: number): void {
    const requestsThisSecond = Math.round(qps);
    const activeUsers = Math.min(userCount, Math.ceil(requestsThisSecond / 2));
    
    for (let i = 0; i < requestsThisSecond; i++) {
      const userId = `user_${i % activeUsers}`;
      const requestTimestamp = timestamp + (i / requestsThisSecond) * 1000;
      this.generateTrafficEvent(userId, requestTimestamp, 'initial');
    }
  }

  /**
   * Generate realistic user sessions for a given second
   */
  private generateRealisticUserSessions(timestamp: number, qps: number, userCount: number): void {
    if (!this.config) return;
    
    const { userBehavior } = this.config;
    const requestsThisSecond = Math.round(qps);
    
    // Determine how many users should be active
    const activeUserRatio = Math.min(1.0, qps / (userCount * userBehavior.concurrencyFactor));
    const activeUsers = Math.ceil(userCount * activeUserRatio);
    
    // Distribute requests among active users
    for (let i = 0; i < requestsThisSecond; i++) {
      const userId = `user_${i % activeUsers}`;
      const requestTimestamp = timestamp + (i / requestsThisSecond) * 1000;
      
      // Determine request type based on user behavior
      const requestType = this.determineRequestType(userId);
      this.generateTrafficEvent(userId, requestTimestamp, requestType);
    }
  }

  /**
   * Schedule all generated traffic events
   */
  private scheduleTrafficEvents(): void {
    this.trafficEvents.forEach(event => {
      this.eventScheduler.scheduleEvent({
        id: event.id,
        timestamp: event.timestamp,
        type: 'request_arrival',
        componentId: 'traffic_generator',
        data: {
          userId: event.userId,
          sessionId: event.sessionId,
          requestType: event.requestType,
          expectedLatency: event.expectedLatency,
          priority: event.priority
        }
      });
    });
  }

  /**
   * Helper methods
   */
  private sampleFromDistribution(mean: number, variance: number): number {
    // Simple normal distribution approximation
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return Math.max(0, mean + z0 * mean * variance);
  }

  private calculateExpectedLatency(requestType: 'initial' | 'follow-up' | 'retry'): number {
    const baseLatency = 100; // 100ms base latency
    switch (requestType) {
      case 'initial': return baseLatency;
      case 'follow-up': return baseLatency * 0.8; // Cached responses
      case 'retry': return baseLatency * 1.5; // Retries take longer
    }
  }

  private calculateRequestPriority(requestType: 'initial' | 'follow-up' | 'retry'): 'low' | 'normal' | 'high' {
    switch (requestType) {
      case 'initial': return 'normal';
      case 'follow-up': return 'high'; // User is engaged
      case 'retry': return 'low'; // Already failed once
    }
  }

  private determineRequestType(userId: string): 'initial' | 'follow-up' | 'retry' {
    const userSession = this.activeUsers.get(userId);
    if (!userSession) return 'initial';
    
    // 70% initial, 25% follow-up, 5% retry
    const rand = Math.random();
    if (rand < 0.7) return 'initial';
    if (rand < 0.95) return 'follow-up';
    return 'retry';
  }

  private getDefaultDailyPattern(): number[] {
    // 24-hour pattern with peaks at 9-11 AM, 2-4 PM, 7-9 PM
    return [
      0.3, 0.2, 0.2, 0.2, 0.3, 0.4, // 12-6 AM
      0.6, 0.8, 1.0, 1.3, 1.2, 0.9, // 6 AM-12 PM
      0.8, 1.0, 1.4, 1.3, 1.0, 0.9, // 12-6 PM
      1.1, 1.3, 1.2, 0.9, 0.7, 0.5  // 6 PM-12 AM
    ];
  }

  private getDefaultWeeklyPattern(): number[] {
    // Monday=0, Sunday=6. Higher traffic on weekdays
    return [1.2, 1.3, 1.2, 1.1, 1.0, 0.8, 0.7];
  }

  private interpolatePattern(pattern: number[], time: number): number {
    const index = time % pattern.length;
    const lowerIndex = Math.floor(index);
    const upperIndex = (lowerIndex + 1) % pattern.length;
    const fraction = index - lowerIndex;
    
    return pattern[lowerIndex] * (1 - fraction) + pattern[upperIndex] * fraction;
  }

  private getMaintenanceMultiplier(timeOfDay: number, windows: MaintenanceWindow[]): number {
    for (const window of windows) {
      if (timeOfDay >= window.startHour && timeOfDay < window.startHour + window.duration) {
        return 1.0 - window.trafficReduction;
      }
    }
    return 1.0;
  }

  private generateBurstSchedule(duration: number, config: TrafficBurstConfig): Array<{startTime: number, duration: number}> {
    const bursts = [];
    let currentTime = config.frequency;
    
    while (currentTime < duration - config.duration) {
      bursts.push({
        startTime: currentTime,
        duration: config.duration
      });
      
      // Add some randomness to burst timing
      currentTime += config.frequency * (0.8 + Math.random() * 0.4);
    }
    
    return bursts;
  }

  /**
   * Get generated traffic statistics
   */
  getTrafficStatistics(): TrafficStatistics {
    const totalEvents = this.trafficEvents.length;
    const uniqueUsers = new Set(this.trafficEvents.map(e => e.userId)).size;
    const uniqueSessions = new Set(this.trafficEvents.map(e => e.sessionId)).size;
    
    const requestTypes = this.trafficEvents.reduce((acc, event) => {
      acc[event.requestType] = (acc[event.requestType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalRequests: totalEvents,
      uniqueUsers,
      uniqueSessions,
      requestTypeDistribution: requestTypes,
      averageQPS: totalEvents / (this.config?.duration || 1),
      peakQPS: this.calculatePeakQPS(),
      pattern: this.config?.pattern || 'steady'
    };
  }

  private calculatePeakQPS(): number {
    // Group events by second and find peak
    const requestsPerSecond = new Map<number, number>();
    
    this.trafficEvents.forEach(event => {
      const second = Math.floor(event.timestamp / 1000);
      requestsPerSecond.set(second, (requestsPerSecond.get(second) || 0) + 1);
    });
    
    return Math.max(...Array.from(requestsPerSecond.values()));
  }
}

// Supporting interfaces
interface UserSession {
  userId: string;
  sessionId: string;
  startTime: number;
  duration: number;
  requestsRemaining: number;
  thinkTime: number;
  retryProbability: number;
  abandonmentRate: number;
  isActive: boolean;
  lastRequestTime: number;
}

export interface TrafficStatistics {
  totalRequests: number;
  uniqueUsers: number;
  uniqueSessions: number;
  requestTypeDistribution: Record<string, number>;
  averageQPS: number;
  peakQPS: number;
  pattern: TrafficPatternType;
}