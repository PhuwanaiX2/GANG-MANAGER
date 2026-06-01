import { Events, GuildMember } from 'discord.js';
import { client } from '../index';
import { db, gangs, members } from '@gang/database';
import { eq, and } from 'drizzle-orm';
import { normalizePermissionLevel, type PermissionLevel } from '../utils/permissions';
import { logError, logInfo, logWarn } from '../utils/logger';

let roleSyncRegistered = false;

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
}

type GangRoleMapping = {
    discordRoleId: string;
    permissionLevel: string;
};

type DbMemberRoleState = {
    id: string;
    gangRole: string | null;
    status: string | null;
    isActive: boolean | null;
    discordUsername?: string | null;
    discordAvatar?: string | null;
};

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
