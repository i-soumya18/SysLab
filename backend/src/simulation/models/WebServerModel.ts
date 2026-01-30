/**
 * Web Server component simulation model
 * Simulates realistic web server behavior including request processing, connection handling, and resource utilization
 */

import { BaseComponentModel } from './BaseComponentModel';
import { SimulationRequest, SimulationResponse } from '../../types';

interface WebServerConfig {
  capacity: number;
  latency: number;
  failureRate: number;
  maxConnections: number;
  keepAliveTimeout: number; // milliseconds
  requestTimeout: number; // milliseconds
  staticContentRatio: number; // 0-1, ratio of static vs dynamic content
  compressionEnabled: boolean;
}

interface ActiveConnection {
  id: string;
  startTime: number;
  requestCount: number;
  keepAlive: boolean;
}

export class WebServerModel extends BaseComponentModel {
  private activeConnections: Map<string, ActiveConnection> = new Map();
  private staticContentCache: Map<string, any> = new Map();

  constructor(id: string, configuration: WebServerConfig) {
    super(id, 'web-server', configuration);
    this.initializeStaticContent();
  }

  async processRequest(request: SimulationRequest): Promise<SimulationResponse> {
    this.totalRequests++;
    this.currentLoad++;
    this.queueDepth++;

    try {
      const config = this.getWebServerConfig();
      
      // Check connection limits
      if (this.activeConnections.size >= config.maxConnections) {
        this.currentLoad--;
        this.queueDepth--;
        return this.createFailureResponse(request, 0, 'Server connection limit exceeded');
      }

      // Create or reuse connection
      const connection = this.getOrCreateConnection(request);
      
      // Determine content type
      const isStaticContent = Math.random() < config.staticContentRatio;
      
      // Calculate processing time
      const processingTime = this.calculateProcessingTime(isStaticContent, request);
      
      // Check for request timeout
      if (processingTime > config.requestTimeout) {
        this.releaseConnection(connection.id);
        this.currentLoad--;
        this.queueDepth--;
        return this.createFailureResponse(request, config.requestTimeout, 'Request timeout');
      }

      // Simulate processing
      await this.simulateProcessingDelay(processingTime);

      // Update connection
      connection.requestCount++;
      
      // Determine if connection should be kept alive
      const shouldKeepAlive = this.shouldKeepConnectionAlive(connection);
      if (!shouldKeepAlive) {
        this.releaseConnection(connection.id);
      }

      this.currentLoad--;
      this.queueDepth--;

      // Check for processing failure
      if (this.shouldRequestFail()) {
        return this.createFailureResponse(request, processingTime, 'Server processing error');
      }

      // Generate response
      const responsePayload = this.generateResponsePayload(isStaticContent, request, processingTime);
      
      return this.createSuccessResponse(request, processingTime, responsePayload);

    } catch (error) {
      this.currentLoad--;
      this.queueDepth--;
      return this.createFailureResponse(request, 0, `Web server error: ${error}`);
    }
  }

  /**
   * Get or create connection for request
   */
  private getOrCreateConnection(request: SimulationRequest): ActiveConnection {
    const connectionId = this.generateConnectionId(request);
    
    let connection = this.activeConnections.get(connectionId);
    if (!connection) {
      connection = {
        id: connectionId,
        startTime: Date.now(),
        requestCount: 0,
        keepAlive: true
      };
      this.activeConnections.set(connectionId, connection);
    }
    
    return connection;
  }

  /**
   * Generate connection ID (simplified)
   */
  private generateConnectionId(request: SimulationRequest): string {
    // In reality, this would be based on client IP and port
    return `conn-${request.sourceComponentId}-${Math.floor(Date.now() / 10000)}`;
  }

  /**
   * Calculate processing time based on content type and server load
   */
  private calculateProcessingTime(isStaticContent: boolean, request: SimulationRequest): number {
    const baseLatency = this.calculateLatency();
    
    if (isStaticContent) {
      // Static content is much faster
      return baseLatency * 0.2;
    } else {
      // Dynamic content processing
      const complexityFactor = this.estimateRequestComplexity(request);
      const loadFactor = Math.max(1, this.currentLoad / this.configuration.capacity);
      
      return baseLatency * complexityFactor * loadFactor;
    }
  }

  /**
   * Estimate request complexity for dynamic content
   */
  private estimateRequestComplexity(request: SimulationRequest): number {
    // Simplified complexity estimation based on payload size
    const payloadSize = JSON.stringify(request.payload).length;
    
    if (payloadSize < 100) return 0.5; // Simple request
    if (payloadSize < 1000) return 1.0; // Medium request
    return 2.0; // Complex request
  }

  /**
   * Determine if connection should be kept alive
   */
  private shouldKeepConnectionAlive(connection: ActiveConnection): boolean {
    const config = this.getWebServerConfig();
    const connectionAge = Date.now() - connection.startTime;
    
    // Close connection if it's too old or has handled too many requests
    if (connectionAge > config.keepAliveTimeout || connection.requestCount > 100) {
      return false;
    }
    
    // Close connection under high load
    const loadRatio = this.activeConnections.size / config.maxConnections;
    if (loadRatio > 0.8 && Math.random() < 0.3) {
      return false;
    }
    
    return true;
  }

  /**
   * Release connection
   */
  private releaseConnection(connectionId: string): void {
    this.activeConnections.delete(connectionId);
  }

  /**
   * Generate response payload
   */
  private generateResponsePayload(isStaticContent: boolean, request: SimulationRequest, processingTime: number): any {
    const config = this.getWebServerConfig();
    
    const response: any = {
      contentType: isStaticContent ? 'static' : 'dynamic',
      processingTime,
      compressed: config.compressionEnabled,
      cacheHit: isStaticContent && this.staticContentCache.has(this.generateCacheKey(request)),
      connectionReused: this.activeConnections.has(this.generateConnectionId(request)),
      serverLoad: this.currentLoad / this.configuration.capacity
    };

    // Add content-specific data
    if (isStaticContent) {
      response.contentSize = Math.floor(Math.random() * 50000) + 1000; // 1KB - 50KB
      response.cacheControl = 'max-age=3600';
    } else {
      response.contentSize = Math.floor(Math.random() * 10000) + 500; // 500B - 10KB
      response.generationTime = processingTime * 0.8; // Most time spent generating content
    }

    return response;
  }

  /**
   * Generate cache key for static content
   */
  private generateCacheKey(request: SimulationRequest): string {
    return `static-${JSON.stringify(request.payload)}`;
  }

  /**
   * Initialize static content cache
   */
  private initializeStaticContent(): void {
    // Pre-populate with some common static content
    const commonFiles = ['index.html', 'style.css', 'app.js', 'logo.png', 'favicon.ico'];
    
    commonFiles.forEach(file => {
      this.staticContentCache.set(file, {
        content: `Mock content for ${file}`,
        size: Math.floor(Math.random() * 100000) + 1000,
        lastModified: Date.now() - Math.random() * 86400000 // Random time in last 24h
      });
    });
  }

  /**
   * Get web server specific configuration
   */
  private getWebServerConfig(): WebServerConfig {
    return this.configuration as WebServerConfig;
  }

  /**
   * Override metrics to include web server specific metrics
   */
  getMetrics() {
    const baseMetrics = super.getMetrics();
    const config = this.getWebServerConfig();
    
    const connectionUtilization = this.activeConnections.size / config.maxConnections;
    const avgConnectionAge = this.calculateAverageConnectionAge();
    const staticContentHitRatio = this.calculateStaticContentHitRatio();
    
    return {
      ...baseMetrics,
      activeConnections: this.activeConnections.size,
      connectionUtilization,
      averageConnectionAge: avgConnectionAge,
      staticContentHitRatio,
      staticCacheSize: this.staticContentCache.size,
      keepAliveConnections: Array.from(this.activeConnections.values()).filter(c => c.keepAlive).length
    };
  }

  /**
   * Calculate average connection age
   */
  private calculateAverageConnectionAge(): number {
    if (this.activeConnections.size === 0) return 0;
    
    const now = Date.now();
    const totalAge = Array.from(this.activeConnections.values())
      .reduce((sum, conn) => sum + (now - conn.startTime), 0);
    
    return totalAge / this.activeConnections.size;
  }

  /**
   * Calculate static content hit ratio
   */
  private calculateStaticContentHitRatio(): number {
    // Simplified calculation - in reality you'd track hits/misses
    const config = this.getWebServerConfig();
    return config.staticContentRatio * 0.8; // Assume 80% of static requests are cache hits
  }

  /**
   * Handle web server specific failures
   */
  handleFailure(failureType: string): void {
    super.handleFailure(failureType);
    
    switch (failureType) {
      case 'memory_leak':
        // Simulate memory pressure by reducing capacity
        this.configuration.capacity *= 0.7;
        break;
      case 'connection_pool_exhaustion':
        // Close some connections
        const connectionsToClose = Math.floor(this.activeConnections.size * 0.3);
        const connectionIds = Array.from(this.activeConnections.keys()).slice(0, connectionsToClose);
        connectionIds.forEach(id => this.releaseConnection(id));
        break;
      case 'static_cache_corruption':
        // Clear static content cache
        this.staticContentCache.clear();
        this.initializeStaticContent();
        break;
      case 'high_cpu':
        // Increase processing latency
        this.configuration.latency *= 1.5;
        break;
    }
  }

  /**
   * Cleanup connections on shutdown
   */
  destroy(): void {
    this.activeConnections.clear();
    this.staticContentCache.clear();
  }
}