import { describe, expect, it } from 'vitest';

import { BILLING_PLANS, BILLING_PLAN_MAP } from '@/lib/billingPlans';

describe('billingPlans config', () => {
    it('exports exactly the canonical FREE and PREMIUM plans', () => {
        expect(BILLING_PLANS.map((plan) => plan.id)).toEqual(['FREE', 'PREMIUM']);
    });

    it('keeps the shared plan map in sync with the plan list', () => {
        expect(BILLING_PLAN_MAP.FREE).toBeDefined();
        expect(BILLING_PLAN_MAP.PREMIUM).toBeDefined();
        expect(BILLING_PLAN_MAP.FREE.name).toBe('Free');
        expect(BILLING_PLAN_MAP.PREMIUM.name).toBe('Premium');
    });

    it('keeps pricing and member limits aligned with the current billing model', () => {
        expect(BILLING_PLAN_MAP.FREE.priceMonthly).toBe(0);
        expect(BILLING_PLAN_MAP.FREE.priceYearly).toBe(0);
        expect(BILLING_PLAN_MAP.FREE.maxMembers).toBe(15);

        expect(BILLING_PLAN_MAP.PREMIUM.priceMonthly).toBe(179);
        expect(BILLING_PLAN_MAP.PREMIUM.priceYearly).toBe(1790);
        expect(BILLING_PLAN_MAP.PREMIUM.maxMembers).toBe(40);
    });

    it('marks only PREMIUM as the popular paid plan', () => {
        expect(BILLING_PLAN_MAP.FREE.popular).toBeUndefined();
        expect(BILLING_PLAN_MAP.PREMIUM.popular).toBe(true);
    });
});
