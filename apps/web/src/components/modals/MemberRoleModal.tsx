'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserCog, Crown, Shield, Wallet, User, X, RefreshCw } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    member: {
        id: string;
        name: string;
        gangRole?: string;
    };
    gangId: string;
}

const ROLES = [
    { key: 'MEMBER', label: 'สมาชิก', icon: User, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    { key: 'ADMIN', label: 'แอดมิน', icon: Shield, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
    { key: 'TREASURER', label: 'เหรัญญิก', icon: Wallet, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
];

export function MemberRoleModal({ isOpen, onClose, member, gangId }: Props) {
    const router = useRouter();
    const [selectedRole, setSelectedRole] = useState(member.gangRole || 'MEMBER');
    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (selectedRole === member.gangRole) {
            onClose();
            return;
        }

        setIsSaving(true);
        try {
            const res = await fetch(`/api/gangs/${gangId}/members/${member.id}/role`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: selectedRole }),
            });

            if (!res.ok) throw new Error('Failed to update role');

            toast.success('อัปเดตยศเรียบร้อยแล้ว', {
                description: `${member.name} เป็น ${ROLES.find(r => r.key === selectedRole)?.label} แล้ว`,
            });
            onClose();
            router.refresh();
        } catch (error) {
            console.error(error);
            toast.error('เกิดข้อผิดพลาด', {
                description: 'ไม่สามารถอัปเดตยศได้',
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#111111] border border-white/10 rounded-2xl shadow-2xl p-6 w-full max-w-md transform scale-100 transition-all animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/10 rounded-xl">
                            <UserCog className="w-6 h-6 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-lg">กำหนดยศ</h3>
                            <p className="text-gray-400 text-sm">{member.name}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Role Selection */}
                <div className="space-y-3 mb-6">
                    {ROLES.map((role) => {
                        const Icon = role.icon;
                        const isSelected = selectedRole === role.key;
                        return (
                            <button
                                key={role.key}
                                onClick={() => setSelectedRole(role.key)}
                                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${isSelected
                                        ? `${role.bg} ${role.border} border-2`
                                        : 'bg-black/20 border-white/5 hover:border-white/10'
                                    }`}
                            >
                                <div className={`p-2 rounded-lg ${role.bg}`}>
                                    <Icon className={`w-5 h-5 ${role.color}`} />
                                </div>
                                <div className="flex-1 text-left">
                                    <div className={`font-medium ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                                        {role.label}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {role.key === 'MEMBER' && 'สิทธิ์พื้นฐาน'}
                                        {role.key === 'ADMIN' && 'จัดการสมาชิก, อนุมัติคำขอ'}
                                        {role.key === 'TREASURER' && 'จัดการการเงิน, ดูรายงาน'}
                                    </div>
                                </div>
                                {isSelected && (
                                    <div className={`w-5 h-5 rounded-full ${role.bg} flex items-center justify-center`}>
                                        <div className={`w-2.5 h-2.5 rounded-full ${role.color.replace('text-', 'bg-')}`} />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Note */}
                <div className="mb-6 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs">
                    <Crown className="w-4 h-4 inline mr-1.5" />
                    <strong>หมายเหตุ:</strong> ยศ Owner กำหนดผ่านการแมป Discord Role ในหน้าตั้งค่า
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        ยกเลิก
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-purple-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                กำลังบันทึก...
                            </>
                        ) : (
                            'บันทึก'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
