import { db, gangs, getTierConfig, canAccessFeature, FeatureFlagService, resolveEffectiveSubscriptionTier } from '@gang/database';
import { eq } from 'drizzle-orm';
import type { SubscriptionTier, TierConfig } from '@gang/database';
import { PAYMENT_PAUSED_COPY } from './paymentReadiness';

export type Feature = 'finance' | 'gangFee' | 'exportCSV' | 'monthlySummary' | 'analytics' | 'customBranding' | 'dailyBackup' | 'multiAdmin' | 'webhookNotify';

// Map tier feature names to global feature flag keys
const FEATURE_TO_FLAG_KEY: Partial<Record<Feature, string>> = {
    finance: 'finance',
    gangFee: 'finance',
    exportCSV: 'export_csv',
    monthlySummary: 'monthly_summary',
    analytics: 'analytics',
};

export interface TierCheckResult {
    allowed: boolean;
    tier: SubscriptionTier;
    tierConfig: TierConfig;
    message?: string;
    disabledByAdmin?: boolean;
}

export async function checkTierAccess(gangId: string, feature: Feature): Promise<TierCheckResult> {
    // 1. Check global feature flag first (super admin kill-switch)
    const flagKey = FEATURE_TO_FLAG_KEY[feature];
    if (flagKey) {
        const globalEnabled = await FeatureFlagService.isEnabled(db, flagKey);
        if (!globalEnabled) {
            const gang = await db.query.gangs.findFirst({
                where: eq(gangs.id, gangId),
                columns: { subscriptionTier: true, subscriptionExpiresAt: true },
            });
            const tier = resolveEffectiveSubscriptionTier(gang?.subscriptionTier, gang?.subscriptionExpiresAt);
            return {
                allowed: false,
                tier,
                tierConfig: getTierConfig(tier),
                message: 'ฟีเจอร์นี้ถูกปิดใช้งานชั่วคราวโดยผู้ดูแลระบบ',
                disabledByAdmin: true,
            };
        }
    }

    // 2. Normal tier-based access check
    const gang = await db.query.gangs.findFirst({
        where: eq(gangs.id, gangId),
        columns: { subscriptionTier: true, subscriptionExpiresAt: true },
    });

    const tier = resolveEffectiveSubscriptionTier(gang?.subscriptionTier, gang?.subscriptionExpiresAt);
    const tierConfig = getTierConfig(tier);
    const allowed = canAccessFeature(tier, feature);

    return {
        allowed,
        tier,
        tierConfig,
        message: allowed
            ? undefined
            : `${PAYMENT_PAUSED_COPY.lockedFeature} (ปัจจุบัน: ${tierConfig.name})`,
    };
}

/**
 * Standalone check: is a feature globally enabled by super admin?
 * Use this in dashboard pages to show maintenance banners.
 */
export async function isFeatureEnabled(flagKey: string): Promise<boolean> {
    return FeatureFlagService.isEnabled(db, flagKey);
}
