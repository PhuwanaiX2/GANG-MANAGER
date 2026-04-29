import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { BILLING_PLANS } from '@/lib/billingPlans';
import {
    ArrowRight,
    Bot,
    CalendarCheck,
    Check,
    ChevronRight,
    Clock3,
    FileText,
    Globe,
    Landmark,
    LifeBuoy,
    Megaphone,
    Shield,
    Sparkles,
    Terminal,
    Users,
    Wallet,
    Zap,
} from 'lucide-react';
import { LoginButton } from '@/components/LoginButton';
import { Badge, Card } from '@/components/ui';

export default async function Home() {
    const session = await getServerSession(authOptions);

    if (session) {
        redirect('/dashboard');
    }

    const botInviteUrl = `https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=8&scope=bot+applications.commands`;
    const proPlan = BILLING_PLANS.find((plan) => plan.id === 'PREMIUM');

    const features = [
        { icon: Users, title: 'สมาชิกและยศ', desc: 'จัดสมาชิก Discord, role mapping, สถานะอนุมัติ และสิทธิ์ตามหน้าที่ในที่เดียว', tone: 'text-fg-success bg-status-success-subtle' },
        { icon: CalendarCheck, title: 'เช็คชื่อ', desc: 'เปิดรอบเช็คชื่อ ดูผลย้อนหลัง แก้สถานะ และสรุปงานให้หัวหน้าเห็นทันที', tone: 'text-fg-info bg-status-info-subtle' },
        { icon: Wallet, title: 'การเงินแก๊ง', desc: 'ดูยอดกองกลาง ยืม/คืน สำรองจ่าย และรายการรออนุมัติพร้อม audit trail', tone: 'text-fg-warning bg-status-warning-subtle' },
        { icon: Megaphone, title: 'ประกาศ', desc: 'ส่งประกาศสำคัญ จัดสถานะ active/expired และลดประกาศตกหล่นในแชต', tone: 'text-accent-bright bg-accent-subtle' },
        { icon: FileText, title: 'ลาและคำขอ', desc: 'สมาชิกส่งคำขอ ทีมดูแลอนุมัติหรือปฏิเสธ พร้อมประวัติเพื่อย้อนตรวจได้', tone: 'text-fg-info bg-status-info-subtle' },
        { icon: Shield, title: 'สิทธิ์และบันทึกงาน', desc: 'แยก Owner, Admin, Treasurer, Attendance และ Member เพื่อลดสิทธิ์หลุด', tone: 'text-fg-danger bg-status-danger-subtle' },
    ];

    const proofPoints = [
        { icon: Bot, label: 'Discord Bot', value: 'กดใช้งานในเซิร์ฟเวอร์' },
        { icon: Globe, label: 'Web Dashboard', value: 'จัดการเป็นระบบ' },
        { icon: Shield, label: 'Permission', value: 'แยกสิทธิ์ตามหน้าที่' },
        { icon: Clock3, label: 'History', value: 'ย้อนดูงานสำคัญได้' },
    ];

    return (
        <main className="relative min-h-screen overflow-hidden bg-bg-base text-fg-primary" style={{ touchAction: 'manipulation' }}>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(255,106,61,0.24),transparent_34%),radial-gradient(circle_at_88%_2%,rgba(59,130,246,0.13),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(16,185,129,0.08),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_38%)]" />
            <div className="pointer-events-none absolute inset-0 bg-grid-subtle opacity-45" />

            <nav className="fixed left-0 right-0 top-0 z-50 border-b border-border-subtle bg-bg-base/72 backdrop-blur-xl" role="navigation" aria-label="Main navigation">
                <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
                    <Link href="/" className="group flex items-center gap-2.5" aria-label="Gang Manager">
                        <div className="flex h-9 w-9 items-center justify-center rounded-token-lg border border-border-accent bg-accent-subtle transition-colors group-hover:brightness-125">
                            <Terminal className="h-4 w-4 text-accent-bright" aria-hidden="true" />
                        </div>
                        <span className="font-heading text-[15px] font-black tracking-tight">
                            Gang<span className="text-accent-bright">Manager</span>
                        </span>
                    </Link>
                    <div className="hidden items-center gap-8 text-[13px] font-medium text-fg-secondary md:flex">
                        <a href="#features" className="transition-colors hover:text-fg-primary">ฟีเจอร์</a>
                        <a href="#how-it-works" className="transition-colors hover:text-fg-primary">วิธีเริ่ม</a>
                        <a href="#pricing" className="transition-colors hover:text-fg-primary">แพลน</a>
                        <Link href="/support" className="transition-colors hover:text-fg-primary">ซัพพอร์ต</Link>
                    </div>
                    <div className="flex items-center gap-3">
                        <a
                            href={botInviteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hidden items-center gap-1.5 text-[13px] font-medium text-fg-secondary transition-colors hover:text-accent-bright sm:flex"
                        >
                            <Bot className="h-4 w-4" aria-hidden="true" />
                            เชิญบอท
                        </a>
                        <LoginButton />
                    </div>
                </div>
            </nav>

            <section className="relative z-10 px-5 pb-20 pt-32 sm:px-8 sm:pb-28 sm:pt-40" aria-labelledby="hero-title">
                <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
                    <div>
                        <Badge tone="accent" variant="outline" size="md" className="mb-7 px-4 py-1.5">
                            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                            ระบบจัดการแก๊ง FiveM ผ่าน Discord
                        </Badge>

                        <h1 id="hero-title" className="font-heading text-5xl font-black leading-[1.02] tracking-tight sm:text-7xl">
                            คุมทีมใน Discord
                            <br />
                            <span className="text-gradient-hero">ให้เห็นงานทั้งหมดในจอเดียว</span>
                        </h1>

                        <p className="mt-6 max-w-2xl text-lg leading-8 text-fg-secondary sm:text-xl">
                            รวมสมาชิก เช็คชื่อ การเงิน ประกาศ การลา และสิทธิ์ไว้ในระบบเดียว ใช้คู่กับ Discord โดยไม่ต้องตามข้อมูลกระจัดกระจายในแชต
                        </p>

                        <div className="mt-9 flex flex-col gap-4 sm:flex-row">
                            <a
                                href={botInviteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-primary inline-flex items-center justify-center gap-2.5 px-8 py-3.5 text-sm"
                            >
                                <Bot className="h-4 w-4" aria-hidden="true" />
                                เพิ่มบอทลงเซิร์ฟเวอร์
                                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                            </a>
                            <LoginButton />
                        </div>

                        <p className="mt-4 text-xs leading-6 text-fg-tertiary">
                            ใช้ Discord OAuth เพื่อเข้าสู่ระบบ และบอทจะทำงานเฉพาะเซิร์ฟเวอร์ที่คุณอนุญาตเท่านั้น
                        </p>
                    </div>

                    <div className="relative">
                        <div className="absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-accent/25 via-status-info/10 to-transparent blur-2xl" />
                        <Card variant="subtle" padding="lg" className="relative overflow-hidden border-border-accent bg-bg-subtle/82 backdrop-blur">
                            <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-[3rem] bg-accent-subtle" />
                            <div className="relative space-y-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-[0.24em] text-fg-tertiary">Operations board</p>
                                        <h2 className="mt-1 font-heading text-2xl font-black">เห็นงานสำคัญทันที</h2>
                                    </div>
                                    <div className="rounded-token-full border border-status-success bg-status-success-subtle px-3 py-1 text-[10px] font-black text-fg-success">ONLINE</div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    {proofPoints.map((item) => {
                                        const Icon = item.icon;
                                        return (
                                            <div key={item.label} className="rounded-token-xl border border-border-subtle bg-bg-muted/70 p-4">
                                                <Icon className="mb-3 h-5 w-5 text-accent-bright" />
                                                <p className="text-[10px] font-black uppercase tracking-widest text-fg-tertiary">{item.label}</p>
                                                <p className="mt-1 text-sm font-bold text-fg-primary">{item.value}</p>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="rounded-token-xl border border-border-subtle bg-bg-base/60 p-4">
                                    <div className="mb-3 flex items-center gap-2">
                                        <Landmark className="h-4 w-4 text-fg-info" />
                                        <span className="text-xs font-bold text-fg-secondary">แก้ปัญหาที่เจอบ่อย</span>
                                    </div>
                                    <div className="space-y-2 text-xs text-fg-secondary">
                                        <p className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-fg-success" /> ลดงานจดมือและตามข้อมูลในแชต</p>
                                        <p className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-fg-success" /> แยกหน้าที่ Owner, Admin, Treasurer และ Member</p>
                                        <p className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-fg-success" /> ใช้เว็บดูภาพรวม และใช้ Discord เป็นจุดเริ่มงาน</p>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </section>

            <section id="features" className="relative z-10 px-5 py-20 sm:px-8 sm:py-28" aria-labelledby="features-title">
                <div className="mx-auto max-w-6xl">
                    <div className="mb-14 max-w-2xl">
                        <Badge tone="accent" variant="outline" size="md" className="mb-5 px-3 py-1">
                            <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                            ระบบหลัก
                        </Badge>
                        <h2 id="features-title" className="font-heading text-3xl font-black tracking-tight sm:text-5xl">ของที่หัวหน้าแก๊งต้องใช้ทุกวัน</h2>
                        <p className="mt-4 text-sm leading-7 text-fg-secondary">ออกแบบให้ทีมเล็กเริ่มใช้งานได้เร็ว แต่ยังมีสิทธิ์ การตรวจสอบย้อนหลัง และหน้าจัดการที่ชัดเจนพอสำหรับงานจริง</p>
                    </div>

                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {features.map((feature) => {
                            const Icon = feature.icon;
                            return (
                                <Card key={feature.title} variant="subtle" padding="lg" className="group transition-[transform,border-color,box-shadow] hover:-translate-y-1 hover:border-border hover:shadow-token-md">
                                    <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-token-lg ${feature.tone} transition-transform group-hover:scale-110`}>
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <h3 className="mb-2 font-heading text-base font-bold text-fg-primary">{feature.title}</h3>
                                    <p className="text-sm leading-7 text-fg-secondary">{feature.desc}</p>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section id="how-it-works" className="relative z-10 px-5 py-20 sm:px-8 sm:py-28" aria-labelledby="how-title">
                <div className="mx-auto max-w-5xl">
                    <div className="mb-14 text-center">
                        <h2 id="how-title" className="font-heading text-3xl font-black tracking-tight sm:text-5xl">เริ่มใช้ใน 3 ขั้นตอน</h2>
                    </div>
                    <div className="grid gap-5 md:grid-cols-3">
                        {[
                            { num: '01', title: 'เพิ่มบอท', desc: 'เชิญบอทเข้า Discord server และให้ permission ที่ระบบต้องใช้', icon: Bot },
                            { num: '02', title: 'ตั้งค่า /setup', desc: 'เลือกติดตั้งอัตโนมัติหรือ manual แล้ว map role/channel ให้ถูกต้อง', icon: Terminal },
                            { num: '03', title: 'เปิด Dashboard', desc: 'ล็อกอินด้วย Discord แล้วจัดการสมาชิก เช็คชื่อ และประกาศจากเว็บ', icon: Globe },
                        ].map((step) => {
                            const Icon = step.icon;
                            return (
                                <Card key={step.num} variant="subtle" padding="lg" className="text-center">
                                    <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-token-lg bg-gradient-to-br from-accent to-secondary text-fg-inverse shadow-token-md">
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <p className="mb-2 font-mono text-xs font-bold tracking-widest text-fg-tertiary">STEP {step.num}</p>
                                    <h3 className="mb-2 font-heading text-lg font-bold">{step.title}</h3>
                                    <p className="text-sm leading-7 text-fg-secondary">{step.desc}</p>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section id="pricing" className="relative z-10 px-5 py-20 sm:px-8 sm:py-28" aria-labelledby="pricing-title">
                <div className="mx-auto max-w-4xl">
                    <div className="mb-12 text-center">
                        <h2 id="pricing-title" className="font-heading text-3xl font-black tracking-tight sm:text-5xl">ทดลองใช้ก่อน แล้วค่อยเลือกแพลนที่เหมาะกับแก๊ง</h2>
                        <p className="mt-3 text-base text-fg-secondary">เริ่มจาก Trial เพื่อให้หัวหน้าและทีมลอง flow จริงใน Discord ได้ครบก่อน หากต้องการใช้งานต่อสามารถอัปเกรดเป็น Pro ผ่าน PromptPay และส่งสลิปให้ตรวจสอบได้</p>
                    </div>

                    <Card variant="subtle" padding="lg" className="relative overflow-hidden border-border-accent bg-gradient-to-b from-accent-subtle to-transparent shadow-token-glow-accent">
                        <span className="absolute right-6 top-6 rounded-token-full bg-status-warning px-3 py-1 text-[10px] font-black text-fg-inverse">Trial 7 วัน</span>
                        <h3 className="font-heading text-2xl font-black">{proPlan?.name}</h3>
                        <p className="mt-2 max-w-xl text-sm leading-7 text-fg-secondary">{proPlan?.marketingDescription}</p>
                        <p className="mt-5 rounded-token-xl border border-status-warning bg-status-warning-subtle px-4 py-3 text-sm font-medium text-fg-warning">
                            ทดลองใช้ฟรีโดยไม่ต้องผูกบัตร หลังจากนั้นค่อยตัดสินใจว่าจะต่อ Pro แบบรายเดือนหรือรายปี ไม่มีการตัดเงินอัตโนมัติ
                        </p>
                        <div className="mt-6 border-b border-border-subtle pb-6">
                            <span className="font-heading text-4xl font-black tabular-nums text-fg-primary">฿{proPlan?.priceMonthly}</span>
                            <span className="ml-1.5 text-sm text-fg-tertiary">/เดือน หลังหมด Trial</span>
                        </div>
                        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                            {proPlan?.marketingFeatures.map((feature) => (
                                <li key={feature} className="flex gap-2 text-sm text-fg-primary">
                                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-bright" />
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>
                        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                            <a href={botInviteUrl} target="_blank" rel="noopener noreferrer" className="btn-primary inline-flex items-center justify-center gap-2 px-5 py-3 text-sm">
                                เพิ่มบอทและเริ่มใช้งาน <ArrowRight className="h-4 w-4" />
                            </a>
                            <Link href="/support" className="inline-flex items-center justify-center gap-2 rounded-token-lg border border-border-subtle bg-bg-muted px-5 py-3 text-sm font-bold text-fg-secondary transition-colors hover:text-fg-primary">
                                คุยกับซัพพอร์ต <LifeBuoy className="h-4 w-4" />
                            </Link>
                        </div>
                    </Card>
                </div>
            </section>

            <section className="relative z-10 px-5 py-20 sm:px-8 sm:py-28">
                <div className="mx-auto max-w-2xl text-center">
                    <Landmark className="mx-auto mb-5 h-10 w-10 text-accent-bright" />
                    <h2 className="mb-4 font-heading text-3xl font-black tracking-tight sm:text-4xl">เริ่มจากเซิร์ฟเวอร์เดียวก็พอ</h2>
                    <p className="mb-8 text-base leading-8 text-fg-secondary">ติดตั้งบอท ตั้งค่า roles/channels แล้วให้สมาชิกเริ่มใช้งานจาก Discord ได้เลย หน้าเว็บจะเป็นที่รวมข้อมูลและการตัดสินใจของหัวหน้าแก๊ง</p>
                    <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                        <a href={botInviteUrl} target="_blank" rel="noopener noreferrer" className="btn-primary inline-flex items-center gap-2.5 px-8 py-3.5 text-sm">
                            เพิ่มบอทและเริ่มทดลองใช้
                        </a>
                        <a href="https://discord.gg/rHvkNv8ayj" target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2 text-sm font-medium text-fg-secondary transition-colors hover:text-accent-bright">
                            Discord Support
                            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                        </a>
                    </div>
                </div>
            </section>

            <footer className="relative z-10 border-t border-border-subtle px-5 py-10 sm:px-8">
                <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-token-sm border border-border-accent bg-accent-subtle">
                            <Terminal className="h-3.5 w-3.5 text-accent-bright" aria-hidden="true" />
                        </div>
                        <span className="font-heading text-sm font-bold tracking-tight">Gang<span className="text-accent-bright">Manager</span></span>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-5 text-xs font-medium text-fg-tertiary">
                        <Link href="/terms" className="transition-colors hover:text-fg-primary">เงื่อนไข</Link>
                        <Link href="/privacy" className="transition-colors hover:text-fg-primary">ความเป็นส่วนตัว</Link>
                        <Link href="/support" className="transition-colors hover:text-fg-primary">ซัพพอร์ต</Link>
                        <span>© 2026 Gang Manager</span>
                    </div>
                </div>
            </footer>
        </main>
    );
}
