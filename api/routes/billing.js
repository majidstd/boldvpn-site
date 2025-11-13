const express = require('express');
const router = express.Router();

const { authenticateToken } = require('../middleware/auth');

// Mock Stripe integration for now
// TODO: Replace with real Stripe implementation

// Get user subscription status
router.get('/subscription', authenticateToken, async (req, res) => {
  try {
    const { username, plan } = req.user;

    // Mock subscription data
    const subscriptions = {
      basic: {
        plan: 'basic',
        name: 'Basic Plan',
        price: 9.99,
        currency: 'USD',
        interval: 'month',
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        features: [
          '50 GB/month',
          '50 Mbps speed',
          '2 devices',
          'Basic support'
        ]
      },
      premium: {
        plan: 'premium',
        name: 'Premium Plan',
        price: 19.99,
        currency: 'USD',
        interval: 'month',
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        features: [
          '100 GB/month',
          '100 Mbps speed',
          '5 devices',
          'Priority support',
          'Ad blocking'
        ]
      },
      family: {
        plan: 'family',
        name: 'Family Plan',
        price: 29.99,
        currency: 'USD',
        interval: 'month',
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        features: [
          '250 GB/month',
          '200 Mbps speed',
          '10 devices',
          'Priority support',
          'Ad blocking',
          'Parental controls'
        ]
      }
    };

    const subscription = subscriptions[plan] || subscriptions.basic;

    res.json({
      subscription: {
        ...subscription,
        username
      }
    });

  } catch (error) {
    console.error('[!] Subscription fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// Get available plans
router.get('/plans', (req, res) => {
  const plans = [
    {
      id: 'basic',
      name: 'Basic Plan',
      price: 9.99,
      currency: 'USD',
      interval: 'month',
      description: 'Perfect for individual users',
      features: [
        '50 GB/month data',
        '50 Mbps connection speed',
        'Connect up to 2 devices',
        'Basic customer support',
        '30-day money-back guarantee'
      ],
      popular: false
    },
    {
      id: 'premium',
      name: 'Premium Plan',
      price: 19.99,
      currency: 'USD',
      interval: 'month',
      description: 'Great for power users and small teams',
      features: [
        '100 GB/month data',
        '100 Mbps connection speed',
        'Connect up to 5 devices',
        'Priority customer support',
        'Advanced security features',
        'Ad blocking included',
        '30-day money-back guarantee'
      ],
      popular: true
    },
    {
      id: 'family',
      name: 'Family Plan',
      price: 29.99,
      currency: 'USD',
      interval: 'month',
      description: 'Share with your entire family',
      features: [
        '250 GB/month data',
        '200 Mbps connection speed',
        'Connect up to 10 devices',
        'Priority customer support',
        'Advanced security features',
        'Ad blocking included',
        'Parental controls',
        'Multi-user dashboard',
        '30-day money-back guarantee'
      ],
      popular: false
    }
  ];

  res.json({ plans });
});

// Create payment intent (Stripe)
router.post('/create-payment-intent', authenticateToken, async (req, res) => {
  try {
    const { planId, paymentMethodId } = req.body;
    const { username } = req.user;

    // Mock Stripe payment intent creation
    // TODO: Implement real Stripe integration

    const plans = {
      basic: { amount: 999, currency: 'usd' },    // $9.99
      premium: { amount: 1999, currency: 'usd' }, // $19.99
      family: { amount: 2999, currency: 'usd' }   // $29.99
    };

    const plan = plans[planId];
    if (!plan) {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }

    // Mock payment intent
    const paymentIntent = {
      id: `pi_mock_${Date.now()}`,
      client_secret: `pi_mock_secret_${Date.now()}`,
      amount: plan.amount,
      currency: plan.currency,
      status: 'requires_payment_method'
    };

    res.json({
      paymentIntent,
      plan: planId,
      username
    });

  } catch (error) {
    console.error('[!] Payment intent creation error:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

// Confirm payment (Stripe webhook would handle this in production)
router.post('/confirm-payment', authenticateToken, async (req, res) => {
  try {
    const { paymentIntentId, planId } = req.body;
    const { username } = req.user;

    // Mock payment confirmation
    // TODO: Verify with Stripe webhook

    // Update user plan in database
    const { getPlanAttributes } = require('../utils/database');
    const planAttributes = getPlanAttributes(planId);

    // TODO: Update user attributes in database based on new plan

    res.json({
      success: true,
      message: 'Payment confirmed successfully',
      plan: planId,
      username
    });

  } catch (error) {
    console.error('[!] Payment confirmation error:', error);
    res.status(500).json({ error: 'Failed to confirm payment' });
  }
});

// Get billing history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { username } = req.user;

    // Mock billing history
    const history = [
      {
        id: 'inv_001',
        date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        amount: 19.99,
        currency: 'USD',
        status: 'paid',
        plan: 'premium',
        description: 'Premium Plan - Monthly'
      },
      {
        id: 'inv_002',
        date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        amount: 19.99,
        currency: 'USD',
        status: 'paid',
        plan: 'premium',
        description: 'Premium Plan - Monthly'
      }
    ];

    res.json({ history });

  } catch (error) {
    console.error('[!] Billing history error:', error);
    res.status(500).json({ error: 'Failed to fetch billing history' });
  }
});

// Cancel subscription
router.post('/cancel', authenticateToken, async (req, res) => {
  try {
    const { username } = req.user;

    // Mock subscription cancellation
    // TODO: Cancel with Stripe

    res.json({
      success: true,
      message: 'Subscription cancelled successfully',
      effectiveDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      username
    });

  } catch (error) {
    console.error('[!] Subscription cancellation error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

module.exports = router;
