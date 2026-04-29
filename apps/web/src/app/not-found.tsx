import Link from 'next/link';
import { FileQuestion, ArrowLeft } from 'lucide-react';

export default function NotFound() {
    return (
        <div className="min-h-screen bg-bg text-fg-primary flex flex-col items-center justify-center p-4">
            <div className="text-center space-y-6">
                <div className="w-24 h-24 bg-bg-muted rounded-token-full flex items-center justify-center mx-auto border border-border-subtle">
                    <FileQuestion className="w-12 h-12 text-fg-secondary" />
                </div>

                <h2 className="text-3xl font-bold">ไม่พบหน้านี้ (404)</h2>
                <p className="text-fg-secondary max-w-sm mx-auto">
                    หน้าที่คุณกำลังตามหาอาจถูกลบ ย้าย หรือไม่มีอยู่จริง
                </p>

                <Link
                    href="/"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-fg-inverse font-semibold rounded-token-lg hover:brightness-110 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    กลับสู่หน้าหลัก
                </Link>
            </div>
        </div>
    );
}
