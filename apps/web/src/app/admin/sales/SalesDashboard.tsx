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

    const reviewPayment = async (payment: PaymentRequest, action: 'approve' | 'reject') => {
        const reviewNotes = action === 'approve'
            ? 'Manual approval from admin sales dashboard'
            : window.prompt('เหตุผลที่ปฏิเสธรายการนี้')?.trim();

        if (action === 'reject' && !reviewNotes) {
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
                    reviewNotes,
                }),
            });
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.error || `HTTP ${res.status}`);
            }

            toast.success(action === 'approve' ? 'อนุมัติและเปิดแพลนแล้ว' : 'ปฏิเสธรายการแล้ว');
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
        <div className="space-y-6">
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

            <div className="overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle shadow-token-sm">
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
                    <div className="max-h-[560px] overflow-auto">
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
                                                            onClick={() => reviewPayment(payment, 'approve')}
                                                            disabled={reviewingId === payment.id}
                                                            className="inline-flex items-center gap-1 rounded-token-lg border border-status-success bg-status-success-subtle px-3 py-2 text-xs font-bold text-fg-success hover:bg-status-success hover:text-fg-inverse disabled:opacity-50"
                                                        >
                                                            {reviewingId === payment.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                                            อนุมัติ
                                                        </button>
                                                        <button
                                                            onClick={() => reviewPayment(payment, 'reject')}
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
                ) : (
                    <div className="p-12 text-center text-fg-tertiary">
                        <Receipt className="mx-auto mb-2 h-8 w-8 opacity-30" />
                        <p className="text-xs">ยังไม่มีรายการชำระเงินในสถานะนี้</p>
                    </div>
                )}
            </div>
        </div>
    );
}
