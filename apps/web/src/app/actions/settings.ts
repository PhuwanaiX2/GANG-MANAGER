'use server';

import { db, gangRoles, gangSettings } from '@gang/database';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
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
    verifyChannelId: z.string().max(64).nullable().optional(),
    logChannelId: z.string().max(64).nullable().optional(),
    registerChannelId: z.string().max(64).nullable().optional(),
    attendanceChannelId: z.string().max(64).nullable().optional(),
    attendanceSummaryChannelId: z.string().max(64).nullable().optional(),
    financeChannelId: z.string().max(64).nullable().optional(),
    penaltyChannelId: z.string().max(64).nullable().optional(),
    announcementChannelId: z.string().max(64).nullable().optional(),
    leaveChannelId: z.string().max(64).nullable().optional(),
    approvedLeaveChannelId: z.string().max(64).nullable().optional(),
    requestsChannelId: z.string().max(64).nullable().optional(),
    websiteChannelId: z.string().max(64).nullable().optional(),
    adminPanelChannelId: z.string().max(64).nullable().optional(),
});

const VerifiedRoleSchema = z.object({
    roleId: z.string().trim().max(64).nullable(),
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
            error: 'การผูกยศหลักจากหน้าเว็บถูกปิดไว้ ให้ซ่อมห้องและยศจาก Discord ก่อน',
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
            return { success: false, error: 'ข้อมูลแก๊งไม่ถูกต้อง กรุณาเปิดหน้านี้ใหม่แล้วลองอีกครั้ง' };
        }

        logError('actions.settings.roles.remap_disabled.failed', error, { gangId });
        return { success: false, error: 'ยังเปลี่ยนการผูกยศจากหน้าเว็บไม่ได้ ให้ซ่อมห้องและยศจาก Discord ก่อน' };
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
            return { success: false, error: 'แก๊งนี้ยังไม่ได้เชื่อมกับเซิร์ฟเวอร์ Discord' };
        }

        if (!process.env.DISCORD_BOT_TOKEN) {
            logWarn('actions.settings.roles.rename.token_missing', { gangId: parsedGangId });
            return { success: false, error: 'บอทยังไม่พร้อมเชื่อมกับ Discord กรุณาติดต่อผู้ดูแลระบบ' };
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
                error: 'ยังมียศหลักที่บอทหาไม่เจอ ให้ซ่อมห้องและยศจาก Discord ก่อน',
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
                error: 'Discord ไม่อนุญาตให้เปลี่ยนชื่อยศบางรายการ กรุณาเช็กว่าบอทอยู่สูงกว่ายศเหล่านั้นแล้วลองใหม่',
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
            return { success: false, error: 'ข้อมูลชื่อยศไม่ถูกต้อง กรุณาตรวจชื่อยศแล้วลองใหม่' };
        }

        logError('actions.settings.roles.rename.failed', error, { gangId });
        return { success: false, error: 'เปลี่ยนชื่อยศใน Discord ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' };
    }
}

export async function updateGangVerifiedRole(gangId: string, roleId: string | null) {
    try {
        const parsedGangId = z.string().min(1).max(64).parse(gangId);
        const parsedRoleId = VerifiedRoleSchema.parse({
            roleId: roleId?.trim() ? roleId.trim() : null,
        }).roleId;
        const access = await requireGangAccess({ gangId: parsedGangId, minimumRole: 'OWNER' });
        const discordGuildId = access.gang.discordGuildId;

        if (parsedRoleId && (parsedRoleId === '@everyone' || parsedRoleId === discordGuildId)) {
            return { success: false, error: 'ห้ามใช้ @everyone เป็นยศคนทั่วไป เพราะจะทำให้ทุกคนในเซิร์ฟถูกนับรวมทันที' };
        }

        const mappings = await db.query.gangRoles.findMany({
            where: eq(gangRoles.gangId, parsedGangId),
            columns: {
                id: true,
                permissionLevel: true,
                discordRoleId: true,
            },
        });

        const existingVerified = mappings.find((mapping) => mapping.permissionLevel === 'VERIFIED');
        const conflictingRole = parsedRoleId
            ? mappings.find((mapping) => mapping.discordRoleId === parsedRoleId && mapping.permissionLevel !== 'VERIFIED')
            : null;

        if (conflictingRole) {
            return {
                success: false,
                error: 'ยศนี้ถูกใช้เป็นยศสมาชิกหรือยศดูแลแก๊งแล้ว กรุณาเลือกยศคนทั่วไปที่แยกจากยศสมาชิกแก๊งจริง',
            };
        }

        if (!parsedRoleId) {
            if (existingVerified) {
                await db.delete(gangRoles).where(eq(gangRoles.id, existingVerified.id));
            }
        } else if (existingVerified) {
            if (existingVerified.discordRoleId !== parsedRoleId) {
                await db.update(gangRoles)
                    .set({ discordRoleId: parsedRoleId })
                    .where(eq(gangRoles.id, existingVerified.id));
            }
        } else {
            await db.insert(gangRoles).values({
                id: nanoid(),
                gangId: parsedGangId,
                permissionLevel: 'VERIFIED',
                discordRoleId: parsedRoleId,
            });
        }

        revalidatePath(`/dashboard/${parsedGangId}/settings`);
        revalidatePath(`/dashboard/${parsedGangId}/settings/roles-channels`);
        logInfo('actions.settings.roles.verified.update.succeeded', {
            gangId: parsedGangId,
            actorDiscordId: access.member.discordId,
            hasVerifiedRole: Boolean(parsedRoleId),
        });
        return { success: true };
    } catch (error) {
        if (isGangAccessError(error)) {
            logWarn('actions.settings.roles.verified.update.forbidden', {
                gangId,
                status: error.status,
            });
            return { success: false, error: error.message };
        }

        if (error instanceof z.ZodError) {
            return { success: false, error: 'ข้อมูลยศคนทั่วไปไม่ถูกต้อง กรุณาเลือกยศจากรายการในเซิร์ฟเวอร์' };
        }

        logError('actions.settings.roles.verified.update.failed', error, { gangId });
        return { success: false, error: 'บันทึกยศคนทั่วไปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' };
    }
}

export async function updateGangSettings(
    gangId: string,
    settings: {
        verifyChannelId?: string | null;
        logChannelId?: string | null;
        registerChannelId?: string | null;
        attendanceChannelId?: string | null;
        attendanceSummaryChannelId?: string | null;
        financeChannelId?: string | null;
        penaltyChannelId?: string | null;
        announcementChannelId?: string | null;
        leaveChannelId?: string | null;
        approvedLeaveChannelId?: string | null;
        requestsChannelId?: string | null;
        websiteChannelId?: string | null;
        adminPanelChannelId?: string | null;
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
        revalidatePath(`/dashboard/${parsedGangId}/settings/roles-channels`);
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
            return { success: false, error: 'ข้อมูลห้อง Discord ไม่ถูกต้อง กรุณาเลือกห้องจากรายการแล้วลองใหม่' };
        }

        logError('actions.settings.channels.update.failed', error, { gangId });
        return { success: false, error: 'บันทึกการตั้งค่าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' };
    }
}
