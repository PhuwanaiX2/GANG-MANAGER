import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { GET as getMyProfile } from '../../app/api/gangs/[gangId]/my-profile/route';
import { GET as exportFinance } from '../../app/api/gangs/[gangId]/finance/export/route';
import { GET as getFinanceSummary } from '../../app/api/gangs/[gangId]/finance/summary/route';
import { GET as getFinanceAudit } from '../../app/api/gangs/[gangId]/finance/audit/route';

vi.mock('next-auth');
vi.mock('@gang/database');
vi.mock('@/lib/gangAccess', () => {
    class GangAccessError extends Error {
        constructor(
            message: string,
            public readonly status: number
        ) {
            super(message);
            this.name = 'GangAccessError';
        }
    }

    return {
        GangAccessError,
        isGangAccessError: (error: unknown) => error instanceof GangAccessError,
        requireGangAccess: vi.fn(),
    };
});
vi.mock('@/lib/tierGuard');
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/logger', () => ({
    logError: vi.fn(),
    logWarn: vi.fn(),
    logInfo: vi.fn(),
}));
vi.mock('@/lib/apiRateLimit', () => ({
    enforceRouteRateLimit: vi.fn().mockResolvedValue(null),
    buildRateLimitSubject: vi.fn(() => 'finance-reporting:test'),
}));

import { getServerSession } from 'next-auth';
import { db, getOutstandingLoanDebt } from '@gang/database';
import { GangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { checkTierAccess } from '@/lib/tierGuard';
import { enforceRouteRateLimit } from '@/lib/apiRateLimit';

function createSelectResult(rows: any) {
    return {
        from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(rows),
        }),
    };
}

function tooManyRequests() {
    return new Response(JSON.stringify({ error: 'Too Many Requests' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('Finance reporting compatibility routes', () => {
    const mockGangId = 'gang-123';

    beforeEach(() => {
        vi.clearAllMocks();

        (requireGangAccess as any).mockResolvedValue({
            gang: { id: mockGangId },
            member: { discordId: 'discord-123' },
            session: { user: { discordId: 'discord-123' } },
        });
        (enforceRouteRateLimit as any).mockResolvedValue(null);
        (checkTierAccess as any).mockResolvedValue({ allowed: true });
    });

    it('my-profile: should return separated finance summary', async () => {
        (getServerSession as any).mockResolvedValue({
            user: { discordId: 'discord-123' },
        });

        (db as any).query = {
            members: {
                findFirst: vi.fn().mockResolvedValue({
                    id: 'mem-1',
                    name: 'Alice',
                    discordUsername: 'alice',
                    discordAvatar: 'avatar.png',
                    gangRole: 'MEMBER',
                    balance: 320,
                    createdAt: new Date('2026-01-01T00:00:00.000Z'),
                }),
            },
            transactions: {
                findMany: vi.fn().mockResolvedValue([
                    {
                        id: 'txn-1',
                        type: 'DEPOSIT',
                        amount: 200,
                        status: 'APPROVED',
                        createdAt: new Date('2026-04-01T00:00:00.000Z'),
                    },
                ]),
            },
        };

        (db as any).select = vi.fn()
            .mockReturnValueOnce(createSelectResult([{ count: 12 }]))
            .mockReturnValueOnce(createSelectResult([{ count: 9 }]))
            .mockReturnValueOnce(createSelectResult([{ count: 2 }]))
            .mockReturnValueOnce(createSelectResult([{ count: 1 }]))
            .mockReturnValueOnce(createSelectResult([{ sum: 150 }]))
            .mockReturnValueOnce(createSelectResult([{ total: 480 }]));

        (getOutstandingLoanDebt as any).mockResolvedValue(700);

        const req = new NextRequest('http://localhost:3000/api/gangs/gang-123/my-profile');
        const res = await getMyProfile(req, { params: { gangId: mockGangId } });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.financeSummary).toEqual({
            loanDebt: 700,
            collectionDue: 480,
            availableCredit: 320,
        });
        expect(json.totalPenalties).toBe(150);
    });

    it('my-profile: should hide finance data when finance access is unavailable', async () => {
        (getServerSession as any).mockResolvedValue({
            user: { discordId: 'discord-123' },
        });
        (checkTierAccess as any).mockResolvedValue({ allowed: false, message: 'Upgrade required' });

        (db as any).query = {
            members: {
                findFirst: vi.fn().mockResolvedValue({
                    id: 'mem-1',
                    name: 'Alice',
                    discordUsername: 'alice',
                    discordAvatar: 'avatar.png',
                    gangRole: 'MEMBER',
                    balance: 320,
                    createdAt: new Date('2026-01-01T00:00:00.000Z'),
                }),
            },
            transactions: {
                findMany: vi.fn(),
            },
        };

        (db as any).select = vi.fn()
            .mockReturnValueOnce(createSelectResult([{ count: 12 }]))
            .mockReturnValueOnce(createSelectResult([{ count: 9 }]))
            .mockReturnValueOnce(createSelectResult([{ count: 2 }]))
            .mockReturnValueOnce(createSelectResult([{ count: 1 }]));

        const req = new NextRequest('http://localhost:3000/api/gangs/gang-123/my-profile');
        const res = await getMyProfile(req, { params: { gangId: mockGangId } });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(checkTierAccess).toHaveBeenCalledWith(mockGangId, 'finance');
        expect(json.member.balance).toBe(0);
        expect(json.transactions).toEqual([]);
        expect(json.financeSummary).toEqual({
            loanDebt: 0,
            collectionDue: 0,
            availableCredit: 0,
        });
        expect(json.totalPenalties).toBe(0);
        expect(db.query.transactions.findMany).not.toHaveBeenCalled();
        expect(getOutstandingLoanDebt).not.toHaveBeenCalled();
    });

    it('my-profile: should rate limit before member lookup and finance aggregation', async () => {
        (getServerSession as any).mockResolvedValue({
            user: { discordId: 'discord-123' },
        });
        (enforceRouteRateLimit as any).mockResolvedValue(tooManyRequests());

        const findMember = vi.fn();
        (db as any).query = {
            members: {
                findFirst: findMember,
            },
        };
        (db as any).select = vi.fn();
        (getOutstandingLoanDebt as any).mockResolvedValue(0);

        const req = new NextRequest('http://localhost:3000/api/gangs/gang-123/my-profile');
        const res = await getMyProfile(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(429);
        await expect(res.json()).resolves.toMatchObject({ error: 'Too Many Requests' });
        expect(findMember).not.toHaveBeenCalled();
        expect((db as any).select).not.toHaveBeenCalled();
        expect(getOutstandingLoanDebt).not.toHaveBeenCalled();
    });

    it('finance export: should reject users without owner or treasurer permission', async () => {
        (requireGangAccess as any).mockRejectedValue(new GangAccessError('Forbidden', 403));

        const req = new NextRequest('http://localhost:3000/api/gangs/gang-123/finance/export');
        const res = await exportFinance(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(403);
        await expect(res.text()).resolves.toContain('Forbidden');
    });

    it('finance export: should reject unauthenticated users', async () => {
        (requireGangAccess as any).mockRejectedValue(new GangAccessError('Unauthorized', 401));

        const req = new NextRequest('http://localhost:3000/api/gangs/gang-123/finance/export');
        const res = await exportFinance(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(401);
        await expect(res.text()).resolves.toContain('Unauthorized');
    });

    it('finance summary: should reject users without treasurer access before DB aggregation', async () => {
        (requireGangAccess as any).mockRejectedValue(new GangAccessError('Forbidden', 403));
        (db as any).select = vi.fn();

        const req = new NextRequest('http://localhost:3000/api/gangs/gang-123/finance/summary');
        const res = await getFinanceSummary(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(403);
        await expect(res.json()).resolves.toMatchObject({ error: 'Forbidden' });
        expect(requireGangAccess).toHaveBeenCalledWith({ gangId: mockGangId, minimumRole: 'TREASURER' });
        expect((db as any).select).not.toHaveBeenCalled();
    });

    it('finance summary: should rate limit before DB aggregation', async () => {
        (enforceRouteRateLimit as any).mockResolvedValue(tooManyRequests());
        const findMembers = vi.fn();
        (db as any).select = vi.fn();
        (db as any).query = {
            members: {
                findMany: findMembers,
            },
        };

        const req = new NextRequest('http://localhost:3000/api/gangs/gang-123/finance/summary');
        const res = await getFinanceSummary(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(429);
        await expect(res.json()).resolves.toMatchObject({ error: 'Too Many Requests' });
        expect(requireGangAccess).toHaveBeenCalledWith({ gangId: mockGangId, minimumRole: 'TREASURER' });
        expect((db as any).select).not.toHaveBeenCalled();
        expect(findMembers).not.toHaveBeenCalled();
    });

    it('finance summary: should reject gangs without monthly summary access before DB aggregation', async () => {
        (checkTierAccess as any).mockResolvedValue({ allowed: false, message: 'Upgrade required' });
        const findMembers = vi.fn();
        (db as any).select = vi.fn();
        (db as any).query = {
            members: {
                findMany: findMembers,
            },
        };

        const req = new NextRequest('http://localhost:3000/api/gangs/gang-123/finance/summary');
        const res = await getFinanceSummary(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(403);
        await expect(res.json()).resolves.toMatchObject({ error: 'Upgrade required', upgrade: true });
        expect(checkTierAccess).toHaveBeenCalledWith(mockGangId, 'monthlySummary');
        expect((db as any).select).not.toHaveBeenCalled();
        expect(findMembers).not.toHaveBeenCalled();
    });

    it('finance audit: should reject users without member access before DB lookup', async () => {
        const findMany = vi.fn();
        (requireGangAccess as any).mockRejectedValue(new GangAccessError('Forbidden', 403));
        (db as any).query = {
            auditLogs: {
                findMany,
            },
        };

        const req = new NextRequest('http://localhost:3000/api/gangs/gang-123/finance/audit');
        const res = await getFinanceAudit(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(403);
        await expect(res.json()).resolves.toMatchObject({ error: 'Forbidden' });
        expect(requireGangAccess).toHaveBeenCalledWith({ gangId: mockGangId, minimumRole: 'MEMBER' });
        expect(findMany).not.toHaveBeenCalled();
    });

    it('finance audit: should rate limit before audit log lookup', async () => {
        const findMany = vi.fn();
        (enforceRouteRateLimit as any).mockResolvedValue(tooManyRequests());
        (db as any).query = {
            auditLogs: {
                findMany,
            },
        };

        const req = new NextRequest('http://localhost:3000/api/gangs/gang-123/finance/audit');
        const res = await getFinanceAudit(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(429);
        await expect(res.json()).resolves.toMatchObject({ error: 'Too Many Requests' });
        expect(requireGangAccess).toHaveBeenCalledWith({ gangId: mockGangId, minimumRole: 'MEMBER' });
        expect(findMany).not.toHaveBeenCalled();
    });

    it('finance audit: should reject gangs without finance access before audit log lookup', async () => {
        const findMany = vi.fn();
        (checkTierAccess as any).mockResolvedValue({ allowed: false, message: 'Upgrade required' });
        (db as any).query = {
            auditLogs: {
                findMany,
            },
        };

        const req = new NextRequest('http://localhost:3000/api/gangs/gang-123/finance/audit');
        const res = await getFinanceAudit(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(403);
        await expect(res.json()).resolves.toMatchObject({ error: 'Upgrade required', upgrade: true });
        expect(checkTierAccess).toHaveBeenCalledWith(mockGangId, 'finance');
        expect(findMany).not.toHaveBeenCalled();
    });

    it('finance export: should rate limit before tier check and CSV queries', async () => {
        (enforceRouteRateLimit as any).mockResolvedValue(tooManyRequests());
        const findTransactions = vi.fn();
        const findGang = vi.fn();
        (db as any).query = {
            transactions: {
                findMany: findTransactions,
            },
            gangs: {
                findFirst: findGang,
            },
        };

        const req = new NextRequest('http://localhost:3000/api/gangs/gang-123/finance/export');
        const res = await exportFinance(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(429);
        await expect(res.json()).resolves.toMatchObject({ error: 'Too Many Requests' });
        expect(requireGangAccess).toHaveBeenCalledWith({ gangId: mockGangId, minimumRole: 'TREASURER' });
        expect(checkTierAccess).not.toHaveBeenCalled();
        expect(findTransactions).not.toHaveBeenCalled();
        expect(findGang).not.toHaveBeenCalled();
    });

    it('finance export: should reject gangs without premium export access', async () => {
        (checkTierAccess as any).mockResolvedValue({ allowed: false, message: 'Upgrade required' });

        const req = new NextRequest('http://localhost:3000/api/gangs/gang-123/finance/export');
        const res = await exportFinance(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(403);
        await expect(res.text()).resolves.toContain('Upgrade required');
    });

    it('finance export: should label GANG_FEE rows as due-only in csv', async () => {
        (checkTierAccess as any).mockResolvedValue({ allowed: true });

        (db as any).query = {
            transactions: {
                findMany: vi.fn().mockResolvedValue([
                    {
                        id: 'txn-gf',
                        createdAt: new Date('2026-04-01T10:00:00.000Z'),
                        type: 'GANG_FEE',
                        description: 'ตั้งยอดเก็บเงินแก๊ง: เมษายน',
                        amount: 500,
                        status: 'APPROVED',
                        batchId: 'batch-1',
                        memberId: 'member-1',
                        member: { name: 'Alice' },
                        createdBy: { name: 'Admin' },
                        balanceBefore: 1000,
                        balanceAfter: 1000,
                        settledAt: null,
                    },
                    {
                        id: 'txn-dep',
                        createdAt: new Date('2026-04-02T10:00:00.000Z'),
                        type: 'DEPOSIT',
                        description: 'ชำระค่าเก็บเงินแก๊ง / ฝากเครดิต',
                        amount: 500,
                        status: 'APPROVED',
                        batchId: null,
                        memberId: 'member-1',
                        member: { name: 'Alice' },
                        createdBy: { name: 'Admin' },
                        balanceBefore: 1000,
                        balanceAfter: 1500,
                        settledAt: new Date('2026-04-02T10:30:00.000Z'),
                    },
                ]),
            },
            financeCollectionSettlements: {
                findMany: vi.fn().mockResolvedValue([
                    {
                        batchId: 'batch-1',
                        memberId: 'member-1',
                        transactionId: 'txn-gf',
                        amount: 100,
                        source: 'PRE_CREDIT',
                    },
                    {
                        batchId: 'batch-1',
                        memberId: 'member-1',
                        transactionId: 'txn-dep',
                        amount: 400,
                        source: 'DEPOSIT',
                    },
                ]),
            },
            gangs: {
                findFirst: vi.fn().mockResolvedValue({ name: 'Test Gang' }),
            },
        };

        const req = new NextRequest('http://localhost:3000/api/gangs/gang-123/finance/export');
        const res = await exportFinance(req, { params: { gangId: mockGangId } });
        const csv = await res.text();

        expect(res.status).toBe(200);
        expect(csv).toContain('LedgerEffect');
        expect(csv).toContain('SettlementSource');
        expect(csv).toContain('SettledAt');
        expect(csv).toContain('DUE_ONLY');
        expect(csv).toContain('CASH_INFLOW');
        expect(csv).toContain('PRE_CREDIT:100|DEPOSIT:400');
        expect(csv).toContain('DEPOSIT:400');
        expect(csv).toContain('ชำระค่าเก็บเงินแก๊ง / ฝากเครดิต');
    });
});
