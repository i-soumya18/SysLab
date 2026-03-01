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

// API Gateway component configurations
export const ApiGatewayConfigs: Record<string, ComponentConfig> = {
  awsApiGateway: {
    capacity: 10000,
    latency: 5,
    failureRate: 0.0001,
    rateLimiting: true,
    throttling: true,
    caching: true,
    requestValidation: true,
    responseTransformation: true,
    apiVersioning: true,
    sslEnabled: true
  },
  kong: {
    capacity: 15000,
    latency: 3,
    failureRate: 0.0002,
    plugins: ['rate-limiting', 'authentication', 'logging'],
    loadBalancing: true,
    healthChecks: true,
    sslTermination: true,
    requestTransformation: true
  },
  nginxGateway: {
    capacity: 12000,
    latency: 2,
    failureRate: 0.00015,
    rateLimiting: true,
    loadBalancing: true,
    sslTermination: true,
    caching: true,
    compression: true
  }
};

// Search Engine component configurations
export const SearchEngineConfigs: Record<string, ComponentConfig> = {
  elasticsearch: {
    capacity: 5000,
    latency: 10,
    failureRate: 0.001,
    shards: 5,
    replicas: 1,
    indexing: true,
    fullTextSearch: true,
    facetedSearch: true,
    clustering: true,
    storageType: 'SSD'
  },
  solr: {
    capacity: 4000,
    latency: 12,
    failureRate: 0.0012,
    collections: 3,
    replication: 2,
    facetedSearch: true,
    highlighting: true,
    clustering: true,
    storageType: 'SSD'
  },
  opensearch: {
    capacity: 6000,
    latency: 8,
    failureRate: 0.0008,
    shards: 5,
    replicas: 2,
    securityEnabled: true,
    monitoring: true,
    alerting: true,
    storageType: 'SSD'
  }
};

// Object Storage component configurations
export const ObjectStorageConfigs: Record<string, ComponentConfig> = {
  awsS3: {
    capacity: 1000000,
    latency: 50,
    failureRate: 0.00001,
    durability: '99.999999999%',
    availability: '99.99%',
    versioning: true,
    encryption: true,
    lifecycleManagement: true,
    cdnIntegration: true
  },
  azureBlob: {
    capacity: 800000,
    latency: 55,
    failureRate: 0.00002,
    tier: 'hot',
    redundancy: 'LRS',
    versioning: true,
    encryption: true,
    lifecycleManagement: true
  },
  googleCloudStorage: {
    capacity: 900000,
    latency: 45,
    failureRate: 0.000015,
    storageClass: 'STANDARD',
    versioning: true,
    encryption: true,
    lifecycleManagement: true,
    cdnIntegration: true
  }
};

// Service Mesh component configurations
export const ServiceMeshConfigs: Record<string, ComponentConfig> = {
  istio: {
    capacity: 20000,
    latency: 2,
    failureRate: 0.0001,
    trafficManagement: true,
    security: true,
    observability: true,
    circuitBreaker: true,
    retries: true,
    timeout: true,
    loadBalancing: true
  },
  linkerd: {
    capacity: 18000,
    latency: 1.5,
    failureRate: 0.00012,
    automaticTLS: true,
    loadBalancing: true,
    retries: true,
    circuitBreaker: true,
    observability: true
  },
  consul: {
    capacity: 15000,
    latency: 2.5,
    failureRate: 0.00015,
    serviceDiscovery: true,
    healthChecking: true,
    loadBalancing: true,
    security: true,
    multiDatacenter: true
  }
};

// Rate Limiter component configurations
export const RateLimiterConfigs: Record<string, ComponentConfig> = {
  redisRateLimiter: {
    capacity: 50000,
    latency: 0.5,
    failureRate: 0.0001,
    algorithm: 'token-bucket',
    slidingWindow: true,
    distributed: true,
    persistence: false,
    maxRequests: 1000,
    windowSize: 60
  },
  nginxRateLimiter: {
    capacity: 30000,
    latency: 0.3,
    failureRate: 0.0002,
    algorithm: 'leaky-bucket',
    zones: 10,
    burst: 50,
    nodelay: false
  },
  envoyRateLimiter: {
    capacity: 40000,
    latency: 0.4,
    failureRate: 0.00015,
    algorithm: 'token-bucket',
    distributed: true,
    localCache: true,
    maxTokens: 1000,
    refillRate: 100
  }
};

// Circuit Breaker component configurations
export const CircuitBreakerConfigs: Record<string, ComponentConfig> = {
  hystrix: {
    capacity: 10000,
    latency: 0.2,
    failureRate: 0.0001,
    failureThreshold: 0.5,
    timeout: 1000,
    halfOpenMaxCalls: 3,
    slidingWindow: true,
    metricsEnabled: true
  },
  resilience4j: {
    capacity: 12000,
    latency: 0.15,
    failureRate: 0.00008,
    failureThreshold: 0.5,
    waitDuration: 60,
    halfOpenMaxCalls: 5,
    slidingWindow: true,
    metricsEnabled: true
  },
  envoyCircuitBreaker: {
    capacity: 15000,
    latency: 0.1,
    failureRate: 0.00005,
    maxConnections: 1000,
    maxPendingRequests: 100,
    maxRequests: 1000,
    consecutiveErrors: 5,
    interval: 30
  }
};

// Authentication Service component configurations
export const AuthServiceConfigs: Record<string, ComponentConfig> = {
  oauth2: {
    capacity: 5000,
    latency: 20,
    failureRate: 0.0005,
    grantTypes: ['authorization_code', 'client_credentials', 'refresh_token'],
    tokenExpiry: 3600,
    refreshTokenExpiry: 86400,
    jwtSigning: true,
    multiFactorAuth: false
  },
  jwt: {
    capacity: 8000,
    latency: 5,
    failureRate: 0.0003,
    algorithm: 'RS256',
    tokenExpiry: 3600,
    refreshTokenExpiry: 86400,
    keyRotation: true,
    blacklistSupport: true
  },
  keycloak: {
    capacity: 3000,
    latency: 25,
    failureRate: 0.0008,
    identityProviders: ['oauth2', 'saml', 'ldap'],
    userFederation: true,
    socialLogin: true,
    multiFactorAuth: true
  }
};

// Monitoring component configurations
export const MonitoringConfigs: Record<string, ComponentConfig> = {
  prometheus: {
    capacity: 10000,
    latency: 10,
    failureRate: 0.0002,
    metricsRetention: '15d',
    scrapeInterval: 15,
    alerting: true,
    serviceDiscovery: true,
    federation: true
  },
  grafana: {
    capacity: 5000,
    latency: 15,
    failureRate: 0.0003,
    dashboards: true,
    alerting: true,
    dataSources: ['prometheus', 'influxdb', 'elasticsearch'],
    plugins: true,
    userManagement: true
  },
  datadog: {
    capacity: 20000,
    latency: 5,
    failureRate: 0.0001,
    apm: true,
    logs: true,
    metrics: true,
    traces: true,
    alerting: true,
    dashboards: true
  }
};

// Logging component configurations
export const LoggingConfigs: Record<string, ComponentConfig> = {
  elasticsearch: {
    capacity: 8000,
    latency: 8,
    failureRate: 0.0003,
    retention: '30d',
    indexing: true,
    search: true,
    aggregation: true,
    sharding: true,
    replication: 1
  },
  splunk: {
    capacity: 6000,
    latency: 12,
    failureRate: 0.0004,
    retention: '90d',
    indexing: true,
    search: true,
    alerting: true,
    dashboards: true
  },
  fluentd: {
    capacity: 10000,
    latency: 3,
    failureRate: 0.0002,
    buffering: true,
    filtering: true,
    routing: true,
    plugins: true,
    highAvailability: true
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
  },

  // API Gateway metadata
  'awsApiGateway-gateway': {
    name: 'AWS API Gateway',
    description: 'Managed API gateway with rate limiting, throttling, caching, and request/response transformation',
    version: 'latest'
  },
  'kong-gateway': {
    name: 'Kong API Gateway',
    description: 'Open-source API gateway with plugin ecosystem, load balancing, and health checks',
    version: '3.0'
  },
  'nginxGateway-gateway': {
    name: 'Nginx API Gateway',
    description: 'High-performance API gateway with rate limiting, SSL termination, and caching',
    version: '1.24'
  },

  // Search Engine metadata
  'elasticsearch-search': {
    name: 'Elasticsearch',
    description: 'Distributed search and analytics engine with full-text search, faceted search, and clustering',
    version: '8.0'
  },
  'solr-search': {
    name: 'Apache Solr',
    description: 'Enterprise search platform with faceted search, highlighting, and replication',
    version: '9.0'
  },
  'opensearch-search': {
    name: 'OpenSearch',
    description: 'Open-source search engine with security, monitoring, and alerting capabilities',
    version: '2.0'
  },

  // Object Storage metadata
  'awsS3-storage': {
    name: 'AWS S3',
    description: 'Scalable object storage with 99.999999999% durability, versioning, and lifecycle management',
    version: 'latest'
  },
  'azureBlob-storage': {
    name: 'Azure Blob Storage',
    description: 'Cloud object storage with tiered storage, redundancy options, and lifecycle management',
    version: 'latest'
  },
  'googleCloudStorage-storage': {
    name: 'Google Cloud Storage',
    description: 'Unified object storage with versioning, encryption, and CDN integration',
    version: 'latest'
  },

  // Service Mesh metadata
  'istio-mesh': {
    name: 'Istio Service Mesh',
    description: 'Service mesh with traffic management, security, observability, and circuit breaking',
    version: '1.19'
  },
  'linkerd-mesh': {
    name: 'Linkerd Service Mesh',
    description: 'Ultralight service mesh with automatic TLS, load balancing, and observability',
    version: '2.13'
  },
  'consul-mesh': {
    name: 'Consul Service Mesh',
    description: 'Service mesh with service discovery, health checking, and multi-datacenter support',
    version: '1.16'
  },

  // Rate Limiter metadata
  'redisRateLimiter-limiter': {
    name: 'Redis Rate Limiter',
    description: 'Distributed rate limiter using token-bucket algorithm with sliding window support',
    version: '7.0'
  },
  'nginxRateLimiter-limiter': {
    name: 'Nginx Rate Limiter',
    description: 'Rate limiting using leaky-bucket algorithm with burst and nodelay options',
    version: '1.24'
  },
  'envoyRateLimiter-limiter': {
    name: 'Envoy Rate Limiter',
    description: 'Distributed rate limiter with token-bucket algorithm and local caching',
    version: '1.27'
  },

  // Circuit Breaker metadata
  'hystrix-breaker': {
    name: 'Hystrix Circuit Breaker',
    description: 'Circuit breaker with failure threshold, timeout, and sliding window metrics',
    version: '1.5'
  },
  'resilience4j-breaker': {
    name: 'Resilience4j Circuit Breaker',
    description: 'Lightweight fault tolerance library with circuit breaker, retry, and rate limiter',
    version: '1.17'
  },
  'envoyCircuitBreaker-breaker': {
    name: 'Envoy Circuit Breaker',
    description: 'Circuit breaker with connection and request limits, consecutive error tracking',
    version: '1.27'
  },

  // Authentication Service metadata
  'oauth2-auth': {
    name: 'OAuth2 Auth Service',
    description: 'OAuth2 authentication service with multiple grant types and JWT token support',
    version: '2.1'
  },
  'jwt-auth': {
    name: 'JWT Auth Service',
    description: 'JWT-based authentication with RS256 signing, token expiry, and key rotation',
    version: '9.0'
  },
  'keycloak-auth': {
    name: 'Keycloak Auth Service',
    description: 'Identity and access management with OAuth2, SAML, LDAP, and social login',
    version: '22.0'
  },

  // Monitoring metadata
  'prometheus-monitoring': {
    name: 'Prometheus',
    description: 'Monitoring and alerting toolkit with metrics collection, retention, and federation',
    version: '2.45'
  },
  'grafana-monitoring': {
    name: 'Grafana',
    description: 'Analytics and visualization platform with dashboards, alerting, and multiple data sources',
    version: '10.0'
  },
  'datadog-monitoring': {
    name: 'Datadog',
    description: 'Cloud monitoring platform with APM, logs, metrics, traces, and alerting',
    version: 'latest'
  },

  // Logging metadata
  'elasticsearch-logging': {
    name: 'Elasticsearch Logging',
    description: 'Log aggregation and search with indexing, retention, and full-text search capabilities',
    version: '8.0'
  },
  'splunk-logging': {
    name: 'Splunk',
    description: 'Log analysis platform with indexing, search, alerting, and dashboard capabilities',
    version: '9.0'
  },
  'fluentd-logging': {
    name: 'Fluentd',
    description: 'Log collector with buffering, filtering, routing, and high availability support',
    version: '1.16'
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

    // Initialize API Gateway configs
    Object.entries(ApiGatewayConfigs).forEach(([key, config]) => {
      this.componentConfigs.set(`api-gateway-${key}`, config);
    });

    // Initialize Search Engine configs
    Object.entries(SearchEngineConfigs).forEach(([key, config]) => {
      this.componentConfigs.set(`search-engine-${key}`, config);
    });

    // Initialize Object Storage configs
    Object.entries(ObjectStorageConfigs).forEach(([key, config]) => {
      this.componentConfigs.set(`object-storage-${key}`, config);
    });

    // Initialize Service Mesh configs
    Object.entries(ServiceMeshConfigs).forEach(([key, config]) => {
      this.componentConfigs.set(`service-mesh-${key}`, config);
    });

    // Initialize Rate Limiter configs
    Object.entries(RateLimiterConfigs).forEach(([key, config]) => {
      this.componentConfigs.set(`rate-limiter-${key}`, config);
    });

    // Initialize Circuit Breaker configs
    Object.entries(CircuitBreakerConfigs).forEach(([key, config]) => {
      this.componentConfigs.set(`circuit-breaker-${key}`, config);
    });

    // Initialize Auth Service configs
    Object.entries(AuthServiceConfigs).forEach(([key, config]) => {
      this.componentConfigs.set(`auth-service-${key}`, config);
    });

    // Initialize Monitoring configs
    Object.entries(MonitoringConfigs).forEach(([key, config]) => {
      this.componentConfigs.set(`monitoring-${key}`, config);
    });

    // Initialize Logging configs
    Object.entries(LoggingConfigs).forEach(([key, config]) => {
      this.componentConfigs.set(`logging-${key}`, config);
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
    } else if (componentKey.startsWith('api-gateway-')) {
      componentType = 'api-gateway';
      componentName = componentKey.substring('api-gateway-'.length);
    } else if (componentKey.startsWith('search-engine-')) {
      componentType = 'search-engine';
      componentName = componentKey.substring('search-engine-'.length);
    } else if (componentKey.startsWith('object-storage-')) {
      componentType = 'object-storage';
      componentName = componentKey.substring('object-storage-'.length);
    } else if (componentKey.startsWith('service-mesh-')) {
      componentType = 'service-mesh';
      componentName = componentKey.substring('service-mesh-'.length);
    } else if (componentKey.startsWith('rate-limiter-')) {
      componentType = 'rate-limiter';
      componentName = componentKey.substring('rate-limiter-'.length);
    } else if (componentKey.startsWith('circuit-breaker-')) {
      componentType = 'circuit-breaker';
      componentName = componentKey.substring('circuit-breaker-'.length);
    } else if (componentKey.startsWith('auth-service-')) {
      componentType = 'auth-service';
      componentName = componentKey.substring('auth-service-'.length);
    } else {
      // For single-word types like 'database', 'cache', 'cdn', 'service', 'queue', 'monitoring', 'logging'
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
        case 'api-gateway':
          metadataKey = `${componentName}-gateway`;
          break;
        case 'search-engine':
          metadataKey = `${componentName}-search`;
          break;
        case 'object-storage':
          metadataKey = `${componentName}-storage`;
          break;
        case 'service-mesh':
          metadataKey = `${componentName}-mesh`;
          break;
        case 'rate-limiter':
          metadataKey = `${componentName}-limiter`;
          break;
        case 'circuit-breaker':
          metadataKey = `${componentName}-breaker`;
          break;
        case 'auth-service':
          metadataKey = `${componentName}-auth`;
          break;
        case 'monitoring':
          metadataKey = `${componentName}-monitoring`;
          break;
        case 'logging':
          metadataKey = `${componentName}-logging`;
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
      case 'api-gateway':
        Object.assign(presets, ApiGatewayConfigs);
        break;
      case 'search-engine':
        Object.assign(presets, SearchEngineConfigs);
        break;
      case 'object-storage':
        Object.assign(presets, ObjectStorageConfigs);
        break;
      case 'service-mesh':
        Object.assign(presets, ServiceMeshConfigs);
        break;
      case 'rate-limiter':
        Object.assign(presets, RateLimiterConfigs);
        break;
      case 'circuit-breaker':
        Object.assign(presets, CircuitBreakerConfigs);
        break;
      case 'auth-service':
        Object.assign(presets, AuthServiceConfigs);
        break;
      case 'monitoring':
        Object.assign(presets, MonitoringConfigs);
        break;
      case 'logging':
        Object.assign(presets, LoggingConfigs);
        break;
    }

    return presets;
  }
}

// Export singleton instance
export const componentLibrary = ComponentLibrary.getInstance();