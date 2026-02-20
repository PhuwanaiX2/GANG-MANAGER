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
                    <div className="p-2.5 border border-fivem-red/30 bg-black/60 rounded shadow-[0_0_15px_rgba(255,42,0,0.2)] group-hover:scale-110 transition-transform duration-300">
                        <Gamepad2 className="w-6 h-6 text-fivem-red" />
                    </div>
                    <span className="font-black text-xl tracking-tighter text-white uppercase transition-all duration-300">คุมเมือง</span>
                </Link>
            </div>

            {/* Gang Context Header */}
            {gangName && (
                <div className="px-6 mb-8 mt-2">
                    <div className="p-4 bg-black border border-[#151515] relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-fivem-red/10 blur-2xl -mr-10 -mt-10 group-hover:bg-fivem-red/20 transition-colors" />
                        <Link
                            href="/dashboard"
                            className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-fivem-red font-bold mb-3 hover:text-white transition-colors"
                            onClick={onItemClick}
                        >
                            <ChevronLeft className="w-3 h-3" />
                            เปลี่ยนแก็ง
                        </Link>
                        <div className="flex items-center gap-3">
                            {gangLogoUrl ? (
                                <img
                                    src={gangLogoUrl}
                                    alt={gangName || ''}
                                    className="w-10 h-10 object-cover border border-fivem-border flex-shrink-0"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                            ) : null}
                            <h2 className="font-black text-lg text-white truncate drop-shadow-sm uppercase">{gangName}</h2>
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
                                        className={`flex items-center gap-3.5 px-4 py-3.5 transition-all duration-300 group relative overflow-hidden ${isActive
                                            ? 'bg-[#111111] text-white border-l-2 border-fivem-red font-bold'
                                            : 'text-zinc-500 hover:bg-[#0A0A0A] hover:text-[#d1d5db] hover:border-l-2 hover:border-[#151515] border-l-2 border-transparent'
                                            }`}
                                    >
                                        <Icon className={`w-5 h-5 ${isActive ? 'text-fivem-red' : 'group-hover:scale-110 transition-transform'}`} />
                                        <span className="text-sm tracking-wide uppercase">{item.label}</span>
                                        {/* Pending Leave Badge */}
                                        {item.label === 'การลา' && pendingLeaveCount && pendingLeaveCount > 0 && (
                                            <span className="ml-auto px-2 py-0.5 text-[10px] font-black bg-fivem-red text-white shadow-[0_0_10px_rgba(255,42,0,0.5)] animate-pulse-slow">
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
                <div className="p-4 bg-black border border-[#151515] group">
                    <div className="flex items-center gap-3">
                        {session.user.image ? (
                            <div className="relative">
                                <Image
                                    src={session.user.image}
                                    alt={session.user.name || ''}
                                    width={40}
                                    height={40}
                                    className="border border-[#151515] group-hover:border-fivem-red transition-colors shadow-lg shadow-black/40"
                                />
                                <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 border-2 border-black" />
                            </div>
                        ) : (
                            <div className="w-10 h-10 bg-[#0A0A0A] flex items-center justify-center border border-[#151515] group-hover:border-fivem-red transition-colors shadow-lg">
                                <Users className="w-5 h-5 text-zinc-500" />
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm truncate text-white block uppercase tracking-wide">
                                {session.user.name}
                            </div>
                            <div className="flex items-center gap-2 mt-1.5">
                                <button
                                    onClick={onSignOut}
                                    className="flex items-center gap-1.5 text-[10px] font-bold text-fivem-red/80 hover:text-fivem-red uppercase tracking-widest transition-colors"
                                >
                                    <LogOut className="w-3 h-3" />
                                    Sign Out
                                </button>
                                {isSystemAdmin && (
                                    <Link
                                        href="/admin"
                                        onClick={onItemClick}
                                        className="ml-auto p-1 text-zinc-600 hover:text-fivem-red transition-colors"
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
