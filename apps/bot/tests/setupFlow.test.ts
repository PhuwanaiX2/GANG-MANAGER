import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockGangFindFirst,
    mockGangRoleFindFirst,
    mockMemberFindMany,
    mockMemberFindFirst,
    mockDbInsert,
    mockDbUpdate,
    mockEq,
    mockAnd,
    mockCheckPermission,
    mockSyncDiscordGuildOwnerMembership,
} = vi.hoisted(() => ({
    mockGangFindFirst: vi.fn(),
    mockGangRoleFindFirst: vi.fn(),
    mockMemberFindMany: vi.fn(),
    mockMemberFindFirst: vi.fn(),
    mockDbInsert: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockEq: vi.fn((left, right) => ({ left, right })),
    mockAnd: vi.fn((...conditions: unknown[]) => conditions),
    mockCheckPermission: vi.fn(),
    mockSyncDiscordGuildOwnerMembership: vi.fn(),
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
                findFirst: mockMemberFindFirst,
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
        gangId: 'gang_roles.gang_id',
        discordRoleId: 'gang_roles.discord_role_id',
        permissionLevel: 'gang_roles.permission_level',
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

vi.mock('../src/utils/permissions', () => ({
    checkPermission: mockCheckPermission,
    syncDiscordGuildOwnerMembership: mockSyncDiscordGuildOwnerMembership,
}));

import {
    AUTO_SETUP_DEPRECATED_CHANNEL_NAMES,
    AUTO_SETUP_MANAGED_CHANNEL_NAMES,
    ensureSetupRoleMapping,
    ensureVerifiedRoleMapping,
    getBotRoleHierarchyIssue,
    handleSetupModeAuto,
    handleSetupModeManual,
    handleSetupModalSubmit,
    handleSetupMemberRoleSelect,
    handleSetupInstallExisting,
    handleSetupVerifyAuto,
    handleSetupVerifyRoleSelect,
    handleSetupRoleSelect,
    handleSetupStart,
    hasBotManagedChannelAccess,
    isDiscordMissingAccessError,
    isManagedLeavePanelMessage,
    pickSetupAdminPanelChannel,
    withBotManagedChannelAccess,
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
        user: {
            id: 'user-1',
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
        memberPermissions: {
            has: vi.fn(() => true),
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
        guildId: 'guild-1',
        user: {
            id: 'user-1',
        },
        guild,
        memberPermissions: {
            has: vi.fn(() => true),
        },
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
        mockCheckPermission.mockResolvedValue(true);
        mockSyncDiscordGuildOwnerMembership.mockResolvedValue(undefined);
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
                flags: 64,
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
                flags: 64,
            })
        );
        expect(interaction.showModal).not.toHaveBeenCalled();
    });

    it('rejects existing-gang setup for Discord admins who are not gang admins', async () => {
        mockGangFindFirst.mockResolvedValue({
            id: 'gang-1',
            name: 'Tokyo',
        });
        mockCheckPermission.mockResolvedValue(false);

        const interaction = createInteraction();

        await handleSetupStart(interaction as any);

        expect(mockCheckPermission).toHaveBeenCalledWith(
            interaction,
            'gang-1',
            ['OWNER']
        );
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('หัวหน้าแก๊ง (Owner)'),
                flags: 64,
            })
        );
        expect(interaction.showModal).not.toHaveBeenCalled();
    });

    it.each([
        ['auto repair', handleSetupModeAuto, 'setup_mode_auto_gang-1'],
        ['verify role selection', handleSetupModeManual, 'setup_mode_manual_gang-1'],
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
                flags: 64,
            })
        );
        expect(interaction.deferUpdate).not.toHaveBeenCalled();
        expect(interaction.editReply).not.toHaveBeenCalled();
    });

    it('blocks existing-server setup mutations before loading when the actor is only a Discord server admin', async () => {
        mockCheckPermission.mockResolvedValue(false);
        const interaction = createInteraction({
            customId: 'setup_install_existing_gang-1',
            update: vi.fn().mockResolvedValue(undefined),
            deferUpdate: vi.fn().mockResolvedValue(undefined),
            editReply: vi.fn().mockResolvedValue(undefined),
        });

        await handleSetupInstallExisting(interaction as any);

        expect(mockCheckPermission).toHaveBeenCalledWith(
            interaction,
            'gang-1',
            ['OWNER']
        );
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('หัวหน้าแก๊ง (Owner)'),
                flags: 64,
            })
        );
        expect(interaction.update).not.toHaveBeenCalled();
        expect(interaction.editReply).not.toHaveBeenCalled();
        expect(mockDbUpdate).not.toHaveBeenCalled();
        expect(mockDbInsert).not.toHaveBeenCalled();
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

        expect(interaction.deferReply).toHaveBeenCalledWith({ flags: 64 });
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('ยังไม่พบบอทในเซิร์ฟเวอร์นี้'),
                components: [],
            })
        );
        expect(mockDbInsert).not.toHaveBeenCalled();
        expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it('persists a new gang before choosing the setup mode so setup can survive bot restarts', async () => {
        mockGangFindFirst.mockResolvedValue(null);
        const interaction = createModalInteraction();

        await handleSetupModalSubmit(interaction as any);

        expect(interaction.deferReply).toHaveBeenCalledWith({ flags: 64 });
        expect(mockDbInsert).toHaveBeenCalledTimes(2);
        expect(mockDbUpdate).not.toHaveBeenCalled();

        const replyPayload = interaction.editReply.mock.calls.at(-1)?.[0];
        const serializedComponents = JSON.stringify(replyPayload.components);
        expect(serializedComponents).toContain('setup_install_new_gang-1');
        expect(serializedComponents).toContain('setup_install_existing_gang-1');
    });

    it('does not grant a fresh trial when the owner already had a dissolved free gang', async () => {
        mockGangFindFirst.mockResolvedValue(null);
        mockMemberFindMany.mockResolvedValue([
            {
                gang: {
                    id: 'old-free-gang',
                    name: 'Old Free',
                    isActive: false,
                    dissolvedAt: new Date('2026-05-01T00:00:00.000Z'),
                    subscriptionTier: 'FREE',
                    subscriptionExpiresAt: null,
                },
            },
        ]);
        const updateWhere = vi.fn().mockResolvedValue(undefined);
        const updateSet = vi.fn(() => ({ where: updateWhere }));
        mockDbUpdate.mockReturnValueOnce({ set: updateSet });
        const interaction = createModalInteraction();

        await handleSetupModalSubmit(interaction as any);

        expect(mockDbInsert).toHaveBeenCalledTimes(2);
        expect(updateSet).toHaveBeenCalledWith({
            subscriptionTier: 'FREE',
            subscriptionExpiresAt: null,
        });
        expect(updateWhere).toHaveBeenCalled();
    });

    it('transfers an active dissolved premium plan instead of granting a new trial', async () => {
        mockGangFindFirst.mockResolvedValue(null);
        const premiumExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        mockMemberFindMany.mockResolvedValue([
            {
                gang: {
                    id: 'old-premium-gang',
                    name: 'Old Premium',
                    isActive: false,
                    dissolvedAt: new Date('2026-05-01T00:00:00.000Z'),
                    subscriptionTier: 'PREMIUM',
                    subscriptionExpiresAt: premiumExpiresAt,
                },
            },
        ]);
        const updateWhere = vi.fn().mockResolvedValue(undefined);
        const updateSet = vi.fn(() => ({ where: updateWhere }));
        mockDbUpdate.mockReturnValue({ set: updateSet });
        const interaction = createModalInteraction();

        await handleSetupModalSubmit(interaction as any);

        expect(updateSet).toHaveBeenCalledWith({
            subscriptionTier: 'PREMIUM',
            subscriptionExpiresAt: premiumExpiresAt,
        });
        expect(updateSet).toHaveBeenCalledWith({
            subscriptionTier: 'FREE',
            subscriptionExpiresAt: null,
        });
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

        expect(interaction.deferReply).toHaveBeenCalledWith({ flags: 64 });
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
    it('keeps read-only managed channels writable by the bot', () => {
        const overwrites = withBotManagedChannelAccess('bot-member-id', [
            { id: 'guild-id', allow: ['ViewChannel'], deny: ['SendMessages'] },
        ]);

        expect(overwrites).toEqual([
            { id: 'guild-id', allow: ['ViewChannel'], deny: ['SendMessages'] },
            {
                id: 'bot-member-id',
                allow: ['ViewChannel', 'SendMessages', 'EmbedLinks', 'ReadMessageHistory'],
            },
        ]);
    });

    it('does not duplicate an existing bot overwrite during repair', () => {
        const overwrites = withBotManagedChannelAccess('bot-member-id', [
            { id: 'bot-member-id', allow: ['ViewChannel'] },
            { id: 'guild-id', deny: ['ViewChannel'] },
        ]);

        expect(overwrites).toEqual([
            { id: 'guild-id', deny: ['ViewChannel'] },
            {
                id: 'bot-member-id',
                allow: ['ViewChannel', 'SendMessages', 'EmbedLinks', 'ReadMessageHistory'],
            },
        ]);
    });

    it('detects Discord Missing Access errors from REST failures', () => {
        expect(isDiscordMissingAccessError({ code: 50001 })).toBe(true);
        expect(isDiscordMissingAccessError({ name: 'DiscordAPIError[50001]', message: 'Missing Access' })).toBe(true);
        expect(isDiscordMissingAccessError({ code: 50013, message: 'Missing Permissions' })).toBe(false);
    });

    it('requires bot send permissions before reusing a managed channel', () => {
        const permissions = {
            has: vi.fn((permission) => permission !== BigInt(2048)),
        };
        const channel = {
            permissionsFor: vi.fn(() => permissions),
        };

        expect(hasBotManagedChannelAccess(channel, { id: 'bot-member-id' })).toBe(false);
        expect(permissions.has).toHaveBeenCalled();
    });

    it('picks an accessible duplicate admin panel channel instead of the first inaccessible one', () => {
        const inaccessiblePanel = {
            id: 'old-panel',
            name: 'แผงควบคุม',
            isTextBased: vi.fn(() => true),
            permissionsFor: vi.fn(() => ({ has: vi.fn(() => false) })),
        };
        const accessiblePanel = {
            id: 'new-panel',
            name: 'แผงควบคุม',
            isTextBased: vi.fn(() => true),
            permissionsFor: vi.fn(() => ({ has: vi.fn(() => true) })),
        };
        const cache = new Map([
            [inaccessiblePanel.id, inaccessiblePanel],
            [accessiblePanel.id, accessiblePanel],
        ]);

        expect(pickSetupAdminPanelChannel({ channels: { cache } }, null, { id: 'bot-member-id' })).toBe(accessiblePanel);
    });

    it('reports roles above the bot for setup diagnostics', () => {
        const botRole = { id: 'bot-role', name: 'GANG-MANAGER', position: 5 };
        const higherRole = { id: 'r5', name: 'R5', position: 10 };
        const lowerRole = { id: 'member', name: 'Gang Member', position: 2 };
        const everyoneRole = { id: 'guild-1', name: '@everyone', position: 0 };
        const cache = new Map([
            [everyoneRole.id, everyoneRole],
            [higherRole.id, higherRole],
            [botRole.id, botRole],
            [lowerRole.id, lowerRole],
        ]);

        const issue = getBotRoleHierarchyIssue(
            { id: 'guild-1', roles: { cache } },
            { roles: { highest: botRole } }
        );

        expect(issue?.roleCount).toBe(1);
        expect(issue?.roleNames).toEqual(['R5']);
        expect(issue?.warning).toContain('R5');
    });

    it('keeps auto setup limited to essential managed channels', () => {
        expect(AUTO_SETUP_MANAGED_CHANNEL_NAMES).toEqual([
            'ยืนยันตัวตน',
            'ลงทะเบียน',
            'ประกาศ',
            'Website',
            'เช็คชื่อ',
            'สรุปเช็คชื่อ',
            'แจ้งลา',
            'ห้องคนลา',
            'แจ้งธุรกรรม',
            'แผงควบคุม',
            'log-ระบบ',
            '📋-คำขอและอนุมัติ',
        ]);
        expect(AUTO_SETUP_MANAGED_CHANNEL_NAMES).not.toContain('แดชบอร์ด');
        expect(AUTO_SETUP_MANAGED_CHANNEL_NAMES).not.toContain('bot-commands');
    });

    it('documents channels that repair mode must not create again', () => {
        expect(AUTO_SETUP_DEPRECATED_CHANNEL_NAMES).toEqual([
            'กฎแก๊ง',
            'แดชบอร์ด',
            'bot-commands',
        ]);
    });
    it('detects old managed leave panels before repair sends a replacement', () => {
        expect(isManagedLeavePanelMessage({
            author: { id: 'bot-1' },
            embeds: [{ title: '📝 แจ้งลา / เข้าช้า' }],
            components: [],
        }, 'bot-1')).toBe(true);

        expect(isManagedLeavePanelMessage({
            author: { id: 'bot-1' },
            embeds: [],
            components: [{ components: [{ customId: 'request_leave_late' }] }],
        }, 'bot-1')).toBe(true);

        expect(isManagedLeavePanelMessage({
            author: { id: 'member-1' },
            embeds: [{ title: '📝 แจ้งลา / เข้าช้า' }],
            components: [{ components: [{ customId: 'request_leave_late' }] }],
        }, 'bot-1')).toBe(false);
    });
});

describe('auto repair role mapping preservation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCheckPermission.mockResolvedValue(true);
        mockSyncDiscordGuildOwnerMembership.mockResolvedValue(undefined);
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
            editable: true,
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

    it('replaces an existing role mapping when the mapped role is above the bot', async () => {
        const mappedRole = {
            id: 'unmanageable-member-role',
            name: 'Gang Member',
            managed: false,
            editable: false,
        };
        const replacementRole = {
            id: 'manageable-member-role',
            name: 'Gang Member',
            managed: false,
            editable: true,
        };
        const updateWhere = vi.fn().mockResolvedValue(undefined);
        const updateSet = vi.fn(() => ({ where: updateWhere }));
        const guild = {
            id: 'guild-1',
            roles: {
                cache: {
                    get: vi.fn(() => mappedRole),
                    find: vi.fn(() => replacementRole),
                },
                create: vi.fn(),
            },
        };
        mockGangRoleFindFirst.mockResolvedValueOnce({
            id: 'mapping-member',
            discordRoleId: mappedRole.id,
            permissionLevel: 'MEMBER',
        });
        mockDbUpdate.mockReturnValueOnce({ set: updateSet });

        const role = await ensureSetupRoleMapping(guild as any, 'gang-1', {
            name: 'Gang Member',
            color: '#3498DB',
            permission: 'MEMBER',
            hoist: true,
        });

        expect(role).toBe(replacementRole);
        expect(guild.roles.cache.find).toHaveBeenCalled();
        expect(guild.roles.create).not.toHaveBeenCalled();
        expect(updateSet).toHaveBeenCalledWith({ discordRoleId: replacementRole.id });
        expect(updateWhere).toHaveBeenCalled();
    });

    it('repairs a broken mapping only when the mapped Discord role is missing', async () => {
        const fallbackRole = {
            id: 'auto-owner-role',
            name: 'Gang Owner',
            managed: false,
            editable: true,
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

    it('stores a verified visitor role mapping without using the web role mapping permissions', async () => {
        const insertValues = vi.fn().mockResolvedValue(undefined);
        const verifiedRole = {
            id: 'civilian-role',
            name: 'Civilian',
            managed: false,
            editable: true,
        };
        const guild = {
            id: 'guild-1',
            roles: {
                cache: {
                    get: vi.fn(() => verifiedRole),
                    find: vi.fn(),
                },
                create: vi.fn(),
            },
        };
        mockGangRoleFindFirst
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null);
        mockDbInsert.mockReturnValueOnce({ values: insertValues });

        const role = await ensureVerifiedRoleMapping(guild as any, 'gang-1', verifiedRole.id);

        expect(role).toBe(verifiedRole);
        expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
            gangId: 'gang-1',
            discordRoleId: verifiedRole.id,
            permissionLevel: 'VERIFIED',
        }));
        expect(guild.roles.create).not.toHaveBeenCalled();
    });

    it('stores an existing Discord role as the gang member role when selected during setup', async () => {
        const insertValues = vi.fn().mockResolvedValue(undefined);
        const existingMemberRole = {
            id: 'bidroi-role',
            name: 'BIDROI',
            managed: false,
            editable: true,
        };
        const guild = {
            id: 'guild-1',
            roles: {
                cache: {
                    get: vi.fn(() => existingMemberRole),
                    find: vi.fn(),
                },
                create: vi.fn(),
            },
        };
        mockGangRoleFindFirst
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null);
        mockDbInsert.mockReturnValueOnce({ values: insertValues });

        const role = await ensureSetupRoleMapping(guild as any, 'gang-1', {
            name: 'Gang Member',
            color: '#3498DB',
            permission: 'MEMBER',
            hoist: true,
        }, existingMemberRole.id);

        expect(role).toBe(existingMemberRole);
        expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
            gangId: 'gang-1',
            discordRoleId: existingMemberRole.id,
            permissionLevel: 'MEMBER',
        }));
        expect(guild.roles.create).not.toHaveBeenCalled();
        expect(guild.roles.cache.find).not.toHaveBeenCalled();
    });

    it('does not allow the selected member role to reuse the visitor role mapping', async () => {
        const visitorRole = {
            id: 'visitor-role',
            name: 'Visitor',
            managed: false,
            editable: true,
        };
        const guild = {
            id: 'guild-1',
            roles: {
                cache: {
                    get: vi.fn(() => visitorRole),
                    find: vi.fn(),
                },
                create: vi.fn(),
            },
        };
        mockGangRoleFindFirst
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
                id: 'mapping-verified',
                discordRoleId: visitorRole.id,
                permissionLevel: 'VERIFIED',
            });

        await expect(ensureSetupRoleMapping(guild as any, 'gang-1', {
            name: 'Gang Member',
            color: '#3498DB',
            permission: 'MEMBER',
            hoist: true,
        }, visitorRole.id)).rejects.toThrow(/กรุณาเลือกยศสมาชิกแก๊งที่ไม่ซ้ำกับยศอื่น/);

        expect(mockDbInsert).not.toHaveBeenCalled();
        expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it('does not allow the verify role to reuse a gang permission role', async () => {
        const memberRole = {
            id: 'gang-member-role',
            name: 'Gang Member',
            managed: false,
            editable: true,
        };
        const guild = {
            id: 'guild-1',
            roles: {
                cache: {
                    get: vi.fn(() => memberRole),
                    find: vi.fn(),
                },
                create: vi.fn(),
            },
        };
        mockGangRoleFindFirst
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
                id: 'mapping-member',
                discordRoleId: memberRole.id,
                permissionLevel: 'MEMBER',
            });

        await expect(ensureVerifiedRoleMapping(guild as any, 'gang-1', memberRole.id))
            .rejects.toThrow(/กรุณาเลือกยศคนทั่วไปที่ไม่ใช่ยศสมาชิกแก๊ง/);

        expect(mockDbInsert).not.toHaveBeenCalled();
        expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it('updates the verified mapping when an admin chooses a different assignable role', async () => {
        const updateWhere = vi.fn().mockResolvedValue(undefined);
        const updateSet = vi.fn(() => ({ where: updateWhere }));
        const newVerifiedRole = {
            id: 'new-visitor-role',
            name: 'Visitor',
            managed: false,
            editable: true,
        };
        const guild = {
            id: 'guild-1',
            roles: {
                cache: {
                    get: vi.fn(() => newVerifiedRole),
                    find: vi.fn(),
                },
                create: vi.fn(),
            },
        };
        mockGangRoleFindFirst
            .mockResolvedValueOnce({
                id: 'mapping-verified',
                discordRoleId: 'old-visitor-role',
                permissionLevel: 'VERIFIED',
            })
            .mockResolvedValueOnce(null);
        mockDbUpdate.mockReturnValueOnce({ set: updateSet });

        const role = await ensureVerifiedRoleMapping(guild as any, 'gang-1', newVerifiedRole.id);

        expect(role).toBe(newVerifiedRole);
        expect(updateSet).toHaveBeenCalledWith({ discordRoleId: newVerifiedRole.id });
        expect(updateWhere).toHaveBeenCalled();
        expect(mockDbInsert).not.toHaveBeenCalled();
    });
});

describe('verify role setup selection flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCheckPermission.mockResolvedValue(true);
        mockSyncDiscordGuildOwnerMembership.mockResolvedValue(undefined);
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

    it('turns the legacy manual setup button into verify role selection', async () => {
        const interaction = createInteraction({
            customId: 'setup_mode_manual_gang-1',
            message: {
                flags: {
                    has: vi.fn((flag: number) => flag === 64),
                },
            },
            deferUpdate: vi.fn().mockResolvedValue(undefined),
            editReply: vi.fn().mockResolvedValue(undefined),
        });

        await handleSetupModeManual(interaction as any);

        expect(interaction.deferUpdate).toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({
                embeds: expect.any(Array),
                components: expect.any(Array),
            })
        );
        const replyPayload = interaction.editReply.mock.calls.at(-1)?.[0];
        expect(JSON.stringify(replyPayload.components)).toContain('setup_verify_role_gang-1');
        expect(mockDbInsert).not.toHaveBeenCalled();
        expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it('answers public verify role setup buttons ephemerally without editing the admin panel message', async () => {
        const interaction = createInteraction({
            customId: 'setup_mode_manual_gang-1',
            message: {
                flags: {
                    has: vi.fn(() => false),
                },
            },
            deferUpdate: vi.fn().mockResolvedValue(undefined),
            editReply: vi.fn().mockResolvedValue(undefined),
        });

        await handleSetupModeManual(interaction as any);

        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({
            embeds: expect.any(Array),
            components: expect.any(Array),
            flags: 64,
        }));
        expect(interaction.deferUpdate).not.toHaveBeenCalled();
        expect(interaction.editReply).not.toHaveBeenCalled();
    });

    it('rejects verify role select submissions for non-admin users', async () => {
        const interaction = createRoleSelectInteraction({
            customId: 'setup_verify_role_gang-1',
            memberPermissions: {
                has: vi.fn(() => false),
            },
            reply: vi.fn().mockResolvedValue(undefined),
        });

        await handleSetupVerifyRoleSelect(interaction as any);

        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({
            flags: 64,
        }));
        expect(interaction.deferUpdate).not.toHaveBeenCalled();
        expect(mockDbInsert).not.toHaveBeenCalled();
        expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it('asks for the gang member role after an admin chooses the visitor role', async () => {
        const interaction = createRoleSelectInteraction({
            customId: 'setup_verify_role_gang-1',
            values: ['visitor-role'],
        });

        await handleSetupVerifyRoleSelect(interaction as any);

        expect(interaction.deferUpdate).toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({
                embeds: expect.any(Array),
                components: expect.any(Array),
            })
        );
        const replyPayload = interaction.editReply.mock.calls.at(-1)?.[0];
        expect(JSON.stringify(replyPayload.components)).toContain('setup_member_role:gang-1:visitor-role');
        expect(JSON.stringify(replyPayload.components)).toContain('setup_member_auto:gang-1:visitor-role');
        expect(mockDbInsert).not.toHaveBeenCalled();
        expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it('blocks using the same Discord role for visitor and gang member setup', async () => {
        const visitorRole = {
            id: 'visitor-role',
            name: 'Visitor',
            managed: false,
            editable: true,
        };
        const interaction = createRoleSelectInteraction({
            customId: 'setup_member_role:gang-1:visitor-role',
            values: ['visitor-role'],
            guild: {
                id: 'guild-1',
                roles: {
                    cache: {
                        get: vi.fn(() => visitorRole),
                    },
                },
            },
        });

        await handleSetupMemberRoleSelect(interaction as any);

        expect(interaction.deferUpdate).toHaveBeenCalled();
        const replyPayload = interaction.editReply.mock.calls.at(-1)?.[0];
        expect(JSON.stringify(replyPayload.embeds)).toContain('ยศสมาชิกแก๊งต้องคนละยศกับยศคนทั่วไป');
        expect(mockDbInsert).not.toHaveBeenCalled();
        expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it('rejects legacy manual role mapping selections without changing DB mappings', async () => {
        mockGangFindFirst.mockResolvedValue({
            id: 'gang-1',
            name: 'Tokyo',
        });
        const interaction = createRoleSelectInteraction({
            customId: 'setup_select_MEMBER_gang-1',
        });

        await handleSetupRoleSelect(interaction as any);

        expect(mockDbInsert).not.toHaveBeenCalled();
        expect(mockDbUpdate).not.toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('โหมดเชื่อมยศแก๊ง'),
                components: [],
            })
        );
    });
});
