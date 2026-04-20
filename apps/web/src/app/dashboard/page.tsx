export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, gangs, members } from '@gang/database';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { DashboardLayout } from '@/components/DashboardLayout';
import { normalizeSubscriptionTierValue } from '@/lib/subscriptionTier';
import { Users, ArrowRight, Server } from 'lucide-react';

const ADMIN_IDS = (process.env.ADMIN_DISCORD_IDS || '').split(',').filter(Boolean);

export default async function DashboardPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect('/');
    }

    // Get user's gangs (gangs where user is a member)
    const userMembers = await db.query.members.findMany({
        where: (members, { eq, and }) => and(
            eq(members.discordId, session.user.discordId),
            eq(members.isActive, true),
            eq(members.status, 'APPROVED')
        ),
        with: {
            gang: true,
        },
    });

    const userGangs = userMembers.map(m => m.gang).filter(Boolean);

    // If no gangs, show empty state
    if (userGangs.length === 0) {
        return (
            <DashboardLayout session={session} isSystemAdmin={ADMIN_IDS.includes(session.user.discordId)}>
                <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 max-w-md mx-auto animate-fade-in">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5">
                        <Server className="w-6 h-6 text-emerald-400" strokeWidth={1.5} />
                    </div>
                    <h2 className="text-xl font-bold mb-2 text-white font-heading">ยังไม่มีแก๊ง</h2>
                    <p className="text-zinc-400 mb-8 text-sm leading-relaxed">สมัครผ่าน Discord หรือติดตั้งบอทในเซิร์ฟเวอร์</p>
                    <a
                        href={`https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=8&scope=bot+applications.commands`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary px-6 py-2.5 text-sm flex items-center gap-2"
                    >
                        ติดตั้งบอท <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout session={session} isSystemAdmin={ADMIN_IDS.includes(session.user.discordId)}>
            <div className="mb-8 animate-fade-in">
                <h1 className="text-2xl font-bold tracking-tight text-white font-heading">เลือกแก๊ง</h1>
                <p className="text-zinc-500 text-sm mt-1">เลือกแก๊งที่ต้องการจัดการ</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in-up">
                {userGangs.map((gang) => (
                    <Link
                        key={gang.id}
                        href={`/dashboard/${gang.id}`}
                        className="group flex items-center gap-4 p-5 rounded-2xl bg-[#0F0F12] border border-white/[0.08] hover:border-emerald-500/20 hover:bg-[#12121A] transition-all duration-300 hover:-translate-y-0.5"
                    >
                        {gang.logoUrl ? (
                            <img src={gang.logoUrl} alt={gang.name} className="w-12 h-12 rounded-xl object-cover border border-white/10 shrink-0 shadow-lg" />
                        ) : (
                            <div className="w-12 h-12 bg-[#16161A] rounded-xl border border-white/10 flex items-center justify-center shrink-0">
                                <Users className="w-5 h-5 text-zinc-400" />
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-white truncate font-heading">{gang.name}</h3>
                            <span className="text-xs text-zinc-500">{normalizeSubscriptionTierValue(gang.subscriptionTier)} Plan</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-emerald-400 transition-colors shrink-0" />
                    </Link>
                ))}
            </div>
        </DashboardLayout>
    );
}
