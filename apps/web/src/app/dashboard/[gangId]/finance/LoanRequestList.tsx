'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { Check, X, Loader2, HandCoins, Landmark, PiggyBank, Clock } from 'lucide-react';
import { toast } from 'sonner';

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
            console.error(error);
            toast.error('เกิดข้อผิดพลาด');
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl overflow-hidden shadow-sm flex flex-col">
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-400" />
                    <h3 className="font-semibold text-white tracking-wide font-heading">คำขอที่รออนุมัติ</h3>
                    <span className="bg-amber-500/10 text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full ml-2 ring-1 ring-amber-500/20">
                        {requests.length}
                    </span>
                </div>
            </div>

            <div className="p-4 sm:p-5 flex-1 overflow-auto max-h-[500px]">
                <div className="grid gap-4">
                    {requests.map((req) => (
                        <div
                            key={req.id}
                            className="bg-[#111] hover:bg-[#1a1a1a] transition-colors border border-white/5 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                        >
                            <div className="flex items-start gap-4">
                                <div className={`p-2.5 rounded-xl mt-1 shadow-sm shrink-0 ${req.type === 'LOAN' ? 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20' : req.type === 'DEPOSIT' ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20' : 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20'}`}>
                                    {req.type === 'LOAN' ? <HandCoins className="w-5 h-5" /> : req.type === 'DEPOSIT' ? <PiggyBank className="w-5 h-5" /> : <Landmark className="w-5 h-5" />}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                        <span className="font-bold text-white text-lg tracking-tight">
                                            ฿{req.amount.toLocaleString()}
                                        </span>
                                        <span className={`text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-md border ${req.type === 'LOAN'
                                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                            : req.type === 'DEPOSIT'
                                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                                : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                                            }`}>
                                            {req.type === 'LOAN' ? 'ขอยืม' : req.type === 'DEPOSIT' ? 'แจ้งนำเงินเข้า' : 'ชำระหนี้'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-zinc-400 mb-1">
                                        <img
                                            src={req.member?.discordAvatar || '/avatars/0.png'}
                                            alt={req.member?.name}
                                            className="w-5 h-5 rounded-full ring-1 ring-white/10"
                                        />
                                        <span className="text-zinc-200 font-medium truncate">{req.member?.name}</span>
                                        <span className="text-zinc-600">•</span>
                                        <span className="truncate">{req.description}</span>
                                    </div>
                                    <div className="text-xs text-zinc-500">
                                        {format(new Date(req.createdAt), 'd MMM HH:mm', { locale: th })}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 w-full md:w-auto mt-2 md:mt-0 pt-3 md:pt-0 border-t border-white/5 md:border-0">
                                <button
                                    onClick={() => handleAction(req.id, 'APPROVE')}
                                    disabled={!!processingId}
                                    className="flex-1 md:flex-none px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 hover:border-emerald-500/30 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2"
                                >
                                    {processingId === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    อนุมัติ
                                </button>
                                <button
                                    onClick={() => handleAction(req.id, 'REJECT')}
                                    disabled={!!processingId}
                                    className="flex-1 md:flex-none px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 hover:border-rose-500/30 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2"
                                >
                                    {processingId === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                                    ปฏิเสธ
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
