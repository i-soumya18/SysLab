import { Workspace } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export interface GuidanceHint {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
  actionable: boolean;
  suggestedAction?: string;
  priority: number;
}

export interface EvaluationResult {
  scenarioId: string;
  workspaceId: string;
  score: number;
  passed: boolean;
  completedCriteria: string[];
  failedCriteria: string[];
  feedback: string[];
  recommendations: string[];
  hints: GuidanceHint[];
}

export interface ScenarioObjectives {
  scenarioId: string;
  name: string;
  description: string;
  objectives: string[];
  hints: string[];
  evaluationCriteria: string[];
}

export interface HintsResponse {
  success: boolean;
  data: {
    hints: GuidanceHint[];
    scenarioId: string;
    workspaceId: string;
  };
}

export interface EvaluationResponse {
  success: boolean;
  data: EvaluationResult;
}

export interface ObjectivesResponse {
  success: boolean;
  data: ScenarioObjectives;
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
 * Guidance API Service
 * Handles all guidance and evaluation related API calls
 */
export class GuidanceApiService {
  /**
   * Get contextual hints for a workspace and scenario
   */
  async getHints(workspace: Workspace, scenarioId: string): Promise<GuidanceHint[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/guidance/hints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspace,
          scenarioId
        }),
      });

      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error.message);
      }

      const result: HintsResponse = await response.json();
      return result.data.hints;
    } catch (error) {
      console.error('Failed to get hints:', error);
      throw error;
    }
  }

  /**
   * Evaluate workspace against scenario criteria
   */
  async evaluateWorkspace(workspace: Workspace, scenarioId: string): Promise<EvaluationResult> {
    try {
      const response = await fetch(`${API_BASE_URL}/guidance/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspace,
          scenarioId
        }),
      });

      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error.message);
      }

      const result: EvaluationResponse = await response.json();
      return result.data;
    } catch (error) {
      console.error('Failed to evaluate workspace:', error);
      throw error;
    }
  }

  /**
   * Get scenario objectives and hints
   */
  async getScenarioObjectives(scenarioId: string): Promise<ScenarioObjectives> {
    try {
      const response = await fetch(`${API_BASE_URL}/guidance/scenario/${scenarioId}/objectives`);

      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error.message);
      }

      const result: ObjectivesResponse = await response.json();
      return result.data;
    } catch (error) {
      console.error(`Failed to get objectives for scenario ${scenarioId}:`, error);
      throw error;
    }
  }
}

// Singleton instance
export const guidanceApi = new GuidanceApiService();