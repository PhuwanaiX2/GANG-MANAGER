'use client';

import { Session } from 'next-auth';
import { signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
    BarChart3,
    CalendarDays,
    ClipboardCheck,
    CreditCard,
    LayoutDashboard,
    LogOut,
    Megaphone,
    Menu,
    Settings,
    Terminal,
    UserCircle,
    Users,
    Wallet,
    X,
} from 'lucide-react';
import { Sidebar, type SidebarNavItem } from './Sidebar';
import { Footer } from './Footer';
import { SystemBanner } from './SystemBanner';
import { ThemeToggle } from './ThemeToggle';

interface DashboardLayoutProps {
    children: React.ReactNode;
    session: Session;
    gangId?: string;
    gangName?: string;
    gangLogoUrl?: string | null;
    pendingLeaveCount?: number;
    isSystemAdmin?: boolean;
    permissions?: {
        level: 'OWNER' | 'ADMIN' | 'TREASURER' | 'ATTENDANCE_OFFICER' | 'MEMBER' | 'NONE';
        isOwner: boolean;
        isAdmin: boolean;
        isTreasurer: boolean;
        isAttendanceOfficer: boolean;
        isMember: boolean;
    };
}

function canSeeItem(item: SidebarNavItem, permissions?: DashboardLayoutProps['permissions']) {
    if (!permissions) return true;
    if (permissions.isOwner) return true;
    if (item.required === 'OWNER') return false;
    if (item.required === 'TREASURER') return permissions.isTreasurer;
    if (item.required === 'ATTENDANCE') return permissions.isAdmin || permissions.isAttendanceOfficer;
    if (item.required === 'ADMIN') return permissions.isAdmin;
    return true;
}

export function DashboardLayout({
    children,
    session,
    gangId,
    gangName,
    gangLogoUrl,
    permissions,
    pendingLeaveCount,
    isSystemAdmin,
}: DashboardLayoutProps) {
    const pathname = usePathname();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);

    const allNavItems = gangId ? [
        { href: `/dashboard/${gangId}`, label: 'ภาพรวม', group: 'command', icon: LayoutDashboard, required: 'MEMBER' },
        { href: `/dashboard/${gangId}/announcements`, label: 'ประกาศ', group: 'command', icon: Megaphone, required: 'ADMIN' },
        { href: `/dashboard/${gangId}/analytics`, label: 'สถิติ', group: 'command', icon: BarChart3, required: 'ADMIN' },
        { href: `/dashboard/${gangId}/my-profile`, label: 'โปรไฟล์ของฉัน', group: 'people', icon: UserCircle, required: 'MEMBER' },
        { href: `/dashboard/${gangId}/members`, label: 'สมาชิก', group: 'people', icon: Users, required: 'MEMBER' },
        { href: `/dashboard/${gangId}/attendance`, label: 'เช็คชื่อ', group: 'operations', icon: ClipboardCheck, required: 'MEMBER' },
        { href: `/dashboard/${gangId}/leaves`, label: 'การลา', group: 'operations', icon: CalendarDays, required: 'MEMBER' },
        { href: `/dashboard/${gangId}/finance`, label: 'การเงิน', group: 'business', icon: Wallet, required: 'TREASURER' },
        { href: `/dashboard/${gangId}/billing`, label: 'แพลน', group: 'business', icon: CreditCard, required: 'OWNER' },
        { href: `/dashboard/${gangId}/settings`, label: 'ตั้งค่า', group: 'setup', icon: Settings, required: 'OWNER' },
    ] satisfies SidebarNavItem[] : [];
    const navItems: SidebarNavItem[] = allNavItems.filter((item) => canSeeItem(item, permissions));

    return (
        <div className="min-h-screen flex bg-bg-base text-fg-primary selection:bg-accent-subtle selection:text-accent-bright font-sans">
            <aside className="hidden md:flex w-64 bg-bg-subtle/94 border-r border-border-subtle flex-col relative z-20 shadow-token-sm backdrop-blur-xl">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,var(--color-accent-subtle),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.035),transparent_38%)]" />
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
                    onSignOut={() => setShowLogoutModal(true)}
                />
            </aside>

            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-bg-overlay backdrop-blur-sm z-40 md:hidden animate-fade-in"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            <div className={`fixed inset-y-0 left-0 w-72 max-w-[88vw] bg-bg-subtle border-r border-border flex flex-col shadow-token-lg z-50 transform transition-transform duration-token-normal ease-token-emphasized md:hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
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
                    onSignOut={() => setShowLogoutModal(true)}
                />
                <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="absolute top-5 right-4 p-2 text-fg-secondary hover:text-fg-primary bg-bg-muted hover:bg-bg-elevated rounded-token-md transition-colors duration-token-normal ease-token-standard border border-border-subtle"
                    aria-label="ปิดเมนู"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            <main className="flex-1 flex flex-col min-w-0 relative bg-bg-base text-fg-primary h-screen overflow-hidden">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,var(--color-accent-subtle),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.08),transparent_30%),linear-gradient(135deg,transparent_0%,var(--color-bg-muted)_120%)] opacity-80" />
                <div className="pointer-events-none absolute inset-0 bg-grid-subtle opacity-[0.16]" />

                <header className="md:hidden flex items-center justify-between p-4 border-b border-border-subtle bg-bg-base/88 backdrop-blur-xl sticky top-0 z-30">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-token-md bg-accent-subtle border border-border-accent flex items-center justify-center">
                            <Terminal className="w-4 h-4 text-accent-bright" />
                        </div>
                        <span className="font-bold text-[15px] tracking-tight text-fg-primary font-heading">{gangName || 'Dashboard'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <ThemeToggle compact />
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="p-2 text-fg-secondary hover:text-fg-primary rounded-token-md bg-bg-muted hover:bg-bg-elevated transition-colors duration-token-normal ease-token-standard border border-border-subtle"
                            aria-label="เปิดเมนู"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-auto custom-scrollbar relative">
                    <div className="relative z-10 p-3 sm:p-5 lg:p-7 max-w-[86rem] mx-auto min-h-full flex flex-col">
                        <div className="flex-1">
                            <SystemBanner />
                            {children}
                        </div>
                        <div className="mt-8 border-t border-border-subtle pt-6 pb-3">
                            <Footer />
                        </div>
                    </div>
                </div>
            </main>

            {showLogoutModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-bg-overlay backdrop-blur-sm animate-fade-in">
                    <div className="relative overflow-hidden bg-bg-elevated border border-border rounded-token-2xl p-6 sm:p-8 w-full max-w-sm shadow-token-lg animate-fade-in-up">
                        <div className="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-token-full bg-status-danger-subtle blur-3xl" />
                        <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 rounded-token-full bg-status-danger-subtle flex items-center justify-center mb-5">
                                <LogOut className="w-6 h-6 text-fg-danger" />
                            </div>
                            <h3 className="font-bold text-fg-primary text-xl mb-2 font-heading">ออกจากระบบ?</h3>
                            <p className="text-fg-secondary text-sm leading-relaxed mb-8">
                                คุณกำลังจะออกจากระบบ และกลับไปหน้าเข้าสู่ระบบ
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowLogoutModal(false)}
                                className="flex-1 px-4 py-2.5 bg-bg-muted hover:bg-bg-elevated text-fg-primary rounded-token-md text-sm font-semibold transition-colors duration-token-normal ease-token-standard border border-border"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={() => {
                                    setShowLogoutModal(false);
                                    signOut();
                                }}
                                className="flex-1 px-4 py-2.5 bg-status-danger hover:brightness-110 text-fg-inverse rounded-token-md text-sm font-semibold transition-[filter,background-color] duration-token-normal ease-token-standard shadow-token-glow-danger"
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
