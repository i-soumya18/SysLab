import { Router } from 'express';
import { guidanceService } from '../services/guidanceService';
import { scenarioService } from '../services/scenarioService';
import { ErrorResponse } from '../types';

const router = Router();

/**
 * POST /api/v1/guidance/hints
 * Get contextual hints for a workspace and scenario
 */
router.post('/hints', (req, res) => {
  try {
    const { workspace, scenarioId } = req.body;

    if (!workspace || !scenarioId) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Workspace and scenarioId are required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown'
        }
      };
      return res.status(400).json(errorResponse);
    }

    const scenario = scenarioService.getScenario(scenarioId);
    if (!scenario) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'SCENARIO_NOT_FOUND',
          message: `Scenario with ID '${scenarioId}' not found`,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown'
        }
      };
      return res.status(404).json(errorResponse);
    }

    const hints = guidanceService.generateHints(workspace, scenario);

    return res.json({
      success: true,
      data: {
        hints,
        scenarioId,
        workspaceId: workspace.id
      }
    });
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'HINTS_GENERATION_ERROR',
        message: 'Failed to generate hints',
        details: error,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };
    return res.status(500).json(errorResponse);
  }
});

/**
 * POST /api/v1/guidance/evaluate
 * Evaluate a workspace against scenario criteria
 */
router.post('/evaluate', (req, res) => {
  try {
    const { workspace, scenarioId } = req.body;

    if (!workspace || !scenarioId) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Workspace and scenarioId are required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown'
        }
      };
      return res.status(400).json(errorResponse);
    }

    const scenario = scenarioService.getScenario(scenarioId);
    if (!scenario) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'SCENARIO_NOT_FOUND',
          message: `Scenario with ID '${scenarioId}' not found`,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown'
        }
      };
      return res.status(404).json(errorResponse);
    }

    const evaluation = guidanceService.evaluateWorkspace(workspace, scenario);

    return res.json({
      success: true,
      data: evaluation
    });
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'EVALUATION_ERROR',
        message: 'Failed to evaluate workspace',
        details: error,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };
    return res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/v1/guidance/scenario/:scenarioId/objectives
 * Get scenario objectives and hints
 */
router.get('/scenario/:scenarioId/objectives', (req, res) => {
  try {
    const { scenarioId } = req.params;

    const scenario = scenarioService.getScenario(scenarioId);
    if (!scenario) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'SCENARIO_NOT_FOUND',
          message: `Scenario with ID '${scenarioId}' not found`,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown'
        }
      };
      return res.status(404).json(errorResponse);
    }

    return res.json({
      success: true,
      data: {
        scenarioId,
        name: scenario.name,
        description: scenario.description,
        objectives: scenario.objectives,
        hints: scenario.hints,
        evaluationCriteria: scenario.evaluationCriteria
      }
    });
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'OBJECTIVES_FETCH_ERROR',
        message: 'Failed to fetch scenario objectives',
        details: error,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };
    return res.status(500).json(errorResponse);
  }
});

export default router;