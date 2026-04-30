'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { Check, X, Loader2, HandCoins, Landmark, PiggyBank, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { logClientError } from '@/lib/clientLogger';

interface Transaction {
    id: string;
    type: string;
    amount: number;
    description: string;
    member?: {
        name: string;
        discordAvatar: string | null;
    } | null;
    createdAt: Date;
}

interface Props {
    gangId: string;
    requests: Transaction[];
}

export function LoanRequestList({ gangId, requests }: Props) {
    const router = useRouter();
    const [processingId, setProcessingId] = useState<string | null>(null);

    // Auto-refresh pending list every 15 seconds
    useEffect(() => {
        if (requests.length === 0) return;
        const interval = setInterval(() => {
            router.refresh();
        }, 15_000);
        return () => clearInterval(interval);
    }, [requests.length, router]);

    if (requests.length === 0) return null;

    const handleAction = async (transactionId: string, action: 'APPROVE' | 'REJECT') => {
        setProcessingId(transactionId);
        try {
            const res = await fetch(`/api/gangs/${gangId}/finance/${transactionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            });

            if (!res.ok) {
                const data = await res.json();
                if (data.alreadyProcessed) {
                    const statusText = data.currentStatus === 'APPROVED' ? 'อนุมัติ' : 'ปฏิเสธ';
                    toast.info(`รายการนี้ถูก${statusText}ไปแล้ว (อัปเดตรายการให้แล้ว)`);
                    router.refresh();
                    return;
                }
                toast.error(data.error || `เกิดข้อผิดพลาดในการ${action === 'APPROVE' ? 'อนุมัติ' : 'ปฏิเสธ'}คำขอ`);
                return;
            }

            toast.success(action === 'APPROVE' ? 'อนุมัติคำขอแล้ว' : 'ปฏิเสธคำขอแล้ว');
            router.refresh();
        } catch (error) {
            logClientError('dashboard.finance.request_action.failed', error, { gangId, transactionId, action });
            toast.error('เกิดข้อผิดพลาด');
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden shadow-token-sm flex flex-col">
            <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-border-subtle bg-bg-muted flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-fg-warning" />
                    <h3 className="font-bold text-sm text-fg-primary tracking-wide font-heading">คำขอที่รออนุมัติ</h3>
                    <span className="bg-status-warning-subtle text-fg-warning text-xs font-bold px-2 py-0.5 rounded-token-full ml-2 ring-1 ring-status-warning">
                        {requests.length}
                    </span>
                </div>
            </div>

            <div className="flex-1 overflow-auto max-h-[500px]">
                <div className="space-y-3 p-3 md:hidden">
                    {requests.map((req) => {
                        const isLoan = req.type === 'LOAN';
                        const isDeposit = req.type === 'DEPOSIT';
                        const label = isLoan ? 'ขอยืม' : isDeposit ? 'เก็บเงินแก๊ง/เครดิต' : 'ชำระหนี้ยืม';
                        const tone = isLoan
                            ? 'bg-status-warning-subtle border-status-warning text-fg-warning'
                            : isDeposit
                                ? 'bg-status-success-subtle border-status-success text-fg-success'
                                : 'bg-status-info-subtle border-status-info text-fg-info';

                        return (
                            <article key={req.id} className="rounded-token-2xl border border-border-subtle bg-bg-muted p-4 shadow-token-sm">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex min-w-0 items-start gap-3">
                                        <div className={`shrink-0 rounded-token-xl border p-2 ${tone}`}>
                                            {isLoan ? <HandCoins className="h-4 w-4" /> : isDeposit ? <PiggyBank className="h-4 w-4" /> : <Landmark className="h-4 w-4" />}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className={`rounded-token-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${tone}`}>
                                                    {label}
                                                </span>
                                                <span className="text-[11px] font-semibold text-fg-tertiary">
                                                    {format(new Date(req.createdAt), 'd MMM HH:mm', { locale: th })}
                                                </span>
                                            </div>
                                            <div className="mt-3 flex items-center gap-2">
                                                <img
                                                    src={req.member?.discordAvatar || '/avatars/0.png'}
                                                    alt={req.member?.name}
                                                    className="h-8 w-8 shrink-0 rounded-token-full ring-1 ring-border-subtle"
                                                />
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-black text-fg-primary">{req.member?.name}</p>
                                                    <p className="line-clamp-2 text-xs text-fg-tertiary">{req.description}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="shrink-0 font-mono text-base font-black tabular-nums text-fg-primary">
                                        ฿{req.amount.toLocaleString()}
                                    </p>
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => handleAction(req.id, 'APPROVE')}
                                        disabled={!!processingId}
                                        className="inline-flex items-center justify-center gap-1.5 rounded-token-xl border border-status-success bg-status-success-subtle px-3 py-2.5 text-xs font-bold text-fg-success transition-all hover:brightness-110 disabled:opacity-50"
                                    >
                                        {processingId === req.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                        อนุมัติ
                                    </button>
                                    <button
                                        onClick={() => handleAction(req.id, 'REJECT')}
                                        disabled={!!processingId}
                                        className="inline-flex items-center justify-center gap-1.5 rounded-token-xl border border-status-danger bg-status-danger-subtle px-3 py-2.5 text-xs font-bold text-fg-danger transition-all hover:brightness-110 disabled:opacity-50"
                                    >
                                        {processingId === req.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                                        ปฏิเสธ
                                    </button>
                                </div>
                            </article>
                        );
                    })}
                </div>

                <div className="hidden overflow-x-auto md:block">
                    <table className="min-w-[920px] w-full text-left">
                        <thead className="sticky top-0 z-10 bg-bg-muted border-b border-border-subtle">
                            <tr>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">ประเภท</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">สมาชิก / รายละเอียด</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-right">จำนวน</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary whitespace-nowrap">ส่งเมื่อ</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-right">ดำเนินการ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle">
                            {requests.map((req) => (
                                <tr key={req.id} className="hover:bg-bg-muted transition-colors">
                                    <td className="px-4 py-3 align-middle whitespace-nowrap">
                                        <div className="flex items-center gap-2.5">
                                            <div className={`p-1.5 rounded-token-lg border shadow-token-sm shrink-0 ${req.type === 'LOAN' ? 'bg-status-warning-subtle text-fg-warning border-status-warning' : req.type === 'DEPOSIT' ? 'bg-status-success-subtle text-fg-success border-status-success' : 'bg-status-info-subtle text-fg-info border-status-info'}`}>
                                                {req.type === 'LOAN' ? <HandCoins className="w-4 h-4" /> : req.type === 'DEPOSIT' ? <PiggyBank className="w-4 h-4" /> : <Landmark className="w-4 h-4" />}
                                            </div>
                                            <span className={`text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-token-md border ${req.type === 'LOAN'
                                                ? 'bg-status-warning-subtle border-status-warning text-fg-warning'
                                                : req.type === 'DEPOSIT'
                                                    ? 'bg-status-success-subtle border-status-success text-fg-success'
                                                    : 'bg-status-info-subtle border-status-info text-fg-info'
                                                }`}>
                                                {req.type === 'LOAN' ? 'ขอยืม' : req.type === 'DEPOSIT' ? 'เก็บเงินแก๊ง/เครดิต' : 'ชำระหนี้ยืม'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 align-middle">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <img
                                                src={req.member?.discordAvatar || '/avatars/0.png'}
                                                alt={req.member?.name}
                                                className="w-7 h-7 rounded-token-full ring-1 ring-border-subtle shrink-0"
                                            />
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-fg-primary truncate">{req.member?.name}</p>
                                                <p className="text-xs text-fg-tertiary truncate max-w-sm">{req.description}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 align-middle text-right whitespace-nowrap">
                                        <span className="font-mono font-bold text-sm text-fg-primary tracking-tight">
                                            ฿{req.amount.toLocaleString()}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 align-middle whitespace-nowrap">
                                        <span className="text-xs text-fg-tertiary">
                                            {format(new Date(req.createdAt), 'd MMM HH:mm', { locale: th })}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 align-middle">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleAction(req.id, 'APPROVE')}
                                                disabled={!!processingId}
                                                className="px-3 py-2 bg-status-success-subtle hover:brightness-110 text-fg-success border border-status-success rounded-token-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                                            >
                                                {processingId === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                                อนุมัติ
                                            </button>
                                            <button
                                                onClick={() => handleAction(req.id, 'REJECT')}
                                                disabled={!!processingId}
                                                className="px-3 py-2 bg-status-danger-subtle hover:brightness-110 text-fg-danger border border-status-danger rounded-token-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                                            >
                                                {processingId === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                                                ปฏิเสธ
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
