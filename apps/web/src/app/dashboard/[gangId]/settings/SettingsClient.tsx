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
            <div className="relative overflow-hidden rounded-token-xl border border-status-danger bg-status-danger-subtle p-4 sm:p-5">
                <h3 className="mb-2 flex items-center gap-2 text-lg font-bold text-fg-danger">
                    <AlertTriangle className="h-5 w-5" />
                    Danger Zone
                </h3>
                <p className="mb-5 max-w-xl text-sm text-fg-secondary">
                    การกระทำในส่วนนี้กระทบข้อมูลสำคัญของแก๊งโดยตรง เช่น การย้ายเซิร์ฟเวอร์หรือการยุบแก๊ง โปรดใช้เฉพาะตอนที่ตรวจสอบแล้วเท่านั้น
                </p>

                <div className="flex justify-end">
                    <button
                        onClick={() => setIsDissolveModalOpen(true)}
                        className="flex min-h-11 items-center gap-2 rounded-token-lg border border-status-danger bg-status-danger-subtle px-4 py-2.5 text-sm font-bold text-fg-danger transition-colors hover:opacity-90"
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
