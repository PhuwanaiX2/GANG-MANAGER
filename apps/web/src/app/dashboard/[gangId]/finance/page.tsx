import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, gangs, transactions, members } from '@gang/database';
import { eq, desc, and, count, sql } from 'drizzle-orm';
import {
    Wallet,
    ArrowUpRight,
    ArrowDownLeft,
    AlertTriangle,
    History
} from 'lucide-react';

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
            columns: { balance: true }
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

    // --- Overview Data Fetching ---
    let overviewData = null;
    if (tab === 'overview') {
        const [incomeResult, expenseResult, pendingRequests] = await Promise.all([
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
            })
        ]);
        overviewData = {
            income: incomeResult[0]?.sum || 0,
            expense: expenseResult[0]?.sum || 0,
            pendingRequests
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
                <FinanceClient gangId={gangId} members={activeMembers} />
            </div>

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

                    <LoanRequestList gangId={gangId} requests={overviewData.pendingRequests} />
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
        </>
    );
}
