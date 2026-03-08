/**
 * Subscription and billing types for SRS FR-1.4
 * Implements subscription tier system with feature access controls
 */

export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

export interface SubscriptionFeatures {
  maxWorkspaces: number;
  maxComponentsPerWorkspace: number;
  maxSimulationDuration: number; // in seconds
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
}

export interface SubscriptionPlan {
  tier: SubscriptionTier;
  name: string;
  description: string;
  monthlyPrice: number; // in cents (USD)
  yearlyPrice: number; // in cents (USD)
  features: SubscriptionFeatures;
  popular?: boolean;
  trialDays?: number;
}

export interface UserSubscription {
  id: string;
  userId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billingCycle: 'monthly' | 'yearly';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialEnd?: Date;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type SubscriptionStatus = 
  | 'active' 
  | 'trialing' 
  | 'past_due' 
  | 'canceled' 
  | 'unpaid' 
  | 'incomplete' 
  | 'incomplete_expired';

export interface BillingInfo {
  customerId: string;
  email: string;
  name?: string;
  address?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  paymentMethods: PaymentMethod[];
  defaultPaymentMethod?: string;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account';
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  isDefault: boolean;
  createdAt: Date;
}

export interface Invoice {
  id: string;
  subscriptionId: string;
  amount: number; // in cents
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
  paidAt?: Date;
  hostedInvoiceUrl?: string;
  invoicePdf?: string;
  createdAt: Date;
}

export interface UsageMetrics {
  userId: string;
  period: {
    start: Date;
    end: Date;
  };
  workspacesCreated: number;
  simulationsRun: number;
  totalSimulationTime: number; // in seconds
  collaboratorsInvited: number;
  reportsGenerated: number;
  apiCallsMade: number;
}

export interface FeatureUsage {
  feature: keyof SubscriptionFeatures;
  used: number;
  limit: number;
  unlimited: boolean;
}

export interface SubscriptionUpgradeRequest {
  targetTier: SubscriptionTier;
  billingCycle: 'monthly' | 'yearly';
  paymentMethodId?: string;
}

export interface SubscriptionDowngradeRequest {
  targetTier: SubscriptionTier;
  reason?: string;
  feedback?: string;
}

export interface BillingPortalSession {
  url: string;
  returnUrl: string;
}

export interface CheckoutSession {
  id: string;
  url: string;
  tier: SubscriptionTier;
  billingCycle: 'monthly' | 'yearly';
  successUrl: string;
  cancelUrl: string;
}

// Feature access control result
export interface FeatureAccessResult {
  allowed: boolean;
  reason?: string;
  upgradeRequired?: SubscriptionTier;
  currentUsage?: number;
  limit?: number;
}

// Subscription analytics for admin dashboard
export interface SubscriptionAnalytics {
  totalSubscribers: number;
  activeSubscribers: number;
  trialUsers: number;
  churnRate: number;
  monthlyRecurringRevenue: number;
  averageRevenuePerUser: number;
  tierDistribution: {
    [key in SubscriptionTier]: number;
  };
  conversionRate: {
    trialToFree: number;
    freeToProTrial: number;
    trialToPaid: number;
  };
}