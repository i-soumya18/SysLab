/**
 * Subscription Status Component
 * Displays user's current subscription tier and usage information
 * Implements SRS FR-1.4: Feature access controls based on subscription tier
 */

import React, { useState, useEffect } from 'react';
import './SubscriptionStatus.css';

interface SubscriptionPlan {
  tier: 'free' | 'pro' | 'enterprise';
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  popular?: boolean;
  features: {
    maxWorkspaces: number;
    maxComponentsPerWorkspace: number;
    maxSimulationDuration: number;
    maxConcurrentSimulations: number;
    advancedMetrics: boolean;
    costModeling: boolean;
    failureInjection: boolean;
    collaborativeEditing: boolean;
    exportCapabilities: boolean;
    prioritySupport: boolean;
    customScenarios: boolean;
    abTesting: boolean;
    performanceReports: boolean;
    apiAccess: boolean;
    ssoIntegration: boolean;
  };
  trialDays?: number;
}

interface UserSubscription {
  id: string;
  userId: string;
  tier: 'free' | 'pro' | 'enterprise';
  status: string;
  billingCycle: 'monthly' | 'yearly';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEnd?: string;
}

interface FeatureUsage {
  feature: string;
  name: string;
  used: number;
  limit: number;
  unlimited: boolean;
}

interface SubscriptionData {
  subscription: UserSubscription | null;
  currentTier: 'free' | 'pro' | 'enterprise';
  currentPlan: SubscriptionPlan;
  features: SubscriptionPlan['features'];
}

interface UsageData {
  featureUsage: FeatureUsage[];
  period: {
    start: string;
    end: string;
    type: string;
  };
}

export const SubscriptionStatus: React.FC = () => {
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSubscriptionData();
    fetchUsageData();
  }, []);

  const fetchSubscriptionData = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        setError('Authentication required');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/v1/subscription/current', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch subscription data');
      }

      const result = await response.json();
      setSubscriptionData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscription data');
    }
  };

  const fetchUsageData = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const response = await fetch('/api/v1/subscription/usage', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch usage data');
      }

      const result = await response.json();
      setUsageData(result.data);
    } catch (err) {
      console.error('Failed to load usage data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (targetTier: 'pro' | 'enterprise') => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const response = await fetch('/api/v1/subscription/upgrade', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          targetTier,
          billingCycle: 'monthly'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to upgrade subscription');
      }

      // Refresh subscription data
      await fetchSubscriptionData();
      await fetchUsageData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upgrade subscription');
    }
  };

  const formatPrice = (cents: number): string => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatLimit = (limit: number): string => {
    return limit === -1 ? 'Unlimited' : limit.toString();
  };

  const getUsagePercentage = (used: number, limit: number): number => {
    if (limit === -1) return 0; // Unlimited
    return Math.min((used / limit) * 100, 100);
  };

  if (loading) {
    return (
      <div className="subscription-status loading">
        <div className="loading-spinner"></div>
        <p>Loading subscription information...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="subscription-status error">
        <div className="error-message">
          <h3>Error Loading Subscription</h3>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  if (!subscriptionData) {
    return (
      <div className="subscription-status error">
        <p>No subscription data available</p>
      </div>
    );
  }

  const { currentTier, currentPlan, subscription } = subscriptionData;

  return (
    <div className="subscription-status">
      <div className="subscription-header">
        <div className="current-plan">
          <h2>
            {currentPlan.name} Plan
            {currentPlan.popular && <span className="popular-badge">Popular</span>}
          </h2>
          <p className="plan-description">{currentPlan.description}</p>
          <div className="plan-price">
            {currentPlan.monthlyPrice === 0 ? (
              <span className="price">Free</span>
            ) : (
              <>
                <span className="price">{formatPrice(currentPlan.monthlyPrice)}</span>
                <span className="period">/month</span>
              </>
            )}
          </div>
        </div>

        {subscription?.status === 'trialing' && subscription.trialEnd && (
          <div className="trial-info">
            <h4>Trial Active</h4>
            <p>Trial ends: {new Date(subscription.trialEnd).toLocaleDateString()}</p>
          </div>
        )}

        {subscription?.cancelAtPeriodEnd && (
          <div className="cancellation-notice">
            <h4>Subscription Canceled</h4>
            <p>Access continues until: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}</p>
          </div>
        )}
      </div>

      {usageData && (
        <div className="usage-section">
          <h3>Current Usage</h3>
          <div className="usage-grid">
            {usageData.featureUsage.map((usage) => (
              <div key={usage.feature} className="usage-item">
                <div className="usage-header">
                  <span className="usage-name">{usage.name}</span>
                  <span className="usage-count">
                    {usage.used} / {formatLimit(usage.limit)}
                  </span>
                </div>
                {!usage.unlimited && (
                  <div className="usage-bar">
                    <div 
                      className="usage-fill"
                      style={{ width: `${getUsagePercentage(usage.used, usage.limit)}%` }}
                    ></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="features-section">
        <h3>Plan Features</h3>
        <div className="features-grid">
          <div className="feature-category">
            <h4>Workspace Limits</h4>
            <ul>
              <li>Max Workspaces: {formatLimit(currentPlan.features.maxWorkspaces)}</li>
              <li>Components per Workspace: {formatLimit(currentPlan.features.maxComponentsPerWorkspace)}</li>
              <li>Simulation Duration: {currentPlan.features.maxSimulationDuration === -1 ? 'Unlimited' : `${currentPlan.features.maxSimulationDuration / 60} minutes`}</li>
              <li>Concurrent Simulations: {currentPlan.features.maxConcurrentSimulations}</li>
            </ul>
          </div>

          <div className="feature-category">
            <h4>Advanced Features</h4>
            <ul>
              <li className={currentPlan.features.advancedMetrics ? 'enabled' : 'disabled'}>
                Advanced Metrics {currentPlan.features.advancedMetrics ? '✓' : '✗'}
              </li>
              <li className={currentPlan.features.costModeling ? 'enabled' : 'disabled'}>
                Cost Modeling {currentPlan.features.costModeling ? '✓' : '✗'}
              </li>
              <li className={currentPlan.features.failureInjection ? 'enabled' : 'disabled'}>
                Failure Injection {currentPlan.features.failureInjection ? '✓' : '✗'}
              </li>
              <li className={currentPlan.features.collaborativeEditing ? 'enabled' : 'disabled'}>
                Collaborative Editing {currentPlan.features.collaborativeEditing ? '✓' : '✗'}
              </li>
            </ul>
          </div>

          <div className="feature-category">
            <h4>Enterprise Features</h4>
            <ul>
              <li className={currentPlan.features.apiAccess ? 'enabled' : 'disabled'}>
                API Access {currentPlan.features.apiAccess ? '✓' : '✗'}
              </li>
              <li className={currentPlan.features.ssoIntegration ? 'enabled' : 'disabled'}>
                SSO Integration {currentPlan.features.ssoIntegration ? '✓' : '✗'}
              </li>
              <li className={currentPlan.features.prioritySupport ? 'enabled' : 'disabled'}>
                Priority Support {currentPlan.features.prioritySupport ? '✓' : '✗'}
              </li>
            </ul>
          </div>
        </div>
      </div>

      {currentTier !== 'enterprise' && (
        <div className="upgrade-section">
          <h3>Upgrade Your Plan</h3>
          <div className="upgrade-options">
            {currentTier === 'free' && (
              <button 
                className="upgrade-button pro"
                onClick={() => handleUpgrade('pro')}
              >
                Upgrade to Pro - {formatPrice(2900)}/month
              </button>
            )}
            <button 
              className="upgrade-button enterprise"
              onClick={() => handleUpgrade('enterprise')}
            >
              Upgrade to Enterprise - {formatPrice(9900)}/month
            </button>
          </div>
        </div>
      )}
    </div>
  );
};