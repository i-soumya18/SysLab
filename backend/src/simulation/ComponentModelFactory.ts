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