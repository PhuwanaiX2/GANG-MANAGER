'use client';

import { Session } from 'next-auth';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
    BarChart3,
    CalendarDays,
    ClipboardCheck,
    CreditCard,
    Gauge,
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
        { href: `/dashboard/${gangId}/attendance`, label: 'เช็คชื่อ', group: 'attendance', icon: ClipboardCheck, required: 'MEMBER' },
        { href: `/dashboard/${gangId}/leaves`, label: 'การลา', group: 'attendance', icon: CalendarDays, required: 'MEMBER' },
        { href: `/dashboard/${gangId}/finance`, label: 'การเงินแก๊ง', group: 'finance', icon: Wallet, required: 'TREASURER' },
        { href: `/dashboard/${gangId}/billing`, label: 'แพลนระบบ', group: 'billing', icon: CreditCard, required: 'OWNER' },
        { href: `/dashboard/${gangId}/settings`, label: 'ตั้งค่า', group: 'setup', icon: Settings, required: 'OWNER' },
    ] satisfies SidebarNavItem[] : [];
    const navItems: SidebarNavItem[] = allNavItems.filter((item) => canSeeItem(item, permissions));
    const bottomNavItems = gangId
        ? [
            `/dashboard/${gangId}`,
            `/dashboard/${gangId}/my-profile`,
            `/dashboard/${gangId}/attendance`,
            `/dashboard/${gangId}/finance`,
            `/dashboard/${gangId}/members`,
        ]
            .map((href) => navItems.find((item) => item.href === href))
            .filter((item): item is SidebarNavItem => Boolean(item))
            .slice(0, 4) as SidebarNavItem[]
        : [];
    const isBottomNavActive = (href: string) => {
        if (pathname === href) return true;
        const isDashboardRoot = /^\/dashboard\/[^/]+$/.test(href);
        return !isDashboardRoot && Boolean(pathname?.startsWith(`${href}/`));
    };

    return (
        <div className="min-h-screen flex bg-bg-base text-fg-primary selection:bg-accent-subtle selection:text-accent-bright font-sans">
            <aside className="hidden md:flex w-[16.25rem] bg-bg-subtle/95 border-r border-border-subtle flex-col relative z-20 shadow-token-xs backdrop-blur-xl">
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(88,101,242,0.035),transparent_30%),linear-gradient(90deg,rgba(255,255,255,0.025),transparent_46%)]" />
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
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(88,101,242,0.035),transparent_260px),linear-gradient(135deg,transparent_0%,var(--color-bg-muted)_210%)]" />
                <div className="pointer-events-none absolute inset-0 bg-grid-subtle opacity-[0.014]" />

                <header className="md:hidden flex items-center justify-between p-4 border-b border-border-subtle bg-bg-base/88 backdrop-blur-xl sticky top-0 z-30">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-token-lg border border-border-accent bg-accent-subtle text-accent-bright shadow-token-xs">
                            <Terminal className="w-4 h-4" />
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

                <header className="relative z-20 hidden border-b border-border-subtle bg-bg-base/72 px-5 py-3 backdrop-blur-xl md:block">
                    <div className="mx-auto flex max-w-[90rem] items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-token-lg border border-border-accent bg-accent-subtle text-accent-bright">
                                <Gauge className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                                <p className="truncate text-sm font-black text-fg-primary">{gangName || 'แผงควบคุม'}</p>
                                <p className="text-[11px] font-semibold tracking-wide text-fg-tertiary">
                                    จัดการผ่าน Discord และเว็บ
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {permissions?.level ? (
                            <span className="hidden rounded-token-full border border-border-subtle bg-bg-muted px-3 py-1 text-[11px] font-bold text-fg-secondary lg:inline-flex">
                                    {permissions.level}
                                </span>
                            ) : null}
                            <ThemeToggle compact />
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-auto custom-scrollbar relative">
                    <div className="relative z-10 p-3 sm:p-5 lg:p-7 max-w-[86rem] mx-auto min-h-full flex flex-col">
                        <div className="flex-1">
                            <SystemBanner />
                            {children}
                        </div>
                        <div className="mt-8 border-t border-border-subtle pt-6 pb-24 md:pb-3">
                            <Footer />
                        </div>
                    </div>
                </div>
            </main>

            {bottomNavItems.length > 0 && (
                <nav className="fixed inset-x-3 bottom-3 z-40 rounded-token-2xl border border-border bg-bg-subtle/96 p-1.5 shadow-token-sm backdrop-blur-xl md:hidden" aria-label="Primary mobile navigation">
                    <div className="grid grid-cols-4 gap-1">
                        {bottomNavItems.map((item) => {
                            const Icon = item.icon;
                            const active = isBottomNavActive(item.href);

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-token-xl px-2 text-[10px] font-bold transition-colors ${active
                                        ? 'bg-accent-subtle text-accent-bright ring-1 ring-border-accent'
                                        : 'text-fg-tertiary hover:bg-bg-muted hover:text-fg-primary'
                                        }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    <span className="max-w-full truncate">{item.label}</span>
                                </Link>
                            );
                        })}
                    </div>
                </nav>
            )}

            {showLogoutModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-bg-overlay backdrop-blur-sm animate-fade-in">
                    <div className="relative w-full max-w-sm animate-fade-in-up overflow-hidden rounded-token-2xl border border-border bg-bg-elevated p-5 shadow-token-md sm:p-6">
                        <div className="flex flex-col items-center text-center">
                            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-token-lg bg-status-danger-subtle">
                                <LogOut className="h-5 w-5 text-fg-danger" />
                            </div>
                            <h3 className="mb-2 font-heading text-lg font-bold text-fg-primary">ออกจากระบบ?</h3>
                            <p className="mb-6 text-sm leading-relaxed text-fg-secondary">
                                คุณกำลังจะออกจากระบบ และกลับไปหน้าเข้าสู่ระบบ
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowLogoutModal(false)}
                                className="min-h-11 flex-1 rounded-token-md border border-border bg-bg-muted px-4 py-2.5 text-sm font-semibold text-fg-primary transition-colors duration-token-normal ease-token-standard hover:bg-bg-elevated"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={() => {
                                    setShowLogoutModal(false);
                                    signOut();
                                }}
                                className="min-h-11 flex-1 rounded-token-md bg-status-danger px-4 py-2.5 text-sm font-semibold text-fg-inverse transition-colors duration-token-normal ease-token-standard hover:opacity-90"
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
