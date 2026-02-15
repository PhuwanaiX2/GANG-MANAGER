export type SubscriptionTier = 'FREE' | 'TRIAL' | 'PRO' | 'PREMIUM';

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
        maxMembers: 10,
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
    TRIAL: {
        name: 'Trial',
        maxMembers: 25,
        features: {
            finance: true,
            gangFee: true,
            exportCSV: false,
            monthlySummary: false,
            analytics: false,
            customBranding: false,
            dailyBackup: true,
            multiAdmin: false,
            webhookNotify: false,
        },
        auditLogRetentionDays: 30,
        price: 0,
    },
    PRO: {
        name: 'Pro',
        maxMembers: 25,
        features: {
            finance: true,
            gangFee: true,
            exportCSV: true,
            monthlySummary: false,
            analytics: false,
            customBranding: false,
            dailyBackup: true,
            multiAdmin: false,
            webhookNotify: false,
        },
        auditLogRetentionDays: 90,
        price: 149,
    },
    PREMIUM: {
        name: 'Premium',
        maxMembers: 50,
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
        price: 299,
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
    const tierOrder: SubscriptionTier[] = ['FREE', 'TRIAL', 'PRO', 'PREMIUM'];
    const currentIndex = tierOrder.indexOf(currentTier as SubscriptionTier);
    const requiredIndex = tierOrder.indexOf(requiredTier);
    return currentIndex >= requiredIndex;
}
