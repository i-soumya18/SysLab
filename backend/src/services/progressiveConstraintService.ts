import { FailureScenario, LoadPattern } from '../types';

/**
 * Progressive Constraint System implementing SRS FR-9.2
 * Manages progressive constraint introduction, adaptive difficulty adjustment,
 * and constraint timing and sequencing during scenario execution
 */

export interface ConstraintEvent {
  id: string;
  type: 'load-increase' | 'failure-injection' | 'latency-spike' | 'resource-limit' | 'network-partition';
  triggerTime: number; // seconds from scenario start
  duration: number; // seconds
  severity: number; // 0.0 to 1.0
  description: string;
  learningObjective: string;
  adaptiveParameters?: AdaptiveParameters;
}

export interface AdaptiveParameters {
  userPerformanceThreshold: number; // 0.0 to 1.0
  difficultyAdjustment: number; // -0.5 to +0.5
  skipIfPoorPerformance: boolean;
  prerequisiteEvents: string[]; // IDs of events that must complete first
}

export interface ConstraintSequence {
  scenarioId: string;
  events: ConstraintEvent[];
  adaptiveDifficulty: boolean;
  baselineMetrics: {
    expectedLatency: number;
    expectedThroughput: number;
    expectedErrorRate: number;
  };
}

export interface UserPerformanceMetrics {
  userId: string;
  scenarioId: string;
  currentLatency: number;
  currentThroughput: number;
  currentErrorRate: number;
  timeToResolveIssues: number;
  correctDecisionsMade: number;
  totalDecisionOpportunities: number;
  timestamp: number;
}

export class ProgressiveConstraintService {
  private constraintSequences: Map<string, ConstraintSequence> = new Map();
  private activeConstraints: Map<string, ConstraintEvent[]> = new Map(); // sessionId -> active events
  private userPerformance: Map<string, UserPerformanceMetrics[]> = new Map(); // userId -> performance history

  constructor() {
    this.initializeConstraintSequences();
  }

  /**
   * Initialize constraint sequences for different scenarios
   * Implements SRS FR-9.2 progressive constraint introduction
   */
  private initializeConstraintSequences(): void {
    // Basic Web App - Gentle introduction to constraints
    this.constraintSequences.set('basic-web-app', {
      scenarioId: 'basic-web-app',
      adaptiveDifficulty: true,
      baselineMetrics: {
        expectedLatency: 100,
        expectedThroughput: 100,
        expectedErrorRate: 0.01
      },
      events: [
        {
          id: 'load-increase-1',
          type: 'load-increase',
          triggerTime: 60, // 1 minute in
          duration: 120,
          severity: 0.3,
          description: 'Traffic increases to 200 RPS',
          learningObjective: 'Observe how increased load affects system performance',
          adaptiveParameters: {
            userPerformanceThreshold: 0.7,
            difficultyAdjustment: 0.0,
            skipIfPoorPerformance: false,
            prerequisiteEvents: []
          }
        },
        {
          id: 'database-slowdown',
          type: 'latency-spike',
          triggerTime: 180, // 3 minutes in
          duration: 60,
          severity: 0.4,
          description: 'Database response time increases by 50ms',
          learningObjective: 'Identify database as bottleneck and consider solutions',
          adaptiveParameters: {
            userPerformanceThreshold: 0.6,
            difficultyAdjustment: 0.1,
            skipIfPoorPerformance: true,
            prerequisiteEvents: ['load-increase-1']
          }
        }
      ]
    });

    // Load Balanced System - More complex constraint progression
    this.constraintSequences.set('load-balanced-system', {
      scenarioId: 'load-balanced-system',
      adaptiveDifficulty: true,
      baselineMetrics: {
        expectedLatency: 80,
        expectedThroughput: 500,
        expectedErrorRate: 0.005
      },
      events: [
        {
          id: 'gradual-load-ramp',
          type: 'load-increase',
          triggerTime: 30,
          duration: 180,
          severity: 0.5,
          description: 'Traffic gradually increases from 100 to 800 RPS',
          learningObjective: 'Observe load distribution across servers',
          adaptiveParameters: {
            userPerformanceThreshold: 0.8,
            difficultyAdjustment: 0.0,
            skipIfPoorPerformance: false,
            prerequisiteEvents: []
          }
        },
        {
          id: 'server-failure',
          type: 'failure-injection',
          triggerTime: 240,
          duration: 90,
          severity: 0.7,
          description: 'One web server crashes',
          learningObjective: 'Test system resilience and load balancer failover',
          adaptiveParameters: {
            userPerformanceThreshold: 0.7,
            difficultyAdjustment: 0.2,
            skipIfPoorPerformance: false,
            prerequisiteEvents: ['gradual-load-ramp']
          }
        },
        {
          id: 'database-connection-limit',
          type: 'resource-limit',
          triggerTime: 360,
          duration: 120,
          severity: 0.6,
          description: 'Database connection pool reaches maximum capacity',
          learningObjective: 'Understand connection pooling and database scaling',
          adaptiveParameters: {
            userPerformanceThreshold: 0.6,
            difficultyAdjustment: 0.3,
            skipIfPoorPerformance: true,
            prerequisiteEvents: ['server-failure']
          }
        }
      ]
    });

    // Microservices Architecture - Complex multi-service constraints
    this.constraintSequences.set('microservices-basics', {
      scenarioId: 'microservices-basics',
      adaptiveDifficulty: true,
      baselineMetrics: {
        expectedLatency: 120,
        expectedThroughput: 300,
        expectedErrorRate: 0.02
      },
      events: [
        {
          id: 'service-cascade-delay',
          type: 'latency-spike',
          triggerTime: 60,
          duration: 180,
          severity: 0.4,
          description: 'User service experiences increased latency',
          learningObjective: 'Observe how service delays cascade through the system',
          adaptiveParameters: {
            userPerformanceThreshold: 0.7,
            difficultyAdjustment: 0.1,
            skipIfPoorPerformance: false,
            prerequisiteEvents: []
          }
        },
        {
          id: 'message-queue-backlog',
          type: 'resource-limit',
          triggerTime: 180,
          duration: 120,
          severity: 0.5,
          description: 'Message queue starts backing up',
          learningObjective: 'Learn about async processing bottlenecks',
          adaptiveParameters: {
            userPerformanceThreshold: 0.6,
            difficultyAdjustment: 0.2,
            skipIfPoorPerformance: false,
            prerequisiteEvents: ['service-cascade-delay']
          }
        },
        {
          id: 'network-partition',
          type: 'network-partition',
          triggerTime: 320,
          duration: 90,
          severity: 0.8,
          description: 'Network partition between services',
          learningObjective: 'Understand distributed system failure modes',
          adaptiveParameters: {
            userPerformanceThreshold: 0.5,
            difficultyAdjustment: 0.4,
            skipIfPoorPerformance: true,
            prerequisiteEvents: ['message-queue-backlog']
          }
        }
      ]
    });

    // High-Throughput System - Advanced constraint sequences
    this.constraintSequences.set('high-throughput-system', {
      scenarioId: 'high-throughput-system',
      adaptiveDifficulty: true,
      baselineMetrics: {
        expectedLatency: 50,
        expectedThroughput: 10000,
        expectedErrorRate: 0.001
      },
      events: [
        {
          id: 'traffic-spike',
          type: 'load-increase',
          triggerTime: 120,
          duration: 300,
          severity: 0.9,
          description: 'Sudden traffic spike to 100K RPS',
          learningObjective: 'Test system behavior under extreme load',
          adaptiveParameters: {
            userPerformanceThreshold: 0.8,
            difficultyAdjustment: 0.0,
            skipIfPoorPerformance: false,
            prerequisiteEvents: []
          }
        },
        {
          id: 'hot-partition',
          type: 'resource-limit',
          triggerTime: 240,
          duration: 180,
          severity: 0.7,
          description: 'One database shard becomes hot partition',
          learningObjective: 'Learn about data distribution and hot spots',
          adaptiveParameters: {
            userPerformanceThreshold: 0.6,
            difficultyAdjustment: 0.3,
            skipIfPoorPerformance: false,
            prerequisiteEvents: ['traffic-spike']
          }
        },
        {
          id: 'cache-cluster-failure',
          type: 'failure-injection',
          triggerTime: 420,
          duration: 120,
          severity: 0.8,
          description: 'Primary cache cluster fails',
          learningObjective: 'Test cache failover and system degradation',
          adaptiveParameters: {
            userPerformanceThreshold: 0.5,
            difficultyAdjustment: 0.4,
            skipIfPoorPerformance: true,
            prerequisiteEvents: ['hot-partition']
          }
        }
      ]
    });
  }

  /**
   * Get constraint sequence for a scenario
   * Implements SRS FR-9.2 constraint timing and sequencing
   */
  getConstraintSequence(scenarioId: string): ConstraintSequence | null {
    return this.constraintSequences.get(scenarioId) || null;
  }

  /**
   * Start progressive constraint execution for a scenario session
   * Implements SRS FR-9.2 progressive constraint introduction
   */
  startConstraintSequence(sessionId: string, scenarioId: string, userId: string): ConstraintEvent[] {
    const sequence = this.getConstraintSequence(scenarioId);
    if (!sequence) {
      return [];
    }

    // Get user's historical performance for adaptive difficulty
    const userHistory = this.getUserPerformanceHistory(userId, scenarioId);
    const adaptedEvents = this.adaptConstraintsToUser(sequence.events, userHistory);

    this.activeConstraints.set(sessionId, adaptedEvents);
    return adaptedEvents;
  }

  /**
   * Get constraints that should be active at a given time
   * Implements SRS FR-9.2 constraint timing
   */
  getActiveConstraints(sessionId: string, currentTime: number): ConstraintEvent[] {
    const allConstraints = this.activeConstraints.get(sessionId) || [];
    
    return allConstraints.filter(constraint => {
      const startTime = constraint.triggerTime;
      const endTime = constraint.triggerTime + constraint.duration;
      return currentTime >= startTime && currentTime <= endTime;
    });
  }

  /**
   * Get next upcoming constraint
   * Implements SRS FR-9.2 constraint sequencing
   */
  getNextConstraint(sessionId: string, currentTime: number): ConstraintEvent | null {
    const allConstraints = this.activeConstraints.get(sessionId) || [];
    
    const upcomingConstraints = allConstraints
      .filter(constraint => constraint.triggerTime > currentTime)
      .sort((a, b) => a.triggerTime - b.triggerTime);
    
    return upcomingConstraints.length > 0 ? upcomingConstraints[0] : null;
  }

  /**
   * Record user performance metrics for adaptive difficulty
   * Implements SRS FR-9.2 adaptive difficulty adjustment
   */
  recordUserPerformance(userId: string, scenarioId: string, metrics: Omit<UserPerformanceMetrics, 'userId' | 'scenarioId' | 'timestamp'>): void {
    const performanceRecord: UserPerformanceMetrics = {
      userId,
      scenarioId,
      timestamp: Date.now(),
      ...metrics
    };

    if (!this.userPerformance.has(userId)) {
      this.userPerformance.set(userId, []);
    }

    const userHistory = this.userPerformance.get(userId)!;
    userHistory.push(performanceRecord);

    // Keep only last 10 records per scenario
    const scenarioRecords = userHistory.filter(record => record.scenarioId === scenarioId);
    if (scenarioRecords.length > 10) {
      const otherRecords = userHistory.filter(record => record.scenarioId !== scenarioId);
      const recentScenarioRecords = scenarioRecords.slice(-10);
      this.userPerformance.set(userId, [...otherRecords, ...recentScenarioRecords]);
    }
  }

  /**
   * Get user performance history for adaptive difficulty calculation
   */
  private getUserPerformanceHistory(userId: string, scenarioId: string): UserPerformanceMetrics[] {
    const userHistory = this.userPerformance.get(userId) || [];
    return userHistory.filter(record => record.scenarioId === scenarioId);
  }

  /**
   * Adapt constraints based on user performance history
   * Implements SRS FR-9.2 adaptive difficulty adjustment
   */
  private adaptConstraintsToUser(events: ConstraintEvent[], userHistory: UserPerformanceMetrics[]): ConstraintEvent[] {
    if (userHistory.length === 0) {
      // No history, return original events
      return [...events];
    }

    // Calculate user performance score (0.0 to 1.0)
    const avgPerformance = this.calculateUserPerformanceScore(userHistory);
    
    return events.map(event => {
      if (!event.adaptiveParameters) {
        return event;
      }

      const adaptedEvent = { ...event };
      const params = event.adaptiveParameters;

      // Skip event if user performance is below threshold and skip is enabled
      if (params.skipIfPoorPerformance && avgPerformance < params.userPerformanceThreshold) {
        adaptedEvent.severity = 0; // Effectively disable the constraint
        adaptedEvent.description += ' (Skipped due to performance)';
        return adaptedEvent;
      }

      // Adjust difficulty based on user performance
      let difficultyMultiplier = 1.0;
      if (avgPerformance > params.userPerformanceThreshold) {
        // User is performing well, increase difficulty
        difficultyMultiplier = 1.0 + params.difficultyAdjustment;
      } else {
        // User is struggling, decrease difficulty
        difficultyMultiplier = 1.0 - (params.difficultyAdjustment * 0.5);
      }

      adaptedEvent.severity = Math.min(1.0, Math.max(0.1, event.severity * difficultyMultiplier));
      
      if (difficultyMultiplier > 1.0) {
        adaptedEvent.description += ' (Increased difficulty)';
      } else if (difficultyMultiplier < 1.0) {
        adaptedEvent.description += ' (Reduced difficulty)';
      }

      return adaptedEvent;
    });
  }

  /**
   * Calculate user performance score based on historical metrics
   */
  private calculateUserPerformanceScore(history: UserPerformanceMetrics[]): number {
    if (history.length === 0) return 0.5; // Default to average

    const recentHistory = history.slice(-5); // Use last 5 records
    
    let totalScore = 0;
    recentHistory.forEach(record => {
      // Score based on decision accuracy (0.0 to 1.0)
      const decisionScore = record.totalDecisionOpportunities > 0 
        ? record.correctDecisionsMade / record.totalDecisionOpportunities 
        : 0.5;
      
      // Score based on time to resolve issues (lower is better)
      const timeScore = Math.max(0, 1.0 - (record.timeToResolveIssues / 300)); // 5 minutes max
      
      // Combined score
      const combinedScore = (decisionScore * 0.7) + (timeScore * 0.3);
      totalScore += combinedScore;
    });

    return totalScore / recentHistory.length;
  }

  /**
   * Convert constraint event to simulation failure scenario
   * Implements SRS FR-9.2 constraint application
   */
  constraintEventToFailureScenario(event: ConstraintEvent, targetComponentId: string): FailureScenario {
    return {
      componentId: targetComponentId,
      failureType: this.mapConstraintTypeToFailureType(event.type),
      startTime: event.triggerTime,
      duration: event.duration,
      severity: event.severity
    };
  }

  /**
   * Convert constraint event to load pattern modification
   * Implements SRS FR-9.2 load-based constraints
   */
  constraintEventToLoadPattern(event: ConstraintEvent, basePattern: LoadPattern): LoadPattern {
    if (event.type !== 'load-increase') {
      return basePattern;
    }

    const multiplier = 1.0 + event.severity;
    return {
      ...basePattern,
      baseLoad: basePattern.baseLoad * multiplier,
      peakLoad: (basePattern.peakLoad || basePattern.baseLoad) * multiplier
    };
  }

  /**
   * Map constraint types to failure types
   */
  private mapConstraintTypeToFailureType(constraintType: string): string {
    const mapping: { [key: string]: string } = {
      'failure-injection': 'crash',
      'latency-spike': 'latency-increase',
      'resource-limit': 'resource-exhaustion',
      'network-partition': 'network-partition',
      'load-increase': 'load-spike'
    };
    
    return mapping[constraintType] || 'generic-failure';
  }

  /**
   * Clean up session data
   */
  endConstraintSequence(sessionId: string): void {
    this.activeConstraints.delete(sessionId);
  }

  /**
   * Get constraint statistics for analytics
   */
  getConstraintStatistics(scenarioId: string): {
    totalEvents: number;
    averageDifficulty: number;
    adaptiveEvents: number;
  } {
    const sequence = this.getConstraintSequence(scenarioId);
    if (!sequence) {
      return { totalEvents: 0, averageDifficulty: 0, adaptiveEvents: 0 };
    }

    const events = sequence.events;
    const totalEvents = events.length;
    const averageDifficulty = events.reduce((sum, event) => sum + event.severity, 0) / totalEvents;
    const adaptiveEvents = events.filter(event => event.adaptiveParameters).length;

    return { totalEvents, averageDifficulty, adaptiveEvents };
  }
}

// Singleton instance
export const progressiveConstraintService = new ProgressiveConstraintService();