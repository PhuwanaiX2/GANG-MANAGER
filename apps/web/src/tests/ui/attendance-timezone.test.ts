import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = join(process.cwd(), '..', '..');
const webRoot = process.cwd();

function readRepoFile(path: string) {
    return readFileSync(join(repoRoot, path), 'utf8');
}

function readWebFile(path: string) {
    return readFileSync(join(webRoot, path), 'utf8');
}

describe('attendance Bangkok timezone regression guard', () => {
    it('keeps create API coverage for manual and scheduled Bangkok boundaries', () => {
        const source = readWebFile('src/tests/api/attendance.test.ts');

        expect(source).toContain("new Date('2026-04-25T17:00:00.000Z')");
        expect(source).toContain("new Date('2026-04-26T16:59:59.999Z')");
        expect(source).toContain("new Date('2026-05-09T13:30:00.000Z')");
        expect(source).toContain("new Date('2026-05-09T14:30:00.000Z')");
    });

    it('formats web attendance report, active message, close summary, and detail display in Bangkok time', () => {
        const sessionRoute = readWebFile('src/app/api/gangs/[gangId]/attendance/[sessionId]/route.ts');
        const attendanceList = readWebFile('src/app/dashboard/[gangId]/attendance/AttendanceClient.tsx');
        const attendanceDetail = readWebFile('src/app/dashboard/[gangId]/attendance/[sessionId]/page.tsx');
        const memberCard = readWebFile('src/app/dashboard/[gangId]/attendance/[sessionId]/MemberSessionAttendanceCard.tsx');

        expect((sessionRoute.match(/timeZone: 'Asia\/Bangkok'/g) || []).length).toBeGreaterThanOrEqual(6);
        expect(sessionRoute).toContain("sessionStatus === 'CLOSED'");
        expect(sessionRoute).toContain("'ATTENDANCE_CLOSE'");
        expect(attendanceList).toContain("timeZone: 'Asia/Bangkok'");
        expect(attendanceDetail).toContain("timeZone: 'Asia/Bangkok'");
        expect(memberCard).toContain("timeZone: 'Asia/Bangkok'");
    });

    it('formats bot auto-start and auto-close Discord messages in Bangkok time', () => {
        const scheduler = readRepoFile('apps/bot/src/services/attendanceScheduler.ts');

        expect((scheduler.match(/timeZone: 'Asia\/Bangkok'/g) || []).length).toBeGreaterThanOrEqual(4);
        expect(scheduler).toContain("status: 'CLOSED'");
        expect(scheduler).toContain("closedAt: now");
    });
});
