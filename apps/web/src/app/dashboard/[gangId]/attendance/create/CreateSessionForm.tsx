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
        <form onSubmit={handleSubmit} className="space-y-4" data-testid="attendance-create-form">
            <section className="rounded-token-xl border border-border-subtle bg-bg-subtle p-3 shadow-token-sm sm:p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                        <p className="text-sm font-black text-fg-primary">เลือกวิธีเช็คชื่อ</p>
                        <p className="mt-1 text-xs leading-relaxed text-fg-tertiary">
                            เลือกตั้งแต่ตอนสร้างรอบ เพราะแต่ละวิธีมีขั้นตอนใช้งานต่างกัน
                        </p>
                    </div>
                    <Zap className="mt-0.5 h-4 w-4 shrink-0 text-fg-warning" />
                </div>
                <div className="grid gap-2.5 md:grid-cols-2">
                    <button
                        type="button"
                        onClick={() => setSessionMode('DISCORD_SELF_CHECKIN')}
                        data-testid="attendance-mode-discord"
                        className={`min-h-[92px] rounded-token-xl border p-3 text-left transition-colors ${sessionMode === 'DISCORD_SELF_CHECKIN'
                            ? 'border-status-success bg-status-success-subtle text-fg-success shadow-token-sm ring-1 ring-status-success/20'
                            : 'border-border-subtle bg-bg-muted text-fg-secondary hover:border-border-strong hover:bg-bg-elevated'
                            }`}
                    >
                        <div className="mb-2 flex items-center gap-2 text-sm font-black">
                            <Radio className="h-4 w-4" />
                            ทุกคนลงชื่อผ่าน Discord
                        </div>
                        <p className="text-xs leading-relaxed opacity-85">
                            ตั้งเวลาเปิด-ปิด ส่งปุ่มไป Discord แล้วสมาชิกกดเช็คชื่อเอง
                        </p>
                    </button>
                    <button
                        type="button"
                        onClick={() => setSessionMode('MANUAL_ROLL_CALL')}
                        data-testid="attendance-mode-manual"
                        className={`min-h-[92px] rounded-token-xl border p-3 text-left transition-colors ${sessionMode === 'MANUAL_ROLL_CALL'
                            ? 'border-status-warning bg-status-warning-subtle text-fg-warning shadow-token-sm ring-1 ring-status-warning/20'
                            : 'border-border-subtle bg-bg-muted text-fg-secondary hover:border-border-strong hover:bg-bg-elevated'
                            }`}
                    >
                        <div className="mb-2 flex items-center gap-2 text-sm font-black">
                            <ClipboardCheck className="h-4 w-4" />
                            เจ้าหน้าที่เช็คเอง
                        </div>
                        <p className="text-xs leading-relaxed opacity-85">
                            {isSupplementalRound
                                ? 'เปิดเป็นสมุดรายชื่อทันที เลือกเฉพาะคนที่เข้าร่วม แล้วปิดรอบได้เลย'
                                : 'เปิดเป็นสมุดรายชื่อทันที เจ้าหน้าที่ต้องติ๊ก มา/ขาด/ลา ให้ครบทุกคน'}
                        </p>
                    </button>
                </div>
                {isManualMode && isSupplementalRound ? (
                    <div className="mt-3 rounded-token-lg border border-status-success/20 bg-status-success-subtle px-3 py-2 text-xs font-semibold leading-relaxed text-fg-success">
                        รอบเสริมแบบเจ้าหน้าที่เช็คเอง: เลือกเฉพาะคนที่เข้าร่วม คนที่ไม่เลือกจะไม่ถูกบันทึกเป็นขาด
                    </div>
                ) : null}
            </section>

            <section className="rounded-token-xl border border-border-subtle bg-bg-subtle p-3 shadow-token-sm sm:p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                        <p className="text-sm font-black text-fg-primary">การนับผลของรอบนี้</p>
                        <p className="mt-1 text-xs leading-relaxed text-fg-tertiary">
                            เลือกให้ตรงกับเจตนาของรอบ เพื่อให้สถิติสมาชิกไม่หลอกตา
                        </p>
                    </div>
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-fg-info" />
                </div>
                <div className="grid gap-2.5 md:grid-cols-2">
                    <button
                        type="button"
                        onClick={() => setCountingPolicy('REQUIRED')}
                        data-testid="attendance-counting-required"
                        className={`min-h-[96px] rounded-token-xl border p-3 text-left transition-colors ${countingPolicy === 'REQUIRED'
                            ? 'border-status-danger/45 bg-status-danger-subtle text-fg-danger shadow-token-sm ring-1 ring-status-danger/15'
                            : 'border-border-subtle bg-bg-muted text-fg-secondary hover:border-border-strong hover:bg-bg-elevated'
                            }`}
                    >
                        <div className="mb-2 flex items-center gap-2 text-sm font-black">
                            <ClipboardCheck className="h-4 w-4" />
                            รอบบังคับ
                        </div>
                        <p className="text-xs leading-relaxed opacity-85">
                            ใช้กับรอบที่ต้องรู้ผลทุกคน คนไม่เช็คจะถูกลงเป็นขาดหรือลาตามใบลา และอาจคิดค่าปรับ
                        </p>
                    </button>
                    <button
                        type="button"
                        onClick={() => setCountingPolicy('SUPPLEMENTAL')}
                        data-testid="attendance-counting-supplemental"
                        className={`min-h-[96px] rounded-token-xl border p-3 text-left transition-colors ${countingPolicy === 'SUPPLEMENTAL'
                            ? 'border-status-success/45 bg-status-success-subtle text-fg-success shadow-token-sm ring-1 ring-status-success/15'
                            : 'border-border-subtle bg-bg-muted text-fg-secondary hover:border-border-strong hover:bg-bg-elevated'
                            }`}
                    >
                        <div className="mb-2 flex items-center gap-2 text-sm font-black">
                            <Radio className="h-4 w-4" />
                            รอบเสริม
                        </div>
                        <p className="text-xs leading-relaxed opacity-85">
                            ใช้ตอนอยากรู้ว่าใครอยู่หรือใครช่วยกิจกรรมเสริม ระบบนับเฉพาะคนที่เข้าร่วม ไม่ลงขาด
                        </p>
                    </button>
                </div>
            </section>

            {!isManualMode ? (
                <section className="rounded-token-xl border border-border-subtle bg-bg-subtle p-3 shadow-token-sm sm:p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-black text-fg-primary">วิธียืนยันตอนสมาชิกกดเอง</p>
                            <p className="mt-1 text-xs leading-relaxed text-fg-tertiary">
                                ใช้เพิ่มความน่าเชื่อถือของรอบ Discord โดยไม่ทำให้คนเช็คเสียเวลามาก
                            </p>
                        </div>
                        <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-fg-warning" />
                    </div>
                    <div className="grid gap-2.5 md:grid-cols-2">
                        <button
                            type="button"
                            onClick={() => setVerificationMode('NONE')}
                            data-testid="attendance-verification-none"
                            className={`min-h-[88px] rounded-token-xl border p-3 text-left transition-colors ${verificationMode === 'NONE'
                                ? 'border-status-success/45 bg-status-success-subtle text-fg-success shadow-token-sm ring-1 ring-status-success/15'
                                : 'border-border-subtle bg-bg-muted text-fg-secondary hover:border-border-strong hover:bg-bg-elevated'
                                }`}
                        >
                            <div className="mb-2 flex items-center gap-2 text-sm font-black">
                                <Radio className="h-4 w-4" />
                                กดเช็คชื่อทันที
                            </div>
                            <p className="text-xs leading-relaxed opacity-85">
                                เหมาะกับรอบทั่วไป สมาชิกกดปุ่มแล้วบันทึกเป็นมาเลย
                            </p>
                        </button>
                        <button
                            type="button"
                            onClick={() => setVerificationMode('CODE')}
                            data-testid="attendance-verification-code"
                            className={`min-h-[88px] rounded-token-xl border p-3 text-left transition-colors ${verificationMode === 'CODE'
                                ? 'border-status-warning/45 bg-status-warning-subtle text-fg-warning shadow-token-sm ring-1 ring-status-warning/15'
                                : 'border-border-subtle bg-bg-muted text-fg-secondary hover:border-border-strong hover:bg-bg-elevated'
                                }`}
                        >
                            <div className="mb-2 flex items-center gap-2 text-sm font-black">
                                <KeyRound className="h-4 w-4" />
                                กรอกรหัสจากเจ้าหน้าที่
                            </div>
                            <p className="text-xs leading-relaxed opacity-85">
                                ระบบสุ่มรหัส 4 หลักให้เจ้าหน้าที่บอกในเกมหรือห้องเสียง สมาชิกต้องกรอกให้ถูกก่อนบันทึก
                            </p>
                        </button>
                    </div>
                </section>
            ) : null}

            <section className="rounded-token-xl border border-border-subtle bg-bg-subtle p-3 shadow-token-sm sm:p-4">
                <label className="mb-2 block text-sm font-semibold tracking-wide text-fg-secondary">
                    ชื่อรอบ <span className="text-fg-danger">*</span>
                </label>
                <input
                    type="text"
                    data-testid="attendance-session-name"
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    placeholder="เช็คชื่อ 5 กุมภาพันธ์"
                    className="w-full rounded-token-lg border border-border-subtle bg-bg-muted px-4 py-2.5 text-fg-primary shadow-inner outline-none transition-colors placeholder:text-fg-tertiary hover:border-border-strong focus:border-status-success/50 focus:ring-2 focus:ring-status-success/50"
                    autoFocus
                />
            </section>

            {isManualMode ? (
                <section className="rounded-token-xl border border-status-warning/20 bg-status-warning-subtle/35 p-3 shadow-token-sm sm:p-4">
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
                        className="w-full rounded-token-lg border border-border-subtle bg-bg-muted px-4 py-2.5 text-fg-primary shadow-inner outline-none transition-colors hover:border-border-strong focus:border-status-warning/50 focus:ring-2 focus:ring-status-warning/50 [color-scheme:inherit]"
                    />
                    <p className="mt-3 text-xs leading-relaxed text-fg-tertiary">
                        {isSupplementalRound
                            ? 'รอบนี้ไม่มีเวลาเปิด/ปิด ระบบจะเปิดตารางให้เจ้าหน้าที่เลือกเฉพาะคนที่เข้าร่วม และปิดรอบได้ทันที'
                            : 'รอบนี้ไม่มีเวลาเปิด/ปิด ระบบจะเปิดตารางให้เจ้าหน้าที่เช็คเองทันที และปิดรอบได้เมื่อเช็คครบทุกคน'}
                    </p>
                </section>
            ) : (
                <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <div className="rounded-token-xl border border-status-success/20 bg-status-success-subtle/40 p-3 sm:p-3.5">
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
                            className="mb-3 w-full rounded-token-lg border border-border-subtle bg-bg-muted px-4 py-2.5 text-fg-primary shadow-inner outline-none transition-colors hover:border-border-strong focus:border-status-success/50 focus:ring-2 focus:ring-status-success/50 [color-scheme:inherit]"
                        />
                        <TimePickerField
                            testId="attendance-start-time"
                            value={startTime}
                            onChange={setStartTime}
                            label="เวลาเปิดเช็คชื่อ"
                            tone="success"
                        />
                        <div className="mt-2 flex items-center gap-2 text-[11px] font-medium text-fg-tertiary">
                            <span>เวลาเปิด</span>
                            <InfoTip label="เวลาเปิด" content="สมาชิกจะเริ่มกดเช็คชื่อจากปุ่ม Discord ได้ตั้งแต่เวลานี้ ใช้เวลาไทยแบบ 24 ชั่วโมง" />
                        </div>
                    </div>
                    <div className="rounded-token-xl border border-status-danger/20 bg-status-danger-subtle/40 p-3 sm:p-3.5">
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
                            className={`mb-3 w-full rounded-token-lg border bg-bg-muted px-4 py-2.5 text-fg-primary shadow-inner outline-none transition-colors focus:ring-2 [color-scheme:inherit] ${!isTimeValid ? 'border-status-danger/50 bg-status-danger-subtle focus:ring-status-danger/50' : 'border-border-subtle hover:border-border-strong focus:border-status-success/50 focus:ring-status-success/50'}`}
                        />
                        <TimePickerField
                            testId="attendance-end-time"
                            value={endTime}
                            onChange={setEndTime}
                            label="เวลาหมดเขต"
                            tone="danger"
                        />
                        <div className="mt-2 flex items-center gap-2 text-[11px] font-medium text-fg-tertiary">
                            <span>เวลาปิด</span>
                            <InfoTip
                                label="เวลาปิด"
                                content={isSupplementalRound
                                    ? 'หลังเวลานี้ระบบจะล็อกการเข้าร่วม รอบเสริมจะสรุปเฉพาะคนที่กดเข้าร่วมเท่านั้น'
                                    : 'หลังเวลานี้ระบบจะล็อกการกดเช็คชื่อ และคนที่ยังไม่เช็คจะถูกประเมินเป็นขาดตามเงื่อนไขของรอบ'}
                            />
                        </div>
                        {!isTimeValid && (
                            <p className="mt-2 flex w-fit items-center gap-1.5 rounded-token-md border border-status-danger/20 bg-status-danger-subtle px-2 py-1 text-[11px] font-medium text-fg-danger">
                                <AlertCircle className="h-3 w-3" />
                                ต้องมากกว่าเวลาเปิด
                            </p>
                        )}
                    </div>
                </section>
            )}

            <section className="rounded-token-xl border border-border-subtle bg-bg-subtle p-3 shadow-token-sm sm:p-4">
                <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold tracking-wide text-fg-secondary">
                    {hasFinance ? <DollarSign className="h-4 w-4 text-fg-secondary" /> : <Lock className="h-4 w-4 text-fg-warning" />}
                    ค่าปรับขาด <span className="font-normal text-fg-tertiary">(ไม่บังคับ)</span>
                </label>
                {isSupplementalRound ? (
                    <div className="rounded-token-xl border border-status-success/20 bg-status-success-subtle p-4">
                        <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-fg-success">
                            <Radio className="h-4 w-4" />
                            รอบเสริมไม่ใช้ค่าปรับ
                        </p>
                        <p className="text-xs font-medium leading-relaxed text-fg-secondary">
                            คนที่ไม่เข้าร่วมรอบเสริมจะไม่ถูกลงขาด จึงไม่ควรเกิดหนี้หรือค่าปรับจากรอบนี้
                        </p>
                    </div>
                ) : hasFinance ? (
                    <div className="relative">
                        <input
                            type="number"
                            data-testid="attendance-absent-penalty"
                            value={absentPenalty || ''}
                            onChange={(e) => setAbsentPenalty(Number(e.target.value))}
                            min={0}
                            placeholder="0"
                            className="w-full rounded-token-lg border border-border-subtle bg-bg-muted py-2.5 pl-4 pr-12 font-medium tabular-nums text-fg-primary shadow-inner outline-none transition-colors hover:border-border-strong focus:border-status-success/50 focus:ring-2 focus:ring-status-success/50"
                        />
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                            <span className="font-medium text-fg-tertiary">฿</span>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-token-xl border border-status-warning/20 bg-status-warning-subtle p-4">
                        <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-fg-warning">
                            <Lock className="h-4 w-4" />
                            ค่าปรับอัตโนมัติต้องใช้แพลน Premium
                        </p>
                        <p className="mb-3 text-xs font-medium leading-relaxed text-fg-secondary">
                            แพลนปัจจุบันยังไม่รองรับการเชื่อมกับระบบการเงิน ระบบจะบันทึกผลเช็คชื่อได้ แต่ไม่หักเงินอัตโนมัติ
                        </p>
                        <a href={`/dashboard/${gangId}/billing`} className="inline-flex items-center justify-center gap-1.5 rounded-token-lg border border-status-warning/20 bg-status-warning-subtle px-3 py-1.5 text-[11px] font-bold text-fg-warning transition-colors hover:opacity-90">
                            <Zap className="h-3.5 w-3.5" />
                            อัปเกรดแพลน
                        </a>
                    </div>
                )}
            </section>

            <div className="flex flex-col-reverse gap-3 rounded-token-xl border border-border-subtle bg-bg-subtle p-3 shadow-token-sm sm:flex-row">
                <Link
                    href={`/dashboard/${gangId}/attendance`}
                    className="flex items-center justify-center gap-2 rounded-token-lg border border-border-subtle bg-bg-muted px-6 py-2.5 font-semibold text-fg-secondary shadow-token-sm transition-colors hover:bg-bg-subtle"
                >
                    <ArrowLeft className="h-4 w-4" />
                    ยกเลิก
                </Link>
                <button
                    type="submit"
                    data-testid="attendance-create-submit"
                    disabled={isSubmitting || !isTimeValid}
                    className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-token-lg bg-status-success px-4 py-2 font-bold text-fg-inverse shadow-token-sm transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
