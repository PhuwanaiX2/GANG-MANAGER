import type { Metadata } from 'next';
import Link from 'next/link';
import {
    ArrowLeft,
    BadgeCheck,
    Bot,
    CheckCircle2,
    ClipboardCheck,
    ExternalLink,
    LifeBuoy,
    Settings,
    Shield,
    ShieldCheck,
    UserCheck,
    Wrench,
} from 'lucide-react';
import { Badge, Card } from '@/components/ui';
import { DiscordLogo } from '@/components/icons/DiscordLogo';
import { getDiscordBotInviteUrl, getDiscordSupportInviteUrl } from '@/lib/discordInvite';

export const metadata: Metadata = {
    title: 'คู่มือบอท Discord | Gang Manager',
    description: 'คู่มือติดตั้งและใช้งานบอท Discord สำหรับ Gang Manager',
};

const setupSteps = [
    {
        title: 'เชิญบอทเข้าเซิร์ฟเวอร์',
        body: 'ใช้บัญชีที่มีสิทธิ์จัดการเซิร์ฟเวอร์ เชิญบอทเข้า Discord แล้วเปิดสิทธิ์ให้บอทจัดการยศ จัดการห้อง ส่งข้อความ และใช้คำสั่ง Slash Commands',
    },
    {
        title: 'ตรวจลำดับยศบอท',
        body: 'ลากยศของบอทให้อยู่สูงกว่ายศที่ระบบต้องให้หรือถอน เช่น ยศคนทั่วไป ยศสมาชิกแก๊ง และยศทีมดูแล ถ้าบอทให้ยศไหนไม่ได้ ระบบจะหยุดและบอกให้แก้ก่อน',
    },
    {
        title: 'ใช้คำสั่ง /setup',
        body: 'เลือกชื่อแก๊ง จากนั้นเลือกว่าจะให้บอทสร้างยศใหม่ หรือใช้ยศเดิมของเซิร์ฟเวอร์ที่มีอยู่แล้ว',
    },
    {
        title: 'เลือกยศคนทั่วไป',
        body: 'ยศนี้สำหรับคนที่อยู่ใน Discord แต่ยังไม่ได้เป็นสมาชิกแก๊ง เช่น ประชาชน ผู้เล่นทั่วไป หรือยศที่ได้หลังพิมพ์จุด ยศนี้ไม่ใช่ยศสมาชิกแก๊ง',
    },
    {
        title: 'เลือกยศสมาชิกแก๊ง',
        body: 'ถ้าเซิร์ฟเวอร์มียศสมาชิกอยู่แล้ว เช่น BIDROI หรือชื่อแก๊ง ให้เลือกยศเดิมได้เลย ไม่จำเป็นต้องสร้าง Gang Member ใหม่',
    },
    {
        title: 'เลือกห้องที่ใช้จริงบนเว็บ',
        body: 'เข้า Dashboard > ตั้งค่า > ยศและช่อง Discord แล้วเลือกห้องลงทะเบียน เช็คชื่อ การเงิน ประกาศ แจ้งลา และห้องบันทึกระบบตามโครงเซิร์ฟจริง',
    },
    {
        title: 'กดซ่อมห้อง/ยศ',
        body: 'กลับไปที่ห้องควบคุมใน Discord แล้วกดซ่อมห้อง/ยศ เพื่อให้บอทส่งข้อความพร้อมปุ่มล่าสุดไปยังห้องที่เลือกไว้ โดยไม่ลบข้อความเก่า',
    },
    {
        title: 'ทดสอบก่อนเปิดให้สมาชิกใช้',
        body: 'ให้สมาชิกลองรับยศคนทั่วไป สมัครเข้าแก๊ง อนุมัติสมาชิก เปิดรอบเช็คชื่อ แจ้งลา และทดสอบสิทธิ์หน้าเว็บอย่างน้อยหนึ่งรอบ',
    },
];

const roleDefinitions = [
    {
        icon: BadgeCheck,
        title: 'ยศคนทั่วไปในเซิร์ฟ',
        body: 'ใช้เปิดห้องพื้นฐานให้คนที่ยังไม่ได้เข้าแก๊ง เช่น คนที่มาเล่นเกมอื่น คนที่รอสมัคร หรือคนที่เพิ่งเข้าดิส ยศนี้ยังไม่ใช่สมาชิกแก๊ง',
    },
    {
        icon: UserCheck,
        title: 'ยศสมาชิกแก๊ง',
        body: 'ใช้กับคนที่สมัครและได้รับอนุมัติแล้ว สมาชิกกลุ่มนี้จะเริ่มใช้ Dashboard, เช็คชื่อ, การลา และระบบการเงินได้ตามสิทธิ์ของตัวเอง',
    },
    {
        icon: ShieldCheck,
        title: 'ยศดูแลระบบ',
        body: 'Owner ยึดจากเจ้าของ Discord server ส่วน Admin, เหรัญญิก และเจ้าหน้าที่เช็คชื่อใช้กำหนดสิทธิ์งานเฉพาะจุดในเว็บและบอท',
    },
];

const existingServerTips = [
    'ไม่ต้องย้ายโครงห้องเดิมทั้งหมด ให้เลือกห้องที่ใช้อยู่จริงจากหน้าเว็บ แล้วกดซ่อมห้อง/ยศเพื่อส่งข้อความพร้อมปุ่มใหม่',
    'ถ้าเซิร์ฟเวอร์มียศสมาชิกเดิมอยู่แล้ว ให้เลือกยศนั้นใน /setup เช่น BIDROI, BITROI หรือชื่อแก๊ง',
    'ถ้าคนนอกเซิร์ฟต้องเข้ามาคุยหรือเล่นอย่างอื่น ให้ใช้ยศคนทั่วไปแยกจากยศสมาชิกเสมอ',
    'ถ้าบอทแจ้งว่าให้/ถอนยศไม่ได้ ให้ย้ายยศบอทขึ้นสูงกว่ายศนั้นก่อน แล้วกด /setup หรือซ่อมห้อง/ยศใหม่',
];

const botSurfaces = [
    { title: '/setup', body: 'เปิดระบบใหม่หรือซ่อมระบบเดิม เลือกยศคนทั่วไป ยศสมาชิกแก๊ง และส่งข้อความพร้อมปุ่มหลัก' },
    { title: '/help', body: 'ดูคำสั่งและตำแหน่งห้องที่สมาชิกควรใช้งาน' },
    { title: 'รับยศคนทั่วไป', body: 'ปุ่มสำหรับคนที่ยังไม่ใช่สมาชิกแก๊ง เพื่อให้เห็นห้องพื้นฐานที่แอดมินเปิดไว้' },
    { title: 'สมัครเข้าแก๊ง', body: 'ปุ่มส่งคำขอเข้าแก๊งจริง หลังจากได้รับยศคนทั่วไปแล้ว' },
    { title: 'ศูนย์ควบคุมหัวหน้าแก๊ง', body: 'แผงรวม Dashboard, ตั้งค่าเว็บ, การเงินบนเว็บ, ซ่อมห้อง/ยศ และรายการเงินด่วน' },
];

const commonIssues = [
    {
        title: 'กดปุ่มแล้วบอทบอกว่าไม่มีสิทธิ์',
        body: 'ตรวจว่ายศของบอทอยู่สูงกว่ายศที่ต้องให้/ถอน และบอทมีสิทธิ์ส่งข้อความในห้องนั้นครบหรือไม่',
    },
    {
        title: 'สมาชิกสมัครไม่ได้',
        body: 'ให้สมาชิกกดรับยศคนทั่วไปก่อน หรือให้แอดมินตรวจว่ายศคนทั่วไปที่ตั้งไว้ยังอยู่และบอทให้ยศนี้ได้',
    },
    {
        title: 'ปุ่มหรือข้อความระบบหาย',
        body: 'เลือกห้องปลายทางใหม่บนเว็บ แล้วกดซ่อมห้อง/ยศจากแผงควบคุมใน Discord',
    },
    {
        title: 'ปุ่มการเงินหรือบางระบบกดไม่ได้',
        body: 'ตรวจแพลนของแก๊ง สิทธิ์ของสมาชิก และกดซ่อมห้อง/ยศหลังอัปเกรดแพลนเพื่ออัปเดตปุ่มใน Discord',
    },
];

const launchChecklist = [
    'Discord OAuth login ใช้ได้',
    '/setup กับเซิร์ฟเวอร์จริงใช้ได้',
    'เลือกยศคนทั่วไปและยศสมาชิกเดิมได้ถูกต้อง',
    'เลือกห้องเดิมบนเว็บและกดซ่อมห้อง/ยศแล้วข้อความพร้อมปุ่มไปถูกห้อง',
    'สมาชิกกดรับยศคนทั่วไปและสมัครเข้าแก๊งได้',
    'หัวหน้า/แอดมินอนุมัติหรือปฏิเสธสมาชิกได้',
    'เปิดรอบเช็คชื่อได้ทั้ง Discord self check-in และ manual roll call',
    'แจ้งลาและอนุมัติ/ปฏิเสธได้',
    'ระบบการเงินและแพลนตรงกับสิทธิ์จริง',
    'สมาชิกที่ไม่มีสิทธิ์เข้าหน้า admin หรือกดปุ่ม admin ไม่ได้',
];

export default function DiscordBotGuidePage() {
    const botInviteUrl = getDiscordBotInviteUrl();
    const supportUrl = getDiscordSupportInviteUrl();

    return (
        <main data-testid="discord-bot-guide-page" className="min-h-screen bg-bg-base px-5 py-10 text-fg-primary sm:px-8 sm:py-14">
            <div className="mx-auto max-w-6xl space-y-8">
                <Link
                    href="/support"
                    prefetch={false}
                    className="inline-flex min-h-10 items-center gap-2 rounded-token-lg border border-border-subtle bg-bg-subtle px-3 text-sm font-bold text-fg-secondary transition-colors hover:border-border hover:text-fg-primary"
                >
                    <ArrowLeft className="h-4 w-4" />
                    กลับศูนย์ช่วยเหลือ
                </Link>

                <header className="overflow-hidden rounded-token-xl border border-border-subtle bg-bg-elevated shadow-token-lg">
                    <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)] lg:items-end">
                        <div className="space-y-5">
                            <Badge tone="accent" variant="outline" size="md">Discord bot guide</Badge>
                            <div className="space-y-3">
                                <h1 className="font-heading text-3xl font-black tracking-tight sm:text-5xl">
                                    คู่มือติดตั้งและใช้งานบอท Discord
                                </h1>
                                <p className="max-w-3xl text-sm leading-7 text-fg-secondary sm:text-base">
                                    สำหรับเจ้าของเซิร์ฟเวอร์และหัวหน้าแก๊งที่ต้องการใช้ Gang Manager กับ Discord ที่มีอยู่แล้ว โดยไม่ต้องรื้อโครงห้องเดิมทั้งหมด
                                </p>
                            </div>
                            <div className="flex flex-col gap-3 sm:flex-row">
                                <a
                                    href={botInviteUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-token-lg bg-accent px-4 text-sm font-black text-accent-fg transition-colors hover:bg-accent-hover"
                                >
                                    <DiscordLogo className="h-4 w-4" />
                                    เชิญบอทเข้าเซิร์ฟเวอร์
                                    <ExternalLink className="h-4 w-4" />
                                </a>
                                <a
                                    href={supportUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-token-lg border border-border-subtle bg-bg-subtle px-4 text-sm font-black text-fg-secondary transition-colors hover:text-fg-primary"
                                >
                                    <LifeBuoy className="h-4 w-4" />
                                    ขอความช่วยเหลือ
                                </a>
                            </div>
                        </div>

                        <Card padding="lg" variant="subtle" className="space-y-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-token-lg border border-border-accent bg-accent-subtle text-accent-bright">
                                <Bot className="h-6 w-6" />
                            </div>
                            <div>
                                <h2 className="text-lg font-black">สรุปสั้นที่สุด</h2>
                                <p className="mt-2 text-sm leading-7 text-fg-secondary">
                                    เชิญบอท → จัดลำดับยศ → ใช้ /setup → เลือกยศคนทั่วไป → เลือกยศสมาชิกแก๊ง → เลือกห้องบนเว็บ → กดซ่อมห้อง/ยศ
                                </p>
                            </div>
                        </Card>
                    </div>
                </header>

                <section className="grid gap-4 lg:grid-cols-3">
                    {roleDefinitions.map((item) => {
                        const Icon = item.icon;
                        return (
                            <Card key={item.title} padding="lg" variant="subtle" className="space-y-3">
                                <Icon className="h-6 w-6 text-accent-bright" />
                                <h2 className="text-lg font-black">{item.title}</h2>
                                <p className="text-sm leading-7 text-fg-secondary">{item.body}</p>
                            </Card>
                        );
                    })}
                </section>

                <section className="rounded-token-xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm sm:p-6">
                    <div className="mb-5 flex items-center gap-3">
                        <Settings className="h-5 w-5 text-accent-bright" />
                        <div>
                            <h2 className="text-xl font-black">ขั้นตอนติดตั้งแบบละเอียด</h2>
                            <p className="mt-1 text-sm text-fg-secondary">เหมาะกับทั้งเซิร์ฟใหม่และเซิร์ฟที่มีห้อง/ยศเดิมอยู่แล้ว</p>
                        </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                        {setupSteps.map((step, index) => (
                            <article key={step.title} className="rounded-token-lg border border-border-subtle bg-bg-base p-4">
                                <div className="mb-3 flex items-center gap-3">
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-token-full bg-accent text-xs font-black text-accent-fg">
                                        {String(index + 1).padStart(2, '0')}
                                    </span>
                                    <h3 className="text-sm font-black text-fg-primary">{step.title}</h3>
                                </div>
                                <p className="text-sm leading-7 text-fg-secondary">{step.body}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                    <Card padding="lg" variant="subtle" className="space-y-4">
                        <div className="flex items-center gap-3">
                            <Shield className="h-5 w-5 text-fg-success" />
                            <h2 className="text-xl font-black">กรณีมี Discord เดิมอยู่แล้ว</h2>
                        </div>
                        <ul className="space-y-3 text-sm leading-7 text-fg-secondary">
                            {existingServerTips.map((item) => <li key={item}>• {item}</li>)}
                        </ul>
                    </Card>

                    <Card padding="lg" variant="subtle" className="space-y-4">
                        <div className="flex items-center gap-3">
                            <ClipboardCheck className="h-5 w-5 text-fg-info" />
                            <h2 className="text-xl font-black">จุดที่บอทให้ใช้งาน</h2>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {botSurfaces.map((item) => (
                                <div key={item.title} className="rounded-token-lg border border-border-subtle bg-bg-muted p-3">
                                    <h3 className="text-sm font-black text-fg-primary">{item.title}</h3>
                                    <p className="mt-1 text-xs leading-6 text-fg-secondary">{item.body}</p>
                                </div>
                            ))}
                        </div>
                    </Card>
                </section>

                <section className="grid gap-4 lg:grid-cols-2">
                    <Card padding="lg" variant="subtle" className="space-y-4">
                        <div className="flex items-center gap-3">
                            <Wrench className="h-5 w-5 text-fg-warning" />
                            <h2 className="text-xl font-black">ปัญหาที่เจอบ่อย</h2>
                        </div>
                        <div className="space-y-3">
                            {commonIssues.map((issue) => (
                                <div key={issue.title} className="rounded-token-lg border border-border-subtle bg-bg-base p-3">
                                    <h3 className="text-sm font-black text-fg-primary">{issue.title}</h3>
                                    <p className="mt-1 text-xs leading-6 text-fg-secondary">{issue.body}</p>
                                </div>
                            ))}
                        </div>
                    </Card>

                    <Card padding="lg" variant="subtle" className="space-y-4">
                        <div className="flex items-center gap-3">
                            <CheckCircle2 className="h-5 w-5 text-fg-success" />
                            <h2 className="text-xl font-black">เช็กลิสต์ก่อนเปิดให้สมาชิกใช้</h2>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {launchChecklist.map((item) => (
                                <div key={item} className="flex gap-2 rounded-token-lg border border-border-subtle bg-bg-base p-3 text-xs font-bold leading-5 text-fg-secondary">
                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-fg-success" />
                                    <span>{item}</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                </section>
            </div>
        </main>
    );
}
