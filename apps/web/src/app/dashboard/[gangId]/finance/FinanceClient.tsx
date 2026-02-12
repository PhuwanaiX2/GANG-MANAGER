'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { CreateTransactionModal } from '@/components/modals/CreateTransactionModal';

interface Props {
    gangId: string;
    members: { id: string; name: string }[];
}

export function FinanceClient({ gangId, members }: Props) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setIsModalOpen(true)}
                className="bg-white text-black px-4 py-2 rounded-2xl font-bold hover:bg-gray-200 transition-colors flex items-center gap-2 shadow-lg shadow-white/5"
            >
                <Plus className="w-5 h-5" />
                สร้างรายการ
            </button>

            <CreateTransactionModal
                gangId={gangId}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                members={members}
            />
        </>
    );
}
