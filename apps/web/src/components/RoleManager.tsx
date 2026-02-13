'use client';

import { useState } from 'react';
import { UserCog, Save, RefreshCw, ChevronDown, Check } from 'lucide-react';
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
    guildId: string; // To fetch discord roles
    initialMappings: Array<{ permissionLevel: string; discordRoleId: string }>;
    discordRoles: Role[];
}

const PERMISSIONS = [
    { key: 'OWNER', label: '👑 หัวหน้าแก๊ง', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    { key: 'ADMIN', label: '🛡️ แอดมิน', color: 'text-red-500', bg: 'bg-red-500/10' },
    { key: 'TREASURER', label: '💰 เหรัญญิก', color: 'text-green-500', bg: 'bg-green-500/10' },
    { key: 'MEMBER', label: '👤 สมาชิก', color: 'text-blue-500', bg: 'bg-blue-500/10' },
];

export function RoleManager({ gangId, guildId, initialMappings, discordRoles }: Props) {
    const router = useRouter();
    const [saving, setSaving] = useState(false);

    // State for simple mapping: permission -> roleId
    // Initialize lazily to avoid useEffect sync
    const [mappings, setMappings] = useState<Record<string, string>>(() => {
        const map: Record<string, string> = {};
        initialMappings.forEach(m => {
            map[m.permissionLevel] = m.discordRoleId;
        });
        return map;
    });

    const handleRoleChange = (permission: string, roleId: string) => {
        setMappings(prev => ({ ...prev, [permission]: roleId }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Convert map back to array for action
            const updates = Object.entries(mappings).map(([permission, roleId]) => ({
                permission: permission as any,
                roleId
            }));

            const result = await updateGangRoles(gangId, updates);
            if (result.success) {
                router.refresh();
                toast.success('บันทึกข้อมูลเรียบร้อยแล้ว', {
                    description: 'อัปเดตรหัสยศ Discord สำเร็จแล้ว',
                });
            } else {
                toast.error('เกิดข้อผิดพลาดในการบันทึก');
            }
        } catch (error) {
            console.error(error);
            toast.error('เกิดข้อผิดพลาด', {
                description: 'กรุณาลองใหม่อีกครั้ง'
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            {PERMISSIONS.map((perm) => (
                <div key={perm.key} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-black/20 gap-3 border border-transparent hover:border-white/5 transition-colors">
                    <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${perm.bg} ${perm.color} border border-white/5`}>
                            {perm.key}
                        </span>
                        <span className="text-gray-300 font-medium text-sm">{perm.label}</span>
                    </div>

                    <div className="relative w-full sm:w-64">
                        <select
                            value={mappings[perm.key] || ''}
                            onChange={(e) => handleRoleChange(perm.key, e.target.value)}
                            className="w-full bg-[#0a0a0a] border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                        >
                            <option value="">-- ไม่ระบุ --</option>
                            {discordRoles.map(role => (
                                <option key={role.id} value={role.id} style={{ color: role.color ? `#${role.color.toString(16)}` : 'inherit' }}>
                                    {role.name} {role.managed ? '(Bot/Managed)' : ''}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-gray-500 pointer-events-none" />
                    </div>
                </div>
            ))}

            <div className="pt-4 flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
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
