/**
 * Client Component Model - Enhanced for System Graph Engine
 * 
 * Models client-side behavior including session management, connection pooling,
 * and realistic user interaction patterns.
 */

import { BaseComponentModel } from './BaseComponentModel';
import { ComponentConfig, SimulationRequest, SimulationResponse, ComponentType } from '../../types';

export interface ClientConfiguration extends ComponentConfig {
  sessionTimeout: number; // milliseconds
  connectionPoolSize: number;
  cachingEnabled: boolean;
  retryAttempts: number;
  userBehaviorPattern: 'burst' | 'steady' | 'random';
}

export class ClientModel extends BaseComponentModel {
  private activeSessions: Map<string, number> = new Map(); // sessionId -> timestamp
  private connectionPool: number = 0;
  private cacheHitRate: number = 0.8; // 80% cache hit rate by default

  constructor(id: string, configuration: ClientConfiguration) {
    super(id, 'web-server' as ComponentType, configuration);
    this.connectionPool = configuration.connectionPoolSize || 10;
  }

  async processRequest(request: SimulationRequest): Promise<SimulationResponse> {
    this.totalRequests++;
    this.currentLoad++;

    try {
      // Simulate session management
      const sessionId = this.getOrCreateSession(request);
      
      // Check cache if enabled
      if ((this.configuration as ClientConfiguration).cachingEnabled && Math.random() < this.cacheHitRate) {
        // Cache hit - much faster response
        const latency = this.calculateLatency() * 0.1; // 10% of normal latency
        await this.simulateProcessingDelay(latency);
        
        return this.createSuccessResponse(request, latency, { 
          cached: true, 
          sessionId 
        });
      }

      // Check connection pool availability
      if (this.connectionPool <= 0) {
        return this.createFailureResponse(request, 0, 'Connection pool exhausted');
      }

      this.connectionPool--;
      
      // Simulate processing with potential failures
      if (this.shouldRequestFail()) {
        this.connectionPool++; // Return connection to pool
        return this.createFailureResponse(request, this.calculateLatency(), 'Client-side error');
      }

      const latency = this.calculateLatency();
      await this.simulateProcessingDelay(latency);

      this.connectionPool++; // Return connection to pool
      
      return this.createSuccessResponse(request, latency, { 
        sessionId,
        connectionPoolUsage: (this.configuration as ClientConfiguration).connectionPoolSize - this.connectionPool
      });

    } finally {
      this.currentLoad = Math.max(0, this.currentLoad - 1);
    }
  }

  /**
   * Get or create a session for the request
   */
  private getOrCreateSession(request: SimulationRequest): string {
    const sessionId = request.payload?.sessionId || `session_${Date.now()}_${Math.random()}`;
    const now = Date.now();
    const sessionTimeout = (this.configuration as ClientConfiguration).sessionTimeout || 30000;

    // Clean up expired sessions
    for (const [id, timestamp] of this.activeSessions.entries()) {
      if (now - timestamp > sessionTimeout) {
        this.activeSessions.delete(id);
      }
    }

    // Update or create session
    this.activeSessions.set(sessionId, now);
    
    return sessionId;
  }

  /**
   * Get current session count
   */
  getActiveSessionCount(): number {
    return this.activeSessions.size;
  }

  /**
   * Get connection pool utilization
   */
  getConnectionPoolUtilization(): number {
    const maxConnections = (this.configuration as ClientConfiguration).connectionPoolSize || 10;
    return (maxConnections - this.connectionPool) / maxConnections;
  }

  /**
   * Update cache hit rate based on system conditions
   */
  updateCacheHitRate(hitRate: number): void {
    this.cacheHitRate = Math.max(0, Math.min(1, hitRate));
  }
}