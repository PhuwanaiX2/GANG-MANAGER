import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { GET as getMyProfile } from '../../app/api/gangs/[gangId]/my-profile/route';
import { GET as exportFinance } from '../../app/api/gangs/[gangId]/finance/export/route';

vi.mock('next-auth');
vi.mock('@gang/database');
vi.mock('@/lib/permissions');
vi.mock('@/lib/tierGuard');
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

import { getServerSession } from 'next-auth';
import { db, getOutstandingLoanDebt } from '@gang/database';
import { getGangPermissions } from '@/lib/permissions';
import { checkTierAccess } from '@/lib/tierGuard';

function createSelectResult(rows: any) {
    return {
        from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(rows),
        }),
    };
}

describe('Finance reporting compatibility routes', () => {
    const mockGangId = 'gang-123';

    beforeEach(() => {
        vi.clearAllMocks();
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

    it('finance export: should reject users without owner or treasurer permission', async () => {
        (getServerSession as any).mockResolvedValue({
            user: { discordId: 'discord-123' },
        });
        (getGangPermissions as any).mockResolvedValue({ isOwner: false, isTreasurer: false });

        const req = new NextRequest('http://localhost:3000/api/gangs/gang-123/finance/export');
        const res = await exportFinance(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(403);
        await expect(res.text()).resolves.toContain('Forbidden');
    });

    it('finance export: should reject gangs without premium export access', async () => {
        (getServerSession as any).mockResolvedValue({
            user: { discordId: 'discord-123' },
        });
        (getGangPermissions as any).mockResolvedValue({ isOwner: true, isTreasurer: false });
        (checkTierAccess as any).mockResolvedValue({ allowed: false, message: 'Upgrade required' });

        const req = new NextRequest('http://localhost:3000/api/gangs/gang-123/finance/export');
        const res = await exportFinance(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(403);
        await expect(res.text()).resolves.toContain('Upgrade required');
    });

    it('finance export: should label GANG_FEE rows as due-only in csv', async () => {
        (getServerSession as any).mockResolvedValue({
            user: { discordId: 'discord-123' },
        });
        (getGangPermissions as any).mockResolvedValue({ isOwner: true, isTreasurer: false });
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
                        description: 'นำเงินเข้ากองกลาง/สำรองจ่าย',
                        amount: 500,
                        status: 'APPROVED',
                        member: { name: 'Alice' },
                        createdBy: { name: 'Admin' },
                        balanceBefore: 1000,
                        balanceAfter: 1500,
                        settledAt: new Date('2026-04-02T10:30:00.000Z'),
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
        expect(csv).toContain('SettledAt');
        expect(csv).toContain('DUE_ONLY');
        expect(csv).toContain('CASH_INFLOW');
    });
});
