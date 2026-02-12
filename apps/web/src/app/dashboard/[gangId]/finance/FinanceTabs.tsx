'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { LayoutDashboard, History } from 'lucide-react';

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
        <div className="flex p-1 bg-black/20 backdrop-blur-sm rounded-xl border border-white/5 mb-8 w-fit relative z-10">
            <button
                onClick={() => handleTabChange('overview')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${currentTab === 'overview'
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
            >
                <LayoutDashboard className="w-4 h-4" />
                ภาพรวม
            </button>
            <button
                onClick={() => handleTabChange('history')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${currentTab === 'history'
                    ? 'bg-discord-primary text-white shadow-lg shadow-discord-primary/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
            >
                <History className="w-4 h-4" />
                ประวัติธุรกรรม
            </button>
        </div>
    );
}
