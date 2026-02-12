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
          components: [],
          connections: [],
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
              type: 'service',
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
            }
          ],
          connections: [
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
    const workspace: Workspace = {
      id: `scenario-${scenarioId}-${Date.now()}`,
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