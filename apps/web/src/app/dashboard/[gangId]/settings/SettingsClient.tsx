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
            <div className="relative overflow-hidden rounded-token-2xl border border-status-danger bg-status-danger-subtle p-6">
                <div className="absolute right-0 top-0 p-4 opacity-5">
                    <AlertTriangle className="h-32 w-32 text-fg-danger" />
                </div>

                <h3 className="mb-2 flex items-center gap-2 text-lg font-bold text-fg-danger">
                    <AlertTriangle className="h-5 w-5" />
                    Danger Zone
                </h3>
                <p className="mb-6 max-w-xl text-sm text-fg-secondary">
                    การกระทำในส่วนนี้กระทบข้อมูลสำคัญของแก๊งโดยตรง เช่น การย้ายเซิร์ฟเวอร์หรือการยุบแก๊ง โปรดใช้เฉพาะตอนที่ตรวจสอบแล้วเท่านั้น
                </p>

                <div className="flex justify-end">
                    <button
                        onClick={() => setIsDissolveModalOpen(true)}
                        className="flex items-center gap-2 rounded-token-xl border border-status-danger bg-status-danger-subtle px-6 py-2.5 font-bold text-fg-danger transition-all hover:brightness-110 hover:shadow-token-md"
                    >
                        <AlertTriangle className="h-4 w-4" />
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
