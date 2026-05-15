'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { AlertTriangle, Info, UserCog } from 'lucide-react';

const TABS = [
    {
        id: 'general',
        label: 'ข้อมูลแก๊ง',
        description: 'ชื่อ รูป และข้อมูลพื้นฐานที่สมาชิกเห็น',
        icon: Info,
        color: 'text-fg-info',
        active: 'border-status-info bg-status-info-subtle',
    },
    {
        id: 'roles-channels',
        label: 'ยศและช่อง',
        description: 'ผูกสิทธิ์กับ Discord และเลือกช่องที่บอทใช้',
        icon: UserCog,
        color: 'text-accent-bright',
        active: 'border-border-accent bg-accent-subtle',
    },
    {
        id: 'advanced',
        label: 'ขั้นสูง',
        description: 'ย้ายเซิร์ฟเวอร์ ยุบแก๊ง และงานที่มีผลกับข้อมูล',
        icon: AlertTriangle,
        color: 'text-fg-danger',
        active: 'border-status-danger bg-status-danger-subtle',
    },
] as const;

type TabId = typeof TABS[number]['id'];

interface Props {
    generalContent: React.ReactNode;
    rolesChannelsContent: React.ReactNode;
    advancedContent: React.ReactNode;
}

export function SettingsTabsClient({ generalContent, rolesChannelsContent, advancedContent }: Props) {
    const searchParams = useSearchParams();
    const pathname = usePathname();

    const initialTab = useMemo<TabId>(() => {
        const tab = searchParams.get('tab');
        if (tab && TABS.some((item) => item.id === tab)) return tab as TabId;
        return 'general';
    }, [searchParams]);
    const [activeTab, setActiveTab] = useState<TabId>(initialTab);

    useEffect(() => {
        setActiveTab(initialTab);
    }, [initialTab]);

    const handleTabChange = useCallback((tab: TabId) => {
        if (tab === activeTab) return;
        setActiveTab(tab);
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', tab);
        window.history.replaceState(null, '', `${pathname}?${params.toString()}`);
    }, [activeTab, pathname, searchParams]);

    const contentMap: Record<TabId, React.ReactNode> = {
        general: generalContent,
        'roles-channels': rolesChannelsContent,
        advanced: advancedContent,
    };

    return (
        <div className="space-y-4">
            <div className="rounded-token-xl border border-border-subtle bg-bg-subtle p-1.5 shadow-token-sm">
                <div className="flex gap-2 overflow-x-auto pb-1 md:grid md:grid-cols-3 md:overflow-visible md:pb-0">
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id)}
                                className={`min-h-12 min-w-[168px] rounded-token-lg border px-3 py-2 text-left transition-colors hover:bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:min-w-0 ${isActive
                                    ? `${tab.active} text-fg-primary shadow-token-sm`
                                    : 'border-border-subtle bg-bg-elevated/70 text-fg-secondary hover:text-fg-primary'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <Icon className={`h-4 w-4 ${isActive ? tab.color : 'text-fg-tertiary'}`} />
                                    <span className="text-sm font-black">{tab.label}</span>
                                </div>
                                <p className="mt-1 line-clamp-1 text-xs leading-5 text-fg-tertiary md:line-clamp-2">{tab.description}</p>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="max-w-none">
                {contentMap[activeTab]}
            </div>
        </div>
    );
}
