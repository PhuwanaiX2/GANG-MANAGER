import {
    AnySelectMenuInteraction,
    ButtonInteraction,
    ChatInputCommandInteraction,
    Interaction,
    ModalSubmitInteraction,
} from 'discord.js';
import { commandHandlers } from './commands';
import { handleButton } from './buttons';
import { handleModal } from './modals';
import { handleSelectMenu } from './selectMenus';
import { checkInteractionRateLimit } from '../utils/interactionRateLimit';
import { logError, logWarn } from '../utils/logger';
import { logErrorToDiscord } from '../utils/errorLogger';

const RATE_LIMIT_MESSAGE = '⚠️ คุณกำลังใช้งานเร็วเกินไป กรุณารอสักครู่แล้วลองใหม่';
const GENERIC_ERROR_MESSAGE = '❌ เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้งครับ';
const UNKNOWN_COMMAND_MESSAGE = '❌ ไม่พบคำสั่งนี้';

export async function handleInteraction(interaction: Interaction) {
    const rateLimit = await checkInteractionRateLimit(interaction.user.id);
    if (!rateLimit.allowed) {
        logWarn('bot.interaction.rate_limited', {
            userId: interaction.user.id,
            interactionType: interaction.type,
            retryAfterSeconds: rateLimit.retryAfterSeconds,
            remaining: rateLimit.remaining,
        });
        if (interaction.isRepliable()) {
            await interaction.reply({
                content: RATE_LIMIT_MESSAGE,
                ephemeral: true,
            });
        }
        return;
    }

    try {
        if (interaction.isChatInputCommand()) {
            await handleCommand(interaction);
        } else if (interaction.isButton()) {
            await handleButton(interaction);
        } else if (interaction.isModalSubmit()) {
            await handleModal(interaction);
        } else if (interaction.isAnySelectMenu()) {
            await handleSelectMenu(interaction);
        }
    } catch (error) {
        const supportedInteraction =
            interaction.isChatInputCommand() ||
            interaction.isButton() ||
            interaction.isModalSubmit() ||
            interaction.isAnySelectMenu()
                ? interaction
                : undefined;

        await logErrorToDiscord(error, {
            source: 'handleInteraction',
            interaction: supportedInteraction,
        });

        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            try {
                await interaction.reply({
                    content: GENERIC_ERROR_MESSAGE,
                    ephemeral: true,
                });
            } catch (replyError) {
                logError('bot.interaction.error_reply_failed', replyError, {
                    userId: interaction.user.id,
                    interactionType: interaction.type,
                });
            }
        } else if (interaction.isRepliable() && (interaction.deferred || interaction.replied)) {
            try {
                await interaction.followUp({
                    content: GENERIC_ERROR_MESSAGE,
                    ephemeral: true,
                });
            } catch (followUpError) {
                logError('bot.interaction.error_followup_failed', followUpError, {
                    userId: interaction.user.id,
                    interactionType: interaction.type,
                });
            }
        }
    }
}

async function handleCommand(interaction: ChatInputCommandInteraction) {
    const handler = commandHandlers.get(interaction.commandName);

    if (!handler) {
        await interaction.reply({
            content: UNKNOWN_COMMAND_MESSAGE,
            ephemeral: true,
        });
        return;
    }

    await handler(interaction);
}
