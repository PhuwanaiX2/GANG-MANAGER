'use client';

import Link from 'next/link';
import { AlertTriangle, Headphones, RotateCcw } from 'lucide-react';

export default function DashboardSegmentError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <section data-testid="dashboard-segment-error" className="min-w-0 rounded-token-2xl border border-status-danger/30 bg-bg-subtle p-5 shadow-token-sm sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-token-xl border border-status-danger/35 bg-status-danger-subtle">
                        <AlertTriangle className="h-5 w-5 text-fg-danger" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-fg-danger">Route error</p>
                    <h1 className="mt-2 font-heading text-xl font-black tracking-tight text-fg-primary">เปิดหน้านี้ไม่สำเร็จ</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-fg-secondary">
                        ลองโหลดข้อมูลใหม่อีกครั้ง หากยังเกิดซ้ำให้ส่งรายละเอียดเวลาและหน้าที่ใช้งานให้ทีมซัพพอร์ต
                    </p>
                    {error.digest ? (
                        <p className="mt-3 font-mono text-[10px] text-fg-tertiary">Support digest: {error.digest}</p>
                    ) : null}
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                    <button
                        onClick={() => reset()}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-token-lg border border-border-accent bg-accent px-4 text-sm font-black text-accent-fg shadow-token-sm transition hover:brightness-110"
                    >
                        <RotateCcw className="h-4 w-4" />
                        ลองใหม่
                    </button>
                    <Link
                        href="/support"
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-token-lg border border-border-subtle bg-bg-muted px-4 text-sm font-black text-fg-secondary transition hover:text-fg-primary"
                    >
                        <Headphones className="h-4 w-4" />
                        ซัพพอร์ต
                    </Link>
                </div>
            </div>
        </section>
    );
}
