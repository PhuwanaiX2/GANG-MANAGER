import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockGangFindFirst,
    mockGangRoleFindFirst,
    mockDbInsert,
    mockDbUpdate,
    mockEq,
    mockAnd,
} = vi.hoisted(() => ({
    mockGangFindFirst: vi.fn(),
    mockGangRoleFindFirst: vi.fn(),
    mockDbInsert: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockEq: vi.fn((left, right) => ({ left, right })),
    mockAnd: vi.fn((...conditions: unknown[]) => conditions),
}));

vi.mock('@gang/database', () => ({
    db: {
        query: {
            gangs: {
                findFirst: mockGangFindFirst,
            },
            gangRoles: {
                findFirst: mockGangRoleFindFirst,
            },
        },
        insert: mockDbInsert,
        update: mockDbUpdate,
    },
    gangs: {
        discordGuildId: 'gangs.discord_guild_id',
        id: 'gangs.id',
    },
    gangSettings: {},
    gangRoles: {
        id: 'gang_roles.id',
    },
    members: {},
    licenses: {},
    getTierConfig: vi.fn(),
    normalizeSubscriptionTier: vi.fn((tier: string) => tier),
    canAccessFeature: vi.fn(() => true),
}));

vi.mock('drizzle-orm', () => ({
    eq: mockEq,
    and: mockAnd,
}));

vi.mock('nanoid', () => ({
    nanoid: vi.fn(() => 'gang-1'),
}));

import {
    handleSetupModeAuto,
    handleSetupModeManual,
    handleSetupRoleSelect,
    handleSetupStart,
} from '../src/features/setupFlow';

function createInteraction(overrides?: Partial<any>) {
    return {
        guildId: 'guild-1',
        memberPermissions: {
            has: vi.fn(() => true),
        },
        reply: vi.fn().mockResolvedValue(undefined),
        showModal: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

function createRoleSelectInteraction(overrides?: Partial<any>) {
    const role = {
        id: 'role-owner',
        managed: false,
        editable: true,
        members: { size: 1 },
        guild: {
            id: 'guild-1',
            members: {
                fetch: vi.fn().mockResolvedValue(undefined),
            },
        },
    };

    const guild = {
        id: 'guild-1',
        roles: {
            cache: {
                get: vi.fn(() => role),
            },
        },
        members: role.guild.members,
    };
    role.guild = guild as any;

    return {
        customId: 'setup_select_OWNER_gang-1',
        values: ['role-owner'],
        guild,
        member: {
            roles: {
                cache: {
                    has: vi.fn(() => true),
                },
            },
        },
        deferUpdate: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

describe('setup flow button entry', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDbInsert.mockReturnValue({
            values: vi.fn().mockResolvedValue(undefined),
        });
        mockDbUpdate.mockReturnValue({
            set: vi.fn(() => ({
                where: vi.fn().mockResolvedValue(undefined),
            })),
        });
    });

    it('rejects setup start for non-admin users', async () => {
        const interaction = createInteraction({
            memberPermissions: {
                has: vi.fn(() => false),
            },
        });

        await handleSetupStart(interaction as any);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.any(String),
                ephemeral: true,
            })
        );
        expect(interaction.showModal).not.toHaveBeenCalled();
    });

    it('skips the modal and shows mode selection when the gang already exists', async () => {
        mockGangFindFirst.mockResolvedValue({
            id: 'gang-1',
            name: 'Tokyo',
        });

        const interaction = createInteraction();

        await handleSetupStart(interaction as any);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                embeds: expect.any(Array),
                components: expect.any(Array),
                ephemeral: true,
            })
        );
        expect(interaction.showModal).not.toHaveBeenCalled();
    });

    it.each([
        ['auto repair', handleSetupModeAuto, 'setup_mode_auto_gang-1'],
        ['manual mapping', handleSetupModeManual, 'setup_mode_manual_gang-1'],
    ])('rejects %s setup actions for non-admin users', async (_label, handler, customId) => {
        const interaction = createInteraction({
            customId,
            memberPermissions: {
                has: vi.fn(() => false),
            },
            deferUpdate: vi.fn().mockResolvedValue(undefined),
            editReply: vi.fn().mockResolvedValue(undefined),
        });

        await handler(interaction as any);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.any(String),
                ephemeral: true,
            })
        );
        expect(interaction.deferUpdate).not.toHaveBeenCalled();
        expect(interaction.editReply).not.toHaveBeenCalled();
    });
});

describe('manual setup role selection guards', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGangRoleFindFirst.mockResolvedValue(null);
        mockDbInsert.mockReturnValue({
            values: vi.fn().mockResolvedValue(undefined),
        });
        mockDbUpdate.mockReturnValue({
            set: vi.fn(() => ({
                where: vi.fn().mockResolvedValue(undefined),
            })),
        });
    });

    it('rejects an owner role that has more than one member', async () => {
        const interaction = createRoleSelectInteraction();
        const selectedRole = interaction.guild.roles.cache.get('role-owner');
        selectedRole.members.size = 3;

        await handleSetupRoleSelect(interaction as any);

        expect(interaction.deferUpdate).toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({
                embeds: expect.any(Array),
                components: expect.any(Array),
            })
        );
        expect(mockDbInsert).not.toHaveBeenCalled();
        expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it('rejects owner mapping when the setup actor does not hold the selected role', async () => {
        const interaction = createRoleSelectInteraction({
            member: {
                roles: {
                    cache: {
                        has: vi.fn(() => false),
                    },
                },
            },
        });

        await handleSetupRoleSelect(interaction as any);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({
                embeds: expect.any(Array),
                components: expect.any(Array),
            })
        );
        expect(mockDbInsert).not.toHaveBeenCalled();
        expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it('does not overwrite a role that is already mapped to another permission level', async () => {
        mockGangRoleFindFirst.mockResolvedValue({
            id: 'mapping-1',
            permissionLevel: 'ADMIN',
        });
        const interaction = createRoleSelectInteraction();

        await handleSetupRoleSelect(interaction as any);

        expect(mockDbInsert).not.toHaveBeenCalled();
        expect(mockDbUpdate).not.toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({
                embeds: expect.any(Array),
                components: expect.any(Array),
            })
        );
    });

    it('rejects a role that the bot cannot manage in Discord hierarchy', async () => {
        const interaction = createRoleSelectInteraction();
        const selectedRole = interaction.guild.roles.cache.get('role-owner');
        selectedRole.editable = false;

        await handleSetupRoleSelect(interaction as any);

        expect(interaction.deferUpdate).toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({
                embeds: expect.any(Array),
                components: expect.any(Array),
            })
        );
        expect(mockDbInsert).not.toHaveBeenCalled();
        expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it('offers auto repair and dashboard links after manual role mapping is complete', async () => {
        mockGangFindFirst.mockResolvedValue({
            id: 'gang-1',
            name: 'Tokyo',
        });
        const interaction = createRoleSelectInteraction({
            customId: 'setup_select_MEMBER_gang-1',
        });

        await handleSetupRoleSelect(interaction as any);

        expect(mockDbInsert).toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({
                embeds: expect.any(Array),
                components: expect.any(Array),
            })
        );
        const replyPayload = interaction.editReply.mock.calls.at(-1)?.[0];
        expect(JSON.stringify(replyPayload.components)).toContain('setup_mode_auto_gang-1');
        expect(JSON.stringify(replyPayload.components)).toContain('/dashboard/gang-1');
    });
});
