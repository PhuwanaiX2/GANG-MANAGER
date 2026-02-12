import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, gangs, gangSettings, gangRoles, members } from '@gang/database';
import { eq, and } from 'drizzle-orm';
// import { DashboardLayout } from '@/components/DashboardLayout';
import { RoleManager } from '@/components/RoleManager';
import { ChannelSettings } from '@/components/ChannelSettings';
import { SettingsClient } from './SettingsClient';
import { GangProfileClient } from './GangProfileClient';
import {
    Settings,
    Shield,
    Hash,
    Info,
    Key,
    UserCog
} from 'lucide-react';

import { getGangPermissions } from '@/lib/permissions';
import { getDiscordRoles, getDiscordChannels } from '@/lib/discord-api';

interface Props {
    params: { gangId: string };
}

export default async function SettingsPage({ params }: Props) {
    const session = await getServerSession(authOptions);
    if (!session) redirect('/');

    const { gangId } = params;

    // Optimization: Fetch all required data in parallel to avoid waterfall
    const [gang, member] = await Promise.all([
        db.query.gangs.findFirst({
            where: eq(gangs.id, gangId),
            with: {
                settings: true,
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

    // Manual Permission Check (Avoid redundancy)
    // Only OWNER can access settings
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

    // Get remaining Discord data in parallel (Cached for 5 mins)
    const [roles, discordRoles, channels] = await Promise.all([
        db.query.gangRoles.findMany({
            where: eq(gangRoles.gangId, gangId),
        }),
        getDiscordRoles(gang.discordGuildId),
        getDiscordChannels(gang.discordGuildId)
    ]);

    return (
        <>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 mb-2">การตั้งค่า</h1>
                    <p className="text-gray-400 flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        จัดการข้อมูลและกำหนดค่าต่างๆ ของแก๊ง
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl">
                {/* Gang Info */}
                {/* Gang Info */}
                <GangProfileClient gang={gang} />
                {/* Role Mappings */}
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

                {/* Channels */}
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
                        }}
                        channels={channels}
                    />
                </div>

                {/* Danger Zone */}
                <SettingsClient gangId={gangId} gangName={gang.name} />
            </div>
        </>
    );
}
