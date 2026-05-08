export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { ArrowRight, CreditCard, Hash, Info, Settings, Shield, UserCog } from 'lucide-react';
import { db, gangRoles, gangs, members, normalizeSubscriptionTier } from '@gang/database';
import { ChannelSettings } from '@/components/ChannelSettings';
import { RoleManager } from '@/components/RoleManager';
import { authOptions } from '@/lib/auth';
import { getDiscordChannels, getDiscordRoles } from '@/lib/discord-api';
import { GangProfileClient } from './GangProfileClient';
import { ServerTransferClient } from './ServerTransferClient';
import { SettingsClient } from './SettingsClient';
import { SettingsTabsClient } from './SettingsTabsClient';

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
            with: { settings: true },
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
                <p className="max-w-md text-fg-secondary">
                    เฉพาะหัวหน้าแก๊ง (Owner) เท่านั้นที่ตั้งค่าระบบได้
                    <br />
                    หากคุณเป็นหัวหน้าแก๊ง โปรดตรวจสอบสิทธิ์ใน Discord อีกครั้ง
                </p>
            </div>
        );
    }

    const [roles, discordRoles, channels] = await Promise.all([
        db.query.gangRoles.findMany({
            where: eq(gangRoles.gangId, gangId),
        }),
        getDiscordRoles(gang.discordGuildId),
        getDiscordChannels(gang.discordGuildId),
    ]);

    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-4 rounded-token-xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <div className="mb-2 inline-flex items-center gap-2 rounded-token-full border border-border-subtle bg-bg-subtle px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-fg-tertiary">
                        <Settings className="h-3.5 w-3.5 text-accent-bright" />
                        Setup Hub
                    </div>
                    <h1 className="font-heading text-xl font-black tracking-tight text-fg-primary sm:text-2xl">การตั้งค่า</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-fg-secondary">
                        ตั้งค่าข้อมูลแก๊ง ยศ ช่อง Discord และงานเสี่ยงสูง แยกแพลนไปหน้า Billing เพื่อไม่ให้ปนกัน
                    </p>
                </div>
                <Link
                    href={`/dashboard/${gangId}/billing`}
                    className="inline-flex min-h-11 w-fit items-center justify-center gap-2 self-start rounded-token-lg border border-border-accent bg-accent-subtle px-4 py-2 text-sm font-black text-accent-bright transition hover:bg-bg-elevated lg:self-auto"
                >
                    <CreditCard className="h-4 w-4" />
                    ไปหน้าแพลน
                    <ArrowRight className="h-4 w-4" />
                </Link>
            </div>

            <SettingsTabsClient
                generalContent={
                    <GangProfileClient gang={{ ...gang, subscriptionTier: normalizeSubscriptionTier(gang.subscriptionTier) }} />
                }
                rolesChannelsContent={
                    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                        <div data-testid="settings-role-mapping-panel" className="rounded-token-xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm">
                            <h3 className="mb-4 flex items-center gap-2 border-b border-border-subtle pb-3 text-base font-bold text-fg-primary">
                                <UserCog className="h-5 w-5 text-accent-bright" />
                                ยศและสิทธิ์
                            </h3>
                            <RoleManager
                                gangId={gangId}
                                guildId={gang.discordGuildId}
                                initialMappings={roles}
                                discordRoles={discordRoles}
                            />
                            <p className="mt-4 flex items-center gap-1 text-xs text-fg-tertiary opacity-80">
                                <Info className="h-3 w-3" />
                                Owner ใช้เจ้าของเซิร์ฟเวอร์ Discord เป็นหลัก ส่วนยศอื่นใช้กำหนดสิทธิ์การเข้าถึง
                            </p>
                        </div>

                        <div data-testid="settings-channel-mapping-panel" className="rounded-token-xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm">
                            <h3 className="mb-4 flex items-center gap-2 border-b border-border-subtle pb-3 text-base font-bold text-fg-primary">
                                <Hash className="h-5 w-5 text-fg-tertiary" />
                                ช่อง Discord
                            </h3>
                            <ChannelSettings
                                gangId={gangId}
                                guildId={gang.discordGuildId}
                                currentSettings={{
                                    logChannelId: gang.settings?.logChannelId,
                                    registerChannelId: gang.settings?.registerChannelId,
                                    attendanceChannelId: gang.settings?.attendanceChannelId,
                                    financeChannelId: gang.settings?.financeChannelId,
                                    announcementChannelId: gang.settings?.announcementChannelId,
                                    leaveChannelId: gang.settings?.leaveChannelId,
                                    requestsChannelId: gang.settings?.requestsChannelId,
                                }}
                                channels={channels}
                            />
                        </div>
                    </div>
                }
                advancedContent={
                    <div className="space-y-6">
                        <ServerTransferClient gangId={gangId} gangName={gang.name} initialTransferStatus={gang.transferStatus} />
                        <SettingsClient gangId={gangId} gangName={gang.name} />
                    </div>
                }
            />
        </div>
    );
}
