/**
 * Subscription API Routes
 * Implements SRS FR-1.4: Subscription tier system with billing integration
 */

import express, { Request, Response } from 'express';
import { SubscriptionService } from '../services/subscriptionService';
import { authenticateToken as authMiddleware } from '../middleware/auth';
import { subscriptionMiddleware } from '../middleware/subscriptionMiddleware';
import { 
  SubscriptionTier, 
  SubscriptionUpgradeRequest, 
  SubscriptionDowngradeRequest,
  SubscriptionFeatures
} from '../types/subscription';

const router = express.Router();
const subscriptionService = new SubscriptionService();

/**
 * GET /api/subscription/plans
 * Get all available subscription plans
 * Public endpoint - no authentication required
 */
router.get('/plans', async (req: Request, res: Response) => {
  try {
    const plans = subscriptionService.getSubscriptionPlans();
    
    res.json({
      success: true,
      data: {
        plans
      }
    });
  } catch (error) {
    console.error('Error getting subscription plans:', error);
    res.status(500).json({
      error: {
        code: 'PLANS_FETCH_FAILED',
        message: 'Failed to retrieve subscription plans',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * GET /api/subscription/current
 * Get user's current subscription information
 * Requires authentication
 */
router.get('/current', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    const subscription = await subscriptionService.getUserSubscription(userId);
    const userTier = await subscriptionService.getUserTier(userId);
    const plans = subscriptionService.getSubscriptionPlans();
    const currentPlan = plans.find(p => p.tier === userTier);
    
    res.json({
      success: true,
      data: {
        subscription,
        currentTier: userTier,
        currentPlan,
        features: currentPlan?.features
      }
    });
  } catch (error) {
    console.error('Error getting current subscription:', error);
    res.status(500).json({
      error: {
        code: 'SUBSCRIPTION_FETCH_FAILED',
        message: 'Failed to retrieve subscription information',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * GET /api/subscription/usage
 * Get user's current usage metrics
 * Requires authentication
 */
router.get('/usage', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { period } = req.query;
    
    // Default to current month if no period specified
    const now = new Date();
    const periodStart = period === 'year' 
      ? new Date(now.getFullYear(), 0, 1)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = period === 'year'
      ? new Date(now.getFullYear() + 1, 0, 1)
      : new Date(now.getFullYear(), now.getMonth() + 1, 1);
    
    const usageMetrics = await subscriptionService.getUserUsageMetrics(userId, periodStart, periodEnd);
    const userTier = await subscriptionService.getUserTier(userId);
    const plans = subscriptionService.getSubscriptionPlans();
    const currentPlan = plans.find(p => p.tier === userTier);
    
    // Calculate feature usage for display
    const featureUsage = [];
    if (currentPlan) {
      const features = currentPlan.features;
      
      // Check workspace usage
      const workspaceAccess = await subscriptionService.checkFeatureAccess(userId, 'maxWorkspaces');
      if (typeof features.maxWorkspaces === 'number') {
        featureUsage.push({
          feature: 'maxWorkspaces',
          name: 'Workspaces',
          used: workspaceAccess.currentUsage || 0,
          limit: features.maxWorkspaces,
          unlimited: features.maxWorkspaces === -1
        });
      }
      
      // Check component usage
      const componentAccess = await subscriptionService.checkFeatureAccess(userId, 'maxComponentsPerWorkspace');
      if (typeof features.maxComponentsPerWorkspace === 'number') {
        featureUsage.push({
          feature: 'maxComponentsPerWorkspace',
          name: 'Components per Workspace',
          used: componentAccess.currentUsage || 0,
          limit: features.maxComponentsPerWorkspace,
          unlimited: features.maxComponentsPerWorkspace === -1
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        usage: usageMetrics,
        featureUsage,
        period: {
          start: periodStart,
          end: periodEnd,
          type: period || 'month'
        }
      }
    });
  } catch (error) {
    console.error('Error getting usage metrics:', error);
    res.status(500).json({
      error: {
        code: 'USAGE_FETCH_FAILED',
        message: 'Failed to retrieve usage metrics',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * POST /api/subscription/upgrade
 * Upgrade user's subscription tier
 * Requires authentication
 */
router.post('/upgrade', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const upgradeRequest: SubscriptionUpgradeRequest = req.body;
    
    // Validate request
    if (!upgradeRequest.targetTier || !upgradeRequest.billingCycle) {
      res.status(400).json({
        error: {
          code: 'INVALID_UPGRADE_REQUEST',
          message: 'Target tier and billing cycle are required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }
    
    const validTiers: SubscriptionTier[] = ['free', 'pro', 'enterprise'];
    if (!validTiers.includes(upgradeRequest.targetTier)) {
      res.status(400).json({
        error: {
          code: 'INVALID_TIER',
          message: 'Invalid subscription tier',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }
    
    // Check if user is already on this tier or higher
    const currentTier = await subscriptionService.getUserTier(userId);
    const tierHierarchy = { free: 0, pro: 1, enterprise: 2 };
    
    if (tierHierarchy[currentTier] >= tierHierarchy[upgradeRequest.targetTier]) {
      res.status(400).json({
        error: {
          code: 'INVALID_UPGRADE',
          message: 'Cannot upgrade to same or lower tier',
          details: {
            currentTier,
            targetTier: upgradeRequest.targetTier
          },
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }
    
    // For free tier, create subscription directly
    if (upgradeRequest.targetTier === 'free') {
      const subscription = await subscriptionService.createSubscription(
        userId,
        upgradeRequest.targetTier,
        upgradeRequest.billingCycle
      );
      
      res.json({
        success: true,
        data: {
          subscription,
          message: 'Successfully upgraded to free tier'
        }
      });
      return;
    }
    
    // For paid tiers, in a real implementation you would:
    // 1. Create Stripe checkout session
    // 2. Return checkout URL for user to complete payment
    // 3. Handle webhook to create subscription after successful payment
    
    // For now, simulate the upgrade process
    const subscription = await subscriptionService.createSubscription(
      userId,
      upgradeRequest.targetTier,
      upgradeRequest.billingCycle,
      `cus_simulated_${userId}`, // Simulated Stripe customer ID
      `sub_simulated_${Date.now()}` // Simulated Stripe subscription ID
    );
    
    res.json({
      success: true,
      data: {
        subscription,
        message: `Successfully upgraded to ${upgradeRequest.targetTier} tier`,
        // In real implementation, would return checkout session URL
        checkoutUrl: null
      }
    });
    
  } catch (error) {
    console.error('Error upgrading subscription:', error);
    res.status(500).json({
      error: {
        code: 'UPGRADE_FAILED',
        message: 'Failed to upgrade subscription',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * POST /api/subscription/cancel
 * Cancel user's subscription (at period end)
 * Requires authentication
 */
router.post('/cancel', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { reason, feedback } = req.body;
    
    const currentSubscription = await subscriptionService.getUserSubscription(userId);
    if (!currentSubscription) {
      res.status(404).json({
        error: {
          code: 'NO_SUBSCRIPTION',
          message: 'No active subscription found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }
    
    if (currentSubscription.tier === 'free') {
      res.status(400).json({
        error: {
          code: 'CANNOT_CANCEL_FREE',
          message: 'Cannot cancel free tier subscription',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }
    
    await subscriptionService.cancelSubscription(userId, reason);
    
    res.json({
      success: true,
      data: {
        message: 'Subscription will be canceled at the end of the current billing period',
        currentPeriodEnd: currentSubscription.currentPeriodEnd
      }
    });
    
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({
      error: {
        code: 'CANCELLATION_FAILED',
        message: 'Failed to cancel subscription',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * POST /api/subscription/reactivate
 * Reactivate a canceled subscription
 * Requires authentication
 */
router.post('/reactivate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    const currentSubscription = await subscriptionService.getUserSubscription(userId);
    if (!currentSubscription || !currentSubscription.cancelAtPeriodEnd) {
      res.status(400).json({
        error: {
          code: 'CANNOT_REACTIVATE',
          message: 'No canceled subscription found to reactivate',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }
    
    await subscriptionService.reactivateSubscription(userId);
    
    res.json({
      success: true,
      data: {
        message: 'Subscription has been reactivated'
      }
    });
    
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    res.status(500).json({
      error: {
        code: 'REACTIVATION_FAILED',
        message: 'Failed to reactivate subscription',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * GET /api/subscription/feature/:feature
 * Check access to a specific feature
 * Requires authentication
 */
router.get('/feature/:feature', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const feature = req.params.feature as keyof SubscriptionFeatures;
    
    const accessResult = await subscriptionService.checkFeatureAccess(userId, feature);
    const userTier = await subscriptionService.getUserTier(userId);
    
    res.json({
      success: true,
      data: {
        feature,
        access: accessResult,
        currentTier: userTier
      }
    });
    
  } catch (error) {
    console.error('Error checking feature access:', error);
    res.status(500).json({
      error: {
        code: 'FEATURE_CHECK_FAILED',
        message: 'Failed to check feature access',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * GET /api/subscription/analytics (Admin only)
 * Get subscription analytics
 * Requires authentication and admin role
 */
router.get('/analytics', authMiddleware, subscriptionMiddleware.requireTier('enterprise'), async (req: Request, res: Response) => {
  try {
    // In a real implementation, you'd check for admin role here
    // For now, we'll allow enterprise users to see analytics
    
    const analytics = await subscriptionService.getSubscriptionAnalytics();
    
    res.json({
      success: true,
      data: {
        analytics
      }
    });
    
  } catch (error) {
    console.error('Error getting subscription analytics:', error);
    res.status(500).json({
      error: {
        code: 'ANALYTICS_FETCH_FAILED',
        message: 'Failed to retrieve subscription analytics',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

export default router;