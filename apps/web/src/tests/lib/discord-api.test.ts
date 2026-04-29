import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
    logError: vi.fn(),
    logWarn: vi.fn(),
}));

import { getDiscordChannels, getDiscordRoles } from '@/lib/discord-api';
import { logError, logWarn } from '@/lib/logger';

global.fetch = vi.fn();

describe('Discord API helpers', () => {
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        fetchMock.mockReset();
        delete process.env.DISCORD_BOT_TOKEN;
    });

    it('returns no roles and logs a warning when the bot token is missing', async () => {
        const roles = await getDiscordRoles('guild-1');

        expect(roles).toEqual([]);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(logWarn).toHaveBeenCalledWith('lib.discord.roles.token_missing', { guildId: 'guild-1' });
    });

    it('returns no channels and logs a warning when Discord returns a non-ok response', async () => {
        process.env.DISCORD_BOT_TOKEN = 'mock-token';
        fetchMock.mockResolvedValue({
            ok: false,
            status: 403,
            statusText: 'Forbidden',
        });

        const channels = await getDiscordChannels('guild-1');

        expect(channels).toEqual([]);
        expect(logWarn).toHaveBeenCalledWith('lib.discord.channels.fetch_failed', {
            guildId: 'guild-1',
            statusCode: 403,
            statusText: 'Forbidden',
        });
    });

    it('returns no roles and logs errors when Discord fetch throws', async () => {
        const error = new Error('network down');
        process.env.DISCORD_BOT_TOKEN = 'mock-token';
        fetchMock.mockRejectedValue(error);

        const roles = await getDiscordRoles('guild-1');

        expect(roles).toEqual([]);
        expect(logError).toHaveBeenCalledWith('lib.discord.roles.fetch_error', error, { guildId: 'guild-1' });
    });

    it('maps only text channels and sorts them by position', async () => {
        process.env.DISCORD_BOT_TOKEN = 'mock-token';
        fetchMock.mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue([
                { id: 'voice-1', name: 'Voice', type: 2, position: 1, parent_id: null },
                { id: 'text-2', name: 'general', type: 0, position: 20, parent_id: 'cat-1' },
                { id: 'text-1', name: 'announcements', type: 0, position: 10, parent_id: null },
            ]),
        });

        const channels = await getDiscordChannels('guild-1');

        expect(channels).toEqual([
            { id: 'text-1', name: 'announcements', type: 0, position: 10, parentId: null },
            { id: 'text-2', name: 'general', type: 0, position: 20, parentId: 'cat-1' },
        ]);
    });
});
