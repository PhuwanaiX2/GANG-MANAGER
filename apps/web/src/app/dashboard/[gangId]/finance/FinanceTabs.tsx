'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BarChart3, History, LayoutDashboard, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

const TABS = [
    { id: 'overview', label: 'ภาพรวม', icon: LayoutDashboard, activeClass: 'text-fg-success' },
    { id: 'history', label: 'ประวัติ', icon: History, activeClass: 'text-fg-info' },
    { id: 'summary', label: 'สรุป', icon: BarChart3, activeClass: 'text-accent-bright' },
] as const;

type FinanceTab = typeof TABS[number]['id'];

export function FinanceTabs() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const [pendingTab, setPendingTab] = useState<FinanceTab | null>(null);
    const [isRoutePending, startRouteTransition] = useTransition();

    const requestedTab = searchParams.get('tab') || 'overview';
    const currentTab = TABS.some((tab) => tab.id === requestedTab) ? requestedTab as FinanceTab : 'overview';
    const searchKey = searchParams.toString();

    const tabLinks = useMemo(() => {
        return TABS.map((tab) => {
            const params = new URLSearchParams(searchKey);
            params.delete('page');

            params.set('tab', tab.id);

            if (tab.id === 'overview' || tab.id === 'history') {
                params.delete('range');
            }

            const query = params.toString();
            return {
                ...tab,
                href: query ? `${pathname}?${query}` : pathname,
            };
        });
    }, [pathname, searchKey]);

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
        <nav
            className="relative flex w-full max-w-full gap-1 overflow-x-auto rounded-token-xl border border-border-subtle bg-bg-muted/80 p-1 shadow-token-xs backdrop-blur sm:w-fit"
            aria-label="Finance sections"
            aria-busy={isSwitching}
            role="tablist"
        >
            {tabLinks.map((tab) => {
                const Icon = tab.icon;
                const isActive = visualTab === tab.id;
                const isRealRoute = currentTab === tab.id;

                return (
                    <a
                        key={tab.id}
                        href={tab.href}
                        role="tab"
                        aria-selected={isRealRoute}
                        aria-current={isRealRoute ? 'page' : undefined}
                        onMouseEnter={() => router.prefetch(tab.href)}
                        onFocus={() => router.prefetch(tab.href)}
                        onClick={(event) => {
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
                        }}
                        className={cn(
                            'relative inline-flex min-h-10 min-w-fit items-center justify-center gap-2 rounded-token-lg px-3 text-xs font-black tracking-wide transition-colors sm:px-4',
                            isActive
                                ? 'bg-bg-elevated text-fg-primary shadow-token-sm ring-1 ring-border'
                                : 'text-fg-tertiary hover:bg-bg-subtle hover:text-fg-primary'
                        )}
                    >
                        <Icon className={cn('h-4 w-4', isActive ? tab.activeClass : 'text-fg-tertiary')} />
                        {tab.label}
                        {pendingTab === tab.id && !isRealRoute && (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-bright" aria-hidden="true" />
                        )}
                    </a>
                );
            })}
            {isSwitching && (
                <span className="pointer-events-none absolute inset-x-2 bottom-0 h-0.5 rounded-token-full bg-accent" />
            )}
            <span className="sr-only" aria-live="polite">
                {isSwitching ? 'กำลังเปลี่ยนหน้า' : ''}
            </span>
        </nav>
    );
}
