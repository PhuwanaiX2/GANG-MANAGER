import { ButtonInteraction, EmbedBuilder, PermissionFlagsBits, GuildMember } from 'discord.js';
import { registerButtonHandler } from '../handlers';
import { db, members, gangs } from '@gang/database';
import { eq, and } from 'drizzle-orm';
import { assignMemberRole } from './registerModal';
import { createAuditLog } from '../utils/auditLog';
import { checkPermission } from '../utils/permissions';

registerButtonHandler('approve_member', handleApproveMember);
registerButtonHandler('reject_member', handleRejectMember);

async function handleApproveMember(interaction: ButtonInteraction) {
    const memberId = interaction.customId.replace('approve_member_', '');
    const member = await db.query.members.findFirst({ where: eq(members.id, memberId) });

    if (!member) {
        await interaction.reply({ content: '❌ ไม่พบข้อมูลสมาชิก (อาจถูกลบไปแล้ว)', ephemeral: true });
        return;
    }

    // Check permission using DB-based roles
    const hasPermission = await checkPermission(interaction, member.gangId, ['OWNER', 'ADMIN']);
    if (!hasPermission) {
        await interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ทำรายการนี้', ephemeral: true });
        return;
    }

    await interaction.deferUpdate();

    if (member.status === 'APPROVED') {
        await interaction.followUp({ content: '⚠️ สมาชิกนี้ได้รับอนุมัติไปแล้ว', ephemeral: true });
        return;
    }

    try {
        // 1. Update DB Status
        await db.update(members).set({ status: 'APPROVED' }).where(eq(members.id, memberId));

        // 2. Assign Role & Rename (if possible)
        const guildMember = await interaction.guild?.members.fetch(member.discordId!).catch(() => null);
        if (guildMember) {
            await assignMemberRole(interaction, member.gangId, guildMember);

            // Try to set nickname to In-Game Name
            if (member.name) {
                await guildMember.setNickname(member.name).catch(() => { });
            }
        }

        // 3. Update Admin Message
        const oldEmbed = interaction.message.embeds[0];
        const newEmbed = new EmbedBuilder(oldEmbed.data)
            .setColor(0x00FF00)
            .setTitle('✅ อนุมัติเรียบร้อย')
            .setFooter({ text: `Approved by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        await interaction.editReply({ embeds: [newEmbed], components: [] });

        // 4. Audit Log
        await createAuditLog({
            gangId: member.gangId,
            actorId: interaction.user.id,
            actorName: interaction.user.username,
            action: 'MEMBER_APPROVE',
            targetType: 'member',
            targetId: memberId,
            newValue: { status: 'APPROVED' },
            client: interaction.client,
        });

    } catch (error) {
        console.error('Approval Error:', error);
        await interaction.followUp({ content: '❌ เกิดข้อผิดพลาดในการอนุมัติ', ephemeral: true });
    }
}

async function handleRejectMember(interaction: ButtonInteraction) {
    const memberId = interaction.customId.replace('reject_member_', '');
    const member = await db.query.members.findFirst({ where: eq(members.id, memberId) });

    if (!member) {
        await interaction.reply({ content: '❌ ไม่พบข้อมูลสมาชิก', ephemeral: true });
        return;
    }

    // Check permission using DB-based roles
    const hasPermission = await checkPermission(interaction, member.gangId, ['OWNER', 'ADMIN']);
    if (!hasPermission) {
        await interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ทำรายการนี้', ephemeral: true });
        return;
    }

    await interaction.deferUpdate();

    try {
        // 1. Update to REJECTED
        await db.update(members).set({ status: 'REJECTED', isActive: false }).where(eq(members.id, memberId));

        // 2. Update Admin Message
        const oldEmbed = interaction.message.embeds[0];
        const newEmbed = new EmbedBuilder(oldEmbed.data)
            .setColor(0xFF0000)
            .setTitle('❌ ปฏิเสธคำขอ')
            .setFooter({ text: `Rejected by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        await interaction.editReply({ embeds: [newEmbed], components: [] });

        // 3. Audit Log
        await createAuditLog({
            gangId: member.gangId,
            actorId: interaction.user.id,
            actorName: interaction.user.username,
            action: 'MEMBER_REJECT',
            targetType: 'member',
            targetId: memberId,
            newValue: { status: 'REJECTED' },
            client: interaction.client,
        });

    } catch (error) {
        console.error('Rejection Error:', error);
        await interaction.followUp({ content: '❌ เกิดข้อผิดพลาด', ephemeral: true });
    }
}
