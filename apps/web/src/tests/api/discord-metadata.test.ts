import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/discord-api');
vi.mock('@/lib/gangAccess');
vi.mock('@/lib/logger', () => ({
    logError: vi.fn(),
    logWarn: vi.fn(),
    logInfo: vi.fn(),
}));
vi.mock('@/lib/apiRateLimit', () => ({
    enforceRouteRateLimit: vi.fn().mockResolvedValue(null),
    buildRateLimitSubject: vi.fn(() => 'discord:test'),
    getClientIp: vi.fn(() => '127.0.0.1'),
}));

import { GET as getRoles } from '@/app/api/discord/roles/route';
import { GET as getChannels } from '@/app/api/discord/channels/route';
import { getDiscordRoles, getDiscordChannels } from '@/lib/discord-api';
import { requireGangAccess, isGangAccessError } from '@/lib/gangAccess';

describe('Discord metadata routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (isGangAccessError as any).mockImplementation((error: any) => Boolean(error?.status));
    });

    it('returns 400 for missing guildId on roles route', async () => {
        const response = await getRoles(new Request('http://localhost/api/discord/roles'));

        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ error: 'Missing guildId' });
    });

    it('returns 403 when roles access is denied', async () => {
        (requireGangAccess as any).mockRejectedValue({ message: 'Forbidden', status: 403 });

        const response = await getRoles(new Request('http://localhost/api/discord/roles?guildId=guild-1'));

        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({ error: 'Forbidden' });
        expect(getDiscordRoles).not.toHaveBeenCalled();
    });

    it('returns roles when the requester is authorized', async () => {
        (requireGangAccess as any).mockResolvedValue({
            gang: { id: 'gang-1', discordGuildId: 'guild-1', name: 'Gang One' },
        });
        (getDiscordRoles as any).mockResolvedValue([{ id: 'role-1', name: 'Owner' }]);

        const response = await getRoles(new Request('http://localhost/api/discord/roles?guildId=guild-1'));

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual([{ id: 'role-1', name: 'Owner' }]);
        expect(requireGangAccess).toHaveBeenCalledWith({ guildId: 'guild-1', minimumRole: 'OWNER' });
    });

    it('returns 403 when channels access is denied', async () => {
        (requireGangAccess as any).mockRejectedValue({ message: 'Forbidden', status: 403 });

        const response = await getChannels(new Request('http://localhost/api/discord/channels?guildId=guild-1'));

        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({ error: 'Forbidden' });
        expect(getDiscordChannels).not.toHaveBeenCalled();
    });

    it('returns channels when the requester is authorized', async () => {
        (requireGangAccess as any).mockResolvedValue({
            gang: { id: 'gang-1', discordGuildId: 'guild-1', name: 'Gang One' },
        });
        (getDiscordChannels as any).mockResolvedValue([{ id: 'channel-1', name: 'finance' }]);

        const response = await getChannels(new Request('http://localhost/api/discord/channels?guildId=guild-1'));

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual([{ id: 'channel-1', name: 'finance' }]);
        expect(requireGangAccess).toHaveBeenCalledWith({ guildId: 'guild-1', minimumRole: 'OWNER' });
    });
});
