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

            if (!res.ok) throw new Error('บันทึกข้อมูลสมาชิกไม่สำเร็จ');

            toast.success('บันทึกข้อมูลสมาชิกแล้ว');
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
        <div className="fixed inset-0 z-[140] flex items-end justify-center bg-bg-overlay backdrop-blur-sm p-2 animate-fade-in sm:items-center sm:p-4">
            <div className="w-full max-w-md rounded-token-xl border border-border-subtle bg-bg-subtle shadow-token-lg">
                <div className="flex justify-between items-start gap-3 p-4 sm:p-5 border-b border-border-subtle">
                    <h2 className="text-base font-bold text-fg-primary flex items-center gap-2">
                        <User className="w-4 h-4 text-brand-discord" />
                        แก้ไขสมาชิก
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
                            placeholder="ระบุชื่อ..."
                            required
                        />
                    </div>

                    <div className="flex items-center justify-between gap-3 p-3 bg-bg-muted rounded-token-lg border border-border-subtle">
                        <div className="min-w-0 flex flex-col">
                            <span className="text-sm font-medium text-fg-primary">สถานะใช้งาน</span>
                            <span className="text-xs text-fg-tertiary">
                                {member.gangRole === 'OWNER' ? 'ไม่สามารถปิดการใช้งานหัวหน้าแก๊งได้' : 'เปิด/ปิดการใช้งานสมาชิกคนนี้'}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => member.gangRole !== 'OWNER' && setIsActive(!isActive)}
                            disabled={member.gangRole === 'OWNER'}
                            className={`h-11 w-11 shrink-0 flex items-center justify-center rounded-token-lg transition-colors ${member.gangRole === 'OWNER' ? 'text-fg-success/30 cursor-not-allowed' : isActive ? 'text-fg-success hover:bg-status-success-subtle' : 'text-fg-tertiary hover:bg-bg-raised'}`}
                        >
                            {isActive ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
                        </button>
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
                            <span>บันทึกข้อมูล</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
