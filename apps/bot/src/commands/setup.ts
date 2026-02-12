import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';

export const setupCommand = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('เริ่มการตั้งค่าระบบจัดการแก๊ง (Interactive)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('⚙️ เริ่มต้นตั้งค่าระบบแก๊ง')
            .setDescription('กดปุ่มด้านล่างเพื่อเริ่มการตั้งค่า ชื่อแก๊ง, License, และการสร้างห้องต่าง ๆ');

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('setup_start')
                    .setLabel('🛠️ เริ่มต้นตั้งค่า')
                    .setStyle(ButtonStyle.Primary)
            );

        await interaction.editReply({ embeds: [embed], components: [row] });
    },
};
