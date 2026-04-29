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
    User
} from 'lucide-react';
import { ConfirmModal } from '@/components/modals/ConfirmModal';

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

interface Props {
    gangId: string;
    sessionId: string;
    records: AttendanceRecord[];
    notCheckedIn: Member[];
    leavePreviewByMemberId: Record<string, LeavePreview>;
    isSessionActive: boolean;
    isSessionClosed: boolean;
    canManageAttendance: boolean;
}

export function AttendanceSessionDetail({ gangId, sessionId, records, notCheckedIn, leavePreviewByMemberId, isSessionActive, isSessionClosed, canManageAttendance }: Props) {
    const router = useRouter();
    const [currentPage, setCurrentPage] = useState(1);
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

    const allItems = useMemo(() => ([
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

    const totalPages = Math.ceil(allItems.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedItems = allItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const statusColors: Record<string, string> = {
        PRESENT: 'bg-status-success-subtle text-fg-success border-status-success shadow-token-sm',
        ABSENT: 'bg-status-danger-subtle text-fg-danger border-status-danger shadow-token-sm',
        LEAVE: 'bg-status-info-subtle text-fg-info border-status-info shadow-token-sm',
        LATE_NOTICE: 'bg-status-warning-subtle text-fg-warning border-status-warning shadow-token-sm',
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
                setLocalRecords(prev => prev.filter(record => record.member.id !== memberId));

                if (isSessionActive && restoredMember) {
                    const restoredLeavePreview = leavePreviewByMemberId[memberId];

                    if (restoredLeavePreview) {
                        setLocalLeavePreviewByMemberId(prev => ({
                            ...prev,
                            [memberId]: restoredLeavePreview,
                        }));
                    }

                    setLocalNotCheckedIn(prev => sortMembers([
                        ...prev.filter(member => member.id !== memberId),
                        restoredMember,
                    ]));
                }
            } else if (data.record) {
                const nextRecord = data.record as AttendanceRecord;

                setLocalLeavePreviewByMemberId(prev => {
                    if (!prev[memberId]) {
                        return prev;
                    }

                    const next = { ...prev };
                    delete next[memberId];
                    return next;
                });

                setLocalRecords(prev => {
                    const existingIndex = prev.findIndex(record => record.member.id === memberId);
                    if (existingIndex === -1) {
                        return [...prev, nextRecord];
                    }

                    const next = [...prev];
                    next[existingIndex] = nextRecord;
                    return next;
                });

                setLocalNotCheckedIn(prev => prev.filter(member => member.id !== memberId));
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

    const renderQuickActions = (memberId: string, memberName: string, currentStatus?: string, hasPersistedRecord = false) => {
        if (!isSessionEditable) {
            return <span className="text-fg-tertiary font-medium">-</span>;
        }

        const isUpdating = pendingMemberIds.includes(memberId);
        const normalizedStatus = normalizeAttendanceStatus(currentStatus);
        const isPresentLike = isPresentLikeStatus(currentStatus);
        const isAbsent = normalizedStatus === 'ABSENT';
        const isLeave = normalizedStatus === 'LEAVE';

        return (
            <div className="flex justify-end gap-1.5">
                <button
                    onClick={() => handleAttendanceUpdate(memberId, memberName, 'PRESENT', currentStatus)}
                    data-testid={`attendance-action-present-${memberId}`}
                    disabled={isUpdating || isPresentLike}
                    className={`px-2.5 py-1 rounded-token-md text-[10px] font-bold tracking-widest border transition-colors min-w-[48px] flex items-center justify-center ${isPresentLike ? 'bg-status-success-subtle text-fg-success border-status-success' : 'bg-bg-muted text-fg-secondary border-border-subtle hover:bg-status-success-subtle hover:text-fg-success hover:border-status-success'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {isUpdating ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'มา'}
                </button>
                <button
                    onClick={() => handleAttendanceUpdate(memberId, memberName, 'ABSENT', currentStatus)}
                    data-testid={`attendance-action-absent-${memberId}`}
                    disabled={isUpdating || isAbsent}
                    className={`px-2.5 py-1 rounded-token-md text-[10px] font-bold tracking-widest border transition-colors min-w-[48px] flex items-center justify-center ${isAbsent ? 'bg-status-danger-subtle text-fg-danger border-status-danger' : 'bg-bg-muted text-fg-secondary border-border-subtle hover:bg-status-danger-subtle hover:text-fg-danger hover:border-status-danger'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {isUpdating ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'ขาด'}
                </button>
                <button
                    onClick={() => handleAttendanceUpdate(memberId, memberName, 'LEAVE', currentStatus)}
                    data-testid={`attendance-action-leave-${memberId}`}
                    disabled={isUpdating || isLeave}
                    className={`px-2.5 py-1 rounded-token-md text-[10px] font-bold tracking-widest border transition-colors min-w-[48px] flex items-center justify-center ${isLeave ? 'bg-status-info-subtle text-fg-info border-status-info' : 'bg-bg-muted text-fg-secondary border-border-subtle hover:bg-status-info-subtle hover:text-fg-info hover:border-status-info'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {isUpdating ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'ลา'}
                </button>
                {currentStatus && hasPersistedRecord && isSessionActive && (
                    <button
                        onClick={() => handleAttendanceUpdate(memberId, memberName, 'RESET', currentStatus)}
                        data-testid={`attendance-action-reset-${memberId}`}
                        disabled={isUpdating}
                        className="px-2.5 py-1 rounded-token-md text-[10px] font-bold tracking-widest border transition-colors min-w-[56px] flex items-center justify-center bg-bg-muted text-fg-tertiary border-border-subtle hover:bg-bg-elevated hover:text-fg-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isUpdating ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'รีเซ็ต'}
                    </button>
                )}
            </div>
        );
    };

    return (
        <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden shadow-token-sm" data-testid="attendance-member-table">
            <div className="p-4 sm:p-5 border-b border-border-subtle bg-bg-muted">
                <h3 className="font-semibold text-fg-primary tracking-wide">รายชื่อผู้เข้าร่วม</h3>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
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
                        แสดง <span className="text-fg-secondary">{startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, allItems.length)}</span> จาก <span className="text-fg-secondary">{allItems.length}</span> รายการ
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
