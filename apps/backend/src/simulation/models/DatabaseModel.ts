/**
 * Database component simulation model
 * Simulates realistic database behavior including connection pooling, query processing, and caching
 */

import { BaseComponentModel } from './BaseComponentModel';
import { SimulationRequest, SimulationResponse } from '../../types';

interface DatabaseConfig {
  capacity: number;
  latency: number;
  failureRate: number;
  connectionPoolSize: number;
  cacheHitRatio: number;
  queryComplexity: 'simple' | 'medium' | 'complex';
  indexEfficiency: number; // 0-1, affects query performance
}

export class DatabaseModel extends BaseComponentModel {
  private connectionPool: number = 0;
  private cache: Map<string, any> = new Map();
  private readonly maxCacheSize: number = 1000;

  constructor(id: string, configuration: DatabaseConfig) {
    super(id, 'database', configuration);
    this.connectionPool = configuration.connectionPoolSize || 10;
  }

  async processRequest(request: SimulationRequest): Promise<SimulationResponse> {
    this.totalRequests++;
    this.currentLoad++;
    this.queueDepth++;

    try {
      // Check if we have available connections
      if (this.connectionPool <= 0) {
        this.queueDepth--;
        return this.createFailureResponse(request, 0, 'No available database connections');
      }

      // Acquire connection
      this.connectionPool--;

      // Check for cache hit
      const cacheKey = this.generateCacheKey(request);
      const isCacheHit = this.cache.has(cacheKey) && Math.random() < this.getDatabaseConfig().cacheHitRatio;

      let latency: number;
      if (isCacheHit) {
        // Cache hit - much faster response
        latency = this.calculateLatency() * 0.1; // 10% of normal latency
      } else {
        // Cache miss - full database query
        latency = this.calculateDatabaseQueryLatency(request);
        
        // Store in cache if there's space
        if (this.cache.size < this.maxCacheSize) {
          this.cache.set(cacheKey, request.payload);
        }
      }

      // Simulate processing delay
      await this.simulateProcessingDelay(latency);

      // Release connection
      this.connectionPool++;
      this.currentLoad--;
      this.queueDepth--;

      // Check for failure
      if (this.shouldRequestFail()) {
        return this.createFailureResponse(request, latency, 'Database query failed');
      }

      // Successful response
      const responsePayload = {
        queryResult: this.generateQueryResult(request),
        cacheHit: isCacheHit,
        executionTime: latency
      };

      return this.createSuccessResponse(request, latency, responsePayload);

    } catch (error) {
      this.connectionPool++;
      this.currentLoad--;
      this.queueDepth--;
      return this.createFailureResponse(request, 0, `Database error: ${error}`);
    }
  }

  /**
   * Calculate database-specific query latency
   */
  private calculateDatabaseQueryLatency(request: SimulationRequest): number {
    const baseLatency = this.calculateLatency();
    const config = this.getDatabaseConfig();
    
    // Adjust latency based on query complexity
    let complexityMultiplier = 1;
    switch (config.queryComplexity) {
      case 'simple':
        complexityMultiplier = 0.5;
        break;
      case 'medium':
        complexityMultiplier = 1.0;
        break;
      case 'complex':
        complexityMultiplier = 2.5;
        break;
    }

    // Adjust for index efficiency
    const indexMultiplier = 1 + (1 - config.indexEfficiency);

    // Adjust for current load (connection contention)
    const loadMultiplier = 1 + (this.currentLoad / this.configuration.capacity) * 0.5;

    return baseLatency * complexityMultiplier * indexMultiplier * loadMultiplier;
  }

  /**
   * Generate cache key for request
   */
  private generateCacheKey(request: SimulationRequest): string {
    return `${request.sourceComponentId}-${JSON.stringify(request.payload)}`;
  }

  /**
   * Generate mock query result
   */
  private generateQueryResult(request: SimulationRequest): any {
    return {
      rows: Math.floor(Math.random() * 100) + 1,
      executionPlan: 'index_scan',
      affectedRows: Math.floor(Math.random() * 10)
    };
  }

  /**
   * Get database-specific configuration
   */
  private getDatabaseConfig(): DatabaseConfig {
    return this.configuration as DatabaseConfig;
  }

  /**
   * Override metrics to include database-specific metrics
   */
  getMetrics() {
    const baseMetrics = super.getMetrics();
    const config = this.getDatabaseConfig();
    
    return {
      ...baseMetrics,
      connectionPoolUtilization: 1 - (this.connectionPool / config.connectionPoolSize),
      cacheHitRatio: config.cacheHitRatio,
      cacheSize: this.cache.size,
      activeConnections: config.connectionPoolSize - this.connectionPool
    };
  }

  /**
   * Handle database-specific failures
   */
  handleFailure(failureType: string): void {
    super.handleFailure(failureType);
    
    switch (failureType) {
      case 'connection_timeout':
        this.connectionPool = Math.floor(this.connectionPool * 0.5); // Lose half connections
        break;
      case 'disk_full':
        // Simulate read-only mode
        break;
      case 'corruption':
        this.cache.clear(); // Clear cache on corruption
        break;
    }
  }
}