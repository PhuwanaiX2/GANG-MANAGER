
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Info, Key, Edit2, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface GangProps {
    id: string;
    name: string;
    subscriptionTier: 'FREE' | 'TRIAL' | 'PRO';
    discordGuildId: string;
}

interface Props {
    gang: GangProps;
}

export function GangProfileClient({ gang }: Props) {
    const router = useRouter();
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(gang.name);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!name.trim()) return;
        if (name === gang.name) {
            setIsEditing(false);
            return;
        }

        const confirmed = window.confirm(`คุณต้องการเปลี่ยนชื่อแก๊งเป็น "${name}" ใช่หรือไม่?`);
        if (!confirmed) return;

        setIsSaving(true);
        try {
            const res = await fetch(`/api/gangs/${gang.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to update gang name');
            }

            toast.success('อัปเดตชื่อแก๊งเรียบร้อย');
            setIsEditing(false);
            router.refresh();
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-[#151515] p-6 rounded-2xl border border-white/5 shadow-xl">
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-white border-b border-white/5 pb-4">
                <Info className="w-5 h-5 text-blue-400" />
                ข้อมูลแก๊ง
            </h3>
            <div className="space-y-4">
                {/* Gang Name */}
                <div className="flex flex-col gap-2 p-3 rounded-xl bg-black/20">
                    <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">ชื่อแก๊ง</span>
                        {!isEditing ? (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                                title="แก้ไขชื่อแก๊ง"
                            >
                                <Edit2 className="w-3.5 h-3.5" />
                            </button>
                        ) : (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="p-1.5 hover:bg-green-500/20 rounded-lg text-green-400 transition-colors"
                                >
                                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                    onClick={() => {
                                        setIsEditing(false);
                                        setName(gang.name);
                                    }}
                                    disabled={isSaving}
                                    className="p-1.5 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                    </div>
                    {isEditing ? (
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-white font-medium focus:outline-none focus:border-blue-500/50 w-full"
                            placeholder="ใส่ชื่อแก๊ง..."
                            autoFocus
                        />
                    ) : (
                        <span className="font-medium text-white px-1">{gang.name}</span>
                    )}
                </div>

                {/* Subscription */}
                <div className="flex justify-between items-center p-3 rounded-xl bg-black/20">
                    <span className="text-gray-400 text-sm">Subscription</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${gang.subscriptionTier === 'PRO' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' : 'bg-gray-500/10 text-gray-400'}`}>
                        {gang.subscriptionTier}
                    </span>
                </div>

                {/* Gang ID */}
                <div className="flex flex-col gap-2 p-3 rounded-xl bg-black/20">
                    <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">Gang ID</span>
                        <Key className="w-3 h-3 text-gray-500" />
                    </div>
                    <span className="font-mono text-xs text-gray-500 break-all bg-black/30 p-2 rounded border border-white/5 select-all">
                        {gang.id}
                    </span>
                </div>
            </div>
        </div>
    );
}
