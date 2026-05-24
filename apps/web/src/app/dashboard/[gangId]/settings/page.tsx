export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { ArrowRight, CreditCard, Hash, Settings, Shield, ShieldAlert, UserCog } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { db, gangs, members, normalizeSubscriptionTier } from '@gang/database';
import { authOptions } from '@/lib/auth';
import { GangProfileClient } from './GangProfileClient';
import { SettingsTabsClient } from './SettingsTabsClient';
import { OpsPageHeader } from '@/components/ui';

interface Props {
    params: Promise<{ gangId: string }>;
    searchParams?: Promise<{ tab?: string | string[] }>;
}

export default async function SettingsPage(props: Props) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session) redirect('/');

    const { gangId } = params;
    const searchParams = props.searchParams ? await props.searchParams : undefined;
    const requestedTab = Array.isArray(searchParams?.tab) ? searchParams?.tab[0] : searchParams?.tab;

    if (requestedTab === 'roles-channels') {
        redirect(`/dashboard/${gangId}/settings/roles-channels`);
    }

    if (requestedTab === 'advanced') {
        redirect(`/dashboard/${gangId}/settings/advanced`);
    }

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
                <div className="space-y-5">
                    <section className="rounded-token-xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm">
                        <div className="mb-4">
                            <p className="text-xs font-black uppercase tracking-wide text-fg-tertiary">Setup path</p>
                            <h3 className="mt-1 text-base font-black text-fg-primary">ลำดับการตั้งค่าที่แนะนำ</h3>
                            <p className="mt-1 max-w-2xl text-sm leading-6 text-fg-secondary">
                                Discord เป็นตัวสร้างยศและห้อง ส่วนเว็บใช้ปรับค่าที่ปลอดภัยและตรวจสถานะ เพื่อให้ทั้งสองฝั่งไม่แย่งกันเป็นเจ้าของข้อมูล
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                            <SetupStepCard
                                href={`/dashboard/${gangId}/settings/roles-channels`}
                                icon={UserCog}
                                title="ยศระบบ"
                                description="เปลี่ยนชื่อยศที่ bot สร้างไว้ และตรวจว่ามีครบก่อนใช้งานจริง"
                            />
                            <SetupStepCard
                                href={`/dashboard/${gangId}/settings/roles-channels`}
                                icon={Hash}
                                title="ช่อง Discord"
                                description="เลือกปลายทางข้อความของบอท แยก panel, คำขอ, log และงานสำคัญให้ชัด"
                            />
                            <SetupStepCard
                                href={`/dashboard/${gangId}/settings/advanced`}
                                icon={ShieldAlert}
                                title="ขั้นสูง"
                                description="ย้ายเซิร์ฟเวอร์ ยุบแก๊ง และงานที่ต้องยืนยันแบบ Owner-only"
                            />
                        </div>

                        <div className="mt-3 rounded-token-lg border border-border-subtle bg-bg-muted px-3 py-2 text-xs font-semibold leading-5 text-fg-tertiary">
                            ถ้าต้องสร้างหรือซ่อม role/channel ให้ใช้ <span className="font-black text-fg-primary">/setup repair</span> ใน Discord ก่อน แล้วกลับมาตรวจในเว็บ
                        </div>
                    </section>

                    <GangProfileClient gang={{ ...gang, subscriptionTier: normalizeSubscriptionTier(gang.subscriptionTier) }} />
                </div>
            </SettingsTabsClient>
        </div>
    );
}

function SetupStepCard({
    href,
    icon: Icon,
    title,
    description,
}: {
    href: string;
    icon: LucideIcon;
    title: string;
    description: string;
}) {
    return (
        <Link
            href={href}
            className="group flex min-h-28 flex-col justify-between rounded-token-xl border border-border-subtle bg-bg-muted p-4 transition-colors hover:border-border-accent hover:bg-bg-elevated"
        >
            <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-token-lg border border-border-subtle bg-bg-subtle text-accent-bright">
                    <Icon className="h-5 w-5" />
                </span>
                <ArrowRight className="h-4 w-4 text-fg-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-accent-bright" />
            </div>
            <div className="mt-3">
                <h4 className="text-sm font-black text-fg-primary">{title}</h4>
                <p className="mt-1 text-xs leading-5 text-fg-secondary">{description}</p>
            </div>
        </Link>
    );
}
