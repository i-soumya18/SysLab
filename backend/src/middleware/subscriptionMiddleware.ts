/**
 * Subscription Middleware
 * Implements SRS FR-1.4: Feature access controls based on subscription tier
 */

import { Request, Response, NextFunction } from 'express';
import { SubscriptionService } from '../services/subscriptionService';
import { SubscriptionFeatures } from '../types/subscription';

// Extend Express Request to include subscription info
declare global {
  namespace Express {
    interface Request {
      subscription?: {
        tier: string;
        features: SubscriptionFeatures;
      };
    }
  }
}

export class SubscriptionMiddleware {
  private subscriptionService: SubscriptionService;

  constructor() {
    this.subscriptionService = new SubscriptionService();
  }

  /**
   * Middleware to check if user has access to a specific feature
   */
  requireFeature(feature: keyof SubscriptionFeatures) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.id;
        
        if (!userId) {
          res.status(401).json({
            error: {
              code: 'AUTHENTICATION_REQUIRED',
              message: 'Authentication required to access this feature',
              timestamp: new Date().toISOString(),
              requestId: req.headers['x-request-id'] || 'unknown'
            }
          });
          return;
        }

        const accessResult = await this.subscriptionService.checkFeatureAccess(userId, feature);
        
        if (!accessResult.allowed) {
          res.status(403).json({
            error: {
              code: 'FEATURE_ACCESS_DENIED',
              message: accessResult.reason || 'Feature not available in your current plan',
              details: {
                feature,
                upgradeRequired: accessResult.upgradeRequired,
                currentUsage: accessResult.currentUsage,
                limit: accessResult.limit
              },
              timestamp: new Date().toISOString(),
              requestId: req.headers['x-request-id'] || 'unknown'
            }
          });
          return;
        }

        // Add subscription info to request for use in route handlers
        const userTier = await this.subscriptionService.getUserTier(userId);
        const plans = this.subscriptionService.getSubscriptionPlans();
        const currentPlan = plans.find(p => p.tier === userTier);
        
        if (currentPlan) {
          req.subscription = {
            tier: userTier,
            features: currentPlan.features
          };
        }

        next();
      } catch (error) {
        console.error('Subscription middleware error:', error);
        res.status(500).json({
          error: {
            code: 'SUBSCRIPTION_CHECK_FAILED',
            message: 'Failed to verify feature access',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
      }
    };
  }

  /**
   * Middleware to check if user has a minimum subscription tier
   */
  requireTier(minimumTier: 'free' | 'pro' | 'enterprise') {
    const tierHierarchy = { free: 0, pro: 1, enterprise: 2 };
    
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.id;
        
        if (!userId) {
          res.status(401).json({
            error: {
              code: 'AUTHENTICATION_REQUIRED',
              message: 'Authentication required',
              timestamp: new Date().toISOString(),
              requestId: req.headers['x-request-id'] || 'unknown'
            }
          });
          return;
        }

        const userTier = await this.subscriptionService.getUserTier(userId);
        const userTierLevel = tierHierarchy[userTier];
        const requiredTierLevel = tierHierarchy[minimumTier];
        
        if (userTierLevel < requiredTierLevel) {
          res.status(403).json({
            error: {
              code: 'INSUFFICIENT_SUBSCRIPTION_TIER',
              message: `This feature requires ${minimumTier} tier or higher`,
              details: {
                currentTier: userTier,
                requiredTier: minimumTier
              },
              timestamp: new Date().toISOString(),
              requestId: req.headers['x-request-id'] || 'unknown'
            }
          });
          return;
        }

        next();
      } catch (error) {
        console.error('Tier check middleware error:', error);
        res.status(500).json({
          error: {
            code: 'TIER_CHECK_FAILED',
            message: 'Failed to verify subscription tier',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
      }
    };
  }

  /**
   * Middleware to add subscription info to all authenticated requests
   */
  addSubscriptionInfo() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.id;
        
        if (userId) {
          const userTier = await this.subscriptionService.getUserTier(userId);
          const plans = this.subscriptionService.getSubscriptionPlans();
          const currentPlan = plans.find(p => p.tier === userTier);
          
          if (currentPlan) {
            req.subscription = {
              tier: userTier,
              features: currentPlan.features
            };
          }
        }

        next();
      } catch (error) {
        console.error('Add subscription info middleware error:', error);
        // Don't fail the request, just continue without subscription info
        next();
      }
    };
  }

  /**
   * Middleware to check usage limits for numeric features
   */
  checkUsageLimit(feature: keyof SubscriptionFeatures, increment: number = 1) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.id;
        
        if (!userId) {
          res.status(401).json({
            error: {
              code: 'AUTHENTICATION_REQUIRED',
              message: 'Authentication required',
              timestamp: new Date().toISOString(),
              requestId: req.headers['x-request-id'] || 'unknown'
            }
          });
          return;
        }

        const accessResult = await this.subscriptionService.checkFeatureAccess(userId, feature);
        
        if (!accessResult.allowed) {
          res.status(403).json({
            error: {
              code: 'USAGE_LIMIT_EXCEEDED',
              message: accessResult.reason || 'Usage limit exceeded',
              details: {
                feature,
                currentUsage: accessResult.currentUsage,
                limit: accessResult.limit,
                upgradeRequired: accessResult.upgradeRequired
              },
              timestamp: new Date().toISOString(),
              requestId: req.headers['x-request-id'] || 'unknown'
            }
          });
          return;
        }

        // Check if adding the increment would exceed the limit
        if (accessResult.limit !== -1 && accessResult.currentUsage !== undefined && accessResult.limit !== undefined) {
          if (accessResult.currentUsage + increment > accessResult.limit) {
            res.status(403).json({
              error: {
                code: 'USAGE_LIMIT_WOULD_BE_EXCEEDED',
                message: `This action would exceed your ${feature} limit`,
                details: {
                  feature,
                  currentUsage: accessResult.currentUsage,
                  increment,
                  limit: accessResult.limit,
                  upgradeRequired: accessResult.upgradeRequired
                },
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] || 'unknown'
              }
            });
            return;
          }
        }

        next();
      } catch (error) {
        console.error('Usage limit middleware error:', error);
        res.status(500).json({
          error: {
            code: 'USAGE_CHECK_FAILED',
            message: 'Failed to check usage limits',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
      }
    };
  }
}

// Export singleton instance
export const subscriptionMiddleware = new SubscriptionMiddleware();