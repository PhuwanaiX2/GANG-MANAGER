import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth');
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@gang/database');

describe('Admin backup API', () => {
    let GET: typeof import('@/app/api/admin/backup/route').GET;
    let POST: typeof import('@/app/api/admin/backup/route').POST;
    let getServerSessionMock: any;
    let dbModule: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.resetModules();
        process.env.ADMIN_DISCORD_IDS = 'admin-123';

        const nextAuth = await import('next-auth');
        dbModule = await import('@gang/database');
        ({ GET, POST } = await import('@/app/api/admin/backup/route'));

        getServerSessionMock = nextAuth.getServerSession as any;
        getServerSessionMock.mockResolvedValue({
            user: { discordId: 'admin-123' },
        });
    });

    it('returns 403 when requester is not an admin', async () => {
        getServerSessionMock.mockResolvedValue({ user: { discordId: 'user-999' } });

        const res = await GET();

        expect(res.status).toBe(403);
        await expect(res.json()).resolves.toMatchObject({ error: 'Forbidden' });
    });

    it('returns a downloadable JSON backup for admins', async () => {
        const datasets = [
            [{ id: 'gang-1' }],
            [{ id: 'settings-1' }],
            [{ id: 'role-1' }],
            [{ id: 'member-1' }],
            [{ id: 'session-1' }],
            [{ id: 'record-1' }],
            [{ id: 'leave-1' }],
            [{ id: 'txn-1' }],
            [{ id: 'audit-1' }],
            [{ id: 'license-1' }],
        ];

        (dbModule.db as any).select = vi.fn(() => ({
            from: vi.fn().mockImplementation(() => Promise.resolve(datasets.shift() ?? [])),
        }));

        const res = await GET();
        const text = await res.text();

        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toContain('application/json');
        expect(res.headers.get('Content-Disposition')).toContain('backup-');
        expect(text).toContain('gang-1');
        expect(text).toContain('license-1');
    });

    it('rejects delete_gang_data requests without gangId', async () => {
        const req = new NextRequest('http://localhost:3000/api/admin/backup', {
            method: 'POST',
            body: JSON.stringify({ action: 'delete_gang_data' }),
        });

        const res = await POST(req);

        expect(res.status).toBe(400);
        await expect(res.json()).resolves.toMatchObject({ error: 'ต้องระบุ gangId' });
    });
});
