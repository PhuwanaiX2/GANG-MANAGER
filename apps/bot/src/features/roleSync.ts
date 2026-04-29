import { Events, GuildMember } from 'discord.js';
import { client } from '../index';
import { db, gangs, members } from '@gang/database';
import { eq, and } from 'drizzle-orm';
import { resolveSyncedGangRole } from '../utils/permissions';
import { logError, logInfo } from '../utils/logger';

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

        const memberRoleIds = member.roles.cache.map(r => r.id);
        const highestRole = resolveSyncedGangRole(memberRoleIds, gang.roles);

        if (dbMember.gangRole !== highestRole) {
            logInfo('bot.role_sync.role_updated', {
                guildId: member.guild.id,
                memberDiscordId: member.id,
                previousGangRole: dbMember.gangRole,
                nextGangRole: highestRole,
            });
            updates.gangRole = highestRole;
        }
    }

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
