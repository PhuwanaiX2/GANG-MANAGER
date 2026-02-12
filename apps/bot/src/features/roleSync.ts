
import { Events, GuildMember } from 'discord.js';
import { client } from '../index';
import { db, gangs, gangRoles, members } from '@gang/database';
import { eq, and } from 'drizzle-orm';

export function registerRoleSync() {
    client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
        try {
            await handleRoleSync(newMember);
        } catch (error) {
            console.error('[RoleSync] Error syncing roles:', error);
        }
    });

    // Also sync on Join (just in case they have roles pre-assigned or re-join)
    client.on(Events.GuildMemberAdd, async (member) => {
        try {
            await handleRoleSync(member);
        } catch (error) {
            console.error('[RoleSync] Error syncing roles on join:', error);
        }
    });
}

async function handleRoleSync(member: GuildMember) {
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

    // 3. Sync Role (Hybrid Logic)
    // SAFETY RULE 1: If user is OWNER in DB, NEVER change their role via Sync
    if (dbMember.gangRole !== 'OWNER') {

        // Map Discord Roles to Permissions
        const memberRoleIds = member.roles.cache.map(r => r.id);

        // Create a map for fast lookup: RoleID -> Permission
        const roleMap = new Map<string, string>();
        for (const r of gang.roles) {
            roleMap.set(r.discordRoleId, r.permissionLevel);
        }

        // Determine Highest Role (Priority: ADMIN > TREASURER > MEMBER)
        // Note: OWNER Discord Role is treated as ADMIN here (Safety Rule 2)
        let highestRole = 'MEMBER';

        // Check for specific permission levels in order of priority
        if (memberRoleIds.some(id => roleMap.get(id) === 'OWNER')) highestRole = 'ADMIN'; // Downgrade Owner Discord Role to Admin
        else if (memberRoleIds.some(id => roleMap.get(id) === 'ADMIN')) highestRole = 'ADMIN';
        else if (memberRoleIds.some(id => roleMap.get(id) === 'TREASURER')) highestRole = 'TREASURER';
        else if (memberRoleIds.some(id => roleMap.get(id) === 'MEMBER')) highestRole = 'MEMBER';

        // Additional Logic: If they have NO mapped roles, should we keep them as MEMBER?
        // Current logic: Default is MEMBER. So if they lose all roles, they stay MEMBER.
        // This is safe. They won't lose access to history, just permissions.

        if (dbMember.gangRole !== highestRole) {
            console.log(`[RoleSync] Updating role for ${member.user.tag}: ${dbMember.gangRole} -> ${highestRole}`);
            updates.gangRole = highestRole;
        }
    }

    // 4. Sync Details (Name & Avatar) - Always sync this
    const discordUsername = member.user.username;
    const discordAvatar = member.user.displayAvatarURL({ extension: 'png', size: 128 });

    if (dbMember.discordUsername !== discordUsername) updates.discordUsername = discordUsername;
    if (dbMember.discordAvatar !== discordAvatar) updates.discordAvatar = discordAvatar;

    if (Object.keys(updates).length > 0) {
        console.log(`[RoleSync] Updating ${member.user.tag} details:`, updates);
        await db.update(members)
            .set(updates)
            .where(eq(members.id, dbMember.id));
    }
}
