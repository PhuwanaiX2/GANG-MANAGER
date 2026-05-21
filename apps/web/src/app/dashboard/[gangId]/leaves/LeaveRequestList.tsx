'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, CheckCircle2, Clock, Calendar, ChevronLeft, ChevronRight, CircleX, FileText, LayoutGrid, Plus, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { logClientError } from '@/lib/clientLogger';
import { Avatar, ModalLayer } from '@/components/ui';

interface Props {
    requests: (any & { reviewer?: any })[]; // We'll rely on the runtime check/display for member fields
    gangId: string;
    canReview: boolean;
    currentMemberId: string | null;
    currentMemberName: string | null;
}

const getAvatarUrl = (member: any) => {
    if (member?.discordAvatar) return member.discordAvatar;
    return null;
};

function formatBangkokDate(value: Date | string) {
    return new Date(value).toLocaleDateString('th-TH', {
        timeZone: 'Asia/Bangkok',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

function formatBangkokTime(value: Date | string) {
    return new Date(value).toLocaleTimeString('th-TH', {
        timeZone: 'Asia/Bangkok',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
}

function formatBangkokDateTime(value: Date | string) {
    return new Date(value).toLocaleString('th-TH', {
        timeZone: 'Asia/Bangkok',
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
}

function formatBangkokInputDate(value: Date | string) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date(value));
}

const getStatusMeta = (status: string) => {
    if (status === 'APPROVED') {
        return {
            label: 'อนุมัติแล้ว',
            reviewerPrefix: 'อนุมัติโดย',
            badgeClass: 'border-status-success bg-status-success-subtle text-fg-success',
            railClass: 'bg-status-success',
        };
    }
    if (status === 'REJECTED') {
        return {
            label: 'ปฏิเสธ',
            reviewerPrefix: 'ปฏิเสธโดย',
            badgeClass: 'border-status-danger bg-status-danger-subtle text-fg-danger',
            railClass: 'bg-status-danger',
        };
    }
    return {
        label: 'รออนุมัติ',
        reviewerPrefix: 'รอตรวจ',
        badgeClass: 'border-status-info bg-status-info-subtle text-fg-info',
        railClass: 'bg-status-info',
    };
};

const OPEN_CREATE_EVENT = 'leave:create:open';

export function LeaveCreateButton({ className = '' }: { className?: string }) {
    return (
        <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(OPEN_CREATE_EVENT))}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-token-lg bg-accent px-4 py-2.5 text-sm font-black text-accent-fg shadow-token-sm transition-colors hover:bg-accent-hover ${className}`}
        >
            <Plus className="h-4 w-4" />
            ส่งคำขอใหม่
        </button>
    );
}

export function LeaveRequestList({ requests, gangId, canReview, currentMemberId, currentMemberName }: Props) {
    const router = useRouter();
    const today = new Date().toISOString().slice(0, 10);
    const [view, setView] = useState<'mine' | 'team'>(canReview ? 'team' : 'mine');
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [requestType, setRequestType] = useState<'FULL' | 'LATE'>('FULL');
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [lateDate, setLateDate] = useState(today);
    const [lateTime, setLateTime] = useState('20:00');
    const [reason, setReason] = useState('');
    const ITEMS_PER_PAGE = 10;

    const myRequests = currentMemberId ? requests.filter(r => r.memberId === currentMemberId) : [];
    const sourceRequests = view === 'team' ? requests : myRequests;
    const pendingRequests = sourceRequests.filter(r => r.status === 'PENDING');
    const completedRequests = sourceRequests.filter(r => r.status !== 'PENDING');
    const historyRequests = canReview ? completedRequests : sourceRequests;
    const statusCounts = {
        PENDING: sourceRequests.filter(r => r.status === 'PENDING').length,
        APPROVED: sourceRequests.filter(r => r.status === 'APPROVED').length,
        REJECTED: sourceRequests.filter(r => r.status === 'REJECTED').length,
    };
    const totalPages = Math.ceil(historyRequests.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedRequests = historyRequests.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    const hasDraft = creating
        || processingId !== null
        || requestType !== 'FULL'
        || startDate !== today
        || endDate !== today
        || lateDate !== today
        || lateTime !== '20:00'
        || reason.trim().length > 0;

    useAutoRefresh(30, !hasDraft && pendingRequests.length > 0);

    useEffect(() => {
        const handleOpenCreate = () => {
            if (currentMemberId) setIsCreateModalOpen(true);
        };
        window.addEventListener(OPEN_CREATE_EVENT, handleOpenCreate);
        return () => window.removeEventListener(OPEN_CREATE_EVENT, handleOpenCreate);
    }, [currentMemberId]);

    const handleViewChange = (newView: 'mine' | 'team') => {
        setView(newView);
        setCurrentPage(1);
    };

    const handleCreateRequest = async () => {
        setCreating(true);
        try {
            const payload = requestType === 'FULL'
                ? {
                    type: 'FULL',
                    startDate,
                    endDate,
                    reason,
                }
                : {
                    type: 'LATE',
                    lateDate,
                    lateTime,
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

            toast.success(requestType === 'FULL' ? 'ส่งคำขอลาแล้ว' : 'ส่งคำขอแจ้งเข้าช้าแล้ว');
            setReason('');
            setView('mine');
            setIsCreateModalOpen(false);
            router.refresh();
        } catch (error: any) {
            logClientError('dashboard.leaves.create_request.failed', error, { gangId, requestType });
            toast.error(error?.message || 'เกิดข้อผิดพลาด');
        } finally {
            setCreating(false);
        }
    };

    const handleAction = async (requestId: string, action: 'approve' | 'reject', data?: { startDate?: Date, endDate?: Date }) => {
        setProcessingId(requestId);
        try {
            const res = await fetch(`/api/gangs/${gangId}/leaves/${requestId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: action === 'approve' ? 'APPROVED' : 'REJECTED',
                    startDate: data?.startDate,
                    endDate: data?.endDate
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error || 'อัปเดตคำขอไม่สำเร็จ');
            }

            toast.success(action === 'approve' ? 'อนุมัติเรียบร้อย' : 'ปฏิเสธเรียบร้อย');
            router.refresh();
        } catch (error: any) {
            logClientError('dashboard.leaves.review_request.failed', error, { gangId, requestId, action });
            toast.error(error?.message || 'เกิดข้อผิดพลาด');
        } finally {
            setProcessingId(null);
        }
    };

    const getRequestRange = (req: any) => (
        req.type === 'FULL'
            ? `${formatBangkokDate(req.startDate)} - ${formatBangkokDate(req.endDate)}`
            : `จะเข้า ${formatBangkokTime(req.startDate)} น.`
    );

    const renderAvatar = (req: any) => (
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-token-full border ${req.type === 'FULL' ? 'border-status-danger bg-status-danger-subtle text-fg-danger' : 'border-status-warning bg-status-warning-subtle text-fg-warning'}`}>
            {getAvatarUrl(req.member) ? (
                <Avatar
                    src={getAvatarUrl(req.member)}
                    name={req.member?.name}
                    alt={req.member?.name || 'Member avatar'}
                    className="h-full w-full border-0"
                />
            ) : (
                req.type === 'FULL' ? <Calendar className="h-4 w-4" /> : <Clock className="h-4 w-4" />
            )}
        </div>
    );

    const renderReviewActions = (req: any) => (
        <div className="space-y-2">
            {req.type === 'FULL' && (
                <div className="grid grid-cols-2 gap-1.5">
                    <input
                        type="date"
                        aria-label="เริ่มลา"
                        className="min-h-9 w-full rounded-token-md border border-border-subtle bg-bg-base px-2 text-xs text-fg-primary outline-none focus:border-border-strong"
                        defaultValue={formatBangkokInputDate(req.startDate)}
                        id={`leave-start-${req.id}`}
                    />
                    <input
                        type="date"
                        aria-label="สิ้นสุด"
                        className="min-h-9 w-full rounded-token-md border border-border-subtle bg-bg-base px-2 text-xs text-fg-primary outline-none focus:border-border-strong"
                        defaultValue={formatBangkokInputDate(req.endDate)}
                        id={`leave-end-${req.id}`}
                    />
                </div>
            )}
            <div className="grid grid-cols-2 gap-1.5">
                <button
                    type="button"
                    onClick={() => handleAction(req.id, 'reject')}
                    disabled={!!processingId}
                    className="min-h-9 rounded-token-md border border-status-danger bg-status-danger-subtle px-2 text-xs font-black text-fg-danger transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                    ปฏิเสธ
                </button>
                <button
                    type="button"
                    onClick={() => {
                        if (req.type === 'FULL') {
                            const startEl = document.getElementById(`leave-start-${req.id}`) as HTMLInputElement;
                            const endEl = document.getElementById(`leave-end-${req.id}`) as HTMLInputElement;
                            handleAction(req.id, 'approve', {
                                startDate: startEl?.value ? new Date(startEl.value) : undefined,
                                endDate: endEl?.value ? new Date(endEl.value) : undefined
                            });
                            return;
                        }
                        handleAction(req.id, 'approve');
                    }}
                    disabled={!!processingId}
                    className="inline-flex min-h-9 items-center justify-center gap-1 rounded-token-md bg-accent px-2 text-xs font-black text-accent-fg shadow-token-sm transition-colors hover:bg-accent-hover disabled:opacity-50"
                >
                    {processingId === req.id ? (
                        <div className="h-3 w-3 rounded-token-full border-2 border-accent-fg/30 border-t-accent-fg animate-spin" />
                    ) : (
                        <>
                            <Check className="h-3 w-3" />
                            อนุมัติ
                        </>
                    )}
                </button>
            </div>
        </div>
    );

    const renderMobileRequestCard = (req: any, allowReview: boolean) => {
        const status = getStatusMeta(req.status);

        return (
            <article key={req.id} className="relative overflow-hidden rounded-token-lg border border-border-subtle bg-bg-base p-3 shadow-token-sm">
                <span className={`absolute inset-y-0 left-0 w-1 ${status.railClass}`} />
                <div className="flex gap-2 pl-1">
                    {renderAvatar(req)}
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate text-sm font-black text-fg-primary">{req.member?.name || 'ไม่พบชื่อสมาชิก'}</p>
                            <span className={`rounded-token-full border px-2 py-0.5 text-[10px] font-black ${req.type === 'FULL' ? 'border-status-danger bg-status-danger-subtle text-fg-danger' : 'border-status-warning bg-status-warning-subtle text-fg-warning'}`}>
                                {req.type === 'FULL' ? 'ลาหยุด' : 'เข้าช้า'}
                            </span>
                            <span className={`rounded-token-full border px-2 py-0.5 text-[10px] font-black ${status.badgeClass}`}>
                                {status.label}
                            </span>
                        </div>
                        <p className="mt-1 text-xs font-semibold text-fg-secondary">{getRequestRange(req)}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-fg-tertiary">{req.reason ? `"${req.reason}"` : 'ไม่มีเหตุผลเพิ่มเติม'}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold text-fg-tertiary">
                            <span>ส่ง {formatBangkokDateTime(req.requestedAt)}</span>
                            {req.reviewer && req.status !== 'PENDING' && <span>{status.reviewerPrefix} {req.reviewer.name}</span>}
                        </div>
                    </div>
                </div>
                {allowReview && <div className="mt-3 rounded-token-lg border border-border-subtle bg-bg-muted p-2">{renderReviewActions(req)}</div>}
            </article>
        );
    };

    const renderEmptyState = (icon: ReactNode, title: string, detail: string) => (
        <div className="mt-3 flex min-h-36 flex-col items-center justify-center rounded-token-lg border border-dashed border-border-subtle bg-bg-base px-4 py-6 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-token-full border border-border-subtle bg-bg-muted text-fg-tertiary">
                {icon}
            </div>
            <p className="mt-3 text-sm font-black text-fg-primary">{title}</p>
            <p className="mt-1 text-xs font-semibold text-fg-tertiary">{detail}</p>
        </div>
    );

    return (
        <div className="space-y-3">
            <section className="ops-surface rounded-token-2xl border border-border-subtle bg-bg-subtle p-3 shadow-token-xs sm:p-4">
                <div className="flex flex-col gap-4 border-b border-border-subtle pb-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 className="text-base font-black text-fg-primary">รายการลา</h2>
                        {canReview ? (
                            <div className="mt-3 flex w-full gap-1.5 overflow-x-auto rounded-token-lg bg-bg-muted p-1 sm:w-fit">
                                <button
                                    type="button"
                                    onClick={() => handleViewChange('team')}
                                className={`inline-flex min-h-10 min-w-[6.5rem] items-center justify-center gap-2 rounded-token-md px-3 text-sm font-bold transition-colors ${view === 'team' ? 'border border-border-accent bg-accent-subtle text-accent-bright shadow-token-xs' : 'text-fg-tertiary hover:bg-bg-subtle hover:text-fg-primary'}`}
                                >
                                    <LayoutGrid className="h-4 w-4" />
                                    ทั้งหมด
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleViewChange('mine')}
                                className={`inline-flex min-h-10 min-w-[6.5rem] items-center justify-center gap-2 rounded-token-md px-3 text-sm font-bold transition-colors ${view === 'mine' ? 'border border-border-accent bg-accent-subtle text-accent-bright shadow-token-xs' : 'text-fg-tertiary hover:bg-bg-subtle hover:text-fg-primary'}`}
                                >
                                    <UserRound className="h-4 w-4" />
                                    ของฉัน
                                </button>
                            </div>
                        ) : null}
                    </div>

                    <div className="grid grid-cols-3 gap-2 sm:min-w-[26rem]">
                        <div className="flex min-h-10 items-center justify-between gap-2 rounded-token-lg border border-border-subtle bg-bg-base px-3 shadow-token-xs">
                            <span className="inline-flex items-center gap-2 text-xs font-black text-fg-secondary"><Clock className="h-4 w-4 text-fg-info" />รอ</span>
                            <span className="text-sm font-black tabular-nums text-fg-primary">{statusCounts.PENDING}</span>
                        </div>
                        <div className="flex min-h-10 items-center justify-between gap-2 rounded-token-lg border border-border-subtle bg-bg-base px-3 shadow-token-xs">
                            <span className="inline-flex items-center gap-2 text-xs font-black text-fg-secondary"><CheckCircle2 className="h-4 w-4 text-fg-success" />อนุมัติ</span>
                            <span className="text-sm font-black tabular-nums text-fg-primary">{statusCounts.APPROVED}</span>
                        </div>
                        <div className="flex min-h-10 items-center justify-between gap-2 rounded-token-lg border border-border-subtle bg-bg-base px-3 shadow-token-xs">
                            <span className="inline-flex items-center gap-2 text-xs font-black text-fg-secondary"><CircleX className="h-4 w-4 text-fg-danger" />ปฏิเสธ</span>
                            <span className="text-sm font-black tabular-nums text-fg-primary">{statusCounts.REJECTED}</span>
                        </div>
                    </div>
                </div>

                {canReview && (
                    <div id="leave-review-queue" className="mt-4 scroll-mt-6 rounded-token-lg border border-border-subtle bg-bg-base p-3">
                        <div className="flex items-center justify-between gap-3">
                            <h3 className="inline-flex items-center gap-2 text-sm font-black text-fg-primary">
                                <Clock className="h-4 w-4 text-fg-info" />
                                รออนุมัติ
                            </h3>
                            <span className="rounded-token-full bg-bg-muted px-2.5 py-1 text-xs font-black text-fg-secondary tabular-nums">{pendingRequests.length} รายการ</span>
                        </div>
                        {pendingRequests.length === 0 ? renderEmptyState(
                            <Calendar className="h-5 w-5 text-accent-bright" />,
                            'ไม่มีคำขอที่รออนุมัติ',
                            'เมื่อมีคำขอใหม่ จะแสดงในรายการนี้'
                        ) : (
                            <>
                                <div className="mt-3 hidden overflow-hidden rounded-token-lg border border-border-subtle bg-bg-subtle md:block">
                                    <table className="ops-table w-full text-left text-sm">
                                        <thead className="bg-bg-muted text-xs font-bold text-fg-tertiary">
                                            <tr>
                                                <th className="px-3 py-2">สมาชิก</th>
                                                <th className="px-3 py-2">ประเภท/เวลา</th>
                                                <th className="px-3 py-2">เหตุผล</th>
                                                <th className="px-3 py-2">ส่งเมื่อ</th>
                                                <th className="w-[260px] px-3 py-2">จัดการ</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border-subtle">
                                            {pendingRequests.map((req) => (
                                                <tr key={req.id} className="align-top">
                                                    <td className="px-3 py-3">
                                                        <div className="flex items-center gap-2">
                                                            {renderAvatar(req)}
                                                            <span className="font-black text-fg-primary">{req.member?.name || 'ไม่พบชื่อสมาชิก'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <span className={`inline-flex rounded-token-full border px-2 py-0.5 text-[10px] font-black ${req.type === 'FULL' ? 'border-status-danger bg-status-danger-subtle text-fg-danger' : 'border-status-warning bg-status-warning-subtle text-fg-warning'}`}>{req.type === 'FULL' ? 'ลาหยุด' : 'เข้าช้า'}</span>
                                                        <p className="mt-1 text-xs font-semibold text-fg-secondary">{getRequestRange(req)}</p>
                                                    </td>
                                                    <td className="max-w-[280px] px-3 py-3 text-xs leading-5 text-fg-tertiary">{req.reason || 'ไม่มีเหตุผลเพิ่มเติม'}</td>
                                                    <td className="px-3 py-3 text-xs font-semibold text-fg-tertiary">{formatBangkokDateTime(req.requestedAt)}</td>
                                                    <td className="px-3 py-3">{renderReviewActions(req)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="mt-3 space-y-2 md:hidden">
                                    {pendingRequests.map((req) => renderMobileRequestCard(req, true))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                <div className="mt-4 rounded-token-lg border border-border-subtle bg-bg-base p-3">
                    <div className="flex items-center justify-between gap-3">
                        <h3 className="inline-flex items-center gap-2 text-sm font-black text-fg-primary">
                            <Calendar className="h-4 w-4 text-fg-tertiary" />
                            ประวัติที่ดำเนินการแล้ว
                        </h3>
                        <span className="rounded-token-full bg-bg-muted px-2.5 py-1 text-xs font-black text-fg-secondary tabular-nums">{historyRequests.length} รายการ</span>
                    </div>

                    {historyRequests.length === 0 ? renderEmptyState(
                        <FileText className="h-5 w-5" />,
                        canReview ? 'ยังไม่มีประวัติอนุมัติหรือปฏิเสธ' : 'ยังไม่มีประวัติการลา',
                        canReview ? 'ประวัติการตัดสินใจจะแสดงที่นี่' : 'คำขอของคุณจะแสดงในรายการนี้'
                    ) : (
                        <>
                            <div className="mt-3 hidden overflow-hidden rounded-token-lg border border-border-subtle bg-bg-subtle md:block">
                                <table className="ops-table w-full text-left text-sm">
                                    <thead className="bg-bg-muted text-xs font-bold text-fg-tertiary">
                                        <tr>
                                            <th className="px-3 py-2">สมาชิก</th>
                                            <th className="px-3 py-2">ประเภท/เวลา</th>
                                            <th className="px-3 py-2">สถานะ</th>
                                            <th className="px-3 py-2">ผู้ตรวจ</th>
                                            <th className="px-3 py-2">ส่งเมื่อ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border-subtle">
                                        {paginatedRequests.map((req) => {
                                            const status = getStatusMeta(req.status);
                                            return (
                                                <tr key={req.id}>
                                                    <td className="px-3 py-3">
                                                        <div className="flex items-center gap-2">
                                                            {renderAvatar(req)}
                                                            <span className="font-black text-fg-primary">{req.member?.name || 'ไม่พบชื่อสมาชิก'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <span className={`inline-flex rounded-token-full border px-2 py-0.5 text-[10px] font-black ${req.type === 'FULL' ? 'border-status-danger bg-status-danger-subtle text-fg-danger' : 'border-status-warning bg-status-warning-subtle text-fg-warning'}`}>{req.type === 'FULL' ? 'ลาหยุด' : 'เข้าช้า'}</span>
                                                        <p className="mt-1 text-xs font-semibold text-fg-secondary">{getRequestRange(req)}</p>
                                                    </td>
                                                    <td className="px-3 py-3"><span className={`inline-flex rounded-token-full border px-2 py-1 text-[10px] font-black ${status.badgeClass}`}>{status.label}</span></td>
                                                    <td className="px-3 py-3 text-xs font-semibold text-fg-tertiary">{req.reviewer?.name || '-'}</td>
                                                    <td className="px-3 py-3 text-xs font-semibold text-fg-tertiary">{formatBangkokDateTime(req.requestedAt)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-3 space-y-2 md:hidden">
                                {paginatedRequests.map((req) => renderMobileRequestCard(req, false))}
                            </div>
                        </>
                    )}

                    {totalPages > 1 && (
                        <div className="mt-3 flex items-center justify-center gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="rounded-token-lg border border-border-subtle bg-bg-subtle p-2 text-fg-tertiary transition-colors hover:bg-bg-muted hover:text-fg-primary disabled:cursor-not-allowed disabled:opacity-30"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </button>

                            <div className="flex items-center gap-1">
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
                                            type="button"
                                            key={page}
                                            onClick={() => setCurrentPage(page)}
                                            className={`h-10 w-10 rounded-token-lg text-sm font-medium transition-colors ${page === currentPage
                                                ? 'bg-accent text-accent-fg shadow-token-sm'
                                                : 'border border-border-subtle bg-bg-subtle text-fg-tertiary hover:bg-bg-muted hover:text-fg-primary'
                                                }`}
                                        >
                                            {page}
                                        </button>
                                    );
                                })}
                            </div>

                            <button
                                type="button"
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className="rounded-token-lg border border-border-subtle bg-bg-subtle p-2 text-fg-tertiary transition-colors hover:bg-bg-muted hover:text-fg-primary disabled:cursor-not-allowed disabled:opacity-30"
                            >
                                <ChevronRight className="h-5 w-5" />
                            </button>

                            <span className="ml-2 hidden text-xs text-fg-tertiary sm:inline">
                                {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, historyRequests.length)} จาก {historyRequests.length}
                            </span>
                        </div>
                    )}
                </div>
            </section>

            {isCreateModalOpen && currentMemberId && (
                <ModalLayer align="top" onClose={creating ? undefined : () => setIsCreateModalOpen(false)}>
                    <button
                        type="button"
                        aria-label="ปิดหน้าต่างส่งคำขอ"
                        className="absolute inset-0"
                        onClick={() => {
                            if (!creating) setIsCreateModalOpen(false);
                        }}
                    />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="leave-create-modal-title"
                        className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-xl overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle shadow-token-md animate-in zoom-in-95 duration-200"
                    >
                        <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-4 py-3">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="flex h-9 w-9 items-center justify-center rounded-token-lg border border-status-success/40 bg-status-success-subtle">
                                        <Plus className="h-4 w-4 text-fg-success" />
                                    </span>
                                    <div>
                                        <h3 id="leave-create-modal-title" className="text-base font-black text-fg-primary">
                                            ส่งคำขอใหม่
                                        </h3>
                                        <p className="mt-0.5 text-xs font-medium text-fg-tertiary">
                                            {currentMemberName ? `ส่งคำขอในชื่อ ${currentMemberName}` : 'ส่งคำขอลาหรือแจ้งเข้าช้า'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsCreateModalOpen(false)}
                                disabled={creating}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-token-lg border border-border-subtle bg-bg-muted text-fg-tertiary transition-colors hover:bg-bg-elevated hover:text-fg-primary disabled:opacity-50"
                                aria-label="ปิด"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form
                            className="max-h-[calc(100dvh-7rem)] space-y-3 overflow-y-auto p-4"
                            onSubmit={(event) => {
                                event.preventDefault();
                                handleCreateRequest();
                            }}
                        >
                            <div className="grid grid-cols-2 gap-1.5 rounded-token-lg border border-border-subtle bg-bg-muted p-1 shadow-inner">
                                <button
                                    type="button"
                                    onClick={() => setRequestType('FULL')}
                                    className={`min-h-10 rounded-token-md px-3 py-2 text-sm font-bold transition-colors ${requestType === 'FULL' ? 'border border-status-danger bg-status-danger-subtle text-fg-danger shadow-token-sm' : 'text-fg-tertiary hover:bg-bg-subtle hover:text-fg-primary'}`}
                                >
                                    ลาหยุด
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRequestType('LATE')}
                                    className={`min-h-10 rounded-token-md px-3 py-2 text-sm font-bold transition-colors ${requestType === 'LATE' ? 'border border-status-warning bg-status-warning-subtle text-fg-warning shadow-token-sm' : 'text-fg-tertiary hover:bg-bg-subtle hover:text-fg-primary'}`}
                                >
                                    เข้าช้า
                                </button>
                            </div>

                            {requestType === 'FULL' ? (
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    <label className="space-y-1.5">
                                        <span className="text-xs font-medium text-fg-tertiary">วันเริ่มลา</span>
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="min-h-10 w-full rounded-token-lg border border-border-subtle bg-bg-base px-3 py-2 text-sm text-fg-primary outline-none focus:border-border-strong"
                                        />
                                    </label>
                                    <label className="space-y-1.5">
                                        <span className="text-xs font-medium text-fg-tertiary">วันสิ้นสุด</span>
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="min-h-10 w-full rounded-token-lg border border-border-subtle bg-bg-base px-3 py-2 text-sm text-fg-primary outline-none focus:border-border-strong"
                                        />
                                    </label>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    <label className="space-y-1.5">
                                        <span className="text-xs font-medium text-fg-tertiary">วันที่จะเข้าช้า</span>
                                        <input
                                            type="date"
                                            value={lateDate}
                                            onChange={(e) => setLateDate(e.target.value)}
                                            className="min-h-10 w-full rounded-token-lg border border-border-subtle bg-bg-base px-3 py-2 text-sm text-fg-primary outline-none focus:border-border-strong"
                                        />
                                    </label>
                                    <label className="space-y-1.5">
                                        <span className="text-xs font-medium text-fg-tertiary">เวลาเข้าโดยประมาณ</span>
                                        <input
                                            type="time"
                                            value={lateTime}
                                            onChange={(e) => setLateTime(e.target.value)}
                                            className="min-h-10 w-full rounded-token-lg border border-border-subtle bg-bg-base px-3 py-2 text-sm text-fg-primary outline-none focus:border-border-strong"
                                        />
                                    </label>
                                </div>
                            )}

                            <label className="block space-y-1.5">
                                <span className="text-xs font-medium text-fg-tertiary">เหตุผล (ไม่บังคับ)</span>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    rows={3}
                                    maxLength={500}
                                    className="w-full resize-none rounded-token-lg border border-border-subtle bg-bg-base px-3 py-2.5 text-sm text-fg-primary outline-none placeholder:text-fg-tertiary focus:border-border-strong"
                                    placeholder={requestType === 'FULL' ? 'เช่น ติดธุระ / พักรักษาตัว' : 'เช่น รถติด / ติดงาน / เน็ตมีปัญหา'}
                                />
                            </label>

                            <div className="grid grid-cols-2 gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    disabled={creating}
                                    className="min-h-10 rounded-token-lg border border-border-subtle bg-bg-muted px-4 py-2 text-sm font-bold text-fg-secondary transition-colors hover:bg-bg-elevated hover:text-fg-primary disabled:opacity-50"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-token-lg bg-accent px-4 py-2 text-sm font-black text-accent-fg shadow-token-sm transition-colors hover:bg-accent-hover disabled:opacity-50"
                                >
                                    {creating ? 'กำลังส่ง...' : requestType === 'FULL' ? 'ส่งคำขอลา' : 'ส่งคำขอเข้าช้า'}
                                </button>
                            </div>
                        </form>
                    </div>
                </ModalLayer>
            )}
        </div>
    );
}
