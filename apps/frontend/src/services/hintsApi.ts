import type { Hint, ExplanationContent, HintContext } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

export interface HintsResponse {
  success: boolean;
  data: {
    hints: Hint[];
    count: number;
    context: {
      userId: string;
      scenarioId: string;
      currentTime: number;
    };
    currentDifficulty?: string;
  };
}

export interface ExplanationResponse {
  success: boolean;
  data: {
    explanation: ExplanationContent;
    concept: string;
    level: string;
  };
}

export interface RecordResponse {
  success: boolean;
  data: {
    userId: string;
    scenarioId: string;
    hintId?: string;
    concept?: string;
    message: string;
  };
}

export interface HintStatisticsResponse {
  success: boolean;
  data: {
    scenarioId: string;
    statistics: {
      totalHints: number;
      hintsByType: { [type: string]: number };
      hintsByDifficulty: { [difficulty: string]: number };
    };
  };
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
 * Hints API Service
 * Handles all hint and explanation-related API calls
 * Implements SRS FR-9.3 frontend integration
 */
export class HintsApiService {
  /**
   * Get contextual hints based on current scenario state
   */
  async getContextualHints(context: HintContext): Promise<Hint[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/hints/contextual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(context),
      });
      
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error.message);
      }

      const result: HintsResponse = await response.json();
      return result.data.hints;
    } catch (error) {
      console.error('Failed to fetch contextual hints:', error);
      throw error;
    }
  }

  /**
   * Get progressive hints based on user progress
   */
  async getProgressiveHints(
    context: HintContext, 
    currentDifficulty: 'beginner' | 'intermediate' | 'advanced'
  ): Promise<Hint[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/hints/progressive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...context,
          currentDifficulty
        }),
      });
      
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error.message);
      }

      const result: HintsResponse = await response.json();
      return result.data.hints;
    } catch (error) {
      console.error('Failed to fetch progressive hints:', error);
      throw error;
    }
  }

  /**
   * Get remedial hints when user is struggling
   */
  async getRemedialHints(context: HintContext): Promise<Hint[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/hints/remedial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(context),
      });
      
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error.message);
      }

      const result: HintsResponse = await response.json();
      return result.data.hints;
    } catch (error) {
      console.error('Failed to fetch remedial hints:', error);
      throw error;
    }
  }

  /**
   * Get explanation content for a concept
   */
  async getExplanation(
    concept: string, 
    level?: 'basic' | 'intermediate' | 'advanced' | 'expert'
  ): Promise<ExplanationContent> {
    try {
      const url = new URL(`${API_BASE_URL}/hints/explanation/${concept}`);
      if (level) {
        url.searchParams.append('level', level);
      }

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error.message);
      }

      const result: ExplanationResponse = await response.json();
      return result.data.explanation;
    } catch (error) {
      console.error(`Failed to fetch explanation for ${concept}:`, error);
      throw error;
    }
  }

  /**
   * Record that a hint was shown to a user
   */
  async recordHintShown(userId: string, scenarioId: string, hintId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/hints/record/shown`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, scenarioId, hintId }),
      });
      
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error.message);
      }

      // Success - no return value needed
    } catch (error) {
      console.error('Failed to record hint shown:', error);
      throw error;
    }
  }

  /**
   * Record that a user requested a hint
   */
  async recordHintRequested(userId: string, scenarioId: string, hintId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/hints/record/requested`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, scenarioId, hintId }),
      });
      
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error.message);
      }

      // Success - no return value needed
    } catch (error) {
      console.error('Failed to record hint requested:', error);
      throw error;
    }
  }

  /**
   * Record that a user skipped a hint
   */
  async recordHintSkipped(userId: string, scenarioId: string, hintId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/hints/record/skipped`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, scenarioId, hintId }),
      });
      
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error.message);
      }

      // Success - no return value needed
    } catch (error) {
      console.error('Failed to record hint skipped:', error);
      throw error;
    }
  }

  /**
   * Record that a user viewed an explanation
   */
  async recordExplanationViewed(userId: string, scenarioId: string, concept: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/hints/record/explanation-viewed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, scenarioId, concept }),
      });
      
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error.message);
      }

      // Success - no return value needed
    } catch (error) {
      console.error('Failed to record explanation viewed:', error);
      throw error;
    }
  }

  /**
   * Get hint statistics for analytics
   */
  async getHintStatistics(scenarioId: string): Promise<{
    totalHints: number;
    hintsByType: { [type: string]: number };
    hintsByDifficulty: { [difficulty: string]: number };
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/hints/statistics/${scenarioId}`);
      
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error.message);
      }

      const result: HintStatisticsResponse = await response.json();
      return result.data.statistics;
    } catch (error) {
      console.error(`Failed to fetch hint statistics for ${scenarioId}:`, error);
      throw error;
    }
  }
}

// Singleton instance
export const hintsApi = new HintsApiService();