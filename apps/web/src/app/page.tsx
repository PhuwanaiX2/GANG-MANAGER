import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Users, CalendarCheck, Wallet, Bot, LogIn, Shield, FileText, Zap, Gem, Crown, Check } from 'lucide-react';
import { LoginButton } from '@/components/LoginButton';
import { Footer } from '@/components/Footer';

export default async function Home() {
    const session = await getServerSession(authOptions);

    // If logged in, redirect to dashboard
    if (session) {
        redirect('/dashboard');
    }

    return (
        <main className="relative flex min-h-screen flex-col items-center justify-center p-6 sm:p-12 overflow-hidden bg-[#050505]">
            {/* Background Mesh Gradient */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] bg-discord-primary/10 rounded-full blur-[120px] animate-pulse-slow" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-purple-600/10 rounded-full blur-[100px] animate-float" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] pointer-events-none" />
            </div>

            <div className="relative z-10 text-center max-w-5xl mx-auto space-y-16">
                {/* Hero Section */}
                <div className="space-y-8 animate-fade-in-up">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/10 backdrop-blur-md shadow-2xl">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-discord-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-discord-primary"></span>
                        </span>
                        <span className="text-white/60 text-[10px] font-black tracking-[0.2em] uppercase">
                            ระบบจัดการแก๊งผ่าน Discord
                        </span>
                    </div>

                    <h1 className="text-6xl sm:text-8xl font-black tracking-tighter text-white leading-[1.1]">
                        <span className="block italic opacity-50 text-4xl sm:text-5xl font-light mb-2">บริหารทีมของคุณ</span>
                        Gang <span className="text-transparent bg-clip-text bg-gradient-premium drop-shadow-[0_0_30px_rgba(88,101,242,0.3)]">Manager</span>
                    </h1>

                    <p className="text-lg sm:text-2xl text-gray-400 max-w-2xl mx-auto font-medium leading-relaxed">
                        จัดการสมาชิก การเงิน เช็คชื่อ และลาหยุด ผ่าน Discord Bot และ Web Dashboard ในที่เดียว
                    </p>
                </div>

                {/* Features Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full pt-4">
                    <FeatureCard
                        icon={<Users className="w-8 h-8 text-discord-primary" />}
                        title="จัดการสมาชิก"
                        description="เพิ่ม ลบ แก้ไขสมาชิก พร้อมซิงค์ยศจาก Discord อัตโนมัติ ดูข้อมูลครบจบในหน้าเดียว"
                        delay="100ms"
                    />
                    <FeatureCard
                        icon={<CalendarCheck className="w-8 h-8 text-purple-400" />}
                        title="เช็คชื่อ Real-time"
                        description="เปิดเซสชันเช็คชื่อผ่าน Discord Bot สมาชิกกดเข้าร่วมได้ทันที พร้อมสรุปสถิติ"
                        delay="200ms"
                    />
                    <FeatureCard
                        icon={<Wallet className="w-8 h-8 text-emerald-400" />}
                        title="ระบบการเงิน"
                        description="ยืม-คืนเงินกองกลาง อนุมัติรายการผ่านเว็บ พร้อม Audit Log โปร่งใสทุกบาท"
                        delay="300ms"
                    />
                </div>

                {/* Pricing Section */}
                <div className="w-full pt-8 animate-fade-in-up" style={{ animationDelay: '350ms' }}>
                    <div className="text-center mb-10">
                        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-3">เลือกแพลนที่เหมาะกับแก๊งคุณ</h2>
                        <p className="text-gray-500 font-medium">เริ่มต้นฟรี อัปเกรดเมื่อพร้อม</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                        <PricingCard
                            icon={<Crown className="w-5 h-5 text-gray-400" />}
                            name="Free"
                            price={0}
                            features={['สมาชิกสูงสุด 10 คน', 'ลงทะเบียน + เช็คชื่อ', 'ระบบแจ้งลา', 'Audit Log 7 วัน']}
                            color="gray"
                        />
                        <PricingCard
                            icon={<Zap className="w-5 h-5 text-blue-400" />}
                            name="Pro"
                            price={149}
                            features={['สมาชิกสูงสุด 25 คน', 'ระบบการเงินเต็มรูปแบบ', 'Export CSV', 'สรุปรายเดือน', 'Backup รายวัน', 'Audit Log 90 วัน']}
                            color="blue"
                            popular
                        />
                        <PricingCard
                            icon={<Gem className="w-5 h-5 text-purple-400" />}
                            name="Premium"
                            price={299}
                            features={['สมาชิกสูงสุด 40 คน', 'ทุกอย่างใน Pro', 'Analytics Dashboard', 'Audit Log ไม่จำกัด', 'Priority Support']}
                            color="purple"
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-6 items-center justify-center w-full max-w-2xl mx-auto animate-fade-in-up" style={{ animationDelay: '400ms' }}>
                    <div className="w-full sm:w-auto">
                        <LoginButton />
                    </div>

                    <a
                        href={`https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=8&scope=bot+applications.commands`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group w-full sm:w-auto flex items-center justify-center gap-3 bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-white px-10 py-5 rounded-2xl text-lg font-bold transition-all backdrop-blur-md hover:scale-[1.02] active:scale-95 shadow-xl"
                    >
                        <Bot className="w-6 h-6 text-gray-400 group-hover:text-white transition-colors" />
                        <span>เชิญบอทเข้าเซิร์ฟเวอร์</span>
                    </a>
                </div>

                {/* Footer */}
                <div className="pt-20">
                    <div className="h-[1px] w-40 bg-gradient-to-r from-transparent via-white/10 to-transparent mx-auto mb-8" />
                    <Footer />
                </div>
            </div>
        </main>
    );
}

function PricingCard({ icon, name, price, features, color, popular }: { icon: React.ReactNode, name: string, price: number, features: string[], color: string, popular?: boolean }) {
    const colorMap: Record<string, { border: string; bg: string; text: string }> = {
        gray: { border: 'border-white/5', bg: 'bg-white/[0.02]', text: 'text-gray-400' },
        blue: { border: 'border-blue-500/30', bg: 'bg-blue-500/[0.03]', text: 'text-blue-400' },
        purple: { border: 'border-purple-500/30', bg: 'bg-purple-500/[0.03]', text: 'text-purple-400' },
    };
    const c = colorMap[color] || colorMap.gray;

    return (
        <div className={`relative ${c.bg} border ${popular ? 'border-blue-500/40 ring-1 ring-blue-500/20' : c.border} p-8 rounded-[2rem] text-left backdrop-blur-sm transition-all duration-300 hover:-translate-y-1`}>
            {popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-black tracking-widest uppercase px-4 py-1 rounded-full shadow-lg shadow-blue-600/30">
                    แนะนำ
                </div>
            )}
            <div className="flex items-center gap-3 mb-5">
                <div className={`p-2 rounded-xl ${c.bg} border ${c.border}`}>{icon}</div>
                <span className="text-white font-bold text-lg">{name}</span>
            </div>
            <div className="mb-6">
                <span className="text-4xl font-black text-white">฿{price}</span>
                <span className="text-gray-500 text-sm">/เดือน</span>
            </div>
            <ul className="space-y-2.5">
                {features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                        <Check className={`w-4 h-4 mt-0.5 shrink-0 ${c.text}`} />
                        {f}
                    </li>
                ))}
            </ul>
        </div>
    );
}

function FeatureCard({ icon, title, description, delay }: { icon: React.ReactNode, title: string, description: string, delay: string }) {
    return (
        <div
            className="group relative bg-white/[0.02] border border-white/5 hover:border-white/20 p-8 rounded-[2.5rem] text-left transition-all duration-500 hover:-translate-y-2 backdrop-blur-sm overflow-hidden animate-fade-in-up"
            style={{ animationDelay: delay }}
        >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/[0.02] rounded-full -mr-16 -mt-16 group-hover:bg-white/[0.05] transition-colors" />

            <div className="mb-6 relative">
                <div className="absolute inset-0 bg-white/10 blur-xl rounded-full scale-50 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative bg-black/40 w-16 h-16 flex items-center justify-center rounded-2xl border border-white/5 shadow-inner">
                    {icon}
                </div>
            </div>

            <h3 className="text-2xl font-black text-white mb-3 tracking-tight group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-premium transition-all">
                {title}
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed font-medium">
                {description}
            </p>
        </div>
    );
}
