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
            <div className="overflow-hidden rounded-token-xl border border-status-danger bg-bg-subtle shadow-token-sm">
                <div className="border-b border-status-danger bg-status-danger-subtle px-4 py-4 sm:px-5">
                    <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-token-lg border border-status-danger bg-bg-subtle text-fg-danger">
                            <AlertTriangle className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                            <h3 className="text-base font-black text-fg-danger">พื้นที่เสี่ยงสูง</h3>
                            <p className="mt-1 text-xs leading-5 text-fg-secondary">
                                ใช้เฉพาะงานที่กระทบข้อมูลทั้งแก๊ง ทุกปุ่มในส่วนนี้เป็น Owner-only
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-4 sm:p-5">
                    <p className="text-sm leading-6 text-fg-secondary">
                        การยุบแก๊งถาวรจะลบพื้นที่ใช้งานของแก๊งนี้และย้อนกลับเองไม่ได้ ควรใช้เฉพาะกรณีที่ยืนยันกับทีมแล้วเท่านั้น
                    </p>
                    <button
                        onClick={() => setIsDissolveModalOpen(true)}
                        className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-token-lg border border-status-danger bg-status-danger-subtle px-4 py-2.5 text-sm font-black text-fg-danger transition-colors hover:opacity-90"
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
