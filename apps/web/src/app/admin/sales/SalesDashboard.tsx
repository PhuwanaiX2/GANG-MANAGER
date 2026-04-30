'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    Banknote,
    Check,
    Clock,
    Loader2,
    RefreshCw,
    Receipt,
    ShieldCheck,
    X,
} from 'lucide-react';
import { toast } from 'sonner';

type PaymentRequest = {
    id: string;
    gangId: string;
    requestRef: string;
    actorName: string;
    actorDiscordId: string;
    tier: 'PREMIUM';
    billingPeriod: 'monthly' | 'yearly';
    amount: number;
    currency: string;
    provider: 'PROMPTPAY_MANUAL' | 'SLIPOK';
    status: 'PENDING' | 'SUBMITTED' | 'VERIFIED' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';
    slipImageUrl: string | null;
    slipTransRef: string | null;
    verificationError: string | null;
    submittedAt: string | null;
    verifiedAt: string | null;
    approvedAt: string | null;
    rejectedAt: string | null;
    reviewNotes: string | null;
    expiresAt: string | null;
    createdAt: string | null;
};

const STATUS_OPTIONS = [
    { value: 'ALL', label: 'ทั้งหมด' },
    { value: 'SUBMITTED', label: 'รอตรวจ' },
    { value: 'VERIFIED', label: 'SlipOK ผ่าน' },
    { value: 'APPROVED', label: 'อนุมัติแล้ว' },
    { value: 'REJECTED', label: 'ปฏิเสธ' },
    { value: 'PENDING', label: 'ยังไม่ส่งสลิป' },
] as const;

const STATUS_STYLES: Record<PaymentRequest['status'], string> = {
    PENDING: 'bg-bg-muted text-fg-secondary border-border-subtle',
    SUBMITTED: 'bg-status-warning-subtle text-fg-warning border-status-warning',
    VERIFIED: 'bg-status-info-subtle text-fg-info border-status-info',
    APPROVED: 'bg-status-success-subtle text-fg-success border-status-success',
    REJECTED: 'bg-status-danger-subtle text-fg-danger border-status-danger',
    EXPIRED: 'bg-bg-muted text-fg-secondary border-border-subtle',
    CANCELLED: 'bg-bg-muted text-fg-secondary border-border-subtle',
};

function formatTHB(amount: number) {
    return `฿${amount.toLocaleString('th-TH')}`;
}

function formatDate(value: string | null) {
    if (!value) return '-';

    return new Date(value).toLocaleString('th-TH', {
        timeZone: 'Asia/Bangkok',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function SalesDashboard() {
    const [payments, setPayments] = useState<PaymentRequest[]>([]);
    const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]['value']>('ALL');
    const [loading, setLoading] = useState(true);
    const [reviewingId, setReviewingId] = useState<string | null>(null);
    const [reviewTarget, setReviewTarget] = useState<{ payment: PaymentRequest; action: 'approve' | 'reject' } | null>(null);
    const [reviewNotes, setReviewNotes] = useState('');
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const query = status === 'ALL' ? '' : `?status=${status}`;
            const res = await fetch(`/api/admin/subscription-payments${query}`);
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.error || `HTTP ${res.status}`);
            }
            setPayments(json.paymentRequests || []);
        } catch (err: any) {
            setError(err.message || 'โหลดข้อมูลยอดขายไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    }, [status]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const stats = useMemo(() => {
        const approved = payments.filter((payment) => payment.status === 'APPROVED');
        const pendingReview = payments.filter((payment) => payment.status === 'SUBMITTED' || payment.status === 'VERIFIED');
        const totalApproved = approved.reduce((sum, payment) => sum + payment.amount, 0);
        const pendingAmount = pendingReview.reduce((sum, payment) => sum + payment.amount, 0);
        const slipOkApproved = approved.filter((payment) => payment.provider === 'SLIPOK').length;

        return {
            totalApproved,
            pendingAmount,
            approvedCount: approved.length,
            pendingReviewCount: pendingReview.length,
            slipOkApproved,
        };
    }, [payments]);

    const openReview = (payment: PaymentRequest, action: 'approve' | 'reject') => {
        setReviewTarget({ payment, action });
        setReviewNotes(action === 'approve' ? 'ตรวจสอบรายการและอนุมัติจากหน้า Admin Sales' : '');
    };

    const closeReview = () => {
        if (reviewingId) return;
        setReviewTarget(null);
        setReviewNotes('');
    };

    const reviewPayment = async () => {
        if (!reviewTarget) return;

        const { payment, action } = reviewTarget;
        const normalizedNotes = reviewNotes.trim();

        if (action === 'reject' && !normalizedNotes) {
            toast.error('ต้องระบุเหตุผลก่อนปฏิเสธ');
            return;
        }

        setReviewingId(payment.id);
        try {
            const res = await fetch('/api/admin/subscription-payments', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    paymentRequestId: payment.id,
                    gangId: payment.gangId,
                    reviewNotes: normalizedNotes || 'ตรวจสอบรายการและอนุมัติจากหน้า Admin Sales',
                }),
            });
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.error || `HTTP ${res.status}`);
            }

            toast.success(action === 'approve' ? 'อนุมัติและเปิดแพลนแล้ว' : 'ปฏิเสธรายการแล้ว');
            setReviewTarget(null);
            setReviewNotes('');
            await fetchData();
        } catch (err: any) {
            toast.error(err.message || 'อัปเดตรายการไม่สำเร็จ');
        } finally {
            setReviewingId(null);
        }
    };

    if (error) {
        return (
            <div className="rounded-token-2xl border border-status-danger bg-status-danger-subtle p-8 text-center shadow-token-sm">
                <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-fg-danger" />
                <h3 className="mb-1 text-sm font-bold text-fg-danger">ไม่สามารถโหลดข้อมูลยอดขายได้</h3>
                <p className="mb-4 text-xs text-fg-secondary">{error}</p>
                <button onClick={fetchData} className="rounded-token-xl border border-status-danger px-4 py-2 text-xs font-bold text-fg-danger hover:bg-status-danger hover:text-fg-inverse">
                    ลองอีกครั้ง
                </button>
            </div>
        );
    }

    return (
        <div data-testid="admin-sales-dashboard" className="space-y-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-token-xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm">
                    <div className="mb-3 flex items-center gap-2">
                        <Banknote className="h-4 w-4 text-fg-success" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-fg-tertiary">รายได้อนุมัติแล้ว</span>
                    </div>
                    <div className="text-xl font-black text-fg-primary">{formatTHB(stats.totalApproved)}</div>
                    <p className="mt-1 text-[10px] text-fg-tertiary">{stats.approvedCount} รายการ</p>
                </div>
                <div className="rounded-token-xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm">
                    <div className="mb-3 flex items-center gap-2">
                        <Clock className="h-4 w-4 text-fg-warning" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-fg-tertiary">รอตรวจ</span>
                    </div>
                    <div className="text-xl font-black text-fg-primary">{formatTHB(stats.pendingAmount)}</div>
                    <p className="mt-1 text-[10px] text-fg-tertiary">{stats.pendingReviewCount} รายการ</p>
                </div>
                <div className="rounded-token-xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm">
                    <div className="mb-3 flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-fg-info" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-fg-tertiary">SlipOK auto</span>
                    </div>
                    <div className="text-xl font-black text-fg-primary">{stats.slipOkApproved}</div>
                    <p className="mt-1 text-[10px] text-fg-tertiary">รายการที่ผ่าน provider</p>
                </div>
                <div className="rounded-token-xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm">
                    <div className="mb-3 flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-accent-bright" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-fg-tertiary">ทั้งหมดในมุมมอง</span>
                    </div>
                    <div className="text-xl font-black text-fg-primary">{payments.length}</div>
                    <p className="mt-1 text-[10px] text-fg-tertiary">คำขอชำระเงิน</p>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <div className="flex overflow-hidden rounded-token-xl border border-border-subtle bg-bg-subtle shadow-token-sm">
                    {STATUS_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => setStatus(option.value)}
                            className={`px-3 py-2 text-xs font-bold transition-colors ${
                                status === option.value
                                    ? 'bg-accent text-accent-fg'
                                    : 'text-fg-tertiary hover:bg-bg-muted hover:text-fg-primary'
                            }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                <button
                    onClick={fetchData}
                    disabled={loading}
                    className="rounded-token-xl border border-border-subtle bg-bg-subtle p-2 text-fg-secondary shadow-token-sm transition-colors hover:bg-bg-muted hover:text-fg-primary disabled:opacity-50"
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div data-testid="admin-sales-payment-table" className="overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle shadow-token-sm">
                <div className="border-b border-border-subtle p-5">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-fg-primary">
                        <Receipt className="h-4 w-4 text-fg-info" />
                        รายการชำระเงิน PromptPay / SlipOK
                    </h3>
                    <p className="mt-1 text-xs text-fg-tertiary">รายการจะเปิดแพลนหลัง SlipOK verify ผ่าน หรือแอดมินอนุมัติเองเท่านั้น</p>
                </div>

                {loading && payments.length === 0 ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-fg-tertiary" />
                    </div>
                ) : payments.length > 0 ? (
                    <>
                    <div className="space-y-3 p-3 md:hidden">
                        {payments.map((payment) => {
                            const canReview = payment.status === 'SUBMITTED' || payment.status === 'VERIFIED';
                            return (
                                <article key={payment.id} className="rounded-token-2xl border border-border-subtle bg-bg-muted p-4 shadow-token-sm">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-lg font-black text-fg-primary">{formatTHB(payment.amount)}</span>
                                                <span className={`rounded-token-sm border px-2 py-1 text-[9px] font-black ${STATUS_STYLES[payment.status]}`}>
                                                    {payment.status}
                                                </span>
                                            </div>
                                            <p className="mt-1 truncate font-mono text-[10px] text-fg-tertiary">{payment.requestRef}</p>
                                            <p className="mt-2 text-sm font-bold text-fg-primary">{payment.actorName}</p>
                                            <p className="font-mono text-[10px] text-fg-tertiary">{payment.actorDiscordId}</p>
                                        </div>
                                        <span className="shrink-0 rounded-token-full border border-border-subtle bg-bg-subtle px-2.5 py-1 text-[10px] font-bold text-fg-secondary">
                                            {payment.provider}
                                        </span>
                                    </div>

                                    <div className="mt-3 grid grid-cols-2 gap-2 rounded-token-xl border border-border-subtle bg-bg-subtle p-3 text-[10px] font-semibold text-fg-tertiary">
                                        <div>
                                            <p className="font-black uppercase tracking-widest">สร้าง</p>
                                            <p className="mt-1 text-fg-secondary">{formatDate(payment.createdAt)}</p>
                                        </div>
                                        <div>
                                            <p className="font-black uppercase tracking-widest">ส่งสลิป</p>
                                            <p className="mt-1 text-fg-secondary">{formatDate(payment.submittedAt)}</p>
                                        </div>
                                    </div>

                                    {payment.verificationError && (
                                        <p className="mt-3 rounded-token-lg border border-status-warning bg-status-warning-subtle px-3 py-2 text-[11px] font-semibold text-fg-warning">
                                            {payment.verificationError}
                                        </p>
                                    )}

                                    <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                                        {payment.slipImageUrl && (
                                            <a
                                                href={payment.slipImageUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex rounded-token-lg border border-border-accent bg-accent-subtle px-3 py-2 text-xs font-bold text-accent-bright"
                                            >
                                                เปิดสลิป
                                            </a>
                                        )}
                                        {canReview ? (
                                            <>
                                                <button
                                                    onClick={() => openReview(payment, 'approve')}
                                                    disabled={reviewingId === payment.id}
                                                    className="inline-flex items-center gap-1 rounded-token-lg border border-status-success bg-status-success-subtle px-3 py-2 text-xs font-bold text-fg-success disabled:opacity-50"
                                                >
                                                    <Check className="h-3.5 w-3.5" />
                                                    อนุมัติ
                                                </button>
                                                <button
                                                    onClick={() => openReview(payment, 'reject')}
                                                    disabled={reviewingId === payment.id}
                                                    className="inline-flex items-center gap-1 rounded-token-lg border border-status-danger bg-status-danger-subtle px-3 py-2 text-xs font-bold text-fg-danger disabled:opacity-50"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                    ปฏิเสธ
                                                </button>
                                            </>
                                        ) : (
                                            <span className="rounded-token-lg border border-border-subtle bg-bg-subtle px-3 py-2 text-[10px] font-bold text-fg-tertiary">
                                                ไม่มี action
                                            </span>
                                        )}
                                    </div>
                                </article>
                            );
                        })}
                    </div>

                    <div className="hidden max-h-[560px] overflow-auto md:block">
                        <table className="min-w-[980px] w-full text-left">
                            <thead className="sticky top-0 z-10 border-b border-border-subtle bg-bg-muted">
                                <tr>
                                    <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">รายการ</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">ผู้ซื้อ</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">Provider</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">เวลา</th>
                                    <th className="px-5 py-3 text-right text-[10px] font-black uppercase tracking-widest text-fg-tertiary">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-subtle">
                                {payments.map((payment) => {
                                    const canReview = payment.status === 'SUBMITTED' || payment.status === 'VERIFIED';
                                    return (
                                        <tr key={payment.id} className="transition-colors hover:bg-bg-muted">
                                            <td className="px-5 py-3">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-sm font-black text-fg-primary">{formatTHB(payment.amount)}</span>
                                                    <span className={`rounded-token-sm border px-1.5 py-0.5 text-[8px] font-black ${STATUS_STYLES[payment.status]}`}>
                                                        {payment.status}
                                                    </span>
                                                    <span className="text-[9px] text-fg-tertiary">{payment.billingPeriod}</span>
                                                </div>
                                                <p className="mt-1 font-mono text-[10px] text-fg-tertiary">{payment.requestRef}</p>
                                                {payment.verificationError && (
                                                    <p className="mt-1 text-[10px] text-fg-warning">{payment.verificationError}</p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="text-xs font-bold text-fg-primary">{payment.actorName}</p>
                                                <p className="font-mono text-[9px] text-fg-tertiary">{payment.actorDiscordId}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="rounded-token-full border border-border-subtle bg-bg-muted px-2 py-1 text-[10px] font-bold text-fg-secondary">
                                                    {payment.provider}
                                                </span>
                                                {payment.slipTransRef && (
                                                    <p className="mt-1 font-mono text-[9px] text-fg-tertiary">{payment.slipTransRef}</p>
                                                )}
                                                {payment.slipImageUrl && (
                                                    <a
                                                        href={payment.slipImageUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="mt-2 inline-flex rounded-token-md border border-border-subtle bg-bg-subtle px-2 py-1 text-[10px] font-bold text-accent-bright hover:border-border-accent"
                                                    >
                                                        เปิดสลิป
                                                    </a>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-[10px] text-fg-tertiary">
                                                <p>สร้าง: {formatDate(payment.createdAt)}</p>
                                                <p>ส่งสลิป: {formatDate(payment.submittedAt)}</p>
                                                <p>อนุมัติ: {formatDate(payment.approvedAt)}</p>
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                {canReview ? (
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => openReview(payment, 'approve')}
                                                            disabled={reviewingId === payment.id}
                                                            className="inline-flex items-center gap-1 rounded-token-lg border border-status-success bg-status-success-subtle px-3 py-2 text-xs font-bold text-fg-success hover:bg-status-success hover:text-fg-inverse disabled:opacity-50"
                                                        >
                                                            <Check className="h-3 w-3" />
                                                            อนุมัติ
                                                        </button>
                                                        <button
                                                            onClick={() => openReview(payment, 'reject')}
                                                            disabled={reviewingId === payment.id}
                                                            className="inline-flex items-center gap-1 rounded-token-lg border border-status-danger bg-status-danger-subtle px-3 py-2 text-xs font-bold text-fg-danger hover:bg-status-danger hover:text-fg-inverse disabled:opacity-50"
                                                        >
                                                            <X className="h-3 w-3" />
                                                            ปฏิเสธ
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-fg-tertiary">ไม่มี action</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    </>
                ) : (
                    <div className="p-12 text-center text-fg-tertiary">
                        <Receipt className="mx-auto mb-2 h-8 w-8 opacity-30" />
                        <p className="text-xs">ยังไม่มีรายการชำระเงินในสถานะนี้</p>
                    </div>
                )}
            </div>

            {reviewTarget && (
                <div data-testid="admin-sales-review-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-bg-overlay p-4 backdrop-blur-sm">
                    <div className="relative w-full max-w-lg overflow-hidden rounded-token-2xl border border-border bg-bg-elevated p-6 shadow-token-lg">
                        <div className={`pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-token-full blur-3xl ${reviewTarget.action === 'approve' ? 'bg-status-success-subtle' : 'bg-status-danger-subtle'}`} />
                        <div className="relative">
                            <div className="mb-4 flex items-start justify-between gap-4">
                                <div>
                                    <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">
                                        Manual payment review
                                    </p>
                                    <h3 className="font-heading text-xl font-black text-fg-primary">
                                        {reviewTarget.action === 'approve' ? 'ยืนยันการอนุมัติแพลน' : 'ปฏิเสธรายการชำระเงิน'}
                                    </h3>
                                </div>
                                <button
                                    onClick={closeReview}
                                    disabled={!!reviewingId}
                                    className="rounded-token-lg border border-border-subtle bg-bg-muted p-2 text-fg-tertiary hover:text-fg-primary disabled:opacity-50"
                                    aria-label="ปิดหน้าต่างตรวจรายการ"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="mb-4 rounded-token-xl border border-border-subtle bg-bg-muted/70 p-4 text-sm">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="font-bold text-fg-primary">{formatTHB(reviewTarget.payment.amount)}</span>
                                    <span className={`rounded-token-sm border px-2 py-1 text-[10px] font-black ${STATUS_STYLES[reviewTarget.payment.status]}`}>
                                        {reviewTarget.payment.status}
                                    </span>
                                </div>
                                <p className="mt-2 font-mono text-[10px] text-fg-tertiary">{reviewTarget.payment.requestRef}</p>
                                <p className="mt-1 text-xs text-fg-secondary">{reviewTarget.payment.actorName} • {reviewTarget.payment.provider}</p>
                                {reviewTarget.payment.slipImageUrl && (
                                    <a
                                        href={reviewTarget.payment.slipImageUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-3 inline-flex rounded-token-lg border border-border-accent bg-accent-subtle px-3 py-2 text-xs font-bold text-accent-bright"
                                    >
                                        เปิดสลิปเพื่อตรวจอีกครั้ง
                                    </a>
                                )}
                            </div>

                            <label className="mb-2 block text-xs font-bold text-fg-secondary">
                                {reviewTarget.action === 'approve' ? 'บันทึกการตรวจสอบ' : 'เหตุผลที่ปฏิเสธ'}
                            </label>
                            <textarea
                                value={reviewNotes}
                                onChange={(event) => setReviewNotes(event.target.value)}
                                rows={4}
                                className="w-full resize-none rounded-token-xl border border-border-subtle bg-bg-base px-4 py-3 text-sm text-fg-primary outline-none transition-colors placeholder:text-fg-tertiary focus:border-border-accent"
                                placeholder={reviewTarget.action === 'approve' ? 'เช่น ตรวจสลิปแล้ว ยอดและผู้รับเงินถูกต้อง' : 'ระบุเหตุผลให้ผู้ดูแลตามต่อได้'}
                            />

                            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                                <button
                                    onClick={closeReview}
                                    disabled={!!reviewingId}
                                    className="rounded-token-xl border border-border-subtle bg-bg-muted px-4 py-2.5 text-sm font-bold text-fg-secondary hover:text-fg-primary disabled:opacity-50"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    onClick={reviewPayment}
                                    disabled={!!reviewingId}
                                    className={`inline-flex items-center justify-center gap-2 rounded-token-xl px-4 py-2.5 text-sm font-black text-fg-inverse disabled:opacity-50 ${reviewTarget.action === 'approve' ? 'bg-status-success' : 'bg-status-danger'}`}
                                >
                                    {reviewingId ? <Loader2 className="h-4 w-4 animate-spin" /> : reviewTarget.action === 'approve' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                                    {reviewTarget.action === 'approve' ? 'อนุมัติและเปิดแพลน' : 'ยืนยันปฏิเสธ'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
