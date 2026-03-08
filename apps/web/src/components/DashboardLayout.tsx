'use client';

import { Session } from 'next-auth';
import { signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
    LayoutDashboard,
    Users,
    ClipboardCheck,
    Wallet,
    Settings,
    LogOut,
    Terminal,
    Menu,
    X,
    Megaphone,
    CalendarDays,
    UserCircle,
    BarChart3
} from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';
import { SystemBanner } from './SystemBanner';



interface DashboardLayoutProps {
    children: React.ReactNode;
    session: Session;
    gangId?: string;
    gangName?: string;
    gangLogoUrl?: string | null;
    pendingLeaveCount?: number;
    isSystemAdmin?: boolean;
    permissions?: {
        level: 'OWNER' | 'ADMIN' | 'TREASURER' | 'MEMBER' | 'NONE';
        isOwner: boolean;
        isAdmin: boolean;
        isTreasurer: boolean;
        isMember: boolean;
    };
}

export function DashboardLayout({ children, session, gangId, gangName, gangLogoUrl, permissions, pendingLeaveCount, isSystemAdmin }: DashboardLayoutProps) {
    const pathname = usePathname();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);

    const handleSignOut = () => {
        setShowLogoutModal(true);
    };

    const navItems: { href: string; label: string; icon: any; required: string }[] = gangId ? [
        { href: `/dashboard/${gangId}`, label: 'ภาพรวม', icon: LayoutDashboard, required: 'MEMBER' },
        { href: `/dashboard/${gangId}/my-profile`, label: 'ยอดของฉัน', icon: UserCircle, required: 'MEMBER' },
        { href: `/dashboard/${gangId}/members`, label: 'สมาชิก', icon: Users, required: 'MEMBER' },
        { href: `/dashboard/${gangId}/announcements`, label: 'ประกาศ', icon: Megaphone, required: 'ADMIN' },
        { href: `/dashboard/${gangId}/attendance`, label: 'เช็คชื่อ', icon: ClipboardCheck, required: 'ADMIN' },
        { href: `/dashboard/${gangId}/leaves`, label: 'การลา', icon: CalendarDays, required: 'ADMIN' },
        { href: `/dashboard/${gangId}/finance`, label: 'การเงิน', icon: Wallet, required: 'TREASURER' },
        { href: `/dashboard/${gangId}/analytics`, label: 'Analytics', icon: BarChart3, required: 'ADMIN' },
        { href: `/dashboard/${gangId}/settings`, label: 'ตั้งค่า', icon: Settings, required: 'OWNER' },
    ].filter(item => {
        if (!permissions) return true;
        if (permissions.isOwner) return true; // Owner sees everything

        if (item.required === 'OWNER') return false;
        if (item.required === 'TREASURER') return permissions.isTreasurer;
        if (item.required === 'ADMIN') return permissions.isAdmin;
        return true;
    }) : [];

    return (
        <div className="min-h-screen flex bg-[#09090B] text-white selection:bg-emerald-500/30 selection:text-white font-sans">
            {/* Sidebar Desktop */}
            <aside className="hidden md:flex w-56 bg-[#0C0C0E] border-r border-white/[0.06] flex-col relative z-20">
                <Sidebar
                    session={session}
                    gangId={gangId}
                    gangName={gangName}
                    gangLogoUrl={gangLogoUrl}
                    pathname={pathname || ''}
                    pendingLeaveCount={pendingLeaveCount}
                    navItems={navItems}
                    isSystemAdmin={isSystemAdmin}
                    onItemClick={() => setIsMobileMenuOpen(false)}
                    onSignOut={handleSignOut}
                />
            </aside>

            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden animate-fade-in" onClick={() => setIsMobileMenuOpen(false)} />
            )}

            {/* Mobile Sidebar */}
            <div className={`fixed inset-y-0 left-0 w-60 bg-[#0C0C0E] border-r border-white/[0.08] flex flex-col shadow-2xl z-50 transform transition-all duration-300 ease-out md:hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <Sidebar
                    session={session}
                    gangId={gangId}
                    gangName={gangName}
                    gangLogoUrl={gangLogoUrl}
                    pathname={pathname || ''}
                    pendingLeaveCount={pendingLeaveCount}
                    navItems={navItems}
                    isSystemAdmin={isSystemAdmin}
                    onItemClick={() => setIsMobileMenuOpen(false)}
                    onSignOut={handleSignOut}
                />
                <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="absolute top-6 right-4 p-2 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all border border-white/5"
                    aria-label="Close menu"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 relative bg-[#09090B] text-zinc-300 h-screen overflow-hidden">
                {/* Mobile Header */}
                <header className="md:hidden flex items-center justify-between p-4 border-b border-white/[0.06] bg-[#09090B]/80 backdrop-blur-xl sticky top-0 z-30">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#111] border border-white/10 flex items-center justify-center">
                            <Terminal className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-bold text-[15px] tracking-tight text-white font-heading">Dashboard</span>
                    </div>
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="p-2 text-zinc-400 hover:text-white rounded-lg bg-white/5 hover:bg-white/10 transition-all border border-white/5"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                </header>

                {/* Scrollable Area */}
                <div className="flex-1 overflow-auto custom-scrollbar relative">
                    <div className="p-4 sm:p-6 max-w-7xl mx-auto min-h-full flex flex-col">
                        <div className="flex-1">
                            <SystemBanner />
                            {children}
                        </div>
                        <div className="mt-8 border-t border-white/[0.04] pt-6 pb-3">
                            <Footer />
                        </div>
                    </div>
                </div>
            </main>

            {/* Logout Confirmation Modal */}
            {showLogoutModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-[#16161A] border border-white/10 rounded-2xl p-6 sm:p-8 w-full max-w-sm shadow-2xl animate-fade-in-up">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center mb-5">
                                <LogOut className="w-6 h-6 text-rose-400" />
                            </div>
                            <h3 className="font-bold text-white text-xl mb-2 font-heading">ออกจากระบบ?</h3>
                            <p className="text-zinc-400 text-sm leading-relaxed mb-8">
                                คุณกำลังจะออกจากระบบ กลับไปหน้าล็อกอิน
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowLogoutModal(false)}
                                className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-medium transition-all border border-white/5"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={() => {
                                    setShowLogoutModal(false);
                                    signOut();
                                }}
                                className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-rose-500/20"
                            >
                                ยืนยัน
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
