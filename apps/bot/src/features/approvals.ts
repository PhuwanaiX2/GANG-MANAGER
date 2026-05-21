import { ButtonInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { registerButtonHandler } from '../handlers';
import { db, members, gangs } from '@gang/database';
import { and, eq } from 'drizzle-orm';
import { assignMemberRole, formatRoleAssignmentIssues, validateMemberRoleAssignment } from './registerModal';
import { createAuditLog } from '../utils/auditLog';
import { thaiTimestamp } from '../utils/thaiTime';
import { checkPermission } from '../utils/permissions';
import { logError, logWarn } from '../utils/logger';

registerButtonHandler('approve_member', handleApproveMember);
registerButtonHandler('reject_member', handleRejectMember);

async function handleApproveMember(interaction: ButtonInteraction) {
    const memberId = interaction.customId.replace('approve_member_', '');
    const member = await db.query.members.findFirst({ where: eq(members.id, memberId) });
    let interactionAcknowledged = false;

    if (!member) {
        await interaction.reply({ content: '❌ ไม่พบข้อมูลสมาชิก (อาจถูกลบไปแล้ว)', flags: MessageFlags.Ephemeral });
        return;
    }

    const hasPermission = await checkPermission(interaction, member.gangId, ['OWNER', 'ADMIN']);
    if (!hasPermission) {
        await interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ทำรายการนี้', flags: MessageFlags.Ephemeral });
        return;
    }

    if (member.status === 'APPROVED') {
        await interaction.update({ components: [] });
        interactionAcknowledged = true;
        await interaction.followUp({ content: '⚠️ สมาชิกนี้ได้รับอนุมัติไปแล้ว', flags: MessageFlags.Ephemeral });
        return;
    }

    try {
        const guildMember = member.discordId
            ? await interaction.guild?.members.fetch(member.discordId).catch(() => null)
            : null;

        if (member.discordId && !guildMember) {
            logWarn('bot.approvals.approve.member_not_in_guild', {
                memberId,
                gangId: member.gangId,
                memberDiscordId: member.discordId,
                reviewerDiscordId: interaction.user.id,
            });
            await interaction.reply({
                content: '❌ ยังอนุมัติไม่ได้ เพราะไม่พบสมาชิกคนนี้ใน Discord เซิร์ฟเวอร์นี้ ให้สมาชิกเข้าเซิร์ฟเวอร์ก่อนแล้วกดอนุมัติอีกครั้ง',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (guildMember) {
            const roleAssignmentPlan = await validateMemberRoleAssignment(member.gangId, guildMember);
            if (!roleAssignmentPlan.canAssign) {
                logWarn('bot.approvals.approve.role_preflight_blocked', {
                    memberId,
                    gangId: member.gangId,
                    memberDiscordId: member.discordId,
                    reviewerDiscordId: interaction.user.id,
                    issues: roleAssignmentPlan.issues,
                });
                await interaction.reply({
                    content: formatRoleAssignmentIssues(roleAssignmentPlan.issues),
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }
        }

        const gangForTransfer = await db.query.gangs.findFirst({
            where: eq(gangs.id, member.gangId),
            columns: { transferStatus: true },
        });

        const extraUpdates = gangForTransfer?.transferStatus === 'ACTIVE'
            ? { status: 'APPROVED' as const, transferStatus: 'CONFIRMED' as const }
            : { status: 'APPROVED' as const };

        await interaction.update({ components: [] });
        interactionAcknowledged = true;

        await db.update(members)
            .set(extraUpdates)
            .where(and(
                eq(members.id, memberId),
                eq(members.gangId, member.gangId)
            ));

        if (guildMember) {
            const roleAssignment = await assignMemberRole(interaction, member.gangId, guildMember);
            if (roleAssignment.issues.length > 0) {
                await interaction.followUp({
                    content: formatRoleAssignmentIssues(roleAssignment.issues),
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (member.name) {
                if (guildMember.manageable === false) {
                    logWarn('bot.approvals.nickname.unmanageable', {
                        memberId,
                        gangId: member.gangId,
                        memberDiscordId: member.discordId,
                    });
                } else {
                    await guildMember.setNickname(member.name).catch((error: unknown) => {
                        logWarn('bot.approvals.nickname_failed', {
                            memberId,
                            gangId: member.gangId,
                            memberDiscordId: member.discordId,
                            error,
                        });
                    });
                }
            }
        }

        const oldEmbed = interaction.message.embeds[0];
        const newEmbed = new EmbedBuilder(oldEmbed.data)
            .setColor(0x00ff00)
            .setTitle('✅ อนุมัติเรียบร้อย')
            .setFooter({
                text: `อนุมัติโดย ${interaction.user.username} • ${thaiTimestamp()}`,
                iconURL: interaction.user.displayAvatarURL(),
            });

        await interaction.editReply({ embeds: [newEmbed], components: [] });

        if (member.discordId) {
            try {
                const gang = await db.query.gangs.findFirst({ where: eq(gangs.id, member.gangId), columns: { name: true } });
                const applicant = await interaction.client.users.fetch(member.discordId);
                await applicant.send(`✅ คำขอเข้าแก๊ง **${gang?.name || ''}** ของคุณได้รับการอนุมัติแล้วครับ ยินดีต้อนรับ!`);
            } catch (dmErr) {
                logWarn('bot.approvals.approve.dm_failed', {
                    memberId,
                    gangId: member.gangId,
                    memberDiscordId: member.discordId,
                    reviewerDiscordId: interaction.user.id,
                    error: dmErr,
                });
            }
        }

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
        logError('bot.approvals.approve.failed', error, {
            memberId,
            gangId: member.gangId,
            reviewerDiscordId: interaction.user.id,
        });
        const errorPayload = { content: '❌ เกิดข้อผิดพลาดในการอนุมัติ', flags: MessageFlags.Ephemeral } as const;
        if (interactionAcknowledged) {
            await interaction.followUp(errorPayload);
        } else {
            await interaction.reply(errorPayload);
        }
    }
}

async function handleRejectMember(interaction: ButtonInteraction) {
    const memberId = interaction.customId.replace('reject_member_', '');
    const member = await db.query.members.findFirst({ where: eq(members.id, memberId) });

    if (!member) {
        await interaction.reply({ content: '❌ ไม่พบข้อมูลสมาชิก', flags: MessageFlags.Ephemeral });
        return;
    }

    const hasPermission = await checkPermission(interaction, member.gangId, ['OWNER', 'ADMIN']);
    if (!hasPermission) {
        await interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ทำรายการนี้', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.update({ components: [] });

    try {
        await db.update(members)
            .set({ status: 'REJECTED', isActive: false })
            .where(and(
                eq(members.id, memberId),
                eq(members.gangId, member.gangId)
            ));

        const oldEmbed = interaction.message.embeds[0];
        const newEmbed = new EmbedBuilder(oldEmbed.data)
            .setColor(0xff0000)
            .setTitle('❌ ปฏิเสธคำขอ')
            .setFooter({
                text: `ปฏิเสธโดย ${interaction.user.username} • ${thaiTimestamp()}`,
                iconURL: interaction.user.displayAvatarURL(),
            });

        await interaction.editReply({ embeds: [newEmbed], components: [] });

        if (member.discordId) {
            try {
                const gang = await db.query.gangs.findFirst({ where: eq(gangs.id, member.gangId), columns: { name: true } });
                const applicant = await interaction.client.users.fetch(member.discordId);
                await applicant.send(`❌ คำขอเข้าแก๊ง **${gang?.name || ''}** ของคุณถูกปฏิเสธ หากมีข้อสงสัยกรุณาติดต่อหัวหน้าแก๊งครับ`);
            } catch (dmErr) {
                logWarn('bot.approvals.reject.dm_failed', {
                    memberId,
                    gangId: member.gangId,
                    memberDiscordId: member.discordId,
                    reviewerDiscordId: interaction.user.id,
                    error: dmErr,
                });
            }
        }

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
        logError('bot.approvals.reject.failed', error, {
            memberId,
            gangId: member.gangId,
            reviewerDiscordId: interaction.user.id,
        });
        await interaction.followUp({ content: '❌ เกิดข้อผิดพลาด', flags: MessageFlags.Ephemeral });
    }
}
