export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, gangs, gangSettings, gangRoles, members, getTierConfig, normalizeSubscriptionTier } from '@gang/database';
import { eq, and, sql } from 'drizzle-orm';
import { RoleManager } from '@/components/RoleManager';
import { ChannelSettings } from '@/components/ChannelSettings';
import { isPromptPayBillingEnabled } from '@/lib/promptPayBilling';
import { SettingsClient } from './SettingsClient';
import { GangProfileClient } from './GangProfileClient';
import { SettingsTabsClient } from './SettingsTabsClient';
import {
    Settings,
    Shield,
    Hash,
    Info,
    UserCog
} from 'lucide-react';

import { getDiscordRoles, getDiscordChannels } from '@/lib/discord-api';
import { SubscriptionClient } from './SubscriptionClient';
import { ServerTransferClient } from './ServerTransferClient';
import { LicenseActivationClient } from './LicenseActivationClient';

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
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                <div className="w-16 h-16 bg-status-danger-subtle rounded-token-full flex items-center justify-center mb-4">
                    <Shield className="w-8 h-8 text-fg-danger" />
                </div>
                <h1 className="text-2xl font-bold text-fg-primary mb-2">ไม่มีสิทธิ์เข้าถึง</h1>
                <p className="text-fg-secondary max-w-md">
                    เฉพาะหัวหน้าแก๊ง (Owner) เท่านั้นที่สามารถตั้งค่าระบบได้
                    <br />หากคุณเป็นหัวหน้าแก๊ง โปรดตรวจสอบ role ใน Discord
                </p>
            </div>
        );
    }

    const [roles, discordRoles, channels, memberCountResult] = await Promise.all([
        db.query.gangRoles.findMany({
            where: eq(gangRoles.gangId, gangId),
        }),
        getDiscordRoles(gang.discordGuildId),
        getDiscordChannels(gang.discordGuildId),
        db.select({ count: sql<number>`count(*)` })
            .from(members)
            .where(and(eq(members.gangId, gangId), eq(members.isActive, true)))
    ]);

    const tierConfig = getTierConfig(gang.subscriptionTier);
    const memberCount = memberCountResult[0]?.count || 0;
    const promptPayBillingEnabled = isPromptPayBillingEnabled();

    return (
        <>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-fg-primary font-heading mb-2">การตั้งค่า</h1>
                    <p className="text-fg-secondary flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        จัดการข้อมูล ยศ ช่อง Discord แพลน และเครื่องมือขั้นสูงของแก๊ง
                    </p>
                </div>
            </div>

            <SettingsTabsClient
                generalContent={
                    <GangProfileClient gang={{ ...gang, subscriptionTier: normalizeSubscriptionTier(gang.subscriptionTier) }} />
                }
                rolesChannelsContent={
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div data-testid="settings-role-mapping-panel" className="bg-bg-subtle p-6 rounded-token-2xl border border-border-subtle shadow-token-sm">
                            <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-fg-primary border-b border-border-subtle pb-4">
                                <UserCog className="w-5 h-5 text-accent-bright" />
                                ตั้งค่ายศและสิทธิ์
                            </h3>
                            <RoleManager
                                gangId={gangId}
                                guildId={gang.discordGuildId}
                                initialMappings={roles}
                                discordRoles={discordRoles}
                            />
                            <p className="text-xs text-fg-tertiary mt-4 flex items-center gap-1 opacity-80">
                                <Info className="w-3 h-3" />
                                เลือก role ใน Discord ให้ตรงกับตำแหน่งในแก๊ง เพื่อกำหนดสิทธิ์การเข้าถึงให้ปลอดภัย
                            </p>
                        </div>

                        <div data-testid="settings-channel-mapping-panel" className="bg-bg-subtle p-6 rounded-token-2xl border border-border-subtle shadow-token-sm">
                            <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-fg-primary border-b border-border-subtle pb-4">
                                <Hash className="w-5 h-5 text-fg-tertiary" />
                                ตั้งค่า Channels
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
                subscriptionContent={
                    <div className="space-y-6">
                        <SubscriptionClient
                            gangId={gangId}
                            currentTier={gang.subscriptionTier}
                            expiresAt={gang.subscriptionExpiresAt}
                            memberCount={memberCount}
                            maxMembers={tierConfig.maxMembers}
                            promptPayBillingEnabled={promptPayBillingEnabled}
                        />
                        <LicenseActivationClient gangId={gangId} />
                    </div>
                }
                advancedContent={
                    <div className="space-y-6">
                        <ServerTransferClient gangId={gangId} gangName={gang.name} initialTransferStatus={gang.transferStatus} />
                        <SettingsClient gangId={gangId} gangName={gang.name} />
                    </div>
                }
            />
        </>
    );
}
