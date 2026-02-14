import {
    ModalSubmitInteraction,
    EmbedBuilder,
    GuildMember,
    ButtonInteraction,
} from 'discord.js';
import { registerModalHandler } from '../handlers';
import { db, gangs, members, gangRoles, gangSettings } from '@gang/database';
import { eq, and, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createAuditLog } from '../utils/auditLog';

// Register modal handler
registerModalHandler('register_modal', handleRegisterModal);

async function handleRegisterModal(interaction: ModalSubmitInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId;
    if (!guildId) return;

    // Extract gangId from customId (register_modal_<gangId>)
    const gangId = interaction.customId.replace('register_modal_', '');

    // Get form values
    const name = interaction.fields.getTextInputValue('name');

    // Get gang
    const gang = await db.query.gangs.findFirst({
        where: eq(gangs.id, gangId),
    });

    if (!gang) {
        await interaction.editReply('❌ ไม่พบข้อมูลแก๊ง');
        return;
    }

    // Check member limit for TRIAL
    if (gang.subscriptionTier === 'TRIAL') {
        const memberCount = await db.query.members.findMany({
            where: eq(members.gangId, gangId),
        });

        if (memberCount.length >= 20) {
            await interaction.editReply('❌ แก๊งนี้มีสมาชิกเต็มแล้ว (Trial จำกัด 20 คน)');
            return;
        }
    }

    try {
        const user = interaction.user;

        // Check for existing member record to update
        const existingMember = await db.query.members.findFirst({
            where: and(eq(members.gangId, gangId), eq(members.discordId, user.id))
        });

        const memberId = existingMember ? existingMember.id : nanoid();
        const isRejoin = !!existingMember;

        if (isRejoin) {
            // Update existing record
            await db.update(members).set({
                name: name,
                discordUsername: user.username,
                discordAvatar: user.displayAvatarURL(),
                status: 'PENDING',
                isActive: true,
                joinedAt: new Date(), // Reset join date on rejoin? Optional.
            }).where(eq(members.id, memberId));
        } else {
            // Create new member
            await db.insert(members).values({
                id: memberId,
                gangId: gangId,
                discordId: user.id,
                name: name,
                discordUsername: user.username,
                discordAvatar: user.displayAvatarURL(),
                status: 'PENDING',
            });
        }

        // NOTE: Role assignment moved to Approval Step

        // Create audit log
        await createAuditLog({
            gangId,
            actorId: user.id,
            actorName: user.username,
            action: isRejoin ? 'MEMBER_UPDATE' : 'MEMBER_REGISTER',
            targetType: 'member',
            targetId: memberId,
            newValue: { name, status: 'PENDING' },
            client: interaction.client,
        });

        // 1. Notify User
        const embed = new EmbedBuilder()
            .setColor(0xFEE75C) // Yellow for Pending
            .setTitle('⏳ ส่งคำขอเรียบร้อย')
            .setDescription(`คำขอเข้าแก๊ง **${gang.name}** ของคุณถูกส่งแล้ว\nกรุณารอหัวหน้าแก๊งหรือแอดมินอนุมัติ`)
            .addFields(
                { name: '👤 ชื่อในเกม', value: name, inline: true },
            )
            .setThumbnail(user.displayAvatarURL());

        await interaction.editReply({ embeds: [embed] });

        // 2. Notify Admins (Send Approval Request)
        await sendApprovalRequest(interaction, gangId, memberId, name, user);

    } catch (error) {
        console.error('Registration error:', error);
        await interaction.editReply('❌ เกิดข้อผิดพลาด กรุณาลองใหม่');
    }
}

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel, User } from 'discord.js';

async function sendApprovalRequest(interaction: ModalSubmitInteraction, gangId: string, memberId: string, name: string, user: User) {
    const settings = await db.query.gangSettings.findFirst({ where: eq(gangSettings.gangId, gangId) });

    // Use Request Channel (Priority) -> Log Channel -> Fallback
    let channelId = settings?.requestsChannelId || settings?.logChannelId;
    let channel: TextChannel | undefined;

    if (channelId) {
        channel = interaction.guild?.channels.cache.get(channelId) as TextChannel;
    }

    if (!channel) {
        channel = interaction.guild?.channels.cache.find(c => ['คำขอเข้าแก๊ง', 'log-ระบบ', 'bot-commands'].includes(c.name) && c.isTextBased()) as TextChannel;
    }

    if (!channel) return; // No admin channel found

    const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('📩 มีสมาชิกใหม่ขอเข้าแก๊ง')
        .setDescription(`**${name}** (<@${user.id}>) ต้องการเข้าร่วมแก๊ง`)
        .addFields(
            { name: 'Discord', value: `${user.username}`, inline: true },
            { name: 'ชื่อในเกม', value: name, inline: true }
        )
        .setThumbnail(user.displayAvatarURL())
        .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`approve_member_${memberId}`).setLabel('✅ อนุมัติ').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`reject_member_${memberId}`).setLabel('❌ ปฏิเสธ').setStyle(ButtonStyle.Danger)
    );

    // Fetch Admin and Owner Roles for Tagging
    const roles = await db.query.gangRoles.findMany({
        where: and(
            eq(gangRoles.gangId, gangId),
            or(eq(gangRoles.permissionLevel, 'ADMIN'), eq(gangRoles.permissionLevel, 'OWNER'))
        )
    });

    const mentions = roles.map(r => `<@&${r.discordRoleId}>`).join(' ');
    const content = mentions ? `${mentions} มีคำร้องขอเข้าแก๊งใหม่!` : '@here มีคำร้องขอเข้าแก๊งใหม่!';

    await channel.send({ content, embeds: [embed], components: [row] });
}

export async function assignMemberRole(interaction: ModalSubmitInteraction | ButtonInteraction, gangId: string, targetUser: GuildMember) {
    try {
        const member = targetUser;
        if (!member) return;

        // Determine permission level
        let targetPermission = 'MEMBER';

        // Check if user is Guild Owner
        if (member.id === member.guild?.ownerId) {
            targetPermission = 'OWNER';
        }

        // Get role mapping
        const roleMapping = await db.query.gangRoles.findFirst({
            where: and(
                eq(gangRoles.gangId, gangId),
                eq(gangRoles.permissionLevel, targetPermission)
            ),
        });

        // Always try to give MEMBER role as well if OWNER
        if (targetPermission === 'OWNER') {
            const memberRole = await db.query.gangRoles.findFirst({
                where: and(
                    eq(gangRoles.gangId, gangId),
                    eq(gangRoles.permissionLevel, 'MEMBER')
                ),
            });

            if (memberRole) {
                const role = member.guild?.roles.cache.get(memberRole.discordRoleId);
                if (role) await member.roles.add(role);
            }
        }

        if (!roleMapping) return;

        const role = member.guild?.roles.cache.get(roleMapping.discordRoleId);
        if (role) {
            await member.roles.add(role);
        }
    } catch (error) {
        console.error('Error assigning role:', error);
    }
}

export { handleRegisterModal };
