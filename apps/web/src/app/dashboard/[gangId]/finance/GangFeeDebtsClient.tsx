'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Coins, XCircle, RefreshCw, Info } from 'lucide-react';
import { ConfirmModal } from '@/components/ConfirmModal';

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
    totalMembersInBatch?: Record<string, number>; // batchId -> total members in that batch
}

export function GangFeeDebtsClient({ gangId, debts, totalMembersInBatch = {} }: Props) {
    const router = useRouter();
    const [loadingKey, setLoadingKey] = useState<string | null>(null);
    const [waiveTarget, setWaiveTarget] = useState<{ memberId: string; batchId: string; memberName: string; amount: number } | null>(null);

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
            .map((b) => {
                const totalInBatch = totalMembersInBatch[b.batchId] || b.rows.length;
                const unpaidCount = b.rows.length;
                const paidCount = totalInBatch - unpaidCount;
                const progressPercent = totalInBatch > 0 ? Math.round((paidCount / totalInBatch) * 100) : 0;
                return {
                    ...b,
                    totalUnpaid: b.rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
                    totalInBatch,
                    paidCount,
                    progressPercent,
                };
            });
    }, [debts, totalMembersInBatch]);

    const executeWaive = async () => {
        if (!waiveTarget) return;
        const { memberId, batchId } = waiveTarget;
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
                toast.error(data?.error || 'ไม่สามารถยกเลิกหนี้ได้');
                return;
            }

            toast.success('ยกเลิกหนี้เรียบร้อย');
            router.refresh();
        } catch (err) {
            console.error(err);
            toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่');
        } finally {
            setLoadingKey(null);
            setWaiveTarget(null);
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
                <>
                    <div className="px-5 py-3 bg-purple-500/5 border-b border-white/5 flex items-start gap-2">
                        <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-gray-400">
                            สมาชิกสามารถ<span className="text-white font-medium">ฝากเงิน/คืนเงิน</span>เพื่อชำระหนี้ → เงินจะเข้ากองกลางเมื่อจ่ายจริง
                        </p>
                    </div>
                    <div className="divide-y divide-white/5">
                        {grouped.map((b: any) => {
                            const headerDate = new Date(b.latestAt).toLocaleDateString('th-TH', {
                                timeZone: 'Asia/Bangkok',
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                            });

                            return (
                                <div key={b.batchId}>
                                    <div className="px-5 py-4 bg-black/10">
                                        <div className="flex items-start justify-between gap-4 mb-3">
                                            <div className="min-w-0">
                                                <div className="text-sm font-bold text-white truncate">{b.description}</div>
                                                <div className="text-[10px] text-gray-600 mt-0.5">
                                                    {headerDate}
                                                </div>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <div className="text-sm font-black text-red-400 tabular-nums">-฿{Number(b.totalUnpaid).toLocaleString()}</div>
                                                <div className="text-[10px] text-gray-600">฿{Number(b.amountPerMember).toLocaleString()}/คน</div>
                                            </div>
                                        </div>
                                        {/* Progress bar */}
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between text-[10px]">
                                                <span className="text-gray-500">ชำระแล้ว {b.paidCount}/{b.totalInBatch} คน</span>
                                                <span className={`font-bold ${b.progressPercent === 100 ? 'text-emerald-400' : b.progressPercent > 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                    {b.progressPercent}%
                                                </span>
                                            </div>
                                            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${b.progressPercent === 100 ? 'bg-emerald-500' : b.progressPercent > 50 ? 'bg-yellow-500' : 'bg-purple-500'}`}
                                                    style={{ width: `${b.progressPercent}%` }}
                                                />
                                            </div>
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
                                                            onClick={() => setWaiveTarget({ memberId: d.memberId, batchId: d.batchId, memberName: d.memberName, amount: Number(d.amount) })}
                                                            title="ยกเลิกหนี้ (คืนยอดให้สมาชิก)"
                                                            className="shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors inline-flex items-center gap-1 border border-white/10 bg-white/5 text-gray-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 disabled:opacity-50"
                                                        >
                                                            <XCircle className="w-3.5 h-3.5" />
                                                            {isLoading ? 'กำลังดำเนินการ...' : 'ยกเลิกหนี้'}
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            <ConfirmModal
                isOpen={!!waiveTarget}
                onClose={() => setWaiveTarget(null)}
                onConfirm={executeWaive}
                variant="danger"
                title="ยกเลิกหนี้"
                description={waiveTarget ? `ยืนยันยกเลิกหนี้ ฿${waiveTarget.amount.toLocaleString()} ของ ${waiveTarget.memberName}? หนี้จะถูกลบและคืนยอดให้สมาชิก` : ''}
                confirmText="ยืนยันยกเลิกหนี้"
                cancelText="ไม่ใช่ ปิด"
                icon={<XCircle className="w-6 h-6 text-red-500" />}
                loading={!!loadingKey}
            />
        </div>
    );
}
