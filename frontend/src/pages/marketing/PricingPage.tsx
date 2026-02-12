import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFirebaseAuthContext } from '../../hooks/useFirebaseAuth';

interface PricingTier {
  name: string;
  price: string;
  description: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}

const PRICING_TIERS: PricingTier[] = [
  {
    name: 'Free',
    price: '$0',
    description: 'Perfect for learning the basics',
    features: [
      'Unlimited simulation runs',
      'Access to 8 core components',
      'Scale up to 1M users',
      '5 saved workspaces',
      'Community templates',
      'Basic metrics dashboard',
      'Email support'
    ],
    cta: 'Start Free'
  },
  {
    name: 'Pro',
    price: '$29',
    description: 'For serious system design practice',
    features: [
      'Everything in Free, plus:',
      'Scale up to 1B users',
      'Unlimited saved workspaces',
      'Advanced metrics & analytics',
      'Custom failure scenarios',
      'Collaboration (5 users)',
      'Version history',
      'Priority support',
      'Export reports (PDF/CSV)'
    ],
    cta: 'Start Pro Trial',
    highlighted: true
  },
  {
    name: 'Team',
    price: '$99',
    description: 'For engineering teams and educators',
    features: [
      'Everything in Pro, plus:',
      'Unlimited team members',
      'Team workspace sharing',
      'Admin dashboard',
      'SSO integration',
      'Custom scenarios',
      'Learning analytics',
      'Dedicated support',
      'Custom training'
    ],
    cta: 'Contact Sales'
  }
];

export function PricingPage() {
  const navigate = useNavigate();
  const { user } = useFirebaseAuthContext();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  const handleSelectPlan = () => {
    if (user) {
      navigate('/subscription');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Hero */}
      <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <h1 className="text-5xl font-extrabold text-gray-900">
          Simple, Transparent Pricing
        </h1>
        <p className="mt-4 text-xl text-gray-600">
          Choose the plan that's right for your learning journey
        </p>

        {/* Billing Toggle */}
        <div className="mt-8 inline-flex rounded-lg border border-gray-300 bg-white p-1">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-6 py-2 rounded-md text-sm font-medium ${
              billingCycle === 'monthly' ? 'bg-blue-600 text-white' : 'text-gray-700'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('annual')}
            className={`px-6 py-2 rounded-md text-sm font-medium ${
              billingCycle === 'annual' ? 'bg-blue-600 text-white' : 'text-gray-700'
            }`}
          >
            Annual <span className="ml-1 text-xs text-green-600">Save 20%</span>
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {PRICING_TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-2xl border-2 ${
                tier.highlighted
                  ? 'border-blue-600 shadow-2xl'
                  : 'border-gray-200'
              } bg-white p-8 relative`}
            >
              {tier.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                  Most Popular
                </div>
              )}

              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-900">{tier.name}</h3>
                <p className="mt-2 text-gray-600">{tier.description}</p>
                <div className="mt-4">
                  <span className="text-5xl font-extrabold text-gray-900">{tier.price}</span>
                  {tier.price !== '$0' && (
                    <span className="text-gray-600">
                      /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                    </span>
                  )}
                </div>
              </div>

              <ul className="mt-8 space-y-3">
                {tier.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <svg className="h-6 w-6 flex-shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelectPlan()}
                className={`mt-8 w-full rounded-lg px-6 py-3 text-sm font-semibold ${
                  tier.highlighted
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50'
                }`}
              >
                {tier.cta}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="border-t border-gray-200 bg-white py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            {[
              {
                q: 'Can I try before I buy?',
                a: 'Absolutely! Our Free plan gives you unlimited simulation runs and access to all core features. Upgrade anytime when you need advanced capabilities.'
              },
              {
                q: 'What payment methods do you accept?',
                a: 'We accept all major credit cards (Visa, Mastercard, Amex) and PayPal. Enterprise customers can pay via invoice.'
              },
              {
                q: 'Can I cancel anytime?',
                a: 'Yes! Cancel anytime with no penalties. Your Pro features will remain active until the end of your billing period.'
              },
              {
                q: 'Do you offer student discounts?',
                a: 'Yes! Students and educators get 50% off Pro plans. Contact us with your .edu email to get verified.'
              },
              {
                q: 'Is my data secure?',
                a: 'Absolutely. We use bank-level encryption, regular security audits, and never share your data with third parties.'
              }
            ].map((faq, idx) => (
              <div key={idx} className="rounded-lg border border-gray-200 bg-gray-50 p-6">
                <h3 className="text-lg font-semibold text-gray-900">{faq.q}</h3>
                <p className="mt-2 text-gray-700">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
