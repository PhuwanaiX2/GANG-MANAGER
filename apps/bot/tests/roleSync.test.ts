import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockGangFindFirst,
    mockMemberFindMany,
    mockMemberFindFirst,
    mockDbUpdate,
    mockDbInsert,
    mockEq,
    mockAnd,
} = vi.hoisted(() => ({
    mockGangFindFirst: vi.fn(),
    mockMemberFindMany: vi.fn(),
    mockMemberFindFirst: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockDbInsert: vi.fn(),
    mockEq: vi.fn((left, right) => ({ left, right })),
    mockAnd: vi.fn((...conditions: unknown[]) => conditions),
}));

vi.mock('../src/index', () => ({
    client: {
        on: vi.fn(),
    },
}));

vi.mock('@gang/database', () => ({
    db: {
        query: {
            gangs: {
                findFirst: mockGangFindFirst,
            },
            members: {
                findMany: mockMemberFindMany,
                findFirst: mockMemberFindFirst,
            },
        },
        update: mockDbUpdate,
        insert: mockDbInsert,
    },
    auditLogs: {},
    gangs: {
        discordGuildId: 'gangs.discord_guild_id',
    },
    members: {
        id: 'members.id',
        discordId: 'members.discord_id',
        gangId: 'members.gang_id',
        isActive: 'members.is_active',
        status: 'members.status',
        updatedAt: 'members.updated_at',
    },
}));

vi.mock('drizzle-orm', () => ({
    eq: mockEq,
    and: mockAnd,
}));

vi.mock('../src/utils/logger', () => ({
    logError: vi.fn(),
    logInfo: vi.fn(),
    logWarn: vi.fn(),
}));

import { handleGuildMemberRemove, handleRoleSync, reconcileGuildMemberPresence } from '../src/features/roleSync';

type MockRole = {
    id: string;
    name: string;
};

function createRole(id: string, name = id): MockRole {
    return { id, name };
}

function createRoleCache(roles: MockRole[]) {
    const map = new Map(roles.map((role) => [role.id, role]));
    return {
        get: (id: string) => map.get(id),
        map: <T>(callback: (role: MockRole) => T) => Array.from(map.values()).map(callback),
    };
}

function createGuildMember(memberRoleIds: string[], guildRoles: MockRole[] = [], options: { id?: string; ownerId?: string } = {}) {
    const rolesById = new Map(guildRoles.map((role) => [role.id, role]));
    const memberRoles = memberRoleIds.map((roleId) => rolesById.get(roleId) ?? createRole(roleId));
    const memberId = options.id || 'discord-user-1';

    return {
        id: memberId,
        user: {
            id: memberId,
            bot: false,
            username: 'alice',
            displayAvatarURL: vi.fn(() => 'https://cdn.example/avatar.png'),
        },
        guild: {
            id: 'guild-1',
            ownerId: options.ownerId || 'discord-owner',
            roles: {
                cache: createRoleCache(guildRoles),
            },
        },
        roles: {
            cache: createRoleCache(memberRoles),
            add: vi.fn().mockResolvedValue(undefined),
            remove: vi.fn().mockResolvedValue(undefined),
        },
    };
}

function createGuild(fetchMember: (input: unknown) => Promise<unknown>) {
    return {
        id: 'guild-1',
        members: {
            fetch: vi.fn(fetchMember),
        },
    };
}

const gangRoles = [
    { discordRoleId: 'role-owner', permissionLevel: 'OWNER' },
    { discordRoleId: 'role-admin', permissionLevel: 'ADMIN' },
    { discordRoleId: 'role-treasurer', permissionLevel: 'TREASURER' },
    { discordRoleId: 'role-attendance', permissionLevel: 'ATTENDANCE_OFFICER' },
    { discordRoleId: 'role-member', permissionLevel: 'MEMBER' },
    { discordRoleId: 'role-verified', permissionLevel: 'VERIFIED' },
];

const guildRoles = [
    createRole('role-owner', 'Gang Owner'),
    createRole('role-admin', 'Gang Admin'),
    createRole('role-treasurer', 'Gang Treasurer'),
    createRole('role-attendance', 'Gang Attendance'),
    createRole('role-member', 'Gang Member'),
    createRole('role-verified', 'Verified'),
    createRole('role-head', 'HEAD'),
];

function mockGangAndMember(member: Record<string, unknown> | null) {
    mockGangFindFirst.mockResolvedValue({
        id: 'gang-1',
        discordGuildId: 'guild-1',
        roles: gangRoles,
    });
    mockMemberFindFirst.mockResolvedValue(member);
}

describe('role sync', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDbUpdate.mockReturnValue({
            set: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(undefined),
            }),
        });
        mockDbInsert.mockReturnValue({
            values: vi.fn().mockResolvedValue(undefined),
        });
        mockMemberFindMany.mockResolvedValue([]);
    });

    it('ignores Discord role changes for users that are not registered in the gang DB', async () => {
        mockGangAndMember(null);
        const member = createGuildMember(['role-member', 'role-admin'], guildRoles);

        await handleRoleSync(member as any);

        expect(member.roles.remove).not.toHaveBeenCalled();
        expect(member.roles.add).not.toHaveBeenCalled();
        expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it('removes only extra mapped gang roles and never promotes DB role from Discord', async () => {
        mockGangAndMember({
            id: 'member-1',
            gangRole: 'MEMBER',
            status: 'APPROVED',
            isActive: true,
            discordUsername: 'alice',
            discordAvatar: 'https://cdn.example/avatar.png',
        });
        const member = createGuildMember(['role-member', 'role-admin', 'role-head', 'role-verified'], guildRoles);

        await handleRoleSync(member as any);

        expect(member.roles.remove).toHaveBeenCalledTimes(1);
        expect(member.roles.remove).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'role-admin' }),
            expect.any(String)
        );
        expect(member.roles.add).not.toHaveBeenCalled();
        expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it('syncs Discord roles from DB role when expected mapped role is missing', async () => {
        mockGangAndMember({
            id: 'member-1',
            gangRole: 'ADMIN',
            status: 'APPROVED',
            isActive: true,
            discordUsername: 'alice',
            discordAvatar: 'https://cdn.example/avatar.png',
        });
        const member = createGuildMember(['role-member'], guildRoles);

        await handleRoleSync(member as any);

        expect(member.roles.remove).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'role-member' }),
            expect.any(String)
        );
        expect(member.roles.add).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'role-admin' }),
            expect.any(String)
        );
        expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it('removes mapped gang roles from inactive or pending members without touching other roles', async () => {
        mockGangAndMember({
            id: 'member-1',
            gangRole: 'MEMBER',
            status: 'PENDING',
            isActive: false,
            discordUsername: 'alice',
            discordAvatar: 'https://cdn.example/avatar.png',
        });
        const member = createGuildMember(['role-member', 'role-head', 'role-verified'], guildRoles);

        await handleRoleSync(member as any);

        expect(member.roles.remove).toHaveBeenCalledTimes(1);
        expect(member.roles.remove).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'role-member' }),
            expect.any(String)
        );
        expect(member.roles.add).not.toHaveBeenCalled();
    });

    it('does not add or remove mapped roles for the Discord server owner', async () => {
        mockGangAndMember({
            id: 'member-owner',
            gangRole: 'OWNER',
            status: 'APPROVED',
            isActive: true,
            discordUsername: 'alice',
            discordAvatar: 'https://cdn.example/avatar.png',
        });
        const member = createGuildMember(['role-member'], guildRoles, {
            id: 'discord-owner',
            ownerId: 'discord-owner',
        });

        await handleRoleSync(member as any);

        expect(member.roles.remove).not.toHaveBeenCalled();
        expect(member.roles.add).not.toHaveBeenCalled();
        expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it('deactivates a registered active member when they leave the Discord guild', async () => {
        mockGangAndMember({
            id: 'member-1',
            name: 'Alice',
            gangRole: 'MEMBER',
            status: 'APPROVED',
            isActive: true,
            discordUsername: 'alice',
            discordAvatar: 'https://cdn.example/avatar.png',
        });
        const member = createGuildMember(['role-member'], guildRoles);

        await handleGuildMemberRemove(member as any);

        expect(mockDbUpdate).toHaveBeenCalledWith(expect.anything());
        const updateSet = mockDbUpdate.mock.results[0].value.set;
        expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({
            isActive: false,
            status: 'REJECTED',
            updatedAt: expect.any(Date),
        }));
        expect(mockDbInsert).toHaveBeenCalledWith(expect.anything());
        const insertValues = mockDbInsert.mock.results[0].value.values;
        expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
            gangId: 'gang-1',
            actorId: 'discord-user-1',
            action: 'MEMBER_DISCORD_LEAVE',
            targetType: 'MEMBER',
            targetId: 'member-1',
        }));
    });

    it('ignores Discord guild leaves for users that are not registered', async () => {
        mockGangAndMember(null);
        const member = createGuildMember(['role-member'], guildRoles);

        await handleGuildMemberRemove(member as any);

        expect(mockDbUpdate).not.toHaveBeenCalled();
        expect(mockDbInsert).not.toHaveBeenCalled();
    });

    it('does not rewrite members that were already inactive from a previous removal', async () => {
        mockGangAndMember({
            id: 'member-1',
            name: 'Alice',
            gangRole: 'MEMBER',
            status: 'REJECTED',
            isActive: false,
            discordUsername: 'alice',
            discordAvatar: 'https://cdn.example/avatar.png',
        });
        const member = createGuildMember(['role-member'], guildRoles);

        await handleGuildMemberRemove(member as any);

        expect(mockDbUpdate).not.toHaveBeenCalled();
        expect(mockDbInsert).not.toHaveBeenCalled();
    });

    it('reconciles active DB members that are missing from the Discord guild', async () => {
        mockGangFindFirst.mockResolvedValue({
            id: 'gang-1',
            discordGuildId: 'guild-1',
        });
        mockMemberFindMany.mockResolvedValue([
            {
                id: 'member-missing',
                discordId: 'discord-missing',
                name: 'Missing User',
                gangRole: 'MEMBER',
                status: 'APPROVED',
                isActive: true,
            },
            {
                id: 'member-present',
                discordId: 'discord-present',
                name: 'Present User',
                gangRole: 'MEMBER',
                status: 'APPROVED',
                isActive: true,
            },
        ]);
        const guild = createGuild(async (input) => {
            if ((input as { user?: string }).user === 'discord-missing') {
                const error = new Error('Unknown Member') as Error & { code: number; status: number };
                error.code = 10007;
                error.status = 404;
                throw error;
            }
            return {};
        });

        const result = await reconcileGuildMemberPresence(guild as any);

        expect(result).toEqual({ checked: 2, deactivated: 1, skipped: 0 });
        expect(guild.members.fetch).toHaveBeenCalledWith({ user: 'discord-missing', force: true });
        expect(guild.members.fetch).toHaveBeenCalledWith({ user: 'discord-present', force: true });
        const updateSet = mockDbUpdate.mock.results[0].value.set;
        expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({
            isActive: false,
            status: 'REJECTED',
        }));
        const insertValues = mockDbInsert.mock.results[0].value.values;
        expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
            gangId: 'gang-1',
            actorId: 'system:member-presence-reconcile',
            action: 'MEMBER_DISCORD_LEAVE',
            targetId: 'member-missing',
        }));
    });

    it('does not deactivate members when Discord member fetch fails for an unknown infrastructure reason', async () => {
        mockGangFindFirst.mockResolvedValue({
            id: 'gang-1',
            discordGuildId: 'guild-1',
        });
        mockMemberFindMany.mockResolvedValue([
            {
                id: 'member-1',
                discordId: 'discord-user-1',
                name: 'Alice',
                gangRole: 'MEMBER',
                status: 'APPROVED',
                isActive: true,
            },
        ]);
        const guild = createGuild(async () => {
            throw new Error('Discord API temporarily unavailable');
        });

        const result = await reconcileGuildMemberPresence(guild as any);

        expect(result).toEqual({ checked: 1, deactivated: 0, skipped: 1 });
        expect(mockDbUpdate).not.toHaveBeenCalled();
        expect(mockDbInsert).not.toHaveBeenCalled();
    });
});
