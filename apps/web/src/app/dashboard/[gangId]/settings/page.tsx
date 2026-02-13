import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, gangs, gangSettings, gangRoles, members } from '@gang/database';
import { eq, and, sql } from 'drizzle-orm';
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
// import { DashboardLayout } from '@/components/DashboardLayout';
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
import { RoleManager } from '@/components/RoleManager';
import { ChannelSettings } from '@/components/ChannelSettings';
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
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
import { getTierConfig } from '@gang/database';
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx

=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
import { ServerTransferClient } from './ServerTransferClient';
import { getTierConfig } from '@gang/database';
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
import { ServerTransferClient } from './ServerTransferClient';
import { getTierConfig } from '@gang/database';
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
import { ServerTransferClient } from './ServerTransferClient';
import { getTierConfig } from '@gang/database';
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
import { ServerTransferClient } from './ServerTransferClient';
import { getTierConfig } from '@gang/database';
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
import { ServerTransferClient } from './ServerTransferClient';
import { getTierConfig } from '@gang/database';
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
import { ServerTransferClient } from './ServerTransferClient';
import { getTierConfig } from '@gang/database';
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
import { ServerTransferClient } from './ServerTransferClient';
import { getTierConfig } from '@gang/database';
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
import { ServerTransferClient } from './ServerTransferClient';
import { getTierConfig } from '@gang/database';
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
import { ServerTransferClient } from './ServerTransferClient';
import { getTierConfig } from '@gang/database';
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
import { ServerTransferClient } from './ServerTransferClient';
import { getTierConfig } from '@gang/database';
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
import { ServerTransferClient } from './ServerTransferClient';
import { getTierConfig } from '@gang/database';
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
import { ServerTransferClient } from './ServerTransferClient';
import { LicenseActivationClient } from './LicenseActivationClient';
import { getTierConfig } from '@gang/database';
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
import { ServerTransferClient } from './ServerTransferClient';
import { LicenseActivationClient } from './LicenseActivationClient';
import { getTierConfig } from '@gang/database';
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx

interface Props {
    params: { gangId: string };
}

export default async function SettingsPage({ params }: Props) {
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
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                    <Shield className="w-8 h-8 text-red-500" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">ไม่มีสิทธิ์เข้าถึง</h1>
                <p className="text-gray-400 max-w-md">
                    เฉพาะหัวหน้าแก๊ง (Owner) เท่านั้นที่สามารถตั้งค่าระบบได้
                    <br />หากคุณเป็นหัวหน้าแก๊ง โปรดตรวจสอบยศใน Discord
                </p>
            </div>
        );
    }

<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
    // Get remaining Discord data in parallel (Cached for 5 mins)
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
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

    return (
        <>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 mb-2">การตั้งค่า</h1>
                    <p className="text-gray-400 flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        จัดการข้อมูลและกำหนดค่าต่างๆ ของแก๊ง
                    </p>
                </div>
            </div>

            <SettingsTabsClient
                generalContent={
                    <GangProfileClient gang={gang} />
                }
                rolesChannelsContent={
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-[#151515] p-6 rounded-2xl border border-white/5 shadow-xl">
                            <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-white border-b border-white/5 pb-4">
                                <UserCog className="w-5 h-5 text-purple-400" />
                                การตั้งค่ายศ (Roles)
                            </h3>
                            <RoleManager
                                gangId={gangId}
                                guildId={gang.discordGuildId}
                                initialMappings={roles}
                                discordRoles={discordRoles}
                            />
                            <p className="text-xs text-secondary-text mt-4 flex items-center gap-1 opacity-60">
                                <Info className="w-3 h-3" />
                                เลือกยศใน Discord ให้ตรงกับตำแหน่งในแก๊ง เพื่อกำหนดสิทธิ์การเข้าถึง
                            </p>
                        </div>
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx

                        <div className="bg-[#151515] p-6 rounded-2xl border border-white/5 shadow-xl">
                            <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-white border-b border-white/5 pb-4">
                                <Hash className="w-5 h-5 text-gray-400" />
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
                    <SubscriptionClient
                        gangId={gangId}
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
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

                {/* Danger Zone */}
                <SettingsClient gangId={gangId} gangName={gang.name} />

                {/* Server Transfer */}
                <ServerTransferClient gangId={gangId} gangName={gang.name} />
            </div>

            {/* Subscription Management */}
            <div className="mt-10 max-w-5xl">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Key className="w-5 h-5 text-yellow-400" />
                    การสมัครสมาชิก & แพลน
                </h2>
                <SubscriptionClient
                    gangId={gangId}
                    currentTier={gang.subscriptionTier}
                    expiresAt={gang.subscriptionExpiresAt}
                    memberCount={memberCount}
                    maxMembers={tierConfig.maxMembers}
                />
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
            </div>

            {/* Subscription Management */}
            <div className="mt-10 max-w-5xl">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Key className="w-5 h-5 text-yellow-400" />
                    การสมัครสมาชิก & แพลน
                </h2>
                <SubscriptionClient
                    gangId={gangId}
                    currentTier={gang.subscriptionTier}
                    expiresAt={gang.subscriptionExpiresAt}
                    memberCount={memberCount}
                    maxMembers={tierConfig.maxMembers}
                />
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
            </div>
=======
                        currentTier={gang.subscriptionTier}
                        expiresAt={gang.subscriptionExpiresAt}
                        memberCount={memberCount}
                        maxMembers={tierConfig.maxMembers}
                    />
=======
                        currentTier={gang.subscriptionTier}
                        expiresAt={gang.subscriptionExpiresAt}
                        memberCount={memberCount}
                        maxMembers={tierConfig.maxMembers}
                    />
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
                        currentTier={gang.subscriptionTier}
                        expiresAt={gang.subscriptionExpiresAt}
                        memberCount={memberCount}
                        maxMembers={tierConfig.maxMembers}
                    />
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
                        currentTier={gang.subscriptionTier}
                        expiresAt={gang.subscriptionExpiresAt}
                        memberCount={memberCount}
                        maxMembers={tierConfig.maxMembers}
                    />
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
                        currentTier={gang.subscriptionTier}
                        expiresAt={gang.subscriptionExpiresAt}
                        memberCount={memberCount}
                        maxMembers={tierConfig.maxMembers}
                    />
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
                        currentTier={gang.subscriptionTier}
                        expiresAt={gang.subscriptionExpiresAt}
                        memberCount={memberCount}
                        maxMembers={tierConfig.maxMembers}
                    />
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
                }
                advancedContent={
                    <div className="space-y-6">
                        <ServerTransferClient gangId={gangId} gangName={gang.name} />
=======

=======

>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
                        <div className="bg-[#151515] p-6 rounded-2xl border border-white/5 shadow-xl">
                            <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-white border-b border-white/5 pb-4">
                                <Hash className="w-5 h-5 text-gray-400" />
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
                        />
                        <LicenseActivationClient gangId={gangId} />
                    </div>
                }
                advancedContent={
                    <div className="space-y-6">
                        <ServerTransferClient gangId={gangId} gangName={gang.name} initialTransferStatus={gang.transferStatus} />
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
                        <SettingsClient gangId={gangId} gangName={gang.name} />
                    </div>
                }
            />
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/dashboard/[gangId]/settings/page.tsx
        </>
    );
}
