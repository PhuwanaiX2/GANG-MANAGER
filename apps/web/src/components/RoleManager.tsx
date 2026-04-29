'use client';

import { useState } from 'react';
import {
    AlertTriangle,
    ChevronDown,
    ClipboardCheck,
    Coins,
    Crown,
    RefreshCw,
    Save,
    ShieldCheck,
    User,
} from 'lucide-react';
import { updateGangRoles } from '@/app/actions/settings';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface Role {
    id: string;
    name: string;
    color: number;
    position: number;
    managed: boolean;
}

interface Props {
    gangId: string;
    guildId: string;
    initialMappings: Array<{ permissionLevel: string; discordRoleId: string }>;
    discordRoles: Role[];
}

const PERMISSIONS = [
    {
        key: 'OWNER',
        label: 'หัวหน้าแก๊ง',
        helper: 'สิทธิ์สูงสุด ใช้ role นี้กับกลุ่มเล็กและไว้ใจได้เท่านั้น',
        icon: Crown,
        color: 'text-fg-warning',
        bg: 'bg-status-warning-subtle',
    },
    {
        key: 'ADMIN',
        label: 'แอดมิน',
        helper: 'จัดการสมาชิก ประกาศ และงานดูแลระบบ',
        icon: ShieldCheck,
        color: 'text-fg-danger',
        bg: 'bg-status-danger-subtle',
    },
    {
        key: 'TREASURER',
        label: 'เหรัญญิก',
        helper: 'จัดการรายการเงินและอนุมัติรายการการเงิน',
        icon: Coins,
        color: 'text-fg-success',
        bg: 'bg-status-success-subtle',
    },
    {
        key: 'ATTENDANCE_OFFICER',
        label: 'เจ้าหน้าที่เช็คชื่อ',
        helper: 'เปิด/ปิดรอบเช็คชื่อและดูแลสถานะการเข้าร่วม',
        icon: ClipboardCheck,
        color: 'text-fg-warning',
        bg: 'bg-status-warning-subtle',
    },
    {
        key: 'MEMBER',
        label: 'สมาชิก',
        helper: 'สิทธิ์ใช้งานพื้นฐานของสมาชิกทั่วไป',
        icon: User,
        color: 'text-fg-info',
        bg: 'bg-status-info-subtle',
    },
];

export function RoleManager({ gangId, initialMappings, discordRoles }: Props) {
    const router = useRouter();
    const [saving, setSaving] = useState(false);

    const [mappings, setMappings] = useState<Record<string, string>>(() => {
        const map: Record<string, string> = {};
        initialMappings.forEach((mapping) => {
            map[mapping.permissionLevel] = mapping.discordRoleId;
        });
        return map;
    });

    const handleRoleChange = (permission: string, roleId: string) => {
        setMappings((prev) => ({ ...prev, [permission]: roleId }));
    };

    const selectedEntries = Object.entries(mappings).filter(([, roleId]) => roleId);
    const roleUsageCount = selectedEntries.reduce<Record<string, number>>((acc, [, roleId]) => {
        acc[roleId] = (acc[roleId] ?? 0) + 1;
        return acc;
    }, {});
    const duplicateRoleIds = new Set(
        Object.entries(roleUsageCount)
            .filter(([, count]) => count > 1)
            .map(([roleId]) => roleId)
    );
    const hasDuplicateMappings = duplicateRoleIds.size > 0;

    const handleSave = async () => {
        if (hasDuplicateMappings) {
            toast.error('Role mapping ซ้ำกัน', {
                description: 'Discord role หนึ่งอันใช้ได้กับ permission เดียวเท่านั้น เพื่อกันสิทธิ์หลุด',
            });
            return;
        }

        setSaving(true);
        try {
            const updates = Object.entries(mappings).map(([permission, roleId]) => ({
                permission: permission as any,
                roleId,
            }));

            const result = await updateGangRoles(gangId, updates);
            if (result.success) {
                router.refresh();
                toast.success('บันทึกข้อมูลเรียบร้อยแล้ว', {
                    description: 'อัปเดต role mapping ของ Discord สำเร็จ',
                });
            } else {
                toast.error('บันทึก role mapping ไม่สำเร็จ');
            }
        } catch (error) {
            console.error(error);
            toast.error('เกิดข้อผิดพลาด', {
                description: 'กรุณาลองใหม่อีกครั้ง',
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="rounded-token-2xl border border-status-warning bg-status-warning-subtle p-4">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-fg-warning" />
                    <div>
                        <p className="text-sm font-bold text-fg-warning">ตั้งค่า role ด้วยความระวัง</p>
                        <p className="mt-1 text-sm text-fg-secondary">
                            Discord role เดียวห้ามผูกหลาย permission โดยเฉพาะ Owner เพราะจะทำให้สมาชิกที่มี role เดียวกันได้สิทธิ์สูงเกินจริง
                        </p>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto rounded-token-xl border border-border-subtle bg-bg-subtle shadow-token-sm">
                <table className="min-w-[620px] w-full text-left">
                    <thead className="bg-bg-muted border-b border-border-subtle">
                        <tr>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">Permission</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">Discord Role</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                        {PERMISSIONS.map((perm) => {
                            const Icon = perm.icon;
                            return (
                                <tr key={perm.key} className="hover:bg-bg-muted transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex items-start gap-3">
                                            <span className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-token-xl ${perm.bg} ${perm.color} border border-border-subtle`}>
                                                <Icon className="h-4 w-4" />
                                            </span>
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-fg-primary font-bold text-sm">{perm.label}</span>
                                                    <span className={`px-2 py-0.5 rounded-token-full text-[10px] font-black ${perm.bg} ${perm.color} border border-border-subtle`}>
                                                        {perm.key}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-xs text-fg-tertiary">{perm.helper}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="relative">
                                            <select
                                                value={mappings[perm.key] || ''}
                                                onChange={(event) => handleRoleChange(perm.key, event.target.value)}
                                                className="w-full bg-bg-subtle border border-border-subtle text-fg-primary text-sm rounded-token-lg px-3 py-2 focus:ring-2 focus:ring-status-info outline-none appearance-none"
                                            >
                                                <option value="">-- ไม่ระบุ --</option>
                                                {discordRoles.map((role) => {
                                                    const selectedElsewhere = Object.entries(mappings)
                                                        .some(([permissionKey, roleId]) => permissionKey !== perm.key && roleId === role.id);
                                                    return (
                                                        <option
                                                            key={role.id}
                                                            value={role.id}
                                                            disabled={selectedElsewhere}
                                                            style={{ color: role.color ? `#${role.color.toString(16)}` : 'inherit' }}
                                                        >
                                                            {role.name} {role.managed ? '(Bot/Managed)' : ''}{selectedElsewhere ? ' (ถูกใช้แล้ว)' : ''}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                            <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-fg-tertiary pointer-events-none" />
                                        </div>
                                        {duplicateRoleIds.has(mappings[perm.key] ?? '') && (
                                            <p className="mt-2 text-xs font-semibold text-fg-danger">
                                                Role นี้ถูกผูกกับ permission อื่นแล้ว กรุณาเลือก role ที่ไม่ซ้ำ
                                            </p>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {hasDuplicateMappings && (
                <div className="rounded-token-xl border border-status-danger bg-status-danger-subtle px-4 py-3 text-sm font-semibold text-fg-danger">
                    Discord role หนึ่งอันใช้ได้กับ permission เดียวเท่านั้น กรุณาแก้ role ที่ซ้ำก่อนบันทึก
                </div>
            )}

            <div className="pt-4 flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving || hasDuplicateMappings}
                    className="flex items-center gap-2 px-6 py-2 bg-status-info hover:brightness-110 text-fg-inverse rounded-token-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-token-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                    {saving ? (
                        <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            กำลังบันทึก...
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4" />
                            บันทึกการเปลี่ยนแปลง
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
