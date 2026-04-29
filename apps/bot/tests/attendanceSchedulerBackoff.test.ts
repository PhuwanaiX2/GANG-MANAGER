import { describe, expect, it, vi } from 'vitest';

vi.mock('@gang/database', () => ({
    db: {},
    attendanceSessions: {},
    attendanceRecords: {},
    members: {},
    gangs: {},
    gangSettings: {},
    auditLogs: {},
    canAccessFeature: vi.fn(() => false),
    partitionAttendanceRecords: vi.fn(() => ({ present: [], absent: [], leave: [] })),
    resolveUncheckedAttendanceStatus: vi.fn(() => 'ABSENT'),
}));

vi.mock('drizzle-orm', () => ({
    eq: vi.fn(),
    and: vi.fn(),
    lte: vi.fn(),
    sql: vi.fn(),
}));

vi.mock('../src/index', () => ({
    client: {
        guilds: {
            cache: new Map(),
        },
    },
}));

vi.mock('../src/utils/logger', () => ({
    logError: vi.fn(),
    logInfo: vi.fn(),
}));

vi.mock('nanoid', () => ({
    nanoid: vi.fn(() => 'id-1'),
}));

import { getAttendanceSchedulerBackoffMs } from '../src/services/attendanceScheduler';

describe('attendance scheduler backoff', () => {
    it('backs off exponentially and caps retries at five minutes', () => {
        expect(getAttendanceSchedulerBackoffMs(1)).toBe(30_000);
        expect(getAttendanceSchedulerBackoffMs(2)).toBe(60_000);
        expect(getAttendanceSchedulerBackoffMs(3)).toBe(120_000);
        expect(getAttendanceSchedulerBackoffMs(4)).toBe(240_000);
        expect(getAttendanceSchedulerBackoffMs(5)).toBe(300_000);
        expect(getAttendanceSchedulerBackoffMs(20)).toBe(300_000);
    });
});
