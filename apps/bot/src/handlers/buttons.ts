import { ButtonInteraction } from 'discord.js';

// Button handlers map
const buttonHandlers = new Map<string, (interaction: ButtonInteraction) => Promise<void>>();

// Register handler
export function registerButtonHandler(customId: string, handler: (interaction: ButtonInteraction) => Promise<void>) {
    buttonHandlers.set(customId, handler);
}

// Handle button interaction
export async function handleButton(interaction: ButtonInteraction) {
    // Check for prefix-based handlers (e.g., "register_", "checkin_")
    const prefix = interaction.customId.split('_')[0];

    // Try exact match first
    let handler = buttonHandlers.get(interaction.customId);

    // Then try prefix match (iterate to find matching prefix key)
    if (!handler) {
        for (const [key, h] of buttonHandlers.entries()) {
            if (interaction.customId.startsWith(key)) {
                handler = h;
                break;
            }
        }
    }

    if (!handler) {
        await interaction.reply({
            content: '❌ ไม่พบการทำงานของปุ่มนี้',
            ephemeral: true,
        });
        return;
    }

    await handler(interaction);
}
