import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, gangs, members, licenses } from '@gang/database';
import { eq, and } from 'drizzle-orm';

export async function POST(
    request: NextRequest,
    { params }: { params: { gangId: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.discordId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { gangId } = params;

        // Verify OWNER
        const member = await db.query.members.findFirst({
            where: and(
                eq(members.discordId, session.user.discordId),
                eq(members.gangId, gangId),
                eq(members.isActive, true)
            ),
        });
        if (!member || member.gangRole !== 'OWNER') {
            return NextResponse.json({ error: 'เฉพาะหัวหน้าแก๊งเท่านั้น' }, { status: 403 });
        }

        const body = await request.json();
        const { licenseKey } = body as { licenseKey?: string };

        if (!licenseKey || !licenseKey.trim()) {
            return NextResponse.json({ error: 'กรุณากรอก License Key' }, { status: 400 });
        }

        // Find license
        const license = await db.query.licenses.findFirst({
            where: eq(licenses.key, licenseKey.trim().toUpperCase()),
        });

        if (!license) {
            return NextResponse.json({ error: 'ไม่พบ License Key นี้ในระบบ' }, { status: 404 });
        }

        if (!license.isActive) {
            return NextResponse.json({ error: 'License Key นี้ถูกใช้งานหรือปิดการใช้งานแล้ว' }, { status: 400 });
        }

        if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
            return NextResponse.json({ error: 'License Key นี้หมดอายุแล้ว' }, { status: 400 });
        }

        // Get current gang info for proration
        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.id, gangId),
            columns: { subscriptionTier: true, subscriptionExpiresAt: true },
        });

        const tierOrder: Record<string, number> = { FREE: 0, TRIAL: 1, PRO: 2, PREMIUM: 3 };
        const currentTierRank = tierOrder[gang?.subscriptionTier || 'FREE'] ?? 0;
        const newTierRank = tierOrder[license.tier] ?? 0;
        const licenseDays = license.durationDays || 30;

        let totalDays = licenseDays;
        let bonusDays = 0;
        let finalTier = license.tier;

        // Check if gang already has an active paid plan with remaining days
        const now = new Date();
        const currentExpiry = gang?.subscriptionExpiresAt ? new Date(gang.subscriptionExpiresAt) : null;
        const remainingMs = currentExpiry ? currentExpiry.getTime() - now.getTime() : 0;
        const remainingDays = remainingMs > 0 ? Math.ceil(remainingMs / (1000 * 60 * 60 * 24)) : 0;

        if (remainingDays > 0 && currentTierRank > 0) {
            if (newTierRank >= currentTierRank) {
                // Same or higher tier: just add days
                totalDays = licenseDays + remainingDays;
                bonusDays = remainingDays;
                finalTier = license.tier;
            } else {
                // Lower tier license on higher plan: convert remaining days proportionally
                // e.g. PRO remaining -> PREMIUM license: PRO days worth less
                // For simplicity: just add the license days to current plan
                totalDays = licenseDays + remainingDays;
                bonusDays = remainingDays;
                finalTier = gang!.subscriptionTier; // keep higher tier
            }
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + totalDays);

        // Activate: update gang tier + mark license as used
        await db.update(gangs)
            .set({
                subscriptionTier: finalTier as any,
                subscriptionExpiresAt: expiresAt,
                updatedAt: new Date(),
            })
            .where(eq(gangs.id, gangId));

        await db.update(licenses)
            .set({ isActive: false })
            .where(eq(licenses.id, license.id));

        const bonusMsg = bonusDays > 0 ? ` (+${bonusDays} วันจากแพลนเดิม)` : '';
        return NextResponse.json({
            success: true,
            tier: finalTier,
            durationDays: totalDays,
            bonusDays,
            expiresAt: expiresAt.toISOString(),
            message: `เปิดใช้งานแพลน ${finalTier} สำเร็จ! (${totalDays} วัน${bonusMsg})`,
        });

    } catch (error) {
        console.error('[API] Activate License Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
