export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { ArrowRight, CreditCard, Hash, Settings, Shield, UserCog } from 'lucide-react';
import { db, gangRoles, gangs, members } from '@gang/database';
import { ChannelSettings } from '@/components/ChannelSettings';
import { RoleManager } from '@/components/RoleManager';
import { DiscordRoleSyncButton } from '@/components/DiscordRoleSyncButton';
import { authOptions } from '@/lib/auth';
import { getDiscordChannels, getDiscordRoles } from '@/lib/discord-api';
import { OpsPageHeader } from '@/components/ui';
import { SettingsTabsClient } from '../SettingsTabsClient';

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
                        verifyChannelId: true,
                        logChannelId: true,
                        registerChannelId: true,
                        attendanceChannelId: true,
                        attendanceSummaryChannelId: true,
                        financeChannelId: true,
                        announcementChannelId: true,
                        leaveChannelId: true,
                        approvedLeaveChannelId: true,
                        requestsChannelId: true,
                        websiteChannelId: true,
                        adminPanelChannelId: true,
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
    const rolePermissionSet = new Set(roles.map((role) => role.permissionLevel));
    const channelSettings = gang.settings;
    const missingRoleCount = ['VERIFIED', 'MEMBER', 'ADMIN', 'TREASURER', 'ATTENDANCE_OFFICER'].filter((permission) => !rolePermissionSet.has(permission)).length;
    const missingChannelCount = [
        channelSettings?.verifyChannelId,
        channelSettings?.registerChannelId,
        channelSettings?.attendanceChannelId,
        channelSettings?.attendanceSummaryChannelId,
        channelSettings?.financeChannelId,
        channelSettings?.leaveChannelId,
        channelSettings?.approvedLeaveChannelId,
        channelSettings?.requestsChannelId,
        channelSettings?.adminPanelChannelId,
    ].filter((value) => !value).length;

    return (
        <div className="space-y-5">
            <OpsPageHeader
                eyebrow="Setup Hub"
                title="การตั้งค่า"
                description="เชื่อมยศและห้อง Discord ให้ตรงกับเซิร์ฟจริง โดยไม่บังคับให้ย้ายโครงห้องเดิม"
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
                <div className="space-y-5">
                    <section className="rounded-token-xl border border-status-info bg-status-info-subtle p-4 shadow-token-sm sm:p-5">
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.7fr)] lg:items-center">
                            <div>
                                <p className="text-sm font-black text-fg-info">โหมดเซิร์ฟเดิม</p>
                                <h3 className="mt-1 text-lg font-black text-fg-primary">ใช้ห้องที่แก๊งมีอยู่แล้วได้</h3>
                                <p className="mt-2 text-sm leading-6 text-fg-secondary">
                                    เลือกห้องปลายทางของแต่ละระบบด้านล่าง บอทจะส่งข้อความพร้อมปุ่มใช้งานไปตามห้องที่เลือกไว้
                                    โดยไม่ลบข้อความเก่า ไม่ย้ายห้องเดิม และไม่เปลี่ยนสิทธิ์การมองเห็นหรือการพิมพ์ของห้องเดิมเอง
                                </p>
                            </div>
                            <div className="rounded-token-lg border border-border-subtle bg-bg-base p-3">
                                <p className="text-xs font-black text-fg-primary">ลำดับที่แนะนำ</p>
                                <ol className="mt-2 space-y-1 text-xs leading-5 text-fg-secondary">
                                    <li>1. ตั้งยศคนทั่วไปในเซิร์ฟ</li>
                                    <li>2. ถ้าใช้ยศสมาชิกเดิม ให้กด /setup ใน Discord แล้วเลือกยศเดิม</li>
                                    <li>3. เลือกห้อง Discord ที่ใช้อยู่จริง</li>
                                    <li>4. กลับไปกดซ่อมห้อง/ยศใน Discord เพื่อส่งข้อความพร้อมปุ่มล่าสุด</li>
                                </ol>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-token-xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm sm:p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0">
                                <p className="text-xs font-black uppercase text-fg-tertiary">Discord Check</p>
                                <h3 className="mt-1 text-base font-black text-fg-primary">ตรวจความตรงกันระหว่างเว็บกับ Discord</h3>
                                <p className="mt-1 text-sm leading-6 text-fg-secondary">
                                    ใช้เมื่อแก้ยศใน Discord เอง ย้ายเซิร์ฟเวอร์ หรือสงสัยว่าสมาชิกเห็นห้องไม่ตรงกับสถานะในเว็บ
                                </p>
                            </div>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                <div className="grid grid-cols-2 gap-2 text-xs font-bold text-fg-secondary">
                                    <span className="rounded-token-md border border-border-subtle bg-bg-base px-3 py-2">ยศที่ยังขาด {missingRoleCount}</span>
                                    <span className="rounded-token-md border border-border-subtle bg-bg-base px-3 py-2">ช่องที่ยังไม่ผูก {missingChannelCount}</span>
                                </div>
                                <DiscordRoleSyncButton gangId={gangId} />
                            </div>
                        </div>
                    </section>

                    <section data-testid="settings-role-mapping-panel" className="overflow-hidden rounded-token-xl border border-border-subtle bg-bg-subtle shadow-token-sm">
                        <div className="border-b border-border-subtle bg-bg-muted px-4 py-4 sm:px-5">
                            <div className="flex items-start gap-3">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-token-lg border border-border-accent bg-accent-subtle text-accent-bright">
                                    <UserCog className="h-5 w-5" />
                                </span>
                                <div className="min-w-0">
                                    <h3 className="text-base font-black text-fg-primary">ชื่อยศระบบ</h3>
                                    <p className="mt-1 text-xs leading-5 text-fg-secondary">
                                        ตั้งชื่อยศให้ทีมจำง่าย และเลือกยศคนทั่วไปจาก Discord ได้จากจุดเดียว
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 sm:p-5">
                            <RoleManager
                                gangId={gangId}
                                guildId={gang.discordGuildId}
                                initialMappings={roles}
                                discordRoles={discordRoles}
                            />
                        </div>
                    </section>

                    <section data-testid="settings-channel-mapping-panel" className="overflow-hidden rounded-token-xl border border-border-subtle bg-bg-subtle shadow-token-sm">
                        <div className="border-b border-border-subtle bg-bg-muted px-4 py-4 sm:px-5">
                            <div className="flex items-start gap-3">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-token-lg border border-border-subtle bg-bg-subtle text-fg-tertiary">
                                    <Hash className="h-5 w-5" />
                                </span>
                                <div className="min-w-0">
                                    <h3 className="text-base font-black text-fg-primary">ช่อง Discord</h3>
                                    <p className="mt-1 text-xs leading-5 text-fg-secondary">
                                        เลือกห้องเดิมหรือห้องที่บอทสร้างไว้สำหรับประกาศ เช็คชื่อ การเงิน คำขอ และบันทึกสำคัญ
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 sm:p-5">
                            <ChannelSettings
                                gangId={gangId}
                                guildId={gang.discordGuildId}
                                currentSettings={{
                                    verifyChannelId: gang.settings?.verifyChannelId,
                                    logChannelId: gang.settings?.logChannelId,
                                    registerChannelId: gang.settings?.registerChannelId,
                                    attendanceChannelId: gang.settings?.attendanceChannelId,
                                    attendanceSummaryChannelId: gang.settings?.attendanceSummaryChannelId,
                                    financeChannelId: gang.settings?.financeChannelId,
                                    announcementChannelId: gang.settings?.announcementChannelId,
                                    leaveChannelId: gang.settings?.leaveChannelId,
                                    approvedLeaveChannelId: gang.settings?.approvedLeaveChannelId,
                                    requestsChannelId: gang.settings?.requestsChannelId,
                                    websiteChannelId: gang.settings?.websiteChannelId,
                                    adminPanelChannelId: gang.settings?.adminPanelChannelId,
                                }}
                                channels={channels}
                            />
                        </div>
                    </section>
                </div>
            </SettingsTabsClient>
        </div>
    );
}
