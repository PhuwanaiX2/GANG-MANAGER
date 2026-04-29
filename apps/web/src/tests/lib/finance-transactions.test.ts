import { describe, expect, it } from 'vitest';
import { groupRecentFinanceTransactions } from '@/lib/financeTransactions';

describe('groupRecentFinanceTransactions', () => {
    it('groups gang-fee rows consistently before applying the display limit', () => {
        const rows = [
            {
                id: 'fee-1',
                type: 'GANG_FEE',
                amount: 100,
                description: 'Weekly fee',
                createdById: 'treasurer-1',
                approvedAt: new Date('2026-04-25T12:00:10.000Z'),
                createdAt: new Date('2026-04-25T12:00:00.000Z'),
                member: { id: 'member-1' },
            },
            {
                id: 'fee-2',
                type: 'GANG_FEE',
                amount: 100,
                description: 'Weekly fee',
                createdById: 'treasurer-1',
                approvedAt: new Date('2026-04-25T12:00:40.000Z'),
                createdAt: new Date('2026-04-25T12:00:00.000Z'),
                member: { id: 'member-2' },
            },
            {
                id: 'income-1',
                type: 'INCOME',
                amount: 50,
                description: 'Donation',
                approvedAt: new Date('2026-04-25T12:01:00.000Z'),
                createdAt: new Date('2026-04-25T12:01:00.000Z'),
            },
        ];

        const grouped = groupRecentFinanceTransactions(rows, 5);

        expect(grouped).toHaveLength(2);
        expect(grouped[0].id).toBe('income-1');
        expect(grouped[1]).toMatchObject({
            id: 'gang_fee_fee-1',
            amount: 200,
            __batchCount: 2,
            member: undefined,
        });
        expect(grouped[1].approvedAt).toEqual(new Date('2026-04-25T12:00:40.000Z'));
    });
});
