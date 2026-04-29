export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, leaveRequests, members } from '@gang/database';
import { eq, and, sql } from 'drizzle-orm';
import { LeaveRequestList } from './LeaveRequestList';

import { getGangAccessContextForDiscordId } from '@/lib/gangAccess';
import { isFeatureEnabled } from '@/lib/tierGuard';
import { FeatureDisabledBanner } from '@/components/FeatureDisabledBanner';
import { CalendarDays, CheckCircle2, Clock, FileText } from 'lucide-react';

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
                    <span className="text-fg-danger text-[10px] font-black tracking-widest uppercase">Access Denied</span>
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
    const pendingCount = enrichedRequests.filter((request) => request.status === 'PENDING').length;
    const approvedCount = enrichedRequests.filter((request) => request.status === 'APPROVED').length;

    return (
        <>
            <div className="mb-8 relative overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle p-6 shadow-token-md animate-fade-in">
                <div className="absolute -right-20 -top-24 h-56 w-56 rounded-token-full bg-accent-subtle blur-3xl" />
                <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-accent to-transparent opacity-50" />
                <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-token-full bg-accent-subtle border border-border-accent mb-3 shadow-token-sm">
                            <span className="w-1.5 h-1.5 rounded-token-full bg-accent-bright animate-pulse" />
                            <span className="text-accent-bright text-[10px] font-black tracking-widest uppercase">Leave Desk</span>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="p-2.5 rounded-token-xl bg-accent-subtle border border-border-accent shadow-token-sm">
                                <CalendarDays className="w-6 h-6 text-accent-bright" />
                            </div>
                            <div>
                                <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-fg-primary font-heading">รายการลา / แจ้งเข้าช้า</h1>
                                <p className="mt-2 text-sm leading-relaxed text-fg-secondary">
                                    {canReviewRequests
                                        ? 'ส่งคำขอของตัวเอง ตรวจคำขอลาสมาชิก และจัดคิวอนุมัติในหน้าเดียว'
                                        : 'ส่งคำขอลาของคุณและติดตามสถานะการพิจารณาได้จากหน้านี้'}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-token-xl border border-border-subtle bg-bg-muted px-4 py-3 shadow-inner">
                            <FileText className="mb-2 h-4 w-4 text-fg-tertiary" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-fg-tertiary">Total</p>
                            <p className="mt-1 text-xl font-black text-fg-primary tabular-nums">{enrichedRequests.length}</p>
                        </div>
                        <div className="rounded-token-xl border border-status-warning bg-status-warning-subtle px-4 py-3 shadow-inner">
                            <Clock className="mb-2 h-4 w-4 text-fg-warning" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-fg-warning">Pending</p>
                            <p className="mt-1 text-xl font-black text-fg-primary tabular-nums">{pendingCount}</p>
                        </div>
                        <div className="rounded-token-xl border border-status-success bg-status-success-subtle px-4 py-3 shadow-inner">
                            <CheckCircle2 className="mb-2 h-4 w-4 text-fg-success" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-fg-success">Approved</p>
                            <p className="mt-1 text-xl font-black text-fg-primary tabular-nums">{approvedCount}</p>
                        </div>
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
        </>
    );
}
