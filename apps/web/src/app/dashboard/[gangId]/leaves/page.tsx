export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, leaveRequests, members } from '@gang/database';
import { eq, and, sql } from 'drizzle-orm';
import { LeaveCreateButton } from './LeaveCreateButton';
import { LeaveRequestList } from './LeaveRequestList';

import { getGangAccessContextForDiscordId } from '@/lib/gangAccess';
import { isFeatureEnabled } from '@/lib/tierGuard';
import { FeatureDisabledBanner } from '@/components/FeatureDisabledBanner';
import { OpsPageHeader } from '@/components/ui';
import { CalendarDays } from 'lucide-react';

interface Props {
    params: Promise<{ gangId: string }>;
}

export default async function LeavesPage(props: Props) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session) redirect('/');

    const { gangId } = params;

    // Global feature flag check
    const leaveEnabled = await isFeatureEnabled('leave');
    if (!leaveEnabled) {
        return <FeatureDisabledBanner featureName="ระบบแจ้งลา" />;
    }

    const { access, permissions } = await getGangAccessContextForDiscordId({ gangId, discordId: session.user.discordId });
    const canReviewRequests = permissions.isOwner || permissions.isAdmin;

    const currentMember = access?.member
        ? { id: access.member.id, name: access.member.name }
        : null;

    if (!canReviewRequests && !currentMember) {
        return (
            <div className="flex h-[52vh] flex-col items-center justify-center px-6 text-center animate-fade-in">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-token-xl border border-status-danger bg-status-danger-subtle">
                    <CalendarDays className="h-6 w-6 text-fg-danger" />
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-token-full bg-status-danger-subtle border border-status-danger mb-3">
                    <span className="h-1.5 w-1.5 rounded-token-full bg-status-danger" />
                    <span className="text-fg-danger text-[10px] font-bold">ไม่มีสิทธิ์</span>
                </div>
                <h1 className="text-2xl font-black text-fg-primary mb-2 tracking-tight font-heading">ไม่มีสิทธิ์เข้าถึง</h1>
                <p className="text-fg-tertiary max-w-md text-sm">
                    ไม่พบสิทธิ์ใช้งานหรือข้อมูลสมาชิกสำหรับระบบแจ้งลา
                </p>
            </div>
        );
    }

    const requests = await db.query.leaveRequests.findMany({
        where: canReviewRequests
            ? eq(leaveRequests.gangId, gangId)
            : and(
                eq(leaveRequests.gangId, gangId),
                eq(leaveRequests.memberId, currentMember!.id)
            ),
        orderBy: (lr, { desc }) => desc(lr.requestedAt),
        columns: {
            id: true,
            memberId: true,
            gangId: true,
            type: true,
            startDate: true,
            endDate: true,
            reason: true,
            status: true,
            requestedAt: true,
            reviewedAt: true,
            reviewedById: true,
            reviewNotes: true,
        },
        with: {
            member: {
                columns: {
                    id: true,
                    name: true,
                    discordAvatar: true,
                    discordUsername: true,
                },
            },
        },
    });

    const reviewerIds = Array.from(new Set(requests.map(r => r.reviewedById).filter(Boolean))) as string[];

    const reviewers = reviewerIds.length > 0 ? await db.query.members.findMany({
        where: sql`id IN ${reviewerIds}`,
        columns: { id: true, name: true, discordUsername: true }
    }) : [];

    const reviewerMap = new Map(reviewers.map(r => [r.id, r]));

    const enrichedRequests = requests.map(r => ({
        ...r,
        reviewer: r.reviewedById ? reviewerMap.get(r.reviewedById) : null
    }));
    return (
        <div className="space-y-4">
            <OpsPageHeader
                eyebrow="Leave Desk"
                title="การลา"
                description={canReviewRequests
                    ? 'ตรวจคำขอรออนุมัติก่อน แล้วค่อยเปิดฟอร์มส่งคำขอของตัวเองเมื่อจำเป็น ไม่ให้สองงานแย่งพื้นที่กัน'
                    : 'ส่งคำขอลาของคุณและติดตามสถานะการพิจารณาได้จากหน้านี้'}
                icon={CalendarDays}
                tone="danger"
                compact
                actions={currentMember ? <LeaveCreateButton className="w-full sm:w-auto" /> : null}
            />

            <LeaveRequestList
                requests={enrichedRequests}
                gangId={gangId}
                canReview={canReviewRequests}
                currentMemberId={currentMember?.id || null}
                currentMemberName={currentMember?.name || null}
            />
        </div>
    );
}
