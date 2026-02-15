import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import {
    Users, CalendarCheck, Wallet, Bot, Shield, Zap, Gem, Crown, Check,
    ArrowRight, ChevronRight, Terminal, BarChart3, Clock, FileText,
    Sparkles, MessageSquare, Lock, Globe
} from 'lucide-react';
import { LoginButton } from '@/components/LoginButton';

export default async function Home() {
    const session = await getServerSession(authOptions);

    if (session) {
        redirect('/dashboard');
    }

    const botInviteUrl = `https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=8&scope=bot+applications.commands`;

    return (
        <main className="relative min-h-screen bg-black text-white selection:bg-discord-primary/30">

            {/* ═══ NAVBAR ═══ */}
            <nav className="fixed top-0 left-0 right-0 z-50">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-2xl border-b border-white/[0.06]" />
                <div className="relative max-w-6xl mx-auto px-5 sm:px-8 h-[60px] flex items-center justify-between">
                    <a href="/" className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-discord-primary to-purple-600 flex items-center justify-center">
                            <Terminal className="w-4 h-4 text-white" strokeWidth={2.5} />
                        </div>
                        <span className="font-bold text-[15px] tracking-tight">
                            Gang<span className="text-discord-primary">Manager</span>
                        </span>
                    </a>
                    <div className="hidden md:flex items-center gap-7 text-[13px] font-medium text-zinc-400">
                        <a href="#features" className="hover:text-white transition-colors duration-200">ฟีเจอร์</a>
                        <a href="#how-it-works" className="hover:text-white transition-colors duration-200">วิธีใช้งาน</a>
                        <a href="#pricing" className="hover:text-white transition-colors duration-200">ราคา</a>
                    </div>
                    <div className="flex items-center gap-3">
                        <a href={botInviteUrl} target="_blank" rel="noopener noreferrer"
                           className="hidden sm:flex items-center gap-1.5 text-[13px] font-medium text-zinc-400 hover:text-white transition-colors">
                            <Bot className="w-4 h-4" />
                            เชิญบอท
                        </a>
                        <div className="hidden sm:block h-4 w-px bg-white/10" />
                        <LoginButton />
                    </div>
                </div>
            </nav>

            {/* ═══ HERO ═══ */}
            <section className="relative z-10 min-h-screen flex flex-col items-center justify-center px-5 sm:px-8 pt-[60px]">
                {/* Aurora */}
                <div className="hero-aurora" />

                {/* Radial fade overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black z-[1] pointer-events-none" />

                <div className="relative z-10 max-w-4xl mx-auto text-center">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm animate-fade-in" style={{ animationDelay: '200ms' }}>
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                        </span>
                        <span className="text-[11px] font-medium tracking-wide text-zinc-300">
                            ใช้งานฟรี · ไม่ต้องใช้บัตรเครดิต
                        </span>
                    </div>

                    {/* Title */}
                    <h1 className="text-[clamp(2.5rem,8vw,6rem)] font-bold leading-[1.05] tracking-tight animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                        จัดการแก๊ง FiveM
                        <br />
                        <span className="text-gradient-animated">ในที่เดียว</span>
                    </h1>

                    <p className="mt-6 text-base sm:text-lg text-zinc-400 max-w-xl mx-auto leading-relaxed animate-fade-in-up" style={{ animationDelay: '450ms' }}>
                        สมาชิก · การเงิน · เช็คชื่อ · ลาหยุด · Audit Log
                        <br className="hidden sm:block" />
                        ควบคุมทุกอย่างผ่าน <span className="text-white font-medium">Discord Bot</span> และ <span className="text-white font-medium">Web Dashboard</span>
                    </p>

                    {/* CTA */}
                    <div className="mt-10 flex flex-col sm:flex-row gap-3 items-center justify-center animate-fade-in-up" style={{ animationDelay: '600ms' }}>
                        <a href={botInviteUrl} target="_blank" rel="noopener noreferrer"
                           className="btn-glow flex items-center gap-2.5 px-7 py-3.5 rounded-xl text-[15px] font-semibold text-white">
                            <Bot className="w-5 h-5" />
                            เริ่มต้นใช้งานฟรี
                            <ArrowRight className="w-4 h-4" />
                        </a>
                        <a href="#features"
                           className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-[14px] font-medium text-zinc-400 hover:text-white border border-white/[0.08] hover:border-white/20 hover:bg-white/[0.03] transition-all duration-300">
                            ดูฟีเจอร์ทั้งหมด
                            <ChevronRight className="w-4 h-4" />
                        </a>
                    </div>
                </div>

                {/* Dashboard Preview */}
                <div className="relative z-10 mt-16 sm:mt-20 w-full max-w-5xl mx-auto animate-fade-in-up" style={{ animationDelay: '800ms' }}>
                    <div className="gradient-border card-shine shadow-2xl shadow-discord-primary/[0.08]">
                        {/* Window Chrome */}
                        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06]">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
                                <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                                <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
                            </div>
                            <div className="flex-1 flex justify-center">
                                <div className="px-4 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] text-[10px] text-zinc-500 font-mono">
                                    gangmanager.app/dashboard
                                </div>
                            </div>
                            <div className="w-12" />
                        </div>

                        {/* Dashboard Content */}
                        <div className="p-5 sm:p-7">
                            {/* Stats */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                                {[
                                    { icon: <Users className="w-4 h-4 text-discord-primary" />, label: 'สมาชิก', value: '24', change: '+3' },
                                    { icon: <CalendarCheck className="w-4 h-4 text-emerald-400" />, label: 'เช็คชื่อวันนี้', value: '18', change: '75%' },
                                    { icon: <Wallet className="w-4 h-4 text-amber-400" />, label: 'กองกลาง', value: '฿12,450', change: '+฿2.1k' },
                                    { icon: <BarChart3 className="w-4 h-4 text-purple-400" />, label: 'อัตราเข้างาน', value: '87%', change: '+5%' },
                                ].map((stat, i) => (
                                    <div key={i} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3.5">
                                        <div className="flex items-center justify-between mb-2">
                                            {stat.icon}
                                            <span className="text-[10px] font-medium text-emerald-400">{stat.change}</span>
                                        </div>
                                        <div className="text-lg font-bold text-white">{stat.value}</div>
                                        <div className="text-[10px] text-zinc-500 font-medium mt-0.5">{stat.label}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Activity + Chart area */}
                            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                                {/* Fake chart */}
                                <div className="sm:col-span-3 rounded-xl bg-white/[0.02] border border-white/[0.06] p-4">
                                    <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-4">สถิติเช็คชื่อ 7 วัน</div>
                                    <div className="flex items-end gap-1.5 h-24">
                                        {[65, 78, 45, 90, 82, 70, 88].map((h, i) => (
                                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                                <div className="w-full rounded-sm bg-gradient-to-t from-discord-primary/40 to-discord-primary/80" style={{ height: `${h}%` }} />
                                                <span className="text-[8px] text-zinc-600">{['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'][i]}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {/* Activity log */}
                                <div className="sm:col-span-2 rounded-xl bg-white/[0.02] border border-white/[0.06] p-4">
                                    <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-3">กิจกรรมล่าสุด</div>
                                    <div className="space-y-2.5">
                                        {[
                                            { t: '14:32', u: 'ShadowX', a: 'เช็คชื่อ', c: 'text-emerald-400' },
                                            { t: '14:28', u: 'NightRider', a: 'ยืม ฿500', c: 'text-amber-400' },
                                            { t: '14:15', u: 'Admin', a: 'อนุมัติ #42', c: 'text-discord-primary' },
                                            { t: '13:50', u: 'BlazeFury', a: 'ลาหยุด 2d', c: 'text-pink-400' },
                                        ].map((item, i) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <span className="text-[9px] font-mono text-zinc-600 w-8 shrink-0">{item.t}</span>
                                                <span className={`text-[11px] font-semibold ${item.c} truncate`}>{item.u}</span>
                                                <span className="text-[11px] text-zinc-500 truncate">{item.a}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Fade at bottom */}
                    <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent pointer-events-none" />
                </div>
            </section>

            {/* ═══ SOCIAL PROOF ═══ */}
            <section className="relative z-10 py-16 sm:py-20">
                <div className="max-w-4xl mx-auto px-5 sm:px-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {[
                            { n: '500+', l: 'แก๊งที่ใช้งาน' },
                            { n: '5,000+', l: 'สมาชิกทั้งหมด' },
                            { n: '99.9%', l: 'Uptime' },
                            { n: '24/7', l: 'บอทออนไลน์' },
                        ].map((s, i) => (
                            <div key={i} className="text-center">
                                <div className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">{s.n}</div>
                                <div className="text-[13px] text-zinc-500 mt-1.5">{s.l}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ FEATURES ═══ */}
            <section id="features" className="relative z-10 py-24 sm:py-32 px-5 sm:px-8">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-14 sm:mb-20">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-5 rounded-full border border-discord-primary/20 bg-discord-primary/5 text-discord-primary text-xs font-semibold">
                            <Sparkles className="w-3.5 h-3.5" />
                            ฟีเจอร์
                        </div>
                        <h2 className="text-3xl sm:text-[2.75rem] font-bold tracking-tight leading-tight">
                            ทุกเครื่องมือที่แก๊ง
                            <span className="text-gradient-animated"> ต้องการ</span>
                        </h2>
                    </div>

                    {/* Bento */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        {/* Member Management - Large */}
                        <div className="md:col-span-7 gradient-border card-shine p-7 sm:p-9 min-h-[300px] flex flex-col justify-between">
                            <div>
                                <div className="w-12 h-12 rounded-2xl bg-discord-primary/10 border border-discord-primary/20 flex items-center justify-center mb-6">
                                    <Users className="w-6 h-6 text-discord-primary" />
                                </div>
                                <h3 className="text-xl sm:text-2xl font-bold mb-3 tracking-tight">จัดการสมาชิกแบบ Real-time</h3>
                                <p className="text-sm text-zinc-400 leading-relaxed max-w-md">
                                    เพิ่ม ลบ แก้ไข ซิงค์ยศจาก Discord อัตโนมัติ ดูโปรไฟล์ สถิติเช็คชื่อ ประวัติการเงิน ครบในหน้าเดียว
                                </p>
                            </div>
                            <div className="mt-6 flex flex-wrap gap-2">
                                {['ซิงค์ Discord', 'จัดการยศ', 'โปรไฟล์', 'ค้นหาขั้นสูง'].map((t) => (
                                    <span key={t} className="px-3 py-1.5 rounded-lg bg-discord-primary/[0.08] text-discord-primary text-[11px] font-medium">{t}</span>
                                ))}
                            </div>
                        </div>

                        {/* Attendance */}
                        <div className="md:col-span-5 gradient-border card-shine p-7 sm:p-9 min-h-[300px]">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6">
                                <CalendarCheck className="w-6 h-6 text-emerald-400" />
                            </div>
                            <h3 className="text-xl font-bold mb-3 tracking-tight">เช็คชื่อ Real-time</h3>
                            <p className="text-sm text-zinc-400 leading-relaxed">
                                เปิดเซสชันผ่าน Bot สมาชิกกดเข้าร่วมทันที สรุปสถิติรายวัน/สัปดาห์ ไม่พลาดทุกการเข้างาน
                            </p>
                            {/* Mini chart visualization */}
                            <div className="mt-8 flex items-end gap-1 h-16">
                                {[40, 65, 50, 80, 70, 90, 85].map((h, i) => (
                                    <div key={i} className="flex-1 rounded-t-sm bg-emerald-400/20" style={{ height: `${h}%` }}>
                                        <div className="w-full h-1/2 rounded-t-sm bg-emerald-400/40" />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Finance */}
                        <div className="md:col-span-5 gradient-border card-shine p-7 sm:p-9 min-h-[280px]">
                            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6">
                                <Wallet className="w-6 h-6 text-amber-400" />
                            </div>
                            <h3 className="text-xl font-bold mb-3 tracking-tight">ระบบการเงิน</h3>
                            <p className="text-sm text-zinc-400 leading-relaxed">
                                ยืม/คืน/ฝาก อนุมัติรายการผ่านเว็บ ดูยอดกองกลาง Real-time โปร่งใสทุกบาท
                            </p>
                            <div className="mt-6 flex items-center gap-3">
                                <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                                    <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-amber-500 to-amber-400" />
                                </div>
                                <span className="text-xs font-bold text-amber-400">฿12,450</span>
                            </div>
                        </div>

                        {/* Bot */}
                        <div className="md:col-span-7 gradient-border card-shine p-7 sm:p-9 min-h-[280px] flex flex-col justify-between">
                            <div>
                                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-6">
                                    <Bot className="w-6 h-6 text-purple-400" />
                                </div>
                                <h3 className="text-xl sm:text-2xl font-bold mb-3 tracking-tight">Discord Bot ครบวงจร</h3>
                                <p className="text-sm text-zinc-400 leading-relaxed max-w-md">
                                    Slash Commands สำหรับทุกอย่าง: ลงทะเบียน เช็คชื่อ ยืมเงิน ลาหยุด ดูสถิติ ไม่ต้องออกจาก Discord
                                </p>
                            </div>
                            {/* Command preview */}
                            <div className="mt-6 rounded-xl bg-black/40 border border-white/[0.05] p-4 font-mono text-xs">
                                <div className="flex items-center gap-2 text-zinc-500">
                                    <span className="text-discord-primary">/</span>
                                    <span className="text-zinc-300">checkin</span>
                                    <span className="text-zinc-600">— เช็คชื่อเข้างาน</span>
                                </div>
                                <div className="flex items-center gap-2 text-zinc-500 mt-1.5">
                                    <span className="text-discord-primary">/</span>
                                    <span className="text-zinc-300">balance</span>
                                    <span className="text-zinc-600">— เช็คยอดเงินกองกลาง</span>
                                </div>
                                <div className="flex items-center gap-2 text-zinc-500 mt-1.5">
                                    <span className="text-discord-primary">/</span>
                                    <span className="text-zinc-300">leave request</span>
                                    <span className="text-zinc-600">— แจ้งลาหยุด</span>
                                </div>
                            </div>
                        </div>

                        {/* Audit */}
                        <div className="md:col-span-6 gradient-border card-shine p-7 sm:p-9">
                            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-6">
                                <Shield className="w-6 h-6 text-rose-400" />
                            </div>
                            <h3 className="text-xl font-bold mb-3 tracking-tight">Audit Log & ความปลอดภัย</h3>
                            <p className="text-sm text-zinc-400 leading-relaxed">
                                ทุก Action ถูกบันทึก ย้อนดูประวัติได้ทุกเมื่อ ป้องกันการทุจริต โปร่งใส 100%
                            </p>
                        </div>

                        {/* Dashboard */}
                        <div className="md:col-span-6 gradient-border card-shine p-7 sm:p-9">
                            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-6">
                                <Globe className="w-6 h-6 text-cyan-400" />
                            </div>
                            <h3 className="text-xl font-bold mb-3 tracking-tight">Web Dashboard</h3>
                            <p className="text-sm text-zinc-400 leading-relaxed">
                                Login ด้วย Discord ดูทุกอย่างในหน้าเดียว พร้อม Export CSV สรุปรายเดือน Analytics
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══ HOW IT WORKS ═══ */}
            <section id="how-it-works" className="relative z-10 py-24 sm:py-32 px-5 sm:px-8">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-14 sm:mb-20">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-5 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-xs font-semibold">
                            <Zap className="w-3.5 h-3.5" />
                            เริ่มต้นง่ายมาก
                        </div>
                        <h2 className="text-3xl sm:text-[2.75rem] font-bold tracking-tight leading-tight">
                            3 ขั้นตอน<span className="text-gradient-animated"> เริ่มใช้งานได้เลย</span>
                        </h2>
                        <p className="text-zinc-500 mt-3 text-base">ตั้งค่าเสร็จใน 2 นาที ไม่ต้องเขียนโค้ด</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {[
                            {
                                num: '01',
                                title: 'เชิญบอทเข้าเซิร์ฟเวอร์',
                                desc: 'กดปุ่มเชิญบอท เลือก Discord Server ของคุณ ให้สิทธิ์ที่จำเป็น เสร็จ!',
                                icon: <Bot className="w-5 h-5 text-discord-primary" />,
                                color: 'from-discord-primary/20',
                            },
                            {
                                num: '02',
                                title: 'ตั้งค่าแก๊ง',
                                desc: 'ใช้คำสั่ง /setup ตั้งชื่อแก๊ง เลือกยศ กำหนดกฎ ระบบพร้อมใช้ทันที',
                                icon: <Terminal className="w-5 h-5 text-purple-400" />,
                                color: 'from-purple-500/20',
                            },
                            {
                                num: '03',
                                title: 'จัดการผ่านเว็บ',
                                desc: 'เข้าสู่ระบบด้วย Discord ดู Dashboard จัดการทุกอย่างได้จากหน้าเว็บ',
                                icon: <Globe className="w-5 h-5 text-emerald-400" />,
                                color: 'from-emerald-500/20',
                            },
                        ].map((step, i) => (
                            <div key={i} className={`gradient-border card-shine p-7 sm:p-8 ${i < 2 ? 'step-connector' : ''}`}>
                                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${step.color} to-transparent border border-white/[0.06] flex items-center justify-center mb-5`}>
                                    {step.icon}
                                </div>
                                <div className="text-[11px] font-bold text-zinc-600 tracking-wider mb-3">STEP {step.num}</div>
                                <h3 className="text-lg font-bold mb-2 tracking-tight">{step.title}</h3>
                                <p className="text-sm text-zinc-400 leading-relaxed">{step.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ PRICING ═══ */}
            <section id="pricing" className="relative z-10 py-24 sm:py-32 px-5 sm:px-8">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-14 sm:mb-20">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-5 rounded-full border border-amber-500/20 bg-amber-500/5 text-amber-400 text-xs font-semibold">
                            <Crown className="w-3.5 h-3.5" />
                            ราคา
                        </div>
                        <h2 className="text-3xl sm:text-[2.75rem] font-bold tracking-tight leading-tight">
                            เลือกแพลนที่<span className="text-gradient-animated"> เหมาะกับคุณ</span>
                        </h2>
                        <p className="text-zinc-500 mt-3 text-base">เริ่มต้นฟรี อัปเกรดเมื่อพร้อม</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {/* Free */}
                        <div className="gradient-border card-shine p-7 sm:p-8">
                            <div className="text-zinc-400 mb-1"><Crown className="w-5 h-5" /></div>
                            <h3 className="text-lg font-bold">Free</h3>
                            <p className="text-xs text-zinc-500 mt-1 mb-6">เหมาะกับแก๊งเล็กที่เพิ่งเริ่มต้น</p>
                            <div className="mb-6">
                                <span className="text-4xl font-bold">฿0</span>
                                <span className="text-zinc-500 text-sm ml-1">/เดือน</span>
                            </div>
                            <ul className="space-y-3">
                                {['สมาชิกสูงสุด 10 คน', 'ลงทะเบียน + เช็คชื่อ', 'ระบบแจ้งลา', 'Audit Log 7 วัน'].map((f, i) => (
                                    <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-300">
                                        <Check className="w-4 h-4 mt-0.5 shrink-0 text-zinc-600" />
                                        {f}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Pro - Popular */}
                        <div className="pricing-popular gradient-border card-shine p-7 sm:p-8 relative">
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-discord-primary to-purple-600 text-white text-[10px] font-bold tracking-wider uppercase px-5 py-1 rounded-full shadow-lg shadow-discord-primary/30">
                                แนะนำ
                            </div>
                            <div className="text-discord-primary mb-1"><Zap className="w-5 h-5" /></div>
                            <h3 className="text-lg font-bold">Pro</h3>
                            <p className="text-xs text-zinc-500 mt-1 mb-6">สำหรับแก๊งที่ต้องการระบบการเงิน</p>
                            <div className="mb-6">
                                <span className="text-4xl font-bold">฿149</span>
                                <span className="text-zinc-500 text-sm ml-1">/เดือน</span>
                            </div>
                            <ul className="space-y-3">
                                {['สมาชิกสูงสุด 25 คน', 'ระบบการเงิน (ยืม/คืน/ฝาก)', 'Export CSV', 'Backup รายวัน', 'Audit Log 90 วัน'].map((f, i) => (
                                    <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-300">
                                        <Check className="w-4 h-4 mt-0.5 shrink-0 text-discord-primary" />
                                        {f}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Premium */}
                        <div className="gradient-border card-shine p-7 sm:p-8">
                            <div className="text-purple-400 mb-1"><Gem className="w-5 h-5" /></div>
                            <h3 className="text-lg font-bold">Premium</h3>
                            <p className="text-xs text-zinc-500 mt-1 mb-6">ครบทุกฟีเจอร์สำหรับแก๊งขนาดใหญ่</p>
                            <div className="mb-6">
                                <span className="text-4xl font-bold">฿299</span>
                                <span className="text-zinc-500 text-sm ml-1">/เดือน</span>
                            </div>
                            <ul className="space-y-3">
                                {['สมาชิกสูงสุด 50 คน', 'ทุกอย่างใน Pro', 'เก็บเงินแก๊ง', 'สรุปรายเดือน', 'Analytics Dashboard', 'Multi-Admin', 'Audit Log ไม่จำกัด', 'Priority Support'].map((f, i) => (
                                    <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-300">
                                        <Check className="w-4 h-4 mt-0.5 shrink-0 text-purple-400" />
                                        {f}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══ FINAL CTA ═══ */}
            <section className="relative z-10 py-28 sm:py-36 px-5 sm:px-8 overflow-hidden">
                {/* Background orb */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
                     style={{ background: 'radial-gradient(circle, rgba(88,101,242,0.12) 0%, transparent 70%)' }} />

                <div className="relative max-w-2xl mx-auto text-center">
                    <h2 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight mb-5">
                        พร้อมบริหารแก๊ง
                        <br />
                        <span className="text-gradient-animated">อย่างมืออาชีพ?</span>
                    </h2>
                    <p className="text-zinc-400 text-base sm:text-lg mb-10 max-w-md mx-auto">
                        เริ่มต้นฟรีวันนี้ ตั้งค่าเสร็จใน 2 นาที ไม่ต้องใช้บัตรเครดิต
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
                        <a href={botInviteUrl} target="_blank" rel="noopener noreferrer"
                           className="btn-glow flex items-center gap-2.5 px-8 py-4 rounded-xl text-base font-semibold text-white">
                            <Bot className="w-5 h-5" />
                            เริ่มต้นใช้งานฟรี
                            <ArrowRight className="w-4 h-4" />
                        </a>
                        <a href="https://discord.gg/rHvkNv8ayj" target="_blank" rel="noopener noreferrer"
                           className="group flex items-center gap-2 text-zinc-400 hover:text-white text-sm font-medium transition-colors">
                            <MessageSquare className="w-4 h-4" />
                            พูดคุยกับเราบน Discord
                            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </a>
                    </div>
                </div>
            </section>

            {/* ═══ FOOTER ═══ */}
            <footer className="relative z-10 border-t border-white/[0.06] py-8 px-5 sm:px-8">
                <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-discord-primary to-purple-600 flex items-center justify-center">
                            <Terminal className="w-3 h-3 text-white" strokeWidth={2.5} />
                        </div>
                        <span className="text-sm font-bold tracking-tight text-zinc-400">
                            Gang<span className="text-discord-primary">Manager</span>
                        </span>
                    </div>
                    <div className="flex items-center gap-5 text-xs text-zinc-600">
                        <a href="https://discord.gg/rHvkNv8ayj" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 transition-colors">ศูนย์ช่วยเหลือ</a>
                        <span className="text-zinc-800">|</span>
                        <span>© 2026 Gang Manager</span>
                    </div>
                </div>
            </footer>
        </main>
    );
}
