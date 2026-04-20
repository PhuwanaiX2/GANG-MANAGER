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
import { db, gangs, gangSettings, gangRoles, members, licenses, getTierConfig, normalizeSubscriptionTier } from '@gang/database';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// --- Handlers Registration ---
registerButtonHandler('setup_start', handleSetupStart);
registerModalHandler('setup_modal', handleSetupModalSubmit);
registerButtonHandler('setup_mode_auto', handleSetupModeAuto);
registerButtonHandler('setup_mode_manual', handleSetupModeManual);

// Register Select Menu Handlers for Manual Flow
registerSelectMenuHandler('setup_select', handleSetupRoleSelect);

// --- 1. Start Button Click -> Show Modal OR Skip if exists ---
async function handleSetupStart(interaction: ButtonInteraction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: '❌ คุณต้องเป็น Administrator เท่านั้น', ephemeral: true });
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
            .setTitle('เลือกโหมดติดตั้ง')
            .setDescription(`พบแก๊ง **"${existingGang.name}"** ในระบบแล้ว`)
            .addFields(
                { name: 'Auto (แนะนำ)', value: 'สร้างห้อง+ยศที่ขาดหายให้ครบ' },
                { name: 'เชื่อมต่อยศ', value: 'เชื่อมยศที่มีอยู่เข้ากับระบบ' }
            );

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`setup_mode_auto_${existingGang.id}`).setLabel('Auto').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`setup_mode_manual_${existingGang.id}`).setLabel('เชื่อมยศ').setStyle(ButtonStyle.Secondary)
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

    // New gangs start on FREE tier
    let resolvedTier: 'FREE' | 'PREMIUM' = 'FREE';

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
                m.gang.stripeCustomerId &&
                normalizeSubscriptionTier(m.gang.subscriptionTier) !== 'FREE'
            );

            if (dissolvedGangWithSub && dissolvedGangWithSub.gang) {
                const oldGang = dissolvedGangWithSub.gang;
                // Transfer subscription to new gang
                await db.update(gangs)
                    .set({
                        stripeCustomerId: oldGang.stripeCustomerId,
                        subscriptionTier: normalizeSubscriptionTier(oldGang.subscriptionTier),
                        subscriptionExpiresAt: oldGang.subscriptionExpiresAt,
                    })
                    .where(eq(gangs.id, gangId));

                // Clear old gang's stripe data
                await db.update(gangs)
                    .set({
                        stripeCustomerId: null,
                        subscriptionTier: 'FREE',
                        subscriptionExpiresAt: null,
                    })
                    .where(eq(gangs.id, oldGang.id));

                resolvedTier = normalizeSubscriptionTier(oldGang.subscriptionTier);
                transferredInfo = `\n🔄 **โอนแพ็คเกจ ${normalizeSubscriptionTier(oldGang.subscriptionTier)}** จากแก๊ง "${oldGang.name}" สำเร็จ!`;
                console.log(`[Setup] Transferred subscription ${normalizeSubscriptionTier(oldGang.subscriptionTier)} from gang "${oldGang.name}" (${oldGang.id}) to new gang "${gangName}" (${gangId})`);
            }
        } else {
            await db.update(gangs)
                .set({ name: gangName, subscriptionTier: resolvedTier })
                .where(eq(gangs.id, gangId));
        }

        // Ask for Mode
        const trialInfo = '';
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🛠️ เลือกโหมดการติดตั้ง')
            .setDescription(`บันทึกข้อมูลแก๊ง **"${gangName}"** เรียบร้อยแล้ว${transferredInfo}${trialInfo}\nคุณต้องการทำรายการใดต่อ?`)
            .addFields(
                { name: '🚀 ติดตั้ง Auto (แนะนำ)', value: 'สร้างห้อง, ยศ, และตั้งค่าเริ่มต้นให้ครบชุด' },
                { name: '⚙️ เชื่อมต่อยศ (Setup Roles)', value: 'มีห้องแล้ว? กดปุ่มนี้เพื่อเชื่อมยศที่มีอยู่ เข้ากับระบบ' }
            );

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`setup_mode_auto_${gangId}`).setLabel('🚀 ติดตั้ง Auto').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`setup_mode_manual_${gangId}`).setLabel('⚙️ เชื่อมต่อยศ').setStyle(ButtonStyle.Secondary)
        );

        await interaction.editReply({ embeds: [embed], components: [row] });

    } catch (error) {
        console.error('Setup Modal Error:', error);
        await interaction.editReply('❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
}

// --- 3. Auto Mode -> Create Resources ---
async function handleSetupModeAuto(interaction: ButtonInteraction) {
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
    } catch (e) {
        console.log('Interaction update failed, trying to continue:', e);
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

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ ตั้งค่าสำเร็จ!')
            .setDescription(`ระบบจัดการแก๊ง **${gang?.name}** พร้อมใช้งานแล้ว`)
            .addFields(
                { name: '📋 สถานะ', value: normalizeSubscriptionTier(gang?.subscriptionTier) === 'PREMIUM' ? 'Premium' : 'Free', inline: true },
                { name: '🎭 ระบบยศ', value: 'สร้างครบ 4 ระดับ', inline: true },
                { name: '📂 ห้อง', value: 'สร้างครบทุกหมวด', inline: true }
            );

        await interaction.editReply({ content: '', embeds: [embed], components: [] });

        await sendSetupInstructions(interaction, gangId);
        await sendAdminPanel(interaction, gangId);

    } catch (error) {
        console.error('Auto Setup Error:', error);
        await interaction.editReply('❌ เกิดข้อผิดพลาดในการสร้างทรัพยากร');
    }
}

// --- 4. Manual Mode -> Start Role Selection Loop ---
async function handleSetupModeManual(interaction: ButtonInteraction) {
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
    const currentPermission = parts[2] as 'OWNER' | 'ADMIN' | 'TREASURER' | 'MEMBER';
    const gangId = parts[3];
    const selectedRoleId = interaction.values[0];

    await interaction.deferUpdate();

    // 1. Save Mapping
    // Check if mapping exists
    const existing = await db.query.gangRoles.findFirst({
        where: (t, { and, eq }) => and(eq(t.gangId, gangId), eq(t.discordRoleId, selectedRoleId))
    });

    if (!existing) {
        await db.insert(gangRoles).values({
            id: nanoid(),
            gangId: gangId,
            discordRoleId: selectedRoleId,
            permissionLevel: currentPermission
        });
    } else {
        // Update permission if already mapped (or just ignore/overwrite)
        await db.update(gangRoles)
            .set({ permissionLevel: currentPermission })
            .where(eq(gangRoles.id, existing.id));
    }

    // 2. Next Step
    const nextStepMap: Record<string, string> = {
        'OWNER': 'ADMIN',
        'ADMIN': 'TREASURER',
        'TREASURER': 'MEMBER',
        'MEMBER': 'DONE'
    };

    const nextPerm = nextStepMap[currentPermission];

    if (nextPerm === 'DONE') {
        const gang = await db.query.gangs.findFirst({ where: eq(gangs.id, gangId) });
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ ตั้งค่าสำเร็จ (Manual)')
            .setDescription(`แก๊ง **${gang?.name}** บันทึกยศครบถ้วนแล้ว\nคุณสามารถใช้งาน Dashboard ได้ทันที`)
            .addFields({ name: '📝 ขั้นตอนต่อไป', value: 'ใช้คำสั่ง `/settings` เพื่อตั้งค่าห้อง หรือปรับแต่งเพิ่มเติม' });

        await interaction.editReply({ embeds: [embed], components: [] });
    } else {
        await askForRole(interaction, gangId, nextPerm);
    }
}

// Helper to send Role Select Menu
async function askForRole(interaction: ButtonInteraction | AnySelectMenuInteraction, gangId: string, permission: string) {
    const labels: Record<string, string> = {
        'OWNER': '👑 หัวหน้าแก๊ง (Owner)',
        'ADMIN': '🛡️ รองหัวหน้า (Admin)',
        'TREASURER': '💰 เหรัญญิก (Treasurer)',
        'MEMBER': '👤 สมาชิก (Member)'
    };

    const embed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle(`🎭 เลือกยศ: ${labels[permission]}`)
        .setDescription(`กรุณาเลือก Role ใน Discord ที่ต้องการมอบหมายให้เป็น **${labels[permission]}**`);

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
        console.warn('Failed to set Verified role position:', error);
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

        const existingMap = await db.query.gangRoles.findFirst({
            where: (table, { and, eq }) => and(
                eq(table.gangId, gangId),
                eq(table.discordRoleId, role!.id)
            )
        });

        if (!existingMap) {
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
        } catch (e) {
            console.error('[Setup] Failed to create Admin Category:', e);
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
                        console.log(`[Setup] Moved existing channel '${name}' to new category`);
                    } catch (moveErr: any) {
                        console.warn(`[Setup] Failed to move channel '${name}':`, moveErr.message);
                    }
                }
            }

            if (existing) {
                // Enforce permissions if specified
                if (options.permissionOverwrites) {
                    await (existing as TextChannel).edit({ permissionOverwrites: options.permissionOverwrites }).catch(err => {
                        console.warn(`[Setup] Failed to update permissions for ${name}:`, err.message);
                    });
                }
                return existing;
            }

            return await guild.channels.create({ name, parent: parentId, type: ChannelType.GuildText, ...options });
        } catch (error: any) {
            console.error(`[Setup] Failed to ensure channel '${name}':`, error.message);
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

    // === � ห้องแชท (Chat Channels) ===
    // General chat: visible to Verified + all gang roles
    const generalChatPerms = [
        { id: guild.roles.everyone.id, deny: ['ViewChannel'] },
        { id: verifiedRole!.id, allow: ['ViewChannel', 'SendMessages'] },
        { id: createdRoles['MEMBER'].id, allow: ['ViewChannel', 'SendMessages'] },
        { id: createdRoles['ADMIN'].id, allow: ['ViewChannel', 'SendMessages'] },
        { id: createdRoles['TREASURER'].id, allow: ['ViewChannel', 'SendMessages'] },
        { id: createdRoles['OWNER'].id, allow: ['ViewChannel', 'SendMessages'] },
    ];

    let chatCategory = guild.channels.cache.find(c => c.name === '� ห้องแชท' && c.type === ChannelType.GuildCategory) as CategoryChannel;
    if (!chatCategory) chatCategory = await guild.channels.create({ name: '� ห้องแชท', type: ChannelType.GuildCategory });

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
        .setDescription('กดปุ่มด้านล่างเพื่อแจ้งลาหรือเข้าช้า')
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
        columns: { balance: true, name: true },
    });
    const gangBalance = gangData?.balance || 0;

    const financeEmbed = new EmbedBuilder()
        .setTitle('💰 ระบบการเงิน (Finance System)')
        .setDescription(
            `**🏦 ยอดกองกลาง: ฿${gangBalance.toLocaleString()}**\n\n` +
            `💸 **ยืมเงิน** — ขอเบิก/ยืมจากกองกลาง\n` +
            `🏦 **คืนเงิน** — คืนเงินที่ยืมไว้\n` +
            `📥 **ฝาก/สำรองจ่าย** — แจ้งฝากเงินเข้ากองกลาง\n` +
            `💳 **สถานะการเงิน** — ดูหนี้ยืม ค้างเก็บเงิน และเครดิตกับกองกลาง`
        )
        .setColor('#FFD700')
        .setFooter({ text: `${gangData?.name || 'Gang'} • Finance System` });

    const financeRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
          new ButtonBuilder()
              .setCustomId('finance_request_loan')
              .setLabel('💸 ยืมเงิน')
              .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
              .setCustomId('finance_request_repay')
              .setLabel('🏦 คืนเงิน')
              .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
              .setCustomId('finance_request_deposit')
              .setLabel('📥 ฝาก/สำรองจ่าย')
              .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
              .setCustomId('finance_balance')
              .setLabel('💳 สถานะการเงิน')
              .setStyle(ButtonStyle.Secondary),
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
            .setTitle('✅ ยืนยันตัวตน (Verify)')
            .setDescription(
                'กดปุ่มด้านล่างเพื่อยืนยันตัวตน\n\n' +
                'หลังยืนยันแล้วคุณจะสามารถเห็นห้องพูดคุยทั่วไปได้\n' +
                'หากต้องการเข้าร่วมแก๊ง ให้ไปที่ห้อง **ลงทะเบียน** เพิ่มเติม'
            )
            .setFooter({ text: 'Gang Management System' });

        const verifyRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('verify_member')
                    .setLabel('✅ ยืนยันตัวตน')
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
        .setTitle('🎮 ยินดีต้อนรับ!')
        .setDescription('กดปุ่มด้านล่างเพื่อลงทะเบียนเป็นสมาชิกแก๊ง')
        .addFields({ name: '📝 ขั้นตอน', value: '1. กดปุ่ม "ลงทะเบียน"\n2. กรอกชื่อในเกมของคุณ\n3. รอรับยศสมาชิก' });

    const button = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(new ButtonBuilder().setCustomId('register').setLabel('📝 ลงทะเบียน').setStyle(ButtonStyle.Primary));

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

    // Get current settings
    const settings = await db.query.gangSettings.findFirst({
        where: eq(gangSettings.gangId, gangId),
        columns: { adminPanelMessageId: true }
    });

    const embed = new EmbedBuilder()
        .setColor(0x2B2D31)
        .setTitle('🎛️ Gang Control Panel')
        .setDescription('แผงควบคุมสำหรับหัวหน้าแก๊งและแอดมิน\nจัดการทุกอย่างได้จากที่นี่')
        .setFooter({ text: 'เมนูนี้จะค้างหน้านี้ตลอดไป หากหายไปให้พิมพ์ /setup ใหม่' });

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setLabel('🌐 Dashboard').setStyle(ButtonStyle.Link).setURL(`${process.env.NEXTAUTH_URL || 'https://gang-manager.vercel.app'}/dashboard/${gangId}`),
        new ButtonBuilder().setCustomId(`setup_mode_auto_${gangId}`).setLabel('🔄 ซ่อมแซมห้อง/ยศ').setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('admin_income').setLabel('💰 รายรับ').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('admin_expense').setLabel('💸 รายจ่าย').setStyle(ButtonStyle.Danger),
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

    // Check if we already sent it recently to avoid spam (optional, but good practice)
    // For now, simple implementation: just send it. 
    // Ideally we might want to delete old one if we track it, but we don't track public msg ID in DB yet.

    const embed = new EmbedBuilder()
        .setColor(0x00B0F4)
        .setTitle('🌐 Gang Dashboard')
        .setDescription('เว็บแดชบอร์ดสำหรับสมาชิกแก๊ง\nสามารถดูข้อมูลการเงิน, เช็คชื่อ, และจัดการข้อมูลส่วนตัวได้ที่นี่')
        .addFields({ name: '🔗 Link', value: 'กดปุ่มด้านล่างเพื่อเปิดเว็บ' })
        .setFooter({ text: 'Gang Management System' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setLabel('เปิด Dashboard')
            .setStyle(ButtonStyle.Link)
            .setURL(`${process.env.NEXTAUTH_URL || 'https://gang-manager.vercel.app'}/dashboard/${gangId}`)
    );

    await channel.send({ embeds: [embed], components: [row] });
}

export { handleSetupStart, handleSetupModalSubmit, handleSetupModeAuto, handleSetupModeManual, sendAdminPanel };
