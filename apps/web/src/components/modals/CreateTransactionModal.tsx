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
                    amount: parseFloat(amount),
                    description: type === 'INCOME' || type === 'EXPENSE' ? description : undefined,
                    memberId: memberId || undefined,
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-[#09090b] border border-white/10 rounded-2xl shadow-2xl p-6 w-full max-w-md transform scale-100 transition-all animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-white text-lg">สร้างรายการใหม่</h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Type Selection */}
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setType('INCOME')}
                            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${type === 'INCOME'
                                ? 'bg-green-500/20 border-green-500 text-green-400'
                                : 'bg-black/20 border-white/5 text-gray-400 hover:bg-white/5'
                                }`}
                        >
                            <ArrowUpCircle className="w-6 h-6" />
                            <span className="text-sm font-medium">รายรับ (ฝาก)</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setType('EXPENSE')}
                            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${type === 'EXPENSE'
                                ? 'bg-red-500/20 border-red-500 text-red-400'
                                : 'bg-black/20 border-white/5 text-gray-400 hover:bg-white/5'
                                }`}
                        >
                            <ArrowDownCircle className="w-6 h-6" />
                            <span className="text-sm font-medium">รายจ่าย (ถอน)</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setType('LOAN')}
                            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${type === 'LOAN'
                                ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400'
                                : 'bg-black/20 border-white/5 text-gray-400 hover:bg-white/5'
                                }`}
                        >
                            <HandCoins className="w-6 h-6" />
                            <span className="text-sm font-medium">สมาชิกยืมเงิน</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setType('REPAYMENT')}
                            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${type === 'REPAYMENT'
                                ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                                : 'bg-black/20 border-white/5 text-gray-400 hover:bg-white/5'
                                }`}
                        >
                            <Landmark className="w-6 h-6" />
                            <span className="text-sm font-medium">สมาชิบคืนเงิน</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setType('DEPOSIT')}
                            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${type === 'DEPOSIT'
                                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                                : 'bg-black/20 border-white/5 text-gray-400 hover:bg-white/5'
                                }`}
                        >
                            <Landmark className="w-6 h-6" />
                            <span className="text-sm font-medium">สมาชิกฝาก/สำรองจ่าย</span>
                        </button>
                    </div>

                    {/* Amount */}
                    <div className="space-y-2">
                        <label className="text-sm text-gray-400">จำนวนเงิน</label>
                        <input
                            type="number"
                            required
                            min="0"
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className={`w-full bg-black/20 border rounded-lg p-2 text-white placeholder-gray-600 focus:outline-none ${parseFloat(amount) > 100000000 ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-white/20'}`}
                            placeholder="0.00"
                        />
                        {parseFloat(amount) > 100000000 && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                                <span className="text-red-400 text-xs font-bold">⚠ ยอดเกิน 100,000,000 — ระบบรองรับสูงสุด 100M ต่อรายการ</span>
                            </div>
                        )}
                    </div>

                    {/* Description */}
                    {(type === 'INCOME' || type === 'EXPENSE') && (
                        <div className="space-y-2">
                            <label className="text-sm text-gray-400">รายละเอียด</label>
                            <input
                                type="text"
                                required
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white placeholder-gray-600 focus:outline-none focus:border-white/20"
                                placeholder="เช่น ค่ากระสุน, พี่Xให้มา"
                            />
                        </div>
                    )}

                    {/* Member Selection (Conditional) */}
                    {(type === 'LOAN' || type === 'REPAYMENT' || type === 'DEPOSIT') && (
                        <div className="space-y-2">
                            <label className="text-sm text-gray-400">สมาชิก</label>
                            <select
                                required
                                value={memberId}
                                onChange={(e) => setMemberId(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-white/20"
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
                            className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-sm font-medium transition-colors"
                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 bg-white text-black px-4 py-2 rounded-2xl font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
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
