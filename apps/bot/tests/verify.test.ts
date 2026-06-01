import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockGangFindFirst,
    mockGangRoleFindFirst,
    mockEq,
    mockAnd,
} = vi.hoisted(() => ({
    mockGangFindFirst: vi.fn(),
    mockGangRoleFindFirst: vi.fn(),
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
    },
    gangs: {
        discordGuildId: 'gangs.discord_guild_id',
    },
    gangRoles: {
        gangId: 'gang_roles.gang_id',
        permissionLevel: 'gang_roles.permission_level',
    },
}));

vi.mock('drizzle-orm', () => ({
    eq: mockEq,
    and: mockAnd,
}));

vi.mock('../src/utils/logger', () => ({
    logInfo: vi.fn(),
    logWarn: vi.fn(),
    logError: vi.fn(),
}));

import { handleVerify } from '../src/features/verify';

function createVerifyInteraction(overrides?: Partial<any>) {
    const mappedRole = {
        id: 'role-civilian',
        name: 'Civilian',
        managed: false,
        editable: true,
    };
    const member = {
        roles: {
            cache: {
                has: vi.fn(() => false),
            },
            add: vi.fn().mockResolvedValue(undefined),
        },
        manageable: true,
    };

    return {
        user: { id: 'discord-member' },
        reply: vi.fn().mockResolvedValue(undefined),
        deferReply: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
        guild: {
            id: 'guild-1',
            name: 'Guild',
            roles: {
                cache: {
                    get: vi.fn((roleId: string) => (roleId === mappedRole.id ? mappedRole : undefined)),
                    find: vi.fn(),
                },
            },
            members: {
                fetch: vi.fn().mockResolvedValue(member),
            },
        },
        ...overrides,
    };
}

describe('verify button role assignment', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGangFindFirst.mockResolvedValue({ id: 'gang-1' });
        mockGangRoleFindFirst.mockResolvedValue({ discordRoleId: 'role-civilian' });
    });

    it('uses the configured verified visitor role instead of hard-coding the Verified role', async () => {
        const interaction = createVerifyInteraction();
        const member = await interaction.guild.members.fetch('discord-member');

        await handleVerify(interaction as any);

        expect(member.roles.add).toHaveBeenCalledWith(expect.objectContaining({ id: 'role-civilian' }));
        expect(interaction.guild.roles.cache.find).not.toHaveBeenCalled();
        expect(interaction.deferReply).toHaveBeenCalledWith(expect.objectContaining({
            flags: 64,
        }));
        expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({
            content: expect.stringContaining('รับยศคนทั่วไปสำเร็จ'),
        }));
        expect(interaction.reply).not.toHaveBeenCalled();
    });

    it('blocks verification when the configured role is missing instead of falling back silently', async () => {
        const interaction = createVerifyInteraction({
            guild: {
                id: 'guild-1',
                name: 'Guild',
                roles: {
                    cache: {
                        get: vi.fn(() => undefined),
                        find: vi.fn(),
                    },
                },
                members: {
                    fetch: vi.fn().mockResolvedValue({
                        roles: {
                            cache: { has: vi.fn(() => false) },
                            add: vi.fn().mockResolvedValue(undefined),
                        },
                        manageable: true,
                    }),
                },
            },
        });

        await handleVerify(interaction as any);

        expect(interaction.guild.roles.cache.find).not.toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({
            content: expect.stringContaining('/setup'),
        }));
        expect(interaction.reply).not.toHaveBeenCalled();
    });
});
