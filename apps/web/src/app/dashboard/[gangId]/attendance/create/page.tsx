export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, gangs, canAccessFeature } from '@gang/database';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { getGangPermissions } from '@/lib/permissions';

import { CreateSessionForm } from './CreateSessionForm';
import { ClipboardPlus, ArrowLeft, Clock } from 'lucide-react';

interface Props {
    params: { gangId: string };
}

export default async function CreateAttendancePage({ params }: Props) {
    const session = await getServerSession(authOptions);
    if (!session) redirect('/');

    const { gangId } = params;

    const permissions = await getGangPermissions(gangId, session.user.discordId);
    if (!permissions.isOwner && !permissions.isAdmin && !permissions.isAttendanceOfficer) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 ring-1 ring-red-500/20">
                    <Clock className="w-8 h-8 text-red-500" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2 tracking-wide font-heading">ไม่มีสิทธิ์เข้าถึง</h1>
                <p className="text-zinc-400 max-w-md">
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
            <div className="flex items-start gap-4 pb-6 border-b border-white/5">
                <Link
                    href={`/dashboard/${gangId}/attendance`}
                    className="p-2.5 bg-[#111] border border-white/5 hover:bg-white/5 rounded-xl text-zinc-400 hover:text-white transition-all shadow-sm group mt-1"
                >
                    <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
                </Link>
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 shadow-sm">
                            <ClipboardPlus className="w-5 h-5 text-emerald-400" />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-white font-heading">
                            สร้างรอบเช็คชื่อใหม่
                        </h1>
                    </div>
                    <p className="text-sm text-zinc-500 font-medium">
                        กำหนดเวลาเช็คชื่อ และส่งข้อความให้สมาชิกกดปุ่มผ่าน Discord
                    </p>
                </div>
            </div>

            <div className="bg-[#111] border border-white/5 rounded-2xl p-6 sm:p-8 max-w-2xl shadow-sm">
                <CreateSessionForm gangId={gangId} hasFinance={canAccessFeature(gang.subscriptionTier, 'finance')} />
            </div>
        </div>
    );
}
