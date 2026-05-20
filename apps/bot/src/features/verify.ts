import { ButtonInteraction } from 'discord.js';
import { registerButtonHandler } from '../handlers';
import { logError, logInfo } from '../utils/logger';
import { findAssignableRoleByName } from '../utils/discordRole';

registerButtonHandler('verify_member', handleVerify);

async function handleVerify(interaction: ButtonInteraction) {
    const guild = interaction.guild;
    if (!guild) {
        await interaction.reply({ content: '❌ ไม่พบเซิร์ฟเวอร์', ephemeral: true });
        return;
    }

    const member = await guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member) {
        await interaction.reply({ content: '❌ ไม่พบข้อมูลสมาชิก', ephemeral: true });
        return;
    }

    // Find Verified role
    const verifiedRole = findAssignableRoleByName(guild, 'Verified');
    if (!verifiedRole) {
        await interaction.reply({ content: '❌ ไม่พบยศ Verified ที่บอทจัดการได้ — กรุณาให้แอดมินกดซ่อมแซมห้อง/ยศ หรือย้ายยศบอทให้อยู่สูงกว่า Verified', ephemeral: true });
        return;
    }

    // Check if already has the role
    if (member.roles.cache.has(verifiedRole.id)) {
        await interaction.reply({ content: '✅ คุณยืนยันตัวตนไปแล้ว!', ephemeral: true });
        return;
    }

    if (member.manageable === false) {
        await interaction.reply({
            content: '❌ บอทอยู่ต่ำกว่ายศของคุณใน Discord จึงยังให้ยศ Verified ไม่ได้ — กรุณาให้แอดมินลากยศ GANG-MANAGER ให้อยู่เหนือยศของคุณ แล้วลองอีกครั้ง',
            ephemeral: true,
        });
        return;
    }

    try {
        await member.roles.add(verifiedRole);
        await interaction.reply({
            content: '✅ **ยืนยันตัวตนสำเร็จ!**\n\nตอนนี้คุณสามารถเห็นห้องพื้นฐานที่แอดมินเปิดไว้ได้แล้ว\nหากต้องการเข้าร่วมแก๊ง ให้ไปที่ห้อง **ลงทะเบียน**',
            ephemeral: true,
        });
        logInfo('bot.verify.completed', {
            guildId: guild.id,
            guildName: guild.name,
            memberDiscordId: interaction.user.id,
            roleId: verifiedRole.id,
        });
    } catch (err) {
        logError('bot.verify.role_add_failed', err, {
            guildId: guild.id,
            memberDiscordId: interaction.user.id,
            roleId: verifiedRole.id,
        });
        await interaction.reply({ content: '❌ ไม่สามารถให้ยศได้ — กรุณาแจ้งแอดมิน', ephemeral: true });
    }
}
