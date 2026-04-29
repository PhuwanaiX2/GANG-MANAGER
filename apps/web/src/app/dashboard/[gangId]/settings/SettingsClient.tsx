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
            <div className="bg-status-danger-subtle border border-status-danger rounded-token-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                    <AlertTriangle className="w-32 h-32 text-fg-danger" />
                </div>

                <h3 className="font-bold text-lg mb-2 text-fg-danger flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Danger Zone
                </h3>
                <p className="text-fg-secondary text-sm mb-6 max-w-xl">
                    การกระทำในส่วนนี้กระทบข้อมูลสำคัญของแก๊งโดยตรง เช่น การย้ายเซิร์ฟเวอร์หรือการยุบแก๊ง โปรดใช้เฉพาะตอนที่ตรวจสอบแล้วเท่านั้น
                </p>

                <div className="flex justify-end">
                    <button
                        onClick={() => setIsDissolveModalOpen(true)}
                        className="bg-status-danger-subtle hover:brightness-110 text-fg-danger border border-status-danger px-6 py-2.5 rounded-token-xl font-bold transition-all hover:shadow-token-md flex items-center gap-2"
                    >
                        <AlertTriangle className="w-4 h-4" />
                        ยุบแก๊งถาวร
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
