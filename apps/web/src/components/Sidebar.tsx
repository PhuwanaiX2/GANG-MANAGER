'use client';

import { Session } from 'next-auth';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, LogOut, Shield, Terminal, Users } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

export type SidebarNavGroup = 'command' | 'people' | 'operations' | 'business' | 'setup';

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
    operations: 'งานประจำวัน',
    business: 'การเงินและแพลน',
    setup: 'ตั้งค่าระบบ',
};

function isNavActive(pathname: string, href: string) {
    if (pathname === href) return true;
    if (href.endsWith('/billing')) return pathname.startsWith(href);
    if (href.endsWith('/settings')) return pathname.startsWith(href);
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
        operations: [],
        business: [],
        setup: [],
    });

    return (
        <>
            <div className="relative px-4 py-4">
                <Link href="/dashboard" className="flex items-center gap-3 group" onClick={onItemClick}>
                    <div className="w-9 h-9 rounded-token-xl bg-accent-subtle border border-border-accent flex items-center justify-center shadow-token-glow-accent transition-colors duration-token-normal ease-token-standard group-hover:brightness-125">
                        <Terminal className="w-4 h-4 text-accent-bright" strokeWidth={2} />
                    </div>
                    <div>
                        <span className="block font-black text-sm tracking-tight font-heading text-fg-primary">
                            Gang<span className="text-accent-bright">Manager</span>
                        </span>
                        <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-fg-tertiary">Discord Ops</span>
                    </div>
                </Link>
            </div>

            {gangName && (
                <div className="px-3 mb-3">
                    <div className="relative overflow-hidden px-3 py-3 rounded-token-xl bg-bg-muted/72 border border-border-subtle shadow-token-sm">
                        <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-token-full bg-accent-subtle blur-2xl" />
                        <Link
                            href="/dashboard"
                            className="relative flex items-center gap-1 text-[10px] font-bold tracking-wide text-fg-tertiary hover:text-fg-primary transition-colors mb-2"
                            onClick={onItemClick}
                        >
                            <ChevronLeft className="w-3 h-3" />
                            เปลี่ยนแก๊ง
                        </Link>
                        <div className="relative flex items-center gap-2.5">
                            {gangLogoUrl ? (
                                <img
                                    src={gangLogoUrl}
                                    alt={gangName || ''}
                                    className="w-8 h-8 rounded-token-md object-cover border border-border-subtle flex-shrink-0"
                                    onError={(event) => { (event.target as HTMLImageElement).style.display = 'none'; }}
                                />
                            ) : (
                                <div className="w-8 h-8 rounded-token-md bg-bg-muted flex items-center justify-center border border-border-subtle">
                                    <Users className="w-4 h-4 text-fg-tertiary" />
                                </div>
                            )}
                            <h2 className="font-black text-sm text-fg-primary truncate max-w-[184px] font-heading">{gangName}</h2>
                        </div>
                    </div>
                </div>
            )}

            <nav className="flex-1 px-2.5 overflow-y-auto custom-scrollbar">
                {!gangId ? (
                    <div className="px-2">
                        <div className="p-4 rounded-token-xl border border-dashed border-border bg-bg-muted/55 text-center">
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
                                                        className={`relative flex min-h-11 items-center gap-2.5 px-3 py-2.5 rounded-token-xl transition-[background-color,border-color,color,transform] duration-token-normal ease-token-standard group border ${isActive
                                                            ? 'bg-accent-subtle text-accent-bright border-border-accent shadow-token-sm'
                                                            : 'text-fg-tertiary hover:bg-bg-muted hover:text-fg-primary border-transparent hover:translate-x-0.5'
                                                            }`}
                                                    >
                                                        {isActive && <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-token-full bg-accent-bright" />}
                                                        <Icon className={`w-4 h-4 ${isActive ? 'text-accent-bright' : 'text-fg-tertiary group-hover:text-fg-secondary'} transition-colors`} />
                                                        <span className="text-[13px] font-semibold">{item.label}</span>
                                                        {showLeaveBadge && (
                                                            <span className="ml-auto flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-token-full bg-status-danger text-[9px] font-bold text-fg-inverse leading-none">
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

            <div className="px-3 py-3 mt-auto border-t border-border-subtle">
                <div className="flex items-center gap-2.5">
                    {session.user.image ? (
                        <Image
                            src={session.user.image}
                            alt={session.user.name || ''}
                            width={30}
                            height={30}
                            className="rounded-token-full border border-border-subtle shrink-0"
                        />
                    ) : (
                        <div className="w-8 h-8 shrink-0 rounded-token-full bg-bg-muted flex items-center justify-center border border-border-subtle">
                            <Users className="w-4 h-4 text-fg-tertiary" />
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold truncate text-fg-primary">{session.user.name}</div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-fg-tertiary">Discord Login</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {isSystemAdmin && (
                            <Link href="/admin" onClick={onItemClick} className="text-fg-tertiary hover:text-fg-primary transition-colors p-1" title="Admin">
                                <Shield className="w-3.5 h-3.5" />
                            </Link>
                        )}
                        <button onClick={onSignOut} className="text-fg-tertiary hover:text-fg-danger transition-colors p-1" title="ออกจากระบบ">
                            <LogOut className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
