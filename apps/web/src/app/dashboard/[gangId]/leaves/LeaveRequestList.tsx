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
import { TimePickerField } from '@/components/ui';

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

export function LeaveRequestList({ requests, gangId, canReview, currentMemberId, currentMemberName }: Props) {
    const router = useRouter();
    const today = new Date().toISOString().slice(0, 10);
    const [view, setView] = useState<'mine' | 'team'>(canReview ? 'team' : 'mine');
    const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
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
    const filteredRequests = sourceRequests.filter(r => r.status === filter);
    const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedRequests = filteredRequests.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    const hasDraft = creating
        || processingId !== null
        || requestType !== 'FULL'
        || startDate !== today
        || endDate !== today
        || lateDate !== today
        || lateTime !== '20:00'
        || reason.trim().length > 0;

    useAutoRefresh(15, !hasDraft);

    const handleFilterChange = (newFilter: 'PENDING' | 'APPROVED' | 'REJECTED') => {
        setFilter(newFilter);
        setCurrentPage(1);
    };

    const handleViewChange = (newView: 'mine' | 'team') => {
        setView(newView);
        setFilter('PENDING');
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
            setFilter('PENDING');
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
                throw new Error(data?.error || 'Failed to update');
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
        <div className="flex flex-col">
            {currentMemberId && (
                <div className={`${canReview ? 'order-2' : 'order-1'} mb-6 rounded-token-2xl border border-border-subtle bg-bg-subtle p-5 space-y-4 shadow-token-sm`}>
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-bold text-fg-primary flex items-center gap-2">
                                <Plus className="w-4 h-4 text-fg-success" />
                                ส่งคำขอใหม่
                            </h2>
                            <p className="text-sm text-fg-tertiary mt-1">
                                {currentMemberName ? `ส่งคำขอในชื่อ ${currentMemberName}` : 'ส่งคำขอลาหรือแจ้งเข้าช้าจากหน้าเว็บได้ทันที'}
                            </p>
                        </div>
                    </div>

                    <div className="grid w-full grid-cols-2 gap-2 rounded-token-xl border border-border-subtle bg-bg-muted p-1 shadow-inner sm:w-fit">
                        <button
                            onClick={() => setRequestType('FULL')}
                            className={`rounded-token-lg px-4 py-2 text-sm font-medium transition-all ${requestType === 'FULL' ? 'bg-status-danger-subtle text-fg-danger border border-status-danger shadow-token-sm' : 'text-fg-tertiary hover:text-fg-primary hover:bg-bg-subtle'}`}
                        >
                            ลาหยุด
                        </button>
                        <button
                            onClick={() => setRequestType('LATE')}
                            className={`rounded-token-lg px-4 py-2 text-sm font-medium transition-all ${requestType === 'LATE' ? 'bg-status-warning-subtle text-fg-warning border border-status-warning shadow-token-sm' : 'text-fg-tertiary hover:text-fg-primary hover:bg-bg-subtle'}`}
                        >
                            แจ้งเข้าช้า
                        </button>
                    </div>

                    {requestType === 'FULL' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <label className="space-y-2">
                                <span className="text-xs font-medium text-fg-tertiary">วันเริ่มลา</span>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full bg-bg-base border border-border-subtle rounded-token-xl px-3 py-2.5 text-sm text-fg-primary focus:outline-none focus:border-border-strong"
                                />
                            </label>
                            <label className="space-y-2">
                                <span className="text-xs font-medium text-fg-tertiary">วันสิ้นสุด</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full bg-bg-base border border-border-subtle rounded-token-xl px-3 py-2.5 text-sm text-fg-primary focus:outline-none focus:border-border-strong"
                                />
                            </label>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <label className="space-y-2">
                                <span className="text-xs font-medium text-fg-tertiary">วันที่จะเข้าช้า</span>
                                <input
                                    type="date"
                                    value={lateDate}
                                    onChange={(e) => setLateDate(e.target.value)}
                                    className="w-full bg-bg-base border border-border-subtle rounded-token-xl px-3 py-2.5 text-sm text-fg-primary focus:outline-none focus:border-border-strong"
                                />
                            </label>
                            <label className="space-y-2">
                                <span className="text-xs font-medium text-fg-tertiary">คาดว่าจะเข้ากี่โมง</span>
                                <TimePickerField
                                    value={lateTime}
                                    onChange={setLateTime}
                                    label="คาดว่าจะเข้ากี่โมง"
                                    tone="warning"
                                />
                            </label>
                        </div>
                    )}

                    <label className="block space-y-2">
                        <span className="text-xs font-medium text-fg-tertiary">เหตุผล (ไม่บังคับ)</span>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                            maxLength={500}
                            className="w-full bg-bg-base border border-border-subtle rounded-token-xl px-3 py-3 text-sm text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:border-border-strong resize-none"
                            placeholder={requestType === 'FULL' ? 'เช่น ติดธุระ / พักรักษาตัว' : 'เช่น รถติด / ติดงาน / เน็ตมีปัญหา'}
                        />
                    </label>

                    <div className="flex justify-end">
                        <button
                            onClick={handleCreateRequest}
                            disabled={creating}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-token-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg transition-all hover:bg-accent-hover disabled:opacity-50 sm:w-auto"
                        >
                            {creating ? 'กำลังส่ง...' : requestType === 'FULL' ? 'ส่งคำขอลา' : 'ส่งคำขอเข้าช้า'}
                        </button>
                    </div>
                </div>
            )}

            {canReview && (
                <div className="order-1 mb-4 rounded-token-2xl border border-border-subtle bg-bg-subtle p-3 shadow-token-sm">
                    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-fg-tertiary">Review Queue</p>
                            <p className="text-xs text-fg-tertiary">หัวหน้า/แอดมินจะเห็นคำขอทั้งแก๊งเป็นค่าเริ่มต้น</p>
                        </div>
                        <span className="rounded-token-full border border-status-info bg-status-info-subtle px-2.5 py-1 text-[10px] font-bold text-fg-info">
                            รออนุมัติ {requests.filter(r => r.status === 'PENDING').length}
                        </span>
                    </div>
                    <div className="grid w-full grid-cols-2 gap-2 rounded-token-xl border border-border-subtle bg-bg-muted p-1 shadow-inner sm:w-fit">
                    <button
                        onClick={() => handleViewChange('mine')}
                        className={`rounded-token-lg px-4 py-2 text-sm font-medium transition-all ${view === 'mine' ? 'bg-bg-elevated text-fg-primary border border-border shadow-token-sm' : 'text-fg-tertiary hover:text-fg-primary hover:bg-bg-subtle'}`}
                    >
                        คำขอของฉัน
                    </button>
                    <button
                        onClick={() => handleViewChange('team')}
                        className={`rounded-token-lg px-4 py-2 text-sm font-medium transition-all ${view === 'team' ? 'bg-accent text-accent-fg shadow-token-sm' : 'text-fg-tertiary hover:text-fg-primary hover:bg-bg-subtle'}`}
                    >
                        คำขอทั้งแก๊ง
                    </button>
                    </div>
                </div>
            )}

            <div className="order-3 mb-6 flex w-full gap-2 overflow-x-auto rounded-token-xl border border-border-subtle bg-bg-muted p-1 shadow-inner custom-scrollbar sm:w-fit">
                <button
                    onClick={() => handleFilterChange('PENDING')}
                    className={`px-4 py-2 rounded-token-lg text-sm font-medium transition-all whitespace-nowrap ${filter === 'PENDING' ? 'bg-status-info-subtle text-fg-info border border-status-info shadow-token-sm' : 'text-fg-tertiary hover:text-fg-primary hover:bg-bg-subtle'
                        }`}
                >
                    รออนุมัติ ({sourceRequests.filter(r => r.status === 'PENDING').length})
                </button>
                <button
                    onClick={() => handleFilterChange('APPROVED')}
                    className={`px-4 py-2 rounded-token-lg text-sm font-medium transition-all whitespace-nowrap ${filter === 'APPROVED' ? 'bg-status-success-subtle text-fg-success border border-status-success shadow-token-sm' : 'text-fg-tertiary hover:text-fg-primary hover:bg-bg-subtle'
                        }`}
                >
                    อนุมัติแล้ว
                </button>
                <button
                    onClick={() => handleFilterChange('REJECTED')}
                    className={`px-4 py-2 rounded-token-lg text-sm font-medium transition-all whitespace-nowrap ${filter === 'REJECTED' ? 'bg-status-danger-subtle text-fg-danger border border-status-danger shadow-token-sm' : 'text-fg-tertiary hover:text-fg-primary hover:bg-bg-subtle'
                        }`}
                >
                    ปฏิเสธ
                </button>
            </div>

            <div className="space-y-3">
                {filteredRequests.length === 0 ? (
                    <div className="text-center py-12 text-fg-tertiary border border-dashed border-border-subtle bg-bg-subtle rounded-token-2xl">
                        {view === 'team' ? 'ยังไม่มีคำขอในมุมมองนี้' : 'ยังไม่มีคำขอของคุณในสถานะนี้'}
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle shadow-token-sm">
                        <div className="space-y-3 p-3 md:hidden">
                            {paginatedRequests.map((req) => (
                                <article key={req.id} className="rounded-token-2xl border border-border-subtle bg-bg-muted p-4 shadow-token-sm">
                                    <div className="flex items-start gap-3">
                                        <div className={`w-11 h-11 rounded-token-full flex items-center justify-center shrink-0 overflow-hidden border ${req.type === 'FULL' ? 'bg-status-danger-subtle text-fg-danger border-status-danger' : 'bg-status-warning-subtle text-fg-warning border-status-warning'
                                            }`}>
                                            {getAvatarUrl(req.member) ? (
                                                <Image
                                                    src={getAvatarUrl(req.member)}
                                                    alt={req.member?.name || 'Member avatar'}
                                                    width={44}
                                                    height={44}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                req.type === 'FULL' ? <Calendar className="w-5 h-5" /> : <Clock className="w-5 h-5" />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="truncate text-sm font-black text-fg-primary">{req.member?.name || 'Unknown Member'}</p>
                                                <span className={`inline-flex rounded-token-full border px-2 py-0.5 text-[10px] font-black ${req.type === 'FULL'
                                                    ? 'bg-status-danger-subtle text-fg-danger border-status-danger'
                                                    : 'bg-status-warning-subtle text-fg-warning border-status-warning'
                                                    }`}>
                                                    {req.type === 'FULL' ? 'ลาหยุด' : 'เข้าช้า'}
                                                </span>
                                            </div>
                                            <p className="mt-1 text-xs font-semibold text-fg-secondary">
                                                {req.type === 'FULL'
                                                    ? `${format(new Date(req.startDate), 'dd MMM yyyy', { locale: th })} - ${format(new Date(req.endDate), 'dd MMM yyyy', { locale: th })}`
                                                    : `จะเข้า ${format(new Date(req.startDate), 'HH:mm', { locale: th })} น.`}
                                            </p>
                                            <p className="mt-2 line-clamp-2 text-xs text-fg-tertiary">"{req.reason}"</p>
                                            {req.reviewer && (filter === 'APPROVED' || filter === 'REJECTED') && (
                                                <p className="mt-2 text-[11px] font-semibold text-fg-tertiary">
                                                    {filter === 'APPROVED' ? 'อนุมัติโดย' : 'ปฏิเสธโดย'} <span className="text-fg-primary">{req.reviewer.name}</span>
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-3 rounded-token-xl border border-border-subtle bg-bg-subtle p-3 text-[11px] font-semibold text-fg-tertiary">
                                        ส่งเมื่อ {format(new Date(req.requestedAt), 'dd/MM/yy HH:mm', { locale: th })}
                                    </div>

                                    {canReview && view === 'team' && filter === 'PENDING' ? (
                                        <div className="mt-3 space-y-3">
                                            {req.type === 'FULL' && (
                                                <div className="grid grid-cols-2 gap-2">
                                                    <label className="space-y-1">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-fg-tertiary">Start</span>
                                                        <input
                                                            type="date"
                                                            className="w-full rounded-token-lg border border-border-subtle bg-bg-base px-2 py-2 text-xs text-fg-primary outline-none focus:border-border-strong"
                                                            defaultValue={format(new Date(req.startDate), 'yyyy-MM-dd')}
                                                            id={`m-start-${req.id}`}
                                                        />
                                                    </label>
                                                    <label className="space-y-1">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-fg-tertiary">End</span>
                                                        <input
                                                            type="date"
                                                            className="w-full rounded-token-lg border border-border-subtle bg-bg-base px-2 py-2 text-xs text-fg-primary outline-none focus:border-border-strong"
                                                            defaultValue={format(new Date(req.endDate), 'yyyy-MM-dd')}
                                                            id={`m-end-${req.id}`}
                                                        />
                                                    </label>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    onClick={() => handleAction(req.id, 'reject')}
                                                    disabled={!!processingId}
                                                    className="rounded-token-xl border border-status-danger bg-status-danger-subtle px-3 py-2.5 text-xs font-bold text-fg-danger transition-[filter] hover:brightness-110 disabled:opacity-50"
                                                >
                                                    ปฏิเสธ
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (req.type === 'FULL') {
                                                            const startEl = document.getElementById(`m-start-${req.id}`) as HTMLInputElement;
                                                            const endEl = document.getElementById(`m-end-${req.id}`) as HTMLInputElement;
                                                            handleAction(req.id, 'approve', {
                                                                startDate: startEl?.value ? new Date(startEl.value) : undefined,
                                                                endDate: endEl?.value ? new Date(endEl.value) : undefined
                                                            });
                                                        } else {
                                                            handleAction(req.id, 'approve');
                                                        }
                                                    }}
                                                    disabled={!!processingId}
                                                    className="inline-flex items-center justify-center gap-1 rounded-token-xl bg-accent px-3 py-2.5 text-xs font-bold text-accent-fg shadow-token-sm transition-all hover:bg-accent-hover disabled:opacity-50"
                                                >
                                                    {processingId === req.id ? (
                                                        <div className="w-3 h-3 border-2 border-accent-fg/30 border-t-accent-fg rounded-token-full animate-spin" />
                                                    ) : (
                                                        <>
                                                            <Check className="w-3 h-3" />
                                                            อนุมัติ
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className={`mt-3 inline-flex rounded-token-md border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${filter === 'APPROVED' ? 'bg-status-success-subtle text-fg-success border-status-success' :
                                            filter === 'REJECTED' ? 'bg-status-danger-subtle text-fg-danger border-status-danger' :
                                                'bg-status-info-subtle text-fg-info border-status-info'
                                            }`}>
                                            {filter === 'APPROVED' ? 'อนุมัติแล้ว' : filter === 'REJECTED' ? 'ปฏิเสธ' : 'รออนุมัติ'}
                                        </div>
                                    )}
                                </article>
                            ))}
                        </div>

                        <div className="hidden overflow-x-auto md:block">
                            <table className="min-w-[1100px] w-full text-left">
                                <thead className="bg-bg-muted border-b border-border-subtle">
                                    <tr>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">ผู้ขอ</th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">ประเภท / เวลา</th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">เหตุผล / ผู้พิจารณา</th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary whitespace-nowrap">ส่งเมื่อ</th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-right">ดำเนินการ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-subtle">
                                    {paginatedRequests.map((req) => (
                                        <tr key={req.id} className="hover:bg-bg-muted transition-colors">
                                            <td className="px-4 py-3 align-middle">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-token-full flex items-center justify-center shrink-0 overflow-hidden border ${req.type === 'FULL' ? 'bg-status-danger-subtle text-fg-danger border-status-danger' : 'bg-status-warning-subtle text-fg-warning border-status-warning'
                                                        }`}>
                                                        {getAvatarUrl(req.member) ? (
                                                            <Image
                                                                src={getAvatarUrl(req.member)}
                                                                alt={req.member?.name || 'Member avatar'}
                                                                width={40}
                                                                height={40}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            req.type === 'FULL' ? <Calendar className="w-5 h-5" /> : <Clock className="w-5 h-5" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-fg-primary truncate">{req.member?.name || 'Unknown Member'}</p>
                                                        <span className={`mt-1 inline-flex text-[10px] px-2 py-0.5 rounded-token-full border font-bold tracking-wide ${req.type === 'FULL'
                                                            ? 'bg-status-danger-subtle text-fg-danger border-status-danger'
                                                            : 'bg-status-warning-subtle text-fg-warning border-status-warning'
                                                            }`}>
                                                            {req.type === 'FULL' ? 'ลาหยุด' : 'เข้าช้า'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 align-middle">
                                                <div className="text-sm text-fg-secondary font-medium">
                                                    {req.type === 'FULL' ? (
                                                        <span>{format(new Date(req.startDate), 'dd MMM yyyy', { locale: th })} - {format(new Date(req.endDate), 'dd MMM yyyy', { locale: th })}</span>
                                                    ) : (
                                                        <span>จะเข้า {format(new Date(req.startDate), 'HH:mm', { locale: th })} น.</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 align-middle">
                                                <div className="max-w-sm">
                                                    <p className="text-sm text-fg-secondary truncate">"{req.reason}"</p>
                                                    {req.reviewer && (filter === 'APPROVED' || filter === 'REJECTED') && (
                                                        <div className="mt-1.5 flex items-center gap-2">
                                                            <span className="text-[10px] text-fg-tertiary">
                                                                {filter === 'APPROVED' ? 'อนุมัติโดย' : 'ปฏิเสธโดย'}:
                                                            </span>
                                                            <span className="text-[10px] text-fg-primary bg-bg-muted border border-border-subtle px-2 py-0.5 rounded-token-full">
                                                                {req.reviewer.name}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 align-middle whitespace-nowrap">
                                                <span className="text-xs text-fg-tertiary">
                                                    {format(new Date(req.requestedAt), 'dd/MM/yy HH:mm', { locale: th })}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 align-middle">
                                                <div className="flex justify-end gap-2 items-end">
                                                    {canReview && view === 'team' && filter === 'PENDING' ? (
                                                        <>
                                                            {req.type === 'FULL' && (
                                                                <>
                                                                    <div className="flex flex-col gap-1">
                                                                        <span className="text-[10px] text-fg-tertiary uppercase tracking-wider">Start</span>
                                                                        <input
                                                                            type="date"
                                                                            className="bg-bg-base border border-border-subtle rounded-token-sm px-2 py-1 text-xs text-fg-primary focus:outline-none focus:border-border-strong"
                                                                            defaultValue={format(new Date(req.startDate), 'yyyy-MM-dd')}
                                                                            id={`start-${req.id}`}
                                                                        />
                                                                    </div>
                                                                    <div className="flex flex-col gap-1">
                                                                        <span className="text-[10px] text-fg-tertiary uppercase tracking-wider">End</span>
                                                                        <input
                                                                            type="date"
                                                                            className="bg-bg-base border border-border-subtle rounded-token-sm px-2 py-1 text-xs text-fg-primary focus:outline-none focus:border-border-strong"
                                                                            defaultValue={format(new Date(req.endDate), 'yyyy-MM-dd')}
                                                                            id={`end-${req.id}`}
                                                                        />
                                                                    </div>
                                                                </>
                                                            )}

                                                            <button
                                                                onClick={() => handleAction(req.id, 'reject')}
                                                                disabled={!!processingId}
                                                                className="px-3 py-2 bg-status-danger-subtle hover:brightness-110 text-fg-danger border border-status-danger rounded-token-lg text-xs font-medium transition-[filter] disabled:opacity-50"
                                                            >
                                                                ปฏิเสธ
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    if (req.type === 'FULL') {
                                                                        const startEl = document.getElementById(`start-${req.id}`) as HTMLInputElement;
                                                                        const endEl = document.getElementById(`end-${req.id}`) as HTMLInputElement;
                                                                        handleAction(req.id, 'approve', {
                                                                            startDate: startEl?.value ? new Date(startEl.value) : undefined,
                                                                            endDate: endEl?.value ? new Date(endEl.value) : undefined
                                                                        });
                                                                    } else {
                                                                        handleAction(req.id, 'approve');
                                                                    }
                                                                }}
                                                                disabled={!!processingId}
                                                                className="flex items-center gap-1 px-4 py-2 bg-accent hover:bg-accent-hover text-accent-fg rounded-token-lg text-xs font-medium shadow-token-sm transition-all disabled:opacity-50"
                                                            >
                                                                {processingId === req.id ? (
                                                                    <div className="w-3 h-3 border-2 border-accent-fg/30 border-t-accent-fg rounded-token-full animate-spin" />
                                                                ) : (
                                                                    <>
                                                                        <Check className="w-3 h-3" />
                                                                        อนุมัติ
                                                                    </>
                                                                )}
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <span className={`inline-flex px-2.5 py-1 rounded-token-md border text-[10px] font-bold uppercase tracking-widest ${filter === 'APPROVED' ? 'bg-status-success-subtle text-fg-success border-status-success' :
                                                            filter === 'REJECTED' ? 'bg-status-danger-subtle text-fg-danger border-status-danger' :
                                                                'bg-status-info-subtle text-fg-info border-status-info'
                                                            }`}>
                                                            {filter === 'APPROVED' ? 'อนุมัติแล้ว' : filter === 'REJECTED' ? 'ปฏิเสธ' : 'รออนุมัติ'}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                    <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="p-2 rounded-token-lg bg-bg-subtle border border-border-subtle text-fg-tertiary hover:text-fg-primary hover:bg-bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
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
                                    className={`w-10 h-10 rounded-token-lg text-sm font-medium transition-colors ${page === currentPage
                                        ? 'bg-accent text-accent-fg shadow-token-sm'
                                        : 'bg-bg-subtle border border-border-subtle text-fg-tertiary hover:text-fg-primary hover:bg-bg-muted'
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
                        className="p-2 rounded-token-lg bg-bg-subtle border border-border-subtle text-fg-tertiary hover:text-fg-primary hover:bg-bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>

                    <span className="text-xs text-fg-tertiary ml-2">
                        {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, filteredRequests.length)} จาก {filteredRequests.length}
                    </span>
                </div>
            )}
        </div>
    );
}
