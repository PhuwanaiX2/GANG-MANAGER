import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockGangFindMany,
    mockUpdateSet,
    mockUpdateWhere,
    mockInsertValues,
    mockAnd,
    mockEq,
    mockIsNotNull,
    mockLt,
    mockNe,
} = vi.hoisted(() => ({
    mockGangFindMany: vi.fn(),
    mockUpdateSet: vi.fn(),
    mockUpdateWhere: vi.fn(),
    mockInsertValues: vi.fn(),
    mockAnd: vi.fn((...conditions: unknown[]) => ({ type: 'and', conditions })),
    mockEq: vi.fn((left, right) => ({ type: 'eq', left, right })),
    mockIsNotNull: vi.fn((column) => ({ type: 'isNotNull', column })),
    mockLt: vi.fn((left, right) => ({ type: 'lt', left, right })),
    mockNe: vi.fn((left, right) => ({ type: 'ne', left, right })),
}));

vi.mock('@gang/database', () => ({
    db: {
        query: {
            gangs: {
                findMany: mockGangFindMany,
            },
        },
        update: vi.fn(() => ({
            set: mockUpdateSet.mockReturnValue({
                where: mockUpdateWhere,
            }),
        })),
        insert: vi.fn(() => ({
            values: mockInsertValues,
        })),
    },
    gangs: {
        id: 'gangs.id',
        isActive: 'gangs.is_active',
        subscriptionExpiresAt: 'gangs.subscription_expires_at',
        subscriptionTier: 'gangs.subscription_tier',
    },
    auditLogs: {},
}));

vi.mock('drizzle-orm', () => ({
    and: mockAnd,
    eq: mockEq,
    isNotNull: mockIsNotNull,
    lt: mockLt,
    ne: mockNe,
}));

vi.mock('../src/utils/logger', () => ({
    logError: vi.fn(),
    logInfo: vi.fn(),
}));

import { checkExpiredLicenses } from '../src/services/licenseScheduler';

describe('licenseScheduler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGangFindMany.mockResolvedValue([]);
        mockUpdateWhere.mockResolvedValue(undefined);
        mockInsertValues.mockResolvedValue(undefined);
    });

    it('compares subscription expiry using a Date value, not millisecond epoch numbers', async () => {
        await checkExpiredLicenses();

        expect(mockLt).toHaveBeenCalledWith('gangs.subscription_expires_at', expect.any(Date));
        expect(mockLt.mock.calls[0][1]).not.toEqual(expect.any(Number));
    });

    it('downgrades only matched expired gangs and writes an audit trail', async () => {
        const expiredAt = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
        mockGangFindMany.mockResolvedValue([
            {
                id: 'gang_1',
                name: 'Test Gang',
                subscriptionTier: 'TRIAL',
                subscriptionExpiresAt: expiredAt,
            },
        ]);

        await checkExpiredLicenses();

        expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({
            subscriptionTier: 'FREE',
            subscriptionExpiresAt: null,
            updatedAt: expect.any(Date),
        }));
        expect(mockUpdateWhere).toHaveBeenCalledWith({ type: 'eq', left: 'gangs.id', right: 'gang_1' });
        expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({
            gangId: 'gang_1',
            actorId: 'system',
            action: 'SYSTEM_DOWNGRADE_EXPIRED_LICENSE',
            oldValue: expect.stringContaining('"subscriptionTier":"TRIAL"'),
            newValue: expect.stringContaining('"subscriptionTier":"FREE"'),
        }));
    });
});
