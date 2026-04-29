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
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('⚙️ เริ่มเปิดระบบจัดการแก๊ง')
            .setDescription('คำสั่งนี้จะช่วยคุณเปิดระบบแก๊งให้พร้อมใช้งานทั้งใน Discord และหน้าเว็บ\nเหมาะทั้งการตั้งค่าครั้งแรก และการซ่อมแซมห้อง/ยศ/แผงที่หายไป')
            .addFields(
                { name: 'สิ่งที่จะได้หลังติดตั้ง', value: '• ห้องและยศหลักสำหรับระบบแก๊ง\n• ปุ่มสมัครสมาชิก, แจ้งลา, การเงิน\n• แผงควบคุมหัวหน้าแก๊ง + ลิงก์ Dashboard' },
                { name: 'แนะนำก่อนเริ่ม', value: 'ตรวจว่าบอทมีสิทธิ์ Manage Roles และ Manage Channels เพื่อให้ติดตั้งได้ครบ' }
            )
            .setFooter({ text: 'ถ้าเคยตั้งค่าไว้แล้ว ระบบจะพาไปโหมดซ่อมแซมหรือเชื่อมยศแทน' });

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('setup_start')
                    .setLabel('🛠️ เริ่มเปิดระบบ')
                    .setStyle(ButtonStyle.Primary)
            );

        await interaction.editReply({ embeds: [embed], components: [row] });
    },
};
