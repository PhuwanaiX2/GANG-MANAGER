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
                    <span className="text-fg-danger text-[10px] font-black tracking-widest uppercase">ไม่มีสิทธิ์</span>
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
            <div className="relative mb-4 overflow-hidden rounded-token-xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm">
                <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-2xl">
                        <div className="mb-3 inline-flex items-center gap-2 rounded-token-full border border-border-accent bg-accent-subtle px-3 py-1 text-[10px] font-black uppercase tracking-widest text-accent-bright shadow-token-sm">
                            <span className="h-1.5 w-1.5 rounded-token-full bg-accent-bright" />
                            ประกาศแก๊ง
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="rounded-token-lg border border-border-accent bg-accent-subtle p-2 shadow-token-sm">
                                <Megaphone className="h-4 w-4 text-accent-bright" />
                            </div>
                            <div>
                                <h1 className="font-heading text-xl font-black tracking-tight text-fg-primary sm:text-2xl">ประกาศ</h1>
                                <p className="mt-1.5 text-sm leading-relaxed text-fg-secondary">
                                    ส่งข่าวสำคัญไป Discord และตรวจย้อนหลังว่าใครประกาศ เมื่อไหร่
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                        <div className="inline-flex items-center gap-3 rounded-token-lg border border-border-subtle bg-bg-muted px-3 py-2 shadow-inner">
                            <Megaphone className="h-4 w-4 text-fg-tertiary" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-fg-secondary">ทั้งหมด</span>
                            <span className="text-base font-black leading-none text-fg-primary tabular-nums">{allAnnouncementsData.length}</span>
                        </div>
                        <div className="inline-flex items-center gap-3 rounded-token-lg border border-status-success bg-status-success-subtle px-3 py-2 shadow-inner">
                            <Radio className="h-4 w-4 text-fg-success" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-fg-success">ส่งแล้ว</span>
                            <span className="text-base font-black leading-none text-fg-primary tabular-nums">{allAnnouncementsData.filter((announcement) => announcement.discordMessageId).length}</span>
                        </div>
                    </div>
                </div>
            </div>

            <AnnouncementsClient announcements={allAnnouncementsData} gangId={gangId} />
        </>
    );
}
