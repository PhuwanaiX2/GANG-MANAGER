import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripeInstance(): Stripe {
    if (!_stripe) {
        const key = process.env.STRIPE_SECRET_KEY;
        if (!key) {
            throw new Error('STRIPE_SECRET_KEY is not set');
        }
        _stripe = new Stripe(key);
    }
    return _stripe;
}

export { Stripe };

export const stripe = {
    get customers() { return getStripeInstance().customers; },
    get checkout() { return getStripeInstance().checkout; },
    get webhooks() { return getStripeInstance().webhooks; },
    get subscriptions() { return getStripeInstance().subscriptions; },
};

// Price IDs from Stripe Dashboard — set these in env vars
export const PRICE_IDS: Record<string, Record<string, string>> = {
    monthly: {
        PRO: process.env.STRIPE_PRICE_PRO || '',
        PREMIUM: process.env.STRIPE_PRICE_PREMIUM || '',
    },
    yearly: {
        PRO: process.env.STRIPE_PRICE_PRO_YEARLY || '',
        PREMIUM: process.env.STRIPE_PRICE_PREMIUM_YEARLY || '',
    },
};

export function getPriceId(tier: string, billing: 'monthly' | 'yearly' = 'monthly'): string | null {
    return PRICE_IDS[billing]?.[tier] || null;
}

