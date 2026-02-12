import { ActionRowBuilder, ButtonBuilder, ButtonStyle, CategoryChannel, ChannelType, ColorResolvable, EmbedBuilder, PermissionsBitField, Role, TextChannel, Guild } from 'discord.js';
import { client } from '../index';
import { db, gangs, gangRoles, gangSettings } from '@gang/database';
import { eq } from 'drizzle-orm';

export async function dissolveGang(gangId: string, options: { deleteData: boolean }) {
    console.log(`[Dissolve] Starting dissolution for gang ${gangId}`);

    // 1. Get Gang Info & Settings
    const gang = await db.query.gangs.findFirst({
        where: eq(gangs.id, gangId),
        with: {
            settings: true,
            roles: true,
        }
    });

    if (!gang) {
        throw new Error('Gang not found');
    }

    const guild = client.guilds.cache.get(gang.discordGuildId);
    if (!guild) {
        console.error(`[Dissolve] Guild ${gang.discordGuildId} not found`);
        return;
    }

    // 2. Delete Roles (Crucial for fixing "Ghost Roles")
    // This allows users to see the register channel again
    const rolesToDelete = gang.roles.map(r => r.discordRoleId);

    // Add built-in roles if they exist in DB mappings (or hardcoded known patterns if needed)
    // Here we rely on `gangRoles` table which should contain all mapped roles

    for (const roleId of rolesToDelete) {
        try {
            const role = guild.roles.cache.get(roleId);
            if (role) {
                await role.delete('Gang Dissolved');
                console.log(`[Dissolve] Deleted role ${role.name} (${roleId})`);
            }
        } catch (error) {
            console.error(`[Dissolve] Failed to delete role ${roleId}:`, error);
        }
    }

    // 3. Delete Channels (if they exist in settings)
    const channelsToDelete: string[] = [];
    if (gang.settings) {
        if (gang.settings.registerChannelId) channelsToDelete.push(gang.settings.registerChannelId);
        if (gang.settings.attendanceChannelId) channelsToDelete.push(gang.settings.attendanceChannelId);
        if (gang.settings.financeChannelId) channelsToDelete.push(gang.settings.financeChannelId);
        if (gang.settings.logChannelId) channelsToDelete.push(gang.settings.logChannelId);
        if (gang.settings.announcementChannelId) channelsToDelete.push(gang.settings.announcementChannelId);
        if (gang.settings.leaveChannelId) channelsToDelete.push(gang.settings.leaveChannelId);
    }

    // Categories to search and delete
    const categoriesToDelete = [
        '📌 ข้อมูลทั่วไป',
        '⏰ ระบบเช็คชื่อ',
        '💰 ระบบการเงิน',
        '🔒 หัวแก๊ง',
        '🔊 ห้องพูดคุย'
    ];

    // Find and add categories to delete list (we can't rely on IDs easily as they aren't all stored individually, except maybe implicitly)
    // Actually, we should just find them by name in the guild, as they are created with specific names.
    // NOTE: This might delete categories with same name not created by bot if user manually created perfectly matching name.
    // But given the emojis, it's fairly specific.

    for (const catName of categoriesToDelete) {
        const category = guild.channels.cache.find(c => c.name === catName && c.type === ChannelType.GuildCategory);
        if (category) {
            channelsToDelete.push(category.id);
        }
    }

    for (const channelId of channelsToDelete) {
        try {
            const channel = guild.channels.cache.get(channelId);
            if (channel) {
                // If it's in a category associated with the gang, we might want to delete the category too
                // But simplified: just delete the specific channels we created
                await channel.delete('Gang Dissolved');
                console.log(`[Dissolve] Deleted channel ${channel.name} (${channelId})`);
            }
        } catch (error) {
            console.error(`[Dissolve] Failed to delete channel ${channelId}:`, error);
        }
    }

    // 4. Update Database
    if (options.deleteData) {
        // Hard Delete
        await db.delete(gangs).where(eq(gangs.id, gangId));
        console.log(`[Dissolve] Hard deleted gang record`);
    } else {
        // Soft Delete
        await db.update(gangs)
            .set({
                dissolvedAt: new Date(),
                isActive: false
            })
            .where(eq(gangs.id, gangId));
        console.log(`[Dissolve] Soft deleted gang record`);
    }

    console.log(`[Dissolve] Completed dissolution for gang ${gangId}`);
}
