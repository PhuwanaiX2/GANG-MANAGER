export const dynamic = 'force-dynamic';

import { db, gangs, members, transactions, licenses, FeatureFlagService, attendanceSessions } from '@gang/database';
import { eq, sql, gte } from 'drizzle-orm';
import Link from 'next/link';
import {
    Users,
    Server,
    Key,
    TrendingUp,
    Crown,
    Zap,
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

const TIER_MONTHLY_PRICE: Record<string, number> = { FREE: 0, TRIAL: 0, PRO: 149, PREMIUM: 299 };

export default async function AdminOverview() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [
        totalGangsResult,
        activeGangsResult,
        totalMembersResult,
        activeMembersResult,
        totalTransactionsResult,
        recentTxResult,
        tierBreakdown,
        totalLicensesResult,
        recentSessionsResult,
        newGangs30dResult,
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
        db.select({ count: sql<number>`count(*)` }).from(licenses).where(eq(licenses.isActive, true)),
        db.select({ count: sql<number>`count(*)` }).from(attendanceSessions).where(gte(attendanceSessions.createdAt, sevenDaysAgo)),
        db.select({ count: sql<number>`count(*)` }).from(gangs).where(gte(gangs.createdAt, thirtyDaysAgo)),
    ]);

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
    const totalLicenses = totalLicensesResult[0]?.count || 0;
    const recentSessions = recentSessionsResult[0]?.count || 0;
    const newGangs30d = newGangs30dResult[0]?.count || 0;

    const monthlyRevenue = tierBreakdown.reduce((sum, t) => sum + (TIER_MONTHLY_PRICE[t.tier] || 0) * t.count, 0);

    // Expiring gangs (within 7 days)
    const expiringGangs = await db.query.gangs.findMany({
        where: sql`${gangs.isActive} = 1 AND ${gangs.subscriptionExpiresAt} IS NOT NULL AND ${gangs.subscriptionExpiresAt} <= datetime('now', '+7 days') AND ${gangs.subscriptionExpiresAt} > datetime('now')`,
        columns: { id: true, name: true, subscriptionTier: true, subscriptionExpiresAt: true },
    });

    const tierIcon: Record<string, React.ReactNode> = {
        FREE: <Crown className="w-4 h-4 text-gray-400" />,
        TRIAL: <Crown className="w-4 h-4 text-yellow-400" />,
        PRO: <Zap className="w-4 h-4 text-blue-400" />,
        PREMIUM: <Gem className="w-4 h-4 text-purple-400" />,
    };

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
        blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
        cyan: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
        yellow: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
        orange: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
        purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
        emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
        red: 'bg-red-500/10 border-red-500/20 text-red-400',
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-black tracking-tight">ภาพรวมระบบ</h1>
                <p className="text-gray-500 text-sm mt-1">สถานะระบบทั้งหมด ณ ขณะนี้</p>
            </div>

            {/* Alerts */}
            {disabledFeaturesCount > 0 && (
                <div className="flex items-center gap-3 px-4 py-3 bg-orange-500/5 border border-orange-500/20 rounded-xl">
                    <Power className="w-5 h-5 text-orange-400 shrink-0" />
                    <span className="text-xs text-orange-400 font-bold flex-1">
                        มี {disabledFeaturesCount} ฟีเจอร์ที่ถูกปิดใช้งาน — ผู้ใช้จะเข้าถึงไม่ได้
                    </span>
                    <Link href="/admin/features" className="text-[10px] text-orange-400 hover:text-orange-300 font-bold flex items-center gap-1">
                        จัดการ <ArrowRight className="w-3 h-3" />
                    </Link>
                </div>
            )}

            {expiringGangs.length > 0 && (
                <div className="flex items-center gap-3 px-4 py-3 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
                    <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />
                    <span className="text-xs text-yellow-400 font-bold flex-1">
                        มี {expiringGangs.length} แก๊งจะหมดอายุใน 7 วัน: {expiringGangs.map(g => g.name).join(', ')}
                    </span>
                    <Link href="/admin/gangs" className="text-[10px] text-yellow-400 hover:text-yellow-300 font-bold flex items-center gap-1">
                        ดู <ArrowRight className="w-3 h-3" />
                    </Link>
                </div>
            )}

            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <StatCard icon={<Server className="w-5 h-5 text-blue-400" />} label="แก๊ง (Active)" value={activeGangs} sub={`/${totalGangs}`} />
                <StatCard icon={<Users className="w-5 h-5 text-green-400" />} label="สมาชิก (Active)" value={activeMembers} sub={`/${totalMembers}`} />
                <StatCard icon={<DollarSign className="w-5 h-5 text-emerald-400" />} label="รายได้/เดือน" value={monthlyRevenue} prefix="฿" />
                <StatCard icon={<Key className="w-5 h-5 text-yellow-400" />} label="License พร้อมใช้" value={totalLicenses} />
                <StatCard icon={<TrendingUp className="w-5 h-5 text-cyan-400" />} label="แก๊งใหม่ (30d)" value={newGangs30d} />
            </div>

            {/* Activity Row */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                        <TrendingUp className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                        <div className="text-lg font-black text-white tabular-nums">{recentTx.toLocaleString()}</div>
                        <div className="text-[10px] text-gray-500">ธุรกรรม 30 วันล่าสุด</div>
                    </div>
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex items-center gap-3">
                    <div className="p-2 bg-cyan-500/10 rounded-lg">
                        <CalendarCheck className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div>
                        <div className="text-lg font-black text-white tabular-nums">{recentSessions.toLocaleString()}</div>
                        <div className="text-[10px] text-gray-500">เช็คชื่อ 7 วันล่าสุด</div>
                    </div>
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex items-center gap-3">
                    <div className="p-2 bg-yellow-500/10 rounded-lg">
                        <Clock className="w-4 h-4 text-yellow-400" />
                    </div>
                    <div>
                        <div className="text-lg font-black text-white tabular-nums">{totalTx.toLocaleString()}</div>
                        <div className="text-[10px] text-gray-500">ธุรกรรมทั้งหมด</div>
                    </div>
                </div>
            </div>

            {/* Tier Breakdown */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <Crown className="w-4 h-4 text-yellow-400" />
                    การกระจายแพลน
                </h3>
                <div className="flex items-center gap-3 flex-wrap">
                    {tierBreakdown.map(t => {
                        const pct = activeGangs > 0 ? Math.round((t.count / activeGangs) * 100) : 0;
                        return (
                            <div key={t.tier} className="flex items-center gap-2.5 px-4 py-2.5 bg-black/20 border border-white/5 rounded-xl">
                                {tierIcon[t.tier]}
                                <div>
                                    <div className="text-xs font-bold text-white">{t.count} <span className="text-gray-600 font-normal">({pct}%)</span></div>
                                    <div className="text-[9px] text-gray-500">{t.tier}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Quick Links */}
            <div>
                <h3 className="text-sm font-bold text-white mb-4">เมนูจัดการ</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {QUICK_LINKS.map(link => (
                        <Link key={link.href} href={link.href}
                            className="group flex items-center gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] hover:border-white/10 transition-all">
                            <div className={`p-2.5 rounded-xl border ${colorMap[link.color]}`}>
                                <link.icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-white group-hover:text-white/90">{link.label}</div>
                                <div className="text-[10px] text-gray-500">{link.desc}</div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, sub, prefix }: { icon: React.ReactNode; label: string; value: number; sub?: string; prefix?: string }) {
    return (
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
                {icon}
                <span className="text-[10px] font-bold tracking-widest uppercase">{label}</span>
            </div>
            <div className="text-2xl font-black text-white tabular-nums">
                {prefix}{value.toLocaleString()}
                {sub && <span className="text-xs text-gray-600 font-medium ml-1">{sub}</span>}
            </div>
        </div>
    );
}
