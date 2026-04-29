import { describe, expect, it } from 'vitest';
import {
    canAccessFeatureWithExpiry,
    resolveEffectiveSubscriptionTier,
} from '@gang/database';

describe('subscription tier expiry helpers', () => {
    const now = new Date('2026-04-29T00:00:00.000Z');

    it('keeps paid access when there is no expiry timestamp', () => {
        expect(resolveEffectiveSubscriptionTier('PREMIUM', null, { now })).toBe('PREMIUM');
        expect(resolveEffectiveSubscriptionTier('TRIAL', undefined, { now })).toBe('TRIAL');
    });

    it('keeps paid access during the configured grace window', () => {
        const expiredYesterday = new Date('2026-04-28T00:00:00.000Z');

        expect(resolveEffectiveSubscriptionTier('PREMIUM', expiredYesterday, { now, graceDays: 3 })).toBe('PREMIUM');
    });

    it('downgrades expired paid access to free after the grace window', () => {
        const expiredLastWeek = new Date('2026-04-20T00:00:00.000Z');

        expect(resolveEffectiveSubscriptionTier('PREMIUM', expiredLastWeek, { now, graceDays: 3 })).toBe('FREE');
        expect(canAccessFeatureWithExpiry('PREMIUM', expiredLastWeek, 'finance', { now, graceDays: 3 })).toBe(false);
    });

    it('treats invalid expiry values as free for safety', () => {
        expect(resolveEffectiveSubscriptionTier('PREMIUM', 'not-a-date', { now })).toBe('FREE');
    });
});
