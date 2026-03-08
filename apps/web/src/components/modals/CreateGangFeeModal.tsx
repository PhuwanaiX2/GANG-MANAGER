'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Coins, X, Users, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';

interface Props {
    gangId: string;
    isOpen: boolean;
    onClose: () => void;
    members: { id: string; name: string }[];
}

type TargetMode = 'ALL' | 'SELECTED';

export function CreateGangFeeModal({ gangId, isOpen, onClose, members }: Props) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [targetMode, setTargetMode] = useState<TargetMode>('ALL');
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
    const totalAmount = (parseInt(amount, 10) || 0) * targetCount;

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || !description) return;
        if (targetMode === 'SELECTED' && selectedMemberIds.size === 0) {
            toast.error('กรุณาเลือกสมาชิกอย่างน้อย 1 คน');
            return;
        }

        setIsSubmitting(true);
        try {
            const body: any = {
                amount: parseInt(amount, 10),
                description,
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
            setSelectedMemberIds(new Set());
        } catch (error) {
            console.error(error);
            toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่');
        } finally {
            setIsSubmitting(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-[#09090b] border border-purple-500/20 rounded-2xl shadow-2xl shadow-purple-500/5 p-6 w-full max-w-md transform scale-100 transition-all animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/10 rounded-xl">
                            <Coins className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-lg">เก็บเงินแก๊ง</h3>
                            <p className="text-[11px] text-gray-500">สมาชิกจะยอดติดลบทันที • กองกลางเพิ่มเมื่อจ่ายจริง</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-hidden flex flex-col">
                    {/* Amount */}
                    <div className="space-y-2">
                        <label className="text-sm text-gray-400">จำนวนเงิน/คน</label>
                        <input
                            type="number"
                            required
                            min="1"
                            step="1"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className={`w-full bg-black/20 border rounded-lg p-3 text-white text-lg font-bold placeholder-gray-600 focus:outline-none ${parseFloat(amount) > 100000000 ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-purple-500/50'}`}
                            placeholder="0"
                        />
                        {parseFloat(amount) > 100000000 && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                                <span className="text-red-400 text-xs font-bold">⚠ ยอดเกิน 100,000,000</span>
                            </div>
                        )}
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <label className="text-sm text-gray-400">รายละเอียด</label>
                        <input
                            type="text"
                            required
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
                            placeholder="เช่น ค่าแก๊งเดือน มี.ค."
                        />
                    </div>

                    {/* Target Mode */}
                    <div className="space-y-2">
                        <label className="text-sm text-gray-400">เก็บจากใคร</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setTargetMode('ALL')}
                                className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 transition-all text-sm font-medium ${targetMode === 'ALL'
                                    ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                                    : 'bg-black/20 border-white/5 text-gray-400 hover:bg-white/5'
                                    }`}
                            >
                                <Users className="w-4 h-4" />
                                ทุกคน ({members.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setTargetMode('SELECTED')}
                                className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 transition-all text-sm font-medium ${targetMode === 'SELECTED'
                                    ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                                    : 'bg-black/20 border-white/5 text-gray-400 hover:bg-white/5'
                                    }`}
                            >
                                <UserCheck className="w-4 h-4" />
                                เลือกเฉพาะ
                            </button>
                        </div>
                    </div>

                    {/* Member Selection */}
                    {targetMode === 'SELECTED' && (
                        <div className="space-y-2 flex-1 overflow-hidden flex flex-col min-h-0">
                            <div className="flex items-center justify-between">
                                <label className="text-sm text-gray-400">เลือกสมาชิก ({selectedMemberIds.size}/{members.length})</label>
                                <div className="flex gap-2">
                                    <button type="button" onClick={selectAll} className="text-[10px] text-purple-400 hover:text-purple-300 font-medium">เลือกทั้งหมด</button>
                                    <button type="button" onClick={deselectAll} className="text-[10px] text-gray-500 hover:text-gray-400 font-medium">ล้าง</button>
                                </div>
                            </div>
                            <div className="overflow-y-auto flex-1 max-h-[180px] border border-white/5 rounded-xl divide-y divide-white/5">
                                {members.map(m => (
                                    <label key={m.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 cursor-pointer transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={selectedMemberIds.has(m.id)}
                                            onChange={() => toggleMember(m.id)}
                                            className="w-4 h-4 rounded border-white/20 bg-black/20 text-purple-500 focus:ring-purple-500/50 focus:ring-offset-0"
                                        />
                                        <span className="text-sm text-white truncate">{m.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Summary */}
                    {parseInt(amount, 10) > 0 && targetCount > 0 && (
                        <div className="bg-purple-500/5 border border-purple-500/10 rounded-xl p-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-400">สรุป</span>
                                <span className="text-purple-400 font-bold">
                                    ฿{parseInt(amount, 10).toLocaleString()} × {targetCount} คน = ฿{totalAmount.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-medium transition-colors"
                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || (targetMode === 'SELECTED' && selectedMemberIds.size === 0)}
                            className="flex-1 bg-purple-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-purple-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20"
                        >
                            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                            เรียกเก็บ
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
