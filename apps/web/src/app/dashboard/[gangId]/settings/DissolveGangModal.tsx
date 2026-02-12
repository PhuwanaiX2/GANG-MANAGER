'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
    gangId: string;
    gangName: string;
    isOpen: boolean;
    onClose: () => void;
}

export function DissolveGangModal({ gangId, gangName, isOpen, onClose }: Props) {
    const router = useRouter();
    const [confirmText, setConfirmText] = useState('');
    const [deleteData, setDeleteData] = useState(true); // Force True by default
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleDissolve = async () => {
        if (confirmText !== gangName) return;

        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/gangs/${gangId}/dissolve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deleteData }),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to dissolve gang');
            }

            toast.success('ยุบแก๊งเรียบร้อยแล้ว');
            router.push('/dashboard'); // Go back to main dashboard
            router.refresh();
        } catch (error) {
            console.error(error);
            toast.error('เกิดข้อผิดพลาดในการยุบแก๊ง');
            setIsSubmitting(false); // Only stop loading on error
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#111111] border border-red-500/30 rounded-2xl shadow-2xl p-6 w-full max-w-md transform scale-100 transition-all animate-in zoom-in-95 duration-200">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>
                    <h3 className="font-bold text-white text-xl mb-2">ยืนยันการยุบแก๊ง?</h3>
                    <p className="text-gray-400 text-sm">
                        การกระทำนี้จะลบยศ Discord ทั้งหมด และไม่สามารถย้อนกลับได้
                    </p>
                </div>

                <div className="space-y-4 mb-6">
                    {/* Hard Delete is now default and mandatory */}
                    <div className="bg-red-900/10 border border-red-500/20 rounded-xl p-4 text-left">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                            <div className="space-y-1">
                                <span className="text-white font-medium block">การลบข้อมูลถาวร (Permanent Delete)</span>
                                <span className="text-gray-400 text-xs block">
                                    ระบบจะลบข้อมูลทั้งหมดรวมถึง ประวัติการเงิน, การเช็คชื่อ และสมาชิก ออกจากฐานข้อมูลทันที ไม่สามารถกู้คืนได้
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 text-left">
                        <label className="text-sm text-gray-400">
                            พิมพ์ชื่อแก๊ง <span className="font-bold text-white">"{gangName}"</span> เพื่อยืนยัน
                        </label>
                        <input
                            type="text"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50 transition-colors"
                            placeholder={gangName}
                        />
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-medium transition-colors"
                    >
                        ยกเลิก
                    </button>
                    <button
                        onClick={handleDissolve}
                        disabled={confirmText !== gangName || isSubmitting}
                        className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl font-bold transition-all shadow-lg shadow-red-900/20 flex items-center justify-center gap-2"
                    >
                        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                        ยุบแก๊งทันที
                    </button>
                </div>
            </div>
        </div>
    );
}
