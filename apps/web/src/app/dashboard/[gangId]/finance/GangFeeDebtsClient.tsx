'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Coins, XCircle, RefreshCw, Info } from 'lucide-react';
import { ConfirmModal } from '@/components/ConfirmModal';
import { logClientError } from '@/lib/clientLogger';

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
        } catch (error) {
            logClientError('dashboard.finance.gang_fee_waive.failed', error, { gangId, memberId, batchId });
            toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่');
        } finally {
            setLoadingKey(null);
            setWaiveTarget(null);
        }
    };

    return (
        <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden shadow-token-sm">
            <div className="p-5 border-b border-border-subtle bg-bg-muted flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-accent-bright" />
                    <h3 className="font-bold text-fg-primary text-sm">หนี้เก็บเงินแก๊ง (ค้างชำระ)</h3>
                </div>
                <button
                    onClick={() => router.refresh()}
                    className="text-xs text-fg-tertiary hover:text-fg-primary transition-colors inline-flex items-center gap-1"
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                    รีเฟรช
                </button>
            </div>

            {grouped.length === 0 ? (
                <div className="p-8 text-center text-fg-tertiary text-sm">ไม่มีหนี้ค้าง</div>
            ) : (
                <>
                    <div className="px-5 py-3 bg-accent-subtle border-b border-border-accent flex items-start gap-2">
                        <Info className="w-4 h-4 text-accent-bright shrink-0 mt-0.5" />
                        <p className="text-[11px] text-fg-secondary">
                            สมาชิกสามารถ<span className="text-fg-primary font-medium">ชำระค่าเก็บเงินแก๊ง / ฝากเครดิต</span>เพื่อปิดยอดค้างได้ ส่วนปุ่มชำระหนี้ยืมจะไม่ตัดยอดเก็บเงินแก๊ง โดยกองกลางจะเพิ่มเมื่อมีการบันทึกรายการเงินจริง
                        </p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-[840px] w-full text-left">
                            <thead className="bg-bg-muted border-b border-border-subtle">
                                <tr>
                                    <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">รอบเก็บเงิน / สมาชิก</th>
                                    <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-center">ความคืบหน้า</th>
                                    <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-right">ยอดค้าง</th>
                                    <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-right">ดำเนินการ</th>
                                </tr>
                            </thead>
                            {grouped.map((b: any) => {
                                const headerDate = new Date(b.latestAt).toLocaleDateString('th-TH', {
                                    timeZone: 'Asia/Bangkok',
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                });

                                return (
                                    <tbody key={b.batchId} className="divide-y divide-border-subtle">
                                        <tr className="bg-bg-muted/70">
                                            <td className="px-5 py-4" colSpan={2}>
                                                <div className="min-w-0">
                                                    <div className="text-sm font-bold text-fg-primary truncate">{b.description}</div>
                                                    <div className="text-[10px] text-fg-tertiary mt-0.5">
                                                        {headerDate} • ฿{Number(b.amountPerMember).toLocaleString()}/คน
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <div className="text-sm font-black text-fg-danger tabular-nums">-฿{Number(b.totalUnpaid).toLocaleString()}</div>
                                                <div className="text-[10px] text-fg-tertiary">{b.rows.length} คนค้าง</div>
                                            </td>
                                            <td className="px-5 py-4">
                                                {/* Progress bar */}
                                                <div className="ml-auto w-44 space-y-1.5">
                                                    <div className="flex items-center justify-between text-[10px]">
                                                        <span className="text-fg-tertiary">ชำระแล้ว {b.paidCount}/{b.totalInBatch}</span>
                                                        <span className={`font-bold ${b.progressPercent === 100 ? 'text-fg-success' : b.progressPercent > 50 ? 'text-fg-warning' : 'text-fg-danger'}`}>
                                                            {b.progressPercent}%
                                                        </span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-bg-subtle rounded-token-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-token-full transition-all duration-500 ${b.progressPercent === 100 ? 'bg-status-success' : b.progressPercent > 50 ? 'bg-status-warning' : 'bg-accent'}`}
                                                            style={{ width: `${b.progressPercent}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                        {b.rows
                                            .slice()
                                            .sort((x: DebtRow, y: DebtRow) => (x.memberName || '').localeCompare(y.memberName || ''))
                                            .map((d: DebtRow) => {
                                                const key = `${d.batchId}|${d.memberId}`;
                                                const isLoading = loadingKey === key;

                                                return (
                                                    <tr key={key} className="hover:bg-bg-muted transition-colors">
                                                        <td className="px-5 py-3">
                                                            <div className="text-sm font-medium text-fg-primary truncate">{d.memberName}</div>
                                                            <div className="text-[10px] text-fg-tertiary truncate">{d.description}</div>
                                                        </td>
                                                        <td className="px-5 py-3 text-center">
                                                            <span className="inline-flex rounded-token-full border border-status-danger bg-status-danger-subtle px-2.5 py-1 text-[10px] font-bold text-fg-danger">
                                                                ค้างชำระ
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-3 text-right">
                                                            <div className="text-sm font-bold text-fg-danger tabular-nums">-฿{Number(d.amount).toLocaleString()}</div>
                                                        </td>
                                                        <td className="px-5 py-3 text-right">
                                                            <button
                                                                disabled={isLoading}
                                                                onClick={() => setWaiveTarget({ memberId: d.memberId, batchId: d.batchId, memberName: d.memberName, amount: Number(d.amount) })}
                                                                title="ยกเลิกหนี้ (คืนยอดให้สมาชิก)"
                                                                className="shrink-0 px-2.5 py-1.5 rounded-token-lg text-[10px] font-bold transition-colors inline-flex items-center gap-1 border border-border-subtle bg-bg-muted text-fg-secondary hover:bg-status-danger-subtle hover:text-fg-danger hover:border-status-danger disabled:opacity-50"
                                                            >
                                                                <XCircle className="w-3.5 h-3.5" />
                                                                {isLoading ? 'กำลังดำเนินการ...' : 'ยกเลิกหนี้'}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                    </tbody>
                                );
                            })}
                        </table>
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
                icon={<XCircle className="w-6 h-6 text-fg-danger" />}
                loading={!!loadingKey}
            />
        </div>
    );
}
