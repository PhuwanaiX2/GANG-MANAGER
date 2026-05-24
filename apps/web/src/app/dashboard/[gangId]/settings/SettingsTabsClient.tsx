'use client';

import type { ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { AlertTriangle, Info, UserCog } from 'lucide-react';
import { OpsSubNav } from '@/components/ui';

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
        description: 'เปลี่ยนชื่อยศระบบ และเลือกช่องที่บอทใช้',
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
    activeTab?: TabId;
    children?: ReactNode;
    generalContent?: ReactNode;
    rolesChannelsContent?: ReactNode;
    advancedContent?: ReactNode;
}

export function SettingsTabsClient({
    activeTab: forcedActiveTab,
    children,
    generalContent,
    rolesChannelsContent,
    advancedContent,
}: Props) {
    const searchParams = useSearchParams();
    const pathname = usePathname();

    const normalizedPath = pathname.replace(/\/$/, '');
    const pathTab: TabId | null = normalizedPath.endsWith('/roles-channels')
        ? 'roles-channels'
        : normalizedPath.endsWith('/advanced')
            ? 'advanced'
            : null;
    const basePath = pathTab ? normalizedPath.slice(0, normalizedPath.lastIndexOf('/')) : normalizedPath;
    const requestedTab = pathTab || searchParams.get('tab');
    const activeTab: TabId = forcedActiveTab || (requestedTab && TABS.some((item) => item.id === requestedTab)
        ? requestedTab as TabId
        : 'general');

    const contentMap: Record<TabId, ReactNode> = {
        general: generalContent ?? null,
        'roles-channels': rolesChannelsContent ?? null,
        advanced: advancedContent ?? null,
    };

    return (
        <div className="space-y-4">
            <OpsSubNav
                ariaLabel="Settings sections"
                items={TABS.map((tab) => ({
                    id: tab.id,
                    label: tab.label,
                    description: tab.description,
                    icon: tab.icon,
                    href: tab.id === 'general' ? basePath : `${basePath}/${tab.id}`,
                    active: activeTab === tab.id,
                    tone: tab.id === 'advanced' ? 'danger' : tab.id === 'roles-channels' ? 'accent' : 'info',
                }))}
            />

            <div className="max-w-none">
                {children ?? contentMap[activeTab]}
            </div>
        </div>
    );
}
