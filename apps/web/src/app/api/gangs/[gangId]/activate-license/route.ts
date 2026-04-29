import { NextRequest, NextResponse } from 'next/server';
import { isGangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { buildRateLimitSubject, enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { logError } from '@/lib/logger';
import { db, gangs, licenses, auditLogs, normalizeSubscriptionTier } from '@gang/database';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

async function requireLicenseActivationAccess(gangId: string) {
    try {
        return {
            access: await requireGangAccess({ gangId, minimumRole: 'OWNER' }),
            response: null,
        };
    } catch (error) {
        if (isGangAccessError(error)) {
            return {
                access: null,
                response: NextResponse.json(
                    { error: error.status === 401 ? 'Unauthorized' : 'เฉพาะหัวหน้าแก๊งเท่านั้น' },
                    { status: error.status === 401 ? 401 : 403 }
                ),
            };
        }

        throw error;
    }
}

export async function POST(request: NextRequest, props: { params: Promise<{ gangId: string }> }) {
    const params = await props.params;
    const { gangId } = params;
    let actorDiscordId = 'unknown';

    try {
        const { access, response } = await requireLicenseActivationAccess(gangId);
        if (!access) {
            return response ?? NextResponse.json({ error: 'เฉพาะหัวหน้าแก๊งเท่านั้น' }, { status: 403 });
        }
        const sessionUser = (access.session as { user?: { discordId?: string; name?: string | null } } | null | undefined)?.user;
        actorDiscordId = sessionUser?.discordId || 'unknown';

        const rateLimited = await enforceRouteRateLimit(request, {
            scope: 'api:activate-license',
            limit: 10,
            windowMs: 60 * 1000,
            subject: buildRateLimitSubject('activate-license', gangId, actorDiscordId),
        });
        if (rateLimited) {
            return rateLimited;
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

        const normalizedLicenseTier = normalizeSubscriptionTier(license.tier);
        const licenseDays = license.durationDays || 30;

        let totalDays = licenseDays;
        let bonusDays = 0;
        let finalTier = normalizedLicenseTier;

        // Check if gang already has an active paid plan with remaining days
        const now = new Date();
        const currentExpiry = gang?.subscriptionExpiresAt ? new Date(gang.subscriptionExpiresAt) : null;
        const remainingMs = currentExpiry ? currentExpiry.getTime() - now.getTime() : 0;
        const remainingDays = remainingMs > 0 ? Math.ceil(remainingMs / (1000 * 60 * 60 * 24)) : 0;

        if (remainingDays > 0 && normalizeSubscriptionTier(gang?.subscriptionTier) === 'PREMIUM') {
            // Existing paid time stacks on top of the incoming Premium license duration.
            totalDays = licenseDays + remainingDays;
            bonusDays = remainingDays;
            finalTier = normalizedLicenseTier;
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + totalDays);

        // Activate: update gang tier + mark license as used
        await db.update(gangs)
            .set({
                subscriptionTier: finalTier,
                subscriptionExpiresAt: expiresAt,
                updatedAt: new Date(),
            })
            .where(eq(gangs.id, gangId));

        await db.update(licenses)
            .set({ isActive: false })
            .where(eq(licenses.id, license.id));

        await db.insert(auditLogs).values({
            id: nanoid(),
            gangId,
            actorId: actorDiscordId,
            actorName: sessionUser?.name || 'Unknown',
            action: 'LICENSE_ACTIVATE',
            targetType: 'license',
            targetId: license.id,
            oldValue: JSON.stringify({
                previousTier: gang?.subscriptionTier || null,
                previousExpiresAt: gang?.subscriptionExpiresAt || null,
                licenseActive: license.isActive,
            }),
            newValue: JSON.stringify({
                tier: finalTier,
                expiresAt: expiresAt.toISOString(),
                licenseActive: false,
            }),
            details: JSON.stringify({
                licenseKey: license.key,
                durationDays: totalDays,
                bonusDays,
            }),
        });

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
        logError('api.activate_license.failed', error, {
            gangId,
            actorDiscordId,
        });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
