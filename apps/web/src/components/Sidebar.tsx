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
                    <div className="w-7 h-7 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center transition-all group-hover:bg-emerald-500/20">
                        <Terminal className="w-3.5 h-3.5 text-emerald-400" strokeWidth={2} />
                    </div>
                    <span className="font-bold text-sm tracking-tight font-heading text-white">
                        Gang<span className="text-emerald-400">Manager</span>
                    </span>
                </Link>
            </div>

            {/* Gang Context Header */}
            {gangName && (
                <div className="px-3 mb-3">
                    <div className="px-3 py-2.5 rounded-lg bg-[#0F0F12] border border-white/[0.06]">
                        <Link
                            href="/dashboard"
                            className="flex items-center gap-1 text-[10px] font-medium text-zinc-500 hover:text-white transition-colors mb-2"
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
                                    className="w-7 h-7 rounded-md object-cover border border-white/10 flex-shrink-0"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                            ) : (
                                <div className="w-7 h-7 rounded-md bg-zinc-800 flex items-center justify-center border border-white/10">
                                    <Users className="w-3.5 h-3.5 text-zinc-400" />
                                </div>
                            )}
                            <h2 className="font-medium text-sm text-white truncate max-w-[150px]">{gangName}</h2>
                        </div>
                    </div>
                </div>
            )}

            {/* Navigation */}
            <nav className="flex-1 px-3 overflow-y-auto custom-scrollbar">
                {!gangId ? (
                    <div className="px-2">
                        <div className="p-3 rounded-lg border border-dashed border-white/10 text-center">
                            <p className="text-xs text-zinc-500">เลือกแก๊งเพื่อเริ่มจัดการ</p>
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
                                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all group ${isActive
                                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10'
                                            : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300 border border-transparent'
                                            }`}
                                    >
                                        <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-zinc-600 group-hover:text-zinc-400'} transition-colors`} />
                                        <span className="text-[13px] font-medium">{item.label}</span>

                                        {item.label === 'การลา' && pendingLeaveCount && pendingLeaveCount > 0 && (
                                            <span className="ml-auto flex items-center justify-center w-4.5 h-4.5 rounded-full bg-rose-500 text-[9px] font-bold text-white">
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

            {/* User Profile */}
            <div className="px-3 py-3 mt-auto border-t border-white/[0.06]">
                <div className="flex items-center gap-2.5">
                    {session.user.image ? (
                        <Image
                            src={session.user.image}
                            alt={session.user.name || ''}
                            width={28}
                            height={28}
                            className="rounded-full border border-white/10 shrink-0"
                        />
                    ) : (
                        <div className="w-7 h-7 shrink-0 rounded-full bg-zinc-800 flex items-center justify-center border border-white/10">
                            <Users className="w-3.5 h-3.5 text-zinc-400" />
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium truncate text-white">{session.user.name}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {isSystemAdmin && (
                            <Link href="/admin" onClick={onItemClick} className="text-zinc-600 hover:text-white transition-colors p-1" title="Admin">
                                <Shield className="w-3.5 h-3.5" />
                            </Link>
                        )}
                        <button onClick={onSignOut} className="text-zinc-600 hover:text-rose-500 transition-colors p-1" title="ออกจากระบบ">
                            <LogOut className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
