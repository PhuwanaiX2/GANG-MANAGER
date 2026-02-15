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
        <div className="flex p-1 bg-black/20 backdrop-blur-sm rounded-xl border border-white/5 mb-6 sm:mb-8 w-fit max-w-full overflow-x-auto relative z-10">
            <button
                onClick={() => handleTabChange('overview')}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all duration-300 whitespace-nowrap ${currentTab === 'overview'
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
            >
                <LayoutDashboard className="w-4 h-4" />
                ภาพรวม
            </button>
            <button
                onClick={() => handleTabChange('history')}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all duration-300 whitespace-nowrap ${currentTab === 'history'
                    ? 'bg-discord-primary text-white shadow-lg shadow-discord-primary/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
            >
                <History className="w-4 h-4" />
                ประวัติ
            </button>
            <button
                onClick={() => handleTabChange('summary')}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all duration-300 whitespace-nowrap ${currentTab === 'summary'
                    ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
            >
                <BarChart3 className="w-4 h-4" />
                สรุป
            </button>
        </div>
    );
}
