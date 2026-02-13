import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, gangs, transactions, members, canAccessFeature, getTierConfig } from '@gang/database';
import { eq, desc, and, count, sql } from 'drizzle-orm';
import {
    Wallet,
    ArrowUpRight,
    ArrowDownLeft,
    AlertTriangle,
    History,
    Clock,
    Lock,
    Zap
} from 'lucide-react';
import Link from 'next/link';

import { getGangPermissions } from '@/lib/permissions';
import { TransactionTable } from './TransactionTable';
import { FinanceClient } from './FinanceClient';
import { LoanRequestList } from './LoanRequestList';
import { FinanceTabs } from './FinanceTabs';

interface Props {
    params: { gangId: string };
    searchParams: { page?: string; tab?: string };
}

export default async function FinancePage({ params, searchParams }: Props) {
    const session = await getServerSession(authOptions);
    if (!session) redirect('/');

    const { gangId } = params;
    const tab = searchParams.tab || 'overview';

    // Pagination for History Tab
    const page = Number(searchParams.page) || 1;
    const ITEMS_PER_PAGE = 20;
    const offset = (page - 1) * ITEMS_PER_PAGE;

    // Check Permissions (OWNER or TREASURER)
    const permissions = await getGangPermissions(gangId, session.user.discordId);
    if (!permissions.isOwner && !permissions.isTreasurer) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                    <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">ไม่มีสิทธิ์เข้าถึง</h1>
                <p className="text-gray-400 max-w-md">
                    เฉพาะหัวหน้าแก๊ง (Owner) หรือ เหรัญญิก (Treasurer) เท่านั้น
                    <br />ที่สามารถจัดการการเงินได้
                </p>
            </div>
        );
    }

    // Common Data
    const [gang, activeMembers] = await Promise.all([
        db.query.gangs.findFirst({
            where: eq(gangs.id, gangId),
            columns: { balance: true, subscriptionTier: true }
        }),
        db.query.members.findMany({
            where: and(
                eq(members.gangId, gangId),
                eq(members.isActive, true),
                eq(members.status, 'APPROVED')
            ),
            columns: { id: true, name: true },
            orderBy: desc(members.name),
        })
    ]);

    if (!gang) redirect('/dashboard');
    const balance = gang.balance || 0;
    const tier = gang.subscriptionTier || 'FREE';
    const hasFinance = canAccessFeature(tier, 'finance');
    const hasExportCSV = canAccessFeature(tier, 'exportCSV');
    const hasMonthlySummary = canAccessFeature(tier, 'monthlySummary');
    const tierConfig = getTierConfig(tier);

    // --- Overview Data Fetching ---
    let overviewData = null;
    if (tab === 'overview') {
        const [incomeResult, expenseResult, pendingRequests, recentApproved] = await Promise.all([
            // Calculate Total Income (Aggregated)
            db.select({ sum: sql<number>`sum(${transactions.amount})` })
                .from(transactions)
                .where(and(
                    eq(transactions.gangId, gangId),
                    eq(transactions.status, 'APPROVED'),
                    sql`${transactions.type} IN ('INCOME', 'REPAYMENT')`
                )),
            // Calculate Total Expense (Aggregated)
            db.select({ sum: sql<number>`sum(${transactions.amount})` })
                .from(transactions)
                .where(and(
                    eq(transactions.gangId, gangId),
                    eq(transactions.status, 'APPROVED'),
                    sql`${transactions.type} IN ('EXPENSE', 'LOAN')`
                )),
            // Pending Requests
            db.query.transactions.findMany({
                where: and(
                    eq(transactions.gangId, gangId),
                    eq(transactions.status, 'PENDING')
                ),
                orderBy: desc(transactions.createdAt),
                with: { member: true, createdBy: true },
            }),
            // Recent approved transactions for mini-history
            db.query.transactions.findMany({
                where: and(
                    eq(transactions.gangId, gangId),
                    eq(transactions.status, 'APPROVED')
                ),
                orderBy: desc(transactions.createdAt),
                limit: 8,
                with: { member: true },
            }),
        ]);
        overviewData = {
            income: incomeResult[0]?.sum || 0,
            expense: expenseResult[0]?.sum || 0,
            pendingRequests,
            recentApproved,
        };
    }

    // --- History Data Fetching ---
    let historyData = null;
    if (tab === 'history') {
        const [historyTransactions, totalTransactionsResult] = await Promise.all([
            db.query.transactions.findMany({
                where: and(
                    eq(transactions.gangId, gangId),
                    sql`${transactions.status} != 'PENDING'`,
                    sql`${transactions.status} != 'REJECTED'`
                ),
                orderBy: desc(transactions.createdAt),
                limit: ITEMS_PER_PAGE,
                offset: offset,
                with: { member: true, createdBy: true },
            }),
            db.select({ count: count() })
                .from(transactions)
                .where(and(
                    eq(transactions.gangId, gangId),
                    sql`${transactions.status} != 'PENDING'`,
                    sql`${transactions.status} != 'REJECTED'`
                ))
        ]);

        const totalTransactions = totalTransactionsResult[0]?.count || 0;
        historyData = {
            transactions: historyTransactions,
            totalPages: Math.ceil(totalTransactions / ITEMS_PER_PAGE),
            totalItems: totalTransactions
        };
    }

    // --- Summary Data Fetching ---
    let summaryData = null;
    if (tab === 'summary') {
        const [monthlySummaryRaw, topDebtors] = await Promise.all([
            db.select({
                month: sql<string>`strftime('%Y-%m', ${transactions.createdAt})`,
                type: transactions.type,
                total: sql<number>`COALESCE(sum(${transactions.amount}), 0)`,
                count: sql<number>`count(*)`,
            })
                .from(transactions)
                .where(and(
                    eq(transactions.gangId, gangId),
                    eq(transactions.status, 'APPROVED'),
                    sql`${transactions.createdAt} >= date('now', '-6 months')`
                ))
                .groupBy(sql`strftime('%Y-%m', ${transactions.createdAt})`, transactions.type)
                .orderBy(sql`strftime('%Y-%m', ${transactions.createdAt})`),

            db.query.members.findMany({
                where: and(
                    eq(members.gangId, gangId),
                    eq(members.isActive, true),
                    sql`${members.balance} < 0`
                ),
                orderBy: sql`${members.balance} ASC`,
                limit: 10,
                columns: { id: true, name: true, balance: true, discordAvatar: true },
            }),
        ]);

        // Reshape monthly data
        const monthlyMap = new Map<string, { month: string; income: number; expense: number; loan: number; repayment: number; penalty: number; txCount: number }>();
        for (const row of monthlySummaryRaw) {
            const month = row.month;
            if (!monthlyMap.has(month)) {
                monthlyMap.set(month, { month, income: 0, expense: 0, loan: 0, repayment: 0, penalty: 0, txCount: 0 });
            }
            const entry = monthlyMap.get(month)!;
            entry.txCount += row.count;
            switch (row.type) {
                case 'INCOME': entry.income = row.total; break;
                case 'EXPENSE': entry.expense = row.total; break;
                case 'LOAN': entry.loan = row.total; break;
                case 'REPAYMENT': entry.repayment = row.total; break;
                case 'PENALTY': entry.penalty = row.total; break;
            }
        }

        summaryData = {
            months: Array.from(monthlyMap.values()),
            topDebtors,
        };
    }

    return (
        <>
            <div className="flex items-center justify-between mb-8 animate-fade-in relative z-10">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-emerald-500 text-[10px] font-black tracking-widest uppercase">Finance Management</span>
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-2 drop-shadow-sm">การเงิน</h1>
                    <FinanceTabs />
                </div>
                <FinanceClient gangId={gangId} members={activeMembers} hasFinance={hasFinance} hasExportCSV={hasExportCSV} />
            </div>

            {/* Tier Gate Banner */}
            {!hasFinance && (
                <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-6 mb-8 flex items-start gap-4 animate-fade-in">
                    <div className="p-2 bg-yellow-500/10 rounded-xl shrink-0">
                        <Lock className="w-6 h-6 text-yellow-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-yellow-400 mb-1">ฟีเจอร์การเงินต้องใช้แพลน Trial ขึ้นไป</h3>
                        <p className="text-sm text-gray-400 mb-3">แพลนปัจจุบัน: <strong className="text-white">{tierConfig.name}</strong> — อัปเกรดเพื่อใช้งานระบบการเงิน สร้างรายการ ยืม/คืนเงิน และอื่นๆ</p>
                        <a href={`/dashboard/${gangId}/settings?tab=subscription`} className="inline-flex items-center gap-1.5 px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-bold rounded-xl transition-colors">
                            <Zap className="w-3.5 h-3.5" /> อัปเกรดแพลน
                        </a>
                    </div>
                </div>
            )}

            {/* Overview Tab Content */}
            {tab === 'overview' && overviewData && (
                <div className="animate-fade-in-up">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12 relative z-10">
                        {/* Income Card */}
                        <div className="bg-white/[0.02] border border-white/5 p-8 rounded-[2.5rem] backdrop-blur-sm relative overflow-hidden group hover:border-emerald-500/30 transition-[border-color,transform] duration-500 shadow-2xl">
                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-[opacity,transform] duration-700">
                                <ArrowUpRight className="w-24 h-24 text-emerald-500" />
                            </div>
                            <div className="text-gray-400 text-[10px] font-black tracking-[0.2em] uppercase mb-3 flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/10 shadow-lg">
                                    <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                                </div>
                                Income Total
                            </div>
                            <div className="text-4xl font-black text-emerald-400 tracking-tighter drop-shadow-md tabular-nums">
                                +฿{overviewData.income.toLocaleString()}
                            </div>
                            <div className="mt-4 text-[10px] font-bold text-gray-600 uppercase tracking-widest">รายรับสะสมทั้งหมด</div>
                        </div>

                        {/* Expense Card */}
                        <div className="bg-white/[0.02] border border-white/5 p-8 rounded-[2.5rem] backdrop-blur-sm relative overflow-hidden group hover:border-red-500/30 transition-[border-color,transform] duration-500 shadow-2xl">
                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-[opacity,transform] duration-700">
                                <ArrowDownLeft className="w-24 h-24 text-red-500" />
                            </div>
                            <div className="text-gray-400 text-[10px] font-black tracking-[0.2em] uppercase mb-3 flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/10 shadow-lg">
                                    <ArrowDownLeft className="w-4 h-4 text-red-500" />
                                </div>
                                Expense Total
                            </div>
                            <div className="text-4xl font-black text-red-500 tracking-tighter drop-shadow-md tabular-nums">
                                -฿{overviewData.expense.toLocaleString()}
                            </div>
                            <div className="mt-4 text-[10px] font-bold text-gray-600 uppercase tracking-widest">รายจ่ายสะสมทั้งหมด</div>
                        </div>

                        {/* Net Balance Card */}
                        <div className="bg-gradient-premium p-8 rounded-[2.5rem] relative overflow-hidden group shadow-[0_20px_50px_rgba(88,101,242,0.3)] hover:scale-[1.02] transition-[transform,shadow] duration-500 ring-1 ring-white/20">
                            <div className="absolute top-0 right-0 p-8 opacity-20 scale-125 group-hover:rotate-12 transition-transform duration-700">
                                <Wallet className="w-24 h-24 text-white" />
                            </div>
                            <div className="text-white/60 text-[10px] font-black tracking-[0.2em] uppercase mb-3 flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-white/20 backdrop-blur-md shadow-lg border border-white/10">
                                    <Wallet className="w-4 h-4 text-white" />
                                </div>
                                Net Balance
                            </div>
                            <div className={`text-5xl font-black tracking-tighter text-white drop-shadow-2xl tabular-nums`}>
                                ฿{balance.toLocaleString()}
                            </div>
                            <div className="mt-4 text-[10px] font-black text-white/50 uppercase tracking-widest">ยอดคงเหลือในแก๊งปัจจุบัน</div>
                        </div>
                    </div>

                    {/* Pending Requests + Recent Transactions — side by side */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <LoanRequestList gangId={gangId} requests={overviewData.pendingRequests} />

                        {/* Recent Transactions Mini-History */}
                        <div className="bg-[#151515] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
                            <div className="p-5 border-b border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-gray-400" />
                                    <h3 className="font-bold text-white text-sm">ธุรกรรมล่าสุด</h3>
                                </div>
                                <Link
                                    href={`/dashboard/${gangId}/finance?tab=history`}
                                    className="text-xs text-gray-500 hover:text-white transition-colors"
                                >
                                    ดูทั้งหมด →
                                </Link>
                            </div>
                            {overviewData.recentApproved && overviewData.recentApproved.length > 0 ? (
                                <div className="divide-y divide-white/5">
                                    {overviewData.recentApproved.map((t: any) => {
                                        const isIncome = t.type === 'INCOME' || t.type === 'REPAYMENT';
                                        return (
                                            <div key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors">
                                                <div className={`shrink-0 p-1.5 rounded-lg ${isIncome ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-500'}`}>
                                                    {isIncome ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownLeft className="w-3.5 h-3.5" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-medium text-white truncate">
                                                        {['LOAN', 'REPAYMENT', 'PENALTY'].includes(t.type)
                                                            ? `${t.member?.name || '-'} ${t.type === 'LOAN' ? 'ยืม' : t.type === 'REPAYMENT' ? 'คืนเงิน' : 'ค่าปรับ'}`
                                                            : t.description
                                                        }
                                                    </div>
                                                    <div className="text-[10px] text-gray-600">
                                                        {new Date(t.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>
                                                <span className={`shrink-0 font-bold text-xs tabular-nums ${isIncome ? 'text-emerald-400' : 'text-red-500'}`}>
                                                    {isIncome ? '+' : '-'}฿{Math.abs(t.amount).toLocaleString()}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-gray-600 text-sm">ยังไม่มีธุรกรรม</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* History Tab Content */}
            {tab === 'history' && historyData && (
                <div className="animate-fade-in-up">
                    <TransactionTable
                        transactions={historyData.transactions}
                        currentPage={page}
                        totalPages={historyData.totalPages}
                        totalItems={historyData.totalItems}
                        itemsPerPage={ITEMS_PER_PAGE}
                    />
                </div>
            )}

            {/* Summary Tab Content */}
            {tab === 'summary' && !hasMonthlySummary && (
                <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-8 text-center animate-fade-in">
                    <Lock className="w-10 h-10 text-purple-400 mx-auto mb-3" />
                    <h3 className="font-bold text-white text-lg mb-2">สรุปรายเดือนต้องใช้แพลน PRO ขึ้นไป</h3>
                    <p className="text-sm text-gray-400 mb-4">แพลนปัจจุบัน: <strong className="text-white">{tierConfig.name}</strong></p>
                    <a href={`/dashboard/${gangId}/settings?tab=subscription`} className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-purple-500 hover:bg-purple-400 text-white text-xs font-bold rounded-xl transition-colors">
                        <Zap className="w-3.5 h-3.5" /> อัปเกรดเป็น PRO
                    </a>
                </div>
            )}
            {tab === 'summary' && hasMonthlySummary && summaryData && (
                <div className="animate-fade-in-up space-y-8">
                    {/* Monthly Breakdown Table */}
                    <div className="bg-[#151515] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
                        <div className="p-6 border-b border-white/5 flex items-center gap-2">
                            <History className="w-5 h-5 text-purple-400" />
                            <h3 className="font-bold text-white">สรุปรายเดือน (6 เดือนล่าสุด)</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-black/20 text-gray-400 text-xs uppercase font-semibold tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4 text-left">เดือน</th>
                                        <th className="px-6 py-4 text-right text-emerald-400">รายรับ</th>
                                        <th className="px-6 py-4 text-right text-red-400">รายจ่าย</th>
                                        <th className="px-6 py-4 text-right text-yellow-400">ยืม</th>
                                        <th className="px-6 py-4 text-right text-blue-400">คืนเงิน</th>
                                        <th className="px-6 py-4 text-right text-orange-400">ค่าปรับ</th>
                                        <th className="px-6 py-4 text-right text-white">สุทธิ</th>
                                        <th className="px-6 py-4 text-right text-gray-400">รายการ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {summaryData.months.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                                                ยังไม่มีข้อมูลธุรกรรม
                                            </td>
                                        </tr>
                                    ) : (
                                        summaryData.months.map((m) => {
                                            const net = (m.income + m.repayment) - (m.expense + m.loan);
                                            const [year, month] = m.month.split('-');
                                            const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
                                            return (
                                                <tr key={m.month} className="hover:bg-white/[0.02] transition-colors">
                                                    <td className="px-6 py-4 font-medium text-white">{monthName}</td>
                                                    <td className="px-6 py-4 text-right font-mono text-emerald-400">+฿{m.income.toLocaleString()}</td>
                                                    <td className="px-6 py-4 text-right font-mono text-red-400">-฿{m.expense.toLocaleString()}</td>
                                                    <td className="px-6 py-4 text-right font-mono text-yellow-400">-฿{m.loan.toLocaleString()}</td>
                                                    <td className="px-6 py-4 text-right font-mono text-blue-400">+฿{m.repayment.toLocaleString()}</td>
                                                    <td className="px-6 py-4 text-right font-mono text-orange-400">฿{m.penalty.toLocaleString()}</td>
                                                    <td className="px-6 py-4 text-right font-mono font-bold">
                                                        <span className={net >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                                            {net >= 0 ? '+' : ''}฿{net.toLocaleString()}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right text-gray-500">{m.txCount}</td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Top Debtors */}
                    {summaryData.topDebtors.length > 0 && (
                        <div className="bg-[#151515] border border-red-500/10 rounded-2xl overflow-hidden shadow-xl">
                            <div className="p-6 border-b border-white/5 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-red-400" />
                                <h3 className="font-bold text-white">สมาชิกที่มีหนี้ค้าง</h3>
                            </div>
                            <div className="divide-y divide-white/5">
                                {summaryData.topDebtors.map((d, i) => (
                                    <div key={d.id} className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors">
                                        <span className="text-gray-600 font-mono text-sm w-6">#{i + 1}</span>
                                        <img
                                            src={d.discordAvatar || '/avatars/0.png'}
                                            alt={d.name}
                                            className="w-8 h-8 rounded-full border border-white/10"
                                        />
                                        <span className="font-medium text-white flex-1">{d.name}</span>
                                        <span className="font-mono font-bold text-red-400">
                                            -฿{Math.abs(d.balance).toLocaleString()}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
