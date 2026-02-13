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

    // Disable buttons immediately to prevent double-click
    await interaction.update({ components: [] });

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
            .setFooter({ text: `อนุมัติโดย ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        await interaction.editReply({ embeds: [newEmbed], components: [] });

        // 4. DM notify the applicant
        if (member.discordId) {
            try {
                const gang = await db.query.gangs.findFirst({ where: eq(gangs.id, member.gangId), columns: { name: true } });
                const applicant = await interaction.client.users.fetch(member.discordId);
                const dmEmbed = new EmbedBuilder()
                    .setColor(0x57F287)
                    .setTitle('✅ คำขอเข้าแก๊งได้รับการอนุมัติ!')
                    .setDescription(`ยินดีต้อนรับเข้าสู่แก๊ง **${gang?.name || 'Unknown'}**\nคุณสามารถเริ่มใช้งานระบบได้เลยครับ`)
                    .addFields(
                        { name: '👤 ชื่อในเกม', value: member.name, inline: true },
                        { name: '✅ อนุมัติโดย', value: interaction.user.username, inline: true }
                    )
                    .setTimestamp();
                await applicant.send({ embeds: [dmEmbed] });
            } catch (dmErr) {
                console.error('Could not DM approved member:', dmErr);
            }
        }

        // 5. Audit Log
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

    // Disable buttons immediately to prevent double-click
    await interaction.update({ components: [] });

    try {
        // 1. Update to REJECTED
        await db.update(members).set({ status: 'REJECTED', isActive: false }).where(eq(members.id, memberId));

        // 2. Update Admin Message
        const oldEmbed = interaction.message.embeds[0];
        const newEmbed = new EmbedBuilder(oldEmbed.data)
            .setColor(0xFF0000)
            .setTitle('❌ ปฏิเสธคำขอ')
            .setFooter({ text: `ปฏิเสธโดย ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        await interaction.editReply({ embeds: [newEmbed], components: [] });

        // 3. DM notify the applicant
        if (member.discordId) {
            try {
                const gang = await db.query.gangs.findFirst({ where: eq(gangs.id, member.gangId), columns: { name: true } });
                const applicant = await interaction.client.users.fetch(member.discordId);
                const dmEmbed = new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle('❌ คำขอเข้าแก๊งถูกปฏิเสธ')
                    .setDescription(`คำขอเข้าแก๊ง **${gang?.name || 'Unknown'}** ของคุณถูกปฏิเสธ\nหากมีข้อสงสัย กรุณาติดต่อหัวหน้าแก๊ง`)
                    .addFields(
                        { name: '👤 ชื่อในเกม', value: member.name, inline: true },
                        { name: '❌ ตรวจสอบโดย', value: interaction.user.username, inline: true }
                    )
                    .setTimestamp();
                await applicant.send({ embeds: [dmEmbed] });
            } catch (dmErr) {
                console.error('Could not DM rejected member:', dmErr);
            }
        }

        // 4. Audit Log
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
