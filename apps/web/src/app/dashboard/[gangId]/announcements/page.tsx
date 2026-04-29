export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, gangs, announcements, members } from '@gang/database';
import { eq, desc, and } from 'drizzle-orm';
import { AnnouncementsClient } from './AnnouncementsClient';
import { getGangPermissionFlagsForDiscordId } from '@/lib/gangAccess';
import { isFeatureEnabled } from '@/lib/tierGuard';
import { FeatureDisabledBanner } from '@/components/FeatureDisabledBanner';
import { Radio, Megaphone } from 'lucide-react';

interface Props {
    params: Promise<{ gangId: string }>;
}

export default async function AnnouncementsPage(props: Props) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session) redirect('/');

    const { gangId } = params;

    // Global feature flag check
    const announcementsEnabled = await isFeatureEnabled('announcements');
    if (!announcementsEnabled) {
        return <FeatureDisabledBanner featureName="ระบบประกาศ" />;
    }

    // Check Permissions (ADMIN or OWNER)
    const permissions = await getGangPermissionFlagsForDiscordId({ gangId, discordId: session.user.discordId });
    if (!permissions.isOwner && !permissions.isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 animate-fade-in">
                <div className="w-16 h-16 rounded-token-full bg-status-danger-subtle border border-status-danger flex items-center justify-center mb-4 shadow-token-md">
                    <Megaphone className="w-8 h-8 text-fg-danger" />
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-token-full bg-status-danger-subtle border border-status-danger mb-3">
                    <span className="w-1.5 h-1.5 rounded-token-full bg-status-danger animate-pulse" />
                    <span className="text-fg-danger text-[10px] font-black tracking-widest uppercase">Access Denied</span>
                </div>
                <h1 className="text-2xl font-black text-fg-primary mb-2 font-heading tracking-tight">ไม่มีสิทธิ์เข้าถึง</h1>
                <p className="text-fg-tertiary max-w-md text-sm">
                    เฉพาะหัวหน้าแก๊ง (Owner) หรือ รองหัวหน้า (Admin) เท่านั้น
                </p>
            </div>
        );
    }

    // Get data in parallel
    const [allAnnouncementsData] = await Promise.all([
        db.select({
            id: announcements.id,
            title: announcements.title,
            content: announcements.content,
            authorName: announcements.authorName,
            discordMessageId: announcements.discordMessageId,
            createdAt: announcements.createdAt,
            authorAvatar: members.discordAvatar,
            authorDiscordUsername: members.discordUsername,
        })
            .from(announcements)
            .leftJoin(members, and(
                eq(members.discordId, announcements.authorId),
                eq(members.gangId, gangId)
            ))
            .where(eq(announcements.gangId, gangId))
            .orderBy(desc(announcements.createdAt))
    ]);

    return (
        <>
            <div className="mb-8 animate-fade-in relative overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle p-6 shadow-token-md">
                <div className="absolute -right-20 -top-24 h-56 w-56 rounded-token-full bg-accent-subtle blur-3xl" />
                <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-accent to-transparent opacity-50" />
                <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-token-full bg-accent-subtle border border-border-accent mb-3 shadow-token-sm">
                            <span className="w-1.5 h-1.5 rounded-token-full bg-accent-bright animate-pulse" />
                            <span className="text-accent-bright text-[10px] font-black tracking-widest uppercase">Broadcast</span>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="p-2.5 rounded-token-xl bg-accent-subtle border border-border-accent shadow-token-sm">
                                <Megaphone className="w-6 h-6 text-accent-bright" />
                            </div>
                            <div>
                                <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-fg-primary font-heading drop-shadow-sm">ประกาศ</h1>
                                <p className="mt-2 text-sm leading-relaxed text-fg-secondary">
                                    กระดานสั่งการสำหรับส่งข่าวสำคัญไปยัง Discord พร้อมตรวจย้อนหลังว่าใครเป็นผู้ประกาศและส่งเมื่อไหร่
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                        <div className="inline-flex items-center gap-3 px-4 py-3 rounded-token-xl bg-bg-muted border border-border-subtle shadow-inner">
                            <Megaphone className="w-4 h-4 text-fg-tertiary" />
                            <span className="text-fg-secondary text-[10px] font-black tracking-widest uppercase">Total</span>
                            <span className="text-lg font-black text-fg-primary tabular-nums leading-none">{allAnnouncementsData.length}</span>
                        </div>
                        <div className="inline-flex items-center gap-3 px-4 py-3 rounded-token-xl bg-status-success-subtle border border-status-success shadow-inner">
                            <Radio className="w-4 h-4 text-fg-success" />
                            <span className="text-fg-success text-[10px] font-black tracking-widest uppercase">Sent</span>
                            <span className="text-lg font-black text-fg-primary tabular-nums leading-none">{allAnnouncementsData.filter((announcement) => announcement.discordMessageId).length}</span>
                        </div>
                    </div>
                </div>
            </div>

            <AnnouncementsClient announcements={allAnnouncementsData} gangId={gangId} />
        </>
    );
}
