'use server';

import { db, gangRoles, gangSettings } from '@gang/database';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireGangAccess, isGangAccessError } from '@/lib/gangAccess';
import { logError, logInfo, logWarn } from '@/lib/logger';

const RoleMappingSchema = z.object({
    permission: z.enum(['OWNER', 'ADMIN', 'TREASURER', 'ATTENDANCE_OFFICER', 'MEMBER']),
    roleId: z.string().max(64),
});

const RoleMappingsSchema = z.array(RoleMappingSchema).superRefine((mappings, ctx) => {
    const seenPermissions = new Set<string>();
    const seenRoleIds = new Map<string, string>();

    for (const [index, mapping] of mappings.entries()) {
        if (seenPermissions.has(mapping.permission)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: [index, 'permission'],
                message: 'Duplicate permission mapping',
            });
        }
        seenPermissions.add(mapping.permission);

        const roleId = mapping.roleId.trim();
        if (!roleId) continue;

        const existingPermission = seenRoleIds.get(roleId);
        if (existingPermission && existingPermission !== mapping.permission) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: [index, 'roleId'],
                message: 'Discord role is already mapped to another permission',
            });
        }
        seenRoleIds.set(roleId, mapping.permission);
    }
});

const ChannelSettingsSchema = z.object({
    logChannelId: z.string().max(64).nullable().optional(),
    registerChannelId: z.string().max(64).nullable().optional(),
    attendanceChannelId: z.string().max(64).nullable().optional(),
    financeChannelId: z.string().max(64).nullable().optional(),
    announcementChannelId: z.string().max(64).nullable().optional(),
    leaveChannelId: z.string().max(64).nullable().optional(),
    requestsChannelId: z.string().max(64).nullable().optional(),
});

class RoleMappingConflictError extends Error {
    constructor(message = 'Role mapping conflict') {
        super(message);
        this.name = 'RoleMappingConflictError';
    }
}

export async function updateGangRoles(
    gangId: string,
    mappings: Array<{ permission: 'OWNER' | 'ADMIN' | 'TREASURER' | 'ATTENDANCE_OFFICER' | 'MEMBER', roleId: string }>
) {
    try {
        const parsedGangId = z.string().min(1).max(64).parse(gangId);
        const parsedMappings = RoleMappingsSchema.parse(mappings);
        const access = await requireGangAccess({ gangId: parsedGangId, minimumRole: 'OWNER' });

        await db.transaction(async (tx) => {
            for (const map of parsedMappings) {
                const roleId = map.roleId.trim();
                const existingByPermission = await tx.query.gangRoles.findFirst({
                    where: and(
                        eq(gangRoles.gangId, parsedGangId),
                        eq(gangRoles.permissionLevel, map.permission)
                    )
                });

                if (!roleId) {
                    if (existingByPermission) {
                        await tx.delete(gangRoles)
                            .where(eq(gangRoles.id, existingByPermission.id));
                    }
                    continue;
                }

                const existingByRole = await tx.query.gangRoles.findFirst({
                    where: and(
                        eq(gangRoles.gangId, parsedGangId),
                        eq(gangRoles.discordRoleId, roleId)
                    )
                });

                if (existingByRole && existingByRole.permissionLevel !== map.permission) {
                    throw new RoleMappingConflictError();
                }

                if (existingByPermission) {
                    if (existingByPermission.discordRoleId !== roleId) {
                        await tx.update(gangRoles)
                            .set({ discordRoleId: roleId })
                            .where(eq(gangRoles.id, existingByPermission.id));
                    }
                } else {
                    await tx.insert(gangRoles).values({
                        id: nanoid(),
                        gangId: parsedGangId,
                        permissionLevel: map.permission,
                        discordRoleId: roleId
                    });
                }
            }
        });

        revalidatePath(`/dashboard/${parsedGangId}/settings`);
        logInfo('actions.settings.roles.update.succeeded', {
            gangId: parsedGangId,
            actorDiscordId: access.member.discordId,
            mappingCount: parsedMappings.length,
        });
        return { success: true };
    } catch (error) {
        if (isGangAccessError(error)) {
            logWarn('actions.settings.roles.update.forbidden', {
                gangId,
                status: error.status,
            });
            return { success: false, error: error.message };
        }

        if (error instanceof z.ZodError) {
            return { success: false, error: 'Invalid role mapping data' };
        }

        if (error instanceof RoleMappingConflictError) {
            return { success: false, error: 'Discord role is already mapped to another permission' };
        }

        logError('actions.settings.roles.update.failed', error, { gangId });
        return { success: false, error: 'Database error' };
    }
}

export async function updateGangSettings(
    gangId: string,
    settings: {
        logChannelId?: string;
        registerChannelId?: string;
        attendanceChannelId?: string;
        financeChannelId?: string;
        announcementChannelId?: string;
        leaveChannelId?: string;
        requestsChannelId?: string;
    }
) {
    try {
        const parsedGangId = z.string().min(1).max(64).parse(gangId);
        const parsedSettings = ChannelSettingsSchema.parse(settings);
        const access = await requireGangAccess({ gangId: parsedGangId, minimumRole: 'OWNER' });

        await db.update(gangSettings)
            .set(parsedSettings)
            .where(eq(gangSettings.gangId, parsedGangId));

        revalidatePath(`/dashboard/${parsedGangId}/settings`);
        logInfo('actions.settings.channels.update.succeeded', {
            gangId: parsedGangId,
            actorDiscordId: access.member.discordId,
            updatedKeys: Object.keys(parsedSettings),
        });
        return { success: true };
    } catch (error) {
        if (isGangAccessError(error)) {
            logWarn('actions.settings.channels.update.forbidden', {
                gangId,
                status: error.status,
            });
            return { success: false, error: error.message };
        }

        if (error instanceof z.ZodError) {
            return { success: false, error: 'Invalid channel settings data' };
        }

        logError('actions.settings.channels.update.failed', error, { gangId });
        return { success: false, error: 'Database error' };
    }
}

