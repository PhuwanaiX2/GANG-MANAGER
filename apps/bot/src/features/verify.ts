import { ButtonInteraction, MessageFlags } from 'discord.js';
import { registerButtonHandler } from '../handlers';
import { logError, logInfo } from '../utils/logger';
import { findAssignableRoleByName, isRoleAssignableByBot } from '../utils/discordRole';
import { db, gangRoles, gangs } from '@gang/database';
import { and, eq } from 'drizzle-orm';

registerButtonHandler('verify_member', handleVerify);

const VISITOR_ROLE_FALLBACK_NAMES = ['Visitor', 'Verified'];

export async function handleVerify(interaction: ButtonInteraction) {
    const guild = interaction.guild;
    if (!guild) {
        await interaction.reply({ content: '❌ ไม่พบเซิร์ฟเวอร์', flags: MessageFlags.Ephemeral });
        return;
    }

    const member = await guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member) {
        await interaction.reply({ content: '❌ ไม่พบข้อมูลสมาชิก', flags: MessageFlags.Ephemeral });
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
    if (verifiedRoleMapping && (!mappedVerifiedRole || !isRoleAssignableByBot(mappedVerifiedRole))) {
        await interaction.reply({ content: '❌ ยศคนทั่วไป/ผู้เยี่ยมชมที่ตั้งไว้หายไปหรือบอทยังจัดการไม่ได้ — กรุณาให้แอดมินกด /setup เพื่อเลือกหรือซ่อมยศนี้ใหม่', flags: MessageFlags.Ephemeral });
        return;
    }

    const verifiedRole = mappedVerifiedRole ?? VISITOR_ROLE_FALLBACK_NAMES
        .map((roleName) => findAssignableRoleByName(guild, roleName))
        .find(Boolean);

    if (!verifiedRole) {
        await interaction.reply({ content: '❌ ไม่พบยศคนทั่วไปที่บอทจัดการได้ — กรุณาให้แอดมินกด /setup เพื่อซ่อมยศ หรือย้ายยศบอทให้อยู่สูงกว่ายศนี้', flags: MessageFlags.Ephemeral });
        return;
    }

    // Check if already has the role
    if (member.roles.cache.has(verifiedRole.id)) {
        await interaction.reply({ content: '✅ คุณมียศคนทั่วไป/ผู้เยี่ยมชมอยู่แล้ว!', flags: MessageFlags.Ephemeral });
        return;
    }

    if (member.manageable === false) {
        await interaction.reply({
            content: '❌ บอทอยู่ต่ำกว่ายศของคุณใน Discord จึงยังให้ยศคนทั่วไปไม่ได้ — กรุณาให้แอดมินลากยศ GANG-MANAGER ให้อยู่เหนือยศนี้ แล้วลองอีกครั้ง',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    try {
        await member.roles.add(verifiedRole);
        await interaction.reply({
            content: '✅ **รับยศคนทั่วไปสำเร็จ!**\n\nตอนนี้คุณสามารถเห็นห้องพื้นฐานที่แอดมินเปิดไว้ได้แล้ว\nขั้นตอนนี้ยังไม่ใช่สมาชิกแก๊ง หากต้องการเข้าร่วมแก๊ง ให้ไปที่ห้อง **ลงทะเบียน**',
            flags: MessageFlags.Ephemeral,
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
        await interaction.reply({ content: '❌ ไม่สามารถให้ยศได้ — กรุณาแจ้งแอดมิน', flags: MessageFlags.Ephemeral });
    }
}
