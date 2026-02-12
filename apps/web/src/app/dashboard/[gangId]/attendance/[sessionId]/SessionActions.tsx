'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Lock, Play, RefreshCw, Send, AlertTriangle } from 'lucide-react';
import { ConfirmModal } from '@/components/modals/ConfirmModal';

interface Props {
    gangId: string;
    sessionId: string;
    currentStatus: string;
}

export function SessionActions({ gangId, sessionId, currentStatus }: Props) {
    const router = useRouter();
    const [isUpdating, setIsUpdating] = useState(false);
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);

    const handleStatusChange = async (newStatus: 'ACTIVE' | 'CLOSED') => {
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
            } else {
                toast.success('ปิดรอบเช็คชื่อแล้ว', {
                    description: 'สมาชิกที่ไม่เช็คชื่อถูกบันทึกเป็น "ขาด"',
                });
            }

            setShowCloseConfirm(false);
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

    // SCHEDULED: Show "Start" button
    if (currentStatus === 'SCHEDULED') {
        return (
            <div className="flex flex-col items-end gap-2">
                <span className="text-xs text-yellow-400/70 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    รอระบบเริ่มอัตโนมัติ... หรือ
                </span>
                <button
                    onClick={() => handleStatusChange('ACTIVE')}
                    disabled={isUpdating}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold border border-white/10 transition-all disabled:opacity-50"
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

    // CLOSED: No action (already closed)
    if (currentStatus === 'CLOSED') {
        return (
            <span className="flex items-center gap-2 px-4 py-2 bg-gray-600/50 text-gray-400 rounded-xl font-medium">
                <Lock className="w-4 h-4" />
                ปิดแล้ว
            </span>
        );
    }

    // ACTIVE: Show "Close" button
    return (
        <>
            <button
                onClick={() => setShowCloseConfirm(true)}
                disabled={isUpdating}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
            >
                {isUpdating ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                    <Lock className="w-4 h-4" />
                )}
                ปิดรอบ
            </button>

            <ConfirmModal
                isOpen={showCloseConfirm}
                onClose={() => setShowCloseConfirm(false)}
                onConfirm={() => handleStatusChange('CLOSED')}
                title="ยืนยันที่จะปิดรอบเช็คชื่อ?"
                description={
                    <span>
                        สมาชิกที่ยังไม่เช็คชื่อจะถูกบันทึกว่า <span className="text-red-400 font-bold">"ขาด"</span> และถูกหักเงินทันที
                    </span>
                }
                confirmText="ยืนยันปิดรอบ"
                cancelText="ยกเลิก"
                type="danger"
                icon={AlertTriangle}
                isProcessing={isUpdating}
            />
        </>
    );
}
