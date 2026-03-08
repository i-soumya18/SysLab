/**
 * Retry and Timeout Engine implementing SRS FR-4.4
 * 
 * Creates retry logic with exponential backoff per SRS FR-4.4
 * Adds timeout handling and circuit breaker patterns per SRS FR-4.4
 * Implements failure detection and recovery per SRS FR-4.4
 */

import { EventScheduler, SimulationEvent } from './types';
import { SystemGraphEngine, SystemGraphNode } from './SystemGraphEngine';

// Retry configuration
export interface RetryConfiguration {
  maxRetries: number;
  initialDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
  jitterEnabled: boolean;
  jitterRange: number; // 0-1, percentage of delay to add as jitter
  retryableErrors: string[];
  nonRetryableErrors: string[];
}

// Timeout configuration
export interface TimeoutConfiguration {
  requestTimeout: number; // milliseconds
  connectionTimeout: number; // milliseconds
  readTimeout: number; // milliseconds
  writeTimeout: number; // milliseconds
  keepAliveTimeout: number; // milliseconds
  timeoutStrategy: 'fail-fast' | 'graceful' | 'circuit-breaker';
}

// Circuit breaker configuration
export interface CircuitBreakerConfiguration {
  failureThreshold: number; // number of failures to open circuit
  successThreshold: number; // number of successes to close circuit
  timeout: number; // milliseconds to wait before trying again
  monitoringWindow: number; // milliseconds to monitor failures
  halfOpenMaxCalls: number; // max calls allowed in half-open state
}

// Request state tracking
export interface RequestState {
  id: string;
  componentId: string;
  originalTimestamp: number;
  currentAttempt: number;
  maxRetries: number;
  nextRetryTime: number;
  timeoutTime: number;
  isTimedOut: boolean;
  isCompleted: boolean;
  lastError?: string;
  retryHistory: RetryAttempt[];
}

export interface RetryAttempt {
  attemptNumber: number;
  timestamp: number;
  delay: number;
  error?: string;
  success: boolean;
}

// Circuit breaker state
export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerStatus {
  componentId: string;
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  nextAttemptTime: number;
  halfOpenCallCount: number;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
  failureRate: number;
}

// Failure detection configuration
export interface FailureDetectionConfig {
  healthCheckInterval: number; // milliseconds
  healthCheckTimeout: number; // milliseconds
  consecutiveFailuresThreshold: number;
  recoveryCheckInterval: number; // milliseconds
  enableAdaptiveTimeout: boolean;
  adaptiveTimeoutFactor: number;
}

// Recovery tracking
export interface RecoveryStatus {
  componentId: string;
  isRecovering: boolean;
  recoveryStartTime: number;
  consecutiveSuccesses: number;
  requiredSuccesses: number;
  lastHealthCheck: number;
  healthCheckResults: boolean[];
}

/**
 * Retry and Timeout Engine
 * Implements SRS FR-4.4 requirements
 */
export class RetryTimeoutEngine {
  private systemGraph: SystemGraphEngine;
  private eventScheduler: EventScheduler;
  private retryConfigurations: Map<string, RetryConfiguration>;
  private timeoutConfigurations: Map<string, TimeoutConfiguration>;
  private circuitBreakerConfigurations: Map<string, CircuitBreakerConfiguration>;
  private failureDetectionConfigs: Map<string, FailureDetectionConfig>;
  
  private activeRequests: Map<string, RequestState>;
  private circuitBreakerStates: Map<string, CircuitBreakerStatus>;
  private recoveryStatuses: Map<string, RecoveryStatus>;
  private timeoutTimers: Map<string, NodeJS.Timeout>;
  private retryTimers: Map<string, NodeJS.Timeout>;

  constructor(systemGraph: SystemGraphEngine, eventScheduler: EventScheduler) {
    this.systemGraph = systemGraph;
    this.eventScheduler = eventScheduler;
    this.retryConfigurations = new Map();
    this.timeoutConfigurations = new Map();
    this.circuitBreakerConfigurations = new Map();
    this.failureDetectionConfigs = new Map();
    
    this.activeRequests = new Map();
    this.circuitBreakerStates = new Map();
    this.recoveryStatuses = new Map();
    this.timeoutTimers = new Map();
    this.retryTimers = new Map();
  }

  /**
   * Initialize retry and timeout mechanisms
   * Implements SRS FR-4.4: Retry logic with exponential backoff
   */
  initializeRetryTimeout(): void {
    const allNodes = this.systemGraph.getAllComponents();
    
    for (const node of allNodes) {
      // Initialize retry configuration
      const retryConfig = this.createRetryConfiguration(node);
      this.retryConfigurations.set(node.id, retryConfig);
      
      // Initialize timeout configuration
      const timeoutConfig = this.createTimeoutConfiguration(node);
      this.timeoutConfigurations.set(node.id, timeoutConfig);
      
      // Initialize circuit breaker configuration
      const circuitBreakerConfig = this.createCircuitBreakerConfiguration(node);
      this.circuitBreakerConfigurations.set(node.id, circuitBreakerConfig);
      
      // Initialize failure detection configuration
      const failureDetectionConfig = this.createFailureDetectionConfiguration(node);
      this.failureDetectionConfigs.set(node.id, failureDetectionConfig);
      
      // Initialize circuit breaker state
      this.initializeCircuitBreakerState(node.id, circuitBreakerConfig);
      
      // Initialize recovery status
      this.initializeRecoveryStatus(node.id);
      
      // Start health checking
      this.startHealthChecking(node.id);
    }
  }

  /**
   * Process request with retry and timeout handling
   * Implements SRS FR-4.4: Timeout handling and circuit breaker patterns
   */
  processRequest(requestId: string, componentId: string, timeoutMs?: number): boolean {
    const circuitBreakerState = this.circuitBreakerStates.get(componentId);
    
    if (!circuitBreakerState) {
      return false;
    }

    // Check circuit breaker state
    if (!this.canProcessRequest(componentId)) {
      this.recordCircuitBreakerRejection(componentId);
      return false;
    }

    const retryConfig = this.retryConfigurations.get(componentId);
    const timeoutConfig = this.timeoutConfigurations.get(componentId);
    
    if (!retryConfig || !timeoutConfig) {
      return false;
    }

    // Create request state
    const requestTimeout = timeoutMs || timeoutConfig.requestTimeout;
    const requestState: RequestState = {
      id: requestId,
      componentId,
      originalTimestamp: Date.now(),
      currentAttempt: 0,
      maxRetries: retryConfig.maxRetries,
      nextRetryTime: 0,
      timeoutTime: Date.now() + requestTimeout,
      isTimedOut: false,
      isCompleted: false,
      retryHistory: []
    };

    this.activeRequests.set(requestId, requestState);

    // Set timeout timer
    this.setTimeoutTimer(requestId, requestTimeout);

    // Process the initial request
    this.attemptRequest(requestId);

    return true;
  }

  /**
   * Attempt to process a request
   */
  private attemptRequest(requestId: string): void {
    const requestState = this.activeRequests.get(requestId);
    if (!requestState || requestState.isCompleted || requestState.isTimedOut) {
      return;
    }

    requestState.currentAttempt++;
    const attemptTimestamp = Date.now();

    // Check if we've exceeded max retries
    if (requestState.currentAttempt > requestState.maxRetries + 1) {
      this.handleRequestFailure(requestId, 'Max retries exceeded');
      return;
    }

    // Schedule request processing
    this.eventScheduler.scheduleEvent({
      id: `request_attempt_${requestId}_${requestState.currentAttempt}`,
      timestamp: attemptTimestamp,
      type: 'request_arrival',
      componentId: requestState.componentId,
      data: {
        requestId,
        attemptNumber: requestState.currentAttempt,
        isRetry: requestState.currentAttempt > 1
      }
    });
  }

  /**
   * Handle request success
   * Implements SRS FR-4.4: Failure detection and recovery
   */
  handleRequestSuccess(requestId: string, responseTime: number): void {
    const requestState = this.activeRequests.get(requestId);
    if (!requestState || requestState.isCompleted) {
      return;
    }

    // Mark request as completed
    requestState.isCompleted = true;
    
    // Record successful attempt
    requestState.retryHistory.push({
      attemptNumber: requestState.currentAttempt,
      timestamp: Date.now(),
      delay: 0,
      success: true
    });

    // Clear timeout timer
    this.clearTimeoutTimer(requestId);

    // Update circuit breaker with success
    this.recordCircuitBreakerSuccess(requestState.componentId, responseTime);

    // Update recovery status
    this.updateRecoveryStatus(requestState.componentId, true);

    // Clean up request state
    this.activeRequests.delete(requestId);

    // Emit success event
    this.eventScheduler.scheduleEvent({
      id: `request_success_${requestId}`,
      timestamp: Date.now(),
      type: 'request_completion',
      componentId: requestState.componentId,
      data: {
        requestId,
        success: true,
        attempts: requestState.currentAttempt,
        responseTime,
        retryHistory: requestState.retryHistory
      }
    });
  }

  /**
   * Handle request failure
   */
  handleRequestFailure(requestId: string, error: string): void {
    const requestState = this.activeRequests.get(requestId);
    if (!requestState || requestState.isCompleted) {
      return;
    }

    requestState.lastError = error;

    // Record failed attempt
    requestState.retryHistory.push({
      attemptNumber: requestState.currentAttempt,
      timestamp: Date.now(),
      delay: 0,
      error,
      success: false
    });

    // Check if error is retryable
    const retryConfig = this.retryConfigurations.get(requestState.componentId);
    if (!retryConfig || !this.isRetryableError(error, retryConfig)) {
      this.finalizeRequestFailure(requestId, error);
      return;
    }

    // Check if we can retry
    if (requestState.currentAttempt >= requestState.maxRetries + 1) {
      this.finalizeRequestFailure(requestId, 'Max retries exceeded');
      return;
    }

    // Calculate retry delay with exponential backoff
    const retryDelay = this.calculateRetryDelay(requestState, retryConfig);
    requestState.nextRetryTime = Date.now() + retryDelay;

    // Update retry history with delay
    const lastAttempt = requestState.retryHistory[requestState.retryHistory.length - 1];
    lastAttempt.delay = retryDelay;

    // Schedule retry
    this.scheduleRetry(requestId, retryDelay);

    // Update circuit breaker with failure
    this.recordCircuitBreakerFailure(requestState.componentId, error);

    // Update recovery status
    this.updateRecoveryStatus(requestState.componentId, false);
  }

  /**
   * Handle request timeout
   */
  handleRequestTimeout(requestId: string): void {
    const requestState = this.activeRequests.get(requestId);
    if (!requestState || requestState.isCompleted) {
      return;
    }

    requestState.isTimedOut = true;
    
    const timeoutConfig = this.timeoutConfigurations.get(requestState.componentId);
    if (!timeoutConfig) {
      this.finalizeRequestFailure(requestId, 'Timeout - no configuration');
      return;
    }

    switch (timeoutConfig.timeoutStrategy) {
      case 'fail-fast':
        this.finalizeRequestFailure(requestId, 'Request timeout - fail fast');
        break;
        
      case 'graceful':
        this.handleGracefulTimeout(requestId);
        break;
        
      case 'circuit-breaker':
        this.handleCircuitBreakerTimeout(requestId);
        break;
    }
  }

  /**
   * Handle graceful timeout
   */
  private handleGracefulTimeout(requestId: string): void {
    const requestState = this.activeRequests.get(requestId);
    if (!requestState) return;

    // Try to extend timeout once
    if (requestState.currentAttempt === 1) {
      const timeoutConfig = this.timeoutConfigurations.get(requestState.componentId);
      if (timeoutConfig) {
        const extendedTimeout = timeoutConfig.requestTimeout * 1.5;
        requestState.timeoutTime = Date.now() + extendedTimeout;
        this.setTimeoutTimer(requestId, extendedTimeout);
        return;
      }
    }

    this.finalizeRequestFailure(requestId, 'Request timeout - graceful');
  }

  /**
   * Handle circuit breaker timeout
   */
  private handleCircuitBreakerTimeout(requestId: string): void {
    const requestState = this.activeRequests.get(requestId);
    if (!requestState) return;

    // Open circuit breaker on timeout
    this.openCircuitBreaker(requestState.componentId, 'Request timeout');
    this.finalizeRequestFailure(requestId, 'Request timeout - circuit breaker opened');
  }

  /**
   * Finalize request failure
   */
  private finalizeRequestFailure(requestId: string, error: string): void {
    const requestState = this.activeRequests.get(requestId);
    if (!requestState) return;

    requestState.isCompleted = true;
    requestState.lastError = error;

    // Clear timers
    this.clearTimeoutTimer(requestId);
    this.clearRetryTimer(requestId);

    // Emit failure event
    this.eventScheduler.scheduleEvent({
      id: `request_failure_${requestId}`,
      timestamp: Date.now(),
      type: 'request_completion',
      componentId: requestState.componentId,
      data: {
        requestId,
        success: false,
        error,
        attempts: requestState.currentAttempt,
        retryHistory: requestState.retryHistory
      }
    });

    // Clean up request state
    this.activeRequests.delete(requestId);
  }

  /**
   * Calculate retry delay with exponential backoff
   * Implements SRS FR-4.4: Exponential backoff
   */
  private calculateRetryDelay(requestState: RequestState, retryConfig: RetryConfiguration): number {
    const attemptNumber = requestState.currentAttempt - 1; // 0-based for calculation
    let delay = retryConfig.initialDelay * Math.pow(retryConfig.backoffMultiplier, attemptNumber);
    
    // Cap at max delay
    delay = Math.min(delay, retryConfig.maxDelay);
    
    // Add jitter if enabled
    if (retryConfig.jitterEnabled) {
      const jitter = delay * retryConfig.jitterRange * (Math.random() - 0.5);
      delay += jitter;
    }
    
    return Math.max(0, delay);
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: string, retryConfig: RetryConfiguration): boolean {
    // Check non-retryable errors first
    if (retryConfig.nonRetryableErrors.some(nonRetryable => error.includes(nonRetryable))) {
      return false;
    }
    
    // Check retryable errors
    if (retryConfig.retryableErrors.length > 0) {
      return retryConfig.retryableErrors.some(retryable => error.includes(retryable));
    }
    
    // Default: most errors are retryable except for specific ones
    const defaultNonRetryableErrors = ['400', '401', '403', '404', '422'];
    return !defaultNonRetryableErrors.some(nonRetryable => error.includes(nonRetryable));
  }

  /**
   * Check if circuit breaker allows processing requests
   */
  private canProcessRequest(componentId: string): boolean {
    const circuitBreakerState = this.circuitBreakerStates.get(componentId);
    if (!circuitBreakerState) return true;

    const now = Date.now();

    switch (circuitBreakerState.state) {
      case 'CLOSED':
        return true;
        
      case 'OPEN':
        if (now >= circuitBreakerState.nextAttemptTime) {
          this.transitionToHalfOpen(componentId);
          return true;
        }
        return false;
        
      case 'HALF_OPEN':
        const config = this.getCircuitBreakerConfig(componentId);
        const maxCalls = config?.halfOpenMaxCalls || 1;
        return circuitBreakerState.halfOpenCallCount < maxCalls;
    }
  }

  /**
   * Record circuit breaker success
   */
  private recordCircuitBreakerSuccess(componentId: string, responseTime: number): void {
    const circuitBreakerState = this.circuitBreakerStates.get(componentId);
    if (!circuitBreakerState) return;

    circuitBreakerState.successCount++;
    circuitBreakerState.totalSuccesses++;
    circuitBreakerState.totalRequests++;
    circuitBreakerState.lastSuccessTime = Date.now();
    
    // Update failure rate
    circuitBreakerState.failureRate = circuitBreakerState.totalFailures / circuitBreakerState.totalRequests;

    if (circuitBreakerState.state === 'HALF_OPEN') {
      circuitBreakerState.halfOpenCallCount++;
      
      const config = this.getCircuitBreakerConfig(componentId);
      if (config && circuitBreakerState.successCount >= config.successThreshold) {
        this.closeCircuitBreaker(componentId);
      }
    }
  }

  /**
   * Record circuit breaker failure
   */
  private recordCircuitBreakerFailure(componentId: string, error: string): void {
    const circuitBreakerState = this.circuitBreakerStates.get(componentId);
    if (!circuitBreakerState) return;

    circuitBreakerState.failureCount++;
    circuitBreakerState.totalFailures++;
    circuitBreakerState.totalRequests++;
    circuitBreakerState.lastFailureTime = Date.now();
    
    // Update failure rate
    circuitBreakerState.failureRate = circuitBreakerState.totalFailures / circuitBreakerState.totalRequests;

    const config = this.getCircuitBreakerConfig(componentId);
    if (!config) return;

    if (circuitBreakerState.state === 'CLOSED' && 
        circuitBreakerState.failureCount >= config.failureThreshold) {
      this.openCircuitBreaker(componentId, error);
    } else if (circuitBreakerState.state === 'HALF_OPEN') {
      this.openCircuitBreaker(componentId, error);
    }
  }

  /**
   * Record circuit breaker rejection
   */
  private recordCircuitBreakerRejection(componentId: string): void {
    const circuitBreakerState = this.circuitBreakerStates.get(componentId);
    if (!circuitBreakerState) return;

    circuitBreakerState.totalRequests++;
    // Rejections don't count as failures for failure rate calculation
  }

  /**
   * Open circuit breaker
   */
  private openCircuitBreaker(componentId: string, reason: string): void {
    const circuitBreakerState = this.circuitBreakerStates.get(componentId);
    const config = this.getCircuitBreakerConfig(componentId);
    
    if (!circuitBreakerState || !config) return;

    circuitBreakerState.state = 'OPEN';
    circuitBreakerState.nextAttemptTime = Date.now() + config.timeout;
    circuitBreakerState.halfOpenCallCount = 0;

    // Emit circuit breaker opened event
    this.eventScheduler.scheduleEvent({
      id: `circuit_breaker_opened_${componentId}`,
      timestamp: Date.now(),
      type: 'component_failure',
      componentId,
      data: {
        type: 'circuit_breaker_opened',
        reason,
        failureCount: circuitBreakerState.failureCount,
        failureRate: circuitBreakerState.failureRate
      }
    });
  }

  /**
   * Close circuit breaker
   */
  private closeCircuitBreaker(componentId: string): void {
    const circuitBreakerState = this.circuitBreakerStates.get(componentId);
    if (!circuitBreakerState) return;

    circuitBreakerState.state = 'CLOSED';
    circuitBreakerState.failureCount = 0;
    circuitBreakerState.successCount = 0;
    circuitBreakerState.halfOpenCallCount = 0;

    // Emit circuit breaker closed event
    this.eventScheduler.scheduleEvent({
      id: `circuit_breaker_closed_${componentId}`,
      timestamp: Date.now(),
      type: 'component_recovery',
      componentId,
      data: {
        type: 'circuit_breaker_closed',
        totalRequests: circuitBreakerState.totalRequests,
        totalSuccesses: circuitBreakerState.totalSuccesses,
        failureRate: circuitBreakerState.failureRate
      }
    });
  }

  /**
   * Transition circuit breaker to half-open state
   */
  private transitionToHalfOpen(componentId: string): void {
    const circuitBreakerState = this.circuitBreakerStates.get(componentId);
    if (!circuitBreakerState) return;

    circuitBreakerState.state = 'HALF_OPEN';
    circuitBreakerState.halfOpenCallCount = 0;
    circuitBreakerState.successCount = 0;

    // Emit circuit breaker half-open event
    this.eventScheduler.scheduleEvent({
      id: `circuit_breaker_half_open_${componentId}`,
      timestamp: Date.now(),
      type: 'recovery_check',
      componentId,
      data: {
        type: 'circuit_breaker_half_open'
      }
    });
  }

  /**
   * Start health checking for a component
   * Implements SRS FR-4.4: Failure detection and recovery
   */
  private startHealthChecking(componentId: string): void {
    const config = this.failureDetectionConfigs.get(componentId);
    if (!config) return;

    // Schedule periodic health checks
    const scheduleHealthCheck = () => {
      this.eventScheduler.scheduleEvent({
        id: `health_check_${componentId}_${Date.now()}`,
        timestamp: Date.now() + config.healthCheckInterval,
        type: 'recovery_check',
        componentId,
        data: {
          type: 'health_check'
        }
      });
    };

    scheduleHealthCheck();
    
    // Set up recurring health checks
    setInterval(scheduleHealthCheck, config.healthCheckInterval);
  }

  /**
   * Update recovery status
   */
  private updateRecoveryStatus(componentId: string, success: boolean): void {
    const recoveryStatus = this.recoveryStatuses.get(componentId);
    if (!recoveryStatus) return;

    if (success) {
      recoveryStatus.consecutiveSuccesses++;
      if (recoveryStatus.isRecovering && 
          recoveryStatus.consecutiveSuccesses >= recoveryStatus.requiredSuccesses) {
        this.completeRecovery(componentId);
      }
    } else {
      recoveryStatus.consecutiveSuccesses = 0;
      if (!recoveryStatus.isRecovering) {
        this.startRecovery(componentId);
      }
    }
  }

  /**
   * Start recovery process
   */
  private startRecovery(componentId: string): void {
    const recoveryStatus = this.recoveryStatuses.get(componentId);
    if (!recoveryStatus) return;

    recoveryStatus.isRecovering = true;
    recoveryStatus.recoveryStartTime = Date.now();
    recoveryStatus.consecutiveSuccesses = 0;

    // Emit recovery started event
    this.eventScheduler.scheduleEvent({
      id: `recovery_started_${componentId}`,
      timestamp: Date.now(),
      type: 'recovery_check',
      componentId,
      data: {
        type: 'recovery_started'
      }
    });
  }

  /**
   * Complete recovery process
   */
  private completeRecovery(componentId: string): void {
    const recoveryStatus = this.recoveryStatuses.get(componentId);
    if (!recoveryStatus) return;

    recoveryStatus.isRecovering = false;
    const recoveryDuration = Date.now() - recoveryStatus.recoveryStartTime;

    // Emit recovery completed event
    this.eventScheduler.scheduleEvent({
      id: `recovery_completed_${componentId}`,
      timestamp: Date.now(),
      type: 'component_recovery',
      componentId,
      data: {
        type: 'recovery_completed',
        recoveryDuration,
        consecutiveSuccesses: recoveryStatus.consecutiveSuccesses
      }
    });
  }

  /**
   * Timer management methods
   */
  private setTimeoutTimer(requestId: string, timeoutMs: number): void {
    this.clearTimeoutTimer(requestId);
    
    const timer = setTimeout(() => {
      this.handleRequestTimeout(requestId);
    }, timeoutMs);
    
    this.timeoutTimers.set(requestId, timer);
  }

  private clearTimeoutTimer(requestId: string): void {
    const timer = this.timeoutTimers.get(requestId);
    if (timer) {
      clearTimeout(timer);
      this.timeoutTimers.delete(requestId);
    }
  }

  private scheduleRetry(requestId: string, delayMs: number): void {
    this.clearRetryTimer(requestId);
    
    const timer = setTimeout(() => {
      this.attemptRequest(requestId);
    }, delayMs);
    
    this.retryTimers.set(requestId, timer);
  }

  private clearRetryTimer(requestId: string): void {
    const timer = this.retryTimers.get(requestId);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(requestId);
    }
  }

  /**
   * Configuration creation methods
   */
  private createRetryConfiguration(node: SystemGraphNode): RetryConfiguration {
    const baseConfig: RetryConfiguration = {
      maxRetries: 3,
      initialDelay: 1000, // 1 second
      maxDelay: 30000, // 30 seconds
      backoffMultiplier: 2.0,
      jitterEnabled: true,
      jitterRange: 0.1, // 10% jitter
      retryableErrors: ['timeout', '500', '502', '503', '504'],
      nonRetryableErrors: ['400', '401', '403', '404', '422']
    };

    // Adjust based on component type
    switch (node.type) {
      case 'Database':
        baseConfig.maxRetries = 2;
        baseConfig.initialDelay = 2000;
        baseConfig.maxDelay = 60000;
        break;
      case 'Cache':
        baseConfig.maxRetries = 5;
        baseConfig.initialDelay = 100;
        baseConfig.maxDelay = 5000;
        break;
      case 'Queue':
        baseConfig.maxRetries = 10;
        baseConfig.initialDelay = 500;
        break;
    }

    return baseConfig;
  }

  private createTimeoutConfiguration(node: SystemGraphNode): TimeoutConfiguration {
    const baseConfig: TimeoutConfiguration = {
      requestTimeout: 30000, // 30 seconds
      connectionTimeout: 5000, // 5 seconds
      readTimeout: 30000, // 30 seconds
      writeTimeout: 30000, // 30 seconds
      keepAliveTimeout: 60000, // 60 seconds
      timeoutStrategy: 'circuit-breaker'
    };

    // Adjust based on component type
    switch (node.type) {
      case 'Database':
        baseConfig.requestTimeout = 60000;
        baseConfig.connectionTimeout = 10000;
        break;
      case 'Cache':
        baseConfig.requestTimeout = 5000;
        baseConfig.connectionTimeout = 1000;
        baseConfig.timeoutStrategy = 'fail-fast';
        break;
      case 'SearchIndex':
        baseConfig.requestTimeout = 45000;
        baseConfig.timeoutStrategy = 'graceful';
        break;
    }

    return baseConfig;
  }

  private createCircuitBreakerConfiguration(node: SystemGraphNode): CircuitBreakerConfiguration {
    return {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 60000, // 60 seconds
      monitoringWindow: 300000, // 5 minutes
      halfOpenMaxCalls: 3
    };
  }

  private createFailureDetectionConfiguration(node: SystemGraphNode): FailureDetectionConfig {
    return {
      healthCheckInterval: 30000, // 30 seconds
      healthCheckTimeout: 5000, // 5 seconds
      consecutiveFailuresThreshold: 3,
      recoveryCheckInterval: 10000, // 10 seconds
      enableAdaptiveTimeout: true,
      adaptiveTimeoutFactor: 1.5
    };
  }

  private initializeCircuitBreakerState(componentId: string, config: CircuitBreakerConfiguration): void {
    this.circuitBreakerStates.set(componentId, {
      componentId,
      state: 'CLOSED',
      failureCount: 0,
      successCount: 0,
      lastFailureTime: 0,
      lastSuccessTime: 0,
      nextAttemptTime: 0,
      halfOpenCallCount: 0,
      totalRequests: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      failureRate: 0
    });
  }

  private initializeRecoveryStatus(componentId: string): void {
    this.recoveryStatuses.set(componentId, {
      componentId,
      isRecovering: false,
      recoveryStartTime: 0,
      consecutiveSuccesses: 0,
      requiredSuccesses: 3,
      lastHealthCheck: 0,
      healthCheckResults: []
    });
  }

  private getCircuitBreakerConfig(componentId: string): CircuitBreakerConfiguration | undefined {
    return this.circuitBreakerConfigurations.get(componentId);
  }

  /**
   * Public API methods
   */
  getRequestState(requestId: string): RequestState | undefined {
    return this.activeRequests.get(requestId);
  }

  getCircuitBreakerStatus(componentId: string): CircuitBreakerStatus | undefined {
    return this.circuitBreakerStates.get(componentId);
  }

  getRecoveryStatus(componentId: string): RecoveryStatus | undefined {
    return this.recoveryStatuses.get(componentId);
  }

  getAllCircuitBreakerStatuses(): Map<string, CircuitBreakerStatus> {
    return new Map(this.circuitBreakerStates);
  }

  getActiveRequestCount(): number {
    return this.activeRequests.size;
  }

  /**
   * Clear all state
   */
  clear(): void {
    // Clear all timers
    for (const timer of this.timeoutTimers.values()) {
      clearTimeout(timer);
    }
    for (const timer of this.retryTimers.values()) {
      clearTimeout(timer);
    }

    this.retryConfigurations.clear();
    this.timeoutConfigurations.clear();
    this.circuitBreakerConfigurations.clear();
    this.failureDetectionConfigs.clear();
    this.activeRequests.clear();
    this.circuitBreakerStates.clear();
    this.recoveryStatuses.clear();
    this.timeoutTimers.clear();
    this.retryTimers.clear();
  }
}