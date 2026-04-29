import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth');
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@gang/database');
vi.mock('@/lib/apiRateLimit', () => ({
    enforceRouteRateLimit: vi.fn().mockResolvedValue(null),
    buildRateLimitSubject: vi.fn(() => 'admin:backup:test'),
}));
vi.mock('@/lib/logger', () => ({
    logError: vi.fn(),
    logInfo: vi.fn(),
    logWarn: vi.fn(),
}));

describe('Admin backup API', () => {
    let GET: typeof import('@/app/api/admin/backup/route').GET;
    let POST: typeof import('@/app/api/admin/backup/route').POST;
    let getServerSessionMock: any;
    let dbModule: any;
    let loggerModule: any;

    const mockSelectSequence = (datasets: unknown[]) => {
        (dbModule.db as any).select = vi.fn(() => ({
            from: vi.fn().mockImplementation(() => Promise.resolve(datasets.shift() ?? [])),
        }));
    };

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.resetModules();
        process.env.ADMIN_DISCORD_IDS = 'admin-123';

        const nextAuth = await import('next-auth');
        dbModule = await import('@gang/database');
        loggerModule = await import('@/lib/logger');
        ({ GET, POST } = await import('@/app/api/admin/backup/route'));

        getServerSessionMock = nextAuth.getServerSession as any;
        getServerSessionMock.mockResolvedValue({
            user: { discordId: 'admin-123' },
        });
    });

    it('returns 403 when requester is not an admin', async () => {
        getServerSessionMock.mockResolvedValue({ user: { discordId: 'user-999' } });

        const res = await GET(new NextRequest('http://localhost:3000/api/admin/backup'));

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

        mockSelectSequence(datasets);

        const res = await GET(new NextRequest('http://localhost:3000/api/admin/backup'));
        const text = await res.text();

        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toContain('application/json');
        expect(res.headers.get('Content-Disposition')).toContain('backup-');
        expect(text).toContain('gang-1');
        expect(text).toContain('license-1');
    });

    it('returns a structural backup preview for valid restore preview requests', async () => {
        const backupPayload = {
            timestamp: '2026-04-20T00:00:00.000Z',
            gangs: [{ id: 'gang-1' }],
            gangSettings: [{ id: 'settings-1', gangId: 'gang-1' }],
            gangRoles: [{ id: 'role-1', gangId: 'gang-1' }],
            members: [{ id: 'member-1', gangId: 'gang-1' }],
            attendanceSessions: [{ id: 'session-1', gangId: 'gang-1' }],
            attendanceRecords: [{ id: 'record-1', memberId: 'member-1', sessionId: 'session-1' }],
            leaveRequests: [],
            transactions: [],
            auditLogs: [],
            licenses: [{ id: 'license-1' }],
        };

        mockSelectSequence([
            [{ id: 'gang-1' }, { id: 'gang-live-only' }],
            [{ id: 'settings-1' }],
            [{ id: 'role-legacy' }],
            [{ id: 'member-1' }],
            [{ id: 'session-1' }],
            [{ id: 'record-legacy' }],
            [],
            [],
            [],
            [{ id: 'license-live-only' }],
        ]);

        const req = new NextRequest('http://localhost:3000/api/admin/backup', {
            method: 'POST',
            body: JSON.stringify({
                action: 'preview_restore',
                fileName: 'backup.json',
                backupJson: JSON.stringify(backupPayload),
            }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.preview.fileName).toBe('backup.json');
        expect(data.preview.isValid).toBe(true);
        expect(data.preview.totalRecords).toBe(7);
        expect(data.preview.issues).toHaveLength(0);
        expect(data.preview.impact).toMatchObject({
            hasExistingData: true,
            hasIdCollisions: true,
            strategyHint: 'review_required',
            totals: {
                createCount: 3,
                overwriteCount: 4,
                liveOnlyCount: 4,
                rowsWithoutId: 0,
            },
        });
        expect(data.preview.impact.notes.length).toBeGreaterThan(0);
    });

    it('logs restore preview failures through the structured logger', async () => {
        const error = new Error('select failed');
        const backupPayload = {
            timestamp: '2026-04-20T00:00:00.000Z',
            gangs: [{ id: 'gang-1' }],
            gangSettings: [],
            gangRoles: [],
            members: [],
            attendanceSessions: [],
            attendanceRecords: [],
            leaveRequests: [],
            transactions: [],
            auditLogs: [],
            licenses: [],
        };

        (dbModule.db as any).select = vi.fn(() => {
            throw error;
        });

        const req = new NextRequest('http://localhost:3000/api/admin/backup', {
            method: 'POST',
            body: JSON.stringify({
                action: 'preview_restore',
                fileName: 'backup.json',
                backupJson: JSON.stringify(backupPayload),
            }),
        });

        const res = await POST(req);

        expect(res.status).toBe(500);
        expect(loggerModule.logError).toHaveBeenCalledWith('api.admin.backup.preview.failed', error, expect.objectContaining({
            actorDiscordId: 'admin-123',
            action: 'preview_restore',
            fileName: 'backup.json',
        }));
    });

    it('builds a restore plan for valid preview_restore_plan requests', async () => {
        const backupPayload = {
            timestamp: '2026-04-20T00:00:00.000Z',
            gangs: [{ id: 'gang-1' }],
            gangSettings: [{ id: 'settings-1', gangId: 'gang-1' }],
            gangRoles: [{ id: 'role-1', gangId: 'gang-1' }],
            members: [{ id: 'member-1', gangId: 'gang-1' }],
            attendanceSessions: [{ id: 'session-1', gangId: 'gang-1' }],
            attendanceRecords: [{ id: 'record-1', memberId: 'member-1', sessionId: 'session-1' }],
            leaveRequests: [],
            transactions: [],
            auditLogs: [],
            licenses: [{ id: 'license-1' }],
        };

        mockSelectSequence([
            [{ id: 'gang-1' }, { id: 'gang-live-only' }],
            [{ id: 'settings-1' }],
            [{ id: 'role-legacy' }],
            [{ id: 'member-1' }],
            [{ id: 'session-1' }],
            [{ id: 'record-legacy' }],
            [],
            [],
            [],
            [{ id: 'license-live-only' }],
        ]);

        const req = new NextRequest('http://localhost:3000/api/admin/backup', {
            method: 'POST',
            body: JSON.stringify({
                action: 'preview_restore_plan',
                fileName: 'backup.json',
                strategy: 'create_only',
                backupJson: JSON.stringify(backupPayload),
            }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.plan).toMatchObject({
            fileName: 'backup.json',
            strategy: 'create_only',
            requiresManualReview: true,
            summary: {
                plannedCreates: 3,
                plannedOverwrites: 0,
                skippedRecords: 4,
                liveOnlyCount: 4,
            },
        });
        expect(data.plan.collections.find((collection: any) => collection.key === 'gangs')).toMatchObject({
            createCount: 0,
            overwriteCount: 0,
            skipCount: 1,
            liveOnlyCount: 1,
        });
    });

    it('rejects invalid JSON files during restore preview', async () => {
        const req = new NextRequest('http://localhost:3000/api/admin/backup', {
            method: 'POST',
            body: JSON.stringify({
                action: 'preview_restore',
                fileName: 'broken.json',
                backupJson: '{not valid json}',
            }),
        });

        const res = await POST(req);

        expect(res.status).toBe(400);
        await expect(res.json()).resolves.toMatchObject({
            error: expect.stringContaining('JSON'),
        });
    });

    it('rejects delete_gang_data requests without gangId', async () => {
        const req = new NextRequest('http://localhost:3000/api/admin/backup', {
            method: 'POST',
            body: JSON.stringify({ action: 'delete_gang_data' }),
        });

        const res = await POST(req);

        expect(res.status).toBe(400);
        await expect(res.json()).resolves.toMatchObject({
            error: expect.stringContaining('gangId'),
        });
    });

    it('logs purge failures through the structured logger', async () => {
        const error = new Error('delete failed');
        (dbModule.db as any).delete = vi.fn(() => {
            throw error;
        });

        const req = new NextRequest('http://localhost:3000/api/admin/backup', {
            method: 'POST',
            body: JSON.stringify({
                action: 'purge_audit_logs',
                olderThanDays: 30,
            }),
        });

        const res = await POST(req);

        expect(res.status).toBe(500);
        expect(loggerModule.logError).toHaveBeenCalledWith('api.admin.backup.purge.failed', error, expect.objectContaining({
            actorDiscordId: 'admin-123',
            action: 'purge_audit_logs',
            olderThanDays: 30,
        }));
    });
});
