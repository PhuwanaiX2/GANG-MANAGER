'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Server,
    Key,
    Power,
    Database,
    ShieldAlert,
    Home,
    LogOut,
    Menu,
    X,
    Shield,
    DollarSign,
} from 'lucide-react';
import { useState } from 'react';

interface Props {
    adminName: string;
    adminAvatar?: string;
}

const NAV_ITEMS = [
    { href: '/admin', label: 'ภาพรวม', icon: LayoutDashboard, exact: true },
    { href: '/admin/gangs', label: 'จัดการแก๊ง', icon: Server },
    { href: '/admin/licenses', label: 'License Keys', icon: Key },
    { href: '/admin/features', label: 'Feature Flags', icon: Power },
    { href: '/admin/sales', label: 'ยอดขาย (Stripe)', icon: DollarSign },
    { href: '/admin/data', label: 'ข้อมูล & Backup', icon: Database },
    { href: '/admin/security', label: 'ความปลอดภัย', icon: ShieldAlert },
];

export function AdminSidebar({ adminName, adminAvatar }: Props) {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);

    const isActive = (item: typeof NAV_ITEMS[0]) => {
        if (item.exact) return pathname === item.href;
        return pathname.startsWith(item.href);
    };

    const sidebar = (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-5 border-b border-white/5">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                        <Shield className="w-4.5 h-4.5 text-red-500" />
                    </div>
                    <div className="min-w-0">
                        <div className="text-sm font-black text-white tracking-tight">Super Admin</div>
                        <div className="text-[10px] text-gray-600 font-mono truncate">Control Panel</div>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {NAV_ITEMS.map(item => {
                    const active = isActive(item);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                                active
                                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                            }`}
                        >
                            <item.icon className={`w-4 h-4 shrink-0 ${active ? 'text-red-400' : ''}`} />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-white/5 space-y-2">
                {/* Admin info */}
                <div className="flex items-center gap-2.5 px-2 py-2">
                    {adminAvatar ? (
                        <img src={adminAvatar} alt="" className="w-7 h-7 rounded-lg object-cover border border-white/10" />
                    ) : (
                        <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center">
                            <Shield className="w-3.5 h-3.5 text-red-400" />
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white truncate">{adminName}</div>
                        <div className="text-[9px] text-red-400/60 font-bold uppercase tracking-wider">Super Admin</div>
                    </div>
                </div>

                {/* Quick links */}
                <div className="flex items-center gap-1">
                    <Link href="/" className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] text-gray-500 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                        <Home className="w-3 h-3" />
                        หน้าแรก
                    </Link>
                    <Link href="/dashboard" className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] text-gray-500 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                        <Server className="w-3 h-3" />
                        Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );

    return (
        <>
            {/* Desktop Sidebar */}
            <aside className="hidden lg:block fixed left-0 top-0 bottom-0 w-64 bg-[#0a0a0a] border-r border-white/5 z-40">
                {sidebar}
            </aside>

            {/* Mobile Toggle */}
            <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="lg:hidden fixed top-4 left-4 z-50 p-2.5 rounded-xl bg-[#111] border border-white/10 text-white shadow-xl"
            >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Mobile Overlay */}
            {mobileOpen && (
                <div className="lg:hidden fixed inset-0 z-40 flex">
                    <div className="w-64 bg-[#0a0a0a] border-r border-white/5 h-full">
                        {sidebar}
                    </div>
                    <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
                </div>
            )}
        </>
    );
}
