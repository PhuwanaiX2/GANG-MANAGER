'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowUpCircle, ArrowDownCircle, HandCoins, Landmark, X } from 'lucide-react';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';

interface Props {
    gangId: string;
    isOpen: boolean;
    onClose: () => void;
    members: { id: string; name: string }[];
}

type TransactionType = 'INCOME' | 'EXPENSE' | 'LOAN' | 'REPAYMENT' | 'DEPOSIT';

export function CreateTransactionModal({ gangId, isOpen, onClose, members }: Props) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [type, setType] = useState<TransactionType>('INCOME');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [memberId, setMemberId] = useState('');

    const typeHelpText: Record<TransactionType, string> = {
        INCOME: 'ใช้เมื่อมีรายรับเข้ากองกลางโดยตรง เช่น ขายของหรือรับเงินจากกิจกรรม',
        EXPENSE: 'ใช้เมื่อจ่ายเงินออกจากกองกลางโดยตรง',
        LOAN: 'กองกลางจะลดลง และสมาชิกจะมียอดค้างชำระเพิ่มขึ้น',
        REPAYMENT: 'ใช้ชำระเฉพาะหนี้ยืมเท่านั้น ไม่ตัดยอดค้างเก็บเงินแก๊ง',
        DEPOSIT: 'ใช้ชำระค่าเก็บเงินแก๊งที่ค้างอยู่ หรือฝากเครดิต/สำรองจ่ายแทนแก๊ง',
    };

    const setTransactionType = (nextType: TransactionType) => {
        setType(nextType);
        if (nextType === 'INCOME' || nextType === 'EXPENSE') {
            setMemberId('');
        }
    };

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount) return;
        if (type === 'INCOME' || type === 'EXPENSE') {
            if (!description) return;
        }
        if ((type === 'LOAN' || type === 'REPAYMENT' || type === 'DEPOSIT') && !memberId) return;

        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/gangs/${gangId}/finance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type,
                    amount: parseInt(amount, 10),
                    description: type === 'INCOME' || type === 'EXPENSE' ? description : undefined,
                    memberId:
                        type === 'LOAN' || type === 'REPAYMENT' || type === 'DEPOSIT'
                            ? (memberId || undefined)
                            : undefined,
                }),
            });

            if (!res.ok) {
                const error = await res.json();
                toast.error(error.error || 'ไม่สามารถสร้างรายการได้');
                return;
            }

            toast.success('บันทึกรายการเรียบร้อย');
            router.refresh();
            onClose();
            // Reset form
            setAmount('');
            setDescription('');
            setMemberId('');
            setType('INCOME');
        } catch (error) {
            console.error(error);
            toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่');
        } finally {
            setIsSubmitting(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[140] flex items-end justify-center p-2 bg-bg-overlay backdrop-blur-md animate-in fade-in duration-200 sm:items-center sm:p-4">
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Create finance transaction"
                data-finance-transaction-modal
                className="max-h-[calc(100dvh-1rem)] w-full max-w-lg overflow-y-auto rounded-token-xl border border-border-subtle bg-bg-subtle p-4 shadow-token-lg animate-in zoom-in-95 duration-200 sm:p-5"
            >

                <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="min-w-0">
                        <h3 className="font-bold text-fg-primary text-base">บันทึกรายการการเงิน</h3>
                        <p className="text-[11px] text-fg-tertiary mt-1">เลือกรูปแบบรายการให้ตรงกับการเคลื่อนไหวเงินจริงของกองกลาง</p>

                    </div>
                    <button
                        onClick={onClose}
                        className="h-11 w-11 shrink-0 flex items-center justify-center hover:bg-bg-muted rounded-token-lg text-fg-secondary hover:text-fg-primary transition-colors"

                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                    {/* Type Selection */}
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        <button
                            type="button"
                            onClick={() => setTransactionType('INCOME')}
                            aria-pressed={type === 'INCOME'}
                            className={`min-h-11 rounded-token-lg border px-3 py-2 flex items-center justify-start gap-2 text-left transition-colors ${type === 'INCOME'
                                ? 'bg-status-success-subtle border-status-success text-fg-success'
                                : 'bg-bg-muted border-border-subtle text-fg-secondary hover:bg-bg-raised'

                                }`}
                        >
                            <ArrowUpCircle className="w-4 h-4 shrink-0" />
                            <span className="text-xs font-semibold leading-tight">รายรับเข้ากองกลาง</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setTransactionType('EXPENSE')}
                            aria-pressed={type === 'EXPENSE'}
                            className={`min-h-11 rounded-token-lg border px-3 py-2 flex items-center justify-start gap-2 text-left transition-colors ${type === 'EXPENSE'
                                ? 'bg-status-danger-subtle border-status-danger text-fg-danger'
                                : 'bg-bg-muted border-border-subtle text-fg-secondary hover:bg-bg-raised'

                                }`}
                        >
                            <ArrowDownCircle className="w-4 h-4 shrink-0" />
                            <span className="text-xs font-semibold leading-tight">รายจ่ายจากกองกลาง</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setTransactionType('LOAN')}
                            aria-pressed={type === 'LOAN'}
                            className={`min-h-11 rounded-token-lg border px-3 py-2 flex items-center justify-start gap-2 text-left transition-colors ${type === 'LOAN'
                                ? 'bg-status-warning-subtle border-status-warning text-fg-warning'
                                : 'bg-bg-muted border-border-subtle text-fg-secondary hover:bg-bg-raised'

                                }`}
                        >
                            <HandCoins className="w-4 h-4 shrink-0" />
                            <span className="text-xs font-semibold leading-tight">สมาชิกยืมจากกองกลาง</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setTransactionType('REPAYMENT')}
                            aria-pressed={type === 'REPAYMENT'}
                            className={`min-h-11 rounded-token-lg border px-3 py-2 flex items-center justify-start gap-2 text-left transition-colors ${type === 'REPAYMENT'
                                ? 'bg-status-info-subtle border-status-info text-fg-info'
                                : 'bg-bg-muted border-border-subtle text-fg-secondary hover:bg-bg-raised'

                                }`}
                        >
                            <Landmark className="w-4 h-4 shrink-0" />
                            <span className="text-xs font-semibold leading-tight">ชำระหนี้ยืม</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setTransactionType('DEPOSIT')}
                            aria-pressed={type === 'DEPOSIT'}
                            className={`min-h-11 rounded-token-lg border px-3 py-2 flex items-center justify-start gap-2 text-left transition-colors sm:col-span-2 ${type === 'DEPOSIT'
                                ? 'bg-status-success-subtle border-status-success text-fg-success'
                                : 'bg-bg-muted border-border-subtle text-fg-secondary hover:bg-bg-raised'

                                }`}
                        >
                            <Landmark className="w-4 h-4 shrink-0" />
                            <span className="text-xs font-semibold leading-tight">เก็บเงินแก๊ง/เครดิต</span>
                        </button>

                    </div>

                    <div className="rounded-token-lg border border-border-subtle bg-bg-muted px-3 py-2">
                        <p className="text-[11px] text-fg-secondary leading-relaxed">{typeHelpText[type]}</p>

                    </div>

                    {/* Amount */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-fg-secondary">จำนวนเงิน</label>

                        <input
                            type="number"
                            required
                            min="1"
                            step="1"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className={`w-full min-h-11 bg-bg-muted border rounded-token-lg px-3 py-2 text-fg-primary placeholder:text-fg-tertiary focus:outline-none ${parseFloat(amount) > 100000000 ? 'border-status-danger/50 focus:border-status-danger' : 'border-border-subtle focus:border-border-strong'}`}

                            placeholder="0"
                        />
                        {parseFloat(amount) > 100000000 && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-status-danger-subtle border border-status-danger/20 rounded-token-lg">
                                <span className="text-fg-danger text-xs font-bold">⚠ ยอดเกิน 100,000,000 — ระบบรองรับสูงสุด 100M ต่อรายการ</span>

                            </div>
                        )}
                    </div>

                    {/* Description */}
                    {(type === 'INCOME' || type === 'EXPENSE') && (
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-fg-secondary">รายละเอียด</label>

                            <input
                                type="text"
                                required
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full min-h-11 bg-bg-muted border border-border-subtle rounded-token-lg px-3 py-2 text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:border-border-strong"

                                placeholder='เช่น ขายของได้, ค่าอุปกรณ์, ค่าน้ำมัน'
                            />
                        </div>
                    )}

                    {/* Member Selection (Conditional) */}
                    {(type === 'LOAN' || type === 'REPAYMENT' || type === 'DEPOSIT') && (
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-fg-secondary">สมาชิกที่เกี่ยวข้อง</label>

                            <select
                                required
                                value={memberId}
                                onChange={(e) => setMemberId(e.target.value)}
                                className="w-full min-h-11 bg-bg-muted border border-border-subtle rounded-token-lg px-3 py-2 text-fg-primary focus:outline-none focus:border-border-strong"

                            >
                                <option value="">เลือกสมาชิก...</option>
                                {members.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-2">
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
                            disabled={isSubmitting}
                            className="min-h-11 bg-accent text-fg-inverse px-4 py-2 rounded-token-lg font-medium hover:bg-accent-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-60"

                        >
                            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                            บันทึก
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
