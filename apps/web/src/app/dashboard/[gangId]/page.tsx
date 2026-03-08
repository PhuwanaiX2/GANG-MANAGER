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
    ArrowUpRight,
    ArrowDownLeft,
    CalendarCheck,
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
            <div className="mb-8 flex items-center justify-between gap-4 relative z-10 animate-fade-in">
                <div className="flex items-center gap-3">
                    {gang.logoUrl ? (
                        <img src={gang.logoUrl} alt={gang.name} className="w-11 h-11 rounded-xl object-cover border border-white/10 shadow-lg" />
                    ) : (
                        <div className="w-11 h-11 bg-[#16161A] rounded-xl border border-white/10 flex items-center justify-center">
                            <Users className="w-5 h-5 text-zinc-400" />
                        </div>
                    )}
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-white font-heading">{gang.name}</h1>
                        <Link href={`/dashboard/${gangId}/settings?tab=subscription`} className="inline-flex items-center gap-1.5 text-xs text-emerald-400/70 hover:text-emerald-400 transition-colors mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {gang.subscriptionTier} Plan
                        </Link>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 relative z-10 animate-fade-in-up">
                <StatsCard title="สมาชิก" value={memberCount[0]?.count || 0} label="คน" icon={<Users className="w-4 h-4" />} color="emerald" />
                <StatsCard title="กองกลาง" value={`฿${balance.toLocaleString()}`} label="" icon={<Wallet className="w-4 h-4" />} color="amber" />
                <StatsCard title="เช็คชื่อ" value={recentSessions.length} label="รอบ" icon={<CalendarCheck className="w-4 h-4" />} color="cyan" />
            </div>

            {/* Content Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 relative z-10 animate-fade-in-up delay-200">
                {/* Recent Attendance */}
                <div className="bg-[#0F0F12] border border-white/[0.08] rounded-2xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white font-heading">เช็คชื่อล่าสุด</h3>
                        <Link href={`/dashboard/${gangId}/attendance?tab=closed`} className="text-[11px] text-emerald-400/70 hover:text-emerald-400 transition-colors font-medium">ดูทั้งหมด →</Link>
                    </div>
                    {recentSessions.length === 0 ? (
                        <div className="text-center py-10 text-zinc-600 text-sm">ยังไม่มีข้อมูล</div>
                    ) : (
                        <div className="divide-y divide-white/[0.05]">
                            {recentSessions.map((s) => (
                                <Link key={s.id} href={`/dashboard/${gangId}/attendance/${s.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.03] transition-colors">
                                    <div className={`shrink-0 w-2 h-2 rounded-full ${s.status === 'ACTIVE' ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : s.status === 'CLOSED' ? 'bg-zinc-600' : 'bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.5)]'}`} />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[13px] text-zinc-200 truncate font-medium">{s.sessionName}</div>
                                    </div>
                                    <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-medium ${s.status === 'ACTIVE' ? 'text-emerald-400 bg-emerald-500/10' : s.status === 'CLOSED' ? 'text-zinc-500 bg-white/5' : 'text-cyan-400 bg-cyan-500/10'}`}>
                                        {new Date(s.createdAt).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short' })}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent Finance */}
                <div className="bg-[#0F0F12] border border-white/[0.08] rounded-2xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white font-heading">ธุรกรรมล่าสุด</h3>
                        <Link href={`/dashboard/${gangId}/finance?tab=history`} className="text-[11px] text-emerald-400/70 hover:text-emerald-400 transition-colors font-medium">ดูทั้งหมด →</Link>
                    </div>
                    {recentTransactions.length === 0 ? (
                        <div className="text-center py-10 text-zinc-600 text-sm">ยังไม่มีข้อมูล</div>
                    ) : (
                        <div className="divide-y divide-white/[0.05]">
                            {groupedRecentTransactions.map((t: any) => {
                                const isIncome = t.type === 'INCOME' || t.type === 'REPAYMENT' || t.type === 'DEPOSIT';
                                const effectiveAt = new Date(t.approvedAt || t.createdAt);
                                return (
                                    <div key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.03] transition-colors">
                                        <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${isIncome ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                            {isIncome ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[13px] text-zinc-200 truncate font-medium">
                                                {t.type === 'GANG_FEE' && t.__batchCount
                                                    ? `เก็บเงินแก๊ง: ${t.__batchCount} คน`
                                                    : ['LOAN', 'REPAYMENT', 'DEPOSIT', 'GANG_FEE', 'PENALTY'].includes(t.type)
                                                        ? `${(t as any).member?.name || '-'} ${t.type === 'LOAN' ? 'ยืม' : t.type === 'REPAYMENT' ? 'คืน' : t.type === 'DEPOSIT' ? 'ฝาก' : t.type === 'GANG_FEE' ? 'เก็บเงิน' : 'ค่าปรับ'}`
                                                        : t.description
                                                }
                                            </div>
                                        </div>
                                        <span className={`shrink-0 text-sm font-semibold tabular-nums ${isIncome ? 'text-emerald-400' : 'text-rose-400'}`}>
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

function StatsCard({ title, value, label, icon, color }: any) {
    const colorMap: Record<string, { bg: string; text: string; border: string }> = {
        emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-l-emerald-500/50' },
        amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-l-amber-500/50' },
        cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-l-cyan-500/50' },
    };
    const c = colorMap[color] || colorMap.emerald;

    return (
        <div className={`p-5 rounded-2xl bg-[#0F0F12] border border-white/[0.08] border-l-2 ${c.border} hover:border-white/[0.12] transition-all`}>
            <div className="flex items-center gap-2.5 mb-3">
                <div className={`w-8 h-8 rounded-lg ${c.bg} ${c.text} flex items-center justify-center`}>
                    {icon}
                </div>
                <span className="text-sm text-zinc-400 font-medium">{title}</span>
            </div>
            <div className="text-2xl font-bold text-white tabular-nums font-heading">{value} <span className="text-sm font-normal text-zinc-500">{label}</span></div>
        </div>
    );
}
