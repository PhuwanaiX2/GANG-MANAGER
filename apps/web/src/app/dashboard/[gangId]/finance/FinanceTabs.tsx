'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { LayoutDashboard, History, BarChart3 } from 'lucide-react';

export function FinanceTabs() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    // Default to 'overview' if no tab is specified
    const currentTab = searchParams.get('tab') || 'overview';

    const handleTabChange = (tab: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', tab);
        // Reset page when switching tabs
        if (tab === 'history') {
            params.delete('page');
        }
        router.push(`${pathname}?${params.toString()}`);
    };

    return (
        <div className="flex w-full max-w-full gap-1 overflow-x-auto rounded-token-2xl border border-border-subtle bg-bg-subtle/80 p-1 shadow-token-xs backdrop-blur sm:w-fit">
            <button
                onClick={() => handleTabChange('overview')}
                className={`flex min-w-fit items-center justify-center gap-1.5 rounded-token-xl px-3 py-2 text-xs font-bold transition-all duration-300 sm:gap-2 sm:px-4 whitespace-nowrap ${currentTab === 'overview'
                    ? 'bg-bg-elevated text-fg-primary shadow-token-sm ring-1 ring-border'
                    : 'text-fg-tertiary hover:text-fg-primary hover:bg-bg-muted'
                    }`}
            >
                <LayoutDashboard className={`w-4 h-4 ${currentTab === 'overview' ? 'text-fg-success' : 'text-fg-tertiary'}`} />
                ภาพรวม
            </button>
            <button
                onClick={() => handleTabChange('history')}
                className={`flex min-w-fit items-center justify-center gap-1.5 rounded-token-xl px-3 py-2 text-xs font-bold transition-all duration-300 sm:gap-2 sm:px-4 whitespace-nowrap ${currentTab === 'history'
                    ? 'bg-bg-elevated text-fg-primary shadow-token-sm ring-1 ring-border'
                    : 'text-fg-tertiary hover:text-fg-primary hover:bg-bg-muted'
                    }`}
            >
                <History className={`w-4 h-4 ${currentTab === 'history' ? 'text-fg-info' : 'text-fg-tertiary'}`} />
                ประวัติ
            </button>
            <button
                onClick={() => handleTabChange('summary')}
                className={`flex min-w-fit items-center justify-center gap-1.5 rounded-token-xl px-3 py-2 text-xs font-bold transition-all duration-300 sm:gap-2 sm:px-4 whitespace-nowrap ${currentTab === 'summary'
                    ? 'bg-bg-elevated text-fg-primary shadow-token-sm ring-1 ring-border'
                    : 'text-fg-tertiary hover:text-fg-primary hover:bg-bg-muted'
                    }`}
            >
                <BarChart3 className={`w-4 h-4 ${currentTab === 'summary' ? 'text-fg-accent' : 'text-fg-tertiary'}`} />
                สรุป
            </button>
        </div>
    );
}
