export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, gangs, members } from '@gang/database';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { DashboardLayout } from '@/components/DashboardLayout';
import { normalizeSubscriptionTierValue } from '@/lib/subscriptionTier';
import { Users, ArrowRight, Server, Terminal, Shield, Sparkles } from 'lucide-react';
import { Badge, EmptyState } from '@/components/ui';

const ADMIN_IDS = (process.env.ADMIN_DISCORD_IDS || '').split(',').filter(Boolean);

function getTierLabel(tier: string | null | undefined) {
    const normalized = normalizeSubscriptionTierValue(tier);
    if (normalized === 'TRIAL') return 'Trial 7 วัน';
    if (normalized === 'PREMIUM') return 'Pro';
    return 'Free';
}

function getExpirySummary(expiresAt: Date | null | undefined) {
    if (!expiresAt) return null;
    const expiryDate = new Date(expiresAt);
    const diffDays = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'หมดอายุแล้ว';
    return `เหลือ ${diffDays} วัน`;
}

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
                <div className="min-h-[50vh] flex items-center justify-center animate-fade-in">
                    <EmptyState
                        icon={<Server className="w-6 h-6" strokeWidth={1.5} />}
                        title="ยังไม่มีแก๊ง"
                        description="สมัครผ่าน Discord หรือติดตั้งบอทในเซิร์ฟเวอร์"
                        action={
                            <a
                                href={`https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=8&scope=bot+applications.commands`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-primary px-6 py-2.5 text-sm flex items-center gap-2"
                            >
                                ติดตั้งบอท <ArrowRight className="w-3.5 h-3.5" />
                            </a>
                        }
                    />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout session={session} isSystemAdmin={ADMIN_IDS.includes(session.user.discordId)}>
            <div className="mb-8 grid gap-4 lg:grid-cols-[1.6fr_0.8fr] animate-fade-in">
                <div className="relative overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle p-6 shadow-token-md">
                    <div className="absolute -right-16 -top-20 h-44 w-44 rounded-token-full bg-accent-subtle blur-3xl" />
                    <div className="relative z-10">
                        <Badge tone="accent" variant="outline" size="md" className="mb-4 gap-2 px-3 py-1">
                            <Terminal className="h-3.5 w-3.5" />
                            Command Selector
                        </Badge>
                        <h1 className="text-3xl font-black tracking-tight text-fg-primary font-heading sm:text-4xl">เลือกแก๊ง</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-secondary">
                            เลือกศูนย์บัญชาการที่ต้องการจัดการ ระบบจะแสดงเฉพาะแก๊งที่คุณเป็นสมาชิกและได้รับอนุมัติแล้ว
                        </p>
                    </div>
                </div>

                <div className="rounded-token-2xl border border-border-subtle bg-bg-subtle p-5 shadow-token-sm">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-fg-tertiary">Available Gangs</p>
                            <p className="mt-1 text-3xl font-black text-fg-primary tabular-nums">{userGangs.length}</p>
                        </div>
                        <div className="flex h-12 w-12 items-center justify-center rounded-token-xl border border-border-accent bg-accent-subtle text-accent-bright shadow-token-glow-accent">
                            <Shield className="h-5 w-5" />
                        </div>
                    </div>
                    <p className="mt-4 text-xs leading-relaxed text-fg-tertiary">
                        เข้าแต่ละแก๊งเพื่อดูภาพรวม สมาชิก การเงิน เช็คชื่อ และงานปฏิบัติการที่เกี่ยวข้อง
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 animate-fade-in-up sm:grid-cols-2 xl:grid-cols-3">
                {userGangs.map((gang) => {
                    const normalizedTier = normalizeSubscriptionTierValue(gang.subscriptionTier);
                    const isFree = normalizedTier === 'FREE';

                    return (
                        <Link
                            key={gang.id}
                            href={`/dashboard/${gang.id}`}
                            className="group relative overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle p-5 shadow-token-sm transition-[transform,border-color,background-color,box-shadow] duration-token-normal ease-token-standard hover:-translate-y-1 hover:border-border-accent hover:bg-bg-muted hover:shadow-token-md"
                        >
                            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-accent via-accent-bright to-transparent opacity-60" />
                            <div className="absolute -right-12 -top-12 h-28 w-28 rounded-token-full bg-accent-subtle blur-2xl transition-opacity duration-token-normal group-hover:opacity-100" />

                            <div className="relative z-10 flex items-start justify-between gap-4">
                                <div className="flex min-w-0 items-center gap-4">
                                    {gang.logoUrl ? (
                                        <img src={gang.logoUrl} alt={gang.name} className="h-14 w-14 shrink-0 rounded-token-xl border border-border-subtle object-cover shadow-token-md" />
                                    ) : (
                                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-token-xl border border-border-subtle bg-bg-elevated shadow-token-sm">
                                            <Users className="h-6 w-6 text-fg-tertiary" />
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <h3 className="truncate text-base font-black tracking-tight text-fg-primary font-heading">{gang.name}</h3>
                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                            <Badge tone={isFree ? 'neutral' : 'accent'} variant={isFree ? 'soft' : 'outline'} size="sm">
                                                {getTierLabel(gang.subscriptionTier)}
                                            </Badge>
                                            {!isFree && gang.subscriptionExpiresAt && (
                                                <span className="text-[11px] font-medium text-fg-tertiary">
                                                    {getExpirySummary(gang.subscriptionExpiresAt)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-token-full border border-border-subtle bg-bg-muted text-fg-tertiary transition-colors duration-token-normal group-hover:border-border-accent group-hover:text-accent-bright">
                                    <ArrowRight className="h-4 w-4" />
                                </div>
                            </div>

                            <div className="relative z-10 mt-5 flex items-center justify-between border-t border-border-subtle pt-4">
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-fg-tertiary">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    Ready
                                </span>
                                <span className="text-[11px] font-semibold text-fg-secondary">เปิด command center</span>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </DashboardLayout>
    );
}
