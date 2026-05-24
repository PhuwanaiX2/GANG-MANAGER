export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { KeyRound, Shield } from 'lucide-react';
import { db, gangs, members } from '@gang/database';
import { OpsPageHeader } from '@/components/ui';
import { authOptions } from '@/lib/auth';
import { LicenseActivationClient } from '../settings/LicenseActivationClient';

interface Props {
    params: Promise<{ gangId: string }>;
}

export default async function LicensePage(props: Props) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session) redirect('/');

    const { gangId } = params;
    const [gang, member] = await Promise.all([
        db.query.gangs.findFirst({
            where: eq(gangs.id, gangId),
            columns: {
                id: true,
                name: true,
                subscriptionTier: true,
                subscriptionExpiresAt: true,
            },
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
                <p className="max-w-md text-fg-secondary">เฉพาะหัวหน้าแก๊งเท่านั้นที่เปิดใช้งาน License Key ได้</p>
            </div>
        );
    }

    const expiresAt = gang.subscriptionExpiresAt ? new Date(gang.subscriptionExpiresAt) : null;

    return (
        <div className="mx-auto max-w-5xl space-y-5">
            <OpsPageHeader
                eyebrow="License"
                title="License Key"
                description="กรอกคีย์เพื่อเปิดหรือเติมวัน Premium ให้แก๊งนี้โดยไม่ต้องสร้างบิลชำระเงิน"
                icon={KeyRound}
                tone="accent"
                compact
            />

            <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-token-xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-fg-tertiary">Current Plan</p>
                    <h2 className="mt-2 font-heading text-2xl font-black text-fg-primary">{gang.subscriptionTier}</h2>
                    <p className="mt-2 text-sm leading-6 text-fg-secondary">
                        {expiresAt
                            ? `หมดอายุ ${expiresAt.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'long', year: 'numeric' })}`
                            : 'ยังไม่มีวันหมดอายุของแพลน'}
                    </p>
                    <div className="mt-4 rounded-token-xl border border-border-subtle bg-bg-base p-3 text-sm leading-6 text-fg-secondary">
                        License Key ใช้ได้ครั้งเดียว เมื่อเปิดใช้งานสำเร็จ ระบบจะเพิ่มวัน Premium ต่อจากวันหมดอายุเดิมของแก๊งนี้
                    </div>
                </div>

                <LicenseActivationClient gangId={gangId} />
            </section>
        </div>
    );
}
