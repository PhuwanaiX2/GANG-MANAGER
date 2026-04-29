import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/debug/db/route';

const { findGangs, findMembers } = vi.hoisted(() => ({
    findGangs: vi.fn(),
    findMembers: vi.fn(),
}));

vi.mock('next-auth');
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/logger', () => ({
    logError: vi.fn(),
    logWarn: vi.fn(),
}));
vi.mock('@gang/database', () => ({
    db: {
        query: {
            gangs: {
                findMany: findGangs,
            },
            members: {
                findMany: findMembers,
            },
        },
    },
}));

import { getServerSession } from 'next-auth';
import { logWarn } from '@/lib/logger';

describe('GET /api/debug/db', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.NODE_ENV = 'test';
        delete process.env.ENABLE_DEBUG_ROUTES;
        delete process.env.ADMIN_DISCORD_IDS;
        (getServerSession as any).mockResolvedValue({
            user: { discordId: 'admin-1' },
        });
        findGangs.mockResolvedValue([]);
        findMembers.mockResolvedValue([]);
    });

    afterEach(() => {
        process.env.NODE_ENV = originalNodeEnv;
    });

    it('fails closed in production before auth or database access', async () => {
        process.env.NODE_ENV = 'production';
        process.env.ENABLE_DEBUG_ROUTES = 'true';
        process.env.ADMIN_DISCORD_IDS = 'admin-1';

        const res = await GET();

        expect(res.status).toBe(404);
        await expect(res.json()).resolves.toMatchObject({ error: 'Not found' });
        expect(getServerSession).not.toHaveBeenCalled();
        expect(findGangs).not.toHaveBeenCalled();
        expect(findMembers).not.toHaveBeenCalled();
    });

    it('fails closed when debug routes are not explicitly enabled', async () => {
        process.env.ADMIN_DISCORD_IDS = 'admin-1';

        const res = await GET();

        expect(res.status).toBe(404);
        expect(getServerSession).not.toHaveBeenCalled();
        expect(findGangs).not.toHaveBeenCalled();
        expect(findMembers).not.toHaveBeenCalled();
    });

    it('rejects non-admin callers before database access', async () => {
        process.env.ENABLE_DEBUG_ROUTES = 'true';
        process.env.ADMIN_DISCORD_IDS = 'admin-1';
        (getServerSession as any).mockResolvedValue({
            user: { discordId: 'member-1' },
        });

        const res = await GET();

        expect(res.status).toBe(403);
        await expect(res.json()).resolves.toMatchObject({ error: 'Forbidden' });
        expect(logWarn).toHaveBeenCalledWith('api.debug_db.forbidden', {
            actorDiscordId: 'member-1',
        });
        expect(findGangs).not.toHaveBeenCalled();
        expect(findMembers).not.toHaveBeenCalled();
    });

    it('returns summarized database diagnostics for explicitly allowed admins only', async () => {
        process.env.ENABLE_DEBUG_ROUTES = 'true';
        process.env.ADMIN_DISCORD_IDS = 'admin-1';
        findGangs.mockResolvedValueOnce([
            { id: 'gang-1', name: 'Gang One', discordGuildId: 'guild-1' },
        ]);
        findMembers.mockResolvedValueOnce([
            { id: 'member-1', name: 'Alice', gangId: 'gang-1' },
            { id: 'member-2', name: 'Orphan', gangId: 'missing-gang' },
        ]);

        const res = await GET();
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.summary).toEqual({
            totalGangs: 1,
            totalMembers: 2,
            orphanedMembers: 1,
        });
        expect(json.members[1]).toMatchObject({ id: 'member-2', isOrphaned: true });
    });
});
