export type NormalizedSubscriptionTier = 'FREE' | 'TRIAL' | 'PREMIUM';

// Legacy PRO values are normalized for client-side backward compatibility.
export function normalizeSubscriptionTierValue(tier: string | null | undefined): NormalizedSubscriptionTier {
    if (tier === 'TRIAL') {
        return 'TRIAL';
    }
    if (tier === 'PREMIUM' || tier === 'PRO') {
        return 'PREMIUM';
    }

    return 'FREE';
}

export function getSubscriptionTierBadgeClass(tier: string | null | undefined): string {
    return normalizeSubscriptionTierValue(tier) !== 'FREE'
        ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
        : 'bg-gray-500/10 text-gray-400 border-gray-500/20';
}

export function getSubscriptionTierTextClass(tier: string | null | undefined): string {
    return normalizeSubscriptionTierValue(tier) !== 'FREE'
        ? 'text-purple-400'
        : 'text-gray-400';
}
