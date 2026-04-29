import { beforeEach, describe, expect, it, vi } from 'vitest';

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
        transaction: vi.fn(),
        txFindRole: vi.fn(),
        txUpdate: vi.fn(),
        txUpdateSet: vi.fn(),
        txUpdateWhere: vi.fn(),
        txInsert: vi.fn(),
        txInsertValues: vi.fn(),
        txDelete: vi.fn(),
        txDeleteWhere: vi.fn(),
    };
});

vi.mock('next/cache', () => ({
    revalidatePath: mocks.revalidatePath,
}));

vi.mock('nanoid', () => ({
    nanoid: () => 'generated-id',
}));

vi.mock('drizzle-orm', () => ({
    eq: vi.fn((column, value) => ({ op: 'eq', column, value })),
    and: vi.fn((...conditions) => ({ op: 'and', conditions })),
}));

vi.mock('@gang/database', () => ({
    db: {
        update: mocks.dbUpdate,
        transaction: mocks.transaction,
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

import { updateGangRoles, updateGangSettings } from '@/app/actions/settings';

describe('settings server actions', () => {
    const gangId = 'gang-123';
    const actorDiscordId = 'discord-123';

    beforeEach(() => {
        vi.clearAllMocks();

        mocks.requireGangAccess.mockResolvedValue({
            gang: { id: gangId },
            member: { discordId: actorDiscordId },
            session: { user: { discordId: actorDiscordId } },
        });

        mocks.updateWhere.mockResolvedValue(undefined);
        mocks.updateSet.mockReturnValue({ where: mocks.updateWhere });
        mocks.dbUpdate.mockReturnValue({ set: mocks.updateSet });

        mocks.txUpdateWhere.mockResolvedValue(undefined);
        mocks.txUpdateSet.mockReturnValue({ where: mocks.txUpdateWhere });
        mocks.txUpdate.mockReturnValue({ set: mocks.txUpdateSet });
        mocks.txInsertValues.mockResolvedValue(undefined);
        mocks.txInsert.mockReturnValue({ values: mocks.txInsertValues });
        mocks.txDeleteWhere.mockResolvedValue(undefined);
        mocks.txDelete.mockReturnValue({ where: mocks.txDeleteWhere });
        mocks.txFindRole.mockResolvedValue(null);
        mocks.transaction.mockImplementation(async (callback: any) => callback({
            query: {
                gangRoles: {
                    findFirst: mocks.txFindRole,
                },
            },
            update: mocks.txUpdate,
            insert: mocks.txInsert,
            delete: mocks.txDelete,
        }));
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

    it('rejects invalid role mappings before owner access or database writes', async () => {
        const result = await updateGangRoles(gangId, [
            { permission: 'ADMIN', roleId: 'x'.repeat(65) },
        ]);

        expect(result).toEqual({ success: false, error: 'Invalid role mapping data' });
        expect(mocks.requireGangAccess).not.toHaveBeenCalled();
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it('rejects duplicate Discord role mappings before owner access or database writes', async () => {
        const result = await updateGangRoles(gangId, [
            { permission: 'OWNER', roleId: 'role-shared' },
            { permission: 'ADMIN', roleId: 'role-shared' },
        ]);

        expect(result).toEqual({ success: false, error: 'Invalid role mapping data' });
        expect(mocks.requireGangAccess).not.toHaveBeenCalled();
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it('updates role mappings for owners without logging raw mapping payloads', async () => {
        const result = await updateGangRoles(gangId, [
            { permission: 'ADMIN', roleId: 'role-admin' },
        ]);

        expect(result).toEqual({ success: true });
        expect(mocks.transaction).toHaveBeenCalledTimes(1);
        expect(mocks.txFindRole).toHaveBeenCalledTimes(2);
        expect(mocks.txInsertValues).toHaveBeenCalledWith({
            id: 'generated-id',
            gangId,
            permissionLevel: 'ADMIN',
            discordRoleId: 'role-admin',
        });
        expect(mocks.revalidatePath).toHaveBeenCalledWith(`/dashboard/${gangId}/settings`);
        expect(mocks.logInfo).toHaveBeenCalledWith('actions.settings.roles.update.succeeded', {
            gangId,
            actorDiscordId,
            mappingCount: 1,
        });
    });

    it('deletes an existing role mapping when a permission is cleared', async () => {
        mocks.txFindRole
            .mockResolvedValueOnce({
                id: 'mapping-admin',
                permissionLevel: 'ADMIN',
                discordRoleId: 'role-admin',
            });

        const result = await updateGangRoles(gangId, [
            { permission: 'ADMIN', roleId: '' },
        ]);

        expect(result).toEqual({ success: true });
        expect(mocks.txDelete).toHaveBeenCalledWith(expect.anything());
        expect(mocks.txDeleteWhere).toHaveBeenCalledTimes(1);
        expect(mocks.txInsert).not.toHaveBeenCalled();
    });

    it('rejects a role already mapped to another permission in the database', async () => {
        mocks.txFindRole
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
                id: 'mapping-owner',
                permissionLevel: 'OWNER',
                discordRoleId: 'role-owner',
            });

        const result = await updateGangRoles(gangId, [
            { permission: 'ADMIN', roleId: 'role-owner' },
        ]);

        expect(result).toEqual({
            success: false,
            error: 'Discord role is already mapped to another permission',
        });
        expect(mocks.txInsert).not.toHaveBeenCalled();
        expect(mocks.logError).not.toHaveBeenCalled();
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
