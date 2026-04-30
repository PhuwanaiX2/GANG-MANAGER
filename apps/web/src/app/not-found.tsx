import Link from 'next/link';
import { ArrowLeft, FileQuestion, Headphones } from 'lucide-react';

export default function NotFound() {
    return (
        <div className="min-h-screen bg-bg-base text-fg-primary flex items-center justify-center p-4">
            <div data-testid="safe-not-found" className="relative w-full max-w-lg overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle p-6 text-center shadow-token-lg sm:p-8">
                <div className="pointer-events-none absolute -left-20 -top-20 h-44 w-44 rounded-token-full bg-accent-subtle blur-3xl" />
                <div className="relative">
                    <div className="w-16 h-16 bg-bg-muted rounded-token-2xl flex items-center justify-center mx-auto border border-border-subtle shadow-token-sm">
                        <FileQuestion className="w-8 h-8 text-fg-secondary" />
                    </div>

                    <p className="mt-5 text-[10px] font-black uppercase tracking-[0.24em] text-fg-tertiary">404</p>
                    <h2 className="mt-2 font-heading text-3xl font-black">ไม่พบหน้านี้</h2>
                    <p className="mt-3 text-sm leading-relaxed text-fg-secondary max-w-sm mx-auto">
                        ลิงก์นี้อาจถูกลบ ย้าย หรือคุณอาจยังไม่มีสิทธิ์เข้าถึงหน้าดังกล่าว
                    </p>

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                        <Link
                            href="/"
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-accent text-accent-fg font-bold rounded-token-xl border border-border-accent shadow-token-sm hover:brightness-110 transition"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            กลับหน้าหลัก
                        </Link>
                        <Link
                            href="/support"
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-bg-muted text-fg-secondary font-bold rounded-token-xl border border-border-subtle hover:text-fg-primary transition"
                        >
                            <Headphones className="w-4 h-4" />
                            ขอความช่วยเหลือ
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
