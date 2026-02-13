import { WebhookClient, EmbedBuilder, ChatInputCommandInteraction, ButtonInteraction, ModalSubmitInteraction, AnySelectMenuInteraction } from 'discord.js';

const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

export async function logErrorToDiscord(
    error: any,
    context: {
        interaction?: ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction | AnySelectMenuInteraction;
        source?: string;
    }
) {
    if (!webhookUrl) {
        console.error('❌ DISCORD_WEBHOOK_URL is not set. Error logging to Discord skipped.');
        console.error(error);
        return;
    }

    try {
        const webhookClient = new WebhookClient({ url: webhookUrl });

        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : 'No stack trace';

        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🚨 Runtime Error Occurred')
            .setDescription(`\`\`\`js\n${errorMessage}\n\`\`\``)
            .addFields(
                { name: 'Source', value: context.source || 'Unknown', inline: true },
                { name: 'Timestamp', value: new Date().toISOString(), inline: true }
            );

        if (context.interaction) {
            const { user, guild, channel } = context.interaction;
            embed.addFields(
                { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                { name: 'Guild', value: guild ? `${guild.name} (${guild.id})` : 'DM', inline: true },
                { name: 'Channel', value: channel ? `${channel.id}` : 'Unknown', inline: true }
            );

            if (context.interaction.isCommand()) {
                embed.addFields({ name: 'Command', value: context.interaction.commandName, inline: true });
            } else if (context.interaction.isButton() || context.interaction.isModalSubmit() || context.interaction.isAnySelectMenu()) {
                embed.addFields({ name: 'Custom ID', value: context.interaction.customId, inline: true });
            }
        }

        // Truncate stack trace if too long (Discord limit is 1024 chars for field value)
        if (errorStack) {
            const truncatedStack = errorStack.length > 1000 ? errorStack.substring(0, 1000) + '...' : errorStack;
            embed.addFields({ name: 'Stack Trace', value: `\`\`\`js\n${truncatedStack}\n\`\`\`` });
        }

        await webhookClient.send({
            username: 'GangBot Error Logger',
            avatarURL: 'https://cdn.discordapp.com/embed/avatars/4.png',
            embeds: [embed],
        });

    } catch (loggingError) {
        console.error('❌ Failed to log error to Discord:', loggingError);
        console.error('Original Error:', error);
    }
}
