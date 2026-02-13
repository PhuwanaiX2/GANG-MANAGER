import {
    ButtonInteraction,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    TextChannel,
} from 'discord.js';
import { registerButtonHandler } from '../handlers';
import { db, gangs, gangSettings, members } from '@gang/database';
import { eq, and } from 'drizzle-orm';
import { client } from '../index';

// Register button handlers
registerButtonHandler('transfer_confirm', handleTransferConfirm);
registerButtonHandler('transfer_leave', handleTransferLeave);

/**
 * Send server transfer announcement to the gang's announcement channel
 * Called from the web API via internal route or directly
 */
export async function sendTransferAnnouncement(gangId: string, deadlineISO: string, memberDiscordIds: string[]) {
    const gang = await db.query.gangs.findFirst({
        where: eq(gangs.id, gangId),
        with: { settings: true },
    });

    if (!gang || !gang.settings) {
        console.error(`[Transfer] Gang ${gangId} not found or no settings`);
        return;
    }

    const guild = client.guilds.cache.get(gang.discordGuildId);
    if (!guild) {
        console.error(`[Transfer] Guild ${gang.discordGuildId} not found in cache`);
        return;
    }

    // Find announcement channel
    const channelId = gang.settings.announcementChannelId;
    if (!channelId) {
        console.error(`[Transfer] No announcement channel set for gang ${gangId}`);
        return;
    }

    const channel = guild.channels.cache.get(channelId) as TextChannel;
    if (!channel) {
        console.error(`[Transfer] Channel ${channelId} not found`);
        return;
    }

    const deadline = new Date(deadlineISO);
    const deadlineStr = deadline.toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    const embed = new EmbedBuilder()
        .setColor(0xFF8C00)
        .setTitle('🔄 แก๊งย้ายเซิร์ฟเกม!')
        .setDescription(
            `แก๊ง **${gang.name}** กำลังย้ายเซิร์ฟเกม!\n\n` +
            `กดปุ่มด้านล่างเพื่อยืนยันว่าคุณจะ **ตามไปด้วย** หรือ **ออกจากแก๊ง**\n\n` +
            `⏰ **Deadline:** ${deadlineStr}\n` +
            `⚠️ สมาชิกที่ไม่ยืนยันภายในเวลากำหนดจะถูก deactivate อัตโนมัติ`
        )
        .setFooter({ text: `สมาชิกทั้งหมด: ${memberDiscordIds.length} คน` })
        .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`transfer_confirm_${gangId}`)
            .setLabel('✅ ตามไปด้วย')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`transfer_leave_${gangId}`)
            .setLabel('❌ ออกจากแก๊ง')
            .setStyle(ButtonStyle.Danger),
    );

    // Send announcement + mention everyone
    await channel.send({
        content: memberDiscordIds.map(id => `<@${id}>`).join(' '),
        embeds: [embed],
        components: [row],
    });

    console.log(`[Transfer] Sent announcement to channel ${channelId} for gang ${gangId}`);
}

// --- Button Handlers ---

async function handleTransferConfirm(interaction: ButtonInteraction) {
    const gangId = interaction.customId.split('_')[2];
    if (!gangId) {
        await interaction.reply({ content: '❌ ข้อมูลผิดพลาด', ephemeral: true });
        return;
    }

    // Check if transfer is still active
    const gang = await db.query.gangs.findFirst({
        where: eq(gangs.id, gangId),
        columns: { transferStatus: true },
    });
    if (!gang || gang.transferStatus !== 'ACTIVE') {
        await interaction.reply({ content: '❌ การย้ายเซิร์ฟสิ้นสุดแล้ว', ephemeral: true });
        return;
    }

    const member = await db.query.members.findFirst({
        where: and(
            eq(members.discordId, interaction.user.id),
            eq(members.gangId, gangId),
            eq(members.isActive, true),
        ),
    });

    if (!member) {
        await interaction.reply({ content: '❌ คุณไม่ได้อยู่ในแก๊งนี้', ephemeral: true });
        return;
    }

    if (member.transferStatus === 'CONFIRMED') {
        await interaction.reply({ content: '✅ คุณยืนยันไปแล้ว', ephemeral: true });
        return;
    }

    // Save confirmed status
    await db.update(members)
        .set({ transferStatus: 'CONFIRMED' })
        .where(eq(members.id, member.id));

    await interaction.reply({
        content: '✅ **ยืนยันแล้ว!** คุณจะยังคงอยู่ในแก๊งหลังย้ายเซิร์ฟ',
        ephemeral: true,
    });

    console.log(`[Transfer] Member ${interaction.user.id} confirmed for gang ${gangId}`);
}

async function handleTransferLeave(interaction: ButtonInteraction) {
    const gangId = interaction.customId.split('_')[2];
    if (!gangId) {
        await interaction.reply({ content: '❌ ข้อมูลผิดพลาด', ephemeral: true });
        return;
    }

    // Check if transfer is still active
    const gang = await db.query.gangs.findFirst({
        where: eq(gangs.id, gangId),
        columns: { transferStatus: true },
    });
    if (!gang || gang.transferStatus !== 'ACTIVE') {
        await interaction.reply({ content: '❌ การย้ายเซิร์ฟสิ้นสุดแล้ว', ephemeral: true });
        return;
    }

    const member = await db.query.members.findFirst({
        where: and(
            eq(members.discordId, interaction.user.id),
            eq(members.gangId, gangId),
            eq(members.isActive, true),
        ),
    });

    if (!member) {
        await interaction.reply({ content: '❌ คุณไม่ได้อยู่ในแก๊งนี้', ephemeral: true });
        return;
    }

    if (member.gangRole === 'OWNER') {
        await interaction.reply({
            content: '❌ หัวแก๊ง (Owner) ไม่สามารถออกจากแก๊งผ่านปุ่มนี้ได้',
            ephemeral: true,
        });
        return;
    }

    if (member.transferStatus === 'LEFT') {
        await interaction.reply({ content: '👋 คุณออกจากแก๊งไปแล้ว', ephemeral: true });
        return;
    }

    // Deactivate member + mark as LEFT
    await db.update(members)
        .set({ isActive: false, transferStatus: 'LEFT' })
        .where(eq(members.id, member.id));

    // Try to remove Discord roles
    try {
        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.id, gangId),
            with: { roles: true },
        });

        if (gang) {
            const guild = client.guilds.cache.get(gang.discordGuildId);
            const guildMember = guild?.members.cache.get(interaction.user.id);
            if (guildMember && gang.roles) {
                for (const role of gang.roles) {
                    try {
                        await guildMember.roles.remove(role.discordRoleId);
                    } catch { }
                }
            }
        }
    } catch (err) {
        console.error(`[Transfer] Failed to remove roles for ${interaction.user.id}:`, err);
    }

    await interaction.reply({
        content: '👋 **ออกจากแก๊งแล้ว** — ขอบคุณที่อยู่ด้วยกัน!',
        ephemeral: true,
    });

    console.log(`[Transfer] Member ${interaction.user.id} left gang ${gangId}`);
}
