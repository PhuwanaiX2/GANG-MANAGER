'use client';

import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    DollarSign,
    Lock,
    RefreshCw,
    Send,
    Zap,
} from 'lucide-react';
import { logClientError } from '@/lib/clientLogger';
import { TimePickerField } from '@/components/ui';

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

function FieldLabel({ children, required = false }: { children: ReactNode; required?: boolean }) {
    return (
        <label className="flex items-center gap-1.5 text-sm font-semibold text-fg-secondary">
            {children}
            {required ? <span className="text-fg-danger">*</span> : null}
        </label>
    );
}

function SegmentGroup({
    label,
    children,
    hint,
}: {
    label: string;
    children: ReactNode;
    hint?: string;
}) {
    return (
        <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-black text-fg-primary">{label}</h2>
                {hint ? <span className="text-xs font-medium text-fg-tertiary">{hint}</span> : null}
            </div>
            <div className="grid gap-1 rounded-token-lg border border-border-subtle bg-bg-muted/55 p-1 sm:grid-cols-2">{children}</div>
        </section>
    );
}

function SegmentOption({
    active,
    onClick,
    testId,
    title,
    description,
}: {
    active: boolean;
    onClick: () => void;
    testId: string;
    title: string;
    description: string;
}) {
    return (
        <button
            type="button"
            aria-pressed={active}
            onClick={onClick}
            data-testid={testId}
            className={[
                'min-h-16 rounded-token-md px-3 py-2.5 text-left transition-colors',
                active
                    ? 'bg-bg-base text-fg-primary shadow-token-sm ring-1 ring-border-subtle'
                    : 'text-fg-secondary hover:bg-bg-base/60 hover:text-fg-primary',
            ].join(' ')}
        >
            <span className="flex items-center justify-between gap-3">
                <span className="text-sm font-black">{title}</span>
                <span
                    className={[
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded-token-full border',
                        active ? 'border-status-success bg-status-success text-fg-inverse' : 'border-border-strong',
                    ].join(' ')}
                >
                    {active ? <CheckCircle2 className="h-3 w-3" /> : null}
                </span>
            </span>
            <span className="mt-1 block text-xs leading-5 text-fg-tertiary">{description}</span>
        </button>
    );
}

export function CreateSessionForm({ gangId, hasFinance = true }: Props) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [defaultDateTimes] = useState(getDefaultDateTimes);

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
    const submitLabel = isManualMode ? 'สร้างตารางเช็คชื่อ' : 'สร้างรอบเช็คชื่อ';

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
            toast.error('เวลาปิดต้องมากกว่าเวลาเปิด');
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
                    ? 'เปิดตารางให้เจ้าหน้าที่เช็คแล้ว'
                    : 'รอบพร้อมเปิดใช้งานและส่งไป Discord ตามเวลาที่ตั้งไว้',
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
        <form
            onSubmit={handleSubmit}
            className="mx-auto max-w-3xl overflow-hidden rounded-token-xl border border-border-subtle bg-bg-subtle shadow-token-sm"
            data-testid="attendance-create-form"
        >
            <div className="border-b border-border-subtle bg-bg-base px-4 py-4 sm:px-5">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-fg-tertiary">สร้างรอบ</p>
                <h2 className="mt-1 text-lg font-black tracking-tight text-fg-primary sm:text-xl">สร้างรอบเช็คชื่อใหม่</h2>
                <p className="mt-1 text-sm leading-6 text-fg-tertiary">เลือกวิธีเช็ค ตั้งเวลา แล้วกดสร้างรอบ</p>
            </div>

            <div className="space-y-5 px-4 py-5 sm:px-5">
                <SegmentGroup label="ประเภทการเช็คชื่อ">
                    <SegmentOption
                        active={sessionMode === 'DISCORD_SELF_CHECKIN'}
                        onClick={() => setSessionMode('DISCORD_SELF_CHECKIN')}
                        testId="attendance-mode-discord"
                        title="สมาชิกเช็คชื่อเอง"
                        description="ส่งปุ่มเช็คชื่อไป Discord"
                    />
                    <SegmentOption
                        active={sessionMode === 'MANUAL_ROLL_CALL'}
                        onClick={() => setSessionMode('MANUAL_ROLL_CALL')}
                        testId="attendance-mode-manual"
                        title="เจ้าหน้าที่เช็คชื่อ"
                        description="เจ้าหน้าที่ติ๊กผลในเว็บ"
                    />
                </SegmentGroup>

                <div className="h-px bg-border-subtle" />

                <section className="space-y-3">
                    <h2 className="text-sm font-black text-fg-primary">ข้อมูลรอบ</h2>
                    <div className="space-y-2">
                        <FieldLabel required>ชื่อรอบ</FieldLabel>
                        <input
                            type="text"
                            data-testid="attendance-session-name"
                            value={sessionName}
                            onChange={(e) => setSessionName(e.target.value)}
                            placeholder="เช็คชื่อ 20 มิถุนายน"
                            className="w-full rounded-token-lg border border-border-subtle bg-bg-muted/60 px-4 py-3 text-fg-primary shadow-inner outline-none transition-colors placeholder:text-fg-tertiary hover:border-border-strong focus:border-status-success/50 focus:ring-2 focus:ring-status-success/40"
                            autoFocus
                        />
                    </div>

                    {isManualMode ? null : (
                        <div className="grid gap-3 lg:grid-cols-2">
                            <div className="space-y-3">
                                <FieldLabel>เวลาเปิด</FieldLabel>
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
                                    label="เวลาเปิด"
                                    tone="success"
                                />
                            </div>

                            <div className="space-y-3">
                                <FieldLabel>เวลาปิด</FieldLabel>
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
                                    label="เวลาปิด"
                                    tone="danger"
                                />
                            </div>
                        </div>
                    )}

                    {!isManualMode && !isTimeValid ? (
                        <p className="flex w-fit items-center gap-1.5 rounded-token-md border border-status-danger/20 bg-status-danger-subtle px-2 py-1 text-[11px] font-medium text-fg-danger">
                            <AlertCircle className="h-3 w-3" />
                            เวลาปิดต้องมากกว่าเวลาเปิด
                        </p>
                    ) : null}
                </section>

                {!isManualMode ? (
                    <>
                        <div className="h-px bg-border-subtle" />
                        <SegmentGroup label="วิธีเช็คชื่อ">
                            <SegmentOption
                                active={verificationMode === 'NONE'}
                                onClick={() => setVerificationMode('NONE')}
                                testId="attendance-verification-none"
                                title="เช็คชื่อทันที"
                                description="กดแล้วบันทึกผลเลย"
                            />
                            <SegmentOption
                                active={verificationMode === 'CODE'}
                                onClick={() => setVerificationMode('CODE')}
                                testId="attendance-verification-code"
                                title="เช็คชื่อด้วยรหัส"
                                description="กดแล้วต้องกรอกรหัสรอบ"
                            />
                        </SegmentGroup>
                        {verificationMode === 'CODE' ? (
                            <p className="rounded-token-lg border border-status-warning/20 bg-status-warning-subtle px-4 py-3 text-xs leading-5 text-fg-secondary">
                                <span className="font-black text-fg-warning">รหัสจะแสดงหลังสร้างรอบ</span> เจ้าหน้าที่นำรหัสไปบอกสมาชิกตอนเริ่มเช็คชื่อ
                            </p>
                        ) : null}
                    </>
                ) : null}

                <div className="h-px bg-border-subtle" />

                <SegmentGroup label="ประเภทการนับผล">
                    <SegmentOption
                        active={countingPolicy === 'REQUIRED'}
                        onClick={() => setCountingPolicy('REQUIRED')}
                        testId="attendance-counting-required"
                        title="รอบบังคับ"
                        description="นับมา/ขาดสำหรับสมาชิก"
                    />
                    <SegmentOption
                        active={countingPolicy === 'SUPPLEMENTAL'}
                        onClick={() => setCountingPolicy('SUPPLEMENTAL')}
                        testId="attendance-counting-supplemental"
                        title="รอบเสริม"
                        description="นับเฉพาะคนที่มา"
                    />
                </SegmentGroup>

                <div className="h-px bg-border-subtle" />

                <section className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="flex items-center gap-1.5 text-sm font-black text-fg-primary">
                            <DollarSign className="h-4 w-4 text-fg-tertiary" />
                            ค่าปรับ
                        </h2>
                        <span className="text-xs font-medium text-fg-tertiary">ไม่บังคับ</span>
                    </div>

                    {isSupplementalRound ? (
                        <p className="rounded-token-lg border border-status-success/20 bg-status-success-subtle px-4 py-3 text-sm font-semibold text-fg-success">
                            รอบเสริมไม่มีค่าปรับ เพราะไม่ลงขาดให้คนที่ไม่ได้เข้าร่วม
                        </p>
                    ) : hasFinance ? (
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)] sm:items-center">
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
                            <p className="text-xs leading-5 text-fg-tertiary">ใส่ 0 ถ้าต้องการเช็คชื่ออย่างเดียว</p>
                        </div>
                    ) : (
                        <div className="rounded-token-lg border border-status-warning/20 bg-status-warning-subtle p-4">
                            <p className="flex items-center gap-1.5 text-sm font-semibold text-fg-warning">
                                <Lock className="h-4 w-4" />
                                ค่าปรับอัตโนมัติต้องใช้ Premium
                            </p>
                            <Link
                                href={'/dashboard/' + gangId + '/billing'}
                                className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-token-lg border border-status-warning/20 bg-status-warning-subtle px-3 py-1.5 text-[11px] font-bold text-fg-warning transition-colors hover:opacity-90"
                            >
                                <Zap className="h-3.5 w-3.5" />
                                ดูแผน Premium
                            </Link>
                        </div>
                    )}
                </section>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-border-subtle bg-bg-base px-4 py-4 sm:flex-row sm:px-5">
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
                            กำลังสร้าง...
                        </>
                    ) : (
                        <>
                            <Send className="h-4 w-4" />
                            {submitLabel}
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}
