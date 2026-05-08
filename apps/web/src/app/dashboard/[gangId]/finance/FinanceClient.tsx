'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Loader2, Lock, Plus, ReceiptText } from 'lucide-react';
import { toast } from 'sonner';
import { CreateTransactionModal } from '@/components/modals/CreateTransactionModal';
import { CreateGangFeeModal } from '@/components/modals/CreateGangFeeModal';
import { logClientError } from '@/lib/clientLogger';
import { PAYMENT_PAUSED_COPY } from '@/lib/paymentReadiness';
import { cn } from '@/lib/cn';

type MemberOption = { id: string; name: string };

interface Props {
    gangId: string;
    initialMembers?: MemberOption[];
    hasFinance?: boolean;
    hasExportCSV?: boolean;
}

export function FinanceClient({ gangId, initialMembers = [], hasFinance = true, hasExportCSV = true }: Props) {
    const [members, setMembers] = useState<MemberOption[]>(initialMembers);
    const [hasLoadedMembers, setHasLoadedMembers] = useState(initialMembers.length > 0);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isGangFeeOpen, setIsGangFeeOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isLoadingMembers, setIsLoadingMembers] = useState(false);
    const loadMembersPromise = useRef<Promise<boolean> | null>(null);

    const loadMembers = useCallback(async (silent = false) => {
        if (hasLoadedMembers) {
            return true;
        }

        if (loadMembersPromise.current) {
            return loadMembersPromise.current;
        }

        setIsLoadingMembers(true);
        loadMembersPromise.current = (async () => {
            try {
                const res = await fetch(`/api/gangs/${gangId}/members`, {
                    headers: { Accept: 'application/json' },
                });
                if (!res.ok) throw new Error('Member list failed');
                const data = await res.json();
                setMembers(Array.isArray(data.members) ? data.members : []);
                setHasLoadedMembers(true);
                return true;
            } catch (error) {
                logClientError('dashboard.finance.members.load.failed', error, { gangId });
                if (!silent) {
                    toast.error('โหลดรายชื่อสมาชิกไม่สำเร็จ');
                }
                return false;
            } finally {
                setIsLoadingMembers(false);
                loadMembersPromise.current = null;
            }
        })();

        return loadMembersPromise.current;
    }, [gangId, hasLoadedMembers]);

    useEffect(() => {
        if (hasFinance && !hasLoadedMembers) {
            void loadMembers(true);
        }
    }, [hasFinance, hasLoadedMembers, loadMembers]);

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

    const handleCreate = async () => {
        if (!hasFinance) {
            toast.error(PAYMENT_PAUSED_COPY.shortLabel, {
                description: PAYMENT_PAUSED_COPY.lockedFeature,
            });
            return;
        }
        if (await loadMembers()) {
            setIsModalOpen(true);
        }
    };

    const handleGangFee = async () => {
        if (!hasFinance) {
            toast.error(PAYMENT_PAUSED_COPY.shortLabel, {
                description: PAYMENT_PAUSED_COPY.lockedFeature,
            });
            return;
        }
        if (await loadMembers()) {
            setIsGangFeeOpen(true);
        }
    };

    const actionDisabled = isLoadingMembers || !hasFinance;

    return (
        <div className="grid w-full grid-cols-[1fr_1fr] gap-2 sm:flex sm:w-auto sm:min-w-0 sm:items-center sm:justify-end">
            <button
                onClick={handleExport}
                disabled={isExporting || !hasExportCSV}
                className={cn(
                    'inline-flex min-h-11 items-center justify-center gap-2 rounded-token-xl border px-3 text-xs font-black tracking-wide transition-colors sm:px-4',
                    hasExportCSV
                        ? 'border-border-subtle bg-bg-elevated text-fg-secondary shadow-token-sm hover:border-border hover:bg-bg-muted hover:text-fg-primary disabled:cursor-wait disabled:opacity-60'
                        : 'cursor-not-allowed border-border-subtle bg-bg-muted text-fg-tertiary opacity-60'
                )}
            >
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : hasExportCSV ? <Download className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                <span className="hidden sm:inline">{isExporting ? 'กำลัง Export' : hasExportCSV ? 'Export CSV' : 'Export Premium'}</span>
                <span className="sm:hidden">Export</span>
            </button>

            <button
                onClick={handleGangFee}
                disabled={actionDisabled}
                className={cn(
                    'inline-flex min-h-11 items-center justify-center gap-2 rounded-token-xl border px-3 text-xs font-black tracking-wide transition-colors sm:px-4',
                    hasFinance
                        ? 'border-border-accent bg-accent-subtle text-accent-bright shadow-token-sm hover:bg-accent hover:text-accent-fg disabled:cursor-wait disabled:opacity-70'
                        : 'cursor-not-allowed border-border-subtle bg-bg-muted text-fg-tertiary opacity-60'
                )}
            >
                {isLoadingMembers ? <Loader2 className="h-4 w-4 animate-spin" /> : hasFinance ? <ReceiptText className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                <span className="hidden sm:inline">เก็บเงินแก๊ง</span>
                <span className="sm:hidden">เก็บเงิน</span>
            </button>

            <button
                onClick={handleCreate}
                disabled={actionDisabled}
                className={cn(
                    'col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-token-xl px-3 text-xs font-black tracking-wide transition-colors sm:col-span-1 sm:px-5',
                    hasFinance
                        ? 'bg-accent text-accent-fg shadow-token-sm hover:bg-accent-hover disabled:cursor-wait disabled:opacity-70'
                        : 'cursor-not-allowed border border-border-subtle bg-bg-muted text-fg-tertiary opacity-60'
                )}
            >
                {isLoadingMembers ? <Loader2 className="h-4 w-4 animate-spin" /> : hasFinance ? <Plus className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                บันทึกรายการ
            </button>

            {hasFinance && hasLoadedMembers && (
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
