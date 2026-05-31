import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    class GangAccessError extends Error {
        constructor(
            message: string,
            public readonly status: number
        ) {
            super(message);
            this.name = 'GangAccessError';
        }
    }

    return {
        GangAccessError,
        requireGangAccess: vi.fn(),
        revalidatePath: vi.fn(),
        logError: vi.fn(),
        logInfo: vi.fn(),
        logWarn: vi.fn(),
        dbUpdate: vi.fn(),
        updateSet: vi.fn(),
        updateWhere: vi.fn(),
        dbInsert: vi.fn(),
        insertValues: vi.fn(),
        dbDelete: vi.fn(),
        deleteWhere: vi.fn(),
        gangRoleFindMany: vi.fn(),
        fetch: vi.fn(),
    };
});

vi.mock('next/cache', () => ({
    revalidatePath: mocks.revalidatePath,
}));

vi.mock('drizzle-orm', () => ({
    eq: vi.fn((column, value) => ({ op: 'eq', column, value })),
}));

vi.mock('nanoid', () => ({
    nanoid: () => 'generated-id',
}));

vi.mock('@gang/database', () => ({
    db: {
        update: mocks.dbUpdate,
        insert: mocks.dbInsert,
        delete: mocks.dbDelete,
        query: {
            gangRoles: {
                findMany: mocks.gangRoleFindMany,
            },
        },
    },
    gangRoles: {
        id: 'gangRoles.id',
        gangId: 'gangRoles.gangId',
        permissionLevel: 'gangRoles.permissionLevel',
        discordRoleId: 'gangRoles.discordRoleId',
    },
    gangSettings: {
        gangId: 'gangSettings.gangId',
    },
}));

vi.mock('@/lib/gangAccess', () => ({
    GangAccessError: mocks.GangAccessError,
    isGangAccessError: (error: unknown) => error instanceof mocks.GangAccessError,
    requireGangAccess: mocks.requireGangAccess,
}));

vi.mock('@/lib/logger', () => ({
    logError: mocks.logError,
    logInfo: mocks.logInfo,
    logWarn: mocks.logWarn,
}));

import { updateGangRoleNames, updateGangRoles, updateGangSettings, updateGangVerifiedRole } from '@/app/actions/settings';

describe('settings server actions', () => {
    const gangId = 'gang-123';
    const actorDiscordId = 'discord-123';
    const originalBotToken = process.env.DISCORD_BOT_TOKEN;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('fetch', mocks.fetch);
        process.env.DISCORD_BOT_TOKEN = 'test-token';

        mocks.requireGangAccess.mockResolvedValue({
            gang: { id: gangId, discordGuildId: 'guild-1' },
            member: { discordId: actorDiscordId },
            session: { user: { discordId: actorDiscordId } },
        });

        mocks.updateWhere.mockResolvedValue(undefined);
        mocks.updateSet.mockReturnValue({ where: mocks.updateWhere });
        mocks.dbUpdate.mockReturnValue({ set: mocks.updateSet });
        mocks.insertValues.mockResolvedValue(undefined);
        mocks.dbInsert.mockReturnValue({ values: mocks.insertValues });
        mocks.deleteWhere.mockResolvedValue(undefined);
        mocks.dbDelete.mockReturnValue({ where: mocks.deleteWhere });
        mocks.gangRoleFindMany.mockResolvedValue([
            { id: 'mapping-admin', permissionLevel: 'ADMIN', discordRoleId: 'role-admin' },
            { id: 'mapping-member', permissionLevel: 'MEMBER', discordRoleId: 'role-member' },
        ]);
        mocks.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            text: vi.fn().mockResolvedValue('ok'),
        } as unknown as Response);
    });

    afterEach(() => {
        if (originalBotToken === undefined) {
            delete process.env.DISCORD_BOT_TOKEN;
        } else {
            process.env.DISCORD_BOT_TOKEN = originalBotToken;
        }
        vi.unstubAllGlobals();
    });

    it('rejects invalid channel settings before owner access or database writes', async () => {
        const result = await updateGangSettings(gangId, {
            logChannelId: 'x'.repeat(65),
        });

        expect(result).toEqual({ success: false, error: 'Invalid channel settings data' });
        expect(mocks.requireGangAccess).not.toHaveBeenCalled();
        expect(mocks.dbUpdate).not.toHaveBeenCalled();
        expect(mocks.logError).not.toHaveBeenCalled();
    });

    it('rejects non-owner channel updates before database writes', async () => {
        mocks.requireGangAccess.mockRejectedValue(new mocks.GangAccessError('Forbidden', 403));

        const result = await updateGangSettings(gangId, {
            logChannelId: 'channel-1',
        });

        expect(result).toEqual({ success: false, error: 'Forbidden' });
        expect(mocks.requireGangAccess).toHaveBeenCalledWith({ gangId, minimumRole: 'OWNER' });
        expect(mocks.dbUpdate).not.toHaveBeenCalled();
        expect(mocks.logWarn).toHaveBeenCalledWith('actions.settings.channels.update.forbidden', {
            gangId,
            status: 403,
        });
    });

    it('updates channel settings for owners and logs a sanitized success event', async () => {
        const result = await updateGangSettings(gangId, {
            logChannelId: 'channel-1',
            attendanceChannelId: 'channel-2',
        });

        expect(result).toEqual({ success: true });
        expect(mocks.updateSet).toHaveBeenCalledWith({
            logChannelId: 'channel-1',
            attendanceChannelId: 'channel-2',
        });
        expect(mocks.updateWhere).toHaveBeenCalledTimes(1);
        expect(mocks.revalidatePath).toHaveBeenCalledWith(`/dashboard/${gangId}/settings`);
        expect(mocks.logInfo).toHaveBeenCalledWith('actions.settings.channels.update.succeeded', {
            gangId,
            actorDiscordId,
            updatedKeys: ['logChannelId', 'attendanceChannelId'],
        });
    });

    it('keeps legacy web role remapping owner-only and disabled', async () => {
        const result = await updateGangRoles(gangId, [
            { permission: 'ADMIN', roleId: 'role-admin' },
        ]);

        expect(result).toEqual({
            success: false,
            error: 'การผูกยศหลักจากหน้าเว็บถูกปิดไว้ ให้ซ่อมห้องและยศจาก Discord ก่อน',
        });
        expect(mocks.requireGangAccess).toHaveBeenCalledWith({ gangId, minimumRole: 'OWNER' });
        expect(mocks.gangRoleFindMany).not.toHaveBeenCalled();
        expect(mocks.fetch).not.toHaveBeenCalled();
        expect(mocks.logWarn).toHaveBeenCalledWith('actions.settings.roles.remap_disabled', { gangId });
    });

    it('rejects non-owner legacy role remapping before any Discord or database work', async () => {
        mocks.requireGangAccess.mockRejectedValue(new mocks.GangAccessError('Forbidden', 403));

        const result = await updateGangRoles(gangId, [
            { permission: 'ADMIN', roleId: 'role-admin' },
        ]);

        expect(result).toEqual({ success: false, error: 'Forbidden' });
        expect(mocks.gangRoleFindMany).not.toHaveBeenCalled();
        expect(mocks.fetch).not.toHaveBeenCalled();
        expect(mocks.logWarn).toHaveBeenCalledWith('actions.settings.roles.remap_disabled.forbidden', {
            gangId,
            status: 403,
        });
    });

    it('rejects invalid role names before owner access or Discord calls', async () => {
        const result = await updateGangRoleNames(gangId, [
            { permission: 'ADMIN', name: '' },
        ]);

        expect(result).toEqual({ success: false, error: 'Invalid role name data' });
        expect(mocks.requireGangAccess).not.toHaveBeenCalled();
        expect(mocks.gangRoleFindMany).not.toHaveBeenCalled();
        expect(mocks.fetch).not.toHaveBeenCalled();
    });

    it('rejects duplicate role names before owner access or Discord calls', async () => {
        const result = await updateGangRoleNames(gangId, [
            { permission: 'ADMIN', name: 'Gang Staff' },
            { permission: 'MEMBER', name: 'gang staff' },
        ]);

        expect(result).toEqual({ success: false, error: 'Invalid role name data' });
        expect(mocks.requireGangAccess).not.toHaveBeenCalled();
        expect(mocks.gangRoleFindMany).not.toHaveBeenCalled();
        expect(mocks.fetch).not.toHaveBeenCalled();
    });

    it('requires a configured Discord bot token before database or Discord role changes', async () => {
        delete process.env.DISCORD_BOT_TOKEN;

        const result = await updateGangRoleNames(gangId, [
            { permission: 'ADMIN', name: 'Gang Admin' },
        ]);

        expect(result).toEqual({ success: false, error: 'Discord bot token is not configured' });
        expect(mocks.requireGangAccess).toHaveBeenCalledWith({ gangId, minimumRole: 'OWNER' });
        expect(mocks.gangRoleFindMany).not.toHaveBeenCalled();
        expect(mocks.fetch).not.toHaveBeenCalled();
        expect(mocks.logWarn).toHaveBeenCalledWith('actions.settings.roles.rename.token_missing', { gangId });
    });

    it('rejects role rename when the system role mapping is missing', async () => {
        mocks.gangRoleFindMany.mockResolvedValue([
            { permissionLevel: 'MEMBER', discordRoleId: 'role-member' },
        ]);

        const result = await updateGangRoleNames(gangId, [
            { permission: 'ADMIN', name: 'Gang Admin' },
        ]);

        expect(result).toEqual({
            success: false,
            error: 'ยังมียศหลักที่บอทหาไม่เจอ ให้ซ่อมห้องและยศจาก Discord ก่อน',
        });
        expect(mocks.fetch).not.toHaveBeenCalled();
        expect(mocks.logWarn).toHaveBeenCalledWith('actions.settings.roles.rename.mapping_missing', {
            gangId,
            permissions: ['ADMIN'],
        });
    });

    it('renames existing Discord system roles for owners without logging raw names', async () => {
        const result = await updateGangRoleNames(gangId, [
            { permission: 'ADMIN', name: 'Ops Admin' },
        ]);

        expect(result).toEqual({ success: true, updatedCount: 1 });
        expect(mocks.fetch).toHaveBeenCalledWith(
            'https://discord.com/api/v10/guilds/guild-1/roles/role-admin',
            expect.objectContaining({
                method: 'PATCH',
                headers: expect.objectContaining({
                    Authorization: 'Bot test-token',
                    'Content-Type': 'application/json',
                    'X-Audit-Log-Reason': 'Gang Manager web role rename',
                }),
                body: JSON.stringify({ name: 'Ops Admin' }),
            })
        );
        expect(mocks.revalidatePath).toHaveBeenCalledWith(`/dashboard/${gangId}/settings`);
        expect(mocks.revalidatePath).toHaveBeenCalledWith(`/dashboard/${gangId}/settings/roles-channels`);
        expect(mocks.logInfo).toHaveBeenCalledWith('actions.settings.roles.rename.succeeded', {
            gangId,
            actorDiscordId,
            updateCount: 1,
        });
    });

    it('returns a controlled error when Discord rejects a role rename', async () => {
        mocks.fetch.mockResolvedValue({
            ok: false,
            status: 403,
            text: vi.fn().mockResolvedValue('Missing Permissions'),
        } as unknown as Response);

        const result = await updateGangRoleNames(gangId, [
            { permission: 'ADMIN', name: 'Ops Admin' },
        ]);

        expect(result).toEqual({
            success: false,
            error: 'Discord rejected one or more role renames. Check bot role hierarchy and try again.',
            failedPermissions: ['ADMIN'],
        });
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
        expect(mocks.logWarn).toHaveBeenCalledWith('actions.settings.roles.rename.discord_failed', {
            gangId,
            permission: 'ADMIN',
            roleId: 'role-admin',
            statusCode: 403,
            responseBody: 'Missing Permissions',
        });
    });

    it('rejects invalid visitor role data before owner access or database writes', async () => {
        const result = await updateGangVerifiedRole(gangId, 'x'.repeat(65));

        expect(result).toEqual({ success: false, error: 'ข้อมูลยศคนนอกแก๊งไม่ถูกต้อง' });
        expect(mocks.requireGangAccess).not.toHaveBeenCalled();
        expect(mocks.gangRoleFindMany).not.toHaveBeenCalled();
        expect(mocks.dbInsert).not.toHaveBeenCalled();
        expect(mocks.dbUpdate).not.toHaveBeenCalled();
        expect(mocks.dbDelete).not.toHaveBeenCalled();
    });

    it('rejects non-owner verified role updates before database writes', async () => {
        mocks.requireGangAccess.mockRejectedValue(new mocks.GangAccessError('Forbidden', 403));

        const result = await updateGangVerifiedRole(gangId, 'role-verified');

        expect(result).toEqual({ success: false, error: 'Forbidden' });
        expect(mocks.gangRoleFindMany).not.toHaveBeenCalled();
        expect(mocks.dbInsert).not.toHaveBeenCalled();
        expect(mocks.logWarn).toHaveBeenCalledWith('actions.settings.roles.verified.update.forbidden', {
            gangId,
            status: 403,
        });
    });

    it('prevents the visitor role from reusing a gang permission role', async () => {
        const result = await updateGangVerifiedRole(gangId, 'role-admin');

        expect(result).toEqual({
            success: false,
            error: 'ยศนี้ถูกใช้กับสิทธิ์แก๊งหลักแล้ว กรุณาเลือกยศคนนอกแก๊งที่ไม่ซ้ำกับยศสมาชิกหรือยศดูแล',
        });
        expect(mocks.dbInsert).not.toHaveBeenCalled();
        expect(mocks.dbUpdate).not.toHaveBeenCalled();
        expect(mocks.dbDelete).not.toHaveBeenCalled();
    });

    it('creates a verified role mapping when none exists', async () => {
        const result = await updateGangVerifiedRole(gangId, 'role-verified');

        expect(result).toEqual({ success: true });
        expect(mocks.insertValues).toHaveBeenCalledWith({
            id: 'generated-id',
            gangId,
            permissionLevel: 'VERIFIED',
            discordRoleId: 'role-verified',
        });
        expect(mocks.revalidatePath).toHaveBeenCalledWith(`/dashboard/${gangId}/settings`);
        expect(mocks.revalidatePath).toHaveBeenCalledWith(`/dashboard/${gangId}/settings/roles-channels`);
        expect(mocks.logInfo).toHaveBeenCalledWith('actions.settings.roles.verified.update.succeeded', {
            gangId,
            actorDiscordId,
            hasVerifiedRole: true,
        });
    });

    it('updates an existing verified role mapping', async () => {
        mocks.gangRoleFindMany.mockResolvedValue([
            { id: 'mapping-admin', permissionLevel: 'ADMIN', discordRoleId: 'role-admin' },
            { id: 'mapping-verified', permissionLevel: 'VERIFIED', discordRoleId: 'role-old-verified' },
        ]);

        const result = await updateGangVerifiedRole(gangId, 'role-new-verified');

        expect(result).toEqual({ success: true });
        expect(mocks.updateSet).toHaveBeenCalledWith({ discordRoleId: 'role-new-verified' });
        expect(mocks.updateWhere).toHaveBeenCalledWith({ op: 'eq', column: 'gangRoles.id', value: 'mapping-verified' });
        expect(mocks.dbInsert).not.toHaveBeenCalled();
    });

    it('clears an existing verified role mapping', async () => {
        mocks.gangRoleFindMany.mockResolvedValue([
            { id: 'mapping-verified', permissionLevel: 'VERIFIED', discordRoleId: 'role-verified' },
        ]);

        const result = await updateGangVerifiedRole(gangId, null);

        expect(result).toEqual({ success: true });
        expect(mocks.dbDelete).toHaveBeenCalledWith(expect.anything());
        expect(mocks.deleteWhere).toHaveBeenCalledWith({ op: 'eq', column: 'gangRoles.id', value: 'mapping-verified' });
    });

    it('logs unexpected channel update failures through the structured logger', async () => {
        const error = new Error('database unavailable');
        mocks.dbUpdate.mockImplementationOnce(() => {
            throw error;
        });

        const result = await updateGangSettings(gangId, {
            logChannelId: 'channel-1',
        });

        expect(result).toEqual({ success: false, error: 'Database error' });
        expect(mocks.logError).toHaveBeenCalledWith('actions.settings.channels.update.failed', error, {
            gangId,
        });
    });
});
