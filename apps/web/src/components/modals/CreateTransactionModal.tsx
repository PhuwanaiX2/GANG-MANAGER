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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-bg-overlay backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl shadow-token-lg p-6 w-full max-w-md transform scale-100 transition-all animate-in zoom-in-95 duration-200">

                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="font-bold text-fg-primary text-lg">บันทึกรายการการเงิน</h3>
                        <p className="text-[11px] text-fg-tertiary mt-1">เลือกรูปแบบรายการให้ตรงกับการเคลื่อนไหวเงินจริงของกองกลาง</p>

                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-bg-muted rounded-token-lg text-fg-secondary hover:text-fg-primary transition-colors"

                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Type Selection */}
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setTransactionType('INCOME')}
                            className={`p-3 rounded-token-xl border flex flex-col items-center gap-2 transition-all ${type === 'INCOME'
                                ? 'bg-status-success-subtle border-status-success text-fg-success'
                                : 'bg-bg-muted border-border-subtle text-fg-secondary hover:bg-bg-raised'

                                }`}
                        >
                            <ArrowUpCircle className="w-6 h-6" />
                            <span className="text-sm font-medium">รายรับเข้ากองกลาง</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setTransactionType('EXPENSE')}
                            className={`p-3 rounded-token-xl border flex flex-col items-center gap-2 transition-all ${type === 'EXPENSE'
                                ? 'bg-status-danger-subtle border-status-danger text-fg-danger'
                                : 'bg-bg-muted border-border-subtle text-fg-secondary hover:bg-bg-raised'

                                }`}
                        >
                            <ArrowDownCircle className="w-6 h-6" />
                            <span className="text-sm font-medium">รายจ่ายจากกองกลาง</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setTransactionType('LOAN')}
                            className={`p-3 rounded-token-xl border flex flex-col items-center gap-2 transition-all ${type === 'LOAN'
                                ? 'bg-status-warning-subtle border-status-warning text-fg-warning'
                                : 'bg-bg-muted border-border-subtle text-fg-secondary hover:bg-bg-raised'

                                }`}
                        >
                            <HandCoins className="w-6 h-6" />
                            <span className="text-sm font-medium">สมาชิกยืมจากกองกลาง</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setTransactionType('REPAYMENT')}
                            className={`p-3 rounded-token-xl border flex flex-col items-center gap-2 transition-all ${type === 'REPAYMENT'
                                ? 'bg-status-info-subtle border-status-info text-fg-info'
                                : 'bg-bg-muted border-border-subtle text-fg-secondary hover:bg-bg-raised'

                                }`}
                        >
                            <Landmark className="w-6 h-6" />
                            <span className="text-sm font-medium">ชำระหนี้ยืม</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setTransactionType('DEPOSIT')}
                            className={`p-3 rounded-token-xl border flex flex-col items-center gap-2 transition-all ${type === 'DEPOSIT'
                                ? 'bg-status-success-subtle border-status-success text-fg-success'
                                : 'bg-bg-muted border-border-subtle text-fg-secondary hover:bg-bg-raised'

                                }`}
                        >
                            <Landmark className="w-6 h-6" />
                            <span className="text-sm font-medium">เก็บเงินแก๊ง/เครดิต</span>
                        </button>

                    </div>

                    <div className="rounded-token-xl border border-border-subtle bg-bg-muted px-3 py-2">
                        <p className="text-[11px] text-fg-secondary leading-relaxed">{typeHelpText[type]}</p>

                    </div>

                    {/* Amount */}
                    <div className="space-y-2">
                        <label className="text-sm text-fg-secondary">จำนวนเงิน</label>

                        <input
                            type="number"
                            required
                            min="1"
                            step="1"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className={`w-full bg-bg-muted border rounded-token-lg p-2 text-fg-primary placeholder:text-fg-tertiary focus:outline-none ${parseFloat(amount) > 100000000 ? 'border-status-danger/50 focus:border-status-danger' : 'border-border-subtle focus:border-border-strong'}`}

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
                        <div className="space-y-2">
                            <label className="text-sm text-fg-secondary">รายละเอียด</label>

                            <input
                                type="text"
                                required
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full bg-bg-muted border border-border-subtle rounded-token-lg p-2 text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:border-border-strong"

                                placeholder='เช่น ขายของได้, ค่าอุปกรณ์, ค่าน้ำมัน'
                            />
                        </div>
                    )}

                    {/* Member Selection (Conditional) */}
                    {(type === 'LOAN' || type === 'REPAYMENT' || type === 'DEPOSIT') && (
                        <div className="space-y-2">
                            <label className="text-sm text-fg-secondary">สมาชิกที่เกี่ยวข้อง</label>

                            <select
                                required
                                value={memberId}
                                onChange={(e) => setMemberId(e.target.value)}
                                className="w-full bg-bg-muted border border-border-subtle rounded-token-lg p-2 text-fg-primary focus:outline-none focus:border-border-strong"

                            >
                                <option value="">เลือกสมาชิก...</option>
                                {members.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-2 bg-bg-muted hover:bg-bg-raised text-fg-primary rounded-token-2xl text-sm font-medium transition-colors"

                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 bg-accent text-fg-inverse px-4 py-2 rounded-token-2xl font-medium hover:bg-accent-hover transition-colors flex items-center justify-center gap-2"

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
