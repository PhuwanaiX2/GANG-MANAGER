import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@gang/database');

import { FeatureFlagService, db, getTierConfig, canAccessFeature, resolveEffectiveSubscriptionTier } from '@gang/database';
import { checkTierAccess, isFeatureEnabled } from '@/lib/tierGuard';
import { PAYMENT_PAUSED_COPY } from '@/lib/paymentReadiness';

describe('tierGuard', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        (resolveEffectiveSubscriptionTier as any).mockImplementation((tier: string | null | undefined) => (
            tier === 'TRIAL' ? 'TRIAL' : tier === 'PREMIUM' || tier === 'PRO' ? 'PREMIUM' : 'FREE'
        ));
        (getTierConfig as any).mockImplementation((tier: string) => ({
            name: tier === 'FREE' ? 'Free' : tier === 'TRIAL' ? 'Trial' : 'Premium',
            features: {},
        }));
        (db as any).query = {
            gangs: {
                findFirst: vi.fn().mockResolvedValue({ subscriptionTier: 'FREE', subscriptionExpiresAt: null }),
            },
        };
    });

    it('returns a disabled-by-admin result when the global feature flag is off', async () => {
        (FeatureFlagService.isEnabled as any).mockResolvedValue(false);
        (db as any).query.gangs.findFirst.mockResolvedValue({ subscriptionTier: 'PRO', subscriptionExpiresAt: null });

        const result = await checkTierAccess('gang-123', 'finance');

        expect(result.allowed).toBe(false);
        expect(result.disabledByAdmin).toBe(true);
        expect(result.tier).toBe('PREMIUM');
        expect(result.message).toContain('ผู้ดูแลระบบ');
    });

    it('returns a payment-paused premium message when the gang tier lacks access', async () => {
        (FeatureFlagService.isEnabled as any).mockResolvedValue(true);
        (db as any).query.gangs.findFirst.mockResolvedValue({ subscriptionTier: 'FREE', subscriptionExpiresAt: null });
        (canAccessFeature as any).mockReturnValue(false);

        const result = await checkTierAccess('gang-123', 'analytics');

        expect(result.allowed).toBe(false);
        expect(result.tier).toBe('FREE');
        expect(result.message).toContain('Premium');
        expect(result.message).toContain(PAYMENT_PAUSED_COPY.lockedFeature);
    });

    it('returns an allowed result with trial tier when access is granted', async () => {
        (FeatureFlagService.isEnabled as any).mockResolvedValue(true);
        (db as any).query.gangs.findFirst.mockResolvedValue({ subscriptionTier: 'TRIAL', subscriptionExpiresAt: null });
        (canAccessFeature as any).mockReturnValue(true);

        const result = await checkTierAccess('gang-123', 'exportCSV');

        expect(result.allowed).toBe(true);
        expect(result.tier).toBe('TRIAL');
        expect(result.message).toBeUndefined();
    });

    it('uses effective tier so expired paid access is treated as free even before scheduler cleanup', async () => {
        (FeatureFlagService.isEnabled as any).mockResolvedValue(true);
        const expiredAt = new Date('2026-01-01T00:00:00.000Z');
        (db as any).query.gangs.findFirst.mockResolvedValue({
            subscriptionTier: 'PREMIUM',
            subscriptionExpiresAt: expiredAt,
        });
        (resolveEffectiveSubscriptionTier as any).mockReturnValue('FREE');
        (canAccessFeature as any).mockReturnValue(false);

        const result = await checkTierAccess('gang-123', 'finance');

        expect(resolveEffectiveSubscriptionTier).toHaveBeenCalledWith('PREMIUM', expiredAt);
        expect(canAccessFeature).toHaveBeenCalledWith('FREE', 'finance');
        expect(result.allowed).toBe(false);
        expect(result.tier).toBe('FREE');
    });

    it('passes through standalone feature flag checks', async () => {
        (FeatureFlagService.isEnabled as any).mockResolvedValue(true);

        await expect(isFeatureEnabled('finance')).resolves.toBe(true);
        expect(FeatureFlagService.isEnabled).toHaveBeenCalledWith(db, 'finance');
    });
});
