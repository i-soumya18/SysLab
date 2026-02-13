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

// API Gateway component configurations
export const ApiGatewayConfigs = {
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
export const SearchEngineConfigs = {
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
export const ObjectStorageConfigs = {
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
export const ServiceMeshConfigs = {
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
export const RateLimiterConfigs = {
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
export const CircuitBreakerConfigs = {
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
export const AuthServiceConfigs = {
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
export const MonitoringConfigs = {
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
export const LoggingConfigs = {
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
      // For single-word types like 'database', 'cache', 'cdn', 'proxy', 'monitoring', 'logging'
      const parts = componentKey.split('-');
      if (parts.length >= 2) {
        componentType = parts[0];
        componentName = parts.slice(1).join('-');
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
      } else if (componentType === 'api-gateway') {
        metadataKey = `${componentName}-gateway`;
      } else if (componentType === 'search-engine') {
        metadataKey = `${componentName}-search`;
      } else if (componentType === 'object-storage') {
        metadataKey = `${componentName}-storage`;
      } else if (componentType === 'service-mesh') {
        metadataKey = `${componentName}-mesh`;
      } else if (componentType === 'rate-limiter') {
        metadataKey = `${componentName}-limiter`;
      } else if (componentType === 'circuit-breaker') {
        metadataKey = `${componentName}-breaker`;
      } else if (componentType === 'auth-service') {
        metadataKey = `${componentName}-auth`;
      } else if (componentType === 'monitoring') {
        metadataKey = `${componentName}-monitoring`;
      } else if (componentType === 'logging') {
        metadataKey = `${componentName}-logging`;
      }
      
      return this.componentMetadata.get(metadataKey) || this.componentMetadata.get(componentName);
    }
    
    return this.componentMetadata.get(componentKey);
  }

  public getAvailableComponents(): string[] {
    return Array.from(this.componentConfigs.keys());
  }

  public getComponentsByType(type: ComponentType): string[] {
    return Array.from(this.componentConfigs.keys()).filter(key => {
      // For multi-word types like 'api-gateway', check if key starts with 'api-gateway-'
      // For single-word types like 'cache', check if key starts with 'cache-'
      return key.startsWith(`${type}-`);
    });
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