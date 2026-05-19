'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserCog, Crown, Shield, Wallet, User, X, RefreshCw, ClipboardCheck } from 'lucide-react';

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
    { key: 'MEMBER', label: 'สมาชิก', icon: User, color: 'text-fg-info', bg: 'bg-status-info-subtle', border: 'border-status-info/20' },
    { key: 'ADMIN', label: 'แอดมิน', icon: Shield, color: 'text-fg-danger', bg: 'bg-status-danger-subtle', border: 'border-status-danger/20' },
    { key: 'TREASURER', label: 'เหรัญญิก', icon: Wallet, color: 'text-fg-success', bg: 'bg-status-success-subtle', border: 'border-status-success/20' },
    { key: 'ATTENDANCE_OFFICER', label: 'เจ้าหน้าที่เช็คชื่อ', icon: ClipboardCheck, color: 'text-fg-warning', bg: 'bg-status-warning-subtle', border: 'border-status-warning/20' },
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

            if (!res.ok) throw new Error('อัปเดตยศไม่สำเร็จ');

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
        <div className="fixed inset-0 z-[140] flex items-end justify-center p-2 bg-bg-overlay backdrop-blur-sm animate-in fade-in duration-200 sm:items-center sm:p-4">
            <div className="max-h-[calc(100dvh-1rem)] w-full max-w-lg overflow-y-auto rounded-token-xl border border-border-subtle bg-bg-subtle p-4 shadow-token-lg animate-in zoom-in-95 duration-200 sm:p-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="min-w-0 flex items-start gap-2.5">
                        <div className="mt-0.5 h-8 w-8 shrink-0 flex items-center justify-center bg-accent-subtle rounded-token-lg">
                            <UserCog className="w-4 h-4 text-accent-bright" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-fg-primary text-base">กำหนดยศ</h3>
                            <p className="text-fg-secondary text-xs truncate">{member.name}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="h-11 w-11 shrink-0 flex items-center justify-center hover:bg-bg-muted rounded-token-lg text-fg-secondary hover:text-fg-primary transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Role Selection */}
                <div className="space-y-2 mb-4">
                    {ROLES.map((role) => {
                        const Icon = role.icon;
                        const isSelected = selectedRole === role.key;
                        return (
                            <button
                                key={role.key}
                                type="button"
                                onClick={() => setSelectedRole(role.key)}
                                aria-pressed={isSelected}
                                className={`w-full min-h-14 flex items-center gap-3 p-3 rounded-token-lg border transition-colors ${isSelected
                                        ? `${role.bg} ${role.border}`
                                        : 'bg-bg-muted border-border-subtle hover:border-border-strong'
                                    }`}
                            >
                                <div className={`h-8 w-8 shrink-0 flex items-center justify-center rounded-token-lg ${role.bg}`}>
                                    <Icon className={`w-4 h-4 ${role.color}`} />
                                </div>
                                <div className="min-w-0 flex-1 text-left">
                                    <div className={`text-sm font-medium ${isSelected ? 'text-fg-primary' : 'text-fg-secondary'}`}>
                                        {role.label}
                                    </div>
                                    <div className="text-[11px] leading-snug text-fg-tertiary">
                                        {role.key === 'MEMBER' && 'สิทธิ์พื้นฐาน'}
                                        {role.key === 'ADMIN' && 'จัดการสมาชิก, อนุมัติคำขอ'}
                                        {role.key === 'TREASURER' && 'จัดการการเงิน, ดูรายงาน'}
                                        {role.key === 'ATTENDANCE_OFFICER' && 'จัดการรอบเช็คชื่อ, เปิด/ปิดรอบ และแก้ attendance'}
                                    </div>
                                </div>
                                {isSelected && (
                                    <div className={`w-5 h-5 shrink-0 rounded-token-full ${role.bg} flex items-center justify-center`}>
                                        <div className={`w-2 h-2 rounded-token-full ${role.color.replace('text-fg-', 'bg-status-')}`} />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Note */}
                <div className="mb-4 p-2.5 rounded-token-lg bg-status-warning-subtle border border-status-warning/20 text-fg-warning text-[11px] leading-relaxed">
                    <Crown className="w-4 h-4 inline mr-1.5" />
                    <strong>หมายเหตุ:</strong> ยศ Owner เป็นสิทธิ์สูงสุดของแก๊ง จึงไม่เปิดให้เปลี่ยนจากหน้ากำหนดยศทั่วไป
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="min-h-11 px-4 py-2 bg-bg-muted hover:bg-bg-raised text-fg-primary rounded-token-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        ยกเลิก
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="min-h-11 px-4 py-2 bg-accent hover:bg-accent-hover text-fg-inverse rounded-token-lg text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
