import type { Metadata } from 'next';
import { LifeBuoy, MessageCircle, ShieldCheck } from 'lucide-react';
import { Badge, Card } from '@/components/ui';

export const metadata: Metadata = {
    title: 'Support | Gang Manager',
    description: 'ช่องทางช่วยเหลือและแจ้งปัญหา Gang Manager',
};

const supportItems = [
    'แจ้ง bug พร้อมขั้นตอนที่กดแล้วเกิดปัญหา เช่น หน้าเว็บ ปุ่ม Discord ชื่อคำสั่ง เวลาประมาณ และรูปหน้าจอถ้ามี',
    'แจ้งปัญหาข้อมูล เช่น สมาชิกหาย ยศไม่ sync ยอดเงินผิด หรือรอบเช็คชื่อไม่ตรง โดยแนบชื่อแก๊งและ Discord ID ที่เกี่ยวข้อง',
    'ขอลบหรือแก้ไขข้อมูลส่วนบุคคล โดยระบุ Discord ID และเซิร์ฟเวอร์ที่ต้องการให้ตรวจสอบ',
];

export default function SupportPage() {
    return (
        <main className="min-h-screen bg-bg-base text-fg-primary px-5 py-16 sm:px-8">
            <div className="mx-auto max-w-4xl space-y-8">
                <header className="space-y-4">
                    <Badge tone="accent" variant="outline" size="md">Support center</Badge>
                    <div className="space-y-3">
                        <h1 className="font-heading text-4xl font-black tracking-tight sm:text-5xl">ศูนย์ช่วยเหลือ</h1>
                        <p className="max-w-2xl text-sm leading-7 text-fg-secondary">
                            ช่องทางหลักสำหรับแจ้งปัญหา ขอความช่วยเหลือ และส่งรายละเอียดให้ทีมดูบริบทเดียวกันทั้งเว็บ บอท และ Discord
                        </p>
                    </div>
                </header>

                <section className="grid gap-4 sm:grid-cols-2">
                    <Card padding="lg" variant="elevated" className="space-y-4">
                        <MessageCircle className="h-7 w-7 text-brand-discord" />
                        <div>
                            <h2 className="mb-2 text-xl font-bold">Discord Support</h2>
                            <p className="text-sm leading-7 text-fg-secondary">ใช้สำหรับแจ้งปัญหา ขอความช่วยเหลือ และติดตามสถานะการแก้ไขจากเจ้าของระบบโดยตรง</p>
                        </div>
                        <a
                            href="https://discord.gg/rHvkNv8ayj"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center rounded-token-lg bg-accent px-4 py-2 text-sm font-bold text-fg-inverse transition-colors hover:brightness-110"
                        >
                            เข้าร่วม Discord Support
                        </a>
                    </Card>

                    <Card padding="lg" variant="subtle" className="space-y-4">
                        <ShieldCheck className="h-7 w-7 text-fg-success" />
                        <div>
                            <h2 className="mb-2 text-xl font-bold">ก่อนส่งเคส</h2>
                            <p className="text-sm leading-7 text-fg-secondary">ถ้าเป็นข้อมูลสำคัญ เช่น การเงินหรือสิทธิ์สมาชิก ให้หยุดใช้งานจุดนั้นชั่วคราวแล้วแจ้งรายละเอียดทันที</p>
                        </div>
                    </Card>
                </section>

                <Card padding="lg" variant="subtle">
                    <div className="mb-5 flex items-center gap-3">
                        <LifeBuoy className="h-5 w-5 text-accent-bright" />
                        <h2 className="text-lg font-bold">ข้อมูลที่ช่วยให้แก้เร็ว</h2>
                    </div>
                    <ul className="space-y-3 text-sm leading-7 text-fg-secondary">
                        {supportItems.map((item) => <li key={item}>• {item}</li>)}
                    </ul>
                </Card>
            </div>
        </main>
    );
}
