'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Megaphone, X, RefreshCw } from 'lucide-react';
import { logClientError } from '@/lib/clientLogger';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    gangId: string;
}

export function AnnouncementModal({ isOpen, onClose, gangId }: Props) {
    const router = useRouter();
    const [content, setContent] = useState('');
    const [mentionEveryone, setMentionEveryone] = useState(false);
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
                body: JSON.stringify({ content, mentionEveryone }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to post');
            }

            toast.success('ส่งประกาศเรียบร้อยแล้ว! 📢', {
                description: 'ประกาศถูกส่งไปยังห้อง Discord แล้ว',
            });
            const data = await res.json();
            const discordWarning = data?.discord?.warning as string | null | undefined;
            if (discordWarning) {
                toast.warning('Discord delivery needs review', {
                    description: mentionEveryone
                        ? 'If @everyone did not ping, check the bot Mention Everyone permission.'
                        : 'Check the announcement channel and bot token configuration.',
                });
            }

            setContent('');
            setMentionEveryone(false);
            onClose();
            router.refresh();
        } catch (error: any) {
            logClientError('dashboard.announcements.create.failed', error, { gangId, mentionEveryone });
            toast.error('ส่งประกาศไม่สำเร็จ', {
                description: error.message || 'กรุณาลองใหม่อีกครั้ง',
            });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-bg-overlay backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl shadow-token-lg p-6 w-full max-w-lg transform scale-100 transition-all animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-status-info-subtle rounded-token-xl">
                            <Megaphone className="w-6 h-6 text-fg-info" />

                        </div>
                        <div>
                            <h3 className="font-bold text-fg-primary text-lg">สร้างประกาศใหม่</h3>
                            <p className="text-fg-secondary text-sm">ส่งไปยังห้อง #ประกาศ</p>

                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-bg-muted rounded-token-lg text-fg-secondary hover:text-fg-primary transition-colors"

                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-fg-secondary mb-2">

                            เนื้อหาประกาศ
                        </label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="พิมพ์ข้อความประกาศที่นี่..."
                            rows={6}
                            className="w-full bg-bg-muted border border-border-subtle text-fg-primary rounded-token-xl px-4 py-3 focus:ring-2 focus:ring-status-info outline-none placeholder:text-fg-tertiary resize-none"

                            maxLength={2000}
                        />
                        <div className="flex justify-between text-xs text-fg-tertiary mt-1">

                            <span>บรรทัดแรกถูกจัดเป็นหัวข้อใน Discord</span>
                            <span>{content.length}/2000</span>
                        </div>
                    </div>

                    <label className="flex items-start gap-3 rounded-token-xl border border-border-subtle bg-bg-muted p-3 text-sm text-fg-secondary">
                        <input
                            type="checkbox"
                            checked={mentionEveryone}
                            onChange={(e) => setMentionEveryone(e.target.checked)}
                            className="mt-1 h-4 w-4 rounded-token-sm border-border-subtle bg-bg-muted text-status-info focus:ring-status-info"
                        />
                        <span className="space-y-1">
                            <span className="block font-semibold text-fg-primary">Mention @everyone</span>
                            <span className="block text-xs leading-relaxed text-fg-tertiary">
                                Sends a real @everyone ping only when enabled and the bot has Discord Mention Everyone permission.
                            </span>
                        </span>
                    </label>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSending}
                            className="flex-1 px-4 py-2.5 bg-bg-muted hover:bg-bg-raised text-fg-primary rounded-token-xl text-sm font-medium transition-colors disabled:opacity-50"

                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            disabled={isSending || !content.trim()}
                            className="flex-1 px-4 py-2.5 bg-status-info hover:brightness-110 text-fg-inverse rounded-token-xl text-sm font-bold transition-colors shadow-token-sm disabled:opacity-50 flex items-center justify-center gap-2"

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
