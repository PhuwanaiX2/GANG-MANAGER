import {
    AnySelectMenuInteraction,
    ButtonInteraction,
    ChatInputCommandInteraction,
    Interaction,
    ModalSubmitInteraction,
    MessageFlags,
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

function isUnknownInteractionError(error: unknown) {
    const maybeError = error as {
        code?: unknown;
        name?: unknown;
        message?: unknown;
        rawError?: { code?: unknown };
    };

    return maybeError?.code === 10062 ||
        maybeError?.rawError?.code === 10062 ||
        maybeError?.name === 'DiscordAPIError[10062]' ||
        (typeof maybeError?.message === 'string' && maybeError.message.includes('Unknown interaction'));
}

async function notifyInteractionError(interaction: Interaction) {
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        try {
            await interaction.reply({
                content: GENERIC_ERROR_MESSAGE,
                flags: MessageFlags.Ephemeral,
            });
        } catch (replyError) {
            const eventName = isUnknownInteractionError(replyError)
                ? 'bot.interaction.error_reply_expired'
                : 'bot.interaction.error_reply_failed';
            logError(eventName, replyError, {
                userId: interaction.user.id,
                interactionType: interaction.type,
            });
        }
        return;
    }

    if (interaction.isRepliable() && (interaction.deferred || interaction.replied)) {
        try {
            await interaction.followUp({
                content: GENERIC_ERROR_MESSAGE,
                flags: MessageFlags.Ephemeral,
            });
        } catch (followUpError) {
            const eventName = isUnknownInteractionError(followUpError)
                ? 'bot.interaction.error_followup_expired'
                : 'bot.interaction.error_followup_failed';
            logError(eventName, followUpError, {
                userId: interaction.user.id,
                interactionType: interaction.type,
            });
        }
    }
}

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
                flags: MessageFlags.Ephemeral,
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
        if (isUnknownInteractionError(error)) {
            logWarn('bot.interaction.unknown_interaction', {
                userId: interaction.user.id,
                interactionType: interaction.type,
                customId: interaction.isButton() || interaction.isModalSubmit() || interaction.isAnySelectMenu()
                    ? interaction.customId
                    : undefined,
            });
            return;
        }

        const supportedInteraction =
            interaction.isChatInputCommand() ||
            interaction.isButton() ||
            interaction.isModalSubmit() ||
            interaction.isAnySelectMenu()
                ? interaction
                : undefined;

        await notifyInteractionError(interaction);

        await logErrorToDiscord(error, {
            source: 'handleInteraction',
            interaction: supportedInteraction,
        });
    }
}

async function handleCommand(interaction: ChatInputCommandInteraction) {
    const handler = commandHandlers.get(interaction.commandName);

    if (!handler) {
        await interaction.reply({
            content: UNKNOWN_COMMAND_MESSAGE,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    await handler(interaction);
}
