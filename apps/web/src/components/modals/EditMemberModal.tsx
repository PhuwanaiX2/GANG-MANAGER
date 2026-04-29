'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Save, User, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';

interface Member {
    id: string;
    name: string;

    isActive: boolean;
    balance: number;
    gangRole?: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    member: Member;
    gangId: string;
}

export function EditMemberModal({ isOpen, onClose, member, gangId }: Props) {
    const router = useRouter();

    const [name, setName] = useState(member.name);
    const [isActive, setIsActive] = useState(member.isActive);
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const res = await fetch(`/api/gangs/${gangId}/members/${member.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, isActive }),
            });

            if (!res.ok) throw new Error('Failed to update');

            router.refresh();
            onClose();
        } catch (error) {
            console.error(error);
            toast.error('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-overlay backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl w-full max-w-md shadow-token-lg transform transition-all scale-100">
                <div className="flex justify-between items-center p-6 border-b border-border-subtle">
                    <h2 className="text-xl font-bold text-fg-primary flex items-center gap-2">
                        <User className="w-5 h-5 text-brand-discord" />
                        แก้ไขสมาชิก
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
                            placeholder="ระบุชื่อ..."
                            required
                        />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-bg-muted rounded-token-xl border border-border-subtle">
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-fg-primary">สถานะ Active</span>
                            <span className="text-xs text-fg-tertiary">
                                {member.gangRole === 'OWNER' ? 'ไม่สามารถปิด Active ของหัวหน้าแก๊งได้' : 'เปิด/ปิด การใช้งานสมาชิกคนนี้'}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => member.gangRole !== 'OWNER' && setIsActive(!isActive)}
                            disabled={member.gangRole === 'OWNER'}
                            className={`transition-colors ${member.gangRole === 'OWNER' ? 'text-fg-success/30 cursor-not-allowed' : isActive ? 'text-fg-success' : 'text-fg-tertiary'}`}
                        >
                            {isActive ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                        </button>
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
                            <span>บันทึกข้อมูล</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
