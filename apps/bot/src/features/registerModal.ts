import {
    ModalSubmitInteraction,
    EmbedBuilder,
    GuildMember,
    ButtonInteraction,
    Role,
    MessageFlags,
} from 'discord.js';
import { registerModalHandler } from '../handlers';
import { db, gangs, members, gangRoles, gangSettings } from '@gang/database';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { thaiTimestamp } from '../utils/thaiTime';
import { createAuditLog } from '../utils/auditLog';
import { logError, logWarn } from '../utils/logger';
import { isRoleAssignableByBot } from '../utils/discordRole';

// Register modal handler
registerModalHandler('register_modal', handleRegisterModal);

async function handleRegisterModal(interaction: ModalSubmitInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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

    if (!gang.discordGuildId || gang.discordGuildId !== guildId) {
        logWarn('bot.registration.submit.guild_mismatch', {
            gangId,
            expectedGuildId: gang.discordGuildId,
            actualGuildId: guildId,
            actorDiscordId: interaction.user.id,
            customId: interaction.customId,
        });
        await interaction.editReply('ไม่พบข้อมูลแก๊งใน Discord server นี้ กรุณาใช้ปุ่มสมัครจากห้องของแก๊งที่ถูกต้อง');
        return;
    }

    // Check member limit based on tier
    {
        const { getTierConfig } = await import('@gang/database');
        const tierConfig = getTierConfig(gang.subscriptionTier);
        const memberCount = await db.query.members.findMany({
            where: and(eq(members.gangId, gangId), eq(members.isActive, true)),
        });

        if (memberCount.length >= tierConfig.maxMembers) {
            await interaction.editReply(`❌ แก๊งนี้มีสมาชิกเต็มแล้ว (${tierConfig.name} จำกัด ${tierConfig.maxMembers} คน)`);
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
            .setColor(0xFEE75C)
            .setTitle('ส่งคำขอแล้ว')
            .setDescription(`คำขอเข้าแก๊ง **${gang.name}** รออนุมัติ (ชื่อในแก๊ง: ${name})`)
            .setThumbnail(user.displayAvatarURL());

        await interaction.editReply({ embeds: [embed] });

        // 2. Notify Admins (Send Approval Request)
        await sendApprovalRequest(interaction, gangId, memberId, name, user);

    } catch (error) {
        logError('bot.registration.submit.failed', error, {
            gangId,
            guildId,
            actorDiscordId: interaction.user.id,
            customId: interaction.customId,
        });
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
        .setTitle('คำขอเข้าแก๊งใหม่')
        .setDescription(`**${name}** (<@${user.id}>) ขอเข้าร่วม\nชื่อในแก๊งคือชื่อกลางของระบบ ส่วน Discord ใช้สำหรับยืนยันตัวตนและแจ้งเตือน`)
        .setThumbnail(user.displayAvatarURL())
        .setFooter({ text: thaiTimestamp() });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`approve_member_${memberId}`).setLabel('✅ อนุมัติ').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`reject_member_${memberId}`).setLabel('❌ ปฏิเสธ').setStyle(ButtonStyle.Danger)
    );

    // Owner is the Discord server owner; role mentions are only for delegated admins.
    const roles = await db.query.gangRoles.findMany({
        where: and(
            eq(gangRoles.gangId, gangId),
            eq(gangRoles.permissionLevel, 'ADMIN')
        )
    });

    const ownerMention = interaction.guild?.ownerId ? `<@${interaction.guild.ownerId}>` : '';
    const mentions = [ownerMention, ...roles.map(r => `<@&${r.discordRoleId}>`)].filter(Boolean).join(' ');
    const content = mentions ? `${mentions} มีคนขอเข้าแก๊ง` : '@here มีคนขอเข้าแก๊ง';

    await channel.send({ content, embeds: [embed], components: [row] });
}

type RoleAssignmentPermission = 'OWNER' | 'MEMBER' | string;

export type RoleAssignmentIssueCode =
    | 'ROLE_MAPPING_MISSING'
    | 'ROLE_MISSING'
    | 'ROLE_UNMANAGEABLE'
    | 'ROLE_ASSIGN_FAILED';

export type RoleAssignmentIssue = {
    code: RoleAssignmentIssueCode;
    message: string;
    permission?: RoleAssignmentPermission;
    roleId?: string;
    roleName?: string;
};

type RoleAssignmentTarget = {
    permission: RoleAssignmentPermission;
    role: Role;
};

export type RoleAssignmentPlan = {
    targetPermission: RoleAssignmentPermission;
    roles: RoleAssignmentTarget[];
    issues: RoleAssignmentIssue[];
    canAssign: boolean;
};

export type RoleAssignmentResult = {
    assignedRoleIds: string[];
    issues: RoleAssignmentIssue[];
};

function resolveTargetPermission(member: GuildMember): RoleAssignmentPermission {
    return member.id === member.guild?.ownerId ? 'OWNER' : 'MEMBER';
}

async function getMappedGangRole(gangId: string, permission: RoleAssignmentPermission) {
    return db.query.gangRoles.findFirst({
        where: and(
            eq(gangRoles.gangId, gangId),
            eq(gangRoles.permissionLevel, permission)
        ),
    });
}

function getRequiredRolePermissions(targetPermission: RoleAssignmentPermission) {
    return targetPermission === 'OWNER'
        ? (['MEMBER', 'OWNER'] as RoleAssignmentPermission[])
        : ([targetPermission] as RoleAssignmentPermission[]);
}

async function buildRoleAssignmentPlan(gangId: string, targetUser: GuildMember): Promise<RoleAssignmentPlan> {
    const targetPermission = resolveTargetPermission(targetUser);
    const roles: RoleAssignmentTarget[] = [];
    const issues: RoleAssignmentIssue[] = [];

    for (const permission of getRequiredRolePermissions(targetPermission)) {
        const roleMapping = await getMappedGangRole(gangId, permission);
        if (!roleMapping) {
            issues.push({
                code: 'ROLE_MAPPING_MISSING',
                permission,
                message: `ยังไม่ได้เชื่อมยศ Discord สำหรับสิทธิ์ ${permission}`,
            });
            continue;
        }

        const role = targetUser.guild?.roles.cache.get(roleMapping.discordRoleId) as Role | undefined;
        if (!role) {
            issues.push({
                code: 'ROLE_MISSING',
                permission,
                roleId: roleMapping.discordRoleId,
                message: `ไม่พบยศ Discord สำหรับสิทธิ์ ${permission} แล้ว อาจถูกลบไปจากเซิร์ฟเวอร์`,
            });
            continue;
        }

        if (!isRoleAssignableByBot(role)) {
            issues.push({
                code: 'ROLE_UNMANAGEABLE',
                permission,
                roleId: role.id,
                roleName: role.name,
                message: `บอทยังจัดการยศ "${role.name}" ไม่ได้ เพราะยศนี้อยู่สูงกว่าหรือเป็น managed role`,
            });
            continue;
        }

        roles.push({ permission, role });
    }

    return {
        targetPermission,
        roles,
        issues,
        canAssign: issues.length === 0,
    };
}

export async function validateMemberRoleAssignment(gangId: string, targetUser: GuildMember) {
    return buildRoleAssignmentPlan(gangId, targetUser);
}

export function formatRoleAssignmentIssues(issues: RoleAssignmentIssue[]) {
    if (issues.length === 0) return '';

    const visibleIssues = issues.slice(0, 4).map(issue => `• ${issue.message}`);
    const hiddenCount = issues.length - visibleIssues.length;
    const extraLine = hiddenCount > 0 ? [`• และอีก ${hiddenCount} จุด`] : [];

    return [
        '❌ ยังอนุมัติไม่ได้ เพราะบอทยังแจกยศ Discord ที่ผูกกับสิทธิ์นี้ไม่ได้',
        ...visibleIssues,
        ...extraLine,
        'ให้ลากยศของบอทให้อยู่เหนือยศแก๊งที่ต้องแจก หรือเลือกยศแก๊งที่บอทจัดการได้ แล้วกดอนุมัติอีกครั้ง',
    ].join('\n');
}

export async function assignMemberRole(
    _interaction: ModalSubmitInteraction | ButtonInteraction,
    gangId: string,
    targetUser: GuildMember
): Promise<RoleAssignmentResult> {
    const plan = await buildRoleAssignmentPlan(gangId, targetUser);
    const assignedRoleIds: string[] = [];
    const issues: RoleAssignmentIssue[] = [...plan.issues];

    if (!plan.canAssign) {
        logWarn('bot.registration.role_assign.blocked', {
            gangId,
            targetDiscordId: targetUser.id,
            targetPermission: plan.targetPermission,
            issues,
        });
        return { assignedRoleIds, issues };
    }

    for (const target of plan.roles) {
        try {
            await targetUser.roles.add(target.role);
            assignedRoleIds.push(target.role.id);
        } catch (error) {
            const issue: RoleAssignmentIssue = {
                code: 'ROLE_ASSIGN_FAILED',
                permission: target.permission,
                roleId: target.role.id,
                roleName: target.role.name,
                message: `Discord ปฏิเสธการให้ยศ "${target.role.name}" หลังผ่าน preflight แล้ว`,
            };
            issues.push(issue);
            logWarn('bot.registration.role_assign.failed', {
                gangId,
                targetDiscordId: targetUser.id,
                roleId: target.role.id,
                permission: target.permission,
                error,
            });
        }
    }

    return { assignedRoleIds, issues };
}

export { handleRegisterModal };
