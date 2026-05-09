'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import Image from 'next/image';
import { Check, Clock, Calendar, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { logClientError } from '@/lib/clientLogger';

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

export function LeaveRequestList({ requests, gangId, canReview, currentMemberId, currentMemberName }: Props) {
    const router = useRouter();
    const today = new Date().toISOString().slice(0, 10);
    const [view, setView] = useState<'mine' | 'team'>(canReview ? 'team' : 'mine');
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
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
    const statusCounts = {
        PENDING: sourceRequests.filter(r => r.status === 'PENDING').length,
        APPROVED: sourceRequests.filter(r => r.status === 'APPROVED').length,
        REJECTED: sourceRequests.filter(r => r.status === 'REJECTED').length,
    };
    const totalPages = Math.ceil(sourceRequests.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedRequests = sourceRequests.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    const hasDraft = creating
        || processingId !== null
        || requestType !== 'FULL'
        || startDate !== today
        || endDate !== today
        || lateDate !== today
        || lateTime !== '20:00'
        || reason.trim().length > 0;

    useAutoRefresh(15, !hasDraft);

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

    return (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] xl:items-start">
            {currentMemberId && (
                <section id="leave-request-form" className="scroll-mt-6 rounded-token-xl border border-border-subtle bg-bg-subtle p-3 shadow-token-sm">
                    <div className="flex items-start justify-between gap-3 border-b border-border-subtle pb-3">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 text-sm font-black text-fg-primary">
                                <span className="flex h-8 w-8 items-center justify-center rounded-token-lg border border-status-success/40 bg-status-success-subtle">
                                    <Plus className="h-4 w-4 text-fg-success" />
                                </span>
                                ส่งคำขอใหม่
                            </div>
                            <p className="mt-1 text-xs text-fg-tertiary">
                                {currentMemberName ? `ส่งคำขอในชื่อ ${currentMemberName}` : 'ส่งคำขอลาหรือแจ้งเข้าช้าจากหน้าเว็บได้ทันที'}
                            </p>
                        </div>
                        <span className="rounded-token-full border border-border-subtle bg-bg-muted px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">
                            Form
                        </span>
                    </div>

                    <div className="mt-3 space-y-3">
                        <div className="grid grid-cols-2 gap-1.5 rounded-token-lg border border-border-subtle bg-bg-muted p-1 shadow-inner">
                            <button
                                onClick={() => setRequestType('FULL')}
                                className={`min-h-10 rounded-token-md px-3 py-2 text-sm font-bold transition-colors ${requestType === 'FULL' ? 'border border-status-danger bg-status-danger-subtle text-fg-danger shadow-token-sm' : 'text-fg-tertiary hover:bg-bg-subtle hover:text-fg-primary'}`}
                            >
                                ลาหยุด
                            </button>
                            <button
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

                        <button
                            onClick={handleCreateRequest}
                            disabled={creating}
                            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-token-lg bg-accent px-4 py-2 text-sm font-black text-accent-fg shadow-token-sm transition-colors hover:bg-accent-hover disabled:opacity-50"
                        >
                            {creating ? 'กำลังส่ง...' : requestType === 'FULL' ? 'ส่งคำขอลา' : 'ส่งคำขอเข้าช้า'}
                        </button>
                    </div>
                </section>
            )}

            <section id="leave-review-queue" className={`${currentMemberId ? '' : 'xl:col-span-2'} scroll-mt-6 rounded-token-xl border border-border-subtle bg-bg-subtle p-3 shadow-token-sm`}>
                <div className="flex flex-col gap-3 border-b border-border-subtle pb-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-fg-tertiary">Leave Timeline</p>
                        <h2 className="mt-1 text-base font-black text-fg-primary">{view === 'team' ? 'คำขอทั้งแก๊ง' : 'ประวัติของฉัน'}</h2>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            <span className="rounded-token-full border border-status-info/30 bg-status-info-subtle px-2 py-0.5 text-[10px] font-black text-fg-info tabular-nums">รอ {statusCounts.PENDING}</span>
                            <span className="rounded-token-full border border-status-success/30 bg-status-success-subtle px-2 py-0.5 text-[10px] font-black text-fg-success tabular-nums">อนุมัติ {statusCounts.APPROVED}</span>
                            <span className="rounded-token-full border border-status-danger/30 bg-status-danger-subtle px-2 py-0.5 text-[10px] font-black text-fg-danger tabular-nums">ปฏิเสธ {statusCounts.REJECTED}</span>
                        </div>
                    </div>

                    {canReview && (
                        <div className="flex gap-1.5 overflow-x-auto rounded-token-lg border border-border-subtle bg-bg-muted p-1 shadow-inner">
                            <button
                                onClick={() => handleViewChange('team')}
                                className={`flex min-h-10 min-w-fit items-center gap-2 rounded-token-md px-3 py-2 text-sm font-bold transition-colors ${view === 'team' ? 'bg-accent text-accent-fg shadow-token-sm' : 'text-fg-tertiary hover:bg-bg-elevated hover:text-fg-primary'}`}
                            >
                                ทั้งแก๊ง
                                <span className="rounded-token-md bg-bg-subtle/80 px-2 py-0.5 text-[10px] font-black text-fg-primary tabular-nums">{requests.length}</span>
                            </button>
                            <button
                                onClick={() => handleViewChange('mine')}
                                className={`flex min-h-10 min-w-fit items-center gap-2 rounded-token-md px-3 py-2 text-sm font-bold transition-colors ${view === 'mine' ? 'bg-bg-subtle text-fg-primary shadow-token-sm ring-1 ring-border-subtle' : 'text-fg-tertiary hover:bg-bg-elevated hover:text-fg-primary'}`}
                            >
                                ของฉัน
                                <span className="rounded-token-md bg-bg-elevated px-2 py-0.5 text-[10px] font-black text-fg-secondary tabular-nums">{myRequests.length}</span>
                            </button>
                        </div>
                    )}
                </div>

                {sourceRequests.length === 0 ? (
                    <div className="mt-3 flex items-center gap-4 rounded-token-xl border border-dashed border-border-subtle bg-bg-base p-4 text-left text-fg-tertiary">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-token-full bg-bg-muted ring-1 ring-border-subtle">
                            <Clock className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm font-black text-fg-primary">
                                {view === 'team' ? 'ยังไม่มีคำขอในมุมมองนี้' : 'ยังไม่มีประวัติการลา'}
                            </p>
                            <p className="mt-1 text-xs">รายการใหม่และประวัติย้อนหลังจะแสดงรวมกันตรงนี้</p>
                        </div>
                    </div>
                ) : (
                    <div className="mt-3 space-y-2.5">
                        {paginatedRequests.map((req) => {
                            const status = getStatusMeta(req.status);
                            const canAct = canReview && view === 'team' && req.status === 'PENDING';

                            return (
                                <article key={req.id} className="relative overflow-hidden rounded-token-xl border border-border-subtle bg-bg-base p-3 shadow-token-sm">
                                    <span className={`absolute inset-y-0 left-0 w-1 ${status.railClass}`} />
                                    <div className="flex items-start gap-3 pl-1">
                                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-token-full border ${req.type === 'FULL' ? 'border-status-danger bg-status-danger-subtle text-fg-danger' : 'border-status-warning bg-status-warning-subtle text-fg-warning'}`}>
                                            {getAvatarUrl(req.member) ? (
                                                <Image
                                                    src={getAvatarUrl(req.member)}
                                                    alt={req.member?.name || 'Member avatar'}
                                                    width={40}
                                                    height={40}
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                req.type === 'FULL' ? <Calendar className="h-5 w-5" /> : <Clock className="h-5 w-5" />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="truncate text-sm font-black text-fg-primary">{req.member?.name || 'ไม่พบชื่อสมาชิก'}</p>
                                                <span className={`inline-flex rounded-token-full border px-2 py-0.5 text-[10px] font-black ${req.type === 'FULL' ? 'border-status-danger bg-status-danger-subtle text-fg-danger' : 'border-status-warning bg-status-warning-subtle text-fg-warning'}`}>
                                                    {req.type === 'FULL' ? 'ลาหยุด' : 'เข้าช้า'}
                                                </span>
                                                <span className={`inline-flex rounded-token-full border px-2 py-0.5 text-[10px] font-black ${status.badgeClass}`}>
                                                    {status.label}
                                                </span>
                                            </div>
                                            <p className="mt-1 text-xs font-semibold text-fg-secondary">
                                                {req.type === 'FULL'
                                                    ? `${format(new Date(req.startDate), 'dd MMM yyyy', { locale: th })} - ${format(new Date(req.endDate), 'dd MMM yyyy', { locale: th })}`
                                                    : `จะเข้า ${format(new Date(req.startDate), 'HH:mm', { locale: th })} น.`}
                                            </p>
                                            <p className="mt-2 line-clamp-2 text-xs leading-5 text-fg-tertiary">{req.reason ? `"${req.reason}"` : 'ไม่มีเหตุผลเพิ่มเติม'}</p>
                                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-fg-tertiary">
                                                <span>ส่งเมื่อ {format(new Date(req.requestedAt), 'dd/MM/yy HH:mm', { locale: th })}</span>
                                                {req.reviewer && req.status !== 'PENDING' && (
                                                    <span className="rounded-token-full border border-border-subtle bg-bg-muted px-2 py-0.5 text-fg-secondary">
                                                        {status.reviewerPrefix} {req.reviewer.name}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {canAct && (
                                        <div className="mt-3 space-y-3 rounded-token-lg border border-border-subtle bg-bg-muted p-2.5">
                                            {req.type === 'FULL' && (
                                                <div className="grid grid-cols-2 gap-2">
                                                    <label className="space-y-1">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-fg-tertiary">เริ่มลา</span>
                                                        <input
                                                            type="date"
                                                            className="w-full rounded-token-lg border border-border-subtle bg-bg-base px-2 py-2 text-xs text-fg-primary outline-none focus:border-border-strong"
                                                            defaultValue={format(new Date(req.startDate), 'yyyy-MM-dd')}
                                                            id={`leave-start-${req.id}`}
                                                        />
                                                    </label>
                                                    <label className="space-y-1">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-fg-tertiary">สิ้นสุด</span>
                                                        <input
                                                            type="date"
                                                            className="w-full rounded-token-lg border border-border-subtle bg-bg-base px-2 py-2 text-xs text-fg-primary outline-none focus:border-border-strong"
                                                            defaultValue={format(new Date(req.endDate), 'yyyy-MM-dd')}
                                                            id={`leave-end-${req.id}`}
                                                        />
                                                    </label>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    onClick={() => handleAction(req.id, 'reject')}
                                                    disabled={!!processingId}
                                                    className="min-h-10 rounded-token-lg border border-status-danger bg-status-danger-subtle px-3 py-2 text-xs font-bold text-fg-danger transition-opacity hover:opacity-90 disabled:opacity-50"
                                                >
                                                    ปฏิเสธ
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (req.type === 'FULL') {
                                                            const startEl = document.getElementById(`leave-start-${req.id}`) as HTMLInputElement;
                                                            const endEl = document.getElementById(`leave-end-${req.id}`) as HTMLInputElement;
                                                            handleAction(req.id, 'approve', {
                                                                startDate: startEl?.value ? new Date(startEl.value) : undefined,
                                                                endDate: endEl?.value ? new Date(endEl.value) : undefined
                                                            });
                                                        } else {
                                                            handleAction(req.id, 'approve');
                                                        }
                                                    }}
                                                    disabled={!!processingId}
                                                    className="inline-flex min-h-10 items-center justify-center gap-1 rounded-token-lg bg-accent px-3 py-2 text-xs font-bold text-accent-fg shadow-token-sm transition-colors hover:bg-accent-hover disabled:opacity-50"
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
                                    )}
                                </article>
                            );
                        })}
                    </div>
                )}

                {totalPages > 1 && (
                    <div className="mt-3 flex items-center justify-center gap-2 pt-1">
                        <button
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
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="rounded-token-lg border border-border-subtle bg-bg-subtle p-2 text-fg-tertiary transition-colors hover:bg-bg-muted hover:text-fg-primary disabled:cursor-not-allowed disabled:opacity-30"
                        >
                            <ChevronRight className="h-5 w-5" />
                        </button>

                        <span className="ml-2 hidden text-xs text-fg-tertiary sm:inline">
                            {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, sourceRequests.length)} จาก {sourceRequests.length}
                        </span>
                    </div>
                )}
            </section>
        </div>
    );
}
