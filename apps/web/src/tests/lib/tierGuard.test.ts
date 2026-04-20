import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@gang/database');

import { FeatureFlagService, db, getTierConfig, canAccessFeature, normalizeSubscriptionTier } from '@gang/database';
import { checkTierAccess, isFeatureEnabled } from '@/lib/tierGuard';

describe('tierGuard', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        (normalizeSubscriptionTier as any).mockImplementation((tier: string | null | undefined) => (
            tier === 'PREMIUM' || tier === 'PRO' || tier === 'TRIAL' ? 'PREMIUM' : 'FREE'
        ));
        (getTierConfig as any).mockImplementation((tier: string) => ({
            name: tier === 'PREMIUM' ? 'Premium' : 'Free',
            features: {},
        }));
        (db as any).query = {
            gangs: {
                findFirst: vi.fn().mockResolvedValue({ subscriptionTier: 'FREE' }),
            },
        };
    });

    it('returns a disabled-by-admin result when the global feature flag is off', async () => {
        (FeatureFlagService.isEnabled as any).mockResolvedValue(false);
        (db as any).query.gangs.findFirst.mockResolvedValue({ subscriptionTier: 'PRO' });

        const result = await checkTierAccess('gang-123', 'finance');

        expect(result.allowed).toBe(false);
        expect(result.disabledByAdmin).toBe(true);
        expect(result.tier).toBe('PREMIUM');
        expect(result.message).toContain('ผู้ดูแลระบบ');
    });

    it('returns a premium-required message when the gang tier lacks access', async () => {
        (FeatureFlagService.isEnabled as any).mockResolvedValue(true);
        (db as any).query.gangs.findFirst.mockResolvedValue({ subscriptionTier: 'FREE' });
        (canAccessFeature as any).mockReturnValue(false);

        const result = await checkTierAccess('gang-123', 'analytics');

        expect(result.allowed).toBe(false);
        expect(result.tier).toBe('FREE');
        expect(result.message).toContain('Premium');
    });

    it('returns an allowed result with normalized premium tier when access is granted', async () => {
        (FeatureFlagService.isEnabled as any).mockResolvedValue(true);
        (db as any).query.gangs.findFirst.mockResolvedValue({ subscriptionTier: 'TRIAL' });
        (canAccessFeature as any).mockReturnValue(true);

        const result = await checkTierAccess('gang-123', 'exportCSV');

        expect(result.allowed).toBe(true);
        expect(result.tier).toBe('PREMIUM');
        expect(result.message).toBeUndefined();
    });

    it('passes through standalone feature flag checks', async () => {
        (FeatureFlagService.isEnabled as any).mockResolvedValue(true);

        await expect(isFeatureEnabled('finance')).resolves.toBe(true);
        expect(FeatureFlagService.isEnabled).toHaveBeenCalledWith(db, 'finance');
    });
});
