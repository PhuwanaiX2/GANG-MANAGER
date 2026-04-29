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
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex items-start gap-4 pb-6 border-b border-border-subtle">
                <Link
                    href={`/dashboard/${gangId}/attendance`}
                    className="p-2.5 bg-bg-subtle border border-border-subtle hover:bg-bg-muted rounded-token-xl text-fg-secondary hover:text-fg-primary transition-all shadow-token-sm group mt-1"
                >
                    <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
                </Link>
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-token-xl bg-status-success-subtle border border-status-success/20 shadow-token-sm">
                            <ClipboardPlus className="w-5 h-5 text-fg-success" />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-fg-primary font-heading">
                            สร้างรอบเช็คชื่อใหม่
                        </h1>
                    </div>
                    <p className="text-sm text-fg-tertiary font-medium">
                        กำหนดเวลาเช็คชื่อก่อน แล้วค่อยให้ระบบเปิดรอบอัตโนมัติหรือเปิดเองจากหน้ารอบนั้น
                    </p>
                </div>
            </div>

            <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl p-6 sm:p-8 max-w-2xl shadow-token-sm">
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
