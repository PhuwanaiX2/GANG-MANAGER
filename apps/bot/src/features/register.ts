import {
    ButtonInteraction,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder
} from 'discord.js';
import { registerButtonHandler } from '../handlers';
import { db, gangs, members, gangSettings, gangRoles, getTierConfig } from '@gang/database';
import { eq, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createAuditLog } from '../utils/auditLog';

// Register button handler
registerButtonHandler('register', handleRegisterButton);

async function handleRegisterButton(interaction: ButtonInteraction) {
    const guildId = interaction.guildId;
    if (!guildId) return;

    // Check if gang exists
    const gang = await db.query.gangs.findFirst({
        where: eq(gangs.discordGuildId, guildId),
    });

    if (!gang) {
        await interaction.reply({
            content: '❌ ระบบยังไม่ได้ตั้งค่า',
            ephemeral: true,
        });
        return;
    }

    // Check if already registered
    const existingMember = await db.query.members.findFirst({
        where: and(
            eq(members.gangId, gang.id),
            eq(members.discordId, interaction.user.id)
        ),
    });

    if (existingMember) {
        // Allow re-register if previously REJECTED or KICKED (isActive=false)
        const isActiveMember = existingMember.isActive && existingMember.status === 'APPROVED';
        const isPending = existingMember.status === 'PENDING';

        // Check if the GANG is dissolved (isActive = false)
        // If gang is dissolved, we should ideally treat it as if the member record doesn't exist (clean slate)
        // But since we are likely doing Hard Delete now, existingMember check will return null anyway.
        // This is a safety check for legacy Soft Deleted gangs.
        if (gang.isActive && (isActiveMember || isPending)) {
            const message = isPending
                ? '⏳ คำขออยู่ระหว่างรออนุมัติ'
                : '✅ คุณเป็นสมาชิกอยู่แล้ว';

            await interaction.reply({
                content: message,
                ephemeral: true,
            });
            return;
        }
    }


    // Check member limit based on subscription tier
    const tierConfig = getTierConfig(gang.subscriptionTier);
    const activeMemberCount = await db.select({ count: sql<number>`count(*)` })
        .from(members)
        .where(and(
            eq(members.gangId, gang.id),
            eq(members.isActive, true)
        ));

    const currentCount = activeMemberCount[0]?.count || 0;
    if (currentCount >= tierConfig.maxMembers) {
        await interaction.reply({
            content: `❌ สมาชิกเต็มแล้ว (${currentCount}/${tierConfig.maxMembers}) — แจ้งหัวหน้าให้จัดการสมาชิกเดิมก่อน หรือรอเปิดระบบแพลนหลัง product readiness`,
            ephemeral: true,
        });
        return;
    }

    // Show registration modal
    const modal = new ModalBuilder()
        .setCustomId(`register_modal_${gang.id}`)
        .setTitle('📝 ลงทะเบียนสมาชิก');

    const nameInput = new TextInputBuilder()
        .setCustomId('name')
        .setLabel('ชื่อในเกม')
        .setPlaceholder('กรอกชื่อในเกม FiveM ของคุณ')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(100);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput)
    );

    await interaction.showModal(modal);
}

export { handleRegisterButton };
