import { UserProgress, Scenario } from '../types';
import { EvaluationResult } from './guidanceService';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  criteria: string;
  points: number;
  unlockedAt?: Date;
  category: 'completion' | 'performance' | 'speed' | 'consistency' | 'mastery';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface LearningPath {
  id: string;
  name: string;
  description: string;
  scenarios: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: number; // minutes
  prerequisites: string[];
  rewards: {
    points: number;
    achievements: string[];
  };
}

export interface ScenarioCompletion {
  scenarioId: string;
  completedAt: Date;
  score: number;
  timeSpent: number; // minutes
  hintsUsed: number;
  attemptsCount: number;
  evaluationResult: EvaluationResult;
  learningObjectivesMet: string[];
}

export interface LearningAnalytics {
  userId: string;
  totalTimeSpent: number; // minutes
  averageSessionDuration: number; // minutes
  conceptsMastered: string[];
  conceptsStruggling: string[];
  learningVelocity: number; // scenarios per week
  retentionRate: number; // percentage
  engagementScore: number; // 0-100
  preferredLearningStyle: 'visual' | 'hands-on' | 'theoretical' | 'mixed';
  strongAreas: string[];
  improvementAreas: string[];
}

export interface ProgressStats {
  totalScenarios: number;
  completedScenarios: number;
  averageScore: number;
  totalPoints: number;
  currentStreak: number;
  longestStreak: number;
  timeSpent: number; // minutes
  achievements: Achievement[];
  currentLevel: number;
  nextLevelProgress: number;
  // Enhanced analytics
  completionRate: number; // percentage
  masteryLevel: 'novice' | 'beginner' | 'intermediate' | 'advanced' | 'expert';
  recentActivity: ScenarioCompletion[];
  learningTrends: {
    scoreImprovement: number;
    speedImprovement: number;
    consistencyImprovement: number;
  };
}

export interface Milestone {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement: number;
  type: 'scenarios_completed' | 'points_earned' | 'streak_achieved' | 'time_spent' | 'concepts_mastered';
  rewards: {
    points: number;
    title?: string;
    badge?: string;
  };
}

export interface RecommendationEngine {
  getNextScenarios(userProgress: UserProgress): Scenario[];
  getPersonalizedHints(userProgress: UserProgress, currentScenario: string): string[];
  getLearningPath(userProgress: UserProgress): LearningPath | null;
}

/**
 * Enhanced Progress Service implementing SRS FR-9.4
 * Manages scenario completion tracking, learning progress analytics,
 * achievement and milestone systems with comprehensive user progress tracking
 */
export class ProgressService {
  private userProgress: Map<string, UserProgress> = new Map();
  private scenarioCompletions: Map<string, ScenarioCompletion[]> = new Map(); // userId -> completions
  private learningAnalytics: Map<string, LearningAnalytics> = new Map(); // userId -> analytics
  private achievements: Achievement[] = [];
  private milestones: Milestone[] = [];
  private learningPaths: LearningPath[] = [];

  constructor() {
    this.initializeAchievements();
    this.initializeMilestones();
    this.initializeLearningPaths();
  }

  /**
   * Initialize comprehensive achievement definitions implementing SRS FR-9.4
   */
  private initializeAchievements(): void {
    this.achievements = [
      // Completion Achievements
      {
        id: 'first-scenario',
        name: 'Getting Started',
        description: 'Complete your first scenario',
        icon: '🎯',
        criteria: 'complete_scenario',
        points: 100,
        category: 'completion',
        rarity: 'common'
      },
      {
        id: 'scenario-explorer',
        name: 'Scenario Explorer',
        description: 'Complete 5 different scenarios',
        icon: '🗺️',
        criteria: 'complete_5_scenarios',
        points: 300,
        category: 'completion',
        rarity: 'common'
      },
      {
        id: 'scenario-master',
        name: 'Scenario Master',
        description: 'Complete all available scenarios',
        icon: '👑',
        criteria: 'complete_all_scenarios',
        points: 1000,
        category: 'completion',
        rarity: 'legendary'
      },

      // Performance Achievements
      {
        id: 'perfect-score',
        name: 'Perfect Solution',
        description: 'Achieve 100% score on any scenario',
        icon: '⭐',
        criteria: 'perfect_score',
        points: 250,
        category: 'performance',
        rarity: 'rare'
      },
      {
        id: 'perfectionist',
        name: 'Perfectionist',
        description: 'Achieve 90%+ average score across all scenarios',
        icon: '💎',
        criteria: 'high_average',
        points: 500,
        category: 'performance',
        rarity: 'epic'
      },
      {
        id: 'consistent-performer',
        name: 'Consistent Performer',
        description: 'Score 80%+ on 10 consecutive scenarios',
        icon: '🎖️',
        criteria: 'consistent_high_scores',
        points: 400,
        category: 'performance',
        rarity: 'rare'
      },

      // Speed Achievements
      {
        id: 'speed-demon',
        name: 'Speed Demon',
        description: 'Complete a scenario in under 10 minutes',
        icon: '⚡',
        criteria: 'fast_completion',
        points: 150,
        category: 'speed',
        rarity: 'common'
      },
      {
        id: 'lightning-fast',
        name: 'Lightning Fast',
        description: 'Complete 3 scenarios in under 15 minutes each',
        icon: '🏃‍♂️',
        criteria: 'multiple_fast_completions',
        points: 300,
        category: 'speed',
        rarity: 'rare'
      },

      // Consistency Achievements
      {
        id: 'streak-master',
        name: 'Streak Master',
        description: 'Complete 5 scenarios in a row with passing scores',
        icon: '🔥',
        criteria: 'streak_5',
        points: 200,
        category: 'consistency',
        rarity: 'common'
      },
      {
        id: 'unstoppable',
        name: 'Unstoppable',
        description: 'Complete 10 scenarios in a row with 80%+ scores',
        icon: '🚀',
        criteria: 'streak_10_high',
        points: 500,
        category: 'consistency',
        rarity: 'epic'
      },

      // Mastery Achievements
      {
        id: 'load-balancer-master',
        name: 'Load Balancer Master',
        description: 'Complete all load balancing scenarios with 85%+ scores',
        icon: '⚖️',
        criteria: 'master_load_balancing',
        points: 300,
        category: 'mastery',
        rarity: 'rare'
      },
      {
        id: 'caching-expert',
        name: 'Caching Expert',
        description: 'Complete all caching optimization scenarios with 85%+ scores',
        icon: '🚀',
        criteria: 'master_caching',
        points: 300,
        category: 'mastery',
        rarity: 'rare'
      },
      {
        id: 'microservices-architect',
        name: 'Microservices Architect',
        description: 'Complete all microservices scenarios with 85%+ scores',
        icon: '🏗️',
        criteria: 'master_microservices',
        points: 400,
        category: 'mastery',
        rarity: 'epic'
      },
      {
        id: 'system-design-guru',
        name: 'System Design Guru',
        description: 'Master all system design concepts with 90%+ average',
        icon: '🧙‍♂️',
        criteria: 'master_all_concepts',
        points: 1500,
        category: 'mastery',
        rarity: 'legendary'
      },

      // Learning Achievements
      {
        id: 'quick-learner',
        name: 'Quick Learner',
        description: 'Complete first 3 scenarios without using hints',
        icon: '🧠',
        criteria: 'no_hints_early',
        points: 200,
        category: 'performance',
        rarity: 'rare'
      },
      {
        id: 'persistent-learner',
        name: 'Persistent Learner',
        description: 'Complete a scenario after 3+ attempts',
        icon: '💪',
        criteria: 'persistent_completion',
        points: 150,
        category: 'consistency',
        rarity: 'common'
      }
    ];
  }

  /**
   * Initialize milestone definitions implementing SRS FR-9.4
   */
  private initializeMilestones(): void {
    this.milestones = [
      {
        id: 'scenarios-5',
        name: 'Explorer',
        description: 'Complete 5 scenarios',
        icon: '🗺️',
        requirement: 5,
        type: 'scenarios_completed',
        rewards: { points: 100, title: 'Explorer' }
      },
      {
        id: 'scenarios-10',
        name: 'Adventurer',
        description: 'Complete 10 scenarios',
        icon: '🎒',
        requirement: 10,
        type: 'scenarios_completed',
        rewards: { points: 250, title: 'Adventurer' }
      },
      {
        id: 'scenarios-25',
        name: 'Expert',
        description: 'Complete 25 scenarios',
        icon: '🎓',
        requirement: 25,
        type: 'scenarios_completed',
        rewards: { points: 500, title: 'Expert', badge: 'expert-badge' }
      },
      {
        id: 'points-1000',
        name: 'Point Collector',
        description: 'Earn 1000 points',
        icon: '💰',
        requirement: 1000,
        type: 'points_earned',
        rewards: { points: 200 }
      },
      {
        id: 'points-5000',
        name: 'Point Master',
        description: 'Earn 5000 points',
        icon: '💎',
        requirement: 5000,
        type: 'points_earned',
        rewards: { points: 500, badge: 'point-master-badge' }
      },
      {
        id: 'streak-10',
        name: 'Streak Champion',
        description: 'Achieve a 10-scenario streak',
        icon: '🔥',
        requirement: 10,
        type: 'streak_achieved',
        rewards: { points: 300, title: 'Streak Champion' }
      },
      {
        id: 'time-600',
        name: 'Dedicated Learner',
        description: 'Spend 10 hours learning',
        icon: '⏰',
        requirement: 600, // minutes
        type: 'time_spent',
        rewards: { points: 200, title: 'Dedicated Learner' }
      }
    ];
  }
  /**
   * Initialize enhanced learning path definitions implementing SRS FR-9.4
   */
  private initializeLearningPaths(): void {
    this.learningPaths = [
      {
        id: 'beginner-path',
        name: 'System Design Fundamentals',
        description: 'Learn the basics of system design with simple architectures',
        scenarios: ['basic-web-app', 'simple-caching'],
        difficulty: 'beginner',
        estimatedTime: 90,
        prerequisites: [],
        rewards: { points: 200, achievements: ['first-scenario', 'quick-learner'] }
      },
      {
        id: 'scaling-path',
        name: 'Scaling Systems',
        description: 'Master horizontal and vertical scaling techniques',
        scenarios: ['load-balanced-system', 'caching-optimization'],
        difficulty: 'intermediate',
        estimatedTime: 120,
        prerequisites: ['beginner-path'],
        rewards: { points: 400, achievements: ['load-balancer-master', 'caching-expert'] }
      },
      {
        id: 'advanced-architecture-path',
        name: 'Advanced Architectures',
        description: 'Design complex distributed systems and microservices',
        scenarios: ['microservices-basics', 'global-cdn-system'],
        difficulty: 'advanced',
        estimatedTime: 180,
        prerequisites: ['scaling-path'],
        rewards: { points: 600, achievements: ['microservices-architect'] }
      },
      {
        id: 'performance-path',
        name: 'Performance Optimization',
        description: 'Master techniques for optimizing system performance',
        scenarios: ['caching-optimization', 'high-throughput-system'],
        difficulty: 'intermediate',
        estimatedTime: 150,
        prerequisites: ['beginner-path'],
        rewards: { points: 500, achievements: ['caching-expert', 'speed-demon'] }
      },
      {
        id: 'resilience-path',
        name: 'System Resilience',
        description: 'Build fault-tolerant and highly available systems',
        scenarios: ['chaos-engineering', 'high-throughput-system'],
        difficulty: 'advanced',
        estimatedTime: 200,
        prerequisites: ['advanced-architecture-path'],
        rewards: { points: 800, achievements: ['system-design-guru'] }
      }
    ];
  }

  /**
   * Record scenario completion with comprehensive tracking
   * Implements SRS FR-9.4 scenario completion tracking
   */
  recordScenarioCompletion(
    userId: string,
    scenarioId: string,
    evaluationResult: EvaluationResult,
    timeSpent: number,
    hintsUsed: number,
    attemptsCount: number,
    learningObjectivesMet: string[]
  ): ScenarioCompletion {
    const completion: ScenarioCompletion = {
      scenarioId,
      completedAt: new Date(),
      score: evaluationResult.score,
      timeSpent,
      hintsUsed,
      attemptsCount,
      evaluationResult,
      learningObjectivesMet
    };

    // Store completion record
    if (!this.scenarioCompletions.has(userId)) {
      this.scenarioCompletions.set(userId, []);
    }
    this.scenarioCompletions.get(userId)!.push(completion);

    // Update user progress
    this.updateProgress(userId, scenarioId, evaluationResult);

    // Update learning analytics
    this.updateLearningAnalytics(userId, completion);

    return completion;
  }

  /**
   * Get scenario completion history for a user
   * Implements SRS FR-9.4 scenario completion tracking
   */
  getScenarioCompletions(userId: string, scenarioId?: string): ScenarioCompletion[] {
    const completions = this.scenarioCompletions.get(userId) || [];
    
    if (scenarioId) {
      return completions.filter(c => c.scenarioId === scenarioId);
    }
    
    return completions.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
  }

  /**
   * Get learning analytics for a user
   * Implements SRS FR-9.4 learning progress analytics
   */
  getLearningAnalytics(userId: string): LearningAnalytics {
    if (!this.learningAnalytics.has(userId)) {
      this.initializeLearningAnalytics(userId);
    }
    return this.learningAnalytics.get(userId)!;
  }

  /**
   * Initialize learning analytics for a new user
   */
  private initializeLearningAnalytics(userId: string): void {
    const analytics: LearningAnalytics = {
      userId,
      totalTimeSpent: 0,
      averageSessionDuration: 0,
      conceptsMastered: [],
      conceptsStruggling: [],
      learningVelocity: 0,
      retentionRate: 100,
      engagementScore: 50,
      preferredLearningStyle: 'mixed',
      strongAreas: [],
      improvementAreas: []
    };
    
    this.learningAnalytics.set(userId, analytics);
  }

  /**
   * Update learning analytics based on scenario completion
   */
  private updateLearningAnalytics(userId: string, completion: ScenarioCompletion): void {
    const analytics = this.getLearningAnalytics(userId);
    const completions = this.getScenarioCompletions(userId);

    // Update time tracking
    analytics.totalTimeSpent += completion.timeSpent;
    analytics.averageSessionDuration = analytics.totalTimeSpent / completions.length;

    // Update concepts mastered/struggling
    completion.learningObjectivesMet.forEach(objective => {
      if (!analytics.conceptsMastered.includes(objective)) {
        analytics.conceptsMastered.push(objective);
      }
    });

    // Identify struggling concepts (low scores with multiple attempts)
    if (completion.score < 70 && completion.attemptsCount > 2) {
      const strugglingConcepts = this.extractConceptsFromScenario(completion.scenarioId);
      strugglingConcepts.forEach(concept => {
        if (!analytics.conceptsStruggling.includes(concept)) {
          analytics.conceptsStruggling.push(concept);
        }
      });
    }

    // Calculate learning velocity (scenarios per week)
    const recentCompletions = completions.filter(c => 
      (Date.now() - c.completedAt.getTime()) < (7 * 24 * 60 * 60 * 1000) // Last 7 days
    );
    analytics.learningVelocity = recentCompletions.length;

    // Calculate retention rate (simplified)
    const totalAttempts = completions.reduce((sum, c) => sum + c.attemptsCount, 0);
    const successfulFirstAttempts = completions.filter(c => c.attemptsCount === 1 && c.score >= 70).length;
    analytics.retentionRate = completions.length > 0 ? (successfulFirstAttempts / completions.length) * 100 : 100;

    // Calculate engagement score
    analytics.engagementScore = this.calculateEngagementScore(completions, analytics);

    // Determine preferred learning style
    analytics.preferredLearningStyle = this.determinePreferredLearningStyle(completions);

    // Identify strong areas and improvement areas
    analytics.strongAreas = this.identifyStrongAreas(completions);
    analytics.improvementAreas = this.identifyImprovementAreas(completions);

    this.learningAnalytics.set(userId, analytics);
  }

  /**
   * Calculate engagement score based on user behavior
   */
  private calculateEngagementScore(completions: ScenarioCompletion[], analytics: LearningAnalytics): number {
    if (completions.length === 0) return 50;

    let score = 50; // Base score

    // Bonus for consistency
    if (analytics.learningVelocity > 2) score += 20;
    else if (analytics.learningVelocity > 1) score += 10;

    // Bonus for high scores
    const avgScore = completions.reduce((sum, c) => sum + c.score, 0) / completions.length;
    if (avgScore > 85) score += 20;
    else if (avgScore > 70) score += 10;

    // Bonus for low hint usage
    const avgHints = completions.reduce((sum, c) => sum + c.hintsUsed, 0) / completions.length;
    if (avgHints < 2) score += 10;
    else if (avgHints < 4) score += 5;

    // Penalty for many attempts
    const avgAttempts = completions.reduce((sum, c) => sum + c.attemptsCount, 0) / completions.length;
    if (avgAttempts > 3) score -= 10;
    else if (avgAttempts > 2) score -= 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Determine preferred learning style based on completion patterns
   */
  private determinePreferredLearningStyle(completions: ScenarioCompletion[]): 'visual' | 'hands-on' | 'theoretical' | 'mixed' {
    if (completions.length < 3) return 'mixed';

    const avgHints = completions.reduce((sum, c) => sum + c.hintsUsed, 0) / completions.length;
    const avgTime = completions.reduce((sum, c) => sum + c.timeSpent, 0) / completions.length;
    const avgAttempts = completions.reduce((sum, c) => sum + c.attemptsCount, 0) / completions.length;

    if (avgHints < 2 && avgTime < 20) return 'hands-on'; // Quick, independent learner
    if (avgHints > 5) return 'theoretical'; // Prefers explanations
    if (avgAttempts > 2 && avgTime > 30) return 'visual'; // Takes time, multiple attempts
    return 'mixed';
  }

  /**
   * Identify strong areas based on performance patterns
   */
  private identifyStrongAreas(completions: ScenarioCompletion[]): string[] {
    const conceptScores: { [concept: string]: number[] } = {};
    
    completions.forEach(completion => {
      const concepts = this.extractConceptsFromScenario(completion.scenarioId);
      concepts.forEach(concept => {
        if (!conceptScores[concept]) conceptScores[concept] = [];
        conceptScores[concept].push(completion.score);
      });
    });

    return Object.entries(conceptScores)
      .filter(([_, scores]) => {
        const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        return avgScore >= 85 && scores.length >= 2;
      })
      .map(([concept, _]) => concept);
  }

  /**
   * Identify improvement areas based on performance patterns
   */
  private identifyImprovementAreas(completions: ScenarioCompletion[]): string[] {
    const conceptScores: { [concept: string]: number[] } = {};
    
    completions.forEach(completion => {
      const concepts = this.extractConceptsFromScenario(completion.scenarioId);
      concepts.forEach(concept => {
        if (!conceptScores[concept]) conceptScores[concept] = [];
        conceptScores[concept].push(completion.score);
      });
    });

    return Object.entries(conceptScores)
      .filter(([_, scores]) => {
        const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        return avgScore < 70 && scores.length >= 2;
      })
      .map(([concept, _]) => concept);
  }

  /**
   * Extract learning concepts from scenario ID
   */
  private extractConceptsFromScenario(scenarioId: string): string[] {
    const conceptMap: { [scenarioId: string]: string[] } = {
      'basic-web-app': ['client-server-architecture', 'database-connections'],
      'simple-caching': ['caching-strategies', 'performance-optimization'],
      'load-balanced-system': ['load-balancing', 'horizontal-scaling', 'high-availability'],
      'caching-optimization': ['cache-patterns', 'performance-tuning'],
      'microservices-basics': ['microservices', 'service-decomposition', 'distributed-systems'],
      'global-cdn-system': ['cdn', 'global-distribution', 'edge-computing'],
      'high-throughput-system': ['high-performance', 'scalability', 'optimization'],
      'chaos-engineering': ['fault-tolerance', 'resilience', 'disaster-recovery']
    };
    
    return conceptMap[scenarioId] || [];
  }

  /**
   * Get user progress by ID
   */
  getUserProgress(userId: string): UserProgress {
    if (!this.userProgress.has(userId)) {
      this.userProgress.set(userId, {
        userId,
        completedScenarios: [],
        achievements: [],
        totalScore: 0
      });
    }
    return this.userProgress.get(userId)!;
  }

  /**
   * Update user progress after scenario completion
   */
  updateProgress(userId: string, scenarioId: string, evaluationResult: EvaluationResult): UserProgress {
    const progress = this.getUserProgress(userId);
    
    // Add scenario to completed list if not already there
    if (!progress.completedScenarios.includes(scenarioId)) {
      progress.completedScenarios.push(scenarioId);
    }

    // Update total score (running average)
    const previousTotal = progress.totalScore * (progress.completedScenarios.length - 1);
    progress.totalScore = Math.round((previousTotal + evaluationResult.score) / progress.completedScenarios.length);

    // Update current scenario
    progress.currentScenario = undefined;

    // Check for new achievements
    const newAchievements = this.checkAchievements(progress, evaluationResult);
    newAchievements.forEach(achievement => {
      if (!progress.achievements.includes(achievement.id)) {
        progress.achievements.push(achievement.id);
        achievement.unlockedAt = new Date();
      }
    });

    this.userProgress.set(userId, progress);
    return progress;
  }

  /**
   * Get comprehensive progress statistics implementing SRS FR-9.4
   */
  getProgressStats(userId: string, allScenarios: Scenario[]): ProgressStats {
    const progress = this.getUserProgress(userId);
    const completions = this.getScenarioCompletions(userId);
    const analytics = this.getLearningAnalytics(userId);
    const completedCount = progress.completedScenarios.length;
    const totalCount = allScenarios.length;

    // Calculate achievements and points
    const unlockedAchievements = this.achievements.filter(a => 
      progress.achievements.includes(a.id)
    );
    const totalPoints = unlockedAchievements.reduce((sum, a) => sum + a.points, 0);

    // Calculate level (every 500 points = 1 level)
    const currentLevel = Math.floor(totalPoints / 500) + 1;
    const nextLevelProgress = (totalPoints % 500) / 500 * 100;

    // Calculate streaks
    const currentStreak = this.calculateCurrentStreak(completions);
    const longestStreak = this.calculateLongestStreak(completions);

    // Calculate completion rate
    const completionRate = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    // Determine mastery level
    const masteryLevel = this.determineMasteryLevel(progress, analytics);

    // Get recent activity (last 5 completions)
    const recentActivity = completions.slice(0, 5);

    // Calculate learning trends
    const learningTrends = this.calculateLearningTrends(completions);

    return {
      totalScenarios: totalCount,
      completedScenarios: completedCount,
      averageScore: progress.totalScore,
      totalPoints,
      currentStreak,
      longestStreak,
      timeSpent: analytics.totalTimeSpent,
      achievements: unlockedAchievements,
      currentLevel,
      nextLevelProgress,
      completionRate,
      masteryLevel,
      recentActivity,
      learningTrends
    };
  }

  /**
   * Determine user's mastery level based on progress and analytics
   */
  private determineMasteryLevel(progress: UserProgress, analytics: LearningAnalytics): 'novice' | 'beginner' | 'intermediate' | 'advanced' | 'expert' {
    const completedCount = progress.completedScenarios.length;
    const avgScore = progress.totalScore;
    const conceptsMastered = analytics.conceptsMastered.length;

    if (completedCount === 0) return 'novice';
    if (completedCount < 3 || avgScore < 60) return 'beginner';
    if (completedCount < 8 || avgScore < 75 || conceptsMastered < 5) return 'intermediate';
    if (completedCount < 15 || avgScore < 85 || conceptsMastered < 10) return 'advanced';
    return 'expert';
  }

  /**
   * Calculate learning trends over time
   */
  private calculateLearningTrends(completions: ScenarioCompletion[]): {
    scoreImprovement: number;
    speedImprovement: number;
    consistencyImprovement: number;
  } {
    if (completions.length < 3) {
      return { scoreImprovement: 0, speedImprovement: 0, consistencyImprovement: 0 };
    }

    const sortedCompletions = [...completions].sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime());
    const firstHalf = sortedCompletions.slice(0, Math.floor(sortedCompletions.length / 2));
    const secondHalf = sortedCompletions.slice(Math.floor(sortedCompletions.length / 2));

    // Score improvement
    const firstHalfAvgScore = firstHalf.reduce((sum, c) => sum + c.score, 0) / firstHalf.length;
    const secondHalfAvgScore = secondHalf.reduce((sum, c) => sum + c.score, 0) / secondHalf.length;
    const scoreImprovement = secondHalfAvgScore - firstHalfAvgScore;

    // Speed improvement (lower time is better, so negative change is improvement)
    const firstHalfAvgTime = firstHalf.reduce((sum, c) => sum + c.timeSpent, 0) / firstHalf.length;
    const secondHalfAvgTime = secondHalf.reduce((sum, c) => sum + c.timeSpent, 0) / secondHalf.length;
    const speedImprovement = firstHalfAvgTime - secondHalfAvgTime; // Positive means improvement

    // Consistency improvement (lower attempts is better)
    const firstHalfAvgAttempts = firstHalf.reduce((sum, c) => sum + c.attemptsCount, 0) / firstHalf.length;
    const secondHalfAvgAttempts = secondHalf.reduce((sum, c) => sum + c.attemptsCount, 0) / secondHalf.length;
    const consistencyImprovement = firstHalfAvgAttempts - secondHalfAvgAttempts; // Positive means improvement

    return {
      scoreImprovement: Math.round(scoreImprovement * 10) / 10,
      speedImprovement: Math.round(speedImprovement * 10) / 10,
      consistencyImprovement: Math.round(consistencyImprovement * 10) / 10
    };
  }

  /**
   * Get recommended next scenarios
   */
  getRecommendedScenarios(userId: string, allScenarios: Scenario[]): Scenario[] {
    const progress = this.getUserProgress(userId);
    const completed = new Set(progress.completedScenarios);
    
    // Filter out completed scenarios
    const incomplete = allScenarios.filter(scenario => !completed.has(scenario.id));
    
    if (incomplete.length === 0) {
      return [];
    }

    // Recommend based on learning path progression
    const currentPath = this.getCurrentLearningPath(progress);
    if (currentPath) {
      const pathScenarios = incomplete.filter(s => currentPath.scenarios.includes(s.id));
      if (pathScenarios.length > 0) {
        return pathScenarios.slice(0, 2);
      }
    }

    // Fallback to difficulty-based recommendations
    if (completed.size === 0) {
      // First scenario - recommend beginner
      return incomplete.filter(s => s.id === 'basic-web-app').slice(0, 1);
    } else if (completed.size < 3) {
      // Early scenarios - recommend beginner/intermediate
      return incomplete.filter(s => 
        s.id === 'load-balanced-system' || s.id === 'caching-optimization'
      ).slice(0, 2);
    } else {
      // Advanced scenarios
      return incomplete.filter(s => 
        s.id === 'microservices-architecture'
      ).slice(0, 1);
    }
  }
  /**
   * Get personalized learning path
   */
  getCurrentLearningPath(progress: UserProgress): LearningPath | null {
    const completedCount = progress.completedScenarios.length;
    const averageScore = progress.totalScore;

    // Determine appropriate path based on progress
    if (completedCount === 0 || averageScore < 60) {
      return this.learningPaths.find(p => p.id === 'beginner-path') || null;
    } else if (completedCount < 3 || averageScore < 80) {
      return this.learningPaths.find(p => p.id === 'performance-path') || null;
    } else {
      return this.learningPaths.find(p => p.id === 'scalability-path') || null;
    }
  }

  /**
   * Get all available learning paths
   */
  getAllLearningPaths(): LearningPath[] {
    return this.learningPaths;
  }

  /**
   * Check for newly unlocked achievements
   */
  private checkAchievements(progress: UserProgress, evaluationResult: EvaluationResult): Achievement[] {
    const newAchievements: Achievement[] = [];

    // First scenario completion
    if (progress.completedScenarios.length === 1) {
      const achievement = this.achievements.find(a => a.id === 'first-scenario');
      if (achievement && !progress.achievements.includes(achievement.id)) {
        newAchievements.push(achievement);
      }
    }

    // Perfect score
    if (evaluationResult.score === 100) {
      const achievement = this.achievements.find(a => a.id === 'perfect-score');
      if (achievement && !progress.achievements.includes(achievement.id)) {
        newAchievements.push(achievement);
      }
    }

    // High average score
    if (progress.totalScore >= 90 && progress.completedScenarios.length >= 3) {
      const achievement = this.achievements.find(a => a.id === 'perfectionist');
      if (achievement && !progress.achievements.includes(achievement.id)) {
        newAchievements.push(achievement);
      }
    }

    // Category-specific achievements
    const loadBalancingScenarios = ['load-balanced-system'];
    const cachingScenarios = ['caching-optimization'];
    const microservicesScenarios = ['microservices-architecture'];

    if (loadBalancingScenarios.every(s => progress.completedScenarios.includes(s))) {
      const achievement = this.achievements.find(a => a.id === 'load-balancer-master');
      if (achievement && !progress.achievements.includes(achievement.id)) {
        newAchievements.push(achievement);
      }
    }

    if (cachingScenarios.every(s => progress.completedScenarios.includes(s))) {
      const achievement = this.achievements.find(a => a.id === 'caching-expert');
      if (achievement && !progress.achievements.includes(achievement.id)) {
        newAchievements.push(achievement);
      }
    }

    if (microservicesScenarios.every(s => progress.completedScenarios.includes(s))) {
      const achievement = this.achievements.find(a => a.id === 'microservices-architect');
      if (achievement && !progress.achievements.includes(achievement.id)) {
        newAchievements.push(achievement);
      }
    }

    return newAchievements;
  }

  /**
   * Calculate current streak based on recent completions
   */
  private calculateCurrentStreak(completions: ScenarioCompletion[]): number {
    if (completions.length === 0) return 0;

    const sortedCompletions = [...completions].sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
    let streak = 0;

    for (const completion of sortedCompletions) {
      if (completion.score >= 70) { // Passing score threshold
        streak++;
      } else {
        break; // Streak broken
      }
    }

    return streak;
  }

  /**
   * Calculate longest streak from completion history
   */
  private calculateLongestStreak(completions: ScenarioCompletion[]): number {
    if (completions.length === 0) return 0;

    const sortedCompletions = [...completions].sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime());
    let longestStreak = 0;
    let currentStreak = 0;

    for (const completion of sortedCompletions) {
      if (completion.score >= 70) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    return longestStreak;
  }

  /**
   * Get achievement by ID
   */
  getAchievement(id: string): Achievement | null {
    return this.achievements.find(a => a.id === id) || null;
  }

  /**
   * Get all milestones
   */
  getAllMilestones(): Milestone[] {
    return this.milestones;
  }

  /**
   * Get achieved milestones for a user
   */
  getAchievedMilestones(userId: string): Milestone[] {
    const progress = this.getUserProgress(userId);
    const completions = this.getScenarioCompletions(userId);
    const analytics = this.getLearningAnalytics(userId);
    
    const unlockedAchievements = this.achievements.filter(a => 
      progress.achievements.includes(a.id)
    );
    const totalPoints = unlockedAchievements.reduce((sum, a) => sum + a.points, 0);
    const currentStreak = this.calculateCurrentStreak(completions);

    return this.milestones.filter(milestone => {
      switch (milestone.type) {
        case 'scenarios_completed':
          return progress.completedScenarios.length >= milestone.requirement;
        case 'points_earned':
          return totalPoints >= milestone.requirement;
        case 'streak_achieved':
          return currentStreak >= milestone.requirement;
        case 'time_spent':
          return analytics.totalTimeSpent >= milestone.requirement;
        case 'concepts_mastered':
          return analytics.conceptsMastered.length >= milestone.requirement;
        default:
          return false;
      }
    });
  }

  /**
   * Get next milestone for a user
   */
  getNextMilestone(userId: string): Milestone | null {
    const achievedMilestones = new Set(this.getAchievedMilestones(userId).map(m => m.id));
    const unachievedMilestones = this.milestones.filter(m => !achievedMilestones.has(m.id));
    
    if (unachievedMilestones.length === 0) return null;
    
    // Return the milestone with the lowest requirement
    return unachievedMilestones.reduce((closest, current) => 
      current.requirement < closest.requirement ? current : closest
    );
  }

  /**
   * Get all achievements
   */
  getAllAchievements(): Achievement[] {
    return this.achievements;
  }

  /**
   * Get achievements by category
   */
  getAchievementsByCategory(category: Achievement['category']): Achievement[] {
    return this.achievements.filter(a => a.category === category);
  }

  /**
   * Get achievements by rarity
   */
  getAchievementsByRarity(rarity: Achievement['rarity']): Achievement[] {
    return this.achievements.filter(a => a.rarity === rarity);
  }

  /**
   * Get user's learning summary
   */
  getUserLearningSummary(userId: string): {
    totalTimeSpent: number;
    scenariosCompleted: number;
    conceptsMastered: number;
    averageScore: number;
    strongestArea: string;
    improvementArea: string;
    nextRecommendation: string;
  } {
    const progress = this.getUserProgress(userId);
    const analytics = this.getLearningAnalytics(userId);
    const completions = this.getScenarioCompletions(userId);

    return {
      totalTimeSpent: analytics.totalTimeSpent,
      scenariosCompleted: progress.completedScenarios.length,
      conceptsMastered: analytics.conceptsMastered.length,
      averageScore: progress.totalScore,
      strongestArea: analytics.strongAreas[0] || 'None yet',
      improvementArea: analytics.improvementAreas[0] || 'Keep learning!',
      nextRecommendation: this.getNextRecommendation(userId)
    };
  }

  /**
   * Get next recommendation for a user
   */
  private getNextRecommendation(userId: string): string {
    const progress = this.userProgress.get(userId);
    if (!progress) return 'Start with a beginner scenario';

    const analytics = this.getLearningAnalytics(userId);
    
    // If user has improvement areas, recommend working on those
    if (analytics.improvementAreas.length > 0) {
      return `Focus on improving ${analytics.improvementAreas[0]}`;
    }
    
    // If user has completed scenarios, recommend next difficulty level
    if (progress.completedScenarios.length > 0) {
      const lastCompleted = progress.completedScenarios[progress.completedScenarios.length - 1];
      return `Try an intermediate scenario to build on ${lastCompleted}`;
    }
    
    return 'Start with a beginner scenario to learn the basics';
  }

  /**
   * Get milestone progress for a user
   */
  getMilestoneProgress(userId: string, milestoneId: string): { current: number; required: number; percentage: number } | null {
    const milestone = this.milestones.find(m => m.id === milestoneId);
    if (!milestone) return null;

    const progress = this.getUserProgress(userId);
    const completions = this.getScenarioCompletions(userId);
    const analytics = this.getLearningAnalytics(userId);
    
    const unlockedAchievements = this.achievements.filter(a => 
      progress.achievements.includes(a.id)
    );
    const totalPoints = unlockedAchievements.reduce((sum, a) => sum + a.points, 0);
    const currentStreak = this.calculateCurrentStreak(completions);

    let current = 0;
    switch (milestone.type) {
      case 'scenarios_completed':
        current = progress.completedScenarios.length;
        break;
      case 'points_earned':
        current = totalPoints;
        break;
      case 'streak_achieved':
        current = currentStreak;
        break;
      case 'time_spent':
        current = analytics.totalTimeSpent;
        break;
      case 'concepts_mastered':
        current = analytics.conceptsMastered.length;
        break;
    }

    const percentage = Math.min(100, (current / milestone.requirement) * 100);
    
    return {
      current,
      required: milestone.requirement,
      percentage: Math.round(percentage * 10) / 10
    };
  }

  /**
   * Reset user progress (for testing/demo purposes)
   */
  resetProgress(userId: string): void {
    this.userProgress.delete(userId);
  }

  /**
   * Get leaderboard data (simplified)
   */
  getLeaderboard(): Array<{ userId: string; score: number; completedScenarios: number }> {
    return Array.from(this.userProgress.entries())
      .map(([userId, progress]) => ({
        userId,
        score: progress.totalScore,
        completedScenarios: progress.completedScenarios.length
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }
}

// Singleton instance
export const progressService = new ProgressService();