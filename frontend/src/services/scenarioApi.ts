import type { Scenario, Workspace } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

export interface ScenarioResponse {
  success: boolean;
  data: Scenario[];
  count: number;
}

export interface SingleScenarioResponse {
  success: boolean;
  data: Scenario;
}

export interface ScenarioLoadResponse {
  success: boolean;
  data: {
    workspace: Workspace;
    scenario: Scenario;
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
 * Scenario API Service
 * Handles all scenario-related API calls
 */
export class ScenarioApiService {
  /**
   * Get all available scenarios
   */
  async getAllScenarios(category?: string): Promise<Scenario[]> {
    try {
      const url = new URL(`${API_BASE_URL}/scenarios`);
      if (category) {
        url.searchParams.append('category', category);
      }

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error.message);
      }

      const result: ScenarioResponse = await response.json();
      return result.data;
    } catch (error) {
      console.error('Failed to fetch scenarios:', error);
      throw error;
    }
  }

  /**
   * Get a specific scenario by ID
   */
  async getScenario(id: string): Promise<Scenario> {
    try {
      const response = await fetch(`${API_BASE_URL}/scenarios/${id}`);
      
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error.message);
      }

      const result: SingleScenarioResponse = await response.json();
      return result.data;
    } catch (error) {
      console.error(`Failed to fetch scenario ${id}:`, error);
      throw error;
    }
  }

  /**
   * Load a scenario and create a workspace from it
   */
  async loadScenario(scenarioId: string, userId: string): Promise<{ workspace: Workspace; scenario: Scenario }> {
    try {
      const response = await fetch(`${API_BASE_URL}/scenarios/${scenarioId}/load`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });
      
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error.message);
      }

      const result: ScenarioLoadResponse = await response.json();
      return result.data;
    } catch (error) {
      console.error(`Failed to load scenario ${scenarioId}:`, error);
      throw error;
    }
  }

  /**
   * Get recommended scenarios for a user
   */
  async getRecommendedScenarios(userId: string): Promise<Scenario[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/scenarios/recommendations/${userId}`);
      
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error.message);
      }

      const result: ScenarioResponse = await response.json();
      return result.data;
    } catch (error) {
      console.error(`Failed to fetch recommendations for user ${userId}:`, error);
      throw error;
    }
  }
}

// Singleton instance
export const scenarioApi = new ScenarioApiService();