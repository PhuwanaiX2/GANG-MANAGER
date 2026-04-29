import { ChatInputCommandInteraction, ButtonInteraction, ModalSubmitInteraction, AnySelectMenuInteraction } from 'discord.js';
import { logError } from './logger';

type SupportedInteraction =
    | ChatInputCommandInteraction
    | ButtonInteraction
    | ModalSubmitInteraction
    | AnySelectMenuInteraction;

function buildInteractionContext(interaction: SupportedInteraction) {
    return {
        userId: interaction.user.id,
        userTag: interaction.user.tag,
        guildId: interaction.guildId ?? 'DM',
        guildName: interaction.guild?.name ?? 'DM',
        channelId: interaction.channelId ?? 'Unknown',
        command: interaction.isChatInputCommand() ? interaction.commandName : undefined,
        customId: interaction.isButton() || interaction.isModalSubmit() || interaction.isAnySelectMenu()
            ? interaction.customId
            : undefined,
    };
}

export async function logErrorToDiscord(
    error: unknown,
    context: {
        interaction?: SupportedInteraction;
        source?: string;
    }
) {
    logError('bot.interaction.unhandled', error, {
        source: context.source,
        interaction: context.interaction ? buildInteractionContext(context.interaction) : undefined,
    });
}
