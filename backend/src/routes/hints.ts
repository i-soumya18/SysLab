import { Router } from 'express';
import { hintExplanationService } from '../services/hintExplanationService';
import { ErrorResponse } from '../types';

const router = Router();

/**
 * POST /api/v1/hints/contextual
 * Get contextual hints based on current scenario state
 * Implements SRS FR-9.3 contextual hint delivery
 */
router.post('/contextual', (req, res) => {
  try {
    const {
      userId,
      scenarioId,
      currentTime,
      userPerformance,
      recentActions,
      componentsAdded,
      connectionsCreated,
      errorsEncountered,
      timeStuckOnCurrentStep
    } = req.body;

    if (!userId || !scenarioId) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'userId and scenarioId are required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown'
        }
      };
      return res.status(400).json(errorResponse);
    }

    const context = {
      userId,
      scenarioId,
      currentTime: currentTime || 0,
      userPerformance: userPerformance || { latency: 0, throughput: 0, errorRate: 0 },
      recentActions: recentActions || [],
      componentsAdded: componentsAdded || [],
      connectionsCreated: connectionsCreated || 0,
      errorsEncountered: errorsEncountered || [],
      timeStuckOnCurrentStep: timeStuckOnCurrentStep || 0
    };

    const hints = hintExplanationService.getContextualHints(context);

    return res.json({
      success: true,
      data: {
        hints,
        count: hints.length,
        context: {
          userId,
          scenarioId,
          currentTime: context.currentTime
        }
      }
    });
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'CONTEXTUAL_HINTS_ERROR',
        message: 'Failed to get contextual hints',
        details: error,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };
    return res.status(500).json(errorResponse);
  }
});

/**
 * POST /api/v1/hints/progressive
 * Get progressive hints based on user progress
 * Implements SRS FR-9.3 progressive disclosure of complexity
 */
router.post('/progressive', (req, res) => {
  try {
    const {
      userId,
      scenarioId,
      currentTime,
      currentDifficulty,
      userPerformance,
      recentActions,
      componentsAdded,
      connectionsCreated,
      errorsEncountered,
      timeStuckOnCurrentStep
    } = req.body;

    if (!userId || !scenarioId || !currentDifficulty) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'userId, scenarioId, and currentDifficulty are required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown'
        }
      };
      return res.status(400).json(errorResponse);
    }

    const validDifficulties = ['beginner', 'intermediate', 'advanced'];
    if (!validDifficulties.includes(currentDifficulty)) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'INVALID_DIFFICULTY',
          message: `currentDifficulty must be one of: ${validDifficulties.join(', ')}`,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown'
        }
      };
      return res.status(400).json(errorResponse);
    }

    const context = {
      userId,
      scenarioId,
      currentTime: currentTime || 0,
      userPerformance: userPerformance || { latency: 0, throughput: 0, errorRate: 0 },
      recentActions: recentActions || [],
      componentsAdded: componentsAdded || [],
      connectionsCreated: connectionsCreated || 0,
      errorsEncountered: errorsEncountered || [],
      timeStuckOnCurrentStep: timeStuckOnCurrentStep || 0
    };

    const hints = hintExplanationService.getProgressiveHints(context, currentDifficulty);

    return res.json({
      success: true,
      data: {
        hints,
        count: hints.length,
        currentDifficulty,
        context: {
          userId,
          scenarioId,
          currentTime: context.currentTime
        }
      }
    });
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'PROGRESSIVE_HINTS_ERROR',
        message: 'Failed to get progressive hints',
        details: error,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };
    return res.status(500).json(errorResponse);
  }
});

/**
 * POST /api/v1/hints/remedial
 * Get remedial hints when user is struggling
 * Implements SRS FR-9.3 contextual hint delivery for struggling users
 */
router.post('/remedial', (req, res) => {
  try {
    const {
      userId,
      scenarioId,
      currentTime,
      userPerformance,
      recentActions,
      componentsAdded,
      connectionsCreated,
      errorsEncountered,
      timeStuckOnCurrentStep
    } = req.body;

    if (!userId || !scenarioId) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'userId and scenarioId are required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown'
        }
      };
      return res.status(400).json(errorResponse);
    }

    const context = {
      userId,
      scenarioId,
      currentTime: currentTime || 0,
      userPerformance: userPerformance || { latency: 0, throughput: 0, errorRate: 0 },
      recentActions: recentActions || [],
      componentsAdded: componentsAdded || [],
      connectionsCreated: connectionsCreated || 0,
      errorsEncountered: errorsEncountered || [],
      timeStuckOnCurrentStep: timeStuckOnCurrentStep || 0
    };

    const hints = hintExplanationService.getRemedialHints(context);

    return res.json({
      success: true,
      data: {
        hints,
        count: hints.length,
        context: {
          userId,
          scenarioId,
          currentTime: context.currentTime
        }
      }
    });
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'REMEDIAL_HINTS_ERROR',
        message: 'Failed to get remedial hints',
        details: error,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };
    return res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/v1/hints/explanation/:concept
 * Get explanation content for a concept
 * Implements SRS FR-9.3 explanation and learning content
 */
router.get('/explanation/:concept', (req, res) => {
  try {
    const { concept } = req.params;
    const { level } = req.query;

    const validLevels = ['basic', 'intermediate', 'advanced', 'expert'];
    if (level && !validLevels.includes(level as string)) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'INVALID_LEVEL',
          message: `level must be one of: ${validLevels.join(', ')}`,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown'
        }
      };
      return res.status(400).json(errorResponse);
    }

    const explanation = hintExplanationService.getExplanation(
      concept, 
      level as 'basic' | 'intermediate' | 'advanced' | 'expert'
    );

    if (!explanation) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'EXPLANATION_NOT_FOUND',
          message: `No explanation found for concept '${concept}'`,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown'
        }
      };
      return res.status(404).json(errorResponse);
    }

    return res.json({
      success: true,
      data: {
        explanation,
        concept,
        level: level || explanation.level
      }
    });
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'EXPLANATION_ERROR',
        message: 'Failed to get explanation',
        details: error,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };
    return res.status(500).json(errorResponse);
  }
});

/**
 * POST /api/v1/hints/record/shown
 * Record that a hint was shown to a user
 */
router.post('/record/shown', (req, res) => {
  try {
    const { userId, scenarioId, hintId } = req.body;

    if (!userId || !scenarioId || !hintId) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'userId, scenarioId, and hintId are required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown'
        }
      };
      return res.status(400).json(errorResponse);
    }

    hintExplanationService.recordHintShown(userId, scenarioId, hintId);

    return res.json({
      success: true,
      data: {
        userId,
        scenarioId,
        hintId,
        message: 'Hint shown recorded successfully'
      }
    });
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'RECORD_HINT_ERROR',
        message: 'Failed to record hint shown',
        details: error,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };
    return res.status(500).json(errorResponse);
  }
});

/**
 * POST /api/v1/hints/record/requested
 * Record that a user requested a hint
 */
router.post('/record/requested', (req, res) => {
  try {
    const { userId, scenarioId, hintId } = req.body;

    if (!userId || !scenarioId || !hintId) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'userId, scenarioId, and hintId are required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown'
        }
      };
      return res.status(400).json(errorResponse);
    }

    hintExplanationService.recordHintRequested(userId, scenarioId, hintId);

    return res.json({
      success: true,
      data: {
        userId,
        scenarioId,
        hintId,
        message: 'Hint request recorded successfully'
      }
    });
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'RECORD_HINT_REQUEST_ERROR',
        message: 'Failed to record hint request',
        details: error,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };
    return res.status(500).json(errorResponse);
  }
});

/**
 * POST /api/v1/hints/record/skipped
 * Record that a user skipped a hint
 */
router.post('/record/skipped', (req, res) => {
  try {
    const { userId, scenarioId, hintId } = req.body;

    if (!userId || !scenarioId || !hintId) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'userId, scenarioId, and hintId are required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown'
        }
      };
      return res.status(400).json(errorResponse);
    }

    hintExplanationService.recordHintSkipped(userId, scenarioId, hintId);

    return res.json({
      success: true,
      data: {
        userId,
        scenarioId,
        hintId,
        message: 'Hint skip recorded successfully'
      }
    });
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'RECORD_HINT_SKIP_ERROR',
        message: 'Failed to record hint skip',
        details: error,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };
    return res.status(500).json(errorResponse);
  }
});

/**
 * POST /api/v1/hints/record/explanation-viewed
 * Record that a user viewed an explanation
 */
router.post('/record/explanation-viewed', (req, res) => {
  try {
    const { userId, scenarioId, concept } = req.body;

    if (!userId || !scenarioId || !concept) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'userId, scenarioId, and concept are required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown'
        }
      };
      return res.status(400).json(errorResponse);
    }

    hintExplanationService.recordExplanationViewed(userId, scenarioId, concept);

    return res.json({
      success: true,
      data: {
        userId,
        scenarioId,
        concept,
        message: 'Explanation view recorded successfully'
      }
    });
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'RECORD_EXPLANATION_VIEW_ERROR',
        message: 'Failed to record explanation view',
        details: error,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };
    return res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/v1/hints/statistics/:scenarioId
 * Get hint statistics for analytics
 */
router.get('/statistics/:scenarioId', (req, res) => {
  try {
    const { scenarioId } = req.params;
    const statistics = hintExplanationService.getHintStatistics(scenarioId);

    return res.json({
      success: true,
      data: {
        scenarioId,
        statistics
      }
    });
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'HINT_STATISTICS_ERROR',
        message: 'Failed to get hint statistics',
        details: error,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };
    return res.status(500).json(errorResponse);
  }
});

export default router;