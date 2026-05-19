import { describe, expect, it } from 'vitest';
import {
    getApprovedLeavePreview,
    getAttendanceBucketCounts,
    getAttendanceDisplayCounts,
    getAttendanceStatusLabel,
    isApprovedLeaveApplicableToSession,
    normalizeAttendanceStatus,
    resolveUncheckedAttendanceStatus,
} from '@gang/database/attendance';

describe('attendance domain helpers', () => {
    it('normalizes legacy LATE records as PRESENT across labels and bucket counts', () => {
        const counts = getAttendanceBucketCounts([
            { status: 'LATE' },
            { status: 'PRESENT' },
            { status: 'ABSENT' },
            { status: 'LEAVE' },
        ]);

        expect(normalizeAttendanceStatus('LATE')).toBe('PRESENT');
        expect(getAttendanceStatusLabel('LATE')).toBe('มา');
        expect(counts).toEqual({
            present: 2,
            absent: 1,
            leave: 1,
            total: 4,
        });
    });

    it('keeps closed attendance history totals tied to the records saved in that session', () => {
        const displayCounts = getAttendanceDisplayCounts(
            [
                { status: 'PRESENT' },
                { status: 'ABSENT' },
            ],
            {
                includeOpenRoster: false,
                uncheckedCount: 18,
            }
        );

        expect(displayCounts).toEqual({
            present: 1,
            absent: 1,
            leave: 0,
            unchecked: 0,
            total: 2,
        });
    });

    it('includes only active-session roster gaps in live attendance totals', () => {
        const displayCounts = getAttendanceDisplayCounts(
            [
                { status: 'PRESENT' },
                { status: 'ABSENT' },
            ],
            {
                includeOpenRoster: true,
                previewLeaveCount: 1,
                uncheckedCount: 17,
            }
        );

        expect(displayCounts).toEqual({
            present: 1,
            absent: 1,
            leave: 1,
            unchecked: 17,
            total: 20,
        });
    });

    it('treats approved FULL leave as applicable for any session on the same leave day', () => {
        expect(isApprovedLeaveApplicableToSession(
            {
                startTime: new Date('2025-01-01T12:00:00.000Z'),
                endTime: new Date('2025-01-01T13:00:00.000Z'),
            },
            {
                type: 'FULL',
                startDate: new Date('2025-01-01T00:00:00.000Z'),
                endDate: new Date('2025-01-01T00:00:00.000Z'),
            }
        )).toBe(true);
    });

    it('treats a Bangkok full-day leave as active in manual roll call day bounds', () => {
        const manualSession = {
            startTime: new Date('2024-12-31T17:00:00.000Z'),
            endTime: new Date('2025-01-01T16:59:59.999Z'),
        };

        const leave = {
            type: 'FULL' as const,
            startDate: new Date('2024-12-31T17:00:00.000Z'),
            endDate: new Date('2025-01-01T16:59:59.999Z'),
        };

        expect(isApprovedLeaveApplicableToSession(manualSession, leave)).toBe(true);
        expect(getApprovedLeavePreview({ attendanceSession: manualSession, leave })?.type).toBe('FULL');
    });

    it('keeps legacy UTC full-day bot leaves visible for the intended Bangkok attendance day', () => {
        const manualSession = {
            startTime: new Date('2024-12-31T17:00:00.000Z'),
            endTime: new Date('2025-01-01T16:59:59.999Z'),
        };

        const legacyBotLeave = {
            type: 'FULL' as const,
            startDate: new Date('2025-01-01T00:00:00.000Z'),
            endDate: new Date('2025-01-01T23:59:59.999Z'),
        };

        expect(isApprovedLeaveApplicableToSession(manualSession, legacyBotLeave)).toBe(true);
        expect(getApprovedLeavePreview({ attendanceSession: manualSession, leave: legacyBotLeave })?.statusLabel).toBe('ลา');
    });

    it('resolves an unchecked member with approved late leave to LEAVE only when the session closes before the expected arrival', () => {
        expect(resolveUncheckedAttendanceStatus({
            attendanceSession: {
                startTime: new Date('2025-01-01T10:00:00.000Z'),
                endTime: new Date('2025-01-01T10:30:00.000Z'),
            },
            memberId: 'member-1',
            approvedLeaves: [{
                memberId: 'member-1',
                type: 'LATE',
                startDate: new Date('2025-01-01T11:00:00.000Z'),
                endDate: new Date('2025-01-01T11:00:00.000Z'),
                status: 'APPROVED',
            }],
        })).toBe('LEAVE');

        expect(resolveUncheckedAttendanceStatus({
            attendanceSession: {
                startTime: new Date('2025-01-01T10:00:00.000Z'),
                endTime: new Date('2025-01-01T11:30:00.000Z'),
            },
            memberId: 'member-1',
            approvedLeaves: [{
                memberId: 'member-1',
                type: 'LATE',
                startDate: new Date('2025-01-01T11:00:00.000Z'),
                endDate: new Date('2025-01-01T11:00:00.000Z'),
                status: 'APPROVED',
            }],
        })).toBe('ABSENT');
    });

    it('shows active-session preview for approved late leave before the expected arrival time', () => {
        expect(getApprovedLeavePreview({
            attendanceSession: {
                startTime: new Date('2025-01-01T10:00:00.000Z'),
                endTime: new Date('2025-01-01T12:00:00.000Z'),
                status: 'ACTIVE',
            },
            leave: {
                type: 'LATE',
                startDate: new Date('2025-01-01T11:00:00.000Z'),
                endDate: new Date('2025-01-01T11:00:00.000Z'),
            },
            now: new Date('2025-01-01T10:15:00.000Z'),
        })).toEqual({
            note: 'แจ้งเข้าช้าถึง 18:00 น.',
            type: 'LATE',
            statusLabel: 'แจ้งเข้าช้า',
        });
    });
});
