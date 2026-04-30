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
    const [expandedBatches, setExpandedBatches] = useState<Set<string>>(() => new Set());

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

    const totalUnpaidAmount = grouped.reduce((sum, batch) => sum + batch.totalUnpaid, 0);
    const totalUnpaidMembers = grouped.reduce((sum, batch) => sum + batch.rows.length, 0);

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

    const toggleBatch = (batchId: string) => {
        setExpandedBatches((current) => {
            const next = new Set(current);
            if (next.has(batchId)) {
                next.delete(batchId);
            } else {
                next.add(batchId);
            }
            return next;
        });
    };

    return (
        <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden shadow-token-sm">
            <div className="p-4 sm:p-5 border-b border-border-subtle bg-bg-muted flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-2">
                    <div className="rounded-token-xl border border-border-accent bg-accent-subtle p-2 text-accent-bright">
                        <Coins className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="font-bold text-fg-primary text-sm">คนค้างเงินแก๊ง</h3>
                        <p className="mt-0.5 text-xs text-fg-tertiary">รวมเป็นรอบเก็บเงิน เพื่อไม่ให้สมาชิก 20 คนกลายเป็น 20 แถวรกทันที</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="rounded-token-xl border border-status-danger bg-status-danger-subtle px-3 py-1.5 text-xs font-black text-fg-danger">
                        ฿{totalUnpaidAmount.toLocaleString()} ค้าง
                    </div>
                    <div className="rounded-token-xl border border-border-subtle bg-bg-subtle px-3 py-1.5 text-xs font-bold text-fg-secondary">
                        {totalUnpaidMembers.toLocaleString()} คน
                    </div>
                    <button
                        onClick={() => router.refresh()}
                        className="text-xs text-fg-tertiary hover:text-fg-primary transition-colors inline-flex items-center gap-1 rounded-token-xl border border-border-subtle bg-bg-subtle px-3 py-1.5"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        รีเฟรช
                    </button>
                </div>
            </div>

            {grouped.length === 0 ? (
                <div className="p-8 text-center text-fg-tertiary text-sm">ไม่มีหนี้ค้าง</div>
            ) : (
                <>
                    <details className="bg-accent-subtle border-b border-border-accent">
                        <summary className="flex cursor-pointer list-none items-start gap-2 px-5 py-3 [&::-webkit-details-marker]:hidden">
                        <Info className="w-4 h-4 text-accent-bright shrink-0 mt-0.5" />
                        <p className="text-[11px] text-fg-secondary flex-1">
                            Tip: เก็บเงินแก๊งเป็นยอดค้างแยกจากหนี้ยืม กดเปิดเพื่อดูวิธีอ่านยอด
                        </p>
                    </summary>
                        <p className="px-5 pb-3 pl-11 text-[11px] text-fg-secondary">
                            สมาชิกสามารถ<span className="text-fg-primary font-medium">ชำระค่าเก็บเงินแก๊ง / ฝากเครดิต</span>เพื่อปิดยอดค้างได้ ส่วนปุ่มชำระหนี้ยืมจะไม่ตัดยอดเก็บเงินแก๊ง โดยกองกลางจะเพิ่มเมื่อมีการบันทึกรายการเงินจริง
                        </p>
                    </details>
                    <div className="space-y-3 p-3 md:hidden">
                        {grouped.map((b: any) => {
                            const headerDate = new Date(b.latestAt).toLocaleDateString('th-TH', {
                                timeZone: 'Asia/Bangkok',
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                            });
                            const expanded = expandedBatches.has(b.batchId);
                            const sortedRows = b.rows
                                .slice()
                                .sort((x: DebtRow, y: DebtRow) => (x.memberName || '').localeCompare(y.memberName || ''));
                            const visibleRows = expanded ? sortedRows : sortedRows.slice(0, 4);
                            const hiddenCount = Math.max(0, sortedRows.length - visibleRows.length);

                            return (
                                <section key={b.batchId} className="overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle shadow-token-sm">
                                    <div className="border-b border-border-subtle bg-bg-muted p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <h4 className="line-clamp-2 text-sm font-black text-fg-primary">{b.description}</h4>
                                                <p className="mt-1 text-[11px] font-semibold text-fg-tertiary">
                                                    {headerDate} • ฿{Number(b.amountPerMember).toLocaleString()}/คน
                                                </p>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <p className="font-mono text-base font-black tabular-nums text-fg-danger">
                                                    -฿{Number(b.totalUnpaid).toLocaleString()}
                                                </p>
                                                <p className="text-[10px] font-semibold text-fg-tertiary">{b.rows.length} คนค้าง</p>
                                            </div>
                                        </div>

                                        <div className="mt-3 space-y-1.5">
                                            <div className="flex items-center justify-between text-[10px] font-semibold">
                                                <span className="text-fg-tertiary">ชำระแล้ว {b.paidCount}/{b.totalInBatch}</span>
                                                <span className={b.progressPercent === 100 ? 'text-fg-success' : b.progressPercent > 50 ? 'text-fg-warning' : 'text-fg-danger'}>
                                                    {b.progressPercent}%
                                                </span>
                                            </div>
                                            <div className="h-1.5 overflow-hidden rounded-token-full bg-bg-subtle">
                                                <div
                                                    className={`h-full rounded-token-full transition-all duration-500 ${b.progressPercent === 100 ? 'bg-status-success' : b.progressPercent > 50 ? 'bg-status-warning' : 'bg-accent'}`}
                                                    style={{ width: `${b.progressPercent}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="divide-y divide-border-subtle">
                                        {visibleRows.map((d: DebtRow) => {
                                            const key = `${d.batchId}|${d.memberId}`;
                                            const isLoading = loadingKey === key;

                                            return (
                                                <div key={key} className="flex items-center justify-between gap-3 p-4">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-bold text-fg-primary">{d.memberName}</p>
                                                        <p className="mt-1 line-clamp-1 text-[11px] text-fg-tertiary">{d.description}</p>
                                                    </div>
                                                    <div className="shrink-0 text-right">
                                                        <p className="font-mono text-sm font-black tabular-nums text-fg-danger">
                                                            -฿{Number(d.amount).toLocaleString()}
                                                        </p>
                                                        <button
                                                            disabled={isLoading}
                                                            onClick={() => setWaiveTarget({ memberId: d.memberId, batchId: d.batchId, memberName: d.memberName, amount: Number(d.amount) })}
                                                            title="ยกเลิกหนี้ (คืนยอดให้สมาชิก)"
                                                            className="mt-2 inline-flex items-center gap-1 rounded-token-lg border border-border-subtle bg-bg-muted px-2.5 py-1.5 text-[10px] font-bold text-fg-secondary transition-colors hover:border-status-danger hover:bg-status-danger-subtle hover:text-fg-danger disabled:opacity-50"
                                                        >
                                                            <XCircle className="h-3.5 w-3.5" />
                                                            {isLoading ? 'กำลังทำ...' : 'ยกเลิก'}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {(hiddenCount > 0 || (expanded && sortedRows.length > 4)) && (
                                        <div className="border-t border-border-subtle bg-bg-muted p-3 text-center">
                                            <button
                                                type="button"
                                                onClick={() => toggleBatch(b.batchId)}
                                                className="inline-flex items-center justify-center rounded-token-full border border-border-subtle bg-bg-subtle px-3 py-1.5 text-[11px] font-bold text-fg-secondary transition-colors hover:border-border-strong hover:text-fg-primary"
                                            >
                                                {expanded ? 'ย่อรายการคนค้าง' : `แสดงคนค้างเพิ่มอีก ${hiddenCount} คน`}
                                            </button>
                                        </div>
                                    )}
                                </section>
                            );
                        })}
                    </div>

                    <div className="hidden overflow-x-auto md:block">
                        <table className="min-w-[720px] w-full text-left">
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

                                const expanded = expandedBatches.has(b.batchId);
                                const sortedRows = b.rows
                                    .slice()
                                    .sort((x: DebtRow, y: DebtRow) => (x.memberName || '').localeCompare(y.memberName || ''));
                                const visibleRows = expanded ? sortedRows : sortedRows.slice(0, 5);
                                const hiddenCount = Math.max(0, sortedRows.length - visibleRows.length);

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
                                        {visibleRows
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
                                        {hiddenCount > 0 && (
                                            <tr>
                                                <td colSpan={4} className="px-5 py-3 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleBatch(b.batchId)}
                                                        className="inline-flex items-center justify-center rounded-token-full border border-border-subtle bg-bg-muted px-3 py-1.5 text-[11px] font-bold text-fg-secondary transition-colors hover:border-border-strong hover:text-fg-primary"
                                                    >
                                                        แสดงคนค้างเพิ่มอีก {hiddenCount} คน
                                                    </button>
                                                </td>
                                            </tr>
                                        )}
                                        {expanded && sortedRows.length > 5 && (
                                            <tr>
                                                <td colSpan={4} className="px-5 py-3 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleBatch(b.batchId)}
                                                        className="inline-flex items-center justify-center rounded-token-full border border-border-subtle bg-bg-muted px-3 py-1.5 text-[11px] font-bold text-fg-tertiary transition-colors hover:border-border-strong hover:text-fg-primary"
                                                    >
                                                        ย่อรายการคนค้าง
                                                    </button>
                                                </td>
                                            </tr>
                                        )}
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
