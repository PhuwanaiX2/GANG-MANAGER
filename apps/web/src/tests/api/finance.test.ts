import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../../app/api/gangs/[gangId]/finance/route';
import { NextRequest } from 'next/server';

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
vi.mock('@/lib/logger', () => ({
    logInfo: vi.fn(),
    logWarn: vi.fn(),
    logError: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/apiRateLimit', () => ({
    enforceRouteRateLimit: vi.fn().mockResolvedValue(null),
    buildRateLimitSubject: vi.fn(() => 'finance:test'),
}));

import { getServerSession } from 'next-auth';
import { FinanceService, db } from '@gang/database';
import { GangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { checkTierAccess } from '@/lib/tierGuard';
import { enforceRouteRateLimit } from '@/lib/apiRateLimit';

describe('POST /api/gangs/[gangId]/finance', () => {
    const mockGangId = 'gang-123';
    const mockUserId = 'user-123';
    const mockActorMemberId = 'mem-admin-1';

    beforeEach(() => {
        vi.clearAllMocks();

        (checkTierAccess as any).mockResolvedValue({
            allowed: true,
            tier: 'PREMIUM',
            tierConfig: { name: 'Premium' },
            message: undefined,
        });
        (enforceRouteRateLimit as any).mockResolvedValue(null);
        (requireGangAccess as any).mockResolvedValue({
            gang: { id: mockGangId },
            member: { id: mockActorMemberId, discordId: mockUserId },
            session: { user: { discordId: mockUserId, name: 'Admin' } },
        });

        (db as any).query = {
            members: {
                findFirst: vi.fn().mockResolvedValue({ id: mockActorMemberId }),
            },
        };
    });

    const createRequest = (body: any) => new NextRequest('http://localhost:3000/api', {
        method: 'POST',
        body: JSON.stringify(body),
    });

    it('should return 401 if not authenticated', async () => {
        (getServerSession as any).mockResolvedValue(null);
        (requireGangAccess as any).mockRejectedValue(new GangAccessError('Unauthorized', 401));
        const req = createRequest({});
        const res = await POST(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(401);
    });

    it('should return 403 if user is not Treasurer or Owner', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId } });
        (requireGangAccess as any).mockRejectedValue(new GangAccessError('Forbidden', 403));

        const req = createRequest({});
        const res = await POST(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(403);
    });

    it('should validate request body schema', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId } });

        const req = createRequest({ type: 'INCOME', amount: -100, description: 'Test' });
        const res = await POST(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(400);
    });

    it('should return 429 when the durable finance rate limit is exceeded', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId } });
        (enforceRouteRateLimit as any).mockResolvedValue(
            new Response(JSON.stringify({ error: 'Too Many Requests' }), {
                status: 429,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        const req = createRequest({ type: 'INCOME', amount: 500, description: 'Blocked by throttling' });
        const res = await POST(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(429);
        await expect(res.json()).resolves.toMatchObject({ error: 'Too Many Requests' });
        expect(FinanceService.createTransaction).not.toHaveBeenCalled();
    });

    it('should process INCOME transaction successfully', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Admin' } });

        (FinanceService.createTransaction as any) = vi.fn().mockResolvedValue({
            transactionId: 'txn-1',
            newGangBalance: 1500,
        });

        const body = { type: 'INCOME', amount: 500, description: 'Sold items' };
        const req = createRequest(body);
        const res = await POST(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);

        expect(FinanceService.createTransaction).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                gangId: mockGangId,
                type: 'INCOME',
                amount: 500,
                description: 'Sold items',
                actorId: mockActorMemberId,
                actorName: 'Admin',
            })
        );
    });

    it('should prevent EXPENSE if insufficient funds', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId } });

        (FinanceService.createTransaction as any) = vi.fn().mockRejectedValue(
            new Error('เงินกองกลางไม่พอ')
        );

        const body = { type: 'EXPENSE', amount: 500, description: 'Buy items' };
        const req = createRequest(body);
        const res = await POST(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toBe('เงินกองกลางไม่พอ');
    });

    it('should retry or fail on OCC conflict', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId } });

        (FinanceService.createTransaction as any) = vi.fn().mockRejectedValue(
            new Error('Concurrency Conflict: Balance was updated by another transaction. Please try again.')
        );

        const body = { type: 'INCOME', amount: 500, description: 'Conflict test' };
        const req = createRequest(body);
        const res = await POST(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(409);
        const json = await res.json();
        expect(json.error).toContain('concurrent update');
    });

    it('should process LOAN correctly (Gang decreases, Member increases)', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Admin' } });

        (FinanceService.createTransaction as any) = vi.fn().mockResolvedValue({
            transactionId: 'txn-2',
            newGangBalance: 500,
        });

        const body = { type: 'LOAN', amount: 500, description: 'Test Loan', memberId: 'mem-1' };
        const req = createRequest(body);
        const res = await POST(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(200);
        expect(FinanceService.createTransaction).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                type: 'LOAN',
                amount: 500,
                memberId: 'mem-1',
            })
        );
    });

    it('should process REPAYMENT correctly and validate member funds', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Admin' } });

        (FinanceService.createTransaction as any) = vi.fn().mockResolvedValue({
            transactionId: 'txn-3',
            newGangBalance: 1500,
        });

        const body = { type: 'REPAYMENT', amount: 500, description: 'Return Loan', memberId: 'mem-1' };
        const req = createRequest(body);
        const res = await POST(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(200);
        expect(FinanceService.createTransaction).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                type: 'REPAYMENT',
                amount: 500,
                description: 'ชำระหนี้ยืมเข้ากองกลาง',
                memberId: 'mem-1',
            })
        );
    });

    it('should process DEPOSIT with collection-payment and credit wording', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Admin' } });

        (FinanceService.createTransaction as any) = vi.fn().mockResolvedValue({
            transactionId: 'txn-4',
            newGangBalance: 1500,
        });

        const body = { type: 'DEPOSIT', amount: 500, description: 'Top up', memberId: 'mem-1' };
        const req = createRequest(body);
        const res = await POST(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(200);
        expect(FinanceService.createTransaction).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                type: 'DEPOSIT',
                amount: 500,
                description: 'ชำระค่าเก็บเงินแก๊ง / ฝากเครดิต',
                memberId: 'mem-1',
            })
        );
    });

    it('should fail REPAYMENT if member has insufficient funds', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Admin' } });

        (FinanceService.createTransaction as any) = vi.fn().mockRejectedValue(
            new Error('สมาชิกไม่มีหนี้ยืมค้างชำระ')
        );

        const body = { type: 'REPAYMENT', amount: 500, description: 'Return Loan', memberId: 'mem-1' };
        const req = createRequest(body);
        const res = await POST(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toBe('สมาชิกไม่มีหนี้ยืมค้างชำระ');
    });
});
