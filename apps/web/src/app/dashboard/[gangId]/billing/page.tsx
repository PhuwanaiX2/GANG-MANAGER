export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { and, eq, sql } from 'drizzle-orm';
import { CreditCard, KeyRound, Shield } from 'lucide-react';
import { db, gangs, getTierConfig, members } from '@gang/database';
import { authOptions } from '@/lib/auth';
import { OpsPageHeader } from '@/components/ui';
import { isPromptPayBillingRuntimeEnabled } from '@/lib/billingRuntimeFlags';
import { SubscriptionClient } from '../settings/SubscriptionClient';

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
                actions={(
                    <Link
                        href={`/dashboard/${gangId}/license`}
                        className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-token-lg border border-border-subtle bg-bg-elevated px-4 py-2 text-sm font-black text-fg-secondary transition hover:border-border-accent hover:text-accent-bright"
                    >
                        <KeyRound className="h-4 w-4" />
                        ใช้ License Key
                    </Link>
                )}
            />

            <SubscriptionClient
                gangId={gangId}
                currentTier={gang.subscriptionTier}
                expiresAt={gang.subscriptionExpiresAt}
                memberCount={memberCount}
                maxMembers={tierConfig.maxMembers}
                promptPayBillingEnabled={promptPayBillingEnabled}
            />

        </div>
    );
}
