'use client';

import Link from 'next/link';
import { AlertTriangle, Headphones, RotateCcw } from 'lucide-react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="min-h-screen bg-bg-base text-fg-primary flex items-center justify-center p-4">
            <div data-testid="safe-route-error" className="relative w-full max-w-lg overflow-hidden rounded-token-2xl border border-status-danger bg-bg-subtle p-6 text-center shadow-token-lg sm:p-8">
                <div className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-token-full bg-status-danger-subtle blur-3xl" />
                <div className="relative">
                    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-token-2xl border border-status-danger bg-status-danger-subtle">
                        <AlertTriangle className="h-7 w-7 text-fg-danger" />
                    </div>
                    <p className="mb-2 text-[10px] font-black uppercase tracking-[0.24em] text-fg-tertiary">Route Error</p>
                    <h2 className="font-heading text-2xl font-black text-fg-primary">เกิดข้อผิดพลาดชั่วคราว</h2>
                    <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-fg-secondary">
                        ระบบไม่สามารถเปิดหน้านี้ได้ในตอนนี้ ลองโหลดใหม่อีกครั้ง หากยังเกิดซ้ำให้ติดต่อผู้ดูแลพร้อมเวลาที่พบปัญหา
                    </p>
                    {error.digest && (
                        <p className="mt-3 font-mono text-[10px] text-fg-tertiary">Ref: {error.digest}</p>
                    )}
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                        <button
                            onClick={() => reset()}
                            className="inline-flex items-center justify-center gap-2 rounded-token-xl border border-border-accent bg-accent px-4 py-2.5 text-sm font-bold text-accent-fg shadow-token-sm transition hover:brightness-110"
                        >
                            <RotateCcw className="h-4 w-4" />
                            ลองใหม่
                        </button>
                        <Link
                            href="/support"
                            className="inline-flex items-center justify-center gap-2 rounded-token-xl border border-border-subtle bg-bg-muted px-4 py-2.5 text-sm font-bold text-fg-secondary transition hover:text-fg-primary"
                        >
                            <Headphones className="h-4 w-4" />
                            ติดต่อช่วยเหลือ
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
