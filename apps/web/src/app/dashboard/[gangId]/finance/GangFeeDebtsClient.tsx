'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Coins, CheckCircle2, RefreshCw } from 'lucide-react';

type DebtRow = {
    memberId: string;
    memberName: string;
    batchId: string;
    description: string;
    amount: number;
    createdAt: string;
};

interface Props {
    gangId: string;
    debts: DebtRow[];
}

export function GangFeeDebtsClient({ gangId, debts }: Props) {
    const router = useRouter();
    const [loadingKey, setLoadingKey] = useState<string | null>(null);

    const grouped = useMemo(() => {
        const batches = new Map<
            string,
            {
                batchId: string;
                description: string;
                amountPerMember: number;
                latestAt: number;
                rows: DebtRow[];
            }
        >();

        for (const d of debts) {
            const key = d.batchId || 'unknown';
            const at = new Date(d.createdAt).getTime();
            const existing = batches.get(key);
            if (!existing) {
                batches.set(key, {
                    batchId: key,
                    description: d.description,
                    amountPerMember: Number(d.amount) || 0,
                    latestAt: at,
                    rows: [d],
                });
            } else {
                existing.rows.push(d);
                existing.latestAt = Math.max(existing.latestAt, at);
            }
        }

        return Array.from(batches.values())
            .sort((a, b) => b.latestAt - a.latestAt)
            .map((b) => ({
                ...b,
                totalUnpaid: b.rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
            }));
    }, [debts]);

    const handleSettle = async (memberId: string, batchId: string) => {
        const key = `${batchId}|${memberId}`;
        setLoadingKey(key);
        try {
            const res = await fetch(`/api/gangs/${gangId}/finance/gang-fee/settle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memberId, batchId }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast.error(data?.error || 'ไม่สามารถบันทึกการชำระได้');
                return;
            }

            toast.success('บันทึกการชำระเรียบร้อย');
            router.refresh();
        } catch (err) {
            console.error(err);
            toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่');
        } finally {
            setLoadingKey(null);
        }
    };

    return (
        <div className="bg-[#151515] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-purple-400" />
                    <h3 className="font-bold text-white text-sm">หนี้เก็บเงินแก๊ง (ค้างชำระ)</h3>
                </div>
                <button
                    onClick={() => router.refresh()}
                    className="text-xs text-gray-500 hover:text-white transition-colors inline-flex items-center gap-1"
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                    รีเฟรช
                </button>
            </div>

            {grouped.length === 0 ? (
                <div className="p-8 text-center text-gray-600 text-sm">ไม่มีหนี้ค้าง</div>
            ) : (
                <div className="divide-y divide-white/5">
                    {grouped.map((b: any) => {
                        const headerDate = new Date(b.latestAt).toLocaleDateString('th-TH', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                        });

                        return (
                            <div key={b.batchId}>
                                <div className="px-5 py-4 flex items-start justify-between gap-4 bg-black/10">
                                    <div className="min-w-0">
                                        <div className="text-sm font-bold text-white truncate">{b.description}</div>
                                        <div className="text-[10px] text-gray-600 mt-0.5">
                                            {headerDate} · ค้าง {b.rows.length} คน
                                        </div>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <div className="text-sm font-black text-red-400 tabular-nums">-฿{Number(b.totalUnpaid).toLocaleString()}</div>
                                        <div className="text-[10px] text-gray-600">฿{Number(b.amountPerMember).toLocaleString()}/คน</div>
                                    </div>
                                </div>

                                <div className="divide-y divide-white/5">
                                    {b.rows
                                        .slice()
                                        .sort((x: DebtRow, y: DebtRow) => (x.memberName || '').localeCompare(y.memberName || ''))
                                        .map((d: DebtRow) => {
                                            const key = `${d.batchId}|${d.memberId}`;
                                            const isLoading = loadingKey === key;

                                            return (
                                                <div key={key} className="flex items-center gap-3 px-5 py-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-medium text-white truncate">{d.memberName}</div>
                                                    </div>
                                                    <div className="shrink-0 text-right">
                                                        <div className="text-sm font-bold text-red-400 tabular-nums">-฿{Number(d.amount).toLocaleString()}</div>
                                                    </div>
                                                    <button
                                                        disabled={isLoading}
                                                        onClick={() => handleSettle(d.memberId, d.batchId)}
                                                        className="shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5 border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-50"
                                                    >
                                                        <CheckCircle2 className="w-4 h-4" />
                                                        {isLoading ? 'กำลังบันทึก...' : 'บันทึกว่าจ่ายแล้ว'}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
