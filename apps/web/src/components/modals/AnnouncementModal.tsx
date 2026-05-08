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
                throw new Error(data.error || 'ส่งประกาศไม่สำเร็จ');
            }

            toast.success('ส่งประกาศเรียบร้อยแล้ว! 📢', {
                description: 'ประกาศถูกส่งไปยังห้อง Discord แล้ว',
            });
            const data = await res.json();
            const discordWarning = data?.discord?.warning as string | null | undefined;
            if (discordWarning) {
                toast.warning('ส่งประกาศแล้ว แต่ควรตรวจห้อง Discord อีกครั้ง', {
                    description: mentionEveryone
                        ? 'ถ้า @everyone ไม่แจ้งเตือน ให้ตรวจสิทธิ์ Mention Everyone ของบอท'
                        : 'ถ้าไม่เห็นประกาศใน Discord ให้ตรวจห้องประกาศและสิทธิ์ของบอท',
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
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-2 bg-bg-overlay backdrop-blur-sm animate-in fade-in duration-200 sm:items-center sm:p-4">
            <div className="max-h-[calc(100dvh-1rem)] w-full max-w-lg overflow-y-auto rounded-token-xl border border-border-subtle bg-bg-subtle p-4 shadow-token-lg animate-in zoom-in-95 duration-200 sm:p-5">

                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="min-w-0 flex items-start gap-2.5">
                        <div className="mt-0.5 h-8 w-8 shrink-0 flex items-center justify-center bg-status-info-subtle rounded-token-lg">
                            <Megaphone className="w-4 h-4 text-fg-info" />

                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-fg-primary text-base">สร้างประกาศใหม่</h3>
                            <p className="text-fg-secondary text-xs">ส่งไปยังห้อง #ประกาศ</p>

                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="h-11 w-11 shrink-0 flex items-center justify-center hover:bg-bg-muted rounded-token-lg text-fg-secondary hover:text-fg-primary transition-colors"

                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-fg-secondary mb-1.5">

                            เนื้อหาประกาศ
                        </label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="พิมพ์ข้อความประกาศที่นี่..."
                            rows={5}
                            className="w-full min-h-36 bg-bg-muted border border-border-subtle text-fg-primary rounded-token-lg px-3 py-2.5 focus:ring-2 focus:ring-status-info outline-none placeholder:text-fg-tertiary resize-none"

                            maxLength={2000}
                        />
                        <div className="flex justify-between gap-3 text-[11px] text-fg-tertiary mt-1">

                            <span className="min-w-0">บรรทัดแรกถูกจัดเป็นหัวข้อใน Discord</span>
                            <span className="shrink-0 tabular-nums">{content.length}/2000</span>
                        </div>
                    </div>

                    <label className="flex items-start gap-3 rounded-token-lg border border-border-subtle bg-bg-muted p-2.5 text-sm text-fg-secondary">
                        <input
                            type="checkbox"
                            checked={mentionEveryone}
                            onChange={(e) => setMentionEveryone(e.target.checked)}
                            className="mt-1 h-4 w-4 rounded-token-sm border-border-subtle bg-bg-muted text-status-info focus:ring-status-info"
                        />
                        <span className="space-y-1">
                            <span className="block font-semibold text-fg-primary">แจ้งเตือน @everyone</span>
                            <span className="block text-xs leading-relaxed text-fg-tertiary">
                                ระบบจะ ping ทุกคนเฉพาะตอนเปิดตัวเลือกนี้ และบอทมีสิทธิ์ Mention Everyone ใน Discord
                            </span>
                        </span>
                    </label>

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSending}
                            className="min-h-11 px-4 py-2 bg-bg-muted hover:bg-bg-raised text-fg-primary rounded-token-lg text-sm font-medium transition-colors disabled:opacity-50"

                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            disabled={isSending || !content.trim()}
                            className="flex min-h-11 items-center justify-center gap-2 rounded-token-lg bg-status-info px-4 py-2 text-sm font-bold text-fg-inverse transition-colors hover:brightness-105 disabled:opacity-50"

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
