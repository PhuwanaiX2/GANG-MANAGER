'use client';

import { useCallback, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Info, Settings, UserCog } from 'lucide-react';

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
            <div className="grid gap-2 rounded-token-2xl border border-border-subtle bg-bg-subtle p-2 shadow-token-sm md:grid-cols-3">
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id)}
                            className={`min-h-20 rounded-token-xl border px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${isActive
                                ? `${tab.active} text-fg-primary shadow-token-md`
                                : 'border-border-subtle bg-bg-elevated/70 text-fg-secondary hover:text-fg-primary'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <Icon className={`h-4 w-4 ${isActive ? tab.color : 'text-fg-tertiary'}`} />
                                <span className="text-sm font-black">{tab.label}</span>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-fg-tertiary">{tab.description}</p>
                        </button>
                    );
                })}
                <div className="hidden items-center gap-2 rounded-token-xl border border-border-subtle bg-bg-muted px-3 py-2 text-xs font-bold text-fg-tertiary md:col-span-3 md:flex">
                    <Settings className="h-3.5 w-3.5" />
                    หน้าแพลนและการชำระเงินถูกแยกไปที่เมนู “แพลนระบบ” เพื่อไม่ให้ปนกับการตั้งค่าแก๊ง
                </div>
            </div>

            <div className="max-w-none">
                {contentMap[activeTab]}
            </div>
        </div>
    );
}
