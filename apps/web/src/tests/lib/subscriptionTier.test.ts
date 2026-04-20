import { describe, expect, it } from 'vitest';

import {
    getSubscriptionTierBadgeClass,
    getSubscriptionTierTextClass,
    normalizeSubscriptionTierValue,
} from '@/lib/subscriptionTier';

describe('subscriptionTier helpers', () => {
    it('normalizes legacy and canonical paid tiers to PREMIUM', () => {
        expect(normalizeSubscriptionTierValue('PREMIUM')).toBe('PREMIUM');
        expect(normalizeSubscriptionTierValue('PRO')).toBe('PREMIUM');
        expect(normalizeSubscriptionTierValue('TRIAL')).toBe('PREMIUM');
    });

    it('normalizes nullish and unknown values to FREE', () => {
        expect(normalizeSubscriptionTierValue('FREE')).toBe('FREE');
        expect(normalizeSubscriptionTierValue(undefined)).toBe('FREE');
        expect(normalizeSubscriptionTierValue(null)).toBe('FREE');
        expect(normalizeSubscriptionTierValue('UNKNOWN')).toBe('FREE');
    });

    it('returns the premium badge/text classes for paid tiers', () => {
        expect(getSubscriptionTierBadgeClass('PRO')).toContain('text-purple-400');
        expect(getSubscriptionTierTextClass('TRIAL')).toBe('text-purple-400');
    });

    it('returns the free badge/text classes for free tiers', () => {
        expect(getSubscriptionTierBadgeClass('FREE')).toContain('text-gray-400');
        expect(getSubscriptionTierTextClass(undefined)).toBe('text-gray-400');
    });
});
