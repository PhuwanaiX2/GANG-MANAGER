import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

import { POST as createGangFee } from '../../app/api/gangs/[gangId]/finance/gang-fee/route';
import { POST as settleGangFee } from '../../app/api/gangs/[gangId]/finance/gang-fee/settle/route';

vi.mock('next-auth');
vi.mock('@gang/database');
vi.mock('@/lib/permissions');
vi.mock('@/lib/tierGuard');
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

vi.mock('nanoid', () => ({ nanoid: () => 'batch-123' }));
vi.mock('discord.js', () => {
    class REST {
        setToken() {
            return this;
        }
        post = vi.fn().mockResolvedValue({});
    }
    return { REST };
});
vi.mock('discord-api-types/v10', () => ({
    Routes: { channelMessages: (id: string) => `/channels/${id}/messages` },
}));

import { getServerSession } from 'next-auth';
import { FinanceService, db } from '@gang/database';
import { getGangPermissions } from '@/lib/permissions';
import { checkTierAccess } from '@/lib/tierGuard';

describe('Gang fee flow (create + settle)', () => {
    const mockGangId = 'gang-123';
    const mockUserDiscordId = 'user-123';
    const mockActorMemberId = 'mem-admin-1';

    beforeEach(() => {
        vi.clearAllMocks();

        (checkTierAccess as any).mockResolvedValue({
            allowed: true,
            tier: 'PRO',
            tierConfig: { name: 'PRO' },
            message: undefined,
        });

        (getGangPermissions as any).mockResolvedValue({ isTreasurer: true, isOwner: false });

        (db as any).query = {
            members: {
                findFirst: vi.fn().mockResolvedValue({ id: mockActorMemberId, name: 'Admin' }),
                findMany: vi.fn().mockResolvedValue([{ id: 'mem-1' }, { id: 'mem-2' }]),
            },
            gangs: {
                findFirst: vi.fn().mockResolvedValue({
                    name: 'Test Gang',
                    settings: { announcementChannelId: null },
                }),
            },
        };

        (FinanceService.createTransaction as any) = vi.fn().mockResolvedValue({
            transactionId: 'txn-1',
            newGangBalance: 0,
        });
        (FinanceService.waiveGangFeeDebt as any) = vi.fn().mockResolvedValue({
            waived: true,
            amount: 100,
        });
    });

    const createRequest = (body: any) =>
        new NextRequest('http://localhost:3000/api', {
            method: 'POST',
            body: JSON.stringify(body),
        });

    it('create: should return 401 if not authenticated', async () => {
        (getServerSession as any).mockResolvedValue(null);

        const req = createRequest({ amount: 100, description: 'Premium' });
        const res = await createGangFee(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(401);
    });

    it('create: should create per-member GANG_FEE with shared batchId', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserDiscordId, name: 'Admin' } });

        const req = createRequest({ amount: 100, description: 'Premium' });
        const res = await createGangFee(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);
        expect(json.count).toBe(2);
        expect(json.batchId).toBe('batch-123');

        expect(FinanceService.createTransaction).toHaveBeenCalledTimes(2);
        for (const mId of ['mem-1', 'mem-2']) {
            expect(FinanceService.createTransaction).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    gangId: mockGangId,
                    type: 'GANG_FEE',
                    amount: 100,
                    description: 'เรียกเก็บเงินแก๊ง: Premium',
                    memberId: mId,
                    batchId: 'batch-123',
                    actorId: mockActorMemberId,
                })
            );
        }
    });

    it('settle: should call waiveGangFeeDebt and return success', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserDiscordId, name: 'Admin' } });

        const req = createRequest({ memberId: 'mem-1', batchId: 'batch-123' });
        const res = await settleGangFee(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);
        expect(FinanceService.waiveGangFeeDebt).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                gangId: mockGangId,
                memberId: 'mem-1',
                batchId: 'batch-123',
                actorId: mockActorMemberId,
            })
        );
    });

    it('settle: should map not-found debt to 404', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserDiscordId, name: 'Admin' } });
        (FinanceService.waiveGangFeeDebt as any) = vi.fn().mockRejectedValue(
            new Error('ไม่พบหนี้เก็บเงินแก๊งที่ยังค้างอยู่')
        );

        const req = createRequest({ memberId: 'mem-1', batchId: 'batch-123' });
        const res = await settleGangFee(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(404);
        const json = await res.json();
        expect(json.error).toContain('ไม่พบหนี้เก็บเงินแก๊ง');
    });
});
