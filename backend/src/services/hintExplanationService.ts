import { Scenario } from '../types';

/**
 * Hint and Explanation System implementing SRS FR-9.3
 * Provides contextual hint delivery, progressive disclosure of complexity,
 * and explanation and learning content during scenario execution
 */

export interface Hint {
  id: string;
  scenarioId: string;
  type: 'contextual' | 'progressive' | 'remedial' | 'advanced';
  trigger: HintTrigger;
  content: string;
  explanation?: string;
  relatedConcepts: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  priority: number; // 1-10, higher is more important
  prerequisites?: string[]; // Other hint IDs that should be shown first
  followUpHints?: string[]; // Hints to show after this one
}

export interface HintTrigger {
  type: 'time-based' | 'performance-based' | 'action-based' | 'error-based' | 'request-based';
  condition: HintCondition;
}

export interface HintCondition {
  // Time-based triggers
  timeThreshold?: number; // seconds
  
  // Performance-based triggers
  latencyThreshold?: number; // ms
  errorRateThreshold?: number; // 0.0 to 1.0
  throughputThreshold?: number; // requests per second
  
  // Action-based triggers
  requiredAction?: string; // e.g., 'add-component', 'connect-components'
  componentType?: string;
  
  // Error-based triggers
  errorType?: string;
  errorCount?: number;
  
  // Context
  userStuckDuration?: number; // seconds without progress
  attemptCount?: number; // number of failed attempts
}

export interface ExplanationContent {
  id: string;
  title: string;
  concept: string;
  level: 'basic' | 'intermediate' | 'advanced' | 'expert';
  content: {
    summary: string;
    detailedExplanation: string;
    examples: string[];
    commonMistakes: string[];
    bestPractices: string[];
    relatedTopics: string[];
  };
  visualAids?: {
    diagrams: string[];
    animations: string[];
    interactiveElements: string[];
  };
}

export interface UserHintHistory {
  userId: string;
  scenarioId: string;
  hintsShown: string[];
  hintsRequested: string[];
  hintsSkipped: string[];
  explanationsViewed: string[];
  timestamp: number;
}

export interface HintContext {
  userId: string;
  scenarioId: string;
  currentTime: number;
  userPerformance: {
    latency: number;
    throughput: number;
    errorRate: number;
  };
  recentActions: string[];
  componentsAdded: string[];
  connectionsCreated: number;
  errorsEncountered: string[];
  timeStuckOnCurrentStep: number;
}

export class HintExplanationService {
  private hints: Map<string, Hint[]> = new Map(); // scenarioId -> hints
  private explanations: Map<string, ExplanationContent> = new Map(); // concept -> explanation
  private userHintHistory: Map<string, UserHintHistory[]> = new Map(); // userId -> history

  constructor() {
    this.initializeHints();
    this.initializeExplanations();
  }

  /**
   * Initialize contextual hints for different scenarios
   * Implements SRS FR-9.3 contextual hint delivery
   */
  private initializeHints(): void {
    // Basic Web App Scenario Hints
    const basicWebAppHints: Hint[] = [
      {
        id: 'basic-start-hint',
        scenarioId: 'basic-web-app',
        type: 'contextual',
        trigger: {
          type: 'time-based',
          condition: { timeThreshold: 30 }
        },
        content: 'Start by dragging a web server component from the component library onto the canvas.',
        explanation: 'A web server is the entry point for user requests in a web application architecture.',
        relatedConcepts: ['web-server', 'client-server-architecture'],
        difficulty: 'beginner',
        priority: 10,
        followUpHints: ['basic-database-hint']
      },
      {
        id: 'basic-database-hint',
        scenarioId: 'basic-web-app',
        type: 'progressive',
        trigger: {
          type: 'action-based',
          condition: { 
            requiredAction: 'add-component',
            componentType: 'service'
          }
        },
        content: 'Great! Now add a database component to store your application data.',
        explanation: 'Databases provide persistent storage for application data. Most web applications need a database to store user information, content, and other data.',
        relatedConcepts: ['database', 'data-persistence', 'sql'],
        difficulty: 'beginner',
        priority: 9,
        prerequisites: ['basic-start-hint'],
        followUpHints: ['basic-connection-hint']
      },
      {
        id: 'basic-connection-hint',
        scenarioId: 'basic-web-app',
        type: 'progressive',
        trigger: {
          type: 'action-based',
          condition: { 
            requiredAction: 'add-component',
            componentType: 'database'
          }
        },
        content: 'Now connect your web server to the database by dragging from the web server output to the database input.',
        explanation: 'Connections define how components communicate. The web server needs to connect to the database to read and write data.',
        relatedConcepts: ['component-connections', 'data-flow'],
        difficulty: 'beginner',
        priority: 8,
        prerequisites: ['basic-database-hint'],
        followUpHints: ['basic-configuration-hint']
      },
      {
        id: 'basic-configuration-hint',
        scenarioId: 'basic-web-app',
        type: 'contextual',
        trigger: {
          type: 'action-based',
          condition: { requiredAction: 'connect-components' }
        },
        content: 'Configure your components by clicking on them. Set the web server capacity to handle your expected load.',
        explanation: 'Component configuration determines performance characteristics. Capacity limits how many requests a component can handle simultaneously.',
        relatedConcepts: ['capacity-planning', 'performance-tuning'],
        difficulty: 'beginner',
        priority: 7,
        prerequisites: ['basic-connection-hint']
      },
      {
        id: 'basic-performance-hint',
        scenarioId: 'basic-web-app',
        type: 'contextual',
        trigger: {
          type: 'performance-based',
          condition: { 
            latencyThreshold: 200,
            userStuckDuration: 60
          }
        },
        content: 'Your system latency is high. Consider increasing the web server or database capacity, or check if your database connection limit is sufficient.',
        explanation: 'High latency often indicates that components are overloaded or bottlenecked. Increasing capacity or optimizing connections can help.',
        relatedConcepts: ['latency-optimization', 'bottleneck-analysis'],
        difficulty: 'intermediate',
        priority: 8
      }
    ];

    // Load Balanced System Hints
    const loadBalancedHints: Hint[] = [
      {
        id: 'lb-start-hint',
        scenarioId: 'load-balanced-system',
        type: 'contextual',
        trigger: {
          type: 'time-based',
          condition: { timeThreshold: 20 }
        },
        content: 'Start by adding a load balancer as the entry point for your system.',
        explanation: 'Load balancers distribute incoming requests across multiple servers, improving scalability and reliability.',
        relatedConcepts: ['load-balancing', 'horizontal-scaling'],
        difficulty: 'intermediate',
        priority: 10,
        followUpHints: ['lb-multiple-servers-hint']
      },
      {
        id: 'lb-multiple-servers-hint',
        scenarioId: 'load-balanced-system',
        type: 'progressive',
        trigger: {
          type: 'action-based',
          condition: { 
            requiredAction: 'add-component',
            componentType: 'load-balancer'
          }
        },
        content: 'Add multiple web server instances behind the load balancer. Try adding 3-4 servers for good redundancy.',
        explanation: 'Multiple servers provide redundancy and increased capacity. If one server fails, others can continue serving requests.',
        relatedConcepts: ['redundancy', 'fault-tolerance', 'horizontal-scaling'],
        difficulty: 'intermediate',
        priority: 9,
        prerequisites: ['lb-start-hint']
      },
      {
        id: 'lb-algorithm-hint',
        scenarioId: 'load-balanced-system',
        type: 'contextual',
        trigger: {
          type: 'action-based',
          condition: { 
            requiredAction: 'connect-components',
            attemptCount: 2
          }
        },
        content: 'Configure your load balancer algorithm. Round-robin works well for similar servers, while least-connections is better for varying request complexity.',
        explanation: 'Different load balancing algorithms distribute traffic differently. Choose based on your server characteristics and request patterns.',
        relatedConcepts: ['load-balancing-algorithms', 'traffic-distribution'],
        difficulty: 'intermediate',
        priority: 7
      },
      {
        id: 'lb-failure-hint',
        scenarioId: 'load-balanced-system',
        type: 'remedial',
        trigger: {
          type: 'error-based',
          condition: { 
            errorType: 'server-failure',
            errorCount: 1
          }
        },
        content: 'One of your servers failed! Notice how the load balancer automatically routes traffic to healthy servers. This is why redundancy is important.',
        explanation: 'Load balancers perform health checks and automatically remove failed servers from rotation, maintaining system availability.',
        relatedConcepts: ['health-checks', 'automatic-failover', 'high-availability'],
        difficulty: 'intermediate',
        priority: 9
      }
    ];

    // Microservices Hints
    const microservicesHints: Hint[] = [
      {
        id: 'ms-decomposition-hint',
        scenarioId: 'microservices-basics',
        type: 'contextual',
        trigger: {
          type: 'time-based',
          condition: { timeThreshold: 30 }
        },
        content: 'Break your system into separate services by business domain. Consider user management, order processing, and inventory as separate services.',
        explanation: 'Microservices should be organized around business capabilities, not technical layers. Each service should own its data and business logic.',
        relatedConcepts: ['service-decomposition', 'domain-driven-design', 'bounded-contexts'],
        difficulty: 'advanced',
        priority: 10
      },
      {
        id: 'ms-communication-hint',
        scenarioId: 'microservices-basics',
        type: 'progressive',
        trigger: {
          type: 'action-based',
          condition: { 
            requiredAction: 'add-component',
            componentType: 'service',
            attemptCount: 3
          }
        },
        content: 'Add message queues for asynchronous communication between services. This reduces coupling and improves resilience.',
        explanation: 'Async communication via message queues allows services to operate independently and handle failures gracefully.',
        relatedConcepts: ['async-messaging', 'loose-coupling', 'event-driven-architecture'],
        difficulty: 'advanced',
        priority: 8
      },
      {
        id: 'ms-circuit-breaker-hint',
        scenarioId: 'microservices-basics',
        type: 'remedial',
        trigger: {
          type: 'performance-based',
          condition: { 
            errorRateThreshold: 0.1,
            userStuckDuration: 90
          }
        },
        content: 'High error rates detected! Consider implementing circuit breaker patterns to prevent cascade failures between services.',
        explanation: 'Circuit breakers prevent failed services from bringing down the entire system by temporarily stopping calls to failing services.',
        relatedConcepts: ['circuit-breaker', 'fault-tolerance', 'cascade-failure-prevention'],
        difficulty: 'advanced',
        priority: 9
      }
    ];

    // Store hints by scenario
    this.hints.set('basic-web-app', basicWebAppHints);
    this.hints.set('load-balanced-system', loadBalancedHints);
    this.hints.set('microservices-basics', microservicesHints);
  }

  /**
   * Initialize explanation content for system design concepts
   * Implements SRS FR-9.3 explanation and learning content
   */
  private initializeExplanations(): void {
    const explanations: ExplanationContent[] = [
      {
        id: 'load-balancing',
        title: 'Load Balancing',
        concept: 'load-balancing',
        level: 'intermediate',
        content: {
          summary: 'Load balancing distributes incoming requests across multiple servers to improve performance and reliability.',
          detailedExplanation: 'Load balancers act as reverse proxies, receiving client requests and forwarding them to backend servers based on various algorithms. They provide several benefits: improved performance through parallel processing, high availability through redundancy, and scalability through horizontal scaling.',
          examples: [
            'A web application with 3 servers behind a load balancer can handle 3x more traffic than a single server',
            'If one server crashes, the load balancer routes traffic to remaining healthy servers',
            'During peak traffic, additional servers can be added behind the load balancer'
          ],
          commonMistakes: [
            'Not configuring health checks, leading to traffic being sent to failed servers',
            'Using session-based load balancing without sticky sessions',
            'Overloading the load balancer itself by not scaling it appropriately'
          ],
          bestPractices: [
            'Implement proper health checks for backend servers',
            'Choose the right algorithm (round-robin, least-connections, etc.) for your use case',
            'Monitor load balancer performance and scale when needed',
            'Use multiple load balancers for high availability'
          ],
          relatedTopics: ['horizontal-scaling', 'health-checks', 'high-availability', 'reverse-proxy']
        },
        visualAids: {
          diagrams: ['load-balancer-architecture.svg', 'load-balancing-algorithms.svg'],
          animations: ['request-distribution.gif'],
          interactiveElements: ['load-balancer-simulator']
        }
      },
      {
        id: 'caching',
        title: 'Caching Strategies',
        concept: 'caching',
        level: 'intermediate',
        content: {
          summary: 'Caching stores frequently accessed data in fast storage to reduce latency and database load.',
          detailedExplanation: 'Caching is a technique that stores copies of frequently accessed data in faster storage layers. Common patterns include cache-aside (lazy loading), write-through, and write-behind. Caches can be implemented at multiple levels: browser cache, CDN, application cache, and database cache.',
          examples: [
            'Redis cache storing user session data for fast access',
            'CDN caching static assets like images and CSS files',
            'Database query result caching to avoid expensive computations'
          ],
          commonMistakes: [
            'Not setting appropriate TTL (Time To Live) values',
            'Cache stampede - multiple requests trying to populate the same cache key',
            'Not handling cache failures gracefully',
            'Caching data that changes frequently'
          ],
          bestPractices: [
            'Implement cache-aside pattern for most use cases',
            'Set appropriate TTL based on data freshness requirements',
            'Use cache warming for predictable access patterns',
            'Monitor cache hit ratios and adjust strategies accordingly',
            'Implement cache invalidation strategies for data consistency'
          ],
          relatedTopics: ['performance-optimization', 'data-consistency', 'memory-management']
        }
      },
      {
        id: 'microservices',
        title: 'Microservices Architecture',
        concept: 'microservices',
        level: 'advanced',
        content: {
          summary: 'Microservices architecture structures applications as a collection of loosely coupled, independently deployable services.',
          detailedExplanation: 'Microservices break down monolithic applications into smaller, focused services that communicate over well-defined APIs. Each service owns its data and business logic, enabling independent development, deployment, and scaling. This architecture provides benefits like technology diversity, fault isolation, and team autonomy, but introduces complexity in service communication, data consistency, and operational overhead.',
          examples: [
            'E-commerce platform with separate services for user management, product catalog, order processing, and payment',
            'Netflix architecture with hundreds of microservices handling different aspects of video streaming',
            'Uber\'s service architecture separating rider services, driver services, trip management, and pricing'
          ],
          commonMistakes: [
            'Creating too many small services (nano-services) that increase complexity',
            'Sharing databases between services, creating tight coupling',
            'Not implementing proper service discovery and communication patterns',
            'Ignoring distributed system challenges like network failures and data consistency'
          ],
          bestPractices: [
            'Design services around business capabilities, not technical layers',
            'Implement proper service boundaries with clear APIs',
            'Use asynchronous communication where possible',
            'Implement circuit breakers and retry mechanisms',
            'Establish proper monitoring and observability',
            'Plan for data consistency and eventual consistency patterns'
          ],
          relatedTopics: ['service-decomposition', 'api-design', 'distributed-systems', 'event-driven-architecture']
        }
      }
    ];

    explanations.forEach(explanation => {
      this.explanations.set(explanation.concept, explanation);
    });
  }

  /**
   * Get contextual hints based on current scenario state
   * Implements SRS FR-9.3 contextual hint delivery
   */
  getContextualHints(context: HintContext): Hint[] {
    const scenarioHints = this.hints.get(context.scenarioId) || [];
    const userHistory = this.getUserHintHistory(context.userId, context.scenarioId);
    const shownHints = new Set(userHistory?.hintsShown || []);
    
    // Filter hints based on triggers and prerequisites
    const applicableHints = scenarioHints.filter(hint => {
      // Skip if already shown
      if (shownHints.has(hint.id)) return false;
      
      // Check prerequisites
      if (hint.prerequisites) {
        const prerequisitesMet = hint.prerequisites.every(prereqId => shownHints.has(prereqId));
        if (!prerequisitesMet) return false;
      }
      
      // Check trigger conditions
      return this.evaluateHintTrigger(hint.trigger, context);
    });
    
    // Sort by priority and return top hints
    return applicableHints
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 3); // Limit to 3 hints to avoid overwhelming user
  }

  /**
   * Get progressive hints based on user progress
   * Implements SRS FR-9.3 progressive disclosure of complexity
   */
  getProgressiveHints(context: HintContext, currentDifficulty: 'beginner' | 'intermediate' | 'advanced'): Hint[] {
    const scenarioHints = this.hints.get(context.scenarioId) || [];
    const userHistory = this.getUserHintHistory(context.userId, context.scenarioId);
    const shownHints = new Set(userHistory?.hintsShown || []);
    
    // Get hints at or below current difficulty level
    const progressiveHints = scenarioHints.filter(hint => {
      if (shownHints.has(hint.id)) return false;
      if (hint.type !== 'progressive') return false;
      
      const difficultyOrder = { 'beginner': 1, 'intermediate': 2, 'advanced': 3 };
      return difficultyOrder[hint.difficulty] <= difficultyOrder[currentDifficulty];
    });
    
    return progressiveHints.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get remedial hints when user is struggling
   * Implements SRS FR-9.3 contextual hint delivery for struggling users
   */
  getRemedialHints(context: HintContext): Hint[] {
    const scenarioHints = this.hints.get(context.scenarioId) || [];
    
    // Look for remedial hints that match current problems
    const remedialHints = scenarioHints.filter(hint => {
      if (hint.type !== 'remedial') return false;
      return this.evaluateHintTrigger(hint.trigger, context);
    });
    
    return remedialHints.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get explanation content for a concept
   * Implements SRS FR-9.3 explanation and learning content
   */
  getExplanation(concept: string, level?: 'basic' | 'intermediate' | 'advanced' | 'expert'): ExplanationContent | null {
    const explanation = this.explanations.get(concept);
    if (!explanation) return null;
    
    // If level is specified and doesn't match, return simplified version
    if (level && level !== explanation.level) {
      return this.adaptExplanationToLevel(explanation, level);
    }
    
    return explanation;
  }

  /**
   * Record that a hint was shown to a user
   */
  recordHintShown(userId: string, scenarioId: string, hintId: string): void {
    this.updateUserHintHistory(userId, scenarioId, history => {
      if (!history.hintsShown.includes(hintId)) {
        history.hintsShown.push(hintId);
      }
    });
  }

  /**
   * Record that a user requested a hint
   */
  recordHintRequested(userId: string, scenarioId: string, hintId: string): void {
    this.updateUserHintHistory(userId, scenarioId, history => {
      if (!history.hintsRequested.includes(hintId)) {
        history.hintsRequested.push(hintId);
      }
    });
  }

  /**
   * Record that a user skipped a hint
   */
  recordHintSkipped(userId: string, scenarioId: string, hintId: string): void {
    this.updateUserHintHistory(userId, scenarioId, history => {
      if (!history.hintsSkipped.includes(hintId)) {
        history.hintsSkipped.push(hintId);
      }
    });
  }

  /**
   * Record that a user viewed an explanation
   */
  recordExplanationViewed(userId: string, scenarioId: string, concept: string): void {
    this.updateUserHintHistory(userId, scenarioId, history => {
      if (!history.explanationsViewed.includes(concept)) {
        history.explanationsViewed.push(concept);
      }
    });
  }

  /**
   * Get hint statistics for analytics
   */
  getHintStatistics(scenarioId: string): {
    totalHints: number;
    hintsByType: { [type: string]: number };
    hintsByDifficulty: { [difficulty: string]: number };
  } {
    const hints = this.hints.get(scenarioId) || [];
    
    const hintsByType: { [type: string]: number } = {};
    const hintsByDifficulty: { [difficulty: string]: number } = {};
    
    hints.forEach(hint => {
      hintsByType[hint.type] = (hintsByType[hint.type] || 0) + 1;
      hintsByDifficulty[hint.difficulty] = (hintsByDifficulty[hint.difficulty] || 0) + 1;
    });
    
    return {
      totalHints: hints.length,
      hintsByType,
      hintsByDifficulty
    };
  }

  /**
   * Evaluate if a hint trigger condition is met
   */
  private evaluateHintTrigger(trigger: HintTrigger, context: HintContext): boolean {
    const condition = trigger.condition;
    
    switch (trigger.type) {
      case 'time-based':
        return condition.timeThreshold ? context.currentTime >= condition.timeThreshold : false;
        
      case 'performance-based':
        if (condition.latencyThreshold && context.userPerformance.latency < condition.latencyThreshold) return false;
        if (condition.errorRateThreshold && context.userPerformance.errorRate < condition.errorRateThreshold) return false;
        if (condition.throughputThreshold && context.userPerformance.throughput > condition.throughputThreshold) return false;
        if (condition.userStuckDuration && context.timeStuckOnCurrentStep < condition.userStuckDuration) return false;
        return true;
        
      case 'action-based':
        if (condition.requiredAction) {
          return context.recentActions.includes(condition.requiredAction);
        }
        return false;
        
      case 'error-based':
        if (condition.errorType) {
          const errorCount = context.errorsEncountered.filter(e => e === condition.errorType).length;
          return condition.errorCount ? errorCount >= condition.errorCount : errorCount > 0;
        }
        return false;
        
      case 'request-based':
        return true; // Always applicable when requested
        
      default:
        return false;
    }
  }

  /**
   * Get user hint history
   */
  private getUserHintHistory(userId: string, scenarioId: string): UserHintHistory | null {
    const userHistories = this.userHintHistory.get(userId) || [];
    return userHistories.find(h => h.scenarioId === scenarioId) || null;
  }

  /**
   * Update user hint history
   */
  private updateUserHintHistory(userId: string, scenarioId: string, updater: (history: UserHintHistory) => void): void {
    if (!this.userHintHistory.has(userId)) {
      this.userHintHistory.set(userId, []);
    }
    
    const userHistories = this.userHintHistory.get(userId)!;
    let history = userHistories.find(h => h.scenarioId === scenarioId);
    
    if (!history) {
      history = {
        userId,
        scenarioId,
        hintsShown: [],
        hintsRequested: [],
        hintsSkipped: [],
        explanationsViewed: [],
        timestamp: Date.now()
      };
      userHistories.push(history);
    }
    
    updater(history);
    history.timestamp = Date.now();
  }

  /**
   * Adapt explanation content to different difficulty levels
   */
  private adaptExplanationToLevel(explanation: ExplanationContent, targetLevel: 'basic' | 'intermediate' | 'advanced' | 'expert'): ExplanationContent {
    const adapted = { ...explanation };
    
    if (targetLevel === 'basic') {
      // Simplify for basic level
      adapted.content = {
        ...explanation.content,
        detailedExplanation: explanation.content.summary,
        examples: explanation.content.examples.slice(0, 1),
        commonMistakes: explanation.content.commonMistakes.slice(0, 2),
        bestPractices: explanation.content.bestPractices.slice(0, 2),
        relatedTopics: explanation.content.relatedTopics.slice(0, 2)
      };
    } else if (targetLevel === 'expert' && explanation.level !== 'expert') {
      // Add more advanced content for expert level
      adapted.content = {
        ...explanation.content,
        detailedExplanation: explanation.content.detailedExplanation + ' Advanced considerations include performance implications, scalability patterns, and operational complexity.',
        bestPractices: [...explanation.content.bestPractices, 'Consider advanced monitoring and alerting', 'Plan for disaster recovery scenarios'],
        relatedTopics: [...explanation.content.relatedTopics, 'advanced-patterns', 'operational-excellence']
      };
    }
    
    return adapted;
  }
}

// Singleton instance
export const hintExplanationService = new HintExplanationService();