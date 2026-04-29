import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockGangFindFirst,
    mockMemberFindFirst,
    mockTransactionFindFirst,
    mockApproveTransaction,
    mockCheckFeatureEnabled,
    mockCheckGangSubscriptionFeatureAccess,
    mockCheckMemberSubscriptionFeatureAccess,
    mockGetMemberFinanceSnapshot,
    mockGetGangMemberByDiscordId,
    mockHasPermissionLevel,
    mockEq,
    mockAnd,
} = vi.hoisted(() => ({
    mockGangFindFirst: vi.fn(),
    mockMemberFindFirst: vi.fn(),
    mockTransactionFindFirst: vi.fn(),
    mockApproveTransaction: vi.fn(),
    mockCheckFeatureEnabled: vi.fn(),
    mockCheckGangSubscriptionFeatureAccess: vi.fn(),
    mockCheckMemberSubscriptionFeatureAccess: vi.fn(),
    mockGetMemberFinanceSnapshot: vi.fn(),
    mockGetGangMemberByDiscordId: vi.fn(),
    mockHasPermissionLevel: vi.fn(),
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
            transactions: {
                findFirst: mockTransactionFindFirst,
            },
        },
    },
    members: {},
    transactions: {
        id: 'transactions.id',
        status: 'transactions.status',
    },
    gangs: {
        discordGuildId: 'gangs.discord_guild_id',
    },
    gangSettings: {},
    gangRoles: {},
    canAccessFeature: vi.fn(() => true),
    FeatureFlagService: {
        isEnabled: vi.fn().mockResolvedValue(true),
    },
    FinanceService: {
        approveTransaction: mockApproveTransaction,
        createTransaction: vi.fn(),
    },
}));

vi.mock('drizzle-orm', () => ({
    eq: mockEq,
    and: mockAnd,
    sql: vi.fn((strings: TemplateStringsArray) => strings.join('')),
}));

vi.mock('../src/utils/featureGuard', () => ({
    checkFeatureEnabled: mockCheckFeatureEnabled,
    checkGangSubscriptionFeatureAccess: mockCheckGangSubscriptionFeatureAccess,
    checkMemberSubscriptionFeatureAccess: mockCheckMemberSubscriptionFeatureAccess,
}));

vi.mock('../src/utils/permissions', () => ({
    getGangMemberByDiscordId: mockGetGangMemberByDiscordId,
    hasPermissionLevel: mockHasPermissionLevel,
}));

vi.mock('../src/utils/financeSnapshot', () => ({
    getMemberFinanceSnapshot: mockGetMemberFinanceSnapshot,
}));

vi.mock('../src/utils/thaiTime', () => ({
    thaiTimestamp: vi.fn(() => '2026-04-23 17:00'),
}));

vi.mock('../src/utils/logger', () => ({
    logInfo: vi.fn(),
    logWarn: vi.fn(),
    logError: vi.fn(),
}));

vi.mock('nanoid', () => ({
    nanoid: vi.fn(() => 'tx-1'),
}));

import { handleButton } from '../src/handlers/buttons';
import { handleModal } from '../src/handlers/modals';
import '../src/features/finance';

function createButtonInteraction(overrides?: Partial<any>) {
    return {
        customId: 'fn_approve_tx-1',
        guildId: 'guild-1',
        user: {
            id: 'discord-1',
            username: 'nobita',
            displayName: 'Nobita',
            displayAvatarURL: vi.fn(() => 'https://avatar.test'),
        },
        client: {},
        message: {
            embeds: [],
            edit: vi.fn().mockResolvedValue(undefined),
        },
        showModal: vi.fn().mockResolvedValue(undefined),
        deferReply: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
        deleteReply: vi.fn().mockResolvedValue(undefined),
        reply: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

function createModalInteraction(overrides?: Partial<any>) {
    return {
        customId: 'admin_income_modal',
        guildId: 'guild-1',
        user: {
            id: 'discord-1',
            displayName: 'Nobita',
            username: 'nobita',
        },
        deferReply: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
        fields: {
            getTextInputValue: vi.fn((field: string) => {
                if (field === 'amount') return 'abc';
                if (field === 'description') return 'test';
                return '';
            }),
        },
        ...overrides,
    };
}

describe('finance button and modal flows', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mockCheckFeatureEnabled.mockResolvedValue(true);
        mockCheckGangSubscriptionFeatureAccess.mockResolvedValue({
            gang: {
                id: 'gang-1',
                name: 'Tokyo',
                subscriptionTier: 'PREMIUM',
                balance: 1000,
            },
            allowed: true,
        });
        mockCheckMemberSubscriptionFeatureAccess.mockResolvedValue({
            allowed: true,
            member: {
                id: 'member-1',
                gangId: 'gang-1',
                balance: 0,
                gang: {
                    id: 'gang-1',
                    balance: 1000,
                    subscriptionTier: 'PREMIUM',
                },
            },
            gang: {
                id: 'gang-1',
                subscriptionTier: 'PREMIUM',
            },
        });
        mockGangFindFirst.mockResolvedValue({
            id: 'gang-1',
            balance: 1000,
        });
        mockMemberFindFirst.mockResolvedValue({
            id: 'member-1',
            gangId: 'gang-1',
            discordId: 'discord-1',
            name: 'Nobita',
            balance: 0,
            gang: {
                id: 'gang-1',
                subscriptionTier: 'PREMIUM',
            },
        });
        mockGetMemberFinanceSnapshot.mockResolvedValue({
            loanDebt: 200,
            collectionDue: 75,
        });
    });

    it('blocks finance approval buttons for users without treasurer permission', async () => {
        mockGetGangMemberByDiscordId.mockResolvedValue({
            id: 'member-1',
            gangRole: 'MEMBER',
        });
        mockHasPermissionLevel.mockReturnValue(false);

        const interaction = createButtonInteraction();

        await handleButton(interaction as any);

        expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
        expect(interaction.editReply).toHaveBeenCalledWith(expect.any(String));
        expect(mockApproveTransaction).not.toHaveBeenCalled();
    });

    it('approves pending finance requests and closes the ephemeral reply', async () => {
        mockGetGangMemberByDiscordId.mockResolvedValue({
            id: 'member-1',
            name: 'Nobita',
            gangRole: 'TREASURER',
        });
        mockHasPermissionLevel.mockReturnValue(true);
        mockTransactionFindFirst.mockResolvedValue({
            id: 'tx-1',
            status: 'PENDING',
        });

        const interaction = createButtonInteraction();

        await handleButton(interaction as any);

        expect(mockApproveTransaction).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                transactionId: 'tx-1',
                actorId: 'member-1',
                actorName: 'Nobita',
            })
        );
        expect(interaction.message.edit).toHaveBeenCalled();
        expect(interaction.deleteReply).toHaveBeenCalled();
    });

    it('blocks finance approval buttons when the subscription guard denies access after a request is already pending', async () => {
        mockGetGangMemberByDiscordId.mockResolvedValue({
            id: 'member-1',
            name: 'Nobita',
            gangRole: 'TREASURER',
        });
        mockHasPermissionLevel.mockReturnValue(true);
        mockCheckGangSubscriptionFeatureAccess.mockResolvedValueOnce({
            gang: {
                id: 'gang-1',
                subscriptionTier: 'FREE',
            },
            allowed: false,
        });

        const interaction = createButtonInteraction();

        await handleButton(interaction as any);

        expect(mockCheckGangSubscriptionFeatureAccess).toHaveBeenCalledWith(
            interaction,
            'guild-1',
            'finance',
            expect.any(String),
            expect.objectContaining({
                alreadyDeferred: true,
            })
        );
        expect(mockTransactionFindFirst).not.toHaveBeenCalled();
        expect(mockApproveTransaction).not.toHaveBeenCalled();
    });

    it('rejects invalid admin income modal amounts before touching finance services', async () => {
        const interaction = createModalInteraction();

        await handleModal(interaction as any);

        expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
        expect(interaction.editReply).toHaveBeenCalledWith(expect.any(String));
        expect(mockApproveTransaction).not.toHaveBeenCalled();
    });

    it.each([
        ['finance_loan_modal'],
        ['finance_repay_modal'],
        ['finance_deposit_modal'],
    ])('blocks member finance modal %s when the subscription guard denies access', async (customId) => {
        mockCheckMemberSubscriptionFeatureAccess.mockResolvedValueOnce({
            allowed: false,
            member: null,
            gang: {
                id: 'gang-1',
                subscriptionTier: 'FREE',
            },
        });
        const interaction = createModalInteraction({
            customId,
            fields: {
                getTextInputValue: vi.fn((field: string) => {
                    if (field === 'amount') return '500';
                    return 'test';
                }),
            },
        });

        await handleModal(interaction as any);

        expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
        expect(mockCheckMemberSubscriptionFeatureAccess).toHaveBeenCalledWith(
            interaction,
            'guild-1',
            'discord-1',
            'finance',
            expect.any(String),
            expect.objectContaining({
                alreadyDeferred: true,
                requireApprovedMember: true,
            })
        );
        expect(mockMemberFindFirst).not.toHaveBeenCalled();
    });

    it('labels the repay button flow as loan-only when collection debt also exists', async () => {
        const interaction = createButtonInteraction({ customId: 'finance_request_repay' });

        await handleButton(interaction as any);

        const reply = interaction.editReply.mock.calls.at(-1)?.[0];
        const embed = reply.embeds[0].data;
        const buttonLabels = reply.components[0].components.map((component: any) => component.data.label);

        expect(embed.title).toContain('หนี้ยืม');
        expect(embed.description).toContain('ค้างเก็บเงินแก๊ง');
        expect(embed.description).toContain('ฝากเครดิต');
        expect(buttonLabels.join(' ')).toContain('หนี้ยืม');
    });

    it('opens the collection payment modal with explicit gang-fee and credit wording', async () => {
        const interaction = createButtonInteraction({ customId: 'finance_request_deposit' });

        await handleButton(interaction as any);

        const modal = interaction.showModal.mock.calls[0][0];
        expect(modal.data.title).toContain('เก็บเงินแก๊ง');
        expect(modal.data.title).toContain('เครดิต');
        expect(mockCheckMemberSubscriptionFeatureAccess).toHaveBeenCalled();
    });

    it.each([
        ['finance_request_loan'],
        ['finance_request_repay'],
        ['finance_request_deposit'],
        ['finance_balance'],
    ])('blocks member finance button %s when the subscription guard denies access', async (customId) => {
        mockCheckMemberSubscriptionFeatureAccess.mockResolvedValueOnce({
            allowed: false,
            member: null,
            gang: {
                id: 'gang-1',
                subscriptionTier: 'FREE',
            },
        });

        const interaction = createButtonInteraction({ customId });

        await handleButton(interaction as any);

        expect(mockCheckMemberSubscriptionFeatureAccess).toHaveBeenCalledWith(
            interaction,
            'guild-1',
            'discord-1',
            'finance',
            expect.any(String),
            expect.objectContaining({
                requireApprovedMember: true,
            })
        );
        expect(interaction.showModal).not.toHaveBeenCalled();
        expect(mockGetMemberFinanceSnapshot).not.toHaveBeenCalled();
    });

    it('explains separate loan and collection payment paths in the balance embed', async () => {
        const interaction = createButtonInteraction({ customId: 'finance_balance' });

        await handleButton(interaction as any);

        const reply = interaction.editReply.mock.calls.at(-1)?.[0];
        const embed = reply.embeds[0].data;

        expect(embed.description).toContain('หนี้ยืม');
        expect(embed.description).toContain('เก็บเงินแก๊ง');
        expect(embed.description).toContain('คนละยอด');
    });
});
