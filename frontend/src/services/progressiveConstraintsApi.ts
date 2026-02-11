import type { ConstraintEvent, ConstraintSequence } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export interface ConstraintSequenceResponse {
  success: boolean;
  data: ConstraintSequence;
}

export interface ConstraintStartResponse {
  success: boolean;
  data: {
    sessionId: string;
    scenarioId: string;
    adaptedEvents: ConstraintEvent[];
    totalEvents: number;
    message: string;
  };
}

export interface ActiveConstraintsResponse {
  success: boolean;
  data: {
    sessionId: string;
    currentTime: number;
    activeConstraints: ConstraintEvent[];
    count: number;
  };
}

export interface NextConstraintResponse {
  success: boolean;
  data: {
    sessionId: string;
    currentTime: number;
    nextConstraint: ConstraintEvent | null;
    timeUntilNext: number | null;
  };
}

export interface PerformanceRecordResponse {
  success: boolean;
  data: {
    userId: string;
    scenarioId: string;
    message: string;
  };
}

export interface ConstraintStatisticsResponse {
  success: boolean;
  data: {
    scenarioId: string;
    statistics: {
      totalEvents: number;
      averageDifficulty: number;
      adaptiveEvents: number;
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
 * Progressive Constraints API Service
 * Handles all progressive constraint-related API calls
 * Implements SRS FR-9.2 frontend integration
 */
export class ProgressiveConstraintsApiService {
  /**
   * Get constraint sequence for a scenario
   */
  async getConstraintSequence(scenarioId: string): Promise<ConstraintSequence> {
    try {
      const response = await fetch(`${API_BASE_URL}/progressive-constraints/sequence/${scenarioId}`);
      
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error.message);
      }

      const result: ConstraintSequenceResponse = await response.json();
      return result.data;
    } catch (error) {
      console.error(`Failed to fetch constraint sequence for ${scenarioId}:`, error);
      throw error;
    }
  }

  /**
   * Start progressive constraint execution for a scenario session
   */
  async startConstraintSequence(
    sessionId: string, 
    scenarioId: string, 
    userId: string
  ): Promise<ConstraintEvent[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/progressive-constraints/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId, scenarioId, userId }),
      });
      
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error.message);
      }

      const result: ConstraintStartResponse = await response.json();
      return result.data.adaptedEvents;
    } catch (error) {
      console.error(`Failed to start constraint sequence for session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Get constraints that should be active at current time
   */
  async getActiveConstraints(sessionId: string, currentTime: number): Promise<ConstraintEvent[]> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/progressive-constraints/active/${sessionId}?currentTime=${currentTime}`
      );
      
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error.message);
      }

      const result: ActiveConstraintsResponse = await response.json();
      return result.data.activeConstraints;
    } catch (error) {
      console.error(`Failed to fetch active constraints for session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Get next upcoming constraint
   */
  async getNextConstraint(
    sessionId: string, 
    currentTime: number
  ): Promise<{ constraint: ConstraintEvent | null; timeUntilNext: number | null }> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/progressive-constraints/next/${sessionId}?currentTime=${currentTime}`
      );
      
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error.message);
      }

      const result: NextConstraintResponse = await response.json();
      return {
        constraint: result.data.nextConstraint,
        timeUntilNext: result.data.timeUntilNext
      };
    } catch (error) {
      console.error(`Failed to fetch next constraint for session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Record user performance metrics for adaptive difficulty
   */
  async recordUserPerformance(
    userId: string,
    scenarioId: string,
    metrics: {
      currentLatency?: number;
      currentThroughput?: number;
      currentErrorRate?: number;
      timeToResolveIssues?: number;
      correctDecisionsMade?: number;
      totalDecisionOpportunities?: number;
    }
  ): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/progressive-constraints/performance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          scenarioId,
          ...metrics
        }),
      });
      
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error.message);
      }

      // Success - no return value needed
    } catch (error) {
      console.error(`Failed to record performance metrics for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * End constraint sequence and clean up session data
   */
  async endConstraintSequence(sessionId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/progressive-constraints/session/${sessionId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error.message);
      }

      // Success - no return value needed
    } catch (error) {
      console.error(`Failed to end constraint sequence for session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Get constraint statistics for analytics
   */
  async getConstraintStatistics(scenarioId: string): Promise<{
    totalEvents: number;
    averageDifficulty: number;
    adaptiveEvents: number;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/progressive-constraints/statistics/${scenarioId}`);
      
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error.message);
      }

      const result: ConstraintStatisticsResponse = await response.json();
      return result.data.statistics;
    } catch (error) {
      console.error(`Failed to fetch constraint statistics for ${scenarioId}:`, error);
      throw error;
    }
  }
}

// Singleton instance
export const progressiveConstraintsApi = new ProgressiveConstraintsApiService();