/**
 * API Gateway Component Model - Enhanced for System Graph Engine
 * 
 * Models API Gateway behavior including rate limiting, authentication overhead,
 * request routing, and protocol translation.
 */

import { BaseComponentModel } from './BaseComponentModel';
import { ComponentConfig, SimulationRequest, SimulationResponse, ComponentType } from '../../types';

export interface APIGatewayConfiguration extends ComponentConfig {
  rateLimitRps: number; // requests per second limit
  authenticationEnabled: boolean;
  authenticationLatency: number; // additional latency for auth
  routingRules: RoutingRule[];
  protocolTranslation: boolean;
  circuitBreakerEnabled: boolean;
  circuitBreakerThreshold: number; // error rate threshold (0-1)
}

export interface RoutingRule {
  path: string;
  targetService: string;
  weight: number; // for load balancing
  timeout: number;
}

export class APIGatewayModel extends BaseComponentModel {
  private requestCounts: Map<string, number> = new Map(); // clientId -> request count
  private lastResetTime: number = Date.now();
  private circuitBreakerOpen: boolean = false;
  private circuitBreakerOpenTime: number = 0;
  private recentErrors: number[] = []; // sliding window of error timestamps

  constructor(id: string, configuration: APIGatewayConfiguration) {
    super(id, 'proxy' as ComponentType, configuration);
  }

  async processRequest(request: SimulationRequest): Promise<SimulationResponse> {
    this.totalRequests++;
    this.currentLoad++;

    try {
      const config = this.configuration as APIGatewayConfiguration;
      
      // Check circuit breaker
      if (this.circuitBreakerOpen) {
        if (Date.now() - this.circuitBreakerOpenTime > 30000) { // 30 second timeout
          this.circuitBreakerOpen = false;
          this.recentErrors = [];
        } else {
          return this.createFailureResponse(request, 1, 'Circuit breaker open');
        }
      }

      // Rate limiting check
      if (!this.checkRateLimit(request)) {
        return this.createFailureResponse(request, 1, 'Rate limit exceeded');
      }

      // Authentication overhead
      let authLatency = 0;
      if (config.authenticationEnabled) {
        authLatency = config.authenticationLatency || 10;
        
        // Simulate authentication failure
        if (Math.random() < 0.02) { // 2% auth failure rate
          return this.createFailureResponse(request, authLatency, 'Authentication failed');
        }
      }

      // Route selection
      const route = this.selectRoute(request);
      if (!route) {
        return this.createFailureResponse(request, 5, 'No route found');
      }

      // Protocol translation overhead
      let protocolLatency = 0;
      if (config.protocolTranslation) {
        protocolLatency = 2; // 2ms overhead for protocol translation
      }

      // Check for general failures
      if (this.shouldRequestFail()) {
        this.recordError();
        return this.createFailureResponse(request, this.calculateLatency(), 'Gateway processing error');
      }

      const totalLatency = this.calculateLatency() + authLatency + protocolLatency;
      await this.simulateProcessingDelay(totalLatency);

      return this.createSuccessResponse(request, totalLatency, {
        route: route.path,
        targetService: route.targetService,
        authenticated: config.authenticationEnabled
      });

    } finally {
      this.currentLoad = Math.max(0, this.currentLoad - 1);
    }
  }

  /**
   * Check rate limiting for the request
   */
  private checkRateLimit(request: SimulationRequest): boolean {
    const config = this.configuration as APIGatewayConfiguration;
    const clientId = request.payload?.clientId || 'anonymous';
    const now = Date.now();
    
    // Reset counters every second
    if (now - this.lastResetTime > 1000) {
      this.requestCounts.clear();
      this.lastResetTime = now;
    }

    const currentCount = this.requestCounts.get(clientId) || 0;
    
    if (currentCount >= config.rateLimitRps) {
      return false;
    }

    this.requestCounts.set(clientId, currentCount + 1);
    return true;
  }

  /**
   * Select routing rule for the request
   */
  private selectRoute(request: SimulationRequest): RoutingRule | null {
    const config = this.configuration as APIGatewayConfiguration;
    const requestPath = request.payload?.path || '/';

    // Find matching routes
    const matchingRoutes = config.routingRules.filter(rule => 
      requestPath.startsWith(rule.path)
    );

    if (matchingRoutes.length === 0) {
      return null;
    }

    // Weighted random selection
    const totalWeight = matchingRoutes.reduce((sum, route) => sum + route.weight, 0);
    let random = Math.random() * totalWeight;

    for (const route of matchingRoutes) {
      random -= route.weight;
      if (random <= 0) {
        return route;
      }
    }

    return matchingRoutes[0]; // Fallback
  }

  /**
   * Record an error for circuit breaker logic
   */
  private recordError(): void {
    const config = this.configuration as APIGatewayConfiguration;
    
    if (!config.circuitBreakerEnabled) return;

    const now = Date.now();
    this.recentErrors.push(now);

    // Keep only errors from the last 60 seconds
    this.recentErrors = this.recentErrors.filter(timestamp => now - timestamp < 60000);

    // Check if we should open the circuit breaker
    const errorRate = this.recentErrors.length / Math.max(1, this.totalRequests);
    if (errorRate > config.circuitBreakerThreshold) {
      this.circuitBreakerOpen = true;
      this.circuitBreakerOpenTime = now;
    }
  }

  /**
   * Get current rate limiting status
   */
  getRateLimitStatus(): { [clientId: string]: number } {
    return Object.fromEntries(this.requestCounts);
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(): { open: boolean, errorRate: number, recentErrors: number } {
    const errorRate = this.totalRequests > 0 ? this.recentErrors.length / this.totalRequests : 0;
    return {
      open: this.circuitBreakerOpen,
      errorRate,
      recentErrors: this.recentErrors.length
    };
  }
}