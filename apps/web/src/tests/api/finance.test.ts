import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../../app/api/gangs/[gangId]/finance/route';
import { NextRequest } from 'next/server';

// Mock Dependencies
vi.mock('next-auth');
vi.mock('@gang/database');
vi.mock('@/lib/permissions');
vi.mock('@/lib/tierGuard');
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

// Imports for mocking
import { getServerSession } from 'next-auth';
import { FinanceService, db } from '@gang/database';
import { getGangPermissions } from '@/lib/permissions';
import { checkTierAccess } from '@/lib/tierGuard';

describe('POST /api/gangs/[gangId]/finance', () => {
    const mockGangId = 'gang-123';
    const mockUserId = 'user-123';
    const mockActorMemberId = 'mem-admin-1';

    beforeEach(() => {
        vi.clearAllMocks();

        (checkTierAccess as any).mockResolvedValue({
            allowed: true,
            tier: 'PRO',
            tierConfig: { name: 'PRO' },
            message: undefined,
        });

        // Route fetches actor member record (internal id) before calling FinanceService
        (db as any).query = {
            members: {
                findFirst: vi.fn().mockResolvedValue({ id: mockActorMemberId }),
            },
        };
    });

    const createRequest = (body: any) => {
        return new NextRequest('http://localhost:3000/api', {
            method: 'POST',
            body: JSON.stringify(body),
        });
    };

    it('should return 401 if not authenticated', async () => {
        (getServerSession as any).mockResolvedValue(null);
        const req = createRequest({});
        const res = await POST(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(401);
    });

    it('should return 403 if user is not Treasurer or Owner', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId } });
        (getGangPermissions as any).mockResolvedValue({ isTreasurer: false, isOwner: false });

        const req = createRequest({});
        const res = await POST(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(403);
    });

    it('should validate request body schema', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId } });
        (getGangPermissions as any).mockResolvedValue({ isTreasurer: true });

        // Invalid Body (Amount negative)
        const req = createRequest({ type: 'INCOME', amount: -100, description: 'Test' });
        const res = await POST(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(400);
    });

    it('should process INCOME transaction successfully', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Admin' } });
        (getGangPermissions as any).mockResolvedValue({ isTreasurer: true });

        // Mock FinanceService to resolve successfully
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

        // Verify FinanceService was called with correct args
        expect(FinanceService.createTransaction).toHaveBeenCalledWith(
            expect.anything(), // db
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
        (getGangPermissions as any).mockResolvedValue({ isTreasurer: true });

        // Mock FinanceService to throw insufficient funds
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
        (getGangPermissions as any).mockResolvedValue({ isTreasurer: true });

        // Mock FinanceService to throw concurrency conflict
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
        (getGangPermissions as any).mockResolvedValue({ isTreasurer: true });

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
        (getGangPermissions as any).mockResolvedValue({ isTreasurer: true });

        (FinanceService.createTransaction as any) = vi.fn().mockResolvedValue({
            transactionId: 'txn-3',
            newGangBalance: 1500,
        });

        const body = { type: 'REPAYMENT', amount: 500, description: 'Return Loan', memberId: 'mem-1' };
        const req = createRequest(body);
        const res = await POST(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(200);
    });

    it('should fail REPAYMENT if member has insufficient funds', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Admin' } });
        (getGangPermissions as any).mockResolvedValue({ isTreasurer: true });

        // Mock FinanceService to throw insufficient member funds
        (FinanceService.createTransaction as any) = vi.fn().mockRejectedValue(
            new Error('สมาชิกไม่มีหนี้ค้างชำระ')
        );

        const body = { type: 'REPAYMENT', amount: 500, description: 'Return Loan', memberId: 'mem-1' };
        const req = createRequest(body);
        const res = await POST(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toBe('สมาชิกไม่มีหนี้ค้างชำระ');
    });
});
