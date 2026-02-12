import { ModalSubmitInteraction } from 'discord.js';

// Modal handlers map
const modalHandlers = new Map<string, (interaction: ModalSubmitInteraction) => Promise<void>>();

// Register handler
export function registerModalHandler(customId: string, handler: (interaction: ModalSubmitInteraction) => Promise<void>) {
    modalHandlers.set(customId, handler);
}

// Handle modal submission
export async function handleModal(interaction: ModalSubmitInteraction) {
    // Try exact match first
    let handler = modalHandlers.get(interaction.customId);

    // Then try prefix match (find key that is a prefix of customId)
    if (!handler) {
        for (const [key, h] of modalHandlers.entries()) {
            if (interaction.customId.startsWith(key)) {
                handler = h;
                break;
            }
        }
    }

    if (!handler) {
        await interaction.reply({
            content: '❌ ไม่พบการทำงานของฟอร์มนี้',
            ephemeral: true,
        });
        return;
    }

    await handler(interaction);
}
