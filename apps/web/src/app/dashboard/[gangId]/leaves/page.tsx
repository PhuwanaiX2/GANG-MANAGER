export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { db, leaveRequests, members } from '@gang/database';
import { eq, and, sql } from 'drizzle-orm';
import { LeaveRequestList } from './LeaveRequestList';

import { getGangAccessContextForDiscordId } from '@/lib/gangAccess';
import { isFeatureEnabled } from '@/lib/tierGuard';
import { FeatureDisabledBanner } from '@/components/FeatureDisabledBanner';
import { CalendarDays, Clock, Plus } from 'lucide-react';

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
            <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6 animate-fade-in">
                <div className="w-16 h-16 bg-status-danger-subtle rounded-token-full flex items-center justify-center mb-4 border border-status-danger shadow-token-md">
                    <CalendarDays className="w-8 h-8 text-fg-danger" />
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-token-full bg-status-danger-subtle border border-status-danger mb-3">
                    <span className="w-1.5 h-1.5 rounded-token-full bg-status-danger animate-pulse" />
                    <span className="text-fg-danger text-[10px] font-black tracking-widest uppercase">ไม่มีสิทธิ์</span>
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
        with: {
            member: true,
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
        <div className="space-y-5">
            <div className="rounded-token-2xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm animate-fade-in sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 rounded-token-full border border-border-accent bg-accent-subtle px-3 py-1">
                            <span className="w-1.5 h-1.5 rounded-token-full bg-accent-bright animate-pulse" />
                            <span className="text-accent-bright text-[10px] font-black tracking-widest uppercase">Leave Desk</span>
                        </div>
                        <div className="mt-3 flex items-start gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-token-xl border border-border-accent bg-accent-subtle">
                                <CalendarDays className="w-5 h-5 text-accent-bright" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-3xl font-black tracking-tight text-fg-primary font-heading sm:text-4xl">การลา</h1>
                                <p className="mt-2 max-w-2xl text-sm leading-6 text-fg-secondary">
                                    {canReviewRequests
                                        ? 'ตรวจคำขอรออนุมัติก่อน แล้วค่อยเปิดฟอร์มส่งคำขอของตัวเองเมื่อจำเป็น ไม่ให้สองงานแย่งพื้นที่กัน'
                                        : 'ส่งคำขอลาของคุณและติดตามสถานะการพิจารณาได้จากหน้านี้'}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
                        {canReviewRequests ? (
                            <Link
                                href="#leave-review-queue"
                                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-token-xl bg-accent px-5 py-2.5 text-sm font-black text-accent-fg shadow-token-sm transition-[filter,transform] hover:-translate-y-0.5 hover:brightness-110"
                            >
                                <Clock className="h-4 w-4" />
                                ดูคิวรออนุมัติ
                            </Link>
                        ) : null}
                        {currentMember && !canReviewRequests ? (
                            <Link
                                href="#leave-request-form"
                                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-token-xl border border-border-subtle bg-bg-muted px-5 py-2.5 text-sm font-bold text-fg-primary shadow-token-sm transition-colors hover:bg-bg-elevated"
                            >
                                <Plus className="h-4 w-4" />
                                ส่งคำขอใหม่
                            </Link>
                        ) : null}
                    </div>
                </div>
            </div>

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
