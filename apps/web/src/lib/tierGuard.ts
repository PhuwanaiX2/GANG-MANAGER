import { db, gangs, getTierConfig, canAccessFeature } from '@gang/database';
import { eq } from 'drizzle-orm';
import type { TierConfig } from '@gang/database';

export type Feature = 'finance' | 'exportCSV' | 'monthlySummary' | 'analytics' | 'customBranding' | 'dailyBackup';

export interface TierCheckResult {
    allowed: boolean;
    tier: string;
    tierConfig: TierConfig;
    message?: string;
}

export async function checkTierAccess(gangId: string, feature: Feature): Promise<TierCheckResult> {
    const gang = await db.query.gangs.findFirst({
        where: eq(gangs.id, gangId),
        columns: { subscriptionTier: true },
    });

    const tier = gang?.subscriptionTier || 'FREE';
    const tierConfig = getTierConfig(tier);
    const allowed = canAccessFeature(tier, feature);

    return {
        allowed,
        tier,
        tierConfig,
        message: allowed ? undefined : `ฟีเจอร์นี้ต้องการแพลน PRO ขึ้นไป (ปัจจุบัน: ${tierConfig.name})`,
    };
}
