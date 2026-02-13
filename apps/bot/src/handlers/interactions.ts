import {
    Interaction,
    ChatInputCommandInteraction,
    ButtonInteraction,
    ModalSubmitInteraction,
    AnySelectMenuInteraction
} from 'discord.js';
import { commandHandlers } from './commands';
import { handleButton } from './buttons';
import { handleModal } from './modals';
import { handleSelectMenu } from './selectMenus';

// Rate limiting map (simple in-memory)
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5; // requests
const RATE_WINDOW = 10000; // 10 seconds

function checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const userLimit = rateLimits.get(userId);

    if (!userLimit || now > userLimit.resetAt) {
        rateLimits.set(userId, { count: 1, resetAt: now + RATE_WINDOW });
        return true;
    }

    if (userLimit.count >= RATE_LIMIT) {
        return false;
    }

    userLimit.count++;
    return true;
}

export async function handleInteraction(interaction: Interaction) {
    // Rate limit check
    if (!checkRateLimit(interaction.user.id)) {
        if (interaction.isRepliable()) {
            await interaction.reply({
                content: '⚠️ คุณกำลังใช้งานเร็วเกินไป กรุณารอสักครู่',
                ephemeral: true,
            });
        }
        return;
    }

    try {
        // Handle slash commands
        if (interaction.isChatInputCommand()) {
            await handleCommand(interaction);
        }
        // Handle buttons
        else if (interaction.isButton()) {
            await handleButton(interaction);
        }
        // Handle modals
        else if (interaction.isModalSubmit()) {
            await handleModal(interaction);
        }
        // Handle select menus
        else if (interaction.isAnySelectMenu()) {
            await handleSelectMenu(interaction);
        }
    } catch (error) {
        console.error('❌ Interaction error:', error);

        // Log to Discord via Webhook
        if (interaction.isChatInputCommand() || interaction.isButton() || interaction.isModalSubmit() || interaction.isAnySelectMenu()) {
            // Dynamic import to avoid circular dependency if any (though utils should be fine)
            const { logErrorToDiscord } = await import('../utils/errorLogger');
            await logErrorToDiscord(error, {
                interaction: interaction as any,
                source: 'InteractionHandler'
            });
        }

        // Check if we can still reply
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            try {
                await interaction.reply({
                    content: '❌ เกิดข้อผิดพลาดในระบบ ทีมงานได้รับแจ้งแล้วครับ',
                    ephemeral: true,
                });
            } catch (replyError) {
                console.error('❌ Failed to send error response:', replyError);
            }
        } else if (interaction.isRepliable() && (interaction.deferred || interaction.replied)) {
            // If deferred or replied, we can followUp
            try {
                await interaction.followUp({
                    content: '❌ เกิดข้อผิดพลาดในระบบ ทีมงานได้รับแจ้งแล้วครับ',
                    ephemeral: true,
                });
            } catch (followUpError) {
                console.error('❌ Failed to send error followUp:', followUpError);
            }
        }
    }
}

async function handleCommand(interaction: ChatInputCommandInteraction) {
    const handler = commandHandlers.get(interaction.commandName);

    if (!handler) {
        await interaction.reply({
            content: '❌ ไม่พบคำสั่งนี้',
            ephemeral: true,
        });
        return;
    }

    await handler(interaction);
}
