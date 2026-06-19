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
    Radio,
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
type CardTone = 'success' | 'warning' | 'danger' | 'info';

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

function getChoiceClasses(active: boolean, tone: CardTone) {
    const activeTone = {
        success: 'border-status-success/45 bg-status-success-subtle text-fg-success ring-1 ring-status-success/15',
        warning: 'border-status-warning/45 bg-status-warning-subtle text-fg-warning ring-1 ring-status-warning/15',
        danger: 'border-status-danger/45 bg-status-danger-subtle text-fg-danger ring-1 ring-status-danger/15',
        info: 'border-status-info/45 bg-status-info-subtle text-fg-info ring-1 ring-status-info/15',
    }[tone];

    return [
        'min-h-[110px] rounded-token-lg border px-4 py-3 text-left transition-colors',
        active
            ? `${activeTone} shadow-token-sm`
            : 'border-border-subtle bg-bg-muted/55 text-fg-secondary hover:border-border-strong hover:bg-bg-elevated',
    ].join(' ');
}

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
        <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-token-lg border border-border-subtle bg-bg-muted/70 text-fg-secondary">
                <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
                <h2 className="text-sm font-black text-fg-primary sm:text-base">{title}</h2>
                <p className="mt-1 text-xs leading-6 text-fg-tertiary sm:text-sm">{description}</p>
            </div>
        </div>
    );
}

function SummaryChip({
    label,
    value,
    tone = 'neutral',
}: {
    label: string;
    value: string;
    tone?: 'neutral' | 'success' | 'warning' | 'danger';
}) {
    const toneClasses = {
        neutral: 'border-border-subtle bg-bg-muted/60 text-fg-secondary',
        success: 'border-status-success/30 bg-status-success-subtle text-fg-success',
        warning: 'border-status-warning/30 bg-status-warning-subtle text-fg-warning',
        danger: 'border-status-danger/30 bg-status-danger-subtle text-fg-danger',
    }[tone];

    return (
        <div className={`rounded-token-lg border px-3 py-3 ${toneClasses}`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-80">{label}</p>
            <p className="mt-1 text-sm font-black sm:text-base">{value}</p>
        </div>
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

    const modeLabel = isManualMode ? 'เจ้าหน้าที่เช็คเอง' : 'สมาชิกกดผ่าน Discord';
    const countingLabel = isSupplementalRound ? 'รอบเสริม' : 'รอบบังคับ';
    const verificationLabel = isManualMode
        ? 'ไม่ต้องยืนยันเพิ่ม'
        : verificationMode === 'CODE'
            ? 'เช็คชื่อพร้อมรหัส'
            : 'กดเช็คชื่อทันที';

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
        <form onSubmit={handleSubmit} className="space-y-6" data-testid="attendance-create-form">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="rounded-token-xl border border-border-subtle bg-bg-muted/55 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-fg-tertiary">Round Setup</p>
                    <h2 className="mt-1 text-base font-black text-fg-primary sm:text-lg">ตั้งรอบให้ตรงกับงานจริงก่อนสร้าง</h2>
                    <p className="mt-2 text-sm leading-6 text-fg-secondary">
                        เลือกให้ชัดว่ารอบนี้เป็นรอบบังคับหรือรอบเสริม ใครเป็นคนเช็ค และถ้าสมาชิกกดเองจะต้องยืนยันเพิ่มหรือไม่
                    </p>
                    {!isManualMode && verificationMode === 'CODE' ? (
                        <div className="mt-3 rounded-token-lg border border-status-warning/25 bg-status-warning-subtle px-3 py-2.5 text-xs font-semibold leading-6 text-fg-warning">
                            ใน Discord สมาชิกจะเห็นปุ่ม <span className="font-black">เช็คชื่อ</span> ตามปกติ แล้วระบบค่อยเด้งช่องให้ใส่รหัส 4 หลักในขั้นถัดไป
                        </div>
                    ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                    <SummaryChip label="โหมด" value={modeLabel} tone={isManualMode ? 'warning' : 'success'} />
                    <SummaryChip label="การนับผล" value={countingLabel} tone={isSupplementalRound ? 'success' : 'danger'} />
                    <SummaryChip label="การยืนยัน" value={verificationLabel} />
                </div>
            </div>

            <section className="space-y-3 border-t border-border-subtle pt-5">
                <SectionHeading
                    icon={Zap}
                    title="รูปแบบรอบ"
                    description="เลือกว่าให้สมาชิกกดเองผ่าน Discord หรือให้เจ้าหน้าที่เปิดตารางแล้วเช็คผลแทน"
                />
                <div className="grid gap-3 md:grid-cols-2">
                    <button
                        type="button"
                        onClick={() => setSessionMode('DISCORD_SELF_CHECKIN')}
                        data-testid="attendance-mode-discord"
                        className={getChoiceClasses(sessionMode === 'DISCORD_SELF_CHECKIN', 'success')}
                    >
                        <div className="mb-2 flex items-center gap-2 text-sm font-black">
                            <Radio className="h-4 w-4" />
                            สมาชิกกดเช็คชื่อผ่าน Discord
                        </div>
                        <p className="text-xs leading-6 opacity-90">
                            เหมาะกับรอบทั่วไป ระบบจะส่งปุ่มไป Discord และเก็บผลจากสมาชิกที่กดเข้ามาเอง
                        </p>
                    </button>
                    <button
                        type="button"
                        onClick={() => setSessionMode('MANUAL_ROLL_CALL')}
                        data-testid="attendance-mode-manual"
                        className={getChoiceClasses(sessionMode === 'MANUAL_ROLL_CALL', 'warning')}
                    >
                        <div className="mb-2 flex items-center gap-2 text-sm font-black">
                            <ClipboardCheck className="h-4 w-4" />
                            เจ้าหน้าที่เช็คเอง
                        </div>
                        <p className="text-xs leading-6 opacity-90">
                            เปิดเป็นตารางให้คนดูแลติ๊กผลทีละคน เหมาะกับรอบที่ต้องสรุปให้จบในมือเจ้าหน้าที่
                        </p>
                    </button>
                </div>
                {isManualMode && isSupplementalRound ? (
                    <div className="rounded-token-lg border border-status-success/20 bg-status-success-subtle px-3 py-2.5 text-xs font-semibold leading-6 text-fg-success">
                        รอบเสริมแบบเจ้าหน้าที่เช็คเองจะบันทึกเฉพาะคนที่เลือกเข้าร่วม คนที่ไม่ได้เลือกจะไม่ถูกลงเป็นขาด
                    </div>
                ) : null}
            </section>

            <section className="space-y-3 border-t border-border-subtle pt-5">
                <SectionHeading
                    icon={AlertCircle}
                    title="การนับผลของรอบนี้"
                    description="กำหนดก่อนว่ารอบนี้ต้องรู้ผลทุกคน หรือเป็นรอบเสริมที่เก็บเฉพาะคนที่เข้าร่วม"
                />
                <div className="grid gap-3 md:grid-cols-2">
                    <button
                        type="button"
                        onClick={() => setCountingPolicy('REQUIRED')}
                        data-testid="attendance-counting-required"
                        className={getChoiceClasses(countingPolicy === 'REQUIRED', 'danger')}
                    >
                        <div className="mb-2 flex items-center gap-2 text-sm font-black">
                            <ClipboardCheck className="h-4 w-4" />
                            รอบบังคับ
                        </div>
                        <p className="text-xs leading-6 opacity-90">
                            ใช้กับรอบสำคัญที่ต้องรู้ผลครบทุกคน คนที่ไม่เช็คจะถูกสรุปเป็นขาดหรือลาตามข้อมูลที่มี
                        </p>
                    </button>
                    <button
                        type="button"
                        onClick={() => setCountingPolicy('SUPPLEMENTAL')}
                        data-testid="attendance-counting-supplemental"
                        className={getChoiceClasses(countingPolicy === 'SUPPLEMENTAL', 'success')}
                    >
                        <div className="mb-2 flex items-center gap-2 text-sm font-black">
                            <Radio className="h-4 w-4" />
                            รอบเสริม
                        </div>
                        <p className="text-xs leading-6 opacity-90">
                            ใช้ตอนอยากรู้ว่าใครยังอยู่หรือใครมาช่วยกิจกรรม ระบบจะนับเฉพาะคนที่เข้าร่วมและไม่ลงขาด
                        </p>
                    </button>
                </div>
            </section>

            {!isManualMode ? (
                <section className="space-y-3 border-t border-border-subtle pt-5">
                    <SectionHeading
                        icon={KeyRound}
                        title="วิธียืนยันเมื่อสมาชิกกดเอง"
                        description="เลือกว่าจะให้กดเช็คชื่อได้ทันที หรือให้ใส่รหัส 4 หลักจากเจ้าหน้าที่เพื่อกันการกดมั่ว"
                    />
                    <div className="grid gap-3 md:grid-cols-2">
                        <button
                            type="button"
                            onClick={() => setVerificationMode('NONE')}
                            data-testid="attendance-verification-none"
                            className={getChoiceClasses(verificationMode === 'NONE', 'success')}
                        >
                            <div className="mb-2 flex items-center gap-2 text-sm font-black">
                                <Radio className="h-4 w-4" />
                                กดเช็คชื่อทันที
                            </div>
                            <p className="text-xs leading-6 opacity-90">
                                เหมาะกับรอบทั่วไป สมาชิกกดปุ่มแล้วระบบบันทึกเป็นมาได้ทันที
                            </p>
                        </button>
                        <button
                            type="button"
                            onClick={() => setVerificationMode('CODE')}
                            data-testid="attendance-verification-code"
                            className={getChoiceClasses(verificationMode === 'CODE', 'warning')}
                        >
                            <div className="mb-2 flex items-center gap-2 text-sm font-black">
                                <KeyRound className="h-4 w-4" />
                                เช็คชื่อพร้อมรหัส
                            </div>
                            <p className="text-xs leading-6 opacity-90">
                                สมาชิกกดปุ่มเช็คชื่อก่อน แล้วกรอกรหัส 4 หลักจากเจ้าหน้าที่ในขั้นถัดไปจึงจะบันทึกสำเร็จ
                            </p>
                        </button>
                    </div>
                </section>
            ) : null}

            <section className="space-y-4 border-t border-border-subtle pt-5">
                <SectionHeading
                    icon={Calendar}
                    title="รายละเอียดรอบ"
                    description="ตั้งชื่อรอบและช่วงเวลาที่จะใช้จริง เพื่อให้คนดูรอบนี้รู้ทันทีว่ากำลังเช็คอะไร"
                />

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
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
                        <div className="rounded-token-lg border border-border-subtle bg-bg-muted/45 p-4">
                            <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold tracking-wide text-fg-secondary">
                                <Calendar className="h-4 w-4 text-fg-warning" />
                                วันที่เช็คชื่อ
                            </label>
                            <input
                                type="date"
                                data-testid="attendance-session-date"
                                lang="en-GB"
                                value={sessionDate}
                                onChange={(e) => handleSessionDateChange(e.target.value)}
                                className="w-full rounded-token-lg border border-border-subtle bg-bg-base px-4 py-3 text-fg-primary shadow-inner outline-none transition-colors hover:border-border-strong focus:border-status-warning/50 focus:ring-2 focus:ring-status-warning/40 [color-scheme:inherit]"
                            />
                            <p className="mt-3 text-xs leading-6 text-fg-tertiary">
                                {isSupplementalRound
                                    ? 'รอบนี้เปิดเป็นตารางทันที ให้เจ้าหน้าที่เลือกเฉพาะคนที่เข้าร่วม แล้วจบงานได้เลย'
                                    : 'รอบนี้เปิดเป็นตารางทันที ให้เจ้าหน้าที่เช็คผลของทุกคนก่อนกดยืนยันจบ'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-3 lg:grid-cols-2">
                            <div className="rounded-token-lg border border-status-success/20 bg-status-success-subtle/30 p-4">
                                <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold tracking-wide text-fg-secondary">
                                    <Clock className="h-4 w-4 text-fg-success" />
                                    เปิดเช็คชื่อ
                                </label>
                                <input
                                    type="date"
                                    data-testid="attendance-session-date"
                                    lang="en-GB"
                                    value={sessionDate}
                                    onChange={(e) => handleSessionDateChange(e.target.value)}
                                    className="mb-3 w-full rounded-token-lg border border-border-subtle bg-bg-base px-4 py-3 text-fg-primary shadow-inner outline-none transition-colors hover:border-border-strong focus:border-status-success/50 focus:ring-2 focus:ring-status-success/40 [color-scheme:inherit]"
                                />
                                <TimePickerField
                                    testId="attendance-start-time"
                                    value={startTime}
                                    onChange={setStartTime}
                                    label="เวลาเปิดเช็คชื่อ"
                                    tone="success"
                                />
                                <div className="mt-2 flex items-center gap-2 text-[11px] font-medium text-fg-tertiary">
                                    <span>เริ่มให้สมาชิกกดจาก Discord</span>
                                    <InfoTip label="เวลาเปิด" content="สมาชิกจะเริ่มกดเช็คชื่อจากปุ่ม Discord ได้ตั้งแต่เวลานี้ ใช้เวลาไทยแบบ 24 ชั่วโมง" />
                                </div>
                            </div>

                            <div className="rounded-token-lg border border-status-danger/20 bg-status-danger-subtle/30 p-4">
                                <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold tracking-wide text-fg-secondary">
                                    <Clock className="h-4 w-4 text-fg-danger" />
                                    หมดเขต
                                </label>
                                <input
                                    type="date"
                                    data-testid="attendance-end-date"
                                    lang="en-GB"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className={`mb-3 w-full rounded-token-lg border bg-bg-base px-4 py-3 text-fg-primary shadow-inner outline-none transition-colors focus:ring-2 [color-scheme:inherit] ${!isTimeValid ? 'border-status-danger/50 bg-status-danger-subtle focus:ring-status-danger/40' : 'border-border-subtle hover:border-border-strong focus:border-status-success/50 focus:ring-status-success/40'}`}
                                />
                                <TimePickerField
                                    testId="attendance-end-time"
                                    value={endTime}
                                    onChange={setEndTime}
                                    label="เวลาหมดเขต"
                                    tone="danger"
                                />
                                <div className="mt-2 flex items-center gap-2 text-[11px] font-medium text-fg-tertiary">
                                    <span>หลังเวลานี้จะล็อกการกดเช็คชื่อ</span>
                                    <InfoTip
                                        label="เวลาปิด"
                                        content={isSupplementalRound
                                            ? 'หลังเวลานี้ระบบจะล็อกการเข้าร่วม รอบเสริมจะสรุปเฉพาะคนที่กดเข้าร่วมเท่านั้น'
                                            : 'หลังเวลานี้ระบบจะล็อกการกดเช็คชื่อ และคนที่ยังไม่เช็คจะถูกประเมินเป็นขาดตามเงื่อนไขของรอบ'}
                                    />
                                </div>
                                {!isTimeValid ? (
                                    <p className="mt-2 flex w-fit items-center gap-1.5 rounded-token-md border border-status-danger/20 bg-status-danger-subtle px-2 py-1 text-[11px] font-medium text-fg-danger">
                                        <AlertCircle className="h-3 w-3" />
                                        ต้องมากกว่าเวลาเปิด
                                    </p>
                                ) : null}
                            </div>
                        </div>
                    )}
                </div>
            </section>

            <section className="space-y-3 border-t border-border-subtle pt-5">
                <SectionHeading
                    icon={DollarSign}
                    title="ค่าปรับขาด"
                    description="กำหนดเฉพาะรอบบังคับที่ต้องการผูกกับระบบการเงิน ถ้าไม่ใส่จะบันทึกผลเช็คชื่ออย่างเดียว"
                />

                {isSupplementalRound ? (
                    <div className="rounded-token-lg border border-status-success/20 bg-status-success-subtle p-4">
                        <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-fg-success">
                            <Radio className="h-4 w-4" />
                            รอบเสริมไม่ใช้ค่าปรับ
                        </p>
                        <p className="text-xs font-medium leading-6 text-fg-secondary">
                            คนที่ไม่เข้าร่วมรอบเสริมจะไม่ถูกลงขาด จึงไม่ควรเกิดหนี้หรือค่าปรับจากรอบนี้
                        </p>
                    </div>
                ) : hasFinance ? (
                    <div className="max-w-md">
                        <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold tracking-wide text-fg-secondary">
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
                ) : (
                    <div className="rounded-token-lg border border-status-warning/20 bg-status-warning-subtle p-4">
                        <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-fg-warning">
                            <Lock className="h-4 w-4" />
                            ค่าปรับอัตโนมัติต้องใช้แพลน Premium
                        </p>
                        <p className="mb-3 text-xs font-medium leading-6 text-fg-secondary">
                            แพลนปัจจุบันยังไม่รองรับการเชื่อมกับระบบการเงิน ระบบจะบันทึกผลเช็คชื่อได้ แต่ไม่หักเงินอัตโนมัติ
                        </p>
                        <Link
                            href={`/dashboard/${gangId}/billing`}
                            className="inline-flex items-center justify-center gap-1.5 rounded-token-lg border border-status-warning/20 bg-status-warning-subtle px-3 py-1.5 text-[11px] font-bold text-fg-warning transition-colors hover:opacity-90"
                        >
                            <Zap className="h-3.5 w-3.5" />
                            อัปเกรดแพลน
                        </Link>
                    </div>
                )}
            </section>

            <div className="flex flex-col-reverse gap-3 border-t border-border-subtle pt-5 sm:flex-row">
                <Link
                    href={`/dashboard/${gangId}/attendance`}
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
    );
}
