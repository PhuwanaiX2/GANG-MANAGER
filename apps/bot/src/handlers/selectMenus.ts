import { AnySelectMenuInteraction } from 'discord.js';

// Select Menu handlers map
const selectMenuHandlers = new Map<string, (interaction: AnySelectMenuInteraction) => Promise<void>>();

// Register handler
export function registerSelectMenuHandler(customId: string, handler: (interaction: AnySelectMenuInteraction) => Promise<void>) {
    selectMenuHandlers.set(customId, handler);
}

// Handle select menu interaction
export async function handleSelectMenu(interaction: AnySelectMenuInteraction) {
    // Check for prefix-based handlers
    // Try exact match first
    let handler = selectMenuHandlers.get(interaction.customId);

    // Then try prefix match iteration
    if (!handler) {
        for (const [key, h] of selectMenuHandlers.entries()) {
            if (interaction.customId.startsWith(key)) {
                handler = h;
                break;
            }
        }
    }

    if (!handler) {
        await interaction.reply({
            content: '❌ ไม่พบการทำงานของเมนูนี้',
            ephemeral: true,
        });
        return;
    }

    await handler(interaction);
}
