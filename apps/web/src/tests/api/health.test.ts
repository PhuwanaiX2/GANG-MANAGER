import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/health/route';

const { findFirst } = vi.hoisted(() => ({
    findFirst: vi.fn(),
}));

vi.mock('@gang/database', () => ({
    db: {
        query: {
            gangs: {
                findFirst,
            },
        },
    },
}));

describe('Health API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 200 when the web app can reach Turso', async () => {
        findFirst.mockResolvedValue(null);

        const res = await GET();
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.status).toBe('ok');
        expect(json.app).toBe('web');
        expect(json.database).toBe('up');
    });

    it('returns 503 when the web app cannot reach Turso', async () => {
        findFirst.mockRejectedValue(new Error('connect ECONNREFUSED'));

        const res = await GET();
        const json = await res.json();

        expect(res.status).toBe(503);
        expect(json.status).toBe('degraded');
        expect(json.app).toBe('web');
        expect(json.database).toBe('down');
        expect(json.error).toContain('ECONNREFUSED');
    });
});
