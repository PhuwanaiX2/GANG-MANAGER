import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
} from 'discord.js';
import { db, gangs, members } from '@gang/database';
import { eq, and } from 'drizzle-orm';
import { getMemberFinanceSnapshot } from '../utils/financeSnapshot';

const BALANCE_LEDGER_HINT =
    'หนี้ยืมและยอดค้างเก็บเงินแก๊งเป็นคนละยอด: ใช้ "ชำระหนี้ยืมเข้ากองกลาง" สำหรับหนี้ยืม และใช้ "ชำระค่าเก็บเงินแก๊ง / ฝากเครดิต" สำหรับยอดเก็บเงินแก๊งหรือเครดิต';

export const balanceCommand = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('เช็คยอดเงินกองกลาง พร้อมหนี้ยืม ค้างเก็บเงิน และเครดิตของคุณ'),

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

        const { loanDebt, collectionDue } = await getMemberFinanceSnapshot(gang.id, member.id);
        const availableCredit = Math.max(0, Number(member.balance) || 0);
        const gangBalance = gang.balance || 0;

        const embed = new EmbedBuilder()
            .setColor(loanDebt > 0 || collectionDue > 0 ? 0xED4245 : 0x57F287)
            .setTitle(`💳 ยอดเงิน — ${gang.name}`)
            .setDescription(BALANCE_LEDGER_HINT)
            .addFields(
                {
                    name: '🏦 เงินกองกลาง',
                    value: `฿${gangBalance.toLocaleString()}`,
                    inline: true,
                },
                {
                    name: '💸 หนี้ยืมคงค้าง',
                    value: `฿${loanDebt.toLocaleString()}`,
                    inline: true,
                },
                {
                    name: '🪙 ค้างเก็บเงินแก๊ง',
                    value: `฿${collectionDue.toLocaleString()}`,
                    inline: true,
                },
                {
                    name: '🤝 เครดิต/สำรองจ่าย',
                    value: `฿${availableCredit.toLocaleString()}`,
                    inline: true,
                },
            )
            .setFooter({ text: `สมาชิก: ${member.name}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },
};
