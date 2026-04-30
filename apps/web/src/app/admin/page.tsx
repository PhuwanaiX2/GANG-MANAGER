export const dynamic = 'force-dynamic';

import { db, gangs, members, transactions, licenses, FeatureFlagService, attendanceSessions, getTierConfig, normalizeSubscriptionTier } from '@gang/database';
import { and, eq, gt, isNotNull, lte, sql, gte } from 'drizzle-orm';
import Link from 'next/link';
import {
    Users,
    Server,
    Key,
    TrendingUp,
    Crown,
    Gem,
    DollarSign,
    Power,
    ArrowRight,
    Database,
    ShieldAlert,
    AlertTriangle,
    Clock,
    CalendarCheck,
    Activity,
    Megaphone,
} from 'lucide-react';

export default async function AdminOverview() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const [
        totalGangsResult,
        activeGangsResult,
        totalMembersResult,
        activeMembersResult,
        totalTransactionsResult,
        recentTxResult,
        tierBreakdown,
        allLicensesResult,
        totalLicensesResult,
        recentSessionsResult,
        newGangs30dResult,
        inactiveGangsResult,
        expiredGangsResult,
    ] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(gangs),
        db.select({ count: sql<number>`count(*)` }).from(gangs).where(eq(gangs.isActive, true)),
        db.select({ count: sql<number>`count(*)` }).from(members),
        db.select({ count: sql<number>`count(*)` }).from(members).where(eq(members.isActive, true)),
        db.select({ count: sql<number>`count(*)` }).from(transactions),
        db.select({ count: sql<number>`count(*)` }).from(transactions).where(gte(transactions.createdAt, thirtyDaysAgo)),
        db.select({
            tier: gangs.subscriptionTier,
            count: sql<number>`count(*)`,
        }).from(gangs).where(eq(gangs.isActive, true)).groupBy(gangs.subscriptionTier),
        db.select({ count: sql<number>`count(*)` }).from(licenses),
        db.select({ count: sql<number>`count(*)` }).from(licenses).where(eq(licenses.isActive, true)),
        db.select({ count: sql<number>`count(*)` }).from(attendanceSessions).where(gte(attendanceSessions.createdAt, sevenDaysAgo)),
        db.select({ count: sql<number>`count(*)` }).from(gangs).where(gte(gangs.createdAt, thirtyDaysAgo)),
        db.select({ count: sql<number>`count(*)` }).from(gangs).where(eq(gangs.isActive, false)),
        db.select({ count: sql<number>`count(*)` }).from(gangs).where(and(
            eq(gangs.isActive, true),
            isNotNull(gangs.subscriptionExpiresAt),
            lte(gangs.subscriptionExpiresAt, now),
        )),
    ]);

    const memberSupportRows = await db.select({
        discordId: members.discordId,
        isActive: members.isActive,
        status: members.status,
        gangActive: gangs.isActive,
    })
        .from(members)
        .leftJoin(gangs, eq(members.gangId, gangs.id));

    // Seed feature flags
    await FeatureFlagService.seed(db);
    const allFeatureFlags = await FeatureFlagService.getAll(db);
    const disabledFeaturesCount = allFeatureFlags.filter((f: any) => !f.enabled).length;

    const totalGangs = totalGangsResult[0]?.count || 0;
    const activeGangs = activeGangsResult[0]?.count || 0;
    const totalMembers = totalMembersResult[0]?.count || 0;
    const activeMembers = activeMembersResult[0]?.count || 0;
    const totalTx = totalTransactionsResult[0]?.count || 0;
    const recentTx = recentTxResult[0]?.count || 0;
    const totalLicenseInventory = allLicensesResult[0]?.count || 0;
    const totalLicenses = totalLicensesResult[0]?.count || 0;
    const inactiveLicenses = Math.max(0, totalLicenseInventory - totalLicenses);
    const recentSessions = recentSessionsResult[0]?.count || 0;
    const newGangs30d = newGangs30dResult[0]?.count || 0;
    const inactiveGangs = inactiveGangsResult[0]?.count || 0;
    const expiredGangsCount = expiredGangsResult[0]?.count || 0;

    const discordUsageMap = (() => {
        const discordMap = new Map<string, number>();
        memberSupportRows.filter(row => row.discordId && row.isActive).forEach(row => {
            discordMap.set(row.discordId!, (discordMap.get(row.discordId!) || 0) + 1);
        });
        return discordMap;
    })();
    const multiGangMembersCount = Array.from(discordUsageMap.values()).filter(count => count > 1).length;
    const noDiscordMembersCount = memberSupportRows.filter(row => !row.discordId).length;
    const pendingMembersCount = memberSupportRows.filter(row => row.status === 'PENDING').length;
    const inactiveGangMembersCount = memberSupportRows.filter(row => row.gangActive === false).length;

    const normalizedTierBreakdown = tierBreakdown.reduce((acc, t) => {
        const normalizedTier = normalizeSubscriptionTier(t.tier);
        acc[normalizedTier] = (acc[normalizedTier] || 0) + t.count;
        return acc;
    }, { FREE: 0, PREMIUM: 0 } as Record<string, number>);

    const estimatedMonthlyPlanValue = Object.entries(normalizedTierBreakdown).reduce((sum, [tier, count]) => {
        return sum + getTierConfig(tier).price * count;
    }, 0);

    // Expiring gangs (within 7 days)
    const expiringGangs = await db.query.gangs.findMany({
        where: and(
            eq(gangs.isActive, true),
            isNotNull(gangs.subscriptionExpiresAt),
            lte(gangs.subscriptionExpiresAt, sevenDaysFromNow),
            gt(gangs.subscriptionExpiresAt, now),
        ),
        columns: { id: true, name: true, subscriptionTier: true, subscriptionExpiresAt: true },
    });

    const tierIcon: Record<string, React.ReactNode> = {
        FREE: <Crown className="w-4 h-4 text-fg-secondary" />,
        PREMIUM: <Gem className="w-4 h-4 text-accent-bright" />,
    };

    const supportQueues = [
        { href: '/admin/gangs?tier=TRIAL&attention=TRIAL', label: 'Trial', count: normalizedTierBreakdown.TRIAL || 0, tone: 'border-border-accent bg-accent-subtle text-accent-bright' },
        { href: '/admin/gangs?attention=EXPIRING', label: 'ใกล้หมดอายุ', count: expiringGangs.length, tone: 'border-status-warning bg-status-warning-subtle text-fg-warning' },
        { href: '/admin/gangs?attention=EXPIRED', label: 'หมดอายุแล้ว', count: expiredGangsCount, tone: 'border-status-danger bg-status-danger-subtle text-fg-danger' },
        { href: '/admin/gangs?status=INACTIVE', label: 'Inactive', count: inactiveGangs, tone: 'border-border-subtle bg-bg-muted text-fg-secondary' },
    ];

    const memberSupportQueues = [
        { href: '/admin/members?support=MULTI_GANG', label: 'หลายแก๊ง', count: multiGangMembersCount, tone: 'border-status-warning bg-status-warning-subtle text-fg-warning' },
        { href: '/admin/members?support=NO_DISCORD', label: 'ไม่มี Discord', count: noDiscordMembersCount, tone: 'border-border-subtle bg-bg-muted text-fg-secondary' },
        { href: '/admin/members?support=PENDING', label: 'Pending', count: pendingMembersCount, tone: 'border-status-warning bg-status-warning-subtle text-fg-warning' },
        { href: '/admin/members?support=INACTIVE_GANG', label: 'แก๊งถูกปิด', count: inactiveGangMembersCount, tone: 'border-status-danger bg-status-danger-subtle text-fg-danger' },
    ];

    const licenseSupportQueues = [
        { href: '/admin/licenses?status=active', label: 'คีย์พร้อมใช้', count: totalLicenses, tone: 'border-status-success bg-status-success-subtle text-fg-success' },
        { href: '/admin/licenses?status=inactive', label: 'คีย์ใช้แล้ว/ปิดแล้ว', count: inactiveLicenses, tone: 'border-border-subtle bg-bg-muted text-fg-secondary' },
    ];

    const QUICK_LINKS = [
        { href: '/admin/gangs', label: 'จัดการแก๊ง', desc: 'เปลี่ยนแพลน, เพิ่มวัน, ดูข้อมูลแก๊ง', icon: Server, color: 'blue' },
        { href: '/admin/members', label: 'ค้นหาสมาชิก', desc: 'ค้นหาผู้ใช้ทั้งระบบ ข้ามแก๊ง สำหรับ support', icon: Users, color: 'cyan' },
        { href: '/admin/licenses', label: 'License Keys', desc: 'สร้าง/จัดการ License สำหรับแจก', icon: Key, color: 'yellow' },
        { href: '/admin/features', label: 'Feature Flags', desc: 'เปิด/ปิดฟีเจอร์ทั้งระบบ (Kill-Switch)', icon: Power, color: 'orange' },
        { href: '/admin/announcements', label: 'ประกาศระบบ', desc: 'ส่งประกาศถึงทุกแก๊ง แจ้งปิดซ่อม, อัปเดต', icon: Megaphone, color: 'purple' },
        { href: '/admin/logs', label: 'Activity Log', desc: 'ดูกิจกรรมทั้งหมดที่เกิดขึ้น filter ตามประเภท', icon: Activity, color: 'cyan' },
        { href: '/admin/data', label: 'ข้อมูล & Backup', desc: 'ดาวน์โหลด Backup, ลบข้อมูลเก่า', icon: Database, color: 'emerald' },
        { href: '/admin/security', label: 'ความปลอดภัย', desc: 'ตรวจสอบ config, จุดเสี่ยง, admin log', icon: ShieldAlert, color: 'red' },
    ];

    const colorMap: Record<string, string> = {
        blue: 'bg-status-info-subtle border-status-info text-fg-info',
        cyan: 'bg-status-info-subtle border-status-info text-fg-info',
        yellow: 'bg-status-warning-subtle border-status-warning text-fg-warning',
        orange: 'bg-status-warning-subtle border-status-warning text-fg-warning',
        purple: 'bg-accent-subtle border-border-accent text-accent-bright',
        emerald: 'bg-status-success-subtle border-status-success text-fg-success',
        red: 'bg-status-danger-subtle border-status-danger text-fg-danger',
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-black tracking-tight">ภาพรวมระบบ</h1>
                <p className="text-fg-tertiary text-sm mt-1">สถานะระบบทั้งหมด ณ ขณะนี้</p>
            </div>

            {/* Alerts */}
            {disabledFeaturesCount > 0 && (
                <div className="flex items-center gap-3 px-4 py-3 bg-status-warning-subtle border border-status-warning rounded-token-xl">
                    <Power className="w-5 h-5 text-fg-warning shrink-0" />
                    <span className="text-xs text-fg-warning font-bold flex-1">
                        มี {disabledFeaturesCount} ฟีเจอร์ที่ถูกปิดใช้งาน — ผู้ใช้จะเข้าถึงไม่ได้
                    </span>
                    <Link href="/admin/features" className="text-[10px] text-fg-warning hover:text-fg-primary font-bold flex items-center gap-1">
                        จัดการ <ArrowRight className="w-3 h-3" />
                    </Link>
                </div>
            )}

            {expiringGangs.length > 0 && (
                <div className="flex items-center gap-3 px-4 py-3 bg-status-warning-subtle border border-status-warning rounded-token-xl">
                    <AlertTriangle className="w-5 h-5 text-fg-warning shrink-0" />
                    <span className="text-xs text-fg-warning font-bold flex-1">
                        มี {expiringGangs.length} แก๊งจะหมดอายุใน 7 วัน: {expiringGangs.map(g => g.name).join(', ')}
                    </span>
                    <Link href="/admin/gangs?attention=EXPIRING" className="text-[10px] text-fg-warning hover:text-fg-primary font-bold flex items-center gap-1">
                        ดู <ArrowRight className="w-3 h-3" />
                    </Link>
                </div>
            )}

            <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl p-5 shadow-token-sm">
                <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                        <h3 className="text-sm font-bold text-fg-primary">Gang Support Queues</h3>
                        <p className="text-[11px] text-fg-tertiary mt-1">คิวเคส subscription และสถานะแก๊งที่ทีม support เจอบ่อย</p>
                    </div>
                    <Link href="/admin/gangs" className="text-[10px] text-fg-info hover:text-fg-primary font-bold flex items-center gap-1">
                        ไปหน้าแก๊ง <ArrowRight className="w-3 h-3" />
                    </Link>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {supportQueues.map(queue => (
                        <Link key={queue.href} href={queue.href} className={`inline-flex items-center gap-2 rounded-token-full border px-3 py-1.5 text-[10px] font-bold transition-colors hover:brightness-110 ${queue.tone}`}>
                            {queue.label}
                            <span className="rounded-token-full bg-bg-muted px-1.5 py-0.5 text-[9px] tabular-nums">{queue.count}</span>
                        </Link>
                    ))}
                </div>
            </div>

            <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl p-5 shadow-token-sm">
                <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                        <h3 className="text-sm font-bold text-fg-primary">Member Support Queues</h3>
                        <p className="text-[11px] text-fg-tertiary mt-1">คิวเคส identity, onboarding, และบัญชีผู้ใช้ที่ต้องไล่ต่อจากหน้า members</p>
                    </div>
                    <Link href="/admin/members" className="text-[10px] text-fg-info hover:text-fg-primary font-bold flex items-center gap-1">
                        ไปหน้าสมาชิก <ArrowRight className="w-3 h-3" />
                    </Link>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {memberSupportQueues.map(queue => (
                        <Link key={queue.href} href={queue.href} className={`inline-flex items-center gap-2 rounded-token-full border px-3 py-1.5 text-[10px] font-bold transition-colors hover:brightness-110 ${queue.tone}`}>
                            {queue.label}
                            <span className="rounded-token-full bg-bg-muted px-1.5 py-0.5 text-[9px] tabular-nums">{queue.count}</span>
                        </Link>
                    ))}
                </div>
            </div>

            <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl p-5 shadow-token-sm">
                <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                        <h3 className="text-sm font-bold text-fg-primary">License Recovery Queues</h3>
                        <p className="text-[11px] text-fg-tertiary mt-1">คีย์ที่พร้อมช่วยลูกค้าเปิดใช้ต่อ หรือคีย์ที่ต้องไล่ประวัติการใช้งานย้อนหลัง</p>
                    </div>
                    <Link href="/admin/licenses" className="text-[10px] text-fg-warning hover:text-fg-primary font-bold flex items-center gap-1">
                        ไปหน้า license <ArrowRight className="w-3 h-3" />
                    </Link>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {licenseSupportQueues.map(queue => (
                        <Link key={queue.href} href={queue.href} className={`inline-flex items-center gap-2 rounded-token-full border px-3 py-1.5 text-[10px] font-bold transition-colors hover:brightness-110 ${queue.tone}`}>
                            {queue.label}
                            <span className="rounded-token-full bg-bg-muted px-1.5 py-0.5 text-[9px] tabular-nums">{queue.count}</span>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <StatCard icon={<Server className="w-5 h-5 text-fg-info" />} label="แก๊ง (Active)" value={activeGangs} sub={`/${totalGangs}`} />
                <StatCard icon={<Users className="w-5 h-5 text-fg-success" />} label="สมาชิก (Active)" value={activeMembers} sub={`/${totalMembers}`} />
                <StatCard icon={<DollarSign className="w-5 h-5 text-fg-success" />} label="มูลค่าแพลน/เดือน" value={estimatedMonthlyPlanValue} prefix="฿" />
                <StatCard icon={<Key className="w-5 h-5 text-fg-warning" />} label="License พร้อมใช้" value={totalLicenses} />
                <StatCard icon={<TrendingUp className="w-5 h-5 text-fg-info" />} label="แก๊งใหม่ (30d)" value={newGangs30d} />
            </div>

            {/* Activity Row */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-bg-subtle border border-border-subtle rounded-token-xl p-4 flex items-center gap-3 shadow-token-sm">
                    <div className="p-2 bg-accent-subtle rounded-token-lg">
                        <TrendingUp className="w-4 h-4 text-accent-bright" />
                    </div>
                    <div>
                        <div className="text-lg font-black text-fg-primary tabular-nums">{recentTx.toLocaleString()}</div>
                        <div className="text-[10px] text-fg-tertiary">ธุรกรรม 30 วันล่าสุด</div>
                    </div>
                </div>
                <div className="bg-bg-subtle border border-border-subtle rounded-token-xl p-4 flex items-center gap-3 shadow-token-sm">
                    <div className="p-2 bg-status-info-subtle rounded-token-lg">
                        <CalendarCheck className="w-4 h-4 text-fg-info" />
                    </div>
                    <div>
                        <div className="text-lg font-black text-fg-primary tabular-nums">{recentSessions.toLocaleString()}</div>
                        <div className="text-[10px] text-fg-tertiary">เช็คชื่อ 7 วันล่าสุด</div>
                    </div>
                </div>
                <div className="bg-bg-subtle border border-border-subtle rounded-token-xl p-4 flex items-center gap-3 shadow-token-sm">
                    <div className="p-2 bg-status-warning-subtle rounded-token-lg">
                        <Clock className="w-4 h-4 text-fg-warning" />
                    </div>
                    <div>
                        <div className="text-lg font-black text-fg-primary tabular-nums">{totalTx.toLocaleString()}</div>
                        <div className="text-[10px] text-fg-tertiary">ธุรกรรมทั้งหมด</div>
                    </div>
                </div>
            </div>

            {/* Tier Breakdown */}
            <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl p-5 shadow-token-sm">
                <h3 className="text-sm font-bold text-fg-primary mb-4 flex items-center gap-2">
                    <Crown className="w-4 h-4 text-accent-bright" />
                    การกระจายแพลน
                </h3>
                <div className="flex items-center gap-3 flex-wrap">
                    {Object.entries(normalizedTierBreakdown).filter(([, count]) => count > 0).map(([tier, count]) => {
                        const pct = activeGangs > 0 ? Math.round((count / activeGangs) * 100) : 0;
                        return (
                            <div key={tier} className="flex items-center gap-2.5 px-4 py-2.5 bg-bg-muted border border-border-subtle rounded-token-xl">
                                {tierIcon[tier]}
                                <div>
                                    <div className="text-xs font-bold text-fg-primary">{count} <span className="text-fg-tertiary font-normal">({pct}%)</span></div>
                                    <div className="text-[9px] text-fg-tertiary">{tier}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Quick Links */}
            <div>
                <h3 className="text-sm font-bold text-fg-primary mb-4">เมนูจัดการ</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {QUICK_LINKS.map(link => (
                        <Link key={link.href} href={link.href}
                            className="group flex items-center gap-4 p-4 bg-bg-subtle border border-border-subtle rounded-token-xl hover:bg-bg-muted hover:border-border transition-all shadow-token-sm">
                            <div className={`p-2.5 rounded-token-xl border ${colorMap[link.color]}`}>
                                <link.icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-fg-primary group-hover:text-fg-secondary">{link.label}</div>
                                <div className="text-[10px] text-fg-tertiary">{link.desc}</div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-fg-tertiary group-hover:text-fg-secondary transition-colors" />
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, sub, prefix }: { icon: React.ReactNode; label: string; value: number; sub?: string; prefix?: string }) {
    return (
        <div className="bg-bg-subtle border border-border-subtle rounded-token-xl p-4 shadow-token-sm">
            <div className="flex items-center gap-2 text-fg-tertiary mb-2">
                {icon}
                <span className="text-[10px] font-bold tracking-widest uppercase">{label}</span>
            </div>
            <div className="text-2xl font-black text-fg-primary tabular-nums">
                {prefix}{value.toLocaleString()}
                {sub && <span className="text-xs text-fg-tertiary font-medium ml-1">{sub}</span>}
            </div>
        </div>
    );
}
