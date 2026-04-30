'use client';

import { useState } from 'react';
import { Hash, Shield, Clock, CreditCard, UserCog, Megaphone, Check, Loader2, CalendarOff, ClipboardList, Info } from 'lucide-react';
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
        leaveChannelId?: string | null;
        requestsChannelId?: string | null;
    };
    channels: Channel[];
}

const CHANNEL_CONFIGS = [
    { key: 'logChannelId', label: 'Log / Audit', description: 'แจ้งเตือน action สำคัญและเหตุการณ์ระบบ', icon: Shield, color: 'text-fg-danger' },
    { key: 'registerChannelId', label: 'ลงทะเบียน', description: 'จุดเริ่มสมัครสมาชิกและยืนยันตัวตน', icon: UserCog, color: 'text-fg-info' },
    { key: 'attendanceChannelId', label: 'เช็คชื่อ', description: 'เปิดรอบเช็คชื่อและส่งสถานะการเข้าร่วม', icon: Clock, color: 'text-fg-warning' },
    { key: 'financeChannelId', label: 'การเงิน', description: 'รายการฝาก จ่าย สำรองจ่าย และอนุมัติการเงิน', icon: CreditCard, color: 'text-fg-success' },
    { key: 'announcementChannelId', label: 'ประกาศ', description: 'ประกาศจากแอดมินและข้อความสำคัญ', icon: Megaphone, color: 'text-accent-bright' },
    { key: 'leaveChannelId', label: 'แจ้งลา', description: 'สมาชิกส่งคำขอลาและติดตามสถานะ', icon: CalendarOff, color: 'text-fg-warning' },
    { key: 'requestsChannelId', label: 'คำขอ / อนุมัติ', description: 'รวมคิวงานที่ต้องให้ทีมดูแลกดอนุมัติ', icon: ClipboardList, color: 'text-fg-info' },
] as const;

export function ChannelSettings({ gangId, currentSettings, channels }: Props) {
    const [saving, setSaving] = useState<string | null>(null);
    const [values, setValues] = useState(currentSettings);

    const handleChange = async (key: string, value: string) => {
        setSaving(key);

        const newValues = { ...values, [key]: value || null };
        setValues(newValues);

        try {
            const result = await updateGangSettings(gangId, { [key]: value || null });
            if (result.success) {
                toast.success('บันทึก channel แล้ว');
            } else {
                toast.error('บันทึก channel ไม่สำเร็จ');
            }
        } catch (error) {
            console.error(error);
            toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
        } finally {
            setSaving(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="rounded-token-2xl border border-status-info bg-status-info-subtle p-4">
                <div className="flex items-start gap-3">
                    <Info className="mt-0.5 h-5 w-5 shrink-0 text-fg-info" />
                    <div>
                        <p className="text-sm font-bold text-fg-info">ตั้งค่า channel ให้ตรงกับงานจริง</p>
                        <p className="mt-1 text-sm text-fg-secondary">
                            ถ้ายังไม่ตั้งค่า บางคำสั่งจะยังทำงานได้ แต่ bot อาจส่งข้อความไปไม่ถูกห้องหรือแจ้งเตือนไม่ครบ
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-3 md:hidden">
                {CHANNEL_CONFIGS.map((config) => {
                    const Icon = config.icon;
                    const currentValue = values[config.key as keyof typeof values] || '';
                    const isSaving = saving === config.key;

                    return (
                        <article key={config.key} className="rounded-token-2xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex min-w-0 items-start gap-3">
                                    <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-token-xl bg-bg-muted border border-border-subtle ${config.color}`}>
                                        <Icon className="h-4 w-4" />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-sm font-black text-fg-primary">{config.label}</p>
                                        <p className="mt-1 text-xs leading-relaxed text-fg-tertiary">{config.description}</p>
                                    </div>
                                </div>
                                <div className="shrink-0">
                                    {isSaving && <Loader2 className="h-4 w-4 animate-spin text-fg-info" />}
                                    {!isSaving && currentValue && <Check className="h-4 w-4 text-fg-success" />}
                                    {!isSaving && !currentValue && (
                                        <span className="rounded-token-full border border-border-subtle bg-bg-muted px-2 py-1 text-[9px] font-black uppercase tracking-widest text-fg-tertiary">
                                            Unset
                                        </span>
                                    )}
                                </div>
                            </div>

                            <select
                                value={currentValue}
                                onChange={(event) => handleChange(config.key, event.target.value)}
                                disabled={isSaving}
                                className="mt-3 w-full rounded-token-xl border border-border-subtle bg-bg-muted px-3 py-3 text-sm font-semibold text-fg-primary outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
                            >
                                <option value="">ไม่ตั้งค่า</option>
                                {channels.map((channel) => (
                                    <option key={channel.id} value={channel.id}>
                                        # {channel.name}
                                    </option>
                                ))}
                            </select>
                        </article>
                    );
                })}
            </div>

            <div className="hidden overflow-x-auto rounded-token-xl border border-border-subtle bg-bg-subtle shadow-token-sm md:block">
                <table className="min-w-[620px] w-full text-left">
                    <thead className="bg-bg-muted border-b border-border-subtle">
                        <tr>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">Function</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">Channel</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-right">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                        {CHANNEL_CONFIGS.map((config) => {
                            const Icon = config.icon;
                            const currentValue = values[config.key as keyof typeof values] || '';
                            const isSaving = saving === config.key;

                            return (
                                <tr key={config.key} className="hover:bg-bg-muted transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex items-start gap-3">
                                            <span className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-token-xl bg-bg-muted border border-border-subtle ${config.color}`}>
                                                <Icon className="w-4 h-4" />
                                            </span>
                                            <div>
                                                <span className="text-sm font-bold text-fg-primary">{config.label}</span>
                                                <p className="mt-1 text-xs text-fg-tertiary">{config.description}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <select
                                            value={currentValue}
                                            onChange={(event) => handleChange(config.key, event.target.value)}
                                            disabled={isSaving}
                                            className="w-full bg-bg-subtle border border-border-subtle text-fg-primary text-xs rounded-token-lg px-3 py-2 focus:ring-2 focus:ring-accent outline-none disabled:opacity-50"
                                        >
                                            <option value="">ไม่ตั้งค่า</option>
                                            {channels.map((channel) => (
                                                <option key={channel.id} value={channel.id}>
                                                    # {channel.name}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {isSaving && <Loader2 className="w-4 h-4 animate-spin text-fg-info inline-block" />}
                                        {!isSaving && currentValue && <Check className="w-4 h-4 text-fg-success inline-block" />}
                                        {!isSaving && !currentValue && <span className="text-[10px] font-bold uppercase tracking-widest text-fg-tertiary">Unset</span>}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <p className="text-xs text-fg-tertiary mt-4 flex items-center gap-1 opacity-80">
                <Hash className="w-3 h-3" />
                เลือกห้อง Discord สำหรับแต่ละฟังก์ชัน ห้อง Log จะได้รับแจ้งเตือนจาก Admin และเหตุการณ์สำคัญ
            </p>
        </div>
    );
}
