'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Coins, X, Users, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { ModalLayer } from '@/components/ui';
import { logClientError } from '@/lib/clientLogger';

interface Props {
    gangId: string;
    isOpen: boolean;
    onClose: () => void;
    members: { id: string; name: string }[];
}

type TargetMode = 'ALL' | 'SELECTED';
type CollectionType = 'GANG_FEE' | 'FINE';
type FineAmountMode = 'PER_MEMBER' | 'SPLIT_TOTAL';

export function CreateGangFeeModal({ gangId, isOpen, onClose, members }: Props) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [targetMode, setTargetMode] = useState<TargetMode>('ALL');
    const [collectionType, setCollectionType] = useState<CollectionType>('GANG_FEE');
    const [fineAmountMode, setFineAmountMode] = useState<FineAmountMode>('PER_MEMBER');
    const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());

    const toggleMember = (id: string) => {
        setSelectedMemberIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAll = () => setSelectedMemberIds(new Set(members.map(m => m.id)));
    const deselectAll = () => setSelectedMemberIds(new Set());

    const targetCount = targetMode === 'ALL' ? members.length : selectedMemberIds.size;
    const rawAmount = parseInt(amount, 10) || 0;
    const amountPerMember = collectionType === 'FINE' && fineAmountMode === 'SPLIT_TOTAL' && targetCount > 0
        ? rawAmount / targetCount
        : rawAmount;
    const isSplitAmountValid = collectionType !== 'FINE' || fineAmountMode !== 'SPLIT_TOTAL' || (targetCount > 0 && rawAmount % targetCount === 0);
    const totalAmount = amountPerMember * targetCount;
    const formatMoney = (value: number) => `฿${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    const summaryAmountText = collectionType === 'FINE' && fineAmountMode === 'SPLIT_TOTAL'
        ? `${formatMoney(rawAmount)} รวม / ${targetCount} คน = ${formatMoney(amountPerMember)} ต่อคน`
        : `${formatMoney(amountPerMember)} × ${targetCount} คน = ${formatMoney(totalAmount)}`;

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || !description) return;
        if (targetMode === 'SELECTED' && selectedMemberIds.size === 0) {
            toast.error('กรุณาเลือกสมาชิกอย่างน้อย 1 คน');
            return;
        }

        if (!Number.isInteger(amountPerMember) || !isSplitAmountValid) {
            toast.error('ยอดรวมต้องหารจำนวนสมาชิกลงตัว');
            return;
        }

        setIsSubmitting(true);
        try {
            const body: any = {
                amount: amountPerMember,
                description,
                collectionType,
            };
            if (targetMode === 'SELECTED') {
                body.memberIds = Array.from(selectedMemberIds);
            }

            const res = await fetch(`/api/gangs/${gangId}/finance/gang-fee`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const error = await res.json();
                toast.error(error.error || 'ไม่สามารถสร้างรายการได้');
                return;
            }

            const data = await res.json();
            toast.success(`เรียกเก็บเงินแก๊งสำเร็จ ${data.count || 0} คน`);
            router.refresh();
            onClose();
            // Reset
            setAmount('');
            setDescription('');
            setTargetMode('ALL');
            setCollectionType('GANG_FEE');
            setFineAmountMode('PER_MEMBER');
            setSelectedMemberIds(new Set());
        } catch (error) {
            logClientError('dashboard.finance.collection_create.failed', error, { gangId, collectionType });
            toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <ModalLayer onClose={isSubmitting ? undefined : onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Create gang collection"
                data-finance-collection-modal
                className="flex max-h-[calc(100dvh-1rem)] w-full max-w-lg flex-col overflow-hidden rounded-token-xl border border-border-subtle bg-bg-subtle p-4 shadow-token-lg animate-in zoom-in-95 duration-200 sm:p-5"
            >

                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="min-w-0 flex items-start gap-2.5">
                        <div className="mt-0.5 h-8 w-8 shrink-0 flex items-center justify-center bg-accent-subtle rounded-token-lg">
                            <Coins className="w-4 h-4 text-accent-bright" />

                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-fg-primary text-base">เก็บเงินแก๊ง</h3>
                            <p className="text-[11px] text-fg-tertiary">ระบบจะตั้งยอดค้างชำระให้สมาชิก • กองกลางจะเพิ่มเมื่อชำระจริงเท่านั้น</p>

                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="h-11 w-11 shrink-0 flex items-center justify-center hover:bg-bg-muted rounded-token-lg text-fg-secondary hover:text-fg-primary transition-colors"

                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3 flex-1 min-h-0 overflow-y-auto pr-0.5">
                    <div className="grid grid-cols-2 gap-1.5">
                        <button
                            type="button"
                            onClick={() => {
                                setCollectionType('GANG_FEE');
                                setFineAmountMode('PER_MEMBER');
                            }}
                            aria-pressed={collectionType === 'GANG_FEE'}
                            className={`min-h-11 px-3 py-2 rounded-token-lg border text-xs font-semibold transition-colors ${collectionType === 'GANG_FEE'
                                ? 'bg-accent-subtle border-accent text-accent-bright'
                                : 'bg-bg-muted border-border-subtle text-fg-secondary hover:bg-bg-raised'
                                }`}
                        >
                            เก็บเงินแก๊ง
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setCollectionType('FINE');
                                setTargetMode('SELECTED');
                            }}
                            aria-pressed={collectionType === 'FINE'}
                            className={`min-h-11 px-3 py-2 rounded-token-lg border text-xs font-semibold transition-colors ${collectionType === 'FINE'
                                ? 'bg-status-warning-subtle border-status-warning text-fg-warning'
                                : 'bg-bg-muted border-border-subtle text-fg-secondary hover:bg-bg-raised'
                                }`}
                        >
                            ค่าปรับสมาชิก
                        </button>
                    </div>

                    {collectionType === 'FINE' && (
                        <div className="grid grid-cols-2 gap-1.5">
                            <button
                                type="button"
                                onClick={() => setFineAmountMode('PER_MEMBER')}
                                aria-pressed={fineAmountMode === 'PER_MEMBER'}
                                className={`min-h-11 px-3 py-2 rounded-token-lg border text-xs font-semibold transition-colors ${fineAmountMode === 'PER_MEMBER'
                                    ? 'bg-status-warning-subtle border-status-warning/60 text-fg-warning'
                                    : 'bg-bg-muted border-border-subtle text-fg-tertiary hover:bg-bg-raised'
                                    }`}
                            >
                                ปรับคนละเท่ากัน
                            </button>
                            <button
                                type="button"
                                onClick={() => setFineAmountMode('SPLIT_TOTAL')}
                                aria-pressed={fineAmountMode === 'SPLIT_TOTAL'}
                                className={`min-h-11 px-3 py-2 rounded-token-lg border text-xs font-semibold transition-colors ${fineAmountMode === 'SPLIT_TOTAL'
                                    ? 'bg-status-warning-subtle border-status-warning/60 text-fg-warning'
                                    : 'bg-bg-muted border-border-subtle text-fg-tertiary hover:bg-bg-raised'
                                    }`}
                            >
                                หารยอดรวม
                            </button>
                        </div>
                    )}

                    {/* Amount */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-fg-secondary">
                            {collectionType === 'FINE' && fineAmountMode === 'SPLIT_TOTAL' ? 'ยอดรวมค่าปรับ' : 'จำนวนเงิน/คน'}
                        </label>
                        <input
                            type="number"
                            required
                            min="1"
                            step="1"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className={`w-full min-h-11 bg-bg-muted border rounded-token-lg px-3 py-2 text-fg-primary text-base font-semibold placeholder:text-fg-tertiary focus:outline-none ${parseFloat(amount) > 100000000 ? 'border-status-danger/50 focus:border-status-danger' : 'border-border-subtle focus:border-accent/50'}`}

                            placeholder="0"
                        />
                        {parseFloat(amount) > 100000000 && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-status-danger-subtle border border-status-danger/20 rounded-token-lg">
                                <span className="text-fg-danger text-xs font-bold">⚠ ยอดเกิน 100,000,000</span>

                            </div>
                        )}
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-fg-secondary">รายละเอียด</label>

                        <input
                            type="text"
                            required
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full min-h-11 bg-bg-muted border border-border-subtle rounded-token-lg px-3 py-2 text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:border-accent/50"

                            placeholder="เช่น ค่าแก๊งเดือน มี.ค."
                        />
                    </div>

                    {/* Target Mode */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-fg-secondary">เก็บจากใคร</label>

                        <div className="grid grid-cols-2 gap-1.5">
                            <button
                                type="button"
                                onClick={() => setTargetMode('ALL')}
                                aria-pressed={targetMode === 'ALL'}
                                className={`min-h-11 px-3 py-2 rounded-token-lg border flex items-center justify-center gap-2 transition-colors text-xs font-semibold ${targetMode === 'ALL'
                                    ? 'bg-accent-subtle border-accent text-accent-bright'
                                    : 'bg-bg-muted border-border-subtle text-fg-secondary hover:bg-bg-raised'
                                    }`}
                            >
                                <Users className="w-4 h-4" />
                                ทุกคน ({members.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setTargetMode('SELECTED')}
                                aria-pressed={targetMode === 'SELECTED'}
                                className={`min-h-11 px-3 py-2 rounded-token-lg border flex items-center justify-center gap-2 transition-colors text-xs font-semibold ${targetMode === 'SELECTED'
                                    ? 'bg-accent-subtle border-accent text-accent-bright'
                                    : 'bg-bg-muted border-border-subtle text-fg-secondary hover:bg-bg-raised'
                                    }`}
                            >
                                <UserCheck className="w-4 h-4" />
                                เลือกเฉพาะ
                            </button>
                        </div>
                    </div>

                    {/* Member Selection */}
                    {targetMode === 'SELECTED' && (
                        <div className="space-y-1.5 flex flex-col min-h-0">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-medium text-fg-secondary">เลือกสมาชิก ({selectedMemberIds.size}/{members.length})</label>

                                <div className="flex gap-1.5">
                                    <button type="button" onClick={selectAll} className="min-h-8 px-2 text-[10px] font-medium text-accent-bright hover:opacity-90">เลือกทั้งหมด</button>
                                    <button type="button" onClick={deselectAll} className="min-h-8 px-2 text-[10px] text-fg-tertiary hover:text-fg-secondary font-medium">ล้าง</button>

                                </div>
                            </div>
                            <div className="overflow-y-auto max-h-[156px] border border-border-subtle rounded-token-lg divide-y divide-border-subtle">

                                {members.map(m => (
                                    <label key={m.id} className="min-h-11 flex items-center gap-3 px-3 py-2 hover:bg-bg-muted cursor-pointer transition-colors">

                                        <input
                                            type="checkbox"
                                            checked={selectedMemberIds.has(m.id)}
                                            onChange={() => toggleMember(m.id)}
                                            className="w-4 h-4 rounded-token-sm border-border-subtle bg-bg-muted text-accent focus:ring-accent/50 focus:ring-offset-0"

                                        />
                                        <span className="text-sm text-fg-primary truncate">{m.name}</span>

                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Summary */}
                    {parseInt(amount, 10) > 0 && targetCount > 0 && (
                        <div className="bg-accent-subtle border border-accent/20 rounded-token-lg px-3 py-2.5">

                            <div className="flex justify-between items-center text-xs gap-3">
                                <span className="text-fg-secondary">สรุปยอดค้างที่จะถูกสร้าง</span>
                                <span className="text-accent-bright font-bold text-right tabular-nums">

                                    {summaryAmountText}
                                </span>
                            </div>
                            <p className="text-[11px] text-fg-tertiary mt-2">ยอดนี้ยังไม่เข้ากองกลางทันที จนกว่าสมาชิกจะชำระและมีการบันทึกรายการเงินจริง</p>

                        </div>
                    )}

                    {/* Actions */}
                    <div className="sticky bottom-0 -mx-4 sm:-mx-5 px-4 sm:px-5 pt-3 pb-1 bg-bg-subtle border-t border-border-subtle grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="min-h-11 px-4 py-2 bg-bg-muted hover:bg-bg-raised text-fg-primary rounded-token-lg text-sm font-medium transition-colors disabled:opacity-60"

                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || (targetMode === 'SELECTED' && selectedMemberIds.size === 0)}
                            className="min-h-11 bg-accent text-fg-inverse px-4 py-2 rounded-token-lg font-semibold hover:bg-accent-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"

                        >
                            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                            เรียกเก็บ
                        </button>
                    </div>
                </form>
            </div>
        </ModalLayer>
    );
}
