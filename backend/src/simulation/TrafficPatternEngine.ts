/**
 * Traffic Pattern Engine implementing SRS FR-4.5
 * 
 * Implements bursty traffic generation per SRS FR-4.5
 * Creates steady-state load simulation per SRS FR-4.5
 * Adds gradual ramp-up and ramp-down patterns per SRS FR-4.5
 */

import { EventScheduler, SimulationEvent } from './types';
import { TrafficGenerationEngine, TrafficGenerationConfig, TrafficPatternType } from './TrafficGenerationEngine';

// Enhanced traffic pattern types
export type AdvancedTrafficPatternType = 
  | 'steady-state'
  | 'bursty'
  | 'gradual-ramp-up'
  | 'gradual-ramp-down'
  | 'sawtooth'
  | 'sinusoidal'
  | 'step-function'
  | 'flash-crowd'
  | 'diurnal'
  | 'weekly-cycle'
  | 'seasonal'
  | 'black-friday'
  | 'ddos-simulation';

// Traffic pattern configuration
export interface TrafficPatternConfig {
  id: string;
  name: string;
  type: AdvancedTrafficPatternType;
  duration: number; // seconds
  baselineQPS: number;
  peakQPS: number;
  parameters: TrafficPatternParameters;
  schedule?: TrafficSchedule;
  isActive: boolean;
  priority: number; // higher priority patterns override lower ones
}

// Pattern-specific parameters
export interface TrafficPatternParameters {
  // Bursty traffic parameters
  burstIntensity?: number; // multiplier for burst traffic
  burstDuration?: number; // seconds
  burstFrequency?: number; // average seconds between bursts
  burstVariability?: number; // 0-1, randomness in burst timing
  
  // Ramp parameters
  rampDuration?: number; // seconds to complete ramp
  rampCurve?: 'linear' | 'exponential' | 'logarithmic' | 'sigmoid';
  rampSmoothness?: number; // 0-1, how smooth the ramp is
  
  // Sinusoidal parameters
  amplitude?: number; // amplitude of sine wave
  frequency?: number; // cycles per hour
  phase?: number; // phase shift in radians
  
  // Step function parameters
  stepLevels?: number[]; // QPS levels for each step
  stepDurations?: number[]; // duration of each step in seconds
  
  // Flash crowd parameters
  flashCrowdProbability?: number; // probability per minute
  flashCrowdIntensity?: number; // traffic multiplier
  flashCrowdDuration?: number; // seconds
  
  // Diurnal parameters
  peakHours?: number[]; // hours of day for peak traffic (0-23)
  lowHours?: number[]; // hours of day for low traffic
  peakMultiplier?: number; // traffic multiplier during peak hours
  lowMultiplier?: number; // traffic multiplier during low hours
  
  // Weekly cycle parameters
  weekdayMultiplier?: number; // Monday-Friday multiplier
  weekendMultiplier?: number; // Saturday-Sunday multiplier
  
  // Seasonal parameters
  seasonalVariation?: number; // 0-1, amount of seasonal variation
  peakSeason?: 'spring' | 'summer' | 'fall' | 'winter';
  
  // DDoS simulation parameters
  ddosIntensity?: number; // traffic multiplier during attack
  ddosDuration?: number; // seconds
  ddosRampUp?: number; // seconds to reach peak intensity
  ddosRampDown?: number; // seconds to return to normal
}

// Traffic schedule for pattern activation
export interface TrafficSchedule {
  startTime: number; // timestamp
  endTime: number; // timestamp
  repeatInterval?: number; // seconds, for recurring patterns
  repeatCount?: number; // number of repetitions
  daysOfWeek?: number[]; // 0-6, Sunday=0
  hoursOfDay?: number[]; // 0-23
}

// Pattern execution state
export interface PatternExecutionState {
  patternId: string;
  isActive: boolean;
  startTime: number;
  currentPhase: string;
  nextPhaseTime: number;
  currentMultiplier: number;
  executionCount: number;
  lastExecution: number;
}

// Traffic pattern metrics
export interface TrafficPatternMetrics {
  patternId: string;
  patternType: AdvancedTrafficPatternType;
  executionCount: number;
  totalDuration: number;
  averageQPS: number;
  peakQPS: number;
  minQPS: number;
  effectiveMultiplier: number;
  lastActive: number;
}

/**
 * Traffic Pattern Engine
 * Implements SRS FR-4.5 requirements for traffic pattern support
 */
export class TrafficPatternEngine {
  private eventScheduler: EventScheduler;
  private trafficGenerator: TrafficGenerationEngine;
  private patterns: Map<string, TrafficPatternConfig>;
  private executionStates: Map<string, PatternExecutionState>;
  private patternMetrics: Map<string, TrafficPatternMetrics>;
  private activePatterns: Set<string>;
  private currentTime: number;
  private baselineQPS: number;

  constructor(eventScheduler: EventScheduler, trafficGenerator: TrafficGenerationEngine) {
    this.eventScheduler = eventScheduler;
    this.trafficGenerator = trafficGenerator;
    this.patterns = new Map();
    this.executionStates = new Map();
    this.patternMetrics = new Map();
    this.activePatterns = new Set();
    this.currentTime = 0;
    this.baselineQPS = 100; // Default baseline
  }

  /**
   * Initialize traffic pattern engine
   * Implements SRS FR-4.5: Traffic pattern generation
   */
  initializeTrafficPatterns(baselineQPS: number): void {
    this.baselineQPS = baselineQPS;
    this.currentTime = Date.now();
    
    // Create default traffic patterns
    this.createDefaultPatterns();
    
    // Start pattern monitoring
    this.startPatternMonitoring();
  }

  /**
   * Add a traffic pattern
   */
  addTrafficPattern(config: TrafficPatternConfig): void {
    this.patterns.set(config.id, config);
    
    // Initialize execution state
    this.executionStates.set(config.id, {
      patternId: config.id,
      isActive: false,
      startTime: 0,
      currentPhase: 'inactive',
      nextPhaseTime: 0,
      currentMultiplier: 1.0,
      executionCount: 0,
      lastExecution: 0
    });
    
    // Initialize metrics
    this.patternMetrics.set(config.id, {
      patternId: config.id,
      patternType: config.type,
      executionCount: 0,
      totalDuration: 0,
      averageQPS: 0,
      peakQPS: 0,
      minQPS: 0,
      effectiveMultiplier: 1.0,
      lastActive: 0
    });
    
    // Schedule pattern if it has a schedule
    if (config.schedule) {
      this.schedulePattern(config.id);
    }
  }

  /**
   * Activate a traffic pattern
   */
  activatePattern(patternId: string): boolean {
    const pattern = this.patterns.get(patternId);
    const executionState = this.executionStates.get(patternId);
    
    if (!pattern || !executionState) {
      return false;
    }

    if (executionState.isActive) {
      return true; // Already active
    }

    executionState.isActive = true;
    executionState.startTime = Date.now();
    executionState.currentPhase = 'starting';
    executionState.executionCount++;
    
    this.activePatterns.add(patternId);
    
    // Start pattern execution
    this.executePattern(patternId);
    
    return true;
  }

  /**
   * Deactivate a traffic pattern
   */
  deactivatePattern(patternId: string): boolean {
    const executionState = this.executionStates.get(patternId);
    
    if (!executionState || !executionState.isActive) {
      return false;
    }

    executionState.isActive = false;
    executionState.currentPhase = 'inactive';
    executionState.currentMultiplier = 1.0;
    
    this.activePatterns.delete(patternId);
    
    // Update metrics
    this.updatePatternMetrics(patternId);
    
    return true;
  }

  /**
   * Execute a specific traffic pattern
   * Implements SRS FR-4.5: Bursty traffic generation, steady-state load simulation, gradual ramp patterns
   */
  private executePattern(patternId: string): void {
    const pattern = this.patterns.get(patternId);
    const executionState = this.executionStates.get(patternId);
    
    if (!pattern || !executionState || !executionState.isActive) {
      return;
    }

    switch (pattern.type) {
      case 'steady-state':
        this.executeSteadyStatePattern(pattern, executionState);
        break;
      case 'bursty':
        this.executeBurstyPattern(pattern, executionState);
        break;
      case 'gradual-ramp-up':
        this.executeGradualRampUpPattern(pattern, executionState);
        break;
      case 'gradual-ramp-down':
        this.executeGradualRampDownPattern(pattern, executionState);
        break;
      case 'sawtooth':
        this.executeSawtoothPattern(pattern, executionState);
        break;
      case 'sinusoidal':
        this.executeSinusoidalPattern(pattern, executionState);
        break;
      case 'step-function':
        this.executeStepFunctionPattern(pattern, executionState);
        break;
      case 'flash-crowd':
        this.executeFlashCrowdPattern(pattern, executionState);
        break;
      case 'diurnal':
        this.executeDiurnalPattern(pattern, executionState);
        break;
      case 'weekly-cycle':
        this.executeWeeklyCyclePattern(pattern, executionState);
        break;
      case 'seasonal':
        this.executeSeasonalPattern(pattern, executionState);
        break;
      case 'black-friday':
        this.executeBlackFridayPattern(pattern, executionState);
        break;
      case 'ddos-simulation':
        this.executeDDoSSimulationPattern(pattern, executionState);
        break;
    }
  }

  /**
   * Execute steady-state traffic pattern
   * Implements SRS FR-4.5: Steady-state load simulation
   */
  private executeSteadyStatePattern(pattern: TrafficPatternConfig, state: PatternExecutionState): void {
    const targetQPS = pattern.baselineQPS;
    const variability = 0.1; // 10% variability for realism
    
    // Add small random variations to make it realistic
    const variation = 1 + (Math.random() - 0.5) * variability;
    const currentQPS = targetQPS * variation;
    
    state.currentMultiplier = currentQPS / this.baselineQPS;
    state.currentPhase = 'steady';
    
    // Apply the traffic level
    this.applyTrafficMultiplier(state.currentMultiplier);
    
    // Schedule next update in 1 second
    this.schedulePatternUpdate(pattern.id, 1000);
  }

  /**
   * Execute bursty traffic pattern
   * Implements SRS FR-4.5: Bursty traffic generation
   */
  private executeBurstyPattern(pattern: TrafficPatternConfig, state: PatternExecutionState): void {
    const params = pattern.parameters;
    const burstIntensity = params.burstIntensity || 5.0;
    const burstDuration = (params.burstDuration || 30) * 1000; // Convert to ms
    const burstFrequency = (params.burstFrequency || 300) * 1000; // Convert to ms
    const burstVariability = params.burstVariability || 0.2;
    
    const currentTime = Date.now();
    const elapsedTime = currentTime - state.startTime;
    
    // Determine if we're in a burst period
    const timeSinceLastBurst = elapsedTime % burstFrequency;
    const isInBurst = timeSinceLastBurst < burstDuration;
    
    if (isInBurst) {
      // Calculate burst intensity with some variability
      const burstProgress = timeSinceLastBurst / burstDuration;
      const burstCurve = Math.sin(burstProgress * Math.PI); // Bell curve
      const variability = 1 + (Math.random() - 0.5) * burstVariability;
      
      state.currentMultiplier = 1 + (burstIntensity - 1) * burstCurve * variability;
      state.currentPhase = 'burst';
    } else {
      // Normal traffic with small variations
      const variation = 1 + (Math.random() - 0.5) * 0.1;
      state.currentMultiplier = variation;
      state.currentPhase = 'normal';
    }
    
    this.applyTrafficMultiplier(state.currentMultiplier);
    
    // Schedule next update
    this.schedulePatternUpdate(pattern.id, 1000);
  }

  /**
   * Execute gradual ramp-up pattern
   * Implements SRS FR-4.5: Gradual ramp-up patterns
   */
  private executeGradualRampUpPattern(pattern: TrafficPatternConfig, state: PatternExecutionState): void {
    const params = pattern.parameters;
    const rampDuration = (params.rampDuration || 300) * 1000; // Convert to ms
    const rampCurve = params.rampCurve || 'linear';
    const targetMultiplier = pattern.peakQPS / pattern.baselineQPS;
    
    const currentTime = Date.now();
    const elapsedTime = currentTime - state.startTime;
    const progress = Math.min(elapsedTime / rampDuration, 1.0);
    
    let multiplier: number;
    
    switch (rampCurve) {
      case 'exponential':
        multiplier = 1 + (targetMultiplier - 1) * Math.pow(progress, 2);
        break;
      case 'logarithmic':
        multiplier = 1 + (targetMultiplier - 1) * Math.sqrt(progress);
        break;
      case 'sigmoid':
        const sigmoid = 1 / (1 + Math.exp(-10 * (progress - 0.5)));
        multiplier = 1 + (targetMultiplier - 1) * sigmoid;
        break;
      default: // linear
        multiplier = 1 + (targetMultiplier - 1) * progress;
    }
    
    state.currentMultiplier = multiplier;
    state.currentPhase = progress < 1.0 ? 'ramping-up' : 'peak';
    
    this.applyTrafficMultiplier(state.currentMultiplier);
    
    // Check if ramp is complete
    if (progress >= 1.0) {
      // Maintain peak for a while, then deactivate or transition
      this.schedulePatternUpdate(pattern.id, 60000); // Check again in 1 minute
    } else {
      this.schedulePatternUpdate(pattern.id, 1000);
    }
  }

  /**
   * Execute gradual ramp-down pattern
   * Implements SRS FR-4.5: Gradual ramp-down patterns
   */
  private executeGradualRampDownPattern(pattern: TrafficPatternConfig, state: PatternExecutionState): void {
    const params = pattern.parameters;
    const rampDuration = (params.rampDuration || 300) * 1000; // Convert to ms
    const rampCurve = params.rampCurve || 'linear';
    const startMultiplier = pattern.peakQPS / pattern.baselineQPS;
    
    const currentTime = Date.now();
    const elapsedTime = currentTime - state.startTime;
    const progress = Math.min(elapsedTime / rampDuration, 1.0);
    
    let multiplier: number;
    
    switch (rampCurve) {
      case 'exponential':
        multiplier = startMultiplier - (startMultiplier - 1) * Math.pow(progress, 2);
        break;
      case 'logarithmic':
        multiplier = startMultiplier - (startMultiplier - 1) * Math.sqrt(progress);
        break;
      case 'sigmoid':
        const sigmoid = 1 / (1 + Math.exp(-10 * (progress - 0.5)));
        multiplier = startMultiplier - (startMultiplier - 1) * sigmoid;
        break;
      default: // linear
        multiplier = startMultiplier - (startMultiplier - 1) * progress;
    }
    
    state.currentMultiplier = multiplier;
    state.currentPhase = progress < 1.0 ? 'ramping-down' : 'baseline';
    
    this.applyTrafficMultiplier(state.currentMultiplier);
    
    // Check if ramp is complete
    if (progress >= 1.0) {
      this.deactivatePattern(pattern.id);
    } else {
      this.schedulePatternUpdate(pattern.id, 1000);
    }
  }

  /**
   * Execute sawtooth pattern
   */
  private executeSawtoothPattern(pattern: TrafficPatternConfig, state: PatternExecutionState): void {
    const params = pattern.parameters;
    const cycleDuration = (params.rampDuration || 600) * 1000; // 10 minutes default
    const peakMultiplier = pattern.peakQPS / pattern.baselineQPS;
    
    const currentTime = Date.now();
    const elapsedTime = currentTime - state.startTime;
    const cycleProgress = (elapsedTime % cycleDuration) / cycleDuration;
    
    // Sawtooth: linear ramp up, then sharp drop
    const multiplier = cycleProgress < 0.8 ? 
      1 + (peakMultiplier - 1) * (cycleProgress / 0.8) : // Ramp up over 80% of cycle
      1; // Sharp drop to baseline
    
    state.currentMultiplier = multiplier;
    state.currentPhase = cycleProgress < 0.8 ? 'ramping' : 'dropping';
    
    this.applyTrafficMultiplier(state.currentMultiplier);
    this.schedulePatternUpdate(pattern.id, 1000);
  }

  /**
   * Execute sinusoidal pattern
   */
  private executeSinusoidalPattern(pattern: TrafficPatternConfig, state: PatternExecutionState): void {
    const params = pattern.parameters;
    const amplitude = params.amplitude || 2.0;
    const frequency = params.frequency || 1.0; // cycles per hour
    const phase = params.phase || 0;
    
    const currentTime = Date.now();
    const elapsedTime = currentTime - state.startTime;
    const hoursElapsed = elapsedTime / (1000 * 60 * 60);
    
    // Sinusoidal function: 1 + amplitude * sin(2π * frequency * time + phase)
    const sineValue = Math.sin(2 * Math.PI * frequency * hoursElapsed + phase);
    const multiplier = 1 + amplitude * (sineValue + 1) / 2; // Normalize to positive values
    
    state.currentMultiplier = multiplier;
    state.currentPhase = sineValue > 0 ? 'peak' : 'trough';
    
    this.applyTrafficMultiplier(state.currentMultiplier);
    this.schedulePatternUpdate(pattern.id, 5000); // Update every 5 seconds
  }

  /**
   * Execute step function pattern
   */
  private executeStepFunctionPattern(pattern: TrafficPatternConfig, state: PatternExecutionState): void {
    const params = pattern.parameters;
    const stepLevels = params.stepLevels || [1, 2, 4, 2, 1];
    const stepDurations = params.stepDurations || [60, 60, 60, 60, 60]; // seconds
    
    const currentTime = Date.now();
    const elapsedTime = currentTime - state.startTime;
    
    // Calculate which step we're in
    let totalDuration = 0;
    let currentStep = 0;
    
    for (let i = 0; i < stepDurations.length; i++) {
      totalDuration += stepDurations[i] * 1000;
      if (elapsedTime < totalDuration) {
        currentStep = i;
        break;
      }
    }
    
    // If we've completed all steps, cycle back to the beginning
    if (currentStep >= stepLevels.length) {
      currentStep = 0;
      state.startTime = currentTime; // Reset start time for next cycle
    }
    
    state.currentMultiplier = stepLevels[currentStep];
    state.currentPhase = `step-${currentStep}`;
    
    this.applyTrafficMultiplier(state.currentMultiplier);
    
    // Schedule next update at the end of current step
    const remainingStepTime = stepDurations[currentStep] * 1000 - 
      (elapsedTime % (stepDurations[currentStep] * 1000));
    this.schedulePatternUpdate(pattern.id, Math.max(remainingStepTime, 1000));
  }

  /**
   * Execute flash crowd pattern
   */
  private executeFlashCrowdPattern(pattern: TrafficPatternConfig, state: PatternExecutionState): void {
    const params = pattern.parameters;
    const flashCrowdProbability = params.flashCrowdProbability || 0.001; // 0.1% per minute
    const flashCrowdIntensity = params.flashCrowdIntensity || 10.0;
    const flashCrowdDuration = (params.flashCrowdDuration || 120) * 1000; // 2 minutes
    
    const currentTime = Date.now();
    
    if (state.currentPhase === 'flash-crowd') {
      // Check if flash crowd is over
      if (currentTime - state.nextPhaseTime > flashCrowdDuration) {
        state.currentPhase = 'normal';
        state.currentMultiplier = 1.0;
      } else {
        // Continue flash crowd with some decay
        const elapsed = currentTime - state.nextPhaseTime;
        const decay = Math.exp(-elapsed / (flashCrowdDuration / 2));
        state.currentMultiplier = 1 + (flashCrowdIntensity - 1) * decay;
      }
    } else {
      // Check for flash crowd trigger
      if (Math.random() < flashCrowdProbability / 60) { // Per second probability
        state.currentPhase = 'flash-crowd';
        state.nextPhaseTime = currentTime;
        state.currentMultiplier = flashCrowdIntensity;
      } else {
        state.currentMultiplier = 1.0 + (Math.random() - 0.5) * 0.1; // Small variations
      }
    }
    
    this.applyTrafficMultiplier(state.currentMultiplier);
    this.schedulePatternUpdate(pattern.id, 1000);
  }

  /**
   * Execute diurnal (daily) pattern
   */
  private executeDiurnalPattern(pattern: TrafficPatternConfig, state: PatternExecutionState): void {
    const params = pattern.parameters;
    const peakHours = params.peakHours || [9, 10, 11, 14, 15, 16, 19, 20, 21];
    const lowHours = params.lowHours || [0, 1, 2, 3, 4, 5];
    const peakMultiplier = params.peakMultiplier || 3.0;
    const lowMultiplier = params.lowMultiplier || 0.3;
    
    const currentHour = new Date().getHours();
    
    let multiplier = 1.0;
    if (peakHours.includes(currentHour)) {
      multiplier = peakMultiplier;
      state.currentPhase = 'peak-hours';
    } else if (lowHours.includes(currentHour)) {
      multiplier = lowMultiplier;
      state.currentPhase = 'low-hours';
    } else {
      multiplier = 1.0;
      state.currentPhase = 'normal-hours';
    }
    
    // Add some randomness
    multiplier *= (0.9 + Math.random() * 0.2);
    
    state.currentMultiplier = multiplier;
    
    this.applyTrafficMultiplier(state.currentMultiplier);
    
    // Update every 5 minutes
    this.schedulePatternUpdate(pattern.id, 5 * 60 * 1000);
  }

  /**
   * Execute weekly cycle pattern
   */
  private executeWeeklyCyclePattern(pattern: TrafficPatternConfig, state: PatternExecutionState): void {
    const params = pattern.parameters;
    const weekdayMultiplier = params.weekdayMultiplier || 1.2;
    const weekendMultiplier = params.weekendMultiplier || 0.7;
    
    const dayOfWeek = new Date().getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    const multiplier = isWeekend ? weekendMultiplier : weekdayMultiplier;
    
    state.currentMultiplier = multiplier * (0.9 + Math.random() * 0.2);
    state.currentPhase = isWeekend ? 'weekend' : 'weekday';
    
    this.applyTrafficMultiplier(state.currentMultiplier);
    
    // Update every hour
    this.schedulePatternUpdate(pattern.id, 60 * 60 * 1000);
  }

  /**
   * Execute seasonal pattern
   */
  private executeSeasonalPattern(pattern: TrafficPatternConfig, state: PatternExecutionState): void {
    const params = pattern.parameters;
    const seasonalVariation = params.seasonalVariation || 0.3;
    const peakSeason = params.peakSeason || 'winter';
    
    const month = new Date().getMonth(); // 0-11
    const seasonMultipliers = {
      'spring': [0.9, 1.0, 1.1], // Mar, Apr, May
      'summer': [1.1, 1.0, 0.9], // Jun, Jul, Aug
      'fall': [0.9, 1.0, 1.1],   // Sep, Oct, Nov
      'winter': [1.1, 1.2, 1.0]  // Dec, Jan, Feb
    };
    
    const seasonIndex = Math.floor(month / 3);
    const seasons = ['winter', 'spring', 'summer', 'fall'];
    const currentSeason = seasons[seasonIndex];
    
    let multiplier = 1.0;
    if (currentSeason === peakSeason) {
      multiplier = 1 + seasonalVariation;
    } else {
      multiplier = 1 - seasonalVariation / 2;
    }
    
    state.currentMultiplier = multiplier;
    state.currentPhase = currentSeason;
    
    this.applyTrafficMultiplier(state.currentMultiplier);
    
    // Update daily
    this.schedulePatternUpdate(pattern.id, 24 * 60 * 60 * 1000);
  }

  /**
   * Execute Black Friday pattern
   */
  private executeBlackFridayPattern(pattern: TrafficPatternConfig, state: PatternExecutionState): void {
    const currentTime = Date.now();
    const elapsedTime = currentTime - state.startTime;
    const totalDuration = pattern.duration * 1000;
    
    // Black Friday pattern: gradual buildup, massive spike, then gradual decline
    const progress = elapsedTime / totalDuration;
    
    let multiplier: number;
    if (progress < 0.3) {
      // Buildup phase
      multiplier = 1 + 4 * progress / 0.3; // Build up to 5x
      state.currentPhase = 'buildup';
    } else if (progress < 0.7) {
      // Peak phase
      multiplier = 5 + 10 * Math.sin((progress - 0.3) / 0.4 * Math.PI); // Peak at 15x
      state.currentPhase = 'peak';
    } else {
      // Decline phase
      multiplier = 5 * (1 - (progress - 0.7) / 0.3); // Decline back to 1x
      state.currentPhase = 'decline';
    }
    
    state.currentMultiplier = Math.max(1, multiplier);
    
    this.applyTrafficMultiplier(state.currentMultiplier);
    
    if (progress >= 1.0) {
      this.deactivatePattern(pattern.id);
    } else {
      this.schedulePatternUpdate(pattern.id, 1000);
    }
  }

  /**
   * Execute DDoS simulation pattern
   */
  private executeDDoSSimulationPattern(pattern: TrafficPatternConfig, state: PatternExecutionState): void {
    const params = pattern.parameters;
    const ddosIntensity = params.ddosIntensity || 50.0;
    const ddosDuration = (params.ddosDuration || 300) * 1000; // 5 minutes
    const ddosRampUp = (params.ddosRampUp || 30) * 1000; // 30 seconds
    const ddosRampDown = (params.ddosRampDown || 60) * 1000; // 1 minute
    
    const currentTime = Date.now();
    const elapsedTime = currentTime - state.startTime;
    
    let multiplier: number;
    
    if (elapsedTime < ddosRampUp) {
      // Ramp up phase
      const rampProgress = elapsedTime / ddosRampUp;
      multiplier = 1 + (ddosIntensity - 1) * rampProgress;
      state.currentPhase = 'ddos-ramp-up';
    } else if (elapsedTime < ddosDuration - ddosRampDown) {
      // Attack phase
      multiplier = ddosIntensity * (0.9 + Math.random() * 0.2); // Add some chaos
      state.currentPhase = 'ddos-attack';
    } else if (elapsedTime < ddosDuration) {
      // Ramp down phase
      const rampDownProgress = (elapsedTime - (ddosDuration - ddosRampDown)) / ddosRampDown;
      multiplier = ddosIntensity * (1 - rampDownProgress) + 1 * rampDownProgress;
      state.currentPhase = 'ddos-ramp-down';
    } else {
      // Attack over
      multiplier = 1.0;
      state.currentPhase = 'post-ddos';
      this.deactivatePattern(pattern.id);
    }
    
    state.currentMultiplier = multiplier;
    
    this.applyTrafficMultiplier(state.currentMultiplier);
    this.schedulePatternUpdate(pattern.id, 1000);
  }

  /**
   * Apply traffic multiplier to the traffic generation system
   */
  private applyTrafficMultiplier(multiplier: number): void {
    // Calculate effective QPS
    const effectiveQPS = this.baselineQPS * multiplier;
    
    // Update traffic generation configuration
    const trafficConfig: TrafficGenerationConfig = {
      userCount: Math.ceil(effectiveQPS / 2), // Assume 2 requests per user on average
      qpsTarget: effectiveQPS,
      pattern: 'steady', // Use steady pattern with multiplier
      duration: 60, // 1 minute duration
      userBehavior: {
        sessionDuration: 300, // 5 minutes
        requestsPerSession: 10,
        thinkTime: 2, // 2 seconds
        retryProbability: 0.1,
        abandonmentRate: 0.05,
        concurrencyFactor: 0.3
      }
    };
    
    // Apply to traffic generator
    this.trafficGenerator.initializeTrafficGeneration(trafficConfig);
  }

  /**
   * Schedule pattern update
   */
  private schedulePatternUpdate(patternId: string, delayMs: number): void {
    this.eventScheduler.scheduleEvent({
      id: `pattern_update_${patternId}_${Date.now()}`,
      timestamp: Date.now() + delayMs,
      type: 'load_change',
      componentId: 'traffic_pattern_engine',
      data: {
        type: 'pattern_update',
        patternId
      }
    });
  }

  /**
   * Schedule pattern activation
   */
  private schedulePattern(patternId: string): void {
    const pattern = this.patterns.get(patternId);
    if (!pattern || !pattern.schedule) return;

    const schedule = pattern.schedule;
    const now = Date.now();
    
    if (schedule.startTime > now) {
      // Schedule future activation
      this.eventScheduler.scheduleEvent({
        id: `pattern_activation_${patternId}`,
        timestamp: schedule.startTime,
        type: 'load_change',
        componentId: 'traffic_pattern_engine',
        data: {
          type: 'pattern_activation',
          patternId
        }
      });
    }
    
    if (schedule.endTime > now) {
      // Schedule deactivation
      this.eventScheduler.scheduleEvent({
        id: `pattern_deactivation_${patternId}`,
        timestamp: schedule.endTime,
        type: 'load_change',
        componentId: 'traffic_pattern_engine',
        data: {
          type: 'pattern_deactivation',
          patternId
        }
      });
    }
  }

  /**
   * Start pattern monitoring
   */
  private startPatternMonitoring(): void {
    // Monitor active patterns every second
    setInterval(() => {
      for (const patternId of this.activePatterns) {
        this.executePattern(patternId);
      }
    }, 1000);
  }

  /**
   * Update pattern metrics
   */
  private updatePatternMetrics(patternId: string): void {
    const pattern = this.patterns.get(patternId);
    const executionState = this.executionStates.get(patternId);
    const metrics = this.patternMetrics.get(patternId);
    
    if (!pattern || !executionState || !metrics) return;

    const duration = Date.now() - executionState.startTime;
    metrics.totalDuration += duration;
    metrics.lastActive = Date.now();
    
    // Update other metrics based on execution state
    if (executionState.currentMultiplier > metrics.effectiveMultiplier) {
      metrics.peakQPS = this.baselineQPS * executionState.currentMultiplier;
    }
  }

  /**
   * Create default traffic patterns
   */
  private createDefaultPatterns(): void {
    // Steady state pattern
    this.addTrafficPattern({
      id: 'default-steady',
      name: 'Steady State Traffic',
      type: 'steady-state',
      duration: 3600, // 1 hour
      baselineQPS: this.baselineQPS,
      peakQPS: this.baselineQPS,
      parameters: {},
      isActive: false,
      priority: 1
    });

    // Bursty pattern
    this.addTrafficPattern({
      id: 'default-bursty',
      name: 'Bursty Traffic',
      type: 'bursty',
      duration: 3600,
      baselineQPS: this.baselineQPS,
      peakQPS: this.baselineQPS * 5,
      parameters: {
        burstIntensity: 5.0,
        burstDuration: 30,
        burstFrequency: 300,
        burstVariability: 0.2
      },
      isActive: false,
      priority: 2
    });

    // Ramp up pattern
    this.addTrafficPattern({
      id: 'default-ramp-up',
      name: 'Gradual Ramp Up',
      type: 'gradual-ramp-up',
      duration: 1800, // 30 minutes
      baselineQPS: this.baselineQPS,
      peakQPS: this.baselineQPS * 10,
      parameters: {
        rampDuration: 1800,
        rampCurve: 'exponential'
      },
      isActive: false,
      priority: 3
    });
  }

  /**
   * Get pattern metrics
   */
  getPatternMetrics(patternId: string): TrafficPatternMetrics | undefined {
    return this.patternMetrics.get(patternId);
  }

  /**
   * Get all active patterns
   */
  getActivePatterns(): string[] {
    return Array.from(this.activePatterns);
  }

  /**
   * Get pattern execution state
   */
  getPatternExecutionState(patternId: string): PatternExecutionState | undefined {
    return this.executionStates.get(patternId);
  }

  /**
   * Clear all patterns and state
   */
  clear(): void {
    this.patterns.clear();
    this.executionStates.clear();
    this.patternMetrics.clear();
    this.activePatterns.clear();
  }
}