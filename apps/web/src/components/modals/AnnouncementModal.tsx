'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Megaphone, X, RefreshCw } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    gangId: string;
}

export function AnnouncementModal({ isOpen, onClose, gangId }: Props) {
    const router = useRouter();
    const [content, setContent] = useState('');
    const [isSending, setIsSending] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim()) {
            toast.error('กรุณากรอกเนื้อหาประกาศ');
            return;
        }

        setIsSending(true);
        try {
            const res = await fetch(`/api/gangs/${gangId}/announcements`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to post');
            }

            toast.success('ส่งประกาศเรียบร้อยแล้ว! 📢', {
                description: 'ประกาศถูกส่งไปยังห้อง Discord แล้ว',
            });
            setContent('');
            onClose();
            router.refresh();
        } catch (error: any) {
            console.error(error);
            toast.error('ส่งประกาศไม่สำเร็จ', {
                description: error.message || 'กรุณาลองใหม่อีกครั้ง',
            });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#111111] border border-white/10 rounded-2xl shadow-2xl p-6 w-full max-w-lg transform scale-100 transition-all animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-xl">
                            <Megaphone className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-lg">สร้างประกาศใหม่</h3>
                            <p className="text-gray-400 text-sm">ส่งไปยังห้อง #ประกาศ</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            เนื้อหาประกาศ
                        </label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="พิมพ์ข้อความประกาศที่นี่..."
                            rows={6}
                            className="w-full bg-black/30 border border-white/10 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-gray-600 resize-none"
                            maxLength={2000}
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>บรรทัดแรกใหญ่ + @everyone อัตโนมัติ</span>
                            <span>{content.length}/2000</span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSending}
                            className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            disabled={isSending || !content.trim()}
                            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSending ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    กำลังส่ง...
                                </>
                            ) : (
                                <>
                                    <Megaphone className="w-4 h-4" />
                                    ส่งประกาศ
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
