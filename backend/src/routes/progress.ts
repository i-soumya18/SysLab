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
 * Update progress after scenario completion with enhanced tracking
 * Implements SRS FR-9.4 scenario completion tracking
 */
router.post('/:userId/complete-scenario', async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      scenarioId, 
      evaluationResult, 
      timeSpent, 
      hintsUsed, 
      attemptsCount, 
      learningObjectivesMet 
    } = req.body;

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

    // Record detailed completion
    const completion = progressService.recordScenarioCompletion(
      userId,
      scenarioId,
      evaluationResult,
      timeSpent || 0,
      hintsUsed || 0,
      attemptsCount || 1,
      learningObjectivesMet || []
    );

    return res.json({
      success: true,
      data: {
        completion,
        message: 'Scenario completion recorded successfully'
      }
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

/**
 * GET /api/v1/progress/:userId/completions
 * Get scenario completion history
 * Implements SRS FR-9.4 scenario completion tracking
 */
router.get('/:userId/completions', async (req, res) => {
  try {
    const { userId } = req.params;
    const { scenarioId } = req.query;
    
    const completions = progressService.getScenarioCompletions(
      userId, 
      scenarioId as string
    );

    res.json({
      success: true,
      data: {
        completions,
        count: completions.length,
        userId,
        scenarioId: scenarioId || null
      }
    });
  } catch (error) {
    console.error('Error getting completions:', error);
    res.status(500).json({
      error: {
        code: 'COMPLETIONS_ERROR',
        message: 'Failed to get scenario completions',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * GET /api/v1/progress/:userId/analytics
 * Get learning analytics for a user
 * Implements SRS FR-9.4 learning progress analytics
 */
router.get('/:userId/analytics', async (req, res) => {
  try {
    const { userId } = req.params;
    const analytics = progressService.getLearningAnalytics(userId);

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({
      error: {
        code: 'ANALYTICS_ERROR',
        message: 'Failed to get learning analytics',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * GET /api/v1/progress/:userId/summary
 * Get user learning summary
 * Implements SRS FR-9.4 learning progress analytics
 */
router.get('/:userId/summary', async (req, res) => {
  try {
    const { userId } = req.params;
    const summary = progressService.getUserLearningSummary(userId);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error getting summary:', error);
    res.status(500).json({
      error: {
        code: 'SUMMARY_ERROR',
        message: 'Failed to get learning summary',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * GET /api/v1/progress/:userId/milestones
 * Get user milestone progress
 * Implements SRS FR-9.4 milestone system
 */
router.get('/:userId/milestones', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const achievedMilestones = progressService.getAchievedMilestones(userId);
    const nextMilestone = progressService.getNextMilestone(userId);
    const allMilestones = progressService.getAllMilestones();
    
    // Get progress for all milestones
    const milestoneProgress = allMilestones.map(milestone => ({
      milestone,
      progress: progressService.getMilestoneProgress(userId, milestone.id),
      achieved: achievedMilestones.some(m => m.id === milestone.id)
    }));

    res.json({
      success: true,
      data: {
        achievedMilestones,
        nextMilestone,
        milestoneProgress,
        totalMilestones: allMilestones.length,
        achievedCount: achievedMilestones.length
      }
    });
  } catch (error) {
    console.error('Error getting milestones:', error);
    res.status(500).json({
      error: {
        code: 'MILESTONES_ERROR',
        message: 'Failed to get user milestones',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * GET /api/v1/progress/milestones
 * Get all available milestones
 * Implements SRS FR-9.4 milestone system
 */
router.get('/milestones', async (req, res) => {
  try {
    const milestones = progressService.getAllMilestones();

    res.json({
      success: true,
      data: {
        milestones,
        count: milestones.length
      }
    });
  } catch (error) {
    console.error('Error getting milestones:', error);
    res.status(500).json({
      error: {
        code: 'MILESTONES_FETCH_ERROR',
        message: 'Failed to get milestones',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * GET /api/v1/progress/achievements/categories
 * Get achievements by category
 * Implements SRS FR-9.4 achievement system
 */
router.get('/achievements/categories/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const achievements = progressService.getAchievementsByCategory(category as any);

    res.json({
      success: true,
      data: {
        achievements,
        count: achievements.length,
        category
      }
    });
  } catch (error) {
    console.error('Error getting achievements by category:', error);
    res.status(500).json({
      error: {
        code: 'ACHIEVEMENTS_CATEGORY_ERROR',
        message: 'Failed to get achievements by category',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

export default router;