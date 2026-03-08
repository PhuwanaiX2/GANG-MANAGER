'use client';

import { useState } from 'react';
import { Plus, Download, Lock, Coins } from 'lucide-react';
import { toast } from 'sonner';
import { CreateTransactionModal } from '@/components/modals/CreateTransactionModal';
import { CreateGangFeeModal } from '@/components/modals/CreateGangFeeModal';

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
            toast.error('ฟีเจอร์ Export CSV ต้องใช้แพลน PRO ขึ้นไป');
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
        } catch (e) {
            console.error('Export error:', e);
        } finally {
            setIsExporting(false);
        }
    };

    const handleCreate = () => {
        if (!hasFinance) {
            toast.error('ฟีเจอร์การเงินต้องใช้แพลน Trial ขึ้นไป');
            return;
        }
        setIsModalOpen(true);
    };

    const handleGangFee = () => {
        if (!hasFinance) {
            toast.error('ฟีเจอร์การเงินต้องใช้แพลน Trial ขึ้นไป');
            return;
        }
        setIsGangFeeOpen(true);
    };

    return (
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <button
                onClick={handleExport}
                disabled={isExporting}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 border ${hasExportCSV
                    ? 'bg-[#111] text-zinc-300 hover:bg-[#1a1a1a] hover:text-white border-white/10 hover:border-white/20 disabled:opacity-50 shadow-sm'
                    : 'bg-black/20 text-zinc-600 border-white/5 cursor-not-allowed'
                    }`}
            >
                {hasExportCSV ? <Download className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" /> : <Lock className="w-4 h-4" />}
                <span className="hidden sm:inline">{isExporting ? 'กำลังดาวน์โหลด...' : hasExportCSV ? 'Export CSV' : 'Export (PRO)'}</span>
                <span className="sm:hidden">{isExporting ? '...' : 'Export'}</span>
            </button>

            <button
                onClick={handleGangFee}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${hasFinance
                    ? 'bg-purple-600 text-white hover:bg-purple-500 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 hover:scale-[1.02] active:scale-[0.98]'
                    : 'bg-purple-500/10 text-purple-900 cursor-not-allowed border border-purple-500/10'
                    }`}
            >
                {hasFinance ? <Coins className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                <span className="hidden sm:inline">เก็บเงินแก๊ง</span>
                <span className="sm:hidden">เก็บเงิน</span>
            </button>

            <button
                onClick={handleCreate}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${hasFinance
                    ? 'bg-white text-black hover:bg-zinc-200 shadow-sm hover:shadow-white/10 hover:scale-[1.02] active:scale-[0.98]'
                    : 'bg-white/10 text-zinc-500 cursor-not-allowed border border-white/5'
                    }`}
            >
                {hasFinance ? <Plus className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                สร้างรายการ
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
