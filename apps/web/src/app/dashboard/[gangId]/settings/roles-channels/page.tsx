export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { ArrowRight, CreditCard, Hash, Info, Settings, Shield, UserCog } from 'lucide-react';
import { db, gangRoles, gangs, members } from '@gang/database';
import { ChannelSettings } from '@/components/ChannelSettings';
import { RoleManager } from '@/components/RoleManager';
import { authOptions } from '@/lib/auth';
import { getDiscordChannels, getDiscordRoles } from '@/lib/discord-api';
import { OpsPageHeader } from '@/components/ui';
import { SettingsTabsClient } from '../SettingsTabsClient';
import { SetupReadinessPanel } from '../SetupReadinessPanel';

interface Props {
    params: Promise<{ gangId: string }>;
}

export default async function SettingsRolesChannelsPage(props: Props) {
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
            },
            with: {
                settings: {
                    columns: {
                        logChannelId: true,
                        registerChannelId: true,
                        attendanceChannelId: true,
                        financeChannelId: true,
                        announcementChannelId: true,
                        leaveChannelId: true,
                        requestsChannelId: true,
                    },
                },
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

    if (member?.gangRole !== 'OWNER') {
        return (
            <div data-testid="settings-owner-only-denied" className="flex h-[60vh] flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-token-full bg-status-danger-subtle">
                    <Shield className="h-8 w-8 text-fg-danger" />
                </div>
                <h1 className="mb-2 text-2xl font-bold text-fg-primary">ไม่มีสิทธิ์เข้าถึง</h1>
                <p className="max-w-md text-fg-secondary">เฉพาะหัวหน้าแก๊ง (Owner) เท่านั้นที่ตั้งค่าระบบได้</p>
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
            <OpsPageHeader
                eyebrow="Setup Hub"
                title="การตั้งค่า"
                description="ตั้งชื่อยศระบบและเลือกช่อง Discord ให้ตรงกับ flow /setup"
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

            <SettingsTabsClient activeTab="roles-channels">
                <SetupReadinessPanel gangId={gangId} roles={roles} settings={gang.settings} />

                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                    <div data-testid="settings-role-mapping-panel" className="rounded-token-xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm">
                        <h3 className="mb-4 flex items-center gap-2 border-b border-border-subtle pb-3 text-base font-bold text-fg-primary">
                            <UserCog className="h-5 w-5 text-accent-bright" />
                            ชื่อยศระบบ
                        </h3>
                        <RoleManager
                            gangId={gangId}
                            guildId={gang.discordGuildId}
                            initialMappings={roles}
                            discordRoles={discordRoles}
                        />
                        <p className="mt-4 flex items-center gap-1 text-xs text-fg-tertiary opacity-80">
                            <Info className="h-3 w-3" />
                            การสร้างและซ่อมยศให้ทำผ่าน /setup ใน Discord ส่วนหน้านี้ใช้เปลี่ยนชื่อยศที่ระบบผูกไว้แล้วเท่านั้น
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
            </SettingsTabsClient>
        </div>
    );
}
