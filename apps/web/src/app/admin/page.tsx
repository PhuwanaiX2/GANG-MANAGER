import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, gangs, members, transactions, licenses } from '@gang/database';
import { eq, sql, desc } from 'drizzle-orm';
import Link from 'next/link';
import {
    Shield,
    Users,
    Server,
    Key,
    TrendingUp,
    Crown,
    Zap,
    Gem,
    Home,
    DollarSign,
} from 'lucide-react';
import { LicenseManager, GangTable, DataManager } from './AdminClient';

const ADMIN_IDS = (process.env.ADMIN_DISCORD_IDS || '').split(',').filter(Boolean);

const TIER_MONTHLY_PRICE: Record<string, number> = { FREE: 0, TRIAL: 0, PRO: 149, PREMIUM: 299 };

export default async function AdminDashboard() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId) redirect('/');

    if (!ADMIN_IDS.includes(session.user.discordId)) {
        return (
            <main className="min-h-screen bg-[#050505] flex items-center justify-center text-white">
                <div className="text-center">
                    <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold mb-2">ไม่มีสิทธิ์เข้าถึง</h1>
                    <p className="text-gray-500">คุณไม่ได้รับอนุญาตให้เข้าถึงหน้านี้</p>
                </div>
            </main>
        );
    }

    // Parallel fetch all stats
    const [
        totalGangsResult,
        activeGangsResult,
        totalMembersResult,
        activeMembersResult,
        totalTransactionsResult,
        tierBreakdown,
        allGangs,
        totalLicensesResult,
        allLicenses,
    ] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(gangs),
        db.select({ count: sql<number>`count(*)` }).from(gangs).where(eq(gangs.isActive, true)),
        db.select({ count: sql<number>`count(*)` }).from(members),
        db.select({ count: sql<number>`count(*)` }).from(members).where(eq(members.isActive, true)),
        db.select({ count: sql<number>`count(*)` }).from(transactions),
        db.select({
            tier: gangs.subscriptionTier,
            count: sql<number>`count(*)`,
        }).from(gangs).where(eq(gangs.isActive, true)).groupBy(gangs.subscriptionTier),
        db.query.gangs.findMany({
            where: eq(gangs.isActive, true),
            orderBy: desc(gangs.createdAt),
            columns: { id: true, name: true, subscriptionTier: true, subscriptionExpiresAt: true, createdAt: true, discordGuildId: true, logoUrl: true },
        }),
        db.select({ count: sql<number>`count(*)` }).from(licenses).where(eq(licenses.isActive, true)),
        db.query.licenses.findMany({ orderBy: desc(licenses.createdAt) }),
    ]);

    const totalGangs = totalGangsResult[0]?.count || 0;
    const activeGangs = activeGangsResult[0]?.count || 0;
    const totalMembers = totalMembersResult[0]?.count || 0;
    const activeMembers = activeMembersResult[0]?.count || 0;
    const totalTx = totalTransactionsResult[0]?.count || 0;
    const totalLicenses = totalLicensesResult[0]?.count || 0;

    // Revenue estimate: count active paid gangs × monthly price
    const monthlyRevenue = tierBreakdown.reduce((sum, t) => sum + (TIER_MONTHLY_PRICE[t.tier] || 0) * t.count, 0);

    // Get member counts per gang for the table
    const gangMemberCounts = await db.select({
        gangId: members.gangId,
        count: sql<number>`count(*)`,
    }).from(members).where(eq(members.isActive, true)).groupBy(members.gangId);

    const memberCountMap = new Map(gangMemberCounts.map(g => [g.gangId, g.count]));

    const tierIcon: Record<string, React.ReactNode> = {
        FREE: <Crown className="w-4 h-4 text-gray-400" />,
        TRIAL: <Crown className="w-4 h-4 text-yellow-400" />,
        PRO: <Zap className="w-4 h-4 text-blue-400" />,
        PREMIUM: <Gem className="w-4 h-4 text-purple-400" />,
    };

    return (
        <main className="min-h-screen bg-[#050505] text-white p-6 pb-24">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 mb-3">
                        <Shield className="w-3.5 h-3.5 text-red-500" />
                        <span className="text-red-500 text-[10px] font-black tracking-widest uppercase">Super Admin</span>
                    </div>
                    <h1 className="text-3xl font-black tracking-tight">Admin Dashboard</h1>
                    <p className="text-gray-500 text-sm mt-1">ภาพรวมระบบทั้งหมด</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <StatCard icon={<Server className="w-5 h-5" />} label="แก๊ง" value={activeGangs} sub={`/${totalGangs}`} />
                    <StatCard icon={<Users className="w-5 h-5" />} label="สมาชิก" value={activeMembers} sub={`/${totalMembers}`} />
                    <StatCard icon={<TrendingUp className="w-5 h-5" />} label="ธุรกรรม" value={totalTx} />
                    <StatCard icon={<Key className="w-5 h-5" />} label="License พร้อมใช้" value={totalLicenses} />
                    <StatCard icon={<DollarSign className="w-5 h-5 text-emerald-400" />} label="รายได้/เดือน (ประมาณ)" value={monthlyRevenue} prefix="฿" />
                </div>

                {/* Tier Breakdown */}
                <div className="flex items-center gap-3 flex-wrap">
                    {tierBreakdown.map(t => (
                        <div key={t.tier} className="flex items-center gap-2 px-4 py-2 bg-white/[0.02] border border-white/5 rounded-xl">
                            {tierIcon[t.tier]}
                            <span className="text-xs font-bold text-white">{t.count}</span>
                            <span className="text-[10px] text-gray-500">{t.tier}</span>
                        </div>
                    ))}
                </div>

                {/* Gang Table (with search + filter) */}
                <GangTable
                    gangs={JSON.parse(JSON.stringify(allGangs))}
                    memberCountMap={Object.fromEntries(memberCountMap)}
                />

                {/* License Management */}
                <LicenseManager initialLicenses={JSON.parse(JSON.stringify(allLicenses))} />

                {/* Backup / Data / Reports */}
                <DataManager gangList={allGangs.map(g => ({ id: g.id, name: g.name }))} />
            </div>

            {/* Fixed Nav */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#111] border border-white/10 rounded-full px-4 py-2 shadow-2xl z-50">
                <Link href="/" className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white rounded-full hover:bg-white/5 transition-colors">
                    <Home className="w-3.5 h-3.5" />
                    หน้าแรก
                </Link>
                <Link href="/dashboard" className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white rounded-full hover:bg-white/5 transition-colors">
                    <Server className="w-3.5 h-3.5" />
                    Dashboard
                </Link>
                <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 bg-red-500/10 rounded-full">
                    <Shield className="w-3.5 h-3.5" />
                    Admin
                </div>
            </div>
        </main>
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
