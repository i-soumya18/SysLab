import { EvaluationResult } from './guidanceApi';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  points: number;
  unlockedAt?: Date;
}

export interface ProgressStats {
  totalScenarios: number;
  completedScenarios: number;
  averageScore: number;
  totalPoints: number;
  currentStreak: number;
  longestStreak: number;
  timeSpent: number;
  achievements: Achievement[];
  currentLevel: number;
  nextLevelProgress: number;
}

export interface LearningPath {
  id: string;
  name: string;
  description: string;
  scenarios: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: number;
}

export interface UserProgress {
  userId: string;
  completedScenarios: string[];
  currentScenario?: string;
  achievements: string[];
  totalScore: number;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId: string;
  };
}

/**
 * Progress API Service
 * Handles all progress tracking and achievement related API calls
 */
export class ProgressApiService {
  /**
   * Get detailed progress statistics for a user
   */
  async getProgressStats(userId: string): Promise<ProgressStats> {
    try {
      const response = await fetch(`${API_BASE_URL}/progress/${userId}/stats`);
      
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error.message);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error(`Failed to get progress stats for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get recommended scenarios for a user
   */
  async getRecommendations(userId: string): Promise<any[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/progress/${userId}/recommendations`);
      
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error.message);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error(`Failed to get recommendations for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get current learning path for a user
   */
  async getLearningPath(userId: string): Promise<LearningPath | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/progress/${userId}/learning-path`);
      
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error.message);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error(`Failed to get learning path for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Update progress after scenario completion
   */
  async completeScenario(userId: string, scenarioId: string, evaluationResult: EvaluationResult): Promise<UserProgress> {
    try {
      const response = await fetch(`${API_BASE_URL}/progress/${userId}/complete-scenario`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scenarioId,
          evaluationResult
        }),
      });
      
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error.message);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error(`Failed to complete scenario ${scenarioId} for user ${userId}:`, error);
      throw error;
    }
  }
  /**
   * Get all achievements for a user
   */
  async getAchievements(userId: string): Promise<{ unlocked: Achievement[]; total: number; unlockedCount: number }> {
    try {
      const response = await fetch(`${API_BASE_URL}/progress/${userId}/achievements`);
      
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error.message);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error(`Failed to get achievements for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get all available learning paths
   */
  async getAllLearningPaths(): Promise<LearningPath[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/progress/learning-paths`);
      
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error.message);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Failed to get learning paths:', error);
      throw error;
    }
  }

  /**
   * Get leaderboard data
   */
  async getLeaderboard(): Promise<Array<{ userId: string; score: number; completedScenarios: number }>> {
    try {
      const response = await fetch(`${API_BASE_URL}/progress/leaderboard`);
      
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error.message);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Failed to get leaderboard:', error);
      throw error;
    }
  }

  /**
   * Reset user progress (for testing/demo purposes)
   */
  async resetProgress(userId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/progress/${userId}/reset`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error.message);
      }
    } catch (error) {
      console.error(`Failed to reset progress for user ${userId}:`, error);
      throw error;
    }
  }
}

// Singleton instance
export const progressApi = new ProgressApiService();