'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Lock, Play, RefreshCw, Send, AlertTriangle, XCircle } from 'lucide-react';
import { ConfirmModal } from '@/components/modals/ConfirmModal';

interface Props {
    gangId: string;
    sessionId: string;
    currentStatus: string;
    canManageAttendance: boolean;
}

export function SessionActions({ gangId, sessionId, currentStatus, canManageAttendance }: Props) {
    const router = useRouter();
    const [isUpdating, setIsUpdating] = useState(false);
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);

    const handleStatusChange = async (newStatus: 'ACTIVE' | 'CLOSED' | 'CANCELLED') => {
        setIsUpdating(true);
        try {
            const res = await fetch(`/api/gangs/${gangId}/attendance/${sessionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to update');
            }

            if (newStatus === 'ACTIVE') {
                toast.success('เปิดเช็คชื่อแล้ว! 📢', {
                    description: 'ส่งปุ่มเช็คชื่อไป Discord แล้ว',
                });
            } else if (newStatus === 'CLOSED') {
                toast.success('ปิดรอบเช็คชื่อแล้ว', {
                    description: 'สมาชิกที่ไม่เช็คชื่อถูกบันทึกเป็น "ขาด"',
                });
            } else if (newStatus === 'CANCELLED') {
                toast.success('ยกเลิกรอบเช็คชื่อแล้ว', {
                    description: 'ไม่มีการคิดค่าปรับ',
                });
            }

            setShowCloseConfirm(false);
            setShowCancelConfirm(false);
            router.refresh();
        } catch (error: any) {
            console.error(error);
            toast.error('อัปเดตไม่สำเร็จ', {
                description: error.message,
            });
        } finally {
            setIsUpdating(false);
        }
    };

    if (!canManageAttendance) {
        return null;
    }

    // SCHEDULED: Show "Start" button
    if (currentStatus === 'SCHEDULED') {
        return (
            <div className="flex flex-col md:items-end gap-2 mt-2 md:mt-0">
                <span className="text-[11px] text-amber-500/70 font-medium tracking-wide flex items-center gap-1.5">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    รอระบบเริ่มอัตโนมัติ... หรือ
                </span>
                <button
                    onClick={() => handleStatusChange('ACTIVE')}
                    data-testid="attendance-start-session"
                    disabled={isUpdating}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
                >
                    {isUpdating ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                        <Send className="w-4 h-4" />
                    )}
                    เริ่มทันที
                </button>
            </div>
        );
    }

    // CLOSED: No action
    if (currentStatus === 'CLOSED') {
        return (
            <span className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-zinc-400 rounded-xl font-semibold shadow-sm text-sm tracking-wide mt-2 md:mt-0">
                <Lock className="w-4 h-4 text-zinc-500" />
                ปิดแล้ว
            </span>
        );
    }

    // CANCELLED: No action
    if (currentStatus === 'CANCELLED') {
        return (
            <span className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl font-semibold shadow-sm text-sm tracking-wide mt-2 md:mt-0">
                <XCircle className="w-4 h-4 text-rose-500" />
                ยกเลิกแล้ว
            </span>
        );
    }

    // ACTIVE: Show "Close" + "Cancel" buttons
    return (
        <>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
                <button
                    onClick={() => setShowCancelConfirm(true)}
                    disabled={isUpdating}
                    className="flex flex-1 sm:flex-none justify-center items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl font-semibold border border-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-sm"
                >
                    {isUpdating ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                        <XCircle className="w-4 h-4" />
                    )}
                    ยกเลิกรอบ
                </button>
                <button
                    onClick={() => setShowCloseConfirm(true)}
                    data-testid="attendance-open-close-confirm"
                    disabled={isUpdating}
                    className="flex flex-1 sm:flex-none justify-center items-center gap-2 px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-semibold transition-all shadow-[0_0_15px_rgba(244,63,94,0.3)] hover:shadow-[0_0_20px_rgba(244,63,94,0.5)] disabled:opacity-50 disabled:cursor-not-allowed text-sm transform hover:-translate-y-0.5"
                >
                    {isUpdating ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                        <Lock className="w-4 h-4" />
                    )}
                    ปิดรอบ
                </button>
            </div>

            <ConfirmModal
                isOpen={showCloseConfirm}
                onClose={() => setShowCloseConfirm(false)}
                onConfirm={() => handleStatusChange('CLOSED')}
                title="ยืนยันที่จะปิดรอบเช็คชื่อ?"
                description={
                    <span className="text-zinc-400">
                        สมาชิกที่ยังไม่เช็คชื่อจะถูกบันทึกว่า <span className="text-rose-400 font-bold">"ขาด"</span> และถูกหักเงินทันที
                    </span>
                }
                confirmText="ยืนยันปิดรอบ"
                cancelText="ยกเลิก"
                type="danger"
                icon={AlertTriangle}
                isProcessing={isUpdating}
            />

            <ConfirmModal
                isOpen={showCancelConfirm}
                onClose={() => setShowCancelConfirm(false)}
                onConfirm={() => handleStatusChange('CANCELLED')}
                title="ยกเลิกรอบเช็คชื่อ?"
                description={
                    <span className="text-zinc-400">
                        ยกเลิกรอบนี้โดย<span className="text-amber-400 font-bold">ไม่มีการคิดค่าปรับ</span>ใดๆ
                    </span>
                }
                confirmText="ยืนยันยกเลิก"
                cancelText="กลับ"
                type="danger"
                icon={XCircle}
                isProcessing={isUpdating}
            />
        </>
    );
}
