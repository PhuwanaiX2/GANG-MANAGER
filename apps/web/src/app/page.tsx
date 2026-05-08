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
    FileText,
    Globe,
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
import { ThemeToggle } from '@/components/ThemeToggle';
import { Badge, Card } from '@/components/ui';

export default async function Home() {
    const session = await getServerSession(authOptions);

    if (session) {
        redirect('/dashboard');
    }

    const botInviteUrl = `https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=8&scope=bot+applications.commands`;
    const proPlan = BILLING_PLANS.find((plan) => plan.id === 'PREMIUM');

    const features = [
        { icon: Users, title: 'สมาชิกและยศ', desc: 'อนุมัติสมาชิก ผูก role และแยกสิทธิ์ตามหน้าที่', tone: 'text-fg-success bg-status-success-subtle' },
        { icon: CalendarCheck, title: 'เช็คชื่อ', desc: 'เปิดรอบ Discord self check-in หรือ manual roll call', tone: 'text-fg-info bg-status-info-subtle' },
        { icon: Wallet, title: 'การเงินแก๊ง', desc: 'แยกเงินกองกลางจริง ค้างเก็บ เครดิต และคำขอรอตรวจ', tone: 'text-fg-warning bg-status-warning-subtle' },
        { icon: Megaphone, title: 'ประกาศ', desc: 'ส่งประกาศและดูสถานะ active/expired จากจุดเดียว', tone: 'text-accent-bright bg-accent-subtle' },
        { icon: FileText, title: 'ลาและคำขอ', desc: 'ตรวจคำขอพร้อมประวัติที่ย้อนดูได้', tone: 'text-fg-info bg-status-info-subtle' },
        { icon: Shield, title: 'Audit ready', desc: 'ทุกงานสำคัญมีสิทธิ์และร่องรอยตรวจสอบ', tone: 'text-fg-danger bg-status-danger-subtle' },
    ];

    return (
        <main className="relative min-h-screen overflow-hidden bg-bg-base text-fg-primary" style={{ touchAction: 'manipulation' }}>
            <div className="pointer-events-none fixed inset-0 bg-grid-subtle opacity-45" />

            <nav className="fixed left-0 right-0 top-0 z-50 border-b border-border-subtle bg-bg-base/82 backdrop-blur-xl" role="navigation" aria-label="Main navigation">
                <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
                    <Link href="/" className="group flex min-w-0 items-center gap-2.5" aria-label="Gang Manager">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-token-lg border border-border-accent bg-accent-subtle transition-colors group-hover:brightness-125">
                            <Terminal className="h-4 w-4 text-accent-bright" aria-hidden="true" />
                        </div>
                        <span className="truncate font-heading text-[15px] font-black tracking-tight">
                            Gang<span className="text-accent-bright">Manager</span>
                        </span>
                    </Link>
                    <div className="hidden items-center gap-8 text-[13px] font-bold text-fg-secondary md:flex">
                        <a href="#features" className="transition-colors hover:text-fg-primary">ฟีเจอร์</a>
                        <a href="#how-it-works" className="transition-colors hover:text-fg-primary">เริ่มใช้งาน</a>
                        <a href="#pricing" className="transition-colors hover:text-fg-primary">แพลน</a>
                        <Link href="/support" className="transition-colors hover:text-fg-primary">ซัพพอร์ต</Link>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                        <ThemeToggle compact />
                        <a
                            href={botInviteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hidden min-h-10 items-center gap-1.5 rounded-token-lg border border-border-subtle bg-bg-elevated px-3 text-[12px] font-black text-fg-secondary transition-colors hover:border-border-accent hover:text-accent-bright sm:flex"
                        >
                            <Bot className="h-4 w-4" aria-hidden="true" />
                            เชิญบอท
                        </a>
                        <LoginButton compactOnMobile />
                    </div>
                </div>
            </nav>

            <section className="relative z-10 overflow-hidden px-5 pb-10 pt-24 sm:min-h-[calc(100vh-2rem)] sm:px-8 sm:pb-14 sm:pt-36" aria-labelledby="hero-title">
                <div className="mx-auto max-w-6xl">
                    <div className="relative lg:min-h-[610px]">
                        <div className="relative z-10 max-w-3xl">
                            <Badge tone="accent" variant="outline" size="md" className="mb-5 px-4 py-1.5">
                                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                                FiveM gang ops on Discord
                            </Badge>

                            <h1 id="hero-title" className="font-heading text-5xl font-black leading-[0.98] tracking-tight text-fg-primary sm:text-7xl lg:text-7xl">
                                GangManager
                            </h1>
                            <p className="mt-5 max-w-2xl text-xl font-black leading-tight text-accent-bright sm:text-3xl">
                                คุมสมาชิก เช็คชื่อ การเงิน ประกาศ และคำขอใน command center เดียว
                            </p>
                            <p className="mt-5 max-w-xl text-base leading-8 text-fg-secondary sm:text-lg">
                                สร้างมาให้หัวหน้าแก๊งเห็นงานจริงเร็วกว่าไล่แชต: Discord เป็นจุดเริ่มงาน เว็บเป็นจุดตัดสินใจ และทุก role มีสิทธิ์เท่าที่ควรใช้
                            </p>

                            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                                <a
                                    href={botInviteUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-primary inline-flex min-h-12 items-center justify-center gap-2.5 px-7 text-sm"
                                >
                                    <Bot className="h-4 w-4" aria-hidden="true" />
                                    เพิ่มบอทลงเซิร์ฟเวอร์
                                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                                </a>
                                <LoginButton />
                            </div>

                            <div className="mt-7 hidden max-w-xl grid-cols-3 gap-2 sm:grid">
                                {[
                                    ['Role-safe', 'แยกสิทธิ์'],
                                    ['Audit', 'ย้อนตรวจ'],
                                    ['Mobile', 'กดเร็ว'],
                                ].map(([label, value]) => (
                                    <div key={label} className="rounded-token-xl border border-border-subtle bg-bg-subtle/78 px-3 py-3 shadow-token-xs backdrop-blur">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-fg-tertiary">{label}</p>
                                        <p className="mt-1 text-sm font-black text-fg-primary">{value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <DashboardPreview />
                    </div>
                </div>
            </section>

            <section id="features" className="relative z-10 px-5 pb-16 sm:px-8 sm:pb-24" aria-labelledby="features-title">
                <div className="mx-auto max-w-6xl">
                    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <Badge tone="accent" variant="outline" size="md" className="mb-4 px-3 py-1">
                                <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                                ระบบหลัก
                            </Badge>
                            <h2 id="features-title" className="font-heading text-3xl font-black tracking-tight sm:text-5xl">ของที่ต้องใช้ทุกวัน</h2>
                        </div>
                        <p className="max-w-md text-sm leading-7 text-fg-secondary">ลด noise ให้เหลือ action ที่หัวหน้าแก๊งต้องกดจริง: เช็คคน จัดเงิน แจ้งทีม และตรวจคำขอ</p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {features.map((feature) => {
                            const Icon = feature.icon;
                            return (
                                <Card key={feature.title} variant="subtle" padding="lg" className="group transition-[transform,border-color,box-shadow] hover:-translate-y-1 hover:border-border hover:shadow-token-md">
                                    <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-token-lg ${feature.tone} transition-transform group-hover:scale-110`}>
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <h3 className="mb-2 font-heading text-base font-black text-fg-primary">{feature.title}</h3>
                                    <p className="text-sm leading-7 text-fg-secondary">{feature.desc}</p>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section id="how-it-works" className="relative z-10 px-5 py-16 sm:px-8 sm:py-24" aria-labelledby="how-title">
                <div className="mx-auto max-w-5xl">
                    <div className="mb-8 text-center">
                        <h2 id="how-title" className="font-heading text-3xl font-black tracking-tight sm:text-5xl">เริ่มใช้ใน 3 ขั้นตอน</h2>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                        {[
                            { num: '01', title: 'เพิ่มบอท', desc: 'เชิญบอทเข้า Discord server และให้ permission ที่จำเป็น', icon: Bot },
                            { num: '02', title: 'ตั้งค่า /setup', desc: 'เลือก manual หรือ automatic setup แล้ว map role/channel ให้ถูก', icon: Terminal },
                            { num: '03', title: 'เปิด Dashboard', desc: 'จัดการสมาชิก เช็คชื่อ การเงิน และประกาศจากเว็บ', icon: Globe },
                        ].map((step) => {
                            const Icon = step.icon;
                            return (
                                <Card key={step.num} variant="subtle" padding="lg" className="text-center">
                                    <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-token-lg bg-accent text-accent-fg shadow-token-md">
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <p className="mb-2 font-mono text-xs font-bold tracking-widest text-fg-tertiary">STEP {step.num}</p>
                                    <h3 className="mb-2 font-heading text-lg font-black">{step.title}</h3>
                                    <p className="text-sm leading-7 text-fg-secondary">{step.desc}</p>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section id="pricing" className="relative z-10 px-5 py-16 sm:px-8 sm:py-24" aria-labelledby="pricing-title">
                <div className="mx-auto max-w-4xl">
                    <div className="mb-8 text-center">
                        <h2 id="pricing-title" className="font-heading text-3xl font-black tracking-tight sm:text-5xl">อัปเกรดเมื่อพร้อมใช้งานจริง</h2>
                        <p className="mt-3 text-base leading-7 text-fg-secondary">Premium ใช้ PromptPay แบบตรวจสลิปก่อนอนุมัติ ไม่มีการตัดเงินอัตโนมัติ</p>
                    </div>

                    <Card variant="subtle" padding="lg" className="relative overflow-hidden border-border-accent shadow-token-glow-accent">
                        <span className="absolute right-5 top-5 rounded-token-full bg-status-warning px-3 py-1 text-[10px] font-black text-fg-inverse">Premium</span>
                        <h3 className="font-heading text-2xl font-black">{proPlan?.name}</h3>
                        <p className="mt-2 max-w-xl text-sm leading-7 text-fg-secondary">{proPlan?.marketingDescription}</p>
                        <div className="mt-6 border-b border-border-subtle pb-6">
                            <span className="font-heading text-4xl font-black tabular-nums text-fg-primary">฿{proPlan?.priceMonthly}</span>
                            <span className="ml-1.5 text-sm text-fg-tertiary">/เดือน</span>
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
                            <a href={botInviteUrl} target="_blank" rel="noopener noreferrer" className="btn-primary inline-flex min-h-12 items-center justify-center gap-2 px-5 text-sm">
                                เพิ่มบอทและเริ่มใช้ <ArrowRight className="h-4 w-4" />
                            </a>
                            <Link href="/support" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-token-lg border border-border-subtle bg-bg-muted px-5 text-sm font-black text-fg-secondary transition-colors hover:text-fg-primary">
                                คุยกับซัพพอร์ต <LifeBuoy className="h-4 w-4" />
                            </Link>
                        </div>
                    </Card>
                </div>
            </section>

            <footer className="relative z-10 border-t border-border-subtle px-5 py-10 sm:px-8">
                <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-token-sm border border-border-accent bg-accent-subtle">
                            <Terminal className="h-3.5 w-3.5 text-accent-bright" aria-hidden="true" />
                        </div>
                        <span className="font-heading text-sm font-black tracking-tight">Gang<span className="text-accent-bright">Manager</span></span>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-5 text-xs font-bold text-fg-tertiary">
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

function DashboardPreview() {
    const rows = [
        ['เช็คชื่อเปิดอยู่', '0', 'รอบ'],
        ['เงินกองกลาง', '฿1.5M', 'อนุมัติแล้ว'],
        ['สมาชิกพร้อมใช้', '42', 'คน'],
    ];

    return (
        <div className="pointer-events-none relative z-0 mx-auto mt-8 max-h-[240px] max-w-5xl overflow-hidden opacity-95 sm:max-h-none lg:absolute lg:inset-x-auto lg:right-0 lg:top-8 lg:mt-0 lg:w-[600px]">
            <div className="rounded-token-2xl border border-border-subtle bg-bg-subtle/88 p-3 shadow-token-lg backdrop-blur-xl sm:p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-token-xl bg-accent text-accent-fg shadow-token-sm">
                            <Terminal className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                            <p className="truncate text-xs font-black uppercase tracking-widest text-fg-tertiary">GangTest99</p>
                            <p className="truncate text-sm font-black text-fg-primary">Command Center</p>
                        </div>
                    </div>
                    <span className="rounded-token-full border border-status-success bg-status-success-subtle px-3 py-1 text-[10px] font-black text-fg-success">ONLINE</span>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                    {rows.map(([label, value, helper]) => (
                        <div key={label} className="rounded-token-xl border border-border-subtle bg-bg-elevated p-3 shadow-token-xs">
                            <p className="text-[10px] font-black uppercase tracking-widest text-fg-tertiary">{label}</p>
                            <p className="mt-2 text-2xl font-black tabular-nums text-fg-primary">{value}</p>
                            <p className="text-xs font-bold text-fg-secondary">{helper}</p>
                        </div>
                    ))}
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-[0.9fr_1.1fr]">
                    <div className="rounded-token-xl border border-border-subtle bg-bg-muted p-3">
                        <div className="mb-3 flex items-center gap-2">
                            <CalendarCheck className="h-4 w-4 text-fg-info" />
                            <p className="text-xs font-black text-fg-primary">Manual roll call</p>
                        </div>
                        {['INNO SENT', 'jiw.xzy', 'MINT'].map((name, index) => (
                            <div key={name} className="flex min-h-9 items-center justify-between border-t border-border-subtle text-xs font-bold">
                                <span>{name}</span>
                                <span className={index === 1 ? 'text-fg-warning' : 'text-fg-success'}>{index === 1 ? 'รอเช็ค' : 'มาแล้ว'}</span>
                            </div>
                        ))}
                    </div>
                    <div className="rounded-token-xl border border-border-subtle bg-bg-muted p-3">
                        <div className="mb-3 flex items-center gap-2">
                            <Wallet className="h-4 w-4 text-accent-bright" />
                            <p className="text-xs font-black text-fg-primary">Finance ledger</p>
                        </div>
                        {[
                            ['จ่ายค่าแก๊ง', '+฿700,000', 'text-fg-success'],
                            ['ตั้งยอดเก็บเงิน', '฿658,679', 'text-fg-warning'],
                            ['รอตรวจ', '0 รายการ', 'text-fg-tertiary'],
                        ].map(([label, value, tone]) => (
                            <div key={label} className="flex min-h-9 items-center justify-between border-t border-border-subtle text-xs font-bold">
                                <span>{label}</span>
                                <span className={tone}>{value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
