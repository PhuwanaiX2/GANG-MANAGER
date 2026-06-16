'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertTriangle, Lock, Play, RefreshCw, XCircle } from 'lucide-react';
import { ConfirmModal } from '@/components/modals/ConfirmModal';
import { logClientError } from '@/lib/clientLogger';

interface Props {
    gangId: string;
    sessionId: string;
    currentStatus: string;
    canManageAttendance: boolean;
    willApplyAbsencePenalty: boolean;
    sessionMode?: string | null;
    countingPolicy?: string | null;
    uncheckedCount?: number;
}

export const ATTENDANCE_MANUAL_UNCHECKED_COUNT_EVENT = 'attendance-manual-unchecked-count:update';
export const ATTENDANCE_MANUAL_SUBMIT_REQUEST_EVENT = 'attendance-manual-submit:request';

export function SessionActions({
    gangId,
    sessionId,
    currentStatus,
    canManageAttendance,
    willApplyAbsencePenalty,
    sessionMode,
    countingPolicy,
    uncheckedCount = 0,
}: Props) {
    const router = useRouter();
    const [isUpdating, setIsUpdating] = useState(false);
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [effectiveUncheckedCount, setEffectiveUncheckedCount] = useState(uncheckedCount);
    const isManualMode = sessionMode === 'MANUAL_ROLL_CALL';
    const isSupplementalRound = countingPolicy === 'SUPPLEMENTAL';
    const canCloseManualRound = !isManualMode || isSupplementalRound || effectiveUncheckedCount === 0;

    useEffect(() => {
        setEffectiveUncheckedCount(uncheckedCount);
    }, [uncheckedCount]);

    useEffect(() => {
        const handleUncheckedCount = (event: Event) => {
            const nextCount = (event as CustomEvent<{ uncheckedCount: number }>).detail?.uncheckedCount;
            if (typeof nextCount === 'number') {
                setEffectiveUncheckedCount(nextCount);
            }
        };

        window.addEventListener(ATTENDANCE_MANUAL_UNCHECKED_COUNT_EVENT, handleUncheckedCount);
        return () => window.removeEventListener(ATTENDANCE_MANUAL_UNCHECKED_COUNT_EVENT, handleUncheckedCount);
    }, []);

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
                throw new Error(data.error || 'อัปเดตสถานะรอบไม่สำเร็จ');
            }

            if (newStatus === 'ACTIVE') {
                toast.success(isManualMode ? 'เปิดตารางเช็คชื่อแล้ว' : 'เปิดเช็คชื่อแล้ว', {
                    description: isManualMode
                        ? 'เจ้าหน้าที่สามารถเช็คสมาชิกจากตารางบนเว็บได้ทันที'
                        : 'ระบบส่งปุ่มเช็คชื่อไป Discord แล้ว สมาชิกเริ่มเช็คชื่อได้ทันที',
                });
            } else if (newStatus === 'CLOSED') {
                toast.success('ปิดรอบเช็คชื่อแล้ว', {
                    description: isManualMode
                        ? 'บันทึกผลที่เจ้าหน้าที่เช็คไว้เป็นสรุปสุดท้ายแล้ว'
                        : 'สมาชิกที่ไม่เช็คชื่อถูกบันทึกตามเงื่อนไขของรอบแล้ว',
                });
            } else if (newStatus === 'CANCELLED') {
                toast.success('ยกเลิกรอบเช็คชื่อแล้ว', {
                    description: 'รอบนี้จะไม่ถูกใช้คิดผลเช็คชื่อหรือค่าปรับ',
                });
            }

            setShowCloseConfirm(false);
            setShowCancelConfirm(false);
            if (newStatus === 'ACTIVE' || (newStatus === 'CLOSED' && !isManualMode)) {
                router.refresh();
            } else if (newStatus === 'CANCELLED') {
                router.replace(`/dashboard/${gangId}/attendance`);
                router.refresh();
            } else {
                router.replace(`/dashboard/${gangId}/attendance/history`);
                router.refresh();
            }
        } catch (error: any) {
            logClientError('dashboard.attendance.session_status.failed', error, { gangId, sessionId, newStatus });
            toast.error('อัปเดตไม่สำเร็จ', {
                description: error.message,
            });
        } finally {
            setIsUpdating(false);
        }
    };

    if (!canManageAttendance || currentStatus === 'CLOSED' || currentStatus === 'CANCELLED') {
        return null;
    }

    if (currentStatus === 'SCHEDULED') {
        return (
            <div className="mt-2 flex flex-col gap-2 md:mt-0 md:items-end">
                <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-fg-warning">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    {isManualMode
                        ? 'รอบเช็คโดยเจ้าหน้าที่รอเปิดใช้งาน'
                        : 'รอบนี้รอเวลาเริ่มอัตโนมัติ หรือเปิดตอนนี้ก็ได้'}
                </span>
                <button
                    onClick={() => handleStatusChange('ACTIVE')}
                    data-testid="attendance-start-session"
                    disabled={isUpdating}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-token-lg bg-accent px-4 py-2 font-bold text-accent-fg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isUpdating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    เปิดรอบตอนนี้
                </button>
            </div>
        );
    }

    return (
        <>
            <div className="mt-2 flex w-full flex-col gap-2 md:mt-0 md:w-auto md:items-end">
                {isManualMode && !isSupplementalRound && effectiveUncheckedCount > 0 ? (
                    <span data-testid="attendance-manual-unchecked-count" className="text-xs font-semibold text-fg-warning">
                        ยังไม่เช็ค {effectiveUncheckedCount} คน ต้องเช็คให้ครบก่อนปิดรอบ
                    </span>
                ) : null}
                {isManualMode && isSupplementalRound ? (
                    <span data-testid="attendance-manual-supplemental-note" className="text-xs font-semibold text-fg-success">
                        รอบเสริม: ปิดได้ทันที ระบบบันทึกเฉพาะคนที่เลือกเป็นเข้าร่วม
                    </span>
                ) : null}
                <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
                    <button
                        onClick={() => setShowCancelConfirm(true)}
                        disabled={isUpdating}
                        className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-token-lg border border-border-subtle bg-bg-muted px-4 py-2 text-sm font-semibold text-fg-secondary shadow-token-sm transition-colors hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
                    >
                        {isUpdating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                        ยกเลิกรอบ
                    </button>
                    <button
                        onClick={() => {
                            if (!canCloseManualRound) return;
                            if (isManualMode) {
                                window.dispatchEvent(new CustomEvent(ATTENDANCE_MANUAL_SUBMIT_REQUEST_EVENT));
                                return;
                            }
                            setShowCloseConfirm(true);
                        }}
                        data-testid="attendance-open-close-confirm"
                        disabled={isUpdating || !canCloseManualRound}
                        className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-token-lg bg-status-danger px-4 py-2 text-sm font-semibold text-fg-inverse transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none"
                    >
                        {isUpdating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                        {isManualMode ? 'ยืนยันจบ' : 'ปิดรอบ'}
                    </button>
                </div>
            </div>

            <ConfirmModal
                isOpen={showCloseConfirm}
                onClose={() => setShowCloseConfirm(false)}
                onConfirm={() => handleStatusChange('CLOSED')}
                title="ยืนยันที่จะปิดรอบเช็คชื่อ?"
                description={
                    <span className="text-fg-secondary">
                        {isManualMode ? (
                            <>
                                ระบบจะใช้สถานะที่เจ้าหน้าที่เช็คไว้เป็นผลสรุปสุดท้าย ถ้ามีคนถูกเช็คเป็น <span className="font-bold text-fg-danger">ขาด</span>
                                {willApplyAbsencePenalty
                                    ? <span> จะถูกคิดค่าปรับตามที่กำหนด</span>
                                    : <span> จะไม่ถูกหักเงินอัตโนมัติในแพลนปัจจุบัน</span>}
                            </>
                        ) : (
                            <>
                                สมาชิกที่ยังไม่เช็คชื่อจะถูกบันทึกว่า <span className="font-bold text-fg-danger">ขาด</span>
                                {willApplyAbsencePenalty
                                    ? <span> และถูกหักเงินทันที</span>
                                    : <span> โดยไม่มีการหักเงินอัตโนมัติในแพลนปัจจุบัน</span>}
                            </>
                        )}
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
                        ยกเลิกรอบนี้โดย<span className="font-bold text-fg-warning">ไม่มีการคิดค่าปรับ</span>ใดๆ
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
