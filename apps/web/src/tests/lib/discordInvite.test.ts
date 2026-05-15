import { afterEach, describe, expect, it } from 'vitest';

describe('Discord bot invite URL', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    it('builds the default production bot invite with required scopes and permissions', async () => {
        delete process.env.DISCORD_BOT_INVITE_URL;
        delete process.env.DISCORD_CLIENT_ID;

        const { DEFAULT_DISCORD_BOT_CLIENT_ID, DISCORD_BOT_INVITE_PERMISSIONS, getDiscordBotInviteUrl } = await import('@/lib/discordInvite');
        const url = new URL(getDiscordBotInviteUrl());

        expect(url.origin).toBe('https://discord.com');
        expect(url.pathname).toBe('/oauth2/authorize');
        expect(url.searchParams.get('client_id')).toBe(DEFAULT_DISCORD_BOT_CLIENT_ID);
        expect(url.searchParams.get('client_id')).toBe('1468534739911573544');
        expect(url.searchParams.get('permissions')).toBe(DISCORD_BOT_INVITE_PERMISSIONS);
        expect(url.searchParams.get('scope')).toBe('bot applications.commands');
    });

    it('uses DISCORD_CLIENT_ID when configured', async () => {
        delete process.env.DISCORD_BOT_INVITE_URL;
        process.env.DISCORD_CLIENT_ID = 'custom-client-id';

        const { getDiscordBotInviteUrl } = await import('@/lib/discordInvite');
        const url = new URL(getDiscordBotInviteUrl());

        expect(url.searchParams.get('client_id')).toBe('custom-client-id');
    });

    it('allows an explicit invite URL override', async () => {
        process.env.DISCORD_BOT_INVITE_URL = 'https://discord.com/oauth2/authorize?client_id=override&scope=bot';

        const { getDiscordBotInviteUrl } = await import('@/lib/discordInvite');

        expect(getDiscordBotInviteUrl()).toBe(process.env.DISCORD_BOT_INVITE_URL);
    });
});
