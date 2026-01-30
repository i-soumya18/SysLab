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
}

export interface LearningPath {
  id: string;
  name: string;
  description: string;
  scenarios: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: number; // minutes
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
}

export interface RecommendationEngine {
  getNextScenarios(userProgress: UserProgress): Scenario[];
  getPersonalizedHints(userProgress: UserProgress, currentScenario: string): string[];
  getLearningPath(userProgress: UserProgress): LearningPath | null;
}

/**
 * Progress Service
 * Manages user progress tracking, achievements, and personalized recommendations
 */
export class ProgressService {
  private userProgress: Map<string, UserProgress> = new Map();
  private achievements: Achievement[] = [];
  private learningPaths: LearningPath[] = [];

  constructor() {
    this.initializeAchievements();
    this.initializeLearningPaths();
  }

  /**
   * Initialize achievement definitions
   */
  private initializeAchievements(): void {
    this.achievements = [
      {
        id: 'first-scenario',
        name: 'Getting Started',
        description: 'Complete your first scenario',
        icon: '🎯',
        criteria: 'complete_scenario',
        points: 100
      },
      {
        id: 'perfect-score',
        name: 'Perfect Solution',
        description: 'Achieve 100% score on any scenario',
        icon: '⭐',
        criteria: 'perfect_score',
        points: 250
      },
      {
        id: 'load-balancer-master',
        name: 'Load Balancer Master',
        description: 'Complete all load balancing scenarios',
        icon: '⚖️',
        criteria: 'complete_load_balancing_scenarios',
        points: 300
      },
      {
        id: 'caching-expert',
        name: 'Caching Expert',
        description: 'Complete all caching optimization scenarios',
        icon: '🚀',
        criteria: 'complete_caching_scenarios',
        points: 300
      },
      {
        id: 'microservices-architect',
        name: 'Microservices Architect',
        description: 'Complete all microservices scenarios',
        icon: '🏗️',
        criteria: 'complete_microservices_scenarios',
        points: 400
      },
      {
        id: 'streak-master',
        name: 'Streak Master',
        description: 'Complete 5 scenarios in a row with passing scores',
        icon: '🔥',
        criteria: 'streak_5',
        points: 200
      },
      {
        id: 'speed-demon',
        name: 'Speed Demon',
        description: 'Complete a scenario in under 10 minutes',
        icon: '⚡',
        criteria: 'fast_completion',
        points: 150
      },
      {
        id: 'perfectionist',
        name: 'Perfectionist',
        description: 'Achieve 90%+ average score across all scenarios',
        icon: '💎',
        criteria: 'high_average',
        points: 500
      }
    ];
  }
  /**
   * Initialize learning path definitions
   */
  private initializeLearningPaths(): void {
    this.learningPaths = [
      {
        id: 'beginner-path',
        name: 'System Design Fundamentals',
        description: 'Learn the basics of system design with simple architectures',
        scenarios: ['basic-web-app', 'load-balanced-system'],
        difficulty: 'beginner',
        estimatedTime: 60
      },
      {
        id: 'performance-path',
        name: 'Performance Optimization',
        description: 'Master techniques for optimizing system performance',
        scenarios: ['caching-optimization', 'load-balanced-system'],
        difficulty: 'intermediate',
        estimatedTime: 90
      },
      {
        id: 'scalability-path',
        name: 'Scalable Architectures',
        description: 'Design systems that can handle massive scale',
        scenarios: ['load-balanced-system', 'microservices-architecture'],
        difficulty: 'advanced',
        estimatedTime: 120
      },
      {
        id: 'microservices-path',
        name: 'Microservices Mastery',
        description: 'Deep dive into microservices architecture patterns',
        scenarios: ['microservices-architecture'],
        difficulty: 'advanced',
        estimatedTime: 90
      }
    ];
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
   * Get detailed progress statistics
   */
  getProgressStats(userId: string, allScenarios: Scenario[]): ProgressStats {
    const progress = this.getUserProgress(userId);
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

    // Calculate streaks (simplified - would need completion history in real implementation)
    const currentStreak = this.calculateCurrentStreak(progress);
    const longestStreak = this.calculateLongestStreak(progress);

    return {
      totalScenarios: totalCount,
      completedScenarios: completedCount,
      averageScore: progress.totalScore,
      totalPoints,
      currentStreak,
      longestStreak,
      timeSpent: completedCount * 30, // Estimated 30 min per scenario
      achievements: unlockedAchievements,
      currentLevel,
      nextLevelProgress
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
   * Calculate current streak (simplified implementation)
   */
  private calculateCurrentStreak(progress: UserProgress): number {
    // In a real implementation, this would check recent completion history
    // For now, return a simple calculation based on total completed
    return Math.min(progress.completedScenarios.length, 5);
  }

  /**
   * Calculate longest streak (simplified implementation)
   */
  private calculateLongestStreak(progress: UserProgress): number {
    // In a real implementation, this would analyze completion history
    // For now, return current streak as longest
    return this.calculateCurrentStreak(progress);
  }

  /**
   * Get achievement by ID
   */
  getAchievement(id: string): Achievement | null {
    return this.achievements.find(a => a.id === id) || null;
  }

  /**
   * Get all achievements
   */
  getAllAchievements(): Achievement[] {
    return this.achievements;
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