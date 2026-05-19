export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { and, eq, sql } from 'drizzle-orm';
import { CheckCircle2, CreditCard, Receipt, Shield, Upload } from 'lucide-react';
import { db, gangs, getTierConfig, members } from '@gang/database';
import { authOptions } from '@/lib/auth';
import { OpsPageHeader } from '@/components/ui';
import { isPromptPayBillingRuntimeEnabled } from '@/lib/billingRuntimeFlags';
import { SubscriptionClient } from '../settings/SubscriptionClient';
import { LicenseActivationClient } from '../settings/LicenseActivationClient';

interface Props {
    params: Promise<{ gangId: string }>;
}

export default async function BillingPage(props: Props) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session) redirect('/');

    const { gangId } = params;

    const [gang, member] = await Promise.all([
        db.query.gangs.findFirst({
            where: eq(gangs.id, gangId),
        }),
        db.query.members.findFirst({
            where: and(
                eq(members.gangId, gangId),
                eq(members.discordId, session.user.discordId)
            ),
        }),
    ]);

    if (!gang) redirect('/dashboard');

    const isOwner = member?.gangRole === 'OWNER';
    if (!isOwner) {
        return (
            <div className="flex h-[60vh] flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-token-full bg-status-danger-subtle">
                    <Shield className="h-8 w-8 text-fg-danger" />
                </div>
                <h1 className="mb-2 text-2xl font-bold text-fg-primary">ไม่มีสิทธิ์เข้าถึง</h1>
                <p className="max-w-md text-fg-secondary">เฉพาะหัวหน้าแก๊งเท่านั้นที่จัดการแพลนและการชำระเงินได้</p>
            </div>
        );
    }

    const memberCountResult = await db.select({ count: sql<number>`count(*)` })
        .from(members)
        .where(and(eq(members.gangId, gangId), eq(members.isActive, true)));

    const tierConfig = getTierConfig(gang.subscriptionTier);
    const memberCount = memberCountResult[0]?.count || 0;
    const promptPayBillingEnabled = await isPromptPayBillingRuntimeEnabled();

    return (
        <div className="space-y-5">
            <OpsPageHeader
                eyebrow="Billing"
                title="แพลนและการชำระเงิน"
                description="ต่ออายุ Premium, ดูสถานะแพลน และติดตามรายการชำระเงินจากจุดเดียว"
                icon={CreditCard}
                tone="accent"
                compact
            />

            <BillingFlowOverview promptPayBillingEnabled={promptPayBillingEnabled} />

            <SubscriptionClient
                gangId={gangId}
                currentTier={gang.subscriptionTier}
                expiresAt={gang.subscriptionExpiresAt}
                memberCount={memberCount}
                maxMembers={tierConfig.maxMembers}
                promptPayBillingEnabled={promptPayBillingEnabled}
            />

            <details className="group rounded-token-xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-black text-fg-primary">
                    <span>มี License Key จากแอดมิน?</span>
                    <span className="rounded-token-full border border-border-subtle bg-bg-base px-3 py-1 text-[10px] font-black text-fg-tertiary group-open:hidden">เปิด</span>
                    <span className="hidden rounded-token-full border border-border-subtle bg-bg-base px-3 py-1 text-[10px] font-black text-fg-tertiary group-open:inline-flex">ซ่อน</span>
                </summary>
                <div className="mt-4">
                    <LicenseActivationClient gangId={gangId} />
                </div>
            </details>
        </div>
    );
}

function BillingFlowOverview({ promptPayBillingEnabled }: { promptPayBillingEnabled: boolean }) {
    const steps = [
        {
            label: 'สร้างบิล',
            description: 'เลือกระยะเวลา ระบบจะล็อกยอดและเลขอ้างอิงให้',
            icon: Receipt,
            tone: 'border-border-accent bg-accent-subtle text-accent-bright',
        },
        {
            label: 'โอนเงิน',
            description: 'ใช้ QR หรือ PromptPay ตามยอดที่แสดงเท่านั้น',
            icon: CreditCard,
            tone: 'border-status-success bg-status-success-subtle text-fg-success',
        },
        {
            label: 'ส่งสลิป',
            description: 'อัปโหลดสลิปจากแอปธนาคาร ระบบตรวจให้อัตโนมัติ',
            icon: Upload,
            tone: 'border-status-info bg-status-info-subtle text-fg-info',
        },
        {
            label: 'เปิดใช้งาน',
            description: 'ถ้าสลิปผ่าน แพลนจะต่ออายุทันที',
            icon: CheckCircle2,
            tone: 'border-status-success bg-status-success-subtle text-fg-success',
        },
    ];

    return (
        <section className="rounded-token-xl border border-border-subtle bg-bg-subtle p-3 shadow-token-xs sm:p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <p className="text-xs font-black text-fg-primary">ขั้นตอนชำระเงิน</p>
                    <p className="mt-1 text-sm leading-6 text-fg-secondary">
                        {promptPayBillingEnabled
                            ? 'ทำตามลำดับนี้ ถ้าสลิปไม่ผ่าน รายการเดิมจะถูกปิดและให้สร้างบิลใหม่'
                            : 'ตอนนี้ยังไม่เปิดรับชำระผ่านหน้าเว็บ แต่ยังดูสถานะแพลนและประวัติได้'}
                    </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[680px] lg:grid-cols-4">
                    {steps.map((step, index) => {
                        const Icon = step.icon;
                        return (
                            <div key={step.label} className="rounded-token-lg border border-border-subtle bg-bg-muted/70 p-3">
                                <div className="flex items-center gap-2">
                                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-token-lg border ${step.tone}`}>
                                        <Icon className="h-4 w-4" />
                                    </span>
                                    <span className="text-[10px] font-black text-fg-tertiary tabular-nums">ขั้นที่ {index + 1}</span>
                                </div>
                                <p className="mt-2 text-sm font-black text-fg-primary">{step.label}</p>
                                <p className="mt-1 line-clamp-2 text-xs leading-5 text-fg-tertiary">{step.description}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
