export function getAdminDiscordIds(raw = process.env.ADMIN_DISCORD_IDS) {
    return (raw || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
}

export function isAdminDiscordId(discordId: string | null | undefined): discordId is string {
    if (!discordId) return false;
    return getAdminDiscordIds().includes(discordId);
}
