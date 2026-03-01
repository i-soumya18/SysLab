/**
 * Factory for creating component behavior models
 */

import { ComponentType, ComponentConfig, ComponentModel } from '../types';
import { 
  BaseComponentModel, 
  DatabaseModel, 
  LoadBalancerModel, 
  CacheModel, 
  WebServerModel 
} from './models';

export class ComponentModelFactory {
  /**
   * Create a component model based on type and configuration
   */
  static createModel(id: string, type: ComponentType, configuration: ComponentConfig): ComponentModel {
    switch (type) {
      case 'database':
        return new DatabaseModel(id, {
          ...configuration,
          connectionPoolSize: configuration.connectionPoolSize || 10,
          cacheHitRatio: configuration.cacheHitRatio || 0.8,
          queryComplexity: configuration.queryComplexity || 'medium',
          indexEfficiency: configuration.indexEfficiency || 0.8
        });

      case 'load-balancer':
        return new LoadBalancerModel(id, {
          ...configuration,
          algorithm: configuration.algorithm || 'round-robin',
          healthCheckInterval: configuration.healthCheckInterval || 5000,
          backendTargets: configuration.backendTargets || []
        });

      case 'cache':
        return new CacheModel(id, {
          ...configuration,
          maxMemory: configuration.maxMemory || 1024 * 1024 * 100, // 100MB default
          evictionPolicy: configuration.evictionPolicy || 'LRU',
          ttl: configuration.ttl || 300000, // 5 minutes default
          hitRatio: configuration.hitRatio || 0.7
        });

      case 'web-server':
        return new WebServerModel(id, {
          ...configuration,
          maxConnections: configuration.maxConnections || 1000,
          keepAliveTimeout: configuration.keepAliveTimeout || 30000,
          requestTimeout: configuration.requestTimeout || 30000,
          staticContentRatio: configuration.staticContentRatio || 0.6,
          compressionEnabled: configuration.compressionEnabled !== false
        });

      case 'message-queue':
        return new MessageQueueModel(id, configuration);

      case 'cdn':
        return new CDNModel(id, configuration);

      case 'proxy':
        return new ProxyModel(id, configuration);

      case 'api-gateway':
        return new ApiGatewayModel(id, configuration);

      case 'search-engine':
        return new SearchEngineModel(id, configuration);

      case 'object-storage':
        return new ObjectStorageModel(id, configuration);

      case 'service-mesh':
        return new ServiceMeshModel(id, configuration);

      case 'rate-limiter':
        return new RateLimiterModel(id, configuration);

      case 'circuit-breaker':
        return new CircuitBreakerModel(id, configuration);

      case 'auth-service':
        return new AuthServiceModel(id, configuration);

      case 'monitoring':
        return new MonitoringModel(id, configuration);

      case 'logging':
        return new LoggingModel(id, configuration);

      case 'client':
        return new ClientModel(id, configuration);

      default:
        throw new Error(`Unsupported component type: ${type}`);
    }
  }
}

/**
 * Placeholder models for components not yet fully implemented
 */
class MessageQueueModel extends BaseComponentModel {
  constructor(id: string, configuration: ComponentConfig) {
    super(id, 'message-queue', configuration);
  }

  async processRequest(request: any): Promise<any> {
    this.totalRequests++;
    const latency = this.calculateLatency();
    await this.simulateProcessingDelay(latency);
    
    return this.createSuccessResponse(request, latency, {
      messageQueued: true,
      queueDepth: this.queueDepth
    });
  }
}

class CDNModel extends BaseComponentModel {
  constructor(id: string, configuration: ComponentConfig) {
    super(id, 'cdn', configuration);
  }

  async processRequest(request: any): Promise<any> {
    this.totalRequests++;
    const latency = this.calculateLatency() * 0.3; // CDN is typically faster
    await this.simulateProcessingDelay(latency);
    
    return this.createSuccessResponse(request, latency, {
      cacheHit: Math.random() > 0.2, // 80% cache hit rate
      edgeLocation: 'edge-' + Math.floor(Math.random() * 10)
    });
  }
}

class ProxyModel extends BaseComponentModel {
  constructor(id: string, configuration: ComponentConfig) {
    super(id, 'proxy', configuration);
  }

  async processRequest(request: any): Promise<any> {
    this.totalRequests++;
    const latency = this.calculateLatency() * 0.8; // Proxy adds some overhead
    await this.simulateProcessingDelay(latency);
    
    return this.createSuccessResponse(request, latency, {
      proxied: true,
      upstreamLatency: latency * 0.7
    });
  }
}

class ApiGatewayModel extends BaseComponentModel {
  constructor(id: string, configuration: ComponentConfig) {
    super(id, 'api-gateway', configuration);
  }

  async processRequest(request: any): Promise<any> {
    this.totalRequests++;
    const latency = this.calculateLatency();
    await this.simulateProcessingDelay(latency);
    
    return this.createSuccessResponse(request, latency, {
      gatewayProcessed: true,
      rateLimited: Math.random() > 0.95, // 5% rate limit chance
      cached: Math.random() > 0.7 // 30% cache hit
    });
  }
}

class SearchEngineModel extends BaseComponentModel {
  constructor(id: string, configuration: ComponentConfig) {
    super(id, 'search-engine', configuration);
  }

  async processRequest(request: any): Promise<any> {
    this.totalRequests++;
    const latency = this.calculateLatency() * 1.2; // Search is typically slower
    await this.simulateProcessingDelay(latency);
    
    return this.createSuccessResponse(request, latency, {
      searchCompleted: true,
      resultsCount: Math.floor(Math.random() * 1000),
      indexed: true
    });
  }
}

class ObjectStorageModel extends BaseComponentModel {
  constructor(id: string, configuration: ComponentConfig) {
    super(id, 'object-storage', configuration);
  }

  async processRequest(request: any): Promise<any> {
    this.totalRequests++;
    const latency = this.calculateLatency() * 2; // Storage operations are slower
    await this.simulateProcessingDelay(latency);
    
    return this.createSuccessResponse(request, latency, {
      stored: true,
      durability: '99.999999999%',
      versioned: true
    });
  }
}

class ServiceMeshModel extends BaseComponentModel {
  constructor(id: string, configuration: ComponentConfig) {
    super(id, 'service-mesh', configuration);
  }

  async processRequest(request: any): Promise<any> {
    this.totalRequests++;
    const latency = this.calculateLatency() * 0.5; // Service mesh adds minimal overhead
    await this.simulateProcessingDelay(latency);
    
    return this.createSuccessResponse(request, latency, {
      meshProcessed: true,
      circuitBreakerOpen: Math.random() > 0.98, // 2% circuit breaker chance
      retried: Math.random() > 0.9 // 10% retry chance
    });
  }
}

class RateLimiterModel extends BaseComponentModel {
  constructor(id: string, configuration: ComponentConfig) {
    super(id, 'rate-limiter', configuration);
  }

  async processRequest(request: any): Promise<any> {
    this.totalRequests++;
    const latency = this.calculateLatency() * 0.1; // Very fast check
    await this.simulateProcessingDelay(latency);
    
    const rateLimited = Math.random() > 0.95; // 5% rate limit chance
    
    if (rateLimited) {
      return this.createErrorResponse(request, latency, 'Rate limit exceeded');
    }
    
    return this.createSuccessResponse(request, latency, {
      rateLimitPassed: true,
      remainingRequests: Math.floor(Math.random() * 1000)
    });
  }
}

class CircuitBreakerModel extends BaseComponentModel {
  constructor(id: string, configuration: ComponentConfig) {
    super(id, 'circuit-breaker', configuration);
  }

  async processRequest(request: any): Promise<any> {
    this.totalRequests++;
    const latency = this.calculateLatency() * 0.1; // Very fast check
    await this.simulateProcessingDelay(latency);
    
    const circuitOpen = Math.random() > 0.98; // 2% circuit open chance
    
    if (circuitOpen) {
      return this.createErrorResponse(request, latency, 'Circuit breaker is open');
    }
    
    return this.createSuccessResponse(request, latency, {
      circuitBreakerPassed: true,
      state: 'closed'
    });
  }
}

class AuthServiceModel extends BaseComponentModel {
  constructor(id: string, configuration: ComponentConfig) {
    super(id, 'auth-service', configuration);
  }

  async processRequest(request: any): Promise<any> {
    this.totalRequests++;
    const latency = this.calculateLatency() * 1.5; // Auth operations take time
    await this.simulateProcessingDelay(latency);
    
    const authenticated = Math.random() > 0.05; // 95% success rate
    
    if (!authenticated) {
      return this.createErrorResponse(request, latency, 'Authentication failed');
    }
    
    return this.createSuccessResponse(request, latency, {
      authenticated: true,
      tokenIssued: true,
      tokenExpiry: Date.now() + 3600000 // 1 hour
    });
  }
}

class MonitoringModel extends BaseComponentModel {
  constructor(id: string, configuration: ComponentConfig) {
    super(id, 'monitoring', configuration);
  }

  async processRequest(request: any): Promise<any> {
    this.totalRequests++;
    const latency = this.calculateLatency() * 0.3; // Monitoring is lightweight
    await this.simulateProcessingDelay(latency);
    
    return this.createSuccessResponse(request, latency, {
      metricsCollected: true,
      alertsTriggered: Math.random() > 0.95 ? 1 : 0,
      dashboardsUpdated: true
    });
  }
}

class LoggingModel extends BaseComponentModel {
  constructor(id: string, configuration: ComponentConfig) {
    super(id, 'logging', configuration);
  }

  async processRequest(request: any): Promise<any> {
    this.totalRequests++;
    const latency = this.calculateLatency() * 0.2; // Logging is very fast
    await this.simulateProcessingDelay(latency);
    
    return this.createSuccessResponse(request, latency, {
      logged: true,
      indexed: true,
      retentionApplied: true
    });
  }
}

class ClientModel extends BaseComponentModel {
  constructor(id: string, configuration: ComponentConfig) {
    super(id, 'client', configuration);
  }

  async processRequest(request: any): Promise<any> {
    this.totalRequests++;
    const latency = this.calculateLatency();
    await this.simulateProcessingDelay(latency);
    
    return this.createSuccessResponse(request, latency, {
      requestSent: true,
      userAgent: configuration.userAgent || 'Unknown'
    });
  }
}