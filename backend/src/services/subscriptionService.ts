/**
 * Subscription Service
 * Implements SRS FR-1.4: Subscription tier system with billing integration and feature access controls
 */

import { Pool } from 'pg';
import { getDatabase } from '../config/database';
import {
  SubscriptionTier,
  SubscriptionPlan,
  SubscriptionFeatures,
  UserSubscription,
  SubscriptionStatus,
  BillingInfo,
  PaymentMethod,
  Invoice,
  UsageMetrics,
  FeatureUsage,
  FeatureAccessResult,
  SubscriptionUpgradeRequest,
  SubscriptionDowngradeRequest,
  BillingPortalSession,
  CheckoutSession,
  SubscriptionAnalytics
} from '../types/subscription';

export class SubscriptionService {
  private db: Pool | null = null;
  private stripeSecretKey: string;
  private stripeWebhookSecret: string;

  constructor(database?: Pool) {
    this.db = database || null;
    this.stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
    this.stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  }

  private getDatabase(): Pool {
    if (!this.db) {
      this.db = getDatabase();
    }
    return this.db;
  }

  /**
   * Get all available subscription plans
   * Implements SRS FR-1.4: Free and paid tier support
   */
  getSubscriptionPlans(): SubscriptionPlan[] {
    return [
      {
        tier: 'free',
        name: 'Free',
        description: 'Perfect for learning system design basics',
        monthlyPrice: 0,
        yearlyPrice: 0,
        features: {
          maxWorkspaces: 3,
          maxComponentsPerWorkspace: 10,
          maxSimulationDuration: 300, // 5 minutes
          maxConcurrentSimulations: 1,
          advancedMetrics: false,
          costModeling: false,
          failureInjection: false,
          collaborativeEditing: false,
          exportCapabilities: false,
          prioritySupport: false,
          customScenarios: false,
          abTesting: false,
          performanceReports: false,
          apiAccess: false,
          ssoIntegration: false
        },
        trialDays: 0
      },
      {
        tier: 'pro',
        name: 'Pro',
        description: 'For engineers and teams building production systems',
        monthlyPrice: 2900, // $29.00
        yearlyPrice: 29000, // $290.00 (2 months free)
        popular: true,
        features: {
          maxWorkspaces: 50,
          maxComponentsPerWorkspace: 100,
          maxSimulationDuration: 3600, // 1 hour
          maxConcurrentSimulations: 5,
          advancedMetrics: true,
          costModeling: true,
          failureInjection: true,
          collaborativeEditing: true,
          exportCapabilities: true,
          prioritySupport: true,
          customScenarios: true,
          abTesting: true,
          performanceReports: true,
          apiAccess: false,
          ssoIntegration: false
        },
        trialDays: 14
      },
      {
        tier: 'enterprise',
        name: 'Enterprise',
        description: 'For large teams with advanced requirements',
        monthlyPrice: 9900, // $99.00
        yearlyPrice: 99000, // $990.00 (2 months free)
        features: {
          maxWorkspaces: -1, // unlimited
          maxComponentsPerWorkspace: -1, // unlimited
          maxSimulationDuration: -1, // unlimited
          maxConcurrentSimulations: 20,
          advancedMetrics: true,
          costModeling: true,
          failureInjection: true,
          collaborativeEditing: true,
          exportCapabilities: true,
          prioritySupport: true,
          customScenarios: true,
          abTesting: true,
          performanceReports: true,
          apiAccess: true,
          ssoIntegration: true
        },
        trialDays: 30
      }
    ];
  }

  /**
   * Get user's current subscription
   * Implements SRS FR-1.4: Subscription management
   */
  async getUserSubscription(userId: string): Promise<UserSubscription | null> {
    try {
      const db = this.getDatabase();
      const query = `
        SELECT id, user_id, tier, status, billing_cycle, current_period_start, 
               current_period_end, cancel_at_period_end, trial_end, 
               stripe_customer_id, stripe_subscription_id, created_at, updated_at
        FROM user_subscriptions 
        WHERE user_id = $1 AND status != 'canceled'
        ORDER BY created_at DESC 
        LIMIT 1
      `;
      
      const result = await db.query(query, [userId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        userId: row.user_id,
        tier: row.tier,
        status: row.status,
        billingCycle: row.billing_cycle,
        currentPeriodStart: row.current_period_start,
        currentPeriodEnd: row.current_period_end,
        cancelAtPeriodEnd: row.cancel_at_period_end,
        trialEnd: row.trial_end,
        stripeCustomerId: row.stripe_customer_id,
        stripeSubscriptionId: row.stripe_subscription_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };

    } catch (error) {
      console.error('Error getting user subscription:', error);
      throw new Error('Failed to retrieve subscription information');
    }
  }

  /**
   * Get user's subscription tier (fallback to free if no subscription)
   * Implements SRS FR-1.4: Feature access controls based on subscription tier
   */
  async getUserTier(userId: string): Promise<SubscriptionTier> {
    try {
      // First check user_subscriptions table
      const subscription = await this.getUserSubscription(userId);
      if (subscription && subscription.status === 'active') {
        return subscription.tier;
      }

      // Fallback to users table subscription_tier column
      const db = this.getDatabase();
      const userQuery = 'SELECT subscription_tier FROM users WHERE id = $1';
      const userResult = await db.query(userQuery, [userId]);
      
      if (userResult.rows.length > 0) {
        return userResult.rows[0].subscription_tier as SubscriptionTier;
      }

      return 'free'; // Default fallback

    } catch (error) {
      console.error('Error getting user tier:', error);
      return 'free'; // Safe fallback
    }
  }

  /**
   * Check if user has access to a specific feature
   * Implements SRS FR-1.4: Feature access controls based on subscription tier
   */
  async checkFeatureAccess(userId: string, feature: keyof SubscriptionFeatures): Promise<FeatureAccessResult> {
    try {
      const userTier = await this.getUserTier(userId);
      const plans = this.getSubscriptionPlans();
      const currentPlan = plans.find(p => p.tier === userTier);
      
      if (!currentPlan) {
        return {
          allowed: false,
          reason: 'Invalid subscription tier',
          upgradeRequired: 'pro'
        };
      }

      const featureValue = currentPlan.features[feature];
      
      // For boolean features, return the value directly
      if (typeof featureValue === 'boolean') {
        return {
          allowed: featureValue,
          reason: featureValue ? undefined : `Feature requires ${this.getMinimumTierForFeature(feature)} tier or higher`,
          upgradeRequired: featureValue ? undefined : this.getMinimumTierForFeature(feature)
        };
      }

      // For numeric features, we need to check current usage
      if (typeof featureValue === 'number') {
        const currentUsage = await this.getFeatureUsage(userId, feature);
        const unlimited = featureValue === -1;
        const allowed = unlimited || currentUsage < featureValue;
        
        return {
          allowed,
          reason: allowed ? undefined : `Feature limit exceeded (${currentUsage}/${unlimited ? '∞' : featureValue})`,
          upgradeRequired: allowed ? undefined : this.getMinimumTierForFeature(feature),
          currentUsage,
          limit: unlimited ? -1 : featureValue
        };
      }

      return { allowed: true };

    } catch (error) {
      console.error('Error checking feature access:', error);
      return {
        allowed: false,
        reason: 'Error checking feature access'
      };
    }
  }

  /**
   * Get current usage for a numeric feature
   */
  private async getFeatureUsage(userId: string, feature: keyof SubscriptionFeatures): Promise<number> {
    try {
      switch (feature) {
        case 'maxWorkspaces':
          const db1 = this.getDatabase();
          const workspaceQuery = 'SELECT COUNT(*) as count FROM workspaces WHERE user_id = $1';
          const workspaceResult = await db1.query(workspaceQuery, [userId]);
          return parseInt(workspaceResult.rows[0].count);

        case 'maxComponentsPerWorkspace':
          // Return the maximum components in any single workspace
          const db2 = this.getDatabase();
          const componentQuery = `
            SELECT MAX(component_count) as max_count
            FROM (
              SELECT COUNT(*) as component_count 
              FROM components c 
              JOIN workspaces w ON c.workspace_id = w.id 
              WHERE w.user_id = $1 
              GROUP BY c.workspace_id
            ) workspace_counts
          `;
          const componentResult = await db2.query(componentQuery, [userId]);
          return parseInt(componentResult.rows[0].max_count || '0');

        case 'maxConcurrentSimulations':
          // This would require tracking active simulations in a separate table
          // For now, return 0 as a placeholder
          return 0;

        case 'maxSimulationDuration':
          // This would require tracking simulation durations
          // For now, return 0 as a placeholder
          return 0;

        default:
          return 0;
      }
    } catch (error) {
      console.error(`Error getting usage for feature ${feature}:`, error);
      return 0;
    }
  }

  /**
   * Get the minimum tier required for a feature
   */
  private getMinimumTierForFeature(feature: keyof SubscriptionFeatures): SubscriptionTier {
    const plans = this.getSubscriptionPlans();
    
    for (const plan of plans) {
      const featureValue = plan.features[feature];
      if (typeof featureValue === 'boolean' && featureValue) {
        return plan.tier;
      }
      if (typeof featureValue === 'number' && featureValue > 0) {
        return plan.tier;
      }
    }
    
    return 'enterprise'; // Default to highest tier
  }

  /**
   * Create a new subscription for a user
   * Implements SRS FR-1.4: Billing integration and subscription management
   */
  async createSubscription(
    userId: string, 
    tier: SubscriptionTier, 
    billingCycle: 'monthly' | 'yearly',
    stripeCustomerId?: string,
    stripeSubscriptionId?: string
  ): Promise<UserSubscription> {
    try {
      const db = this.getDatabase();
      const now = new Date();
      const plans = this.getSubscriptionPlans();
      const plan = plans.find(p => p.tier === tier);
      
      if (!plan) {
        throw new Error('Invalid subscription tier');
      }

      // Calculate period dates
      const currentPeriodStart = now;
      const currentPeriodEnd = new Date(now);
      if (billingCycle === 'monthly') {
        currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
      } else {
        currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
      }

      // Calculate trial end if applicable
      const trialEnd = plan.trialDays ? new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000) : null;
      const status: SubscriptionStatus = plan.trialDays ? 'trialing' : 'active';

      const query = `
        INSERT INTO user_subscriptions 
        (user_id, tier, status, billing_cycle, current_period_start, current_period_end, 
         cancel_at_period_end, trial_end, stripe_customer_id, stripe_subscription_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

      const values = [
        userId, tier, status, billingCycle, currentPeriodStart, currentPeriodEnd,
        false, trialEnd, stripeCustomerId, stripeSubscriptionId
      ];

      const result = await db.query(query, values);
      const row = result.rows[0];

      // Update user's subscription_tier in users table for backward compatibility
      await db.query(
        'UPDATE users SET subscription_tier = $1, updated_at = NOW() WHERE id = $2',
        [tier, userId]
      );

      return {
        id: row.id,
        userId: row.user_id,
        tier: row.tier,
        status: row.status,
        billingCycle: row.billing_cycle,
        currentPeriodStart: row.current_period_start,
        currentPeriodEnd: row.current_period_end,
        cancelAtPeriodEnd: row.cancel_at_period_end,
        trialEnd: row.trial_end,
        stripeCustomerId: row.stripe_customer_id,
        stripeSubscriptionId: row.stripe_subscription_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };

    } catch (error) {
      console.error('Error creating subscription:', error);
      throw new Error('Failed to create subscription');
    }
  }

  /**
   * Update subscription status (typically called by webhooks)
   */
  async updateSubscriptionStatus(
    subscriptionId: string, 
    status: SubscriptionStatus,
    currentPeriodStart?: Date,
    currentPeriodEnd?: Date
  ): Promise<void> {
    try {
      const db = this.getDatabase();
      const query = `
        UPDATE user_subscriptions 
        SET status = $1, current_period_start = COALESCE($2, current_period_start),
            current_period_end = COALESCE($3, current_period_end), updated_at = NOW()
        WHERE stripe_subscription_id = $4
      `;

      await db.query(query, [status, currentPeriodStart, currentPeriodEnd, subscriptionId]);

    } catch (error) {
      console.error('Error updating subscription status:', error);
      throw new Error('Failed to update subscription status');
    }
  }

  /**
   * Cancel subscription at period end
   */
  async cancelSubscription(userId: string, reason?: string): Promise<void> {
    try {
      const db = this.getDatabase();
      const query = `
        UPDATE user_subscriptions 
        SET cancel_at_period_end = true, updated_at = NOW()
        WHERE user_id = $1 AND status IN ('active', 'trialing')
      `;

      await db.query(query, [userId]);

      // Log cancellation reason if provided
      if (reason) {
        console.log(`Subscription canceled for user ${userId}: ${reason}`);
      }

    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw new Error('Failed to cancel subscription');
    }
  }

  /**
   * Reactivate a canceled subscription
   */
  async reactivateSubscription(userId: string): Promise<void> {
    try {
      const db = this.getDatabase();
      const query = `
        UPDATE user_subscriptions 
        SET cancel_at_period_end = false, updated_at = NOW()
        WHERE user_id = $1 AND status IN ('active', 'trialing') AND cancel_at_period_end = true
      `;

      await db.query(query, [userId]);

    } catch (error) {
      console.error('Error reactivating subscription:', error);
      throw new Error('Failed to reactivate subscription');
    }
  }

  /**
   * Get usage metrics for a user
   */
  async getUserUsageMetrics(userId: string, periodStart: Date, periodEnd: Date): Promise<UsageMetrics> {
    try {
      const db = this.getDatabase();
      // Get workspace count
      const workspaceQuery = `
        SELECT COUNT(*) as count 
        FROM workspaces 
        WHERE user_id = $1 AND created_at BETWEEN $2 AND $3
      `;
      const workspaceResult = await db.query(workspaceQuery, [userId, periodStart, periodEnd]);

      // For now, return basic metrics. In a full implementation, you'd track:
      // - Simulations run
      // - Total simulation time
      // - Collaborators invited
      // - Reports generated
      // - API calls made

      return {
        userId,
        period: { start: periodStart, end: periodEnd },
        workspacesCreated: parseInt(workspaceResult.rows[0].count),
        simulationsRun: 0, // Placeholder
        totalSimulationTime: 0, // Placeholder
        collaboratorsInvited: 0, // Placeholder
        reportsGenerated: 0, // Placeholder
        apiCallsMade: 0 // Placeholder
      };

    } catch (error) {
      console.error('Error getting usage metrics:', error);
      throw new Error('Failed to retrieve usage metrics');
    }
  }

  /**
   * Get subscription analytics (admin only)
   */
  async getSubscriptionAnalytics(): Promise<SubscriptionAnalytics> {
    try {
      const db = this.getDatabase();
      // Get total and active subscribers
      const subscriberQuery = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
          COUNT(CASE WHEN status = 'trialing' THEN 1 END) as trialing
        FROM user_subscriptions
        WHERE status != 'canceled'
      `;
      const subscriberResult = await db.query(subscriberQuery);

      // Get tier distribution
      const tierQuery = `
        SELECT tier, COUNT(*) as count
        FROM user_subscriptions
        WHERE status IN ('active', 'trialing')
        GROUP BY tier
      `;
      const tierResult = await db.query(tierQuery);

      const tierDistribution: { [key in SubscriptionTier]: number } = {
        free: 0,
        pro: 0,
        enterprise: 0
      };

      tierResult.rows.forEach(row => {
        tierDistribution[row.tier as SubscriptionTier] = parseInt(row.count);
      });

      // Calculate basic analytics
      const totalSubscribers = parseInt(subscriberResult.rows[0].total);
      const activeSubscribers = parseInt(subscriberResult.rows[0].active);
      const trialUsers = parseInt(subscriberResult.rows[0].trialing);

      return {
        totalSubscribers,
        activeSubscribers,
        trialUsers,
        churnRate: 0, // Would require historical data
        monthlyRecurringRevenue: 0, // Would require billing data
        averageRevenuePerUser: 0, // Would require billing data
        tierDistribution,
        conversionRate: {
          trialToFree: 0, // Would require conversion tracking
          freeToProTrial: 0, // Would require conversion tracking
          trialToPaid: 0 // Would require conversion tracking
        }
      };

    } catch (error) {
      console.error('Error getting subscription analytics:', error);
      throw new Error('Failed to retrieve subscription analytics');
    }
  }
}