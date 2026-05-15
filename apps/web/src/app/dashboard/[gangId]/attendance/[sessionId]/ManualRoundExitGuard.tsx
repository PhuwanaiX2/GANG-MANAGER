'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { logClientError } from '@/lib/clientLogger';

export const ATTENDANCE_MANUAL_SESSION_FINALIZED_EVENT = 'attendance-manual-session:finalized';

interface ManualRoundExitProps {
    gangId: string;
    sessionId: string;
    enabled: boolean;
}

async function cancelManualRound(gangId: string, sessionId: string, keepalive = false) {
    const response = await fetch(`/api/gangs/${gangId}/attendance/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
        keepalive,
    });

    if (!response.ok) {
        throw new Error(`Cancel failed: ${response.status}`);
    }
}

export function ManualRoundExitGuard({ gangId, sessionId, enabled }: ManualRoundExitProps) {
    const router = useRouter();
    const finalizedRef = useRef(false);
    const cancellingRef = useRef(false);

    useEffect(() => {
        if (!enabled || typeof window === 'undefined') {
            return;
        }

        const state = window.history.state || {};
        if (state.manualRoundGuardSessionId !== sessionId) {
            window.history.pushState({ ...state, manualRoundGuardSessionId: sessionId }, '', window.location.href);
        }

        const handleFinalized = () => {
            finalizedRef.current = true;
        };

        const handlePopState = () => {
            if (finalizedRef.current || cancellingRef.current) {
                return;
            }

            cancellingRef.current = true;
            void cancelManualRound(gangId, sessionId, true)
                .catch((error) => {
                    logClientError('dashboard.attendance.manual_round.back_cancel.failed', error, { gangId, sessionId });
                })
                .finally(() => {
                    router.replace(`/dashboard/${gangId}/attendance`);
                    router.refresh();
                });
        };

        window.addEventListener(ATTENDANCE_MANUAL_SESSION_FINALIZED_EVENT, handleFinalized);
        window.addEventListener('popstate', handlePopState);
        return () => {
            window.removeEventListener(ATTENDANCE_MANUAL_SESSION_FINALIZED_EVENT, handleFinalized);
            window.removeEventListener('popstate', handlePopState);
        };
    }, [enabled, gangId, router, sessionId]);

    return null;
}

export function AttendanceSessionBackControl({ gangId, sessionId, enabled }: ManualRoundExitProps) {
    const router = useRouter();
    const [isCancelling, setIsCancelling] = useState(false);
    const href = `/dashboard/${gangId}/attendance`;
    const className = 'mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-token-xl border border-border-subtle bg-bg-muted text-fg-secondary shadow-token-sm transition-colors hover:bg-bg-elevated hover:text-fg-primary disabled:cursor-not-allowed disabled:opacity-60';

    if (!enabled) {
        return (
            <Link href={href} className={className} aria-label="กลับหน้ารายการเช็คชื่อ">
                <ArrowLeft className="h-5 w-5" />
            </Link>
        );
    }

    const handleBack = async () => {
        setIsCancelling(true);
        try {
            await cancelManualRound(gangId, sessionId);
            toast.success('ยกเลิกรอบเช็คชื่อแล้ว');
            window.dispatchEvent(new CustomEvent(ATTENDANCE_MANUAL_SESSION_FINALIZED_EVENT));
            router.replace(href);
            router.refresh();
        } catch (error) {
            logClientError('dashboard.attendance.manual_round.back_button_cancel.failed', error, { gangId, sessionId });
            toast.error('ยกเลิกรอบไม่สำเร็จ', {
                description: 'กรุณากดปุ่มยกเลิกรอบ หรือโหลดหน้าใหม่แล้วลองอีกครั้ง',
            });
            setIsCancelling(false);
        }
    };

    return (
        <button
            type="button"
            onClick={handleBack}
            disabled={isCancelling}
            className={className}
            aria-label="ยกเลิกรอบและกลับหน้ารายการเช็คชื่อ"
        >
            {isCancelling ? <RefreshCw className="h-5 w-5 animate-spin" /> : <ArrowLeft className="h-5 w-5" />}
        </button>
    );
}
