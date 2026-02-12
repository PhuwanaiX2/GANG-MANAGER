import { Interaction, GuildMember } from 'discord.js';
import { db, members } from '@gang/database';
import { eq, and } from 'drizzle-orm';

export type PermissionLevel = 'OWNER' | 'ADMIN' | 'TREASURER' | 'MEMBER';

/**
 * Check if user has required permission level
 * Now checks Database Role instead of Discord Role
 */
export async function checkPermission(
    interaction: Interaction,
    gangId: string,
    requiredLevels: PermissionLevel[]
): Promise<boolean> {
    const member = interaction.member as GuildMember;
    if (!member) return false;

    // Server owner always has permission
    if (interaction.guild?.ownerId === member.id) {
        return true;
    }

    // Administrator permission always has access
    if (member.permissions.has('Administrator')) {
        return true;
    }

    // Check Member in Database
    const dbMember = await db.query.members.findFirst({
        where: and(
            eq(members.gangId, gangId),
            eq(members.discordId, member.id),
            eq(members.isActive, true),
            eq(members.status, 'APPROVED')
        ),
    });

    if (!dbMember) return false;

    // Map DB Role to Permission Level
    // DB Roles: OWNER, ADMIN, TREASURER, MEMBER
    const userRole = dbMember.gangRole as PermissionLevel;

    // Check if userRole is in requiredLevels
    // Also handle hierarchy: OWNER > ADMIN > TREASURER > MEMBER
    // Actually, the caller usually provides a list of allowed roles.
    // But usually "ADMIN" implies "TREASURER" access? 
    // The current usage usually passes ['OWNER', 'ADMIN'] etc.
    // So we just check if included.

    return requiredLevels.includes(userRole);
}

/**
 * Get user's highest permission level
 */
export async function getUserPermissionLevel(
    member: GuildMember,
    gangId: string
): Promise<PermissionLevel | null> {
    // Server owner is always OWNER
    if (member.guild.ownerId === member.id) {
        return 'OWNER';
    }

    // Administrator is OWNER
    if (member.permissions.has('Administrator')) {
        return 'OWNER';
    }

    // Check Member in Database
    const dbMember = await db.query.members.findFirst({
        where: and(
            eq(members.gangId, gangId),
            eq(members.discordId, member.id),
            eq(members.isActive, true),
            eq(members.status, 'APPROVED')
        ),
    });

    if (!dbMember) return null;

    return dbMember.gangRole as PermissionLevel;
}
