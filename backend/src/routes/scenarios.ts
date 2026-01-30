import { Router } from 'express';
import { scenarioService } from '../services/scenarioService';
import { ErrorResponse } from '../types';

const router = Router();

/**
 * GET /api/v1/scenarios
 * Get all available learning scenarios
 */
router.get('/', (req, res) => {
  try {
    const { category } = req.query;
    const scenarios = scenarioService.getScenariosByCategory(category as string);
    
    res.json({
      success: true,
      data: scenarios,
      count: scenarios.length
    });
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'SCENARIOS_FETCH_ERROR',
        message: 'Failed to fetch scenarios',
        details: error,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };
    res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/v1/scenarios/:id
 * Get a specific scenario by ID
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const scenario = scenarioService.getScenario(id);
    
    if (!scenario) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'SCENARIO_NOT_FOUND',
          message: `Scenario with ID '${id}' not found`,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown'
        }
      };
      return res.status(404).json(errorResponse);
    }

    return res.json({
      success: true,
      data: scenario
    });
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'SCENARIO_FETCH_ERROR',
        message: 'Failed to fetch scenario',
        details: error,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };
    return res.status(500).json(errorResponse);
  }
});

/**
 * POST /api/v1/scenarios/:id/load
 * Load a scenario and create a workspace from it
 */
router.post('/:id/load', (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'MISSING_USER_ID',
          message: 'User ID is required to load a scenario',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown'
        }
      };
      return res.status(400).json(errorResponse);
    }

    if (!scenarioService.scenarioExists(id)) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'SCENARIO_NOT_FOUND',
          message: `Scenario with ID '${id}' not found`,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown'
        }
      };
      return res.status(404).json(errorResponse);
    }

    const workspace = scenarioService.loadScenario(id, userId);
    
    if (!workspace) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'SCENARIO_LOAD_ERROR',
          message: 'Failed to load scenario workspace',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown'
        }
      };
      return res.status(500).json(errorResponse);
    }

    return res.json({
      success: true,
      data: {
        workspace,
        scenario: scenarioService.getScenario(id)
      }
    });
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'SCENARIO_LOAD_ERROR',
        message: 'Failed to load scenario',
        details: error,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };
    return res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/v1/scenarios/recommendations/:userId
 * Get recommended scenarios for a user based on their progress
 */
router.get('/recommendations/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    
    // For now, return basic recommendations
    // In a full implementation, this would fetch user progress from database
    const mockUserProgress = {
      userId,
      completedScenarios: [],
      achievements: [],
      totalScore: 0
    };

    const recommendations = scenarioService.getRecommendedScenarios(mockUserProgress);
    
    res.json({
      success: true,
      data: recommendations,
      count: recommendations.length
    });
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'RECOMMENDATIONS_ERROR',
        message: 'Failed to get scenario recommendations',
        details: error,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };
    res.status(500).json(errorResponse);
  }
});

export default router;