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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-[#151515] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl transform transition-all scale-100">
                <div className="flex justify-between items-center p-6 border-b border-white/5">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-discord-primary" />
                        เพิ่มสมาชิก
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">ชื่อในแก๊ง (IC Name)</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-discord-primary/50 transition-colors"
                            placeholder="ระบุชื่อสมาชิก..."
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Discord Username (ถ้ามี)</label>
                        <input
                            type="text"
                            value={discordUsername}
                            onChange={(e) => setDiscordUsername(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-discord-primary/50 transition-colors"
                            placeholder="เช่น phuwanai"
                        />
                    </div>

                    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-xs text-blue-200/90 leading-relaxed">
                        สมาชิกที่เพิ่มจากเว็บจะถูกสร้างเป็นสมาชิกใช้งานทันที และยังไม่เชื่อม Discord อัตโนมัติ
                    </div>

                    <div className="flex gap-3 pt-2 justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm font-medium"
                            disabled={isLoading}
                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            className="flex items-center gap-2 px-6 py-2 bg-discord-primary hover:bg-[#4752C4] text-white rounded-xl font-medium transition-all shadow-lg shadow-discord-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
