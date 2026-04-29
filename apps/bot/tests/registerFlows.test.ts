import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockGangFindFirst,
    mockMemberFindFirst,
    mockMembersFindMany,
    mockGangSettingsFindFirst,
    mockGangRolesFindMany,
    mockCreateAuditLog,
    mockDbSelect,
    mockDbInsert,
    mockDbUpdate,
    mockGetTierConfig,
    mockEq,
    mockAnd,
    mockOr,
    mockSql,
} = vi.hoisted(() => ({
    mockGangFindFirst: vi.fn(),
    mockMemberFindFirst: vi.fn(),
    mockMembersFindMany: vi.fn(),
    mockGangSettingsFindFirst: vi.fn(),
    mockGangRolesFindMany: vi.fn(),
    mockCreateAuditLog: vi.fn(),
    mockDbSelect: vi.fn(),
    mockDbInsert: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockGetTierConfig: vi.fn(),
    mockEq: vi.fn((left, right) => ({ left, right })),
    mockAnd: vi.fn((...conditions: unknown[]) => conditions),
    mockOr: vi.fn((...conditions: unknown[]) => conditions),
    mockSql: vi.fn((strings: TemplateStringsArray) => strings.join('')),
}));

vi.mock('@gang/database', () => ({
    db: {
        query: {
            gangs: {
                findFirst: mockGangFindFirst,
            },
            members: {
                findFirst: mockMemberFindFirst,
                findMany: mockMembersFindMany,
            },
            gangSettings: {
                findFirst: mockGangSettingsFindFirst,
            },
            gangRoles: {
                findMany: mockGangRolesFindMany,
            },
        },
        select: mockDbSelect,
        insert: mockDbInsert,
        update: mockDbUpdate,
    },
    gangs: {
        id: 'gangs.id',
        discordGuildId: 'gangs.discord_guild_id',
    },
    members: {
        id: 'members.id',
        gangId: 'members.gang_id',
        discordId: 'members.discord_id',
        isActive: 'members.is_active',
    },
    gangSettings: {
        gangId: 'gang_settings.gang_id',
    },
    gangRoles: {
        gangId: 'gang_roles.gang_id',
        permissionLevel: 'gang_roles.permission_level',
    },
    getTierConfig: mockGetTierConfig,
}));

vi.mock('drizzle-orm', () => ({
    eq: mockEq,
    and: mockAnd,
    or: mockOr,
    sql: mockSql,
}));

vi.mock('../src/utils/auditLog', () => ({
    createAuditLog: mockCreateAuditLog,
}));

vi.mock('../src/utils/thaiTime', () => ({
    thaiTimestamp: vi.fn(() => '2026-04-23 21:15'),
}));

vi.mock('../src/utils/logger', () => ({
    logInfo: vi.fn(),
    logWarn: vi.fn(),
    logError: vi.fn(),
}));

vi.mock('nanoid', () => ({
    nanoid: vi.fn(() => 'member-1'),
}));

import { handleButton } from '../src/handlers/buttons';
import { handleModal } from '../src/handlers/modals';
import '../src/features/register';
import '../src/features/registerModal';

function createRegisterButtonInteraction(overrides?: Partial<any>) {
    return {
        customId: 'register',
        guildId: 'guild-1',
        user: {
            id: 'discord-member',
        },
        reply: vi.fn().mockResolvedValue(undefined),
        showModal: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

function createRegisterModalInteraction(overrides?: Partial<any>) {
    const send = vi.fn().mockResolvedValue(undefined);
    const channel = {
        id: 'channel-1',
        send,
    };

    return {
        customId: 'register_modal_gang-1',
        guildId: 'guild-1',
        user: {
            id: 'discord-member',
            username: 'nobita',
            displayAvatarURL: vi.fn(() => 'https://avatar.test/member'),
        },
        client: {},
        guild: {
            channels: {
                cache: {
                    get: vi.fn((id: string) => (id === 'channel-1' ? channel : undefined)),
                    find: vi.fn(),
                },
            },
        },
        fields: {
            getTextInputValue: vi.fn(() => 'Nobita'),
        },
        deferReply: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

describe('register button and modal flows', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mockGetTierConfig.mockReturnValue({
            maxMembers: 5,
            name: 'Trial',
        });
        mockDbSelect.mockReturnValue({
            from: vi.fn(() => ({
                where: vi.fn().mockResolvedValue([{ count: 0 }]),
            })),
        });
        mockDbInsert.mockReturnValue({
            values: vi.fn().mockResolvedValue(undefined),
        });
        mockDbUpdate.mockReturnValue({
            set: vi.fn(() => ({
                where: vi.fn().mockResolvedValue(undefined),
            })),
        });
    });

    it('blocks registration when the user is already an approved active member', async () => {
        mockGangFindFirst.mockResolvedValue({
            id: 'gang-1',
            isActive: true,
            subscriptionTier: 'TRIAL',
        });
        mockMemberFindFirst.mockResolvedValue({
            id: 'member-1',
            isActive: true,
            status: 'APPROVED',
        });

        const interaction = createRegisterButtonInteraction();

        await handleButton(interaction as any);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.any(String),
                ephemeral: true,
            })
        );
        expect(interaction.showModal).not.toHaveBeenCalled();
    });

    it('shows the register modal when the gang exists and capacity is available', async () => {
        mockGangFindFirst.mockResolvedValue({
            id: 'gang-1',
            isActive: true,
            subscriptionTier: 'TRIAL',
        });
        mockMemberFindFirst.mockResolvedValue(null);

        const interaction = createRegisterButtonInteraction();

        await handleButton(interaction as any);

        expect(interaction.showModal).toHaveBeenCalled();
        expect(interaction.reply).not.toHaveBeenCalled();
    });

    it('blocks registration at member capacity without telling users to upgrade while payments are paused', async () => {
        mockGangFindFirst.mockResolvedValue({
            id: 'gang-1',
            isActive: true,
            subscriptionTier: 'FREE',
        });
        mockMemberFindFirst.mockResolvedValue(null);
        mockGetTierConfig.mockReturnValue({
            maxMembers: 5,
            name: 'Free',
        });
        mockDbSelect.mockReturnValue({
            from: vi.fn(() => ({
                where: vi.fn().mockResolvedValue([{ count: 5 }]),
            })),
        });

        const interaction = createRegisterButtonInteraction();

        await handleButton(interaction as any);

        const reply = interaction.reply.mock.calls[0][0];
        expect(reply.content).toContain('สมาชิกเต็มแล้ว');
        expect(reply.content).toContain('product readiness');
        expect(reply.content).not.toContain('อัปเกรด');
        expect(interaction.showModal).not.toHaveBeenCalled();
    });

    it('creates a pending registration request and notifies admin reviewers', async () => {
        mockGangFindFirst.mockResolvedValue({
            id: 'gang-1',
            name: 'Tokyo',
            subscriptionTier: 'TRIAL',
        });
        mockMembersFindMany.mockResolvedValue([]);
        mockMemberFindFirst.mockResolvedValue(null);
        mockGangSettingsFindFirst.mockResolvedValue({
            requestsChannelId: 'channel-1',
            logChannelId: null,
        });
        mockGangRolesFindMany.mockResolvedValue([
            { discordRoleId: 'role-admin' },
        ]);

        const interaction = createRegisterModalInteraction();

        await handleModal(interaction as any);

        expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
        expect(mockDbInsert).toHaveBeenCalled();
        expect(mockCreateAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({
                gangId: 'gang-1',
                actorId: 'discord-member',
                action: 'MEMBER_REGISTER',
            })
        );
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({
                embeds: expect.any(Array),
            })
        );
        expect(interaction.guild.channels.cache.get).toHaveBeenCalledWith('channel-1');
    });
});
