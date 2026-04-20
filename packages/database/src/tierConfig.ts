export type SubscriptionTier = 'FREE' | 'PREMIUM';

export interface TierConfig {
    name: string;
    maxMembers: number;
    features: {
        finance: boolean;
        gangFee: boolean;
        exportCSV: boolean;
        monthlySummary: boolean;
        analytics: boolean;
        customBranding: boolean;
        dailyBackup: boolean;
        multiAdmin: boolean;
        webhookNotify: boolean;
    };
    auditLogRetentionDays: number;
    price: number; // THB per month
}

export const TIER_CONFIGS: Record<SubscriptionTier, TierConfig> = {
    FREE: {
        name: 'Free',
        maxMembers: 15,
        features: {
            finance: false,
            gangFee: false,
            exportCSV: false,
            monthlySummary: false,
            analytics: false,
            customBranding: false,
            dailyBackup: false,
            multiAdmin: false,
            webhookNotify: false,
        },
        auditLogRetentionDays: 7,
        price: 0,
    },
    PREMIUM: {
        name: 'Premium',
        maxMembers: 40,
        features: {
            finance: true,
            gangFee: true,
            exportCSV: true,
            monthlySummary: true,
            analytics: true,
            customBranding: true,
            dailyBackup: true,
            multiAdmin: true,
            webhookNotify: true,
        },
        auditLogRetentionDays: -1, // unlimited
        price: 199,
    },
};

// Legacy TRIAL/PRO values are normalized for backward compatibility only.
export function normalizeSubscriptionTier(tier: string | null | undefined): SubscriptionTier {
    if (tier === 'PREMIUM' || tier === 'PRO' || tier === 'TRIAL') {
        return 'PREMIUM';
    }
    return 'FREE';
}

export function getTierRank(tier: string | null | undefined): number {
    const normalizedTier = normalizeSubscriptionTier(tier);
    return normalizedTier === 'PREMIUM' ? 1 : 0;
}

export function getTierConfig(tier: string): TierConfig {
    return TIER_CONFIGS[normalizeSubscriptionTier(tier)];
}

export function canAccessFeature(tier: string, feature: keyof TierConfig['features']): boolean {
    const config = getTierConfig(tier);
    return config.features[feature];
}

export function isAtOrAboveTier(currentTier: string, requiredTier: SubscriptionTier): boolean {
    return getTierRank(currentTier) >= getTierRank(requiredTier);
}
