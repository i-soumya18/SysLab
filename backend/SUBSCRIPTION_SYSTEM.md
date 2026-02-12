# Subscription System Implementation (SRS FR-1.4)

This document describes the implementation of the subscription tier system with billing integration and feature access controls as specified in SRS FR-1.4.

## Overview

The subscription system implements three tiers (Free, Pro, Enterprise) with progressive feature access and usage limits. It includes:

- **Subscription Plans**: Configurable tiers with features and pricing
- **Feature Access Control**: Middleware-based access control for API endpoints
- **Usage Tracking**: Real-time usage monitoring and limits enforcement
- **Billing Integration**: Ready for Stripe integration (currently simulated)

## Architecture

### Core Components

1. **SubscriptionService** (`src/services/subscriptionService.ts`)
   - Manages subscription plans and user subscriptions
   - Handles feature access checks and usage tracking
   - Provides subscription analytics

2. **Subscription Types** (`src/types/subscription.ts`)
   - Defines all subscription-related interfaces and types
   - Includes plan features, billing info, and usage metrics

3. **Subscription Middleware** (`src/middleware/subscriptionMiddleware.ts`)
   - Provides route-level feature access control
   - Enforces usage limits before operations
   - Adds subscription context to requests

4. **API Routes** (`src/routes/subscription.ts`)
   - RESTful endpoints for subscription management
   - Plan information, usage metrics, and upgrades

### Database Schema

The system adds these tables to the existing schema:

```sql
-- User subscriptions table
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier VARCHAR(50) NOT NULL DEFAULT 'free',
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  billing_cycle VARCHAR(20),
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  trial_end TIMESTAMP WITH TIME ZONE,
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255) UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Billing events for audit trail
CREATE TABLE billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}',
  stripe_event_id VARCHAR(255),
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Subscription Tiers

### Free Tier
- **Price**: $0/month
- **Workspaces**: 3
- **Components per Workspace**: 10
- **Simulation Duration**: 5 minutes
- **Concurrent Simulations**: 1
- **Advanced Features**: None

### Pro Tier
- **Price**: $29/month ($290/year)
- **Workspaces**: 50
- **Components per Workspace**: 100
- **Simulation Duration**: 1 hour
- **Concurrent Simulations**: 5
- **Advanced Features**: Metrics, Cost Modeling, Failure Injection, Collaboration
- **Trial**: 14 days

### Enterprise Tier
- **Price**: $99/month ($990/year)
- **Workspaces**: Unlimited
- **Components per Workspace**: Unlimited
- **Simulation Duration**: Unlimited
- **Concurrent Simulations**: 20
- **Advanced Features**: All features including API access and SSO
- **Trial**: 30 days

## Feature Access Control

### Middleware Usage

```typescript
import { subscriptionMiddleware } from '../middleware/subscriptionMiddleware';

// Require specific feature
router.post('/advanced-endpoint', 
  authenticateToken,
  subscriptionMiddleware.requireFeature('advancedMetrics'),
  handler
);

// Check usage limits
router.post('/workspaces', 
  authenticateToken,
  subscriptionMiddleware.checkUsageLimit('maxWorkspaces', 1),
  handler
);

// Require minimum tier
router.get('/enterprise-feature',
  authenticateToken,
  subscriptionMiddleware.requireTier('enterprise'),
  handler
);
```

### Feature Check Examples

```typescript
const subscriptionService = new SubscriptionService();

// Check if user can access a feature
const accessResult = await subscriptionService.checkFeatureAccess(userId, 'costModeling');
if (!accessResult.allowed) {
  // Handle access denied
  console.log(`Access denied: ${accessResult.reason}`);
  console.log(`Upgrade required: ${accessResult.upgradeRequired}`);
}

// Get user's current tier
const userTier = await subscriptionService.getUserTier(userId);

// Get usage metrics
const usage = await subscriptionService.getUserUsageMetrics(userId, startDate, endDate);
```

## API Endpoints

### Public Endpoints

- `GET /api/v1/subscription/plans` - Get all subscription plans

### Authenticated Endpoints

- `GET /api/v1/subscription/current` - Get user's current subscription
- `GET /api/v1/subscription/usage` - Get usage metrics
- `POST /api/v1/subscription/upgrade` - Upgrade subscription
- `POST /api/v1/subscription/cancel` - Cancel subscription
- `POST /api/v1/subscription/reactivate` - Reactivate canceled subscription
- `GET /api/v1/subscription/feature/:feature` - Check feature access

### Admin Endpoints

- `GET /api/v1/subscription/analytics` - Get subscription analytics (Enterprise only)

## Usage Examples

### Frontend Integration

```typescript
// Check subscription status
const response = await fetch('/api/v1/subscription/current', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { subscription, currentTier, features } = await response.json();

// Upgrade subscription
const upgradeResponse = await fetch('/api/v1/subscription/upgrade', {
  method: 'POST',
  headers: { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    targetTier: 'pro',
    billingCycle: 'monthly'
  })
});
```

### Backend Route Protection

```typescript
// Protect workspace creation with usage limits
router.post('/workspaces', 
  authenticateToken,
  subscriptionMiddleware.checkUsageLimit('maxWorkspaces', 1),
  async (req, res) => {
    // Create workspace - user has been verified to have capacity
    const workspace = await workspaceService.create(req.body);
    res.json({ success: true, data: workspace });
  }
);

// Protect advanced features
router.get('/cost-analysis',
  authenticateToken,
  subscriptionMiddleware.requireFeature('costModeling'),
  async (req, res) => {
    // User has access to cost modeling feature
    const analysis = await costService.analyze(req.params.workspaceId);
    res.json({ success: true, data: analysis });
  }
);
```

## Testing

The subscription system includes comprehensive unit tests:

```bash
# Run subscription tests
npm test -- subscription.test.ts
```

Tests cover:
- Subscription plan configuration
- Feature hierarchy across tiers
- Pricing structure validation
- Feature access control logic
- Trial period configuration

## Billing Integration

The system is designed for Stripe integration:

1. **Customer Creation**: Users get Stripe customer IDs
2. **Subscription Management**: Stripe subscription IDs tracked
3. **Webhook Handling**: Ready for Stripe webhook processing
4. **Payment Methods**: Support for multiple payment methods
5. **Invoicing**: Invoice tracking and management

### Stripe Webhook Example

```typescript
// Handle Stripe webhooks (to be implemented)
router.post('/webhook/stripe', async (req, res) => {
  const event = req.body;
  
  switch (event.type) {
    case 'customer.subscription.updated':
      await subscriptionService.updateSubscriptionStatus(
        event.data.object.id,
        event.data.object.status
      );
      break;
    // Handle other events...
  }
  
  res.json({ received: true });
});
```

## Security Considerations

1. **Access Control**: All subscription endpoints require authentication
2. **Data Isolation**: User subscriptions are tenant-scoped
3. **Usage Validation**: Server-side enforcement of all limits
4. **Audit Trail**: All billing events are logged
5. **Token Security**: JWT tokens include subscription context

## Performance Considerations

1. **Caching**: Subscription data can be cached for performance
2. **Database Indexes**: Proper indexing on subscription queries
3. **Lazy Loading**: Services are lazy-loaded to avoid initialization issues
4. **Efficient Queries**: Optimized database queries for usage tracking

## Future Enhancements

1. **Stripe Integration**: Complete Stripe payment processing
2. **Usage Analytics**: Detailed usage tracking and reporting
3. **Custom Plans**: Admin-configurable subscription plans
4. **Team Management**: Multi-user team subscriptions
5. **API Rate Limiting**: Tier-based API rate limits
6. **Resource Quotas**: Granular resource management

## Monitoring and Alerts

The system supports monitoring of:
- Subscription conversion rates
- Usage patterns by tier
- Billing event processing
- Feature access patterns
- Trial conversion rates

This subscription system provides a solid foundation for monetizing the System Design Simulator platform while ensuring proper feature access control and usage management.