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
    Gamepad2,
    Menu,
    X,
    Megaphone,
    CalendarDays,
    UserCircle,
    BarChart3
} from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';



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
        <div className="min-h-screen flex bg-black text-white selection:bg-discord-primary/30 font-sans">
            {/* Sidebar Desktop */}
            <aside className="hidden md:flex w-72 bg-black/40 backdrop-blur-xl border-r border-white/5 flex-col shadow-[20px_0_50px_rgba(0,0,0,0.5)] relative z-20">
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
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-40 md:hidden animate-fade-in" onClick={() => setIsMobileMenuOpen(false)} />
            )}

            {/* Mobile Sidebar */}
            <div className={`fixed inset-y-0 left-0 w-72 bg-black/80 backdrop-blur-2xl border-r border-white/10 flex flex-col shadow-2xl z-50 transform transition-all duration-500 ease-out md:hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
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
                    className="absolute top-6 right-6 p-2 text-gray-400 hover:text-white bg-white/5 rounded-full transition-all"
                    aria-label="Close menu"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                {/* Decorative background blobs */}
                <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-discord-primary/10 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

                {/* Mobile Header */}
                <header className="md:hidden flex items-center justify-between p-4 border-b border-white/5 bg-black/40 backdrop-blur-lg sticky top-0 z-30">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-premium rounded-xl shadow-lg shadow-discord-primary/20">
                            <Gamepad2 className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Gang Manager</span>
                    </div>
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="p-2.5 text-gray-400 hover:text-white rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/5"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                </header>

                <div className="flex-1 overflow-auto p-6 sm:p-10 relative z-10 custom-scrollbar">
                    <div className="max-w-7xl mx-auto min-h-full flex flex-col">
                        <div className="flex-1">
                            {children}
                        </div>
                        <div className="mt-auto border-t border-white/5 pt-8">
                            <Footer />
                        </div>
                    </div>
                </div>
            </main>

            {/* Logout Confirmation Modal */}
            {showLogoutModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-[#111111]/90 backdrop-blur-xl border border-white/10 rounded-[2rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] p-8 w-full max-w-sm transform scale-100 transition-all animate-in zoom-in-95 duration-300">
                        <div className="flex flex-col items-center text-center">
                            <div className="p-4 bg-red-500/10 rounded-2xl mb-6">
                                <LogOut className="w-8 h-8 text-red-500" />
                            </div>
                            <h3 className="font-bold text-white text-2xl mb-2">ยืนยันการออกจากระบบ?</h3>
                            <p className="text-gray-400 text-sm leading-relaxed mb-8">
                                คุณต้องการออกจากระบบและกลับไปหน้า Login ใช่หรือไม่ งานที่คุณทำค้างไว้อาจไม่ถูกบันทึก
                            </p>
                        </div>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => {
                                    setShowLogoutModal(false);
                                    signOut();
                                }}
                                className="w-full px-6 py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl text-base font-bold transition-all shadow-lg shadow-red-500/20 active:scale-95"
                            >
                                ยืนยัน ออกจากระบบ
                            </button>
                            <button
                                onClick={() => setShowLogoutModal(false)}
                                className="w-full px-6 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-base font-medium transition-all border border-white/5 active:scale-95"
                            >
                                ไม่ ยกเลิก
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
