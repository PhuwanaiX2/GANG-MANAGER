import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/system-announcements/route';

const { findMany } = vi.hoisted(() => ({
    findMany: vi.fn(),
}));

vi.mock('@gang/database', () => ({
    db: {
        query: {
            systemAnnouncements: {
                findMany,
            },
        },
    },
    systemAnnouncements: {
        id: 'systemAnnouncements.id',
        title: 'systemAnnouncements.title',
        content: 'systemAnnouncements.content',
        type: 'systemAnnouncements.type',
        isActive: 'systemAnnouncements.isActive',
        expiresAt: 'systemAnnouncements.expiresAt',
        createdAt: 'systemAnnouncements.createdAt',
    },
}));

vi.mock('drizzle-orm', () => ({
    sql: vi.fn(() => 'sql-fragment'),
    desc: vi.fn((column) => ({ desc: column })),
}));

vi.mock('@/lib/apiRateLimit', () => ({
    enforceRouteRateLimit: vi.fn().mockResolvedValue(null),
}));

import { enforceRouteRateLimit } from '@/lib/apiRateLimit';

describe('GET /api/system-announcements', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (enforceRouteRateLimit as any).mockResolvedValue(null);
        findMany.mockResolvedValue([]);
    });

    it('returns active announcements', async () => {
        findMany.mockResolvedValueOnce([
            { id: 'ann-1', title: 'Heads up', content: 'Maintenance', type: 'info' },
        ]);

        const res = await GET(new Request('http://localhost:3000/api/system-announcements'));

        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual([
            { id: 'ann-1', title: 'Heads up', content: 'Maintenance', type: 'info' },
        ]);
        expect(findMany).toHaveBeenCalledTimes(1);
    });

    it('returns 429 before database lookup when rate limited', async () => {
        (enforceRouteRateLimit as any).mockResolvedValue(new Response(
            JSON.stringify({ error: 'Too Many Requests' }),
            { status: 429, headers: { 'Content-Type': 'application/json' } }
        ));

        const res = await GET(new Request('http://localhost:3000/api/system-announcements'));

        expect(res.status).toBe(429);
        await expect(res.json()).resolves.toMatchObject({ error: 'Too Many Requests' });
        expect(findMany).not.toHaveBeenCalled();
    });
});
