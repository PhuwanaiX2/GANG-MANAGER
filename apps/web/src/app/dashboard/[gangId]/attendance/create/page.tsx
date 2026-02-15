export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, gangs, canAccessFeature } from '@gang/database';
import { eq } from 'drizzle-orm';

import { CreateSessionForm } from './CreateSessionForm';
import { ClipboardPlus } from 'lucide-react';

interface Props {
    params: { gangId: string };
}

export default async function CreateAttendancePage({ params }: Props) {
    const session = await getServerSession(authOptions);
    if (!session) redirect('/');

    const { gangId } = params;

    const gang = await db.query.gangs.findFirst({
        where: eq(gangs.id, gangId),
    });

    if (!gang) redirect('/dashboard');

    return (
        <>
            <div className="mb-8">
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 mb-2">
                    สร้างรอบเช็คชื่อใหม่
                </h1>
                <p className="text-gray-400 flex items-center gap-2">
                    <ClipboardPlus className="w-4 h-4" />
                    สร้างรอบและส่งปุ่มเช็คชื่อไปยัง Discord
                </p>
            </div>

            <div className="bg-[#151515] border border-white/5 rounded-2xl p-6 max-w-2xl">
                <CreateSessionForm gangId={gangId} hasFinance={canAccessFeature(gang.subscriptionTier, 'finance')} />
            </div>
        </>
    );
}
