'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Save, User, ToggleLeft, ToggleRight } from 'lucide-react';

interface Member {
    id: string;
    name: string;

    isActive: boolean;
    balance: number;
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
            alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-[#151515] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl transform transition-all scale-100">
                <div className="flex justify-between items-center p-6 border-b border-white/5">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <User className="w-5 h-5 text-discord-primary" />
                        แก้ไขสมาชิก
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
                            placeholder="ระบุชื่อ..."
                            required
                        />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-black/20 rounded-xl border border-white/5">
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-white">สถานะ Active</span>
                            <span className="text-xs text-gray-500">เปิด/ปิด การใช้งานสมาชิกคนนี้</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsActive(!isActive)}
                            className={`transition-colors ${isActive ? 'text-green-400' : 'text-gray-600'}`}
                        >
                            {isActive ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                        </button>
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
                            <span>บันทึกข้อมูล</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
