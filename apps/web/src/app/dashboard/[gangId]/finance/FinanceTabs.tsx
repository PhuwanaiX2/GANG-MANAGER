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
        <div className="flex p-1 bg-bg-subtle backdrop-blur-sm rounded-token-xl border border-border-subtle w-fit max-w-full overflow-x-auto shadow-token-sm">
            <button
                onClick={() => handleTabChange('overview')}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 sm:py-2.5 rounded-token-lg text-xs sm:text-sm font-semibold transition-all duration-300 whitespace-nowrap ${currentTab === 'overview'
                    ? 'bg-bg-elevated text-fg-primary shadow-token-sm ring-1 ring-border'
                    : 'text-fg-tertiary hover:text-fg-primary hover:bg-bg-muted'
                    }`}
            >
                <LayoutDashboard className={`w-4 h-4 ${currentTab === 'overview' ? 'text-fg-success' : 'text-fg-tertiary'}`} />
                ภาพรวม
            </button>
            <button
                onClick={() => handleTabChange('history')}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 sm:py-2.5 rounded-token-lg text-xs sm:text-sm font-semibold transition-all duration-300 whitespace-nowrap ${currentTab === 'history'
                    ? 'bg-bg-elevated text-fg-primary shadow-token-sm ring-1 ring-border'
                    : 'text-fg-tertiary hover:text-fg-primary hover:bg-bg-muted'
                    }`}
            >
                <History className={`w-4 h-4 ${currentTab === 'history' ? 'text-fg-info' : 'text-fg-tertiary'}`} />
                ประวัติ
            </button>
            <button
                onClick={() => handleTabChange('summary')}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 sm:py-2.5 rounded-token-lg text-xs sm:text-sm font-semibold transition-all duration-300 whitespace-nowrap ${currentTab === 'summary'
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
