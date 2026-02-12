import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, gangs, members, attendanceSessions, transactions, leaveRequests } from '@gang/database';
import { eq, and, desc, sql } from 'drizzle-orm';
import Link from 'next/link';
// import { DashboardLayout } from '@/components/DashboardLayout';
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
                sql`${transactions.status} != 'REJECTED'`
            ),
            orderBy: desc(transactions.createdAt),
            limit: 5,
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

    // Calculate balance
    // const lastTransaction = recentTransactions[0];
    const balance = gang.balance;

    return (
        <>
            {/* Page Header */}
            <div className="mb-12 flex flex-col sm:flex-row sm:items-center justify-between gap-6 animate-fade-in relative z-10">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-discord-primary/10 border border-discord-primary/20 mb-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-discord-primary animate-pulse" />
                        <span className="text-discord-primary text-[10px] font-black tracking-widest uppercase">Gang Dashboard</span>
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white drop-shadow-sm">
                        {gang.name}
                    </h1>
                    <p className="text-gray-400 mt-2 font-medium">ภาพรวม สถิติ และกิจกรรมล่าสุดภายในแก๊ง</p>
                </div>
                <div className="flex items-center gap-3 px-6 py-3 bg-gradient-premium rounded-2xl shadow-xl shadow-discord-primary/20">
                    <Crown className="w-6 h-6 text-white drop-shadow-md" />
                    <span className="font-black text-white uppercase tracking-widest text-sm">{gang.subscriptionTier} PLAN</span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12 relative z-10 animate-fade-in-up">
                <StatsCard
                    title="สมาชิกที่ประจำการ"
                    value={memberCount[0]?.count || 0}
                    label="Active Members"
                    icon={<Users className="w-7 h-7 text-white" />}
                    trend="+2 New"
                    trendUp={true}
                    color="blue"
                    delay="100ms"
                />
                <StatsCard
                    title="ยอดกองกลางสุทธิ"
                    value={`฿${balance.toLocaleString()}`}
                    label="Current Balance"
                    icon={<Wallet className="w-7 h-7 text-white" />}
                    trend="Real-time Sync"
                    trendUp={true}
                    color="emerald"
                    delay="200ms"
                />
                <StatsCard
                    title="กิจกรรมเช็คชื่อ"
                    value={recentSessions.length}
                    label="Recent Activities"
                    icon={<CalendarCheck className="w-7 h-7 text-white" />}
                    trend="Active Monthly"
                    trendUp={true}
                    color="purple"
                    delay="300ms"
                />
            </div>

            {/* Content Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
                {/* Recent Activities */}
                <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 backdrop-blur-sm group hover:border-white/10 transition-colors">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-discord-primary/10 rounded-2xl text-discord-primary">
                                <Clock className="w-6 h-6" />
                            </div>
                            <h3 className="font-black text-xl text-white tracking-tight">เช็คชื่อล่าสุด</h3>
                        </div>
                        <Link
                            href={`/dashboard/${gangId}/attendance`}
                            className="bg-white/5 hover:bg-white/10 text-[10px] font-black tracking-widest uppercase text-gray-400 hover:text-white px-4 py-2 rounded-xl transition-all border border-white/5"
                        >
                            ดูทั้งหมด
                        </Link>
                    </div>

                    {recentSessions.length === 0 ? (
                        <div className="text-center py-16 text-gray-500 bg-white/[0.01] rounded-[2rem] border border-dashed border-white/10">
                            ยังไม่มีข้อมูลการเช็คชื่อ
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {recentSessions.map((s, i) => (
                                <div key={s.id} className="flex items-center gap-4 p-5 bg-white/[0.03] rounded-[1.5rem] hover:bg-white/[0.06] transition-all border border-white/5 group/item">
                                    <div className={`shrink-0 w-3 h-3 rounded-full shadow-lg ${s.status === 'ACTIVE' ? 'bg-green-500 shadow-green-500/20 animate-pulse' : s.status === 'CLOSED' ? 'bg-gray-600' : 'bg-blue-500 shadow-blue-500/20'}`} />
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-white tracking-tight truncate group-hover/item:text-discord-primary transition-colors">{s.sessionName}</div>
                                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">{new Date(s.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</div>
                                    </div>
                                    <span className={`shrink-0 px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase shadow-sm ${s.status === 'CLOSED' ? 'bg-gray-500/10 text-gray-500 border border-gray-500/10' :
                                        s.status === 'ACTIVE' ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
                                            'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                        }`}>
                                        {s.status === 'CLOSED' ? 'ปิดแล้ว' : s.status === 'ACTIVE' ? 'กำลังดำเนินการ' : 'รอเริ่ม'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent Finance */}
                <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 backdrop-blur-sm group hover:border-white/10 transition-colors">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500">
                                <TrendingUp className="w-6 h-6" />
                            </div>
                            <h3 className="font-black text-xl text-white tracking-tight">ธุรกรรมล่าสุด</h3>
                        </div>
                        <Link
                            href={`/dashboard/${gangId}/finance`}
                            className="bg-white/5 hover:bg-white/10 text-[10px] font-black tracking-widest uppercase text-gray-400 hover:text-white px-4 py-2 rounded-xl transition-all border border-white/5"
                        >
                            ดูทั้งหมด
                        </Link>
                    </div>

                    {recentTransactions.length === 0 ? (
                        <div className="text-center py-16 text-gray-500 bg-white/[0.01] rounded-[2rem] border border-dashed border-white/10">
                            ยังไม่มีข้อมูลการเงิน
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {recentTransactions.map((t) => {
                                const isIncome = t.type === 'INCOME' || t.type === 'REPAYMENT';
                                return (
                                    <div key={t.id} className="flex items-center gap-4 p-5 bg-white/[0.03] rounded-[1.5rem] hover:bg-white/[0.06] transition-[background-color,border-color,transform] duration-200 border border-white/5 group/item">
                                        <div className={`shrink-0 p-2.5 rounded-xl shadow-lg ${isIncome ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-500'}`}>
                                            {isIncome ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-white tracking-tight truncate group-hover/item:text-emerald-400 transition-colors">
                                                {['LOAN', 'REPAYMENT', 'PENALTY'].includes(t.type)
                                                    ? `${(t as any).member?.name || '-'} ${t.type === 'LOAN' ? 'ยืม' : t.type === 'REPAYMENT' ? 'คืนเงิน' : 'ค่าปรับ'}`
                                                    : t.description
                                                }
                                            </div>
                                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">{new Date(t.createdAt).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short' })}</div>
                                        </div>
                                        <div className={`shrink-0 font-black text-lg tracking-tighter tabular-nums ${isIncome ? 'text-emerald-400' : 'text-red-500'}`}>
                                            {isIncome ? '+' : '-'}฿{Math.abs(t.amount).toLocaleString()}
                                        </div>
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
        blue: {
            bg: 'bg-discord-primary',
            light: 'bg-discord-primary/10',
            text: 'text-discord-primary',
            shadow: 'shadow-discord-primary/20'
        },
        emerald: {
            bg: 'bg-emerald-500',
            light: 'bg-emerald-500/10',
            text: 'text-emerald-500',
            shadow: 'shadow-emerald-500/20'
        },
        purple: {
            bg: 'bg-purple-600',
            light: 'bg-purple-600/10',
            text: 'text-purple-600',
            shadow: 'shadow-purple-600/20'
        }
    };

    const style = colorStyles[color] || colorStyles.blue;

    return (
        <div
            className="relative bg-white/[0.02] border border-white/5 p-8 rounded-[2.5rem] backdrop-blur-sm overflow-hidden group hover:border-white/10 transition-all duration-500 hover:-translate-y-1 shadow-2xl"
            style={{ animationDelay: delay }}
        >
            <div className={`absolute top-0 right-0 w-32 h-32 ${style.light} blur-2xl rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700`} />

            <div className="flex justify-between items-start mb-6 relative z-10">
                <div className={`p-4 ${style.bg} rounded-[2rem] shadow-2xl ${style.shadow} group-hover:scale-110 transition-transform duration-500`}>
                    {icon}
                </div>
                {trend && (
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${style.light} ${style.text} text-[10px] font-black tracking-widest uppercase border border-white/5`}>
                        {trendUp ? '▲' : '▼'} {trend}
                    </div>
                )}
            </div>

            <div className="relative z-10">
                <div className="text-gray-400 text-[10px] font-black tracking-[0.2em] uppercase mb-1">{title}</div>
                <div className="text-4xl font-black text-white tracking-tighter drop-shadow-md mb-1">{value}</div>
                <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{label}</div>
            </div>
        </div>
    );
}
