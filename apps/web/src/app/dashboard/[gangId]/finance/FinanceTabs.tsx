'use client';

import { useTransition } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { LayoutDashboard, History, BarChart3, Loader2 } from 'lucide-react';

export function FinanceTabs() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const [isPending, startTransition] = useTransition();

    // Default to 'overview' if no tab is specified
    const currentTab = searchParams.get('tab') || 'overview';

    const handleTabChange = (tab: string) => {
        if (tab === currentTab || isPending) {
            return;
        }

        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', tab);
        // Reset page when switching tabs
        if (tab === 'history') {
            params.delete('page');
        }
        startTransition(() => {
            router.push(`${pathname}?${params.toString()}`);
        });
    };

    return (
        <div className="flex w-full max-w-full gap-1 overflow-x-auto rounded-token-xl border border-border-subtle bg-bg-subtle/80 p-1 shadow-token-xs backdrop-blur sm:w-fit" aria-busy={isPending}>
            <button
                onClick={() => handleTabChange('overview')}
                disabled={isPending}
                className={`flex min-w-fit items-center justify-center gap-1.5 rounded-token-lg px-3 py-2 text-xs font-bold transition-all duration-300 sm:gap-2 sm:px-4 whitespace-nowrap disabled:cursor-wait disabled:opacity-70 ${currentTab === 'overview'
                    ? 'bg-bg-elevated text-fg-primary shadow-token-sm ring-1 ring-border'
                    : 'text-fg-tertiary hover:text-fg-primary hover:bg-bg-muted'
                    }`}
            >
                {isPending && currentTab !== 'overview'
                    ? <Loader2 className="w-4 h-4 animate-spin text-fg-tertiary" />
                    : <LayoutDashboard className={`w-4 h-4 ${currentTab === 'overview' ? 'text-fg-success' : 'text-fg-tertiary'}`} />}
                ภาพรวม
            </button>
            <button
                onClick={() => handleTabChange('history')}
                disabled={isPending}
                className={`flex min-w-fit items-center justify-center gap-1.5 rounded-token-lg px-3 py-2 text-xs font-bold transition-all duration-300 sm:gap-2 sm:px-4 whitespace-nowrap disabled:cursor-wait disabled:opacity-70 ${currentTab === 'history'
                    ? 'bg-bg-elevated text-fg-primary shadow-token-sm ring-1 ring-border'
                    : 'text-fg-tertiary hover:text-fg-primary hover:bg-bg-muted'
                    }`}
            >
                {isPending && currentTab !== 'history'
                    ? <Loader2 className="w-4 h-4 animate-spin text-fg-tertiary" />
                    : <History className={`w-4 h-4 ${currentTab === 'history' ? 'text-fg-info' : 'text-fg-tertiary'}`} />}
                ประวัติ
            </button>
            <button
                onClick={() => handleTabChange('summary')}
                disabled={isPending}
                className={`flex min-w-fit items-center justify-center gap-1.5 rounded-token-lg px-3 py-2 text-xs font-bold transition-all duration-300 sm:gap-2 sm:px-4 whitespace-nowrap disabled:cursor-wait disabled:opacity-70 ${currentTab === 'summary'
                    ? 'bg-bg-elevated text-fg-primary shadow-token-sm ring-1 ring-border'
                    : 'text-fg-tertiary hover:text-fg-primary hover:bg-bg-muted'
                    }`}
            >
                {isPending && currentTab !== 'summary'
                    ? <Loader2 className="w-4 h-4 animate-spin text-fg-tertiary" />
                    : <BarChart3 className={`w-4 h-4 ${currentTab === 'summary' ? 'text-fg-accent' : 'text-fg-tertiary'}`} />}
                สรุป
            </button>
        </div>
    );
}
