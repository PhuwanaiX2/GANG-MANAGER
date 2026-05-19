'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ModalLayer } from '@/components/ui';
import { logClientError } from '@/lib/clientLogger';

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
                body: JSON.stringify({ deleteData, confirmationText: confirmText }),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'ยุบแก๊งไม่สำเร็จ');
            }

            toast.success('ยุบแก๊งเรียบร้อยแล้ว');
            router.push('/dashboard'); // Go back to main dashboard
            router.refresh();
        } catch (error) {
            logClientError('dashboard.settings.dissolve.failed', error, { gangId, deleteData });
            toast.error('เกิดข้อผิดพลาดในการยุบแก๊ง');
            setIsSubmitting(false); // Only stop loading on error
        }
    };

    return (
        <ModalLayer onClose={isSubmitting ? undefined : onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Dissolve gang"
                className="max-h-[calc(100dvh-1rem)] w-full max-w-lg overflow-y-auto rounded-token-xl border border-status-danger/70 bg-bg-raised p-4 shadow-token-lg animate-in zoom-in-95 duration-200 sm:p-5"
            >
                <div className="flex items-start gap-3 mb-4">
                    <div className="h-10 w-10 shrink-0 bg-status-danger-subtle rounded-token-lg flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-fg-danger" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-bold text-fg-primary text-base mb-1">ยืนยันการยุบแก๊ง?</h3>
                        <p className="text-fg-secondary text-sm leading-relaxed">
                            การกระทำนี้จะลบยศ Discord ทั้งหมด และไม่สามารถย้อนกลับได้
                        </p>
                    </div>
                </div>

                <div className="space-y-3 mb-5">
                    {/* Hard Delete is now default and mandatory */}
                    <div className="bg-status-danger-subtle border border-status-danger/70 rounded-token-lg p-3 text-left">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-fg-danger mt-0.5" />
                            <div className="space-y-1">
                                <span className="text-fg-primary text-sm font-semibold block">การลบข้อมูลถาวร (Permanent Delete)</span>
                                <span className="text-fg-secondary text-xs block">
                                    ระบบจะลบข้อมูลทั้งหมดรวมถึง ประวัติการเงิน, การเช็คชื่อ และสมาชิก ออกจากฐานข้อมูลทันที ไม่สามารถกู้คืนได้
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1.5 text-left">
                        <label className="text-xs font-medium text-fg-secondary">
                            พิมพ์ชื่อแก๊ง <span className="font-bold text-fg-primary">"{gangName}"</span> เพื่อยืนยัน
                        </label>

                        <input
                            type="text"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            className="w-full min-h-11 bg-bg-subtle border border-border-subtle rounded-token-lg px-3 py-2 text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:border-status-danger transition-colors"

                            placeholder={gangName}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="min-h-11 px-4 py-2 bg-bg-muted hover:bg-bg-elevated text-fg-primary rounded-token-lg font-medium transition-colors disabled:opacity-60"

                    >
                        ยกเลิก
                    </button>
                    <button
                        onClick={handleDissolve}
                        disabled={confirmText !== gangName || isSubmitting}
                        className="flex min-h-11 items-center justify-center gap-2 rounded-token-lg bg-status-danger px-4 py-2 font-bold text-fg-inverse transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"

                    >
                        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                        ยุบแก๊งทันที
                    </button>
                </div>
            </div>
        </ModalLayer>
    );
}
