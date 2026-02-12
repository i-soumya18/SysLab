/**
 * Component Library for System Design Simulator
 * Provides predefined component definitions with default configurations and metadata
 */

import type { Component, ComponentType, ComponentConfig, ComponentMetadata } from '../types';

// Client component configurations
export const ClientConfigs = {
  web: {
    capacity: 1000,
    latency: 50,
    failureRate: 0.001,
    connectionPool: 50,
    requestRate: 100,
    userAgent: 'WebClient/1.0'
  },
  mobile: {
    capacity: 500,
    latency: 100,
    failureRate: 0.002,
    connectionPool: 20,
    requestRate: 50,
    userAgent: 'MobileClient/1.0'
  },
  api: {
    capacity: 2000,
    latency: 20,
    failureRate: 0.0005,
    connectionPool: 100,
    requestRate: 200,
    userAgent: 'APIClient/1.0'
  }
};

// Database component configurations
export const DatabaseConfigs = {
  mysql: {
    capacity: 1000,
    latency: 5,
    failureRate: 0.001,
    connectionPool: 100,
    queryCache: true,
    replicationEnabled: false,
    storageType: 'SSD'
  },
  postgresql: {
    capacity: 800,
    latency: 4,
    failureRate: 0.0008,
    connectionPool: 200,
    queryCache: true,
    replicationEnabled: true,
    storageType: 'SSD'
  },
  mongodb: {
    capacity: 1200,
    latency: 3,
    failureRate: 0.0012,
    sharding: true,
    replication: 3,
    indexing: true,
    storageType: 'SSD'
  },
  redis: {
    capacity: 5000,
    latency: 1,
    failureRate: 0.0005,
    memorySize: '8GB',
    persistence: 'RDB',
    clustering: false,
    evictionPolicy: 'allkeys-lru'
  }
};

// Load balancer component configurations
export const LoadBalancerConfigs = {
  nginx: {
    capacity: 10000,
    latency: 1,
    failureRate: 0.0001,
    algorithm: 'round-robin',
    healthCheck: true,
    sslTermination: true,
    compressionEnabled: true
  },
  haproxy: {
    capacity: 8000,
    latency: 1.5,
    failureRate: 0.0002,
    algorithm: 'least-connections',
    healthCheck: true,
    sslTermination: false,
    sessionStickiness: true
  },
  awsAlb: {
    capacity: 50000,
    latency: 2,
    failureRate: 0.00005,
    algorithm: 'weighted-round-robin',
    healthCheck: true,
    sslTermination: true,
    autoScaling: true
  }
};

// Web server component configurations
export const WebServerConfigs = {
  apache: {
    capacity: 2000,
    latency: 10,
    failureRate: 0.002,
    maxConnections: 400,
    keepAlive: true,
    compression: true,
    caching: false
  },
  nginx: {
    capacity: 5000,
    latency: 5,
    failureRate: 0.001,
    maxConnections: 1000,
    keepAlive: true,
    compression: true,
    caching: true
  },
  nodejs: {
    capacity: 3000,
    latency: 8,
    failureRate: 0.0015,
    eventLoop: true,
    clustering: false,
    memoryLimit: '512MB',
    runtime: 'v18'
  }
};

// Cache component configurations
export const CacheConfigs = {
  memcached: {
    capacity: 10000,
    latency: 0.5,
    failureRate: 0.0003,
    memorySize: '4GB',
    hitRatio: 0.85,
    evictionPolicy: 'LRU',
    clustering: true
  },
  redis: {
    capacity: 8000,
    latency: 0.8,
    failureRate: 0.0002,
    memorySize: '8GB',
    hitRatio: 0.90,
    persistence: true,
    clustering: false
  },
  varnish: {
    capacity: 15000,
    latency: 0.3,
    failureRate: 0.0001,
    memorySize: '2GB',
    hitRatio: 0.95,
    httpCache: true,
    compressionEnabled: true
  }
};

// Message queue component configurations
export const MessageQueueConfigs = {
  kafka: {
    capacity: 100000,
    latency: 2,
    failureRate: 0.0001,
    partitions: 10,
    replication: 3,
    retention: '7d',
    compression: 'gzip'
  },
  rabbitmq: {
    capacity: 50000,
    latency: 3,
    failureRate: 0.0002,
    exchanges: 5,
    queues: 20,
    persistence: true,
    clustering: true
  },
  awsSqs: {
    capacity: 300000,
    latency: 5,
    failureRate: 0.00001,
    visibilityTimeout: 30,
    messageRetention: '14d',
    dlq: true,
    fifo: false
  }
};

// CDN component configurations
export const CdnConfigs = {
  cloudflare: {
    capacity: 1000000,
    latency: 50,
    failureRate: 0.00001,
    edgeLocations: 200,
    cacheHitRatio: 0.95,
    ddosProtection: true,
    sslEnabled: true
  },
  awsCloudfront: {
    capacity: 800000,
    latency: 60,
    failureRate: 0.00002,
    edgeLocations: 400,
    cacheHitRatio: 0.92,
    originShield: true,
    compressionEnabled: true
  },
  fastly: {
    capacity: 500000,
    latency: 40,
    failureRate: 0.00003,
    edgeLocations: 100,
    cacheHitRatio: 0.94,
    realTimeAnalytics: true,
    edgeComputing: true
  }
};

// Proxy component configurations
export const ProxyConfigs = {
  squid: {
    capacity: 5000,
    latency: 2,
    failureRate: 0.0005,
    cacheSize: '1GB',
    forwardProxy: true,
    reverseProxy: false,
    sslBump: false
  },
  envoy: {
    capacity: 10000,
    latency: 1.5,
    failureRate: 0.0003,
    loadBalancing: true,
    circuitBreaker: true,
    retries: 3,
    timeout: 30
  },
  traefik: {
    capacity: 8000,
    latency: 2.5,
    failureRate: 0.0004,
    autoDiscovery: true,
    letsEncrypt: true,
    middleware: true,
    dashboard: true
  }
};

// Component metadata definitions
export const ComponentMetadataLibrary: Record<string, ComponentMetadata> = {
  // Client metadata
  'web-client': {
    name: 'Web Client',
    description: 'Web browser client making HTTP requests',
    version: '1.0'
  },
  'mobile-client': {
    name: 'Mobile Client',
    description: 'Mobile application client with network constraints',
    version: '1.0'
  },
  'api-client': {
    name: 'API Client',
    description: 'High-performance API client for service-to-service communication',
    version: '1.0'
  },

  // Database metadata
  'mysql-db': {
    name: 'MySQL Database',
    description: 'Popular open-source relational database management system',
    version: '8.0'
  },
  'postgresql-db': {
    name: 'PostgreSQL Database',
    description: 'Advanced open-source relational database with strong ACID compliance',
    version: '15.0'
  },
  'mongodb-db': {
    name: 'MongoDB Database',
    description: 'Document-oriented NoSQL database with flexible schema',
    version: '6.0'
  },
  'redis-db': {
    name: 'Redis Database',
    description: 'In-memory data structure store used as database, cache, and message broker',
    version: '7.0'
  },

  // Load balancer metadata
  'nginx-lb': {
    name: 'Nginx Load Balancer',
    description: 'High-performance HTTP load balancer and reverse proxy',
    version: '1.24'
  },
  'haproxy-lb': {
    name: 'HAProxy Load Balancer',
    description: 'Reliable, high-performance TCP/HTTP load balancer',
    version: '2.8'
  },
  'awsAlb-lb': {
    name: 'AWS Application Load Balancer',
    description: 'Managed Layer 7 load balancer with advanced routing',
    version: 'latest'
  },

  // Web server metadata
  'apache-web': {
    name: 'Apache HTTP Server',
    description: 'Popular open-source web server with modular architecture',
    version: '2.4'
  },
  'nginx-web': {
    name: 'Nginx Web Server',
    description: 'High-performance web server and reverse proxy',
    version: '1.24'
  },
  'nodejs-web': {
    name: 'Node.js Server',
    description: 'JavaScript runtime for building scalable server applications',
    version: '18.0'
  },

  // Cache metadata
  'memcached-cache': {
    name: 'Memcached',
    description: 'High-performance distributed memory caching system',
    version: '1.6'
  },
  'redis-cache': {
    name: 'Redis Cache',
    description: 'In-memory data structure store optimized for caching',
    version: '7.0'
  },
  'varnish-cache': {
    name: 'Varnish Cache',
    description: 'HTTP accelerator designed for content-heavy dynamic websites',
    version: '7.0'
  },

  // Message queue metadata
  'kafka-mq': {
    name: 'Apache Kafka',
    description: 'Distributed streaming platform for high-throughput data pipelines',
    version: '3.5'
  },
  'rabbitmq-mq': {
    name: 'RabbitMQ',
    description: 'Message broker that supports multiple messaging protocols',
    version: '3.12'
  },
  'awsSqs-mq': {
    name: 'AWS SQS',
    description: 'Fully managed message queuing service',
    version: 'latest'
  },

  // CDN metadata
  'cloudflare-cdn': {
    name: 'Cloudflare CDN',
    description: 'Global content delivery network with security features',
    version: 'latest'
  },
  'awsCloudfront-cdn': {
    name: 'AWS CloudFront',
    description: 'Global content delivery network service',
    version: 'latest'
  },
  'fastly-cdn': {
    name: 'Fastly CDN',
    description: 'Edge cloud platform with real-time analytics',
    version: 'latest'
  },

  // Proxy metadata
  'squid-proxy': {
    name: 'Squid Proxy',
    description: 'Caching proxy for web clients supporting HTTP, HTTPS, and FTP',
    version: '5.0'
  },
  'envoy-proxy': {
    name: 'Envoy Proxy',
    description: 'High-performance service mesh proxy with advanced load balancing',
    version: '1.27'
  },
  'traefik-proxy': {
    name: 'Traefik Proxy',
    description: 'Modern reverse proxy with automatic service discovery',
    version: '3.0'
  }
};

// Component library class for managing predefined components
export class ComponentLibrary {
  private static instance: ComponentLibrary;
  private componentConfigs: Map<string, ComponentConfig>;
  private componentMetadata: Map<string, ComponentMetadata>;

  private constructor() {
    this.componentConfigs = new Map();
    this.componentMetadata = new Map();
    this.initializeLibrary();
  }

  public static getInstance(): ComponentLibrary {
    if (!ComponentLibrary.instance) {
      ComponentLibrary.instance = new ComponentLibrary();
    }
    return ComponentLibrary.instance;
  }

  private initializeLibrary(): void {
    // Initialize client configs
    Object.entries(ClientConfigs).forEach(([key, config]) => {
      this.componentConfigs.set(`client-${key}`, config);
    });

    // Initialize database configs
    Object.entries(DatabaseConfigs).forEach(([key, config]) => {
      this.componentConfigs.set(`database-${key}`, config);
    });

    // Initialize load balancer configs
    Object.entries(LoadBalancerConfigs).forEach(([key, config]) => {
      this.componentConfigs.set(`load-balancer-${key}`, config);
    });

    // Initialize web server configs
    Object.entries(WebServerConfigs).forEach(([key, config]) => {
      this.componentConfigs.set(`web-server-${key}`, config);
    });

    // Initialize cache configs
    Object.entries(CacheConfigs).forEach(([key, config]) => {
      this.componentConfigs.set(`cache-${key}`, config);
    });

    // Initialize message queue configs
    Object.entries(MessageQueueConfigs).forEach(([key, config]) => {
      this.componentConfigs.set(`message-queue-${key}`, config);
    });

    // Initialize CDN configs
    Object.entries(CdnConfigs).forEach(([key, config]) => {
      this.componentConfigs.set(`cdn-${key}`, config);
    });

    // Initialize proxy configs
    Object.entries(ProxyConfigs).forEach(([key, config]) => {
      this.componentConfigs.set(`proxy-${key}`, config);
    });

    // Initialize metadata
    Object.entries(ComponentMetadataLibrary).forEach(([key, metadata]) => {
      this.componentMetadata.set(key, metadata);
    });
  }

  public getComponentConfig(componentKey: string): ComponentConfig | undefined {
    return this.componentConfigs.get(componentKey);
  }

  public getComponentMetadata(componentKey: string): ComponentMetadata | undefined {
    // Extract the component name and type from the key (e.g., 'load-balancer-nginx' -> 'nginx-lb')
    // Handle multi-word component types like 'load-balancer', 'web-server', 'message-queue'
    let componentType = '';
    let componentName = '';
    
    if (componentKey.startsWith('client-')) {
      componentType = 'client';
      componentName = componentKey.substring('client-'.length);
    } else if (componentKey.startsWith('load-balancer-')) {
      componentType = 'load-balancer';
      componentName = componentKey.substring('load-balancer-'.length);
    } else if (componentKey.startsWith('web-server-')) {
      componentType = 'web-server';
      componentName = componentKey.substring('web-server-'.length);
    } else if (componentKey.startsWith('message-queue-')) {
      componentType = 'message-queue';
      componentName = componentKey.substring('message-queue-'.length);
    } else {
      // For single-word types like 'database', 'cache', 'cdn', 'proxy'
      const parts = componentKey.split('-');
      if (parts.length >= 2) {
        componentType = parts[0];
        componentName = parts[parts.length - 1];
      }
    }
    
    if (componentType && componentName) {
      // Create a specific metadata key based on type and name
      let metadataKey = componentName;
      if (componentType === 'client') {
        metadataKey = `${componentName}-client`;
      } else if (componentType === 'load-balancer') {
        metadataKey = `${componentName}-lb`;
      } else if (componentType === 'web-server') {
        metadataKey = `${componentName}-web`;
      } else if (componentType === 'cache') {
        metadataKey = `${componentName}-cache`;
      } else if (componentType === 'database') {
        metadataKey = `${componentName}-db`;
      } else if (componentType === 'message-queue') {
        metadataKey = `${componentName}-mq`;
      } else if (componentType === 'cdn') {
        metadataKey = `${componentName}-cdn`;
      } else if (componentType === 'proxy') {
        metadataKey = `${componentName}-proxy`;
      }
      
      return this.componentMetadata.get(metadataKey) || this.componentMetadata.get(componentName);
    }
    
    return this.componentMetadata.get(componentKey);
  }

  public getAvailableComponents(): string[] {
    return Array.from(this.componentConfigs.keys());
  }

  public getComponentsByType(type: ComponentType): string[] {
    return Array.from(this.componentConfigs.keys()).filter(key => key.startsWith(type));
  }

  public createComponent(
    componentKey: string, 
    type: ComponentType, 
    position: { x: number; y: number },
    customConfig?: Partial<ComponentConfig>
  ): Component | null {
    const baseConfig = this.getComponentConfig(componentKey);
    const metadata = this.getComponentMetadata(componentKey);

    if (!baseConfig || !metadata) {
      return null;
    }

    const finalConfig = { ...baseConfig, ...customConfig };

    return {
      id: crypto.randomUUID(),
      type,
      position,
      configuration: finalConfig,
      metadata
    };
  }

  public getPresetConfigurations(type: ComponentType): Record<string, ComponentConfig> {
    const presets: Record<string, ComponentConfig> = {};
    
    switch (type) {
      case 'client':
        Object.assign(presets, ClientConfigs);
        break;
      case 'database':
        Object.assign(presets, DatabaseConfigs);
        break;
      case 'load-balancer':
        Object.assign(presets, LoadBalancerConfigs);
        break;
      case 'web-server':
        Object.assign(presets, WebServerConfigs);
        break;
      case 'cache':
        Object.assign(presets, CacheConfigs);
        break;
      case 'message-queue':
        Object.assign(presets, MessageQueueConfigs);
        break;
      case 'cdn':
        Object.assign(presets, CdnConfigs);
        break;
      case 'proxy':
        Object.assign(presets, ProxyConfigs);
        break;
    }

    return presets;
  }
}

// Export singleton instance
export const componentLibrary = ComponentLibrary.getInstance();