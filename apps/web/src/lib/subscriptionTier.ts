export type NormalizedSubscriptionTier = 'FREE' | 'PREMIUM';

// Legacy TRIAL/PRO values are normalized for client-side backward compatibility only.
export function normalizeSubscriptionTierValue(tier: string | null | undefined): NormalizedSubscriptionTier {
    if (tier === 'PREMIUM' || tier === 'PRO' || tier === 'TRIAL') {
        return 'PREMIUM';
    }

    return 'FREE';
}

export function getSubscriptionTierBadgeClass(tier: string | null | undefined): string {
    return normalizeSubscriptionTierValue(tier) === 'PREMIUM'
        ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
        : 'bg-gray-500/10 text-gray-400 border-gray-500/20';
}

export function getSubscriptionTierTextClass(tier: string | null | undefined): string {
    return normalizeSubscriptionTierValue(tier) === 'PREMIUM'
        ? 'text-purple-400'
        : 'text-gray-400';
}
