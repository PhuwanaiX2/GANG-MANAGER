'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Save, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    gangId: string;
}

export function CreateMemberModal({ isOpen, onClose, gangId }: Props) {
    const router = useRouter();
    const [name, setName] = useState('');
    const [discordUsername, setDiscordUsername] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const res = await fetch(`/api/gangs/${gangId}/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    discordUsername: discordUsername.trim() || undefined,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'สร้างสมาชิกไม่สำเร็จ');
            }

            toast.success('เพิ่มสมาชิกเรียบร้อยแล้ว');
            router.refresh();
            setName('');
            setDiscordUsername('');
            onClose();
        } catch (error: any) {
            toast.error('ไม่สามารถเพิ่มสมาชิกได้', {
                description: error.message,
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-bg-overlay backdrop-blur-sm p-2 animate-fade-in sm:items-center sm:p-4">
            <div className="bg-bg-subtle border border-border-subtle rounded-token-xl w-full max-w-md shadow-token-lg transform transition-all scale-100">
                <div className="flex justify-between items-start gap-3 p-4 sm:p-5 border-b border-border-subtle">
                    <h2 className="text-base font-bold text-fg-primary flex items-center gap-2">
                        <UserPlus className="w-4 h-4 text-brand-discord" />
                        เพิ่มสมาชิก
                    </h2>
                    <button onClick={onClose} className="h-11 w-11 -mt-2 -mr-2 flex items-center justify-center rounded-token-lg text-fg-secondary hover:bg-bg-muted hover:text-fg-primary transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-fg-secondary mb-1.5">ชื่อในแก๊ง (IC Name)</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full min-h-11 bg-bg-muted border border-border-subtle rounded-token-lg px-3 py-2 text-fg-primary focus:outline-none focus:border-brand-discord/50 transition-colors"
                            placeholder="ระบุชื่อสมาชิก..."
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-fg-secondary mb-1.5">Discord Username (ถ้ามี)</label>
                        <input
                            type="text"
                            value={discordUsername}
                            onChange={(e) => setDiscordUsername(e.target.value)}
                            className="w-full min-h-11 bg-bg-muted border border-border-subtle rounded-token-lg px-3 py-2 text-fg-primary focus:outline-none focus:border-brand-discord/50 transition-colors"
                            placeholder="เช่น phuwanai"
                        />
                    </div>

                    <div className="rounded-token-lg border border-status-info/20 bg-status-info-subtle px-3 py-2 text-[11px] text-fg-info leading-relaxed">
                        สมาชิกที่เพิ่มจากเว็บจะถูกสร้างเป็นสมาชิกใช้งานทันที และยังไม่เชื่อม Discord อัตโนมัติ
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="min-h-11 px-4 py-2 bg-bg-muted hover:bg-bg-raised text-fg-primary rounded-token-lg transition-colors text-sm font-medium disabled:opacity-60"
                            disabled={isLoading}
                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            className="min-h-11 flex items-center justify-center gap-2 px-4 py-2 bg-brand-discord hover:bg-brand-discord-hover text-fg-inverse rounded-token-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <span className="w-4 h-4 border-2 border-border-subtle border-t-fg-inverse rounded-token-full animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            <span>เพิ่มสมาชิก</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
