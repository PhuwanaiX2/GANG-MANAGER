'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    Calendar,
    Check,
    CheckCircle2,
    Clock3,
    Copy,
    Crown,
    Gem,
    ImagePlus,
    Link2,
    Loader2,
    Receipt,
    RefreshCw,
    ShieldCheck,
    Upload,
    XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { BILLING_PLAN_MAP, BILLING_PLANS, type BillingPlanId } from '@/lib/billingPlans';
import { PAYMENT_PAUSED_COPY } from '@/lib/paymentReadiness';
import { getSubscriptionTierLabel, normalizeSubscriptionTierValue } from '@/lib/subscriptionTier';

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

type SlipEvidenceMode = 'file' | 'url';

const ACTIVE_PAYMENT_STATUSES: PaymentStatus[] = ['PENDING', 'SUBMITTED', 'VERIFIED'];
const TERMINAL_PAYMENT_STATUSES: PaymentStatus[] = ['APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED'];

const PAYMENT_STATUS_COPY: Record<PaymentStatus, { label: string; helper: string; tone: string }> = {
    PENDING: {
        label: 'รอโอนเงิน',
        helper: 'สร้างรายการแล้ว โอนตามยอดและเลขอ้างอิง จากนั้นส่งสลิปเพื่อให้ระบบตรวจสอบ',
        tone: 'border-status-warning bg-status-warning-subtle text-fg-warning',
    },
    SUBMITTED: {
        label: 'ส่งสลิปแล้ว',
        helper: 'ได้รับสลิปแล้ว ระบบกำลังตรวจสอบ หากผ่านจะต่ออายุให้อัตโนมัติ',
        tone: 'border-status-info bg-status-info-subtle text-fg-info',
    },
    VERIFIED: {
        label: 'รอยืนยันขั้นสุดท้าย',
        helper: 'ตรวจเบื้องต้นผ่านแล้ว รอระบบหรือแอดมินยืนยันขั้นสุดท้าย',
        tone: 'border-status-info bg-status-info-subtle text-fg-info',
    },
    APPROVED: {
        label: 'สำเร็จ',
        helper: 'ชำระเงินสำเร็จ แพลนถูกต่ออายุแล้ว',
        tone: 'border-status-success bg-status-success-subtle text-fg-success',
    },
    REJECTED: {
        label: 'สลิปใช้ไม่ได้',
        helper: 'รายการนี้ถูกปิดแล้ว หากโอนเงินจริงและมีหลักฐาน ให้รอแอดมินตรวจ/กู้รายการก่อน อย่าโอนซ้ำทันที',
        tone: 'border-status-danger bg-status-danger-subtle text-fg-danger',
    },
    EXPIRED: {
        label: 'หมดเวลา',
        helper: 'รายการนี้หมดอายุแล้ว กรุณาสร้างรายการใหม่',
        tone: 'border-border-subtle bg-bg-muted text-fg-secondary',
    },
    CANCELLED: {
        label: 'ยกเลิก',
        helper: 'รายการนี้ถูกยกเลิกแล้ว',
        tone: 'border-border-subtle bg-bg-muted text-fg-secondary',
    },
};

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

function statusStepActive(status: PaymentStatus, step: 'created' | 'submitted' | 'checked') {
    if (step === 'created') return true;
    if (step === 'submitted') return status !== 'PENDING';
    return ['VERIFIED', 'APPROVED', 'REJECTED'].includes(status);
}

function getUploadErrorCopy(error?: string) {
    if (!error) return 'กรุณาลองใหม่อีกครั้ง';
    if (error.includes('Only JPG') || error.includes('WEBP')) return 'รองรับเฉพาะไฟล์ JPG, PNG หรือ WEBP';
    if (error.includes('5MB')) return 'ไฟล์สลิปต้องไม่เกิน 5MB';
    if (error.includes('Upload service')) return 'ระบบอัปโหลดรูปยังไม่พร้อม กรุณาติดต่อซัพพอร์ตเพื่อตรวจรายการ';
    if (error.includes('Slip image URL')) return 'ลิงก์ต้องเป็นรูปสลิปแบบ HTTPS จาก Discord, Facebook CDN หรือแหล่งที่ระบบไว้ใจ';
    return error;
}

function getPaymentCreatedAtMs(payment: PaymentRequestView) {
    return payment.createdAt ? new Date(payment.createdAt).getTime() : 0;
}

function normalizePaymentRequestList(requests: PaymentRequestView[]) {
    const sorted = [...requests].sort((a, b) => getPaymentCreatedAtMs(b) - getPaymentCreatedAtMs(a));
    const latestTerminal = sorted.find((request) => TERMINAL_PAYMENT_STATUSES.includes(request.status));
    const latestTerminalAt = latestTerminal ? getPaymentCreatedAtMs(latestTerminal) : 0;
    let keptActive = false;

    return sorted.filter((request) => {
        if (!ACTIVE_PAYMENT_STATUSES.includes(request.status)) return true;
        if (latestTerminalAt > 0 && getPaymentCreatedAtMs(request) < latestTerminalAt) return false;
        if (keptActive) return false;
        keptActive = true;
        return true;
    });
}

function getRejectedPaymentCopy(code?: string, error?: string) {
    const messages: Record<string, string> = {
        SLIP_NOT_FOUND_OR_EXPIRED: 'ระบบตรวจอัตโนมัติยังยืนยันรายการโอนนี้ไม่ได้ หากโอนเงินจริงให้รอแอดมินตรวจ อย่าโอนซ้ำทันที',
        AMOUNT_MISMATCH: 'ยอดเงินในสลิปไม่ตรงกับยอดบิล กรุณาสร้างบิลใหม่และโอนตามยอดที่แสดง',
        ACCOUNT_MISMATCH: 'บัญชีผู้รับเงินในสลิปไม่ตรงกับบัญชีตรวจอัตโนมัติ หากโอนเข้าบัญชีที่ถูกต้องให้รอแอดมินตรวจ อย่าโอนซ้ำทันที',
        DUPLICATE_SLIP: 'สลิปนี้ถูกใช้กับรายการอื่นแล้ว กรุณาสร้างบิลใหม่และใช้สลิปที่ยังไม่เคยส่ง',
        MISSING_SLIP_QR: 'ไม่พบ QR ในสลิป กรุณาส่งสลิปที่มี QR จากแอปธนาคาร',
        UNSUPPORTED_SLIP_QR: 'QR ในสลิปไม่รองรับการตรวจสอบ กรุณาสร้างบิลใหม่และส่งสลิปจากแอปธนาคาร',
    };

    if (code && messages[code]) return messages[code];
    return error || 'รายการนี้ถูกปิดแล้ว กรุณาสร้างบิลใหม่ก่อนชำระอีกครั้ง';
}

export function SubscriptionClient({
    gangId,
    currentTier,
    expiresAt,
    memberCount,
    maxMembers,
    promptPayBillingEnabled,
}: Props) {
    const [loading, setLoading] = useState<string | null>(null);
    const [cancelLoading, setCancelLoading] = useState(false);
    const [slipLoading, setSlipLoading] = useState(false);
    const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
    const [paymentRequest, setPaymentRequest] = useState<PaymentRequestView | null>(null);
    const [paymentRequests, setPaymentRequests] = useState<PaymentRequestView[]>([]);
    const [requestsLoading, setRequestsLoading] = useState(true);
    const [promptPay, setPromptPay] = useState<PromptPayReceiverView | null>(null);
    const [slipEvidenceMode, setSlipEvidenceMode] = useState<SlipEvidenceMode>('file');
    const [slipFile, setSlipFile] = useState<File | null>(null);
    const [slipImageUrl, setSlipImageUrl] = useState('');

    const normalizedCurrentTier = useMemo(() => normalizeSubscriptionTierValue(currentTier), [currentTier]);
    const effectivePlanId = useMemo<BillingPlanId>(() => normalizedCurrentTier === 'FREE' ? 'FREE' : 'PREMIUM', [normalizedCurrentTier]);
    const currentPlan = useMemo(() => BILLING_PLAN_MAP[effectivePlanId], [effectivePlanId]);
    const currentTierLabel = useMemo(() => (
        normalizedCurrentTier === 'TRIAL' ? 'Trial' : getSubscriptionTierLabel(normalizedCurrentTier)
    ), [normalizedCurrentTier]);

    const isPaid = normalizedCurrentTier !== 'FREE';
    const isTrial = normalizedCurrentTier === 'TRIAL';
    const paymentPaused = promptPayBillingEnabled !== true;
    const premiumPlan = BILLING_PLAN_MAP.PREMIUM;
    const selectedPrice = billing === 'monthly' ? premiumPlan.priceMonthly : premiumPlan.priceYearly;
    const selectedDurationDays = billing === 'monthly' ? 30 : 365;

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
        const nextRequests = normalizePaymentRequestList([
            nextPayment,
            ...paymentRequests.filter((payment) => payment.id !== nextPayment.id),
        ]);
        setPaymentRequests(nextRequests);
        setPaymentRequest(ACTIVE_PAYMENT_STATUSES.includes(nextPayment.status) ? nextPayment : null);
    }, [paymentRequests]);

    const refreshPaymentRequests = useCallback(async (silent = true) => {
        setRequestsLoading(true);
        try {
            const res = await fetch(`/api/gangs/${gangId}/subscription/payment-requests`);
            const json = await res.json();

            if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);

            const requests: PaymentRequestView[] = normalizePaymentRequestList(json.paymentRequests || []);
            setPaymentRequests(requests);

            const activeRequest = requests.find((request) => ACTIVE_PAYMENT_STATUSES.includes(request.status));
            if (activeRequest) {
                setPaymentRequest((current) => current && ACTIVE_PAYMENT_STATUSES.includes(current.status) ? current : activeRequest);
                if (json.promptPay) setPromptPay((current) => current ?? json.promptPay);
            } else {
                setPaymentRequest(null);
            }
        } catch {
            if (!silent) toast.error('โหลดสถานะการชำระเงินไม่สำเร็จ');
        } finally {
            setRequestsLoading(false);
        }
    }, [gangId]);

    const handleCheckout = async (tier: BillingPlanId) => {
        if (tier === 'FREE') return;
        if (activePaymentRequest) {
            toast.info(activePaymentRequest.status === 'PENDING' ? 'มีบิลที่ยังเปิดอยู่แล้ว' : 'รายการเดิมกำลังรอตรวจสอบ', {
                description: activePaymentRequest.status === 'PENDING'
                    ? 'ใช้บิลด้านล่างต่อได้เลย หรือรอให้รายการนี้จบก่อนสร้างใหม่'
                    : 'ยังไม่ควรสร้างบิลซ้ำจนกว่ารายการเดิมจะผ่านหรือถูกปฏิเสธ',
            });
            return;
        }
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

            const json = await res.json();
            if (!res.ok) {
                toast.error(json.error || 'สร้างรายการชำระเงินไม่สำเร็จ');
                return;
            }

            rememberPaymentRequest(json.paymentRequest);
            setPromptPay(json.promptPay);
            if (json.reused) {
                toast.info(json.blockedByReview ? 'รายการเดิมกำลังรอตรวจสอบ' : 'มีบิลที่ยังใช้งานได้อยู่แล้ว', {
                    description: json.blockedByReview
                        ? 'ระบบดึงรายการเดิมขึ้นมาให้ ไม่ได้สร้างบิลซ้ำ'
                        : 'ใช้บิลเดิมต่อได้เลย ไม่ต้องสร้างรายการใหม่',
                });
            } else {
                toast.success('สร้างรายการชำระเงินแล้ว', {
                    description: 'โอนตามยอดที่แสดง แล้วส่งสลิปเพื่อให้ระบบตรวจสอบ',
                });
            }
        } catch {
            toast.error('เชื่อมต่อระบบชำระเงินไม่สำเร็จ');
        } finally {
            setLoading(null);
        }
    };

    const handleSlipFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] ?? null;
        setSlipFile(file);
        if (file) setSlipImageUrl('');
    };

    const handleSubmitSlip = async () => {
        if (!activePaymentRequest) return;

        const trimmedSlipImageUrl = slipImageUrl.trim();
        if (slipEvidenceMode === 'file' && !slipFile) {
            toast.error('กรุณาเลือกภาพสลิปก่อนส่ง');
            return;
        }
        if (slipEvidenceMode === 'url') {
            if (!trimmedSlipImageUrl) {
                toast.error('กรุณาใส่ลิงก์รูปสลิปก่อนส่ง');
                return;
            }
            try {
                const parsedUrl = new URL(trimmedSlipImageUrl);
                if (parsedUrl.protocol !== 'https:') throw new Error('HTTPS_REQUIRED');
            } catch {
                toast.error('ลิงก์สลิปไม่ถูกต้อง', {
                    description: 'ใช้ลิงก์รูปภาพแบบ HTTPS จาก Discord หรือ Facebook CDN',
                });
                return;
            }
        }

        const resetSlipEvidence = () => {
            setSlipFile(null);
            setSlipImageUrl('');
        };

        const slipEndpoint = `/api/gangs/${gangId}/subscription/payment-requests/${activePaymentRequest.id}/slip`;
        let slipRequestInit: RequestInit;
        if (slipEvidenceMode === 'file') {
            const formData = new FormData();
            formData.set('file', slipFile as File);
            slipRequestInit = {
                method: 'POST',
                body: formData,
            };
        } else {
            slipRequestInit = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl: trimmedSlipImageUrl }),
            };
        }

        setSlipLoading(true);
        try {
            const res = await fetch(slipEndpoint, slipRequestInit);

            const json = await res.json();

            if (!res.ok) {
                if (json.rejected) {
                    toast.error('สลิปใช้ไม่ได้', {
                        description: getRejectedPaymentCopy(json.code, json.error),
                    });
                    if (json.paymentRequest) rememberPaymentRequest(json.paymentRequest);
                    resetSlipEvidence();
                    await refreshPaymentRequests(true);
                    return;
                }

                toast.error('ส่งสลิปไม่สำเร็จ', {
                    description: getUploadErrorCopy(json.error),
                });
                if (json.paymentRequest) rememberPaymentRequest(json.paymentRequest);
                return;
            }

            if (json.activated) {
                toast.success('เปิดใช้งาน Premium สำเร็จ', {
                    description: `เพิ่มวันใช้งาน ${json.durationDays} วัน`,
                });
                window.location.reload();
                return;
            }

            toast.success(json.manualReviewRequired ? 'ส่งสลิปแล้ว รอตรวจสอบ' : 'ส่งสลิปแล้ว กำลังตรวจสอบอัตโนมัติ', {
                description: json.manualReviewRequired
                    ? json.message || 'รายการนี้ถูกส่งให้แอดมินตรวจต่อแล้ว กรุณาอย่าโอนซ้ำ ระหว่างรอผลตรวจ'
                    : 'ระบบจะอัปเดตสถานะให้ทันทีเมื่อผลตรวจเสร็จ',
            });
            if (json.paymentRequest) rememberPaymentRequest(json.paymentRequest);
            resetSlipEvidence();
        } catch {
            toast.error('ส่งสลิปไม่สำเร็จ', {
                description: 'กรุณาลองใหม่อีกครั้ง',
            });
        } finally {
            setSlipLoading(false);
        }
    };

    const handleCancelPaymentRequest = async () => {
        if (!activePaymentRequest || activePaymentRequest.status !== 'PENDING') return;

        setCancelLoading(true);
        try {
            const res = await fetch(`/api/gangs/${gangId}/subscription/payment-requests/${activePaymentRequest.id}`, {
                method: 'DELETE',
            });
            const json = await res.json();

            if (!res.ok) {
                toast.error('ยกเลิกบิลไม่สำเร็จ', {
                    description: json.error || 'รายการนี้อาจถูกส่งสลิปหรือปิดไปแล้ว กรุณาอัปเดตสถานะ',
                });
                await refreshPaymentRequests(true);
                return;
            }

            if (json.paymentRequest) rememberPaymentRequest(json.paymentRequest);
            setSlipFile(null);
            setSlipImageUrl('');
            toast.success('ยกเลิกบิลแล้ว', {
                description: 'สร้างบิลใหม่ได้ทันทีเมื่อพร้อมชำระ',
            });
            await refreshPaymentRequests(true);
        } catch {
            toast.error('ยกเลิกบิลไม่สำเร็จ', {
                description: 'เชื่อมต่อระบบชำระเงินไม่ได้ กรุณาลองใหม่',
            });
        } finally {
            setCancelLoading(false);
        }
    };

    const expiryInfo = useMemo(() => {
        if (!expiresAt) return null;
        const exp = new Date(expiresAt);
        const now = new Date();
        const diffMs = exp.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        return { date: exp, diffDays, isExpired: diffDays <= 0, isExpiringSoon: diffDays > 0 && diffDays <= 7 };
    }, [expiresAt]);

    useEffect(() => {
        refreshPaymentRequests(true);
    }, [refreshPaymentRequests]);

    const activePaymentRequest = paymentRequest && ACTIVE_PAYMENT_STATUSES.includes(paymentRequest.status)
        ? paymentRequest
        : paymentRequests.find((request) => ACTIVE_PAYMENT_STATUSES.includes(request.status)) ?? null;
    const activePaymentStatus = activePaymentRequest ? PAYMENT_STATUS_COPY[activePaymentRequest.status] : null;
    const canSubmitSlip = Boolean(activePaymentRequest && promptPay && activePaymentRequest.status === 'PENDING');
    const canSubmitSlipEvidence = slipEvidenceMode === 'file' ? Boolean(slipFile) : Boolean(slipImageUrl.trim());
    const checkoutBlockedByActivePayment = Boolean(activePaymentRequest);
    const recentPaymentRequests = paymentRequests.slice(0, 5);
    const memberUsagePercent = Math.min(Math.round((memberCount / Math.max(maxMembers, 1)) * 100), 100);
    const planHealthCopy = expiryInfo
        ? expiryInfo.isExpired
            ? 'หมดอายุแล้ว'
            : `เหลือ ${expiryInfo.diffDays} วัน`
        : isPaid
            ? 'ใช้งานได้'
            : 'แพลนเริ่มต้น';
    const planHealthTone = expiryInfo?.isExpired
        ? 'border-status-danger bg-status-danger-subtle text-fg-danger'
        : expiryInfo?.isExpiringSoon
            ? 'border-status-warning bg-status-warning-subtle text-fg-warning'
            : 'border-status-success bg-status-success-subtle text-fg-success';
    const remainingPlanDays = expiryInfo && !expiryInfo.isExpired && isPaid ? expiryInfo.diffDays : 0;
    const selectedTotalDays = selectedDurationDays + remainingPlanDays;
    const paymentSteps = activePaymentRequest
        ? [
            { key: 'created' as const, label: 'สร้างรายการ', value: formatPaymentDate(activePaymentRequest.createdAt) },
            { key: 'submitted' as const, label: 'ส่งสลิป', value: formatPaymentDate(activePaymentRequest.submittedAt) },
            { key: 'checked' as const, label: 'ตรวจสอบ', value: formatPaymentDate(activePaymentRequest.approvedAt || activePaymentRequest.rejectedAt || activePaymentRequest.verifiedAt) },
        ]
        : [];
    const checkoutButtonClass = paymentPaused
        ? 'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-token-lg border border-border-subtle bg-bg-muted px-4 py-3 text-sm font-black text-fg-tertiary shadow-token-sm disabled:cursor-not-allowed disabled:opacity-100'
        : 'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-token-lg bg-status-success px-4 py-3 text-sm font-black text-fg-inverse shadow-token-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';

    return (
        <div data-testid="subscription-settings-panel" className="mx-auto w-full max-w-6xl space-y-4">
            {paymentPaused && (
                <div className="rounded-token-xl border border-status-warning bg-status-warning-subtle p-3 sm:p-4">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-fg-warning sm:h-5 sm:w-5" />
                        <div>
                            <p className="text-sm font-black text-fg-warning sm:text-base">{PAYMENT_PAUSED_COPY.shortLabel}</p>
                            <p className="mt-1 hidden text-sm leading-6 text-fg-secondary sm:block">ยังดูสถานะแพลนและประวัติได้ตามปกติ เมื่อเปิดระบบแล้วจะใช้ PromptPay และตรวจสลิปผ่านหน้านี้</p>
                        </div>
                    </div>
                </div>
            )}

            <section className="grid items-start gap-4 lg:grid-cols-[0.92fr_1.08fr]">
                <div className="order-2 rounded-token-xl border border-border-subtle border-l-2 border-l-status-success bg-bg-subtle p-4 shadow-token-sm lg:order-none">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <div className="mb-3 inline-flex items-center gap-2 rounded-token-full border border-border-subtle bg-bg-base px-3 py-1 text-[10px] font-bold text-fg-tertiary">
                                <Crown className="h-3.5 w-3.5 text-accent-bright" />
                                สถานะแพลน
                            </div>
                            <h2 className="font-heading text-xl font-black tracking-tight text-fg-primary sm:text-2xl">{currentTierLabel}</h2>
                            <p className="mt-1 text-sm leading-6 text-fg-secondary">แพลนปัจจุบันของแก๊ง</p>
                        </div>
                        <span className={`inline-flex w-fit items-center gap-2 rounded-token-full border px-3 py-1 text-xs font-black ${planHealthTone}`}>
                            <Clock3 className="h-3.5 w-3.5" />
                            {planHealthCopy}
                        </span>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-token-xl border border-border-subtle bg-bg-base px-3 py-2">
                            <p className="text-[10px] font-bold text-fg-tertiary">สมาชิก</p>
                            <p className="mt-1 text-sm font-black text-fg-primary">{memberCount}/{maxMembers} คน</p>
                        </div>
                        <div className="rounded-token-xl border border-border-subtle bg-bg-base px-3 py-2">
                            <p className="text-[10px] font-bold text-fg-tertiary">โควตา</p>
                            <p className="mt-1 text-sm font-black text-fg-primary">{memberUsagePercent}%</p>
                        </div>
                    </div>

                    {expiryInfo && (
                        <p className="mt-3 text-sm font-semibold text-fg-secondary">
                            หมดอายุ {expiryInfo.date.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                    )}
                </div>

                <div className="order-1 rounded-token-xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm lg:order-none">
                    <div className="mb-4 flex items-center gap-2">
                        <Gem className="h-5 w-5 text-fg-success" />
                        <h2 className="font-heading text-lg font-black text-fg-primary sm:text-xl">
                            {isPaid ? 'ต่ออายุ Premium' : 'อัปเกรดเป็น Premium'}
                        </h2>
                    </div>

                    <div className="mb-4 grid grid-cols-2 gap-2 rounded-token-lg border border-border-subtle bg-bg-base p-1">
                        <button
                            type="button"
                            onClick={() => setBilling('monthly')}
                            className={`min-h-11 rounded-token-md text-sm font-black transition ${billing === 'monthly' ? 'bg-status-success text-fg-inverse shadow-token-sm' : 'text-fg-secondary hover:text-fg-primary'}`}
                        >
                            30 วัน
                        </button>
                        <button
                            type="button"
                            onClick={() => setBilling('yearly')}
                            className={`min-h-11 rounded-token-md text-sm font-black transition ${billing === 'yearly' ? 'bg-status-success text-fg-inverse shadow-token-sm' : 'text-fg-secondary hover:text-fg-primary'}`}
                        >
                            365 วัน
                        </button>
                    </div>

                    <div className="mb-4 rounded-token-xl border border-border-subtle bg-bg-base p-4">
                        <p className="text-xs font-bold text-fg-tertiary">ยอดที่ต้องชำระ</p>
                        <div className="mt-1 flex items-end justify-between gap-3">
                            <p className="text-2xl font-black text-fg-primary">฿{selectedPrice.toLocaleString('th-TH')}</p>
                            <span className="rounded-token-full border border-status-success bg-status-success-subtle px-3 py-1 text-xs font-black text-fg-success">
                                +{selectedTotalDays} วัน
                            </span>
                        </div>
                        {remainingPlanDays > 0 && (
                            <p className="mt-2 text-xs font-semibold text-fg-tertiary">
                                รวมวันคงเหลือเดิม {remainingPlanDays} วันเข้ากับแพลนใหม่ให้แล้ว
                            </p>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => handleCheckout('PREMIUM')}
                        disabled={!!loading || paymentPaused || checkoutBlockedByActivePayment}
                        className={checkoutButtonClass}
                    >
                        {loading === 'PREMIUM' ? <Loader2 className="h-4 w-4 animate-spin" /> : paymentPaused ? <AlertTriangle className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                        {paymentPaused
                            ? PAYMENT_PAUSED_COPY.actionLabel
                            : loading === 'PREMIUM'
                                ? 'กำลังสร้างรายการ...'
                                : checkoutBlockedByActivePayment
                                    ? activePaymentRequest?.status === 'PENDING' ? 'มีบิลเปิดอยู่แล้ว' : 'รายการเดิมกำลังรอตรวจ'
                                    : isTrial ? `อัปเกรดเป็น Premium (+${selectedTotalDays} วัน)` : isPaid ? `ต่ออายุ (+${selectedTotalDays} วัน)` : 'สร้างรายการชำระเงิน'}
                    </button>
                    <p className="mt-3 text-xs leading-5 text-fg-tertiary">
                        รายการเดิมยังใช้ได้ ถ้าส่งสลิปแล้วให้รอสถานะอัปเดต ไม่ต้องสร้างซ้ำ
                    </p>
                </div>
            </section>

            {activePaymentRequest && promptPay && (
                <section data-testid="subscription-payment-status-card" className="overflow-hidden rounded-token-xl border border-border-subtle bg-bg-subtle shadow-token-sm">
                    <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
                        <div className="bg-accent-subtle p-4">
                            <div className="mb-4 flex flex-wrap items-center gap-2">
                                <span className={`rounded-token-full border px-3 py-1 text-[11px] font-black ${activePaymentStatus?.tone}`}>
                                    {activePaymentStatus?.label}
                                </span>
                                <span className="rounded-token-full border border-border-subtle bg-bg-base px-3 py-1 text-[11px] font-black text-fg-tertiary">
                                    Ref: {activePaymentRequest.requestRef}
                                </span>
                                {activePaymentRequest.status === 'PENDING' && (
                                    <button
                                        type="button"
                                        onClick={handleCancelPaymentRequest}
                                        disabled={cancelLoading}
                                        className="inline-flex min-h-8 items-center gap-1.5 rounded-token-full border border-status-danger bg-status-danger-subtle px-3 py-1 text-[11px] font-black text-fg-danger transition hover:bg-bg-base disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {cancelLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                                        ยกเลิกบิล
                                    </button>
                                )}
                            </div>
                            <h3 className="text-xl font-black text-fg-primary sm:text-2xl">฿{activePaymentRequest.amount.toLocaleString('th-TH')}</h3>
                            <p className="mt-2 text-sm leading-6 text-fg-secondary">{activePaymentRequest.verificationError || activePaymentStatus?.helper}</p>

                            <div className="mt-4 rounded-token-xl border border-border-subtle bg-bg-base p-3">
                                <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
                                    {promptPay.qrDataUrl && (
                                        <img
                                            src={promptPay.qrDataUrl}
                                            alt={`PromptPay QR ${activePaymentRequest.requestRef}`}
                                            width={160}
                                            height={160}
                                            className="mx-auto h-36 w-36 rounded-token-lg border border-border-subtle bg-white p-2 sm:h-40 sm:w-40"
                                        />
                                    )}
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-xs font-bold text-fg-tertiary">ผู้รับเงิน</p>
                                            <p className="font-black text-fg-primary">{promptPay.receiverName}</p>
                                            <p className="text-sm text-fg-secondary">PromptPay: {promptPay.identifier}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={() => copyPaymentText('เบอร์', promptPay.identifier)}
                                                className="inline-flex min-h-10 items-center gap-1.5 rounded-token-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-xs font-black text-fg-secondary transition hover:text-fg-primary"
                                            >
                                                <Copy className="h-3.5 w-3.5" />
                                                คัดลอกเบอร์
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => copyPaymentText('เลขอ้างอิง', activePaymentRequest.requestRef)}
                                                className="inline-flex min-h-10 items-center gap-1.5 rounded-token-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-xs font-black text-fg-secondary transition hover:text-fg-primary"
                                            >
                                                <Copy className="h-3.5 w-3.5" />
                                                คัดลอก Ref
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4">
                            <div className="mb-5 grid gap-2 sm:grid-cols-3">
                                {paymentSteps.map((step, index) => {
                                    const active = statusStepActive(activePaymentRequest.status, step.key);
                                    return (
                                        <div key={step.key} className={`rounded-token-xl border p-3 ${active ? 'border-status-success bg-status-success-subtle' : 'border-border-subtle bg-bg-base'}`}>
                                            <div className="flex items-center gap-2">
                                                <span className={`flex h-7 w-7 items-center justify-center rounded-token-full text-xs font-black ${active ? 'bg-status-success text-fg-inverse' : 'bg-bg-muted text-fg-tertiary'}`}>
                                                    {active ? <Check className="h-3.5 w-3.5" /> : index + 1}
                                                </span>
                                                <span className="text-sm font-black text-fg-primary">{step.label}</span>
                                            </div>
                                            <p className="mt-2 text-xs text-fg-tertiary">{step.value}</p>
                                        </div>
                                    );
                                })}
                            </div>

                            {canSubmitSlip ? (
                                <>
                                    <div className="mb-4 rounded-token-xl border border-border-subtle bg-bg-base p-4">
                                        <p className="font-black text-fg-primary">ขั้นตอนสุดท้าย: ส่งสลิป</p>
                                        <p className="mt-1 text-sm leading-6 text-fg-secondary">
                                            โอนตามยอดและเลขอ้างอิง แล้วส่งหลักฐานเป็นไฟล์หรือแปะลิงก์รูปสลิปโดยตรง
                                        </p>
                                    </div>

                                    <div className="mb-3 grid grid-cols-2 gap-2 rounded-token-xl border border-border-subtle bg-bg-base p-1">
                                        <button
                                            type="button"
                                            onClick={() => setSlipEvidenceMode('file')}
                                            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-token-lg px-3 py-2 text-xs font-black transition ${slipEvidenceMode === 'file' ? 'bg-status-success text-fg-inverse shadow-token-sm' : 'text-fg-secondary hover:bg-bg-elevated hover:text-fg-primary'}`}
                                        >
                                            <ImagePlus className="h-4 w-4" />
                                            อัปโหลดรูป
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSlipEvidenceMode('url');
                                                setSlipFile(null);
                                            }}
                                            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-token-lg px-3 py-2 text-xs font-black transition ${slipEvidenceMode === 'url' ? 'bg-status-success text-fg-inverse shadow-token-sm' : 'text-fg-secondary hover:bg-bg-elevated hover:text-fg-primary'}`}
                                        >
                                            <Link2 className="h-4 w-4" />
                                            แปะลิงก์รูป
                                        </button>
                                    </div>

                                    {slipEvidenceMode === 'file' ? (
                                        <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-token-xl border border-dashed border-border-accent bg-accent-subtle p-4 text-center transition hover:bg-bg-elevated">
                                            <ImagePlus className="mb-2 h-6 w-6 text-accent-bright" />
                                            <span className="text-sm font-black text-fg-primary">{slipFile ? slipFile.name : 'เลือกภาพสลิป'}</span>
                                            <span className="mt-1 text-xs text-fg-tertiary">รองรับ JPG, PNG, WEBP สูงสุด 5MB</span>
                                            <input
                                                type="file"
                                                accept="image/jpeg,image/png,image/webp"
                                                className="sr-only"
                                                onChange={handleSlipFileChange}
                                            />
                                        </label>
                                    ) : (
                                        <div className="rounded-token-xl border border-border-subtle bg-bg-base p-4">
                                            <label htmlFor="subscription-slip-image-url" className="text-sm font-black text-fg-primary">
                                                ลิงก์รูปสลิป
                                            </label>
                                            <input
                                                id="subscription-slip-image-url"
                                                type="url"
                                                inputMode="url"
                                                value={slipImageUrl}
                                                onChange={(event) => setSlipImageUrl(event.target.value)}
                                                placeholder="https://cdn.discordapp.com/... หรือ https://...fbcdn.net/..."
                                                data-testid="subscription-slip-url-input"
                                                className="mt-2 min-h-11 w-full rounded-token-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-sm font-semibold text-fg-primary outline-none transition placeholder:text-fg-muted focus:border-border-accent focus:ring-2 focus:ring-accent-soft"
                                            />
                                            <p className="mt-2 text-xs leading-5 text-fg-tertiary">
                                                ใช้ลิงก์รูปภาพโดยตรงแบบ HTTPS จาก Discord หรือ Facebook CDN เท่านั้น ไม่ใช่ลิงก์โพสต์
                                            </p>
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        onClick={handleSubmitSlip}
                                        data-testid="subscription-slip-submit"
                                        disabled={slipLoading || !canSubmitSlipEvidence}
                                        className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-token-lg bg-status-success px-4 py-3 text-sm font-black text-fg-inverse transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {slipLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                        {slipLoading ? 'กำลังตรวจสลิป...' : 'ส่งสลิปเพื่อตรวจสอบ'}
                                    </button>
                                </>
                            ) : (
                                <div className="rounded-token-xl border border-border-subtle bg-bg-base p-4">
                                    <p className="font-black text-fg-primary">ส่งสลิปแล้ว ไม่ต้องส่งซ้ำ</p>
                                    <p className="mt-2 text-sm leading-6 text-fg-secondary">
                                        สถานะล่าสุดคือ "{activePaymentStatus?.label}" ระบบจะอัปเดตเมื่อรายการนี้ถูกยืนยัน หากกำลังรอตรวจให้รอแอดมินก่อนและอย่าโอนซ้ำ
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => refreshPaymentRequests(false)}
                                        disabled={requestsLoading}
                                        className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-token-lg border border-border-subtle bg-bg-elevated px-4 py-2 text-xs font-black text-fg-secondary transition hover:text-fg-primary disabled:opacity-50"
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
                <section data-testid="subscription-payment-history" className="rounded-token-xl border border-border-subtle bg-bg-subtle p-3 shadow-token-sm sm:p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Receipt className="h-4 w-4 text-fg-info" />
                            <h3 className="text-sm font-black text-fg-primary">ประวัติชำระเงินล่าสุด</h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => refreshPaymentRequests(false)}
                            disabled={requestsLoading}
                            className="inline-flex min-h-10 items-center gap-2 rounded-token-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-[11px] font-black text-fg-secondary transition hover:text-fg-primary disabled:opacity-50"
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

            <details className="group rounded-token-xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-black text-fg-primary">ดูรายละเอียดแพลน</p>
                        <p className="mt-1 text-xs text-fg-tertiary">เปรียบเทียบ Free / Premium แบบละเอียด เก็บไว้ตรงนี้เพื่อไม่ให้ขั้นตอนชำระเงินแน่นเกินไป</p>
                    </div>
                    <span className="rounded-token-full border border-border-subtle bg-bg-base px-3 py-1 text-[10px] font-black text-fg-tertiary group-open:hidden">เปิดดู</span>
                    <span className="hidden rounded-token-full border border-border-subtle bg-bg-base px-3 py-1 text-[10px] font-black text-fg-tertiary group-open:inline-flex">ซ่อน</span>
                </summary>

                <section className="mt-4 grid gap-4 lg:grid-cols-2">
                    {BILLING_PLANS.map((tier) => {
                        const isCurrent = tier.id === effectivePlanId;
                        const Icon = tier.id === 'FREE' ? Crown : Gem;
                        const price = billing === 'monthly' ? tier.priceMonthly : tier.priceYearly;

                        return (
                            <div
                                key={tier.id}
                                className={`relative rounded-token-xl border p-4 shadow-token-sm ${tier.id === 'PREMIUM' ? 'border-status-success bg-status-success-subtle' : 'border-border-subtle bg-bg-base'}`}
                            >
                                {tier.popular && (
                                    <div className="absolute -top-3 left-5 rounded-token-full bg-status-success px-4 py-1 text-[10px] font-bold text-fg-inverse">
                                        แนะนำ
                                    </div>
                                )}
                                <div className="mb-4 flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="rounded-token-lg border border-border-subtle bg-bg-base p-2.5">
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
                                    <span className="text-2xl font-black text-fg-primary">฿{price.toLocaleString('th-TH')}</span>
                                    <span className="text-sm text-fg-tertiary">/{billing === 'monthly' ? 'เดือน' : 'ปี'}</span>
                                    {billing === 'yearly' && tier.priceYearly > 0 && (
                                        <div className="mt-1 text-xs font-bold text-fg-success">
                                            เฉลี่ย ฿{Math.round(tier.priceYearly / 12)}/เดือน
                                        </div>
                                    )}
                                </div>

                                {tier.priceMonthly > 0 && (
                                    <div className="mb-4 flex items-center gap-1.5 rounded-token-lg border border-border-subtle bg-bg-base px-3 py-1.5 text-[11px] text-fg-tertiary">
                                        <Calendar className="h-3 w-3" />
                                        ใช้งานได้ {billing === 'monthly' ? '30 วัน' : '365 วัน'} นับจากวันที่ชำระ
                                    </div>
                                )}

                                <ul className="mb-5 grid gap-2">
                                    {tier.settingsFeatures.slice(0, tier.id === 'PREMIUM' ? 6 : 3).map((feature, index) => (
                                        <li key={index} className="flex items-start gap-2 text-sm text-fg-secondary">
                                            <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${tier.id === 'PREMIUM' ? 'text-fg-success' : 'text-fg-secondary'}`} />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>

                                <div className="min-h-11 w-full rounded-token-xl border border-border-subtle bg-bg-base py-2.5 text-center text-sm font-bold text-fg-tertiary">
                                    {isCurrent ? 'แพลนปัจจุบัน' : tier.id === 'FREE' ? 'แพลนเริ่มต้น' : 'เลือกได้จากการ์ดต่ออายุด้านบน'}
                                </div>
                            </div>
                        );
                    })}
                </section>
            </details>

            <div className="rounded-token-xl border border-border-subtle bg-bg-subtle p-4 text-sm text-fg-secondary">
                <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-fg-success" />
                    <p>
                        ระบบจะไม่ขอข้อมูล QR จากสลิป ผู้ใช้ส่งแค่รูปสลิปเท่านั้น หากรายการถูกปฏิเสธ รายการเดิมจะปิดทันทีและต้องสร้างรายการใหม่เพื่อความปลอดภัยของการตรวจสอบ
                    </p>
                </div>
            </div>
        </div>
    );
}
