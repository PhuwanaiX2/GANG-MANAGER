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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-overlay backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl w-full max-w-md shadow-token-lg transform transition-all scale-100">
                <div className="flex justify-between items-center p-6 border-b border-border-subtle">
                    <h2 className="text-xl font-bold text-fg-primary flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-brand-discord" />
                        เพิ่มสมาชิก
                    </h2>
                    <button onClick={onClose} className="text-fg-secondary hover:text-fg-primary transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-fg-secondary mb-2">ชื่อในแก๊ง (IC Name)</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-bg-muted border border-border-subtle rounded-token-xl px-4 py-2 text-fg-primary focus:outline-none focus:border-brand-discord/50 transition-colors"
                            placeholder="ระบุชื่อสมาชิก..."
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-fg-secondary mb-2">Discord Username (ถ้ามี)</label>
                        <input
                            type="text"
                            value={discordUsername}
                            onChange={(e) => setDiscordUsername(e.target.value)}
                            className="w-full bg-bg-muted border border-border-subtle rounded-token-xl px-4 py-2 text-fg-primary focus:outline-none focus:border-brand-discord/50 transition-colors"
                            placeholder="เช่น phuwanai"
                        />
                    </div>

                    <div className="rounded-token-xl border border-status-info/20 bg-status-info-subtle px-4 py-3 text-xs text-fg-info leading-relaxed">
                        สมาชิกที่เพิ่มจากเว็บจะถูกสร้างเป็นสมาชิกใช้งานทันที และยังไม่เชื่อม Discord อัตโนมัติ
                    </div>

                    <div className="flex gap-3 pt-2 justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-fg-secondary hover:text-fg-primary transition-colors text-sm font-medium"
                            disabled={isLoading}
                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            className="flex items-center gap-2 px-6 py-2 bg-brand-discord hover:bg-brand-discord-hover text-fg-inverse rounded-token-xl font-medium transition-all shadow-token-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
