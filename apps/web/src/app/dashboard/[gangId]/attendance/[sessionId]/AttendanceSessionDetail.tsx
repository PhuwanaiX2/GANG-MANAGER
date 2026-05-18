'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getAttendanceStatusLabel, isPresentLikeStatus, normalizeAttendanceStatus } from '@gang/database/attendance';
import {
    AlertTriangle,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock,
    FileText,
    RefreshCw,
    Search,
    Zap,
    Users,
    XCircle,
} from 'lucide-react';
import { ConfirmModal } from '@/components/modals/ConfirmModal';
import { Avatar } from '@/components/ui';
import { ATTENDANCE_MANUAL_SUBMIT_REQUEST_EVENT, ATTENDANCE_MANUAL_UNCHECKED_COUNT_EVENT } from './SessionActions';
import { ATTENDANCE_MANUAL_SESSION_FINALIZED_EVENT } from './ManualRoundExitGuard';

interface AttendanceRecord {
    id: string;
    status: string;
    checkedInAt: Date | string | null;
    penaltyAmount: number;
    notes?: string | null;
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
type AttendanceDraftStatus = Exclude<AttendanceAction, 'RESET'> | null;
type StatusFilter = 'ALL' | 'UNCHECKED' | 'PRESENT' | 'ABSENT' | 'LEAVE';
type AttendanceListItem =
    | { type: 'record'; data: AttendanceRecord }
    | { type: 'leavePreview'; data: { member: Member; preview: LeavePreview } }
    | { type: 'member'; data: Member };
type ManualRosterItem = {
    member: Member;
    record: AttendanceRecord | null;
    preview: LeavePreview | null;
    status: AttendanceDraftStatus;
};

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
    absentPenalty?: number;
}

const ITEMS_PER_PAGE = 10;

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
    { value: 'ALL', label: 'ทั้งหมด' },
    { value: 'UNCHECKED', label: 'ยังไม่เช็ค' },
    { value: 'PRESENT', label: 'มา' },
    { value: 'ABSENT', label: 'ขาด' },
    { value: 'LEAVE', label: 'ลา' },
];

const statusColors: Record<string, string> = {
    PRESENT: 'bg-status-success-subtle text-fg-success border-status-success',
    ABSENT: 'bg-status-danger-subtle text-fg-danger border-status-danger',
    LEAVE: 'bg-status-info-subtle text-fg-info border-status-info',
    LATE_NOTICE: 'bg-status-warning-subtle text-fg-warning border-status-warning',
    UNCHECKED: 'bg-bg-muted text-fg-tertiary border-border-subtle',
};

const manualStatusOptions: Array<{
    value: Exclude<AttendanceDraftStatus, null>;
    label: string;
    icon: typeof CheckCircle2;
    activeClassName: string;
    inactiveClassName: string;
}> = [
    {
        value: 'PRESENT',
        label: 'มา',
        icon: CheckCircle2,
        activeClassName: 'border-status-success/35 bg-status-success-subtle text-fg-success ring-1 ring-status-success/20 shadow-token-sm',
        inactiveClassName: 'border-border-subtle bg-bg-subtle text-fg-secondary hover:border-status-success/35 hover:bg-status-success-subtle hover:text-fg-success',
    },
    {
        value: 'ABSENT',
        label: 'ขาด',
        icon: XCircle,
        activeClassName: 'border-status-danger/35 bg-status-danger-subtle text-fg-danger ring-1 ring-status-danger/20 shadow-token-sm',
        inactiveClassName: 'border-border-subtle bg-bg-subtle text-fg-secondary hover:border-status-danger/35 hover:bg-status-danger-subtle hover:text-fg-danger',
    },
    {
        value: 'LEAVE',
        label: 'ลา',
        icon: FileText,
        activeClassName: 'border-status-info/35 bg-status-info-subtle text-fg-info ring-1 ring-status-info/20 shadow-token-sm',
        inactiveClassName: 'border-border-subtle bg-bg-subtle text-fg-secondary hover:border-status-info/35 hover:bg-status-info-subtle hover:text-fg-info',
    },
];

function sortMembers(items: Member[]) {
    return [...items].sort((a, b) => a.name.localeCompare(b.name, 'th'));
}

function formatCheckTime(value: Date | string | null) {
    if (!value) {
        return '-';
    }

    return new Date(value).toLocaleTimeString('th-TH', {
        timeZone: 'Asia/Bangkok',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
}

function getItemMember(item: AttendanceListItem) {
    if (item.type === 'record') return item.data.member;
    if (item.type === 'leavePreview') return item.data.member;
    return item.data;
}

function getItemStatus(item: AttendanceListItem) {
    if (item.type === 'record') return normalizeAttendanceStatus(item.data.status) || 'UNCHECKED';
    if (item.type === 'leavePreview') return 'LEAVE';
    return 'UNCHECKED';
}

function getItemStatusLabel(item: AttendanceListItem) {
    if (item.type === 'record') return getAttendanceStatusLabel(item.data.status);
    if (item.type === 'leavePreview') return item.data.preview.statusLabel;
    return 'ยังไม่เช็ค';
}

function getStatusIcon(status: string) {
    if (status === 'PRESENT') return CheckCircle2;
    if (status === 'ABSENT') return XCircle;
    if (status === 'LEAVE') return FileText;
    return Clock;
}

export function AttendanceSessionDetail({
    gangId,
    sessionId,
    records,
    notCheckedIn,
    leavePreviewByMemberId,
    isSessionActive,
    isSessionClosed,
    canManageAttendance,
    sessionMode,
    absentPenalty = 0,
}: Props) {
    const router = useRouter();
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
    const [pendingMemberIds, setPendingMemberIds] = useState<string[]>([]);
    const [localRecords, setLocalRecords] = useState(records);
    const [localNotCheckedIn, setLocalNotCheckedIn] = useState(notCheckedIn);
    const [localLeavePreviewByMemberId, setLocalLeavePreviewByMemberId] = useState(leavePreviewByMemberId);
    const [manualDraftStatuses, setManualDraftStatuses] = useState<Record<string, AttendanceDraftStatus>>({});
    const [selectedManualMemberIds, setSelectedManualMemberIds] = useState<string[]>([]);
    const [showManualSubmitConfirm, setShowManualSubmitConfirm] = useState(false);
    const [isManualSubmitting, setIsManualSubmitting] = useState(false);
    const [pendingConfirmation, setPendingConfirmation] = useState<{
        memberId: string;
        memberName: string;
        attendanceStatus: Exclude<AttendanceAction, 'RESET'>;
        currentStatus?: string;
    } | null>(null);

    const isManualMode = sessionMode === 'MANUAL_ROLL_CALL';
    const isSessionEditable = canManageAttendance && (isSessionActive || isSessionClosed);

    useEffect(() => setLocalRecords(records), [records]);
    useEffect(() => setLocalNotCheckedIn(notCheckedIn), [notCheckedIn]);
    useEffect(() => setLocalLeavePreviewByMemberId(leavePreviewByMemberId), [leavePreviewByMemberId]);

    const allItems = useMemo<AttendanceListItem[]>(() => {
        const uncheckedItems = isSessionActive
            ? localNotCheckedIn.map((member) => {
                const leavePreview = localLeavePreviewByMemberId[member.id];
                if (leavePreview) {
                    return { type: 'leavePreview' as const, data: { member, preview: leavePreview } };
                }

                return { type: 'member' as const, data: member };
            })
            : [];

        return [
            ...localRecords.map((record) => ({ type: 'record' as const, data: record })),
            ...uncheckedItems,
        ];
    }, [isSessionActive, localLeavePreviewByMemberId, localNotCheckedIn, localRecords]);

    const manualRosterItems = useMemo<ManualRosterItem[]>(() => {
        if (!isManualMode || !isSessionActive) {
            return [];
        }

        return allItems
            .map((item) => {
                const member = getItemMember(item);
                const record = item.type === 'record' ? item.data : null;
                const preview = item.type === 'leavePreview'
                    ? item.data.preview
                    : localLeavePreviewByMemberId[member.id] || null;
                const fallbackStatus = record
                    ? normalizeAttendanceStatus(record.status) as AttendanceDraftStatus
                    : preview
                        ? 'LEAVE'
                        : null;
                const hasDraft = Object.prototype.hasOwnProperty.call(manualDraftStatuses, member.id);

                return {
                    member,
                    record,
                    preview,
                    status: hasDraft ? manualDraftStatuses[member.id] : fallbackStatus,
                };
            })
            .sort((a, b) => a.member.name.localeCompare(b.member.name, 'th'));
    }, [allItems, isManualMode, isSessionActive, localLeavePreviewByMemberId, manualDraftStatuses]);

    useEffect(() => {
        if (!isManualMode || !isSessionActive) {
            return;
        }

        setManualDraftStatuses((current) => {
            const nextDraft: Record<string, AttendanceDraftStatus> = {};

            for (const item of allItems) {
                const member = getItemMember(item);
                if (Object.prototype.hasOwnProperty.call(current, member.id)) {
                    nextDraft[member.id] = current[member.id];
                } else if (item.type === 'record') {
                    nextDraft[member.id] = normalizeAttendanceStatus(item.data.status) as AttendanceDraftStatus;
                } else if (item.type === 'leavePreview') {
                    nextDraft[member.id] = 'LEAVE';
                } else {
                    nextDraft[member.id] = null;
                }
            }

            const currentKeys = Object.keys(current);
            const nextKeys = Object.keys(nextDraft);
            const hasChanged = currentKeys.length !== nextKeys.length || nextKeys.some((memberId) => current[memberId] !== nextDraft[memberId]);

            return hasChanged ? nextDraft : current;
        });
    }, [allItems, isManualMode, isSessionActive]);

    const stats = useMemo(() => {
        if (isManualMode && isSessionActive) {
            return manualRosterItems.reduce(
                (acc, item) => {
                    acc.total += 1;
                    if (item.status === 'PRESENT') acc.present += 1;
                    if (item.status === 'ABSENT') acc.absent += 1;
                    if (item.status === 'LEAVE') acc.leave += 1;
                    if (!item.status) acc.unchecked += 1;
                    return acc;
                },
                { total: 0, present: 0, absent: 0, leave: 0, unchecked: 0 }
            );
        }

        const base = localRecords.reduce(
            (acc, record) => {
                const status = normalizeAttendanceStatus(record.status);
                if (status === 'PRESENT') acc.present += 1;
                if (status === 'ABSENT') acc.absent += 1;
                if (status === 'LEAVE') acc.leave += 1;
                return acc;
            },
            { present: 0, absent: 0, leave: 0 }
        );
        const previewLeave = isSessionActive
            ? localNotCheckedIn.filter((member) => localLeavePreviewByMemberId[member.id]).length
            : 0;
        const unchecked = isSessionActive
            ? localNotCheckedIn.filter((member) => !localLeavePreviewByMemberId[member.id]).length
            : 0;

        return {
            total: localRecords.length + localNotCheckedIn.length,
            present: base.present,
            absent: base.absent,
            leave: base.leave + previewLeave,
            unchecked,
        };
    }, [isManualMode, isSessionActive, localLeavePreviewByMemberId, localNotCheckedIn, localRecords, manualRosterItems]);

    const resolvedCount = stats.present + stats.absent + stats.leave;
    const resolvedPercent = stats.total > 0 ? Math.round((resolvedCount / stats.total) * 100) : 0;
    const checkedInPercent = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;
    const presentPercent = stats.total > 0 ? (stats.present / stats.total) * 100 : 0;
    const absentPercent = stats.total > 0 ? (stats.absent / stats.total) * 100 : 0;
    const leavePercent = stats.total > 0 ? (stats.leave / stats.total) * 100 : 0;
    const uncheckedPercent = stats.total > 0 ? (stats.unchecked / stats.total) * 100 : 0;
    const latestCheckInAt = useMemo(() => {
        let latest: Date | string | null = null;
        let latestTime = 0;

        for (const record of localRecords) {
            if (!record.checkedInAt) {
                continue;
            }

            const checkedAt = new Date(record.checkedInAt).getTime();
            if (checkedAt > latestTime) {
                latest = record.checkedInAt;
                latestTime = checkedAt;
            }
        }

        return latest;
    }, [localRecords]);
    const workflowMeta = isManualMode && isSessionActive
        ? {
            kicker: 'ทำคนเดียว',
            title: 'เช็คแบบทำคนเดียวบนเว็บ',
            description: 'เหมาะกับเจ้าหน้าที่คนเดียวไล่เช็คหน้ารายชื่อ เลือกสถานะให้ครบก่อนยืนยันจบ เพื่อบันทึกเป็นชุดเดียว',
            icon: FileText,
            tone: 'border-status-warning/30 bg-status-warning-subtle text-fg-warning',
        }
        : isSessionClosed
            ? {
                kicker: 'ย้อนหลัง / แก้ย้อนหลัง / log',
                title: 'ตรวจผลย้อนหลังและแก้เฉพาะเคสจำเป็น',
                description: 'ผลรอบนี้ถูกปิดแล้ว การแก้รายคนจะขอ confirmation และบันทึกลงประวัติการแก้ไขเพื่อ audit',
                icon: AlertTriangle,
                tone: 'border-status-info/30 bg-status-info-subtle text-fg-info',
            }
            : {
                kicker: 'เช็คผ่าน Discord',
                title: 'ติดตาม Live check-in จาก Discord',
                description: 'สมาชิกเช็คชื่อด้วยปุ่มใน Discord ตารางนี้ใช้ monitor ภาพรวม และให้เจ้าหน้าที่ override เฉพาะกรณีผิดพลาด',
                icon: CheckCircle2,
                tone: 'border-status-success/30 bg-status-success-subtle text-fg-success',
            };
    const WorkflowIcon = workflowMeta.icon;

    useEffect(() => {
        if (!isManualMode || typeof window === 'undefined') {
            return;
        }

        window.dispatchEvent(new CustomEvent(ATTENDANCE_MANUAL_UNCHECKED_COUNT_EVENT, {
            detail: { uncheckedCount: stats.unchecked },
        }));
    }, [isManualMode, stats.unchecked]);

    const filteredItems = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();

        return allItems.filter((item) => {
            const member = getItemMember(item);
            const status = getItemStatus(item);
            const matchesQuery = !query || [member.name, member.discordUsername || ''].some((value) => value.toLowerCase().includes(query));
            const matchesStatus = statusFilter === 'ALL' || status === statusFilter;

            return matchesQuery && matchesStatus;
        });
    }, [allItems, searchTerm, statusFilter]);

    const filteredManualItems = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();

        return manualRosterItems.filter((item) => {
            const status = item.status || 'UNCHECKED';
            const matchesQuery = !query || [item.member.name, item.member.discordUsername || ''].some((value) => value.toLowerCase().includes(query));
            const matchesStatus = statusFilter === 'ALL' || status === statusFilter;

            return matchesQuery && matchesStatus;
        });
    }, [manualRosterItems, searchTerm, statusFilter]);

    const filteredManualMemberIds = useMemo(() => filteredManualItems.map((item) => item.member.id), [filteredManualItems]);
    const selectedManualCount = selectedManualMemberIds.filter((memberId) => filteredManualMemberIds.includes(memberId)).length;
    const isAllFilteredManualSelected = filteredManualMemberIds.length > 0 && selectedManualCount === filteredManualMemberIds.length;

    useEffect(() => setCurrentPage(1), [searchTerm, statusFilter]);

    useEffect(() => {
        setSelectedManualMemberIds((current) => current.filter((memberId) => filteredManualMemberIds.includes(memberId)));
    }, [filteredManualMemberIds]);

    const getStatusFilterCount = (filter: StatusFilter) => {
        if (filter === 'ALL') return stats.total;
        if (filter === 'UNCHECKED') return stats.unchecked;
        if (filter === 'PRESENT') return stats.present;
        if (filter === 'ABSENT') return stats.absent;
        return stats.leave;
    };

    const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedItems = filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    const manualTotalPages = Math.ceil(filteredManualItems.length / ITEMS_PER_PAGE);
    const manualStartIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedManualItems = filteredManualItems.slice(manualStartIndex, manualStartIndex + ITEMS_PER_PAGE);

    useEffect(() => {
        if (!isManualMode || !isSessionActive || !canManageAttendance || typeof window === 'undefined') {
            return;
        }

        const handleManualSubmitRequest = () => {
            if (stats.unchecked > 0) {
                toast.error('ยังยืนยันจบรอบไม่ได้', {
                    description: `ยังมีสมาชิก ${stats.unchecked} คนที่ยังไม่ถูกเช็ค`,
                });
                return;
            }
            setShowManualSubmitConfirm(true);
        };

        window.addEventListener(ATTENDANCE_MANUAL_SUBMIT_REQUEST_EVENT, handleManualSubmitRequest);
        return () => window.removeEventListener(ATTENDANCE_MANUAL_SUBMIT_REQUEST_EVENT, handleManualSubmitRequest);
    }, [canManageAttendance, isManualMode, isSessionActive, stats.unchecked]);

    const setManualDraftStatus = (memberId: string, status: Exclude<AttendanceDraftStatus, null>) => {
        setManualDraftStatuses((prev) => ({
            ...prev,
            [memberId]: status,
        }));
    };

    const markUncheckedManualMembersPresent = () => {
        const updatedCount = manualRosterItems.filter((item) => !item.status).length;
        setManualDraftStatuses((prev) => {
            const next = { ...prev };
            for (const item of manualRosterItems) {
                if (!item.status) {
                    next[item.member.id] = 'PRESENT';
                }
            }
            return next;
        });

        toast.success(updatedCount > 0 ? `ทำเครื่องหมาย ${updatedCount} คนเป็น มา แล้ว` : 'ไม่มีสมาชิกค้างเช็ค');
    };

    const resetManualDraft = () => {
        const nextDraft: Record<string, AttendanceDraftStatus> = {};
        for (const item of allItems) {
            const member = getItemMember(item);
            nextDraft[member.id] = item.type === 'leavePreview' || localLeavePreviewByMemberId[member.id] ? 'LEAVE' : null;
        }
        setManualDraftStatuses(nextDraft);
        toast.success('ล้างร่างเช็คชื่อแล้ว', {
            description: 'คนที่มีใบลาอนุมัติจะยังแสดงเป็น ลา ไว้ให้ตรวจต่อ',
        });
    };

    const submitManualRollCall = async () => {
        const unchecked = manualRosterItems.filter((item) => !item.status);
        if (unchecked.length > 0) {
            toast.error('ยังปิดรอบไม่ได้', {
                description: `ยังมีสมาชิก ${unchecked.length} คนที่ยังไม่ถูกเช็ค`,
            });
            setShowManualSubmitConfirm(false);
            return;
        }

        setIsManualSubmitting(true);
        try {
            const res = await fetch(`/api/gangs/${gangId}/attendance/${sessionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'CLOSED',
                    manualRecords: manualRosterItems.map((item) => ({
                        memberId: item.member.id,
                        status: item.status,
                    })),
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'ปิดรอบเช็คชื่อไม่สำเร็จ');
            }

            toast.success('บันทึกและปิดรอบเช็คชื่อแล้ว', {
                description: 'ระบบบันทึกผลทุกคนพร้อมกันเป็นสรุปสุดท้าย',
            });
            setShowManualSubmitConfirm(false);
            window.dispatchEvent(new CustomEvent(ATTENDANCE_MANUAL_SESSION_FINALIZED_EVENT));
            router.replace(`/dashboard/${gangId}/attendance?tab=closed`);
            router.refresh();
        } catch (error: any) {
            toast.error('ปิดรอบเช็คชื่อไม่สำเร็จ', {
                description: error.message,
            });
        } finally {
            setIsManualSubmitting(false);
        }
    };

    const executeAttendanceUpdate = async (memberId: string, attendanceStatus: AttendanceAction) => {
        setPendingMemberIds((prev) => prev.includes(memberId) ? prev : [...prev, memberId]);
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
                const restoredMember = localRecords.find((record) => record.member.id === memberId)?.member;
                const nextRecords = localRecords.filter((record) => record.member.id !== memberId);
                let nextNotCheckedIn = localNotCheckedIn;
                let nextLeavePreviewByMemberId = localLeavePreviewByMemberId;

                if (isSessionActive && restoredMember) {
                    const restoredLeavePreview = leavePreviewByMemberId[memberId];
                    nextNotCheckedIn = sortMembers([
                        ...localNotCheckedIn.filter((member) => member.id !== memberId),
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
            } else if (data.record) {
                const nextRecord = data.record as AttendanceRecord;
                const existingIndex = localRecords.findIndex((record) => record.member.id === memberId);
                const nextRecords = existingIndex === -1
                    ? [...localRecords, nextRecord]
                    : localRecords.map((record, index) => index === existingIndex ? nextRecord : record);
                const nextNotCheckedIn = localNotCheckedIn.filter((member) => member.id !== memberId);
                const nextLeavePreviewByMemberId = localLeavePreviewByMemberId[memberId]
                    ? Object.fromEntries(Object.entries(localLeavePreviewByMemberId).filter(([id]) => id !== memberId)) as Record<string, LeavePreview>
                    : localLeavePreviewByMemberId;

                setLocalRecords(nextRecords);
                setLocalNotCheckedIn(nextNotCheckedIn);
                setLocalLeavePreviewByMemberId(nextLeavePreviewByMemberId);
            }

            toast.success(
                attendanceStatus === 'RESET'
                    ? 'รีเซ็ตสถานะแล้ว'
                    : attendanceStatus === 'PRESENT'
                        ? 'บันทึกว่า มา แล้ว'
                        : attendanceStatus === 'ABSENT'
                            ? 'บันทึกว่า ขาด แล้ว'
                            : 'บันทึกว่า ลา แล้ว'
            );

            router.refresh();
        } catch (error: any) {
            toast.error('อัปเดตเช็คชื่อไม่สำเร็จ', {
                description: error.message,
            });
        } finally {
            setPendingMemberIds((prev) => prev.filter((id) => id !== memberId));
        }
    };

    const handleAttendanceUpdate = (memberId: string, memberName: string, attendanceStatus: AttendanceAction, currentStatus?: string) => {
        if (isSessionClosed && attendanceStatus !== 'RESET') {
            setPendingConfirmation({ memberId, memberName, attendanceStatus, currentStatus });
            return;
        }

        void executeAttendanceUpdate(memberId, attendanceStatus);
    };

    const renderQuickActions = (memberId: string, memberName: string, currentStatus?: string, hasPersistedRecord = false, testIdPrefix = 'attendance-action') => {
        if (!isSessionEditable) {
            return <span className="font-medium text-fg-tertiary">-</span>;
        }

        const isUpdating = pendingMemberIds.includes(memberId);
        const normalizedStatus = normalizeAttendanceStatus(currentStatus);
        const isPresentLike = isPresentLikeStatus(currentStatus);
        const isAbsent = normalizedStatus === 'ABSENT';
        const isLeave = normalizedStatus === 'LEAVE';

        const baseClass = 'min-h-11 min-w-[58px] rounded-token-lg border px-3 py-2 text-[11px] font-black tracking-wider transition-colors flex items-center justify-center disabled:cursor-not-allowed';

        return (
            <div className="flex flex-wrap justify-end gap-1.5">
                <button
                    onClick={() => handleAttendanceUpdate(memberId, memberName, 'PRESENT', currentStatus)}
                    data-testid={`${testIdPrefix}-present-${memberId}`}
                    disabled={isUpdating || isPresentLike}
                    aria-pressed={isPresentLike}
                    className={`${baseClass} ${isPresentLike ? 'border-status-success bg-status-success-subtle text-fg-success ring-1 ring-status-success/25' : 'border-border-subtle bg-bg-elevated text-fg-secondary hover:border-status-success hover:bg-status-success-subtle hover:text-fg-success'}`}
                >
                    {isUpdating ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'มา'}
                </button>
                <button
                    onClick={() => handleAttendanceUpdate(memberId, memberName, 'ABSENT', currentStatus)}
                    data-testid={`${testIdPrefix}-absent-${memberId}`}
                    disabled={isUpdating || isAbsent}
                    aria-pressed={isAbsent}
                    className={`${baseClass} ${isAbsent ? 'border-status-danger bg-status-danger-subtle text-fg-danger ring-1 ring-status-danger/25' : 'border-border-subtle bg-bg-elevated text-fg-secondary hover:border-status-danger hover:bg-status-danger-subtle hover:text-fg-danger'}`}
                >
                    {isUpdating ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'ขาด'}
                </button>
                <button
                    onClick={() => handleAttendanceUpdate(memberId, memberName, 'LEAVE', currentStatus)}
                    data-testid={`${testIdPrefix}-leave-${memberId}`}
                    disabled={isUpdating || isLeave}
                    aria-pressed={isLeave}
                    className={`${baseClass} ${isLeave ? 'border-status-info bg-status-info-subtle text-fg-info ring-1 ring-status-info/25' : 'border-border-subtle bg-bg-elevated text-fg-secondary hover:border-status-info hover:bg-status-info-subtle hover:text-fg-info'}`}
                >
                    {isUpdating ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'ลา'}
                </button>
                {currentStatus && hasPersistedRecord && isSessionActive ? (
                    <button
                        onClick={() => handleAttendanceUpdate(memberId, memberName, 'RESET', currentStatus)}
                        data-testid={`${testIdPrefix}-reset-${memberId}`}
                        disabled={isUpdating}
                        className={`${baseClass} min-w-[70px] border-border-subtle bg-bg-muted text-fg-tertiary hover:bg-bg-elevated hover:text-fg-primary disabled:opacity-50`}
                    >
                        {isUpdating ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'รีเซ็ต'}
                    </button>
                ) : null}
            </div>
        );
    };

    const renderManualStatusControl = (item: ManualRosterItem, testIdPrefix = 'attendance-manual-status') => (
        <div className="grid grid-cols-3 gap-2">
            {manualStatusOptions.map((option) => {
                const isSelected = item.status === option.value;
                const Icon = option.icon;

                return (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => setManualDraftStatus(item.member.id, option.value)}
                        data-testid={`${testIdPrefix}-${option.value.toLowerCase()}-${item.member.id}`}
                        aria-pressed={isSelected}
                        disabled={isManualSubmitting}
                        className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-token-lg border px-3 text-xs font-black tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${isSelected ? option.activeClassName : option.inactiveClassName}`}
                    >
                        <Icon className="h-3.5 w-3.5" />
                        {option.label}
                    </button>
                );
            })}
        </div>
    );

    const getManualStatusLabel = (status: AttendanceDraftStatus) => status ? getAttendanceStatusLabel(status) : 'ยังไม่เช็ค';

    const getManualDetailText = (item: ManualRosterItem) => {
        if (item.preview) {
            return item.preview.note;
        }

        if (item.status) {
            return `ร่าง: ${getAttendanceStatusLabel(item.status)} - จะบันทึกตอนกดยืนยันจบ`;
        }

        return 'ยังไม่ได้เลือกสถานะ';
    };

    const toggleManualMemberSelection = (memberId: string) => {
        setSelectedManualMemberIds((current) => current.includes(memberId)
            ? current.filter((id) => id !== memberId)
            : [...current, memberId]);
    };

    const toggleAllFilteredManualMembers = () => {
        setSelectedManualMemberIds(isAllFilteredManualSelected ? [] : filteredManualMemberIds);
    };

    const renderAvatar = (member: Member, muted = false) => (
        <Avatar
            src={member.discordAvatar}
            name={member.name}
            alt={member.name}
            className={`h-8 w-8 ring-1 ring-border-subtle ${muted ? 'opacity-70' : ''}`}
        />
    );

    const renderStatusBadge = (status: string, label: string, testId?: string) => {
        const Icon = getStatusIcon(status);

        return (
            <span data-testid={testId} className={`inline-flex items-center justify-center gap-1.5 rounded-token-full border px-2.5 py-1 text-[10px] font-black tracking-wide ${statusColors[status] || statusColors.UNCHECKED}`}>
                <Icon className="h-3.5 w-3.5" />
                {label}
            </span>
        );
    };

    const getLiveNoteText = (preview: LeavePreview | null, record: AttendanceRecord | null, status: string) => {
        if (preview) return preview.note;
        if (record?.notes) return record.notes;
        if (record?.checkedInAt) return 'บันทึกการเช็คชื่อแล้ว';
        if (status === 'ABSENT') return 'ถูก Override โดยเจ้าหน้าที่';
        if (status === 'UNCHECKED') return 'รอสมาชิกกดเช็คชื่อ';
        return 'บันทึกแล้ว';
    };

    const renderMobileItem = (item: AttendanceListItem) => {
        const member = getItemMember(item);
        const status = getItemStatus(item);
        const statusLabel = getItemStatusLabel(item);
        const record = item.type === 'record' ? item.data : null;
        const preview = item.type === 'leavePreview' ? item.data.preview : null;
        const currentStatus = record?.status || (preview ? 'LEAVE' : undefined);

        return (
            <div key={`${item.type}-${member.id}`} data-testid={`attendance-member-mobile-${member.id}`} className="rounded-token-xl border border-border-subtle bg-bg-subtle p-3 shadow-token-sm">
                <div className="flex items-start gap-3">
                    {renderAvatar(member, status === 'UNCHECKED')}
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-black text-fg-primary">{member.name}</p>
                            {renderStatusBadge(status, statusLabel, `attendance-member-mobile-status-${member.id}`)}
                        </div>
                        {member.discordUsername ? <p className="mt-0.5 text-xs text-fg-tertiary">@{member.discordUsername}</p> : null}
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-token-lg border border-border-subtle bg-bg-muted px-3 py-2">
                                <p className="text-[10px] font-bold text-fg-tertiary">เวลา</p>
                                <p className="mt-1 font-bold text-fg-secondary tabular-nums">{record?.checkedInAt ? `${formatCheckTime(record.checkedInAt)} น.` : '-'}</p>
                            </div>
                            <div className="rounded-token-lg border border-border-subtle bg-bg-muted px-3 py-2">
                                <p className="text-[10px] font-bold text-fg-tertiary">หมายเหตุ</p>
                                <p className="mt-1 truncate font-bold text-fg-secondary">{getLiveNoteText(preview, record, status)}</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="mt-3">
                    {renderQuickActions(member.id, member.name, currentStatus, Boolean(record), 'attendance-mobile-action')}
                </div>
            </div>
        );
    };

    const renderManualMobileItem = (item: ManualRosterItem) => {
        const status = item.status || 'UNCHECKED';
        const isSelected = selectedManualMemberIds.includes(item.member.id);

        return (
            <div key={`manual-${item.member.id}`} data-testid={`attendance-member-mobile-${item.member.id}`} className={`rounded-token-xl border border-border-subtle bg-bg-subtle p-3 shadow-token-sm ${isSelected ? 'ring-1 ring-status-info/25' : ''}`}>
                <div className="flex items-start gap-3">
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleManualMemberSelection(item.member.id)}
                        aria-label={`เลือก ${item.member.name}`}
                        className="mt-2 h-4 w-4 rounded-token-sm border-border-subtle bg-bg-subtle text-status-info focus:ring-status-info"
                    />
                    {renderAvatar(item.member, status === 'UNCHECKED')}
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-black text-fg-primary">{item.member.name}</p>
                            <span data-testid={`attendance-member-mobile-status-${item.member.id}`} className={`inline-flex rounded-token-md border px-2 py-1 text-[11px] font-bold ${statusColors[status] || statusColors.UNCHECKED}`}>
                                {getManualStatusLabel(item.status)}
                            </span>
                            {item.preview ? (
                                <span className="rounded-token-full border border-status-info/40 bg-status-info-subtle px-2 py-0.5 text-[10px] font-black text-fg-info">
                                    มีใบลา
                                </span>
                            ) : null}
                        </div>
                        {item.member.discordUsername ? <p className="mt-0.5 text-xs text-fg-tertiary">@{item.member.discordUsername}</p> : null}
                        <p className="mt-2 text-xs text-fg-secondary">{getManualDetailText(item)}</p>
                    </div>
                </div>
                <div className="mt-3">
                    {renderManualStatusControl(item, 'attendance-manual-mobile-status')}
                </div>
            </div>
        );
    };

    if (isManualMode && isSessionActive) {
        return (
            <div className="overflow-hidden rounded-token-xl border border-border-subtle bg-bg-subtle shadow-token-sm" data-testid="attendance-member-table">
                <div className="border-b border-border-subtle bg-bg-muted/80 p-3.5 sm:p-4">
                    <div className="grid gap-3 xl:grid-cols-[minmax(260px,380px)_minmax(0,1fr)_auto] xl:items-center">
                        <label className="relative block">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-tertiary" />
                            <input
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="ค้นหาชื่อหรือ Discord username"
                                data-testid="attendance-member-search"
                                className="min-h-10 w-full rounded-token-lg border border-border-subtle bg-bg-subtle py-2 pl-9 pr-3 text-sm text-fg-primary outline-none transition-colors placeholder:text-fg-tertiary focus:border-border-strong"
                            />
                        </label>
                        <div className="flex min-w-0 gap-1.5 overflow-x-auto rounded-token-xl border border-border-subtle bg-bg-subtle p-1">
                            {statusFilters.map((item) => {
                                const count = item.value === 'ALL'
                                    ? stats.total
                                    : item.value === 'UNCHECKED'
                                        ? stats.unchecked
                                        : item.value === 'PRESENT'
                                            ? stats.present
                                            : item.value === 'ABSENT'
                                                ? stats.absent
                                                : stats.leave;

                                return (
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
                                        <span className="ml-2 rounded-token-full bg-bg-muted px-2 py-0.5 text-[10px] text-fg-tertiary tabular-nums">{count}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex min-w-fit gap-2">
                            <button
                                type="button"
                                onClick={markUncheckedManualMembersPresent}
                                data-testid="attendance-manual-mark-unchecked-present"
                                disabled={isManualSubmitting || stats.unchecked === 0}
                                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-token-lg border border-status-success/30 bg-status-success-subtle px-3 text-xs font-black text-fg-success transition-colors hover:bg-status-success hover:text-fg-inverse disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Zap className="h-3.5 w-3.5" />
                                Auto Check-in
                            </button>
                            <button
                                type="button"
                                onClick={resetManualDraft}
                                data-testid="attendance-manual-reset-draft"
                                disabled={isManualSubmitting}
                                className="hidden min-h-10 rounded-token-lg border border-border-subtle bg-bg-subtle px-3 text-xs font-black text-fg-secondary transition-colors hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-50 sm:inline-flex sm:items-center"
                            >
                                ล้างร่าง
                            </button>
                        </div>
                    </div>
                    <div className="mt-3 flex flex-col gap-2 text-xs font-semibold text-fg-tertiary sm:flex-row sm:items-center sm:justify-between">
                        <span>เลือกแล้ว {selectedManualCount} คน • {stats.unchecked > 0 ? `ยังเหลือ ${stats.unchecked} คนก่อนยืนยันจบรอบ` : 'เช็คครบแล้ว พร้อมยืนยันจบรอบ'}</span>
                        <span className="rounded-token-full border border-border-subtle bg-bg-subtle px-3 py-1 text-[11px] text-fg-secondary">
                            ยังไม่เลือก = ขาดตอนยืนยันจบ
                        </span>
                    </div>
                </div>

                <div className="grid gap-3 p-3 sm:p-4 md:hidden">
                    {paginatedManualItems.length > 0 ? paginatedManualItems.map(renderManualMobileItem) : (
                        <div className="rounded-token-xl border border-dashed border-border-subtle bg-bg-muted p-5 text-center text-sm text-fg-tertiary">
                            ไม่พบสมาชิกตามเงื่อนไขที่เลือก
                        </div>
                    )}
                </div>

                <div className="hidden overflow-x-auto custom-scrollbar md:block">
                    <table className="min-w-[760px] w-full">
                        <thead>
                            <tr className="border-b border-border-subtle bg-bg-muted text-left text-[10px] font-bold text-fg-tertiary">
                                <th className="w-12 px-5 py-3.5">
                                    <input
                                        type="checkbox"
                                        checked={isAllFilteredManualSelected}
                                        onChange={toggleAllFilteredManualMembers}
                                        aria-label="เลือกสมาชิกทั้งหมดที่แสดง"
                                        className="h-4 w-4 rounded-token-sm border-border-subtle bg-bg-subtle text-status-info focus:ring-status-info"
                                    />
                                </th>
                                <th className="px-4 py-3.5">สมาชิก</th>
                                <th className="px-4 py-3.5">สถานะ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle">
                            {paginatedManualItems.map((item) => {
                                const status = item.status || 'UNCHECKED';
                                const isSelected = selectedManualMemberIds.includes(item.member.id);

                                return (
                                    <tr key={`manual-${item.member.id}`} data-testid={`attendance-member-row-${item.member.id}`} className={`group transition-colors hover:bg-bg-muted/70 ${isSelected ? 'bg-status-info-subtle/25' : ''}`}>
                                        <td className="px-5 py-3">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleManualMemberSelection(item.member.id)}
                                                aria-label={`เลือก ${item.member.name}`}
                                                className="h-4 w-4 rounded-token-sm border-border-subtle bg-bg-subtle text-status-info focus:ring-status-info"
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                {renderAvatar(item.member, status === 'UNCHECKED')}
                                                <div className="flex min-w-0 flex-col">
                                                    <span className="truncate text-sm font-black tracking-wide text-fg-primary">{item.member.name}</span>
                                                    {item.member.discordUsername ? (
                                                        <span className="truncate text-[10px] font-medium tracking-wide text-fg-tertiary">@{item.member.discordUsername}</span>
                                                    ) : null}
                                                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                                        <span data-testid={`attendance-member-status-${item.member.id}`} className={`w-fit rounded-token-full border px-2 py-0.5 text-[10px] font-black tracking-wide ${statusColors[status] || statusColors.UNCHECKED}`}>
                                                            {getManualStatusLabel(item.status)}
                                                        </span>
                                                        {item.preview ? (
                                                            <span className="w-fit rounded-token-full border border-status-info/40 bg-status-info-subtle px-2 py-0.5 text-[10px] font-black text-fg-info">
                                                                ใบลาอนุมัติแล้ว
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="max-w-[300px]">
                                                {renderManualStatusControl(item)}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {manualTotalPages > 1 ? (
                    <div className="flex items-center justify-between border-t border-border-subtle bg-bg-muted px-5 py-4">
                        <span className="text-[11px] font-medium tracking-wide text-fg-tertiary">
                            แสดง <span className="text-fg-secondary">{manualStartIndex + 1}-{Math.min(manualStartIndex + ITEMS_PER_PAGE, filteredManualItems.length)}</span> จาก <span className="text-fg-secondary">{filteredManualItems.length}</span> รายการ
                        </span>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="rounded-token-lg border border-border-subtle bg-bg-subtle p-1.5 text-fg-tertiary shadow-token-sm transition-colors hover:bg-bg-elevated hover:text-fg-primary disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <span className="rounded-token-lg border border-border-subtle bg-bg-subtle px-3 py-1.5 text-xs font-bold text-fg-secondary">
                                {currentPage} / {manualTotalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage((prev) => Math.min(manualTotalPages, prev + 1))}
                                disabled={currentPage === manualTotalPages}
                                className="rounded-token-lg border border-border-subtle bg-bg-subtle p-1.5 text-fg-tertiary shadow-token-sm transition-colors hover:bg-bg-elevated hover:text-fg-primary disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                ) : null}

                <ConfirmModal
                    isOpen={showManualSubmitConfirm}
                    onClose={() => setShowManualSubmitConfirm(false)}
                    onConfirm={submitManualRollCall}
                    title="ยืนยันบันทึกและปิดรอบ?"
                    description={
                        <span className="text-fg-secondary">
                            ระบบจะบันทึกผล <span className="font-bold text-fg-primary">{stats.total}</span> คนพร้อมกัน:
                            <span className="font-bold text-fg-success"> มา {stats.present}</span>,
                            <span className="font-bold text-fg-danger"> ขาด {stats.absent}</span>,
                            <span className="font-bold text-fg-info"> ลา {stats.leave}</span>
                            {absentPenalty > 0 && stats.absent > 0 ? <span> และคิดค่าปรับเฉพาะคนที่ถูกติ๊ก “ขาด”</span> : null}
                        </span>
                    }
                    confirmText="ยืนยันบันทึกและปิดรอบ"
                    cancelText="กลับไปตรวจ"
                    type="danger"
                    icon={AlertTriangle}
                    isProcessing={isManualSubmitting}
                />
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-token-xl border border-border-subtle bg-bg-subtle shadow-token-sm" data-testid="attendance-member-table">
            <div className="space-y-3.5 border-b border-border-subtle bg-bg-muted p-3.5 sm:p-5">
                {!isManualMode && isSessionActive ? (
                    <>
                        <div className="grid gap-3 xl:grid-cols-[260px_minmax(0,1fr)]">
                            <div className="rounded-token-xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-token-full border-[10px] border-status-success bg-status-success-subtle shadow-token-sm">
                                        <span className="text-2xl font-black text-fg-primary tabular-nums">{checkedInPercent}%</span>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-bold text-fg-tertiary">ลงทะเบียนแล้ว</p>
                                        <p className="mt-1 text-2xl font-black text-fg-primary tabular-nums">{stats.present} / {stats.total}</p>
                                        <p className="mt-1 text-xs font-semibold text-fg-tertiary">
                                            อัปเดตล่าสุด {latestCheckInAt ? `${formatCheckTime(latestCheckInAt)} น.` : '-'} · Live
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                <StatPill icon={CheckCircle2} label="ลงแล้ว" value={stats.present} tone="success" testId="attendance-stat-present-value" />
                                <StatPill icon={Clock} label="ยังไม่ลง" value={stats.unchecked} tone="warning" testId="attendance-stat-unchecked-value" />
                                <StatPill icon={FileText} label="ลา" value={stats.leave} tone="info" testId="attendance-stat-leave-value" />
                                <StatPill icon={XCircle} label="ขาด" value={stats.absent} tone="danger" testId="attendance-stat-absent-value" />
                            </div>
                        </div>

                        <div className="flex h-2 overflow-hidden rounded-token-full bg-bg-subtle">
                            <div className="bg-status-success transition-[width] duration-500" style={{ width: `${presentPercent}%` }} />
                            <div className="bg-status-warning transition-[width] duration-500" style={{ width: `${uncheckedPercent}%` }} />
                            <div className="bg-status-info transition-[width] duration-500" style={{ width: `${leavePercent}%` }} />
                            <div className="bg-status-danger transition-[width] duration-500" style={{ width: `${absentPercent}%` }} />
                        </div>
                    </>
                ) : (
                    <>
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)]">
                            <div className="rounded-token-xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm">
                                <div className="flex items-start gap-3">
                                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-token-xl border ${workflowMeta.tone}`}>
                                        <WorkflowIcon className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="text-[10px] font-bold text-fg-tertiary">{workflowMeta.kicker}</span>
                                        <h3 className="mt-1 text-base font-black tracking-tight text-fg-primary">{workflowMeta.title}</h3>
                                        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-fg-secondary">{workflowMeta.description}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-token-xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-[10px] font-bold text-fg-tertiary">ความคืบหน้า</p>
                                        <p className="mt-1 text-2xl font-black text-fg-primary tabular-nums">{resolvedPercent}%</p>
                                    </div>
                                    <div className="rounded-token-xl border border-border-subtle bg-bg-muted px-3 py-2 text-xs font-bold text-fg-secondary">
                                        ค่าปรับขาด: {absentPenalty > 0 ? `${absentPenalty.toLocaleString()} ฿` : 'ไม่มี'}
                                    </div>
                                </div>
                                <div className="mt-3 flex h-2 overflow-hidden rounded-token-full bg-bg-muted">
                                    <div className="bg-status-success transition-[width] duration-500" style={{ width: `${presentPercent}%` }} />
                                    <div className="bg-status-danger transition-[width] duration-500" style={{ width: `${absentPercent}%` }} />
                                    <div className="bg-status-info transition-[width] duration-500" style={{ width: `${leavePercent}%` }} />
                                    <div className="bg-border-strong transition-[width] duration-500" style={{ width: `${uncheckedPercent}%` }} />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                            <StatPill icon={Users} label="ทั้งหมด" value={stats.total} testId="attendance-stat-total-value" />
                            <StatPill icon={CheckCircle2} label="มา" value={stats.present} tone="success" testId="attendance-stat-present-value" />
                            <StatPill icon={XCircle} label="ขาด" value={stats.absent} tone="danger" testId="attendance-stat-absent-value" />
                            <StatPill icon={FileText} label="ลา" value={stats.leave} tone="info" testId="attendance-stat-leave-value" />
                            <StatPill icon={Clock} label="ยังไม่เช็ค" value={stats.unchecked} tone="muted" testId="attendance-stat-unchecked-value" />
                        </div>
                    </>
                )}

                {isSessionClosed ? (
                    <div className="grid gap-3 rounded-token-xl border border-status-warning/20 bg-status-warning-subtle/45 p-3 text-xs leading-relaxed text-fg-secondary sm:grid-cols-[1fr_auto] sm:items-center">
                        <p>
                            <span className="font-black text-fg-warning">โหมดแก้ย้อนหลัง:</span> กด มา/ขาด/ลา แล้วต้องยืนยันอีกครั้ง ระบบจะบันทึกลง Log และอาจกระทบค่าปรับถ้าเปิดระบบการเงิน
                        </p>
                        <span className="inline-flex min-h-8 items-center justify-center rounded-token-lg border border-status-warning/25 bg-bg-subtle px-3 text-[11px] font-black text-fg-warning">
                            ต้องยืนยันทุกครั้ง
                        </span>
                    </div>
                ) : null}

                {canManageAttendance ? (
                    <div className="grid gap-2.5 xl:grid-cols-[minmax(220px,360px)_1fr]">
                        <label className="relative block">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-tertiary" />
                            <input
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="ค้นหาชื่อหรือ Discord username"
                                data-testid="attendance-member-search"
                                className="min-h-10 w-full rounded-token-lg border border-border-subtle bg-bg-subtle py-2 pl-9 pr-3 text-sm text-fg-primary outline-none transition-colors placeholder:text-fg-tertiary focus:border-border-strong"
                            />
                        </label>
                        <div className="flex gap-1.5 overflow-x-auto rounded-token-xl border border-border-subtle bg-bg-subtle p-1">
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
                                    {item.value === 'UNCHECKED' && !isManualMode && isSessionActive ? 'ยังไม่ลง' : item.label}
                                    <span className="ml-2 rounded-token-full bg-bg-muted px-2 py-0.5 text-[10px] text-fg-tertiary tabular-nums">{getStatusFilterCount(item.value)}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : null}
            </div>

            <div className="grid gap-3 p-3 sm:p-4 md:hidden">
                {paginatedItems.length > 0 ? paginatedItems.map(renderMobileItem) : (
                    <div className="rounded-token-xl border border-dashed border-border-subtle bg-bg-muted p-5 text-center text-sm text-fg-tertiary">
                        ไม่พบสมาชิกตามเงื่อนไขที่เลือก
                    </div>
                )}
            </div>

            <div className="hidden overflow-x-auto custom-scrollbar md:block">
                <table className="min-w-[1080px] w-full">
                    <thead>
                        <tr className="border-b border-border-subtle bg-bg-muted text-left text-[10px] font-bold text-fg-tertiary">
                            <th className="px-5 py-3.5">สมาชิก</th>
                            <th className="px-5 py-3.5">สถานะ</th>
                            <th className="px-5 py-3.5">เวลาลงทะเบียน</th>
                            <th className="px-5 py-3.5">หมายเหตุ</th>
                            {isSessionClosed ? <th className="px-5 py-3.5">บันทึก/ที่มา</th> : null}
                            <th className="px-5 py-3.5 text-right">{isSessionClosed ? 'แก้ย้อนหลัง' : 'จัดการ'}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                        {paginatedItems.map((item) => {
                            const member = getItemMember(item);
                            const status = getItemStatus(item);
                            const statusLabel = getItemStatusLabel(item);
                            const record = item.type === 'record' ? item.data : null;
                            const preview = item.type === 'leavePreview' ? item.data.preview : null;
                            const currentStatus = record?.status || (preview ? 'LEAVE' : undefined);

                            return (
                                <tr key={`${item.type}-${member.id}`} data-testid={`attendance-member-row-${member.id}`} className="group transition-colors hover:bg-bg-muted/70">
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-3">
                                            {renderAvatar(member, status === 'UNCHECKED')}
                                            <div className="flex min-w-0 flex-col">
                                                <span className="truncate text-sm font-medium tracking-wide text-fg-primary">{member.name}</span>
                                                {member.discordUsername ? (
                                                    <span className="truncate text-[10px] font-medium tracking-wide text-fg-tertiary">@{member.discordUsername}</span>
                                                ) : null}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3">
                                        {renderStatusBadge(status, statusLabel, `attendance-member-status-${member.id}`)}
                                    </td>
                                    <td className="px-5 py-3 text-[13px] font-semibold tracking-wide text-fg-secondary tabular-nums">
                                        {record?.checkedInAt ? `${formatCheckTime(record.checkedInAt)} น.` : '-'}
                                    </td>
                                    <td className="px-5 py-3 text-[13px] font-medium tracking-wide text-fg-secondary">
                                        <span className="line-clamp-1">{getLiveNoteText(preview, record, status)}</span>
                                    </td>
                                    {isSessionClosed ? (
                                        <td className="px-5 py-3 text-[13px] font-medium tracking-wide text-fg-secondary">
                                            <span className="line-clamp-1">{getLiveNoteText(preview, record, status)}</span>
                                            <span className="mt-0.5 block text-[10px] font-bold text-fg-tertiary">
                                                {record?.checkedInAt ? `${formatCheckTime(record.checkedInAt)} น.` : 'ไม่มีเวลาเช็ค'}
                                            </span>
                                        </td>
                                    ) : null}
                                    <td className="px-5 py-3 text-right">
                                        {renderQuickActions(member.id, member.name, currentStatus, Boolean(record))}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 ? (
                <div className="flex items-center justify-between border-t border-border-subtle bg-bg-muted px-5 py-4">
                    <span className="text-[11px] font-medium tracking-wide text-fg-tertiary">
                        แสดง <span className="text-fg-secondary">{startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, filteredItems.length)}</span> จาก <span className="text-fg-secondary">{filteredItems.length}</span> รายการ
                    </span>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="rounded-token-lg border border-border-subtle bg-bg-subtle p-1.5 text-fg-tertiary shadow-token-sm transition-colors hover:bg-bg-elevated hover:text-fg-primary disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="rounded-token-lg border border-border-subtle bg-bg-subtle px-3 py-1.5 text-xs font-bold text-fg-secondary">
                            {currentPage} / {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="rounded-token-lg border border-border-subtle bg-bg-subtle p-1.5 text-fg-tertiary shadow-token-sm transition-colors hover:bg-bg-elevated hover:text-fg-primary disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            ) : null}

            <ConfirmModal
                isOpen={pendingConfirmation !== null}
                onClose={() => setPendingConfirmation(null)}
                onConfirm={() => {
                    if (!pendingConfirmation) return;
                    void executeAttendanceUpdate(pendingConfirmation.memberId, pendingConfirmation.attendanceStatus);
                    setPendingConfirmation(null);
                }}
                title="ยืนยันการแก้ผลหลังปิดรอบ?"
                description={pendingConfirmation ? (
                    <span>
                        คุณกำลังเปลี่ยนสถานะของ <span className="font-semibold text-fg-primary">{pendingConfirmation.memberName}</span> จาก <span className="font-semibold text-fg-warning">{getAttendanceStatusLabel(pendingConfirmation.currentStatus)}</span> เป็น <span className="font-semibold text-fg-primary">{getAttendanceStatusLabel(pendingConfirmation.attendanceStatus)}</span>
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

function StatPill({
    icon: Icon,
    label,
    value,
    tone = 'default',
    testId,
}: {
    icon: typeof Users;
    label: string;
    value: number;
    tone?: 'default' | 'success' | 'danger' | 'info' | 'warning' | 'muted';
    testId: string;
}) {
    const toneClass = {
        default: 'border-border-subtle bg-bg-subtle text-fg-primary',
        success: 'border-status-success/20 bg-status-success-subtle text-fg-success',
        danger: 'border-status-danger/20 bg-status-danger-subtle text-fg-danger',
        info: 'border-status-info/20 bg-status-info-subtle text-fg-info',
        warning: 'border-status-warning/20 bg-status-warning-subtle text-fg-warning',
        muted: 'border-border-subtle bg-bg-muted text-fg-tertiary',
    }[tone];

    return (
        <div className={`rounded-token-xl border px-3 py-2 shadow-token-sm ${toneClass}`}>
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold">
                <Icon className="h-3.5 w-3.5" />
                {label}
            </div>
            <p data-testid={testId} className="text-lg font-black tabular-nums">{value}</p>
        </div>
    );
}
