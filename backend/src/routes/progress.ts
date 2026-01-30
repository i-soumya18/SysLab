import { Router } from 'express';
import { progressService } from '../services/progressService';
import { scenarioService } from '../services/scenarioService';
import { guidanceService } from '../services/guidanceService';

const router = Router();

/**
 * GET /api/v1/progress/:userId/stats
 * Get detailed progress statistics for a user
 */
router.get('/:userId/stats', async (req, res) => {
  try {
    const { userId } = req.params;
    const allScenarios = scenarioService.getAllScenarios();
    const stats = progressService.getProgressStats(userId, allScenarios);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting progress stats:', error);
    res.status(500).json({
      error: {
        code: 'PROGRESS_STATS_ERROR',
        message: 'Failed to get progress statistics',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * GET /api/v1/progress/:userId/recommendations
 * Get recommended scenarios for a user
 */
router.get('/:userId/recommendations', async (req, res) => {
  try {
    const { userId } = req.params;
    const allScenarios = scenarioService.getAllScenarios();
    const recommendations = progressService.getRecommendedScenarios(userId, allScenarios);

    res.json({
      success: true,
      data: recommendations
    });
  } catch (error) {
    console.error('Error getting recommendations:', error);
    res.status(500).json({
      error: {
        code: 'RECOMMENDATIONS_ERROR',
        message: 'Failed to get recommendations',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * GET /api/v1/progress/:userId/learning-path
 * Get current learning path for a user
 */
router.get('/:userId/learning-path', async (req, res) => {
  try {
    const { userId } = req.params;
    const userProgress = progressService.getUserProgress(userId);
    const learningPath = progressService.getCurrentLearningPath(userProgress);

    res.json({
      success: true,
      data: learningPath
    });
  } catch (error) {
    console.error('Error getting learning path:', error);
    res.status(500).json({
      error: {
        code: 'LEARNING_PATH_ERROR',
        message: 'Failed to get learning path',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * POST /api/v1/progress/:userId/complete-scenario
 * Update progress after scenario completion
 */
router.post('/:userId/complete-scenario', async (req, res) => {
  try {
    const { userId } = req.params;
    const { scenarioId, evaluationResult } = req.body;

    if (!scenarioId || !evaluationResult) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing required fields: scenarioId and evaluationResult',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    const updatedProgress = progressService.updateProgress(userId, scenarioId, evaluationResult);

    return res.json({
      success: true,
      data: updatedProgress
    });
  } catch (error) {
    console.error('Error updating progress:', error);
    return res.status(500).json({
      error: {
        code: 'PROGRESS_UPDATE_ERROR',
        message: 'Failed to update progress',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});
/**
 * GET /api/v1/progress/:userId/achievements
 * Get all achievements for a user
 */
router.get('/:userId/achievements', async (req, res) => {
  try {
    const { userId } = req.params;
    const userProgress = progressService.getUserProgress(userId);
    const allAchievements = progressService.getAllAchievements();
    
    const userAchievements = allAchievements.filter(achievement => 
      userProgress.achievements.includes(achievement.id)
    );

    res.json({
      success: true,
      data: {
        unlocked: userAchievements,
        total: allAchievements.length,
        unlockedCount: userAchievements.length
      }
    });
  } catch (error) {
    console.error('Error getting achievements:', error);
    res.status(500).json({
      error: {
        code: 'ACHIEVEMENTS_ERROR',
        message: 'Failed to get achievements',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * GET /api/v1/progress/learning-paths
 * Get all available learning paths
 */
router.get('/learning-paths', async (req, res) => {
  try {
    const learningPaths = progressService.getAllLearningPaths();

    res.json({
      success: true,
      data: learningPaths
    });
  } catch (error) {
    console.error('Error getting learning paths:', error);
    res.status(500).json({
      error: {
        code: 'LEARNING_PATHS_ERROR',
        message: 'Failed to get learning paths',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * GET /api/v1/progress/leaderboard
 * Get leaderboard data
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const leaderboard = progressService.getLeaderboard();

    res.json({
      success: true,
      data: leaderboard
    });
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    res.status(500).json({
      error: {
        code: 'LEADERBOARD_ERROR',
        message: 'Failed to get leaderboard',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * DELETE /api/v1/progress/:userId/reset
 * Reset user progress (for testing/demo purposes)
 */
router.delete('/:userId/reset', async (req, res) => {
  try {
    const { userId } = req.params;
    progressService.resetProgress(userId);

    res.json({
      success: true,
      message: 'Progress reset successfully'
    });
  } catch (error) {
    console.error('Error resetting progress:', error);
    res.status(500).json({
      error: {
        code: 'PROGRESS_RESET_ERROR',
        message: 'Failed to reset progress',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

export default router;