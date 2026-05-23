'use server';

import { db, gangRoles, gangSettings } from '@gang/database';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireGangAccess, isGangAccessError } from '@/lib/gangAccess';
import { logError, logInfo, logWarn } from '@/lib/logger';

const SYSTEM_ROLE_PERMISSIONS = ['OWNER', 'ADMIN', 'TREASURER', 'ATTENDANCE_OFFICER', 'MEMBER'] as const;

const RoleNameUpdateSchema = z.object({
    permission: z.enum(SYSTEM_ROLE_PERMISSIONS),
    name: z.string().trim().min(1).max(100),
});

const RoleNameUpdatesSchema = z.array(RoleNameUpdateSchema)
    .min(1)
    .max(SYSTEM_ROLE_PERMISSIONS.length)
    .superRefine((updates, ctx) => {
        const seenPermissions = new Set<string>();
        const seenNames = new Map<string, string>();

        for (const [index, update] of updates.entries()) {
            if (seenPermissions.has(update.permission)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: [index, 'permission'],
                    message: 'Duplicate role permission',
                });
            }
            seenPermissions.add(update.permission);

            if (update.name === '@everyone') {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: [index, 'name'],
                    message: '@everyone cannot be used as a system role name',
                });
            }

            const normalizedName = update.name.toLocaleLowerCase('th-TH');
            const existingPermission = seenNames.get(normalizedName);
            if (existingPermission && existingPermission !== update.permission) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: [index, 'name'],
                    message: 'Each system role must have a unique name',
                });
            }
            seenNames.set(normalizedName, update.permission);
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

async function readResponseText(response: Response) {
    try {
        return await response.text();
    } catch (error) {
        return `[unavailable:${error instanceof Error ? error.message : 'read_failed'}]`;
    }
}

export async function updateGangRoles(
    gangId: string,
    _mappings: Array<{ permission: 'OWNER' | 'ADMIN' | 'TREASURER' | 'ATTENDANCE_OFFICER' | 'MEMBER', roleId: string }>
) {
    try {
        const parsedGangId = z.string().min(1).max(64).parse(gangId);
        await requireGangAccess({ gangId: parsedGangId, minimumRole: 'OWNER' });
        logWarn('actions.settings.roles.remap_disabled', { gangId: parsedGangId });
        return {
            success: false,
            error: 'Role remapping from the web is disabled. Use /setup repair in Discord to create or repair system roles.',
        };
    } catch (error) {
        if (isGangAccessError(error)) {
            logWarn('actions.settings.roles.remap_disabled.forbidden', {
                gangId,
                status: error.status,
            });
            return { success: false, error: error.message };
        }

        if (error instanceof z.ZodError) {
            return { success: false, error: 'Invalid gang id' };
        }

        logError('actions.settings.roles.remap_disabled.failed', error, { gangId });
        return { success: false, error: 'Role remapping is disabled' };
    }
}

export async function updateGangRoleNames(
    gangId: string,
    updates: Array<{ permission: 'OWNER' | 'ADMIN' | 'TREASURER' | 'ATTENDANCE_OFFICER' | 'MEMBER'; name: string }>
) {
    try {
        const parsedGangId = z.string().min(1).max(64).parse(gangId);
        const parsedUpdates = RoleNameUpdatesSchema.parse(updates);
        const access = await requireGangAccess({ gangId: parsedGangId, minimumRole: 'OWNER' });
        const discordGuildId = access.gang.discordGuildId;

        if (!discordGuildId) {
            logWarn('actions.settings.roles.rename.guild_missing', { gangId: parsedGangId });
            return { success: false, error: 'Discord server is not linked' };
        }

        if (!process.env.DISCORD_BOT_TOKEN) {
            logWarn('actions.settings.roles.rename.token_missing', { gangId: parsedGangId });
            return { success: false, error: 'Discord bot token is not configured' };
        }

        const existingMappings = await db.query.gangRoles.findMany({
            where: eq(gangRoles.gangId, parsedGangId),
            columns: {
                permissionLevel: true,
                discordRoleId: true,
            },
        });
        const mappedRoleIds = new Map(existingMappings.map((mapping) => [mapping.permissionLevel, mapping.discordRoleId]));

        const missingPermissions = parsedUpdates.filter((update) => {
            const roleId = mappedRoleIds.get(update.permission);
            return !roleId || roleId === discordGuildId;
        });

        if (missingPermissions.length > 0) {
            logWarn('actions.settings.roles.rename.mapping_missing', {
                gangId: parsedGangId,
                permissions: missingPermissions.map((update) => update.permission),
            });
            return {
                success: false,
                error: 'Some system roles are missing. Run /setup repair in Discord first.',
            };
        }

        const failed: string[] = [];
        for (const update of parsedUpdates) {
            const roleId = mappedRoleIds.get(update.permission);
            if (!roleId) continue;

            const response = await fetch(`https://discord.com/api/v10/guilds/${discordGuildId}/roles/${roleId}`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
                    'Content-Type': 'application/json',
                    'X-Audit-Log-Reason': 'Gang Manager web role rename',
                },
                body: JSON.stringify({ name: update.name }),
            });

            if (!response.ok) {
                failed.push(update.permission);
                logWarn('actions.settings.roles.rename.discord_failed', {
                    gangId: parsedGangId,
                    permission: update.permission,
                    roleId,
                    statusCode: response.status,
                    responseBody: await readResponseText(response),
                });
            }
        }

        if (failed.length > 0) {
            return {
                success: false,
                error: 'Discord rejected one or more role renames. Check bot role hierarchy and try again.',
                failedPermissions: failed,
            };
        }

        revalidatePath(`/dashboard/${parsedGangId}/settings`);
        revalidatePath(`/dashboard/${parsedGangId}/settings/roles-channels`);
        logInfo('actions.settings.roles.rename.succeeded', {
            gangId: parsedGangId,
            actorDiscordId: access.member.discordId,
            updateCount: parsedUpdates.length,
        });
        return { success: true, updatedCount: parsedUpdates.length };
    } catch (error) {
        if (isGangAccessError(error)) {
            logWarn('actions.settings.roles.rename.forbidden', {
                gangId,
                status: error.status,
            });
            return { success: false, error: error.message };
        }

        if (error instanceof z.ZodError) {
            return { success: false, error: 'Invalid role name data' };
        }

        logError('actions.settings.roles.rename.failed', error, { gangId });
        return { success: false, error: 'Discord role rename failed' };
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
