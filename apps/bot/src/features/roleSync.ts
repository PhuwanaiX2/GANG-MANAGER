import { Events, Guild, GuildMember, PartialGuildMember } from 'discord.js';
import { client } from '../index';
import { auditLogs, db, gangs, members } from '@gang/database';
import { eq, and } from 'drizzle-orm';
import { normalizePermissionLevel, type PermissionLevel } from '../utils/permissions';
import { logError, logInfo, logWarn } from '../utils/logger';

let roleSyncRegistered = false;
let memberPresenceReconciliationStarted = false;

const DEFAULT_MEMBER_PRESENCE_RECONCILE_INTERVAL_MS = 30 * 60 * 1000;
const DEFAULT_MEMBER_PRESENCE_RECONCILE_STARTUP_DELAY_MS = 10 * 1000;

export function registerRoleSync() {
    if (roleSyncRegistered) {
        return;
    }

    roleSyncRegistered = true;
    client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
        try {
            await handleRoleSync(newMember);
        } catch (error) {
            logError('bot.role_sync.update.failed', error, {
                guildId: newMember.guild.id,
                memberDiscordId: newMember.id,
            });
        }
    });

    // Also sync on Join (just in case they have roles pre-assigned or re-join)
    client.on(Events.GuildMemberAdd, async (member) => {
        try {
            await handleRoleSync(member);
        } catch (error) {
            logError('bot.role_sync.join.failed', error, {
                guildId: member.guild.id,
                memberDiscordId: member.id,
            });
        }
    });

    client.on(Events.GuildMemberRemove, async (member) => {
        try {
            await handleGuildMemberRemove(member);
        } catch (error) {
            logError('bot.role_sync.member_remove.failed', error, {
                guildId: member.guild.id,
                memberDiscordId: member.id,
            });
        }
    });
}

type GangRoleMapping = {
    discordRoleId: string;
    permissionLevel: string;
};

type DbMemberRoleState = {
    id: string;
    discordId?: string | null;
    name?: string | null;
    gangRole: string | null;
    status: string | null;
    isActive: boolean | null;
    discordUsername?: string | null;
    discordAvatar?: string | null;
};

function uuid() {
    const runtime = globalThis as typeof globalThis & {
        crypto?: {
            randomUUID?: () => string;
        };
    };

    if (runtime.crypto?.randomUUID) {
        return runtime.crypto.randomUUID();
    }

    return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function resolveMemberPresenceReconcileIntervalMs() {
    const raw = process.env.MEMBER_PRESENCE_RECONCILE_INTERVAL_MS;
    if (!raw) return DEFAULT_MEMBER_PRESENCE_RECONCILE_INTERVAL_MS;

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 60_000) {
        logWarn('bot.member_presence_reconcile.invalid_interval', {
            configuredValue: raw,
            fallbackMs: DEFAULT_MEMBER_PRESENCE_RECONCILE_INTERVAL_MS,
        });
        return DEFAULT_MEMBER_PRESENCE_RECONCILE_INTERVAL_MS;
    }

    return parsed;
}

function isUnknownDiscordMemberError(error: unknown) {
    if (!error || typeof error !== 'object') {
        return false;
    }

    const record = error as Record<string, unknown>;
    return record.code === 10007
        || record.status === 404
        || record.rawError && typeof record.rawError === 'object' && (record.rawError as Record<string, unknown>).code === 10007;
}

async function deactivateMemberAfterDiscordLeave(input: {
    guildId: string;
    gangId: string;
    dbMember: DbMemberRoleState;
    actorId: string;
    actorName: string;
    reason: string;
}) {
    const { guildId, gangId, dbMember, actorId, actorName, reason } = input;

    if (!dbMember.isActive && dbMember.status === 'REJECTED') {
        logInfo('bot.role_sync.member_remove_already_inactive', {
            guildId,
            gangId,
            memberId: dbMember.id,
            memberDiscordId: dbMember.discordId,
        });
        return false;
    }

    const updateData = {
        isActive: false,
        status: 'REJECTED',
        updatedAt: new Date(),
    };

    await db.update(members)
        .set(updateData)
        .where(and(eq(members.id, dbMember.id), eq(members.gangId, gangId)));

    await db.insert(auditLogs).values({
        id: uuid(),
        gangId,
        actorId,
        actorName,
        action: 'MEMBER_DISCORD_LEAVE',
        targetType: 'MEMBER',
        targetId: dbMember.id,
        oldValue: JSON.stringify({
            isActive: dbMember.isActive,
            status: dbMember.status,
        }),
        newValue: JSON.stringify(updateData),
        details: JSON.stringify({
            reason,
            discordGuildId: guildId,
            discordId: dbMember.discordId,
            memberName: dbMember.name,
        }),
    });

    logInfo('bot.role_sync.member_deactivated_after_discord_leave', {
        guildId,
        gangId,
        memberId: dbMember.id,
        memberDiscordId: dbMember.discordId,
        reason,
    });

    return true;
}

function expectedPermissionLevelsForMember(dbMember: DbMemberRoleState): Set<PermissionLevel> {
    if (dbMember.status !== 'APPROVED' || !dbMember.isActive) {
        return new Set();
    }

    const dbRole = normalizePermissionLevel(dbMember.gangRole);
    if (!dbRole) {
        return new Set();
    }

    // Server owner keeps the display Owner role and the base Member role created by setup.
    if (dbRole === 'OWNER') {
        return new Set(['OWNER', 'MEMBER']);
    }

    return new Set([dbRole]);
}

async function reconcileMappedGangRoles(member: GuildMember, gangId: string, dbMember: DbMemberRoleState, mappings: GangRoleMapping[]) {
    if (member.id === member.guild.ownerId) {
        logInfo('bot.role_sync.discord_role_reconcile_skipped_for_guild_owner', {
            guildId: member.guild.id,
            gangId,
            memberDiscordId: member.id,
            memberDbRole: dbMember.gangRole,
        });
        return;
    }

    const expectedPermissions = expectedPermissionLevelsForMember(dbMember);
    const managedMappings = mappings
        .map((mapping) => ({
            ...mapping,
            permissionLevel: normalizePermissionLevel(mapping.permissionLevel),
        }))
        .filter((mapping): mapping is GangRoleMapping & { permissionLevel: PermissionLevel } => Boolean(mapping.permissionLevel));

    const expectedRoleIds = new Set(
        managedMappings
            .filter((mapping) => expectedPermissions.has(mapping.permissionLevel))
            .map((mapping) => mapping.discordRoleId)
    );
    const managedRoleIds = new Set(managedMappings.map((mapping) => mapping.discordRoleId));
    const memberRoleIds = new Set(member.roles.cache.map((role) => role.id));

    const roleIdsToRemove = [...managedRoleIds].filter((roleId) => memberRoleIds.has(roleId) && !expectedRoleIds.has(roleId));
    const roleIdsToAdd = [...expectedRoleIds].filter((roleId) => !memberRoleIds.has(roleId));

    for (const roleId of roleIdsToRemove) {
        const role = member.roles.cache.get(roleId) ?? member.guild.roles.cache.get(roleId);
        if (!role) {
            continue;
        }

        try {
            await member.roles.remove(role, 'Gang Manager role sync: DB role is source of truth');
            logInfo('bot.role_sync.discord_role_removed', {
                guildId: member.guild.id,
                gangId,
                memberDiscordId: member.id,
                memberDbRole: dbMember.gangRole,
                roleId,
            });
        } catch (error) {
            logWarn('bot.role_sync.discord_role_remove_failed', {
                guildId: member.guild.id,
                gangId,
                memberDiscordId: member.id,
                memberDbRole: dbMember.gangRole,
                roleId,
                error,
            });
        }
    }

    for (const roleId of roleIdsToAdd) {
        const role = member.guild.roles.cache.get(roleId);
        if (!role) {
            logWarn('bot.role_sync.expected_role_missing', {
                guildId: member.guild.id,
                gangId,
                memberDiscordId: member.id,
                memberDbRole: dbMember.gangRole,
                roleId,
            });
            continue;
        }

        try {
            await member.roles.add(role, 'Gang Manager role sync: DB role is source of truth');
            logInfo('bot.role_sync.discord_role_added', {
                guildId: member.guild.id,
                gangId,
                memberDiscordId: member.id,
                memberDbRole: dbMember.gangRole,
                roleId,
            });
        } catch (error) {
            logWarn('bot.role_sync.discord_role_add_failed', {
                guildId: member.guild.id,
                gangId,
                memberDiscordId: member.id,
                memberDbRole: dbMember.gangRole,
                roleId,
                error,
            });
        }
    }
}

export async function handleRoleSync(member: GuildMember) {
    if (member.user.bot) return;

    // 1. Find Gang associated with this Guild
    const gang = await db.query.gangs.findFirst({
        where: eq(gangs.discordGuildId, member.guild.id),
        with: {
            roles: true
        }
    });

    if (!gang) return;

    // 2. Find Member record in DB
    const dbMember = await db.query.members.findFirst({
        where: and(eq(members.discordId, member.user.id), eq(members.gangId, gang.id))
    });

    // CRITICAL: Only sync for registered members
    if (!dbMember) return;

    const updates: Partial<typeof members.$inferSelect> = {};

    // 3. Reconcile Discord roles from DB. Discord role changes must never promote DB permissions.
    await reconcileMappedGangRoles(member, gang.id, dbMember, gang.roles ?? []);

    // 4. Sync Details (Name & Avatar) - Always sync this
    const discordUsername = member.user.username;
    const discordAvatar = member.user.displayAvatarURL({ extension: 'png', size: 128 });

    if (dbMember.discordUsername !== discordUsername) updates.discordUsername = discordUsername;
    if (dbMember.discordAvatar !== discordAvatar) updates.discordAvatar = discordAvatar;

    if (Object.keys(updates).length > 0) {
        logInfo('bot.role_sync.member_details_updated', {
            guildId: member.guild.id,
            memberDiscordId: member.id,
            updates,
        });
        await db.update(members)
            .set(updates)
            .where(eq(members.id, dbMember.id));
    }
}

export async function handleGuildMemberRemove(member: GuildMember | PartialGuildMember) {
    if (member.user.bot) return;

    const gang = await db.query.gangs.findFirst({
        where: eq(gangs.discordGuildId, member.guild.id),
        columns: {
            id: true,
            discordGuildId: true,
        },
    });

    if (!gang) return;

    const dbMember = await db.query.members.findFirst({
        where: and(eq(members.discordId, member.user.id), eq(members.gangId, gang.id)),
    });

    if (!dbMember) return;

    await deactivateMemberAfterDiscordLeave({
        guildId: member.guild.id,
        gangId: gang.id,
        dbMember: {
            ...dbMember,
            discordId: member.user.id,
        },
        actorId: member.user.id,
        actorName: member.user.username || dbMember.name || member.user.id,
        reason: 'Discord guild member removed',
    });
}

export async function reconcileGuildMemberPresence(guild: Guild) {
    const gang = await db.query.gangs.findFirst({
        where: eq(gangs.discordGuildId, guild.id),
        columns: {
            id: true,
            discordGuildId: true,
        },
    });

    if (!gang) {
        return { checked: 0, deactivated: 0, skipped: 0 };
    }

    const activeMembers = await db.query.members.findMany({
        where: and(
            eq(members.gangId, gang.id),
            eq(members.isActive, true),
            eq(members.status, 'APPROVED')
        ),
        columns: {
            id: true,
            discordId: true,
            name: true,
            gangRole: true,
            status: true,
            isActive: true,
        },
    });

    let checked = 0;
    let deactivated = 0;
    let skipped = 0;

    for (const dbMember of activeMembers as DbMemberRoleState[]) {
        if (!dbMember.discordId) {
            skipped += 1;
            continue;
        }

        checked += 1;

        try {
            await guild.members.fetch({ user: dbMember.discordId, force: true });
        } catch (error) {
            if (!isUnknownDiscordMemberError(error)) {
                skipped += 1;
                logWarn('bot.member_presence_reconcile.member_fetch_failed', {
                    guildId: guild.id,
                    gangId: gang.id,
                    memberId: dbMember.id,
                    memberDiscordId: dbMember.discordId,
                    error,
                });
                continue;
            }

            const didDeactivate = await deactivateMemberAfterDiscordLeave({
                guildId: guild.id,
                gangId: gang.id,
                dbMember,
                actorId: 'system:member-presence-reconcile',
                actorName: 'Member Presence Reconcile',
                reason: 'Discord guild member missing during reconciliation',
            });

            if (didDeactivate) {
                deactivated += 1;
            }
        }
    }

    logInfo('bot.member_presence_reconcile.guild_completed', {
        guildId: guild.id,
        gangId: gang.id,
        checked,
        deactivated,
        skipped,
    });

    return { checked, deactivated, skipped };
}

export async function reconcileAllGuildMemberPresence(reason = 'manual') {
    const guilds = Array.from(client.guilds.cache.values());
    let checked = 0;
    let deactivated = 0;
    let skipped = 0;

    for (const guild of guilds) {
        try {
            const result = await reconcileGuildMemberPresence(guild);
            checked += result.checked;
            deactivated += result.deactivated;
            skipped += result.skipped;
        } catch (error) {
            logError('bot.member_presence_reconcile.guild_failed', error, {
                reason,
                guildId: guild.id,
            });
        }
    }

    logInfo('bot.member_presence_reconcile.completed', {
        reason,
        guildCount: guilds.length,
        checked,
        deactivated,
        skipped,
    });

    return { guildCount: guilds.length, checked, deactivated, skipped };
}

export function startMemberPresenceReconciliation() {
    if (memberPresenceReconciliationStarted) {
        return;
    }

    memberPresenceReconciliationStarted = true;
    const intervalMs = resolveMemberPresenceReconcileIntervalMs();

    const run = (reason: string) => {
        void reconcileAllGuildMemberPresence(reason).catch((error) => {
            logError('bot.member_presence_reconcile.failed', error, { reason });
        });
    };

    const startupTimer = setTimeout(() => run('startup'), DEFAULT_MEMBER_PRESENCE_RECONCILE_STARTUP_DELAY_MS);
    startupTimer.unref?.();

    const interval = setInterval(() => run('interval'), intervalMs);
    interval.unref?.();

    logInfo('bot.member_presence_reconcile.started', {
        intervalMs,
        startupDelayMs: DEFAULT_MEMBER_PRESENCE_RECONCILE_STARTUP_DELAY_MS,
    });
}
