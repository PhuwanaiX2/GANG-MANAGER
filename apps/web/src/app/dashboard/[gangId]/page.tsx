export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, gangs, members, attendanceSessions, transactions, leaveRequests } from '@gang/database';
import { eq, and, desc, sql } from 'drizzle-orm';
import Link from 'next/link';
import {
    Users,
    Wallet,
    Crown,
    TrendingUp,
    Clock,
    ArrowUpRight,
    ArrowDownLeft,
    CalendarCheck
} from 'lucide-react';
import { AutoRefresh } from '@/components/AutoRefresh';

interface Props {
    params: { gangId: string };
}

export default async function GangDashboard({ params }: Props) {
    const session = await getServerSession(authOptions);
    if (!session) redirect('/');

    const { gangId } = params;

    // Parallelize all data fetching
    const [gang, member, memberCount, recentSessions, recentTransactions, pendingLeaves] = await Promise.all([
        // 1. Get gang details
        db.query.gangs.findFirst({
            where: eq(gangs.id, gangId),
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

    const groupedRecentTransactions = (() => {
        const out: any[] = [];
        const feeGroups = new Map<string, { base: any; count: number; total: number; latestAt: number }>();

        for (const t of recentTransactions as any[]) {
            if (t.type !== 'GANG_FEE') {
                out.push(t);
                continue;
            }

            const effectiveAt = new Date(t.approvedAt || t.createdAt);
            const minuteBucket = effectiveAt.toISOString().slice(0, 16);
            const key = `${t.createdById || ''}|${t.description}|${t.amount}|${minuteBucket}`;
            const existing = feeGroups.get(key);
            if (!existing) {
                feeGroups.set(key, {
                    base: t,
                    count: 1,
                    total: Number(t.amount) || 0,
                    latestAt: effectiveAt.getTime(),
                });
            } else {
                existing.count += 1;
                existing.total += Number(t.amount) || 0;
                existing.latestAt = Math.max(existing.latestAt, effectiveAt.getTime());
            }
        }

        const groupedFees = Array.from(feeGroups.values())
            .sort((a, b) => b.latestAt - a.latestAt)
            .map((g) => ({
                ...g.base,
                id: `gang_fee_${g.base.id}`,
                amount: g.total,
                __batchCount: g.count,
                member: undefined,
                approvedAt: new Date(g.latestAt),
            }));

        const merged = [...out, ...groupedFees].sort((a, b) => {
            const aAt = new Date((a as any).approvedAt || (a as any).createdAt).getTime();
            const bAt = new Date((b as any).approvedAt || (b as any).createdAt).getTime();
            return bAt - aAt;
        });

        return merged.slice(0, 5);
    })();

    // Calculate balance
    // const lastTransaction = recentTransactions[0];
    const balance = gang.balance;

    return (
        <>
            <AutoRefresh interval={30} />
            {/* Page Header */}
            <div className="mb-12 flex flex-col sm:flex-row sm:items-center justify-between gap-6 animate-fade-in relative z-10">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-black border border-fivem-red/30 mb-3 rounded-sm shadow-[0_0_10px_rgba(255,42,0,0.2)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-fivem-red animate-pulse" />
                        <span className="text-fivem-red text-[10px] font-black tracking-widest uppercase">Gang Dashboard</span>
                    </div>
                    <div className="flex items-center gap-4">
                        {gang.logoUrl && (
                            <img
                                src={gang.logoUrl}
                                alt={gang.name}
                                className="w-14 h-14 rounded-2xl object-cover border border-white/10 shadow-lg"
                            />
                        )}
                        <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white drop-shadow-sm">
                            {gang.name}
                        </h1>
                    </div>
                    <p className="text-[#9ca3af] mt-2 font-medium">ภาพรวม สถิติ และกิจกรรมล่าสุดภายในแก๊ง</p>
                </div>
                <Link href={`/dashboard/${gangId}/settings?tab=subscription`} className="flex items-center gap-3 px-6 py-3 bg-black border border-fivem-red/50 hover:bg-fivem-red/10 shadow-[0_0_15px_rgba(255,42,0,0.1)] hover:shadow-[0_0_20px_rgba(255,42,0,0.3)] hover:-translate-y-1 transition-all cursor-pointer">
                    <Crown className="w-6 h-6 text-fivem-red drop-shadow-[0_0_5px_rgba(255,42,0,0.8)]" />
                    <span className="font-black text-white uppercase tracking-widest text-sm">{gang.subscriptionTier} PLAN</span>
                </Link>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12 relative z-10 animate-fade-in-up">
                <StatsCard
                    title="สมาชิกที่ประจำการ"
                    value={memberCount[0]?.count || 0}
                    label="Active Members"
                    icon={<Users className="w-7 h-7 text-fivem-red" />}
                    trend="+2 New"
                    trendUp={true}
                    color="red"
                    delay="100ms"
                />
                <StatsCard
                    title="ยอดกองกลางสุทธิ"
                    value={`฿${balance.toLocaleString()}`}
                    label="Current Balance"
                    icon={<Wallet className="w-7 h-7 text-emerald-500" />}
                    trend="Real-time Sync"
                    trendUp={true}
                    color="emerald"
                    delay="200ms"
                />
                <StatsCard
                    title="กิจกรรมเช็คชื่อ"
                    value={recentSessions.length}
                    label="Recent Activities"
                    icon={<CalendarCheck className="w-7 h-7 text-cyan-500" />}
                    trend="Active Monthly"
                    trendUp={true}
                    color="cyan"
                    delay="300ms"
                />
            </div>

            {/* Content Sections — Compact */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
                {/* Recent Attendance */}
                <div className="bg-[#0A0A0A] border border-[#151515] rounded-none overflow-hidden relative group">
                    {/* Scanline overlay */}
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] mix-blend-overlay pointer-events-none" />

                    <div className="p-5 border-b border-[#151515] flex items-center justify-between bg-black/60 relative z-10">
                        <div className="flex items-center gap-3">
                            <Clock className="w-5 h-5 text-fivem-red" />
                            <h3 className="font-bold text-[#d1d5db] uppercase tracking-wider">เช็คชื่อล่าสุด</h3>
                        </div>
                        <Link
                            href={`/dashboard/${gangId}/attendance?tab=closed`}
                            className="text-xs text-[#9ca3af] hover:text-fivem-red transition-colors uppercase font-bold tracking-widest"
                        >
                            ดูทั้งหมด →
                        </Link>
                    </div>
                    {recentSessions.length === 0 ? (
                        <div className="text-center py-10 text-[#71717a] text-sm uppercase tracking-widest relative z-10">ยังไม่มีข้อมูลการเช็คชื่อ</div>
                    ) : (
                        <div className="divide-y divide-[#151515] relative z-10">
                            {recentSessions.map((s) => (
                                <Link key={s.id} href={`/dashboard/${gangId}/attendance/${s.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-[#111] transition-colors">
                                    <div className={`shrink-0 w-2 h-2 rounded-full ${s.status === 'ACTIVE' ? 'bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]' : s.status === 'CLOSED' ? 'bg-[#52525b]' : 'bg-cyan-500 shadow-[0_0_8px_#06b6d4]'}`} />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold text-white truncate">{s.sessionName}</div>
                                        <div className="text-[10px] text-[#9ca3af] tracking-wider">{new Date(s.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</div>
                                    </div>
                                    <span className={`shrink-0 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border ${s.status === 'CLOSED' ? 'border-[#3f3f46] text-[#a1a1aa] bg-black/50' :
                                        s.status === 'ACTIVE' ? 'border-green-500/50 text-green-500 bg-green-500/10' : 'border-cyan-500/50 text-cyan-400 bg-cyan-500/10'
                                        }`}>
                                        {s.status === 'CLOSED' ? 'เสร็จสิ้น' : s.status === 'ACTIVE' ? 'กำลังเช็ค' : 'รอเปิด'}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent Finance */}
                <div className="bg-[#0A0A0A] border border-[#151515] rounded-none overflow-hidden relative group">
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] mix-blend-overlay pointer-events-none" />

                    <div className="p-5 border-b border-[#151515] flex items-center justify-between bg-black/60 relative z-10">
                        <div className="flex items-center gap-3">
                            <TrendingUp className="w-5 h-5 text-emerald-500" />
                            <h3 className="font-bold text-[#d1d5db] uppercase tracking-wider">ธุรกรรมล่าสุด</h3>
                        </div>
                        <Link
                            href={`/dashboard/${gangId}/finance?tab=history`}
                            className="text-xs text-[#9ca3af] hover:text-emerald-500 transition-colors uppercase font-bold tracking-widest"
                        >
                            ดูทั้งหมด →
                        </Link>
                    </div>
                    {recentTransactions.length === 0 ? (
                        <div className="text-center py-10 text-[#71717a] text-sm uppercase tracking-widest relative z-10">ยังไม่มีข้อมูลการเงิน</div>
                    ) : (
                        <div className="divide-y divide-[#151515] relative z-10">
                            {groupedRecentTransactions.map((t: any) => {
                                const isIncome = t.type === 'INCOME' || t.type === 'REPAYMENT' || t.type === 'DEPOSIT';
                                const effectiveAt = new Date(t.approvedAt || t.createdAt);
                                return (
                                    <div key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#111] transition-colors">
                                        <div className={`shrink-0 p-1.5 border ${isIncome ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-fivem-red/30 bg-fivem-red/10 text-fivem-red'}`}>
                                            {isIncome ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-bold text-white truncate">
                                                {t.type === 'GANG_FEE' && t.__batchCount
                                                    ? `เรียกเก็บเงินแก๊ง: ${t.__batchCount} คน`
                                                    : ['LOAN', 'REPAYMENT', 'DEPOSIT', 'GANG_FEE', 'PENALTY'].includes(t.type)
                                                        ? `${(t as any).member?.name || '-'} ${t.type === 'LOAN' ? 'ยืม' : t.type === 'REPAYMENT' ? 'คืนเงิน' : t.type === 'DEPOSIT' ? 'ฝาก/สำรองจ่าย' : t.type === 'GANG_FEE' ? 'เก็บเงินแก๊ง' : 'ค่าปรับ'}`
                                                        : t.description
                                                }
                                            </div>
                                            <div className="text-[10px] text-[#9ca3af] tracking-wider">{effectiveAt.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                                        </div>
                                        <span className={`shrink-0 font-black text-sm tabular-nums tracking-widest ${isIncome ? 'text-emerald-400' : 'text-fivem-red'}`}>
                                            {isIncome ? '+' : '-'}฿{Math.abs(t.amount).toLocaleString()}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

function StatsCard({ title, value, label, icon, trend, trendUp, color, delay }: any) {
    const colorStyles: any = {
        red: {
            bg: 'bg-black',
            border: 'border-fivem-red/30',
            light: 'bg-fivem-red/10 border-fivem-red/50',
            text: 'text-fivem-red',
            shadow: 'shadow-[0_0_15px_rgba(255,42,0,0.2)]'
        },
        emerald: {
            bg: 'bg-black',
            border: 'border-emerald-500/30',
            light: 'bg-emerald-500/10 border-emerald-500/50',
            text: 'text-emerald-500',
            shadow: 'shadow-[0_0_15px_rgba(16,185,129,0.2)]'
        },
        cyan: {
            bg: 'bg-black',
            border: 'border-cyan-500/30',
            light: 'bg-cyan-500/10 border-cyan-500/50',
            text: 'text-cyan-500',
            shadow: 'shadow-[0_0_15px_rgba(6,182,212,0.2)]'
        }
    };

    const style = colorStyles[color] || colorStyles.red;

    return (
        <div
            className={`relative bg-[#0A0A0A] border ${style.border} p-6 overflow-hidden group hover:border-[#333] transition-all duration-500 hover:-translate-y-1 ${style.shadow}`}
            style={{ animationDelay: delay }}
        >
            <div className={`absolute top-0 right-0 w-32 h-32 ${style.bg} opacity-20 blur-2xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700 pointer-events-none`} />

            <div className="flex justify-between items-start mb-6 relative z-10">
                <div className={`p-3 bg-[#111] border border-[#222] ${style.shadow} group-hover:scale-110 transition-transform duration-500`}>
                    {icon}
                </div>
                {trend && (
                    <div className={`flex items-center gap-1.5 px-2 py-1 ${style.light} ${style.text} text-[10px] font-black tracking-widest uppercase border`}>
                        {trendUp ? '▲' : '▼'} {trend}
                    </div>
                )}
            </div>

            <div className="relative z-10">
                <div className="text-[#a1a1aa] text-[10px] font-black tracking-[0.2em] uppercase mb-1">{title}</div>
                <div className="text-4xl font-black text-white tracking-tighter drop-shadow-md mb-1">{value}</div>
                <div className="text-[10px] font-bold text-[#52525b] uppercase tracking-widest">{label}</div>
            </div>
        </div>
    );
}
