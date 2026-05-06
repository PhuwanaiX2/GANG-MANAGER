'use client';

import { useCallback, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Info, Settings, UserCog } from 'lucide-react';

const TABS = [
    { id: 'general', label: 'ทั่วไป', icon: Info, color: 'text-fg-info' },
    { id: 'roles-channels', label: 'ยศและช่อง', icon: UserCog, color: 'text-accent-bright' },
    { id: 'advanced', label: 'ขั้นสูง', icon: AlertTriangle, color: 'text-fg-danger' },
] as const;

type TabId = typeof TABS[number]['id'];

interface Props {
    generalContent: React.ReactNode;
    rolesChannelsContent: React.ReactNode;
    advancedContent: React.ReactNode;
}

export function SettingsTabsClient({ generalContent, rolesChannelsContent, advancedContent }: Props) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const initialTab = useMemo<TabId>(() => {
        const tab = searchParams.get('tab');
        if (tab && TABS.some((item) => item.id === tab)) return tab as TabId;
        return 'general';
    }, [searchParams]);
    const [activeTab, setActiveTab] = useState<TabId>(initialTab);

    const handleTabChange = useCallback((tab: TabId) => {
        setActiveTab(tab);
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', tab);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, [pathname, router, searchParams]);

    const contentMap: Record<TabId, React.ReactNode> = {
        general: generalContent,
        'roles-channels': rolesChannelsContent,
        advanced: advancedContent,
    };

    return (
        <div className="space-y-6">
            <div className="flex gap-1 p-1 bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-x-auto shadow-token-sm">
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id)}
                            className={`flex min-h-11 items-center gap-2 px-4 py-2.5 rounded-token-xl text-sm font-bold transition-all whitespace-nowrap ${isActive
                                ? 'bg-bg-elevated text-fg-primary shadow-token-md'
                                : 'text-fg-tertiary hover:text-fg-secondary hover:bg-bg-muted'
                                }`}
                        >
                            <Icon className={`w-4 h-4 ${isActive ? tab.color : ''}`} />
                            {tab.label}
                        </button>
                    );
                })}
                <div className="ml-auto hidden items-center gap-2 px-3 text-xs font-bold text-fg-tertiary sm:flex">
                    <Settings className="h-3.5 w-3.5" />
                    ตั้งค่าพื้นฐานเท่านั้น
                </div>
            </div>

            <div className="max-w-none">
                {contentMap[activeTab]}
            </div>
        </div>
    );
}
