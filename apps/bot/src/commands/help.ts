import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
} from 'discord.js';

export const helpCommand = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('ดูคำสั่งทั้งหมดและวิธีใช้งานระบบ'),

    async execute(interaction: ChatInputCommandInteraction) {
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🧭 คู่มือใช้งานบอทแบบย่อ')
            .setDescription('ถ้าเพิ่งเริ่มใช้ ให้เริ่มจาก `/setup` ก่อน\nหลังจากนั้นสมาชิกส่วนใหญ่จะใช้งานผ่านปุ่มในห้องต่าง ๆ มากกว่าพิมพ์คำสั่งเอง')
            .addFields(
                {
                    name: 'เริ่มต้นครั้งแรก',
                    value: [
                        '`/setup` — เปิดระบบแก๊งหรือซ่อมแซมห้อง/ยศ *(Admin)*',
                        '`/settings view` — ดูการตั้งค่าปัจจุบันของแก๊ง *(Owner/Admin)*',
                        '`/settings roles` — เปิดหน้าตั้งค่ายศบนเว็บ *(Owner/Admin)*',
                    ].join('\n'),
                },
                {
                    name: 'งานประจำของหัวหน้า/แอดมิน',
                    value: [
                        'ใช้แผง **ศูนย์ควบคุมหัวหน้าแก๊ง** ในห้อง `log-ระบบ`',
                        '`/settings attendance` — ปรับค่าปรับเช็คชื่อ',
                        '`/balance` — เช็คยอดกองกลาง',
                    ].join('\n'),
                },
                {
                    name: 'สมาชิกใช้งานตรงไหน',
                    value: [
                        'ห้อง **ลงทะเบียน** — สมัครสมาชิก',
                        'ห้อง **แจ้งลา** — แจ้งลา / เข้าช้า',
                        'ห้อง **แจ้งธุรกรรม** — ขอเบิก/ยืม, ชำระหนี้ยืม, จ่ายยอดเก็บ/ฝากเครดิต, ดูยอดของฉัน',
                        'ห้อง **Website** — เข้าเว็บ Dashboard',
                        'ห้อง **ประกาศ** — ดูประกาศสำคัญ',
                    ].join('\n'),
                },
                {
                    name: 'ถ้าระบบดูไม่ครบหรือปุ่มหาย',
                    value: 'ให้ Admin ใช้ `/setup` อีกครั้ง แล้วเลือกว่าให้ยศ Verify เป็นยศอัตโนมัติหรือยศเดิมของเซิร์ฟ จากนั้นระบบจะซ่อมห้อง/ยศให้เอง โดย Owner ยึดจากเจ้าของเซิร์ฟเวอร์ Discord และมี role Gang Owner ไว้ใน DC',
                },
            )
            .setFooter({ text: 'Gang Manager · FiveM' });

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    },
};
