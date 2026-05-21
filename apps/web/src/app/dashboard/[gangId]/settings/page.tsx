export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { ArrowRight, CreditCard, Settings, Shield } from 'lucide-react';
import { db, gangs, members, normalizeSubscriptionTier } from '@gang/database';
import { authOptions } from '@/lib/auth';
import { GangProfileClient } from './GangProfileClient';
import { SettingsTabsClient } from './SettingsTabsClient';
import { OpsPageHeader } from '@/components/ui';

interface Props {
    params: Promise<{ gangId: string }>;
}

export default async function SettingsPage(props: Props) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session) redirect('/');

    const { gangId } = params;

    const [gang, member] = await Promise.all([
        db.query.gangs.findFirst({
            where: eq(gangs.id, gangId),
            columns: {
                id: true,
                discordGuildId: true,
                name: true,
                logoUrl: true,
                subscriptionTier: true,
                transferStatus: true,
            },
        }),
        db.query.members.findFirst({
            where: and(
                eq(members.gangId, gangId),
                eq(members.discordId, session.user.discordId)
            ),
            columns: { gangRole: true },
        }),
    ]);

    if (!gang) redirect('/dashboard');

    const isOwner = member?.gangRole === 'OWNER';

    if (!isOwner) {
        return (
            <div data-testid="settings-owner-only-denied" className="flex h-[60vh] flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-token-full bg-status-danger-subtle">
                    <Shield className="h-8 w-8 text-fg-danger" />
                </div>
                <h1 className="mb-2 text-2xl font-bold text-fg-primary">ไม่มีสิทธิ์เข้าถึง</h1>
                <p className="max-w-md text-fg-secondary">
                    เฉพาะหัวหน้าแก๊ง (Owner) เท่านั้นที่ตั้งค่าระบบได้
                    <br />
                    หากคุณเป็นหัวหน้าแก๊ง โปรดตรวจสอบสิทธิ์ใน Discord อีกครั้ง
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <OpsPageHeader
                eyebrow="Setup Hub"
                title="การตั้งค่า"
                description="ตั้งค่าข้อมูลแก๊ง ยศ ช่อง Discord และงานเสี่ยงสูง แยกแพลนไปหน้า Billing เพื่อไม่ให้ปนกัน"
                icon={Settings}
                tone="accent"
                compact
                actions={(
                    <Link
                        href={`/dashboard/${gangId}/billing`}
                        className="inline-flex min-h-11 w-fit items-center justify-center gap-2 self-start rounded-token-lg border border-border-accent bg-accent-subtle px-4 py-2 text-sm font-black text-accent-bright transition hover:bg-bg-elevated lg:self-auto"
                    >
                        <CreditCard className="h-4 w-4" />
                        ไปหน้าแพลน
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                )}
            />

            <SettingsTabsClient activeTab="general">
                <GangProfileClient gang={{ ...gang, subscriptionTier: normalizeSubscriptionTier(gang.subscriptionTier) }} />
            </SettingsTabsClient>
        </div>
    );
}
