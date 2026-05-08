export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, gangs, canAccessFeature, resolveEffectiveSubscriptionTier } from '@gang/database';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { getGangPermissionFlagsForDiscordId } from '@/lib/gangAccess';

import { CreateSessionForm } from './CreateSessionForm';
import { ClipboardPlus, ArrowLeft, Clock } from 'lucide-react';

interface Props {
    params: Promise<{ gangId: string }>;
}

export default async function CreateAttendancePage(props: Props) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session) redirect('/');

    const { gangId } = params;

    const permissions = await getGangPermissionFlagsForDiscordId({ gangId, discordId: session.user.discordId });
    if (!permissions.isOwner && !permissions.isAdmin && !permissions.isAttendanceOfficer) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                <div className="w-16 h-16 bg-status-danger-subtle rounded-token-full flex items-center justify-center mb-4 ring-1 ring-status-danger/20">
                    <Clock className="w-8 h-8 text-fg-danger" />
                </div>
                <h1 className="text-2xl font-bold text-fg-primary mb-2 tracking-wide font-heading">ไม่มีสิทธิ์เข้าถึง</h1>
                <p className="text-fg-secondary max-w-md">
                    เฉพาะหัวหน้าแก๊ง (Owner), รองหัวหน้า (Admin) หรือ เจ้าหน้าที่เช็คชื่อ เท่านั้น
                </p>
            </div>
        );
    }

    const gang = await db.query.gangs.findFirst({
        where: eq(gangs.id, gangId),
    });

    if (!gang) redirect('/dashboard');

    return (
        <div className="max-w-5xl space-y-4 animate-fade-in-up">
            <div className="overflow-hidden rounded-token-xl border border-border-subtle bg-bg-subtle p-3.5 shadow-token-sm sm:p-4">
                <div className="flex items-start gap-3 sm:gap-4">
                <Link
                    href={`/dashboard/${gangId}/attendance`}
                    className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-token-lg border border-border-subtle bg-bg-subtle text-fg-secondary shadow-token-sm transition-all hover:bg-bg-muted hover:text-fg-primary"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <div>
                    <div className="mb-1.5 flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-token-lg border border-status-success/20 bg-status-success-subtle shadow-token-sm">
                            <ClipboardPlus className="h-4 w-4 text-fg-success" />
                        </div>
                        <h1 className="font-heading text-xl font-black tracking-tight text-fg-primary sm:text-2xl">
                            สร้างรอบเช็คชื่อใหม่
                        </h1>
                    </div>
                    <p className="max-w-2xl text-sm font-medium leading-6 text-fg-tertiary">
                        กำหนดเวลาเช็คชื่อก่อน แล้วค่อยให้ระบบเปิดรอบอัตโนมัติหรือเปิดเองจากหน้ารอบนั้น
                    </p>
                </div>
                </div>
            </div>

            <div className="max-w-4xl rounded-token-xl border border-border-subtle bg-bg-subtle p-3 shadow-token-sm sm:p-4">
                <CreateSessionForm
                    gangId={gangId}
                    hasFinance={canAccessFeature(
                        resolveEffectiveSubscriptionTier(gang.subscriptionTier, gang.subscriptionExpiresAt),
                        'finance'
                    )}
                />
            </div>
        </div>
    );
}
