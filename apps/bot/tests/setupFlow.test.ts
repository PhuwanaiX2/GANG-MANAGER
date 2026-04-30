import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockGangFindFirst,
    mockGangRoleFindFirst,
    mockMemberFindMany,
    mockDbInsert,
    mockDbUpdate,
    mockEq,
    mockAnd,
} = vi.hoisted(() => ({
    mockGangFindFirst: vi.fn(),
    mockGangRoleFindFirst: vi.fn(),
    mockMemberFindMany: vi.fn(),
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
            members: {
                findMany: mockMemberFindMany,
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
    members: {
        discordId: 'members.discord_id',
        gangRole: 'members.gang_role',
    },
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
    AUTO_SETUP_DEPRECATED_CHANNEL_NAMES,
    AUTO_SETUP_MANAGED_CHANNEL_NAMES,
    ensureSetupRoleMapping,
    handleSetupModeAuto,
    handleSetupModeManual,
    handleSetupModalSubmit,
    handleSetupRoleSelect,
    handleSetupStart,
} from '../src/features/setupFlow';

function createInteraction(overrides?: Partial<any>) {
    return {
        guildId: 'guild-1',
        guild: {
            id: 'guild-1',
            members: {
                me: {
                    permissions: {
                        has: vi.fn(() => true),
                    },
                },
            },
        },
        client: {
            guilds: {
                cache: {
                    get: vi.fn(),
                },
            },
        },
        memberPermissions: {
            has: vi.fn(() => true),
        },
        reply: vi.fn().mockResolvedValue(undefined),
        showModal: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

function createModalInteraction(overrides?: Partial<any>) {
    return {
        guildId: 'guild-1',
        guild: {
            id: 'guild-1',
            members: {
                me: {
                    permissions: {
                        has: vi.fn(() => true),
                    },
                },
            },
        },
        client: {
            guilds: {
                cache: {
                    get: vi.fn(),
                },
            },
        },
        fields: {
            getTextInputValue: vi.fn(() => 'TEQ'),
        },
        user: {
            id: 'user-1',
        },
        deferReply: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
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
        mockMemberFindMany.mockResolvedValue([]);
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

    it('does not create a gang record when the bot is not actually in the guild', async () => {
        mockGangFindFirst.mockResolvedValue(null);
        const interaction = createModalInteraction({
            guild: null,
            client: {
                guilds: {
                    cache: {
                        get: vi.fn(() => undefined),
                    },
                },
            },
        });

        await handleSetupModalSubmit(interaction as any);

        expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('ยังไม่พบบอทในเซิร์ฟเวอร์นี้'),
                components: [],
            })
        );
        expect(mockDbInsert).not.toHaveBeenCalled();
        expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it('keeps a new gang setup pending until the owner chooses an install mode', async () => {
        mockGangFindFirst.mockResolvedValue(null);
        const interaction = createModalInteraction();

        await handleSetupModalSubmit(interaction as any);

        expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
        expect(mockDbInsert).not.toHaveBeenCalled();
        expect(mockDbUpdate).not.toHaveBeenCalled();

        const replyPayload = interaction.editReply.mock.calls.at(-1)?.[0];
        const serializedComponents = JSON.stringify(replyPayload.components);
        expect(serializedComponents).toContain('setup_mode_auto_pending_');
        expect(serializedComponents).toContain('setup_mode_manual_pending_');
    });

    it('rejects setup before persistence when the bot lacks role or channel permissions', async () => {
        mockGangFindFirst.mockResolvedValue(null);
        const interaction = createModalInteraction({
            guild: {
                id: 'guild-1',
                members: {
                    me: {
                        permissions: {
                            has: vi.fn(() => false),
                        },
                    },
                },
            },
        });

        await handleSetupModalSubmit(interaction as any);

        expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.any(String),
                components: [],
            })
        );
        expect(mockDbInsert).not.toHaveBeenCalled();
        expect(mockDbUpdate).not.toHaveBeenCalled();
    });
});

describe('auto setup channel footprint', () => {
    it('keeps auto setup limited to essential managed channels', () => {
        expect(AUTO_SETUP_MANAGED_CHANNEL_NAMES).toEqual([
            'ยืนยันตัวตน',
            'ลงทะเบียน',
            'ประกาศ',
            'เช็คชื่อ',
            'แจ้งลา',
            'แจ้งธุรกรรม',
            'log-ระบบ',
            '📋-คำขอและอนุมัติ',
        ]);
        expect(AUTO_SETUP_MANAGED_CHANNEL_NAMES).not.toContain('แดชบอร์ด');
        expect(AUTO_SETUP_MANAGED_CHANNEL_NAMES).not.toContain('bot-commands');
    });

    it('documents channels that repair mode must not create again', () => {
        expect(AUTO_SETUP_DEPRECATED_CHANNEL_NAMES).toEqual([
            'กฎแก๊ง',
            'สรุปเช็คชื่อ',
            'แดชบอร์ด',
            'bot-commands',
        ]);
    });
});

describe('auto repair role mapping preservation', () => {
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

    it('keeps an existing manual role mapping instead of overwriting it with auto-created roles', async () => {
        const mappedRole = {
            id: 'manual-owner-role',
            name: 'หัวหน้าใหญ่',
            managed: false,
        };
        const guild = {
            id: 'guild-1',
            roles: {
                cache: {
                    get: vi.fn(() => mappedRole),
                    find: vi.fn(),
                },
                create: vi.fn(),
            },
        };
        mockGangRoleFindFirst.mockResolvedValueOnce({
            id: 'mapping-owner',
            discordRoleId: mappedRole.id,
            permissionLevel: 'OWNER',
        });

        const role = await ensureSetupRoleMapping(guild as any, 'gang-1', {
            name: 'Gang Owner',
            color: '#FFD700',
            permission: 'OWNER',
            hoist: true,
        });

        expect(role).toBe(mappedRole);
        expect(guild.roles.cache.get).toHaveBeenCalledWith(mappedRole.id);
        expect(guild.roles.cache.find).not.toHaveBeenCalled();
        expect(guild.roles.create).not.toHaveBeenCalled();
        expect(mockDbUpdate).not.toHaveBeenCalled();
        expect(mockDbInsert).not.toHaveBeenCalled();
    });

    it('repairs a broken mapping only when the mapped Discord role is missing', async () => {
        const fallbackRole = {
            id: 'auto-owner-role',
            name: 'Gang Owner',
            managed: false,
        };
        const updateWhere = vi.fn().mockResolvedValue(undefined);
        const updateSet = vi.fn(() => ({ where: updateWhere }));
        const guild = {
            id: 'guild-1',
            roles: {
                cache: {
                    get: vi.fn(() => undefined),
                    find: vi.fn(() => fallbackRole),
                },
                create: vi.fn(),
            },
        };
        mockGangRoleFindFirst.mockResolvedValueOnce({
            id: 'mapping-owner',
            discordRoleId: 'deleted-role',
            permissionLevel: 'OWNER',
        });
        mockDbUpdate.mockReturnValueOnce({ set: updateSet });

        const role = await ensureSetupRoleMapping(guild as any, 'gang-1', {
            name: 'Gang Owner',
            color: '#FFD700',
            permission: 'OWNER',
            hoist: true,
        });

        expect(role).toBe(fallbackRole);
        expect(guild.roles.cache.find).toHaveBeenCalled();
        expect(guild.roles.create).not.toHaveBeenCalled();
        expect(updateSet).toHaveBeenCalledWith({ discordRoleId: fallbackRole.id });
        expect(updateWhere).toHaveBeenCalled();
        expect(mockDbInsert).not.toHaveBeenCalled();
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
