'use client';

import { useState } from 'react';
import { Plus, Download, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { CreateTransactionModal } from '@/components/modals/CreateTransactionModal';

interface Props {
    gangId: string;
    members: { id: string; name: string }[];
    hasFinance?: boolean;
    hasExportCSV?: boolean;
}

export function FinanceClient({ gangId, members, hasFinance = true, hasExportCSV = true }: Props) {
    const [isModalOpen, setIsModalOpen] = useState(false);
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

    return (
        <div className="flex items-center gap-3">
            <button
                onClick={handleExport}
                disabled={isExporting}
                className={`px-4 py-2 rounded-2xl font-bold transition-colors flex items-center gap-2 border ${hasExportCSV
                    ? 'bg-white/5 text-gray-300 hover:bg-white/10 border-white/10 disabled:opacity-50'
                    : 'bg-white/[0.02] text-gray-600 border-white/5 cursor-not-allowed'
                }`}
            >
                {hasExportCSV ? <Download className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
                {isExporting ? 'กำลังดาวน์โหลด...' : hasExportCSV ? 'Export CSV' : 'Export (PRO)'}
            </button>

            <button
                onClick={handleCreate}
                className={`px-4 py-2 rounded-2xl font-bold transition-colors flex items-center gap-2 ${hasFinance
                    ? 'bg-white text-black hover:bg-gray-200 shadow-lg shadow-white/5'
                    : 'bg-white/10 text-gray-500 cursor-not-allowed'
                }`}
            >
                {hasFinance ? <Plus className="w-5 h-5" /> : <Lock className="w-4 h-4" />}
                สร้างรายการ
            </button>

            {hasFinance && (
                <CreateTransactionModal
                    gangId={gangId}
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    members={members}
                />
            )}
        </div>
    );
}
