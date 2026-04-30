'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Calendar, Clock, DollarSign, ArrowLeft, Send, RefreshCw, AlertCircle, Lock, Zap } from 'lucide-react';
import Link from 'next/link';
import { logClientError } from '@/lib/clientLogger';
import { InfoTip } from '@/components/ui';

interface Props {
    gangId: string;
    hasFinance?: boolean;
}

const getBangkokNow = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));

const formatBangkokDate = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const formatBangkokTime = (date: Date) => {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const getDefaultDateTimes = () => {
    const start = getBangkokNow();
    start.setMinutes(start.getMinutes() + 5);
    start.setMinutes(Math.ceil(start.getMinutes() / 5) * 5, 0, 0);

    const end = new Date(start.getTime() + 30 * 60 * 1000);

    return {
        startDate: formatBangkokDate(start),
        startTime: formatBangkokTime(start),
        endDate: formatBangkokDate(end),
        endTime: formatBangkokTime(end),
    };
};

const toBangkokDateTime = (date: string, time: string) => new Date(`${date}T${time}:00+07:00`);
const TIME_OPTIONS = Array.from({ length: 24 * 12 }, (_, index) => {
    const hour = Math.floor(index / 12);
    const minute = (index % 12) * 5;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
});

export function CreateSessionForm({ gangId, hasFinance = true }: Props) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const defaultDateTimes = getDefaultDateTimes();

    // Generate default session name with Thai date
    const getDefaultSessionName = (dateText = defaultDateTimes.startDate) => {
        const date = toBangkokDateTime(dateText, '12:00');
        const day = date.getDate();
        const month = date.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', month: 'long' });
        return `เช็คชื่อ ${day} ${month}`;
    };

    // Form state with defaults
    const [sessionName, setSessionName] = useState(getDefaultSessionName());
    const [sessionDate, setSessionDate] = useState(defaultDateTimes.startDate);
    const [startTime, setStartTime] = useState(defaultDateTimes.startTime);
    const [endDate, setEndDate] = useState(defaultDateTimes.endDate);
    const [endTime, setEndTime] = useState(defaultDateTimes.endTime);
    const [absentPenalty, setAbsentPenalty] = useState(0);

    const startDateTime = toBangkokDateTime(sessionDate, startTime);
    const endDateTime = toBangkokDateTime(endDate, endTime);
    const isTimeValid = endDateTime.getTime() > startDateTime.getTime();

    const handleSessionDateChange = (value: string) => {
        setSessionDate(value);
        if (endDate < value) {
            setEndDate(value);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const resolvedSessionName = sessionName.trim() || getDefaultSessionName(sessionDate);

        if (!sessionName.trim()) {
            setSessionName(resolvedSessionName);
        }

        if (!isTimeValid) {
            toast.error('เวลาหมดเขตต้องมากกว่าเวลาเปิด');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/gangs/${gangId}/attendance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionName: resolvedSessionName,
                    sessionDate: toBangkokDateTime(sessionDate, '00:00'),
                    startTime: startDateTime,
                    endTime: endDateTime,
                    absentPenalty,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to create session');
            }

            const data = await res.json();
            const createdSessionId = data?.session?.id as string | undefined;

            toast.success('สร้างรอบเช็คชื่อสำเร็จ! 📋', {
                description: 'รอบถูกบันทึกเป็นสถานะรอเริ่มแล้ว คุณสามารถเริ่มทันทีหรือรอระบบเปิดอัตโนมัติได้',
            });
            router.push(createdSessionId ? `/dashboard/${gangId}/attendance/${createdSessionId}` : `/dashboard/${gangId}/attendance`);
            router.refresh();
        } catch (error: any) {
            logClientError('dashboard.attendance.create_session.failed', error, { gangId });
            toast.error('สร้างรอบไม่สำเร็จ', {
                description: error.message || 'กรุณาลองใหม่อีกครั้ง',
            });
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6" data-testid="attendance-create-form">
            {/* Session Name */}
            <div>
                <label className="block text-sm font-semibold text-fg-secondary mb-2 tracking-wide">
                    ชื่อรอบ <span className="text-fg-danger">*</span>
                </label>
                <input
                    type="text"
                    data-testid="attendance-session-name"
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    placeholder="เช็คชื่อ 5 กุมภาพันธ์"
                    className="w-full bg-bg-muted border border-border-subtle hover:border-border-strong text-fg-primary rounded-token-xl px-4 py-3 focus:ring-2 focus:ring-status-success/50 focus:border-status-success/50 outline-none placeholder:text-fg-tertiary transition-all shadow-inner"
                    autoFocus
                />
            </div>

            {/* Time Window */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                    <label className="block text-sm font-semibold text-fg-secondary mb-2 tracking-wide flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-fg-success" />
                        เปิดเช็คชื่อ
                    </label>
                    <input
                        type="date"
                        data-testid="attendance-session-date"
                        lang="en-GB"
                        step={60}
                        value={sessionDate}
                        onChange={(e) => handleSessionDateChange(e.target.value)}
                        className="mb-3 w-full bg-bg-muted border border-border-subtle hover:border-border-strong text-fg-primary rounded-token-xl px-4 py-3 focus:ring-2 focus:ring-status-success/50 focus:border-status-success/50 outline-none transition-all shadow-inner [color-scheme:inherit]"
                    />
                    <select
                        data-testid="attendance-start-time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full bg-bg-muted border border-border-subtle hover:border-border-strong text-fg-primary rounded-token-xl px-4 py-3 focus:ring-2 focus:ring-status-success/50 focus:border-status-success/50 outline-none transition-all shadow-inner"
                    >
                        {TIME_OPTIONS.map((time) => (
                            <option key={time} value={time}>{time}</option>
                        ))}
                    </select>
                    <div className="mt-2 flex items-center gap-2 text-[11px] font-medium text-fg-tertiary">
                        <span>เวลาเปิด</span>
                        <InfoTip label="เวลาเปิด" content="สมาชิกจะเริ่มกดเช็คชื่อได้ตั้งแต่เวลานี้ ระบบใช้เวลาไทยและแสดงเป็นรูปแบบ 24 ชั่วโมง" />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-semibold text-fg-secondary mb-2 tracking-wide flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-fg-danger" />
                        หมดเขต
                    </label>
                    <input
                        type="date"
                        data-testid="attendance-end-date"
                        lang="th-TH"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className={`mb-3 w-full bg-bg-muted border text-fg-primary rounded-token-xl px-4 py-3 focus:ring-2 focus:border-transparent outline-none transition-all shadow-inner [color-scheme:inherit] ${!isTimeValid ? 'border-status-danger/50 focus:ring-status-danger/50 bg-status-danger-subtle' : 'border-border-subtle hover:border-border-strong focus:ring-status-success/50 focus:border-status-success/50'
                            }`}
                    />
                    <select
                        data-testid="attendance-end-time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className={`w-full bg-bg-muted border text-fg-primary rounded-token-xl px-4 py-3 focus:ring-2 focus:border-transparent outline-none transition-all shadow-inner ${!isTimeValid ? 'border-status-danger/50 focus:ring-status-danger/50 bg-status-danger-subtle' : 'border-border-subtle hover:border-border-strong focus:ring-status-success/50 focus:border-status-success/50'
                            }`}
                    >
                        {TIME_OPTIONS.map((time) => (
                            <option key={time} value={time}>{time}</option>
                        ))}
                    </select>
                    <div className="mt-2 flex items-center gap-2 text-[11px] font-medium text-fg-tertiary">
                        <span>เวลาปิด</span>
                        <InfoTip label="เวลาปิด" content="หลังเวลานี้ระบบจะล็อคการเช็คชื่อ รอบที่ยังไม่เช็คจะถูกประเมินเป็นขาดตามเงื่อนไขของ session" />
                    </div>
                    {!isTimeValid && (
                        <p className="text-[11px] text-fg-danger mt-2 flex items-center gap-1.5 font-medium bg-status-danger-subtle w-fit px-2 py-1 rounded-token-md border border-status-danger/20"><AlertCircle className="w-3 h-3" /> ต้องมากกว่าเวลาเปิด</p>
                    )}
                </div>
            </div>

            {/* Absent Penalty - Optional */}
            <div>
                <label className="block text-sm font-semibold text-fg-secondary mb-2 tracking-wide flex items-center gap-1.5">
                    {hasFinance ? <DollarSign className="w-4 h-4 text-fg-secondary" /> : <Lock className="w-4 h-4 text-fg-warning" />}
                    ค่าปรับขาด <span className="text-fg-tertiary font-normal">(ไม่บังคับ)</span>
                </label>
                {hasFinance ? (
                    <div className="relative">
                        <input
                            type="number"
                            data-testid="attendance-absent-penalty"
                            value={absentPenalty || ''}
                            onChange={(e) => setAbsentPenalty(Number(e.target.value))}
                            min={0}
                            placeholder="0"
                            className="w-full bg-bg-muted border border-border-subtle hover:border-border-strong text-fg-primary rounded-token-xl pl-4 pr-12 py-3 focus:ring-2 focus:ring-status-success/50 focus:border-status-success/50 outline-none transition-all shadow-inner tabular-nums font-medium"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                            <span className="text-fg-tertiary font-medium">฿</span>
                        </div>
                    </div>
                ) : (
                    <div className="bg-status-warning-subtle border border-status-warning/20 rounded-token-xl p-4">
                        <p className="text-sm text-fg-warning font-semibold mb-1.5 flex items-center gap-1.5">
                            <Lock className="w-4 h-4" /> ฟีเจอร์ค่าปรับอัตโนมัติต้องใช้แพลน Premium
                        </p>
                        <p className="text-xs text-fg-secondary mb-3 font-medium leading-relaxed">แพลนปัจจุบันไม่รองรับการเชื่อมต่อกับระบบการเงิน อัปเกรดเพื่อหักเงินคนที่ขาดงานแบบอัตโนมัติ</p>
                        <a href={`/dashboard/${gangId}/settings?tab=subscription`} className="inline-flex items-center justify-center gap-1.5 text-[11px] font-bold text-fg-warning bg-status-warning-subtle hover:brightness-110 px-3 py-1.5 rounded-token-lg transition-colors uppercase tracking-widest border border-status-warning/20">
                            <Zap className="w-3.5 h-3.5" /> อัปเกรดแพลน
                        </a>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-2 rounded-token-xl border border-status-success/20 bg-status-success-subtle px-4 py-3">
                <p className="text-sm font-semibold text-fg-success">หลังสร้างรอบ</p>
                <InfoTip
                    label="Flow"
                    content="รอบใหม่จะเป็นสถานะรอเริ่มก่อน แล้วระบบจะส่งปุ่มเช็คชื่อไป Discord เมื่อถึงเวลาเปิด หรือคุณจะกดเริ่มทันทีจากหน้ารายละเอียดก็ได้"
                />
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-6 sm:pt-4 border-t border-border-subtle">
                <Link
                    href={`/dashboard/${gangId}/attendance`}
                    className="flex justify-center items-center gap-2 px-6 py-2.5 bg-bg-muted hover:bg-bg-subtle text-fg-secondary rounded-token-xl font-semibold transition-colors border border-border-subtle shadow-token-sm"
                >
                    <ArrowLeft className="w-4 h-4" />
                    ยกเลิก
                </Link>
                <button
                    type="submit"
                    data-testid="attendance-create-submit"
                    disabled={isSubmitting || !isTimeValid}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 bg-status-success hover:brightness-110 text-fg-inverse rounded-token-xl font-bold shadow-token-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:-translate-y-0 transform hover:-translate-y-0.5"
                >
                    {isSubmitting ? (
                        <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            กำลังสร้างรอบ...
                        </>
                    ) : (
                        <>
                            <Send className="w-4 h-4" />
                            สร้างรอบเช็คชื่อ
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}
