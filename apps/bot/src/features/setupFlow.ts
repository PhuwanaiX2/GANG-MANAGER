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
    await interaction.reply({ content: 'âŒ à¸„à¸¸à¸“à¸•à¹‰à¸­à¸‡à¹€à¸›à¹‡à¸™ Administrator à¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™', ephemeral: true });
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
            .setTitle('ðŸ§­ à¸žà¸šà¸£à¸°à¸šà¸šà¹€à¸”à¸´à¸¡à¸‚à¸­à¸‡à¹à¸à¹Šà¸‡à¸™à¸µà¹‰à¹à¸¥à¹‰à¸§')
            .setDescription(`à¹€à¸‹à¸´à¸£à¹Œà¸Ÿà¹€à¸§à¸­à¸£à¹Œà¸™à¸µà¹‰à¹€à¸Šà¸·à¹ˆà¸­à¸¡à¸à¸±à¸šà¹à¸à¹Šà¸‡ **"${existingGang.name}"** à¸­à¸¢à¸¹à¹ˆà¹à¸¥à¹‰à¸§\nà¹€à¸¥à¸·à¸­à¸à¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸à¸²à¸£à¸—à¸³à¸•à¹ˆà¸­à¹„à¸”à¹‰à¹€à¸¥à¸¢`)
            .addFields(
                { name: 'ðŸš€ à¸‹à¹ˆà¸­à¸¡à¹à¸‹à¸¡à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´', value: 'à¸ªà¸£à¹‰à¸²à¸‡à¸«à¸£à¸·à¸­à¹€à¸•à¸´à¸¡à¸«à¹‰à¸­à¸‡/à¸¢à¸¨/à¹à¸œà¸‡à¸«à¸¥à¸±à¸à¸—à¸µà¹ˆà¸«à¸²à¸¢à¹„à¸›à¹ƒà¸«à¹‰à¸žà¸£à¹‰à¸­à¸¡à¹ƒà¸Šà¹‰à¸‡à¸²à¸™à¸­à¸µà¸à¸„à¸£à¸±à¹‰à¸‡' },
                { name: 'ðŸ§© à¹€à¸Šà¸·à¹ˆà¸­à¸¡à¸¢à¸¨à¹€à¸­à¸‡', value: 'à¹ƒà¸Šà¹‰à¹€à¸¡à¸·à¹ˆà¸­à¸„à¸¸à¸“à¸¡à¸µà¹‚à¸„à¸£à¸‡à¸ªà¸£à¹‰à¸²à¸‡à¸«à¹‰à¸­à¸‡à¸­à¸¢à¸¹à¹ˆà¹à¸¥à¹‰à¸§ à¹à¸¥à¸°à¸•à¹‰à¸­à¸‡à¸à¸²à¸£ map à¸¢à¸¨à¹€à¸‚à¹‰à¸²à¸à¸±à¸šà¸£à¸°à¸šà¸šà¹à¸šà¸šà¸¥à¸°à¹€à¸­à¸µà¸¢à¸”' }
            );

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`setup_mode_auto_${existingGang.id}`).setLabel('ðŸš€ à¸‹à¹ˆà¸­à¸¡à¹à¸‹à¸¡à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`setup_mode_manual_${existingGang.id}`).setLabel('ðŸ§© à¹€à¸Šà¸·à¹ˆà¸­à¸¡à¸¢à¸¨à¹€à¸­à¸‡').setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        return;
    }

    const modal = new ModalBuilder()
        .setCustomId('setup_modal')
        .setTitle('âš™ï¸ à¸•à¸±à¹‰à¸‡à¸„à¹ˆà¸²à¹à¸à¹Šà¸‡');

    const nameInput = new TextInputBuilder()
        .setCustomId('gang_name')
        .setLabel('à¸Šà¸·à¹ˆà¸­à¹à¸à¹Šà¸‡')
        .setPlaceholder('à¸£à¸°à¸šà¸¸à¸Šà¸·à¹ˆà¸­à¹à¸à¹Šà¸‡à¸‚à¸­à¸‡à¸„à¸¸à¸“')
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
                transferredInfo = `\nðŸ”„ **à¹‚à¸­à¸™à¹à¸žà¹‡à¸„à¹€à¸à¸ˆ ${normalizeSubscriptionTier(oldGang.subscriptionTier)}** à¸ˆà¸²à¸à¹à¸à¹Šà¸‡ "${oldGang.name}" à¸ªà¸³à¹€à¸£à¹‡à¸ˆ!`;
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
            ? `\nðŸŽ **à¸—à¸”à¸¥à¸­à¸‡à¹ƒà¸Šà¹‰à¸Ÿà¸£à¸µ ${TRIAL_DAYS} à¸§à¸±à¸™** à¸–à¸¶à¸‡ ${currentTrialExpiry.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'long', year: 'numeric' })}`
            : '';
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('âœ… à¸šà¸±à¸™à¸—à¸¶à¸à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹à¸à¹Šà¸‡à¹à¸¥à¹‰à¸§')
            .setDescription(`à¹à¸à¹Šà¸‡ **"${gangName}"** à¸žà¸£à¹‰à¸­à¸¡à¹€à¸‚à¹‰à¸²à¸ªà¸¹à¹ˆà¸‚à¸±à¹‰à¸™à¸•à¸­à¸™à¹€à¸›à¸´à¸”à¸£à¸°à¸šà¸šà¹à¸¥à¹‰à¸§${transferredInfo}${trialInfo}\nà¹€à¸¥à¸·à¸­à¸à¸£à¸¹à¸›à¹à¸šà¸šà¸—à¸µà¹ˆà¹€à¸«à¸¡à¸²à¸°à¸à¸±à¸šà¹€à¸‹à¸´à¸£à¹Œà¸Ÿà¹€à¸§à¸­à¸£à¹Œà¸‚à¸­à¸‡à¸„à¸¸à¸“à¸•à¹ˆà¸­à¹„à¸”à¹‰à¹€à¸¥à¸¢`)
            .addFields(
                { name: 'ðŸš€ à¸•à¸´à¸”à¸•à¸±à¹‰à¸‡à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´', value: 'à¹ƒà¸«à¹‰à¸šà¸­à¸—à¸ªà¸£à¹‰à¸²à¸‡à¸«à¹‰à¸­à¸‡, à¸¢à¸¨, à¸›à¸¸à¹ˆà¸¡à¸¥à¸‡à¸—à¸°à¹€à¸šà¸µà¸¢à¸™, à¹à¸œà¸‡à¸à¸²à¸£à¹€à¸‡à¸´à¸™ à¹à¸¥à¸°à¹à¸œà¸‡à¸„à¸§à¸šà¸„à¸¸à¸¡à¹ƒà¸«à¹‰à¸žà¸£à¹‰à¸­à¸¡à¹ƒà¸Šà¹‰à¸—à¸±à¸™à¸—à¸µ' },
                { name: 'ðŸ§© à¹€à¸Šà¸·à¹ˆà¸­à¸¡à¸¢à¸¨à¹€à¸­à¸‡', value: 'à¹€à¸«à¸¡à¸²à¸°à¸à¸±à¸šà¹€à¸‹à¸´à¸£à¹Œà¸Ÿà¹€à¸§à¸­à¸£à¹Œà¸—à¸µà¹ˆà¸ˆà¸±à¸”à¸«à¹‰à¸­à¸‡à¹„à¸§à¹‰à¹à¸¥à¹‰à¸§ à¹à¸¥à¸°à¸•à¹‰à¸­à¸‡à¸à¸²à¸£ map à¸¢à¸¨à¹€à¸‚à¹‰à¸²à¸£à¸°à¸šà¸šà¸—à¸µà¸¥à¸°à¸‚à¸±à¹‰à¸™' }
            );

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`setup_mode_auto_${gangId}`).setLabel('ðŸš€ à¸•à¸´à¸”à¸•à¸±à¹‰à¸‡à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`setup_mode_manual_${gangId}`).setLabel('ðŸ§© à¹€à¸Šà¸·à¹ˆà¸­à¸¡à¸¢à¸¨à¹€à¸­à¸‡').setStyle(ButtonStyle.Secondary)
        );

        await interaction.editReply({ embeds: [embed], components: [row] });

    } catch (error) {
        logError('bot.setup.modal_failed', error, {
            guildId,
            gangId,
            userDiscordId: interaction.user.id,
        });
        await interaction.editReply('âŒ à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”à¹ƒà¸™à¸à¸²à¸£à¸šà¸±à¸™à¸—à¸¶à¸à¸‚à¹‰à¸­à¸¡à¸¹à¸¥');
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
                content: 'â³ à¸à¸³à¸¥à¸±à¸‡à¸•à¸´à¸”à¸•à¸±à¹‰à¸‡à¸£à¸°à¸šà¸š Auto... à¸à¸£à¸¸à¸“à¸²à¸£à¸­à¸ªà¸±à¸à¸„à¸£à¸¹à¹ˆ',
                embeds: [],
                components: []
            });
        } else {
            await interaction.update({
                content: 'â³ à¸à¸³à¸¥à¸±à¸‡à¸•à¸´à¸”à¸•à¸±à¹‰à¸‡à¸£à¸°à¸šà¸š Auto... à¸à¸£à¸¸à¸“à¸²à¸£à¸­à¸ªà¸±à¸à¸„à¸£à¸¹à¹ˆ',
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
        await interaction.editReply('âŒ Error: Missing Gang ID');
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
                content: 'âŒ **à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹à¸à¹Šà¸‡à¹„à¸¡à¹ˆà¸–à¸¹à¸à¸•à¹‰à¸­à¸‡ (Gang Not Found)**\n\nà¸ªà¸²à¹€à¸«à¸•à¸¸à¸—à¸µà¹ˆà¹€à¸›à¹‡à¸™à¹„à¸›à¹„à¸”à¹‰:\n1. à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸–à¸¹à¸à¸¥à¸šà¸­à¸­à¸à¸ˆà¸²à¸à¸à¸²à¸™à¸‚à¹‰à¸­à¸¡à¸¹à¸¥\n2. à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”à¹ƒà¸™à¸à¸²à¸£à¸šà¸±à¸™à¸—à¸¶à¸à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸‚à¸±à¹‰à¸™à¸•à¸­à¸™à¸à¹ˆà¸­à¸™à¸«à¸™à¹‰à¸²\n\n**à¸§à¸´à¸˜à¸µà¹à¸à¹‰à¹„à¸‚:**\nà¸à¸£à¸¸à¸“à¸²à¸žà¸´à¸¡à¸žà¹Œà¸„à¸³à¸ªà¸±à¹ˆà¸‡ `/setup` à¹€à¸žà¸·à¹ˆà¸­à¹€à¸£à¸´à¹ˆà¸¡à¸•à¸±à¹‰à¸‡à¸„à¹ˆà¸²à¹ƒà¸«à¸¡à¹ˆà¸•à¸±à¹‰à¸‡à¹à¸•à¹ˆà¸•à¹‰à¸™',
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
            .setTitle('âœ… à¹€à¸›à¸´à¸”à¸£à¸°à¸šà¸šà¹à¸à¹Šà¸‡à¸ªà¸³à¹€à¸£à¹‡à¸ˆà¹à¸¥à¹‰à¸§')
            .setDescription(`à¹à¸à¹Šà¸‡ **${gang?.name}** à¸žà¸£à¹‰à¸­à¸¡à¹ƒà¸Šà¹‰à¸‡à¸²à¸™à¸—à¸±à¹‰à¸‡à¹ƒà¸™ Discord à¹à¸¥à¸°à¸«à¸™à¹‰à¸²à¹€à¸§à¹‡à¸šà¹à¸¥à¹‰à¸§`)
            .addFields(
                { name: 'ðŸ“‹ à¸ªà¸–à¸²à¸™à¸°', value: normalizeSubscriptionTier(gang?.subscriptionTier) === 'PREMIUM' ? 'Premium' : normalizeSubscriptionTier(gang?.subscriptionTier) === 'TRIAL' ? 'Trial 7 à¸§à¸±à¸™' : 'Free', inline: true },
                { name: 'ðŸŽ­ à¸£à¸°à¸šà¸šà¸¢à¸¨', value: 'à¸ªà¸£à¹‰à¸²à¸‡à¸„à¸£à¸š 4 à¸£à¸°à¸”à¸±à¸š', inline: true },
                { name: 'ðŸ“‚ à¸«à¹‰à¸­à¸‡', value: 'à¸ªà¸£à¹‰à¸²à¸‡à¸„à¸£à¸šà¸—à¸¸à¸à¸«à¸¡à¸§à¸”', inline: true },
                { name: 'ðŸŽ¯ à¹à¸™à¸°à¸™à¸³à¹ƒà¸«à¹‰à¸—à¸³à¸•à¹ˆà¸­à¸—à¸±à¸™à¸—à¸µ', value: '1. à¹€à¸Šà¹‡à¸à¹à¸œà¸‡à¸¥à¸‡à¸—à¸°à¹€à¸šà¸µà¸¢à¸™/à¸¢à¸·à¸™à¸¢à¸±à¸™à¸•à¸±à¸§à¸•à¸™\n2. à¹ƒà¸«à¹‰à¸ªà¸¡à¸²à¸Šà¸´à¸à¹€à¸£à¸´à¹ˆà¸¡à¹€à¸‚à¹‰à¸²à¸£à¸°à¸šà¸š\n3. à¹€à¸›à¸´à¸” Dashboard à¹€à¸žà¸·à¹ˆà¸­à¸•à¸£à¸§à¸ˆà¸ªà¸¡à¸²à¸Šà¸´à¸, attendance, finance à¹à¸¥à¸°à¸•à¸±à¹‰à¸‡à¸„à¹ˆà¸²à¹€à¸žà¸´à¹ˆà¸¡à¹€à¸•à¸´à¸¡' },
                { name: 'ðŸ›Ÿ à¸–à¹‰à¸²à¹€à¸¡à¸™à¸¹à¸«à¸²à¸¢à¸«à¸£à¸·à¸­à¸«à¹‰à¸­à¸‡à¹€à¸žà¸µà¹‰à¸¢à¸™', value: 'à¹ƒà¸Šà¹‰à¸›à¸¸à¹ˆà¸¡à¸‹à¹ˆà¸­à¸¡à¹à¸‹à¸¡à¸«à¹‰à¸­à¸‡/à¸¢à¸¨à¸ˆà¸²à¸à¹à¸œà¸‡à¸„à¸§à¸šà¸„à¸¸à¸¡ à¸«à¸£à¸·à¸­à¸žà¸´à¸¡à¸žà¹Œ `/setup` à¹€à¸žà¸·à¹ˆà¸­à¸ªà¸£à¹‰à¸²à¸‡à¹ƒà¸«à¸¡à¹ˆà¸­à¸µà¸à¸„à¸£à¸±à¹‰à¸‡' }
            );

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setLabel('ðŸŒ à¹€à¸›à¸´à¸” Dashboard').setStyle(ButtonStyle.Link).setURL(dashboardUrl),
            new ButtonBuilder().setLabel('âš™ï¸ à¸•à¸±à¹‰à¸‡à¸„à¹ˆà¸²à¸šà¸™à¹€à¸§à¹‡à¸š').setStyle(ButtonStyle.Link).setURL(settingsUrl)
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
        await interaction.editReply('âŒ à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”à¹ƒà¸™à¸à¸²à¸£à¸ªà¸£à¹‰à¸²à¸‡à¸—à¸£à¸±à¸žà¸¢à¸²à¸à¸£');
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
            `à¸¢à¸¨à¸™à¸µà¹‰à¸–à¸¹à¸à¹€à¸Šà¸·à¹ˆà¸­à¸¡à¹€à¸›à¹‡à¸™ ${existingByRole.permissionLevel} à¸­à¸¢à¸¹à¹ˆà¹à¸¥à¹‰à¸§ à¸à¸£à¸¸à¸“à¸²à¹€à¸¥à¸·à¸­à¸à¸¢à¸¨à¸„à¸™à¸¥à¸°à¸­à¸±à¸™à¹€à¸žà¸·à¹ˆà¸­à¹„à¸¡à¹ˆà¹ƒà¸«à¹‰à¸ªà¸´à¸—à¸˜à¸´à¹Œà¸—à¸±à¸šà¸à¸±à¸™`
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
            .setTitle('âœ… à¹€à¸Šà¸·à¹ˆà¸­à¸¡à¸¢à¸¨à¸ªà¸³à¹€à¸£à¹‡à¸ˆ')
            .setDescription(`à¹à¸à¹Šà¸‡ **${gang?.name}** à¸šà¸±à¸™à¸—à¸¶à¸à¸¢à¸¨à¸„à¸£à¸šà¸–à¹‰à¸§à¸™à¹à¸¥à¹‰à¸§\nà¸‚à¸±à¹‰à¸™à¸•à¸­à¸™à¸™à¸µà¹‰à¹€à¸›à¹‡à¸™à¸à¸²à¸£à¹€à¸Šà¸·à¹ˆà¸­à¸¡à¸ªà¸´à¸—à¸˜à¸´à¹Œà¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™ à¸–à¹‰à¸²à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¸«à¹‰à¸­à¸‡/à¹à¸œà¸‡à¸›à¸¸à¹ˆà¸¡ à¹ƒà¸«à¹‰à¸à¸”à¸‹à¹ˆà¸­à¸¡à¹à¸‹à¸¡à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´à¸”à¹‰à¸²à¸™à¸¥à¹ˆà¸²à¸‡`)
            .addFields(
                { name: 'ðŸ§­ à¸‚à¸±à¹‰à¸™à¸•à¸­à¸™à¸•à¹ˆà¸­à¹„à¸›', value: '1. à¹€à¸›à¸´à¸” Dashboard à¹€à¸žà¸·à¹ˆà¸­à¸•à¸£à¸§à¸ˆà¸ªà¸¡à¸²à¸Šà¸´à¸à¹à¸¥à¸°à¸•à¸±à¹‰à¸‡à¸„à¹ˆà¸²\n2. à¸–à¹‰à¸²à¸«à¹‰à¸­à¸‡à¸«à¸£à¸·à¸­à¹à¸œà¸‡à¸›à¸¸à¹ˆà¸¡à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸„à¸£à¸š à¹ƒà¸«à¹‰à¸à¸”à¸‹à¹ˆà¸­à¸¡à¹à¸‹à¸¡à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´\n3. à¸«à¸¥à¸±à¸‡à¸‹à¹ˆà¸­à¸¡à¹à¸¥à¹‰à¸§à¹ƒà¸«à¹‰à¸¥à¸­à¸‡à¸à¸”à¸›à¸¸à¹ˆà¸¡à¸¥à¸‡à¸—à¸°à¹€à¸šà¸µà¸¢à¸™/à¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­/à¸à¸²à¸£à¹€à¸‡à¸´à¸™à¸”à¹‰à¸§à¸¢à¸šà¸±à¸à¸Šà¸µà¸—à¸”à¸ªà¸­à¸š' }
            );

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`setup_mode_auto_${gangId}`)
                .setLabel('ðŸš€ à¸‹à¹ˆà¸­à¸¡à¹à¸‹à¸¡à¸«à¹‰à¸­à¸‡/à¹à¸œà¸‡à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setLabel('ðŸŒ à¹€à¸›à¸´à¸” Dashboard')
                .setStyle(ButtonStyle.Link)
                .setURL(dashboardUrl),
            new ButtonBuilder()
                .setLabel('âš™ï¸ à¸•à¸±à¹‰à¸‡à¸„à¹ˆà¸²à¸šà¸™à¹€à¸§à¹‡à¸š')
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
        return 'à¹„à¸¡à¹ˆà¸žà¸šà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹€à¸‹à¸´à¸£à¹Œà¸Ÿà¹€à¸§à¸­à¸£à¹Œ à¸à¸£à¸¸à¸“à¸²à¸¥à¸­à¸‡à¹ƒà¸Šà¹‰ /setup à¹ƒà¸«à¸¡à¹ˆà¸­à¸µà¸à¸„à¸£à¸±à¹‰à¸‡';
    }

    if (selectedRoleId === guild.id) {
        return 'à¸«à¹‰à¸²à¸¡à¹ƒà¸Šà¹‰ @everyone à¹€à¸›à¹‡à¸™à¸¢à¸¨à¸‚à¸­à¸‡à¸£à¸°à¸šà¸šà¹à¸à¹Šà¸‡ à¹€à¸žà¸£à¸²à¸°à¸ˆà¸°à¸—à¸³à¹ƒà¸«à¹‰à¸—à¸¸à¸à¸„à¸™à¹„à¸”à¹‰à¸£à¸±à¸šà¸ªà¸´à¸—à¸˜à¸´à¹Œà¸—à¸±à¸™à¸—à¸µ';
    }

    const role = guild.roles.cache.get(selectedRoleId);
    if (!role) {
        return 'à¹„à¸¡à¹ˆà¸žà¸šà¸¢à¸¨à¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸ à¸à¸£à¸¸à¸“à¸²à¹€à¸¥à¸·à¸­à¸à¸¢à¸¨à¹ƒà¸«à¸¡à¹ˆà¸­à¸µà¸à¸„à¸£à¸±à¹‰à¸‡';
    }

    if (role.managed) {
        return 'à¸¢à¸¨à¸™à¸µà¹‰à¹€à¸›à¹‡à¸™à¸¢à¸¨à¸—à¸µà¹ˆ Discord à¸«à¸£à¸·à¸­ integration à¸ˆà¸±à¸”à¸à¸²à¸£à¹ƒà¸«à¹‰à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´ à¸à¸£à¸¸à¸“à¸²à¹€à¸¥à¸·à¸­à¸à¸¢à¸¨à¸›à¸à¸•à¸´à¸‚à¸­à¸‡à¹€à¸‹à¸´à¸£à¹Œà¸Ÿà¹€à¸§à¸­à¸£à¹Œ';
    }

    if (role.editable === false) {
        return 'à¸šà¸­à¸—à¸¢à¸±à¸‡à¸ˆà¸±à¸”à¸à¸²à¸£à¸¢à¸¨à¸™à¸µà¹‰à¹„à¸¡à¹ˆà¹„à¸”à¹‰ à¹€à¸žà¸£à¸²à¸°à¸¢à¸¨à¸™à¸µà¹‰à¸­à¸¢à¸¹à¹ˆà¸ªà¸¹à¸‡à¸à¸§à¹ˆà¸²à¸šà¸­à¸—à¸«à¸£à¸·à¸­à¸šà¸­à¸—à¹„à¸¡à¹ˆà¸¡à¸µà¸ªà¸´à¸—à¸˜à¸´à¹Œ Manage Roles à¸à¸£à¸¸à¸“à¸²à¸¢à¹‰à¸²à¸¢à¸¢à¸¨à¸šà¸­à¸—à¹ƒà¸«à¹‰à¸­à¸¢à¸¹à¹ˆà¸ªà¸¹à¸‡à¸à¸§à¹ˆà¸²à¸¢à¸¨à¸™à¸µà¹‰à¸à¹ˆà¸­à¸™';
    }

    if (permission !== 'OWNER') {
        return null;
    }

    if (!interactionMemberHasRole(interaction, selectedRoleId)) {
        return 'à¸¢à¸¨ Owner à¸•à¹‰à¸­à¸‡à¹€à¸›à¹‡à¸™à¸¢à¸¨à¸—à¸µà¹ˆà¸œà¸¹à¹‰à¸•à¸±à¹‰à¸‡à¸„à¹ˆà¸²à¸–à¸·à¸­à¸­à¸¢à¸¹à¹ˆ à¹€à¸žà¸·à¹ˆà¸­à¸¢à¸·à¸™à¸¢à¸±à¸™à¸§à¹ˆà¸²à¹€à¸ˆà¹‰à¸²à¸‚à¸­à¸‡à¸£à¸°à¸šà¸šà¸„à¸·à¸­à¸„à¸™à¹€à¸”à¸µà¸¢à¸§à¸à¸±à¸šà¸„à¸™à¸—à¸µà¹ˆà¸à¸³à¸¥à¸±à¸‡ setup';
    }

    const memberCount = await getVerifiedRoleMemberCount(role);
    if (memberCount === null) {
        return 'à¸¢à¸±à¸‡à¸•à¸£à¸§à¸ˆà¸ˆà¸³à¸™à¸§à¸™à¸„à¸™à¹ƒà¸™à¸¢à¸¨ Owner à¹„à¸¡à¹ˆà¹„à¸”à¹‰ à¸à¸£à¸¸à¸“à¸²à¹ƒà¸«à¹‰à¸ªà¸´à¸—à¸˜à¸´à¹Œ Server Members Intent/à¸ªà¸´à¸—à¸˜à¸´à¹Œà¸šà¸­à¸—à¸„à¸£à¸š à¸«à¸£à¸·à¸­à¹ƒà¸Šà¹‰à¸•à¸´à¸”à¸•à¸±à¹‰à¸‡à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´à¹à¸—à¸™';
    }

    if (memberCount !== 1) {
        return `à¸¢à¸¨ Owner à¸•à¹‰à¸­à¸‡à¸¡à¸µà¸ªà¸¡à¸²à¸Šà¸´à¸à¹€à¸žà¸µà¸¢à¸‡ 1 à¸„à¸™à¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™ à¸•à¸­à¸™à¸™à¸µà¹‰à¸¢à¸¨à¸™à¸µà¹‰à¸¡à¸µ ${memberCount} à¸„à¸™ à¸à¸£à¸¸à¸“à¸²à¹€à¸¥à¸·à¸­à¸à¸¢à¸¨à¹€à¸‰à¸žà¸²à¸°à¸«à¸±à¸§à¸«à¸™à¹‰à¸²à¹à¸à¹Šà¸‡`;
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
        'OWNER': 'ðŸ‘‘ à¸«à¸±à¸§à¸«à¸™à¹‰à¸²à¹à¸à¹Šà¸‡ (Owner)',
        'ADMIN': 'ðŸ›¡ï¸ à¸£à¸­à¸‡à¸«à¸±à¸§à¸«à¸™à¹‰à¸² (Admin)',
        'TREASURER': 'ðŸ’° à¹€à¸«à¸£à¸±à¸à¸à¸´à¸ (Treasurer)',
        'ATTENDANCE_OFFICER': 'Attendance Officer',
        'MEMBER': 'ðŸ‘¤ à¸ªà¸¡à¸²à¸Šà¸´à¸ (Member)'
    };

    const embed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle(`ðŸŽ­ à¹€à¸¥à¸·à¸­à¸à¸¢à¸¨: ${labels[permission]}`)
        .setDescription(`à¸à¸£à¸¸à¸“à¸²à¹€à¸¥à¸·à¸­à¸ Role à¹ƒà¸™ Discord à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸à¸²à¸£à¸¡à¸­à¸šà¸«à¸¡à¸²à¸¢à¹ƒà¸«à¹‰à¹€à¸›à¹‡à¸™ **${labels[permission]}**`);

    if (warning) {
        embed.addFields({ name: 'âš ï¸ à¸¢à¸±à¸‡à¸šà¸±à¸™à¸—à¸¶à¸à¹„à¸¡à¹ˆà¹„à¸”à¹‰', value: warning });
    }

    // Use RoleSelectMenuBuilder for better UX
    const select = new RoleSelectMenuBuilder()
        .setCustomId(`setup_select_${permission}_${gangId}`)
        .setPlaceholder(`à¹€à¸¥à¸·à¸­à¸à¸¢à¸¨à¸ªà¸³à¸«à¸£à¸±à¸š ${permission}`)
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
            await interaction.followUp({ content: 'âš ï¸ à¸šà¸­à¸—à¹„à¸¡à¹ˆà¸¡à¸µà¸ªà¸´à¸—à¸˜à¸´à¹Œ Manage Roles à¸«à¸£à¸·à¸­ Manage Channels', ephemeral: true });
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
    let infoCategory = guild.channels.cache.find(c => c.name === 'ðŸ“Œ à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸—à¸±à¹ˆà¸§à¹„à¸›' && c.type === ChannelType.GuildCategory) as CategoryChannel;
    if (!infoCategory) infoCategory = await guild.channels.create({ name: 'ðŸ“Œ à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸—à¸±à¹ˆà¸§à¹„à¸›', type: ChannelType.GuildCategory });

    let attendanceCategory = guild.channels.cache.find(c => c.name === 'â° à¸£à¸°à¸šà¸šà¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­' && c.type === ChannelType.GuildCategory) as CategoryChannel;
    if (!attendanceCategory) attendanceCategory = await guild.channels.create({ name: 'â° à¸£à¸°à¸šà¸šà¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­', type: ChannelType.GuildCategory });

    let financeCategory = guild.channels.cache.find(c => c.name === 'ðŸ’° à¸£à¸°à¸šà¸šà¸à¸²à¸£à¹€à¸‡à¸´à¸™' && c.type === ChannelType.GuildCategory) as CategoryChannel;
    if (!financeCategory) financeCategory = await guild.channels.create({ name: 'ðŸ’° à¸£à¸°à¸šà¸šà¸à¸²à¸£à¹€à¸‡à¸´à¸™', type: ChannelType.GuildCategory });

    let adminCategory = guild.channels.cache.find(c => c.name === 'ðŸ”’ à¸«à¸±à¸§à¹à¸à¹Šà¸‡' && c.type === ChannelType.GuildCategory) as CategoryChannel;
    if (!adminCategory) {
        try {
            adminCategory = await guild.channels.create({
                name: 'ðŸ”’ à¸«à¸±à¸§à¹à¸à¹Šà¸‡',
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

    // === ðŸ“Œ à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸—à¸±à¹ˆà¸§à¹„à¸› ===
    // Verify channel: visible to everyone, only non-verified can see it
    const verifyPerms = [
        { id: guild.roles.everyone.id, allow: ['ViewChannel'], deny: ['SendMessages'] },
        { id: verifiedRole!.id, deny: ['ViewChannel'] },
        { id: createdRoles['MEMBER'].id, deny: ['ViewChannel'] },
        { id: createdRoles['ADMIN'].id, deny: ['ViewChannel'] },
        { id: createdRoles['TREASURER'].id, deny: ['ViewChannel'] },
        { id: createdRoles['OWNER'].id, deny: ['ViewChannel'] },
    ];
    const verifyChannel = await ensureChannel('à¸¢à¸·à¸™à¸¢à¸±à¸™à¸•à¸±à¸§à¸•à¸™', infoCategory.id, { permissionOverwrites: verifyPerms });
    const registerChannel = await ensureChannel('à¸¥à¸‡à¸—à¸°à¹€à¸šà¸µà¸¢à¸™', infoCategory.id, { permissionOverwrites: registerPerms });
    const announcementChannel = await ensureChannel('à¸›à¸£à¸°à¸à¸²à¸¨', infoCategory.id, { permissionOverwrites: readOnlyEveryone }); // Visible to all
    await ensureChannel('à¸à¸Žà¹à¸à¹Šà¸‡', infoCategory.id, { permissionOverwrites: readOnlyEveryone }); // Visible to all
    const dashboardChannel = await ensureChannel('à¹à¸”à¸Šà¸šà¸­à¸£à¹Œà¸”', infoCategory.id, { permissionOverwrites: membersOnlyReadOnly }); // Read-only for members

    // === â° à¸£à¸°à¸šà¸šà¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­ (Members Only) ===
    const attendanceChannel = await ensureChannel('à¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­', attendanceCategory.id, { permissionOverwrites: membersOnlyReadOnly });
    await ensureChannel('à¸ªà¸£à¸¸à¸›à¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­', attendanceCategory.id, { permissionOverwrites: membersOnlyReadOnly });
    const leaveChannel = await ensureChannel('à¹à¸ˆà¹‰à¸‡à¸¥à¸²', attendanceCategory.id, { permissionOverwrites: membersOnlyWritable });

    // === ðŸ’° à¸£à¸°à¸šà¸šà¸à¸²à¸£à¹€à¸‡à¸´à¸™ (Members Only) ===
    const financeChannel = await ensureChannel('à¹à¸ˆà¹‰à¸‡à¸˜à¸¸à¸£à¸à¸£à¸£à¸¡', financeCategory.id, { permissionOverwrites: membersOnlyWritable });
    await ensureChannel('à¸¢à¸­à¸”à¸à¸­à¸‡à¸à¸¥à¸²à¸‡', financeCategory.id, { permissionOverwrites: membersOnlyReadOnly });

    // === ï¿½ à¸«à¹‰à¸­à¸‡à¹à¸Šà¸— (Chat Channels) ===
    // General chat: visible to Verified + all gang roles
    const generalChatPerms = [
        { id: guild.roles.everyone.id, deny: ['ViewChannel'] },
        { id: verifiedRole!.id, allow: ['ViewChannel', 'SendMessages'] },
        { id: createdRoles['MEMBER'].id, allow: ['ViewChannel', 'SendMessages'] },
        { id: createdRoles['ADMIN'].id, allow: ['ViewChannel', 'SendMessages'] },
        { id: createdRoles['TREASURER'].id, allow: ['ViewChannel', 'SendMessages'] },
        { id: createdRoles['OWNER'].id, allow: ['ViewChannel', 'SendMessages'] },
    ];

    let chatCategory = guild.channels.cache.find(c => c.name === 'ï¿½ à¸«à¹‰à¸­à¸‡à¹à¸Šà¸—' && c.type === ChannelType.GuildCategory) as CategoryChannel;
    if (!chatCategory) chatCategory = await guild.channels.create({ name: 'ï¿½ à¸«à¹‰à¸­à¸‡à¹à¸Šà¸—', type: ChannelType.GuildCategory });

    await ensureChannel('à¸žà¸¹à¸”à¸„à¸¸à¸¢à¸—à¸±à¹ˆà¸§à¹„à¸›', chatCategory.id, { type: ChannelType.GuildText, permissionOverwrites: generalChatPerms });
    await ensureChannel('à¸žà¸¹à¸”à¸„à¸¸à¸¢à¹à¸à¹Šà¸‡', chatCategory.id, { type: ChannelType.GuildText, permissionOverwrites: membersOnlyWritable });

    // === ðŸ”Š Voice Channels (Members Only) ===
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

    let voiceCategory = guild.channels.cache.find(c => c.name === 'ðŸ”Š à¸«à¹‰à¸­à¸‡à¸žà¸¹à¸”à¸„à¸¸à¸¢' && c.type === ChannelType.GuildCategory) as CategoryChannel;
    if (!voiceCategory) voiceCategory = await guild.channels.create({ name: 'ðŸ”Š à¸«à¹‰à¸­à¸‡à¸žà¸¹à¸”à¸„à¸¸à¸¢', type: ChannelType.GuildCategory });

    await ensureChannel('à¸žà¸¹à¸”à¸„à¸¸à¸¢', voiceCategory.id, { type: ChannelType.GuildVoice, permissionOverwrites: voiceGeneralPerms });
    await ensureChannel('à¸‡à¸±à¸”à¸£à¹‰à¸²à¸™-1', voiceCategory.id, { type: ChannelType.GuildVoice, permissionOverwrites: voiceMembersOnly });
    await ensureChannel('à¸‡à¸±à¸”à¸£à¹‰à¸²à¸™-2', voiceCategory.id, { type: ChannelType.GuildVoice, permissionOverwrites: voiceMembersOnly });
    await ensureChannel('à¸‡à¸±à¸”à¸£à¹‰à¸²à¸™-3', voiceCategory.id, { type: ChannelType.GuildVoice, permissionOverwrites: voiceMembersOnly });
    await ensureChannel('à¸‡à¸±à¸”à¸£à¹‰à¸²à¸™-4', voiceCategory.id, { type: ChannelType.GuildVoice, permissionOverwrites: voiceMembersOnly });
    await ensureChannel('à¸‡à¸±à¸”à¸£à¹‰à¸²à¸™-5', voiceCategory.id, { type: ChannelType.GuildVoice, permissionOverwrites: voiceMembersOnly });
    await ensureChannel('à¸žà¸±à¸à¸œà¹ˆà¸­à¸™à¸”à¸¹à¸«à¸™à¸±à¸‡', voiceCategory.id, { type: ChannelType.GuildVoice, permissionOverwrites: voiceMembersOnly });
    await ensureChannel('à¹€à¸«à¸¡à¹ˆà¸­ (AFK)', voiceCategory.id, { type: ChannelType.GuildVoice, permissionOverwrites: voiceMembersOnly });

    // === ðŸ”’ à¸«à¸±à¸§à¹à¸à¹Šà¸‡ (Admin Only - already set at category level) ===
    const logChannel = await ensureChannel('log-à¸£à¸°à¸šà¸š', adminCategory.id);
    const requestsChannel = await ensureChannel('ðŸ“‹-à¸„à¸³à¸‚à¸­à¹à¸¥à¸°à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´', adminCategory.id); // New Request Channel for both Join & Leave
    await ensureChannel('à¸«à¹‰à¸­à¸‡à¸›à¸£à¸°à¸Šà¸¸à¸¡', adminCategory.id, { type: ChannelType.GuildVoice });
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
        .setTitle('ðŸ“ à¹à¸ˆà¹‰à¸‡à¸¥à¸² / à¹€à¸‚à¹‰à¸²à¸Šà¹‰à¸²')
        .setDescription('à¹ƒà¸Šà¹‰à¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡à¸™à¸µà¹‰à¹€à¸¡à¸·à¹ˆà¸­à¸„à¸¸à¸“à¸¥à¸²à¸‡à¸²à¸™ à¹€à¸‚à¹‰à¸²à¸Šà¹‰à¸² à¸«à¸£à¸·à¸­à¹„à¸¡à¹ˆà¸ªà¸°à¸”à¸§à¸à¹€à¸‚à¹‰à¸²à¸£à¹ˆà¸§à¸¡à¸•à¸²à¸¡à¹€à¸§à¸¥à¸²\nà¸à¸”à¸›à¸¸à¹ˆà¸¡à¹ƒà¸«à¹‰à¸•à¸£à¸‡à¸à¸±à¸šà¸ªà¸–à¸²à¸™à¸à¸²à¸£à¸“à¹Œ à¹à¸¥à¹‰à¸§à¸£à¸°à¸šà¸šà¸ˆà¸°à¸ªà¹ˆà¸‡à¸„à¸³à¸‚à¸­à¹„à¸›à¹ƒà¸«à¹‰à¸«à¸±à¸§à¸«à¸™à¹‰à¸²/à¹à¸­à¸”à¸¡à¸´à¸™à¸•à¸£à¸§à¸ˆà¸—à¸±à¸™à¸—à¸µ')
        .addFields(
            { name: 'à¹€à¸¥à¸·à¸­à¸à¹à¸šà¸šà¹„à¸«à¸™à¸”à¸µ', value: 'â€¢ **à¹€à¸‚à¹‰à¸²à¸Šà¹‰à¸²** â€” à¸§à¸±à¸™à¸™à¸µà¹‰à¸¢à¸±à¸‡à¸¡à¸² à¹à¸•à¹ˆà¸ˆà¸°à¸¡à¸²à¸Šà¹‰à¸²à¸à¸§à¹ˆà¸²à¸›à¸à¸•à¸´\nâ€¢ **à¸¥à¸² 1 à¸§à¸±à¸™** â€” à¸¥à¸²à¸«à¸¢à¸¸à¸” 1 à¸§à¸±à¸™à¹€à¸•à¹‡à¸¡\nâ€¢ **à¸¥à¸²à¸«à¸¥à¸²à¸¢à¸§à¸±à¸™** â€” à¹ƒà¸Šà¹‰à¹€à¸¡à¸·à¹ˆà¸­à¸«à¸¢à¸¸à¸”à¸¡à¸²à¸à¸à¸§à¹ˆà¸² 1 à¸§à¸±à¸™' },
            { name: 'à¸«à¸¥à¸±à¸‡à¸ªà¹ˆà¸‡à¸„à¸³à¸‚à¸­à¹à¸¥à¹‰à¸§', value: 'à¸«à¸±à¸§à¸«à¸™à¹‰à¸²/à¹à¸­à¸”à¸¡à¸´à¸™à¸ˆà¸°à¹€à¸«à¹‡à¸™à¸£à¸²à¸¢à¸à¸²à¸£à¹ƒà¸™à¸«à¹‰à¸­à¸‡à¸„à¸³à¸‚à¸­à¹à¸¥à¸°à¸šà¸™à¸«à¸™à¹‰à¸²à¹€à¸§à¹‡à¸š à¹€à¸žà¸·à¹ˆà¸­à¸•à¸£à¸§à¸ˆà¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¸«à¸£à¸·à¸­à¸›à¸à¸´à¹€à¸ªà¸˜' }
        )
        .setFooter({ text: 'Gang Management System' });

    const leaveRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('request_leave_late')
                .setLabel('ðŸŸ¡ à¹€à¸‚à¹‰à¸²à¸Šà¹‰à¸²')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('request_leave_1day')
                .setLabel('ðŸŸ¢ à¸¥à¸² 1 à¸§à¸±à¸™')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('request_leave_multi')
                .setLabel('ðŸ”´ à¸¥à¸²à¸«à¸¥à¸²à¸¢à¸§à¸±à¸™')
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
        .setTitle('ðŸ’° à¸¨à¸¹à¸™à¸¢à¹Œà¸à¸²à¸£à¹€à¸‡à¸´à¸™à¸‚à¸­à¸‡à¸ªà¸¡à¸²à¸Šà¸´à¸')
        .setDescription(
            `**ðŸ¦ à¸¢à¸­à¸”à¸à¸­à¸‡à¸à¸¥à¸²à¸‡: à¸¿${gangBalance.toLocaleString()}**\n\n` +
            `à¹ƒà¸Šà¹‰à¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡à¸™à¸µà¹‰à¹€à¸›à¹‡à¸™à¸ˆà¸¸à¸”à¸«à¸¥à¸±à¸à¸ªà¸³à¸«à¸£à¸±à¸šà¸ªà¹ˆà¸‡à¸„à¸³à¸‚à¸­à¸à¸²à¸£à¹€à¸‡à¸´à¸™à¹à¸¥à¸°à¸”à¸¹à¸ªà¸–à¸²à¸™à¸°à¸‚à¸­à¸‡à¸•à¸±à¸§à¹€à¸­à¸‡ à¹‚à¸”à¸¢à¹à¸¢à¸à¸«à¸™à¸µà¹‰à¸¢à¸·à¸¡à¸­à¸­à¸à¸ˆà¸²à¸à¸¢à¸­à¸”à¸„à¹‰à¸²à¸‡à¹€à¸à¹‡à¸šà¹€à¸‡à¸´à¸™à¹à¸à¹Šà¸‡`
        )
        .addFields(
            { name: 'à¸—à¸³à¸­à¸°à¹„à¸£à¹„à¸”à¹‰à¸šà¹‰à¸²à¸‡', value: 'â€¢ **à¸¢à¸·à¸¡à¹€à¸‡à¸´à¸™** â€” à¸‚à¸­à¹€à¸šà¸´à¸/à¸¢à¸·à¸¡à¸ˆà¸²à¸à¸à¸­à¸‡à¸à¸¥à¸²à¸‡\nâ€¢ **à¸Šà¸³à¸£à¸°à¸«à¸™à¸µà¹‰à¸¢à¸·à¸¡** â€” à¸Šà¸³à¸£à¸°à¹€à¸‰à¸žà¸²à¸°à¸«à¸™à¸µà¹‰à¸¢à¸·à¸¡à¹€à¸‚à¹‰à¸²à¸à¸­à¸‡à¸à¸¥à¸²à¸‡\nâ€¢ **à¹€à¸à¹‡à¸šà¹€à¸‡à¸´à¸™à¹à¸à¹Šà¸‡/à¹€à¸„à¸£à¸”à¸´à¸•** â€” à¸Šà¸³à¸£à¸°à¸„à¹ˆà¸²à¹€à¸à¹‡à¸šà¹€à¸‡à¸´à¸™à¹à¸à¹Šà¸‡à¸—à¸µà¹ˆà¸„à¹‰à¸²à¸‡à¸­à¸¢à¸¹à¹ˆ à¸«à¸£à¸·à¸­à¸à¸²à¸à¹€à¸„à¸£à¸”à¸´à¸•/à¸ªà¸³à¸£à¸­à¸‡à¸ˆà¹ˆà¸²à¸¢à¹à¸—à¸™à¹à¸à¹Šà¸‡\nâ€¢ **à¸ªà¸–à¸²à¸™à¸°à¸à¸²à¸£à¹€à¸‡à¸´à¸™** â€” à¸”à¸¹à¸«à¸™à¸µà¹‰à¸¢à¸·à¸¡ à¸„à¹‰à¸²à¸‡à¹€à¸à¹‡à¸šà¹€à¸‡à¸´à¸™ à¹à¸¥à¸°à¹€à¸„à¸£à¸”à¸´à¸•à¸—à¸µà¹ˆà¹ƒà¸Šà¹‰à¹„à¸”à¹‰' },
            { name: 'à¸«à¸¡à¸²à¸¢à¹€à¸«à¸•à¸¸à¸ªà¸³à¸„à¸±à¸', value: 'à¸„à¸³à¸‚à¸­à¸—à¸µà¹ˆà¸ªà¹ˆà¸‡à¸ˆà¸²à¸à¸«à¹‰à¸­à¸‡à¸™à¸µà¹‰à¸­à¸²à¸ˆà¸•à¹‰à¸­à¸‡à¸£à¸­à¸«à¸±à¸§à¸«à¸™à¹‰à¸²/à¹€à¸«à¸£à¸±à¸à¸à¸´à¸à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¸à¹ˆà¸­à¸™à¸¢à¸­à¸”à¸ˆà¸°à¸–à¸¹à¸à¸šà¸±à¸™à¸—à¸¶à¸à¸ˆà¸£à¸´à¸‡' }
        )
        .setColor('#FFD700')
        .setFooter({ text: `${gangData?.name || 'Gang'} â€¢ Member Finance` });

    const financeRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
          new ButtonBuilder()
              .setCustomId('finance_request_loan')
              .setLabel('ðŸ’¸ à¸¢à¸·à¸¡à¹€à¸‡à¸´à¸™')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(!hasFinance),
          new ButtonBuilder()
              .setCustomId('finance_request_repay')
              .setLabel('ðŸ¦ à¸Šà¸³à¸£à¸°à¸«à¸™à¸µà¹‰à¸¢à¸·à¸¡')
              .setStyle(ButtonStyle.Success)
              .setDisabled(!hasFinance),
          new ButtonBuilder()
              .setCustomId('finance_request_deposit')
              .setLabel('ðŸ“¥ à¹€à¸à¹‡à¸šà¹€à¸‡à¸´à¸™à¹à¸à¹Šà¸‡/à¹€à¸„à¸£à¸”à¸´à¸•')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(!hasFinance),
          new ButtonBuilder()
              .setCustomId('finance_balance')
              .setLabel('ðŸ’³ à¸ªà¸–à¸²à¸™à¸°à¸à¸²à¸£à¹€à¸‡à¸´à¸™')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(!hasFinance),
      );

    if (financeChannel) {
        const messages = await (financeChannel as TextChannel).messages.fetch({ limit: 5 });
        const existingMsg = messages.find(m => m.author.id === interaction.client.user.id && m.embeds[0]?.title?.includes('à¸£à¸°à¸šà¸šà¸à¸²à¸£à¹€à¸‡à¸´à¸™'));

        if (existingMsg) {
            await existingMsg.delete().catch(() => { });
        }

        await (financeChannel as TextChannel).send({ embeds: [financeEmbed], components: [financeRow] });
    }

    // === Send Verify Button ===
    if (verifyChannel) {
        const verifyEmbed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('âœ… à¸¢à¸·à¸™à¸¢à¸±à¸™à¸•à¸±à¸§à¸•à¸™à¸à¹ˆà¸­à¸™à¹ƒà¸Šà¹‰à¸‡à¸²à¸™')
            .setDescription(
                'à¸ªà¸¡à¸²à¸Šà¸´à¸à¹ƒà¸«à¸¡à¹ˆà¹à¸¥à¸°à¸œà¸¹à¹‰à¹€à¸‚à¹‰à¸²à¸¡à¸²à¹ƒà¸«à¸¡à¹ˆà¹€à¸£à¸´à¹ˆà¸¡à¸ˆà¸²à¸à¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡à¸™à¸µà¹‰à¸à¹ˆà¸­à¸™\n\n' +
                'à¸«à¸¥à¸±à¸‡à¸¢à¸·à¸™à¸¢à¸±à¸™à¹à¸¥à¹‰à¸§à¸„à¸¸à¸“à¸ˆà¸°à¹€à¸«à¹‡à¸™à¸«à¹‰à¸­à¸‡à¸žà¸¹à¸”à¸„à¸¸à¸¢à¸žà¸·à¹‰à¸™à¸à¸²à¸™à¸‚à¸­à¸‡à¹€à¸‹à¸´à¸£à¹Œà¸Ÿà¹€à¸§à¸­à¸£à¹Œ\n' +
                'à¸–à¹‰à¸²à¸•à¹‰à¸­à¸‡à¸à¸²à¸£à¹€à¸‚à¹‰à¸²à¸£à¹ˆà¸§à¸¡à¹à¸à¹Šà¸‡à¸•à¹ˆà¸­ à¹ƒà¸«à¹‰à¹„à¸›à¸à¸”à¹ƒà¸™à¸«à¹‰à¸­à¸‡ **à¸¥à¸‡à¸—à¸°à¹€à¸šà¸µà¸¢à¸™** à¹€à¸žà¸´à¹ˆà¸¡à¹€à¸•à¸´à¸¡'
            )
            .addFields(
                { name: 'à¸¥à¸³à¸”à¸±à¸šà¸—à¸µà¹ˆà¹à¸™à¸°à¸™à¸³', value: '1. à¸à¸”à¸¢à¸·à¸™à¸¢à¸±à¸™à¸•à¸±à¸§à¸•à¸™\n2. à¸­à¹ˆà¸²à¸™à¸à¸Ž/à¸›à¸£à¸°à¸à¸²à¸¨\n3. à¹„à¸›à¸—à¸µà¹ˆà¸«à¹‰à¸­à¸‡à¸¥à¸‡à¸—à¸°à¹€à¸šà¸µà¸¢à¸™à¹€à¸žà¸·à¹ˆà¸­à¸ªà¸¡à¸±à¸„à¸£à¹€à¸‚à¹‰à¸²à¹à¸à¹Šà¸‡' }
            )
            .setFooter({ text: 'Gang Management System' });

        const verifyRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('verify_member')
                    .setLabel('âœ… à¹€à¸£à¸´à¹ˆà¸¡à¸¢à¸·à¸™à¸¢à¸±à¸™à¸•à¸±à¸§à¸•à¸™')
                    .setStyle(ButtonStyle.Success)
            );

        // Delete old verify messages from bot
        const msgs = await (verifyChannel as TextChannel).messages.fetch({ limit: 5 });
        const oldVerify = msgs.find(m => m.author.id === interaction.client.user.id && m.embeds[0]?.title?.includes('à¸¢à¸·à¸™à¸¢à¸±à¸™à¸•à¸±à¸§à¸•à¸™'));
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
        .setTitle('ðŸ“ à¸ªà¸¡à¸±à¸„à¸£à¹€à¸‚à¹‰à¸²à¸£à¹ˆà¸§à¸¡à¹à¸à¹Šà¸‡')
        .setDescription('à¸ªà¸¡à¸²à¸Šà¸´à¸à¹ƒà¸«à¸¡à¹ˆà¹€à¸£à¸´à¹ˆà¸¡à¸—à¸µà¹ˆà¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡à¸™à¸µà¹‰à¹„à¸”à¹‰à¹€à¸¥à¸¢\nà¸à¸”à¸›à¸¸à¹ˆà¸¡à¸”à¹‰à¸²à¸™à¸¥à¹ˆà¸²à¸‡à¹€à¸žà¸·à¹ˆà¸­à¸ªà¹ˆà¸‡à¸„à¸³à¸‚à¸­à¹€à¸‚à¹‰à¸²à¸£à¸°à¸šà¸š')
        .addFields(
            { name: 'à¸—à¸³à¸­à¸¢à¹ˆà¸²à¸‡à¹„à¸£', value: '1. à¸à¸”à¸›à¸¸à¹ˆà¸¡ "à¸ªà¸¡à¸±à¸„à¸£à¸ªà¸¡à¸²à¸Šà¸´à¸"\n2. à¸à¸£à¸­à¸à¸Šà¸·à¹ˆà¸­à¹ƒà¸™à¹€à¸à¸¡à¸‚à¸­à¸‡à¸„à¸¸à¸“\n3. à¸£à¸­à¸«à¸±à¸§à¸«à¸™à¹‰à¸²/à¹à¸­à¸”à¸¡à¸´à¸™à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¹à¸¥à¸°à¸£à¸±à¸šà¸¢à¸¨' },
            { name: 'à¸«à¸¥à¸±à¸‡à¸ˆà¸²à¸à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¹à¸¥à¹‰à¸§', value: 'à¸„à¸¸à¸“à¸ˆà¸°à¹€à¸£à¸´à¹ˆà¸¡à¹ƒà¸Šà¹‰à¸‡à¸²à¸™à¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­, à¹à¸ˆà¹‰à¸‡à¸¥à¸², à¸à¸²à¸£à¹€à¸‡à¸´à¸™ à¹à¸¥à¸° Dashboard à¹„à¸”à¹‰à¸—à¸±à¸™à¸—à¸µ' }
        );

    const button = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(new ButtonBuilder().setCustomId('register').setLabel('ðŸ“ à¸ªà¸¡à¸±à¸„à¸£à¸ªà¸¡à¸²à¸Šà¸´à¸').setStyle(ButtonStyle.Primary));

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
        .setTitle('ðŸŽ›ï¸ à¸¨à¸¹à¸™à¸¢à¹Œà¸„à¸§à¸šà¸„à¸¸à¸¡à¸«à¸±à¸§à¸«à¸™à¹‰à¸²à¹à¸à¹Šà¸‡')
        .setDescription('à¹ƒà¸Šà¹‰à¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡à¸™à¸µà¹‰à¹€à¸›à¹‡à¸™à¸ˆà¸¸à¸”à¸£à¸§à¸¡à¸‡à¸²à¸™à¸«à¸¥à¸±à¸à¸‚à¸­à¸‡à¸«à¸±à¸§à¸«à¸™à¹‰à¸²à¹à¸à¹Šà¸‡à¹à¸¥à¸°à¹à¸­à¸”à¸¡à¸´à¸™\nà¸—à¸±à¹‰à¸‡à¸‡à¸²à¸™à¸”à¹ˆà¸§à¸™à¹ƒà¸™ Discord à¹à¸¥à¸°à¸‡à¸²à¸™à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¸šà¸™à¸«à¸™à¹‰à¸²à¹€à¸§à¹‡à¸š')
        .addFields(
            { name: 'à¸—à¸³à¸­à¸°à¹„à¸£à¹„à¸”à¹‰à¸—à¸±à¸™à¸—à¸µà¸ˆà¸²à¸à¸•à¸£à¸‡à¸™à¸µà¹‰', value: 'â€¢ à¹€à¸›à¸´à¸” Dashboard à¹€à¸žà¸·à¹ˆà¸­à¸ˆà¸±à¸”à¸à¸²à¸£à¸ªà¸¡à¸²à¸Šà¸´à¸à¹à¸¥à¸°à¸•à¸±à¹‰à¸‡à¸„à¹ˆà¸²\nâ€¢ à¸šà¸±à¸™à¸—à¸¶à¸à¸£à¸²à¸¢à¸£à¸±à¸š/à¸£à¸²à¸¢à¸ˆà¹ˆà¸²à¸¢à¹à¸šà¸šà¸”à¹ˆà¸§à¸™\nâ€¢ à¸‹à¹ˆà¸­à¸¡à¸«à¹‰à¸­à¸‡/à¸¢à¸¨à¹€à¸¡à¸·à¹ˆà¸­à¸¡à¸µà¸„à¸™à¸¥à¸šà¸«à¸£à¸·à¸­à¸¢à¹‰à¸²à¸¢' },
            { name: 'à¸–à¹‰à¸²à¸£à¸°à¸šà¸šà¸”à¸¹à¹„à¸¡à¹ˆà¸„à¸£à¸š', value: 'à¸à¸”à¸›à¸¸à¹ˆà¸¡à¸‹à¹ˆà¸­à¸¡à¹à¸‹à¸¡à¸«à¹‰à¸­à¸‡/à¸¢à¸¨à¹„à¸”à¹‰à¹€à¸¥à¸¢ à¹à¸¥à¹‰à¸§à¸„à¹ˆà¸­à¸¢à¸•à¸£à¸§à¸ˆà¸‹à¹‰à¸³à¸šà¸™ Dashboard' }
        )
        .setFooter({ text: 'à¸–à¹‰à¸²à¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡à¸™à¸µà¹‰à¸«à¸²à¸¢ à¹ƒà¸«à¹‰à¹ƒà¸Šà¹‰ /setup à¹€à¸žà¸·à¹ˆà¸­à¸ªà¸£à¹‰à¸²à¸‡à¹à¸œà¸‡à¹ƒà¸«à¸¡à¹ˆ' });

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setLabel('ðŸŒ Dashboard').setStyle(ButtonStyle.Link).setURL(dashboardUrl),
        new ButtonBuilder().setLabel('âš™ï¸ à¸•à¸±à¹‰à¸‡à¸„à¹ˆà¸²à¹€à¸§à¹‡à¸š').setStyle(ButtonStyle.Link).setURL(settingsUrl),
        new ButtonBuilder().setLabel('ðŸ’° à¸à¸²à¸£à¹€à¸‡à¸´à¸™à¸šà¸™à¹€à¸§à¹‡à¸š').setStyle(ButtonStyle.Link).setURL(financeUrl).setDisabled(!hasFinance)
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`setup_mode_auto_${gangId}`).setLabel('ðŸ”„ à¸‹à¹ˆà¸­à¸¡à¹à¸‹à¸¡à¸«à¹‰à¸­à¸‡/à¸¢à¸¨').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('admin_income').setLabel('ðŸ’° à¸£à¸²à¸¢à¸£à¸±à¸šà¸”à¹ˆà¸§à¸™').setStyle(ButtonStyle.Success).setDisabled(!hasFinance),
        new ButtonBuilder().setCustomId('admin_expense').setLabel('ðŸ’¸ à¸£à¸²à¸¢à¸ˆà¹ˆà¸²à¸¢à¸”à¹ˆà¸§à¸™').setStyle(ButtonStyle.Danger).setDisabled(!hasFinance)
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
    const existingPanel = recentMessages.find((message) => message.author.id === interaction.client.user.id && message.embeds[0]?.title?.includes('à¹€à¸§à¹‡à¸šà¹à¸”à¸Šà¸šà¸­à¸£à¹Œà¸”à¸ªà¸¡à¸²à¸Šà¸´à¸'));
    if (existingPanel) {
        await existingPanel.delete().catch(() => { });
    }

    const embed = new EmbedBuilder()
        .setColor(0x00B0F4)
        .setTitle('ðŸŒ à¹€à¸§à¹‡à¸šà¹à¸”à¸Šà¸šà¸­à¸£à¹Œà¸”à¸ªà¸¡à¸²à¸Šà¸´à¸')
        .setDescription('à¸ªà¸¡à¸²à¸Šà¸´à¸à¸—à¸¸à¸à¸„à¸™à¹ƒà¸Šà¹‰à¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡à¸™à¸µà¹‰à¹€à¸›à¹‡à¸™à¸—à¸²à¸‡à¹€à¸‚à¹‰à¸²à¸«à¸™à¹‰à¸²à¹€à¸§à¹‡à¸šà¸«à¸¥à¸±à¸à¸‚à¸­à¸‡à¹à¸à¹Šà¸‡\nà¸¥à¹‡à¸­à¸à¸­à¸´à¸™à¸”à¹‰à¸§à¸¢ Discord à¹à¸¥à¹‰à¸§à¸”à¸¹à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ªà¹ˆà¸§à¸™à¸•à¸±à¸§ à¸à¸²à¸£à¹€à¸‡à¸´à¸™ à¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­ à¹à¸¥à¸°à¸«à¸™à¹‰à¸²à¸ˆà¸±à¸”à¸à¸²à¸£à¸•à¹ˆà¸²à¸‡ à¹† à¹„à¸”à¹‰à¸—à¸±à¸™à¸—à¸µ')
        .addFields(
            { name: 'à¹ƒà¸Šà¹‰à¸—à¸³à¸­à¸°à¹„à¸£à¹„à¸”à¹‰à¸šà¹‰à¸²à¸‡', value: 'â€¢ à¸”à¸¹à¸ªà¸–à¸²à¸™à¸°à¸à¸²à¸£à¹€à¸‡à¸´à¸™à¸‚à¸­à¸‡à¸•à¸±à¸§à¹€à¸­à¸‡\nâ€¢ à¸”à¸¹à¸›à¸£à¸°à¸§à¸±à¸•à¸´ attendance / leave\nâ€¢ à¹ƒà¸«à¹‰à¸«à¸±à¸§à¸«à¸™à¹‰à¸²à¹€à¸‚à¹‰à¸²à¹„à¸›à¸ˆà¸±à¸”à¸à¸²à¸£à¸ªà¸¡à¸²à¸Šà¸´à¸, à¸à¸²à¸£à¹€à¸‡à¸´à¸™ à¹à¸¥à¸°à¸•à¸±à¹‰à¸‡à¸„à¹ˆà¸²' },
            { name: 'à¸§à¸´à¸˜à¸µà¹€à¸‚à¹‰à¸²à¹ƒà¸Šà¹‰', value: 'à¸à¸”à¸›à¸¸à¹ˆà¸¡à¸”à¹‰à¸²à¸™à¸¥à¹ˆà¸²à¸‡ à¹à¸¥à¹‰à¸§à¸¥à¹‡à¸­à¸à¸­à¸´à¸™à¸”à¹‰à¸§à¸¢ Discord à¸šà¸±à¸à¸Šà¸µà¹€à¸”à¸µà¸¢à¸§à¸à¸±à¸šà¸—à¸µà¹ˆà¸­à¸¢à¸¹à¹ˆà¹ƒà¸™à¹€à¸‹à¸´à¸£à¹Œà¸Ÿà¹€à¸§à¸­à¸£à¹Œà¸™à¸µà¹‰' }
        )
        .setFooter({ text: 'Gang Management System' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setLabel('à¹€à¸›à¸´à¸” Dashboard')
            .setStyle(ButtonStyle.Link)
            .setURL(`${process.env.NEXTAUTH_URL || 'https://gang-manager.vercel.app'}/dashboard/${gangId}`)
    );

    await channel.send({ embeds: [embed], components: [row] });
}

export { handleSetupStart, handleSetupModalSubmit, handleSetupModeAuto, handleSetupModeManual, handleSetupRoleSelect, sendAdminPanel };
