export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { and, eq, sql } from 'drizzle-orm';
import { CreditCard, Shield } from 'lucide-react';
import { db, gangs, getTierConfig, members } from '@gang/database';
import { authOptions } from '@/lib/auth';
import { isPromptPayBillingEnabled } from '@/lib/promptPayBilling';
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
    const promptPayBillingEnabled = isPromptPayBillingEnabled();

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <div className="mb-2 inline-flex items-center gap-2 rounded-token-full border border-border-subtle bg-bg-subtle px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-fg-tertiary">
                        <CreditCard className="h-3.5 w-3.5 text-accent-bright" />
                        Billing
                    </div>
                    <h1 className="font-heading text-3xl font-black tracking-tight text-fg-primary sm:text-4xl">แพลนและการชำระเงิน</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-fg-secondary">
                        ต่ออายุ Premium ด้วย PromptPay สร้างรายการตามยอดที่แสดง แล้วส่งสลิปด้วยรูปภาพหรือ URL ให้ระบบตรวจสอบ
                    </p>
                </div>
            </div>

            <SubscriptionClient
                gangId={gangId}
                currentTier={gang.subscriptionTier}
                expiresAt={gang.subscriptionExpiresAt}
                memberCount={memberCount}
                maxMembers={tierConfig.maxMembers}
                promptPayBillingEnabled={promptPayBillingEnabled}
            />

            <details className="group rounded-token-2xl border border-border-subtle bg-bg-subtle p-5 shadow-token-sm">
                <summary className="cursor-pointer list-none text-sm font-black text-fg-primary">
                    มี License Key จากแอดมิน?
                    <span className="ml-2 text-xs font-semibold text-fg-tertiary">ตัวเลือกสำรอง ไม่ใช่ขั้นตอนปกติของ PromptPay</span>
                </summary>
                <div className="mt-4">
                    <LicenseActivationClient gangId={gangId} />
                </div>
            </details>
        </div>
    );
}
