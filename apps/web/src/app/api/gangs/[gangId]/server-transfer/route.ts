import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, gangs, members, attendanceSessions, transactions, leaveRequests, attendanceRecords, gangSettings } from '@gang/database';
import { eq, and, sql } from 'drizzle-orm';

// ─── GET: Transfer status ───
export async function GET(
    req: Request,
    { params }: { params: { gangId: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.id, params.gangId),
            columns: {
                transferStatus: true,
                transferDeadline: true,
                transferStartedAt: true,
            },
        });
        if (!gang) return NextResponse.json({ error: 'Gang not found' }, { status: 404 });

        if (gang.transferStatus !== 'ACTIVE') {
            return NextResponse.json({ transferStatus: gang.transferStatus });
        }

        // Count member transfer statuses
        const allActive = await db.query.members.findMany({
            where: and(
                eq(members.gangId, params.gangId),
                eq(members.isActive, true),
                eq(members.status, 'APPROVED')
            ),
            columns: { id: true, name: true, transferStatus: true, gangRole: true },
        });

        const confirmed = allActive.filter(m => m.transferStatus === 'CONFIRMED');
        const left = allActive.filter(m => m.transferStatus === 'LEFT');
        const pending = allActive.filter(m => !m.transferStatus || m.transferStatus === 'PENDING');

        // Check if deadline passed
        const now = new Date();
        const deadlinePassed = gang.transferDeadline ? now > new Date(gang.transferDeadline) : false;

        return NextResponse.json({
            transferStatus: 'ACTIVE',
            deadline: gang.transferDeadline ? new Date(gang.transferDeadline).toISOString() : null,
            startedAt: gang.transferStartedAt ? new Date(gang.transferStartedAt).toISOString() : null,
            deadlinePassed,
            counts: {
                total: allActive.length,
                confirmed: confirmed.length,
                left: left.length,
                pending: pending.length,
            },
            members: allActive.map(m => ({
                id: m.id,
                name: m.name,
                transferStatus: m.transferStatus || 'PENDING',
                gangRole: m.gangRole,
            })),
        });

    } catch (error) {
        console.error('[API] Transfer Status Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// ─── POST: Start transfer ───
export async function POST(
    req: Request,
    { params }: { params: { gangId: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Verify OWNER
        const member = await db.query.members.findFirst({
            where: and(
                eq(members.discordId, session.user.discordId),
                eq(members.gangId, params.gangId),
                eq(members.isActive, true)
            ),
        });
        if (!member || member.gangRole !== 'OWNER') {
            return NextResponse.json({ error: 'เฉพาะหัวหน้าแก๊งเท่านั้น' }, { status: 403 });
        }

        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.id, params.gangId),
            with: { settings: true },
        });
        if (!gang) return NextResponse.json({ error: 'Gang not found' }, { status: 404 });

        // Prevent double transfer
        if (gang.transferStatus === 'ACTIVE') {
            return NextResponse.json({ error: 'มีการย้ายเซิร์ฟกำลังดำเนินการอยู่แล้ว' }, { status: 400 });
        }

        const body = await req.json();
        const { deadlineHours, deadlineDays = 3 } = body as {
            deadlineHours?: number;
            deadlineDays?: number;
        };

        // Calculate deadline
        const deadline = new Date();
        if (deadlineHours && deadlineHours > 0) {
            deadline.setTime(deadline.getTime() + Math.min(deadlineHours, 336) * 60 * 60 * 1000);
        } else {
            deadline.setDate(deadline.getDate() + Math.min(deadlineDays, 14));
        }

        const results: string[] = [];

        // 1. Reset ALL data
        await db.delete(transactions).where(eq(transactions.gangId, params.gangId));
        await db.update(gangs)
            .set({ balance: 0, updatedAt: new Date() })
            .where(eq(gangs.id, params.gangId));
        await db.update(members)
            .set({ balance: 0 })
            .where(eq(members.gangId, params.gangId));
        results.push('ล้างข้อมูลการเงิน + ยอดสมาชิกทั้งหมดแล้ว');

        const sessions = await db.query.attendanceSessions.findMany({
            where: eq(attendanceSessions.gangId, params.gangId),
            columns: { id: true },
        });
        if (sessions.length > 0) {
            for (const s of sessions) {
                await db.delete(attendanceRecords).where(eq(attendanceRecords.sessionId, s.id));
            }
            await db.delete(attendanceSessions).where(eq(attendanceSessions.gangId, params.gangId));
        }
        results.push('ล้างประวัติเช็คชื่อแล้ว');

        await db.delete(leaveRequests).where(eq(leaveRequests.gangId, params.gangId));
        results.push('ล้างประวัติการลาแล้ว');

        // 2. Get active members + set transferStatus = PENDING
        const activeMembers = await db.query.members.findMany({
            where: and(
                eq(members.gangId, params.gangId),
                eq(members.isActive, true),
                eq(members.status, 'APPROVED')
            ),
            columns: { id: true, discordId: true, name: true, gangRole: true },
        });

        // Owner auto-confirmed, others PENDING
        for (const m of activeMembers) {
            await db.update(members)
                .set({ transferStatus: m.gangRole === 'OWNER' ? 'CONFIRMED' : 'PENDING' })
                .where(eq(members.id, m.id));
        }

        // 3. Send Discord announcement via REST API
        let transferMessageId: string | null = null;
        let transferChannelId: string | null = null;
        const botToken = process.env.DISCORD_BOT_TOKEN;
        const channelId = gang.settings?.announcementChannelId;

        if (botToken && channelId) {
            try {
                const deadlineStr = deadline.toLocaleDateString('th-TH', {
                    day: 'numeric', month: 'long', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                });

                const mentions = activeMembers
                    .filter(m => m.discordId && m.gangRole !== 'OWNER')
                    .map(m => `<@${m.discordId}>`)
                    .join(' ');

                const embed = {
                    title: '🔄 แก๊งย้ายเซิร์ฟเกม!',
                    description:
                        `หัวหน้าแก๊ง **${gang.name}** ได้ตัดสินใจย้ายเซิร์ฟเกมแล้ว!\n\n` +
                        `ขณะนี้หัวหน้าแก๊งยืนยันสถานะแล้ว สมาชิกท่านอื่นที่ได้รับแท็กด้านล่างนี้ **กรุณากดปุ่มยืนยัน** เพื่อตามแก๊งไปยังบ้านใหม่ หรือกดออกจากแก๊งหากไม่ต้องการไปต่อครับ\n\n` +
                        `⏰ **Deadline:** ${deadlineStr}\n` +
                        `⚠️ สมาชิกที่ไม่ยืนยันภายในเวลากำหนดจะถูกคัดออกจากแก๊งอัตโนมัติ`,
                    color: 0xFF8C00,
                    footer: { text: `สมาชิกทั้งหมดที่ต้องยืนยัน: ${activeMembers.length - 1} คน` },
                    timestamp: new Date().toISOString(),
                };

                const components = [{
                    type: 1,
                    components: [
                        { type: 2, style: 3, label: '✅ ตามไปด้วย', custom_id: `transfer_confirm_${params.gangId}` },
                        { type: 2, style: 4, label: '❌ ออกจากแก๊ง', custom_id: `transfer_leave_${params.gangId}` },
                    ],
                }];

                const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bot ${botToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        content: mentions || '@everyone 📢 **ย้ายเซิร์ฟเกม!**',
                        embeds: [embed],
                        components,
                    }),
                });

                if (res.ok) {
                    const data = await res.json();
                    transferMessageId = data.id;
                    transferChannelId = channelId;
                    results.push('ส่งประกาศไป Discord แล้ว');
                } else {
                    console.error('[Transfer] Discord API error:', await res.text());
                }
            } catch (e) {
                console.error('[Transfer] Discord error:', e);
            }
        }

        // 4. Save transfer state to gang
        await db.update(gangs)
            .set({
                transferStatus: 'ACTIVE',
                transferDeadline: deadline,
                transferStartedAt: new Date(),
                transferMessageId,
                transferChannelId,
                updatedAt: new Date(),
            })
            .where(eq(gangs.id, params.gangId));

        return NextResponse.json({
            success: true,
            results,
            deadline: deadline.toISOString(),
            memberCount: activeMembers.length,
        });

    } catch (error) {
        console.error('[API] Server Transfer Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// ─── DELETE: Cancel transfer ───
export async function DELETE(
    req: Request,
    { params }: { params: { gangId: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const member = await db.query.members.findFirst({
            where: and(
                eq(members.discordId, session.user.discordId),
                eq(members.gangId, params.gangId),
                eq(members.isActive, true)
            ),
        });
        if (!member || member.gangRole !== 'OWNER') {
            return NextResponse.json({ error: 'เฉพาะหัวหน้าแก๊งเท่านั้น' }, { status: 403 });
        }

        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.id, params.gangId),
        });
        if (!gang || gang.transferStatus !== 'ACTIVE') {
            return NextResponse.json({ error: 'ไม่มีการย้ายเซิร์ฟที่กำลังดำเนินการ' }, { status: 400 });
        }

        // Disable Discord buttons
        const botToken = process.env.DISCORD_BOT_TOKEN;
        if (botToken && gang.transferChannelId && gang.transferMessageId) {
            try {
                await fetch(`https://discord.com/api/v10/channels/${gang.transferChannelId}/messages/${gang.transferMessageId}`, {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bot ${botToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        components: [{
                            type: 1,
                            components: [
                                { type: 2, style: 2, label: '🚫 ยกเลิกแล้ว', custom_id: 'transfer_cancelled', disabled: true },
                            ],
                        }],
                    }),
                });
            } catch (e) {
                console.error('[Transfer] Failed to update Discord message:', e);
            }
        }

        // Reset gang transfer state
        await db.update(gangs)
            .set({
                transferStatus: 'CANCELLED',
                transferMessageId: null,
                transferChannelId: null,
                updatedAt: new Date(),
            })
            .where(eq(gangs.id, params.gangId));

        // Reset all member transferStatus
        await db.update(members)
            .set({ transferStatus: null })
            .where(eq(members.gangId, params.gangId));

        return NextResponse.json({ success: true, message: 'ยกเลิกการย้ายเซิร์ฟแล้ว' });

    } catch (error) {
        console.error('[API] Cancel Transfer Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// ─── PATCH: Force complete (stop + deactivate non-confirmed) ───
export async function PATCH(
    req: Request,
    { params }: { params: { gangId: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const member = await db.query.members.findFirst({
            where: and(
                eq(members.discordId, session.user.discordId),
                eq(members.gangId, params.gangId),
                eq(members.isActive, true)
            ),
        });
        if (!member || member.gangRole !== 'OWNER') {
            return NextResponse.json({ error: 'เฉพาะหัวหน้าแก๊งเท่านั้น' }, { status: 403 });
        }

        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.id, params.gangId),
        });
        if (!gang || gang.transferStatus !== 'ACTIVE') {
            return NextResponse.json({ error: 'ไม่มีการย้ายเซิร์ฟที่กำลังดำเนินการ' }, { status: 400 });
        }

        // Deactivate members who didn't confirm
        const pendingMembers = await db.query.members.findMany({
            where: and(
                eq(members.gangId, params.gangId),
                eq(members.isActive, true),
                eq(members.status, 'APPROVED'),
            ),
        });

        let deactivatedCount = 0;
        for (const m of pendingMembers) {
            if (m.transferStatus !== 'CONFIRMED' && m.gangRole !== 'OWNER') {
                await db.update(members)
                    .set({ isActive: false, transferStatus: 'LEFT' })
                    .where(eq(members.id, m.id));
                deactivatedCount++;
            }
        }

        // Disable Discord buttons
        const botToken = process.env.DISCORD_BOT_TOKEN;
        if (botToken && gang.transferChannelId && gang.transferMessageId) {
            try {
                await fetch(`https://discord.com/api/v10/channels/${gang.transferChannelId}/messages/${gang.transferMessageId}`, {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bot ${botToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        components: [{
                            type: 1,
                            components: [
                                { type: 2, style: 2, label: '✅ ย้ายเซิร์ฟเสร็จสิ้น', custom_id: 'transfer_done', disabled: true },
                            ],
                        }],
                    }),
                });
            } catch (e) {
                console.error('[Transfer] Failed to update Discord message:', e);
            }
        }

        // Mark transfer complete
        await db.update(gangs)
            .set({
                transferStatus: 'COMPLETED',
                transferMessageId: null,
                transferChannelId: null,
                updatedAt: new Date(),
            })
            .where(eq(gangs.id, params.gangId));

        // Clear member transferStatus
        await db.update(members)
            .set({ transferStatus: null })
            .where(eq(members.gangId, params.gangId));

        return NextResponse.json({
            success: true,
            message: 'ย้ายเซิร์ฟเสร็จสิ้น',
            deactivatedCount,
        });

    } catch (error) {
        console.error('[API] Complete Transfer Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
