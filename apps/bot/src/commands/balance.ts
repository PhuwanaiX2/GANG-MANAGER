import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
} from 'discord.js';
import { db, gangs, members } from '@gang/database';
import { eq, and } from 'drizzle-orm';

export const balanceCommand = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('เช็คยอดเงินกองกลางและยอดหนี้ส่วนตัว'),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        const guildId = interaction.guildId;
        if (!guildId) {
            await interaction.editReply('❌ ต้องใช้คำสั่งนี้ในเซิร์ฟเวอร์');
            return;
        }

        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.discordGuildId, guildId),
        });

        if (!gang) {
            await interaction.editReply('❌ ไม่พบข้อมูลแก๊งในเซิร์ฟเวอร์นี้');
            return;
        }

        const member = await db.query.members.findFirst({
            where: and(
                eq(members.gangId, gang.id),
                eq(members.discordId, interaction.user.id),
                eq(members.isActive, true),
            ),
        });

        if (!member) {
            await interaction.editReply('❌ คุณยังไม่ได้ลงทะเบียนเป็นสมาชิกแก๊ง');
            return;
        }

        const personalBalance = member.balance || 0;
        const gangBalance = gang.balance || 0;

        const embed = new EmbedBuilder()
            .setColor(personalBalance >= 0 ? 0x57F287 : 0xED4245)
            .setTitle(`💳 ยอดเงิน — ${gang.name}`)
            .addFields(
                {
                    name: '🏦 เงินกองกลาง',
                    value: `฿${gangBalance.toLocaleString()}`,
                    inline: true,
                },
                {
                    name: '👤 ยอดส่วนตัว',
                    value: personalBalance >= 0
                        ? `฿${personalBalance.toLocaleString()} ✅`
                        : `฿${Math.abs(personalBalance).toLocaleString()} (หนี้) ❌`,
                    inline: true,
                },
            )
            .setFooter({ text: `สมาชิก: ${member.name}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },
};
