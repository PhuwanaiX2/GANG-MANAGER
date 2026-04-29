'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Lock, Play, RefreshCw, AlertTriangle, XCircle } from 'lucide-react';
import { ConfirmModal } from '@/components/modals/ConfirmModal';
import { logClientError } from '@/lib/clientLogger';

interface Props {
    gangId: string;
    sessionId: string;
    currentStatus: string;
    canManageAttendance: boolean;
    willApplyAbsencePenalty: boolean;
}

export function SessionActions({ gangId, sessionId, currentStatus, canManageAttendance, willApplyAbsencePenalty }: Props) {
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
                    description: 'ระบบส่งปุ่มเช็คชื่อไป Discord แล้ว และสมาชิกเริ่มเช็คชื่อได้ทันที',
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
            logClientError('dashboard.attendance.session_status.failed', error, { gangId, sessionId, newStatus });
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
                <span className="text-[11px] text-fg-warning font-medium tracking-wide flex items-center gap-1.5">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    รอบนี้รอเวลาเริ่มอัตโนมัติ หรือคุณจะเปิดตอนนี้ก็ได้
                </span>
                <button
                    onClick={() => handleStatusChange('ACTIVE')}
                    data-testid="attendance-start-session"
                    disabled={isUpdating}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-accent-fg rounded-token-xl font-bold transition-all shadow-token-glow-accent disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
                >
                    {isUpdating ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                        <Play className="w-4 h-4" />
                    )}
                    เปิดรอบตอนนี้
                </button>
            </div>
        );
    }

    // CLOSED: No action
    if (currentStatus === 'CLOSED') {
        return (
            <span className="flex items-center gap-2 px-4 py-2 bg-bg-muted border border-border-subtle text-fg-tertiary rounded-token-xl font-semibold shadow-token-sm text-sm tracking-wide mt-2 md:mt-0">
                <Lock className="w-4 h-4 text-fg-tertiary" />
                ปิดแล้ว
            </span>
        );
    }

    // CANCELLED: No action
    if (currentStatus === 'CANCELLED') {
        return (
            <span className="flex items-center gap-2 px-4 py-2 bg-status-danger-subtle border border-status-danger text-fg-danger rounded-token-xl font-semibold shadow-token-sm text-sm tracking-wide mt-2 md:mt-0">
                <XCircle className="w-4 h-4 text-fg-danger" />
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
                    className="flex flex-1 sm:flex-none justify-center items-center gap-2 px-4 py-2.5 bg-bg-muted hover:bg-bg-elevated text-fg-secondary rounded-token-xl font-semibold border border-border-subtle transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-token-sm text-sm"
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
                    className="flex flex-1 sm:flex-none justify-center items-center gap-2 px-4 py-2.5 bg-status-danger hover:brightness-110 text-fg-inverse rounded-token-xl font-semibold transition-all shadow-token-glow-danger disabled:opacity-50 disabled:cursor-not-allowed text-sm transform hover:-translate-y-0.5"
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
                    <span className="text-fg-secondary">
                        สมาชิกที่ยังไม่เช็คชื่อจะถูกบันทึกว่า <span className="text-fg-danger font-bold">"ขาด"</span>
                        {willApplyAbsencePenalty
                            ? <><span> และถูกหักเงินทันที</span></>
                            : <><span> โดยไม่มีการหักเงินอัตโนมัติในแพลนปัจจุบัน</span></>}
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
                    <span className="text-fg-secondary">
                        ยกเลิกรอบนี้โดย<span className="text-fg-warning font-bold">ไม่มีการคิดค่าปรับ</span>ใดๆ
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
