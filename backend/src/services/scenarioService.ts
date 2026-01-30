import { Scenario, Workspace, UserProgress } from '../types';

/**
 * Scenario Service
 * Manages learning scenarios, scenario library, and scenario execution
 */
export class ScenarioService {
  private scenarios: Map<string, Scenario> = new Map();

  constructor() {
    this.initializeScenarios();
  }

  /**
   * Initialize predefined scenarios covering common system design patterns
   */
  private initializeScenarios(): void {
    const scenarios: Scenario[] = [
      {
        id: 'basic-web-app',
        name: 'Basic Web Application',
        description: 'Design a simple web application with a database backend',
        objectives: [
          'Create a web server component',
          'Add a database component',
          'Connect the web server to the database',
          'Configure appropriate parameters for expected load'
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
          'Configure the web server capacity based on expected load',
          'Set appropriate database connection limits'
        ],
        evaluationCriteria: [
          'Web server component present',
          'Database component present',
          'Valid connection between web server and database',
          'Appropriate capacity configuration',
          'System handles target load without errors'
        ]
      },
      {
        id: 'load-balanced-system',
        name: 'Load Balanced System',
        description: 'Design a scalable system with load balancing',
        objectives: [
          'Create multiple web server instances',
          'Add a load balancer component',
          'Configure load balancing algorithm',
          'Add a shared database backend',
          'Test system under varying load'
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
              baseLoad: 50,
              peakLoad: 500
            },
            failureScenarios: [],
            metricsCollection: {
              collectionInterval: 1000,
              retentionPeriod: 3600,
              enabledMetrics: ['latency', 'throughput', 'errors', 'cpu', 'memory']
            }
          }
        },
        hints: [
          'Add a load balancer as the entry point',
          'Create multiple web server instances behind the load balancer',
          'Choose an appropriate load balancing algorithm',
          'Add a shared database that all web servers can access',
          'Consider connection pooling for database connections'
        ],
        evaluationCriteria: [
          'Load balancer component present',
          'Multiple web server instances',
          'Proper load balancer configuration',
          'Shared database backend',
          'System scales effectively under load',
          'No single point of failure in web tier'
        ]
      },
      {
        id: 'caching-optimization',
        name: 'Caching for Performance',
        description: 'Optimize system performance using caching strategies',
        objectives: [
          'Add caching layer to existing system',
          'Configure cache parameters',
          'Implement cache-aside pattern',
          'Measure performance improvement',
          'Handle cache failures gracefully'
        ],
        initialWorkspace: {
          name: 'Caching Optimization Scenario',
          description: 'Learn to optimize performance with caching',
          components: [
            {
              id: 'web-server-1',
              type: 'web-server',
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
              type: 'realistic',
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
          'Configure cache size and eviction policy',
          'Set appropriate cache TTL values',
          'Monitor cache hit ratio for effectiveness',
          'Consider what happens when cache is unavailable'
        ],
        evaluationCriteria: [
          'Cache component added to system',
          'Cache properly positioned in data flow',
          'Appropriate cache configuration',
          'Improved system latency with cache',
          'Cache hit ratio above 70%',
          'System degrades gracefully on cache failure'
        ]
      },
      {
        id: 'microservices-architecture',
        name: 'Microservices Architecture',
        description: 'Design a microservices-based system with service communication',
        objectives: [
          'Break monolith into microservices',
          'Add service discovery',
          'Implement inter-service communication',
          'Add message queues for async processing',
          'Design for fault tolerance'
        ],
        initialWorkspace: {
          name: 'Microservices Architecture Scenario',
          description: 'Learn to design microservices architectures',
          components: [],
          connections: [],
          configuration: {
            duration: 900,
            loadPattern: {
              type: 'spike',
              baseLoad: 100,
              peakLoad: 1000
            },
            failureScenarios: [
              {
                componentId: 'user-service',
                failureType: 'crash',
                startTime: 300,
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
          'Implement circuit breaker patterns'
        ],
        evaluationCriteria: [
          'Multiple service components present',
          'API gateway/load balancer at entry point',
          'Message queue for async communication',
          'Proper service isolation',
          'System resilient to individual service failures',
          'Appropriate service sizing and configuration'
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
   * Get scenarios filtered by difficulty or category
   */
  getScenariosByCategory(category?: string): Scenario[] {
    const allScenarios = this.getAllScenarios();
    
    if (!category) {
      return allScenarios;
    }

    // Simple category filtering based on scenario name/description
    return allScenarios.filter(scenario => 
      scenario.name.toLowerCase().includes(category.toLowerCase()) ||
      scenario.description.toLowerCase().includes(category.toLowerCase())
    );
  }

  /**
   * Get recommended next scenarios based on user progress
   */
  getRecommendedScenarios(userProgress: UserProgress): Scenario[] {
    const allScenarios = this.getAllScenarios();
    const completed = new Set(userProgress.completedScenarios);
    
    // Return scenarios not yet completed, ordered by difficulty
    const incomplete = allScenarios.filter(scenario => !completed.has(scenario.id));
    
    // Simple recommendation logic - can be enhanced with ML later
    return incomplete.slice(0, 3);
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