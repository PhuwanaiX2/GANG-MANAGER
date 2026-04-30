'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getAttendanceStatusLabel } from '@gang/database/attendance';
import { AlertCircle, CheckCircle2, Clock3, ExternalLink, FileText, Loader2, Send } from 'lucide-react';
import { logClientError } from '@/lib/clientLogger';

interface AttendanceRecordSummary {
    status: string;
    checkedInAt: Date | string | null;
    penaltyAmount: number;
}

interface LeaveRequestSummary {
    id: string;
    type: string;
    status: string;
    reason: string;
    startDate: Date | string;
    endDate: Date | string;
}

interface LeavePreview {
    note: string;
    type: 'FULL' | 'LATE';
    statusLabel: string;
}

interface Props {
    gangId: string;
    sessionStatus: string;
    sessionName: string;
    sessionStart: Date | string;
    sessionEnd: Date | string;
    memberName: string;
    attendanceRecord: AttendanceRecordSummary | null;
    leavePreview: LeavePreview | null;
    relevantLeaveRequest: LeaveRequestSummary | null;
}

const lateDelayOptions = [15, 30, 60, 90, 120] as const;
const timeOptions = Array.from({ length: 24 * 12 }, (_, index) => {
    const hour = Math.floor(index / 12);
    const minute = (index % 12) * 5;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
});

function formatBangkokDateKey(value: Date | string) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date(value));
}

function formatBangkokTime(value: Date | string) {
    return new Intl.DateTimeFormat('th-TH', {
        timeZone: 'Asia/Bangkok',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(new Date(value));
}

function formatTimeInput(value: Date | string) {
    return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Bangkok',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(new Date(value));
}

export function MemberSessionAttendanceCard({
    gangId,
    sessionStatus,
    sessionName,
    sessionStart,
    sessionEnd,
    memberName,
    attendanceRecord,
    leavePreview,
    relevantLeaveRequest,
}: Props) {
    const router = useRouter();
    const [mode, setMode] = useState<'FULL' | 'LATE' | null>(null);
    const [reason, setReason] = useState('');
    const [selectedDelay, setSelectedDelay] = useState<number>(30);
    const [customTime, setCustomTime] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const sessionDateKey = useMemo(() => formatBangkokDateKey(sessionStart), [sessionStart]);
    const isSessionOpen = sessionStatus === 'ACTIVE' || sessionStatus === 'SCHEDULED';
    const hasExistingRelevantRequest = Boolean(relevantLeaveRequest && relevantLeaveRequest.status !== 'REJECTED');
    const canCreateRequest = isSessionOpen && !attendanceRecord && !hasExistingRelevantRequest;

    const presetLateTarget = useMemo(() => {
        const baseTime = new Date(Math.max(Date.now(), new Date(sessionStart).getTime()));
        const target = new Date(baseTime.getTime() + selectedDelay * 60 * 1000);
        return {
            lateDate: formatBangkokDateKey(target),
            lateTime: formatTimeInput(target),
            label: formatBangkokTime(target),
        };
    }, [selectedDelay, sessionStart]);

    const handleCreateRequest = async () => {
        setSubmitting(true);
        try {
            const payload = mode === 'FULL'
                ? {
                    type: 'FULL',
                    startDate: sessionDateKey,
                    endDate: sessionDateKey,
                    reason,
                }
                : {
                    type: 'LATE',
                    lateDate: customTime ? sessionDateKey : presetLateTarget.lateDate,
                    lateTime: customTime || presetLateTarget.lateTime,
                    reason,
                };

            const res = await fetch(`/api/gangs/${gangId}/leaves`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error || 'ส่งคำขอไม่สำเร็จ');
            }

            toast.success(mode === 'FULL' ? 'ส่งคำขอลารอบนี้แล้ว' : 'ส่งคำขอแจ้งเข้าช้ารอบนี้แล้ว');
            setMode(null);
            setReason('');
            setCustomTime('');
            router.refresh();
        } catch (error: any) {
            logClientError('dashboard.attendance.member_leave_request.failed', error, { gangId, mode });
            toast.error(error?.message || 'เกิดข้อผิดพลาด');
        } finally {
            setSubmitting(false);
        }
    };

    const statusTone = attendanceRecord
        ? attendanceRecord.status === 'LEAVE'
            ? 'bg-status-info-subtle border-status-info text-fg-info'
            : attendanceRecord.status === 'ABSENT'
                ? 'bg-status-danger-subtle border-status-danger text-fg-danger'
                : 'bg-status-success-subtle border-status-success text-fg-success'
        : relevantLeaveRequest?.status === 'APPROVED'
            ? (leavePreview?.type === 'LATE' || relevantLeaveRequest.type === 'LATE'
                ? 'bg-status-warning-subtle border-status-warning text-fg-warning'
                : 'bg-status-info-subtle border-status-info text-fg-info')
            : relevantLeaveRequest?.status === 'PENDING'
                ? 'bg-status-warning-subtle border-status-warning text-fg-warning'
                : 'bg-bg-muted border-border-subtle text-fg-secondary';

    const statusChip = attendanceRecord
        ? getAttendanceStatusLabel(attendanceRecord.status)
        : relevantLeaveRequest?.status === 'APPROVED'
            ? (leavePreview?.statusLabel || (relevantLeaveRequest.type === 'LATE' ? 'แจ้งเข้าช้า' : 'ลา'))
            : relevantLeaveRequest?.status === 'PENDING'
                ? (relevantLeaveRequest.type === 'LATE' ? 'รอรับทราบ' : 'รออนุมัติ')
                : sessionStatus === 'CLOSED'
                    ? 'ปิดรอบแล้ว'
                    : sessionStatus === 'CANCELLED'
                        ? 'ยกเลิกรอบ'
                        : 'ยังไม่มีคำขอ';

    const statusTitle = attendanceRecord
        ? `สถานะล่าสุด: ${getAttendanceStatusLabel(attendanceRecord.status)}`
        : relevantLeaveRequest?.status === 'APPROVED'
            ? (leavePreview?.type === 'LATE' || relevantLeaveRequest.type === 'LATE'
                ? 'ระบบรับทราบการแจ้งเข้าช้าของคุณสำหรับรอบนี้แล้ว'
                : 'ระบบบันทึกว่าคุณได้รับอนุมัติลาในรอบนี้แล้ว')
        : relevantLeaveRequest?.status === 'PENDING'
            ? (relevantLeaveRequest.type === 'LATE'
                ? 'คุณมีรายการแจ้งเข้าช้าที่กำลังรอการตรวจสอบ'
                : 'คุณมีคำขอลาที่กำลังรออนุมัติสำหรับรอบนี้')
            : sessionStatus === 'CLOSED'
                ? 'รอบนี้ปิดแล้ว'
                : sessionStatus === 'CANCELLED'
                    ? 'รอบนี้ถูกยกเลิกแล้ว'
                    : 'ถ้ารู้ว่าจะมาไม่ทัน คุณแจ้งจากหน้านี้ได้เลย';

    const statusDescription = attendanceRecord
        ? attendanceRecord.checkedInAt
            ? `เช็คชื่อเมื่อ ${formatBangkokTime(attendanceRecord.checkedInAt)} น.`
            : attendanceRecord.penaltyAmount > 0
                ? `รอบนี้ถูกคิดค่าปรับ ${attendanceRecord.penaltyAmount.toLocaleString()} ฿`
                : 'สถานะของคุณสำหรับรอบนี้ถูกบันทึกเรียบร้อยแล้ว'
        : relevantLeaveRequest?.status === 'APPROVED'
            ? (leavePreview?.note || `เหตุผล: ${relevantLeaveRequest.reason}`)
        : relevantLeaveRequest?.status === 'PENDING'
                ? `กำลังรอหัวหน้าแก๊งหรือแอดมินตรวจสอบ${relevantLeaveRequest.reason ? ` — ${relevantLeaveRequest.reason}` : ''}`
                : sessionStatus === 'CLOSED'
                    ? 'หากต้องการดูผลสรุปเพิ่มเติม สามารถตรวจสอบได้จากหน้าการลาหรือประวัติ attendance'
                    : sessionStatus === 'CANCELLED'
                        ? 'รอบนี้จะไม่ถูกนำไปคิดผล attendance เพิ่มเติม'
                        : `รอบ ${sessionName} เปิดเวลา ${formatBangkokTime(sessionStart)} - ${formatBangkokTime(sessionEnd)} น. ถ้ามีเหตุจำเป็นสามารถเลือกแจ้งลาหรือแจ้งเข้าช้าด้านล่างได้ทันที`;

    return (
        <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl shadow-token-sm overflow-hidden">
            <div className="p-5 space-y-4">
                <div className={`rounded-token-2xl border p-4 ${statusTone}`}>
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-token-xl bg-bg-muted border border-border-subtle flex items-center justify-center shrink-0 mt-0.5">
                                {attendanceRecord ? (
                                    attendanceRecord.status === 'LEAVE'
                                        ? <FileText className="w-4.5 h-4.5" />
                                        : attendanceRecord.status === 'ABSENT'
                                            ? <AlertCircle className="w-4.5 h-4.5" />
                                            : <CheckCircle2 className="w-4.5 h-4.5" />
                                ) : (
                                    <Clock3 className="w-4.5 h-4.5" />
                                )}
                            </div>
                            <div className="space-y-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center rounded-token-full border border-current/20 bg-bg-base/40 px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase">
                                        {statusChip}
                                    </span>
                                    <span className="text-[11px] opacity-75">สมาชิก: {memberName}</span>
                                </div>
                                <div className="text-sm font-semibold leading-relaxed">{statusTitle}</div>
                                <div className="text-xs leading-relaxed opacity-90">{statusDescription}</div>
                            </div>
                        </div>
                        <Link
                            href={`/dashboard/${gangId}/leaves`}
                            className="inline-flex items-center gap-1.5 text-xs text-fg-tertiary hover:text-fg-primary transition-colors shrink-0"
                        >
                            หน้าการลา
                            <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                </div>

                {canCreateRequest ? (
                    <div className="space-y-4 rounded-token-2xl border border-border-subtle bg-bg-muted p-4 shadow-inner">
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setMode('FULL')}
                                className={`px-4 py-2 rounded-token-xl text-sm font-semibold transition-colors ${mode === 'FULL' ? 'bg-status-danger-subtle text-fg-danger border border-status-danger shadow-token-sm' : 'bg-bg-subtle text-fg-secondary hover:bg-bg-elevated'}`}
                            >
                                แจ้งลาทั้งรอบ
                            </button>
                            <button
                                onClick={() => setMode('LATE')}
                                className={`px-4 py-2 rounded-token-xl text-sm font-semibold transition-colors ${mode === 'LATE' ? 'bg-status-warning-subtle text-fg-warning border border-status-warning shadow-token-sm' : 'bg-bg-subtle text-fg-secondary hover:bg-bg-elevated'}`}
                            >
                                แจ้งเข้าช้า
                            </button>
                        </div>

                        {mode && (
                            <div className="space-y-4 rounded-token-2xl border border-border-subtle bg-bg-subtle p-4">
                                {mode === 'FULL' ? (
                                    <div className="text-sm text-fg-secondary">
                                        ระบบจะส่งคำขอลาเต็มวันสำหรับวันที่ {sessionDateKey} และแอดมินสามารถอนุมัติได้จากเว็บหรือ Discord
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="text-sm text-fg-secondary">เลือกว่าจะเข้าช้าประมาณเท่าไร หรือกำหนดเวลาเอง</div>
                                        <div className="flex flex-wrap gap-2">
                                            {lateDelayOptions.map((delay) => (
                                                <button
                                                    key={delay}
                                                    onClick={() => {
                                                        setSelectedDelay(delay);
                                                        setCustomTime('');
                                                    }}
                                                    className={`px-3 py-2 rounded-token-xl text-sm font-semibold transition-colors ${selectedDelay === delay && !customTime ? 'bg-status-warning-subtle text-fg-warning border border-status-warning shadow-token-sm' : 'bg-bg-muted text-fg-secondary hover:bg-bg-elevated'}`}
                                                >
                                                    {delay} นาที
                                                </button>
                                            ))}
                                        </div>
                                        <label className="block space-y-2">
                                            <span className="text-xs text-fg-tertiary font-medium">หรือเลือกเวลาเองแบบ 24 ชั่วโมง</span>
                                            <select
                                                value={customTime}
                                                onChange={(event) => setCustomTime(event.target.value)}
                                                className="w-full md:w-52 bg-bg-base border border-border-subtle rounded-token-xl px-3 py-2.5 text-sm text-fg-primary focus:outline-none focus:border-status-warning"
                                            >
                                                <option value="">ใช้เวลาประมาณจากปุ่มด้านบน</option>
                                                {timeOptions.map((time) => (
                                                    <option key={time} value={time}>
                                                        {time}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                        <div className="text-xs text-fg-tertiary">
                                            เวลาที่จะถูกส่ง: {customTime || `${presetLateTarget.lateTime} น. (ประมาณ ${presetLateTarget.label} น.)`}
                                        </div>
                                    </div>
                                )}

                                <label className="block space-y-2">
                                    <span className="text-xs text-fg-tertiary font-medium">เหตุผล (ไม่บังคับ)</span>
                                    <textarea
                                        value={reason}
                                        onChange={(event) => setReason(event.target.value)}
                                        rows={3}
                                        maxLength={500}
                                        className="w-full bg-bg-base border border-border-subtle rounded-token-xl px-3 py-3 text-sm text-fg-primary placeholder:text-fg-tertiary resize-none focus:outline-none focus:border-border-strong"
                                        placeholder={mode === 'FULL' ? 'เช่น ติดธุระ / ป่วย / ไม่สะดวกเข้าร่วมรอบนี้' : 'เช่น รถติด / ติดงาน / อินเทอร์เน็ตมีปัญหา'}
                                    />
                                </label>

                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <div className="text-xs text-fg-tertiary">
                                        คำขอจะถูกส่งไปให้หัวหน้าแก๊ง/แอดมินตรวจสอบก่อนมีผล
                                    </div>
                                    <button
                                        onClick={handleCreateRequest}
                                        disabled={submitting || (mode === 'LATE' && !customTime && !selectedDelay)}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-token-xl bg-accent hover:bg-accent-hover text-accent-fg text-sm font-semibold transition-all disabled:opacity-50"
                                    >
                                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                        ส่งคำขอ
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="rounded-token-2xl border border-border-subtle bg-bg-muted p-4 text-sm text-fg-tertiary leading-relaxed">
                        {attendanceRecord
                            ? 'เมื่อมีการบันทึก attendance แล้ว ระบบจะไม่เปิดให้สร้างคำขอสำหรับรอบนี้เพิ่มจากหน้านี้'
                            : hasExistingRelevantRequest
                                ? 'คุณมีคำขอสำหรับรอบนี้อยู่แล้ว หากต้องการติดตามผลหรือดูรายการย้อนหลัง สามารถเปิดได้จากหน้าการลา'
                                : sessionStatus === 'CANCELLED'
                                    ? 'รอบนี้ยกเลิกแล้ว จึงไม่จำเป็นต้องส่งคำขอเพิ่มเติม'
                                    : 'รอบนี้ปิดแล้ว จึงไม่สามารถสร้างคำขอจากหน้านี้ได้'}
                    </div>
                )}
            </div>
        </div>
    );
}
