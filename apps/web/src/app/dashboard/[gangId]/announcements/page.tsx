import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, gangs, announcements, members } from '@gang/database';
import { eq, desc, and } from 'drizzle-orm';
import { AnnouncementsClient } from './AnnouncementsClient';
import { getGangPermissions } from '@/lib/permissions';
import { Megaphone } from 'lucide-react';

interface Props {
    params: { gangId: string };
}

export default async function AnnouncementsPage({ params }: Props) {
    const session = await getServerSession(authOptions);
    if (!session) redirect('/');

    const { gangId } = params;

    // Check Permissions (ADMIN or OWNER)
    const permissions = await getGangPermissions(gangId, session.user.discordId);
    if (!permissions.isOwner && !permissions.isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                    <Megaphone className="w-8 h-8 text-red-500" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">ไม่มีสิทธิ์เข้าถึง</h1>
                <p className="text-gray-400 max-w-md">
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 mb-2">ประกาศ</h1>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                        <div className="flex items-center gap-1.5">
                            <Megaphone className="w-4 h-4" />
                            <span>ทั้งหมด {allAnnouncementsData.length} ประกาศ</span>
                        </div>
                    </div>
                </div>
            </div>

            <AnnouncementsClient announcements={allAnnouncementsData} gangId={gangId} />
        </>
    );
}
