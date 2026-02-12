'use client';

import { useState } from 'react';
import { Hash, Shield, Clock, CreditCard, UserCog, Megaphone, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { updateGangSettings } from '@/app/actions/settings';

interface Channel {
    id: string;
    name: string;
    type: number;
}

interface Props {
    gangId: string;
    guildId: string;
    currentSettings: {
        logChannelId?: string | null;
        registerChannelId?: string | null;
        attendanceChannelId?: string | null;
        financeChannelId?: string | null;
        announcementChannelId?: string | null;
    };
    channels: Channel[];
}

const CHANNEL_CONFIGS = [
    { key: 'logChannelId', label: 'Log / Audit', icon: Shield, color: 'text-red-400' },
    { key: 'registerChannelId', label: 'ลงทะเบียน', icon: UserCog, color: 'text-blue-400' },
    { key: 'attendanceChannelId', label: 'เช็คชื่อ', icon: Clock, color: 'text-orange-400' },
    { key: 'financeChannelId', label: 'การเงิน', icon: CreditCard, color: 'text-green-400' },
    { key: 'announcementChannelId', label: 'ประกาศ', icon: Megaphone, color: 'text-purple-400' },
] as const;

export function ChannelSettings({ gangId, guildId, currentSettings, channels }: Props) {
    const [saving, setSaving] = useState<string | null>(null);
    const [values, setValues] = useState(currentSettings);

    const handleChange = async (key: string, value: string) => {
        setSaving(key);

        const newValues = { ...values, [key]: value || null };
        setValues(newValues);

        try {
            const result = await updateGangSettings(gangId, { [key]: value || null });
            if (result.success) {
                toast.success('บันทึกแล้ว');
            } else {
                toast.error('บันทึกไม่สำเร็จ');
            }
        } catch (error) {
            toast.error('เกิดข้อผิดพลาด');
        } finally {
            setSaving(null);
        }
    };

    return (
        <div className="space-y-3">
            {CHANNEL_CONFIGS.map((config) => {
                const Icon = config.icon;
                const currentValue = values[config.key as keyof typeof values] || '';
                const isSaving = saving === config.key;

                return (
                    <div key={config.key} className="flex items-center justify-between p-3 rounded-xl bg-black/20">
                        <span className={`text-sm flex items-center gap-2 ${config.color}`}>
                            <Icon className="w-4 h-4" />
                            {config.label}
                        </span>
                        <div className="flex items-center gap-2">
                            <select
                                value={currentValue}
                                onChange={(e) => handleChange(config.key, e.target.value)}
                                disabled={isSaving}
                                className="bg-black/30 border border-white/10 text-white text-xs rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none min-w-[160px] disabled:opacity-50"
                            >
                                <option value="">ไม่ตั้งค่า</option>
                                {channels.map((channel) => (
                                    <option key={channel.id} value={channel.id}>
                                        # {channel.name}
                                    </option>
                                ))}
                            </select>
                            {isSaving && <Loader2 className="w-4 h-4 animate-spin text-blue-400" />}
                            {!isSaving && currentValue && <Check className="w-4 h-4 text-green-400" />}
                        </div>
                    </div>
                );
            })}

            <p className="text-xs text-secondary-text mt-4 flex items-center gap-1 opacity-60">
                <Hash className="w-3 h-3" />
                เลือกช่อง Discord สำหรับแต่ละฟังก์ชัน (ช่อง Log จะได้รับการแจ้งเตือนจาก Admin)
            </p>
        </div>
    );
}
