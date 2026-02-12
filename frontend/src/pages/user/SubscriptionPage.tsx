import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFirebaseAuthContext } from '../../hooks/useFirebaseAuth';
import { SubscriptionStatus } from '../../components/SubscriptionStatus';

interface PricingTier {
  name: string;
  price: string;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
  limits: {
    workspaces: number | 'unlimited';
    simulationRuns: number | 'unlimited';
    maxScale: string;
    collaboration: boolean;
    advancedMetrics: boolean;
    customScenarios: boolean;
    prioritySupport: boolean;
  };
}

const PRICING_TIERS: PricingTier[] = [
  {
    name: 'Free',
    price: '$0',
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      'Unlimited simulation runs',
      'Access to 8 core components',
      'Up to 5 workspaces',
      'Scale up to 1M users',
      'Basic metrics & bottleneck detection',
      'Community support',
    ],
    limits: {
      workspaces: 5,
      simulationRuns: Infinity,
      maxScale: '1M users',
      collaboration: false,
      advancedMetrics: false,
      customScenarios: false,
      prioritySupport: false,
    },
  },
  {
    name: 'Pro',
    price: '$29',
    priceMonthly: 29,
    priceYearly: 279,
    features: [
      'Everything in Free, plus:',
      'Scale up to 1B users',
      'Unlimited workspaces',
      'Advanced metrics & observability',
      'Failure injection & chaos testing',
      'Version history & rollback',
      'Export/import workspaces',
      'Priority support',
    ],
    limits: {
      workspaces: 'unlimited',
      simulationRuns: Infinity,
      maxScale: '1B users',
      collaboration: false,
      advancedMetrics: true,
      customScenarios: false,
      prioritySupport: true,
    },
  },
  {
    name: 'Team',
    price: '$99',
    priceMonthly: 99,
    priceYearly: 949,
    features: [
      'Everything in Pro, plus:',
      'Unlimited team members',
      'Real-time collaboration',
      'Custom scenarios & templates',
      'Team workspaces',
      'SSO & advanced auth',
      'Admin dashboard',
      'Dedicated support',
    ],
    limits: {
      workspaces: 'unlimited',
      simulationRuns: Infinity,
      maxScale: 'Unlimited',
      collaboration: true,
      advancedMetrics: true,
      customScenarios: true,
      prioritySupport: true,
    },
  },
];

interface UsageStats {
  workspaces: number;
  simulationRuns: number;
  storageUsed: number;
  collaborators: number;
}

export function SubscriptionPage() {
  const navigate = useNavigate();
  const { user } = useFirebaseAuthContext();

  const [currentTier, setCurrentTier] = useState<string>('Free');
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [usageStats, setUsageStats] = useState<UsageStats>({
    workspaces: 0,
    simulationRuns: 0,
    storageUsed: 0,
    collaborators: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Fetch subscription and usage data
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        // TODO: Fetch actual subscription data from backend
        // For now, using mock data
        setCurrentTier('Free');
        setUsageStats({
          workspaces: 2,
          simulationRuns: 47,
          storageUsed: 12.5,
          collaborators: 0,
        });
      } catch (err) {
        console.error('Error fetching subscription data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const currentPlan = PRICING_TIERS.find((tier) => tier.name === currentTier) || PRICING_TIERS[0];

  const handleUpgrade = (planName: string) => {
    // TODO: Implement Stripe checkout integration
    alert(`Upgrade to ${planName} coming soon! Stripe integration will be added.`);
  };

  const handleCancelSubscription = async () => {
    // TODO: Implement subscription cancellation
    alert('Subscription cancellation will be implemented with Stripe integration.');
    setShowCancelConfirm(false);
  };

  const getUsagePercentage = (used: number, limit: number | 'unlimited'): number => {
    if (limit === 'unlimited') return 0;
    return Math.min((used / limit) * 100, 100);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-lg bg-white px-6 py-4 shadow">
          <p className="text-sm text-slate-600">Loading subscription...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Subscription & Billing</h1>
          <p className="mt-2 text-gray-600">
            Manage your subscription, view usage, and billing information.
          </p>
          <p className="mt-1 text-xs text-gray-500">
            For now, upgrades use a simulated workflow backed by your account in Firebase auth and the
            app database. Stripe or other payment providers can be wired in later without changing this page.
          </p>
        </div>

        {/* Live subscription tier + usage powered by backend */}
        <div className="mb-10 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <SubscriptionStatus />
        </div>

        {/* Current Plan Card */}
        <div className="mb-8 rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white p-6 shadow-lg">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-gray-900">{currentTier} Plan</h2>
                <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white">
                  Current
                </span>
              </div>
              <p className="mt-2 text-3xl font-bold text-blue-600">
                {currentPlan.price}
                {currentTier !== 'Free' && <span className="text-lg text-gray-600">/month</span>}
              </p>
              {currentTier !== 'Free' && (
                <p className="mt-1 text-sm text-gray-600">
                  Next billing date: {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </p>
              )}
            </div>
            {currentTier === 'Free' && (
              <button
                onClick={() => handleUpgrade('Pro')}
                className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 shadow-md"
              >
                Upgrade Now
              </button>
            )}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-600">Workspaces</p>
              <p className="mt-1 text-xl font-bold text-gray-900">
                {usageStats.workspaces} / {currentPlan.limits.workspaces}
              </p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-600">Simulations</p>
              <p className="mt-1 text-xl font-bold text-gray-900">{usageStats.simulationRuns}</p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-600">Max Scale</p>
              <p className="mt-1 text-xl font-bold text-gray-900">{currentPlan.limits.maxScale}</p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-600">Collaborators</p>
              <p className="mt-1 text-xl font-bold text-gray-900">{usageStats.collaborators}</p>
            </div>
          </div>
        </div>

        {/* Usage Details */}
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Usage This Month</h2>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Workspaces</span>
                <span className="text-sm text-gray-600">
                  {usageStats.workspaces} / {currentPlan.limits.workspaces === 'unlimited' ? '∞' : currentPlan.limits.workspaces}
                </span>
              </div>
              {currentPlan.limits.workspaces !== 'unlimited' && (
                <div className="h-2 rounded-full bg-gray-200">
                  <div
                    className="h-2 rounded-full bg-blue-600 transition-all"
                    style={{ width: `${getUsagePercentage(usageStats.workspaces, currentPlan.limits.workspaces)}%` }}
                  />
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Simulation Runs</span>
                <span className="text-sm text-gray-600">{usageStats.simulationRuns} this month</span>
              </div>
              <div className="h-2 rounded-full bg-gray-200">
                <div className="h-2 rounded-full bg-green-600 transition-all" style={{ width: '15%' }} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Storage Used</span>
                <span className="text-sm text-gray-600">{usageStats.storageUsed} MB / 100 MB</span>
              </div>
              <div className="h-2 rounded-full bg-gray-200">
                <div
                  className="h-2 rounded-full bg-purple-600 transition-all"
                  style={{ width: `${(usageStats.storageUsed / 100) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Billing Period Toggle */}
        {currentTier === 'Free' && (
          <>
            <div className="mb-6 flex items-center justify-center gap-4">
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`rounded-lg px-4 py-2 font-medium transition-all ${
                  billingPeriod === 'monthly'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingPeriod('yearly')}
                className={`rounded-lg px-4 py-2 font-medium transition-all ${
                  billingPeriod === 'yearly'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Yearly
                <span className="ml-2 rounded-full bg-green-500 px-2 py-0.5 text-xs text-white">
                  Save 20%
                </span>
              </button>
            </div>

            {/* Available Plans */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Available Plans</h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {PRICING_TIERS.map((tier) => {
                  const isCurrentPlan = tier.name === currentTier;
                  const price = billingPeriod === 'yearly' ? tier.priceYearly : tier.priceMonthly;
                  const yearlyMonthly = billingPeriod === 'yearly' ? (tier.priceYearly / 12).toFixed(0) : null;

                  return (
                    <div
                      key={tier.name}
                      className={`rounded-xl border-2 p-6 ${
                        isCurrentPlan
                          ? 'border-blue-600 bg-blue-50'
                          : tier.name === 'Pro'
                          ? 'border-blue-400 bg-blue-50/50 shadow-lg'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      {tier.name === 'Pro' && (
                        <span className="inline-block mb-2 rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white">
                          Most Popular
                        </span>
                      )}
                      <h3 className="text-2xl font-bold text-gray-900">{tier.name}</h3>
                      <div className="mt-4">
                        {billingPeriod === 'yearly' && tier.priceMonthly > 0 ? (
                          <>
                            <p className="text-4xl font-bold text-gray-900">${yearlyMonthly}</p>
                            <p className="text-sm text-gray-600">
                              per month, billed ${price} yearly
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-4xl font-bold text-gray-900">{tier.price}</p>
                            {tier.priceMonthly > 0 && <p className="text-sm text-gray-600">per month</p>}
                          </>
                        )}
                      </div>

                      <ul className="mt-6 space-y-3">
                        {tier.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                            <svg className="h-5 w-5 shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            {feature}
                          </li>
                        ))}
                      </ul>

                      <button
                        onClick={() => handleUpgrade(tier.name)}
                        disabled={isCurrentPlan}
                        className={`mt-6 w-full rounded-lg py-3 font-semibold transition-all ${
                          isCurrentPlan
                            ? 'cursor-not-allowed bg-gray-300 text-gray-600'
                            : tier.name === 'Pro'
                            ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                            : 'border-2 border-blue-600 bg-white text-blue-600 hover:bg-blue-50'
                        }`}
                      >
                        {isCurrentPlan ? 'Current Plan' : tier.priceMonthly === 0 ? 'Downgrade' : 'Upgrade'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Billing History */}
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Billing History</h2>
          {currentTier === 'Free' ? (
            <p className="text-sm text-gray-600">
              No billing history yet. Upgrade to a paid plan to see your invoices here.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                <div>
                  <p className="font-medium text-gray-900">Pro Plan - Monthly</p>
                  <p className="text-sm text-gray-600">Dec 1, 2024</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">$29.00</p>
                  <button className="text-sm text-blue-600 hover:text-blue-700">Download</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Payment Method */}
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Method</h2>
          {currentTier === 'Free' ? (
            <p className="text-sm text-gray-600">
              No payment method on file. Add a payment method when you upgrade to a paid plan.
            </p>
          ) : (
            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-gray-100 p-2">
                  <svg className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00- 3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">•••• •••• •••• 4242</p>
                  <p className="text-sm text-gray-600">Expires 12/2025</p>
                </div>
              </div>
              <button className="text-sm font-medium text-blue-600 hover:text-blue-700">
                Update
              </button>
            </div>
          )}
        </div>

        {/* Cancel Subscription */}
        {currentTier !== 'Free' && (
          <div className="rounded-xl border-2 border-red-200 bg-red-50 p-6">
            <h2 className="text-xl font-semibold text-red-900 mb-2">Cancel Subscription</h2>
            <p className="text-sm text-red-700 mb-4">
              You'll lose access to premium features at the end of your billing period. Your workspaces and data will be preserved.
            </p>

            {!showCancelConfirm ? (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="rounded-lg border-2 border-red-600 bg-white px-4 py-2 font-medium text-red-600 hover:bg-red-600 hover:text-white"
              >
                Cancel Subscription
              </button>
            ) : (
              <div className="rounded-lg border border-red-300 bg-white p-4">
                <p className="mb-4 font-medium text-red-900">
                  Are you sure you want to cancel? You can resubscribe anytime.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleCancelSubscription}
                    className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
                  >
                    Yes, Cancel Subscription
                  </button>
                  <button
                    onClick={() => setShowCancelConfirm(false)}
                    className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Keep Subscription
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
