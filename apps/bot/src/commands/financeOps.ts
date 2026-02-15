import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { db, gangs, members, gangRoles, FinanceService } from '@gang/database';
import { checkFeatureEnabled } from '../utils/featureGuard';
import { eq, and } from 'drizzle-orm';

export const incomeCommand = {
    data: new SlashCommandBuilder()
        .setName('income')
        .setDescription('💰 บันทึกรายรับเข้าแก๊ง (Treasurer Only)')
        .addNumberOption(option =>
            option.setName('amount')
                .setDescription('จำนวนเงิน')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('รายละเอียดที่มาของเงิน')
                .setRequired(true)),

    async execute(interaction: ChatInputCommandInteraction) {
        await handleFinanceOp(interaction, 'INCOME');
    }
};

export const expenseCommand = {
    data: new SlashCommandBuilder()
        .setName('expense')
        .setDescription('💸 บันทึกรายจ่ายของแก๊ง (Treasurer Only)')
        .addNumberOption(option =>
            option.setName('amount')
                .setDescription('จำนวนเงิน')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('รายละเอียดการใช้จ่าย')
                .setRequired(true)),

    async execute(interaction: ChatInputCommandInteraction) {
        await handleFinanceOp(interaction, 'EXPENSE');
    }
};

async function handleFinanceOp(interaction: ChatInputCommandInteraction, type: 'INCOME' | 'EXPENSE') {
    await interaction.deferReply({ ephemeral: true });

    // Global feature flag check
    if (!await checkFeatureEnabled(interaction, 'finance', 'ระบบการเงิน', { alreadyDeferred: true })) return;

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
        // 1. Find Gang from Guild ID
        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.discordGuildId, guildId)
        });

        if (!gang) {
            await interaction.editReply('❌ Server นี้ยังไม่ได้ลงทะเบียนแก๊ง');
            return;
        }

        // 2. Check Permissions (Must be TREASURER or OWNER)
        const memberRoles = (interaction.member?.roles as any)?.cache.map((r: any) => r.id) || [];
        const mappings = await db.query.gangRoles.findMany({
            where: eq(gangRoles.gangId, gang.id)
        });

        let hasPermission = false;
        for (const mapping of mappings) {
            if (memberRoles.includes(mapping.discordRoleId)) {
                if (['OWNER', 'TREASURER'].includes(mapping.permissionLevel)) {
                    hasPermission = true;
                    break;
                }
            }
        }

        if (!hasPermission) {
            await interaction.editReply('❌ คุณไม่มีสิทธิ์ใช้งานคำสั่งนี้ (ต้องเป็น Owner หรือ Treasurer)');
            return;
        }

        // 3. Finding Member Record (for createdById)
        const member = await db.query.members.findFirst({
            where: and(eq(members.discordId, discordId), eq(members.gangId, gang.id))
        });

        if (!member) {
            await interaction.editReply('❌ คุณยังไม่ได้ลงทะเบียนสมาชิกแก๊ง');
            return;
        }

        // 4. Process Transaction using Shared Service
        const { newGangBalance } = await FinanceService.createTransaction(db, {
            gangId: gang.id,
            type,
            amount,
            description,
            memberId: null, // Bot command currently doesn't support targeted member (LOAN/REPAYMENT)
            actorId: member.id,
            actorName: member.name,
        });

        const balanceAfter = newGangBalance;

        // 5. Reply
        const embed = new EmbedBuilder()
            .setColor(type === 'INCOME' ? '#00FF00' : '#FF0000')
            .setTitle(type === 'INCOME' ? '💰 รับเงินเข้ากองกลาง' : '💸 จ่ายเงินจากกองกลาง')
            .setDescription(`
                **จำนวน:** ฿${amount.toLocaleString()}
                **รายการ:** ${description}
                **ทำรายการโดย:** <@${discordId}>
                
                **เงินกองกลางคงเหลือ:** ฿${balanceAfter.toLocaleString()}
            `)
            .setTimestamp();

        await interaction.editReply({ content: '✅ ทำรายการสำเร็จ', embeds: [embed] });

        // Log if needed
        if (channelLog(gang.id)) {
            // ...
        }

    } catch (error: any) {
        if (error.message === 'INSUFFICIENT_FUNDS' || error.message === 'Insufficient gang funds') {
            await interaction.editReply(`❌ เงินกองกลางไม่เพียงพอ`);
            return;
        }
        console.error('Finance Op Error:', error);
        await interaction.editReply('❌ เกิดข้อผิดพลาดในการทำรายการ');
    }
}

function channelLog(gangId: string) {
    // Placeholder for logging
    return true;
}
