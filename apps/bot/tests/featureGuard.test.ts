import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockGangFindFirst,
    mockMemberFindFirst,
    mockFeatureEnabled,
    mockCanAccessFeature,
    mockNormalizeSubscriptionTier,
    mockResolveEffectiveSubscriptionTier,
    mockEq,
    mockAnd,
} = vi.hoisted(() => ({
    mockGangFindFirst: vi.fn(),
    mockMemberFindFirst: vi.fn(),
    mockFeatureEnabled: vi.fn(),
    mockCanAccessFeature: vi.fn(),
    mockNormalizeSubscriptionTier: vi.fn((tier: string) => tier),
    mockResolveEffectiveSubscriptionTier: vi.fn((tier: string) => tier),
    mockEq: vi.fn((left, right) => ({ left, right })),
    mockAnd: vi.fn((...conditions: unknown[]) => conditions),
}));

vi.mock('@gang/database', () => ({
    db: {
        query: {
            gangs: {
                findFirst: mockGangFindFirst,
            },
            members: {
                findFirst: mockMemberFindFirst,
            },
        },
    },
    FeatureFlagService: {
        isEnabled: mockFeatureEnabled,
    },
    gangs: {
        discordGuildId: 'gangs.discord_guild_id',
    },
    members: {
        gangId: 'members.gang_id',
        discordId: 'members.discord_id',
        isActive: 'members.is_active',
        status: 'members.status',
    },
    canAccessFeature: mockCanAccessFeature,
    normalizeSubscriptionTier: mockNormalizeSubscriptionTier,
    resolveEffectiveSubscriptionTier: mockResolveEffectiveSubscriptionTier,
}));

vi.mock('drizzle-orm', () => ({
    and: mockAnd,
    eq: mockEq,
}));

import {
    checkFeatureEnabled,
    checkFeatureForGuild,
    checkGangSubscriptionFeatureAccess,
    checkMemberSubscriptionFeatureAccess,
} from '../src/utils/featureGuard';

function createInteraction(overrides?: Partial<any>) {
    return {
        replied: false,
        deferred: false,
        reply: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

describe('featureGuard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockResolveEffectiveSubscriptionTier.mockImplementation((tier: string) => tier);
    });

    it('replies when the feature flag is disabled', async () => {
        mockFeatureEnabled.mockResolvedValueOnce(false);
        const interaction = createInteraction();

        await expect(checkFeatureEnabled(interaction, 'finance', 'ระบบการเงิน')).resolves.toBe(false);

        expect(interaction.reply).toHaveBeenCalledTimes(1);
        expect(interaction.reply.mock.calls[0][0].content).toContain('ระบบการเงิน');
        expect(interaction.reply.mock.calls[0][0].content).not.toContain('à¸');
        expect(interaction.editReply).not.toHaveBeenCalled();
    });

    it('falls back to a readable feature label when callers pass mojibake', async () => {
        mockFeatureEnabled.mockResolvedValueOnce(false);
        const interaction = createInteraction();

        await expect(checkFeatureEnabled(interaction, 'finance', 'à¸£à¸°à¸šà¸šà¸à¸²à¸£à¹€à¸‡à¸´à¸™')).resolves.toBe(false);

        expect(interaction.reply).toHaveBeenCalledTimes(1);
        expect(interaction.reply.mock.calls[0][0].content).toContain('ฟีเจอร์นี้');
        expect(interaction.reply.mock.calls[0][0].content).not.toContain('à¸');
    });

    it('resolves the gang for a guild and confirms the feature is enabled', async () => {
        mockGangFindFirst.mockResolvedValueOnce({ id: 'gang-1' });
        mockFeatureEnabled.mockResolvedValueOnce(true);
        const interaction = createInteraction();

        await expect(
            checkFeatureForGuild(interaction, 'guild-1', 'attendance', 'Attendance')
        ).resolves.toEqual({ gangId: 'gang-1', allowed: true });
    });

    it('blocks access when the command is used outside a guild', async () => {
        mockFeatureEnabled.mockResolvedValueOnce(true);
        const interaction = createInteraction();

        const result = await checkGangSubscriptionFeatureAccess(
            interaction,
            null,
            'finance',
            'ระบบการเงิน'
        );

        expect(result).toEqual({ gang: null, allowed: false });
        expect(interaction.reply).toHaveBeenCalledTimes(1);
        expect(interaction.reply.mock.calls[0][0].content).toContain('เฉพาะในเซิร์ฟเวอร์');
    });

    it('blocks access when the gang tier does not include the feature', async () => {
        mockFeatureEnabled.mockResolvedValueOnce(true);
        mockGangFindFirst.mockResolvedValueOnce({
            id: 'gang-1',
            name: 'Tokyo',
            subscriptionTier: 'FREE',
            subscriptionExpiresAt: null,
            balance: 0,
        });
        mockCanAccessFeature.mockReturnValueOnce(false);
        const interaction = createInteraction();

        const result = await checkGangSubscriptionFeatureAccess(
            interaction,
            'guild-1',
            'finance',
            'ระบบการเงิน'
        );

        expect(result).toEqual({
            gang: {
                id: 'gang-1',
                name: 'Tokyo',
                subscriptionTier: 'FREE',
                balance: 0,
            },
            allowed: false,
        });
        expect(mockNormalizeSubscriptionTier).toHaveBeenCalledWith('FREE');
        expect(interaction.reply).toHaveBeenCalledTimes(1);
        expect(interaction.reply.mock.calls[0][0].content).toContain('ระบบการเงิน');
        expect(interaction.reply.mock.calls[0][0].content).not.toContain('à¸');
    });

    it('blocks access when the member record is missing', async () => {
        mockFeatureEnabled.mockResolvedValueOnce(true);
        mockGangFindFirst.mockResolvedValueOnce({
            id: 'gang-1',
            name: 'Tokyo',
            subscriptionTier: 'PREMIUM',
            subscriptionExpiresAt: null,
            balance: 500,
        });
        mockCanAccessFeature.mockReturnValueOnce(true);
        mockMemberFindFirst.mockResolvedValueOnce(null);
        const interaction = createInteraction({ deferred: true });

        const result = await checkMemberSubscriptionFeatureAccess(
            interaction,
            'guild-1',
            'discord-1',
            'finance',
            'ระบบการเงิน',
            {
                requireApprovedMember: true,
            }
        );

        expect(result).toEqual({
            gang: {
                id: 'gang-1',
                name: 'Tokyo',
                subscriptionTier: 'PREMIUM',
                balance: 500,
            },
            member: null,
            allowed: false,
        });
        expect(interaction.editReply).toHaveBeenCalledTimes(1);
        expect(interaction.editReply.mock.calls[0][0]).toContain('ไม่พบข้อมูลสมาชิก');
        expect(interaction.editReply.mock.calls[0][0]).not.toContain('à¸');
    });

    it('allows approved active members on supported tiers', async () => {
        mockFeatureEnabled.mockResolvedValueOnce(true);
        mockGangFindFirst.mockResolvedValueOnce({
            id: 'gang-1',
            name: 'Tokyo',
            subscriptionTier: 'PREMIUM',
            subscriptionExpiresAt: null,
            balance: 900,
        });
        mockCanAccessFeature.mockReturnValueOnce(true);
        mockMemberFindFirst.mockResolvedValueOnce({
            id: 'member-1',
            name: 'Dekisugi',
            discordId: 'discord-1',
            gangId: 'gang-1',
            gangRole: 'ADMIN',
            status: 'APPROVED',
            balance: 200,
        });
        const interaction = createInteraction();

        const result = await checkMemberSubscriptionFeatureAccess(
            interaction,
            'guild-1',
            'discord-1',
            'finance',
            'ระบบการเงิน',
            {
                requireApprovedMember: true,
            }
        );

        expect(result).toEqual({
            gang: {
                id: 'gang-1',
                name: 'Tokyo',
                subscriptionTier: 'PREMIUM',
                balance: 900,
            },
            member: {
                id: 'member-1',
                name: 'Dekisugi',
                discordId: 'discord-1',
                gangId: 'gang-1',
                gangRole: 'ADMIN',
                status: 'APPROVED',
                balance: 200,
            },
            allowed: true,
        });
        expect(interaction.reply).not.toHaveBeenCalled();
        expect(interaction.editReply).not.toHaveBeenCalled();
    });
});
