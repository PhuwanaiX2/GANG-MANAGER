import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockGangFindFirst,
    mockCreateTransaction,
    mockCheckFeatureEnabled,
    mockCheckGangSubscriptionFeatureAccess,
    mockGetGangMemberByDiscordId,
    mockHasPermissionLevel,
    mockLogError,
    mockEq,
} = vi.hoisted(() => ({
    mockGangFindFirst: vi.fn(),
    mockCreateTransaction: vi.fn(),
    mockCheckFeatureEnabled: vi.fn(),
    mockCheckGangSubscriptionFeatureAccess: vi.fn(),
    mockGetGangMemberByDiscordId: vi.fn(),
    mockHasPermissionLevel: vi.fn(),
    mockLogError: vi.fn(),
    mockEq: vi.fn((left, right) => ({ left, right })),
}));

vi.mock('@gang/database', () => ({
    db: {
        query: {
            gangs: {
                findFirst: mockGangFindFirst,
            },
        },
    },
    gangs: {
        discordGuildId: 'gangs.discord_guild_id',
    },
    FinanceService: {
        createTransaction: mockCreateTransaction,
    },
}));

vi.mock('drizzle-orm', () => ({
    eq: mockEq,
}));

vi.mock('../src/utils/featureGuard', () => ({
    checkFeatureEnabled: mockCheckFeatureEnabled,
    checkGangSubscriptionFeatureAccess: mockCheckGangSubscriptionFeatureAccess,
}));

vi.mock('../src/utils/permissions', () => ({
    getGangMemberByDiscordId: mockGetGangMemberByDiscordId,
    hasPermissionLevel: mockHasPermissionLevel,
}));

vi.mock('../src/utils/logger', () => ({
    logError: mockLogError,
}));

import { expenseCommand, incomeCommand } from '../src/commands/financeOps';

function createInteraction(overrides?: Partial<any>) {
    return {
        guildId: 'guild-1',
        user: {
            id: 'discord-1',
        },
        deferReply: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
        options: {
            getNumber: vi.fn((name: string) => (name === 'amount' ? 5000 : null)),
            getString: vi.fn((name: string) => (name === 'description' ? 'ค่าของกลาง' : null)),
        },
        ...overrides,
    };
}

describe('finance slash commands', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mockCheckFeatureEnabled.mockResolvedValue(true);
        mockCheckGangSubscriptionFeatureAccess.mockResolvedValue({
            gang: {
                id: 'gang-1',
                name: 'Tokyo',
                subscriptionTier: 'PREMIUM',
                balance: 10000,
            },
            allowed: true,
        });
        mockGangFindFirst.mockResolvedValue({
            id: 'gang-1',
        });
        mockGetGangMemberByDiscordId.mockResolvedValue({
            id: 'member-1',
            name: 'Nobita',
            gangRole: 'TREASURER',
        });
        mockHasPermissionLevel.mockReturnValue(true);
        mockCreateTransaction.mockResolvedValue({
            newGangBalance: 15000,
        });
    });

    it('stops immediately when the finance feature flag is disabled', async () => {
        mockCheckFeatureEnabled.mockResolvedValueOnce(false);
        const interaction = createInteraction();

        await incomeCommand.execute(interaction as any);

        expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
        expect(mockCheckGangSubscriptionFeatureAccess).not.toHaveBeenCalled();
        expect(mockGangFindFirst).not.toHaveBeenCalled();
        expect(interaction.editReply).not.toHaveBeenCalled();
    });

    it('rejects members without treasurer-level permission', async () => {
        mockHasPermissionLevel.mockReturnValueOnce(false);
        const interaction = createInteraction();

        await expenseCommand.execute(interaction as any);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.stringContaining('ไม่มีสิทธิ์')
        );
        expect(mockCreateTransaction).not.toHaveBeenCalled();
    });

    it('maps insufficient funds errors to a friendly reply', async () => {
        mockCreateTransaction.mockRejectedValueOnce(new Error('INSUFFICIENT_FUNDS'));
        const interaction = createInteraction();

        await expenseCommand.execute(interaction as any);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.stringContaining('เงินกองกลางไม่เพียงพอ')
        );
        expect(mockLogError).not.toHaveBeenCalled();
    });

    it('creates the transaction and returns a success confirmation for treasurer users', async () => {
        const interaction = createInteraction();

        await incomeCommand.execute(interaction as any);

        expect(mockCreateTransaction).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                gangId: 'gang-1',
                type: 'INCOME',
                amount: 5000,
                description: 'ค่าของกลาง',
                actorId: 'member-1',
                actorName: 'Nobita',
            })
        );
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('สำเร็จ'),
                embeds: expect.any(Array),
            })
        );
    });
});
