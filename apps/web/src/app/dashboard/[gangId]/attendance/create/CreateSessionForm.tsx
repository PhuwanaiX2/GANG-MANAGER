'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
    AlertCircle,
    ArrowLeft,
    Calendar,
    ClipboardCheck,
    Clock,
    DollarSign,
    KeyRound,
    Lock,
    RefreshCw,
    Send,
    Zap,
    type LucideIcon,
} from 'lucide-react';
import { logClientError } from '@/lib/clientLogger';
import { InfoTip, TimePickerField } from '@/components/ui';

interface Props {
    gangId: string;
    hasFinance?: boolean;
}

type AttendanceSessionMode = 'DISCORD_SELF_CHECKIN' | 'MANUAL_ROLL_CALL';
type AttendanceCountingPolicy = 'REQUIRED' | 'SUPPLEMENTAL';
type AttendanceVerificationMode = 'NONE' | 'CODE';
const getBangkokNow = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));

const formatBangkokDate = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const formatBangkokTime = (date: Date) => {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const getDefaultDateTimes = () => {
    const start = getBangkokNow();
    start.setMinutes(start.getMinutes() + 5, 0, 0);

    const end = new Date(start.getTime() + 30 * 60 * 1000);

    return {
        startDate: formatBangkokDate(start),
        startTime: formatBangkokTime(start),
        endDate: formatBangkokDate(end),
        endTime: formatBangkokTime(end),
    };
};

const toBangkokDateTime = (date: string, time: string) => new Date(`${date}T${time}:00+07:00`);

function SectionHeading({
    icon: Icon,
    title,
    description,
}: {
    icon: LucideIcon;
    title: string;
    description: string;
}) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-fg-tertiary" />
                <h2 className="text-sm font-black text-fg-primary sm:text-base">{title}</h2>
            </div>
            <p className="text-xs leading-6 text-fg-tertiary sm:text-sm">{description}</p>
        </div>
    );
}

function SummaryRow({
    label,
    value,
    hint,
}: {
    label: string;
    value: string;
    hint?: string;
}) {
    return (
        <div className="space-y-1.5 py-3">
            <div className="flex items-start justify-between gap-3">
                <span className="text-[11px] font-bold text-fg-tertiary">{label}</span>
                <span className="text-right text-sm font-black text-fg-primary">{value}</span>
            </div>
            {hint ? <p className="text-xs leading-5 text-fg-tertiary">{hint}</p> : null}
        </div>
    );
}

function OptionRow({
    active,
    onClick,
    testId,
    title,
    description,
    icon: Icon,
    tone = 'default',
}: {
    active: boolean;
    onClick: () => void;
    testId: string;
    title: string;
    description: string;
    icon?: LucideIcon;
    tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}) {
    const activeClassName = {
        default: 'border-border-strong bg-bg-elevated text-fg-primary ring-1 ring-border-subtle shadow-token-sm',
        success: 'border-status-success/35 bg-status-success-subtle text-fg-success ring-1 ring-status-success/15 shadow-token-sm',
        warning: 'border-status-warning/35 bg-status-warning-subtle text-fg-warning ring-1 ring-status-warning/15 shadow-token-sm',
        danger: 'border-status-danger/35 bg-status-danger-subtle text-fg-danger ring-1 ring-status-danger/15 shadow-token-sm',
        info: 'border-status-info/35 bg-status-info-subtle text-fg-info ring-1 ring-status-info/15 shadow-token-sm',
    }[tone];

    return (
        <button
            type="button"
            onClick={onClick}
            data-testid={testId}
            className={[
                'w-full rounded-token-lg border px-3.5 py-3 text-left transition-colors',
                active
                    ? activeClassName
                    : 'border-border-subtle bg-transparent text-fg-secondary hover:border-border-strong hover:bg-bg-muted/55',
            ].join(' ')}
        >
            <div className="flex items-start gap-3">
                {Icon ? (
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-token-lg border border-current/15 bg-bg-base/80">
                        <Icon className="h-4 w-4" />
                    </span>
                ) : null}
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-sm font-black text-current">{title}</p>
                        </div>
                        <span
                            className={[
                                'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-token-full border transition-colors',
                                active ? 'border-current bg-current' : 'border-border-strong bg-transparent',
                            ].join(' ')}
                        >
                            <span className="h-1.5 w-1.5 rounded-token-full bg-bg-base" />
                        </span>
                    </div>
                    <p className="mt-1 text-xs leading-6 text-fg-tertiary">{description}</p>
                </div>
            </div>
        </button>
    );
}

export function CreateSessionForm({ gangId, hasFinance = true }: Props) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const defaultDateTimes = getDefaultDateTimes();
    const getDefaultSessionName = (dateText = defaultDateTimes.startDate) => {
        const date = toBangkokDateTime(dateText, '12:00');
        const day = date.getDate();
        const month = date.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', month: 'long' });
        return `เช็คชื่อ ${day} ${month}`;
    };

    const [sessionMode, setSessionMode] = useState<AttendanceSessionMode>('DISCORD_SELF_CHECKIN');
    const [countingPolicy, setCountingPolicy] = useState<AttendanceCountingPolicy>('REQUIRED');
    const [verificationMode, setVerificationMode] = useState<AttendanceVerificationMode>('NONE');
    const [sessionName, setSessionName] = useState(getDefaultSessionName());
    const [sessionDate, setSessionDate] = useState(defaultDateTimes.startDate);
    const [startTime, setStartTime] = useState(defaultDateTimes.startTime);
    const [endDate, setEndDate] = useState(defaultDateTimes.endDate);
    const [endTime, setEndTime] = useState(defaultDateTimes.endTime);
    const [absentPenalty, setAbsentPenalty] = useState(0);

    const isManualMode = sessionMode === 'MANUAL_ROLL_CALL';
    const isSupplementalRound = countingPolicy === 'SUPPLEMENTAL';
    const startDateTime = toBangkokDateTime(sessionDate, startTime);
    const endDateTime = toBangkokDateTime(endDate, endTime);
    const isTimeValid = isManualMode || endDateTime.getTime() > startDateTime.getTime();

    const resolvedSessionName = sessionName.trim() || getDefaultSessionName(sessionDate);
    const modeLabel = isManualMode ? 'เจ้าหน้าที่เช็คเอง' : 'สมาชิกกดผ่าน Discord';
    const countingLabel = isSupplementalRound ? 'รอบเสริม' : 'รอบบังคับ';
    const verificationLabel = isManualMode
        ? 'ไม่ต้องยืนยันเพิ่ม'
        : verificationMode === 'CODE'
            ? 'เช็คชื่อพร้อมรหัส'
            : 'กดเช็คชื่อทันที';
    const countingDescription = isSupplementalRound
        ? 'นับเฉพาะคนที่กดเข้าร่วมจริง คนที่ไม่ได้เข้ามาในรอบนี้จะไม่ถูกลงขาด'
        : 'ระบบจะสรุปผลทุกคนในแก๊ง คนที่ยังไม่เช็คเมื่อจบรอบจะถูกประเมินตามสถานะที่กำหนด';
    const verificationDescription = isManualMode
        ? 'รอบนี้เจ้าหน้าที่เช็คผลให้เองทั้งหมด จึงไม่ต้องมีขั้นตอนยืนยันฝั่งสมาชิก'
        : verificationMode === 'CODE'
            ? 'สมาชิกกดเช็คชื่อใน Discord แล้วต้องกรอกรหัส 4 หลักของรอบนี้อีกครั้ง'
            : 'สมาชิกกดเช็คชื่อแล้วบันทึกผลได้ทันที เหมาะกับรอบที่ต้องการความเร็ว';
    const scheduleSummary = isManualMode
        ? sessionDate
        : sessionDate + ' ' + startTime + ' - ' + (endDate === sessionDate ? endTime : endDate + ' ' + endTime);
    const penaltySummary = isSupplementalRound
        ? 'ไม่ใช้ค่าปรับ'
        : hasFinance
            ? absentPenalty > 0
                ? absentPenalty.toLocaleString() + ' ฿'
                : 'ยังไม่ตั้งค่าปรับ'
            : 'ผูกค่าปรับอัตโนมัติไม่ได้';
    const summaryNote = isManualMode
        ? 'รอบนี้จะเปิดเป็นตารางให้เจ้าหน้าที่เลือก มา / ขาด / ลา แล้วค่อยกดยืนยันจบรอบครั้งเดียว'
        : verificationMode === 'CODE'
            ? 'ระบบจะส่งปุ่มเช็คชื่อไปที่ Discord และให้สมาชิกกรอกรหัสของรอบนี้ก่อนบันทึกผล'
            : 'ระบบจะส่งปุ่มเช็คชื่อไปที่ Discord แล้วบันทึกผลทันทีเมื่อสมาชิกกดสำเร็จ';

    const handleSessionDateChange = (value: string) => {
        setSessionDate(value);
        if (endDate < value) {
            setEndDate(value);
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        const resolvedSessionName = sessionName.trim() || getDefaultSessionName(sessionDate);
        if (!sessionName.trim()) {
            setSessionName(resolvedSessionName);
        }

        if (!isTimeValid) {
            toast.error('เวลาหมดเขตต้องมากกว่าเวลาเปิด');
            return;
        }

        const payload: Record<string, unknown> = {
            sessionName: resolvedSessionName,
            sessionDate: toBangkokDateTime(sessionDate, '00:00'),
            absentPenalty: isSupplementalRound ? 0 : absentPenalty,
            mode: sessionMode,
            countingPolicy,
            verificationMode: isManualMode ? 'NONE' : verificationMode,
        };

        if (!isManualMode) {
            payload.startTime = startDateTime;
            payload.endTime = endDateTime;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/gangs/${gangId}/attendance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'สร้างรอบไม่สำเร็จ');
            }

            const data = await res.json();
            const createdSessionId = data?.session?.id as string | undefined;

            toast.success('สร้างรอบเช็คชื่อสำเร็จ', {
                description: isManualMode
                    ? 'รอบนี้เปิดเป็นตารางเช็คชื่อให้เจ้าหน้าที่เช็คเองแล้ว'
                    : 'รอบนี้ถูกบันทึกเป็นสถานะรอเริ่ม และจะส่งปุ่มไป Discord เมื่อเริ่มรอบ',
            });
            router.push(createdSessionId ? `/dashboard/${gangId}/attendance/${createdSessionId}` : `/dashboard/${gangId}/attendance`);
            router.refresh();
        } catch (error: any) {
            logClientError('dashboard.attendance.create_session.failed', error, { gangId, sessionMode });
            toast.error('สร้างรอบไม่สำเร็จ', {
                description: error.message || 'กรุณาลองใหม่อีกครั้ง',
            });
            setIsSubmitting(false);
        }
    };

    return (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
            <form
                onSubmit={handleSubmit}
                className="overflow-hidden rounded-token-xl border border-border-subtle bg-bg-subtle shadow-token-sm"
                data-testid="attendance-create-form"
            >
                <div className="border-b border-border-subtle bg-bg-muted/70 px-4 py-4 sm:px-5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-fg-tertiary">ตั้งค่ารอบ</p>
                    <h2 className="mt-1 text-lg font-black tracking-tight text-fg-primary sm:text-xl">กรอกเท่าที่จำเป็นก่อนเปิดรอบ</h2>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-fg-tertiary">
                        เริ่มจากชื่อรอบและเวลาให้ชัดก่อน จากนั้นค่อยเลือกวิธีเช็คชื่อ วิธีนับผล และการยืนยันให้เหมาะกับรอบนี้
                    </p>
                </div>

                <div className="divide-y divide-border-subtle">
                    <section className="space-y-4 px-4 py-5 sm:px-5">
                        <SectionHeading
                            icon={Calendar}
                            title="1. ข้อมูลรอบ"
                            description="กรอกชื่อรอบและช่วงเวลาที่ใช้จริงก่อน เพื่อให้ทุกคนเข้าใจตรงกันว่ารอบนี้เช็คเรื่องอะไรและเปิดถึงเมื่อไร"
                        />

                        <div className="space-y-2">
                            <label className="block text-sm font-semibold tracking-wide text-fg-secondary">
                                ชื่อรอบ <span className="text-fg-danger">*</span>
                            </label>
                            <input
                                type="text"
                                data-testid="attendance-session-name"
                                value={sessionName}
                                onChange={(e) => setSessionName(e.target.value)}
                                placeholder="เช็คชื่อ 5 กุมภาพันธ์"
                                className="w-full rounded-token-lg border border-border-subtle bg-bg-muted/60 px-4 py-3 text-fg-primary shadow-inner outline-none transition-colors placeholder:text-fg-tertiary hover:border-border-strong focus:border-status-success/50 focus:ring-2 focus:ring-status-success/40"
                                autoFocus
                            />
                        </div>

                        {isManualMode ? (
                            <div className="grid gap-4 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)] lg:items-end">
                                <div className="space-y-2">
                                    <label className="flex items-center gap-1.5 text-sm font-semibold tracking-wide text-fg-secondary">
                                        <Calendar className="h-4 w-4 text-fg-warning" />
                                        วันที่เช็คชื่อ
                                    </label>
                                    <input
                                        type="date"
                                        data-testid="attendance-session-date"
                                        lang="en-GB"
                                        value={sessionDate}
                                        onChange={(e) => handleSessionDateChange(e.target.value)}
                                        className="w-full rounded-token-lg border border-border-subtle bg-bg-muted/60 px-4 py-3 text-fg-primary shadow-inner outline-none transition-colors hover:border-border-strong focus:border-status-warning/50 focus:ring-2 focus:ring-status-warning/40 [color-scheme:inherit]"
                                    />
                                </div>

                                <div className="rounded-token-lg border border-border-subtle bg-bg-muted/45 px-4 py-3 text-sm leading-6 text-fg-secondary">
                                    {isSupplementalRound
                                        ? 'รอบนี้จะเปิดเป็นตารางให้เจ้าหน้าที่ติ๊กเฉพาะคนที่เข้าร่วมจริง คนที่ไม่ได้เลือกจะไม่ถูกนับเป็นขาด'
                                        : 'รอบนี้จะเปิดเป็นตารางให้เจ้าหน้าที่สรุปผลของทุกคนในครั้งเดียว แล้วค่อยกดยืนยันจบรอบ'}
                                </div>
                            </div>
                        ) : (
                            <div className="grid gap-4 xl:grid-cols-2">
                                <div className="space-y-3">
                                    <label className="flex items-center gap-1.5 text-sm font-semibold tracking-wide text-fg-secondary">
                                        <Clock className="h-4 w-4 text-fg-success" />
                                        เปิดเช็คชื่อ
                                    </label>
                                    <input
                                        type="date"
                                        data-testid="attendance-session-date"
                                        lang="en-GB"
                                        value={sessionDate}
                                        onChange={(e) => handleSessionDateChange(e.target.value)}
                                        className="w-full rounded-token-lg border border-border-subtle bg-bg-muted/60 px-4 py-3 text-fg-primary shadow-inner outline-none transition-colors hover:border-border-strong focus:border-status-success/50 focus:ring-2 focus:ring-status-success/40 [color-scheme:inherit]"
                                    />
                                    <TimePickerField
                                        testId="attendance-start-time"
                                        value={startTime}
                                        onChange={setStartTime}
                                        label="เวลาเปิดเช็คชื่อ"
                                        tone="success"
                                    />
                                    <div className="flex items-center gap-2 text-[11px] font-medium text-fg-tertiary">
                                        <span>เริ่มให้สมาชิกกดจาก Discord</span>
                                        <InfoTip label="เวลาเปิด" content="สมาชิกจะเริ่มกดเช็คชื่อจากปุ่ม Discord ได้ตั้งแต่เวลานี้ ใช้เวลาไทยแบบ 24 ชั่วโมง" />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="flex items-center gap-1.5 text-sm font-semibold tracking-wide text-fg-secondary">
                                        <Clock className="h-4 w-4 text-fg-danger" />
                                        หมดเขต
                                    </label>
                                    <input
                                        type="date"
                                        data-testid="attendance-end-date"
                                        lang="en-GB"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className={[
                                            'w-full rounded-token-lg border bg-bg-muted/60 px-4 py-3 text-fg-primary shadow-inner outline-none transition-colors focus:ring-2 [color-scheme:inherit]',
                                            !isTimeValid
                                                ? 'border-status-danger/50 bg-status-danger-subtle focus:ring-status-danger/40'
                                                : 'border-border-subtle hover:border-border-strong focus:border-status-success/50 focus:ring-status-success/40',
                                        ].join(' ')}
                                    />
                                    <TimePickerField
                                        testId="attendance-end-time"
                                        value={endTime}
                                        onChange={setEndTime}
                                        label="เวลาหมดเขต"
                                        tone="danger"
                                    />
                                    <div className="flex items-center gap-2 text-[11px] font-medium text-fg-tertiary">
                                        <span>หลังเวลานี้จะล็อกการกดเช็คชื่อ</span>
                                        <InfoTip
                                            label="เวลาปิด"
                                            content={isSupplementalRound
                                                ? 'หลังเวลานี้ระบบจะล็อกการเข้าร่วม รอบเสริมจะสรุปเฉพาะคนที่กดเข้าร่วมเท่านั้น'
                                                : 'หลังเวลานี้ระบบจะล็อกการกดเช็คชื่อ และคนที่ยังไม่เช็คจะถูกประเมินตามเงื่อนไขของรอบ'}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {!isManualMode && !isTimeValid ? (
                            <p className="flex w-fit items-center gap-1.5 rounded-token-md border border-status-danger/20 bg-status-danger-subtle px-2 py-1 text-[11px] font-medium text-fg-danger">
                                <AlertCircle className="h-3 w-3" />
                                เวลาหมดเขตต้องมากกว่าเวลาเปิด
                            </p>
                        ) : null}
                    </section>

                    <section className="space-y-4 px-4 py-5 sm:px-5">
                        <SectionHeading
                            icon={Zap}
                            title="2. วิธีเช็คชื่อ"
                            description="เลือกก่อนว่าใครเป็นคนบันทึกผลในรอบนี้ จากนั้นระบบจะจัดหน้ารอบและขั้นตอนให้เหมาะกับโหมดที่เลือก"
                        />
                        <div className="grid gap-2 md:grid-cols-2">
                            <OptionRow
                                active={sessionMode === 'DISCORD_SELF_CHECKIN'}
                                onClick={() => setSessionMode('DISCORD_SELF_CHECKIN')}
                                testId="attendance-mode-discord"
                                title="สมาชิกกดเช็คชื่อผ่าน Discord"
                                description="ระบบส่งปุ่มเช็คชื่อไปที่ Discord แล้วบันทึกผลจากสมาชิกที่กดด้วยตัวเอง เหมาะกับรอบทั่วไปที่ต้องการความเร็ว"
                                icon={Zap}
                                tone="success"
                            />
                            <OptionRow
                                active={sessionMode === 'MANUAL_ROLL_CALL'}
                                onClick={() => setSessionMode('MANUAL_ROLL_CALL')}
                                testId="attendance-mode-manual"
                                title="เจ้าหน้าที่เช็คเอง"
                                description="เปิดเป็นตารางให้เจ้าหน้าที่เลือก มา / ขาด / ลา แล้วค่อยยืนยันสรุปรอบในหน้าเว็บ เหมาะกับรอบจริงจังหรือรอบบังคับ"
                                icon={ClipboardCheck}
                                tone="warning"
                            />
                        </div>
                    </section>

                    <section className="space-y-4 px-4 py-5 sm:px-5">
                        <SectionHeading
                            icon={AlertCircle}
                            title="3. วิธีนับผล"
                            description="กำหนดว่ารอบนี้จะวัดผลสมาชิกทุกคน หรือเก็บเฉพาะคนที่เข้าร่วมจริง"
                        />
                        <div className="grid gap-2 md:grid-cols-2">
                            <OptionRow
                                active={countingPolicy === 'REQUIRED'}
                                onClick={() => setCountingPolicy('REQUIRED')}
                                testId="attendance-counting-required"
                                title="รอบบังคับ"
                                description="ใช้เมื่อรอบนี้ต้องการสรุปผลทุกคนในแก๊ง คนที่ไม่เช็คหรือไม่ถูกติ๊กจะถูกนับตามสถานะของรอบ"
                            />
                            <OptionRow
                                active={countingPolicy === 'SUPPLEMENTAL'}
                                onClick={() => setCountingPolicy('SUPPLEMENTAL')}
                                testId="attendance-counting-supplemental"
                                title="รอบเสริม"
                                description="ใช้เมื่ออยากรู้ว่าใครเข้าร่วมบ้างเท่านั้น ระบบจะนับเฉพาะคนที่มา และไม่ลงขาดให้คนที่ไม่ได้เข้าร่วม"
                            />
                        </div>
                        <p className="text-xs leading-6 text-fg-tertiary">{countingDescription}</p>
                    </section>

                    <section className="space-y-4 px-4 py-5 sm:px-5">
                        <SectionHeading
                            icon={KeyRound}
                            title="4. การยืนยันตอนสมาชิกกดเอง"
                            description="ใช้เฉพาะรอบที่ให้สมาชิกกดผ่าน Discord เพื่อเพิ่มความน่าเชื่อถือของการเช็คชื่อ"
                        />
                        {!isManualMode ? (
                            <div className="grid gap-2 md:grid-cols-2">
                                <OptionRow
                                    active={verificationMode === 'NONE'}
                                    onClick={() => setVerificationMode('NONE')}
                                    testId="attendance-verification-none"
                                    title="กดเช็คชื่อทันที"
                                    description="สมาชิกกดแล้วบันทึกผลได้เลย เหมาะกับรอบที่ต้องการความเร็วและไม่ต้องยืนยันเพิ่ม"
                                />
                                <OptionRow
                                    active={verificationMode === 'CODE'}
                                    onClick={() => setVerificationMode('CODE')}
                                    testId="attendance-verification-code"
                                    title="เช็คชื่อพร้อมรหัส"
                                    description="หลังจากกดปุ่มใน Discord สมาชิกต้องกรอกรหัส 4 หลักของรอบนี้อีกครั้ง เพื่อลดการกดมั่วหรือฝากกด"
                                />
                            </div>
                        ) : (
                            <div className="rounded-token-lg border border-border-subtle bg-bg-muted/45 px-4 py-3 text-sm leading-6 text-fg-secondary">
                                รอบนี้เจ้าหน้าที่เป็นคนเช็คผลให้เองทั้งหมด จึงไม่มีขั้นตอนให้สมาชิกกดยืนยันหรือกรอกรหัสเพิ่ม
                            </div>
                        )}
                        <p className="text-xs leading-6 text-fg-tertiary">{verificationDescription}</p>
                    </section>

                    <section className="space-y-4 px-4 py-5 sm:px-5">
                        <SectionHeading
                            icon={DollarSign}
                            title="5. ค่าปรับขาด"
                            description="ใส่เฉพาะรอบบังคับที่ต้องการเชื่อมกับระบบการเงิน ถ้าไม่ใส่ ระบบจะเก็บผลเช็คชื่ออย่างเดียว"
                        />

                        {isSupplementalRound ? (
                            <div className="rounded-token-lg border border-status-success/20 bg-status-success-subtle px-4 py-3 text-sm leading-6 text-fg-secondary">
                                <span className="font-black text-fg-success">รอบเสริมไม่ใช้ค่าปรับ</span> เพราะคนที่ไม่เข้าร่วมจะไม่ถูกลงเป็นขาด
                            </div>
                        ) : hasFinance ? (
                            <div className="grid gap-3 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:items-start">
                                <div className="space-y-2">
                                    <label className="flex items-center gap-1.5 text-sm font-semibold tracking-wide text-fg-secondary">
                                        <DollarSign className="h-4 w-4 text-fg-secondary" />
                                        ค่าปรับขาด <span className="font-normal text-fg-tertiary">(ไม่บังคับ)</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            data-testid="attendance-absent-penalty"
                                            value={absentPenalty || ''}
                                            onChange={(e) => setAbsentPenalty(Number(e.target.value))}
                                            min={0}
                                            placeholder="0"
                                            className="w-full rounded-token-lg border border-border-subtle bg-bg-muted/60 py-3 pl-4 pr-12 font-medium tabular-nums text-fg-primary shadow-inner outline-none transition-colors hover:border-border-strong focus:border-status-success/50 focus:ring-2 focus:ring-status-success/40"
                                        />
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                                            <span className="font-medium text-fg-tertiary">฿</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="rounded-token-lg border border-border-subtle bg-bg-muted/45 px-4 py-3 text-sm leading-6 text-fg-secondary">
                                    เว้นเป็น 0 ได้ถ้ารอบนี้ต้องการสรุปผลอย่างเดียว และจะเริ่มคิดค่าปรับเฉพาะคนที่ถูกสรุปเป็น “ขาด” ตอนปิดรอบเท่านั้น
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-token-lg border border-status-warning/20 bg-status-warning-subtle p-4">
                                <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-fg-warning">
                                    <Lock className="h-4 w-4" />
                                    ค่าปรับอัตโนมัติต้องใช้แผน Premium
                                </p>
                                <p className="mb-3 text-xs font-medium leading-6 text-fg-secondary">
                                    แผนปัจจุบันยังไม่รองรับการเชื่อมกับระบบการเงิน ระบบจะบันทึกผลเช็คชื่อได้ แต่จะไม่หักเงินอัตโนมัติ
                                </p>
                                <Link
                                    href={'/dashboard/' + gangId + '/billing'}
                                    className="inline-flex items-center justify-center gap-1.5 rounded-token-lg border border-status-warning/20 bg-status-warning-subtle px-3 py-1.5 text-[11px] font-bold text-fg-warning transition-colors hover:opacity-90"
                                >
                                    <Zap className="h-3.5 w-3.5" />
                                    อัปเกรดแผน
                                </Link>
                            </div>
                        )}
                    </section>
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-border-subtle px-4 py-4 sm:flex-row sm:px-5">
                    <Link
                        href={'/dashboard/' + gangId + '/attendance'}
                        className="flex min-h-11 items-center justify-center gap-2 rounded-token-lg border border-border-subtle bg-bg-muted px-6 py-2.5 font-semibold text-fg-secondary shadow-token-sm transition-colors hover:bg-bg-subtle"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        ยกเลิก
                    </Link>
                    <button
                        type="submit"
                        data-testid="attendance-create-submit"
                        disabled={isSubmitting || !isTimeValid}
                        className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-token-lg bg-status-success px-4 py-2.5 font-bold text-fg-inverse shadow-token-sm transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <>
                                <RefreshCw className="h-4 w-4 animate-spin" />
                                กำลังสร้างรอบ...
                            </>
                        ) : (
                            <>
                                <Send className="h-4 w-4" />
                                {isManualMode ? 'สร้างตารางเช็คชื่อ' : 'สร้างรอบเช็คชื่อ'}
                            </>
                        )}
                    </button>
                </div>
            </form>

            <aside className="space-y-3 xl:sticky xl:top-24 xl:self-start">
                <div className="rounded-token-xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-fg-tertiary">สรุปรอบนี้</p>
                    <div className="mt-2 divide-y divide-border-subtle">
                        <SummaryRow label="ชื่อรอบ" value={resolvedSessionName} />
                        <SummaryRow label="วิธีเช็คชื่อ" value={modeLabel} />
                        <SummaryRow label="การนับผล" value={countingLabel} hint={countingDescription} />
                        <SummaryRow label="การยืนยัน" value={verificationLabel} hint={verificationDescription} />
                        <SummaryRow label="วันเวลา" value={scheduleSummary} />
                        <SummaryRow label="ค่าปรับขาด" value={penaltySummary} />
                    </div>
                </div>

                <div className="rounded-token-xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm">
                    <p className="text-sm font-black text-fg-primary">ก่อนกดสร้าง</p>
                    <ul className="mt-2 space-y-2 text-xs leading-6 text-fg-secondary">
                        <li>• ตรวจชื่อรอบและวันเวลาให้ตรงกับกิจกรรมจริง</li>
                        <li>• ถ้าเป็นรอบเสริม ระบบจะไม่ลงขาดให้คนที่ไม่เข้าร่วม</li>
                        <li>• ถ้าเปิดแบบเช็คชื่อพร้อมรหัส ต้องเตรียมบอกรหัสให้สมาชิกในตอนเริ่มรอบ</li>
                    </ul>
                    <div className="mt-3 rounded-token-lg border border-border-subtle bg-bg-muted/45 px-3.5 py-3 text-xs leading-6 text-fg-secondary">
                        {summaryNote}
                    </div>
                    {!isTimeValid ? (
                        <div className="mt-3 rounded-token-lg border border-status-danger/20 bg-status-danger-subtle px-3.5 py-3 text-xs leading-6 text-fg-danger">
                            เวลาหมดเขตยังไม่ถูกต้อง ตอนนี้ยังสร้างรอบไม่ได้จนกว่าจะตั้งให้มากกว่าเวลาเปิด
                        </div>
                    ) : null}
                </div>
            </aside>
        </div>
    );
}
