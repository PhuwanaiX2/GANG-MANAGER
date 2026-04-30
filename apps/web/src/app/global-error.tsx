'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html lang="th">
            <body className="bg-bg-base text-fg-primary">
                <div className="flex min-h-screen w-full items-center justify-center p-4">
                    <div data-testid="safe-global-error" className="relative w-full max-w-lg overflow-hidden rounded-token-2xl border border-status-danger bg-bg-subtle p-6 text-center shadow-token-lg sm:p-8">
                        <div className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-token-full bg-status-danger-subtle blur-3xl" />
                        <div className="relative">
                            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-token-2xl border border-status-danger bg-status-danger-subtle">
                                <AlertTriangle className="h-7 w-7 text-fg-danger" />
                            </div>
                            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.24em] text-fg-tertiary">Critical Error</p>
                            <h2 className="font-heading text-2xl font-black text-fg-primary">ระบบขัดข้องชั่วคราว</h2>
                            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-fg-secondary">
                                หน้าเว็บโหลดไม่สำเร็จ กรุณาลองโหลดใหม่ หากยังเกิดซ้ำให้แจ้งผู้ดูแลพร้อมเวลาที่พบปัญหา
                            </p>
                            {error.digest && (
                                <p className="mt-3 font-mono text-[10px] text-fg-tertiary">Ref: {error.digest}</p>
                            )}
                            <button
                                onClick={() => reset()}
                                className="mt-6 inline-flex items-center justify-center gap-2 rounded-token-xl border border-border-accent bg-accent px-4 py-2.5 text-sm font-bold text-accent-fg shadow-token-sm transition hover:brightness-110"
                            >
                                <RotateCcw className="h-4 w-4" />
                                โหลดใหม่
                            </button>
                        </div>
                    </div>
                </div>
            </body>
        </html>
    );
}
