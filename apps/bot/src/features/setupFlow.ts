import {
    ButtonInteraction,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder,
    ModalSubmitInteraction,
    ButtonStyle,
    ButtonBuilder,
    PermissionFlagsBits,
    ChannelType,
    CategoryChannel,
    Role,
    ColorResolvable,
    ChatInputCommandInteraction,
    TextChannel,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    AnySelectMenuInteraction,
    ComponentType,
    RoleSelectMenuBuilder
} from 'discord.js';
import { registerButtonHandler, registerModalHandler, registerSelectMenuHandler } from '../handlers';
import { db, gangs, gangSettings, gangRoles, members, licenses, getTierConfig, normalizeSubscriptionTier, canAccessFeature, resolveEffectiveSubscriptionTier } from '@gang/database';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { logError, logInfo, logWarn } from '../utils/logger';

const TRIAL_DAYS = 7;
type ManualSetupPermission = 'OWNER' | 'ADMIN' | 'TREASURER' | 'ATTENDANCE_OFFICER' | 'MEMBER';

// --- Handlers Registration ---
registerButtonHandler('setup_start', handleSetupStart);
registerModalHandler('setup_modal', handleSetupModalSubmit);
registerButtonHandler('setup_mode_auto', handleSetupModeAuto);
registerButtonHandler('setup_mode_manual', handleSetupModeManual);

// Register Select Menu Handlers for Manual Flow
registerSelectMenuHandler('setup_select', handleSetupRoleSelect);

// --- 1. Start Button Click -> Show Modal OR Skip if exists ---
function canRunSetupAction(interaction: ButtonInteraction) {
    return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
}

async function rejectSetupAction(interaction: ButtonInteraction) {
    await interaction.reply({ content: '❌ คุณต้องเป็น Administrator เท่านั้น', ephemeral: true });
}

async function handleSetupStart(interaction: ButtonInteraction) {
    if (!canRunSetupAction(interaction)) {
        await rejectSetupAction(interaction);
        return;
    }

    // Check if gang already exists for this guild
    const existingGang = await db.query.gangs.findFirst({
        where: eq(gangs.discordGuildId, interaction.guildId!)
    });

    if (existingGang) {
        // Skip modal, go straight to mode selection
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🧭 พบระบบเดิมของแก๊งนี้แล้ว')
            .setDescription(`เซิร์ฟเวอร์นี้เชื่อมกับแก๊ง **"${existingGang.name}"** อยู่แล้ว\nเลือกสิ่งที่ต้องการทำต่อได้เลย`)
            .addFields(
                { name: '🚀 ซ่อมแซมอัตโนมัติ', value: 'สร้างหรือเติมห้อง/ยศ/แผงหลักที่หายไปให้พร้อมใช้งานอีกครั้ง' },
                { name: '🧩 เชื่อมยศเอง', value: 'ใช้เมื่อคุณมีโครงสร้างห้องอยู่แล้ว และต้องการ map ยศเข้ากับระบบแบบละเอียด' }
            );

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`setup_mode_auto_${existingGang.id}`).setLabel('🚀 ซ่อมแซมอัตโนมัติ').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`setup_mode_manual_${existingGang.id}`).setLabel('🧩 เชื่อมยศเอง').setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        return;
    }

    const modal = new ModalBuilder()
        .setCustomId('setup_modal')
        .setTitle('⚙️ ตั้งค่าแก๊ง');

    const nameInput = new TextInputBuilder()
        .setCustomId('gang_name')
        .setLabel('ชื่อแก๊ง')
        .setPlaceholder('ระบุชื่อแก๊งของคุณ')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput)
    );

    await interaction.showModal(modal);
}

// --- 2. Modal Submit -> Ask for Mode ---
async function handleSetupModalSubmit(interaction: ModalSubmitInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const gangName = interaction.fields.getTextInputValue('gang_name');

    const guildId = interaction.guildId!;

    // New gangs start on TRIAL tier unless a previous paid subscription is transferred.
    let resolvedTier: 'FREE' | 'TRIAL' | 'PREMIUM' = 'TRIAL';
    const trialExpiresAt = new Date();
    trialExpiresAt.setDate(trialExpiresAt.getDate() + TRIAL_DAYS);

    // Check existing
    let gang = await db.query.gangs.findFirst({
        where: eq(gangs.discordGuildId, guildId),
    });

    const gangId = gang?.id || nanoid();

    try {
        let transferredInfo = '';

        if (!gang) {
            await db.insert(gangs).values({
                id: gangId,
                discordGuildId: guildId,
                name: gangName,
                subscriptionTier: resolvedTier,
                subscriptionExpiresAt: trialExpiresAt,
            });
            await db.insert(gangSettings).values({ id: nanoid(), gangId: gangId });

            // Auto-transfer subscription from Owner's dissolved gang
            const ownerDiscordId = interaction.user.id;
            const ownerOldMemberships = await db.query.members.findMany({
                where: and(
                    eq(members.discordId, ownerDiscordId),
                    eq(members.gangRole, 'OWNER')
                ),
                with: { gang: true },
            });

            const dissolvedGangWithSub = ownerOldMemberships.find(m =>
                m.gang &&
                !m.gang.isActive &&
                m.gang.dissolvedAt &&
                normalizeSubscriptionTier(m.gang.subscriptionTier) !== 'FREE'
            );

            if (dissolvedGangWithSub && dissolvedGangWithSub.gang) {
                const oldGang = dissolvedGangWithSub.gang;
                // Transfer subscription to new gang
                await db.update(gangs)
                    .set({
                        subscriptionTier: normalizeSubscriptionTier(oldGang.subscriptionTier),
                        subscriptionExpiresAt: oldGang.subscriptionExpiresAt,
                    })
                    .where(eq(gangs.id, gangId));

                // Clear old gang's subscription data after transferring it once.
                await db.update(gangs)
                    .set({
                        subscriptionTier: 'FREE',
                        subscriptionExpiresAt: null,
                    })
                    .where(eq(gangs.id, oldGang.id));

                resolvedTier = normalizeSubscriptionTier(oldGang.subscriptionTier);
                transferredInfo = `\n🔄 **โอนแพ็คเกจ ${normalizeSubscriptionTier(oldGang.subscriptionTier)}** จากแก๊ง "${oldGang.name}" สำเร็จ!`;
                logInfo('bot.setup.subscription_transferred', {
                    guildId,
                    ownerDiscordId,
                    fromGangId: oldGang.id,
                    toGangId: gangId,
                    subscriptionTier: resolvedTier,
                });
            }
        } else {
            await db.update(gangs)
                .set({ name: gangName })
                .where(eq(gangs.id, gangId));

            resolvedTier = normalizeSubscriptionTier(gang.subscriptionTier);
        }

        // Ask for Mode
        const currentTrialExpiry = gang?.subscriptionExpiresAt ? new Date(gang.subscriptionExpiresAt) : trialExpiresAt;
        const trialInfo = resolvedTier === 'TRIAL'
            ? `\n🎁 **ทดลองใช้ฟรี ${TRIAL_DAYS} วัน** ถึง ${currentTrialExpiry.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'long', year: 'numeric' })}`
            : '';
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('✅ บันทึกข้อมูลแก๊งแล้ว')
            .setDescription(`แก๊ง **"${gangName}"** พร้อมเข้าสู่ขั้นตอนเปิดระบบแล้ว${transferredInfo}${trialInfo}\nเลือกรูปแบบที่เหมาะกับเซิร์ฟเวอร์ของคุณต่อได้เลย`)
            .addFields(
                { name: '🚀 ติดตั้งอัตโนมัติ', value: 'ให้บอทสร้างห้อง, ยศ, ปุ่มลงทะเบียน, แผงการเงิน และแผงควบคุมให้พร้อมใช้ทันที' },
                { name: '🧩 เชื่อมยศเอง', value: 'เหมาะกับเซิร์ฟเวอร์ที่จัดห้องไว้แล้ว และต้องการ map ยศเข้าระบบทีละขั้น' }
            );

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`setup_mode_auto_${gangId}`).setLabel('🚀 ติดตั้งอัตโนมัติ').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`setup_mode_manual_${gangId}`).setLabel('🧩 เชื่อมยศเอง').setStyle(ButtonStyle.Secondary)
        );

        await interaction.editReply({ embeds: [embed], components: [row] });

    } catch (error) {
        logError('bot.setup.modal_failed', error, {
            guildId,
            gangId,
            userDiscordId: interaction.user.id,
        });
        await interaction.editReply('❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
}

// --- 3. Auto Mode -> Create Resources ---
async function handleSetupModeAuto(interaction: ButtonInteraction) {
    if (!canRunSetupAction(interaction)) {
        await rejectSetupAction(interaction);
        return;
    }

    // Update the message immediately to remove buttons and show loading state
    try {
        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({
                content: '⏳ กำลังติดตั้งระบบ Auto... กรุณารอสักครู่',
                embeds: [],
                components: []
            });
        } else {
            await interaction.update({
                content: '⏳ กำลังติดตั้งระบบ Auto... กรุณารอสักครู่',
                embeds: [],
                components: []
            });
        }
    } catch (error) {
        logWarn('bot.setup.auto_initial_update_failed', {
            guildId: interaction.guildId,
            customId: interaction.customId,
            userDiscordId: interaction.user.id,
            error,
        });
    }

    // customId format: setup_mode_auto_GANGID
    const gangId = interaction.customId.replace('setup_mode_auto_', '');
    if (!gangId) {
        await interaction.editReply('❌ Error: Missing Gang ID');
        return;
    }

    try {
        // Validation: Check if gang exists first
        const existingGang = await db.query.gangs.findFirst({ where: eq(gangs.id, gangId) });
        if (!existingGang) {
            // Attempt to recover: Check if we have enough info to recreate? 
            // We don't have the Name here.
            // But we can check if it really doesn't exist or just a glitch.

            await interaction.editReply({
                content: '❌ **ข้อมูลแก๊งไม่ถูกต้อง (Gang Not Found)**\n\nสาเหตุที่เป็นไปได้:\n1. ข้อมูลถูกลบออกจากฐานข้อมูล\n2. เกิดข้อผิดพลาดในการบันทึกข้อมูลขั้นตอนก่อนหน้า\n\n**วิธีแก้ไข:**\nกรุณาพิมพ์คำสั่ง `/setup` เพื่อเริ่มตั้งค่าใหม่ตั้งแต่ต้น',
                embeds: [],
                components: []
            });
            return;
        }

        // Reuse logic
        await createDefaultResources(interaction, gangId);

        const gang = await db.query.gangs.findFirst({ where: eq(gangs.id, gangId) });
        const webUrl = process.env.NEXTAUTH_URL || 'https://gang-manager.vercel.app';
        const dashboardUrl = `${webUrl}/dashboard/${gangId}`;
        const settingsUrl = `${dashboardUrl}/settings`;

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ เปิดระบบแก๊งสำเร็จแล้ว')
            .setDescription(`แก๊ง **${gang?.name}** พร้อมใช้งานทั้งใน Discord และหน้าเว็บแล้ว`)
            .addFields(
                { name: '📋 สถานะ', value: normalizeSubscriptionTier(gang?.subscriptionTier) === 'PREMIUM' ? 'Premium' : normalizeSubscriptionTier(gang?.subscriptionTier) === 'TRIAL' ? 'Trial 7 วัน' : 'Free', inline: true },
                { name: '🎭 ระบบยศ', value: 'สร้างครบ 4 ระดับ', inline: true },
                { name: '📂 ห้อง', value: 'สร้างครบทุกหมวด', inline: true },
                { name: '🎯 แนะนำให้ทำต่อทันที', value: '1. เช็กแผงลงทะเบียน/ยืนยันตัวตน\n2. ให้สมาชิกเริ่มเข้าระบบ\n3. เปิด Dashboard เพื่อตรวจสมาชิก, attendance, finance และตั้งค่าเพิ่มเติม' },
                { name: '🛟 ถ้าเมนูหายหรือห้องเพี้ยน', value: 'ใช้ปุ่มซ่อมแซมห้อง/ยศจากแผงควบคุม หรือพิมพ์ `/setup` เพื่อสร้างใหม่อีกครั้ง' }
            );

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setLabel('🌐 เปิด Dashboard').setStyle(ButtonStyle.Link).setURL(dashboardUrl),
            new ButtonBuilder().setLabel('⚙️ ตั้งค่าบนเว็บ').setStyle(ButtonStyle.Link).setURL(settingsUrl)
        );

        await interaction.editReply({ content: '', embeds: [embed], components: [row] });

        await sendSetupInstructions(interaction, gangId);
        await sendAdminPanel(interaction, gangId);

    } catch (error) {
        logError('bot.setup.auto_failed', error, {
            guildId: interaction.guildId,
            gangId,
            userDiscordId: interaction.user.id,
        });
        await interaction.editReply('❌ เกิดข้อผิดพลาดในการสร้างทรัพยากร');
    }
}

// --- 4. Manual Mode -> Start Role Selection Loop ---
async function handleSetupModeManual(interaction: ButtonInteraction) {
    if (!canRunSetupAction(interaction)) {
        await rejectSetupAction(interaction);
        return;
    }

    const gangId = interaction.customId.replace('setup_mode_manual_', '');

    // Defer update because we are handling a button click from a message we want to edit/replace
    await interaction.deferUpdate();

    // Start with Owner
    await askForRole(interaction, gangId, 'OWNER');
}

// --- 5. Generic Handler for Role Selection Steps ---
async function handleSetupRoleSelect(interaction: AnySelectMenuInteraction) {
    // customId format: setup_select_PERMISSION_GANGID
    const parts = interaction.customId.split('_');
    const currentPermission = parts[2] as ManualSetupPermission;
    const gangId = parts[3];
    const selectedRoleId = interaction.values[0];

    await interaction.deferUpdate();

    const validationError = await validateManualRoleSelection(interaction, currentPermission, selectedRoleId);
    if (validationError) {
        await askForRole(interaction, gangId, currentPermission, validationError);
        return;
    }

    // 1. Save Mapping
    // Check if mapping exists
     const existingByRole = await db.query.gangRoles.findFirst({
        where: (t, { and, eq }) => and(eq(t.gangId, gangId), eq(t.discordRoleId, selectedRoleId))
    });

    if (existingByRole && existingByRole.permissionLevel !== currentPermission) {
        await askForRole(
            interaction,
            gangId,
            currentPermission,
            `ยศนี้ถูกเชื่อมเป็น ${existingByRole.permissionLevel} อยู่แล้ว กรุณาเลือกยศคนละอันเพื่อไม่ให้สิทธิ์ทับกัน`
        );
        return;
    }

    const existingByPermission = await db.query.gangRoles.findFirst({
        where: (t, { and, eq }) => and(eq(t.gangId, gangId), eq(t.permissionLevel, currentPermission))
    });

    if (existingByPermission) {
        await db.update(gangRoles)
            .set({ discordRoleId: selectedRoleId })
            .where(eq(gangRoles.id, existingByPermission.id));
    } else {
        await db.insert(gangRoles).values({
            id: nanoid(),
            gangId: gangId,
            discordRoleId: selectedRoleId,
            permissionLevel: currentPermission
        });
    }

    // 2. Next Step
    const nextStepMap: Record<string, string> = {
        'OWNER': 'ADMIN',
        'ADMIN': 'TREASURER',
        'TREASURER': 'ATTENDANCE_OFFICER',
        'ATTENDANCE_OFFICER': 'MEMBER',
        'MEMBER': 'DONE'
    };

    const nextPerm = nextStepMap[currentPermission];

    if (nextPerm === 'DONE') {
        const gang = await db.query.gangs.findFirst({ where: eq(gangs.id, gangId) });
        const webUrl = process.env.NEXTAUTH_URL || 'https://gang-manager.vercel.app';
        const dashboardUrl = `${webUrl}/dashboard/${gangId}`;
        const settingsUrl = `${dashboardUrl}/settings`;
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ เชื่อมยศสำเร็จ')
            .setDescription(`แก๊ง **${gang?.name}** บันทึกยศครบถ้วนแล้ว\nขั้นตอนนี้เป็นการเชื่อมสิทธิ์เท่านั้น ถ้ายังไม่มีห้อง/แผงปุ่ม ให้กดซ่อมแซมอัตโนมัติด้านล่าง`)
            .addFields(
                { name: '🧭 ขั้นตอนต่อไป', value: '1. เปิด Dashboard เพื่อตรวจสมาชิกและตั้งค่า\n2. ถ้าห้องหรือแผงปุ่มยังไม่ครบ ให้กดซ่อมแซมอัตโนมัติ\n3. หลังซ่อมแล้วให้ลองกดปุ่มลงทะเบียน/เช็คชื่อ/การเงินด้วยบัญชีทดสอบ' }
            );

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`setup_mode_auto_${gangId}`)
                .setLabel('🚀 ซ่อมแซมห้อง/แผงอัตโนมัติ')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setLabel('🌐 เปิด Dashboard')
                .setStyle(ButtonStyle.Link)
                .setURL(dashboardUrl),
            new ButtonBuilder()
                .setLabel('⚙️ ตั้งค่าบนเว็บ')
                .setStyle(ButtonStyle.Link)
                .setURL(settingsUrl)
        );

        await interaction.editReply({ embeds: [embed], components: [row] });
    } else {
        await askForRole(interaction, gangId, nextPerm as ManualSetupPermission);
    }
}

function interactionMemberHasRole(interaction: AnySelectMenuInteraction, roleId: string) {
    const roles = interaction.member?.roles;
    if (!roles) return false;
    if (Array.isArray(roles)) return roles.includes(roleId);
    return roles.cache?.has(roleId) ?? false;
}

async function getVerifiedRoleMemberCount(role: Role) {
    try {
        await role.guild.members.fetch();
        return role.members.size;
    } catch (error) {
        logWarn('bot.setup.manual_role_member_fetch_failed', {
            guildId: role.guild.id,
            roleId: role.id,
            error,
        });
        return null;
    }
}

async function validateManualRoleSelection(
    interaction: AnySelectMenuInteraction,
    permission: ManualSetupPermission,
    selectedRoleId: string
) {
    const guild = interaction.guild;
    if (!guild) {
        return 'ไม่พบข้อมูลเซิร์ฟเวอร์ กรุณาลองใช้ /setup ใหม่อีกครั้ง';
    }

    if (selectedRoleId === guild.id) {
        return 'ห้ามใช้ @everyone เป็นยศของระบบแก๊ง เพราะจะทำให้ทุกคนได้รับสิทธิ์ทันที';
    }

    const role = guild.roles.cache.get(selectedRoleId);
    if (!role) {
        return 'ไม่พบยศที่เลือก กรุณาเลือกยศใหม่อีกครั้ง';
    }

    if (role.managed) {
        return 'ยศนี้เป็นยศที่ Discord หรือ integration จัดการให้อัตโนมัติ กรุณาเลือกยศปกติของเซิร์ฟเวอร์';
    }

    if (role.editable === false) {
        return 'บอทยังจัดการยศนี้ไม่ได้ เพราะยศนี้อยู่สูงกว่าบอทหรือบอทไม่มีสิทธิ์ Manage Roles กรุณาย้ายยศบอทให้อยู่สูงกว่ายศนี้ก่อน';
    }

    if (permission !== 'OWNER') {
        return null;
    }

    if (!interactionMemberHasRole(interaction, selectedRoleId)) {
        return 'ยศ Owner ต้องเป็นยศที่ผู้ตั้งค่าถืออยู่ เพื่อยืนยันว่าเจ้าของระบบคือคนเดียวกับคนที่กำลัง setup';
    }

    const memberCount = await getVerifiedRoleMemberCount(role);
    if (memberCount === null) {
        return 'ยังตรวจจำนวนคนในยศ Owner ไม่ได้ กรุณาให้สิทธิ์ Server Members Intent/สิทธิ์บอทครบ หรือใช้ติดตั้งอัตโนมัติแทน';
    }

    if (memberCount !== 1) {
        return `ยศ Owner ต้องมีสมาชิกเพียง 1 คนเท่านั้น ตอนนี้ยศนี้มี ${memberCount} คน กรุณาเลือกยศเฉพาะหัวหน้าแก๊ง`;
    }

    return null;
}

// Helper to send Role Select Menu
async function askForRole(
    interaction: ButtonInteraction | AnySelectMenuInteraction,
    gangId: string,
    permission: ManualSetupPermission,
    warning?: string
) {
    const labels: Record<string, string> = {
        'OWNER': '👑 หัวหน้าแก๊ง (Owner)',
        'ADMIN': '🛡️ รองหัวหน้า (Admin)',
        'TREASURER': '💰 เหรัญญิก (Treasurer)',
        'ATTENDANCE_OFFICER': 'Attendance Officer',
        'MEMBER': '👤 สมาชิก (Member)'
    };

    const embed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle(`🎭 เลือกยศ: ${labels[permission]}`)
        .setDescription(`กรุณาเลือก Role ใน Discord ที่ต้องการมอบหมายให้เป็น **${labels[permission]}**`);

    if (warning) {
        embed.addFields({ name: '⚠️ ยังบันทึกไม่ได้', value: warning });
    }

    // Use RoleSelectMenuBuilder for better UX
    const select = new RoleSelectMenuBuilder()
        .setCustomId(`setup_select_${permission}_${gangId}`)
        .setPlaceholder(`เลือกยศสำหรับ ${permission}`)
        .setMinValues(1)
        .setMaxValues(1);

    const row = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(select);

    await interaction.editReply({ embeds: [embed], components: [row] });
}


// --- Helper Functions (Moved from setup.ts) ---

async function createDefaultResources(interaction: ButtonInteraction | ChatInputCommandInteraction | ModalSubmitInteraction, gangId: string) {
    const guild = interaction.guild!;
    const botMember = guild.members.me;

    if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles) || !botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) {
        // We can't reply if deferred, let's followUp
        if (interaction.deferred) {
            await interaction.followUp({ content: '⚠️ บอทไม่มีสิทธิ์ Manage Roles หรือ Manage Channels', ephemeral: true });
        }
        return;
    }

    // --- 1. Create Roles ---
    const roleConfig = [
        { name: 'Gang Owner', color: '#FFD700', permission: 'OWNER', hoist: true },   // Gold
        { name: 'Gang Admin', color: '#FF0000', permission: 'ADMIN', hoist: true },   // Red
        { name: 'Gang Treasurer', color: '#00FF00', permission: 'TREASURER', hoist: true }, // Green
        { name: 'Gang Attendance', color: '#FEE75C', permission: 'ATTENDANCE_OFFICER', hoist: true },
        { name: 'Gang Member', color: '#3498DB', permission: 'MEMBER', hoist: true }, // Blue
    ];

    // Create Verified role (non-gang visitors)
    let verifiedRole = guild.roles.cache.find(r => r.name === 'Verified');
    if (!verifiedRole) {
        verifiedRole = await guild.roles.create({
            name: 'Verified',
            color: '#95A5A6' as ColorResolvable,
            hoist: false,
            reason: 'Gang Management Setup - Verified visitors',
        });
    }

    // Ensure Verified is at the bottom (above @everyone)
    try {
        await verifiedRole.setPosition(1);
    } catch (error) {
        logWarn('bot.setup.verified_role_position_failed', {
            guildId: guild.id,
            gangId,
            roleId: verifiedRole.id,
            error,
        });
    }

    const createdRoles: Record<string, Role> = {};

    for (const config of roleConfig) {
        let role = guild.roles.cache.find(r => r.name === config.name);

        if (!role) {
            role = await guild.roles.create({
                name: config.name,
                color: config.color as ColorResolvable,
                hoist: config.hoist,
                reason: 'Gang Management Setup',
            });
        }
        createdRoles[config.permission] = role;

        const existingByPermission = await db.query.gangRoles.findFirst({
            where: (table, { and, eq }) => and(
                eq(table.gangId, gangId),
                eq(table.permissionLevel, config.permission)
            )
        });

        if (existingByPermission) {
            await db.update(gangRoles)
                .set({ discordRoleId: role.id })
                .where(eq(gangRoles.id, existingByPermission.id));
        } else {
            await db.insert(gangRoles).values({
                id: nanoid(),
                gangId: gangId,
                discordRoleId: role.id,
                permissionLevel: config.permission,
            });
        }
    }

    // Assign Owner Role
    // Assign Owner Role
    const ownerRole = createdRoles['OWNER'];
    const member = await guild.members.fetch(interaction.user.id);
    if (ownerRole && member) {
        await member.roles.add(ownerRole);

        // Explicitly ensure DB role is MEMBER Record exists and is OWNER
        const existingMember = await db.query.members.findFirst({
            where: and(
                eq(members.discordId, member.id),
                eq(members.gangId, gangId)
            )
        });

        if (existingMember) {
            await db.update(members)
                .set({ gangRole: 'OWNER' })
                .where(eq(members.id, existingMember.id));
        } else {
            // Create new member record for owner
            await db.insert(members).values({
                id: nanoid(),
                gangId: gangId,
                discordId: member.id,
                name: member.user.username, // Fallback name
                discordUsername: member.user.username,
                discordAvatar: member.user.displayAvatarURL(),
                status: 'APPROVED',
                gangRole: 'OWNER',
                isActive: true
            });
        }
    }

    // --- 2. Create Categories & Channels ---
    let infoCategory = guild.channels.cache.find(c => c.name === '📌 ข้อมูลทั่วไป' && c.type === ChannelType.GuildCategory) as CategoryChannel;
    if (!infoCategory) infoCategory = await guild.channels.create({ name: '📌 ข้อมูลทั่วไป', type: ChannelType.GuildCategory });

    let attendanceCategory = guild.channels.cache.find(c => c.name === '⏰ ระบบเช็คชื่อ' && c.type === ChannelType.GuildCategory) as CategoryChannel;
    if (!attendanceCategory) attendanceCategory = await guild.channels.create({ name: '⏰ ระบบเช็คชื่อ', type: ChannelType.GuildCategory });

    let financeCategory = guild.channels.cache.find(c => c.name === '💰 ระบบการเงิน' && c.type === ChannelType.GuildCategory) as CategoryChannel;
    if (!financeCategory) financeCategory = await guild.channels.create({ name: '💰 ระบบการเงิน', type: ChannelType.GuildCategory });

    let adminCategory = guild.channels.cache.find(c => c.name === '🔒 หัวแก๊ง' && c.type === ChannelType.GuildCategory) as CategoryChannel;
    if (!adminCategory) {
        try {
            adminCategory = await guild.channels.create({
                name: '🔒 หัวแก๊ง',
                type: ChannelType.GuildCategory,
                permissionOverwrites: [
                    { id: guild.id, deny: ['ViewChannel'] },
                    { id: createdRoles['OWNER'].id, allow: ['ViewChannel'] },
                    { id: createdRoles['ADMIN'].id, allow: ['ViewChannel'] }
                ]
            });
        } catch (error) {
            logError('bot.setup.admin_category_create_failed', error, {
                guildId: guild.id,
                gangId,
            });
        }
    }

    const ensureChannel = async (name: string, parentId: string, options: any = {}) => {
        try {
            // 1. Check if channel already exists under the target parent
            let existing = guild.channels.cache.find(c => c.name === name && c.parentId === parentId);

            if (!existing) {
                // 2. Search guild-wide for a channel with the same name (preserved from dissolved gang)
                const channelType = options.type || ChannelType.GuildText;
                existing = guild.channels.cache.find(c => c.name === name && c.type === channelType);

                if (existing) {
                    // Move the existing channel to the new parent category
                    try {
                        await (existing as TextChannel).setParent(parentId, { lockPermissions: false });
                        logInfo('bot.setup.channel_moved', {
                            guildId: guild.id,
                            gangId,
                            channelName: name,
                            parentId,
                        });
                    } catch (error) {
                        logWarn('bot.setup.channel_move_failed', {
                            guildId: guild.id,
                            gangId,
                            channelName: name,
                            parentId,
                            error,
                        });
                    }
                }
            }

            if (existing) {
                // Enforce permissions if specified
                if (options.permissionOverwrites) {
                    await (existing as TextChannel).edit({ permissionOverwrites: options.permissionOverwrites }).catch(error => {
                        logWarn('bot.setup.channel_permission_update_failed', {
                            guildId: guild.id,
                            gangId,
                            channelName: name,
                            error,
                        });
                    });
                }
                return existing;
            }

            return await guild.channels.create({ name, parent: parentId, type: ChannelType.GuildText, ...options });
        } catch (error) {
            logError('bot.setup.channel_ensure_failed', error, {
                guildId: guild.id,
                gangId,
                channelName: name,
                parentId,
            });
            return null;
        }
    };

    // === Permission Templates ===
    // 1. Read-only for everyone (announcements, rules)
    const readOnlyEveryone = [{ id: guild.roles.everyone.id, allow: ['ViewChannel'], deny: ['SendMessages'] }];

    // 2. Registration: visible to non-members, hidden from members (who are already approved)
    // Concept: "Everyone" can see it. But if you have a Gang Role, you cannot see it.
    // This ensures only unregistered people see the register button.
    const registerPerms = [
        { id: guild.roles.everyone.id, allow: ['ViewChannel'], deny: ['SendMessages'] },
        { id: createdRoles['MEMBER'].id, deny: ['ViewChannel'] },
        { id: createdRoles['ADMIN'].id, deny: ['ViewChannel'] },
        { id: createdRoles['TREASURER'].id, deny: ['ViewChannel'] },
        { id: createdRoles['OWNER'].id, deny: ['ViewChannel'] }
    ];

    // 3. Members only (read-only)
    const membersOnlyReadOnly = [
        { id: guild.roles.everyone.id, deny: ['ViewChannel'] },
        { id: createdRoles['MEMBER'].id, allow: ['ViewChannel'], deny: ['SendMessages'] },
        { id: createdRoles['ADMIN'].id, allow: ['ViewChannel'], deny: ['SendMessages'] },
        { id: createdRoles['TREASURER'].id, allow: ['ViewChannel'], deny: ['SendMessages'] },
        { id: createdRoles['OWNER'].id, allow: ['ViewChannel'], deny: ['SendMessages'] }
    ];

    // 4. Members only (can write)
    const membersOnlyWritable = [
        { id: guild.roles.everyone.id, deny: ['ViewChannel'] },
        { id: createdRoles['MEMBER'].id, allow: ['ViewChannel', 'SendMessages'] },
        { id: createdRoles['ADMIN'].id, allow: ['ViewChannel', 'SendMessages'] },
        { id: createdRoles['TREASURER'].id, allow: ['ViewChannel', 'SendMessages'] },
        { id: createdRoles['OWNER'].id, allow: ['ViewChannel', 'SendMessages'] }
    ];

    // === 📌 ข้อมูลทั่วไป ===
    // Verify channel: visible to everyone, only non-verified can see it
    const verifyPerms = [
        { id: guild.roles.everyone.id, allow: ['ViewChannel'], deny: ['SendMessages'] },
        { id: verifiedRole!.id, deny: ['ViewChannel'] },
        { id: createdRoles['MEMBER'].id, deny: ['ViewChannel'] },
        { id: createdRoles['ADMIN'].id, deny: ['ViewChannel'] },
        { id: createdRoles['TREASURER'].id, deny: ['ViewChannel'] },
        { id: createdRoles['OWNER'].id, deny: ['ViewChannel'] },
    ];
    const verifyChannel = await ensureChannel('ยืนยันตัวตน', infoCategory.id, { permissionOverwrites: verifyPerms });
    const registerChannel = await ensureChannel('ลงทะเบียน', infoCategory.id, { permissionOverwrites: registerPerms });
    const announcementChannel = await ensureChannel('ประกาศ', infoCategory.id, { permissionOverwrites: readOnlyEveryone }); // Visible to all
    await ensureChannel('กฎแก๊ง', infoCategory.id, { permissionOverwrites: readOnlyEveryone }); // Visible to all
    const dashboardChannel = await ensureChannel('แดชบอร์ด', infoCategory.id, { permissionOverwrites: membersOnlyReadOnly }); // Read-only for members

    // === ⏰ ระบบเช็คชื่อ (Members Only) ===
    const attendanceChannel = await ensureChannel('เช็คชื่อ', attendanceCategory.id, { permissionOverwrites: membersOnlyReadOnly });
    await ensureChannel('สรุปเช็คชื่อ', attendanceCategory.id, { permissionOverwrites: membersOnlyReadOnly });
    const leaveChannel = await ensureChannel('แจ้งลา', attendanceCategory.id, { permissionOverwrites: membersOnlyWritable });

    // === 💰 ระบบการเงิน (Members Only) ===
    const financeChannel = await ensureChannel('แจ้งธุรกรรม', financeCategory.id, { permissionOverwrites: membersOnlyWritable });
    await ensureChannel('ยอดกองกลาง', financeCategory.id, { permissionOverwrites: membersOnlyReadOnly });

    // === 💬 ห้องแชท (Chat Channels) ===
    // General chat: visible to Verified + all gang roles
    const generalChatPerms = [
        { id: guild.roles.everyone.id, deny: ['ViewChannel'] },
        { id: verifiedRole!.id, allow: ['ViewChannel', 'SendMessages'] },
        { id: createdRoles['MEMBER'].id, allow: ['ViewChannel', 'SendMessages'] },
        { id: createdRoles['ADMIN'].id, allow: ['ViewChannel', 'SendMessages'] },
        { id: createdRoles['TREASURER'].id, allow: ['ViewChannel', 'SendMessages'] },
        { id: createdRoles['OWNER'].id, allow: ['ViewChannel', 'SendMessages'] },
    ];

    let chatCategory = guild.channels.cache.find(c => c.name === '💬 ห้องแชท' && c.type === ChannelType.GuildCategory) as CategoryChannel;
    if (!chatCategory) chatCategory = await guild.channels.create({ name: '💬 ห้องแชท', type: ChannelType.GuildCategory });

    await ensureChannel('พูดคุยทั่วไป', chatCategory.id, { type: ChannelType.GuildText, permissionOverwrites: generalChatPerms });
    await ensureChannel('พูดคุยแก๊ง', chatCategory.id, { type: ChannelType.GuildText, permissionOverwrites: membersOnlyWritable });

    // === 🔊 Voice Channels (Members Only) ===
    const voiceMembersOnly = [
        { id: guild.roles.everyone.id, deny: ['ViewChannel'] },
        { id: createdRoles['MEMBER'].id, allow: ['ViewChannel', 'Connect', 'Speak'] },
        { id: createdRoles['ADMIN'].id, allow: ['ViewChannel', 'Connect', 'Speak'] },
        { id: createdRoles['TREASURER'].id, allow: ['ViewChannel', 'Connect', 'Speak'] },
        { id: createdRoles['OWNER'].id, allow: ['ViewChannel', 'Connect', 'Speak'] }
    ];

    // General voice: visible to Verified + gang
    const voiceGeneralPerms = [
        { id: guild.roles.everyone.id, deny: ['ViewChannel'] },
        { id: verifiedRole!.id, allow: ['ViewChannel', 'Connect', 'Speak'] },
        { id: createdRoles['MEMBER'].id, allow: ['ViewChannel', 'Connect', 'Speak'] },
        { id: createdRoles['ADMIN'].id, allow: ['ViewChannel', 'Connect', 'Speak'] },
        { id: createdRoles['TREASURER'].id, allow: ['ViewChannel', 'Connect', 'Speak'] },
        { id: createdRoles['OWNER'].id, allow: ['ViewChannel', 'Connect', 'Speak'] },
    ];

    let voiceCategory = guild.channels.cache.find(c => c.name === '🔊 ห้องพูดคุย' && c.type === ChannelType.GuildCategory) as CategoryChannel;
    if (!voiceCategory) voiceCategory = await guild.channels.create({ name: '🔊 ห้องพูดคุย', type: ChannelType.GuildCategory });

    await ensureChannel('พูดคุย', voiceCategory.id, { type: ChannelType.GuildVoice, permissionOverwrites: voiceGeneralPerms });
    await ensureChannel('งัดร้าน-1', voiceCategory.id, { type: ChannelType.GuildVoice, permissionOverwrites: voiceMembersOnly });
    await ensureChannel('งัดร้าน-2', voiceCategory.id, { type: ChannelType.GuildVoice, permissionOverwrites: voiceMembersOnly });
    await ensureChannel('งัดร้าน-3', voiceCategory.id, { type: ChannelType.GuildVoice, permissionOverwrites: voiceMembersOnly });
    await ensureChannel('งัดร้าน-4', voiceCategory.id, { type: ChannelType.GuildVoice, permissionOverwrites: voiceMembersOnly });
    await ensureChannel('งัดร้าน-5', voiceCategory.id, { type: ChannelType.GuildVoice, permissionOverwrites: voiceMembersOnly });
    await ensureChannel('พักผ่อนดูหนัง', voiceCategory.id, { type: ChannelType.GuildVoice, permissionOverwrites: voiceMembersOnly });
    await ensureChannel('เหม่อ (AFK)', voiceCategory.id, { type: ChannelType.GuildVoice, permissionOverwrites: voiceMembersOnly });

    // === 🔒 หัวแก๊ง (Admin Only - already set at category level) ===
    const logChannel = await ensureChannel('log-ระบบ', adminCategory.id);
    const requestsChannel = await ensureChannel('📋-คำขอและอนุมัติ', adminCategory.id); // New Request Channel for both Join & Leave
    await ensureChannel('ห้องประชุม', adminCategory.id, { type: ChannelType.GuildVoice });
    await ensureChannel('bot-commands', adminCategory.id);

    // Capture IDs, handling potential nulls
    const updates: any = {};
    if (registerChannel) updates.registerChannelId = registerChannel.id;
    if (attendanceChannel) updates.attendanceChannelId = attendanceChannel.id;
    if (financeChannel) updates.financeChannelId = financeChannel.id;
    if (logChannel) updates.logChannelId = logChannel.id;
    if (requestsChannel) updates.requestsChannelId = requestsChannel.id;
    if (announcementChannel) updates.announcementChannelId = announcementChannel.id;

    if (Object.keys(updates).length > 0) {
        await db.update(gangSettings)
            .set(updates)
            .where(eq(gangSettings.gangId, gangId));
    }

    // === Send Public Dashboard Link (New) ===
    await sendPublicDashboardPanel(interaction, gangId, dashboardChannel as TextChannel);

    // === Send Leave Buttons (2 Buttons: Leave & Late) ===
    const leaveEmbed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('📝 แจ้งลา / เข้าช้า')
        .setDescription('ใช้ข้อความนี้เมื่อคุณลางาน เข้าช้า หรือไม่สะดวกเข้าร่วมตามเวลา\nกดปุ่มให้ตรงกับสถานการณ์ แล้วระบบจะส่งคำขอไปให้หัวหน้า/แอดมินตรวจทันที')
        .addFields(
            { name: 'เลือกแบบไหนดี', value: '• **เข้าช้า** — วันนี้ยังมา แต่จะมาช้ากว่าปกติ\n• **ลา 1 วัน** — ลาหยุด 1 วันเต็ม\n• **ลาหลายวัน** — ใช้เมื่อหยุดมากกว่า 1 วัน' },
            { name: 'หลังส่งคำขอแล้ว', value: 'หัวหน้า/แอดมินจะเห็นรายการในห้องคำขอและบนหน้าเว็บ เพื่อตรวจอนุมัติหรือปฏิเสธ' }
        )
        .setFooter({ text: 'Gang Management System' });

    const leaveRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('request_leave_late')
                .setLabel('🟡 เข้าช้า')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('request_leave_1day')
                .setLabel('🟢 ลา 1 วัน')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('request_leave_multi')
                .setLabel('🔴 ลาหลายวัน')
                .setStyle(ButtonStyle.Danger)
        );

    // Send button (delete old message first if exists)
    if (leaveChannel) {
        // Fetch existing message ID from settings
        const currentSettings = await db.query.gangSettings.findFirst({
            where: eq(gangSettings.gangId, gangId),
            columns: { leaveMessageId: true }
        });

        // Delete old message if exists
        if (currentSettings?.leaveMessageId) {
            try {
                const oldMessage = await (leaveChannel as TextChannel).messages.fetch(currentSettings.leaveMessageId);
                if (oldMessage) await oldMessage.delete();
            } catch { /* Message already deleted or not found */ }
        }

        // Send new message
        const newMessage = await (leaveChannel as TextChannel).send({ embeds: [leaveEmbed], components: [leaveRow] });

        // Save new message ID and channel ID
        await db.update(gangSettings)
            .set({ leaveMessageId: newMessage.id, leaveChannelId: leaveChannel.id })
            .where(eq(gangSettings.gangId, gangId));
    }

    // === Send Finance Buttons (New) ===
    const gangData = await db.query.gangs.findFirst({
        where: eq(gangs.id, gangId),
        columns: { balance: true, name: true, subscriptionTier: true, subscriptionExpiresAt: true },
    });
    const gangBalance = gangData?.balance || 0;
    const hasFinance = gangData
        ? canAccessFeature(resolveEffectiveSubscriptionTier(gangData.subscriptionTier, gangData.subscriptionExpiresAt), 'finance')
        : false;

    const financeEmbed = new EmbedBuilder()
        .setTitle('💰 ศูนย์การเงินของสมาชิก')
        .setDescription(
            `**🏦 ยอดกองกลาง: ฿${gangBalance.toLocaleString()}**\n\n` +
            `ใช้ข้อความนี้เป็นจุดหลักสำหรับส่งคำขอการเงินและดูสถานะของตัวเอง โดยแยกหนี้ยืมออกจากยอดค้างเก็บเงินแก๊ง`
        )
        .addFields(
            { name: 'ทำอะไรได้บ้าง', value: '• **ยืมเงิน** — ขอเบิก/ยืมจากกองกลาง\n• **ชำระหนี้ยืม** — ชำระเฉพาะหนี้ยืมเข้ากองกลาง\n• **เก็บเงินแก๊ง/เครดิต** — ชำระค่าเก็บเงินแก๊งที่ค้างอยู่ หรือฝากเครดิต/สำรองจ่ายแทนแก๊ง\n• **สถานะการเงิน** — ดูหนี้ยืม ค้างเก็บเงิน และเครดิตที่ใช้ได้' },
            { name: 'หมายเหตุสำคัญ', value: 'คำขอที่ส่งจากห้องนี้อาจต้องรอหัวหน้า/เหรัญญิกตรวจสอบก่อนยอดจะถูกบันทึกจริง' }
        )
        .setColor('#FFD700')
        .setFooter({ text: `${gangData?.name || 'Gang'} • Member Finance` });

    const financeRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
          new ButtonBuilder()
              .setCustomId('finance_request_loan')
              .setLabel('💸 ยืมเงิน')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(!hasFinance),
          new ButtonBuilder()
              .setCustomId('finance_request_repay')
              .setLabel('🏦 ชำระหนี้ยืม')
              .setStyle(ButtonStyle.Success)
              .setDisabled(!hasFinance),
          new ButtonBuilder()
              .setCustomId('finance_request_deposit')
              .setLabel('📥 เก็บเงินแก๊ง/เครดิต')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(!hasFinance),
          new ButtonBuilder()
              .setCustomId('finance_balance')
              .setLabel('💳 สถานะการเงิน')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(!hasFinance),
      );

    if (financeChannel) {
        const messages = await (financeChannel as TextChannel).messages.fetch({ limit: 5 });
        const existingMsg = messages.find(m => m.author.id === interaction.client.user.id && m.embeds[0]?.title?.includes('ระบบการเงิน'));

        if (existingMsg) {
            await existingMsg.delete().catch(() => { });
        }

        await (financeChannel as TextChannel).send({ embeds: [financeEmbed], components: [financeRow] });
    }

    // === Send Verify Button ===
    if (verifyChannel) {
        const verifyEmbed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('✅ ยืนยันตัวตนก่อนใช้งาน')
            .setDescription(
                'สมาชิกใหม่และผู้เข้ามาใหม่เริ่มจากข้อความนี้ก่อน\n\n' +
                'หลังยืนยันแล้วคุณจะเห็นห้องพูดคุยพื้นฐานของเซิร์ฟเวอร์\n' +
                'ถ้าต้องการเข้าร่วมแก๊งต่อ ให้ไปกดในห้อง **ลงทะเบียน** เพิ่มเติม'
            )
            .addFields(
                { name: 'ลำดับที่แนะนำ', value: '1. กดยืนยันตัวตน\n2. อ่านกฎ/ประกาศ\n3. ไปที่ห้องลงทะเบียนเพื่อสมัครเข้าแก๊ง' }
            )
            .setFooter({ text: 'Gang Management System' });

        const verifyRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('verify_member')
                    .setLabel('✅ เริ่มยืนยันตัวตน')
                    .setStyle(ButtonStyle.Success)
            );

        // Delete old verify messages from bot
        const msgs = await (verifyChannel as TextChannel).messages.fetch({ limit: 5 });
        const oldVerify = msgs.find(m => m.author.id === interaction.client.user.id && m.embeds[0]?.title?.includes('ยืนยันตัวตน'));
        if (oldVerify) await oldVerify.delete().catch(() => { });

        await (verifyChannel as TextChannel).send({ embeds: [verifyEmbed], components: [verifyRow] });
    }
}

async function sendSetupInstructions(interaction: ButtonInteraction | ChatInputCommandInteraction, gangId: string) {
    const settings = await db.query.gangSettings.findFirst({ where: eq(gangSettings.gangId, gangId) });
    if (!settings?.registerChannelId) return;

    const registerChannel = interaction.guild?.channels.cache.get(settings.registerChannelId) as TextChannel;
    if (!registerChannel) return;

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📝 สมัครเข้าร่วมแก๊ง')
        .setDescription('สมาชิกใหม่เริ่มที่ข้อความนี้ได้เลย\nกดปุ่มด้านล่างเพื่อส่งคำขอเข้าระบบ')
        .addFields(
            { name: 'ทำอย่างไร', value: '1. กดปุ่ม "สมัครสมาชิก"\n2. กรอกชื่อในเกมของคุณ\n3. รอหัวหน้า/แอดมินอนุมัติและรับยศ' },
            { name: 'หลังจากอนุมัติแล้ว', value: 'คุณจะเริ่มใช้งานเช็คชื่อ, แจ้งลา, การเงิน และ Dashboard ได้ทันที' }
        );

    const button = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(new ButtonBuilder().setCustomId('register').setLabel('📝 สมัครสมาชิก').setStyle(ButtonStyle.Primary));

    // Delete old message if exists
    if (settings.registerMessageId) {
        try {
            const oldMessage = await registerChannel.messages.fetch(settings.registerMessageId);
            if (oldMessage) await oldMessage.delete();
        } catch { /* Message already deleted or not found */ }
    }

    // Send new message and save ID
    const newMessage = await registerChannel.send({ embeds: [embed], components: [button] });
    await db.update(gangSettings)
        .set({ registerMessageId: newMessage.id })
        .where(eq(gangSettings.gangId, gangId));
}

async function sendAdminPanel(interaction: ButtonInteraction | ChatInputCommandInteraction, gangId: string) {
    const adminChannel = interaction.guild?.channels.cache.find(c => c.name === 'bot-commands') as TextChannel;
    if (!adminChannel) return;

    const gang = await db.query.gangs.findFirst({
        where: eq(gangs.id, gangId),
        columns: { subscriptionTier: true, subscriptionExpiresAt: true }
    });
    const hasFinance = gang
        ? canAccessFeature(resolveEffectiveSubscriptionTier(gang.subscriptionTier, gang.subscriptionExpiresAt), 'finance')
        : false;

    // Get current settings
    const settings = await db.query.gangSettings.findFirst({
        where: eq(gangSettings.gangId, gangId),
        columns: { adminPanelMessageId: true }
    });
    const webUrl = process.env.NEXTAUTH_URL || 'https://gang-manager.vercel.app';
    const dashboardUrl = `${webUrl}/dashboard/${gangId}`;
    const settingsUrl = `${dashboardUrl}/settings`;
    const financeUrl = `${dashboardUrl}/finance`;

    const embed = new EmbedBuilder()
        .setColor(0x2B2D31)
        .setTitle('🎛️ ศูนย์ควบคุมหัวหน้าแก๊ง')
        .setDescription('ใช้ข้อความนี้เป็นจุดรวมงานหลักของหัวหน้าแก๊งและแอดมิน\nทั้งงานด่วนใน Discord และงานละเอียดบนหน้าเว็บ')
        .addFields(
            { name: 'ทำอะไรได้ทันทีจากตรงนี้', value: '• เปิด Dashboard เพื่อจัดการสมาชิกและตั้งค่า\n• บันทึกรายรับ/รายจ่ายแบบด่วน\n• ซ่อมห้อง/ยศเมื่อมีคนลบหรือย้าย' },
            { name: 'ถ้าระบบดูไม่ครบ', value: 'กดปุ่มซ่อมแซมห้อง/ยศได้เลย แล้วค่อยตรวจซ้ำบน Dashboard' }
        )
        .setFooter({ text: 'ถ้าข้อความนี้หาย ให้ใช้ /setup เพื่อสร้างแผงใหม่' });

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setLabel('🌐 Dashboard').setStyle(ButtonStyle.Link).setURL(dashboardUrl),
        new ButtonBuilder().setLabel('⚙️ ตั้งค่าเว็บ').setStyle(ButtonStyle.Link).setURL(settingsUrl),
        new ButtonBuilder().setLabel('💰 การเงินบนเว็บ').setStyle(ButtonStyle.Link).setURL(financeUrl).setDisabled(!hasFinance)
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`setup_mode_auto_${gangId}`).setLabel('🔄 ซ่อมแซมห้อง/ยศ').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('admin_income').setLabel('💰 รายรับด่วน').setStyle(ButtonStyle.Success).setDisabled(!hasFinance),
        new ButtonBuilder().setCustomId('admin_expense').setLabel('💸 รายจ่ายด่วน').setStyle(ButtonStyle.Danger).setDisabled(!hasFinance)
    );

    // Delete old message if exists
    if (settings?.adminPanelMessageId) {
        try {
            const oldMessage = await adminChannel.messages.fetch(settings.adminPanelMessageId);
            if (oldMessage) await oldMessage.delete();
        } catch { /* Message already deleted or not found */ }
    }

    // Send new message and save ID
    const newMessage = await adminChannel.send({ embeds: [embed], components: [row1, row2] });
    await db.update(gangSettings)
        .set({ adminPanelMessageId: newMessage.id })
        .where(eq(gangSettings.gangId, gangId));
}

async function sendPublicDashboardPanel(interaction: ButtonInteraction | ChatInputCommandInteraction | ModalSubmitInteraction, gangId: string, channel: TextChannel | null) {
    if (!channel) return;

    const recentMessages = await channel.messages.fetch({ limit: 10 });
    const existingPanel = recentMessages.find((message) => message.author.id === interaction.client.user.id && message.embeds[0]?.title?.includes('เว็บแดชบอร์ดสมาชิก'));
    if (existingPanel) {
        await existingPanel.delete().catch(() => { });
    }

    const embed = new EmbedBuilder()
        .setColor(0x00B0F4)
        .setTitle('🌐 เว็บแดชบอร์ดสมาชิก')
        .setDescription('สมาชิกทุกคนใช้ข้อความนี้เป็นทางเข้าหน้าเว็บหลักของแก๊ง\nล็อกอินด้วย Discord แล้วดูข้อมูลส่วนตัว การเงิน เช็คชื่อ และหน้าจัดการต่าง ๆ ได้ทันที')
        .addFields(
            { name: 'ใช้ทำอะไรได้บ้าง', value: '• ดูสถานะการเงินของตัวเอง\n• ดูประวัติ attendance / leave\n• ให้หัวหน้าเข้าไปจัดการสมาชิก, การเงิน และตั้งค่า' },
            { name: 'วิธีเข้าใช้', value: 'กดปุ่มด้านล่าง แล้วล็อกอินด้วย Discord บัญชีเดียวกับที่อยู่ในเซิร์ฟเวอร์นี้' }
        )
        .setFooter({ text: 'Gang Management System' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setLabel('เปิด Dashboard')
            .setStyle(ButtonStyle.Link)
            .setURL(`${process.env.NEXTAUTH_URL || 'https://gang-manager.vercel.app'}/dashboard/${gangId}`)
    );

    await channel.send({ embeds: [embed], components: [row] });
}

export { handleSetupStart, handleSetupModalSubmit, handleSetupModeAuto, handleSetupModeManual, handleSetupRoleSelect, sendAdminPanel };
