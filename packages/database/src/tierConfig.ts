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

export type SubscriptionTier = 'FREE' | 'TRIAL' | 'PREMIUM';
export type BillingPeriod = 'monthly' | 'yearly';

const DEFAULT_EXPIRED_SUBSCRIPTION_GRACE_DAYS = 3;

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
    TRIAL: {
        name: 'Trial',
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
        auditLogRetentionDays: -1,
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
        price: 179,
    },
};

// Legacy PRO values are normalized for backward compatibility.
export function normalizeSubscriptionTier(tier: string | null | undefined): SubscriptionTier {
    if (tier === 'TRIAL') {
        return 'TRIAL';
    }
    if (tier === 'PREMIUM' || tier === 'PRO') {
        return 'PREMIUM';
    }
    return 'FREE';
}

export function resolveEffectiveSubscriptionTier(
    tier: string | null | undefined,
    expiresAt?: Date | string | number | null,
    options?: { now?: Date; graceDays?: number }
): SubscriptionTier {
    const normalizedTier = normalizeSubscriptionTier(tier);
    if (normalizedTier === 'FREE') {
        return 'FREE';
    }

    if (!expiresAt) {
        return normalizedTier;
    }

    const expiresAtDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
    if (Number.isNaN(expiresAtDate.getTime())) {
        return 'FREE';
    }

    const now = options?.now ?? new Date();
    const graceDays = options?.graceDays ?? DEFAULT_EXPIRED_SUBSCRIPTION_GRACE_DAYS;
    const graceEndsAt = expiresAtDate.getTime() + graceDays * 24 * 60 * 60 * 1000;

    return now.getTime() > graceEndsAt ? 'FREE' : normalizedTier;
}

export function getTierRank(tier: string | null | undefined): number {
    const normalizedTier = normalizeSubscriptionTier(tier);
    return normalizedTier === 'FREE' ? 0 : 1;
}

export function getTierConfig(tier: string): TierConfig {
    return TIER_CONFIGS[normalizeSubscriptionTier(tier)];
}

export function getSubscriptionAmount(tier: string, billing: BillingPeriod): number {
    const normalizedTier = normalizeSubscriptionTier(tier);
    if (normalizedTier !== 'PREMIUM') {
        return 0;
    }

    return billing === 'yearly' ? 1790 : TIER_CONFIGS.PREMIUM.price;
}

export function getSubscriptionDurationDays(billing: BillingPeriod): number {
    return billing === 'yearly' ? 365 : 30;
}

export function canAccessFeature(tier: string, feature: keyof TierConfig['features']): boolean {
    const config = getTierConfig(tier);
    return config.features[feature];
}

export function canAccessFeatureWithExpiry(
    tier: string | null | undefined,
    expiresAt: Date | string | number | null | undefined,
    feature: keyof TierConfig['features'],
    options?: { now?: Date; graceDays?: number }
): boolean {
    return canAccessFeature(resolveEffectiveSubscriptionTier(tier, expiresAt, options), feature);
}

export function isAtOrAboveTier(currentTier: string, requiredTier: SubscriptionTier): boolean {
    return getTierRank(currentTier) >= getTierRank(requiredTier);
}
