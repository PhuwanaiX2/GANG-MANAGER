'use client';

import { Session } from 'next-auth';
import Image from 'next/image';
import Link from 'next/link';
import {
    Gamepad2,
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
            <div className="p-8 pb-6">
                <Link href="/dashboard" className="flex items-center gap-3 group" onClick={onItemClick}>
                    <div className="p-2.5 bg-gradient-premium rounded-2xl shadow-lg shadow-discord-primary/20 group-hover:scale-110 transition-transform duration-300">
                        <Gamepad2 className="w-6 h-6 text-white" />
                    </div>
                    <span className="font-bold text-xl tracking-tight text-white group-hover:bg-clip-text group-hover:text-transparent group-hover:bg-gradient-premium transition-all duration-300">Gang Manager</span>
                </Link>
            </div>

            {/* Gang Context Header */}
            {gangName && (
                <div className="px-6 mb-8 mt-2">
                    <div className="p-5 rounded-[1.5rem] bg-white/[0.03] border border-white/10 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-discord-primary/10 blur-2xl -mr-10 -mt-10 group-hover:bg-discord-primary/20 transition-colors" />
                        <Link
                            href="/dashboard"
                            className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-discord-primary font-bold mb-2 hover:text-white transition-colors"
                            onClick={onItemClick}
                        >
                            <ChevronLeft className="w-3 h-3" />
                            เปลี่ยนแก๊ง
                        </Link>
                        <div className="flex items-center gap-3">
                            {gangLogoUrl ? (
                                <img
                                    src={gangLogoUrl}
                                    alt={gangName || ''}
                                    className="w-10 h-10 rounded-xl object-cover border border-white/10 flex-shrink-0"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                            ) : null}
                            <h2 className="font-black text-xl text-white truncate drop-shadow-sm">{gangName}</h2>
                        </div>
                    </div>
                </div>
            )}

            {/* Navigation */}
            {navItems.length > 0 ? (
                <nav className="flex-1 px-6 py-2 overflow-y-auto custom-scrollbar">
                    {!gangId && (
                        <div className="p-4 mb-3 rounded-xl bg-white/5 border border-dashed border-white/10 text-center">
                            <p className="text-xs text-gray-500">กรุณาเลือกแก๊งเพื่อเริ่มการจัดการ</p>
                        </div>
                    )}
                    <ul className="space-y-1.5">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href;
                            return (
                                <li key={item.href}>
                                    <Link
                                        href={item.href}
                                        onClick={onItemClick}
                                        className={`flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative overflow-hidden ${isActive
                                            ? 'bg-gradient-premium text-white shadow-xl shadow-discord-primary/20 font-semibold'
                                            : 'text-gray-400 hover:bg-white/[0.05] hover:text-white border border-transparent hover:border-white/5'
                                            }`}
                                    >
                                        {isActive && (
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-white opacity-50" />
                                        )}
                                        <Icon className={`w-5 h-5 ${isActive ? '' : 'group-hover:scale-110 transition-transform'}`} />
                                        <span className="text-sm font-medium tracking-wide">{item.label}</span>
                                        {/* Pending Leave Badge */}
                                        {item.label === 'การลา' && pendingLeaveCount && pendingLeaveCount > 0 && (
                                            <span className="ml-auto px-2 py-0.5 text-[10px] font-black bg-white text-discord-primary rounded-full shadow-sm animate-pulse-slow">
                                                {pendingLeaveCount}
                                            </span>
                                        )}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>
            ) : (
                <div className="flex-1 px-6 py-4">
                    <div className="p-4 rounded-xl bg-white/5 border border-dashed border-white/10 text-center">
                        <p className="text-xs text-gray-500">กรุณาเลือกแก๊งเพื่อเริ่มการจัดการ</p>
                    </div>
                </div>
            )}

            {/* User Profile */}
            <div className="p-6">
                <div className="p-4 rounded-[1.5rem] bg-white/[0.03] border border-white/10 group">
                    <div className="flex items-center gap-3">
                        {session.user.image ? (
                            <div className="relative">
                                <Image
                                    src={session.user.image}
                                    alt={session.user.name || ''}
                                    width={44}
                                    height={44}
                                    className="rounded-2xl border-2 border-white/10 group-hover:border-discord-primary transition-colors shadow-lg shadow-black/40"
                                />
                                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-[#111] rounded-full" />
                            </div>
                        ) : (
                            <div className="w-11 h-11 rounded-2xl bg-white/5 flex items-center justify-center border-2 border-white/10 group-hover:border-discord-primary transition-colors shadow-lg">
                                <Users className="w-5 h-5 text-gray-400" />
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm truncate text-white block">
                                {session.user.name}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <button
                                    onClick={onSignOut}
                                    className="flex items-center gap-1.5 text-[11px] font-bold text-red-400/80 hover:text-red-400 uppercase tracking-wider transition-colors"
                                >
                                    <LogOut className="w-3 h-3" />
                                    Sign Out
                                </button>
                                {isSystemAdmin && (
                                    <Link
                                        href="/admin"
                                        onClick={onItemClick}
                                        className="ml-auto p-1 text-gray-600 hover:text-gray-400 transition-colors rounded-md"
                                        title="System Admin"
                                    >
                                        <Shield className="w-3 h-3" />
                                    </Link>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
