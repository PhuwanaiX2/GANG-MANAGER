import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();

describe('dashboard navigation loading states', () => {
    it('shows route-pending feedback while switching finance tabs', () => {
        const source = readFileSync(join(projectRoot, 'src/app/dashboard/[gangId]/finance/FinanceTabs.tsx'), 'utf8');
        const opsShellSource = readFileSync(join(projectRoot, 'src/components/ui/OpsShell.tsx'), 'utf8');

        expect(source).toContain('useTransition');
        expect(source).toContain('aria-busy={isSwitching}');
        expect(source).toContain('pending: pendingTab === tab.id');
        expect(opsShellSource).toContain('item.pending');
        expect(opsShellSource).toContain('animate-spin');
        expect(source).toContain('aria-live="polite"');
        expect(source).not.toContain('router.prefetch');
    });

    it('shows pending feedback while switching attendance URL filters', () => {
        const source = readFileSync(join(projectRoot, 'src/app/dashboard/[gangId]/attendance/AttendanceClient.tsx'), 'utf8');

        expect(source).toContain('useTransition');
        expect(source).toContain('isPending');
        expect(source).toContain('router.replace');
        expect(source).toContain('กำลังโหลด');
    });
    it('keeps leave tabs as instant local filters with pagination reset', () => {
        const source = readFileSync(join(projectRoot, 'src/app/dashboard/[gangId]/leaves/LeaveRequestList.tsx'), 'utf8');

        expect(source).toContain("const [view, setView] = useState<'mine' | 'team'>");
        expect(source).toContain('const handleViewChange');
        expect(source).toContain('setView(newView)');
        expect(source).toContain('setCurrentPage(1)');
        expect(source).not.toContain('router.replace(');
        expect(source).not.toContain('router.push(');
    });

    it('keeps member activity filters local with pagination reset', () => {
        const source = readFileSync(join(projectRoot, 'src/app/dashboard/[gangId]/members/[memberId]/MemberActivityClient.tsx'), 'utf8');

        expect(source).toContain("const [filter, setFilter] = useState<FilterType>('all')");
        expect(source).toContain('const handleFilterChange');
        expect(source).toContain('setFilter(newFilter)');
        expect(source).toContain('setCurrentPage(1)');
        expect(source).not.toContain('router.replace(');
        expect(source).not.toContain('router.push(');
    });
});
