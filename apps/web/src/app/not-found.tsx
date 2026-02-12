import Link from 'next/link';
import { FileQuestion, ArrowLeft } from 'lucide-react';

export default function NotFound() {
    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
            <div className="text-center space-y-6">
                <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/10">
                    <FileQuestion className="w-12 h-12 text-gray-400" />
                </div>

                <h2 className="text-3xl font-bold">ไม่พบหน้านี้ (404)</h2>
                <p className="text-gray-400 max-w-sm mx-auto">
                    หน้าที่คุณกำลังตามหาอาจถูกลบ ย้าย หรือไม่มีอยู่จริง
                </p>

                <Link
                    href="/"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    กลับสู่หน้าหลัก
                </Link>
            </div>
        </div>
    );
}
