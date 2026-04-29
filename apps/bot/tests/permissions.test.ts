import { describe, expect, it, beforeEach, vi } from 'vitest';

const {
    mockMemberFindFirst,
    mockGangRolesFindMany,
    mockEq,
    mockAnd,
} = vi.hoisted(() => ({
    mockMemberFindFirst: vi.fn(),
    mockGangRolesFindMany: vi.fn(),
    mockEq: vi.fn((left, right) => ({ left, right })),
    mockAnd: vi.fn((...conditions: unknown[]) => conditions),
}));

vi.mock('@gang/database', () => ({
    db: {
        query: {
            members: {
                findFirst: mockMemberFindFirst,
            },
            gangRoles: {
                findMany: mockGangRolesFindMany,
            },
        },
    },
    gangRoles: {
        gangId: 'gang_roles.gang_id',
    },
    members: {
        gangId: 'members.gang_id',
        discordId: 'members.discord_id',
        isActive: 'members.is_active',
        status: 'members.status',
    },
}));

vi.mock('drizzle-orm', () => ({
    and: mockAnd,
    eq: mockEq,
}));

import {
    checkPermission,
    getGangMemberByDiscordId,
    getGangRoleMappings,
    getUserPermissionLevel,
    hasPermissionLevel,
    normalizePermissionLevel,
    resolveSyncedGangRole,
} from '../src/utils/permissions';

describe('permissions helpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('normalizes only supported permission levels', () => {
        expect(normalizePermissionLevel('OWNER')).toBe('OWNER');
        expect(normalizePermissionLevel('ATTENDANCE_OFFICER')).toBe('ATTENDANCE_OFFICER');
        expect(normalizePermissionLevel('UNKNOWN')).toBeNull();
        expect(normalizePermissionLevel(undefined)).toBeNull();
    });

    it('checks permission access using the centralized matrix', () => {
        expect(hasPermissionLevel('OWNER', ['ADMIN'])).toBe(true);
        expect(hasPermissionLevel('ADMIN', ['TREASURER'])).toBe(false);
        expect(hasPermissionLevel('ATTENDANCE_OFFICER', ['ATTENDANCE_OFFICER'])).toBe(true);
        expect(hasPermissionLevel('MEMBER', ['OWNER'])).toBe(false);
    });

    it('resolves synced gang roles without promoting Discord mappings to owner', () => {
        expect(
            resolveSyncedGangRole(
                ['role-owner', 'role-attendance'],
                [
                    { discordRoleId: 'role-owner', permissionLevel: 'OWNER' },
                    { discordRoleId: 'role-attendance', permissionLevel: 'ATTENDANCE_OFFICER' },
                ]
            )
        ).toBe('ADMIN');

        expect(
            resolveSyncedGangRole(['role-treasurer'], [
                { discordRoleId: 'role-treasurer', permissionLevel: 'TREASURER' },
            ])
        ).toBe('TREASURER');

        expect(resolveSyncedGangRole([], [])).toBe('MEMBER');
    });

    it('loads approved active members by Discord id', async () => {
        const member = {
            id: 'member-1',
            gangId: 'gang-1',
            discordId: 'discord-1',
            name: 'Nobi',
            gangRole: 'ADMIN',
            status: 'APPROVED',
            isActive: true,
        };
        mockMemberFindFirst.mockResolvedValueOnce(member);

        await expect(getGangMemberByDiscordId('gang-1', 'discord-1')).resolves.toEqual(member);
        expect(mockMemberFindFirst).toHaveBeenCalledTimes(1);
        expect(mockEq).toHaveBeenCalled();
        expect(mockAnd).toHaveBeenCalled();
    });

    it('loads gang role mappings for sync', async () => {
        const mappings = [{ discordRoleId: 'role-1', permissionLevel: 'ADMIN' }];
        mockGangRolesFindMany.mockResolvedValueOnce(mappings);

        await expect(getGangRoleMappings('gang-1')).resolves.toEqual(mappings);
        expect(mockGangRolesFindMany).toHaveBeenCalledTimes(1);
    });

    it('authorizes based on the approved DB member role', async () => {
        mockMemberFindFirst.mockResolvedValueOnce({
            id: 'member-1',
            gangId: 'gang-1',
            discordId: 'discord-1',
            name: 'Suneo',
            gangRole: 'TREASURER',
            status: 'APPROVED',
            isActive: true,
        });

        const interaction = {
            user: {
                id: 'discord-1',
            },
        } as any;

        await expect(checkPermission(interaction, 'gang-1', ['TREASURER'])).resolves.toBe(true);
        await expect(getUserPermissionLevel(interaction, 'gang-1')).resolves.toBeNull();
    });

    it('returns the stored permission level when the member exists', async () => {
        mockMemberFindFirst.mockResolvedValueOnce({
            id: 'member-1',
            gangId: 'gang-1',
            discordId: 'discord-1',
            name: 'Shizuka',
            gangRole: 'ATTENDANCE_OFFICER',
            status: 'APPROVED',
            isActive: true,
        });

        const interaction = {
            user: {
                id: 'discord-1',
            },
        } as any;

        await expect(getUserPermissionLevel(interaction, 'gang-1')).resolves.toBe('ATTENDANCE_OFFICER');
    });
});
