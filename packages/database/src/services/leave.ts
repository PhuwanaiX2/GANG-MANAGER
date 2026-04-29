import { randomUUID } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from '../schema';
import { auditLogs, leaveRequests, members } from '../schema';

type DbType = LibSQLDatabase<typeof schema> | any;

function uuid() {
    const g: any = globalThis as any;
    if (g?.crypto?.randomUUID) return g.crypto.randomUUID();
    return randomUUID();
}

export class LeaveReviewError extends Error {
    statusCode: number;

    constructor(message: string, statusCode: number) {
        super(message);
        this.name = 'LeaveReviewError';
        this.statusCode = statusCode;
    }
}

export class CreateLeaveRequestError extends Error {
    statusCode: number;

    constructor(message: string, statusCode: number) {
        super(message);
        this.name = 'CreateLeaveRequestError';
        this.statusCode = statusCode;
    }
}

export interface CreateLeaveRequestDTO {
    gangId: string;
    memberId: string;
    type: 'FULL' | 'LATE';
    startDate: Date | string;
    endDate: Date | string;
    reason?: string;
    actorDiscordId: string;
    actorName: string;
}

 type LeaveDiscordStatus = 'APPROVED' | 'REJECTED';

function formatBangkokDate(value: Date | string) {
    return new Date(value).toLocaleDateString('th-TH', {
        timeZone: 'Asia/Bangkok',
    });
}

function formatBangkokTime(value: Date | string) {
    return new Date(value).toLocaleTimeString('th-TH', {
        timeZone: 'Asia/Bangkok',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
}

function formatBangkokTimestamp(value?: Date | string) {
    return new Date(value || new Date()).toLocaleString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Bangkok',
    });
}

 interface LeaveDiscordDetailsInput {
     type: 'FULL' | 'LATE';
     startDate: Date | string;
     endDate: Date | string;
     reason?: string | null;
 }

 function getLeaveDiscordDetails(input: LeaveDiscordDetailsInput) {
     if (input.type === 'FULL') {
         return {
             typeLabel: 'ลาหยุด',
             dateLabel: 'วันที่',
             dateInfo: `${formatBangkokDate(input.startDate)} - ${formatBangkokDate(input.endDate)}`,
         };
     }

     return {
         typeLabel: 'เข้าช้า',
         dateLabel: 'เวลา',
         dateInfo: `เข้า ${formatBangkokTime(input.startDate)} น.`,
     };
 }

 export function buildLeaveRequestDiscordEmbed(input: LeaveDiscordDetailsInput & {
     memberName: string;
     memberDiscordId?: string | null;
     thumbnailUrl?: string | null;
     requestedAt?: Date | string;
 }) {
     const details = getLeaveDiscordDetails(input);
     const mention = input.memberDiscordId ? ` (<@${input.memberDiscordId}>)` : '';
     const embed: {
         title: string;
         description: string;
         color: number;
         footer: { text: string };
         thumbnail?: { url: string };
     } = {
         title: input.type === 'FULL' ? 'แจ้งลาหยุด' : 'แจ้งเข้าช้า',
         description: [
             `**ผู้ขอ:** ${input.memberName}${mention}`,
             `**ประเภท:** ${details.typeLabel}`,
             `**${details.dateLabel}:** ${details.dateInfo}`,
             `**เหตุผล:** ${input.reason?.trim() || 'ไม่ได้ระบุเหตุผล'}`,
         ].join('\n'),
         color: input.type === 'FULL' ? 0xED4245 : 0xFEE75C,
         footer: { text: formatBangkokTimestamp(input.requestedAt) },
     };

     if (input.thumbnailUrl?.trim()) {
         embed.thumbnail = { url: input.thumbnailUrl.trim() };
     }

     return embed;
 }

 export function buildLeaveReviewDiscordEmbed(input: LeaveDiscordDetailsInput & {
     memberName: string;
     reviewerName: string;
     status: LeaveDiscordStatus;
 }) {
     const isApproved = input.status === 'APPROVED';
     const details = getLeaveDiscordDetails(input);

     return {
         title: isApproved
             ? (input.type === 'FULL' ? 'อนุมัติการลา' : 'รับทราบการเข้าช้า')
             : (input.type === 'FULL' ? 'ปฏิเสธการลา' : 'ปฏิเสธการเข้าช้า'),
         description: [
             `**ผู้ขอ:** ${input.memberName}`,
             `**ประเภท:** ${details.typeLabel}`,
             `**${details.dateLabel}:** ${details.dateInfo}`,
             `**เหตุผล:** ${input.reason?.trim() || 'ไม่ได้ระบุเหตุผล'}`,
             '',
             `**ผู้ดำเนินการ:** ${input.reviewerName}`,
         ].join('\n'),
         color: isApproved ? 0x57F287 : 0xED4245,
         timestamp: new Date().toISOString(),
     };
 }

export async function createLeaveRequest(db: DbType, data: CreateLeaveRequestDTO) {
    const member = await db.query.members.findFirst({
        where: and(
            eq(members.id, data.memberId),
            eq(members.gangId, data.gangId)
        ),
    });

    if (!member) {
        throw new CreateLeaveRequestError('ไม่พบสมาชิกในแก๊งนี้', 404);
    }

    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        throw new CreateLeaveRequestError('ช่วงเวลาการลาไม่ถูกต้อง', 400);
    }

    if (endDate < startDate) {
        throw new CreateLeaveRequestError('วันสิ้นสุดต้องไม่น้อยกว่าวันเริ่มต้น', 400);
    }

    const existingLeaves = await db.query.leaveRequests.findMany({
        where: and(
            eq(leaveRequests.memberId, data.memberId),
            eq(leaveRequests.gangId, data.gangId)
        ),
    });

    const hasOverlap = existingLeaves.some((leave: any) => {
        if (leave.status === 'REJECTED' || leave.status === 'CANCELLED') {
            return false;
        }

        const leaveStart = new Date(leave.startDate);
        const leaveEnd = new Date(leave.endDate);
        return startDate <= leaveEnd && endDate >= leaveStart;
    });

    if (hasOverlap) {
        throw new CreateLeaveRequestError('มีรายการลาช่วงนี้อยู่แล้ว', 409);
    }

    const requestId = uuid();
    const normalizedReason = data.reason?.trim() || 'ไม่ได้ระบุเหตุผล';

    await db.insert(leaveRequests).values({
        id: requestId,
        memberId: data.memberId,
        gangId: data.gangId,
        type: data.type,
        startDate,
        endDate,
        reason: normalizedReason,
        status: 'PENDING',
    });

    const createdRequest = await db.query.leaveRequests.findFirst({
        where: and(
            eq(leaveRequests.id, requestId),
            eq(leaveRequests.gangId, data.gangId)
        ),
        with: {
            member: true,
        },
    });

    if (!createdRequest) {
        throw new CreateLeaveRequestError('ไม่สามารถสร้างคำขอลาได้', 500);
    }

    await db.insert(auditLogs).values({
        id: uuid(),
        gangId: data.gangId,
        actorId: data.actorDiscordId,
        actorName: data.actorName || data.actorDiscordId,
        action: 'LEAVE_CREATE',
        targetType: 'LEAVE_REQUEST',
        targetId: createdRequest.id,
        oldValue: null,
        newValue: JSON.stringify({
            status: createdRequest.status,
            type: createdRequest.type,
            startDate: createdRequest.startDate,
            endDate: createdRequest.endDate,
        }),
        details: JSON.stringify({
            requestId: createdRequest.id,
            memberId: createdRequest.memberId,
            memberName: createdRequest.member?.name || member.name || 'Unknown',
            leaveType: createdRequest.type,
            reason: createdRequest.reason,
        }),
    });

    return {
        createdRequest,
        member,
    };
}

export interface ReviewLeaveRequestDTO {
    gangId: string;
    requestId: string;
    status: 'APPROVED' | 'REJECTED';
    reviewerDiscordId: string;
    reviewerName: string;
    startDate?: Date | string;
    endDate?: Date | string;
}

export async function reviewLeaveRequest(db: DbType, data: ReviewLeaveRequestDTO) {
    const leaveRequest = await db.query.leaveRequests.findFirst({
        where: and(
            eq(leaveRequests.id, data.requestId),
            eq(leaveRequests.gangId, data.gangId)
        ),
        with: {
            member: true,
        },
    });

    if (!leaveRequest) {
        throw new LeaveReviewError('ไม่พบคำขอลา', 404);
    }

    if (leaveRequest.status !== 'PENDING') {
        const statusText = leaveRequest.status === 'APPROVED' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว';
        throw new LeaveReviewError(`คำขอลานี้ถูกดำเนินการไปแล้ว (${statusText})`, 409);
    }

    const reviewer = await db.query.members.findFirst({
        where: and(
            eq(members.gangId, data.gangId),
            eq(members.discordId, data.reviewerDiscordId)
        ),
    });

    if (!reviewer) {
        throw new LeaveReviewError('ไม่พบข้อมูลผู้ตรวจสอบ', 404);
    }

    const updateData: any = {
        status: data.status,
        reviewedAt: new Date(),
        reviewedById: reviewer.id,
    };

    if (data.startDate) updateData.startDate = new Date(data.startDate);
    if (data.endDate) updateData.endDate = new Date(data.endDate);

    const [updatedRequest] = await db.update(leaveRequests)
        .set(updateData)
        .where(
            and(
                eq(leaveRequests.id, data.requestId),
                eq(leaveRequests.gangId, data.gangId)
            )
        )
        .returning();

    if (!updatedRequest) {
        throw new LeaveReviewError('ไม่สามารถอัปเดตคำขอลาได้', 500);
    }

    await db.insert(auditLogs).values({
        id: uuid(),
        gangId: data.gangId,
        actorId: data.reviewerDiscordId,
        actorName: data.reviewerName || data.reviewerDiscordId,
        action: 'LEAVE_REVIEW',
        targetType: 'LEAVE_REQUEST',
        targetId: updatedRequest.id,
        oldValue: JSON.stringify({
            status: leaveRequest.status,
            startDate: leaveRequest.startDate,
            endDate: leaveRequest.endDate,
        }),
        newValue: JSON.stringify({
            status: updatedRequest.status,
            startDate: updatedRequest.startDate,
            endDate: updatedRequest.endDate,
        }),
        details: JSON.stringify({
            requestId: updatedRequest.id,
            memberId: leaveRequest.memberId,
            memberName: leaveRequest.member?.name || 'Unknown',
            leaveType: leaveRequest.type,
            reviewStatus: updatedRequest.status,
            reviewerMemberId: reviewer.id,
        }),
    });

    return {
        leaveRequest,
        updatedRequest,
        reviewer,
    };
}
