import { ButtonInteraction, MessageFlags } from 'discord.js';
import { registerButtonHandler } from '../handlers';
import { logError, logInfo } from '../utils/logger';
import { isRoleAssignableByBot } from '../utils/discordRole';
import { db, gangRoles, gangs } from '@gang/database';
import { and, eq } from 'drizzle-orm';

registerButtonHandler('verify_member', handleVerify);

export async function handleVerify(interaction: ButtonInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guild = interaction.guild;
    if (!guild) {
        await interaction.editReply({ content: '❌ ไม่พบเซิร์ฟเวอร์' });
        return;
    }

    const member = await guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member) {
        await interaction.editReply({ content: '❌ ไม่พบข้อมูลสมาชิก' });
        return;
    }

    const gang = await db.query.gangs.findFirst({
        where: eq(gangs.discordGuildId, guild.id),
        columns: { id: true },
    });
    const verifiedRoleMapping = gang
        ? await db.query.gangRoles.findFirst({
            where: and(
                eq(gangRoles.gangId, gang.id),
                eq(gangRoles.permissionLevel, 'VERIFIED')
            ),
            columns: { discordRoleId: true },
        })
        : null;

    const mappedVerifiedRole = verifiedRoleMapping
        ? guild.roles.cache.get(verifiedRoleMapping.discordRoleId)
        : null;
    if (!verifiedRoleMapping?.discordRoleId) {
        await interaction.editReply({ content: '❌ ยังไม่ได้ตั้งค่ายศคนทั่วไปของเซิร์ฟ กรุณาให้แอดมินกด `/setup` เพื่อเลือกหรือสร้างยศนี้ก่อน' });
        return;
    }

    if (!mappedVerifiedRole || !isRoleAssignableByBot(mappedVerifiedRole)) {
        await interaction.editReply({ content: '❌ ยศคนทั่วไปที่ตั้งไว้หายไปหรือบอทยังให้ยศนี้ไม่ได้ — กรุณาให้แอดมินกด /setup เพื่อเลือกหรือซ่อมยศนี้ใหม่' });
        return;
    }

    const verifiedRole = mappedVerifiedRole;

    // Check if already has the role
    if (member.roles.cache.has(verifiedRole.id)) {
        await interaction.editReply({ content: '✅ คุณมียศคนทั่วไปของเซิร์ฟอยู่แล้ว!' });
        return;
    }

    if (member.manageable === false) {
        await interaction.editReply({
            content: '❌ บอทอยู่ต่ำกว่ายศของคุณใน Discord จึงยังให้ยศคนทั่วไปไม่ได้ — กรุณาให้แอดมินลากยศ GANG-MANAGER ให้อยู่เหนือยศนี้ แล้วลองอีกครั้ง',
        });
        return;
    }

    try {
        await member.roles.add(verifiedRole);
        await interaction.editReply({
            content: '✅ **รับยศคนทั่วไปสำเร็จ!**\n\nตอนนี้คุณสามารถเห็นห้องพื้นฐานที่แอดมินเปิดไว้ได้แล้ว\nขั้นตอนนี้ยังไม่ใช่สมาชิกแก๊ง หากต้องการเข้าร่วมแก๊ง ให้ไปที่ห้อง **ลงทะเบียน**',
        });
        logInfo('bot.verify.completed', {
            guildId: guild.id,
            guildName: guild.name,
            gangId: gang?.id,
            memberDiscordId: interaction.user.id,
            roleId: verifiedRole.id,
        });
    } catch (err) {
        logError('bot.verify.role_add_failed', err, {
            guildId: guild.id,
            memberDiscordId: interaction.user.id,
            roleId: verifiedRole.id,
        });
        await interaction.editReply({ content: '❌ ไม่สามารถให้ยศได้ — กรุณาแจ้งแอดมิน' });
    }
}
