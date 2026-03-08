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

export function getTierConfig(tier: string): TierConfig {
    return TIER_CONFIGS[tier as SubscriptionTier] || TIER_CONFIGS.FREE;
}

export function canAccessFeature(tier: string, feature: keyof TierConfig['features']): boolean {
    const config = getTierConfig(tier);
    return config.features[feature];
}

export function isAtOrAboveTier(currentTier: string, requiredTier: SubscriptionTier): boolean {
    const tierOrder: SubscriptionTier[] = ['FREE', 'PREMIUM'];
    const currentIndex = tierOrder.indexOf(currentTier as SubscriptionTier);
    const requiredIndex = tierOrder.indexOf(requiredTier);
    // Legacy tiers (TRIAL, PRO) map to FREE
    if (currentIndex === -1) return false;
    return currentIndex >= requiredIndex;
}
