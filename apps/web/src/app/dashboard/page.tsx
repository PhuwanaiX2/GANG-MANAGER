import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, gangs, members } from '@gang/database';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Home, Users, ArrowRight, Shield, Crown } from 'lucide-react';

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
            <DashboardLayout session={session}>
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-black/20 rounded-3xl border border-dashed border-gray-800">
                    <div className="w-24 h-24 bg-discord-primary/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
                        <Home className="w-10 h-10 text-discord-primary" />
                    </div>
                    <h2 className="text-3xl font-bold mb-3 text-white">ยังไม่มีแก๊ง</h2>
                    <p className="text-gray-400 mb-8 max-w-md leading-relaxed">
                        คุณยังไม่ได้เป็นสมาชิกแก๊งใดๆ ในระบบ
                        <br />
                        กรุณาลงทะเบียนผ่าน Discord หรือรอให้หัวหน้าแก๊งเพิ่มคุณเข้าสู่ระบบ
                    </p>
                    <a
                        href={`https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=8&scope=bot+applications.commands`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-6 py-3 bg-discord-primary hover:bg-[#4752C4] text-white rounded-xl font-medium transition-all transform hover:scale-105 shadow-lg shadow-discord-primary/20"
                    >
                        <span>เริ่มต้นใช้งาน Discord Bot</span>
                        <ArrowRight className="w-4 h-4" />
                    </a>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout session={session}>
            <div className="mb-12 animate-fade-in relative">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <h1 className="text-4xl sm:text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-white via-white to-white/40 mb-3">
                            พอร์ทัลแก๊ง
                        </h1>
                        <p className="text-gray-400 font-medium text-lg leading-relaxed">
                            เลือกแก๊งที่คุณต้องการจัดการเพื่อเข้าสู่แดชบอร์ด
                        </p>
                    </div>
                </div>
                <div className="absolute top-0 right-0 h-full flex items-center opacity-10 pointer-events-none">
                    <Shield className="w-40 h-40 text-discord-primary blur-sm rotate-12" />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-fade-in-up">
                {userGangs.map((gang, index) => (
                    <Link
                        key={gang.id}
                        href={`/dashboard/${gang.id}`}
                        className="group relative h-full flex flex-col bg-white/[0.02] border border-white/5 hover:border-discord-primary/30 p-8 rounded-[2.5rem] transition-all duration-500 hover:shadow-[0_20px_60px_-15px_rgba(88,101,242,0.2)] hover:-translate-y-2 overflow-hidden backdrop-blur-sm"
                        style={{ animationDelay: `${index * 100}ms` }}
                    >
                        {/* Card Gloss Effect */}
                        <div className="absolute top-0 left-0 w-full h-full bg-gradient-glass opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                        <div className="relative z-10 flex flex-col h-full">
                            <div className="flex justify-between items-start mb-8">
                                <div className="p-4 bg-gradient-premium rounded-2xl shadow-lg shadow-discord-primary/20 group-hover:scale-110 transition-transform duration-500">
                                    <Users className="w-8 h-8 text-white" />
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <span className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase border ${gang.subscriptionTier === 'PRO'
                                        ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                                        : 'bg-white/5 text-gray-400 border-white/10'
                                        }`}>
                                        {gang.subscriptionTier === 'PRO' && <Crown className="w-3 h-3" />}
                                        {gang.subscriptionTier}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-auto">
                                <h3 className="text-2xl sm:text-3xl font-black mb-3 text-white group-hover:bg-clip-text group-hover:text-transparent group-hover:bg-gradient-premium transition-all duration-300">
                                    {gang.name}
                                </h3>
                                <div className="flex items-center gap-2 text-sm font-bold text-gray-500 group-hover:text-discord-primary transition-colors duration-300">
                                    <span className="uppercase tracking-widest text-[10px]">จัดการระบบ</span>
                                    <ArrowRight className="w-4 h-4 transform -translate-x-2 group-hover:translate-x-0 opacity-0 group-hover:opacity-100 transition-all duration-300" />
                                </div>
                            </div>
                        </div>

                        {/* Background Decoration */}
                        <div className="absolute -bottom-10 -right-10 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-500">
                            <Shield className="w-48 h-48 rotate-[-15deg] group-hover:rotate-0 transition-transform duration-700" />
                        </div>
                    </Link>
                ))}
            </div>
        </DashboardLayout>
    );
}
