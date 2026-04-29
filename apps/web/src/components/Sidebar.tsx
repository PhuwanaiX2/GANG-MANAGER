'use client';

import { Session } from 'next-auth';
import Image from 'next/image';
import Link from 'next/link';
import {
    Terminal,
    LogOut,
    Users,
    ChevronLeft,
    Shield
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

export interface SidebarProps {
    session: Session;
    gangId?: string;
    gangName?: string;
    gangLogoUrl?: string | null;
    pathname: string;
    pendingLeaveCount?: number;
    navItems: any[];
    isSystemAdmin?: boolean;
    onItemClick: () => void;
    onSignOut: () => void;
}

export function Sidebar({ session, gangId, gangName, gangLogoUrl, pathname, pendingLeaveCount, navItems, isSystemAdmin, onItemClick, onSignOut }: SidebarProps) {
    return (
        <>
            {/* Logo */}
            <div className="px-4 py-4">
                <Link href="/dashboard" className="flex items-center gap-2 group" onClick={onItemClick}>
                    <div className="w-7 h-7 rounded-token-md bg-accent-subtle border border-border-accent flex items-center justify-center transition-colors duration-token-normal ease-token-standard group-hover:brightness-125">
                        <Terminal className="w-3.5 h-3.5 text-accent-bright" strokeWidth={2} />
                    </div>
                    <span className="font-bold text-sm tracking-tight font-heading text-fg-primary">
                        Gang<span className="text-accent-bright">Manager</span>
                    </span>
                </Link>
            </div>

            {/* Gang Context Header */}
            {gangName && (
                <div className="px-3 mb-3">
                    <div className="px-3 py-2.5 rounded-token-md bg-bg-subtle border border-border-subtle">
                        <Link
                            href="/dashboard"
                            className="flex items-center gap-1 text-[10px] font-bold tracking-wide text-fg-tertiary hover:text-fg-primary transition-colors mb-2"
                            onClick={onItemClick}
                        >
                            <ChevronLeft className="w-3 h-3" />
                            เปลี่ยนแก๊ง
                        </Link>
                        <div className="flex items-center gap-2.5">
                            {gangLogoUrl ? (
                                <img
                                    src={gangLogoUrl}
                                    alt={gangName || ''}
                                    className="w-7 h-7 rounded-token-md object-cover border border-border-subtle flex-shrink-0"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                            ) : (
                                <div className="w-7 h-7 rounded-token-md bg-bg-muted flex items-center justify-center border border-border-subtle">
                                    <Users className="w-3.5 h-3.5 text-fg-tertiary" />
                                </div>
                            )}
                            <h2 className="font-semibold text-sm text-fg-primary truncate max-w-[150px]">{gangName}</h2>
                        </div>
                    </div>
                </div>
            )}

            {/* Navigation */}
            <nav className="flex-1 px-3 overflow-y-auto custom-scrollbar">
                {!gangId ? (
                    <div className="px-2">
                        <div className="p-3 rounded-token-md border border-dashed border-border text-center">
                            <p className="text-xs text-fg-tertiary">เลือกแก๊งเพื่อเริ่มจัดการ</p>
                        </div>
                    </div>
                ) : (
                    <ul className="space-y-0.5">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href;
                            return (
                                <li key={item.href}>
                                    <Link
                                        href={item.href}
                                        onClick={onItemClick}
                                        className={`flex items-center gap-2.5 px-3 py-2 rounded-token-md transition-colors duration-token-normal ease-token-standard group border ${isActive
                                            ? 'bg-accent-subtle text-accent-bright border-border-accent'
                                            : 'text-fg-tertiary hover:bg-bg-muted hover:text-fg-primary border-transparent'
                                            }`}
                                    >
                                        <Icon className={`w-4 h-4 ${isActive ? 'text-accent-bright' : 'text-fg-tertiary group-hover:text-fg-secondary'} transition-colors`} />
                                        <span className="text-[13px] font-semibold">{item.label}</span>

                                        {item.label === 'การลา' && pendingLeaveCount && pendingLeaveCount > 0 && (
                                            <span className="ml-auto flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-token-full bg-status-danger text-[9px] font-bold text-fg-inverse leading-none">
                                                {pendingLeaveCount > 99 ? '99+' : pendingLeaveCount}
                                            </span>
                                        )}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </nav>

            <div className="px-3 pb-3">
                <div className="rounded-token-xl border border-border-subtle bg-bg-muted/70 p-2 shadow-token-sm">
                    <div className="mb-2 flex items-center justify-between gap-2 px-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-fg-tertiary">Theme</span>
                        <span className="h-1.5 w-1.5 rounded-token-full bg-accent" />
                    </div>
                    <ThemeToggle className="w-full justify-center" />
                </div>
            </div>

            {/* User Profile */}
            <div className="px-3 py-3 mt-auto border-t border-border-subtle">
                <div className="flex items-center gap-2.5">
                    {session.user.image ? (
                        <Image
                            src={session.user.image}
                            alt={session.user.name || ''}
                            width={28}
                            height={28}
                            className="rounded-token-full border border-border-subtle shrink-0"
                        />
                    ) : (
                        <div className="w-7 h-7 shrink-0 rounded-token-full bg-bg-muted flex items-center justify-center border border-border-subtle">
                            <Users className="w-3.5 h-3.5 text-fg-tertiary" />
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold truncate text-fg-primary">{session.user.name}</div>
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
