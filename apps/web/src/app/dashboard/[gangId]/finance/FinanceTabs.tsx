'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BarChart3, History, LayoutDashboard } from 'lucide-react';
import { OpsSubNav } from '@/components/ui';

const TABS = [
    { id: 'overview', label: 'ภาพรวม', description: 'คำขอ ค้างเก็บ และรายการล่าสุด', icon: LayoutDashboard, tone: 'success' },
    { id: 'history', label: 'ประวัติ', description: 'รายการที่อนุมัติแล้ว', icon: History, tone: 'info' },
    { id: 'summary', label: 'สรุป', description: 'แนวโน้มและคนเสี่ยง', icon: BarChart3, tone: 'accent' },
] as const;

type FinanceTab = typeof TABS[number]['id'];

export function FinanceTabs() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const [pendingTab, setPendingTab] = useState<FinanceTab | null>(null);
    const [isRoutePending, startRouteTransition] = useTransition();

    const normalizedPath = pathname.replace(/\/$/, '');
    const pathTab: FinanceTab | null = normalizedPath.endsWith('/history')
        ? 'history'
        : normalizedPath.endsWith('/summary')
            ? 'summary'
            : null;
    const basePath = pathTab ? normalizedPath.slice(0, normalizedPath.lastIndexOf('/')) : normalizedPath;
    const requestedTab = pathTab || searchParams.get('tab') || 'overview';
    const currentTab = TABS.some((tab) => tab.id === requestedTab) ? requestedTab as FinanceTab : 'overview';
    const searchKey = searchParams.toString();

    const tabLinks = useMemo(() => {
        return TABS.map((tab) => {
            const params = new URLSearchParams(searchKey);
            params.delete('tab');
            params.delete('page');

            if (tab.id === 'overview' || tab.id === 'history') {
                params.delete('range');
            }

            const targetPath = tab.id === 'overview' ? basePath : `${basePath}/${tab.id}`;
            const query = params.toString();
            return {
                ...tab,
                href: query ? `${targetPath}?${query}` : targetPath,
            };
        });
    }, [basePath, searchKey]);

    useEffect(() => {
        setPendingTab(null);
    }, [currentTab]);

    useEffect(() => {
        for (const tab of tabLinks) {
            if (tab.id !== currentTab) {
                router.prefetch(tab.href);
            }
        }
    }, [currentTab, router, tabLinks]);

    const visualTab = pendingTab || currentTab;
    const isSwitching = isRoutePending || (pendingTab !== null && pendingTab !== currentTab);

    return (
        <div aria-busy={isSwitching}>
            <OpsSubNav
                ariaLabel="Finance sections"
                className="max-w-full sm:w-fit"
                items={tabLinks.map((tab) => ({
                    id: tab.id,
                    href: tab.href,
                    label: tab.label,
                    description: tab.description,
                    icon: tab.icon,
                    tone: tab.tone,
                    active: visualTab === tab.id,
                    pending: pendingTab === tab.id && currentTab !== tab.id,
                    onClick: (event) => {
                        if (
                            event.defaultPrevented ||
                            event.metaKey ||
                            event.ctrlKey ||
                            event.shiftKey ||
                            event.altKey
                        ) {
                            return;
                        }

                        if (tab.id === currentTab) {
                            event.preventDefault();
                            return;
                        }
                        event.preventDefault();
                        setPendingTab(tab.id);
                        startRouteTransition(() => {
                            router.push(tab.href, { scroll: false });
                        });
                    },
                }))}
            />
            <span className="sr-only" aria-live="polite">
                {isSwitching ? 'กำลังเปลี่ยนหน้า' : ''}
            </span>
        </div>
    );
}
