import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockGangFindFirst,
    mockMemberFindFirst,
    mockDbUpdate,
    mockEq,
    mockAnd,
} = vi.hoisted(() => ({
    mockGangFindFirst: vi.fn(),
    mockMemberFindFirst: vi.fn(),
    mockDbUpdate: vi.fn(),
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
                findFirst: mockMemberFindFirst,
            },
        },
        update: mockDbUpdate,
    },
    gangs: {
        discordGuildId: 'gangs.discord_guild_id',
    },
    members: {
        id: 'members.id',
        discordId: 'members.discord_id',
        gangId: 'members.gang_id',
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

import { handleRoleSync } from '../src/features/roleSync';

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

function createGuildMember(memberRoleIds: string[], guildRoles: MockRole[] = []) {
    const rolesById = new Map(guildRoles.map((role) => [role.id, role]));
    const memberRoles = memberRoleIds.map((roleId) => rolesById.get(roleId) ?? createRole(roleId));

    return {
        id: 'discord-user-1',
        user: {
            id: 'discord-user-1',
            bot: false,
            username: 'alice',
            displayAvatarURL: vi.fn(() => 'https://cdn.example/avatar.png'),
        },
        guild: {
            id: 'guild-1',
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
});
