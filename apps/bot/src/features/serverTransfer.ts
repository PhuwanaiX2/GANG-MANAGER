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
import { thaiTimestamp } from '../utils/thaiTime';
import { logError, logInfo, logWarn } from '../utils/logger';

// Register button handlers
registerButtonHandler('transfer_confirm', handleTransferConfirm);
registerButtonHandler('transfer_leave', handleTransferLeave);

function isTransferDeadlinePassed(deadline: Date | string | number | null | undefined) {
    if (!deadline) return false;

    const deadlineDate = deadline instanceof Date ? deadline : new Date(deadline);
    if (Number.isNaN(deadlineDate.getTime())) return false;

    return Date.now() > deadlineDate.getTime();
}

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
        logWarn('bot.transfer.announcement.gang_missing', { gangId });
        return;
    }

    const guild = client.guilds.cache.get(gang.discordGuildId);
    if (!guild) {
        logWarn('bot.transfer.announcement.guild_missing', {
            gangId,
            guildId: gang.discordGuildId,
        });
        return;
    }

    // Find announcement channel
    const channelId = gang.settings.announcementChannelId;
    if (!channelId) {
        logWarn('bot.transfer.announcement.channel_unconfigured', { gangId });
        return;
    }

    const channel = guild.channels.cache.get(channelId) as TextChannel;
    if (!channel) {
        logWarn('bot.transfer.announcement.channel_missing', {
            gangId,
            channelId,
        });
        return;
    }

    const deadline = new Date(deadlineISO);
    const deadlineStr = deadline.toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Bangkok',
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
        .setFooter({ text: `สมาชิกทั้งหมด: ${memberDiscordIds.length} คน • ${thaiTimestamp()}` });

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

    logInfo('bot.transfer.announcement.sent', {
        gangId,
        channelId,
        guildId: gang.discordGuildId,
        memberCount: memberDiscordIds.length,
    });
}

// --- Button Handlers ---

async function handleTransferConfirm(interaction: ButtonInteraction) {
    const gangId = interaction.customId.replace('transfer_confirm_', '');
    if (!gangId) {
        await interaction.reply({ content: '❌ ข้อมูลผิดพลาด', ephemeral: true });
        return;
    }

    // Acknowledge immediately to avoid timeout
    await interaction.deferUpdate();

    const gang = await db.query.gangs.findFirst({
        where: eq(gangs.id, gangId),
        columns: { transferStatus: true, transferDeadline: true, name: true },
    });
    if (!gang || gang.transferStatus !== 'ACTIVE') {
        await interaction.followUp({ content: '❌ การย้ายเซิร์ฟสิ้นสุดแล้ว', ephemeral: true });
        return;
    }
    if (isTransferDeadlinePassed(gang.transferDeadline)) {
        await interaction.followUp({ content: '⏰ หมดเวลายืนยันแล้ว กรุณารอหัวหน้าแก๊งสรุปผลการย้ายเซิร์ฟ', ephemeral: true });
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
        await interaction.followUp({ content: '❌ คุณไม่ได้อยู่ในแก๊งนี้', ephemeral: true });
        return;
    }

    if (member.gangRole === 'OWNER') {
        await interaction.followUp({ content: '👑 คุณเป็นหัวแก๊ง สถานะยืนยันอัตโนมัติแล้วครับ', ephemeral: true });
        return;
    }

    if (member.transferStatus === 'CONFIRMED') {
        await interaction.followUp({ content: '✅ คุณยืนยันไปแล้วครับ', ephemeral: true });
        return;
    }

    // Now they can switch from LEFT to CONFIRMED

    // Save confirmed status
    await db.update(members)
        .set({ transferStatus: 'CONFIRMED' })
        .where(eq(members.id, member.id));

    // Update embed in-place to show current status
    await updateTransferEmbed(interaction, gangId);

    await interaction.followUp({ content: '✅ คุณยืนยันไปแล้ว', ephemeral: true });

    logInfo('bot.transfer.member.confirmed', {
        gangId,
        memberId: member.id,
        memberDiscordId: interaction.user.id,
    });
}

async function handleTransferLeave(interaction: ButtonInteraction) {
    const gangId = interaction.customId.replace('transfer_leave_', '');
    if (!gangId) {
        await interaction.reply({ content: '❌ ข้อมูลผิดพลาด', ephemeral: true });
        return;
    }

    // Acknowledge immediately to avoid timeout
    await interaction.deferUpdate();

    const gang = await db.query.gangs.findFirst({
        where: eq(gangs.id, gangId),
        columns: { transferStatus: true, transferDeadline: true },
    });
    if (!gang || gang.transferStatus !== 'ACTIVE') {
        await interaction.followUp({ content: '❌ การย้ายเซิร์ฟสิ้นสุดแล้ว', ephemeral: true });
        return;
    }
    if (isTransferDeadlinePassed(gang.transferDeadline)) {
        await interaction.followUp({ content: '⏰ หมดเวลายืนยันแล้ว กรุณารอหัวหน้าแก๊งสรุปผลการย้ายเซิร์ฟ', ephemeral: true });
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
        await interaction.followUp({ content: '❌ คุณไม่ได้อยู่ในแก๊งนี้', ephemeral: true });
        return;
    }

    if (member.gangRole === 'OWNER') {
        await interaction.followUp({ content: '👑 คุณเป็นหัวแก๊ง ไม่สามารถออกผ่านปุ่มนี้ได้ครับ', ephemeral: true });
        return;
    }

    if (member.transferStatus === 'LEFT') {
        await interaction.followUp({ content: '👋 คุณเลือกออกจากแก๊งไปแล้วครับ', ephemeral: true });
        return;
    }

    // Now they can switch from CONFIRMED to LEFT

    // Mark as LEFT only — actual deactivation + role removal happens when transfer completes
    await db.update(members)
        .set({ transferStatus: 'LEFT' })
        .where(eq(members.id, member.id));

    // Update embed in-place to show current status
    await updateTransferEmbed(interaction, gangId);

    await interaction.followUp({ content: '👋 บันทึกแล้ว คุณจะถูกนำออกจากแก๊งเมื่อกระบวนการย้ายเซิร์ฟเสร็จสิ้น', ephemeral: true });

    logInfo('bot.transfer.member.left', {
        gangId,
        memberId: member.id,
        memberDiscordId: interaction.user.id,
    });
}

// === Helper: Update transfer embed with current member statuses ===
async function updateTransferEmbed(interaction: ButtonInteraction, gangId: string) {
    try {
        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.id, gangId),
            columns: { name: true },
        });

        const allMembers = await db.query.members.findMany({
            where: and(
                eq(members.gangId, gangId),
                eq(members.isActive, true),
            ),
            columns: { name: true, transferStatus: true, gangRole: true, discordId: true },
        });

        const owner = allMembers.find(m => m.gangRole === 'OWNER');
        const confirmed = allMembers.filter(m => m.transferStatus === 'CONFIRMED' || m.gangRole === 'OWNER');
        const left = allMembers.filter(m => m.transferStatus === 'LEFT');
        const pending = allMembers.filter(m => m.transferStatus === 'PENDING' || (!m.transferStatus && m.gangRole !== 'OWNER'));

        const confirmedNames = confirmed.map(m => `> ✅ ${m.name}${m.gangRole === 'OWNER' ? ' 👑' : ''}`).join('\n') || '> -';
        const leftNames = left.map(m => `> ❌ ${m.name}`).join('\n') || '> -';

        const embed = interaction.message.embeds[0];

        const updatedEmbed = {
            title: '🔄 แก๊งย้ายเซิร์ฟเกม!',
            description:
                `หัวหน้าแก๊ง **${gang?.name || '?'}** ได้ตัดสินใจย้ายเซิร์ฟเกมแล้ว!\n` +
                `กดปุ่มด้านล่างเพื่อยืนยัน **เลือกได้ครั้งเดียวเท่านั้น**`,
            color: 0xFF8C00,
            fields: [
                { name: `✅ ตามไป (${confirmed.length})`, value: confirmedNames.slice(0, 1024), inline: true },
                { name: `❌ ออก (${left.length})`, value: leftNames.slice(0, 1024), inline: true },
                { name: `⏳ รอยืนยัน`, value: `${pending.length} คน`, inline: true },
            ],
            footer: {
                text: `สมาชิกทั้งหมดที่ต้องยืนยัน: ${allMembers.length - (owner ? 1 : 0)} คน • วันนี้ เวลา ${new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })}`,
            },
            timestamp: new Date().toISOString(),
        };

        await interaction.editReply({
            embeds: [updatedEmbed],
            components: interaction.message.components,
        });
    } catch (err) {
        logError('bot.transfer.embed_update.failed', err, {
            gangId,
            actorDiscordId: interaction.user.id,
            messageId: interaction.message?.id,
        });
    }
}
