import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { BILLING_PLANS } from '@/lib/billingPlans';
import {
    Users, CalendarCheck, Wallet, Bot, Shield, Check,
    Terminal, Globe, Zap, ArrowRight, Sparkles, ChevronRight
} from 'lucide-react';
import { LoginButton } from '@/components/LoginButton';

export default async function Home() {
    const session = await getServerSession(authOptions);

    if (session) {
        redirect('/dashboard');
    }

    const botInviteUrl = `https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=8&scope=bot+applications.commands`;

    const features = [
        { icon: <Users className="w-5 h-5" />, title: 'จัดการสมาชิก', desc: 'ซิงค์ยศจาก Discord อัตโนมัติ ดูข้อมูลแต่ละคนได้เลย', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        { icon: <CalendarCheck className="w-5 h-5" />, title: 'เช็คชื่อเข้างาน', desc: 'เปิดรอบเช็คชื่อผ่าน Bot สรุปเวลาทำงานอัตโนมัติ', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
        { icon: <Wallet className="w-5 h-5" />, title: 'กองกลาง', desc: 'เบิก/ฝาก/ยืม/คืน พร้อมระบบอนุมัติโปร่งใส', color: 'text-amber-400', bg: 'bg-amber-500/10' },
        { icon: <Terminal className="w-5 h-5" />, title: 'Slash Commands', desc: 'พิมพ์คำสั่งใน Discord จัดการได้ทันที', color: 'text-violet-400', bg: 'bg-violet-500/10' },
        { icon: <Shield className="w-5 h-5" />, title: 'Audit Logs', desc: 'บันทึกทุกกิจกรรม ใครทำอะไร ดูย้อนหลังได้', color: 'text-rose-400', bg: 'bg-rose-500/10' },
        { icon: <Globe className="w-5 h-5" />, title: 'Web Dashboard', desc: 'ดูข้อมูลผ่านเว็บ แยกสิทธิ์ตามยศอัตโนมัติ', color: 'text-sky-400', bg: 'bg-sky-500/10' },
    ];

    return (
        <main className="relative min-h-screen bg-[#09090B] text-white overflow-hidden" style={{ touchAction: 'manipulation' }}>

            {/* ═══ NAVBAR ═══ */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-[#09090B]/70 backdrop-blur-xl border-b border-white/[0.06]" role="navigation" aria-label="Main navigation">
                <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
                    <a href="/" className="flex items-center gap-2.5 group" aria-label="Gang Manager">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center transition-all group-hover:bg-emerald-500/20 group-hover:border-emerald-500/30">
                            <Terminal className="w-4 h-4 text-emerald-400" strokeWidth={2} aria-hidden="true" />
                        </div>
                        <span className="font-bold text-[15px] tracking-tight font-heading">
                            Gang<span className="text-emerald-400">Manager</span>
                        </span>
                    </a>
                    <div className="hidden md:flex items-center gap-8 text-[13px] font-medium text-zinc-400">
                        <a href="#features" className="hover:text-white transition-colors">ฟีเจอร์</a>
                        <a href="#how-it-works" className="hover:text-white transition-colors">วิธีใช้งาน</a>
                        <a href="#pricing" className="hover:text-white transition-colors">ราคา</a>
                    </div>
                    <div className="flex items-center gap-3">
                        <a href={botInviteUrl} target="_blank" rel="noopener noreferrer"
                            className="hidden sm:flex items-center gap-1.5 text-[13px] font-medium text-zinc-400 hover:text-emerald-400 transition-colors">
                            <Bot className="w-4 h-4" aria-hidden="true" />
                            เชิญบอท
                        </a>
                        <LoginButton />
                    </div>
                </div>
            </nav>

            {/* ═══ HERO ═══ */}
            <section className="relative z-10 px-5 sm:px-8 pt-32 sm:pt-40 pb-24 sm:pb-32" aria-labelledby="hero-title">
                {/* Glow background */}
                <div className="bg-glow-hero" aria-hidden="true" />
                <div className="absolute inset-0 bg-grid-subtle opacity-40" aria-hidden="true" />

                <div className="relative z-10 max-w-4xl mx-auto text-center">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full border border-emerald-500/20 bg-emerald-500/5 animate-fade-in">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                        <span className="text-emerald-300 text-xs font-semibold">ระบบจัดการแก๊งอันดับ 1 สำหรับ FiveM</span>
                    </div>

                    <h1 id="hero-title" className="text-5xl sm:text-7xl font-extrabold leading-[1.05] tracking-tight font-heading animate-fade-in-up">
                        จัดการแก๊ง FiveM
                        <br />
                        <span className="text-gradient-hero">ครบจบในที่เดียว</span>
                    </h1>

                    <p className="mt-6 text-lg sm:text-xl text-zinc-400 max-w-xl mx-auto leading-relaxed animate-fade-in-up delay-100">
                        สั่งงานผ่าน <span className="text-white font-medium">Discord Bot</span> · ดูข้อมูลผ่าน <span className="text-white font-medium">Web Dashboard</span>
                    </p>

                    <div className="mt-10 flex flex-col sm:flex-row gap-4 items-center justify-center animate-fade-in-up delay-200">
                        <a href={botInviteUrl} target="_blank" rel="noopener noreferrer"
                            className="btn-primary px-8 py-3.5 text-sm flex items-center gap-2.5">
                            <Bot className="w-4.5 h-4.5" aria-hidden="true" />
                            เพิ่มบอทลงเซิร์ฟเวอร์
                            <ArrowRight className="w-4 h-4" aria-hidden="true" />
                        </a>
                        <LoginButton />
                    </div>

                    {/* Quick feature pills */}
                    <div className="mt-14 flex flex-wrap items-center justify-center gap-3 animate-fade-in-up delay-300">
                        {[
                            { icon: <Users className="w-3.5 h-3.5 text-emerald-400" />, text: 'จัดยศ' },
                            { icon: <CalendarCheck className="w-3.5 h-3.5 text-cyan-400" />, text: 'เช็คชื่อ' },
                            { icon: <Wallet className="w-3.5 h-3.5 text-amber-400" />, text: 'กองกลาง' },
                            { icon: <Shield className="w-3.5 h-3.5 text-rose-400" />, text: 'Audit Log' },
                        ].map((f, i) => (
                            <span key={i} className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/[0.03] text-sm text-zinc-300 hover:border-white/20 hover:bg-white/[0.06] transition-all cursor-default">
                                {f.icon} {f.text}
                            </span>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ FEATURES ═══ */}
            <section id="features" className="relative z-10 py-20 sm:py-28 px-5 sm:px-8 scroll-mt-20" aria-labelledby="features-title">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-14">
                        <div className="inline-flex items-center gap-2 px-3 py-1 mb-5 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-300 text-xs font-semibold">
                            <Zap className="w-3.5 h-3.5" aria-hidden="true" />
                            ระบบหลัก
                        </div>
                        <h2 id="features-title" className="text-3xl sm:text-4xl font-bold tracking-tight font-heading">
                            ทุกอย่างที่แก๊งต้องการ
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {features.map((f, i) => (
                            <div key={i} className="group relative p-6 rounded-2xl bg-[#0F0F12] border border-white/[0.08] hover:border-white/[0.16] transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/20">
                                <div className={`w-11 h-11 rounded-xl ${f.bg} flex items-center justify-center mb-4 ${f.color} transition-transform group-hover:scale-110`}>
                                    {f.icon}
                                </div>
                                <h3 className="text-base font-semibold text-white mb-2 font-heading">{f.title}</h3>
                                <p className="text-sm text-zinc-400 leading-relaxed">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ HOW IT WORKS ═══ */}
            <section id="how-it-works" className="relative z-10 py-20 sm:py-28 px-5 sm:px-8 scroll-mt-20" aria-labelledby="how-title">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-14">
                        <h2 id="how-title" className="text-3xl sm:text-4xl font-bold tracking-tight font-heading">
                            เริ่มใช้งานใน <span className="text-gradient-hero">3 ขั้นตอน</span>
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        {[
                            { num: '01', title: 'เพิ่มบอท', desc: 'เลือก Server แล้วกดเพิ่มบอท', icon: <Bot className="w-5 h-5" />, color: 'from-emerald-500 to-cyan-500' },
                            { num: '02', title: 'พิมพ์ /setup', desc: 'ตั้งชื่อแก๊งและผูกยศ Discord', icon: <Terminal className="w-5 h-5" />, color: 'from-cyan-500 to-violet-500' },
                            { num: '03', title: 'เข้าแดชบอร์ด', desc: 'ล็อกอินด้วย Discord จัดการได้เลย', icon: <Globe className="w-5 h-5" />, color: 'from-violet-500 to-rose-500' },
                        ].map((step, i) => (
                            <div key={i} className="relative p-6 rounded-2xl bg-[#0F0F12] border border-white/[0.08] text-center group hover:border-white/[0.16] transition-all duration-300">
                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center mx-auto mb-5 text-white shadow-lg transition-transform group-hover:scale-110`}>
                                    {step.icon}
                                </div>
                                <div className="text-xs font-bold text-zinc-500 font-mono mb-2 tracking-widest">STEP {step.num}</div>
                                <h3 className="text-lg font-semibold text-white mb-2 font-heading">{step.title}</h3>
                                <p className="text-sm text-zinc-400">{step.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ PRICING ═══ */}
            <section id="pricing" className="relative z-10 py-20 sm:py-28 px-5 sm:px-8 scroll-mt-20" aria-labelledby="pricing-title">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-14">
                        <h2 id="pricing-title" className="text-3xl sm:text-4xl font-bold tracking-tight font-heading">
                            แพ็กเกจ
                        </h2>
                        <p className="mt-3 text-zinc-400 text-base">เริ่มต้นฟรี อัปเกรดได้เมื่อพร้อม</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl mx-auto">
                        {BILLING_PLANS.map((plan, i) => (
                            <div key={i} className={`relative p-6 rounded-2xl border flex flex-col transition-all duration-300 hover:-translate-y-1 ${plan.popular
                                ? 'border-emerald-500/30 bg-gradient-to-b from-emerald-500/[0.06] to-transparent shadow-lg shadow-emerald-500/5 card-glow'
                                : 'border-white/[0.08] bg-[#0F0F12] hover:border-white/[0.16]'
                                }`}>
                                {plan.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-[11px] font-bold px-4 py-1 rounded-full shadow-lg shadow-emerald-500/20">⚡ ยอดนิยม</span>}
                                <h3 className="text-lg font-bold text-white font-heading">{plan.name}</h3>
                                <p className="text-xs text-zinc-500 mt-1 mb-5">{plan.marketingDescription}</p>
                                <div className="mb-5 pb-5 border-b border-white/[0.06]">
                                    <span className="text-3xl font-extrabold text-white tabular-nums font-heading">฿{plan.priceMonthly}</span>
                                    <span className="text-zinc-500 text-sm ml-1.5">/เดือน</span>
                                </div>
                                <ul className="space-y-3 flex-1 mb-6">
                                    {plan.marketingFeatures.map((f, j) => (
                                        <li key={j} className="flex gap-2 text-sm text-zinc-300">
                                            <Check className={`w-4 h-4 mt-0.5 shrink-0 ${plan.id === 'PREMIUM' ? 'text-emerald-400' : 'text-zinc-500'}`} />
                                            <span>{f}</span>
                                        </li>
                                    ))}
                                </ul>
                                <a href={plan.id === 'PREMIUM' ? '#' : botInviteUrl} className={plan.id === 'PREMIUM'
                                    ? 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold transition-colors'
                                    : 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 border border-white/[0.08] hover:border-white/[0.18] bg-white/[0.03] text-white font-semibold transition-colors'}>
                                    {plan.id === 'PREMIUM' ? 'เลือก Premium' : 'เริ่มฟรี'} <ArrowRight className="w-4 h-4" />
                                </a>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ FINAL CTA ═══ */}
            <section className="relative z-10 py-20 sm:py-28 px-5 sm:px-8 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/[0.03] to-transparent" aria-hidden="true" />
                <div className="relative max-w-2xl mx-auto text-center">
                    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight font-heading mb-4">
                        พร้อมยกระดับแก๊งของคุณ?
                    </h2>
                    <p className="text-zinc-400 mb-8 text-base">เริ่มใช้ฟรีวันนี้ ไม่ต้องผูกบัตร</p>
                    <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
                        <a href={botInviteUrl} target="_blank" rel="noopener noreferrer"
                            className="btn-primary px-8 py-3.5 text-sm flex items-center gap-2.5">
                            <Bot className="w-4.5 h-4.5" aria-hidden="true" />
                            เพิ่มบอทลงเซิร์ฟเวอร์
                        </a>
                        <a href="https://discord.gg/rHvkNv8ayj" target="_blank" rel="noopener noreferrer"
                            className="group flex items-center gap-2 text-zinc-400 hover:text-emerald-400 text-sm font-medium transition-colors">
                            Discord ซัพพอร์ต
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                        </a>
                    </div>
                </div>
            </section>

            {/* ═══ FOOTER ═══ */}
            <footer className="relative z-10 border-t border-white/[0.06] py-10 px-5 sm:px-8">
                <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                            <Terminal className="w-3 h-3 text-emerald-400" strokeWidth={2} aria-hidden="true" />
                        </div>
                        <span className="text-sm font-semibold tracking-tight font-heading">
                            Gang<span className="text-emerald-400">Manager</span>
                        </span>
                    </div>
                    <div className="flex items-center gap-6 text-xs text-zinc-500 font-medium">
                        <a href="https://discord.gg/rHvkNv8ayj" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors">ซัพพอร์ต</a>
                        <span className="w-px h-3 bg-white/10" aria-hidden="true" />
                        <a href="#" className="hover:text-white transition-colors">เงื่อนไข</a>
                        <span className="w-px h-3 bg-white/10" aria-hidden="true" />
                        <span>&copy; 2026 Gang Manager</span>
                    </div>
                </div>
            </footer>
        </main>
    );
}
