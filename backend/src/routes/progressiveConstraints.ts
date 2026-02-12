import { Router } from 'express';
import { progressiveConstraintService } from '../services/progressiveConstraintService';
import { ErrorResponse } from '../types';

const router = Router();

/**
 * GET /api/v1/progressive-constraints/sequence/:scenarioId
 * Get constraint sequence for a scenario
 * Implements SRS FR-9.2 constraint timing and sequencing
 */
router.get('/sequence/:scenarioId', (req, res) => {
  try {
    const { scenarioId } = req.params;
    const sequence = progressiveConstraintService.getConstraintSequence(scenarioId);
    
    if (!sequence) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'CONSTRAINT_SEQUENCE_NOT_FOUND',
          message: `No constraint sequence found for scenario '${scenarioId}'`,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown'
        }
      };
      return res.status(404).json(errorResponse);
    }

    return res.json({
      success: true,
      data: sequence
    });
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'CONSTRAINT_SEQUENCE_ERROR',
        message: 'Failed to fetch constraint sequence',
        details: error,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };
    return res.status(500).json(errorResponse);
  }
});

/**
 * POST /api/v1/progressive-constraints/start
 * Start progressive constraint execution for a scenario session
 * Implements SRS FR-9.2 progressive constraint introduction
 */
router.post('/start', (req, res) => {
  try {
    const { sessionId, scenarioId, userId } = req.body;

    if (!sessionId || !scenarioId || !userId) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'sessionId, scenarioId, and userId are required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown'
        }
      };
      return res.status(400).json(errorResponse);
    }

    const adaptedEvents = progressiveConstraintService.startConstraintSequence(
      sessionId, 
      scenarioId, 
      userId
    );

    return res.json({
      success: true,
      data: {
        sessionId,
        scenarioId,
        adaptedEvents,
        totalEvents: adaptedEvents.length,
        message: 'Progressive constraint sequence started'
      }
    });
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'CONSTRAINT_START_ERROR',
        message: 'Failed to start constraint sequence',
        details: error,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };
    return res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/v1/progressive-constraints/active/:sessionId
 * Get constraints that should be active at current time
 * Implements SRS FR-9.2 constraint timing
 */
router.get('/active/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const { currentTime } = req.query;

    if (!currentTime) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'MISSING_CURRENT_TIME',
          message: 'currentTime query parameter is required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown'
        }
      };
      return res.status(400).json(errorResponse);
    }

    const activeConstraints = progressiveConstraintService.getActiveConstraints(
      sessionId, 
      parseInt(currentTime as string)
    );

    return res.json({
      success: true,
      data: {
        sessionId,
        currentTime: parseInt(currentTime as string),
        activeConstraints,
        count: activeConstraints.length
      }
    });
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'ACTIVE_CONSTRAINTS_ERROR',
        message: 'Failed to fetch active constraints',
        details: error,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };
    return res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/v1/progressive-constraints/next/:sessionId
 * Get next upcoming constraint
 * Implements SRS FR-9.2 constraint sequencing
 */
router.get('/next/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const { currentTime } = req.query;

    if (!currentTime) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'MISSING_CURRENT_TIME',
          message: 'currentTime query parameter is required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown'
        }
      };
      return res.status(400).json(errorResponse);
    }

    const nextConstraint = progressiveConstraintService.getNextConstraint(
      sessionId, 
      parseInt(currentTime as string)
    );

    return res.json({
      success: true,
      data: {
        sessionId,
        currentTime: parseInt(currentTime as string),
        nextConstraint,
        timeUntilNext: nextConstraint 
          ? nextConstraint.triggerTime - parseInt(currentTime as string)
          : null
      }
    });
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'NEXT_CONSTRAINT_ERROR',
        message: 'Failed to fetch next constraint',
        details: error,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };
    return res.status(500).json(errorResponse);
  }
});

/**
 * POST /api/v1/progressive-constraints/performance
 * Record user performance metrics for adaptive difficulty
 * Implements SRS FR-9.2 adaptive difficulty adjustment
 */
router.post('/performance', (req, res) => {
  try {
    const { 
      userId, 
      scenarioId, 
      currentLatency, 
      currentThroughput, 
      currentErrorRate,
      timeToResolveIssues,
      correctDecisionsMade,
      totalDecisionOpportunities
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

    progressiveConstraintService.recordUserPerformance(userId, scenarioId, {
      currentLatency: currentLatency || 0,
      currentThroughput: currentThroughput || 0,
      currentErrorRate: currentErrorRate || 0,
      timeToResolveIssues: timeToResolveIssues || 0,
      correctDecisionsMade: correctDecisionsMade || 0,
      totalDecisionOpportunities: totalDecisionOpportunities || 0
    });

    return res.json({
      success: true,
      data: {
        userId,
        scenarioId,
        message: 'Performance metrics recorded successfully'
      }
    });
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'PERFORMANCE_RECORD_ERROR',
        message: 'Failed to record performance metrics',
        details: error,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };
    return res.status(500).json(errorResponse);
  }
});

/**
 * DELETE /api/v1/progressive-constraints/session/:sessionId
 * End constraint sequence and clean up session data
 */
router.delete('/session/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    
    progressiveConstraintService.endConstraintSequence(sessionId);

    return res.json({
      success: true,
      data: {
        sessionId,
        message: 'Constraint sequence ended and session cleaned up'
      }
    });
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'SESSION_CLEANUP_ERROR',
        message: 'Failed to clean up constraint session',
        details: error,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };
    return res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/v1/progressive-constraints/statistics/:scenarioId
 * Get constraint statistics for analytics
 */
router.get('/statistics/:scenarioId', (req, res) => {
  try {
    const { scenarioId } = req.params;
    const statistics = progressiveConstraintService.getConstraintStatistics(scenarioId);

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
        code: 'STATISTICS_ERROR',
        message: 'Failed to fetch constraint statistics',
        details: error,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };
    return res.status(500).json(errorResponse);
  }
});

export default router;