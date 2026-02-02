/**
 * Backend Component Library for System Design Simulator
 * Provides predefined component definitions with default configurations and metadata
 * Implements SRS FR-3.1: Standard Component Catalog
 */

import type { Component, ComponentType, ComponentConfig, ComponentMetadata } from '../types';

// Enhanced component interfaces for SRS FR-3.1 compliance
export interface LoadBalancerConfig extends ComponentConfig {
  algorithm: 'round-robin' | 'least-connections' | 'weighted-round-robin' | 'ip-hash';
  healthCheck: boolean;
  sslTermination: boolean;
  sessionStickiness?: boolean;
  compressionEnabled?: boolean;
  autoScaling?: boolean;
  maxConnections: number;
  connectionTimeout: number;
}

export interface DatabaseConfig extends ComponentConfig {
  // ACID Properties per SRS FR-3.1
  acidCompliance: {
    atomicity: boolean;
    consistency: 'strong' | 'eventual' | 'weak';
    isolation: 'read-uncommitted' | 'read-committed' | 'repeatable-read' | 'serializable';
    durability: boolean;
  };
  connectionPool: number;
  queryCache: boolean;
  replicationEnabled: boolean;
  replicationFactor?: number;
  storageType: 'SSD' | 'HDD' | 'Memory';
  indexing: boolean;
  sharding?: boolean;
  backupEnabled: boolean;
  transactionSupport: boolean;
}

export interface CacheConfig extends ComponentConfig {
  // Eviction Policies per SRS FR-3.1
  evictionPolicy: 'LRU' | 'LFU' | 'FIFO' | 'Random' | 'TTL' | 'allkeys-lru' | 'allkeys-lfu';
  memorySize: string;
  hitRatio: number;
  persistence: boolean | 'RDB' | 'AOF';
  clustering: boolean;
  ttl: number; // Time to live in seconds
  maxMemoryPolicy: 'noeviction' | 'allkeys-lru' | 'volatile-lru' | 'allkeys-random';
  compressionEnabled: boolean;
}

export interface QueueConfig extends ComponentConfig {
  // Messaging Patterns per SRS FR-3.1
  messagingPattern: 'point-to-point' | 'publish-subscribe' | 'request-reply' | 'message-routing';
  partitions?: number;
  replication: number;
  retention: string;
  compression: 'none' | 'gzip' | 'snappy' | 'lz4';
  ordering: 'FIFO' | 'priority' | 'none';
  deadLetterQueue: boolean;
  messageRetention: string;
  visibilityTimeout?: number;
  maxMessageSize: number;
  durability: boolean;
}

export interface CDNConfig extends ComponentConfig {
  // Geographic Distribution per SRS FR-3.1
  edgeLocations: number;
  geographicDistribution: {
    regions: string[];
    popLocations: GeographicPOP[];
  };
  cacheHitRatio: number;
  cacheTTL: number;
  originShield: boolean;
  compressionEnabled: boolean;
  sslEnabled: boolean;
  ddosProtection: boolean;
  realTimeAnalytics?: boolean;
  edgeComputing?: boolean;
  bandwidthLimit?: number;
}

export interface ServiceConfig extends ComponentConfig {
  // Scaling Options per SRS FR-3.1
  scalingOptions: {
    vertical: {
      enabled: boolean;
      minCpu: number;
      maxCpu: number;
      minMemory: string;
      maxMemory: string;
    };
    horizontal: {
      enabled: boolean;
      minInstances: number;
      maxInstances: number;
      targetCpuUtilization: number;
      scaleUpCooldown: number;
      scaleDownCooldown: number;
    };
    autoScaling: {
      enabled: boolean;
      metrics: ('cpu' | 'memory' | 'requests' | 'latency')[];
      thresholds: Record<string, number>;
    };
  };
  runtime: string;
  memoryLimit: string;
  cpuLimit: number;
  healthCheckPath: string;
  gracefulShutdownTimeout: number;
  maxConnections: number;
  keepAlive: boolean;
  clustering: boolean;
}

export interface GeographicPOP {
  id: string;
  city: string;
  country: string;
  region: string;
  coordinates: { lat: number; lng: number };
  capacity: number;
  latencyToOrigin: number;
}

// Enhanced Load Balancer configurations implementing SRS FR-3.1
export const LoadBalancerConfigs: Record<string, LoadBalancerConfig> = {
  nginx: {
    capacity: 10000,
    latency: 1,
    failureRate: 0.0001,
    algorithm: 'round-robin',
    healthCheck: true,
    sslTermination: true,
    compressionEnabled: true,
    maxConnections: 10000,
    connectionTimeout: 30000,
    sessionStickiness: false
  },
  haproxy: {
    capacity: 8000,
    latency: 1.5,
    failureRate: 0.0002,
    algorithm: 'least-connections',
    healthCheck: true,
    sslTermination: false,
    sessionStickiness: true,
    maxConnections: 8000,
    connectionTimeout: 25000,
    compressionEnabled: false
  },
  awsAlb: {
    capacity: 50000,
    latency: 2,
    failureRate: 0.00005,
    algorithm: 'weighted-round-robin',
    healthCheck: true,
    sslTermination: true,
    autoScaling: true,
    maxConnections: 50000,
    connectionTimeout: 60000,
    compressionEnabled: true
  }
};

// Enhanced Database configurations with ACID properties implementing SRS FR-3.1
export const DatabaseConfigs: Record<string, DatabaseConfig> = {
  mysql: {
    capacity: 1000,
    latency: 5,
    failureRate: 0.001,
    acidCompliance: {
      atomicity: true,
      consistency: 'strong',
      isolation: 'repeatable-read',
      durability: true
    },
    connectionPool: 100,
    queryCache: true,
    replicationEnabled: false,
    replicationFactor: 1,
    storageType: 'SSD',
    indexing: true,
    sharding: false,
    backupEnabled: true,
    transactionSupport: true
  },
  postgresql: {
    capacity: 800,
    latency: 4,
    failureRate: 0.0008,
    acidCompliance: {
      atomicity: true,
      consistency: 'strong',
      isolation: 'serializable',
      durability: true
    },
    connectionPool: 200,
    queryCache: true,
    replicationEnabled: true,
    replicationFactor: 2,
    storageType: 'SSD',
    indexing: true,
    sharding: false,
    backupEnabled: true,
    transactionSupport: true
  },
  mongodb: {
    capacity: 1200,
    latency: 3,
    failureRate: 0.0012,
    acidCompliance: {
      atomicity: true,
      consistency: 'eventual',
      isolation: 'read-committed',
      durability: true
    },
    connectionPool: 150,
    queryCache: false,
    replicationEnabled: true,
    replicationFactor: 3,
    storageType: 'SSD',
    indexing: true,
    sharding: true,
    backupEnabled: true,
    transactionSupport: true
  },
  redis: {
    capacity: 5000,
    latency: 1,
    failureRate: 0.0005,
    acidCompliance: {
      atomicity: false,
      consistency: 'eventual',
      isolation: 'read-uncommitted',
      durability: false
    },
    connectionPool: 1000,
    queryCache: false,
    replicationEnabled: false,
    replicationFactor: 1,
    storageType: 'Memory',
    indexing: false,
    sharding: false,
    backupEnabled: false,
    transactionSupport: false
  }
};

// Enhanced Cache configurations with eviction policies implementing SRS FR-3.1
export const CacheConfigs: Record<string, CacheConfig> = {
  memcached: {
    capacity: 10000,
    latency: 0.5,
    failureRate: 0.0003,
    evictionPolicy: 'LRU',
    memorySize: '4GB',
    hitRatio: 0.85,
    persistence: false,
    clustering: true,
    ttl: 3600,
    maxMemoryPolicy: 'allkeys-lru',
    compressionEnabled: false
  },
  redis: {
    capacity: 8000,
    latency: 0.8,
    failureRate: 0.0002,
    evictionPolicy: 'allkeys-lru',
    memorySize: '8GB',
    hitRatio: 0.90,
    persistence: 'RDB',
    clustering: false,
    ttl: 7200,
    maxMemoryPolicy: 'allkeys-lru',
    compressionEnabled: true
  },
  varnish: {
    capacity: 15000,
    latency: 0.3,
    failureRate: 0.0001,
    evictionPolicy: 'LRU',
    memorySize: '2GB',
    hitRatio: 0.95,
    persistence: false,
    clustering: false,
    ttl: 1800,
    maxMemoryPolicy: 'allkeys-lru',
    compressionEnabled: true
  }
};

// Enhanced Queue configurations with messaging patterns implementing SRS FR-3.1
export const QueueConfigs: Record<string, QueueConfig> = {
  kafka: {
    capacity: 100000,
    latency: 2,
    failureRate: 0.0001,
    messagingPattern: 'publish-subscribe',
    partitions: 10,
    replication: 3,
    retention: '7d',
    compression: 'gzip',
    ordering: 'FIFO',
    deadLetterQueue: false,
    messageRetention: '7d',
    maxMessageSize: 1048576, // 1MB
    durability: true
  },
  rabbitmq: {
    capacity: 50000,
    latency: 3,
    failureRate: 0.0002,
    messagingPattern: 'point-to-point',
    replication: 2,
    retention: '3d',
    compression: 'none',
    ordering: 'FIFO',
    deadLetterQueue: true,
    messageRetention: '3d',
    maxMessageSize: 134217728, // 128MB
    durability: true
  },
  awsSqs: {
    capacity: 300000,
    latency: 5,
    failureRate: 0.00001,
    messagingPattern: 'point-to-point',
    replication: 3,
    retention: '14d',
    compression: 'none',
    ordering: 'FIFO',
    deadLetterQueue: true,
    messageRetention: '14d',
    visibilityTimeout: 30,
    maxMessageSize: 262144, // 256KB
    durability: true
  }
};

// Enhanced CDN configurations with geographic distribution implementing SRS FR-3.1
export const CDNConfigs: Record<string, CDNConfig> = {
  cloudflare: {
    capacity: 1000000,
    latency: 50,
    failureRate: 0.00001,
    edgeLocations: 200,
    geographicDistribution: {
      regions: ['North America', 'Europe', 'Asia Pacific', 'South America', 'Africa', 'Oceania'],
      popLocations: [
        { id: 'nyc', city: 'New York', country: 'USA', region: 'North America', coordinates: { lat: 40.7128, lng: -74.0060 }, capacity: 50000, latencyToOrigin: 10 },
        { id: 'lax', city: 'Los Angeles', country: 'USA', region: 'North America', coordinates: { lat: 34.0522, lng: -118.2437 }, capacity: 45000, latencyToOrigin: 15 },
        { id: 'lon', city: 'London', country: 'UK', region: 'Europe', coordinates: { lat: 51.5074, lng: -0.1278 }, capacity: 40000, latencyToOrigin: 20 },
        { id: 'fra', city: 'Frankfurt', country: 'Germany', region: 'Europe', coordinates: { lat: 50.1109, lng: 8.6821 }, capacity: 35000, latencyToOrigin: 25 },
        { id: 'sin', city: 'Singapore', country: 'Singapore', region: 'Asia Pacific', coordinates: { lat: 1.3521, lng: 103.8198 }, capacity: 30000, latencyToOrigin: 30 },
        { id: 'tok', city: 'Tokyo', country: 'Japan', region: 'Asia Pacific', coordinates: { lat: 35.6762, lng: 139.6503 }, capacity: 35000, latencyToOrigin: 35 }
      ]
    },
    cacheHitRatio: 0.95,
    cacheTTL: 3600,
    originShield: false,
    compressionEnabled: true,
    sslEnabled: true,
    ddosProtection: true,
    realTimeAnalytics: true
  },
  awsCloudfront: {
    capacity: 800000,
    latency: 60,
    failureRate: 0.00002,
    edgeLocations: 400,
    geographicDistribution: {
      regions: ['North America', 'Europe', 'Asia Pacific', 'South America', 'Africa', 'Middle East'],
      popLocations: [
        { id: 'us-east-1', city: 'Virginia', country: 'USA', region: 'North America', coordinates: { lat: 37.4316, lng: -78.6569 }, capacity: 60000, latencyToOrigin: 5 },
        { id: 'us-west-2', city: 'Oregon', country: 'USA', region: 'North America', coordinates: { lat: 44.9778, lng: -123.0351 }, capacity: 55000, latencyToOrigin: 10 },
        { id: 'eu-west-1', city: 'Ireland', country: 'Ireland', region: 'Europe', coordinates: { lat: 53.4129, lng: -8.2439 }, capacity: 50000, latencyToOrigin: 15 },
        { id: 'ap-southeast-1', city: 'Singapore', country: 'Singapore', region: 'Asia Pacific', coordinates: { lat: 1.3521, lng: 103.8198 }, capacity: 45000, latencyToOrigin: 20 }
      ]
    },
    cacheHitRatio: 0.92,
    cacheTTL: 86400,
    originShield: true,
    compressionEnabled: true,
    sslEnabled: true,
    ddosProtection: false
  },
  fastly: {
    capacity: 500000,
    latency: 40,
    failureRate: 0.00003,
    edgeLocations: 100,
    geographicDistribution: {
      regions: ['North America', 'Europe', 'Asia Pacific'],
      popLocations: [
        { id: 'sjc', city: 'San Jose', country: 'USA', region: 'North America', coordinates: { lat: 37.3382, lng: -121.8863 }, capacity: 40000, latencyToOrigin: 8 },
        { id: 'ams', city: 'Amsterdam', country: 'Netherlands', region: 'Europe', coordinates: { lat: 52.3676, lng: 4.9041 }, capacity: 35000, latencyToOrigin: 12 },
        { id: 'hkg', city: 'Hong Kong', country: 'Hong Kong', region: 'Asia Pacific', coordinates: { lat: 22.3193, lng: 114.1694 }, capacity: 30000, latencyToOrigin: 18 }
      ]
    },
    cacheHitRatio: 0.94,
    cacheTTL: 1800,
    originShield: false,
    compressionEnabled: true,
    sslEnabled: true,
    ddosProtection: true,
    realTimeAnalytics: true,
    edgeComputing: true
  }
};

// Enhanced Service configurations with scaling options implementing SRS FR-3.1
export const ServiceConfigs: Record<string, ServiceConfig> = {
  nodejs: {
    capacity: 3000,
    latency: 8,
    failureRate: 0.0015,
    scalingOptions: {
      vertical: {
        enabled: true,
        minCpu: 0.5,
        maxCpu: 4,
        minMemory: '512MB',
        maxMemory: '8GB'
      },
      horizontal: {
        enabled: true,
        minInstances: 1,
        maxInstances: 10,
        targetCpuUtilization: 70,
        scaleUpCooldown: 300,
        scaleDownCooldown: 600
      },
      autoScaling: {
        enabled: true,
        metrics: ['cpu', 'memory', 'requests'],
        thresholds: { cpu: 70, memory: 80, requests: 1000 }
      }
    },
    runtime: 'Node.js 18',
    memoryLimit: '2GB',
    cpuLimit: 2,
    healthCheckPath: '/health',
    gracefulShutdownTimeout: 30,
    maxConnections: 1000,
    keepAlive: true,
    clustering: false
  },
  java: {
    capacity: 2500,
    latency: 12,
    failureRate: 0.001,
    scalingOptions: {
      vertical: {
        enabled: true,
        minCpu: 1,
        maxCpu: 8,
        minMemory: '1GB',
        maxMemory: '16GB'
      },
      horizontal: {
        enabled: true,
        minInstances: 2,
        maxInstances: 20,
        targetCpuUtilization: 75,
        scaleUpCooldown: 600,
        scaleDownCooldown: 900
      },
      autoScaling: {
        enabled: true,
        metrics: ['cpu', 'memory', 'latency'],
        thresholds: { cpu: 75, memory: 85, latency: 500 }
      }
    },
    runtime: 'OpenJDK 17',
    memoryLimit: '4GB',
    cpuLimit: 4,
    healthCheckPath: '/actuator/health',
    gracefulShutdownTimeout: 60,
    maxConnections: 2000,
    keepAlive: true,
    clustering: true
  },
  python: {
    capacity: 2000,
    latency: 15,
    failureRate: 0.002,
    scalingOptions: {
      vertical: {
        enabled: true,
        minCpu: 0.5,
        maxCpu: 4,
        minMemory: '256MB',
        maxMemory: '4GB'
      },
      horizontal: {
        enabled: true,
        minInstances: 1,
        maxInstances: 15,
        targetCpuUtilization: 65,
        scaleUpCooldown: 300,
        scaleDownCooldown: 600
      },
      autoScaling: {
        enabled: true,
        metrics: ['cpu', 'requests'],
        thresholds: { cpu: 65, requests: 800 }
      }
    },
    runtime: 'Python 3.11',
    memoryLimit: '1GB',
    cpuLimit: 2,
    healthCheckPath: '/health',
    gracefulShutdownTimeout: 30,
    maxConnections: 500,
    keepAlive: false,
    clustering: false
  }
};

// Proxy component configurations (kept for backward compatibility)
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

// Enhanced Component metadata definitions implementing SRS FR-3.1
export const ComponentMetadataLibrary: Record<string, ComponentMetadata> = {
  // Load Balancer metadata
  'nginx-lb': {
    name: 'Nginx Load Balancer',
    description: 'High-performance HTTP load balancer with round-robin algorithm, health checks, and SSL termination',
    version: '1.24'
  },
  'haproxy-lb': {
    name: 'HAProxy Load Balancer',
    description: 'Reliable TCP/HTTP load balancer with least-connections algorithm and session stickiness',
    version: '2.8'
  },
  'awsAlb-lb': {
    name: 'AWS Application Load Balancer',
    description: 'Managed Layer 7 load balancer with weighted routing, auto-scaling, and advanced health checks',
    version: 'latest'
  },

  // Database metadata with ACID properties
  'mysql-db': {
    name: 'MySQL Database',
    description: 'ACID-compliant relational database with strong consistency, repeatable-read isolation, and full transaction support',
    version: '8.0'
  },
  'postgresql-db': {
    name: 'PostgreSQL Database',
    description: 'Advanced ACID-compliant database with serializable isolation, strong consistency, and enterprise features',
    version: '15.0'
  },
  'mongodb-db': {
    name: 'MongoDB Database',
    description: 'Document database with eventual consistency, sharding support, and flexible ACID transactions',
    version: '6.0'
  },
  'redis-db': {
    name: 'Redis Database',
    description: 'In-memory data store with eventual consistency, optimized for high-speed operations',
    version: '7.0'
  },

  // Cache metadata with eviction policies
  'memcached-cache': {
    name: 'Memcached Cache',
    description: 'Distributed memory cache with LRU eviction policy, clustering support, and high throughput',
    version: '1.6'
  },
  'redis-cache': {
    name: 'Redis Cache',
    description: 'Advanced cache with configurable eviction policies (LRU/LFU), persistence options, and compression',
    version: '7.0'
  },
  'varnish-cache': {
    name: 'Varnish Cache',
    description: 'HTTP accelerator with LRU eviction, high hit ratios, and built-in compression for web content',
    version: '7.0'
  },

  // Queue metadata with messaging patterns
  'kafka-queue': {
    name: 'Apache Kafka',
    description: 'Distributed streaming platform with publish-subscribe pattern, partitioning, and durable message storage',
    version: '3.5'
  },
  'rabbitmq-queue': {
    name: 'RabbitMQ',
    description: 'Message broker supporting point-to-point messaging, dead letter queues, and multiple exchange types',
    version: '3.12'
  },
  'awsSqs-queue': {
    name: 'AWS SQS',
    description: 'Managed queue service with FIFO ordering, dead letter queues, and high availability',
    version: 'latest'
  },

  // CDN metadata with geographic distribution
  'cloudflare-cdn': {
    name: 'Cloudflare CDN',
    description: 'Global CDN with 200+ edge locations, DDoS protection, real-time analytics, and 95% cache hit ratio',
    version: 'latest'
  },
  'awsCloudfront-cdn': {
    name: 'AWS CloudFront',
    description: 'Global CDN with 400+ edge locations, origin shield, and integrated AWS services',
    version: 'latest'
  },
  'fastly-cdn': {
    name: 'Fastly CDN',
    description: 'Edge cloud platform with real-time analytics, edge computing, and instant purging capabilities',
    version: 'latest'
  },

  // Service metadata with scaling options
  'nodejs-service': {
    name: 'Node.js Service',
    description: 'JavaScript runtime service with horizontal/vertical auto-scaling, health checks, and clustering support',
    version: '18.0'
  },
  'java-service': {
    name: 'Java Service',
    description: 'Enterprise Java service with advanced scaling options, JVM optimization, and high concurrency support',
    version: '17.0'
  },
  'python-service': {
    name: 'Python Service',
    description: 'Python web service with auto-scaling capabilities, health monitoring, and flexible deployment options',
    version: '3.11'
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
    // Initialize load balancer configs
    Object.entries(LoadBalancerConfigs).forEach(([key, config]) => {
      this.componentConfigs.set(`load-balancer-${key}`, config);
    });

    // Initialize database configs
    Object.entries(DatabaseConfigs).forEach(([key, config]) => {
      this.componentConfigs.set(`database-${key}`, config);
    });

    // Initialize cache configs
    Object.entries(CacheConfigs).forEach(([key, config]) => {
      this.componentConfigs.set(`cache-${key}`, config);
    });

    // Initialize queue configs
    Object.entries(QueueConfigs).forEach(([key, config]) => {
      this.componentConfigs.set(`queue-${key}`, config);
    });

    // Initialize CDN configs
    Object.entries(CDNConfigs).forEach(([key, config]) => {
      this.componentConfigs.set(`cdn-${key}`, config);
    });

    // Initialize service configs
    Object.entries(ServiceConfigs).forEach(([key, config]) => {
      this.componentConfigs.set(`service-${key}`, config);
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
    // Handle multi-word component types properly
    let componentType = '';
    let componentName = '';
    
    if (componentKey.startsWith('load-balancer-')) {
      componentType = 'load-balancer';
      componentName = componentKey.substring('load-balancer-'.length);
    } else if (componentKey.startsWith('message-queue-')) {
      componentType = 'message-queue';
      componentName = componentKey.substring('message-queue-'.length);
    } else {
      // For single-word types like 'database', 'cache', 'cdn', 'service', 'queue'
      const parts = componentKey.split('-');
      if (parts.length >= 2) {
        componentType = parts[0];
        componentName = parts.slice(1).join('-');
      }
    }
    
    if (componentType && componentName) {
      // Map to the correct metadata key format
      let metadataKey = '';
      switch (componentType) {
        case 'load-balancer':
          metadataKey = `${componentName}-lb`;
          break;
        case 'database':
          metadataKey = `${componentName}-db`;
          break;
        case 'cache':
          metadataKey = `${componentName}-cache`;
          break;
        case 'queue':
        case 'message-queue':
          metadataKey = `${componentName}-queue`;
          break;
        case 'cdn':
          metadataKey = `${componentName}-cdn`;
          break;
        case 'service':
          metadataKey = `${componentName}-service`;
          break;
        default:
          metadataKey = componentName;
      }
      
      return this.componentMetadata.get(metadataKey);
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

    // Generate UUID for backend (Node.js doesn't have crypto.randomUUID in older versions)
    const generateUUID = (): string => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };

    return {
      id: generateUUID(),
      type,
      position,
      configuration: finalConfig,
      metadata
    };
  }

  public getPresetConfigurations(type: ComponentType): Record<string, ComponentConfig> {
    const presets: Record<string, ComponentConfig> = {};
    
    switch (type) {
      case 'load-balancer':
        Object.assign(presets, LoadBalancerConfigs);
        break;
      case 'database':
        Object.assign(presets, DatabaseConfigs);
        break;
      case 'cache':
        Object.assign(presets, CacheConfigs);
        break;
      case 'message-queue':
        Object.assign(presets, QueueConfigs);
        break;
      case 'cdn':
        Object.assign(presets, CDNConfigs);
        break;
      case 'web-server':
        Object.assign(presets, ServiceConfigs);
        break;
    }

    return presets;
  }
}

// Export singleton instance
export const componentLibrary = ComponentLibrary.getInstance();