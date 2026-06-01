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
        verifyChannelId?: string | null;
        logChannelId?: string | null;
        registerChannelId?: string | null;
        attendanceChannelId?: string | null;
        attendanceSummaryChannelId?: string | null;
        financeChannelId?: string | null;
        announcementChannelId?: string | null;
        leaveChannelId?: string | null;
        requestsChannelId?: string | null;
        websiteChannelId?: string | null;
        adminPanelChannelId?: string | null;
    };
    channels: Channel[];
}

const CHANNEL_CONFIGS = [
    { key: 'verifyChannelId', label: 'รับยศคนนอกแก๊ง', description: 'จุดให้คนทั่วไปกดรับยศก่อนสมัครเข้าแก๊งจริง', icon: UserCog, color: 'text-fg-info' },
    { key: 'registerChannelId', label: 'ลงทะเบียน', description: 'จุดสมัครเข้าแก๊งจริง หลังได้ยศคนนอกแก๊งแล้ว', icon: UserCog, color: 'text-fg-info' },
    { key: 'announcementChannelId', label: 'ประกาศ', description: 'ประกาศจากแอดมินและข้อความสำคัญ', icon: Megaphone, color: 'text-accent-bright' },
    { key: 'websiteChannelId', label: 'ลิงก์เว็บ', description: 'จุดวางลิงก์ Dashboard สำหรับสมาชิก', icon: Hash, color: 'text-accent-bright' },
    { key: 'attendanceChannelId', label: 'เช็คชื่อ', description: 'เปิดรอบเช็คชื่อและส่งสถานะการเข้าร่วม', icon: Clock, color: 'text-fg-warning' },
    { key: 'attendanceSummaryChannelId', label: 'สรุปเช็คชื่อ', description: 'ปลายทางของรายงานหลังปิดรอบเช็คชื่อ', icon: Clock, color: 'text-fg-warning' },
    { key: 'leaveChannelId', label: 'แจ้งลา', description: 'สมาชิกส่งคำขอลาและติดตามสถานะ', icon: CalendarOff, color: 'text-fg-warning' },
    { key: 'financeChannelId', label: 'การเงิน', description: 'รายการฝาก จ่าย สำรองจ่าย และอนุมัติการเงิน', icon: CreditCard, color: 'text-fg-success' },
    { key: 'requestsChannelId', label: 'คำขอ / อนุมัติ', description: 'รวมคิวงานที่ต้องให้ทีมดูแลกดอนุมัติ', icon: ClipboardList, color: 'text-fg-info' },
    { key: 'adminPanelChannelId', label: 'Admin Panel', description: 'แผงควบคุมสำหรับหัวหน้าแก๊งและแอดมิน', icon: Shield, color: 'text-fg-danger' },
    { key: 'logChannelId', label: 'ห้องบันทึกระบบ', description: 'เก็บเหตุการณ์สำคัญและร่องรอยการแก้ไขสำหรับตรวจสอบย้อนหลัง หรือปล่อยว่างถ้าไม่ใช้ log ใน Discord', icon: Shield, color: 'text-fg-danger' },
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
            <div className="rounded-token-lg border border-status-info bg-status-info-subtle p-3">
                <div className="flex items-start gap-3">
                    <Info className="mt-0.5 h-5 w-5 shrink-0 text-fg-info" />
                    <div>
                        <p className="text-sm font-bold text-fg-info">เลือกห้องที่ใช้จริงใน Discord</p>
                        <p className="mt-1 text-xs leading-relaxed text-fg-secondary sm:text-sm">
                            ใช้ห้องเดิมของแก๊งได้เลย บอทจะไม่ลบแชทเดิมและไม่ย้ายห้องที่เลือกจากเว็บ หากบอทส่งข้อความไม่ได้ ให้ตรวจสิทธิ์ห้องนั้นแล้วกดซ่อมห้อง/ยศใน Discord อีกครั้ง
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
                        <article key={config.key} className="rounded-token-lg border border-border-subtle bg-bg-subtle p-3 shadow-token-sm">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex min-w-0 items-start gap-3">
                                    <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-token-lg bg-bg-muted border border-border-subtle ${config.color}`}>
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
                                        <span className="rounded-token-full border border-border-subtle bg-bg-muted px-2 py-1 text-[9px] font-bold text-fg-tertiary">
                                            ยังไม่ตั้งค่า
                                        </span>
                                    )}
                                </div>
                            </div>

                            <select
                                value={currentValue}
                                onChange={(event) => handleChange(config.key, event.target.value)}
                                disabled={isSaving}
                                className="mt-3 min-h-11 w-full rounded-token-lg border border-border-subtle bg-bg-muted px-3 py-2.5 text-sm font-semibold text-fg-primary outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
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
                            <th className="px-4 py-3 text-[11px] font-bold text-fg-tertiary">งานที่ใช้</th>
                            <th className="px-4 py-3 text-[11px] font-bold text-fg-tertiary">ช่อง Discord</th>
                            <th className="px-4 py-3 text-right text-[11px] font-bold text-fg-tertiary">สถานะ</th>
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
                                            <span className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-token-lg bg-bg-muted border border-border-subtle ${config.color}`}>
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
                                        {!isSaving && !currentValue && <span className="text-[11px] font-bold text-fg-tertiary">ยังไม่ตั้งค่า</span>}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <p className="text-xs text-fg-tertiary mt-4 flex items-center gap-1 opacity-80">
                <Hash className="w-3 h-3" />
                แนะนำให้แยกห้องบันทึกสำคัญออกจากห้องที่สมาชิกใช้งานประจำ เพื่อให้ตามเหตุการณ์ย้อนหลังได้ง่าย
            </p>
        </div>
    );
}
