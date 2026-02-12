'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { Check, X, Loader2, HandCoins, Landmark } from 'lucide-react';
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
                const error = await res.json();
                toast.error(error.error || `เกิดข้อผิดพลาดในการ${action === 'APPROVE' ? 'อนุมัติ' : 'ปฏิเสธ'}คำขอ`);
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
        <div className="mb-8 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
                </span>
                คำขอที่รออนุมัติ ({requests.length})
            </h2>

            <div className="grid gap-3">
                {requests.map((req) => (
                    <div
                        key={req.id}
                        className="bg-[#151515] border border-yellow-500/20 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                    >
                        <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${req.type === 'LOAN' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                {req.type === 'LOAN' ? <HandCoins className="w-5 h-5" /> : <Landmark className="w-5 h-5" />}
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-bold text-white text-lg">
                                        ฿{req.amount.toLocaleString()}
                                    </span>
                                    <span className={`text-xs px-2 py-0.5 rounded border ${req.type === 'LOAN'
                                        ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                                        : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                                        }`}>
                                        {req.type === 'LOAN' ? 'ขอยืม' : 'ขอคืน'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                    <img
                                        src={req.member?.discordAvatar || '/avatars/0.png'}
                                        alt={req.member?.name}
                                        className="w-5 h-5 rounded-full"
                                    />
                                    <span className="text-white">{req.member?.name}</span>
                                    <span>•</span>
                                    <span>{req.description}</span>
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                    {format(new Date(req.createdAt), 'd MMM HH:mm', { locale: th })}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <button
                                onClick={() => handleAction(req.id, 'APPROVE')}
                                disabled={!!processingId}
                                className="flex-1 md:flex-none px-4 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-500 border border-green-500/20 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                {processingId === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                อนุมัติ
                            </button>
                            <button
                                onClick={() => handleAction(req.id, 'REJECT')}
                                disabled={!!processingId}
                                className="flex-1 md:flex-none px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                {processingId === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                                ปฏิเสธ
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
