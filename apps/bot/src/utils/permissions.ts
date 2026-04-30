import { Guild, Interaction } from 'discord.js';
import { db, gangRoles, members } from '@gang/database';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { logInfo, logWarn } from './logger';

export type PermissionLevel = 'OWNER' | 'ADMIN' | 'TREASURER' | 'ATTENDANCE_OFFICER' | 'MEMBER';

type GangRoleMapping = {
    discordRoleId: string;
    permissionLevel: string;
};

type ActiveGangMember = {
    id: string;
    gangId: string;
    discordId: string | null;
    name: string;
    gangRole: string;
    status: string;
    isActive: boolean;
};

const ROLE_ACCESS: Record<PermissionLevel, PermissionLevel[]> = {
    OWNER: ['OWNER'],
    ADMIN: ['OWNER', 'ADMIN'],
    TREASURER: ['OWNER', 'TREASURER'],
    ATTENDANCE_OFFICER: ['OWNER', 'ADMIN', 'ATTENDANCE_OFFICER'],
    MEMBER: ['OWNER', 'ADMIN', 'TREASURER', 'ATTENDANCE_OFFICER', 'MEMBER'],
};

const ROLE_SYNC_PRIORITY: PermissionLevel[] = ['ADMIN', 'TREASURER', 'ATTENDANCE_OFFICER', 'MEMBER'];

export function normalizePermissionLevel(value: string | null | undefined): PermissionLevel | null {
    if (!value) return null;
    if (value === 'OWNER' || value === 'ADMIN' || value === 'TREASURER' || value === 'ATTENDANCE_OFFICER' || value === 'MEMBER') {
        return value;
    }
    return null;
}

export function hasPermissionLevel(
    userRole: string | null | undefined,
    requiredLevels: PermissionLevel[]
): boolean {
    const normalizedRole = normalizePermissionLevel(userRole);
    if (!normalizedRole) return false;

    return requiredLevels.some((requiredLevel) => ROLE_ACCESS[requiredLevel].includes(normalizedRole));
}

export function resolveSyncedGangRole(
    memberRoleIds: string[],
    mappings: GangRoleMapping[]
): PermissionLevel {
    const mappedPermissions = new Set<PermissionLevel>();

    for (const mapping of mappings) {
        if (!memberRoleIds.includes(mapping.discordRoleId)) {
            continue;
        }

        const normalizedPermission = normalizePermissionLevel(mapping.permissionLevel);
        if (!normalizedPermission) {
            continue;
        }

        // Safety rule: Discord role mapping alone never promotes someone to DB OWNER.
        mappedPermissions.add(normalizedPermission === 'OWNER' ? 'ADMIN' : normalizedPermission);
    }

    for (const level of ROLE_SYNC_PRIORITY) {
        if (mappedPermissions.has(level)) {
            return level;
        }
    }

    return 'MEMBER';
}

export async function getGangMemberByDiscordId(
    gangId: string,
    discordId: string
): Promise<ActiveGangMember | null> {
    const member = await db.query.members.findFirst({
        where: and(
            eq(members.gangId, gangId),
            eq(members.discordId, discordId),
            eq(members.isActive, true),
            eq(members.status, 'APPROVED')
        ),
        columns: {
            id: true,
            gangId: true,
            discordId: true,
            name: true,
            gangRole: true,
            status: true,
            isActive: true,
        },
    });

    return member ?? null;
}

export async function getGangRoleMappings(gangId: string): Promise<GangRoleMapping[]> {
    return db.query.gangRoles.findMany({
        where: eq(gangRoles.gangId, gangId),
        columns: {
            discordRoleId: true,
            permissionLevel: true,
        },
    });
}

export async function syncDiscordGuildOwnerMembership(gangId: string, guild: Guild) {
    const ownerDiscordId = guild.ownerId;
    if (!ownerDiscordId) {
        return;
    }

    const ownerGuildMember = await guild.members.fetch(ownerDiscordId).catch((error) => {
        logWarn('bot.permissions.owner_fetch_failed', {
            guildId: guild.id,
            gangId,
            ownerDiscordId,
            error,
        });
        return null;
    });

    const ownerName = ownerGuildMember?.displayName || ownerGuildMember?.user.username || 'Discord Server Owner';
    const ownerAvatar = ownerGuildMember?.user.displayAvatarURL({ extension: 'png', size: 128 }) || null;

    const ownerRecords = await db.query.members.findMany({
        where: and(
            eq(members.gangId, gangId),
            eq(members.gangRole, 'OWNER'),
            eq(members.isActive, true),
            eq(members.status, 'APPROVED')
        ),
        columns: {
            id: true,
            discordId: true,
            gangRole: true,
        },
    });

    for (const ownerRecord of ownerRecords) {
        if (ownerRecord.discordId && ownerRecord.discordId !== ownerDiscordId) {
            await db.update(members)
                .set({ gangRole: 'ADMIN' })
                .where(eq(members.id, ownerRecord.id));

            logInfo('bot.permissions.owner_demoted_after_discord_transfer', {
                guildId: guild.id,
                gangId,
                previousOwnerDiscordId: ownerRecord.discordId,
                nextOwnerDiscordId: ownerDiscordId,
            });
        }
    }

    const currentOwner = await db.query.members.findFirst({
        where: and(
            eq(members.gangId, gangId),
            eq(members.discordId, ownerDiscordId)
        ),
    });

    if (currentOwner) {
        if (
            currentOwner.gangRole !== 'OWNER'
            || currentOwner.status !== 'APPROVED'
            || !currentOwner.isActive
            || currentOwner.discordUsername !== ownerGuildMember?.user.username
            || currentOwner.discordAvatar !== ownerAvatar
        ) {
            await db.update(members)
                .set({
                    gangRole: 'OWNER',
                    status: 'APPROVED',
                    isActive: true,
                    discordUsername: ownerGuildMember?.user.username || currentOwner.discordUsername,
                    discordAvatar: ownerAvatar || currentOwner.discordAvatar,
                })
                .where(eq(members.id, currentOwner.id));
        }
        return;
    }

    await db.insert(members).values({
        id: nanoid(),
        gangId,
        discordId: ownerDiscordId,
        name: ownerName,
        discordUsername: ownerGuildMember?.user.username || ownerName,
        discordAvatar: ownerAvatar,
        status: 'APPROVED',
        gangRole: 'OWNER',
        isActive: true,
    });

    logInfo('bot.permissions.owner_membership_created', {
        guildId: guild.id,
        gangId,
        ownerDiscordId,
    });
}

/**
 * Database member role is the source of truth for bot permissions.
 * Discord role mappings are only used to sync that DB role, not to authorize actions directly.
 */
export async function checkPermission(
    interaction: Interaction,
    gangId: string,
    requiredLevels: PermissionLevel[]
): Promise<boolean> {
    if (interaction.guild) {
        await syncDiscordGuildOwnerMembership(gangId, interaction.guild);
    }

    const dbMember = await getGangMemberByDiscordId(gangId, interaction.user.id);
    if (!dbMember) {
        return false;
    }

    return hasPermissionLevel(dbMember.gangRole, requiredLevels);
}

export async function getUserPermissionLevel(
    interaction: Interaction,
    gangId: string
): Promise<PermissionLevel | null> {
    const dbMember = await getGangMemberByDiscordId(gangId, interaction.user.id);
    return normalizePermissionLevel(dbMember?.gangRole);
}
