export const DEFAULT_DISCORD_BOT_CLIENT_ID = '1468534739911573544';

export const DISCORD_BOT_INVITE_PERMISSIONS = [
    16, // Manage Channels
    1024, // View Channels
    2048, // Send Messages
    16384, // Embed Links
    32768, // Attach Files
    65536, // Read Message History
    268435456, // Manage Roles
    2147483648, // Use Application Commands
].reduce((total, permission) => total + permission, 0).toString();

export function getDiscordBotInviteUrl() {
    const overrideUrl = process.env.DISCORD_BOT_INVITE_URL?.trim();
    if (overrideUrl) {
        return overrideUrl;
    }

    const clientId = process.env.DISCORD_CLIENT_ID?.trim() || DEFAULT_DISCORD_BOT_CLIENT_ID;
    const params = new URLSearchParams({
        client_id: clientId,
        permissions: DISCORD_BOT_INVITE_PERMISSIONS,
        scope: 'bot applications.commands',
    });

    return `https://discord.com/oauth2/authorize?${params.toString()}`;
}
