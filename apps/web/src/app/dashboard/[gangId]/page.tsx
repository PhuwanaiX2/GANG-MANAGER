export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, gangs, members, attendanceSessions, transactions, leaveRequests, normalizeSubscriptionTier } from '@gang/database';
import { eq, and, desc, sql } from 'drizzle-orm';
import Link from 'next/link';
import {
    Users,
    Wallet,
    ArrowUpRight,
    ArrowDownLeft,
    CalendarCheck,
    ArrowRight,
    Clock,
    Settings,
    CheckCircle2,
} from 'lucide-react';
import { AutoRefresh } from '@/components/AutoRefresh';
import { groupRecentFinanceTransactions } from '@/lib/financeTransactions';
import { getSubscriptionTierLabel } from '@/lib/subscriptionTier';

interface Props {
    params: Promise<{ gangId: string }>;
}

function getGangPlanLabel(tier: string | null | undefined) {
    const normalizedTier = normalizeSubscriptionTier(tier);
    if (normalizedTier === 'TRIAL') return 'Trial';
    return getSubscriptionTierLabel(normalizedTier);
}

export default async function GangDashboard(props: Props) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session) redirect('/');

    const { gangId } = params;

    // Parallelize all data fetching
    const [gang, member, memberCount, recentSessions, recentTransactions, pendingLeaves] = await Promise.all([
        // 1. Get gang details
        db.query.gangs.findFirst({
            where: eq(gangs.id, gangId),
            with: { settings: true },
        }),
        // 2. Check membership
        db.query.members.findFirst({
            where: and(
                eq(members.gangId, gangId),
                eq(members.discordId, session.user.discordId),
                eq(members.isActive, true),
                eq(members.status, 'APPROVED')
            ),
        }),
        // 3. Stats: Member count
        db.select({ count: sql<number>`count(*)` })
            .from(members)
            .where(and(eq(members.gangId, gangId), eq(members.isActive, true))),
        // 4. Stats: Recent sessions
        db.query.attendanceSessions.findMany({
            where: eq(attendanceSessions.gangId, gangId),
            orderBy: desc(attendanceSessions.createdAt),
            limit: 5,
        }),
        // 5. Stats: Recent transactions
        db.query.transactions.findMany({
            where: and(
                eq(transactions.gangId, gangId),
                eq(transactions.status, 'APPROVED')
            ),
            orderBy: desc(transactions.approvedAt),
            limit: 30,
            with: { member: true },
        }),
        // 6. Stats: Pending leaves
        db.select({ count: sql<number>`count(*)` })
            .from(leaveRequests)
            .where(and(eq(leaveRequests.gangId, gangId), eq(leaveRequests.status, 'PENDING')))
    ]);

    // Validation checks
    if (!gang || !member) {
        redirect('/dashboard');
    }

    const groupedRecentTransactions = groupRecentFinanceTransactions(recentTransactions as any[], 5);

    // Calculate balance
    // const lastTransaction = recentTransactions[0];
    const balance = gang.balance;
    const normalizedTier = normalizeSubscriptionTier(gang.subscriptionTier);
    const trialExpiry = gang.subscriptionExpiresAt ? new Date(gang.subscriptionExpiresAt) : null;
    const trialDaysLeft = trialExpiry ? Math.ceil((trialExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
    const isActiveTrial = normalizedTier === 'TRIAL' && trialExpiry && trialDaysLeft !== null && trialDaysLeft > 0;
    const canManageSetup = ['OWNER', 'ADMIN'].includes(member.gangRole || '');
    const canManageAttendance = ['OWNER', 'ADMIN', 'ATTENDANCE_OFFICER'].includes(member.gangRole || '');
    const canManageFinance = ['OWNER', 'TREASURER'].includes(member.gangRole || '');
    const hasCoreChannels = Boolean(gang.settings?.registerChannelId && gang.settings?.attendanceChannelId && gang.settings?.logChannelId);
    const hasMoreThanOwner = (memberCount[0]?.count || 0) > 1;
    const hasAttendanceHistory = recentSessions.length > 0;
    const hasFinanceHistory = recentTransactions.length > 0;
    const onboardingItems = [
        {
            title: 'ตั้งค่า Roles และ Channels',
            description: 'ผูกยศและห้องหลักให้ระบบทำงานครบ เช่น ลงทะเบียน เช็คชื่อ และบันทึก Log',
            href: `/dashboard/${gangId}/settings?tab=roles-channels`,
            completed: hasCoreChannels,
        },
        {
            title: 'ชวนสมาชิกเข้าระบบ',
            description: 'ให้สมาชิกสมัคร/เข้าร่วม เพื่อเริ่มใช้งานระบบจริงในแก๊ง',
            href: `/dashboard/${gangId}/members`,
            completed: hasMoreThanOwner,
        },
        {
            title: 'เปิดรอบเช็คชื่อครั้งแรก',
            description: 'ทดสอบ flow เช็คชื่อและดูว่าห้อง/ยศทำงานตรงตามที่ตั้งค่าไว้',
            href: `/dashboard/${gangId}/attendance`,
            completed: hasAttendanceHistory,
        },
        {
            title: 'เริ่มใช้งานการเงิน',
            description: 'สร้างรายการแรกเพื่อให้ overview และรายงานเริ่มมีข้อมูลใช้งานจริง',
            href: `/dashboard/${gangId}/finance`,
            completed: hasFinanceHistory,
        },
    ];
    const completedOnboardingCount = onboardingItems.filter((item) => item.completed).length;
    const shouldShowOnboarding = canManageSetup && completedOnboardingCount < onboardingItems.length;

    return (
        <>
            <AutoRefresh interval={30} />
            {/* Page Header */}
            <div className="mb-8 relative z-10 overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle p-5 shadow-token-md animate-fade-in sm:p-6">
                <div className="absolute -right-20 -top-24 h-56 w-56 rounded-token-full bg-accent-subtle blur-3xl" />
                <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-accent to-transparent opacity-50" />
                <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                        {gang.logoUrl ? (
                            <img src={gang.logoUrl} alt={gang.name} className="h-16 w-16 shrink-0 rounded-token-2xl border border-border-subtle object-cover shadow-token-md" />
                        ) : (
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-token-2xl border border-border-subtle bg-bg-elevated shadow-token-sm">
                                <Users className="h-7 w-7 text-fg-tertiary" />
                            </div>
                        )}
                        <div className="min-w-0">
                            <div className="mb-2 inline-flex items-center gap-2 rounded-token-full border border-border-accent bg-accent-subtle px-3 py-1 text-[10px] font-black uppercase tracking-widest text-accent-bright">
                                <span className="h-1.5 w-1.5 rounded-token-full bg-accent-bright" />
                                Command Overview
                            </div>
                            <h1 className="truncate text-3xl font-black tracking-tight text-fg-primary font-heading sm:text-4xl">{gang.name}</h1>
                            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-secondary">
                                ศูนย์ควบคุมสถานะแก๊ง: ตรวจสมาชิก กองกลาง เช็คชื่อ และงานที่ต้องจัดการต่อจากจุดเดียว
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                        <Link href={`/dashboard/${gangId}/settings?tab=subscription`} className="inline-flex items-center justify-center gap-2 rounded-token-xl border border-border-accent bg-accent-subtle px-4 py-2 text-xs font-bold text-accent-bright shadow-token-sm transition-[filter,border-color] hover:brightness-110">
                            <span className="h-1.5 w-1.5 rounded-token-full bg-status-success" />
                            {getGangPlanLabel(gang.subscriptionTier)}
                        </Link>
                        <div className="inline-flex items-center justify-center gap-2 rounded-token-xl border border-border-subtle bg-bg-muted px-4 py-2 text-xs font-bold text-fg-secondary shadow-token-sm">
                            <Settings className="h-3.5 w-3.5" />
                            {member.gangRole || 'MEMBER'}
                        </div>
                    </div>
                </div>
            </div>

            {isActiveTrial && (
                <div className={`mb-6 rounded-token-2xl border p-5 relative z-10 animate-fade-in-up ${trialDaysLeft <= 3 ? 'bg-status-warning-subtle border-status-warning' : 'bg-accent-subtle border-border-accent'}`}>
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className={`text-sm font-bold ${trialDaysLeft <= 3 ? 'text-fg-warning' : 'text-accent-bright'}`}>
                                คุณกำลังใช้งาน Trial แบบเต็มฟีเจอร์
                            </p>
                            <p className="mt-1 text-sm text-fg-secondary">
                                เหลืออีก {trialDaysLeft} วัน ก่อนระบบกลับเป็น Free และจำกัดสมาชิกเหลือ 15 คน
                            </p>
                            <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-fg-tertiary">
                                <Clock className="w-3.5 h-3.5" />
                                หมดอายุ {trialExpiry.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'long', year: 'numeric' })}
                            </div>
                        </div>
                        <Link
                            href={`/dashboard/${gangId}/settings?tab=subscription`}
                            className={`inline-flex items-center justify-center gap-2 rounded-token-md px-4 py-2.5 text-sm font-bold text-fg-inverse transition-[filter,background-color] duration-token-normal ease-token-standard ${trialDaysLeft <= 3 ? 'bg-status-warning hover:brightness-110' : 'bg-accent hover:bg-accent-hover'}`}
                        >
                            อัปเกรดเป็น Premium
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            )}

            {shouldShowOnboarding && (
                <div className="mb-6 rounded-token-2xl border border-status-info bg-status-info-subtle p-5 relative z-10 animate-fade-in-up">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-token-full border border-status-info bg-status-info-subtle px-3 py-1 text-[11px] font-bold text-fg-info">
                                <Settings className="w-3.5 h-3.5" />
                                Onboarding Checklist
                            </div>
                            <h2 className="mt-3 text-lg font-bold text-fg-primary">เริ่มใช้งานแก๊งนี้ให้ครบในไม่กี่ขั้นตอน</h2>
                            <p className="mt-1 text-sm text-fg-secondary">
                                ทำเสร็จแล้ว {completedOnboardingCount}/{onboardingItems.length} ขั้นตอน เพื่อให้ระบบพร้อมใช้งานจริงทั้งฝั่ง Discord และหน้าเว็บ
                            </p>
                        </div>
                        <Link
                            href={`/dashboard/${gangId}/settings`}
                            className="inline-flex items-center justify-center gap-2 rounded-token-md border border-border bg-bg-muted px-4 py-2.5 text-sm font-semibold text-fg-primary hover:bg-bg-elevated transition-colors duration-token-normal ease-token-standard"
                        >
                            ไปหน้าตั้งค่า
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>

                    <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                        {onboardingItems.map((item) => (
                            <Link
                                key={item.title}
                                href={item.href}
                                className={`rounded-token-lg border p-4 transition-colors duration-token-normal ease-token-standard ${item.completed ? 'border-status-success bg-status-success-subtle' : 'border-border bg-bg-subtle hover:bg-bg-muted'}`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`mt-0.5 shrink-0 ${item.completed ? 'text-fg-success' : 'text-fg-tertiary'}`}>
                                        <CheckCircle2 className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-semibold text-fg-primary">{item.title}</p>
                                            <span className={`text-[10px] font-bold uppercase tracking-wide ${item.completed ? 'text-fg-success' : 'text-fg-warning'}`}>
                                                {item.completed ? 'Completed' : 'Pending'}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-xs text-fg-tertiary">{item.description}</p>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 relative z-10 animate-fade-in-up">
                <StatsCard title="สมาชิก" value={memberCount[0]?.count || 0} label="คน" icon={<Users className="w-4 h-4" />} color="emerald" />
                <StatsCard title="กองกลาง" value={`฿${balance.toLocaleString()}`} label="" icon={<Wallet className="w-4 h-4" />} color="amber" />
                <StatsCard title="เช็คชื่อ" value={recentSessions.length} label="รอบ" icon={<CalendarCheck className="w-4 h-4" />} color="cyan" />
            </div>

            {/* Content Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 relative z-10 animate-fade-in-up delay-200">
                {/* Recent Attendance */}
                <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden shadow-token-sm">
                    <div className="px-5 py-3.5 border-b border-border-subtle flex items-center justify-between">
                        <h3 className="text-sm font-bold text-fg-primary font-heading">เช็คชื่อล่าสุด</h3>
                        <Link href={`/dashboard/${gangId}/attendance?tab=closed`} className="text-[11px] text-accent-bright hover:brightness-125 transition-[filter] font-semibold">ดูทั้งหมด →</Link>
                    </div>
                    {recentSessions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
                            <div className="text-sm text-fg-tertiary">ยังไม่มีรอบเช็คชื่อ</div>
                            <p className="max-w-sm text-xs text-fg-tertiary">เริ่มเปิดรอบแรกเพื่อให้สมาชิกลองเช็คชื่อและยืนยันว่าการตั้งค่าห้อง/ยศทำงานถูกต้อง</p>
                            {canManageAttendance && (
                                <Link href={`/dashboard/${gangId}/attendance`} className="inline-flex items-center gap-2 rounded-token-md border border-border bg-bg-muted px-4 py-2 text-xs font-semibold text-fg-primary hover:bg-bg-elevated transition-colors duration-token-normal ease-token-standard">
                                    ไปที่หน้าเช็คชื่อ
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </Link>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="grid gap-3 p-4 md:hidden">
                                {recentSessions.map((s) => (
                                    <Link
                                        key={s.id}
                                        href={`/dashboard/${gangId}/attendance/${s.id}`}
                                        className="rounded-token-xl border border-border-subtle bg-bg-muted/70 p-4 shadow-token-sm transition-colors duration-token-normal ease-token-standard hover:bg-bg-elevated"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-bold text-fg-primary">{s.sessionName}</p>
                                                <p className="mt-1 text-xs text-fg-tertiary">
                                                    {new Date(s.createdAt).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short' })}
                                                </p>
                                            </div>
                                            <span className={`shrink-0 rounded-token-sm px-2 py-1 text-[10px] font-bold ${s.status === 'ACTIVE' ? 'text-fg-success bg-status-success-subtle' : s.status === 'CLOSED' ? 'text-fg-tertiary bg-bg-muted' : 'text-fg-info bg-status-info-subtle'}`}>
                                                {s.status === 'ACTIVE' ? 'เปิดอยู่' : s.status === 'CLOSED' ? 'ปิดแล้ว' : s.status}
                                            </span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                            <div className="hidden overflow-x-auto md:block">
                            <table className="min-w-[520px] w-full text-left">
                                <thead className="bg-bg-muted border-b border-border-subtle">
                                    <tr>
                                        <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">รอบเช็คชื่อ</th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-center">สถานะ</th>
                                        <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-right">วันที่</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-subtle">
                                    {recentSessions.map((s) => (
                                        <tr key={s.id} className="hover:bg-bg-muted transition-colors duration-token-normal ease-token-standard">
                                            <td className="px-5 py-3">
                                                <Link href={`/dashboard/${gangId}/attendance/${s.id}`} className="flex items-center gap-3 min-w-0">
                                                    <div className={`shrink-0 w-2 h-2 rounded-token-full ${s.status === 'ACTIVE' ? 'bg-status-success shadow-[0_0_6px_var(--color-success)]' : s.status === 'CLOSED' ? 'bg-fg-tertiary' : 'bg-status-info shadow-[0_0_6px_var(--color-info)]'}`} />
                                                    <span className="text-[13px] text-fg-primary truncate font-semibold hover:text-accent-bright transition-colors">{s.sessionName}</span>
                                                </Link>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex rounded-token-sm px-2 py-0.5 text-[10px] font-bold ${s.status === 'ACTIVE' ? 'text-fg-success bg-status-success-subtle' : s.status === 'CLOSED' ? 'text-fg-tertiary bg-bg-muted' : 'text-fg-info bg-status-info-subtle'}`}>
                                                    {s.status === 'ACTIVE' ? 'เปิดอยู่' : s.status === 'CLOSED' ? 'ปิดแล้ว' : s.status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-right text-xs text-fg-tertiary whitespace-nowrap">
                                                {new Date(s.createdAt).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short' })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            </div>
                        </>
                    )}
                </div>

                {/* Recent Finance */}
                <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden shadow-token-sm">
                    <div className="px-5 py-3.5 border-b border-border-subtle flex items-center justify-between">
                        <h3 className="text-sm font-bold text-fg-primary font-heading">ธุรกรรมล่าสุด</h3>
                        <Link href={`/dashboard/${gangId}/finance?tab=history`} className="text-[11px] text-accent-bright hover:brightness-125 transition-[filter] font-semibold">ดูทั้งหมด →</Link>
                    </div>
                    {recentTransactions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
                            <div className="text-sm text-fg-tertiary">ยังไม่มีธุรกรรม</div>
                            <p className="max-w-sm text-xs text-fg-tertiary">เมื่อเริ่มบันทึกรายรับ รายจ่าย หรือการยืม/ชำระหนี้ หน้า overview และรายงานจะเริ่มมีข้อมูลทันที</p>
                            {canManageFinance && (
                                <Link href={`/dashboard/${gangId}/finance`} className="inline-flex items-center gap-2 rounded-token-md border border-border bg-bg-muted px-4 py-2 text-xs font-semibold text-fg-primary hover:bg-bg-elevated transition-colors duration-token-normal ease-token-standard">
                                    ไปที่หน้าการเงิน
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </Link>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="grid gap-3 p-4 md:hidden">
                                {groupedRecentTransactions.map((t: any) => {
                                    const isIncome = t.type === 'INCOME' || t.type === 'REPAYMENT' || t.type === 'DEPOSIT' || (t.type === 'PENALTY' && t.amount < 0);
                                    const isDueOnly = t.type === 'GANG_FEE';
                                    const effectiveAt = new Date(t.approvedAt || t.createdAt);
                                    const title = t.type === 'GANG_FEE' && t.__batchCount
                                        ? `ตั้งยอดเก็บเงินแก๊ง: ${t.__batchCount} คน`
                                        : ['LOAN', 'REPAYMENT', 'DEPOSIT', 'GANG_FEE', 'PENALTY'].includes(t.type)
                                            ? `${(t as any).member?.name || '-'} ${t.type === 'LOAN' ? 'ยืมจากกองกลาง' : t.type === 'REPAYMENT' ? 'ชำระหนี้' : t.type === 'DEPOSIT' ? 'นำเงินเข้า' : t.type === 'GANG_FEE' ? 'ตั้งยอดเก็บเงิน' : t.amount < 0 ? 'คืนค่าปรับ' : 'ค่าปรับ'}`
                                            : t.description;

                                    return (
                                        <div key={t.id} className="rounded-token-xl border border-border-subtle bg-bg-muted/70 p-4 shadow-token-sm">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="line-clamp-2 text-sm font-bold text-fg-primary">{title}</p>
                                                    <p className="mt-1 text-xs text-fg-tertiary">
                                                        {effectiveAt.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short' })}
                                                    </p>
                                                </div>
                                                <span className={`shrink-0 text-sm font-black tabular-nums ${isDueOnly ? 'text-accent-bright' : isIncome ? 'text-fg-success' : 'text-fg-danger'}`}>
                                                    {isDueOnly ? `฿${Math.abs(t.amount).toLocaleString()}` : `${isIncome ? '+' : '-'}฿${Math.abs(t.amount).toLocaleString()}`}
                                                </span>
                                            </div>
                                            {isDueOnly && (
                                                <p className="mt-2 text-[11px] text-accent-bright/80">ยังไม่เข้ากองกลางจนกว่าจะมีการชำระจริง</p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="hidden overflow-x-auto md:block">
                            <table className="min-w-[620px] w-full text-left">
                                <thead className="bg-bg-muted border-b border-border-subtle">
                                    <tr>
                                        <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">รายการ</th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary whitespace-nowrap">วันที่</th>
                                        <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-right">จำนวน</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-subtle">
                                    {groupedRecentTransactions.map((t: any) => {
                                        const isIncome = t.type === 'INCOME' || t.type === 'REPAYMENT' || t.type === 'DEPOSIT' || (t.type === 'PENALTY' && t.amount < 0);
                                        const isDueOnly = t.type === 'GANG_FEE';
                                        const effectiveAt = new Date(t.approvedAt || t.createdAt);
                                        return (
                                            <tr key={t.id} className="hover:bg-bg-muted transition-colors duration-token-normal ease-token-standard">
                                                <td className="px-5 py-3">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className={`shrink-0 w-8 h-8 rounded-token-md flex items-center justify-center ${isDueOnly ? 'bg-accent-subtle text-accent-bright' : isIncome ? 'bg-status-success-subtle text-fg-success' : 'bg-status-danger-subtle text-fg-danger'}`}>
                                                            {isDueOnly ? <Wallet className="w-4 h-4" /> : isIncome ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="text-[13px] text-fg-primary truncate font-semibold">
                                                                {t.type === 'GANG_FEE' && t.__batchCount
                                                                    ? `ตั้งยอดเก็บเงินแก๊ง: ${t.__batchCount} คน`
                                                                    : ['LOAN', 'REPAYMENT', 'DEPOSIT', 'GANG_FEE', 'PENALTY'].includes(t.type)
                                                                        ? `${(t as any).member?.name || '-'} ${t.type === 'LOAN' ? 'ยืมจากกองกลาง' : t.type === 'REPAYMENT' ? 'ชำระหนี้' : t.type === 'DEPOSIT' ? 'นำเงินเข้า' : t.type === 'GANG_FEE' ? 'ตั้งยอดเก็บเงิน' : t.amount < 0 ? 'คืนค่าปรับ' : 'ค่าปรับ'}`
                                                                        : t.description
                                                                }
                                                            </div>
                                                            {isDueOnly && (
                                                                <div className="text-[11px] text-accent-bright opacity-80 mt-0.5 truncate">ยังไม่เข้ากองกลางจนกว่าจะมีการชำระจริง</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-fg-tertiary whitespace-nowrap">
                                                    {effectiveAt.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short' })}
                                                </td>
                                                <td className="px-5 py-3 text-right whitespace-nowrap">
                                                    <span className={`text-sm font-bold tabular-nums ${isDueOnly ? 'text-accent-bright' : isIncome ? 'text-fg-success' : 'text-fg-danger'}`}>
                                                        {isDueOnly ? `฿${Math.abs(t.amount).toLocaleString()}` : `${isIncome ? '+' : '-'}฿${Math.abs(t.amount).toLocaleString()}`}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
}

function StatsCard({ title, value, label, icon, color }: any) {
    const colorMap: Record<string, { bg: string; text: string; border: string }> = {
        emerald: { bg: 'bg-status-success-subtle', text: 'text-fg-success', border: 'border-l-status-success' },
        amber: { bg: 'bg-status-warning-subtle', text: 'text-fg-warning', border: 'border-l-status-warning' },
        cyan: { bg: 'bg-status-info-subtle', text: 'text-fg-info', border: 'border-l-status-info' },
    };
    const c = colorMap[color] || colorMap.emerald;

    return (
        <div className={`group relative overflow-hidden p-5 rounded-token-2xl bg-bg-subtle border border-border-subtle border-l-2 ${c.border} shadow-token-sm hover:border-border hover:shadow-token-md transition-[transform,border-color,box-shadow] duration-token-normal ease-token-standard hover:-translate-y-0.5`}>
            <div className="absolute -right-10 -top-10 h-24 w-24 rounded-token-full bg-bg-muted blur-2xl opacity-70" />
            <div className="relative z-10 flex items-center gap-2.5 mb-3">
                <div className={`w-9 h-9 rounded-token-lg ${c.bg} ${c.text} flex items-center justify-center shadow-token-sm`}>
                    {icon}
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-fg-tertiary">{title}</span>
            </div>
            <div className="relative z-10 text-3xl font-black text-fg-primary tabular-nums font-heading">{value} <span className="text-sm font-semibold text-fg-tertiary">{label}</span></div>
        </div>
    );
}
