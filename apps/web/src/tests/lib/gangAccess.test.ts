import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@gang/database');
vi.mock('@/lib/appSession', () => ({ getAppSession: vi.fn() }));

import { db } from '@gang/database';
import { getAppSession } from '@/lib/appSession';
import {
    GangAccessError,
    getGangAccessContextForDiscordId,
    getGangPermissionFlags,
    getGangPermissionFlagsForDiscordId,
    requireGangAccess,
    requireGangAccessForDiscordId,
} from '@/lib/gangAccess';

describe('getGangPermissionFlags', () => {
    it.each([
        ['OWNER', { level: 'OWNER', isOwner: true, isAdmin: true, isTreasurer: true, isAttendanceOfficer: true, isMember: true }],
        ['ADMIN', { level: 'ADMIN', isOwner: false, isAdmin: true, isTreasurer: false, isAttendanceOfficer: true, isMember: true }],
        ['TREASURER', { level: 'TREASURER', isOwner: false, isAdmin: false, isTreasurer: true, isAttendanceOfficer: false, isMember: true }],
        ['ATTENDANCE_OFFICER', { level: 'ATTENDANCE_OFFICER', isOwner: false, isAdmin: false, isTreasurer: false, isAttendanceOfficer: true, isMember: true }],
        ['MEMBER', { level: 'MEMBER', isOwner: false, isAdmin: false, isTreasurer: false, isAttendanceOfficer: false, isMember: true }],
        ['UNKNOWN', { level: 'NONE', isOwner: false, isAdmin: false, isTreasurer: false, isAttendanceOfficer: false, isMember: false }],
    ])('maps %s to permission flags', (role, expected) => {
        expect(getGangPermissionFlags(role)).toEqual(expected);
    });
});

describe('requireGangAccess', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (db as any).query = {
            gangs: { findFirst: vi.fn() },
            members: { findFirst: vi.fn() },
        };
    });

    it('rejects when there is no authenticated session', async () => {
        (getAppSession as any).mockResolvedValue(null);

        await expect(requireGangAccess({ gangId: 'gang-1' })).rejects.toMatchObject({
            name: 'GangAccessError',
            message: 'Unauthorized',
            status: 401,
        } satisfies Partial<GangAccessError>);
    });

    it('rejects when the gang cannot be found', async () => {
        (getAppSession as any).mockResolvedValue({ user: { discordId: 'user-1' } });
        (db as any).query.gangs.findFirst.mockResolvedValue(null);

        await expect(requireGangAccess({ gangId: 'gang-1' })).rejects.toMatchObject({
            name: 'GangAccessError',
            message: 'Gang not found',
            status: 404,
        } satisfies Partial<GangAccessError>);
    });

    it('rejects when the user is not an approved active member of the gang', async () => {
        (getAppSession as any).mockResolvedValue({ user: { discordId: 'user-1' } });
        (db as any).query.gangs.findFirst.mockResolvedValue({
            id: 'gang-1',
            discordGuildId: 'guild-1',
            name: 'Gang One',
            subscriptionTier: 'FREE',
            logoUrl: 'https://cdn.example/logo.png',
        });
        (db as any).query.members.findFirst.mockResolvedValue(null);

        await expect(requireGangAccess({ gangId: 'gang-1' })).rejects.toMatchObject({
            name: 'GangAccessError',
            message: 'Forbidden',
            status: 403,
        } satisfies Partial<GangAccessError>);
    });

    it('rejects when the member role is below the required permission', async () => {
        (getAppSession as any).mockResolvedValue({ user: { discordId: 'user-1' } });
        (db as any).query.gangs.findFirst.mockResolvedValue({
            id: 'gang-1',
            discordGuildId: 'guild-1',
            name: 'Gang One',
            subscriptionTier: 'FREE',
            logoUrl: 'https://cdn.example/logo.png',
        });
        (db as any).query.members.findFirst.mockResolvedValue({
            id: 'member-1',
            gangId: 'gang-1',
            discordId: 'user-1',
            gangRole: 'TREASURER',
            name: 'Treasurer',
        });

        await expect(
            requireGangAccess({ gangId: 'gang-1', minimumRole: 'OWNER' })
        ).rejects.toMatchObject({
            name: 'GangAccessError',
            message: 'Forbidden',
            status: 403,
        } satisfies Partial<GangAccessError>);
    });

    it('returns the gang and member context for authorized users', async () => {
        (getAppSession as any).mockResolvedValue({ user: { discordId: 'user-1' } });
        (db as any).query.gangs.findFirst.mockResolvedValue({
            id: 'gang-1',
            discordGuildId: 'guild-1',
            name: 'Gang One',
            subscriptionTier: 'FREE',
            logoUrl: 'https://cdn.example/logo.png',
        });
        (db as any).query.members.findFirst.mockResolvedValue({
            id: 'member-1',
            gangId: 'gang-1',
            discordId: 'user-1',
            gangRole: 'OWNER',
            name: 'Owner',
        });

        const result = await requireGangAccess({ gangId: 'gang-1', minimumRole: 'OWNER' });

        expect(result.gang.id).toBe('gang-1');
        expect(result.gang.logoUrl).toBe('https://cdn.example/logo.png');
        expect(result.gang.subscriptionTier).toBe('FREE');
        expect(result.member.gangRole).toBe('OWNER');
        expect((db as any).query.gangs.findFirst).toHaveBeenCalled();
        expect((db as any).query.members.findFirst).toHaveBeenCalled();
    });

    it('returns access for a provided Discord id without reading the session', async () => {
        (db as any).query.gangs.findFirst.mockResolvedValue({
            id: 'gang-1',
            discordGuildId: 'guild-1',
            name: 'Gang One',
            subscriptionTier: 'FREE',
            logoUrl: null,
        });
        (db as any).query.members.findFirst.mockResolvedValue({
            id: 'member-1',
            gangId: 'gang-1',
            discordId: 'user-1',
            gangRole: 'ADMIN',
            name: 'Admin',
        });

        const result = await requireGangAccessForDiscordId({
            gangId: 'gang-1',
            discordId: 'user-1',
        });

        expect(result.member.gangRole).toBe('ADMIN');
        expect(getAppSession).not.toHaveBeenCalled();
    });

    it('returns NONE flags for expected access errors in dashboard flag reads', async () => {
        (db as any).query.gangs.findFirst.mockResolvedValue(null);

        const result = await getGangPermissionFlagsForDiscordId({
            gangId: 'missing-gang',
            discordId: 'user-1',
        });

        expect(result).toEqual(getGangPermissionFlags(null));
    });

    it('returns access context and permission flags for dashboard context reads', async () => {
        (db as any).query.gangs.findFirst.mockResolvedValue({
            id: 'gang-1',
            discordGuildId: 'guild-1',
            name: 'Gang One',
            subscriptionTier: 'FREE',
            logoUrl: null,
        });
        (db as any).query.members.findFirst.mockResolvedValue({
            id: 'member-1',
            gangId: 'gang-1',
            discordId: 'user-1',
            gangRole: 'ATTENDANCE_OFFICER',
            name: 'Attendance Officer',
        });

        const result = await getGangAccessContextForDiscordId({
            gangId: 'gang-1',
            discordId: 'user-1',
        });

        expect(result.access?.member.id).toBe('member-1');
        expect(result.permissions.isAttendanceOfficer).toBe(true);
        expect(result.permissions.isMember).toBe(true);
    });
});
