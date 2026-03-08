import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
} from 'discord.js';

export const helpCommand = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('ดูคำสั่งทั้งหมดและวิธีใช้งานระบบ'),

    async execute(interaction: ChatInputCommandInteraction) {
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('คำสั่งทั้งหมด')
            .addFields(
                {
                    name: 'คำสั่งหลัก',
                    value: [
                        '`/setup` — ตั้งค่าแก๊ง *(Admin)*',
                        '`/settings` — ปรับการตั้งค่า *(Admin)*',
                        '`/setup_leave` — สร้างแผงแจ้งลา *(Admin)*',
                        '`/setup_finance` — สร้างแผงการเงิน *(Admin)*',
                    ].join('\n'),
                },
                {
                    name: 'การเงิน',
                    value: [
                        '`/income` — บันทึกรายรับ *(Owner/Treasurer)*',
                        '`/expense` — บันทึกรายจ่าย *(Owner/Treasurer)*',
                        '`/balance` — เช็คยอดกองกลาง',
                    ].join('\n'),
                },
                {
                    name: 'ฟีเจอร์อื่นๆ',
                    value: 'ลงทะเบียน · เช็คชื่อ · แจ้งลา — ใช้ผ่านปุ่มในห้องที่ตั้งค่าไว้',
                },
            )
            .setFooter({ text: 'Gang Manager · FiveM' });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
