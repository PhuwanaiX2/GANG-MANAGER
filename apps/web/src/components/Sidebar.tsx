'use client';

import { Session } from 'next-auth';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, LogOut, Shield, Terminal, Users } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

export type SidebarNavGroup = 'command' | 'people' | 'attendance' | 'finance' | 'billing' | 'setup';

export interface SidebarNavItem {
    href: string;
    label: string;
    group: SidebarNavGroup;
    icon: any;
    required: string;
}

export interface SidebarProps {
    session: Session;
    gangId?: string;
    gangName?: string;
    gangLogoUrl?: string | null;
    pathname: string;
    pendingLeaveCount?: number;
    navItems: SidebarNavItem[];
    isSystemAdmin?: boolean;
    onItemClick: () => void;
    onSignOut: () => void;
}

const GROUP_LABELS: Record<SidebarNavGroup, string> = {
    command: 'ศูนย์สั่งการ',
    people: 'คนในแก๊ง',
    attendance: 'เช็คชื่อและการลา',
    finance: 'การเงินแก๊ง',
    billing: 'แพลนระบบ',
    setup: 'ตั้งค่าระบบ',
};

function isNavActive(pathname: string, href: string) {
    if (pathname === href) return true;
    const isDashboardRoot = /^\/dashboard\/[^/]+$/.test(href);
    if (!isDashboardRoot && pathname.startsWith(`${href}/`)) return true;
    return false;
}

export function Sidebar({
    session,
    gangId,
    gangName,
    gangLogoUrl,
    pathname,
    pendingLeaveCount,
    navItems,
    isSystemAdmin,
    onItemClick,
    onSignOut,
}: SidebarProps) {
    const groupedItems = navItems.reduce<Record<SidebarNavGroup, SidebarNavItem[]>>((acc, item) => {
        acc[item.group].push(item);
        return acc;
    }, {
        command: [],
        people: [],
        attendance: [],
        finance: [],
        billing: [],
        setup: [],
    });

    return (
        <>
            <div className="relative px-4 py-4">
                <Link href="/dashboard" className="group flex items-center gap-3" onClick={onItemClick}>
                    <div className="flex h-9 w-9 items-center justify-center rounded-token-lg border border-border-accent bg-accent-subtle transition-colors duration-token-normal ease-token-standard group-hover:brightness-105">
                        <Terminal className="h-4 w-4 text-accent-bright" strokeWidth={2} />
                    </div>
                    <div>
                        <span className="block font-heading text-sm font-black tracking-tight text-fg-primary">
                            Gang<span className="text-accent-bright">Manager</span>
                        </span>
                        <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-fg-tertiary">Discord Ops</span>
                    </div>
                </Link>
            </div>

            {gangName && (
                <div className="mb-3 px-3">
                    <div className="relative overflow-hidden rounded-token-lg border border-border-subtle bg-bg-muted/72 px-3 py-3 shadow-token-sm">
                        <Link
                            href="/dashboard"
                            className="relative mb-2 flex items-center gap-1 text-[10px] font-bold tracking-wide text-fg-tertiary transition-colors hover:text-fg-primary"
                            onClick={onItemClick}
                        >
                            <ChevronLeft className="h-3 w-3" />
                            เปลี่ยนแก๊ง
                        </Link>
                        <div className="relative flex items-center gap-2.5">
                            {gangLogoUrl ? (
                                <img
                                    src={gangLogoUrl}
                                    alt={gangName || ''}
                                    className="h-8 w-8 flex-shrink-0 rounded-token-md border border-border-subtle object-cover"
                                    onError={(event) => { (event.target as HTMLImageElement).style.display = 'none'; }}
                                />
                            ) : (
                                <div className="flex h-8 w-8 items-center justify-center rounded-token-md border border-border-subtle bg-bg-muted">
                                    <Users className="h-4 w-4 text-fg-tertiary" />
                                </div>
                            )}
                            <h2 className="max-w-[184px] truncate font-heading text-sm font-black text-fg-primary">{gangName}</h2>
                        </div>
                    </div>
                </div>
            )}

            <nav className="custom-scrollbar flex-1 overflow-y-auto px-2.5">
                {!gangId ? (
                    <div className="px-2">
                        <div className="rounded-token-xl border border-dashed border-border bg-bg-muted/55 p-4 text-center">
                            <p className="text-xs font-semibold text-fg-secondary">เลือกแก๊งเพื่อเริ่มจัดการ</p>
                            <p className="mt-1 text-[11px] leading-5 text-fg-tertiary">
                                ถ้ายังไม่มีแก๊ง ให้ติดตั้งบอทใน Discord แล้วใช้คำสั่ง /setup
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {(Object.keys(GROUP_LABELS) as SidebarNavGroup[]).map((group) => {
                            const items = groupedItems[group];
                            if (items.length === 0) return null;

                            return (
                                <div key={group}>
                                    <div className="mb-1.5 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-fg-tertiary">
                                        {GROUP_LABELS[group]}
                                    </div>
                                    <ul className="space-y-1">
                                        {items.map((item) => {
                                            const Icon = item.icon;
                                            const isActive = isNavActive(pathname, item.href);
                                            const showLeaveBadge = item.label === 'การลา' && pendingLeaveCount && pendingLeaveCount > 0;

                                            return (
                                                <li key={item.href}>
                                                    <Link
                                                        href={item.href}
                                                        onClick={onItemClick}
                                                        className={`group relative flex min-h-11 items-center gap-2.5 rounded-token-lg border px-3 py-2.5 transition-[background-color,border-color,color] duration-token-normal ease-token-standard ${isActive
                                                            ? 'border-border-accent bg-accent-subtle text-accent-bright shadow-token-sm'
                                                            : 'border-transparent text-fg-tertiary hover:bg-bg-muted hover:text-fg-primary'
                                                            }`}
                                                    >
                                                        {isActive && <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-token-full bg-accent-bright" />}
                                                        <Icon className={`h-4 w-4 ${isActive ? 'text-accent-bright' : 'text-fg-tertiary group-hover:text-fg-secondary'} transition-colors`} />
                                                        <span className="text-[13px] font-semibold">{item.label}</span>
                                                        {showLeaveBadge && (
                                                            <span className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-token-full bg-status-danger px-1 text-[9px] font-bold leading-none text-fg-inverse">
                                                                {pendingLeaveCount > 99 ? '99+' : pendingLeaveCount}
                                                            </span>
                                                        )}
                                                    </Link>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            );
                        })}
                    </div>
                )}
            </nav>

            <div className="px-2.5 pb-2.5">
                <ThemeToggle className="w-full" />
            </div>

            <div className="mt-auto border-t border-border-subtle px-3 py-3">
                <div className="flex items-center gap-2.5">
                    {session.user.image ? (
                        <Image
                            src={session.user.image}
                            alt={session.user.name || ''}
                            width={30}
                            height={30}
                            className="shrink-0 rounded-token-full border border-border-subtle"
                        />
                    ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-token-full border border-border-subtle bg-bg-muted">
                            <Users className="h-4 w-4 text-fg-tertiary" />
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold text-fg-primary">{session.user.name}</div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-fg-tertiary">Discord Login</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {isSystemAdmin && (
                            <Link href="/admin" onClick={onItemClick} className="p-1 text-fg-tertiary transition-colors hover:text-fg-primary" title="Admin">
                                <Shield className="h-3.5 w-3.5" />
                            </Link>
                        )}
                        <button onClick={onSignOut} className="p-1 text-fg-tertiary transition-colors hover:text-fg-danger" title="ออกจากระบบ">
                            <LogOut className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
