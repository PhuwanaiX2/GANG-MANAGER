import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import {
    Users, CalendarCheck, Wallet, Bot, Shield, Zap, Gem, Crown, Check,
    ArrowRight, ChevronRight, Terminal, BarChart3,
    Sparkles, MessageSquare, Globe
} from 'lucide-react';
import { LoginButton } from '@/components/LoginButton';

export default async function Home() {
    const session = await getServerSession(authOptions);

    if (session) {
        redirect('/dashboard');
    }

    const botInviteUrl = `https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=8&scope=bot+applications.commands`;

    return (
        <main className="relative min-h-screen bg-black text-white noise-overlay" style={{ touchAction: 'manipulation' }}>

            {/* ═══ NAVBAR ═══ */}
            <nav className="fixed top-0 left-0 right-0 z-50" role="navigation" aria-label="Main navigation">
                <div className="absolute inset-0 bg-black/70 backdrop-blur-2xl border-b border-white/[0.06]" />
                <div className="relative max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
                    <a href="/" className="flex items-center gap-2.5 group" aria-label="Gang Manager - หน้าแรก">
                        <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-discord-primary to-purple-600 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                            <Terminal className="w-4 h-4 text-white" strokeWidth={2.5} aria-hidden="true" />
                        </div>
                        <span className="font-bold text-[15px] tracking-tight">
                            Gang<span className="text-discord-primary">Manager</span>
                        </span>
                    </a>
                    <div className="hidden md:flex items-center gap-8 text-[13px] font-medium text-zinc-400">
                        <a href="#features" className="hover:text-white transition-colors duration-200">ฟีเจอร์</a>
                        <a href="#how-it-works" className="hover:text-white transition-colors duration-200">วิธีใช้งาน</a>
                        <a href="#pricing" className="hover:text-white transition-colors duration-200">ราคา</a>
                    </div>
                    <div className="flex items-center gap-3">
                        <a href={botInviteUrl} target="_blank" rel="noopener noreferrer"
                            className="hidden sm:flex items-center gap-1.5 text-[13px] font-medium text-zinc-400 hover:text-white transition-colors duration-200">
                            <Bot className="w-4 h-4" aria-hidden="true" />
                            เชิญบอท
                        </a>
                        <div className="hidden sm:block h-4 w-px bg-white/10" aria-hidden="true" />
                        <LoginButton />
                    </div>
                </div>
            </nav>

            {/* ═══ HERO ═══ */}
            <section className="relative z-10 min-h-screen flex flex-col items-center justify-center px-5 sm:px-8 pt-16" aria-labelledby="hero-title">
                {/* Aurora replaced by Crimson Grunge */}
                <div className="hero-aurora" aria-hidden="true" />

                {/* Heavy Gradients */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black z-[1] pointer-events-none" aria-hidden="true" />

                <div className="relative z-10 max-w-4xl mx-auto text-center mt-12">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-none border border-五m-red/30 bg-black/60 backdrop-blur-md animate-fade-in opacity-0" style={{ animationDelay: '200ms' }}>
                        <span className="relative flex h-2 w-2" aria-hidden="true">
                            <span className="animate-ping absolute inline-flex h-full w-full bg-五m-red opacity-75" />
                            <span className="relative inline-flex h-2 w-2 bg-五m-red" />
                        </span>
                        <span className="text-xs font-bold tracking-widest text-[#d1d5db] uppercase">
                            ระบบพร้อมใช้งาน · ฟรี 100%
                        </span>
                    </div>

                    {/* Title */}
                    <h1
                        id="hero-title"
                        className="text-[clamp(2.5rem,8vw,5.5rem)] font-black leading-[1.05] tracking-tighter uppercase animate-fade-in-up opacity-0"
                        style={{ animationDelay: '300ms', textWrap: 'balance' }}
                    >
                        คุมแก๊ง คุมคน
                        <br />
                        <span className="text-gradient-animated">คุมเมือง</span>
                    </h1>

                    <p className="mt-6 text-base sm:text-lg text-zinc-400 max-w-xl mx-auto leading-relaxed animate-fade-in-up opacity-0 font-medium" style={{ animationDelay: '500ms' }}>
                        จบทุกปัญหาหลังบ้านด้วย <strong className="text-white">Discord Bot</strong> และ <strong className="text-white">Dashboardสุดล้ำ</strong><br className="hidden sm:block" />
                        (จัดยศ, เช็คชื่อ, การเงิน, กองกลาง, Audit Logs)
                    </p>

                    {/* CTA */}
                    <div className="mt-10 flex flex-col sm:flex-row gap-4 items-center justify-center animate-fade-in-up opacity-0" style={{ animationDelay: '700ms' }}>
                        <a href={botInviteUrl} target="_blank" rel="noopener noreferrer"
                            className="btn-fivem flex items-center gap-2.5 px-8 py-4 text-[15px] font-bold text-white uppercase tracking-wider backdrop-blur-md bg-black/50">
                            <Terminal className="w-5 h-5 text-fivem-red" aria-hidden="true" />
                            เชิญบอทลงเซิร์ฟ
                        </a>
                        <a href="#features"
                            className="btn-secondary flex items-center gap-2 px-6 py-4 rounded bg-black/80 text-sm font-bold text-zinc-400 uppercase tracking-wider">
                            ดูระบบทั้งหมด
                        </a>
                    </div>
                </div>

                {/* Dashboard Preview */}
                <div className="relative z-10 mt-16 sm:mt-24 w-full max-w-5xl mx-auto dashboard-preview animate-fade-in-up opacity-0" style={{ animationDelay: '900ms' }}>
                    <div className="dashboard-preview-inner fivem-card p-0 shadow-2xl shadow-[#FF2A00]/[0.15]">
                        {/* Window Chrome */}
                        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/[0.06]">
                            <div className="flex items-center gap-1.5" aria-hidden="true">
                                <div className="w-3 h-3 rounded-full bg-white/[0.06] hover:bg-[#ff5f56] transition-colors duration-200" />
                                <div className="w-3 h-3 rounded-full bg-white/[0.06] hover:bg-[#ffbd2e] transition-colors duration-200" />
                                <div className="w-3 h-3 rounded-full bg-white/[0.06] hover:bg-[#27c93f] transition-colors duration-200" />
                            </div>
                            <div className="flex-1 flex justify-center">
                                <div className="px-4 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[11px] text-zinc-500 font-mono">
                                    gangmanager.app/dashboard
                                </div>
                            </div>
                            <div className="w-12" />
                        </div>

                        {/* Dashboard Content */}
                        <div className="p-5 sm:p-7">
                            {/* Stats */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                                {[
                                    { icon: <Users className="w-4 h-4 text-discord-primary" />, label: 'สมาชิก', value: '24', change: '+3' },
                                    { icon: <CalendarCheck className="w-4 h-4 text-emerald-400" />, label: 'เช็คชื่อวันนี้', value: '18', change: '75%' },
                                    { icon: <Wallet className="w-4 h-4 text-amber-400" />, label: 'กองกลาง', value: '฿12,450', change: '+฿2.1k' },
                                    { icon: <BarChart3 className="w-4 h-4 text-purple-400" />, label: 'อัตราเข้างาน', value: '87%', change: '+5%' },
                                ].map((stat, i) => (
                                    <div key={i} className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-3.5">
                                        <div className="flex items-center justify-between mb-2">
                                            <span aria-hidden="true">{stat.icon}</span>
                                            <span className="text-[10px] font-semibold text-emerald-400 tabular-nums">{stat.change}</span>
                                        </div>
                                        <div className="text-lg font-bold text-white tabular-nums">{stat.value}</div>
                                        <div className="text-[10px] text-zinc-500 font-medium mt-0.5">{stat.label}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Activity + Chart area */}
                            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                                {/* Fake chart */}
                                <div className="sm:col-span-3 rounded-xl bg-white/[0.02] border border-white/[0.04] p-4">
                                    <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-4">สถิติเช็คชื่อ 7 วัน</div>
                                    <div className="flex items-end gap-2 h-24" role="img" aria-label="กราฟแสดงสถิติเช็คชื่อ 7 วัน">
                                        {[65, 78, 45, 90, 82, 70, 88].map((h, i) => (
                                            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                                                <div className="w-full rounded-md bg-gradient-to-t from-discord-primary/30 to-discord-primary/70" style={{ height: `${h}%` }} />
                                                <span className="text-[9px] text-zinc-600 font-medium">{['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'][i]}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {/* Activity log */}
                                <div className="sm:col-span-2 rounded-xl bg-white/[0.02] border border-white/[0.04] p-4">
                                    <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-3">กิจกรรมล่าสุด</div>
                                    <div className="space-y-2.5">
                                        {[
                                            { t: '14:32', u: 'ShadowX', a: 'เช็คชื่อ', c: 'text-emerald-400' },
                                            { t: '14:28', u: 'NightRider', a: 'ยืม ฿500', c: 'text-amber-400' },
                                            { t: '14:15', u: 'Admin', a: 'อนุมัติ #42', c: 'text-discord-primary' },
                                            { t: '13:50', u: 'BlazeFury', a: 'ลาหยุด 2d', c: 'text-pink-400' },
                                        ].map((item, i) => (
                                            <div key={i} className="flex items-center gap-2.5">
                                                <span className="text-[10px] font-mono text-zinc-600 w-9 shrink-0 tabular-nums">{item.t}</span>
                                                <span className={`text-[11px] font-semibold ${item.c} truncate min-w-0`}>{item.u}</span>
                                                <span className="text-[11px] text-zinc-500 truncate min-w-0">{item.a}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Fade at bottom */}
                    <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black to-transparent pointer-events-none" aria-hidden="true" />
                </div>
            </section>

            {/* ═══ SOCIAL PROOF ═══ */}
            <section className="relative z-10 py-20 sm:py-28" aria-label="สถิติการใช้งาน">
                <div className="section-divider max-w-4xl mx-auto mb-16 sm:mb-20" aria-hidden="true" />
                <div className="max-w-4xl mx-auto px-5 sm:px-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        {[
                            { n: '500+', l: 'แก๊งที่ใช้งาน' },
                            { n: '5,000+', l: 'สมาชิกทั้งหมด' },
                            { n: '99.9%', l: 'Uptime' },
                            { n: '24/7', l: 'บอทออนไลน์' },
                        ].map((s, i) => (
                            <div key={i} className="text-center">
                                <div className="text-3xl sm:text-5xl font-bold tracking-tight bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent tabular-nums">{s.n}</div>
                                <div className="text-sm text-zinc-500 mt-2">{s.l}</div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="section-divider max-w-4xl mx-auto mt-16 sm:mt-20" aria-hidden="true" />
            </section>

            {/* ═══ FEATURES ═══ */}
            <section id="features" className="relative z-10 py-24 sm:py-32 px-5 sm:px-8 scroll-mt-20" aria-labelledby="features-title">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16 sm:mb-20">
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 mb-6 rounded-full border border-discord-primary/20 bg-discord-primary/5 text-discord-primary text-xs font-semibold">
                            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                            ฟีเจอร์
                        </div>
                        <h2 id="features-title" className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight" style={{ textWrap: 'balance' }}>
                            ทุกเครื่องมือที่แก๊ง
                            <span className="text-gradient-animated"> ต้องการ</span>
                        </h2>
                    </div>

                    {/* Bento Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                        {/* Member Management - Large */}
                        <div className="md:col-span-7 fivem-card p-7 sm:p-9 min-h-[320px] flex flex-col justify-between group">
                            <div>
                                <div className="w-12 h-12 rounded bg-black/50 border border-fivem-border flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110">
                                    <Users className="w-6 h-6 text-fivem-red" aria-hidden="true" />
                                </div>
                                <h3 className="text-xl sm:text-2xl font-bold mb-3 tracking-tight uppercase">ระบบสมาชิกสุดล้ำ</h3>
                                <p className="text-sm text-zinc-400 leading-relaxed max-w-md">
                                    ไม่ต้องคอยตามจด! ซิงค์ยศจาก Discord อัตโนมัติ เช็คประวัติการเงิน สถิติเข้างานได้รายคน
                                </p>
                            </div>
                            <div className="mt-6 flex flex-wrap gap-2">
                                {['Sync Auto', 'Role Management', 'Member Profile', 'Quick Search'].map((t) => (
                                    <span key={t} className="px-3 py-1.5 rounded-sm bg-black border border-fivem-border/40 text-[#d1d5db] text-[10px] font-bold tracking-widest uppercase">{t}</span>
                                ))}
                            </div>
                        </div>

                        {/* Attendance */}
                        <div className="md:col-span-5 fivem-card p-7 sm:p-9 min-h-[320px] group">
                            <div className="w-12 h-12 rounded bg-black/50 border border-green-500/20 flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110">
                                <CalendarCheck className="w-6 h-6 text-green-500" aria-hidden="true" />
                            </div>
                            <h3 className="text-xl font-bold mb-3 tracking-tight uppercase">เช็คชื่อกะงาน</h3>
                            <p className="text-sm text-zinc-400 leading-relaxed">
                                กดเช็คชื่อ/ออกกะ ผ่าน Discord ทันที ระบบหักเงินค่าปรับคนมาสายออโต้
                            </p>
                            {/* Mini chart visualization */}
                            <div className="mt-8 flex items-end gap-1.5 h-16" role="img" aria-label="กราฟแสดงสถิติเช็คชื่อ">
                                {[40, 65, 50, 80, 70, 90, 85].map((h, i) => (
                                    <div key={i} className="flex-1 rounded-sm bg-green-500/15 transition-all duration-500" style={{ height: `${h}%` }}>
                                        <div className="w-full h-1/2 rounded-sm bg-green-500/30 border-t border-green-400" />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Finance */}
                        <div className="md:col-span-5 fivem-card p-7 sm:p-9 min-h-[300px] group">
                            <div className="w-12 h-12 rounded bg-black/50 border border-amber-500/30 flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110">
                                <Wallet className="w-6 h-6 text-amber-500" aria-hidden="true" />
                            </div>
                            <h3 className="text-xl font-bold mb-3 tracking-tight uppercase">ตู้เซฟ & การเงิน</h3>
                            <p className="text-sm text-zinc-400 leading-relaxed">
                                ระบบเบิก/ฝาก/คืนตู้เซฟแก๊ง อนุมัติไวผ่านเว็บ ดูยอดเงินรวมไม่ต้องกลัวเงินหาย
                            </p>
                            <div className="mt-6 flex items-center gap-3">
                                <div className="flex-1 h-3 rounded-none bg-black border border-white/5 overflow-hidden">
                                    <div className="h-full w-[72%] rounded-none bg-amber-500 transition-all duration-1000" />
                                </div>
                                <span className="text-[13px] font-bold text-amber-500 tabular-nums">฿12,450</span>
                            </div>
                        </div>

                        {/* Bot */}
                        <div className="md:col-span-7 fivem-card p-7 sm:p-9 min-h-[300px] flex flex-col justify-between group">
                            <div>
                                <div className="w-12 h-12 rounded bg-black/50 border border-purple-500/30 flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110">
                                    <Terminal className="w-6 h-6 text-purple-500" aria-hidden="true" />
                                </div>
                                <h3 className="text-xl sm:text-2xl font-bold mb-3 tracking-tight uppercase">Slash Commands รวดเร็ว</h3>
                                <p className="text-sm text-zinc-400 leading-relaxed max-w-md">
                                    ไม่ต้องสลับแท็บไปมา พิมพ์คำสั่ง / ดำเนินการทุกอย่างผ่านช่องแชท Discord หรูหรา ไร้รอยต่อ
                                </p>
                            </div>
                            {/* Command preview */}
                            <div className="mt-6 rounded-xl bg-black/50 border border-white/[0.04] p-4 font-mono text-xs space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-discord-primary font-bold">/</span>
                                    <span className="text-zinc-200">checkin</span>
                                    <span className="text-zinc-600 hidden sm:inline">— เช็คชื่อเข้างาน</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-discord-primary font-bold">/</span>
                                    <span className="text-zinc-200">balance</span>
                                    <span className="text-zinc-600 hidden sm:inline">— เช็คยอดเงินกองกลาง</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-discord-primary font-bold">/</span>
                                    <span className="text-zinc-200">leave request</span>
                                    <span className="text-zinc-600 hidden sm:inline">— แจ้งลาหยุด</span>
                                </div>
                            </div>
                        </div>

                        {/* Audit */}
                        <div className="md:col-span-6 fivem-card p-7 sm:p-9 group">
                            <div className="w-12 h-12 rounded bg-black/50 border border-cyan-500/30 flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110">
                                <Shield className="w-6 h-6 text-cyan-500" aria-hidden="true" />
                            </div>
                            <h3 className="text-xl font-bold mb-3 tracking-tight uppercase">Audit Logs (จับนกต่อ)</h3>
                            <p className="text-sm text-zinc-400 leading-relaxed">
                                ทุกคลิก ทุกลบ ทุกการเคลื่อนไหว ถูกบันทึกประวัติหลังบ้านทั้งหมด ป้องกันการทุจริตในแก๊ง
                            </p>
                        </div>

                        {/* Dashboard */}
                        <div className="md:col-span-6 fivem-card p-7 sm:p-9 group">
                            <div className="w-12 h-12 rounded bg-black/50 border border-zinc-500/40 flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110">
                                <Globe className="w-6 h-6 text-zinc-300" aria-hidden="true" />
                            </div>
                            <h3 className="text-xl font-bold mb-3 tracking-tight uppercase">Admin Dashboard</h3>
                            <p className="text-sm text-zinc-400 leading-relaxed">
                                เข้าหน้าเว็บผ่านบัญชี Discord ควบคุมสิทธิ์ แยกแอดมิน เหรัญญิก ได้ตามใจชอบ
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══ HOW IT WORKS ═══ */}
            <section id="how-it-works" className="relative z-10 py-24 sm:py-32 px-5 sm:px-8 scroll-mt-20" aria-labelledby="how-title">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16 sm:mb-20">
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 mb-6 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-xs font-semibold">
                            <Zap className="w-3.5 h-3.5" aria-hidden="true" />
                            เริ่มต้นง่ายมาก
                        </div>
                        <h2 id="how-title" className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight" style={{ textWrap: 'balance' }}>
                            3 ขั้นตอน<span className="text-gradient-animated"> เริ่มใช้งานได้เลย</span>
                        </h2>
                        <p className="text-zinc-500 mt-4 text-base sm:text-lg">ตั้งค่าเสร็จใน 2 นาที ไม่ต้องเขียนโค้ด</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {[
                            {
                                num: '01',
                                title: 'เชิญบอทเข้าเซิร์ฟเวอร์',
                                desc: 'กดปุ่มเชิญบอท เลือก Discord Server ของคุณ ให้สิทธิ์ที่จำเป็น เสร็จ!',
                                icon: <Bot className="w-5 h-5 text-discord-primary" aria-hidden="true" />,
                                color: 'from-discord-primary/20',
                            },
                            {
                                num: '02',
                                title: 'ตั้งค่าแก๊ง',
                                desc: 'ใช้คำสั่ง /setup ตั้งชื่อแก๊ง เลือกยศ กำหนดกฎ ระบบพร้อมใช้ทันที',
                                icon: <Terminal className="w-5 h-5 text-purple-400" aria-hidden="true" />,
                                color: 'from-purple-500/20',
                            },
                            {
                                num: '03',
                                title: 'จัดการผ่านเว็บ',
                                desc: 'เข้าสู่ระบบด้วย Discord ดู Dashboard จัดการทุกอย่างได้จากหน้าเว็บ',
                                icon: <Globe className="w-5 h-5 text-emerald-400" aria-hidden="true" />,
                                color: 'from-emerald-500/20',
                            },
                        ].map((step, i) => (
                            <div key={i} className={`gradient-border card-shine p-7 sm:p-8 ${i < 2 ? 'step-connector' : ''}`}>
                                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${step.color} to-transparent border border-white/[0.06] flex items-center justify-center mb-5`}>
                                    {step.icon}
                                </div>
                                <div className="text-[11px] font-bold text-zinc-600 tracking-widest mb-3 tabular-nums">STEP {step.num}</div>
                                <h3 className="text-lg font-bold mb-2.5 tracking-tight">{step.title}</h3>
                                <p className="text-sm text-zinc-400 leading-relaxed">{step.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ PRICING ═══ */}
            <section id="pricing" className="relative z-10 py-24 sm:py-32 px-5 sm:px-8 scroll-mt-20" aria-labelledby="pricing-title">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16 sm:mb-20">
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 mb-6 rounded-full border border-amber-500/20 bg-amber-500/5 text-amber-400 text-xs font-semibold">
                            <Crown className="w-3.5 h-3.5" aria-hidden="true" />
                            ราคา
                        </div>
                        <h2 id="pricing-title" className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight" style={{ textWrap: 'balance' }}>
                            เลือกแพลนที่<span className="text-gradient-animated"> เหมาะกับคุณ</span>
                        </h2>
                        <p className="text-zinc-500 mt-4 text-base sm:text-lg">เริ่มต้นฟรี อัปเกรดเมื่อพร้อม</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {/* Free */}
                        <div className="gradient-border card-shine p-7 sm:p-8 flex flex-col">
                            <div className="text-zinc-400 mb-2"><Crown className="w-5 h-5" aria-hidden="true" /></div>
                            <h3 className="text-lg font-bold">Free</h3>
                            <p className="text-xs text-zinc-500 mt-1 mb-6">เหมาะกับแก๊งเล็กที่เพิ่งเริ่มต้น</p>
                            <div className="mb-8">
                                <span className="text-4xl font-bold tabular-nums">฿0</span>
                                <span className="text-zinc-500 text-sm ml-1">/เดือน</span>
                            </div>
                            <ul className="space-y-3.5 flex-1">
                                {['สมาชิกสูงสุด 10 คน', 'ลงทะเบียน + เช็คชื่อ', 'ระบบแจ้งลา', 'Audit Log 7 วัน'].map((f, i) => (
                                    <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-300">
                                        <Check className="w-4 h-4 mt-0.5 shrink-0 text-zinc-600" aria-hidden="true" />
                                        {f}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Pro - Popular */}
                        <div className="pricing-popular gradient-border card-shine p-7 sm:p-8 relative flex flex-col">
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-discord-primary to-purple-600 text-white text-[10px] font-bold tracking-widest uppercase px-5 py-1 rounded-full shadow-lg shadow-discord-primary/30">
                                แนะนำ
                            </div>
                            <div className="text-discord-primary mb-2"><Zap className="w-5 h-5" aria-hidden="true" /></div>
                            <h3 className="text-lg font-bold">Pro</h3>
                            <p className="text-xs text-zinc-500 mt-1 mb-6">สำหรับแก๊งที่ต้องการระบบการเงิน</p>
                            <div className="mb-8">
                                <span className="text-4xl font-bold tabular-nums">฿149</span>
                                <span className="text-zinc-500 text-sm ml-1">/เดือน</span>
                            </div>
                            <ul className="space-y-3.5 flex-1">
                                {['สมาชิกสูงสุด 25 คน', 'ระบบการเงิน (ยืม/คืน/ฝาก)', 'Export CSV', 'Backup รายวัน', 'Audit Log 90 วัน'].map((f, i) => (
                                    <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-300">
                                        <Check className="w-4 h-4 mt-0.5 shrink-0 text-discord-primary" aria-hidden="true" />
                                        {f}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Premium */}
                        <div className="gradient-border card-shine p-7 sm:p-8 flex flex-col">
                            <div className="text-purple-400 mb-2"><Gem className="w-5 h-5" aria-hidden="true" /></div>
                            <h3 className="text-lg font-bold">Premium</h3>
                            <p className="text-xs text-zinc-500 mt-1 mb-6">ครบทุกฟีเจอร์สำหรับแก๊งขนาดใหญ่</p>
                            <div className="mb-8">
                                <span className="text-4xl font-bold tabular-nums">฿299</span>
                                <span className="text-zinc-500 text-sm ml-1">/เดือน</span>
                            </div>
                            <ul className="space-y-3.5 flex-1">
                                {['สมาชิกสูงสุด 50 คน', 'ทุกอย่างใน Pro', 'เก็บเงินแก๊ง', 'สรุปรายเดือน', 'Analytics Dashboard', 'Multi-Admin', 'Audit Log ไม่จำกัด', 'Priority Support'].map((f, i) => (
                                    <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-300">
                                        <Check className="w-4 h-4 mt-0.5 shrink-0 text-purple-400" aria-hidden="true" />
                                        {f}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══ FINAL CTA ═══ */}
            <section className="relative z-10 py-32 sm:py-40 px-5 sm:px-8 overflow-hidden" aria-labelledby="cta-title">
                {/* Background orb */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(88,101,242,0.1) 0%, transparent 65%)' }} aria-hidden="true" />

                <div className="relative max-w-2xl mx-auto text-center">
                    <h2 id="cta-title" className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight mb-6" style={{ textWrap: 'balance' }}>
                        พร้อมบริหารแก๊ง
                        <br />
                        <span className="text-gradient-animated">อย่างมืออาชีพ?</span>
                    </h2>
                    <p className="text-zinc-400 text-base sm:text-lg mb-10 max-w-md mx-auto leading-relaxed">
                        เริ่มต้นฟรีวันนี้ ตั้งค่าเสร็จใน 2 นาที ไม่ต้องใช้บัตรเครดิต
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
                        <a href={botInviteUrl} target="_blank" rel="noopener noreferrer"
                            className="btn-fivem flex items-center gap-2.5 px-8 py-4 text-base font-bold text-white uppercase backdrop-blur-md bg-black/50">
                            <Terminal className="w-5 h-5 text-fivem-red" aria-hidden="true" />
                            ลงทะเบียนเซิร์ฟเวอร์
                        </a>
                        <a href="https://discord.gg/rHvkNv8ayj" target="_blank" rel="noopener noreferrer"
                            className="group flex items-center gap-2 text-zinc-400 hover:text-white text-sm font-medium transition-colors duration-200">
                            <MessageSquare className="w-4 h-4" aria-hidden="true" />
                            พูดคุยกับเราบน Discord
                            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-200" aria-hidden="true" />
                        </a>
                    </div>
                </div>
            </section>

            {/* ═══ FOOTER ═══ */}
            <footer className="relative z-10 border-t border-white/[0.06] py-10 px-5 sm:px-8">
                <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                    <a href="/" className="flex items-center gap-2.5 group" aria-label="Gang Manager">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-discord-primary to-purple-600 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                            <Terminal className="w-3.5 h-3.5 text-white" strokeWidth={2.5} aria-hidden="true" />
                        </div>
                        <span className="text-sm font-bold tracking-tight text-zinc-400">
                            Gang<span className="text-discord-primary">Manager</span>
                        </span>
                    </a>
                    <div className="flex items-center gap-6 text-xs text-zinc-600">
                        <a href="https://discord.gg/rHvkNv8ayj" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 transition-colors duration-200">ศูนย์ช่วยเหลือ</a>
                        <span className="w-px h-3 bg-zinc-800" aria-hidden="true" />
                        <span>&copy; 2026 Gang Manager</span>
                    </div>
                </div>
            </footer>
        </main>
    );
}
