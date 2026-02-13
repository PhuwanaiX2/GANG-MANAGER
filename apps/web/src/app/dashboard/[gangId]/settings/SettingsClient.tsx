'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { DissolveGangModal } from './DissolveGangModal';

interface Props {
    gangId: string;
    gangName: string;
}

export function SettingsClient({ gangId, gangName }: Props) {
    const [isDissolveModalOpen, setIsDissolveModalOpen] = useState(false);

    return (
        <div>
            <div className="bg-red-950/10 border border-red-900/30 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                    <AlertTriangle className="w-32 h-32 text-red-500" />
                </div>

                <h3 className="font-bold text-lg mb-2 text-red-500 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Danger Zone
                </h3>
                <p className="text-gray-400 text-sm mb-6 max-w-xl">
                    การกระทำในส่วนนี้จะลบข้อมูลแก๊ง สมาชิก และประวัติทั้งหมดอย่างถาวร ไม่สามารถกู้คืนได้
                </p>

                <div className="flex justify-end">
                    <button
                        onClick={() => setIsDissolveModalOpen(true)}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50 px-6 py-2.5 rounded-xl font-bold transition-all hover:shadow-lg hover:shadow-red-900/20 flex items-center gap-2"
                    >
                        <AlertTriangle className="w-4 h-4" />
                        ยุบแก๊งถาวร (Delete Gang)
                    </button>
                </div>
            </div>

            <DissolveGangModal
                gangId={gangId}
                gangName={gangName}
                isOpen={isDissolveModalOpen}
                onClose={() => setIsDissolveModalOpen(false)}
            />
        </div>
    );
}
