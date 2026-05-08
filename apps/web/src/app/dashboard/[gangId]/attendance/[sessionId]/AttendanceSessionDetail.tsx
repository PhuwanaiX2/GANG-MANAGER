'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { toast } from 'sonner';
import { getAttendanceStatusLabel, isPresentLikeStatus, normalizeAttendanceStatus } from '@gang/database/attendance';
import {
    AlertTriangle,
    Clock,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Search,
    User
} from 'lucide-react';
import { ConfirmModal } from '@/components/modals/ConfirmModal';
import { ATTENDANCE_STATS_UPDATE_EVENT, type AttendanceStats } from './AttendanceStatsCards';

interface AttendanceRecord {
    id: string;
    status: string;
    checkedInAt: Date | string | null;
    penaltyAmount: number;
    member: {
        id: string;
        name: string;
        discordAvatar?: string | null;
        discordUsername?: string | null;
    };
}

interface Member {
    id: string;
    name: string;
    discordAvatar?: string | null;
    discordUsername?: string | null;
}

interface LeavePreview {
    note: string;
    type: 'FULL' | 'LATE';
    statusLabel: string;
}

type AttendanceAction = 'PRESENT' | 'ABSENT' | 'LEAVE' | 'RESET';
type AttendanceListItem =
    | { type: 'record'; data: AttendanceRecord }
    | { type: 'leavePreview'; data: { member: Member; preview: LeavePreview } }
    | { type: 'member'; data: Member };

interface Props {
    gangId: string;
    sessionId: string;
    records: AttendanceRecord[];
    notCheckedIn: Member[];
    leavePreviewByMemberId: Record<string, LeavePreview>;
    isSessionActive: boolean;
    isSessionClosed: boolean;
    canManageAttendance: boolean;
    sessionMode?: string | null;
}

type StatusFilter = 'ALL' | 'UNCHECKED' | 'PRESENT' | 'ABSENT' | 'LEAVE';

export function AttendanceSessionDetail({ gangId, sessionId, records, notCheckedIn, leavePreviewByMemberId, isSessionActive, isSessionClosed, canManageAttendance, sessionMode }: Props) {
    const router = useRouter();
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
    const [pendingMemberIds, setPendingMemberIds] = useState<string[]>([]);
    const [localRecords, setLocalRecords] = useState(records);
    const [localNotCheckedIn, setLocalNotCheckedIn] = useState(notCheckedIn);
    const [localLeavePreviewByMemberId, setLocalLeavePreviewByMemberId] = useState(leavePreviewByMemberId);
    const [pendingConfirmation, setPendingConfirmation] = useState<{
        memberId: string;
        memberName: string;
        attendanceStatus: Exclude<AttendanceAction, 'RESET'>;
        currentStatus?: string;
    } | null>(null);
    const ITEMS_PER_PAGE = 10;

    const sortMembers = (items: Member[]) => [...items].sort((a, b) => a.name.localeCompare(b.name, 'th'));

    useEffect(() => {
        setLocalRecords(records);
    }, [records]);

    useEffect(() => {
        setLocalNotCheckedIn(notCheckedIn);
    }, [notCheckedIn]);

    useEffect(() => {
        setLocalLeavePreviewByMemberId(leavePreviewByMemberId);
    }, [leavePreviewByMemberId]);

    const isManualMode = sessionMode === 'MANUAL_ROLL_CALL';

    const allItems = useMemo<AttendanceListItem[]>(() => ([
        ...localRecords.map(r => ({ type: 'record' as const, data: r })),
        ...(isSessionActive ? localNotCheckedIn.map(member => {
            const leavePreview = localLeavePreviewByMemberId[member.id];

            if (leavePreview) {
                return {
                    type: 'leavePreview' as const,
                    data: {
                        member,
                        preview: leavePreview,
                    },
                };
            }

            return { type: 'member' as const, data: member };
        }) : [])
    ]), [isSessionActive, localLeavePreviewByMemberId, localNotCheckedIn, localRecords]);

    const isSessionEditable = canManageAttendance && (isSessionActive || isSessionClosed);

    const filteredItems = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();

        return allItems.filter((item) => {
            const member = item.type === 'record'
                ? item.data.member
                : item.type === 'leavePreview'
                    ? item.data.member
                    : item.data;
            const normalizedStatus = item.type === 'record'
                ? normalizeAttendanceStatus(item.data.status) || 'UNCHECKED'
                : item.type === 'leavePreview'
                    ? 'LEAVE'
                    : 'UNCHECKED';
            const matchesQuery = !query || [
                member.name,
                member.discordUsername || '',
            ].some(value => value.toLowerCase().includes(query));
            const matchesStatus = statusFilter === 'ALL' || normalizedStatus === statusFilter;

            return matchesQuery && matchesStatus;
        });
    }, [allItems, searchTerm, statusFilter]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter]);

    const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedItems = filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const statusColors: Record<string, string> = {
        PRESENT: 'bg-status-success-subtle text-fg-success border-status-success shadow-token-sm',
        ABSENT: 'bg-status-danger-subtle text-fg-danger border-status-danger shadow-token-sm',
        LEAVE: 'bg-status-info-subtle text-fg-info border-status-info shadow-token-sm',
        LATE_NOTICE: 'bg-status-warning-subtle text-fg-warning border-status-warning shadow-token-sm',
    };

    const emitStatsUpdate = (
        nextRecords: AttendanceRecord[],
        nextNotCheckedIn: Member[],
        nextLeavePreviewByMemberId: Record<string, LeavePreview>
    ) => {
        if (typeof window === 'undefined') {
            return;
        }

        const counts = nextRecords.reduce(
            (acc, record) => {
                const normalizedStatus = normalizeAttendanceStatus(record.status);

                if (normalizedStatus === 'PRESENT') {
                    acc.present += 1;
                }

                if (normalizedStatus === 'ABSENT') {
                    acc.absent += 1;
                }

                if (normalizedStatus === 'LEAVE') {
                    acc.leave += 1;
                }

                return acc;
            },
            { present: 0, absent: 0, leave: 0 }
        );

        const previewLeaveCount = isSessionActive
            ? nextNotCheckedIn.filter(member => nextLeavePreviewByMemberId[member.id]).length
            : 0;
        const nextStats: AttendanceStats = {
            total: nextRecords.length + nextNotCheckedIn.length,
            present: counts.present,
            absent: counts.absent,
            leave: counts.leave + previewLeaveCount,
        };

        window.dispatchEvent(new CustomEvent(ATTENDANCE_STATS_UPDATE_EVENT, { detail: nextStats }));
    };

    const actionLabels: Record<AttendanceAction, string> = {
        PRESENT: 'มา',
        ABSENT: 'ขาด',
        LEAVE: 'ลา',
        RESET: 'รีเซ็ต',
    };

    const executeAttendanceUpdate = async (memberId: string, attendanceStatus: AttendanceAction) => {
        setPendingMemberIds(prev => prev.includes(memberId) ? prev : [...prev, memberId]);
        try {
            const res = await fetch(`/api/gangs/${gangId}/attendance/${sessionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memberId, attendanceStatus }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'อัปเดตไม่สำเร็จ');
            }

            const data = await res.json();

            if (attendanceStatus === 'RESET') {
                const restoredMember = localRecords.find(record => record.member.id === memberId)?.member;
                const nextRecords = localRecords.filter(record => record.member.id !== memberId);
                let nextNotCheckedIn = localNotCheckedIn;
                let nextLeavePreviewByMemberId = localLeavePreviewByMemberId;

                if (isSessionActive && restoredMember) {
                    const restoredLeavePreview = leavePreviewByMemberId[memberId];
                    nextNotCheckedIn = sortMembers([
                        ...localNotCheckedIn.filter(member => member.id !== memberId),
                        restoredMember,
                    ]);

                    if (restoredLeavePreview) {
                        nextLeavePreviewByMemberId = {
                            ...localLeavePreviewByMemberId,
                            [memberId]: restoredLeavePreview,
                        };
                    }
                }

                setLocalRecords(nextRecords);
                setLocalNotCheckedIn(nextNotCheckedIn);
                setLocalLeavePreviewByMemberId(nextLeavePreviewByMemberId);
                emitStatsUpdate(nextRecords, nextNotCheckedIn, nextLeavePreviewByMemberId);
            } else if (data.record) {
                const nextRecord = data.record as AttendanceRecord;
                const existingIndex = localRecords.findIndex(record => record.member.id === memberId);
                const nextRecords = existingIndex === -1
                    ? [...localRecords, nextRecord]
                    : localRecords.map((record, index) => index === existingIndex ? nextRecord : record);
                const nextNotCheckedIn = localNotCheckedIn.filter(member => member.id !== memberId);
                const nextLeavePreviewByMemberId = localLeavePreviewByMemberId[memberId]
                    ? Object.fromEntries(Object.entries(localLeavePreviewByMemberId).filter(([id]) => id !== memberId)) as Record<string, LeavePreview>
                    : localLeavePreviewByMemberId;

                setLocalLeavePreviewByMemberId(nextLeavePreviewByMemberId);
                setLocalRecords(nextRecords);
                setLocalNotCheckedIn(nextNotCheckedIn);
                emitStatsUpdate(nextRecords, nextNotCheckedIn, nextLeavePreviewByMemberId);
            }

            toast.success(
                attendanceStatus === 'RESET'
                    ? 'รีเซ็ตสถานะเช็คชื่อแล้ว'
                    : attendanceStatus === 'PRESENT'
                        ? 'บันทึกสถานะเป็นมาแล้ว'
                        : attendanceStatus === 'ABSENT'
                            ? 'บันทึกสถานะเป็นขาดแล้ว'
                            : 'บันทึกสถานะเป็นลาแล้ว'
            );

            router.refresh();
        } catch (error: any) {
            toast.error('อัปเดตเช็คชื่อไม่สำเร็จ', {
                description: error.message,
            });
        } finally {
            setPendingMemberIds(prev => prev.filter(id => id !== memberId));
        }
    };

    const handleAttendanceUpdate = (memberId: string, memberName: string, attendanceStatus: AttendanceAction, currentStatus?: string) => {
        if (isSessionClosed && attendanceStatus !== 'RESET') {
            setPendingConfirmation({
                memberId,
                memberName,
                attendanceStatus,
                currentStatus,
            });
            return;
        }

        void executeAttendanceUpdate(memberId, attendanceStatus);
    };

    const renderQuickActions = (memberId: string, memberName: string, currentStatus?: string, hasPersistedRecord = false, testIdPrefix = 'attendance-action') => {
        if (!isSessionEditable) {
            return <span className="text-fg-tertiary font-medium">-</span>;
        }

        const isUpdating = pendingMemberIds.includes(memberId);
        const normalizedStatus = normalizeAttendanceStatus(currentStatus);
        const isPresentLike = isPresentLikeStatus(currentStatus);
        const isAbsent = normalizedStatus === 'ABSENT';
        const isLeave = normalizedStatus === 'LEAVE';

        return (
            <div className="flex flex-wrap justify-end gap-1.5">
                <button
                    onClick={() => handleAttendanceUpdate(memberId, memberName, 'PRESENT', currentStatus)}
                    data-testid={`${testIdPrefix}-present-${memberId}`}
                    disabled={isUpdating || isPresentLike}
                    aria-pressed={isPresentLike}
                    className={`min-h-11 min-w-[64px] rounded-token-lg px-3 py-2 text-[11px] font-black tracking-wider border transition-all flex items-center justify-center ${isPresentLike ? 'bg-status-success-subtle text-fg-success border-status-success ring-1 ring-status-success/25 shadow-token-sm opacity-100' : 'bg-bg-elevated text-fg-secondary border-border-subtle hover:bg-status-success-subtle hover:text-fg-success hover:border-status-success hover:-translate-y-0.5'} disabled:cursor-not-allowed`}
                >
                    {isUpdating ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'มา'}
                </button>
                <button
                    onClick={() => handleAttendanceUpdate(memberId, memberName, 'ABSENT', currentStatus)}
                    data-testid={`${testIdPrefix}-absent-${memberId}`}
                    disabled={isUpdating || isAbsent}
                    aria-pressed={isAbsent}
                    className={`min-h-11 min-w-[64px] rounded-token-lg px-3 py-2 text-[11px] font-black tracking-wider border transition-all flex items-center justify-center ${isAbsent ? 'bg-status-danger-subtle text-fg-danger border-status-danger ring-1 ring-status-danger/25 shadow-token-sm opacity-100' : 'bg-bg-elevated text-fg-secondary border-border-subtle hover:bg-status-danger-subtle hover:text-fg-danger hover:border-status-danger hover:-translate-y-0.5'} disabled:cursor-not-allowed`}
                >
                    {isUpdating ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'ขาด'}
                </button>
                <button
                    onClick={() => handleAttendanceUpdate(memberId, memberName, 'LEAVE', currentStatus)}
                    data-testid={`${testIdPrefix}-leave-${memberId}`}
                    disabled={isUpdating || isLeave}
                    aria-pressed={isLeave}
                    className={`min-h-11 min-w-[64px] rounded-token-lg px-3 py-2 text-[11px] font-black tracking-wider border transition-all flex items-center justify-center ${isLeave ? 'bg-status-info-subtle text-fg-info border-status-info ring-1 ring-status-info/25 shadow-token-sm opacity-100' : 'bg-bg-elevated text-fg-secondary border-border-subtle hover:bg-status-info-subtle hover:text-fg-info hover:border-status-info hover:-translate-y-0.5'} disabled:cursor-not-allowed`}
                >
                    {isUpdating ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'ลา'}
                </button>
                {currentStatus && hasPersistedRecord && isSessionActive && (
                    <button
                        onClick={() => handleAttendanceUpdate(memberId, memberName, 'RESET', currentStatus)}
                        data-testid={`${testIdPrefix}-reset-${memberId}`}
                        disabled={isUpdating}
                        className="min-h-11 min-w-[76px] rounded-token-lg px-3 py-2 text-[11px] font-black tracking-wider border transition-all flex items-center justify-center bg-bg-muted text-fg-tertiary border-border-subtle hover:bg-bg-elevated hover:text-fg-primary hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isUpdating ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'รีเซ็ต'}
                    </button>
                )}
            </div>
        );
    };

    const statusFilters: Array<{ value: StatusFilter; label: string }> = [
        { value: 'ALL', label: 'ทั้งหมด' },
        { value: 'UNCHECKED', label: 'ยังไม่เช็ค' },
        { value: 'PRESENT', label: 'มา' },
        { value: 'ABSENT', label: 'ขาด' },
        { value: 'LEAVE', label: 'ลา' },
    ];

    const renderMobileItem = (item: AttendanceListItem) => {
        let record: AttendanceRecord | null = null;
        let member: Member;
        let preview: LeavePreview | null = null;

        if (item.type === 'record') {
            record = item.data;
            member = item.data.member;
        } else if (item.type === 'leavePreview') {
            member = item.data.member;
            preview = item.data.preview;
        } else {
            member = item.data;
        }

        const currentStatus = record?.status || (preview ? 'LEAVE' : undefined);
        const normalizedStatus = record ? normalizeAttendanceStatus(record.status) || record.status : preview ? 'LEAVE' : 'UNCHECKED';
        const statusLabel = record
            ? getAttendanceStatusLabel(record.status)
            : preview
                ? preview.statusLabel
                : 'ยังไม่เช็ค';

        return (
            <div key={`${item.type}-${member.id}`} data-testid={`attendance-member-mobile-${member.id}`} className="rounded-token-xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm">
                <div className="flex items-start gap-3">
                    {member.discordAvatar ? (
                        <Image
                            src={member.discordAvatar}
                            alt={member.name}
                            width={40}
                            height={40}
                            className="h-10 w-10 shrink-0 rounded-token-full border border-border-subtle object-cover"
                        />
                    ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-token-full border border-border-subtle bg-bg-muted">
                            <User className="h-4 w-4 text-fg-tertiary" />
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-black text-fg-primary">{member.name}</p>
                            <span data-testid={`attendance-member-mobile-status-${member.id}`} className={`inline-flex rounded-token-md border px-2 py-1 text-[10px] font-black tracking-widest ${statusColors[normalizedStatus] || 'bg-bg-muted text-fg-tertiary border-border-subtle'}`}>
                                {statusLabel}
                            </span>
                        </div>
                        {member.discordUsername && <p className="mt-0.5 text-xs text-fg-tertiary">@{member.discordUsername}</p>}
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-fg-secondary">
                            <span>เวลา: {record?.checkedInAt ? new Date(record.checkedInAt).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false }) : '-'}</span>
                            <span className="text-right">ปรับ: {record?.penaltyAmount ? `${record.penaltyAmount.toLocaleString()} ฿` : '-'}</span>
                        </div>
                        {preview && <p className="mt-2 text-xs font-semibold text-fg-warning">{preview.note}</p>}
                    </div>
                </div>
                <div className="mt-4">
                    {renderQuickActions(member.id, member.name, currentStatus, Boolean(record), 'attendance-mobile-action')}
                </div>
            </div>
        );
    };

    return (
        <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden shadow-token-sm" data-testid="attendance-member-table">
            <div className="space-y-4 border-b border-border-subtle bg-bg-muted p-4 sm:p-5">
                <h3 className="font-semibold text-fg-primary tracking-wide">รายชื่อผู้เข้าร่วม</h3>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <p className="text-xs leading-relaxed text-fg-tertiary">
                        {isManualMode ? 'Manual roll call: ค้นหาชื่อแล้วกดบันทึกให้สมาชิกทีละคนได้เร็วบนเว็บ' : 'Discord self check-in: สมาชิกกดเองได้ และเจ้าหน้าที่ยังแก้รายคนได้เมื่อจำเป็น'}
                    </p>
                    <div className="rounded-token-xl border border-border-subtle bg-bg-subtle px-3 py-2 text-xs font-bold text-fg-secondary">
                        แสดง {filteredItems.length} / {allItems.length}
                    </div>
                </div>

                {canManageAttendance && (
                    <div className="grid gap-3 xl:grid-cols-[minmax(220px,360px)_1fr]">
                        <label className="relative block">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-tertiary" />
                            <input
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="ค้นหาชื่อหรือ Discord username"
                                data-testid="attendance-member-search"
                                className="min-h-11 w-full rounded-token-xl border border-border-subtle bg-bg-subtle py-2.5 pl-9 pr-3 text-sm text-fg-primary outline-none transition-colors placeholder:text-fg-tertiary focus:border-border-strong"
                            />
                        </label>
                        <div className="flex gap-2 overflow-x-auto rounded-token-xl border border-border-subtle bg-bg-subtle p-1">
                            {statusFilters.map((item) => (
                                <button
                                    key={item.value}
                                    type="button"
                                    onClick={() => setStatusFilter(item.value)}
                                    data-testid={`attendance-filter-${item.value.toLowerCase()}`}
                                    className={`min-h-10 min-w-fit rounded-token-lg px-3 text-xs font-black transition-colors ${statusFilter === item.value
                                        ? 'bg-bg-elevated text-fg-primary shadow-token-sm ring-1 ring-border-subtle'
                                        : 'text-fg-tertiary hover:bg-bg-muted hover:text-fg-secondary'
                                        }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            <div className="grid gap-3 p-3 md:hidden">
                {paginatedItems.length > 0 ? paginatedItems.map(renderMobileItem) : (
                    <div className="rounded-token-xl border border-dashed border-border-subtle bg-bg-muted p-5 text-center text-sm text-fg-tertiary">
                        ไม่พบสมาชิกตามเงื่อนไขที่เลือก
                    </div>
                )}
            </div>
            <div className="hidden overflow-x-auto custom-scrollbar md:block">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-border-subtle text-left text-fg-tertiary text-[11px] font-bold uppercase tracking-wider bg-bg-muted">
                            <th className="px-5 py-4">สมาชิก</th>
                            <th className="px-5 py-4">สถานะ</th>
                            <th className="px-5 py-4">เวลาเช็คชื่อ</th>
                            <th className="px-5 py-4 text-right">ค่าปรับ</th>
                            <th className="px-5 py-4 text-right">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                        {paginatedItems.map((item, index) => {
                            if (item.type === 'record') {
                                const record = item.data as AttendanceRecord;
                                const normalizedStatus = normalizeAttendanceStatus(record.status) || record.status;
                                return (
                                    <tr key={record.id} data-testid={`attendance-member-row-${record.member.id}`} className="hover:bg-bg-muted transition-colors group">
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    {record.member.discordAvatar ? (
                                                        <Image
                                                            src={record.member.discordAvatar}
                                                            alt={record.member.name}
                                                            width={32}
                                                            height={32}
                                                            className="w-8 h-8 rounded-token-full ring-2 ring-border-subtle group-hover:ring-border transition-all object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-token-full bg-bg-muted flex items-center justify-center ring-2 ring-border-subtle group-hover:ring-border transition-all">
                                                            <User className="w-4 h-4 text-fg-tertiary" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-fg-primary font-medium text-sm transition-colors tracking-wide">{record.member.name}</span>
                                                    {record.member.discordUsername && (
                                                        <span className="text-[10px] text-fg-tertiary font-medium tracking-wide">@{record.member.discordUsername}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span data-testid={`attendance-member-status-${record.member.id}`} className={`text-[10px] px-2.5 py-1 rounded-token-md font-bold tracking-widest uppercase border inline-flex items-center justify-center ${statusColors[normalizedStatus] || statusColors.PRESENT}`}>
                                                {getAttendanceStatusLabel(record.status)}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-fg-secondary text-[13px] font-medium tracking-wide tabular-nums">
                                            {record.checkedInAt
                                                ? new Date(record.checkedInAt).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false })
                                                : '-'}
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            {record.penaltyAmount > 0 ? (
                                                <span data-testid={`attendance-member-penalty-${record.member.id}`} className="text-fg-danger font-bold tabular-nums tracking-tight bg-status-danger-subtle px-2.5 py-1 rounded-token-md border border-status-danger text-xs">
                                                    {record.penaltyAmount.toLocaleString()} ฿
                                                </span>
                                            ) : (
                                                <span data-testid={`attendance-member-penalty-${record.member.id}`} className="text-fg-tertiary font-medium">-</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            {renderQuickActions(record.member.id, record.member.name, record.status, true)}
                                        </td>
                                    </tr>
                                );
                            } else if (item.type === 'leavePreview') {
                                const leavePreviewItem = item.data as { member: Member; preview: LeavePreview };
                                const member = leavePreviewItem.member;
                                const preview = leavePreviewItem.preview;
                                const previewStatusKey = preview.type === 'LATE' ? 'LATE_NOTICE' : 'LEAVE';

                                return (
                                    <tr key={member.id} data-testid={`attendance-member-row-${member.id}`} className={preview.type === 'LATE' ? 'bg-status-warning-subtle/50 group' : 'bg-status-info-subtle/50 group'}>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    {member.discordAvatar ? (
                                                        <Image
                                                            src={member.discordAvatar}
                                                            alt={member.name}
                                                            width={32}
                                                            height={32}
                                                            className={`w-8 h-8 rounded-token-full ring-2 object-cover ${preview.type === 'LATE' ? 'ring-status-warning' : 'ring-status-info'}`}
                                                        />
                                                    ) : (
                                                        <div className={`w-8 h-8 rounded-token-full flex items-center justify-center ring-2 ${preview.type === 'LATE' ? 'bg-status-warning-subtle ring-status-warning' : 'bg-status-info-subtle ring-status-info'}`}>
                                                            <User className={`w-4 h-4 ${preview.type === 'LATE' ? 'text-fg-warning' : 'text-fg-info'}`} />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-fg-primary font-medium text-sm tracking-wide">{member.name}</span>
                                                    <span className={`text-[10px] font-medium tracking-wide ${preview.type === 'LATE' ? 'text-fg-warning' : 'text-fg-info'}`}>{preview.note}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span data-testid={`attendance-member-status-${member.id}`} className={`text-[10px] px-2.5 py-1 rounded-token-md font-bold tracking-widest uppercase border inline-flex items-center justify-center ${statusColors[previewStatusKey]}`}>
                                                {preview.statusLabel}
                                            </span>
                                        </td>
                                        <td className={`px-5 py-3.5 text-[12px] font-medium tracking-wide ${preview.type === 'LATE' ? 'text-fg-warning' : 'text-fg-info'}`}>
                                            {preview.note}
                                        </td>
                                        <td className="px-5 py-3.5 text-right text-fg-tertiary font-medium"><span data-testid={`attendance-member-penalty-${member.id}`}>-</span></td>
                                        <td className="px-5 py-3.5 text-right">
                                            {renderQuickActions(member.id, member.name, 'LEAVE', false)}
                                        </td>
                                    </tr>
                                );
                            } else {
                                const member = item.data as Member;
                                return (
                                    <tr key={member.id} data-testid={`attendance-member-row-${member.id}`} className="bg-bg-muted/60 group">
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-3 opacity-60 group-hover:opacity-100 transition-opacity">
                                                <div className="relative">
                                                    {member.discordAvatar ? (
                                                        <Image
                                                            src={member.discordAvatar}
                                                            alt={member.name}
                                                            width={32}
                                                            height={32}
                                                            className="w-8 h-8 rounded-token-full ring-2 ring-border-subtle grayscale object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-token-full bg-bg-subtle flex items-center justify-center ring-2 ring-border-subtle">
                                                            <User className="w-4 h-4 text-fg-tertiary" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-fg-secondary font-medium text-sm tracking-wide">{member.name}</span>
                                                    {member.discordUsername && (
                                                        <span className="text-[10px] text-fg-tertiary font-medium tracking-wide">@{member.discordUsername}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span data-testid={`attendance-member-status-${member.id}`} className="text-[10px] px-2.5 py-1 rounded-token-md font-bold tracking-widest uppercase border bg-bg-muted text-fg-tertiary border-border-subtle flex items-center gap-1.5 w-fit">
                                                <Clock className="w-3 h-3 text-fg-tertiary" />
                                                ยังไม่เข้า
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-fg-tertiary text-[13px] font-medium">-</td>
                                        <td className="px-5 py-3.5 text-right text-fg-tertiary font-medium"><span data-testid={`attendance-member-penalty-${member.id}`}>-</span></td>
                                        <td className="px-5 py-3.5 text-right">
                                            {renderQuickActions(member.id, member.name)}
                                        </td>
                                    </tr>
                                );
                            }
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-4 border-t border-border-subtle bg-bg-muted">
                    <span className="text-[11px] font-medium text-fg-tertiary tracking-wide">
                        แสดง <span className="text-fg-secondary">{startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, filteredItems.length)}</span> จาก <span className="text-fg-secondary">{filteredItems.length}</span> รายการ
                    </span>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="p-1.5 rounded-token-lg bg-bg-subtle border border-border-subtle text-fg-tertiary hover:text-fg-primary hover:bg-bg-elevated disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-token-sm"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>

                        <div className="flex items-center gap-1 bg-bg-subtle p-1 rounded-token-xl border border-border-subtle shadow-token-sm">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let page;
                                if (totalPages <= 5) {
                                    page = i + 1;
                                } else if (currentPage <= 3) {
                                    page = i + 1;
                                } else if (currentPage >= totalPages - 2) {
                                    page = totalPages - 4 + i;
                                } else {
                                    page = currentPage - 2 + i;
                                }
                                return (
                                    <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        className={`w-7 h-7 rounded-token-lg text-xs font-semibold transition-all ${page === currentPage
                                            ? 'bg-bg-elevated text-fg-primary shadow-token-sm ring-1 ring-border'
                                            : 'text-fg-tertiary hover:text-fg-primary hover:bg-bg-muted'
                                            }`}
                                    >
                                        {page}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="p-1.5 rounded-token-lg bg-bg-subtle border border-border-subtle text-fg-tertiary hover:text-fg-primary hover:bg-bg-elevated disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-token-sm"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={pendingConfirmation !== null}
                onClose={() => setPendingConfirmation(null)}
                onConfirm={() => {
                    if (!pendingConfirmation) {
                        return;
                    }

                    void executeAttendanceUpdate(pendingConfirmation.memberId, pendingConfirmation.attendanceStatus);
                    setPendingConfirmation(null);
                }}
                title="ยืนยันการแก้ผลเช็คชื่อหลังปิดรอบ?"
                description={pendingConfirmation ? (
                    <span>
                        คุณกำลังเปลี่ยนสถานะของ <span className="text-fg-primary font-semibold">{pendingConfirmation.memberName}</span> จาก <span className="text-fg-warning font-semibold">{getAttendanceStatusLabel(pendingConfirmation.currentStatus)}</span> เป็น <span className="text-fg-primary font-semibold">{actionLabels[pendingConfirmation.attendanceStatus]}</span>
                        {'\n\n'}การแก้ไขนี้จะอัปเดตผลสรุปของรอบ, อาจกระทบค่าปรับ และจะถูกบันทึกลงประวัติการแก้ไขเพิ่มเติม
                    </span>
                ) : null}
                confirmText="ยืนยันการแก้ไข"
                cancelText="กลับไปตรวจสอบ"
                type="warning"
                icon={AlertTriangle}
                isProcessing={pendingConfirmation ? pendingMemberIds.includes(pendingConfirmation.memberId) : false}
            />
        </div>
    );
}
