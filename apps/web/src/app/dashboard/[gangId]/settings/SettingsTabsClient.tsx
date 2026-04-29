'use client';

import { useState, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Info, Key, AlertTriangle, Settings } from 'lucide-react';

const TABS = [
    { id: 'general', label: 'ทั่วไป', icon: Info, color: 'text-fg-info' },
    { id: 'roles-channels', label: 'ยศ & ช่อง', icon: Settings, color: 'text-accent-bright' },
    { id: 'subscription', label: 'แพลน', icon: Key, color: 'text-fg-warning' },
    { id: 'advanced', label: 'ขั้นสูง', icon: AlertTriangle, color: 'text-fg-danger' },
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
        if (tab && TABS.some((item) => item.id === tab)) return tab as TabId;
        return 'general';
    }, [searchParams]);
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
            <div className="flex gap-1 p-1 bg-bg-subtle border border-border-subtle rounded-token-xl mb-8 overflow-x-auto shadow-token-sm">
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-token-lg text-sm font-bold transition-all whitespace-nowrap ${isActive
                                ? 'bg-bg-elevated text-fg-primary shadow-token-md'
                                : 'text-fg-tertiary hover:text-fg-secondary hover:bg-bg-muted'
                                }`}
                        >
                            <Icon className={`w-4 h-4 ${isActive ? tab.color : ''}`} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            <div className="max-w-none">
                {contentMap[activeTab]}
            </div>
        </div>
    );
}
