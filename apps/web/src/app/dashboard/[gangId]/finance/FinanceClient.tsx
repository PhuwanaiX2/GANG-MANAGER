'use client';

import { useState } from 'react';
import { Plus, Download, Lock, Coins } from 'lucide-react';
import { toast } from 'sonner';
import { CreateTransactionModal } from '@/components/modals/CreateTransactionModal';
import { CreateGangFeeModal } from '@/components/modals/CreateGangFeeModal';
import { logClientError } from '@/lib/clientLogger';
import { PAYMENT_PAUSED_COPY } from '@/lib/paymentReadiness';

interface Props {
    gangId: string;
    members: { id: string; name: string }[];
    hasFinance?: boolean;
    hasExportCSV?: boolean;
}

export function FinanceClient({ gangId, members, hasFinance = true, hasExportCSV = true }: Props) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isGangFeeOpen, setIsGangFeeOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async () => {
        if (!hasExportCSV) {
            toast.error(PAYMENT_PAUSED_COPY.shortLabel, {
                description: PAYMENT_PAUSED_COPY.lockedFeature,
            });
            return;
        }
        setIsExporting(true);
        try {
            const res = await fetch(`/api/gangs/${gangId}/finance/export`);
            if (!res.ok) throw new Error('Export failed');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            logClientError('dashboard.finance.export.failed', error, { gangId });
            toast.error('Export CSV ไม่สำเร็จ');
        } finally {
            setIsExporting(false);
        }
    };

    const handleCreate = () => {
        if (!hasFinance) {
            toast.error(PAYMENT_PAUSED_COPY.shortLabel, {
                description: PAYMENT_PAUSED_COPY.lockedFeature,
            });
            return;
        }
        setIsModalOpen(true);
    };

    const handleGangFee = () => {
        if (!hasFinance) {
            toast.error(PAYMENT_PAUSED_COPY.shortLabel, {
                description: PAYMENT_PAUSED_COPY.lockedFeature,
            });
            return;
        }
        setIsGangFeeOpen(true);
    };

    return (
        <div className="grid w-full min-w-[240px] grid-cols-2 gap-2 sm:flex sm:w-auto sm:min-w-0 sm:flex-wrap sm:items-center sm:justify-end">
            <button
                onClick={handleExport}
                disabled={isExporting}
                className={`inline-flex items-center justify-center gap-2 rounded-token-xl border px-3 py-2 text-xs font-bold transition-all sm:px-4 sm:py-2.5 sm:text-sm ${hasExportCSV
                    ? 'bg-bg-subtle text-fg-secondary hover:bg-bg-muted hover:text-fg-primary border-border-subtle hover:border-border disabled:opacity-50 shadow-token-sm'
                    : 'bg-bg-muted text-fg-tertiary border-border-subtle cursor-not-allowed opacity-60'
                    }`}
            >
                {hasExportCSV ? <Download className="w-4 h-4 text-fg-tertiary transition-colors" /> : <Lock className="w-4 h-4" />}
                <span className="hidden sm:inline">{isExporting ? 'กำลังดาวน์โหลด...' : hasExportCSV ? 'Export CSV' : 'Export (Premium)'}</span>
                <span className="sm:hidden">{isExporting ? '...' : 'Export'}</span>
            </button>

            <button
                onClick={handleGangFee}
                className={`inline-flex items-center justify-center gap-2 rounded-token-xl px-3 py-2 text-xs font-bold transition-all sm:px-5 sm:py-2.5 sm:text-sm ${hasFinance
                    ? 'bg-accent-subtle text-accent-bright border border-border-accent hover:bg-accent hover:text-accent-fg shadow-token-sm hover:scale-[1.02] active:scale-[0.98]'
                    : 'bg-accent-subtle text-accent-bright cursor-not-allowed border border-border-accent opacity-50'
                    }`}
            >
                {hasFinance ? <Coins className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                <span className="hidden sm:inline">เก็บเงินแก๊ง</span>
                <span className="sm:hidden">เก็บเงิน</span>
            </button>

            <button
                onClick={handleCreate}
                className={`col-span-2 inline-flex items-center justify-center gap-2 rounded-token-xl px-3 py-2 text-xs font-bold transition-all sm:col-span-1 sm:px-5 sm:py-2.5 sm:text-sm ${hasFinance
                    ? 'bg-accent text-accent-fg hover:bg-accent-hover shadow-token-sm hover:scale-[1.02] active:scale-[0.98]'
                    : 'bg-bg-muted text-fg-tertiary cursor-not-allowed border border-border-subtle opacity-60'
                    }`}
            >
                {hasFinance ? <Plus className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                บันทึกรายการ
            </button>

            {hasFinance && (
                <>
                    <CreateTransactionModal
                        gangId={gangId}
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                        members={members}
                    />
                    <CreateGangFeeModal
                        gangId={gangId}
                        isOpen={isGangFeeOpen}
                        onClose={() => setIsGangFeeOpen(false)}
                        members={members}
                    />
                </>
            )}
        </div>
    );
}
