export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, gangs, members, attendanceSessions, transactions, leaveRequests, normalizeSubscriptionTier } from '@gang/database';
import { eq, and, desc, sql } from 'drizzle-orm';
import Link from 'next/link';
import {
    AlertCircle,
    ArrowDownLeft,
    ArrowRight,
    ArrowUpRight,
    BarChart3,
    CalendarCheck,
    CheckCircle2,
    Clock,
    CreditCard,
    Megaphone,
    Settings,
    ShieldCheck,
    Users,
    Wallet,
} from 'lucide-react';
import { AutoRefresh } from '@/components/AutoRefresh';
import { groupRecentFinanceTransactions } from '@/lib/financeTransactions';
import { getSubscriptionTierLabel } from '@/lib/subscriptionTier';

interface Props {
    params: Promise<{ gangId: string }>;
}

type ActionTone = 'primary' | 'warning' | 'success' | 'muted';

function getGangPlanLabel(tier: string | null | undefined) {
    const normalizedTier = normalizeSubscriptionTier(tier);
    if (normalizedTier === 'TRIAL') return 'Trial';
    return getSubscriptionTierLabel(normalizedTier);
}

function formatDate(value: string | Date | null | undefined) {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('th-TH', {
        timeZone: 'Asia/Bangkok',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

function getFinanceTitle(transaction: any) {
    if (transaction.type === 'GANG_FEE' && transaction.__batchCount) {
        return `ตั้งยอดเก็บเงินแก๊ง: ${transaction.__batchCount} คน`;
    }

    if (['LOAN', 'REPAYMENT', 'DEPOSIT', 'GANG_FEE', 'PENALTY'].includes(transaction.type)) {
        const memberName = transaction.member?.name || '-';
        const action = transaction.type === 'LOAN'
            ? 'ยืมจากกองกลาง'
            : transaction.type === 'REPAYMENT'
                ? 'ชำระหนี้'
                : transaction.type === 'DEPOSIT'
                    ? 'นำเงินเข้า'
                    : transaction.type === 'GANG_FEE'
                        ? 'ตั้งยอดเก็บเงิน'
                        : transaction.amount < 0
                            ? 'คืนค่าปรับ'
                            : 'ค่าปรับ';
        return `${memberName} ${action}`;
    }

    return transaction.description || 'ธุรกรรม';
}

function getPrimaryAction({
    gangId,
    hasCoreChannels,
    hasMoreThanOwner,
    hasAttendanceHistory,
    hasFinanceHistory,
    canManageSetup,
    canManageAttendance,
    canManageFinance,
}: {
    gangId: string;
    hasCoreChannels: boolean;
    hasMoreThanOwner: boolean;
    hasAttendanceHistory: boolean;
    hasFinanceHistory: boolean;
    canManageSetup: boolean;
    canManageAttendance: boolean;
    canManageFinance: boolean;
}) {
    if (canManageSetup && !hasCoreChannels) {
        return {
            title: 'ตั้งค่า Roles และ Channels ให้ครบ',
            description: 'เริ่มจากผูกยศและห้องหลัก เพื่อให้บอทกับเว็บทำงานตรงกัน',
            href: `/dashboard/${gangId}/settings?tab=roles-channels`,
            label: 'ไปตั้งค่า',
            tone: 'warning' as ActionTone,
            icon: Settings,
        };
    }

    if (canManageSetup && !hasMoreThanOwner) {
        return {
            title: 'ชวนสมาชิกเข้าระบบ',
            description: 'ตอนนี้แก๊งมีแค่เจ้าของ เพิ่มสมาชิกก่อนเริ่มใช้งานจริง',
            href: `/dashboard/${gangId}/members`,
            label: 'ดูสมาชิก',
            tone: 'primary' as ActionTone,
            icon: Users,
        };
    }

    if (canManageAttendance && !hasAttendanceHistory) {
        return {
            title: 'เปิดรอบเช็คชื่อแรก',
            description: 'ทดสอบ flow เช็คชื่อและยืนยันว่าห้อง Discord ทำงานถูกต้อง',
            href: `/dashboard/${gangId}/attendance`,
            label: 'ไปเช็คชื่อ',
            tone: 'primary' as ActionTone,
            icon: CalendarCheck,
        };
    }

    if (canManageFinance && !hasFinanceHistory) {
        return {
            title: 'เริ่มบันทึกการเงินแก๊ง',
            description: 'บันทึกรายการแรกเพื่อให้ยอดกองกลางและประวัติเริ่มใช้งานได้จริง',
            href: `/dashboard/${gangId}/finance`,
            label: 'ไปการเงินแก๊ง',
            tone: 'primary' as ActionTone,
            icon: Wallet,
        };
    }

    return {
        title: 'ดูภาพรวมความเสี่ยงวันนี้',
        description: 'ทุกอย่างพร้อมใช้งานขั้นต้นแล้ว ไปดูแนวโน้มเช็คชื่อ การเงิน และสมาชิก',
        href: `/dashboard/${gangId}/analytics`,
        label: 'ไปสถิติ',
        tone: 'success' as ActionTone,
        icon: BarChart3,
    };
}

export default async function GangDashboard(props: Props) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session) redirect('/');

    const { gangId } = params;

    const [gang, member, memberCount, recentSessions, recentTransactions, pendingLeaves] = await Promise.all([
        db.query.gangs.findFirst({
            where: eq(gangs.id, gangId),
            with: { settings: true },
        }),
        db.query.members.findFirst({
            where: and(
                eq(members.gangId, gangId),
                eq(members.discordId, session.user.discordId),
                eq(members.isActive, true),
                eq(members.status, 'APPROVED')
            ),
        }),
        db.select({ count: sql<number>`count(*)` })
            .from(members)
            .where(and(eq(members.gangId, gangId), eq(members.isActive, true))),
        db.query.attendanceSessions.findMany({
            where: eq(attendanceSessions.gangId, gangId),
            orderBy: desc(attendanceSessions.createdAt),
            limit: 5,
        }),
        db.query.transactions.findMany({
            where: and(
                eq(transactions.gangId, gangId),
                eq(transactions.status, 'APPROVED')
            ),
            orderBy: desc(transactions.approvedAt),
            limit: 30,
            with: { member: true },
        }),
        db.select({ count: sql<number>`count(*)` })
            .from(leaveRequests)
            .where(and(eq(leaveRequests.gangId, gangId), eq(leaveRequests.status, 'PENDING')))
    ]);

    if (!gang || !member) {
        redirect('/dashboard');
    }

    const activeMemberCount = memberCount[0]?.count || 0;
    const groupedRecentTransactions = groupRecentFinanceTransactions(recentTransactions as any[], 5);
    const balance = gang.balance;
    const normalizedTier = normalizeSubscriptionTier(gang.subscriptionTier);
    const planLabel = getGangPlanLabel(gang.subscriptionTier);
    const trialExpiry = gang.subscriptionExpiresAt ? new Date(gang.subscriptionExpiresAt) : null;
    const trialDaysLeft = trialExpiry ? Math.ceil((trialExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
    const isActiveTrial = normalizedTier === 'TRIAL' && trialDaysLeft !== null && trialDaysLeft > 0;
    const canManageSetup = ['OWNER', 'ADMIN'].includes(member.gangRole || '');
    const canManageAttendance = ['OWNER', 'ADMIN', 'ATTENDANCE_OFFICER'].includes(member.gangRole || '');
    const canManageFinance = ['OWNER', 'TREASURER'].includes(member.gangRole || '');
    const hasCoreChannels = Boolean(gang.settings?.registerChannelId && gang.settings?.attendanceChannelId && gang.settings?.logChannelId);
    const hasMoreThanOwner = activeMemberCount > 1;
    const hasAttendanceHistory = recentSessions.length > 0;
    const hasFinanceHistory = recentTransactions.length > 0;
    const pendingLeaveTotal = pendingLeaves[0]?.count || 0;

    const onboardingItems = [
        {
            title: 'ตั้งค่า Discord ให้ครบ',
            description: 'ผูกยศและห้องหลักสำหรับลงทะเบียน เช็คชื่อ และ Log',
            href: `/dashboard/${gangId}/settings?tab=roles-channels`,
            completed: hasCoreChannels,
        },
        {
            title: 'มีสมาชิกมากกว่าเจ้าของ',
            description: 'ชวนสมาชิกเข้าเว็บหรือให้สมัครผ่าน Discord',
            href: `/dashboard/${gangId}/members`,
            completed: hasMoreThanOwner,
        },
        {
            title: 'มีรอบเช็คชื่อแล้ว',
            description: 'เปิดรอบแรกเพื่อทดสอบ flow ปฏิบัติงาน',
            href: `/dashboard/${gangId}/attendance`,
            completed: hasAttendanceHistory,
        },
        {
            title: 'มีประวัติการเงินแก๊ง',
            description: 'บันทึกรายการเงินจริงเพื่อให้รายงานเริ่มมีข้อมูล',
            href: `/dashboard/${gangId}/finance`,
            completed: hasFinanceHistory,
        },
    ];
    const completedOnboardingCount = onboardingItems.filter((item) => item.completed).length;
    const primaryAction = getPrimaryAction({
        gangId,
        hasCoreChannels,
        hasMoreThanOwner,
        hasAttendanceHistory,
        hasFinanceHistory,
        canManageSetup,
        canManageAttendance,
        canManageFinance,
    });
    const PrimaryIcon = primaryAction.icon;

    const attentionItems = [
        !hasCoreChannels && canManageSetup ? {
            label: 'Discord setup ยังไม่ครบ',
            href: `/dashboard/${gangId}/settings?tab=roles-channels`,
            tone: 'warning' as ActionTone,
            icon: Settings,
        } : null,
        pendingLeaveTotal > 0 ? {
            label: `มีคำขอการลา/เข้าช้ารออนุมัติ ${pendingLeaveTotal} รายการ`,
            href: `/dashboard/${gangId}/leaves`,
            tone: 'primary' as ActionTone,
            icon: Clock,
        } : null,
        isActiveTrial && trialDaysLeft !== null && trialDaysLeft <= 3 ? {
            label: `Trial เหลือ ${trialDaysLeft} วัน`,
            href: `/dashboard/${gangId}/billing`,
            tone: 'warning' as ActionTone,
            icon: CreditCard,
        } : null,
    ].filter(Boolean) as Array<{ label: string; href: string; tone: ActionTone; icon: any }>;

    const quickActions = [
        { label: 'เช็คชื่อ', description: 'เปิดรอบหรือดูรอบล่าสุด', href: `/dashboard/${gangId}/attendance`, icon: CalendarCheck, show: true },
        { label: 'สมาชิก', description: 'ดูรายชื่อ บทบาท และสถานะ', href: `/dashboard/${gangId}/members`, icon: Users, show: true },
        { label: 'ประกาศ', description: 'แจ้งข่าวให้ทั้งแก๊งเห็น', href: `/dashboard/${gangId}/announcements`, icon: Megaphone, show: canManageSetup },
        { label: 'การเงินแก๊ง', description: 'กองกลาง หนี้ และรายการรอตรวจ', href: `/dashboard/${gangId}/finance`, icon: Wallet, show: canManageFinance },
        { label: 'แพลนระบบ', description: 'ต่ออายุ Premium หรือดูสถานะชำระเงิน', href: `/dashboard/${gangId}/billing`, icon: CreditCard, show: member.gangRole === 'OWNER' },
        { label: 'ตั้งค่า', description: 'ยศ ห้อง และงานเสี่ยง', href: `/dashboard/${gangId}/settings`, icon: Settings, show: canManageSetup },
    ].filter((item) => item.show);

    return (
        <>
            <AutoRefresh interval={30} />

            <section className="ops-surface relative z-10 mb-4 overflow-hidden rounded-token-xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm sm:mb-5">
                <div className="relative flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                        {gang.logoUrl ? (
                            <img src={gang.logoUrl} alt={gang.name} className="h-12 w-12 shrink-0 rounded-token-lg border border-border-subtle object-cover shadow-token-sm sm:h-14 sm:w-14" />
                        ) : (
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-token-lg border border-border-subtle bg-bg-elevated shadow-token-sm sm:h-14 sm:w-14">
                                <Users className="h-6 w-6 text-fg-tertiary" />
                            </div>
                        )}
                        <div className="min-w-0">
                            <div className="mb-2 inline-flex items-center gap-2 rounded-token-full border border-border-accent bg-accent-subtle px-3 py-1 text-xs font-bold tracking-normal text-accent-bright">
                                <span className="h-1.5 w-1.5 rounded-token-full bg-accent-bright" />
                                ภาพรวมวันนี้
                            </div>
                            <h1 className="truncate font-heading text-xl font-black tracking-tight text-fg-primary sm:text-2xl">{gang.name}</h1>
                            <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-fg-secondary sm:text-sm">
                                หน้าแรกสำหรับดูสถานะสำคัญของแก๊งและกดไปทำงานต่อทันที ไม่ต้องไล่หาเมนูเอง
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                        <Link href={`/dashboard/${gangId}/billing`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-token-lg border border-border-accent bg-accent-subtle px-4 py-2 text-xs font-bold text-accent-bright shadow-token-sm transition-colors hover:opacity-90">
                            <CreditCard className="h-3.5 w-3.5" />
                            {planLabel}
                        </Link>
                        <div className="inline-flex min-h-10 items-center justify-center gap-2 rounded-token-lg border border-border-subtle bg-bg-muted px-4 py-2 text-xs font-bold text-fg-secondary shadow-token-sm">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            {member.gangRole || 'MEMBER'}
                        </div>
                    </div>
                </div>
            </section>

            <section className="relative z-10 mb-4 grid gap-4 sm:mb-5 lg:grid-cols-[1.4fr_0.9fr]">
                <div className={`ops-card overflow-hidden rounded-token-xl border-l-2 p-4 ${primaryAction.tone === 'warning' ? 'border-l-status-warning' : primaryAction.tone === 'success' ? 'border-l-status-success' : 'border-l-status-info'}`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-4">
                            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-token-lg border border-border-subtle shadow-token-sm ${primaryAction.tone === 'warning' ? 'bg-status-warning-subtle' : primaryAction.tone === 'success' ? 'bg-status-success-subtle' : 'bg-status-info-subtle'}`}>
                                <PrimaryIcon className={`h-5 w-5 ${primaryAction.tone === 'warning' ? 'text-fg-warning' : primaryAction.tone === 'success' ? 'text-fg-success' : 'text-fg-info'}`} />
                            </div>
                            <div>
                                <p className="text-[11px] font-bold text-fg-tertiary">ควรกดต่อ</p>
                                <h2 className="mt-1 font-heading text-base font-black text-fg-primary sm:text-lg">{primaryAction.title}</h2>
                                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-fg-secondary">{primaryAction.description}</p>
                            </div>
                        </div>
                        <Link href={primaryAction.href} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-token-lg bg-accent px-4 py-2 text-sm font-black text-fg-inverse transition-colors hover:opacity-90">
                            {primaryAction.label}
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                </div>

                <div className="ops-card rounded-token-xl p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[11px] font-bold text-fg-tertiary">ต้องสนใจ</p>
                            <h2 className="mt-1 font-heading text-lg font-black text-fg-primary">คิวงานวันนี้</h2>
                        </div>
                        <span className="rounded-token-full border border-border-subtle bg-bg-muted px-3 py-1 text-xs font-bold text-fg-secondary">
                            {attentionItems.length > 0 ? `${attentionItems.length} งาน` : 'เรียบร้อย'}
                        </span>
                    </div>
                    <div className="mt-4 space-y-2">
                        {attentionItems.length === 0 ? (
                            <div className="rounded-token-lg border border-status-success bg-status-success-subtle p-3">
                                <div className="flex items-center gap-3">
                                    <CheckCircle2 className="h-5 w-5 text-fg-success" />
                                    <p className="text-sm font-semibold text-fg-primary">ไม่มีงานด่วนค้างอยู่ตอนนี้</p>
                                </div>
                            </div>
                        ) : (
                            attentionItems.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <Link key={item.label} href={item.href} className="flex min-h-11 items-center gap-3 rounded-token-lg border border-border-subtle bg-bg-muted/70 p-3 transition-colors hover:bg-bg-elevated">
                                        <Icon className={`h-4 w-4 ${item.tone === 'warning' ? 'text-fg-warning' : 'text-accent-bright'}`} />
                                        <span className="text-sm font-semibold text-fg-primary">{item.label}</span>
                                        <ArrowRight className="ml-auto h-4 w-4 text-fg-tertiary" />
                                    </Link>
                                );
                            })
                        )}
                    </div>
                </div>
            </section>

            {isActiveTrial && (
            <section className={`relative z-10 mb-5 rounded-token-xl border p-4 ${trialDaysLeft !== null && trialDaysLeft <= 3 ? 'border-status-warning bg-status-warning-subtle' : 'border-border-accent bg-accent-subtle'}`}>
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-sm font-bold text-fg-primary">กำลังใช้งาน Trial แบบเต็มฟีเจอร์</p>
                            <p className="mt-1 text-sm text-fg-secondary">
                                เหลืออีก {trialDaysLeft} วัน ก่อนระบบกลับเป็น Free และจำกัดสมาชิกเหลือ 15 คน
                            </p>
                            <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-fg-tertiary">
                                <Clock className="h-3.5 w-3.5" />
                                หมดอายุ {formatDate(trialExpiry)}
                            </div>
                        </div>
                        <Link href={`/dashboard/${gangId}/billing`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-token-lg bg-accent px-4 py-2 text-sm font-bold text-fg-inverse transition-colors hover:opacity-90">
                            ดูแพลนระบบ
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                </section>
            )}

            {canManageSetup && completedOnboardingCount < onboardingItems.length && (
                <section className="relative z-10 mb-5 rounded-token-xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-fg-tertiary">ตั้งต้นระบบ</p>
                            <h2 className="mt-1 font-heading text-lg font-black text-fg-primary">เช็คลิสต์ก่อนใช้งานจริง</h2>
                            <p className="mt-1 text-sm text-fg-secondary">ทำเสร็จแล้ว {completedOnboardingCount}/{onboardingItems.length} ขั้นตอน</p>
                        </div>
                        <Link href={`/dashboard/${gangId}/settings`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-token-lg border border-border bg-bg-muted px-4 py-2 text-sm font-semibold text-fg-primary transition-colors hover:bg-bg-elevated">
                            เปิดศูนย์ตั้งค่า
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                        {onboardingItems.map((item) => (
                            <Link key={item.title} href={item.href} className={`rounded-token-lg border p-3 transition-colors ${item.completed ? 'border-status-success bg-status-success-subtle' : 'border-border-subtle bg-bg-muted/65 hover:bg-bg-elevated'}`}>
                                <div className="flex items-start gap-3">
                                    <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${item.completed ? 'text-fg-success' : 'text-fg-tertiary'}`} />
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-sm font-bold text-fg-primary">{item.title}</p>
                                            <span className={`rounded-token-full px-2 py-0.5 text-[10px] font-black ${item.completed ? 'bg-status-success text-fg-success' : 'bg-status-warning-subtle text-fg-warning'}`}>
                                                {item.completed ? 'เสร็จแล้ว' : 'รอทำ'}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-xs leading-relaxed text-fg-tertiary">{item.description}</p>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            <section className="relative z-10 mb-5 grid gap-3 md:grid-cols-3">
                <StatsCard title="สมาชิก Active" value={activeMemberCount} label="คน" icon={<Users className="h-4 w-4" />} tone="success" />
                <StatsCard title="กองกลาง" value={`฿${balance.toLocaleString()}`} label="" icon={<Wallet className="h-4 w-4" />} tone="warning" />
                <StatsCard title="รอบเช็คชื่อ" value={recentSessions.length} label="ล่าสุด" icon={<CalendarCheck className="h-4 w-4" />} tone="info" />
            </section>

            <section className="ops-surface relative z-10 mb-5 rounded-token-xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-[11px] font-bold text-fg-tertiary">ทางลัด</p>
                        <h2 className="mt-1 font-heading text-lg font-black text-fg-primary">กดไปงานที่ใช้บ่อย</h2>
                    </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {quickActions.map((item) => {
                        const Icon = item.icon;
                        return (
                            <Link key={item.href} href={item.href} className="group rounded-token-lg border border-border-subtle bg-bg-muted/60 p-3 transition-[background-color,border-color,transform] hover:-translate-y-px hover:border-border-accent hover:bg-bg-elevated">
                                <div className="flex items-start gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-token-lg border border-border-subtle bg-bg-subtle text-accent-bright shadow-token-sm">
                                    <Icon className="h-4 w-4" />
                                </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-fg-primary">{item.label}</p>
                                        <p className="mt-1 text-xs leading-relaxed text-fg-tertiary">{item.description}</p>
                                    </div>
                                    <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-fg-tertiary transition-transform group-hover:translate-x-0.5" />
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </section>

            <section className="relative z-10 grid gap-5 lg:grid-cols-2">
                <ActivityCard
                    title="เช็คชื่อล่าสุด"
                    href={`/dashboard/${gangId}/attendance?tab=closed`}
                    emptyTitle="ยังไม่มีรอบเช็คชื่อ"
                    emptyDescription="เปิดรอบแรกเพื่อให้สมาชิกลองเช็คชื่อ และยืนยันว่า Discord setup พร้อมใช้งาน"
                    canAct={canManageAttendance}
                    actionHref={`/dashboard/${gangId}/attendance`}
                    actionLabel="ไปหน้าเช็คชื่อ"
                >
                    {recentSessions.map((attendanceSession) => (
                        <Link key={attendanceSession.id} href={`/dashboard/${gangId}/attendance/${attendanceSession.id}`} className="flex items-center justify-between gap-3 rounded-token-lg border border-border-subtle bg-bg-muted/65 p-3 transition-colors hover:bg-bg-elevated">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-fg-primary">{attendanceSession.sessionName}</p>
                                <p className="mt-1 text-xs text-fg-tertiary">{formatDate(attendanceSession.createdAt)}</p>
                            </div>
                            <span className={`shrink-0 rounded-token-full px-3 py-1 text-[10px] font-black ${attendanceSession.status === 'ACTIVE' ? 'bg-status-success-subtle text-fg-success' : attendanceSession.status === 'CLOSED' ? 'bg-bg-muted text-fg-tertiary' : 'bg-status-info-subtle text-fg-info'}`}>
                                {attendanceSession.status === 'ACTIVE' ? 'เปิดอยู่' : attendanceSession.status === 'CLOSED' ? 'ปิดแล้ว' : attendanceSession.status}
                            </span>
                        </Link>
                    ))}
                </ActivityCard>

                <ActivityCard
                    title="การเงินแก๊งล่าสุด"
                    href={`/dashboard/${gangId}/finance?tab=history`}
                    emptyTitle="ยังไม่มีธุรกรรม"
                    emptyDescription="เมื่อเริ่มบันทึกรายรับ รายจ่าย หรือหนี้ สมาชิกจะเห็นภาพรวมกองกลางได้ทันที"
                    canAct={canManageFinance}
                    actionHref={`/dashboard/${gangId}/finance`}
                    actionLabel="ไปการเงินแก๊ง"
                >
                    {groupedRecentTransactions.map((transaction: any) => {
                        const isIncome = transaction.type === 'INCOME' || transaction.type === 'REPAYMENT' || transaction.type === 'DEPOSIT' || (transaction.type === 'PENALTY' && transaction.amount < 0);
                        const isDueOnly = transaction.type === 'GANG_FEE';
                        const effectiveAt = new Date(transaction.approvedAt || transaction.createdAt);
                        return (
                            <div key={transaction.id} className="rounded-token-lg border border-border-subtle bg-bg-muted/65 p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex min-w-0 items-start gap-3">
                                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-token-lg ${isDueOnly ? 'bg-accent-subtle text-accent-bright' : isIncome ? 'bg-status-success-subtle text-fg-success' : 'bg-status-danger-subtle text-fg-danger'}`}>
                                            {isDueOnly ? <Wallet className="h-4 w-4" /> : isIncome ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="line-clamp-2 text-sm font-bold text-fg-primary">{getFinanceTitle(transaction)}</p>
                                            <p className="mt-1 text-xs text-fg-tertiary">{formatDate(effectiveAt)}</p>
                                        </div>
                                    </div>
                                    <span className={`shrink-0 text-sm font-black tabular-nums ${isDueOnly ? 'text-accent-bright' : isIncome ? 'text-fg-success' : 'text-fg-danger'}`}>
                                        {isDueOnly ? `฿${Math.abs(transaction.amount).toLocaleString()}` : `${isIncome ? '+' : '-'}฿${Math.abs(transaction.amount).toLocaleString()}`}
                                    </span>
                                </div>
                                {isDueOnly && (
                                    <div className="mt-3 flex items-start gap-2 rounded-token-lg bg-accent-subtle px-3 py-2 text-[11px] leading-relaxed text-accent-bright">
                                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                        ยังไม่เข้ากองกลางจนกว่าจะมีการชำระจริง
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </ActivityCard>
            </section>
        </>
    );
}

function StatsCard({
    title,
    value,
    label,
    icon,
    tone,
}: {
    title: string;
    value: string | number;
    label: string;
    icon: React.ReactNode;
    tone: 'success' | 'warning' | 'info';
}) {
    const toneMap = {
        success: { border: 'border-l-status-success', bg: 'bg-status-success-subtle', text: 'text-fg-success' },
        warning: { border: 'border-l-status-warning', bg: 'bg-status-warning-subtle', text: 'text-fg-warning' },
        info: { border: 'border-l-status-info', bg: 'bg-status-info-subtle', text: 'text-fg-info' },
    }[tone];

    return (
        <div className={`relative overflow-hidden rounded-token-xl border border-border-subtle border-l-2 ${toneMap.border} bg-bg-subtle p-3 shadow-token-sm transition-[border-color,box-shadow] hover:border-border hover:shadow-token-sm`}>
            <div className="relative z-10 mb-2.5 flex items-center gap-2.5">
                <div className={`flex h-9 w-9 items-center justify-center rounded-token-lg ${toneMap.bg} ${toneMap.text} shadow-token-sm`}>
                    {icon}
                </div>
                <span className="text-xs font-bold text-fg-tertiary">{title}</span>
            </div>
            <div className="relative z-10 font-heading text-xl font-black tabular-nums text-fg-primary sm:text-2xl">
                {value} <span className="text-sm font-semibold text-fg-tertiary">{label}</span>
            </div>
        </div>
    );
}

function ActivityCard({
    title,
    href,
    emptyTitle,
    emptyDescription,
    canAct,
    actionHref,
    actionLabel,
    children,
}: {
    title: string;
    href: string;
    emptyTitle: string;
    emptyDescription: string;
    canAct: boolean;
    actionHref: string;
    actionLabel: string;
    children: React.ReactNode[];
}) {
    const hasItems = children.length > 0;

    return (
        <div className="overflow-hidden rounded-token-xl border border-border-subtle bg-bg-subtle shadow-token-sm">
            <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
                <h3 className="font-heading text-sm font-black text-fg-primary">{title}</h3>
                <Link href={href} className="text-[11px] font-bold text-accent-bright transition-opacity hover:opacity-80">
                    ดูทั้งหมด
                </Link>
            </div>
            {hasItems ? (
                <div className="grid gap-2.5 p-3">
                    {children}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center gap-3 px-5 py-8 text-center">
                    <div className="text-sm font-semibold text-fg-secondary">{emptyTitle}</div>
                    <p className="max-w-sm text-xs leading-relaxed text-fg-tertiary">{emptyDescription}</p>
                    {canAct && (
                        <Link href={actionHref} className="inline-flex min-h-10 items-center gap-2 rounded-token-lg border border-border bg-bg-muted px-4 py-2 text-xs font-semibold text-fg-primary transition-colors hover:bg-bg-elevated">
                            {actionLabel}
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
}
