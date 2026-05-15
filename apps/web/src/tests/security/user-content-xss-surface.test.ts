import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();

const userContentRenderers = [
    'src/app/dashboard/[gangId]/announcements/AnnouncementsClient.tsx',
    'src/app/dashboard/[gangId]/leaves/LeaveRequestList.tsx',
    'src/app/dashboard/[gangId]/finance/TransactionTable.tsx',
    'src/app/dashboard/[gangId]/finance/page.tsx',
    'src/app/dashboard/[gangId]/members/[memberId]/MemberActivityClient.tsx',
    'src/app/dashboard/[gangId]/attendance/[sessionId]/AttendanceSessionDetail.tsx',
    'src/app/dashboard/[gangId]/attendance/[sessionId]/MemberSessionAttendanceCard.tsx',
] as const;

const dangerousHtmlSinks = [
    'dangerouslySetInnerHTML',
    '.innerHTML',
    '.outerHTML',
    'insertAdjacentHTML',
    'document.write',
    'new Function',
    'eval(',
];

describe('user-generated content XSS surface', () => {
    it('renders announcement, leave, member, finance, and attendance notes without raw HTML sinks', () => {
        for (const relativePath of userContentRenderers) {
            const source = readFileSync(join(projectRoot, relativePath), 'utf8');

            for (const sink of dangerousHtmlSinks) {
                expect(source, `${relativePath} must not use ${sink} for user content`).not.toContain(sink);
            }
        }
    });
});
