'use client';

import { useState, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Info, Key, AlertTriangle, Settings } from 'lucide-react';

const TABS = [
    { id: 'general', label: 'ทั่วไป', icon: Info, color: 'text-blue-400' },
    { id: 'roles-channels', label: 'ยศ & ช่อง', icon: Settings, color: 'text-purple-400' },
    { id: 'subscription', label: 'แพลน', icon: Key, color: 'text-yellow-400' },
    { id: 'advanced', label: 'ขั้นสูง', icon: AlertTriangle, color: 'text-red-400' },
] as const;

type TabId = typeof TABS[number]['id'];

interface Props {
    generalContent: React.ReactNode;
    rolesChannelsContent: React.ReactNode;
    subscriptionContent: React.ReactNode;
    advancedContent: React.ReactNode;
}

export function SettingsTabsClient({ generalContent, rolesChannelsContent, subscriptionContent, advancedContent }: Props) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const initialTab = useMemo<TabId>(() => {
        const sub = searchParams.get('subscription');
        const tab = searchParams.get('tab');
        if (sub === 'success' || sub === 'cancelled') return 'subscription';
        if (tab && TABS.some(t => t.id === tab)) return tab as TabId;
        return 'general';
    }, []);
    const [activeTab, setActiveTab] = useState<TabId>(initialTab);

    const handleTabChange = useCallback((tab: TabId) => {
        setActiveTab(tab);
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', tab);
        params.delete('subscription');
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, [searchParams, router, pathname]);

    const contentMap: Record<TabId, React.ReactNode> = {
        general: generalContent,
        'roles-channels': rolesChannelsContent,
        subscription: subscriptionContent,
        advanced: advancedContent,
    };

    return (
        <div>
            {/* Tab Navigation */}
            <div className="flex gap-1 p-1 bg-white/[0.02] border border-white/5 rounded-xl mb-8 overflow-x-auto">
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                                isActive
                                    ? 'bg-white/10 text-white shadow-lg'
                                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                            }`}
                        >
                            <Icon className={`w-4 h-4 ${isActive ? tab.color : ''}`} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            <div className="max-w-5xl">
                {contentMap[activeTab]}
            </div>
        </div>
    );
}
