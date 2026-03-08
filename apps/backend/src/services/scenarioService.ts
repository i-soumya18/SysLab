import { v4 as uuidv4 } from 'uuid';
import { Scenario, Workspace, UserProgress } from '../types';

/**
 * Enhanced Scenario Service implementing SRS FR-9.1
 * Manages learning scenarios, scenario library, and scenario execution
 * with difficulty levels, prerequisites, and comprehensive scenario catalog
 */
export class ScenarioService {
  private scenarios: Map<string, Scenario> = new Map();

  constructor() {
    this.initializeScenarios();
  }

  /**
   * Initialize comprehensive predefined scenarios implementing SRS FR-9.1
   * Covers common system design patterns with difficulty levels and prerequisites
   */
  private initializeScenarios(): void {
    const scenarios: Scenario[] = [
      // BEGINNER LEVEL SCENARIOS
      {
        id: 'basic-web-app',
        name: 'Basic Web Application',
        description: 'Design a simple web application with a database backend. Learn the fundamentals of client-server architecture.',
        difficulty: 'beginner',
        category: 'fundamentals',
        prerequisites: [],
        estimatedTimeMinutes: 30,
        tags: ['web-server', 'database', 'client-server', 'fundamentals'],
        learningOutcomes: [
          'Understand basic client-server architecture',
          'Learn about database connections',
          'Configure component capacity limits',
          'Observe system behavior under load'
        ],
        objectives: [
          'Create a web server component',
          'Add a database component',
          'Connect the web server to the database',
          'Configure appropriate parameters for expected load',
          'Run simulation and observe system behavior'
        ],
        initialWorkspace: {
          name: 'Basic Web App Scenario',
          description: 'Learn to design a basic web application architecture',
          components: [
            {
              id: 'client-1',
              type: 'client',
              componentKey: 'client-web',
              position: { x: 100, y: 300 },
              configuration: {
                capacity: 1000,
                latency: 50,
                failureRate: 0.001
              },
              metadata: {
                name: 'Web Client',
                description: 'Users accessing the web application',
                version: '1.0'
              }
            },
            {
              id: 'load-balancer-1',
              type: 'load-balancer',
              componentKey: 'load-balancer-nginx',
              position: { x: 300, y: 300 },
              configuration: {
                capacity: 10000,
                latency: 1,
                failureRate: 0.0001
              },
              metadata: {
                name: 'Nginx Load Balancer',
                description: 'Load balancer distributing traffic',
                version: '1.24'
              }
            },
            {
              id: 'web-server-1',
              type: 'web-server',
              componentKey: 'web-server-nodejs',
              position: { x: 500, y: 300 },
              configuration: {
                capacity: 3000,
                latency: 8,
                failureRate: 0.0015
              },
              metadata: {
                name: 'Node.js Server',
                description: 'Application server',
                version: '18.0'
              }
            },
            {
              id: 'database-1',
              type: 'database',
              componentKey: 'database-mysql',
              position: { x: 700, y: 300 },
              configuration: {
                capacity: 1000,
                latency: 5,
                failureRate: 0.001
              },
              metadata: {
                name: 'MySQL Database',
                description: 'Data storage',
                version: '8.0'
              }
            }
          ],
          connections: [
            {
              id: 'conn-1',
              sourceComponentId: 'client-1',
              targetComponentId: 'load-balancer-1',
              sourcePort: 'out',
              targetPort: 'in',
              configuration: {
                bandwidth: 1000,
                latency: 10,
                protocol: 'HTTP',
                reliability: 0.99
              }
            },
            {
              id: 'conn-2',
              sourceComponentId: 'load-balancer-1',
              targetComponentId: 'web-server-1',
              sourcePort: 'out',
              targetPort: 'in',
              configuration: {
                bandwidth: 1000,
                latency: 5,
                protocol: 'HTTP',
                reliability: 0.99
              }
            },
            {
              id: 'conn-3',
              sourceComponentId: 'web-server-1',
              targetComponentId: 'database-1',
              sourcePort: 'out',
              targetPort: 'in',
              configuration: {
                bandwidth: 500,
                latency: 5,
                protocol: 'DATABASE',
                reliability: 0.99
              }
            }
          ],
          configuration: {
            duration: 300,
            loadPattern: {
              type: 'constant',
              baseLoad: 100
            },
            failureScenarios: [],
            metricsCollection: {
              collectionInterval: 1000,
              retentionPeriod: 3600,
              enabledMetrics: ['latency', 'throughput', 'errors']
            }
          }
        },
        hints: [
          'Start by adding a web server from the component library',
          'Add a database component to store application data',
          'Connect the web server to the database using a database connection',
          'Configure the web server capacity based on expected load (try 1000 RPS)',
          'Set appropriate database connection limits (try 100 connections)',
          'Run the simulation to see how your system performs'
        ],
        evaluationCriteria: [
          'Web server component present',
          'Database component present',
          'Valid connection between web server and database',
          'Appropriate capacity configuration',
          'System handles target load without errors',
          'Latency remains under 200ms at target load'
        ]
      },
      {
        id: 'simple-caching',
        name: 'Introduction to Caching',
        description: 'Add a cache layer to improve database performance. Learn how caching reduces latency and database load.',
        difficulty: 'beginner',
        category: 'caching',
        prerequisites: ['basic-web-app'],
        estimatedTimeMinutes: 45,
        tags: ['cache', 'performance', 'database-optimization'],
        learningOutcomes: [
          'Understand cache-aside pattern',
          'Learn about cache hit ratios',
          'Observe performance improvements with caching',
          'Configure cache eviction policies'
        ],
        objectives: [
          'Add a cache component to existing web-database system',
          'Configure cache parameters (size, TTL)',
          'Observe performance improvement',
          'Measure cache hit ratio',
          'Test system behavior when cache fails'
        ],
        initialWorkspace: {
          name: 'Simple Caching Scenario',
          description: 'Learn to optimize performance with caching',
          components: [
            {
              id: 'web-server-1',
              type: 'web-server',
              componentKey: 'web-server-nodejs',
              position: { x: 200, y: 200 },
              configuration: {
                capacity: 1000,
                latency: 50,
                failureRate: 0.01
              },
              metadata: {
                name: 'Web Server',
                description: 'Main application server',
                version: '1.0.0'
              }
            },
            {
              id: 'database-1',
              type: 'database',
              componentKey: 'database-mysql',
              position: { x: 400, y: 200 },
              configuration: {
                capacity: 500,
                latency: 100,
                failureRate: 0.005,
                connectionLimit: 100
              },
              metadata: {
                name: 'Primary Database',
                description: 'Main data store',
                version: '1.0.0'
              }
            },
            {
              id: 'cache-1',
              type: 'cache',
              componentKey: 'cache-redis',
              position: { x: 300, y: 350 },
              configuration: {
                capacity: 8000,
                latency: 0.8,
                failureRate: 0.0002
              },
              metadata: {
                name: 'Redis Cache',
                description: 'Cache layer for performance',
                version: '7.0'
              }
            }
          ],
          connections: [
            {
              id: 'web-to-cache',
              sourceComponentId: 'web-server-1',
              targetComponentId: 'cache-1',
              sourcePort: 'out',
              targetPort: 'in',
              configuration: {
                bandwidth: 1000,
                latency: 1,
                protocol: 'TCP',
                reliability: 0.99
              }
            },
            {
              id: 'cache-to-db',
              sourceComponentId: 'cache-1',
              targetComponentId: 'database-1',
              sourcePort: 'out',
              targetPort: 'in',
              configuration: {
                bandwidth: 500,
                latency: 5,
                protocol: 'DATABASE',
                reliability: 0.99
              }
            },
            {
              id: 'web-to-db',
              sourceComponentId: 'web-server-1',
              targetComponentId: 'database-1',
              sourcePort: 'out',
              targetPort: 'in',
              configuration: {
                bandwidth: 1000,
                latency: 5,
                protocol: 'DATABASE',
                reliability: 0.99
              }
            }
          ],
          configuration: {
            duration: 600,
            loadPattern: {
              type: 'ramp',
              baseLoad: 200,
              peakLoad: 800
            },
            failureScenarios: [],
            metricsCollection: {
              collectionInterval: 1000,
              retentionPeriod: 3600,
              enabledMetrics: ['latency', 'throughput', 'errors', 'cache-hits', 'cache-misses']
            }
          }
        },
        hints: [
          'Add a cache component between the web server and database',
          'Configure cache size (try 1000 entries) and TTL (try 300 seconds)',
          'Connect web server to cache, and cache to database',
          'Run simulation and observe latency improvements',
          'Monitor cache hit ratio - aim for 70%+ for good performance',
          'Try injecting cache failure to see graceful degradation'
        ],
        evaluationCriteria: [
          'Cache component added to system',
          'Cache properly positioned in data flow',
          'Appropriate cache configuration (size, TTL)',
          'Improved system latency with cache (>30% improvement)',
          'Cache hit ratio above 70%',
          'System degrades gracefully on cache failure'
        ]
      },

      // INTERMEDIATE LEVEL SCENARIOS
      {
        id: 'load-balanced-system',
        name: 'Load Balanced System',
        description: 'Design a scalable system with load balancing across multiple servers. Learn horizontal scaling patterns.',
        difficulty: 'intermediate',
        category: 'scaling',
        prerequisites: ['basic-web-app', 'simple-caching'],
        estimatedTimeMinutes: 60,
        tags: ['load-balancer', 'horizontal-scaling', 'high-availability'],
        learningOutcomes: [
          'Understand horizontal scaling benefits',
          'Learn load balancing algorithms',
          'Configure server pools',
          'Handle server failures gracefully'
        ],
        objectives: [
          'Create multiple web server instances',
          'Add a load balancer component',
          'Configure load balancing algorithm',
          'Add a shared database backend',
          'Test system under varying load',
          'Simulate server failure and observe recovery'
        ],
        initialWorkspace: {
          name: 'Load Balanced System Scenario',
          description: 'Learn to design systems with load balancing',
          components: [],
          connections: [],
          configuration: {
            duration: 600,
            loadPattern: {
              type: 'ramp',
              baseLoad: 100,
              peakLoad: 1000
            },
            failureScenarios: [
              {
                componentId: 'web-server-2',
                failureType: 'crash',
                startTime: 300,
                duration: 120,
                severity: 1.0
              }
            ],
            metricsCollection: {
              collectionInterval: 1000,
              retentionPeriod: 3600,
              enabledMetrics: ['latency', 'throughput', 'errors', 'cpu', 'memory', 'load-distribution']
            }
          }
        },
        hints: [
          'Add a load balancer as the entry point',
          'Create 3-4 web server instances behind the load balancer',
          'Choose round-robin or least-connections algorithm',
          'Add a shared database that all web servers can access',
          'Configure connection pooling for database connections',
          'Monitor load distribution across servers during simulation'
        ],
        evaluationCriteria: [
          'Load balancer component present',
          'Multiple web server instances (3+)',
          'Proper load balancer configuration',
          'Shared database backend',
          'System scales effectively under load',
          'No single point of failure in web tier',
          'Load distributed evenly across servers',
          'System recovers gracefully from server failure'
        ]
      },
      {
        id: 'microservices-basics',
        name: 'Microservices Architecture',
        description: 'Break down a monolith into microservices. Learn service decomposition and inter-service communication.',
        difficulty: 'intermediate',
        category: 'microservices',
        prerequisites: ['load-balanced-system'],
        estimatedTimeMinutes: 90,
        tags: ['microservices', 'service-decomposition', 'api-gateway', 'service-communication'],
        learningOutcomes: [
          'Understand service decomposition principles',
          'Learn inter-service communication patterns',
          'Configure API gateways',
          'Handle service dependencies'
        ],
        objectives: [
          'Break monolith into separate services (user, order, inventory)',
          'Add API gateway for external access',
          'Implement service-to-service communication',
          'Add message queues for async processing',
          'Configure service discovery',
          'Test system resilience to service failures'
        ],
        initialWorkspace: {
          name: 'Microservices Architecture Scenario',
          description: 'Learn to design microservices architectures',
          components: [],
          connections: [],
          configuration: {
            duration: 900,
            loadPattern: {
              type: 'realistic',
              baseLoad: 200,
              peakLoad: 1000
            },
            failureScenarios: [
              {
                componentId: 'user-service',
                failureType: 'crash',
                startTime: 400,
                duration: 60,
                severity: 1.0
              }
            ],
            metricsCollection: {
              collectionInterval: 1000,
              retentionPeriod: 3600,
              enabledMetrics: ['latency', 'throughput', 'errors', 'queue-depth', 'service-health']
            }
          }
        },
        hints: [
          'Create separate services for different business domains',
          'Use a load balancer as API gateway',
          'Add message queues for asynchronous communication',
          'Consider service dependencies and failure modes',
          'Implement circuit breaker patterns for resilience',
          'Monitor service health and queue depths'
        ],
        evaluationCriteria: [
          'Multiple service components present (3+)',
          'API gateway/load balancer at entry point',
          'Message queue for async communication',
          'Proper service isolation',
          'System resilient to individual service failures',
          'Appropriate service sizing and configuration',
          'Service dependencies properly managed'
        ]
      },

      // ADVANCED LEVEL SCENARIOS
      {
        id: 'global-cdn-system',
        name: 'Global CDN and Edge Computing',
        description: 'Design a globally distributed system with CDN and edge computing. Learn geographic distribution patterns.',
        difficulty: 'advanced',
        category: 'global-scale',
        prerequisites: ['microservices-basics'],
        estimatedTimeMinutes: 120,
        tags: ['cdn', 'edge-computing', 'global-distribution', 'latency-optimization'],
        learningOutcomes: [
          'Understand global content distribution',
          'Learn edge computing benefits',
          'Configure geographic routing',
          'Optimize for global latency'
        ],
        objectives: [
          'Add CDN for static content delivery',
          'Configure edge servers in multiple regions',
          'Implement geographic load balancing',
          'Optimize cache strategies for global users',
          'Handle cross-region data consistency',
          'Test performance from different geographic locations'
        ],
        initialWorkspace: {
          name: 'Global CDN System Scenario',
          description: 'Learn to design globally distributed systems',
          components: [],
          connections: [],
          configuration: {
            duration: 1200,
            loadPattern: {
              type: 'geographic',
              baseLoad: 500
            },
            failureScenarios: [
              {
                componentId: 'cdn-us-east',
                failureType: 'regional-outage',
                startTime: 600,
                duration: 180,
                severity: 1.0
              }
            ],
            metricsCollection: {
              collectionInterval: 1000,
              retentionPeriod: 7200,
              enabledMetrics: ['latency', 'throughput', 'errors', 'cache-hits', 'geographic-distribution']
            }
          }
        },
        hints: [
          'Add CDN components in multiple regions (US, EU, Asia)',
          'Configure origin servers and cache hierarchies',
          'Set up geographic routing based on user location',
          'Consider cache invalidation strategies',
          'Monitor cache hit ratios across regions',
          'Test failover when regional CDN goes down'
        ],
        evaluationCriteria: [
          'CDN components in multiple regions',
          'Proper cache hierarchy configuration',
          'Geographic routing implemented',
          'Cache hit ratios >90% for static content',
          'Latency optimized for global users (<100ms)',
          'System handles regional failures gracefully',
          'Cross-region consistency maintained'
        ]
      },
      {
        id: 'high-throughput-system',
        name: 'High-Throughput Data Processing',
        description: 'Design a system capable of processing millions of requests per second. Learn about sharding, partitioning, and stream processing.',
        difficulty: 'advanced',
        category: 'high-performance',
        prerequisites: ['microservices-basics', 'global-cdn-system'],
        estimatedTimeMinutes: 150,
        tags: ['high-throughput', 'sharding', 'stream-processing', 'data-partitioning'],
        learningOutcomes: [
          'Understand horizontal partitioning strategies',
          'Learn stream processing patterns',
          'Configure database sharding',
          'Handle hot partitions and load balancing'
        ],
        objectives: [
          'Design system to handle 1M+ RPS',
          'Implement database sharding strategy',
          'Add stream processing for real-time analytics',
          'Configure multiple load balancer tiers',
          'Implement caching at multiple levels',
          'Handle hot partitions and uneven load distribution'
        ],
        initialWorkspace: {
          name: 'High-Throughput System Scenario',
          description: 'Learn to design high-throughput systems',
          components: [],
          connections: [],
          configuration: {
            duration: 1800,
            loadPattern: {
              type: 'spike',
              baseLoad: 10000,
              peakLoad: 1000000
            },
            failureScenarios: [
              {
                componentId: 'shard-1',
                failureType: 'hot-partition',
                startTime: 900,
                duration: 300,
                severity: 0.8
              }
            ],
            metricsCollection: {
              collectionInterval: 500,
              retentionPeriod: 7200,
              enabledMetrics: ['latency', 'throughput', 'errors', 'shard-distribution', 'queue-depth', 'cpu', 'memory']
            }
          }
        },
        hints: [
          'Use multiple tiers of load balancers',
          'Implement database sharding with consistent hashing',
          'Add stream processing queues for real-time data',
          'Configure multiple cache layers (L1, L2)',
          'Monitor shard distribution and hot partitions',
          'Consider read replicas for read-heavy workloads'
        ],
        evaluationCriteria: [
          'System handles 1M+ RPS without degradation',
          'Database sharding properly implemented',
          'Stream processing queues configured',
          'Multiple cache layers present',
          'Load distributed evenly across shards',
          'Hot partition handling implemented',
          'System maintains <50ms p99 latency at peak load'
        ]
      },

      // EXPERT LEVEL SCENARIOS
      {
        id: 'chaos-engineering',
        name: 'Chaos Engineering and Resilience',
        description: 'Build a system that can withstand various failure modes. Learn chaos engineering principles and resilience patterns.',
        difficulty: 'expert',
        category: 'resilience',
        prerequisites: ['high-throughput-system'],
        estimatedTimeMinutes: 180,
        tags: ['chaos-engineering', 'resilience', 'fault-tolerance', 'disaster-recovery'],
        learningOutcomes: [
          'Understand chaos engineering principles',
          'Implement circuit breaker patterns',
          'Design for graceful degradation',
          'Configure disaster recovery procedures'
        ],
        objectives: [
          'Design system with multiple failure modes',
          'Implement circuit breakers and bulkheads',
          'Configure automatic failover mechanisms',
          'Add health checks and monitoring',
          'Test system under various failure scenarios',
          'Implement graceful degradation strategies'
        ],
        initialWorkspace: {
          name: 'Chaos Engineering Scenario',
          description: 'Learn to build resilient systems',
          components: [],
          connections: [],
          configuration: {
            duration: 2400,
            loadPattern: {
              type: 'realistic',
              baseLoad: 5000,
              peakLoad: 20000
            },
            failureScenarios: [
              {
                componentId: 'primary-db',
                failureType: 'crash',
                startTime: 600,
                duration: 300,
                severity: 1.0
              },
              {
                componentId: 'cache-cluster',
                failureType: 'network-partition',
                startTime: 1200,
                duration: 180,
                severity: 0.7
              },
              {
                componentId: 'region-us-east',
                failureType: 'regional-outage',
                startTime: 1800,
                duration: 600,
                severity: 1.0
              }
            ],
            metricsCollection: {
              collectionInterval: 500,
              retentionPeriod: 10800,
              enabledMetrics: ['latency', 'throughput', 'errors', 'circuit-breaker-state', 'failover-events', 'recovery-time']
            }
          }
        },
        hints: [
          'Implement circuit breakers between all service calls',
          'Add health checks and automatic failover',
          'Configure bulkhead patterns to isolate failures',
          'Set up cross-region replication and failover',
          'Monitor circuit breaker states and recovery times',
          'Design graceful degradation for non-critical features'
        ],
        evaluationCriteria: [
          'Circuit breakers implemented between services',
          'Automatic failover mechanisms configured',
          'System maintains >95% availability during failures',
          'Graceful degradation strategies implemented',
          'Recovery time <60 seconds for most failures',
          'Cross-region failover working correctly',
          'System performance degrades gracefully, not catastrophically'
        ]
      },

      // NEW SCENARIOS USING RECENTLY ADDED COMPONENTS
      {
        id: 'ecommerce-platform',
        name: 'E-Commerce Platform',
        description: 'Design a complete e-commerce platform with product search, image storage, authentication, and order processing. Learn to integrate multiple modern components.',
        difficulty: 'intermediate',
        category: 'full-stack',
        prerequisites: ['simple-caching'],
        estimatedTimeMinutes: 90,
        tags: ['ecommerce', 'api-gateway', 'search-engine', 'object-storage', 'auth-service', 'message-queue'],
        learningOutcomes: [
          'Understand API Gateway patterns',
          'Learn search engine integration',
          'Configure object storage for media',
          'Implement authentication services',
          'Design async order processing'
        ],
        objectives: [
          'Add API Gateway for request routing',
          'Integrate search engine for product search',
          'Configure object storage for product images',
          'Add authentication service for user management',
          'Implement message queue for order processing',
          'Add monitoring and logging services',
          'Test system under realistic e-commerce load'
        ],
        initialWorkspace: {
          name: 'E-Commerce Platform Scenario',
          description: 'Build a complete e-commerce platform',
          components: [
            {
              id: 'client-1',
              type: 'client',
              componentKey: 'client-web',
              position: { x: 100, y: 300 },
              configuration: {
                capacity: 1000,
                latency: 50,
                failureRate: 0.001
              },
              metadata: {
                name: 'Web Client',
                description: 'Users browsing the e-commerce site',
                version: '1.0'
              }
            },
            {
              id: 'api-gateway-1',
              type: 'api-gateway',
              componentKey: 'api-gateway-kong',
              position: { x: 300, y: 300 },
              configuration: {
                capacity: 10000,
                latency: 5,
                failureRate: 0.0001
              },
              metadata: {
                name: 'Kong API Gateway',
                description: 'API Gateway for request routing',
                version: '3.0'
              }
            },
            {
              id: 'web-server-1',
              type: 'web-server',
              componentKey: 'web-server-nodejs',
              position: { x: 500, y: 300 },
              configuration: {
                capacity: 3000,
                latency: 8,
                failureRate: 0.0015
              },
              metadata: {
                name: 'Node.js Server',
                description: 'Application server',
                version: '18.0'
              }
            },
            {
              id: 'search-engine-1',
              type: 'search-engine',
              componentKey: 'search-engine-elasticsearch',
              position: { x: 500, y: 150 },
              configuration: {
                capacity: 5000,
                latency: 10,
                failureRate: 0.001
              },
              metadata: {
                name: 'Elasticsearch',
                description: 'Product search engine',
                version: '8.0'
              }
            },
            {
              id: 'object-storage-1',
              type: 'object-storage',
              componentKey: 'object-storage-awsS3',
              position: { x: 500, y: 450 },
              configuration: {
                capacity: 1000000,
                latency: 50,
                failureRate: 0.00001
              },
              metadata: {
                name: 'AWS S3',
                description: 'Product images storage',
                version: 'latest'
              }
            },
            {
              id: 'auth-service-1',
              type: 'auth-service',
              componentKey: 'auth-service-jwt',
              position: { x: 700, y: 200 },
              configuration: {
                capacity: 8000,
                latency: 5,
                failureRate: 0.0003
              },
              metadata: {
                name: 'JWT Auth Service',
                description: 'User authentication',
                version: '9.0'
              }
            },
            {
              id: 'message-queue-1',
              type: 'message-queue',
              componentKey: 'message-queue-kafka',
              position: { x: 700, y: 400 },
              configuration: {
                capacity: 100000,
                latency: 2,
                failureRate: 0.0001
              },
              metadata: {
                name: 'Apache Kafka',
                description: 'Order processing queue',
                version: '3.5'
              }
            },
            {
              id: 'database-1',
              type: 'database',
              componentKey: 'database-mysql',
              position: { x: 900, y: 300 },
              configuration: {
                capacity: 1000,
                latency: 5,
                failureRate: 0.001
              },
              metadata: {
                name: 'MySQL Database',
                description: 'Product and order data',
                version: '8.0'
              }
            },
            {
              id: 'monitoring-1',
              type: 'monitoring',
              componentKey: 'monitoring-prometheus',
              position: { x: 300, y: 150 },
              configuration: {
                capacity: 10000,
                latency: 10,
                failureRate: 0.0002
              },
              metadata: {
                name: 'Prometheus',
                description: 'Metrics collection',
                version: '2.45'
              }
            },
            {
              id: 'logging-1',
              type: 'logging',
              componentKey: 'logging-elasticsearch',
              position: { x: 300, y: 450 },
              configuration: {
                capacity: 8000,
                latency: 8,
                failureRate: 0.0003
              },
              metadata: {
                name: 'Elasticsearch Logging',
                description: 'Centralized logging',
                version: '8.0'
              }
            }
          ],
          connections: [
            {
              id: 'conn-1',
              sourceComponentId: 'client-1',
              targetComponentId: 'api-gateway-1',
              sourcePort: 'out',
              targetPort: 'in',
              configuration: {
                bandwidth: 1000,
                latency: 10,
                protocol: 'HTTP',
                reliability: 0.99
              }
            },
            {
              id: 'conn-2',
              sourceComponentId: 'api-gateway-1',
              targetComponentId: 'web-server-1',
              sourcePort: 'out',
              targetPort: 'in',
              configuration: {
                bandwidth: 1000,
                latency: 5,
                protocol: 'HTTP',
                reliability: 0.99
              }
            },
            {
              id: 'conn-3',
              sourceComponentId: 'web-server-1',
              targetComponentId: 'search-engine-1',
              sourcePort: 'out',
              targetPort: 'in',
              configuration: {
                bandwidth: 500,
                latency: 5,
                protocol: 'HTTP',
                reliability: 0.98
              }
            },
            {
              id: 'conn-4',
              sourceComponentId: 'web-server-1',
              targetComponentId: 'object-storage-1',
              sourcePort: 'out',
              targetPort: 'in',
              configuration: {
                bandwidth: 500,
                latency: 20,
                protocol: 'HTTP',
                reliability: 0.99
              }
            },
            {
              id: 'conn-5',
              sourceComponentId: 'api-gateway-1',
              targetComponentId: 'auth-service-1',
              sourcePort: 'out',
              targetPort: 'in',
              configuration: {
                bandwidth: 500,
                latency: 5,
                protocol: 'HTTP',
                reliability: 0.99
              }
            },
            {
              id: 'conn-6',
              sourceComponentId: 'web-server-1',
              targetComponentId: 'message-queue-1',
              sourcePort: 'out',
              targetPort: 'in',
              configuration: {
                bandwidth: 1000,
                latency: 2,
                protocol: 'TCP',
                reliability: 0.99
              }
            },
            {
              id: 'conn-7',
              sourceComponentId: 'web-server-1',
              targetComponentId: 'database-1',
              sourcePort: 'out',
              targetPort: 'in',
              configuration: {
                bandwidth: 500,
                latency: 5,
                protocol: 'DATABASE',
                reliability: 0.99
              }
            },
            {
              id: 'conn-8',
              sourceComponentId: 'web-server-1',
              targetComponentId: 'monitoring-1',
              sourcePort: 'out',
              targetPort: 'in',
              configuration: {
                bandwidth: 100,
                latency: 5,
                protocol: 'HTTP',
                reliability: 0.95
              }
            },
            {
              id: 'conn-9',
              sourceComponentId: 'web-server-1',
              targetComponentId: 'logging-1',
              sourcePort: 'out',
              targetPort: 'in',
              configuration: {
                bandwidth: 200,
                latency: 5,
                protocol: 'HTTP',
                reliability: 0.95
              }
            }
          ],
          configuration: {
            duration: 900,
            loadPattern: {
              type: 'realistic',
              baseLoad: 500,
              peakLoad: 5000
            },
            failureScenarios: [
              {
                componentId: 'search-engine',
                failureType: 'degradation',
                startTime: 400,
                duration: 120,
                severity: 0.5
              }
            ],
            metricsCollection: {
              collectionInterval: 1000,
              retentionPeriod: 3600,
              enabledMetrics: ['latency', 'throughput', 'errors', 'cache-hits', 'search-latency', 'auth-latency']
            }
          }
        },
        hints: [
          'Start with API Gateway as the entry point',
          'Add search engine for product search functionality',
          'Use object storage for product images and media',
          'Integrate authentication service for user sessions',
          'Add message queue for asynchronous order processing',
          'Configure monitoring to track all services',
          'Set up logging for debugging and analytics'
        ],
        evaluationCriteria: [
          'API Gateway configured and routing requests',
          'Search engine integrated and responding',
          'Object storage handling image requests',
          'Authentication service protecting endpoints',
          'Message queue processing orders asynchronously',
          'Monitoring and logging services active',
          'System handles peak load gracefully',
          'Search latency <100ms for typical queries'
        ]
      },
      {
        id: 'social-media-platform',
        name: 'Social Media Platform',
        description: 'Design a social media platform handling millions of posts, real-time feeds, media uploads, and user interactions. Learn to scale social features.',
        difficulty: 'advanced',
        category: 'social-platform',
        prerequisites: ['ecommerce-platform'],
        estimatedTimeMinutes: 120,
        tags: ['social-media', 'real-time', 'feed-generation', 'media-processing', 'service-mesh'],
        learningOutcomes: [
          'Understand feed generation at scale',
          'Learn service mesh patterns',
          'Configure rate limiting for API protection',
          'Implement circuit breakers for resilience',
          'Design media processing pipelines'
        ],
        objectives: [
          'Add service mesh for microservices communication',
          'Configure rate limiters to prevent abuse',
          'Implement circuit breakers for fault tolerance',
          'Set up object storage for user media',
          'Add message queues for feed generation',
          'Configure monitoring for all services',
          'Test system under viral traffic spikes'
        ],
        initialWorkspace: {
          name: 'Social Media Platform Scenario',
          description: 'Build a scalable social media platform',
          components: [],
          connections: [],
          configuration: {
            duration: 1200,
            loadPattern: {
              type: 'spike',
              baseLoad: 2000,
              peakLoad: 50000
            },
            failureScenarios: [
              {
                componentId: 'feed-service',
                failureType: 'overload',
                startTime: 600,
                duration: 180,
                severity: 0.8
              },
              {
                componentId: 'media-storage',
                failureType: 'capacity-exceeded',
                startTime: 900,
                duration: 120,
                severity: 0.6
              }
            ],
            metricsCollection: {
              collectionInterval: 500,
              retentionPeriod: 7200,
              enabledMetrics: ['latency', 'throughput', 'errors', 'rate-limit-hits', 'circuit-breaker-state', 'queue-depth']
            }
          }
        },
        hints: [
          'Use service mesh to manage microservices communication',
          'Add rate limiters to protect APIs from abuse',
          'Implement circuit breakers between services',
          'Use object storage for user-uploaded media',
          'Configure message queues for feed generation',
          'Set up comprehensive monitoring',
          'Test rate limiting under high traffic',
          'Observe circuit breaker behavior during failures'
        ],
        evaluationCriteria: [
          'Service mesh managing inter-service communication',
          'Rate limiters protecting APIs effectively',
          'Circuit breakers preventing cascading failures',
          'Object storage handling media uploads',
          'Message queues processing feeds asynchronously',
          'System handles viral traffic spikes',
          'Rate limiting prevents system overload',
          'Circuit breakers recover gracefully'
        ]
      },
      {
        id: 'observable-microservices',
        name: 'Observable Microservices System',
        description: 'Build a fully observable microservices system with comprehensive monitoring, logging, and distributed tracing. Learn observability best practices.',
        difficulty: 'intermediate',
        category: 'observability',
        prerequisites: ['microservices-basics'],
        estimatedTimeMinutes: 75,
        tags: ['monitoring', 'logging', 'observability', 'distributed-tracing', 'metrics'],
        learningOutcomes: [
          'Understand observability pillars (metrics, logs, traces)',
          'Configure monitoring dashboards',
          'Set up centralized logging',
          'Learn distributed tracing patterns',
          'Implement alerting strategies'
        ],
        objectives: [
          'Add monitoring service for metrics collection',
          'Configure logging service for centralized logs',
          'Set up monitoring for all microservices',
          'Configure log aggregation and search',
          'Create monitoring dashboards',
          'Test observability under failure scenarios',
          'Verify distributed tracing works correctly'
        ],
        initialWorkspace: {
          name: 'Observable Microservices Scenario',
          description: 'Learn observability in microservices',
          components: [
            {
              id: 'user-service',
              type: 'web-server',
              componentKey: 'web-server-nodejs',
              position: { x: 200, y: 200 },
              configuration: {
                capacity: 1000,
                latency: 50,
                failureRate: 0.01
              },
              metadata: {
                name: 'User Service',
                description: 'User management service',
                version: '1.0.0'
              }
            },
            {
              id: 'order-service',
              type: 'web-server',
              componentKey: 'web-server-nodejs',
              position: { x: 400, y: 200 },
              configuration: {
                capacity: 800,
                latency: 60,
                failureRate: 0.01
              },
              metadata: {
                name: 'Order Service',
                description: 'Order processing service',
                version: '1.0.0'
              }
            },
            {
              id: 'monitoring-1',
              type: 'monitoring',
              componentKey: 'monitoring-prometheus',
              position: { x: 300, y: 50 },
              configuration: {
                capacity: 10000,
                latency: 10,
                failureRate: 0.0002
              },
              metadata: {
                name: 'Prometheus',
                description: 'Metrics collection',
                version: '2.45'
              }
            },
            {
              id: 'logging-1',
              type: 'logging',
              componentKey: 'logging-elasticsearch',
              position: { x: 300, y: 350 },
              configuration: {
                capacity: 8000,
                latency: 8,
                failureRate: 0.0003
              },
              metadata: {
                name: 'Elasticsearch Logging',
                description: 'Centralized logging',
                version: '8.0'
              }
            }
          ],
          connections: [
            {
              id: 'conn-1',
              sourceComponentId: 'user-service',
              targetComponentId: 'monitoring-1',
              sourcePort: 'out',
              targetPort: 'in',
              configuration: {
                bandwidth: 100,
                latency: 5,
                protocol: 'HTTP',
                reliability: 0.95
              }
            },
            {
              id: 'conn-2',
              sourceComponentId: 'order-service',
              targetComponentId: 'monitoring-1',
              sourcePort: 'out',
              targetPort: 'in',
              configuration: {
                bandwidth: 100,
                latency: 5,
                protocol: 'HTTP',
                reliability: 0.95
              }
            },
            {
              id: 'conn-3',
              sourceComponentId: 'user-service',
              targetComponentId: 'logging-1',
              sourcePort: 'out',
              targetPort: 'in',
              configuration: {
                bandwidth: 200,
                latency: 5,
                protocol: 'HTTP',
                reliability: 0.95
              }
            },
            {
              id: 'conn-4',
              sourceComponentId: 'order-service',
              targetComponentId: 'logging-1',
              sourcePort: 'out',
              targetPort: 'in',
              configuration: {
                bandwidth: 200,
                latency: 5,
                protocol: 'HTTP',
                reliability: 0.95
              }
            }
          ],
          configuration: {
            duration: 600,
            loadPattern: {
              type: 'ramp',
              baseLoad: 300,
              peakLoad: 1500
            },
            failureScenarios: [
              {
                componentId: 'order-service',
                failureType: 'latency-spike',
                startTime: 300,
                duration: 60,
                severity: 0.7
              }
            ],
            metricsCollection: {
              collectionInterval: 1000,
              retentionPeriod: 3600,
              enabledMetrics: ['latency', 'throughput', 'errors', 'cpu', 'memory', 'request-trace']
            }
          }
        },
        hints: [
          'Add monitoring service (Prometheus/Grafana)',
          'Configure logging service (Elasticsearch)',
          'Connect all services to monitoring',
          'Set up log aggregation from all services',
          'Configure alerting thresholds',
          'Monitor service dependencies',
          'Observe distributed traces across services'
        ],
        evaluationCriteria: [
          'Monitoring service collecting metrics from all services',
          'Logging service aggregating logs',
          'Metrics dashboards showing service health',
          'Logs searchable and indexed',
          'Distributed tracing working across services',
          'Alerts configured for critical metrics',
          'Observability helps identify bottlenecks quickly'
        ]
      },
      {
        id: 'secure-api-platform',
        name: 'Secure API Platform',
        description: 'Design a secure API platform with authentication, rate limiting, and circuit breakers. Learn API security and resilience patterns.',
        difficulty: 'intermediate',
        category: 'security',
        prerequisites: ['load-balanced-system'],
        estimatedTimeMinutes: 80,
        tags: ['api-security', 'authentication', 'rate-limiting', 'circuit-breaker', 'api-gateway'],
        learningOutcomes: [
          'Understand API security best practices',
          'Learn authentication patterns',
          'Configure rate limiting strategies',
          'Implement circuit breakers',
          'Design secure API gateways'
        ],
        objectives: [
          'Add API Gateway as entry point',
          'Configure authentication service',
          'Implement rate limiters',
          'Add circuit breakers for resilience',
          'Test API under attack scenarios',
          'Verify rate limiting prevents abuse',
          'Test circuit breaker behavior'
        ],
        initialWorkspace: {
          name: 'Secure API Platform Scenario',
          description: 'Build a secure and resilient API platform',
          components: [
            {
              id: 'client-1',
              type: 'client',
              componentKey: 'client-api',
              position: { x: 100, y: 300 },
              configuration: {
                capacity: 2000,
                latency: 20,
                failureRate: 0.0005
              },
              metadata: {
                name: 'API Client',
                description: 'API consumers',
                version: '1.0'
              }
            },
            {
              id: 'api-gateway-1',
              type: 'api-gateway',
              componentKey: 'api-gateway-kong',
              position: { x: 300, y: 300 },
              configuration: {
                capacity: 15000,
                latency: 3,
                failureRate: 0.0002
              },
              metadata: {
                name: 'Kong API Gateway',
                description: 'API Gateway for routing',
                version: '3.0'
              }
            },
            {
              id: 'rate-limiter-1',
              type: 'rate-limiter',
              componentKey: 'rate-limiter-redisRateLimiter',
              position: { x: 500, y: 200 },
              configuration: {
                capacity: 50000,
                latency: 0.5,
                failureRate: 0.0001
              },
              metadata: {
                name: 'Redis Rate Limiter',
                description: 'Rate limiting protection',
                version: '7.0'
              }
            },
            {
              id: 'auth-service-1',
              type: 'auth-service',
              componentKey: 'auth-service-jwt',
              position: { x: 500, y: 400 },
              configuration: {
                capacity: 8000,
                latency: 5,
                failureRate: 0.0003
              },
              metadata: {
                name: 'JWT Auth Service',
                description: 'Authentication service',
                version: '9.0'
              }
            },
            {
              id: 'circuit-breaker-1',
              type: 'circuit-breaker',
              componentKey: 'circuit-breaker-resilience4j',
              position: { x: 700, y: 200 },
              configuration: {
                capacity: 12000,
                latency: 0.15,
                failureRate: 0.00008
              },
              metadata: {
                name: 'Resilience4j Circuit Breaker',
                description: 'Fault tolerance',
                version: '1.17'
              }
            },
            {
              id: 'backend-service-1',
              type: 'web-server',
              componentKey: 'web-server-nodejs',
              position: { x: 900, y: 300 },
              configuration: {
                capacity: 3000,
                latency: 8,
                failureRate: 0.0015
              },
              metadata: {
                name: 'Backend Service',
                description: 'API backend service',
                version: '18.0'
              }
            }
          ],
          connections: [
            {
              id: 'conn-1',
              sourceComponentId: 'client-1',
              targetComponentId: 'api-gateway-1',
              sourcePort: 'out',
              targetPort: 'in',
              configuration: {
                bandwidth: 1000,
                latency: 10,
                protocol: 'HTTP',
                reliability: 0.99
              }
            },
            {
              id: 'conn-2',
              sourceComponentId: 'api-gateway-1',
              targetComponentId: 'rate-limiter-1',
              sourcePort: 'out',
              targetPort: 'in',
              configuration: {
                bandwidth: 1000,
                latency: 1,
                protocol: 'HTTP',
                reliability: 0.99
              }
            },
            {
              id: 'conn-3',
              sourceComponentId: 'api-gateway-1',
              targetComponentId: 'auth-service-1',
              sourcePort: 'out',
              targetPort: 'in',
              configuration: {
                bandwidth: 500,
                latency: 5,
                protocol: 'HTTP',
                reliability: 0.99
              }
            },
            {
              id: 'conn-4',
              sourceComponentId: 'rate-limiter-1',
              targetComponentId: 'circuit-breaker-1',
              sourcePort: 'out',
              targetPort: 'in',
              configuration: {
                bandwidth: 1000,
                latency: 1,
                protocol: 'HTTP',
                reliability: 0.99
              }
            },
            {
              id: 'conn-5',
              sourceComponentId: 'circuit-breaker-1',
              targetComponentId: 'backend-service-1',
              sourcePort: 'out',
              targetPort: 'in',
              configuration: {
                bandwidth: 1000,
                latency: 5,
                protocol: 'HTTP',
                reliability: 0.99
              }
            }
          ],
          configuration: {
            duration: 900,
            loadPattern: {
              type: 'spike',
              baseLoad: 500,
              peakLoad: 10000
            },
            failureScenarios: [
              {
                componentId: 'backend-service',
                failureType: 'overload',
                startTime: 400,
                duration: 120,
                severity: 0.9
              }
            ],
            metricsCollection: {
              collectionInterval: 1000,
              retentionPeriod: 3600,
              enabledMetrics: ['latency', 'throughput', 'errors', 'rate-limit-hits', 'auth-failures', 'circuit-breaker-state']
            }
          }
        },
        hints: [
          'Start with API Gateway for request routing',
          'Add authentication service for API keys/tokens',
          'Configure rate limiters to prevent abuse',
          'Add circuit breakers between gateway and services',
          'Test rate limiting with high request rates',
          'Simulate backend failures to test circuit breakers',
          'Monitor authentication and rate limit metrics'
        ],
        evaluationCriteria: [
          'API Gateway routing requests correctly',
          'Authentication service validating requests',
          'Rate limiters preventing abuse',
          'Circuit breakers protecting backend services',
          'System handles attack scenarios gracefully',
          'Rate limiting metrics visible',
          'Circuit breakers recover automatically'
        ]
      },
      {
        id: 'search-powered-app',
        name: 'Search-Powered Application',
        description: 'Build an application with powerful search capabilities using Elasticsearch. Learn search indexing, query optimization, and search scaling.',
        difficulty: 'intermediate',
        category: 'search',
        prerequisites: ['simple-caching'],
        estimatedTimeMinutes: 70,
        tags: ['search-engine', 'elasticsearch', 'full-text-search', 'indexing', 'query-optimization'],
        learningOutcomes: [
          'Understand search engine architecture',
          'Learn indexing strategies',
          'Configure search clusters',
          'Optimize search queries',
          'Handle search at scale'
        ],
        objectives: [
          'Add search engine component',
          'Configure search indexing',
          'Set up search cluster with replicas',
          'Optimize search query performance',
          'Add caching for popular searches',
          'Test search under high query load',
          'Monitor search latency and throughput'
        ],
        initialWorkspace: {
          name: 'Search-Powered Application Scenario',
          description: 'Build an application with search capabilities',
          components: [
            {
              id: 'client-1',
              type: 'client',
              componentKey: 'client-web',
              position: { x: 100, y: 300 },
              configuration: {
                capacity: 1000,
                latency: 50,
                failureRate: 0.001
              },
              metadata: {
                name: 'Web Client',
                description: 'Users searching the application',
                version: '1.0'
              }
            },
            {
              id: 'app-server',
              type: 'web-server',
              componentKey: 'web-server-nodejs',
              position: { x: 300, y: 300 },
              configuration: {
                capacity: 2000,
                latency: 40,
                failureRate: 0.01
              },
              metadata: {
                name: 'Application Server',
                description: 'Main application server',
                version: '1.0.0'
              }
            },
            {
              id: 'search-engine-1',
              type: 'search-engine',
              componentKey: 'search-engine-elasticsearch',
              position: { x: 500, y: 200 },
              configuration: {
                capacity: 5000,
                latency: 10,
                failureRate: 0.001
              },
              metadata: {
                name: 'Elasticsearch',
                description: 'Search engine for full-text search',
                version: '8.0'
              }
            },
            {
              id: 'cache-1',
              type: 'cache',
              componentKey: 'cache-redis',
              position: { x: 500, y: 400 },
              configuration: {
                capacity: 8000,
                latency: 0.8,
                failureRate: 0.0002
              },
              metadata: {
                name: 'Redis Cache',
                description: 'Cache for popular search queries',
                version: '7.0'
              }
            },
            {
              id: 'database',
              type: 'database',
              componentKey: 'database-mysql',
              position: { x: 700, y: 300 },
              configuration: {
                capacity: 1000,
                latency: 10,
                failureRate: 0.005
              },
              metadata: {
                name: 'Primary Database',
                description: 'Main data store',
                version: '1.0.0'
              }
            }
          ],
          connections: [
            {
              id: 'conn-1',
              sourceComponentId: 'client-1',
              targetComponentId: 'app-server',
              sourcePort: 'out',
              targetPort: 'in',
              configuration: {
                bandwidth: 1000,
                latency: 10,
                protocol: 'HTTP',
                reliability: 0.99
              }
            },
            {
              id: 'conn-2',
              sourceComponentId: 'app-server',
              targetComponentId: 'search-engine-1',
              sourcePort: 'out',
              targetPort: 'in',
              configuration: {
                bandwidth: 500,
                latency: 5,
                protocol: 'HTTP',
                reliability: 0.98
              }
            },
            {
              id: 'conn-3',
              sourceComponentId: 'app-server',
              targetComponentId: 'cache-1',
              sourcePort: 'out',
              targetPort: 'in',
              configuration: {
                bandwidth: 1000,
                latency: 1,
                protocol: 'TCP',
                reliability: 0.99
              }
            },
            {
              id: 'conn-4',
              sourceComponentId: 'app-server',
              targetComponentId: 'database',
              sourcePort: 'out',
              targetPort: 'in',
              configuration: {
                bandwidth: 1000,
                latency: 5,
                protocol: 'DATABASE',
                reliability: 0.99
              }
            },
            {
              id: 'conn-5',
              sourceComponentId: 'cache-1',
              targetComponentId: 'database',
              sourcePort: 'out',
              targetPort: 'in',
              configuration: {
                bandwidth: 500,
                latency: 5,
                protocol: 'DATABASE',
                reliability: 0.99
              }
            }
          ],
          configuration: {
            duration: 600,
            loadPattern: {
              type: 'realistic',
              baseLoad: 800,
              peakLoad: 3000
            },
            failureScenarios: [
              {
                componentId: 'search-engine',
                failureType: 'index-corruption',
                startTime: 300,
                duration: 60,
                severity: 0.5
              }
            ],
            metricsCollection: {
              collectionInterval: 1000,
              retentionPeriod: 3600,
              enabledMetrics: ['latency', 'throughput', 'errors', 'search-latency', 'index-size', 'query-performance']
            }
          }
        },
        hints: [
          'Add search engine component',
          'Configure search with appropriate shards and replicas',
          'Connect application server to search engine',
          'Add cache for frequently searched queries',
          'Monitor search query latency',
          'Test search performance under load',
          'Optimize search queries for better performance'
        ],
        evaluationCriteria: [
          'Search engine component added and configured',
          'Search cluster with proper sharding',
          'Search queries responding quickly (<100ms)',
          'Cache improving search performance',
          'Search handles high query load',
          'Search latency metrics visible',
          'System scales search effectively'
        ]
      },
      {
        id: 'media-streaming-platform',
        name: 'Media Streaming Platform',
        description: 'Design a platform for streaming video and audio content with CDN, object storage, and efficient content delivery. Learn media distribution patterns.',
        difficulty: 'advanced',
        category: 'media',
        prerequisites: ['global-cdn-system'],
        estimatedTimeMinutes: 100,
        tags: ['streaming', 'cdn', 'object-storage', 'media-delivery', 'content-distribution'],
        learningOutcomes: [
          'Understand media streaming architecture',
          'Learn CDN optimization for media',
          'Configure object storage for large files',
          'Design efficient content delivery',
          'Handle streaming at scale'
        ],
        objectives: [
          'Add CDN for global content delivery',
          'Configure object storage for media files',
          'Set up multiple CDN edge locations',
          'Optimize cache strategies for media',
          'Add monitoring for streaming metrics',
          'Test streaming under global load',
          'Handle media file failures gracefully'
        ],
        initialWorkspace: {
          name: 'Media Streaming Platform Scenario',
          description: 'Build a scalable media streaming platform',
          components: [],
          connections: [],
          configuration: {
            duration: 1200,
            loadPattern: {
              type: 'geographic',
              baseLoad: 2000,
              peakLoad: 50000
            },
            failureScenarios: [
              {
                componentId: 'cdn-region-asia',
                failureType: 'regional-outage',
                startTime: 600,
                duration: 180,
                severity: 1.0
              },
              {
                componentId: 'media-storage',
                failureType: 'capacity-exceeded',
                startTime: 900,
                duration: 120,
                severity: 0.7
              }
            ],
            metricsCollection: {
              collectionInterval: 1000,
              retentionPeriod: 7200,
              enabledMetrics: ['latency', 'throughput', 'errors', 'cache-hits', 'bandwidth', 'stream-quality']
            }
          }
        },
        hints: [
          'Add CDN components in multiple regions',
          'Configure object storage for media files',
          'Set up origin servers for CDN',
          'Optimize cache TTL for media content',
          'Add monitoring for streaming performance',
          'Test content delivery from different regions',
          'Handle CDN failures with origin fallback'
        ],
        evaluationCriteria: [
          'CDN configured in multiple regions',
          'Object storage handling media files',
          'Cache hit ratios >90% for popular content',
          'Streaming latency optimized globally',
          'System handles regional CDN failures',
          'Media delivery metrics tracked',
          'Content scales efficiently'
        ]
      }
    ];

    scenarios.forEach(scenario => {
      this.scenarios.set(scenario.id, scenario);
    });
  }

  /**
   * Get all available scenarios
   */
  getAllScenarios(): Scenario[] {
    return Array.from(this.scenarios.values());
  }

  /**
   * Get a specific scenario by ID
   */
  getScenario(id: string): Scenario | null {
    return this.scenarios.get(id) || null;
  }

  /**
   * Load a scenario and initialize workspace
   */
  loadScenario(scenarioId: string, userId: string): Workspace | null {
    const scenario = this.getScenario(scenarioId);
    if (!scenario) {
      return null;
    }

    // Create a new workspace based on the scenario's initial workspace
    // Generate a proper UUID for the workspace ID
    const workspaceId = uuidv4();
    
    const workspace: Workspace = {
      id: workspaceId,
      name: scenario.initialWorkspace.name || scenario.name,
      description: scenario.initialWorkspace.description || scenario.description,
      userId,
      components: scenario.initialWorkspace.components || [],
      connections: scenario.initialWorkspace.connections || [],
      configuration: scenario.initialWorkspace.configuration || {
        duration: 300,
        loadPattern: { type: 'constant', baseLoad: 100 },
        failureScenarios: [],
        metricsCollection: {
          collectionInterval: 1000,
          retentionPeriod: 3600,
          enabledMetrics: ['latency', 'throughput', 'errors']
        }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return workspace;
  }

  /**
   * Get scenarios filtered by difficulty, category, or prerequisites
   * Implements SRS FR-9.1 scenario filtering and organization
   */
  getScenariosByCategory(category?: string, difficulty?: string): Scenario[] {
    const allScenarios = this.getAllScenarios();
    
    let filteredScenarios = allScenarios;

    if (category) {
      filteredScenarios = filteredScenarios.filter(scenario => 
        scenario.category.toLowerCase().includes(category.toLowerCase()) ||
        scenario.tags.some(tag => tag.toLowerCase().includes(category.toLowerCase()))
      );
    }

    if (difficulty) {
      filteredScenarios = filteredScenarios.filter(scenario => 
        scenario.difficulty === difficulty.toLowerCase()
      );
    }

    // Sort by difficulty level and then by estimated time
    const difficultyOrder = { 'beginner': 1, 'intermediate': 2, 'advanced': 3, 'expert': 4 };
    return filteredScenarios.sort((a, b) => {
      const diffA = difficultyOrder[a.difficulty];
      const diffB = difficultyOrder[b.difficulty];
      if (diffA !== diffB) return diffA - diffB;
      return a.estimatedTimeMinutes - b.estimatedTimeMinutes;
    });
  }

  /**
   * Get scenarios by difficulty level
   * Implements SRS FR-9.1 difficulty-based scenario organization
   */
  getScenariosByDifficulty(difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert'): Scenario[] {
    return this.getAllScenarios().filter(scenario => scenario.difficulty === difficulty);
  }

  /**
   * Get available scenarios for a user based on completed prerequisites
   * Implements SRS FR-9.1 prerequisite system
   */
  getAvailableScenarios(completedScenarios: string[]): Scenario[] {
    const completed = new Set(completedScenarios);
    
    return this.getAllScenarios().filter(scenario => {
      // Check if all prerequisites are completed
      return scenario.prerequisites.every(prereq => completed.has(prereq));
    });
  }

  /**
   * Get recommended next scenarios based on user progress
   * Enhanced with prerequisite checking and difficulty progression
   */
  getRecommendedScenarios(userProgress: UserProgress): Scenario[] {
    const completed = new Set(userProgress.completedScenarios);
    const availableScenarios = this.getAvailableScenarios(userProgress.completedScenarios);
    
    // Filter out completed scenarios
    const incomplete = availableScenarios.filter(scenario => !completed.has(scenario.id));
    
    if (incomplete.length === 0) {
      return [];
    }

    // Determine user's current skill level based on completed scenarios
    const completedDifficulties = userProgress.completedScenarios
      .map(id => this.getScenario(id)?.difficulty)
      .filter(Boolean);
    
    let recommendedDifficulty: string;
    if (completedDifficulties.length === 0) {
      recommendedDifficulty = 'beginner';
    } else if (completedDifficulties.includes('expert')) {
      recommendedDifficulty = 'expert';
    } else if (completedDifficulties.includes('advanced')) {
      recommendedDifficulty = 'advanced';
    } else if (completedDifficulties.includes('intermediate')) {
      recommendedDifficulty = 'intermediate';
    } else {
      recommendedDifficulty = 'beginner';
    }

    // Prioritize scenarios at current skill level, then next level
    const currentLevel = incomplete.filter(s => s.difficulty === recommendedDifficulty);
    const nextLevel = incomplete.filter(s => {
      const difficultyOrder = { 'beginner': 1, 'intermediate': 2, 'advanced': 3, 'expert': 4 };
      const currentOrder = difficultyOrder[recommendedDifficulty as keyof typeof difficultyOrder];
      const scenarioOrder = difficultyOrder[s.difficulty];
      return scenarioOrder === currentOrder + 1;
    });

    // Return up to 3 recommendations, prioritizing current level
    const recommendations = [...currentLevel, ...nextLevel].slice(0, 3);
    
    // Sort by estimated time (shorter first for better engagement)
    return recommendations.sort((a, b) => a.estimatedTimeMinutes - b.estimatedTimeMinutes);
  }

  /**
   * Get learning path suggestions based on user interests
   * Implements SRS FR-9.1 structured learning paths
   */
  getLearningPath(category: string): Scenario[] {
    const categoryScenarios = this.getScenariosByCategory(category);
    
    // Build a learning path by ordering scenarios based on prerequisites
    const path: Scenario[] = [];
    const added = new Set<string>();
    
    // Helper function to add scenario and its prerequisites
    const addScenarioWithPrereqs = (scenario: Scenario) => {
      // First add all prerequisites
      scenario.prerequisites.forEach(prereqId => {
        if (!added.has(prereqId)) {
          const prereq = this.getScenario(prereqId);
          if (prereq) {
            addScenarioWithPrereqs(prereq);
          }
        }
      });
      
      // Then add the scenario itself
      if (!added.has(scenario.id)) {
        path.push(scenario);
        added.add(scenario.id);
      }
    };
    
    // Add all scenarios in the category with their prerequisites
    categoryScenarios.forEach(scenario => {
      addScenarioWithPrereqs(scenario);
    });
    
    return path;
  }

  /**
   * Validate if a user can access a scenario based on prerequisites
   * Implements SRS FR-9.1 prerequisite validation
   */
  canAccessScenario(scenarioId: string, completedScenarios: string[]): boolean {
    const scenario = this.getScenario(scenarioId);
    if (!scenario) return false;
    
    const completed = new Set(completedScenarios);
    return scenario.prerequisites.every(prereq => completed.has(prereq));
  }

  /**
   * Validate if a scenario exists
   */
  scenarioExists(id: string): boolean {
    return this.scenarios.has(id);
  }
}

// Singleton instance
export const scenarioService = new ScenarioService();