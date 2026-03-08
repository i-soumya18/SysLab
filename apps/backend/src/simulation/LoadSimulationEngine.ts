/**
 * Load Simulation Engine with Queueing Theory
 * 
 * Implements realistic load simulation that models actual traffic patterns and queueing behavior
 * using Poisson arrival processes, backpressure propagation, and queueing theory calculations.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { EventScheduler, SimulationEvent } from './types';
import { SystemGraphEngine, SystemGraphNode, SystemComponentType } from './SystemGraphEngine';
import { LoadPattern, ComponentType } from '../types';

export interface PoissonProcess {
  lambda: number; // arrival rate (requests per second)
  lastArrival: number;
  nextArrival: number;
}

export interface QueueState {
  componentId: string;
  queueLength: number;
  maxCapacity: number;
  serviceRate: number; // mu (requests per second)
  serverCount: number; // c (number of servers)
  waitTime: number;
  utilization: number;
  droppedRequests: number;
  circuitBreakerOpen: boolean;
}

export interface BackpressureState {
  componentId: string;
  upstreamComponents: string[];
  downstreamComponents: string[];
  backpressureLevel: number; // 0-1 (0 = no backpressure, 1 = full backpressure)
  throttleRate: number; // multiplier for incoming requests (0-1)
}

export interface LoadSimulationResult {
  timestamp: number;
  totalRequests: number;
  activeRequests: number;
  completedRequests: number;
  droppedRequests: number;
  averageLatency: number;
  queueStates: Map<string, QueueState>;
  backpressureStates: Map<string, BackpressureState>;
}

export interface TrafficBurst {
  startTime: number;
  duration: number;
  multiplier: number; // traffic multiplier during burst
  pattern?: 'spike' | 'plateau' | 'wave'; // burst shape
}

export interface GradualRampUp {
  startTime: number;
  duration: number;
  startMultiplier: number;
  endMultiplier: number;
  curve?: 'linear' | 'exponential' | 'logarithmic'; // ramp curve type
}

export interface RealisticUserBehavior {
  dailyPattern: number[]; // 24-hour traffic pattern (0-1 multipliers)
  weeklyPattern: number[]; // 7-day traffic pattern (0-1 multipliers)
  seasonalEvents: SeasonalEvent[];
  userSessionDuration: number; // average session duration in seconds
  concurrentSessionRatio: number; // ratio of concurrent to total users
  retryBehavior: RetryBehavior;
}

export interface SeasonalEvent {
  name: string;
  startDate: Date;
  endDate: Date;
  trafficMultiplier: number;
  pattern: 'gradual' | 'sudden' | 'wave';
}

export interface RetryBehavior {
  maxRetries: number;
  backoffMultiplier: number;
  retryProbability: number; // probability user retries after failure
}

export interface GeographicDistribution {
  regions: GeographicRegion[];
  timeZoneOffsets: number[]; // hours offset from UTC
  latencyMatrix: number[][]; // inter-region latency matrix
  loadBalancing: 'round-robin' | 'geographic' | 'latency-based';
}

export interface GeographicRegion {
  id: string;
  name: string;
  userPercentage: number; // percentage of total users in this region
  peakHours: number[]; // peak traffic hours (0-23)
  baseLatency: number; // base latency for this region in ms
  networkQuality: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface TrafficPattern {
  id: string;
  name: string;
  type: 'burst' | 'ramp' | 'realistic' | 'geographic' | 'seasonal';
  configuration: TrafficBurst | GradualRampUp | RealisticUserBehavior | GeographicDistribution;
  isActive: boolean;
  priority: number; // higher priority patterns override lower ones
}

/**
 * Load Simulation Engine implementing queueing theory and backpressure propagation
 */
export class LoadSimulationEngine {
  private systemGraph: SystemGraphEngine;
  private eventScheduler: EventScheduler;
  private poissonProcesses: Map<string, PoissonProcess>;
  private queueStates: Map<string, QueueState>;
  private backpressureStates: Map<string, BackpressureState>;
  private currentTime: number;
  private requestCounter: number;
  private activeRequests: Map<string, number>; // requestId -> startTime
  private completedRequests: number;
  private totalDroppedRequests: number;
  
  // Enhanced traffic pattern management
  private activeTrafficPatterns: Map<string, TrafficPattern>;
  private realisticUserBehavior?: RealisticUserBehavior;
  private geographicDistribution?: GeographicDistribution;
  private currentLoadMultiplier: number;
  private baseArrivalRates: Map<string, number>; // store original rates

  constructor(systemGraph: SystemGraphEngine, eventScheduler: EventScheduler) {
    this.systemGraph = systemGraph;
    this.eventScheduler = eventScheduler;
    this.poissonProcesses = new Map();
    this.queueStates = new Map();
    this.backpressureStates = new Map();
    this.currentTime = 0;
    this.requestCounter = 0;
    this.activeRequests = new Map();
    this.completedRequests = 0;
    this.totalDroppedRequests = 0;
    
    // Initialize enhanced traffic pattern management
    this.activeTrafficPatterns = new Map();
    this.currentLoadMultiplier = 1.0;
    this.baseArrivalRates = new Map();
  }

  /**
   * Initialize load simulation with Poisson arrival processes
   * Requirement 7.1: Generate traffic using Poisson arrival processes with configurable lambda values
   */
  initializeLoadSimulation(loadPattern: LoadPattern, userScale: number): void {
    // Calculate lambda (arrival rate) based on user scale and load pattern
    const baseArrivalRate = this.calculateArrivalRate(loadPattern.baseLoad, userScale);
    
    // Initialize Poisson processes for each entry point (components with no incoming edges)
    const entryComponents = this.systemGraph.getAllComponents().filter(component => 
      component.incomingEdges.length === 0
    );
    
    // If no entry points found, use the first component as entry point
    const effectiveEntryComponents = entryComponents.length > 0 ? entryComponents : 
      this.systemGraph.getAllComponents().slice(0, 1);
    
    effectiveEntryComponents.forEach(component => {
      // Distribute load across entry components
      const componentLambda = baseArrivalRate / effectiveEntryComponents.length;
      
      // Store base arrival rate for traffic pattern modifications
      this.baseArrivalRates.set(component.id, componentLambda);
      
      this.poissonProcesses.set(component.id, {
        lambda: componentLambda,
        lastArrival: 0,
        nextArrival: this.generateNextPoissonArrival(componentLambda, 0)
      });
    });

    // Initialize queue states for all components
    this.initializeQueueStates();
    
    // Initialize backpressure states
    this.initializeBackpressureStates();
  }

  /**
   * Calculate arrival rate based on user scale
   * Maps user scale (1, 1K, 1M, 1B) to realistic request rates
   */
  private calculateArrivalRate(baseLoad: number, userScale: number): number {
    // Scale factors for different user counts
    const scaleFactors: Record<number, number> = {
      1: 0.001,        // 1 user
      1000: 1,         // 1K users
      1000000: 1000,   // 1M users  
      1000000000: 1000000 // 1B users
    };

    // Find the closest scale factor
    const scales = Object.keys(scaleFactors).map(Number).sort((a, b) => a - b);
    let scaleFactor = scaleFactors[1000]; // default to 1K

    for (const scale of scales) {
      if (userScale >= scale) {
        scaleFactor = scaleFactors[scale];
      }
    }

    return baseLoad * scaleFactor;
  }

  /**
   * Initialize queue states for all components
   * Requirement 7.3: Implement queueing theory calculations (M/M/1, M/M/c queues)
   */
  private initializeQueueStates(): void {
    const allComponents = this.systemGraph.getAllComponents();
    
    allComponents.forEach(component => {
      const queueCapacity = this.getComponentQueueCapacity(component.type);
      const serviceRate = this.getComponentServiceRate(component.type, component.component.configuration);
      const serverCount = this.getComponentServerCount(component.type, component.component.configuration);

      this.queueStates.set(component.id, {
        componentId: component.id,
        queueLength: 0,
        maxCapacity: queueCapacity,
        serviceRate: serviceRate,
        serverCount: serverCount,
        waitTime: 0,
        utilization: 0,
        droppedRequests: 0,
        circuitBreakerOpen: false
      });
    });
  }

  /**
   * Initialize backpressure states for all components
   * Requirement 7.2: Model backpressure propagation through the system graph
   */
  private initializeBackpressureStates(): void {
    const allComponents = this.systemGraph.getAllComponents();
    
    allComponents.forEach(component => {
      const upstreamComponents = this.systemGraph.getUpstreamComponents(component.id);
      const downstreamComponents = this.systemGraph.getDownstreamComponents(component.id);

      this.backpressureStates.set(component.id, {
        componentId: component.id,
        upstreamComponents: upstreamComponents.map(c => c.id),
        downstreamComponents: downstreamComponents.map(c => c.id),
        backpressureLevel: 0,
        throttleRate: 1.0
      });
    });
  }

  /**
   * Generate next Poisson arrival time
   * Uses exponential distribution: -ln(U) / lambda where U is uniform random [0,1]
   */
  private generateNextPoissonArrival(lambda: number, currentTime: number): number {
    const u = Math.random();
    const interArrivalTime = -Math.log(u) / lambda;
    return currentTime + interArrivalTime;
  }

  /**
   * Process simulation step
   */
  step(deltaTime: number): LoadSimulationResult {
    this.currentTime += deltaTime;

    // Process scheduled events (including load changes)
    this.processScheduledEvents();

    // Process Poisson arrivals
    this.processArrivals();

    // Process queue operations
    this.processQueues();

    // Update backpressure propagation
    this.updateBackpressure();

    // Process circuit breakers
    this.processCircuitBreakers();

    return this.generateSimulationResult();
  }

  /**
   * Process scheduled events from the event scheduler
   */
  private processScheduledEvents(): void {
    while (this.eventScheduler.hasEvents()) {
      const nextEvent = this.eventScheduler.getNextEvent();
      if (!nextEvent || nextEvent.timestamp > this.currentTime) {
        break;
      }

      switch (nextEvent.type) {
        case 'load_change':
          this.processLoadChangeEvent(nextEvent);
          break;
        case 'request_arrival':
          // Handle retry requests
          if (nextEvent.data.retryAttempt) {
            this.handleRetryRequest(nextEvent);
          }
          break;
        case 'recovery_check':
          this.handleRecoveryCheck(nextEvent);
          break;
      }
    }
  }

  /**
   * Handle retry request processing
   */
  private handleRetryRequest(event: SimulationEvent): void {
    const { requestId, originalRequestId } = event.data;
    
    // Process retry request similar to normal arrival
    const queueState = this.queueStates.get(event.componentId);
    if (queueState && !queueState.circuitBreakerOpen) {
      queueState.queueLength++;
      this.activeRequests.set(requestId, event.timestamp);
    } else {
      // Retry also failed
      this.totalDroppedRequests++;
    }
  }

  /**
   * Handle recovery check events
   */
  private handleRecoveryCheck(event: SimulationEvent): void {
    const queueState = this.queueStates.get(event.componentId);
    if (queueState && event.data.type === 'circuit_breaker') {
      // Check if circuit breaker should close
      if (queueState.queueLength < queueState.maxCapacity * 0.3) {
        queueState.circuitBreakerOpen = false;
        queueState.droppedRequests = 0;
      } else {
        // Schedule another recovery check
        this.eventScheduler.scheduleEvent({
          id: `circuit_breaker_check_${event.componentId}_${Date.now()}`,
          timestamp: this.currentTime + 30000,
          type: 'recovery_check',
          componentId: event.componentId,
          data: { type: 'circuit_breaker' }
        });
      }
    }
  }

  /**
   * Process Poisson arrivals for all entry points
   */
  private processArrivals(): void {
    this.poissonProcesses.forEach((process, componentId) => {
      while (process.nextArrival <= this.currentTime) {
        // Generate request arrival
        const requestId = `req_${this.requestCounter++}`;
        
        // Check if component can accept the request (backpressure)
        const backpressure = this.backpressureStates.get(componentId);
        if (backpressure && Math.random() > backpressure.throttleRate) {
          // Request throttled due to backpressure
          this.totalDroppedRequests++;
        } else {
          // Schedule request arrival event
          this.eventScheduler.scheduleEvent({
            id: `arrival_${requestId}`,
            timestamp: process.nextArrival,
            type: 'request_arrival',
            componentId: componentId,
            data: { requestId, arrivalTime: process.nextArrival }
          });

          this.activeRequests.set(requestId, process.nextArrival);
        }

        // Generate next arrival
        process.lastArrival = process.nextArrival;
        process.nextArrival = this.generateNextPoissonArrival(process.lambda, process.lastArrival);
      }
    });
  }

  /**
   * Process queue operations using queueing theory
   * Requirement 7.3: Implement M/M/1 and M/M/c queue calculations
   */
  private processQueues(): void {
    this.queueStates.forEach((queueState, componentId) => {
      // Calculate queue metrics using queueing theory
      this.updateQueueMetrics(queueState);

      // Process service completions
      this.processServiceCompletions(queueState);

      // Check for queue overflow
      this.checkQueueOverflow(queueState);
    });
  }

  /**
   * Update queue metrics using queueing theory formulas
   */
  private updateQueueMetrics(queueState: QueueState): void {
    const rho = queueState.queueLength / (queueState.serviceRate * queueState.serverCount);
    queueState.utilization = Math.min(rho, 1.0);

    if (queueState.serverCount === 1) {
      // M/M/1 queue formulas
      if (rho < 1) {
        queueState.waitTime = rho / (queueState.serviceRate * (1 - rho));
      } else {
        queueState.waitTime = Number.POSITIVE_INFINITY;
      }
    } else {
      // M/M/c queue formulas (Erlang-C)
      const c = queueState.serverCount;
      const lambda = queueState.queueLength * queueState.serviceRate / Math.max(queueState.queueLength, 1);
      
      if (rho < c) {
        const erlangC = this.calculateErlangC(lambda, queueState.serviceRate, c);
        queueState.waitTime = erlangC / (c * queueState.serviceRate - lambda);
      } else {
        queueState.waitTime = Number.POSITIVE_INFINITY;
      }
    }
  }

  /**
   * Calculate Erlang-C formula for M/M/c queues
   */
  private calculateErlangC(lambda: number, mu: number, c: number): number {
    const rho = lambda / mu;
    const rhoC = Math.pow(rho, c);
    const cFactorial = this.factorial(c);
    
    let sum = 0;
    for (let k = 0; k < c; k++) {
      sum += Math.pow(rho, k) / this.factorial(k);
    }
    
    const numerator = rhoC / cFactorial;
    const denominator = sum + (rhoC / cFactorial) * (c / (c - rho));
    
    return numerator / denominator;
  }

  /**
   * Calculate factorial
   */
  private factorial(n: number): number {
    if (n <= 1) return 1;
    return n * this.factorial(n - 1);
  }

  /**
   * Process service completions
   */
  private processServiceCompletions(queueState: QueueState): void {
    if (queueState.queueLength > 0 && !queueState.circuitBreakerOpen) {
      const serviceTime = 1 / queueState.serviceRate;
      const completionProbability = Math.min(1.0, serviceTime / 1000); // per millisecond
      
      if (Math.random() < completionProbability) {
        queueState.queueLength = Math.max(0, queueState.queueLength - 1);
        this.completedRequests++;
      }
    }
  }

  /**
   * Check for queue overflow and implement overflow behavior
   * Requirement 7.4: Model realistic overflow behavior (request dropping, circuit breaker activation)
   */
  private checkQueueOverflow(queueState: QueueState): void {
    if (queueState.queueLength >= queueState.maxCapacity) {
      // Queue is at capacity - drop new requests
      queueState.droppedRequests++;
      this.totalDroppedRequests++;

      // Check if circuit breaker should open
      const errorRate = queueState.droppedRequests / Math.max(queueState.queueLength + queueState.droppedRequests, 1);
      if (errorRate > 0.5 && queueState.queueLength > 10) {
        queueState.circuitBreakerOpen = true;
        
        // Schedule circuit breaker recovery check
        this.eventScheduler.scheduleEvent({
          id: `circuit_breaker_check_${queueState.componentId}`,
          timestamp: this.currentTime + 30000, // 30 seconds
          type: 'recovery_check',
          componentId: queueState.componentId,
          data: { type: 'circuit_breaker' }
        });
      }
    }
  }

  /**
   * Update backpressure propagation through the system graph
   * Requirement 7.2: Model backpressure propagation through system graph when components reach capacity limits
   */
  private updateBackpressure(): void {
    // Calculate backpressure levels based on queue states
    this.backpressureStates.forEach((backpressureState, componentId) => {
      const queueState = this.queueStates.get(componentId);
      if (!queueState) return;

      // Calculate local backpressure based on queue utilization
      const queueUtilization = queueState.queueLength / queueState.maxCapacity;
      backpressureState.backpressureLevel = Math.min(1.0, queueUtilization);

      // Calculate throttle rate (inverse of backpressure)
      backpressureState.throttleRate = Math.max(0.1, 1.0 - backpressureState.backpressureLevel * 0.8);
    });

    // Propagate backpressure upstream
    this.propagateBackpressureUpstream();
  }

  /**
   * Propagate backpressure to upstream components
   */
  private propagateBackpressureUpstream(): void {
    this.backpressureStates.forEach((backpressureState, componentId) => {
      if (backpressureState.backpressureLevel > 0.5) {
        // Propagate backpressure to upstream components
        backpressureState.upstreamComponents.forEach(upstreamId => {
          const upstreamBackpressure = this.backpressureStates.get(upstreamId);
          if (upstreamBackpressure) {
            // Increase upstream backpressure (but don't exceed current level)
            const propagatedPressure = backpressureState.backpressureLevel * 0.7;
            upstreamBackpressure.backpressureLevel = Math.max(
              upstreamBackpressure.backpressureLevel,
              propagatedPressure
            );
            upstreamBackpressure.throttleRate = Math.max(0.1, 1.0 - upstreamBackpressure.backpressureLevel * 0.8);
          }
        });
      }
    });
  }

  /**
   * Process circuit breakers
   */
  private processCircuitBreakers(): void {
    this.queueStates.forEach((queueState, componentId) => {
      if (queueState.circuitBreakerOpen) {
        // Check if circuit breaker should close (queue has recovered)
        if (queueState.queueLength < queueState.maxCapacity * 0.3) {
          queueState.circuitBreakerOpen = false;
          queueState.droppedRequests = 0; // Reset dropped requests counter
        }
      }
    });
  }

  /**
   * Add burst traffic pattern
   * Requirement 7.5: Provide burst traffic patterns and gradual ramp-up scenarios
   */
  addTrafficBurst(burst: TrafficBurst): void {
    this.eventScheduler.scheduleEvent({
      id: `burst_start_${Date.now()}`,
      timestamp: burst.startTime,
      type: 'load_change',
      componentId: 'system',
      data: { 
        type: 'burst_start',
        multiplier: burst.multiplier,
        duration: burst.duration
      }
    });

    this.eventScheduler.scheduleEvent({
      id: `burst_end_${Date.now()}`,
      timestamp: burst.startTime + burst.duration,
      type: 'load_change',
      componentId: 'system',
      data: { 
        type: 'burst_end',
        multiplier: 1.0
      }
    });
  }

  /**
   * Add gradual ramp-up scenario
   * Requirement 7.5: Provide gradual ramp-up scenarios
   */
  addGradualRampUp(rampUp: GradualRampUp): void {
    const steps = 10; // Number of ramp steps
    const stepDuration = rampUp.duration / steps;
    
    for (let i = 0; i <= steps; i++) {
      const stepTime = rampUp.startTime + i * stepDuration;
      let stepMultiplier: number;
      
      // Calculate multiplier based on curve type
      const progress = i / steps;
      switch (rampUp.curve || 'linear') {
        case 'exponential':
          stepMultiplier = rampUp.startMultiplier + 
            (rampUp.endMultiplier - rampUp.startMultiplier) * Math.pow(progress, 2);
          break;
        case 'logarithmic':
          stepMultiplier = rampUp.startMultiplier + 
            (rampUp.endMultiplier - rampUp.startMultiplier) * Math.sqrt(progress);
          break;
        default: // linear
          stepMultiplier = rampUp.startMultiplier + 
            (rampUp.endMultiplier - rampUp.startMultiplier) * progress;
      }

      this.eventScheduler.scheduleEvent({
        id: `ramp_step_${i}_${Date.now()}`,
        timestamp: stepTime,
        type: 'load_change',
        componentId: 'system',
        data: {
          type: 'ramp_step',
          multiplier: stepMultiplier
        }
      });
    }
  }

  /**
   * Enhanced burst traffic with different patterns
   * Requirement 7.5: Add burst traffic patterns
   */
  addEnhancedTrafficBurst(burst: TrafficBurst): void {
    const pattern = burst.pattern || 'spike';
    
    switch (pattern) {
      case 'spike':
        // Immediate spike to peak, then immediate drop
        this.scheduleLoadChange(burst.startTime, burst.multiplier);
        this.scheduleLoadChange(burst.startTime + burst.duration, 1.0);
        break;
        
      case 'plateau':
        // Gradual rise, plateau, gradual fall
        const riseTime = burst.duration * 0.2;
        const plateauTime = burst.duration * 0.6;
        const fallTime = burst.duration * 0.2;
        
        // Rise phase
        this.addGradualRampUp({
          startTime: burst.startTime,
          duration: riseTime,
          startMultiplier: 1.0,
          endMultiplier: burst.multiplier,
          curve: 'exponential'
        });
        
        // Fall phase
        this.addGradualRampUp({
          startTime: burst.startTime + riseTime + plateauTime,
          duration: fallTime,
          startMultiplier: burst.multiplier,
          endMultiplier: 1.0,
          curve: 'logarithmic'
        });
        break;
        
      case 'wave':
        // Sinusoidal wave pattern
        const waveSteps = 20;
        const stepDuration = burst.duration / waveSteps;
        
        for (let i = 0; i <= waveSteps; i++) {
          const stepTime = burst.startTime + i * stepDuration;
          const waveProgress = (i / waveSteps) * 2 * Math.PI;
          const waveMultiplier = 1.0 + (burst.multiplier - 1.0) * 
            (Math.sin(waveProgress) + 1) / 2;
          
          this.scheduleLoadChange(stepTime, waveMultiplier);
        }
        break;
    }
  }

  /**
   * Implement realistic user behavior modeling
   * Requirement 7.5: Create realistic user behavior modeling
   */
  setRealisticUserBehavior(behavior: RealisticUserBehavior): void {
    this.realisticUserBehavior = behavior;
    
    // Schedule daily pattern updates
    this.scheduleDailyPatternUpdates();
    
    // Schedule weekly pattern updates
    this.scheduleWeeklyPatternUpdates();
    
    // Schedule seasonal events
    behavior.seasonalEvents.forEach(event => {
      this.scheduleSeasonalEvent(event);
    });
  }

  /**
   * Schedule daily traffic pattern updates (24-hour cycle)
   */
  private scheduleDailyPatternUpdates(): void {
    if (!this.realisticUserBehavior) return;
    
    const hoursInDay = 24;
    const millisecondsPerHour = 60 * 60 * 1000;
    
    for (let hour = 0; hour < hoursInDay; hour++) {
      const hourMultiplier = this.realisticUserBehavior.dailyPattern[hour] || 1.0;
      
      // Schedule for current day and repeat daily
      const scheduleTime = this.currentTime + hour * millisecondsPerHour;
      
      this.eventScheduler.scheduleEvent({
        id: `daily_pattern_${hour}`,
        timestamp: scheduleTime,
        type: 'load_change',
        componentId: 'system',
        data: {
          type: 'daily_pattern',
          hour: hour,
          multiplier: hourMultiplier
        }
      });
    }
  }

  /**
   * Schedule weekly traffic pattern updates (7-day cycle)
   */
  private scheduleWeeklyPatternUpdates(): void {
    if (!this.realisticUserBehavior) return;
    
    const daysInWeek = 7;
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    
    for (let day = 0; day < daysInWeek; day++) {
      const dayMultiplier = this.realisticUserBehavior.weeklyPattern[day] || 1.0;
      
      const scheduleTime = this.currentTime + day * millisecondsPerDay;
      
      this.eventScheduler.scheduleEvent({
        id: `weekly_pattern_${day}`,
        timestamp: scheduleTime,
        type: 'load_change',
        componentId: 'system',
        data: {
          type: 'weekly_pattern',
          day: day,
          multiplier: dayMultiplier
        }
      });
    }
  }

  /**
   * Schedule seasonal event traffic changes
   */
  private scheduleSeasonalEvent(event: SeasonalEvent): void {
    const startTime = event.startDate.getTime();
    const endTime = event.endDate.getTime();
    const duration = endTime - startTime;
    
    switch (event.pattern) {
      case 'gradual':
        this.addGradualRampUp({
          startTime: startTime,
          duration: duration / 2,
          startMultiplier: 1.0,
          endMultiplier: event.trafficMultiplier,
          curve: 'exponential'
        });
        
        this.addGradualRampUp({
          startTime: startTime + duration / 2,
          duration: duration / 2,
          startMultiplier: event.trafficMultiplier,
          endMultiplier: 1.0,
          curve: 'logarithmic'
        });
        break;
        
      case 'sudden':
        this.scheduleLoadChange(startTime, event.trafficMultiplier);
        this.scheduleLoadChange(endTime, 1.0);
        break;
        
      case 'wave':
        this.addEnhancedTrafficBurst({
          startTime: startTime,
          duration: duration,
          multiplier: event.trafficMultiplier,
          pattern: 'wave'
        });
        break;
    }
  }

  /**
   * Implement geographic distribution simulation
   * Requirement 7.5: Implement geographic distribution simulation
   */
  setGeographicDistribution(distribution: GeographicDistribution): void {
    this.geographicDistribution = distribution;
    
    // Redistribute load across regions
    this.redistributeLoadByRegion();
    
    // Schedule region-specific peak hour adjustments
    this.scheduleRegionalPeakHours();
  }

  /**
   * Redistribute load across geographic regions
   */
  private redistributeLoadByRegion(): void {
    if (!this.geographicDistribution) return;
    
    const entryComponents = this.systemGraph.getAllComponents().filter(component => 
      component.incomingEdges.length === 0
    );
    
    // Clear existing processes and redistribute
    this.poissonProcesses.clear();
    
    this.geographicDistribution.regions.forEach(region => {
      // Create region-specific entry points
      entryComponents.forEach((component, index) => {
        const regionComponentId = `${component.id}_region_${region.id}`;
        const baseRate = this.baseArrivalRates.get(component.id) || 100;
        const regionRate = baseRate * (region.userPercentage / 100);
        
        // Apply network quality modifier
        const qualityMultiplier = this.getNetworkQualityMultiplier(region.networkQuality);
        const adjustedRate = regionRate * qualityMultiplier;
        
        this.poissonProcesses.set(regionComponentId, {
          lambda: adjustedRate,
          lastArrival: this.currentTime,
          nextArrival: this.generateNextPoissonArrival(adjustedRate, this.currentTime)
        });
      });
    });
  }

  /**
   * Schedule region-specific peak hour adjustments
   */
  private scheduleRegionalPeakHours(): void {
    if (!this.geographicDistribution) return;
    
    this.geographicDistribution.regions.forEach(region => {
      region.peakHours.forEach(peakHour => {
        // Calculate time offset for this region
        const timeZoneOffset = this.geographicDistribution!.timeZoneOffsets[0] || 0;
        const adjustedHour = (peakHour + timeZoneOffset) % 24;
        
        const peakTime = this.currentTime + adjustedHour * 60 * 60 * 1000;
        const peakMultiplier = 2.0; // 2x traffic during peak hours
        
        this.eventScheduler.scheduleEvent({
          id: `regional_peak_${region.id}_${peakHour}`,
          timestamp: peakTime,
          type: 'load_change',
          componentId: `region_${region.id}`,
          data: {
            type: 'regional_peak',
            region: region.id,
            multiplier: peakMultiplier,
            duration: 60 * 60 * 1000 // 1 hour peak
          }
        });
      });
    });
  }

  /**
   * Get network quality multiplier for traffic generation
   */
  private getNetworkQualityMultiplier(quality: 'excellent' | 'good' | 'fair' | 'poor'): number {
    const multipliers = {
      'excellent': 1.0,
      'good': 0.9,
      'fair': 0.7,
      'poor': 0.5
    };
    return multipliers[quality];
  }

  /**
   * Add traffic pattern to active patterns
   */
  addTrafficPattern(pattern: TrafficPattern): void {
    this.activeTrafficPatterns.set(pattern.id, pattern);
    
    // Apply the pattern based on its type
    switch (pattern.type) {
      case 'burst':
        this.addEnhancedTrafficBurst(pattern.configuration as TrafficBurst);
        break;
      case 'ramp':
        this.addGradualRampUp(pattern.configuration as GradualRampUp);
        break;
      case 'realistic':
        this.setRealisticUserBehavior(pattern.configuration as RealisticUserBehavior);
        break;
      case 'geographic':
        this.setGeographicDistribution(pattern.configuration as GeographicDistribution);
        break;
    }
  }

  /**
   * Remove traffic pattern
   */
  removeTrafficPattern(patternId: string): void {
    this.activeTrafficPatterns.delete(patternId);
  }

  /**
   * Get active traffic patterns
   */
  getActiveTrafficPatterns(): TrafficPattern[] {
    return Array.from(this.activeTrafficPatterns.values());
  }

  /**
   * Schedule a load change event
   */
  private scheduleLoadChange(timestamp: number, multiplier: number): void {
    this.eventScheduler.scheduleEvent({
      id: `load_change_${timestamp}_${Date.now()}`,
      timestamp: timestamp,
      type: 'load_change',
      componentId: 'system',
      data: {
        type: 'load_change',
        multiplier: multiplier
      }
    });
  }

  /**
   * Process load change events and update traffic patterns
   */
  processLoadChangeEvent(event: SimulationEvent): void {
    const { multiplier } = event.data;
    this.currentLoadMultiplier = multiplier;
    
    // Apply multiplier to all active Poisson processes
    this.poissonProcesses.forEach(process => {
      const baseRate = this.baseArrivalRates.get(event.componentId) || process.lambda;
      process.lambda = baseRate * multiplier;
    });
  }

  /**
   * Simulate user retry behavior
   */
  private simulateUserRetryBehavior(requestId: string, failureType: string): boolean {
    if (!this.realisticUserBehavior) return false;
    
    const retryBehavior = this.realisticUserBehavior.retryBehavior;
    
    // Check if user will retry based on probability
    if (Math.random() > retryBehavior.retryProbability) {
      return false;
    }
    
    // Schedule retry with backoff
    const retryDelay = retryBehavior.backoffMultiplier * 1000; // Convert to ms
    const retryTime = this.currentTime + retryDelay;
    
    this.eventScheduler.scheduleEvent({
      id: `retry_${requestId}`,
      timestamp: retryTime,
      type: 'request_arrival',
      componentId: 'retry',
      data: {
        requestId: `${requestId}_retry`,
        originalRequestId: requestId,
        retryAttempt: true
      }
    });
    
    return true;
  }

  /**
   * Apply load multiplier to all Poisson processes
   */
  applyLoadMultiplier(multiplier: number): void {
    this.poissonProcesses.forEach(process => {
      process.lambda *= multiplier;
    });
  }

  /**
   * Generate simulation result
   */
  private generateSimulationResult(): LoadSimulationResult {
    const totalRequests = this.requestCounter;
    const activeRequestCount = this.activeRequests.size;
    
    // Calculate average latency from active requests
    let totalLatency = 0;
    this.activeRequests.forEach(startTime => {
      totalLatency += this.currentTime - startTime;
    });
    const averageLatency = activeRequestCount > 0 ? totalLatency / activeRequestCount : 0;

    return {
      timestamp: this.currentTime,
      totalRequests,
      activeRequests: activeRequestCount,
      completedRequests: this.completedRequests,
      droppedRequests: this.totalDroppedRequests,
      averageLatency,
      queueStates: new Map(this.queueStates),
      backpressureStates: new Map(this.backpressureStates)
    };
  }

  /**
   * Get component queue capacity based on type
   */
  private getComponentQueueCapacity(type: SystemComponentType): number {
    const capacities: Record<SystemComponentType, number> = {
      'Client': 100,
      'LoadBalancer': 1000,
      'APIGateway': 500,
      'Service': 200,
      'Cache': 1000,
      'Queue': 10000,
      'Database': 100,
      'CDN': 5000,
      'SearchIndex': 500,
      'ObjectStorage': 1000
    };
    return capacities[type] || 100;
  }

  /**
   * Get component service rate based on type and configuration
   */
  private getComponentServiceRate(type: SystemComponentType, config: any): number {
    const baseRates: Record<SystemComponentType, number> = {
      'Client': 50,        // 50 requests/second
      'LoadBalancer': 1000, // 1000 requests/second
      'APIGateway': 500,   // 500 requests/second
      'Service': 100,      // 100 requests/second
      'Cache': 2000,       // 2000 requests/second
      'Queue': 5000,       // 5000 requests/second
      'Database': 50,      // 50 requests/second
      'CDN': 10000,        // 10000 requests/second
      'SearchIndex': 200,  // 200 requests/second
      'ObjectStorage': 1000 // 1000 requests/second
    };
    
    const baseRate = baseRates[type] || 100;
    
    // Apply configuration multipliers if available
    const performanceMultiplier = config?.performanceMultiplier || 1.0;
    return baseRate * performanceMultiplier;
  }

  /**
   * Get component server count based on type and configuration
   */
  private getComponentServerCount(type: SystemComponentType, config: any): number {
    const defaultCounts: Record<SystemComponentType, number> = {
      'Client': 1,
      'LoadBalancer': 2,
      'APIGateway': 3,
      'Service': 4,
      'Cache': 2,
      'Queue': 1,
      'Database': 2,
      'CDN': 10,
      'SearchIndex': 3,
      'ObjectStorage': 5
    };
    
    const defaultCount = defaultCounts[type] || 1;
    
    // Apply configuration if available
    return config?.serverCount || defaultCount;
  }

  /**
   * Reset simulation state
   */
  reset(): void {
    this.poissonProcesses.clear();
    this.queueStates.clear();
    this.backpressureStates.clear();
    this.activeTrafficPatterns.clear();
    this.baseArrivalRates.clear();
    this.currentTime = 0;
    this.requestCounter = 0;
    this.activeRequests.clear();
    this.completedRequests = 0;
    this.totalDroppedRequests = 0;
    this.currentLoadMultiplier = 1.0;
    this.realisticUserBehavior = undefined;
    this.geographicDistribution = undefined;
  }

  /**
   * Get current queue states (for monitoring)
   */
  getQueueStates(): Map<string, QueueState> {
    return new Map(this.queueStates);
  }

  /**
   * Get current backpressure states (for monitoring)
   */
  getBackpressureStates(): Map<string, BackpressureState> {
    return new Map(this.backpressureStates);
  }
}