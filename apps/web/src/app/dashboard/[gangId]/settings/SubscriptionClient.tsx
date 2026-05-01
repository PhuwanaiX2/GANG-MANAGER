'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Crown, Gem, Loader2, Check, ArrowRight, Clock, RefreshCw, AlertTriangle, CreditCard, Sparkles, Calendar, Copy, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { BILLING_PLANS, BILLING_PLAN_MAP, type BillingPlan, type BillingPlanId } from '@/lib/billingPlans';
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
        helper: 'รายการอยู่ในคิวตรวจสอบ ถ้า SlipOK เปิดอยู่ระบบจะตรวจให้ก่อน',
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
            toast.success(`${label} copied`);
        } catch {
            toast.error(`Could not copy ${label}`);
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
                toast.error(error.message || 'โหลดสถานะการชำระเงินไม่สำเร็จ');
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
            toast.error('กรุณาใส่อย่างใดอย่างหนึ่ง: QR payload หรือ URL รูปสลิป');
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
                toast.error(json.error || 'ตรวจสลิปไม่ผ่าน', {
                    description: json.manualReviewRequired ? 'รายการถูกส่งเข้าคิวตรวจมือแล้ว ยังไม่เปิดแพลนจนกว่าจะอนุมัติ' : undefined,
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

            toast.info('ส่งสลิปเข้าคิวตรวจมือแล้ว', {
                description: 'ระบบยังไม่เปิดแพลนจนกว่าแอดมินจะอนุมัติ',
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

    const colorMap: Record<string, { bg: string; border: string; text: string; button: string; glow: string }> = {
        gray: { bg: 'bg-bg-subtle', border: 'border-border-subtle', text: 'text-fg-secondary', button: 'bg-bg-elevated hover:brightness-110', glow: '' },
        blue: { bg: 'bg-status-info-subtle', border: 'border-status-info', text: 'text-fg-info', button: 'bg-status-info hover:brightness-110', glow: 'shadow-token-sm' },
        purple: { bg: 'bg-accent-subtle', border: 'border-border-accent', text: 'text-accent-bright', button: 'bg-accent hover:brightness-110', glow: 'shadow-token-sm' },
    };

    const planColors: Record<BillingPlanId, keyof typeof colorMap> = {
        FREE: 'gray',
        PREMIUM: 'purple',
    };

    const planIcons: Record<BillingPlanId, typeof Crown> = {
        FREE: Crown,
        PREMIUM: Gem,
    };

    // Calculate proration preview for upgrade
    const getUpgradePreview = (targetTier: BillingPlan) => {
        if (!isPaid || !expiryInfo || expiryInfo.isExpired) return null;
        if (currentPlan.rank >= targetTier.rank) return null;

        const oldDaily = currentPlan.priceMonthly / 30;
        const newDaily = targetTier.priceMonthly / 30;
        if (oldDaily <= 0 || newDaily <= 0) return null;

        const bonusDays = Math.floor(expiryInfo.diffDays * (oldDaily / newDaily));
        const billingDays = billing === 'monthly' ? 30 : 365;
        const totalDays = billingDays + bonusDays;
        return { bonusDays, totalDays, billingDays };
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

    return (
        <div data-testid="subscription-settings-panel" className="space-y-6">
            {paymentPaused && (
                <div className="rounded-token-2xl border border-status-warning bg-status-warning-subtle p-5">
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

            {/* Current Plan Status */}
            <div className={`border rounded-token-2xl p-6 ${expiryInfo?.isExpired ? 'bg-status-danger-subtle border-status-danger' :
                expiryInfo?.isExpiringSoon ? 'bg-status-warning-subtle border-status-warning' :
                    'bg-bg-subtle border-border-subtle'
                }`}>
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-fg-primary font-bold text-lg">
                            แพลนปัจจุบัน: <span className="text-discord-primary">{currentTierLabel}</span>
                        </h3>
                        <p className="text-fg-tertiary text-sm mt-1">
                            สมาชิก: {memberCount}/{maxMembers} คน
                        </p>
                        {isPaid && expiryInfo && (
                            <div className={`flex items-center gap-1.5 mt-2 text-sm font-medium ${expiryInfo.isExpired ? 'text-fg-danger' :
                                expiryInfo.isExpiringSoon ? 'text-fg-warning' :
                                    'text-fg-success'
                                }`}>
                                {expiryInfo.isExpired ? (
                                    <AlertTriangle className="w-4 h-4" />
                                ) : (
                                    <Clock className="w-4 h-4" />
                                )}
                                {expiryInfo.isExpired
                                    ? paymentPaused ? 'หมดอายุแล้ว — ตอนนี้ยังไม่เปิดชำระเงินออนไลน์ และแพลนจะกลับเป็น Free ตามเงื่อนไขปัจจุบัน' : 'หมดอายุแล้ว — กรุณาต่ออายุเพื่อใช้งานต่อ'
                                    : `เหลืออีก ${expiryInfo.diffDays} วัน (หมดอายุ ${expiryInfo.date.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok',  day: 'numeric', month: 'long', year: 'numeric' })})`
                                }
                            </div>
                        )}
                        {isPaid && !expiryInfo && (
                            <div className="flex items-center gap-1.5 mt-2 text-sm font-medium text-fg-success">
                                <Sparkles className="w-4 h-4" />
                                ไม่มีวันหมดอายุ (ถาวร)
                            </div>
                        )}
                    </div>
                    {/* Usage bar */}
                    <div className="w-32">
                        <div className="h-2 bg-bg-muted rounded-token-full overflow-hidden">
                            <div
                                className={`h-full rounded-token-full transition-all ${memberCount / maxMembers > 0.8 ? 'bg-status-danger' : 'bg-status-success'}`}
                                style={{ width: `${Math.min((memberCount / maxMembers) * 100, 100)}%` }}
                            />
                        </div>
                        <span className="text-[10px] text-fg-tertiary mt-1 block text-right">{Math.round((memberCount / maxMembers) * 100)}%</span>
                    </div>
                </div>

                {/* Renew button for expiring/expired paid plans (not for lifetime) */}
                {isPaid && expiryInfo && (expiryInfo.isExpiringSoon || expiryInfo.isExpired) && (
                    <button
                        onClick={() => handleCheckout('PREMIUM')}
                        disabled={!!loading || paymentPaused}
                        className="mt-4 w-full py-2.5 rounded-token-xl text-sm font-bold text-fg-inverse bg-status-success hover:brightness-110 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {loading === 'PREMIUM' ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <RefreshCw className="w-4 h-4" />
                        )}
                        {paymentPaused ? PAYMENT_PAUSED_COPY.actionLabel : loading === 'PREMIUM' ? 'กำลังเปิดหน้าชำระเงิน...' : normalizedCurrentTier === 'TRIAL' ? 'อัปเกรดเป็น Premium' : 'ต่ออายุ Premium'}
                    </button>
                )}

                {/* Info: no auto-charge (only for plans with expiry) */}
                {isPaid && expiryInfo && (
                    <p className="mt-3 text-[11px] text-fg-tertiary flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5" />
                        ไม่มีการตัดเงินอัตโนมัติ — เมื่อหมดอายุแพลนจะกลับเป็น Free
                    </p>
                )}
            </div>

            {isTrial && expiryInfo && !expiryInfo.isExpired && (
                <div className={`rounded-token-2xl border p-5 ${expiryInfo.isExpiringSoon ? 'bg-status-warning-subtle border-status-warning' : 'bg-accent-subtle border-border-accent'}`}>
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className={`text-sm font-bold ${expiryInfo.isExpiringSoon ? 'text-fg-warning' : 'text-accent-bright'}`}>
                                ตอนนี้คุณกำลังทดลองใช้ Premium แบบเต็มฟีเจอร์
                            </p>
                            <p className="mt-1 text-sm text-fg-secondary">
                                เหลืออีก {expiryInfo.diffDays} วัน ก่อนระบบกลับเป็น Free และจำกัดสมาชิกเหลือ 15 คน
                            </p>
                            <p className="mt-2 text-xs text-fg-tertiary">
                                {paymentPaused ? PAYMENT_PAUSED_COPY.trialEnding : 'อัปเกรดตอนนี้เพื่อใช้งานต่อเนื่องทันที โดยไม่มีการตัดเงินอัตโนมัติ'}
                            </p>
                        </div>
                        <button
                            onClick={() => handleCheckout('PREMIUM')}
                            disabled={!!loading || paymentPaused}
                            className={`inline-flex items-center justify-center gap-2 rounded-token-xl px-4 py-2.5 text-sm font-bold text-fg-inverse transition-colors disabled:opacity-50 ${expiryInfo.isExpiringSoon ? 'bg-status-warning hover:brightness-110' : 'bg-accent hover:brightness-110'}`}
                        >
                            {loading === 'PREMIUM' ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <ArrowRight className="w-4 h-4" />
                            )}
                            {paymentPaused ? PAYMENT_PAUSED_COPY.actionLabel : loading === 'PREMIUM' ? 'กำลังเปิดหน้าชำระเงิน...' : 'อัปเกรดเป็น Premium ตอนนี้'}
                        </button>
                    </div>
                </div>
            )}

            {/* How it works - Tips */}
            {isPaid && expiryInfo && !expiryInfo.isExpired && (
                <div className="bg-status-info-subtle border border-status-info rounded-token-xl p-4">
                    <div className="flex items-start gap-3">
                        <Sparkles className="w-4 h-4 text-fg-info mt-0.5 shrink-0" />
                        <div className="space-y-1.5">
                            <p className="text-xs font-bold text-fg-info">อัปเกรดแพลนทำงานยังไง?</p>
                            <ul className="text-[11px] text-fg-secondary space-y-1">
                                <li>- มูลค่าวันที่เหลือจะถูกคำนวณและแปลงเป็นวันของแพลนใหม่อัตโนมัติ</li>
                                <li>- ต่ออายุแพลนเดิม = เพิ่มวันต่อจากที่เหลืออยู่</li>
                                <li>- ซื้อใหม่หลังหมดอายุ = เริ่มนับวันใหม่จากวันที่ชำระ</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {!paymentPaused && (
                <>
            {/* Payment methods info */}
            <div className="flex items-center justify-center gap-4 text-xs text-fg-tertiary">
                <span className="flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" /> PromptPay QR</span>
                <span className="text-fg-tertiary">|</span>
                <span>ตรวจสลิปด้วย SlipOK หรือส่งให้แอดมินตรวจมือ</span>
            </div>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-1 p-1 bg-bg-subtle rounded-token-xl w-fit mx-auto border border-border-subtle">
                <button
                    onClick={() => setBilling('monthly')}
                    className={`px-5 py-2 rounded-token-lg text-sm font-bold transition-all ${billing === 'monthly'
                        ? 'bg-accent text-accent-fg shadow-token-md'
                        : 'text-fg-secondary hover:text-fg-primary'
                        }`}
                >
                    รายเดือน (30 วัน)
                </button>
                <button
                    onClick={() => setBilling('yearly')}
                    className={`px-5 py-2 rounded-token-lg text-sm font-bold transition-all flex items-center gap-2 ${billing === 'yearly'
                        ? 'bg-accent text-accent-fg shadow-token-md'
                        : 'text-fg-secondary hover:text-fg-primary'
                        }`}
                >
                    รายปี (365 วัน)
                    <span className="text-[10px] font-black tracking-wider bg-status-success-subtle text-fg-success px-2 py-0.5 rounded-token-full border border-status-success">
                        ประหยัด 17%
                    </span>
                </button>
            </div>

                </>
            )}

            {activePaymentRequest && promptPay && activePaymentStatus && (
                <section data-testid="subscription-payment-status-card" className="mx-auto max-w-4xl overflow-hidden rounded-token-3xl border border-border-subtle bg-bg-elevated shadow-token-md">
                    <div className="border-b border-border-subtle bg-bg-muted/70 p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                                <div className="mb-3 flex flex-wrap items-center gap-2">
                                    <span className="rounded-token-full border border-border-subtle bg-bg-subtle px-3 py-1 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">
                                        Payment status
                                    </span>
                                    <span className={`rounded-token-full border px-3 py-1 text-[10px] font-black ${activePaymentStatus.tone}`}>
                                        {activePaymentStatus.label}
                                    </span>
                                </div>
                                <h3 className="text-2xl font-black text-fg-primary">
                                    ฿{activePaymentRequest.amount.toLocaleString('th-TH')}
                                    <span className="ml-2 text-sm font-bold text-fg-secondary">
                                        {activePaymentRequest.billingPeriod === 'yearly' ? 'รายปี' : 'รายเดือน'}
                                    </span>
                                </h3>
                                <p className="mt-2 text-sm text-fg-secondary">{activePaymentStatus.helper}</p>
                                <p className="mt-2 break-all font-mono text-xs text-fg-tertiary">
                                    Ref: {activePaymentRequest.requestRef}
                                </p>
                                {activePaymentRequest.verificationError && (
                                    <p className="mt-3 rounded-token-xl border border-status-warning bg-status-warning-subtle px-3 py-2 text-xs font-bold text-fg-warning">
                                        ผลตรวจเบื้องต้น: {activePaymentRequest.verificationError}
                                    </p>
                                )}
                            </div>

                            <div className="grid min-w-[240px] gap-2 rounded-token-2xl border border-border-subtle bg-bg-base p-3 text-xs">
                                {[
                                    { label: 'สร้างรายการ', active: true, value: formatPaymentDate(activePaymentRequest.createdAt) },
                                    { label: 'ส่งสลิป', active: activePaymentRequest.status !== 'PENDING', value: formatPaymentDate(activePaymentRequest.submittedAt) },
                                    { label: 'ตรวจ/อนุมัติ', active: ['VERIFIED', 'APPROVED', 'REJECTED'].includes(activePaymentRequest.status), value: formatPaymentDate(activePaymentRequest.approvedAt || activePaymentRequest.rejectedAt || activePaymentRequest.verifiedAt) },
                                ].map((step, index) => (
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

                    <div className="grid gap-0 lg:grid-cols-[280px_1fr]">
                        <div className="border-b border-border-subtle bg-status-success-subtle p-5 lg:border-b-0 lg:border-r">
                            {promptPay!.qrDataUrl ? (
                                <img
                                    src={promptPay!.qrDataUrl}
                                    alt={`PromptPay QR for ${activePaymentRequest.requestRef}`}
                                    className="mx-auto h-52 w-52 rounded-token-2xl bg-white p-3 shadow-token-sm"
                                />
                            ) : null}
                            <div className="mt-4 space-y-2 text-center text-xs text-fg-secondary">
                                <p className="font-bold text-fg-primary">{promptPay.receiverName}</p>
                                <p>PromptPay: <span className="font-mono font-black">{promptPay.identifier}</span></p>
                                <div className="flex justify-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => copyPaymentText('PromptPay number', promptPay.identifier)}
                                        className="inline-flex items-center gap-1.5 rounded-token-lg border border-border-subtle bg-bg-elevated px-3 py-2 font-bold text-fg-secondary transition hover:text-fg-primary"
                                    >
                                        <Copy className="h-3.5 w-3.5" />
                                        Copy เบอร์
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => copyPaymentText('payment reference', activePaymentRequest.requestRef)}
                                        className="inline-flex items-center gap-1.5 rounded-token-lg border border-border-subtle bg-bg-elevated px-3 py-2 font-bold text-fg-secondary transition hover:text-fg-primary"
                                    >
                                        <Copy className="h-3.5 w-3.5" />
                                        Copy Ref
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="p-5">
                            {canSubmitSlip ? (
                                <>
                                    <div className="mb-4 rounded-token-2xl border border-border-subtle bg-bg-muted p-4">
                                        <p className="text-sm font-black text-fg-primary">ส่งหลักฐานหลังโอนเงิน</p>
                                        <p className="mt-1 text-xs text-fg-secondary">
                                            ใส่อย่างใดอย่างหนึ่งเท่านั้น: QR payload จากสลิป หรือ URL รูปสลิป ระบบจะส่งเข้า SlipOK ถ้าเปิด auto verify ไว้ ไม่งั้นจะเข้าแอดมินตรวจมือ
                                        </p>
                                    </div>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <label className="block">
                                            <span className="text-xs font-bold text-fg-secondary">QR payload จากสลิป</span>
                                            <textarea
                                                value={slipPayload}
                                                onChange={(event) => setSlipPayload(event.target.value)}
                                                placeholder="วางข้อความ QR จากสลิป ถ้ามี"
                                                className="mt-1 min-h-28 w-full rounded-token-xl border border-border-subtle bg-bg-base p-3 text-sm text-fg-primary outline-none focus:border-border-accent"
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
                                <div className="rounded-token-2xl border border-border-subtle bg-bg-muted p-5">
                                    <p className="text-sm font-black text-fg-primary">รับสลิปแล้ว ไม่ต้องส่งซ้ำ</p>
                                    <p className="mt-2 text-sm text-fg-secondary">
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
                <section data-testid="subscription-payment-history" className="mx-auto max-w-4xl rounded-token-2xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm">
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

            {/* Pricing Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                {BILLING_PLANS.map((tier) => {
                    const isCurrent = tier.id === effectivePlanId;
                    const isLower = tier.rank < currentRank && tier.rank > 0;
                    const isUpgrade = tier.rank > currentRank;
                    const colors = colorMap[planColors[tier.id]];
                    const Icon = planIcons[tier.id];
                    const upgradePreview = isUpgrade ? getUpgradePreview(tier) : null;

                    return (
                        <div
                            key={tier.id}
                            className={`relative ${colors.bg} border ${isCurrent ? 'border-border-accent ring-1 ring-border-accent' : colors.border} rounded-token-2xl p-6 transition-all hover:scale-[1.02] ${isCurrent ? `shadow-token-md ${colors.glow}` : ''} ${isLower && !isCurrent ? 'opacity-50' : ''}`}
                        >
                            {tier.popular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-status-info text-fg-inverse text-[10px] font-black tracking-widest uppercase px-4 py-1 rounded-token-full">
                                    แนะนำ
                                </div>
                            )}
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`p-2 rounded-token-xl ${colors.bg} border ${colors.border}`}>
                                    <Icon className={`w-5 h-5 ${colors.text}`} />
                                </div>
                                <div>
                                    <h4 className="text-fg-primary font-bold">{tier.name}</h4>
                                    <span className="text-fg-tertiary text-xs">สูงสุด {tier.maxMembers} คน</span>
                                </div>
                            </div>

                            <div className="mb-4">
                                <span className="text-3xl font-black text-fg-primary">
                                    ฿{billing === 'monthly' ? tier.priceMonthly : tier.priceYearly}
                                </span>
                                <span className="text-fg-tertiary text-sm">/{billing === 'monthly' ? 'เดือน' : 'ปี'}</span>
                                {billing === 'yearly' && tier.priceYearly > 0 && (
                                    <div className="text-fg-success text-xs font-bold mt-1">
                                        เฉลี่ย ฿{Math.round(tier.priceYearly / 12)}/เดือน
                                    </div>
                                )}
                            </div>

                            {/* Duration badge */}
                            {tier.priceMonthly > 0 && (
                                <div className="flex items-center gap-1.5 text-[11px] text-fg-tertiary mb-4 bg-bg-muted rounded-token-lg px-3 py-1.5 border border-border-subtle">
                                    <Calendar className="w-3 h-3" />
                                    ใช้งานได้ {billing === 'monthly' ? '30 วัน' : '365 วัน'} นับจากวันชำระ
                                </div>
                            )}

                            <ul className="space-y-2 mb-6">
                                {tier.settingsFeatures.map((f, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-fg-secondary">
                                        <Check className={`w-4 h-4 mt-0.5 shrink-0 ${colors.text}`} />
                                        {f}
                                    </li>
                                ))}
                            </ul>

                            {/* Upgrade proration preview */}
                            {upgradePreview && (
                                <div className="mb-4 bg-status-success-subtle border border-status-success rounded-token-lg px-3 py-2">
                                    <p className="text-[11px] text-fg-success font-medium flex items-center gap-1.5">
                                        <Sparkles className="w-3 h-3" />
                                        อัปเกรดจะได้รับ: {upgradePreview.billingDays} + {upgradePreview.bonusDays} วัน (รวม {upgradePreview.totalDays} วัน)
                                    </p>
                                </div>
                            )}

                            {isCurrent && isPaid ? (
                                <button
                                    onClick={() => handleCheckout(tier.id)}
                                    disabled={!!loading || paymentPaused}
                                    className="w-full py-2.5 rounded-token-xl text-sm font-bold text-fg-inverse bg-status-success hover:brightness-110 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {loading === tier.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <RefreshCw className="w-4 h-4" />
                                    )}
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
                                    className={`w-full py-2.5 rounded-token-xl text-sm font-bold text-fg-inverse ${colors.button} transition-colors flex items-center justify-center gap-2 disabled:opacity-50`}
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
            </div>
        </div>
    );
}
