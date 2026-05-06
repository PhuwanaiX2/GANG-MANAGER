'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Crown, Gem, Loader2, Check, ArrowRight, Clock, RefreshCw, AlertTriangle, CreditCard, Calendar, Copy, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { BILLING_PLANS, BILLING_PLAN_MAP, type BillingPlanId } from '@/lib/billingPlans';
import { getSubscriptionTierLabel, normalizeSubscriptionTierValue } from '@/lib/subscriptionTier';
import { PAYMENT_PAUSED_COPY } from '@/lib/paymentReadiness';

interface Props {
    gangId: string;
    currentTier: string;
    expiresAt: Date | null;
    memberCount: number;
    maxMembers: number;
    promptPayBillingEnabled?: boolean;
}

type PaymentStatus = 'PENDING' | 'SUBMITTED' | 'VERIFIED' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';

type PaymentRequestView = {
    id: string;
    requestRef: string;
    tier: 'PREMIUM';
    billingPeriod: 'monthly' | 'yearly';
    amount: number;
    currency: string;
    provider?: 'PROMPTPAY_MANUAL' | 'SLIPOK';
    status: PaymentStatus;
    slipImageUrl?: string | null;
    verificationError?: string | null;
    submittedAt?: string | null;
    verifiedAt?: string | null;
    approvedAt?: string | null;
    rejectedAt?: string | null;
    reviewNotes?: string | null;
    expiresAt: string | null;
    createdAt?: string | null;
};

type PromptPayReceiverView = {
    receiverName: string;
    identifier: string;
    qrPayload?: string;
    qrDataUrl?: string;
    instructions: string;
};

const PAYMENT_STATUS_COPY: Record<PaymentStatus, { label: string; helper: string; tone: string }> = {
    PENDING: {
        label: 'รอโอนเงิน',
        helper: 'สร้างรายการแล้ว แต่ยังไม่ได้ส่งสลิปเข้าระบบ',
        tone: 'border-status-warning bg-status-warning-subtle text-fg-warning',
    },
    SUBMITTED: {
        label: 'ส่งสลิปแล้ว',
        helper: 'ได้รับสลิปแล้ว ระบบกำลังตรวจสอบและจะอัปเดตสถานะให้',
        tone: 'border-status-info bg-status-info-subtle text-fg-info',
    },
    VERIFIED: {
        label: 'ตรวจเบื้องต้นผ่าน',
        helper: 'สลิปผ่านการตรวจเบื้องต้นแล้ว รอแอดมินยืนยันขั้นสุดท้าย',
        tone: 'border-status-info bg-status-info-subtle text-fg-info',
    },
    APPROVED: {
        label: 'อนุมัติแล้ว',
        helper: 'เปิดใช้งานแพลนให้แก๊งนี้แล้ว',
        tone: 'border-status-success bg-status-success-subtle text-fg-success',
    },
    REJECTED: {
        label: 'ไม่ผ่าน',
        helper: 'รายการถูกปฏิเสธ ดูเหตุผลแล้วสร้างรายการใหม่ได้',
        tone: 'border-status-danger bg-status-danger-subtle text-fg-danger',
    },
    EXPIRED: {
        label: 'หมดเวลา',
        helper: 'รายการนี้หมดอายุแล้ว สร้างรายการใหม่เพื่อชำระเงินอีกครั้ง',
        tone: 'border-border-subtle bg-bg-muted text-fg-secondary',
    },
    CANCELLED: {
        label: 'ยกเลิก',
        helper: 'รายการนี้ถูกยกเลิกแล้ว',
        tone: 'border-border-subtle bg-bg-muted text-fg-secondary',
    },
};

const ACTIVE_PAYMENT_STATUSES: PaymentStatus[] = ['PENDING', 'SUBMITTED', 'VERIFIED'];

function formatPaymentDate(value?: string | null) {
    if (!value) return '-';

    return new Date(value).toLocaleString('th-TH', {
        timeZone: 'Asia/Bangkok',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function SubscriptionClient({ gangId, currentTier, expiresAt, memberCount, maxMembers, promptPayBillingEnabled }: Props) {
    const [loading, setLoading] = useState<string | null>(null);
    const [slipLoading, setSlipLoading] = useState(false);
    const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
    const [paymentRequest, setPaymentRequest] = useState<PaymentRequestView | null>(null);
    const [paymentRequests, setPaymentRequests] = useState<PaymentRequestView[]>([]);
    const [requestsLoading, setRequestsLoading] = useState(true);
    const [promptPay, setPromptPay] = useState<PromptPayReceiverView | null>(null);
    const [slipPayload, setSlipPayload] = useState('');
    const [slipImageUrl, setSlipImageUrl] = useState('');
    const searchParams = useSearchParams();

    const normalizedCurrentTier = useMemo(() => normalizeSubscriptionTierValue(currentTier), [currentTier]);
    const effectivePlanId = useMemo<BillingPlanId>(() => normalizedCurrentTier === 'FREE' ? 'FREE' : 'PREMIUM', [normalizedCurrentTier]);
    const currentPlan = useMemo(() => BILLING_PLAN_MAP[effectivePlanId], [effectivePlanId]);
    const currentTierLabel = useMemo(() => (
        normalizedCurrentTier === 'TRIAL'
            ? 'Trial'
            : getSubscriptionTierLabel(normalizedCurrentTier)
    ), [normalizedCurrentTier]);

    const currentRank = currentPlan.rank;
    const isPaid = normalizedCurrentTier !== 'FREE';
    const isTrial = normalizedCurrentTier === 'TRIAL';
    const paymentPaused = promptPayBillingEnabled !== true;

    const copyPaymentText = async (label: string, text?: string) => {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            toast.success(`คัดลอก${label}แล้ว`);
        } catch {
            toast.error(`คัดลอก${label}ไม่สำเร็จ`);
        }
    };

    const rememberPaymentRequest = useCallback((nextPayment: PaymentRequestView) => {
        setPaymentRequest(nextPayment);
        setPaymentRequests((current) => [
            nextPayment,
            ...current.filter((payment) => payment.id !== nextPayment.id),
        ]);
    }, []);

    const refreshPaymentRequests = useCallback(async (silent = true) => {
        setRequestsLoading(true);
        try {
            const res = await fetch(`/api/gangs/${gangId}/subscription/payment-requests`);
            const json = await res.json();

            if (!res.ok) {
                throw new Error(json.error || `HTTP ${res.status}`);
            }

            const requests: PaymentRequestView[] = json.paymentRequests || [];
            setPaymentRequests(requests);

            const activeRequest = requests.find((request) => ACTIVE_PAYMENT_STATUSES.includes(request.status));
            if (activeRequest) {
                setPaymentRequest((current) => current ?? activeRequest);
                if (json.promptPay) {
                    setPromptPay((current) => current ?? json.promptPay);
                }
            }
        } catch (error: any) {
            if (!silent) {
                toast.error('โหลดสถานะการชำระเงินไม่สำเร็จ');
            }
        } finally {
            setRequestsLoading(false);
        }
    }, [gangId]);

    const handleCheckout = async (tier: BillingPlanId) => {
        if (tier === 'FREE') return;
        if (paymentPaused) {
            toast.error(PAYMENT_PAUSED_COPY.shortLabel, {
                description: PAYMENT_PAUSED_COPY.bannerBody,
            });
            return;
        }

        setLoading(tier);
        try {
            const res = await fetch(`/api/gangs/${gangId}/subscription/payment-requests`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tier, billingPeriod: billing }),
            });

            if (!res.ok) {
                const err = await res.json();
                toast.error(err.error || 'เกิดข้อผิดพลาด');
                return;
            }

            const json = await res.json();
            rememberPaymentRequest(json.paymentRequest);
            setPromptPay(json.promptPay);
            toast.success('สร้างรายการชำระเงินแล้ว', {
                description: 'โอนตามยอดที่แสดง แล้วส่งข้อมูลสลิปเพื่อตรวจสอบ',
            });
        } catch {
            toast.error('ไม่สามารถเชื่อมต่อระบบชำระเงินได้');
        } finally {
            setLoading(null);
        }
    };

    const handleSubmitSlip = async () => {
        if (!paymentRequest) return;

        const payload = slipPayload.trim();
        const imageUrl = slipImageUrl.trim();
        if ((payload && imageUrl) || (!payload && !imageUrl)) {
            toast.error('กรุณาใส่อย่างใดอย่างหนึ่ง: ข้อมูลจากสลิป หรือ URL รูปสลิป');
            return;
        }

        setSlipLoading(true);
        try {
            const res = await fetch(`/api/gangs/${gangId}/subscription/payment-requests/${paymentRequest.id}/slip`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload ? { payload } : { imageUrl }),
            });
            const json = await res.json();

            if (!res.ok) {
                if (json.rejected) {
                    toast.error('สลิปไม่ผ่านการตรวจสอบ', {
                        description: 'รายการนี้ถูกปิดแล้ว กรุณาสร้างรายการใหม่ หากคิดว่าระบบผิดพลาดให้ติดต่อซัพพอร์ตพร้อมหลักฐาน',
                    });
                    if (json.paymentRequest) rememberPaymentRequest(json.paymentRequest);
                    setSlipPayload('');
                    setSlipImageUrl('');
                    return;
                }

                toast.error(json.error || 'ตรวจสลิปไม่ผ่าน', {
                    description: json.manualReviewRequired ? 'ระบบตรวจอัตโนมัติยังไม่พร้อม รายการนี้ถูกส่งให้แอดมินตรวจสอบแล้ว' : undefined,
                });
                if (json.paymentRequest) rememberPaymentRequest(json.paymentRequest);
                return;
            }

            if (json.activated) {
                toast.success('เปิดใช้งาน Premium สำเร็จ', {
                    description: `วันใช้งานรวม ${json.durationDays} วัน`,
                });
                window.location.reload();
                return;
            }

            toast.info('ส่งสลิปแล้ว รอแอดมินตรวจสอบ', {
                description: 'ระบบยังไม่เปิดแพลนจนกว่ารายการนี้จะถูกอนุมัติ',
            });
            if (json.paymentRequest) rememberPaymentRequest(json.paymentRequest);
            setSlipPayload('');
            setSlipImageUrl('');
        } catch {
            toast.error('ส่งสลิปไม่สำเร็จ กรุณาลองอีกครั้ง');
        } finally {
            setSlipLoading(false);
        }
    };

    const expiryInfo = useMemo(() => {
        if (!expiresAt) return null;
        const exp = new Date(expiresAt);
        const now = new Date();
        const diffMs = exp.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        const isExpired = diffDays <= 0;
        const isExpiringSoon = diffDays > 0 && diffDays <= 7;
        return { date: exp, diffDays, isExpired, isExpiringSoon };
    }, [expiresAt]);

    useEffect(() => {
        const sub = searchParams.get('subscription');
        if (sub === 'success') {
            toast.success('ชำระเงินสำเร็จ!', {
                description: 'แพลนจะอัปเดตภายในไม่กี่วินาที กรุณารอสักครู่...',
                duration: 6000,
            });
            window.history.replaceState({}, '', window.location.pathname);
        } else if (sub === 'cancelled') {
            toast.info('ยกเลิกการชำระเงิน', {
                description: 'คุณสามารถสมัครใหม่ได้ตลอดเวลา',
            });
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [searchParams]);

    useEffect(() => {
        refreshPaymentRequests(true);
    }, [refreshPaymentRequests]);

    const activePaymentRequest = paymentRequest && ACTIVE_PAYMENT_STATUSES.includes(paymentRequest.status)
        ? paymentRequest
        : paymentRequests.find((request) => ACTIVE_PAYMENT_STATUSES.includes(request.status)) ?? null;
    const activePaymentStatus = activePaymentRequest ? PAYMENT_STATUS_COPY[activePaymentRequest.status] : null;
    const canSubmitSlip = Boolean(activePaymentRequest && promptPay && activePaymentRequest.status === 'PENDING');
    const recentPaymentRequests = paymentRequests.slice(0, 5);
    const premiumPlan = BILLING_PLAN_MAP.PREMIUM;
    const selectedPrice = billing === 'monthly' ? premiumPlan.priceMonthly : premiumPlan.priceYearly;
    const selectedDurationDays = billing === 'monthly' ? 30 : 365;
    const memberUsagePercent = Math.min(Math.round((memberCount / maxMembers) * 100), 100);
    const planHealthCopy = expiryInfo
        ? expiryInfo.isExpired
            ? 'หมดอายุแล้ว'
            : `เหลือ ${expiryInfo.diffDays} วัน`
        : isPaid
            ? 'ใช้งานถาวร'
            : 'แพลนเริ่มต้น';
    const planHealthTone = expiryInfo?.isExpired
        ? 'border-status-danger bg-status-danger-subtle text-fg-danger'
        : expiryInfo?.isExpiringSoon
            ? 'border-status-warning bg-status-warning-subtle text-fg-warning'
            : 'border-status-success bg-status-success-subtle text-fg-success';
    const paymentSteps = activePaymentRequest
        ? [
            { label: 'สร้างรายการ', active: true, value: formatPaymentDate(activePaymentRequest.createdAt) },
            { label: 'ส่งสลิป', active: activePaymentRequest.status !== 'PENDING', value: formatPaymentDate(activePaymentRequest.submittedAt) },
            { label: 'ตรวจ/อนุมัติ', active: ['VERIFIED', 'APPROVED', 'REJECTED'].includes(activePaymentRequest.status), value: formatPaymentDate(activePaymentRequest.approvedAt || activePaymentRequest.rejectedAt || activePaymentRequest.verifiedAt) },
        ]
        : [];

    return (
        <div data-testid="subscription-settings-panel" className="mx-auto w-full max-w-6xl space-y-5">
            {paymentPaused && (
                <div className="rounded-token-2xl border border-status-warning bg-status-warning-subtle p-4">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-fg-warning" />
                        <div>
                            <p className="text-sm font-bold text-fg-warning">{PAYMENT_PAUSED_COPY.bannerTitle}</p>
                            <p className="mt-1 text-sm text-fg-secondary">
                                {PAYMENT_PAUSED_COPY.bannerBody}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="overflow-hidden rounded-token-3xl border border-border-subtle bg-bg-subtle shadow-token-sm">
                    <div className="border-b border-border-subtle p-5">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-2 rounded-token-full border border-border-subtle bg-bg-base px-3 py-1 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">
                                <Crown className="h-3.5 w-3.5" />
                                สถานะแพลน
                            </span>
                            <span className={`rounded-token-full border px-3 py-1 text-[10px] font-black ${planHealthTone}`}>
                                {planHealthCopy}
                            </span>
                        </div>
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <h3 className="font-heading text-3xl font-black text-fg-primary">{currentTierLabel}</h3>
                                <p className="mt-1 text-sm text-fg-secondary">
                                    ใช้งานอยู่ตอนนี้ ไม่มีการตัดเงินอัตโนมัติ
                                </p>
                            </div>
                            <div className="rounded-token-2xl border border-border-subtle bg-bg-base px-4 py-3 text-right">
                                <p className="text-[10px] font-black uppercase tracking-widest text-fg-tertiary">สมาชิก</p>
                                <p className="mt-1 text-xl font-black text-fg-primary">{memberCount}/{maxMembers}</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-5">
                        <div className="mb-3 flex items-center justify-between text-xs font-bold text-fg-tertiary">
                            <span>การใช้งานสมาชิก</span>
                            <span>{memberUsagePercent}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-token-full bg-bg-muted">
                            <div
                                className={`h-full rounded-token-full transition-all ${memberUsagePercent > 80 ? 'bg-status-danger' : 'bg-status-success'}`}
                                style={{ width: `${memberUsagePercent}%` }}
                            />
                        </div>
                        {expiryInfo && !expiryInfo.isExpired && (
                            <p className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-fg-success">
                                <Clock className="h-4 w-4" />
                                หมดอายุ {expiryInfo.date.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'long', year: 'numeric' })}
                            </p>
                        )}
                        {isTrial && expiryInfo && !expiryInfo.isExpired && (
                            <p className="mt-3 rounded-token-xl border border-border-accent bg-accent-subtle px-3 py-2 text-xs font-bold text-accent-bright">
                                Trial ใช้งาน Premium เต็มระบบอยู่ ตอนหมดอายุจะกลับเป็น Free
                            </p>
                        )}
                    </div>
                </div>

                <div className="rounded-token-3xl border border-border-subtle bg-bg-subtle p-5 shadow-token-sm">
                    <div className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-fg-success" />
                        <h3 className="font-heading text-xl font-black text-fg-primary">ต่ออายุ Premium</h3>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-fg-secondary">
                        เลือกรอบชำระเงิน แล้วระบบจะสร้าง QR PromptPay ให้โอนและส่งสลิปในขั้นตอนถัดไป
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-2 rounded-token-2xl border border-border-subtle bg-bg-base p-1">
                        <button
                            type="button"
                            onClick={() => setBilling('monthly')}
                            className={`rounded-token-xl px-3 py-2 text-sm font-black transition ${billing === 'monthly' ? 'bg-status-success text-fg-inverse shadow-token-sm' : 'text-fg-secondary hover:text-fg-primary'}`}
                        >
                            30 วัน
                        </button>
                        <button
                            type="button"
                            onClick={() => setBilling('yearly')}
                            className={`rounded-token-xl px-3 py-2 text-sm font-black transition ${billing === 'yearly' ? 'bg-status-success text-fg-inverse shadow-token-sm' : 'text-fg-secondary hover:text-fg-primary'}`}
                        >
                            365 วัน
                        </button>
                    </div>

                    <div className="mt-4 rounded-token-2xl border border-border-subtle bg-bg-base p-4">
                        <div className="flex items-end justify-between gap-3">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-fg-tertiary">ยอดที่ต้องชำระ</p>
                                <p className="mt-1 text-3xl font-black text-fg-primary">฿{selectedPrice.toLocaleString('th-TH')}</p>
                            </div>
                            <span className="rounded-token-full border border-status-success bg-status-success-subtle px-3 py-1 text-xs font-black text-fg-success">
                                +{selectedDurationDays} วัน
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={() => handleCheckout('PREMIUM')}
                        disabled={!!loading || paymentPaused}
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-token-2xl bg-status-success px-5 py-3 text-sm font-black text-fg-inverse shadow-token-sm transition hover:brightness-110 disabled:opacity-50"
                    >
                        {loading === 'PREMIUM' ? <Loader2 className="h-4 w-4 animate-spin" /> : activePaymentRequest ? <RefreshCw className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                        {paymentPaused ? PAYMENT_PAUSED_COPY.actionLabel : loading === 'PREMIUM' ? 'กำลังสร้างรายการ...' : activePaymentRequest ? 'สร้างรายการใหม่' : 'สร้าง QR ชำระเงิน'}
                    </button>
                    {activePaymentRequest && (
                        <p className="mt-3 text-xs leading-5 text-fg-tertiary">
                            มีรายการเดิมอยู่ด้านล่าง ถ้าส่งสลิปแล้วไม่ต้องสร้างซ้ำ ให้รอสถานะหรือกดรีเฟรช
                        </p>
                    )}
                </div>
            </section>

            {activePaymentRequest && promptPay && activePaymentStatus && (
                <section data-testid="subscription-payment-status-card" className="overflow-hidden rounded-token-3xl border border-border-subtle bg-bg-subtle shadow-token-md">
                    <div className="border-b border-border-subtle bg-bg-base p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                                <div className="mb-3 flex flex-wrap items-center gap-2">
                                    <span className="rounded-token-full border border-border-subtle bg-bg-subtle px-3 py-1 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">
                                        รายการที่ต้องทำต่อ
                                    </span>
                                    <span className={`rounded-token-full border px-3 py-1 text-[10px] font-black ${activePaymentStatus.tone}`}>
                                        {activePaymentStatus.label}
                                    </span>
                                </div>
                                <h3 className="font-heading text-3xl font-black text-fg-primary">
                                    ฿{activePaymentRequest.amount.toLocaleString('th-TH')}
                                    <span className="ml-2 text-sm font-bold text-fg-secondary">
                                        {activePaymentRequest.billingPeriod === 'yearly' ? 'รายปี' : 'รายเดือน'}
                                    </span>
                                </h3>
                                <p className="mt-2 text-sm text-fg-secondary">{activePaymentStatus.helper}</p>
                                <p className="mt-2 break-all font-mono text-xs text-fg-tertiary">
                                    เลขอ้างอิง: {activePaymentRequest.requestRef}
                                </p>
                                {activePaymentRequest.verificationError && (
                                    <p className="mt-3 rounded-token-xl border border-status-warning bg-status-warning-subtle px-3 py-2 text-xs font-bold text-fg-warning">
                                        ผลตรวจเบื้องต้น: {activePaymentRequest.verificationError}
                                    </p>
                                )}
                            </div>

                            <div className="grid min-w-[260px] gap-2 rounded-token-2xl border border-border-subtle bg-bg-subtle p-3 text-xs">
                                {paymentSteps.map((step, index) => (
                                    <div key={step.label} className="flex items-center gap-3">
                                        <span className={`flex h-7 w-7 items-center justify-center rounded-token-full border text-[10px] font-black ${step.active ? 'border-status-success bg-status-success text-fg-inverse' : 'border-border-subtle bg-bg-muted text-fg-tertiary'}`}>
                                            {step.active ? <Check className="h-3.5 w-3.5" /> : index + 1}
                                        </span>
                                        <div>
                                            <p className="font-bold text-fg-primary">{step.label}</p>
                                            <p className="text-[10px] text-fg-tertiary">{step.value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-0 lg:grid-cols-[320px_1fr]">
                        <div className="border-b border-border-subtle bg-status-success-subtle p-5 lg:border-b-0 lg:border-r">
                            {promptPay!.qrDataUrl ? (
                                <img
                                    src={promptPay!.qrDataUrl}
                                    alt={`PromptPay QR for ${activePaymentRequest.requestRef}`}
                                    className="mx-auto h-56 w-56 rounded-token-2xl bg-white p-3 shadow-token-sm"
                                />
                            ) : null}
                            <div className="mt-4 space-y-2 text-center text-xs text-fg-secondary">
                                <p className="font-bold text-fg-primary">{promptPay.receiverName}</p>
                                <p>PromptPay: <span className="font-mono font-black">{promptPay.identifier}</span></p>
                                <div className="flex justify-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => copyPaymentText('เบอร์พร้อมเพย์', promptPay.identifier)}
                                        className="inline-flex items-center gap-1.5 rounded-token-lg border border-border-subtle bg-bg-elevated px-3 py-2 font-bold text-fg-secondary transition hover:text-fg-primary"
                                    >
                                        <Copy className="h-3.5 w-3.5" />
                                        คัดลอกเบอร์
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => copyPaymentText('เลขอ้างอิง', activePaymentRequest.requestRef)}
                                        className="inline-flex items-center gap-1.5 rounded-token-lg border border-border-subtle bg-bg-elevated px-3 py-2 font-bold text-fg-secondary transition hover:text-fg-primary"
                                    >
                                        <Copy className="h-3.5 w-3.5" />
                                        คัดลอก Ref
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="p-5">
                            {canSubmitSlip ? (
                                <>
                                    <div className="mb-4 rounded-token-2xl border border-border-subtle bg-bg-base p-4">
                                        <p className="text-base font-black text-fg-primary">ขั้นตอนสุดท้าย: ส่งสลิป</p>
                                        <p className="mt-1 text-sm leading-6 text-fg-secondary">
                                            โอนตามยอดด้านซ้าย แล้วส่งข้อมูลจากสลิปหรือ URL รูปสลิป ระบบจะตรวจให้อัตโนมัติ หากตรวจไม่ได้จะส่งให้แอดมินตรวจสอบ
                                        </p>
                                    </div>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <label className="block">
                                            <span className="text-xs font-bold text-fg-secondary">ข้อมูล QR จากสลิป</span>
                                            <textarea
                                                value={slipPayload}
                                                onChange={(event) => setSlipPayload(event.target.value)}
                                                placeholder="วางข้อมูล QR จากสลิป ถ้ามี"
                                                className="mt-1 min-h-32 w-full rounded-token-xl border border-border-subtle bg-bg-base p-3 text-sm text-fg-primary outline-none focus:border-border-accent"
                                            />
                                        </label>
                                        <label className="block">
                                            <span className="text-xs font-bold text-fg-secondary">URL รูปสลิป</span>
                                            <input
                                                value={slipImageUrl}
                                                onChange={(event) => setSlipImageUrl(event.target.value)}
                                                placeholder="https://..."
                                                className="mt-1 w-full rounded-token-xl border border-border-subtle bg-bg-base p-3 text-sm text-fg-primary outline-none focus:border-border-accent"
                                            />
                                            <p className="mt-2 text-xs text-fg-tertiary">ถ้าใช้ URL ต้องเป็นลิงก์ที่ระบบเปิดดูได้จริง</p>
                                        </label>
                                    </div>
                                    <button
                                        onClick={handleSubmitSlip}
                                        data-testid="subscription-slip-submit"
                                        disabled={slipLoading}
                                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-token-xl bg-status-success px-4 py-3 text-sm font-black text-fg-inverse transition hover:brightness-110 disabled:opacity-50"
                                    >
                                        {slipLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                        {slipLoading ? 'กำลังตรวจสลิป...' : 'ส่งสลิปเพื่อตรวจสอบ'}
                                    </button>
                                </>
                            ) : (
                                <div className="rounded-token-2xl border border-border-subtle bg-bg-base p-5">
                                    <p className="text-base font-black text-fg-primary">รับสลิปแล้ว ไม่ต้องส่งซ้ำ</p>
                                    <p className="mt-2 text-sm leading-6 text-fg-secondary">
                                        สถานะล่าสุดคือ “{activePaymentStatus.label}” ถ้าแอดมินอนุมัติแล้วแพลนจะเปิดใช้งานอัตโนมัติ หากถูกปฏิเสธให้ดูเหตุผลแล้วสร้างรายการใหม่
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => refreshPaymentRequests(false)}
                                        disabled={requestsLoading}
                                        className="mt-4 inline-flex items-center gap-2 rounded-token-xl border border-border-subtle bg-bg-elevated px-4 py-2 text-xs font-black text-fg-secondary transition hover:text-fg-primary disabled:opacity-50"
                                    >
                                        <RefreshCw className={`h-3.5 w-3.5 ${requestsLoading ? 'animate-spin' : ''}`} />
                                        อัปเดตสถานะ
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            )}

            {(requestsLoading || recentPaymentRequests.length > 0) && (
                <section data-testid="subscription-payment-history" className="rounded-token-2xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Receipt className="h-4 w-4 text-fg-info" />
                            <h3 className="text-sm font-black text-fg-primary">ประวัติการชำระเงินล่าสุด</h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => refreshPaymentRequests(false)}
                            disabled={requestsLoading}
                            className="inline-flex items-center gap-2 rounded-token-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-[11px] font-black text-fg-secondary transition hover:text-fg-primary disabled:opacity-50"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${requestsLoading ? 'animate-spin' : ''}`} />
                            รีเฟรช
                        </button>
                    </div>
                    {recentPaymentRequests.length > 0 ? (
                        <div className="space-y-2">
                            {recentPaymentRequests.map((request) => {
                                const copy = PAYMENT_STATUS_COPY[request.status];
                                return (
                                    <div key={request.id} className="flex flex-col gap-2 rounded-token-xl border border-border-subtle bg-bg-base p-3 md:flex-row md:items-center md:justify-between">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-black text-fg-primary">฿{request.amount.toLocaleString('th-TH')}</span>
                                                <span className={`rounded-token-full border px-2 py-1 text-[10px] font-black ${copy.tone}`}>{copy.label}</span>
                                                <span className="text-[10px] font-bold text-fg-tertiary">{request.billingPeriod === 'yearly' ? 'รายปี' : 'รายเดือน'}</span>
                                            </div>
                                            <p className="mt-1 break-all font-mono text-[10px] text-fg-tertiary">{request.requestRef}</p>
                                            {request.reviewNotes && (
                                                <p className="mt-1 text-xs font-semibold text-fg-secondary">หมายเหตุ: {request.reviewNotes}</p>
                                            )}
                                        </div>
                                        <div className="text-xs text-fg-tertiary md:text-right">
                                            <p>สร้าง: {formatPaymentDate(request.createdAt)}</p>
                                            <p>ส่งสลิป: {formatPaymentDate(request.submittedAt)}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="rounded-token-xl border border-dashed border-border-subtle bg-bg-base p-4 text-sm text-fg-tertiary">
                            ยังไม่มีรายการชำระเงินของแก๊งนี้
                        </p>
                    )}
                </section>
            )}

            <section className="grid gap-4 lg:grid-cols-2">
                {BILLING_PLANS.map((tier) => {
                    const isCurrent = tier.id === effectivePlanId;
                    const isLower = tier.rank < currentRank;
                    const isUpgrade = tier.rank > currentRank;
                    const Icon = tier.id === 'FREE' ? Crown : Gem;
                    const price = billing === 'monthly' ? tier.priceMonthly : tier.priceYearly;

                    return (
                        <div
                            key={tier.id}
                            className={`relative rounded-token-3xl border p-5 shadow-token-sm ${tier.id === 'PREMIUM' ? 'border-status-success bg-status-success-subtle' : 'border-border-subtle bg-bg-subtle'} ${isLower && !isCurrent ? 'opacity-70' : ''}`}
                        >
                            {tier.popular && (
                                <div className="absolute -top-3 left-5 rounded-token-full bg-status-success px-4 py-1 text-[10px] font-black uppercase tracking-widest text-fg-inverse">
                                    แนะนำ
                                </div>
                            )}
                            <div className="mb-4 flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-token-2xl border border-border-subtle bg-bg-base p-3">
                                        <Icon className={`h-5 w-5 ${tier.id === 'PREMIUM' ? 'text-fg-success' : 'text-fg-secondary'}`} />
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-black text-fg-primary">{tier.name}</h4>
                                        <span className="text-xs font-bold text-fg-tertiary">สูงสุด {tier.maxMembers} คน</span>
                                    </div>
                                </div>
                                {isCurrent && (
                                    <span className="rounded-token-full border border-border-subtle bg-bg-base px-3 py-1 text-[10px] font-black text-fg-tertiary">
                                        ใช้อยู่
                                    </span>
                                )}
                            </div>

                            <div className="mb-4">
                                <span className="text-3xl font-black text-fg-primary">฿{price.toLocaleString('th-TH')}</span>
                                <span className="text-fg-tertiary text-sm">/{billing === 'monthly' ? 'เดือน' : 'ปี'}</span>
                                {billing === 'yearly' && tier.priceYearly > 0 && (
                                    <div className="text-fg-success text-xs font-bold mt-1">
                                        เฉลี่ย ฿{Math.round(tier.priceYearly / 12)}/เดือน
                                    </div>
                                )}
                            </div>

                            {tier.priceMonthly > 0 && (
                                <div className="mb-4 flex items-center gap-1.5 rounded-token-lg border border-border-subtle bg-bg-base px-3 py-1.5 text-[11px] text-fg-tertiary">
                                    <Calendar className="w-3 h-3" />
                                    ใช้งานได้ {billing === 'monthly' ? '30 วัน' : '365 วัน'} นับจากวันชำระ
                                </div>
                            )}

                            <ul className="mb-5 grid gap-2">
                                {tier.settingsFeatures.slice(0, tier.id === 'PREMIUM' ? 6 : 3).map((f, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-fg-secondary">
                                        <Check className={`mt-0.5 h-4 w-4 shrink-0 ${tier.id === 'PREMIUM' ? 'text-fg-success' : 'text-fg-secondary'}`} />
                                        {f}
                                    </li>
                                ))}
                            </ul>

                            {isCurrent && isPaid ? (
                                <button
                                    onClick={() => handleCheckout(tier.id)}
                                    disabled={!!loading || paymentPaused}
                                    className="flex w-full items-center justify-center gap-2 rounded-token-xl bg-status-success py-2.5 text-sm font-bold text-fg-inverse transition-colors hover:brightness-110 disabled:opacity-50"
                                >
                                    {loading === tier.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                    {paymentPaused ? PAYMENT_PAUSED_COPY.actionLabel : loading === tier.id ? 'กำลังเปิดหน้าชำระเงิน...' : isTrial ? 'อัปเกรดเป็น Premium ตอนนี้' : `ต่ออายุ (+${billing === 'monthly' ? '30' : '365'} วัน)`}
                                </button>
                            ) : isCurrent ? (
                                <button
                                    disabled
                                    className="w-full py-2.5 rounded-token-xl text-sm font-bold bg-bg-muted text-fg-tertiary border border-border-subtle cursor-default"
                                >
                                    แพลนปัจจุบัน
                                </button>
                            ) : tier.id === 'FREE' ? (
                                <div className="w-full py-2.5 rounded-token-xl text-sm font-bold bg-bg-muted text-fg-tertiary border border-border-subtle text-center">
                                    แพลนเริ่มต้น
                                </div>
                            ) : isLower ? (
                                <div className="w-full py-2.5 rounded-token-xl text-sm font-bold bg-bg-muted text-fg-tertiary border border-border-subtle text-center">
                                    แพลนต่ำกว่าปัจจุบัน
                                </div>
                            ) : isUpgrade ? (
                                <button
                                    onClick={() => handleCheckout(tier.id)}
                                    disabled={!!loading || paymentPaused}
                                    className="flex w-full items-center justify-center gap-2 rounded-token-xl bg-status-success py-2.5 text-sm font-bold text-fg-inverse transition-colors hover:brightness-110 disabled:opacity-50"
                                >
                                    {loading === tier.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <ArrowRight className="w-4 h-4" />
                                    )}
                                    {paymentPaused ? PAYMENT_PAUSED_COPY.actionLabel : loading === tier.id ? 'กำลังเปิดหน้าชำระเงิน...' : 'อัปเกรด'}
                                </button>
                            ) : null}
                        </div>
                    );
                })}
            </section>
        </div>
    );
}
