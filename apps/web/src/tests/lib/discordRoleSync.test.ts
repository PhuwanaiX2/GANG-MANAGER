import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addMappedDiscordRole, removeMappedDiscordRole } from '@/lib/discordRoleSync';

vi.mock('@/lib/logger', () => ({
    logWarn: vi.fn(),
}));

global.fetch = vi.fn();

describe('discord role sync helpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.DISCORD_BOT_TOKEN = 'bot-token';
    });

    it('skips adding a Discord role when the caller marks the target as the Discord guild owner', async () => {
        const result = await addMappedDiscordRole({
            gangId: 'gang-1',
            memberId: 'member-owner',
            discordId: 'discord-owner',
            guildId: 'guild-1',
            roleMappings: [{ permissionLevel: 'OWNER', discordRoleId: 'role-owner' }],
            permissionLevel: 'OWNER',
            event: 'test.owner.add',
            skipDiscordRoleSync: true,
            skipReason: 'discord_guild_owner',
        });

        expect(result).toEqual({ ok: true, skipped: true, reason: 'discord_guild_owner' });
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('skips removing a Discord role when the caller marks the target as the Discord guild owner', async () => {
        const result = await removeMappedDiscordRole({
            gangId: 'gang-1',
            memberId: 'member-owner',
            discordId: 'discord-owner',
            guildId: 'guild-1',
            roleMappings: [{ permissionLevel: 'OWNER', discordRoleId: 'role-owner' }],
            permissionLevel: 'OWNER',
            event: 'test.owner.remove',
            strict: true,
            skipDiscordRoleSync: true,
            skipReason: 'discord_guild_owner',
        });

        expect(result).toEqual({ ok: true, skipped: true, reason: 'discord_guild_owner' });
        expect(global.fetch).not.toHaveBeenCalled();
    });
});
