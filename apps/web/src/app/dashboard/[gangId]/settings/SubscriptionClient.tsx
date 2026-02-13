'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Crown, Zap, Gem, Loader2, Check, ArrowRight, Clock, RefreshCw, AlertTriangle, CreditCard, QrCode, Info, Sparkles, Calendar } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
    gangId: string;
    currentTier: string;
    expiresAt: Date | null;
    memberCount: number;
    maxMembers: number;
}

interface TierInfo {
    id: string;
    name: string;
    rank: number;
    priceMonthly: number;
    priceYearly: number;
    icon: typeof Crown;
    color: string;
    maxMembers: number;
    features: string[];
    popular?: boolean;
}

const TIERS: TierInfo[] = [
    {
        id: 'FREE',
        name: 'Free',
        rank: 0,
        priceMonthly: 0,
        priceYearly: 0,
        icon: Crown,
        color: 'gray',
        maxMembers: 10,
        features: ['สมาชิกสูงสุด 10 คน', 'ลงทะเบียน + เช็คชื่อ + แจ้งลา', 'Audit Log 7 วัน'],
    },
    {
        id: 'PRO',
        name: 'Pro',
        rank: 1,
        priceMonthly: 149,
        priceYearly: 1490,
        icon: Zap,
        color: 'blue',
        maxMembers: 25,
        features: ['สมาชิกสูงสุด 25 คน', 'ระบบการเงินเต็มรูปแบบ', 'Export CSV', 'สรุปรายเดือน', 'Backup รายวัน', 'Audit Log 90 วัน'],
        popular: true,
    },
    {
        id: 'PREMIUM',
        name: 'Premium',
        rank: 2,
        priceMonthly: 299,
        priceYearly: 2990,
        icon: Gem,
        color: 'purple',
        maxMembers: 40,
        features: ['สมาชิกสูงสุด 40 คน', 'ทุกอย่างใน Pro', 'Analytics Dashboard', 'Audit Log ไม่จำกัด', 'Priority Support'],
    },
];

export function SubscriptionClient({ gangId, currentTier, expiresAt, memberCount, maxMembers }: Props) {
    const [loading, setLoading] = useState<string | null>(null);
    const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
    const searchParams = useSearchParams();

    const currentRank = useMemo(() => TIERS.find(t => t.id === currentTier)?.rank ?? 0, [currentTier]);
    const isPaid = currentTier !== 'FREE' && currentTier !== 'TRIAL';

    // Expiry info
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

    const handleCheckout = async (tier: string) => {
        if (tier === 'FREE') return;

        setLoading(tier);
        try {
            const res = await fetch('/api/stripe/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gangId, tier, billing }),
            });

            if (!res.ok) {
                const err = await res.json();
                toast.error(err.error || 'เกิดข้อผิดพลาด');
                return;
            }

            const { url } = await res.json();
            if (url) {
                window.location.href = url;
            }
        } catch {
            toast.error('ไม่สามารถเชื่อมต่อระบบชำระเงินได้');
        } finally {
            setLoading(null);
        }
    };

    const colorMap: Record<string, { bg: string; border: string; text: string; button: string; glow: string }> = {
        gray: { bg: 'bg-gray-500/5', border: 'border-gray-500/20', text: 'text-gray-400', button: 'bg-gray-600 hover:bg-gray-500', glow: '' },
        blue: { bg: 'bg-blue-500/5', border: 'border-blue-500/30', text: 'text-blue-400', button: 'bg-blue-600 hover:bg-blue-500', glow: 'shadow-blue-500/10' },
        purple: { bg: 'bg-purple-500/5', border: 'border-purple-500/30', text: 'text-purple-400', button: 'bg-purple-600 hover:bg-purple-500', glow: 'shadow-purple-500/10' },
    };

    // Calculate proration preview for upgrade
    const getUpgradePreview = (targetTier: TierInfo) => {
        if (!isPaid || !expiryInfo || expiryInfo.isExpired) return null;
        const currentTierInfo = TIERS.find(t => t.id === currentTier);
        if (!currentTierInfo || currentTierInfo.rank >= targetTier.rank) return null;

        const oldDaily = currentTierInfo.priceMonthly / 30;
        const newDaily = targetTier.priceMonthly / 30;
        if (oldDaily <= 0 || newDaily <= 0) return null;

        const bonusDays = Math.floor(expiryInfo.diffDays * (oldDaily / newDaily));
        const billingDays = billing === 'monthly' ? 30 : 365;
        const totalDays = billingDays + bonusDays;
        return { bonusDays, totalDays, billingDays };
    };

    return (
        <div className="space-y-6">
            {/* Current Plan Status */}
            <div className={`border rounded-2xl p-6 ${
                expiryInfo?.isExpired ? 'bg-red-500/5 border-red-500/20' :
                expiryInfo?.isExpiringSoon ? 'bg-yellow-500/5 border-yellow-500/20' :
                'bg-white/[0.02] border-white/5'
            }`}>
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-white font-bold text-lg">
                            แพลนปัจจุบัน: <span className="text-discord-primary">{currentTier}</span>
                        </h3>
                        <p className="text-gray-500 text-sm mt-1">
                            สมาชิก: {memberCount}/{maxMembers} คน
                        </p>
                        {isPaid && expiryInfo && (
                            <div className={`flex items-center gap-1.5 mt-2 text-sm font-medium ${
                                expiryInfo.isExpired ? 'text-red-400' :
                                expiryInfo.isExpiringSoon ? 'text-yellow-400' :
                                'text-emerald-400'
                            }`}>
                                {expiryInfo.isExpired ? (
                                    <AlertTriangle className="w-4 h-4" />
                                ) : (
                                    <Clock className="w-4 h-4" />
                                )}
                                {expiryInfo.isExpired
                                    ? 'หมดอายุแล้ว — กรุณาต่ออายุเพื่อใช้งานต่อ'
                                    : `เหลืออีก ${expiryInfo.diffDays} วัน (หมดอายุ ${expiryInfo.date.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })})`
                                }
                            </div>
                        )}
                    </div>
                    {/* Usage bar */}
                    <div className="w-32">
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all ${memberCount / maxMembers > 0.8 ? 'bg-red-500' : 'bg-emerald-500'}`}
                                style={{ width: `${Math.min((memberCount / maxMembers) * 100, 100)}%` }}
                            />
                        </div>
                        <span className="text-[10px] text-gray-500 mt-1 block text-right">{Math.round((memberCount / maxMembers) * 100)}%</span>
                    </div>
                </div>

                {/* Renew button for expiring/expired paid plans */}
                {isPaid && expiryInfo && (expiryInfo.isExpiringSoon || expiryInfo.isExpired) && (
                    <button
                        onClick={() => handleCheckout(currentTier)}
                        disabled={!!loading}
                        className="mt-4 w-full py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {loading === currentTier ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <RefreshCw className="w-4 h-4" />
                        )}
                        {loading === currentTier ? 'กำลังเปิดหน้าชำระเงิน...' : `ต่ออายุ ${currentTier}`}
                    </button>
                )}

                {/* Info: no auto-charge */}
                {isPaid && (
                    <p className="mt-3 text-[11px] text-gray-600 flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5" />
                        ไม่มีการตัดเงินอัตโนมัติ — เมื่อหมดอายุแพลนจะกลับเป็น Free
                    </p>
                )}
            </div>

            {/* How it works - Tips */}
            {isPaid && expiryInfo && !expiryInfo.isExpired && (
                <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                        <Sparkles className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                        <div className="space-y-1.5">
                            <p className="text-xs font-bold text-blue-300">อัปเกรดแพลนทำงานยังไง?</p>
                            <ul className="text-[11px] text-gray-400 space-y-1">
                                <li>- มูลค่าวันที่เหลือจะถูกคำนวณและแปลงเป็นวันของแพลนใหม่อัตโนมัติ</li>
                                <li>- ตัวอย่าง: เหลือ 20 วัน Pro (฿99/วัน) อัปเป็น Premium → ได้ ~10 วัน bonus</li>
                                <li>- ต่ออายุแพลนเดิม = เพิ่มวันต่อจากที่เหลืออยู่</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment methods info */}
            <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" /> บัตรเครดิต/เดบิต</span>
                <span className="text-gray-700">|</span>
                <span className="flex items-center gap-1.5"><QrCode className="w-3.5 h-3.5" /> PromptPay QR</span>
            </div>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-1 p-1 bg-white/5 rounded-xl w-fit mx-auto border border-white/10">
                <button
                    onClick={() => setBilling('monthly')}
                    className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                        billing === 'monthly'
                            ? 'bg-discord-primary text-white shadow-lg shadow-discord-primary/20'
                            : 'text-gray-400 hover:text-white'
                    }`}
                >
                    รายเดือน (30 วัน)
                </button>
                <button
                    onClick={() => setBilling('yearly')}
                    className={`px-5 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                        billing === 'yearly'
                            ? 'bg-discord-primary text-white shadow-lg shadow-discord-primary/20'
                            : 'text-gray-400 hover:text-white'
                    }`}
                >
                    รายปี (365 วัน)
                    <span className="text-[10px] font-black tracking-wider bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        ประหยัด 17%
                    </span>
                </button>
            </div>

            {/* Pricing Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {TIERS.map((tier) => {
                    const isCurrent = tier.id === currentTier;
                    const isLower = tier.rank < currentRank && tier.rank > 0;
                    const isUpgrade = tier.rank > currentRank;
                    const colors = colorMap[tier.color];
                    const Icon = tier.icon;
                    const upgradePreview = isUpgrade ? getUpgradePreview(tier) : null;

                    return (
                        <div
                            key={tier.id}
                            className={`relative ${colors.bg} border ${isCurrent ? 'border-discord-primary/50 ring-1 ring-discord-primary/20' : colors.border} rounded-2xl p-6 transition-all hover:scale-[1.02] ${isCurrent ? `shadow-lg ${colors.glow}` : ''} ${isLower && !isCurrent ? 'opacity-50' : ''}`}
                        >
                            {tier.popular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-black tracking-widest uppercase px-4 py-1 rounded-full">
                                    แนะนำ
                                </div>
                            )}

                            <div className="flex items-center gap-3 mb-4">
                                <div className={`p-2 rounded-xl ${colors.bg} border ${colors.border}`}>
                                    <Icon className={`w-5 h-5 ${colors.text}`} />
                                </div>
                                <div>
                                    <h4 className="text-white font-bold">{tier.name}</h4>
                                    <span className="text-gray-500 text-xs">สูงสุด {tier.maxMembers} คน</span>
                                </div>
                            </div>

                            <div className="mb-4">
                                <span className="text-3xl font-black text-white">
                                    ฿{billing === 'monthly' ? tier.priceMonthly : tier.priceYearly}
                                </span>
                                <span className="text-gray-500 text-sm">/{billing === 'monthly' ? 'เดือน' : 'ปี'}</span>
                                {billing === 'yearly' && tier.priceYearly > 0 && (
                                    <div className="text-emerald-400 text-xs font-bold mt-1">
                                        เฉลี่ย ฿{Math.round(tier.priceYearly / 12)}/เดือน
                                    </div>
                                )}
                            </div>

                            {/* Duration badge */}
                            {tier.priceMonthly > 0 && (
                                <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mb-4 bg-white/[0.03] rounded-lg px-3 py-1.5 border border-white/5">
                                    <Calendar className="w-3 h-3" />
                                    ใช้งานได้ {billing === 'monthly' ? '30 วัน' : '365 วัน'} นับจากวันชำระ
                                </div>
                            )}

                            <ul className="space-y-2 mb-6">
                                {tier.features.map((f, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                                        <Check className={`w-4 h-4 mt-0.5 shrink-0 ${colors.text}`} />
                                        {f}
                                    </li>
                                ))}
                            </ul>

                            {/* Upgrade proration preview */}
                            {upgradePreview && (
                                <div className="mb-4 bg-emerald-500/5 border border-emerald-500/15 rounded-lg px-3 py-2">
                                    <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-1.5">
                                        <Sparkles className="w-3 h-3" />
                                        อัปเกรดจะได้รับ: {upgradePreview.billingDays} + {upgradePreview.bonusDays} วัน (รวม {upgradePreview.totalDays} วัน)
                                    </p>
                                </div>
                            )}

                            {isCurrent && isPaid ? (
                                <button
                                    onClick={() => handleCheckout(tier.id)}
                                    disabled={!!loading}
                                    className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {loading === tier.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <RefreshCw className="w-4 h-4" />
                                    )}
                                    {loading === tier.id ? 'กำลังเปิดหน้าชำระเงิน...' : `ต่ออายุ (+${billing === 'monthly' ? '30' : '365'} วัน)`}
                                </button>
                            ) : isCurrent ? (
                                <button
                                    disabled
                                    className="w-full py-2.5 rounded-xl text-sm font-bold bg-white/5 text-gray-500 border border-white/10 cursor-default"
                                >
                                    แพลนปัจจุบัน
                                </button>
                            ) : tier.id === 'FREE' ? (
                                <div className="w-full py-2.5 rounded-xl text-sm font-bold bg-white/5 text-gray-600 border border-white/5 text-center">
                                    แพลนเริ่มต้น
                                </div>
                            ) : isLower ? (
                                <div className="w-full py-2.5 rounded-xl text-sm font-bold bg-white/5 text-gray-600 border border-white/5 text-center">
                                    แพลนต่ำกว่าปัจจุบัน
                                </div>
                            ) : isUpgrade ? (
                                <button
                                    onClick={() => handleCheckout(tier.id)}
                                    disabled={!!loading}
                                    className={`w-full py-2.5 rounded-xl text-sm font-bold text-white ${colors.button} transition-colors flex items-center justify-center gap-2 disabled:opacity-50`}
                                >
                                    {loading === tier.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <ArrowRight className="w-4 h-4" />
                                    )}
                                    {loading === tier.id ? 'กำลังเปิดหน้าชำระเงิน...' : 'อัปเกรด'}
                                </button>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
