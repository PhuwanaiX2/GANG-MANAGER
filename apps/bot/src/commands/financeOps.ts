import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { db, gangs, FinanceService } from '@gang/database';
import { eq } from 'drizzle-orm';
import { checkFeatureEnabled, checkGangSubscriptionFeatureAccess } from '../utils/featureGuard';
import { getGangMemberByDiscordId, hasPermissionLevel } from '../utils/permissions';
import { logError } from '../utils/logger';

export const incomeCommand = {
    data: new SlashCommandBuilder()
        .setName('income')
        .setDescription('บันทึกรายรับเข้าแก๊ง (Treasurer Only)')
        .addNumberOption((option) =>
            option
                .setName('amount')
                .setDescription('จำนวนเงิน')
                .setRequired(true))
        .addStringOption((option) =>
            option
                .setName('description')
                .setDescription('รายละเอียดที่มาของเงิน')
                .setRequired(true)),

    async execute(interaction: ChatInputCommandInteraction) {
        await handleFinanceOp(interaction, 'INCOME');
    },
};

export const expenseCommand = {
    data: new SlashCommandBuilder()
        .setName('expense')
        .setDescription('บันทึกรายจ่ายของแก๊ง (Treasurer Only)')
        .addNumberOption((option) =>
            option
                .setName('amount')
                .setDescription('จำนวนเงิน')
                .setRequired(true))
        .addStringOption((option) =>
            option
                .setName('description')
                .setDescription('รายละเอียดการใช้จ่าย')
                .setRequired(true)),

    async execute(interaction: ChatInputCommandInteraction) {
        await handleFinanceOp(interaction, 'EXPENSE');
    },
};

async function handleFinanceOp(interaction: ChatInputCommandInteraction, type: 'INCOME' | 'EXPENSE') {
    await interaction.deferReply({ ephemeral: true });
    let gangId = 'unknown';

    if (!await checkFeatureEnabled(interaction, 'finance', 'ระบบการเงิน', { alreadyDeferred: true })) {
        return;
    }

    const financeAccess = await checkGangSubscriptionFeatureAccess(
        interaction,
        interaction.guildId,
        'finance',
        'ระบบการเงิน',
        { alreadyDeferred: true }
    );
    if (!financeAccess.allowed) {
        return;
    }

    const discordId = interaction.user.id;
    const guildId = interaction.guildId;
    const amount = interaction.options.getNumber('amount', true);
    const description = interaction.options.getString('description', true);

    if (!guildId) {
        await interaction.editReply('❌ คำสั่งนี้ใช้ได้เฉพาะใน Server เท่านั้น');
        return;
    }

    if (amount <= 0 || amount > 100000000) {
        await interaction.editReply('❌ จำนวนเงินต้องมากกว่า 0 และไม่เกิน 100,000,000');
        return;
    }

    try {
        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.discordGuildId, guildId),
        });

        if (!gang) {
            await interaction.editReply('❌ Server นี้ยังไม่ได้ลงทะเบียนแก๊ง');
            return;
        }

        gangId = gang.id;

        const member = await getGangMemberByDiscordId(gang.id, discordId);

        if (!member) {
            await interaction.editReply('❌ คุณยังไม่ได้ลงทะเบียนสมาชิกแก๊ง');
            return;
        }

        if (!hasPermissionLevel(member.gangRole, ['TREASURER'])) {
            await interaction.editReply('❌ คุณไม่มีสิทธิ์ใช้งานคำสั่งนี้ (ต้องเป็น Owner หรือ Treasurer)');
            return;
        }

        const { newGangBalance } = await FinanceService.createTransaction(db, {
            gangId: gang.id,
            type,
            amount,
            description,
            memberId: null,
            actorId: member.id,
            actorName: member.name,
        });

        const embed = new EmbedBuilder()
            .setColor(type === 'INCOME' ? '#00FF00' : '#FF0000')
            .setTitle(type === 'INCOME' ? 'รับเงินเข้ากองกลาง' : 'จ่ายเงินจากกองกลาง')
            .setDescription(`
                **จำนวน:** ฿${amount.toLocaleString()}
                **รายการ:** ${description}
                **ทำรายการโดย:** <@${discordId}>

                **เงินกองกลางคงเหลือ:** ฿${newGangBalance.toLocaleString()}
            `)
            .setTimestamp();

        await interaction.editReply({ content: '✅ ทำรายการสำเร็จ', embeds: [embed] });

        if (channelLog(gang.id)) {
            // Placeholder for logging
        }
    } catch (error: any) {
        if (error.message === 'INSUFFICIENT_FUNDS' || error.message === 'Insufficient gang funds') {
            await interaction.editReply('❌ เงินกองกลางไม่เพียงพอ');
            return;
        }

        logError('bot.finance.operation.failed', error, {
            type,
            guildId,
            gangId,
            actorDiscordId: discordId,
            amount,
        });
        await interaction.editReply('❌ เกิดข้อผิดพลาดในการทำรายการ');
    }
}

function channelLog(gangId: string) {
    void gangId;
    return true;
}
