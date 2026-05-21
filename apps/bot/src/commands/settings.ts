import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
} from 'discord.js';
import { db, gangs, gangSettings, gangRoles } from '@gang/database';
import { eq } from 'drizzle-orm';
import { checkPermission } from '../utils/permissions';
import { buildDashboardUrl } from '../utils/webUrl';

export const settingsCommand = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('จัดการการตั้งค่าแก๊ง')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub
                .setName('view')
                .setDescription('ดูการตั้งค่าปัจจุบัน')
        )
        .addSubcommand(sub =>
            sub
                .setName('roles')
                .setDescription('ตั้งค่ายศและสิทธิ์')
        )
        .addSubcommand(sub =>
            sub
                .setName('attendance')
                .setDescription('ตั้งค่าระบบเช็คชื่อ')
                .addNumberOption(opt =>
                    opt.setName('absent_penalty')
                        .setDescription('ค่าปรับขาด (บาท)')
                        .setMinValue(0)
                )
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        if (!guildId) {
            await interaction.reply({ content: '❌ ใช้ได้เฉพาะในเซิร์ฟเวอร์', flags: MessageFlags.Ephemeral });
            return;
        }

        // Get gang
        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.discordGuildId, guildId),
            with: { settings: true },
        });

        if (!gang) {
            await interaction.reply({ content: '❌ ยังไม่ได้ตั้งค่าแก๊ง ใช้ `/setup` ก่อน', flags: MessageFlags.Ephemeral });
            return;
        }

        // Check permission
        const hasPermission = await checkPermission(interaction, gang.id, ['OWNER', 'ADMIN']);
        if (!hasPermission) {
            await interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ใช้คำสั่งนี้', flags: MessageFlags.Ephemeral });
            return;
        }

        switch (subcommand) {
            case 'view':
                await handleViewSettings(interaction, gang);
                break;
            case 'roles':
                await handleRolesSettings(interaction, gang);
                break;
            case 'attendance':
                await handleAttendanceSettings(interaction, gang);
                break;
        }
    },
};

async function handleViewSettings(interaction: ChatInputCommandInteraction, gang: any) {
    const settings = gang.settings;

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`การตั้งค่า — ${gang.name}`)
        .addFields(
            { name: 'แพลน', value: gang.subscriptionTier, inline: true },
            { name: 'สกุลเงิน', value: settings?.currency || 'THB', inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            {
                name: 'เช็คชื่อ',
                value: [
                    `ค่าปรับขาด: ${settings?.defaultAbsentPenalty || 0} บาท`,
                ].join('\n'),
                inline: false
            },
        )
        .setFooter({ text: 'ใช้ /settings <subcommand> เพื่อแก้ไข' });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handleRolesSettings(interaction: ChatInputCommandInteraction, gang: any) {
    const settingsUrl = `${buildDashboardUrl(gang.id, { guildId: interaction.guildId, gangId: gang.id })}/settings`;

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('ตั้งค่ายศและสิทธิ์')
        .setDescription('จัดการยศได้สะดวกกว่าผ่านหน้าเว็บ กดปุ่มด้านล่างเพื่อไปตั้งค่า');

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setLabel('ไปที่หน้าตั้งค่า')
                .setStyle(ButtonStyle.Link)
                .setURL(settingsUrl)
                .setEmoji('🔗')
        );

    await interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
}

async function handleAttendanceSettings(interaction: ChatInputCommandInteraction, gang: any) {
    const absentPenalty = interaction.options.getNumber('absent_penalty');

    if (absentPenalty === null) {
        await interaction.reply({
            content: '⚠️ กรุณาระบุค่าที่ต้องการเปลี่ยนอย่างน้อย 1 อย่าง',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const updates: any = {};
    if (absentPenalty !== null) updates.defaultAbsentPenalty = absentPenalty;

    await db.update(gangSettings)
        .set(updates)
        .where(eq(gangSettings.gangId, gang.id));

    const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ อัพเดทการตั้งค่าสำเร็จ')
        .setDescription(
            Object.entries(updates)
                .map(([key, value]) => {
                    const labels: Record<string, string> = {
                        defaultAbsentPenalty: 'ค่าปรับขาด',
                    };
                    return `${labels[key]}: ${value}`;
                })
                .join('\n')
        );

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
