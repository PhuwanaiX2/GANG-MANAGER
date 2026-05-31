import Link from 'next/link';
import type { ReactNode } from 'react';
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
import { BrandLogo, BrandMark } from '@/components/BrandLogo';
import { HomeSessionRedirect } from '@/components/HomeSessionRedirect';
import { LoginButton } from '@/components/LoginButton';
import { ThemeToggle } from '@/components/ThemeToggle';
import { DiscordLogo } from '@/components/icons/DiscordLogo';
import { Badge, Card } from '@/components/ui';
import { getDiscordBotInviteUrl } from '@/lib/discordInvite';

const NAV_LINK_CLASS =
    'inline-flex min-h-11 items-center rounded-token-md px-1.5 transition-colors hover:text-fg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

const LANDING_NAV_LINKS = [
    { href: '#features', label: 'ฟีเจอร์' },
    { href: '#how-it-works', label: 'เริ่มใช้งาน' },
    { href: '#pricing', label: 'แพลน' },
    { href: '/support', label: 'ซัพพอร์ต' },
] as const;

const TRUST_ITEMS = [
    ['Role-safe', 'แยกสิทธิ์'],
    ['Audit', 'ย้อนตรวจ'],
    ['Mobile', 'กดเร็ว'],
] as const;

const FEATURES = [
    { icon: Users, title: 'สมาชิกและยศ', desc: 'อนุมัติสมาชิก ผูก role และแยกสิทธิ์ตามหน้าที่', tone: 'text-fg-success bg-status-success-subtle' },
    { icon: CalendarCheck, title: 'เช็คชื่อ', desc: 'เปิดรอบ Discord self check-in หรือ manual roll call', tone: 'text-fg-info bg-status-info-subtle' },
    { icon: Wallet, title: 'การเงินแก๊ง', desc: 'แยกเงินกองกลางจริง ค้างเก็บ เครดิต และคำขอรอตรวจ', tone: 'text-fg-warning bg-status-warning-subtle' },
    { icon: Megaphone, title: 'ประกาศ', desc: 'ส่งประกาศและดูสถานะ active/expired จากจุดเดียว', tone: 'text-accent-bright bg-accent-subtle' },
    { icon: FileText, title: 'ลาและคำขอ', desc: 'ตรวจคำขอพร้อมประวัติที่ย้อนดูได้', tone: 'text-fg-info bg-status-info-subtle' },
    { icon: Shield, title: 'Audit ready', desc: 'ทุกงานสำคัญมีสิทธิ์และร่องรอยตรวจสอบ', tone: 'text-fg-danger bg-status-danger-subtle' },
] as const;

const SETUP_STEPS = [
    { num: '01', title: 'เพิ่มบอท', desc: 'เชิญบอทเข้า Discord server และให้ permission ที่จำเป็น', icon: Bot },
    { num: '02', title: 'ตั้งค่า /setup', desc: 'เลือก manual หรือ automatic setup แล้ว map role/channel ให้ถูก', icon: Terminal },
    { num: '03', title: 'เปิด Dashboard', desc: 'จัดการสมาชิก เช็คชื่อ การเงิน และประกาศจากเว็บ', icon: Globe },
] as const;

const PREVIEW_SUMMARY_ROWS = [
    ['เช็คชื่อเปิดอยู่', '0', 'รอบ'],
    ['เงินกองกลาง', '฿1.5M', 'อนุมัติแล้ว'],
    ['สมาชิกพร้อมใช้', '42', 'คน'],
] as const;

const PREVIEW_ATTENDANCE_ROWS = [
    ['INNO SENT', 'มาแล้ว', 'text-fg-success'],
    ['jiw.xzy', 'รอเช็ค', 'text-fg-warning'],
    ['MINT', 'มาแล้ว', 'text-fg-success'],
] as const;

const PREVIEW_FINANCE_ROWS = [
    ['จ่ายค่าแก๊ง', '+฿700,000', 'text-fg-success'],
    ['ตั้งยอดเก็บเงิน', '฿658,679', 'text-fg-warning'],
    ['รอตรวจ', '0 รายการ', 'text-fg-tertiary'],
] as const;

export default function Home() {
    const botInviteUrl = getDiscordBotInviteUrl();
    const proPlan = BILLING_PLANS.find((plan) => plan.id === 'PREMIUM');

    return (
        <main data-testid="landing-page" className="relative min-h-screen touch-manipulation overflow-hidden bg-bg-base text-fg-primary">
            <HomeSessionRedirect />
            <div className="pointer-events-none fixed inset-0 bg-grid-subtle opacity-45" />

            <nav className="fixed left-0 right-0 top-0 z-50 border-b border-border-subtle bg-bg-base/86 backdrop-blur-xl" role="navigation" aria-label="Main navigation">
                <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-8">
                    <Link
                        href="/"
                        prefetch={false}
                        className="group flex min-h-11 min-w-0 items-center gap-2.5 rounded-token-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        aria-label="Gang Manager"
                    >
                        <BrandLogo
                            showTagline={false}
                            markClassName="h-9 w-9 transition-[filter,transform] duration-token-normal ease-token-standard group-hover:-translate-y-px group-hover:brightness-125"
                            textClassName="text-[14px] sm:text-[15px]"
                        />
                    </Link>
                    <div className="hidden items-center gap-8 text-[13px] font-bold text-fg-secondary md:flex">
                        {LANDING_NAV_LINKS.map((item) => item.href.startsWith('/') ? (
                            <Link key={item.href} href={item.href} prefetch={false} className={NAV_LINK_CLASS}>
                                {item.label}
                            </Link>
                        ) : (
                            <a key={item.href} href={item.href} className={NAV_LINK_CLASS}>
                                {item.label}
                            </a>
                        ))}
                    </div>
                    <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                        <ThemeToggle compact className="h-11 w-11" />
                        <BotInviteLink
                            href={botInviteUrl}
                            aria-label="เชิญบอท GangManager เข้า Discord server"
                            className="hidden min-h-11 items-center gap-1.5 rounded-token-lg border border-border-subtle bg-bg-elevated px-3 text-[12px] font-black text-fg-secondary transition-colors hover:border-border-accent hover:text-accent-bright md:inline-flex"
                        >
                            <DiscordLogo className="h-4 w-4" />
                            เชิญบอท
                        </BotInviteLink>
                        <LoginButton compactOnMobile className="hidden md:inline-flex" />
                    </div>
                </div>
            </nav>

            <section className="relative z-10 overflow-hidden px-4 pb-12 pt-24 sm:min-h-[calc(100vh-2rem)] sm:px-8 sm:pb-16 sm:pt-36" aria-labelledby="hero-title">
                <div className="mx-auto max-w-6xl">
                    <div className="relative lg:min-h-[620px]">
                        <div className="relative z-10 max-w-[640px]">
                            <Badge tone="accent" variant="outline" size="md" className="mb-5 max-w-full px-3 py-1.5 text-[11px] sm:px-4 sm:text-xs">
                                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                                จัดการแก๊งผ่าน Discord และเว็บ
                            </Badge>

                            <h1 id="hero-title" className="font-heading text-[42px] font-black leading-[0.98] tracking-tight text-fg-primary sm:text-7xl lg:text-7xl">
                                GangManager
                            </h1>
                            <p className="mt-4 max-w-[560px] text-[20px] font-black leading-tight text-accent-bright sm:mt-5 sm:text-3xl">
                                คุมสมาชิก เช็คชื่อ การเงิน ประกาศ และคำขอในแผงเดียว
                            </p>
                            <p className="mt-4 max-w-xl text-[15px] leading-7 text-fg-secondary sm:mt-5 sm:text-lg sm:leading-8">
                                สร้างมาให้หัวหน้าแก๊งเห็นงานจริงเร็วกว่าไล่แชต: Discord เป็นจุดเริ่มงาน เว็บเป็นจุดตัดสินใจ และทุก role มีสิทธิ์เท่าที่ควรใช้
                            </p>

                            <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-black text-fg-secondary sm:text-[12px]">
                                <span className="inline-flex min-h-8 items-center gap-2 rounded-token-full border border-border-subtle bg-bg-subtle/80 px-3 shadow-token-xs backdrop-blur sm:min-h-9">
                                    <DiscordLogo className="h-4 w-4 text-brand-discord" />
                                    Discord OAuth
                                </span>
                                <span className="inline-flex min-h-8 items-center gap-2 rounded-token-full border border-border-subtle bg-bg-subtle/80 px-3 shadow-token-xs backdrop-blur sm:min-h-9">
                                    <Terminal className="h-4 w-4 text-accent-bright" aria-hidden="true" />
                                    /setup พร้อมใช้
                                </span>
                                <span className="inline-flex min-h-8 items-center gap-2 rounded-token-full border border-border-subtle bg-bg-subtle/80 px-3 shadow-token-xs backdrop-blur sm:min-h-9">
                                    <Shield className="h-4 w-4 text-fg-success" aria-hidden="true" />
                                    Role-safe permissions
                                </span>
                            </div>

                            <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
                                <LoginButton className="min-h-[52px] w-full px-5 text-sm shadow-token-glow-accent sm:w-auto sm:px-7" />
                                <BotInviteLink
                                    href={botInviteUrl}
                                    aria-label="เชิญบอท GangManager เข้า Discord server"
                                    className="inline-flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-token-lg border border-border-subtle bg-bg-subtle px-5 text-sm font-black text-fg-primary shadow-token-xs transition-[border-color,background-color,transform,color] hover:-translate-y-0.5 hover:border-border-accent hover:bg-bg-muted hover:text-accent-bright sm:w-auto sm:px-7"
                                >
                                    <DiscordLogo className="h-4 w-4 text-brand-discord" />
                                    เพิ่มบอทลงเซิร์ฟเวอร์
                                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                                </BotInviteLink>
                            </div>

                            <div className="mt-7 grid max-w-xl grid-cols-3 gap-2">
                                {TRUST_ITEMS.map(([label, value]) => (
                                    <div key={label} className="rounded-token-xl border border-border-subtle bg-bg-subtle/78 px-2.5 py-3 shadow-token-xs backdrop-blur sm:px-3">
                                        <p className="text-[10px] font-bold text-fg-tertiary">{label}</p>
                                        <p className="mt-1 text-[12px] font-black text-fg-primary sm:text-sm">{value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <DashboardPreview />
                    </div>
                </div>
            </section>

            <section id="features" className="relative z-10 scroll-mt-24 px-5 pb-16 sm:px-8 sm:pb-24" aria-labelledby="features-title">
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
                        {FEATURES.map((feature) => {
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

            <section id="how-it-works" className="relative z-10 scroll-mt-24 px-5 py-16 sm:px-8 sm:py-24" aria-labelledby="how-title">
                <div className="mx-auto max-w-5xl">
                    <div className="mb-8 text-center">
                        <h2 id="how-title" className="font-heading text-3xl font-black tracking-tight sm:text-5xl">เริ่มใช้ใน 3 ขั้นตอน</h2>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                        {SETUP_STEPS.map((step) => {
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

            <section id="pricing" className="relative z-10 scroll-mt-24 px-5 py-16 sm:px-8 sm:py-24" aria-labelledby="pricing-title">
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
                            <BotInviteLink
                                href={botInviteUrl}
                                aria-label="เชิญบอท GangManager และเริ่มใช้งาน"
                                className="btn-primary inline-flex min-h-12 items-center justify-center gap-2 px-5 text-sm"
                            >
                                เพิ่มบอทและเริ่มใช้ <ArrowRight className="h-4 w-4" />
                            </BotInviteLink>
                            <Link href="/support" prefetch={false} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-token-lg border border-border-subtle bg-bg-muted px-5 text-sm font-black text-fg-secondary transition-colors hover:text-fg-primary">
                                คุยกับซัพพอร์ต <LifeBuoy className="h-4 w-4" />
                            </Link>
                        </div>
                    </Card>
                </div>
            </section>

            <footer className="relative z-10 border-t border-border-subtle px-5 py-10 sm:px-8">
                <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
                    <div className="flex items-center gap-2.5">
                        <BrandLogo showTagline={false} markClassName="h-7 w-7" textClassName="text-sm" />
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-5 text-xs font-bold text-fg-tertiary">
                        <Link href="/terms" prefetch={false} className="inline-flex min-h-11 min-w-11 items-center justify-center transition-colors hover:text-fg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">เงื่อนไข</Link>
                        <Link href="/privacy" prefetch={false} className="inline-flex min-h-11 min-w-11 items-center justify-center transition-colors hover:text-fg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">ความเป็นส่วนตัว</Link>
                        <Link href="/support" prefetch={false} className="inline-flex min-h-11 min-w-11 items-center justify-center transition-colors hover:text-fg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">ซัพพอร์ต</Link>
                        <span>© 2026 Gang Manager • Powered by gegeydev</span>
                    </div>
                </div>
            </footer>
        </main>
    );
}

function BotInviteLink({
    href,
    children,
    className,
    'aria-label': ariaLabel,
}: {
    href: string;
    children: ReactNode;
    className: string;
    'aria-label': string;
}) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
            aria-label={ariaLabel}
            className={`${className} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
        >
            {children}
        </a>
    );
}

function DashboardPreview() {
    return (
        <div aria-hidden="true" className="pointer-events-none relative z-0 mx-auto mt-9 max-h-[390px] w-full max-w-5xl overflow-hidden opacity-95 sm:max-h-none lg:absolute lg:inset-x-auto lg:-right-8 lg:top-8 lg:mt-0 lg:w-[560px]">
            <div className="rounded-token-2xl border border-border-subtle bg-bg-subtle/90 p-3 shadow-token-lg backdrop-blur-xl sm:p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <BrandMark className="h-10 w-10 shadow-token-sm" />
                        <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-fg-tertiary">GangTest99</p>
                            <p className="truncate text-sm font-black text-fg-primary">ภาพรวมแก๊ง</p>
                        </div>
                    </div>
                    <span className="rounded-token-full border border-status-success bg-status-success-subtle px-3 py-1 text-[11px] font-bold text-fg-success">พร้อมใช้งาน</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                    {PREVIEW_SUMMARY_ROWS.map(([label, value, helper]) => (
                        <div key={label} className="rounded-token-xl border border-border-subtle bg-bg-elevated p-2.5 shadow-token-xs sm:p-3">
                            <p className="truncate text-[9px] font-bold text-fg-tertiary sm:text-[10px]">{label}</p>
                            <p className="mt-2 text-xl font-black tabular-nums text-fg-primary sm:text-2xl">{value}</p>
                            <p className="truncate text-[10px] font-bold text-fg-secondary sm:text-xs">{helper}</p>
                        </div>
                    ))}
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-[0.9fr_1.1fr]">
                    <div className="rounded-token-xl border border-border-subtle bg-bg-muted p-3">
                        <div className="mb-3 flex items-center gap-2">
                            <CalendarCheck className="h-4 w-4 text-fg-info" />
                            <p className="text-xs font-black text-fg-primary">Manual roll call</p>
                        </div>
                        {PREVIEW_ATTENDANCE_ROWS.map(([name, status, tone]) => (
                            <div key={name} className="flex min-h-9 items-center justify-between border-t border-border-subtle text-xs font-bold">
                                <span>{name}</span>
                                <span className={tone}>{status}</span>
                            </div>
                        ))}
                    </div>
                    <div className="rounded-token-xl border border-border-subtle bg-bg-muted p-3">
                        <div className="mb-3 flex items-center gap-2">
                            <Wallet className="h-4 w-4 text-accent-bright" />
                            <p className="text-xs font-black text-fg-primary">Finance ledger</p>
                        </div>
                        {PREVIEW_FINANCE_ROWS.map(([label, value, tone]) => (
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
