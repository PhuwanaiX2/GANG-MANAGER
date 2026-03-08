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
        <div className="flex p-1 bg-[#111] backdrop-blur-sm rounded-xl border border-white/5 w-fit max-w-full overflow-x-auto">
            <button
                onClick={() => handleTabChange('overview')}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-300 whitespace-nowrap ${currentTab === 'overview'
                    ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/20'
                    : 'text-zinc-500 hover:text-white hover:bg-white/5'
                    }`}
            >
                <LayoutDashboard className={`w-4 h-4 ${currentTab === 'overview' ? 'text-emerald-400' : 'text-zinc-600'}`} />
                ภาพรวม
            </button>
            <button
                onClick={() => handleTabChange('history')}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-300 whitespace-nowrap ${currentTab === 'history'
                    ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/20'
                    : 'text-zinc-500 hover:text-white hover:bg-white/5'
                    }`}
            >
                <History className={`w-4 h-4 ${currentTab === 'history' ? 'text-indigo-400' : 'text-zinc-600'}`} />
                ประวัติ
            </button>
            <button
                onClick={() => handleTabChange('summary')}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-300 whitespace-nowrap ${currentTab === 'summary'
                    ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/20'
                    : 'text-zinc-500 hover:text-white hover:bg-white/5'
                    }`}
            >
                <BarChart3 className={`w-4 h-4 ${currentTab === 'summary' ? 'text-purple-400' : 'text-zinc-600'}`} />
                สรุป
            </button>
        </div>
    );
}
