import type { Metadata } from 'next';
import Link from 'next/link';
import { Database, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Badge, Card } from '@/components/ui';

export const metadata: Metadata = {
    title: 'Privacy Policy | Gang Manager',
    description: 'นโยบายความเป็นส่วนตัวสำหรับ Gang Manager',
};

const dataGroups = [
    'บัญชี Discord เช่น Discord ID, username, avatar และข้อมูลเซิร์ฟเวอร์ที่ผู้ใช้อนุญาตผ่าน Discord OAuth หรือการติดตั้งบอท',
    'ข้อมูลการจัดการแก๊ง เช่น สมาชิก ยศ สิทธิ์ ช่อง Discord การตั้งค่า ประกาศ การเช็คชื่อ การลา และประวัติการเงินภายในแก๊ง',
    'ข้อมูลระบบเพื่อความปลอดภัยและการตรวจสอบ เช่น audit log, rate-limit log, error log และ metadata ที่จำเป็นต่อการป้องกัน abuse',
    'ไฟล์หรือรูปที่ผู้ใช้ตั้งใจอัปโหลด เช่น รูปโปรไฟล์แก๊ง โดยอาจถูกจัดเก็บผ่าน Cloudinary หรือผู้ให้บริการจัดเก็บไฟล์ที่โปรเจกต์ใช้',
];

const processors = [
    'Discord: ใช้สำหรับ OAuth, bot, role/channel sync และการส่งข้อความตามที่ผู้ใช้ตั้งค่า',
    'Vercel: ใช้โฮสต์เว็บแอป และอาจใช้ analytics/speed insight ที่จำเป็นต่อการดูแลคุณภาพระบบ',
    'Turso: ใช้เป็นฐานข้อมูลสำหรับข้อมูลแก๊งและข้อมูลปฏิบัติการของระบบ',
    'Cloudinary: ใช้จัดเก็บและเสิร์ฟรูปภาพที่ผู้ใช้ตั้งใจอัปโหลดหรือเชื่อมต่อ',
];

export default function PrivacyPage() {
    return (
        <main className="min-h-screen bg-bg-base text-fg-primary px-5 py-16 sm:px-8">
            <div className="mx-auto max-w-4xl space-y-8">
                <header className="space-y-4">
                    <Badge tone="accent" variant="outline" size="md">Privacy notice</Badge>
                    <div className="space-y-3">
                        <h1 className="font-heading text-4xl font-black tracking-tight sm:text-5xl">นโยบายความเป็นส่วนตัว</h1>
                        <p className="max-w-2xl text-sm leading-7 text-fg-secondary">
                            Gang Manager เป็นเครื่องมือจัดการแก๊ง FiveM ผ่าน Discord Bot และ Web Dashboard นโยบายนี้อธิบายข้อมูลที่ระบบเก็บ เหตุผลที่ใช้ข้อมูล และช่องทางติดต่อเพื่อขอลบหรือแก้ไขข้อมูล
                        </p>
                        <p className="text-xs text-fg-tertiary">ปรับปรุงล่าสุด: 29 เมษายน 2026</p>
                    </div>
                </header>

                <section className="grid gap-4 sm:grid-cols-3">
                    <Card padding="md" variant="subtle">
                        <ShieldCheck className="mb-3 h-6 w-6 text-fg-success" />
                        <h2 className="mb-2 text-sm font-bold">ใช้เท่าที่จำเป็น</h2>
                        <p className="text-xs leading-6 text-fg-secondary">ข้อมูลถูกใช้เพื่อให้ฟีเจอร์ทำงาน ป้องกัน abuse ตรวจสอบย้อนหลัง และซัพพอร์ตผู้ใช้เท่านั้น</p>
                    </Card>
                    <Card padding="md" variant="subtle">
                        <LockKeyhole className="mb-3 h-6 w-6 text-fg-info" />
                        <h2 className="mb-2 text-sm font-bold">ไม่ขายข้อมูล</h2>
                        <p className="text-xs leading-6 text-fg-secondary">เราไม่ขายข้อมูลส่วนบุคคล และไม่ใช้ข้อมูล Discord API เพื่อฝึก AI หรือโมเดลภาษา</p>
                    </Card>
                    <Card padding="md" variant="subtle">
                        <Database className="mb-3 h-6 w-6 text-accent-bright" />
                        <h2 className="mb-2 text-sm font-bold">ขอลบได้</h2>
                        <p className="text-xs leading-6 text-fg-secondary">ผู้ใช้สามารถติดต่อเพื่อขอลบ แก้ไข หรือส่งออกข้อมูลที่เกี่ยวข้องกับตนเองได้ผ่านช่องทางซัพพอร์ต</p>
                    </Card>
                </section>

                <Card padding="lg" variant="subtle" className="space-y-6">
                    <section>
                        <h2 className="mb-3 text-lg font-bold">ข้อมูลที่เราเก็บ</h2>
                        <ul className="space-y-3 text-sm leading-7 text-fg-secondary">
                            {dataGroups.map((item) => <li key={item}>• {item}</li>)}
                        </ul>
                    </section>

                    <section>
                        <h2 className="mb-3 text-lg font-bold">เหตุผลที่ใช้ข้อมูล</h2>
                        <p className="text-sm leading-7 text-fg-secondary">
                            เราใช้ข้อมูลเพื่อยืนยันตัวตนผ่าน Discord, จัดการสมาชิกและสิทธิ์, สร้างรอบเช็คชื่อ, ประมวลผลคำขอลา, บันทึกประวัติการเงินภายในแก๊ง, ส่งประกาศหรือ log ไป Discord ตามการตั้งค่า, ป้องกันการใช้งานผิดปกติ และแก้ปัญหาจากรายงานผู้ใช้
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-lg font-bold">ผู้ให้บริการที่เกี่ยวข้อง</h2>
                        <ul className="space-y-3 text-sm leading-7 text-fg-secondary">
                            {processors.map((item) => <li key={item}>• {item}</li>)}
                        </ul>
                    </section>

                    <section>
                        <h2 className="mb-3 text-lg font-bold">การเก็บรักษาและการลบข้อมูล</h2>
                        <p className="text-sm leading-7 text-fg-secondary">
                            ข้อมูลจะถูกเก็บเท่าที่จำเป็นต่อการให้บริการ ความปลอดภัย การตรวจสอบย้อนหลัง และข้อกำหนดทางเทคนิคของระบบ หากต้องการลบข้อมูลส่วนบุคคลหรือข้อมูลเซิร์ฟเวอร์ ให้ติดต่อซัพพอร์ตพร้อม Discord ID และชื่อเซิร์ฟเวอร์ที่เกี่ยวข้อง
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-lg font-bold">ติดต่อเรื่องข้อมูลส่วนบุคคล</h2>
                        <p className="text-sm leading-7 text-fg-secondary">
                            ติดต่อผ่าน <a href="https://discord.gg/rHvkNv8ayj" target="_blank" rel="noopener noreferrer" className="text-accent-bright hover:underline">Discord Support</a> หรืออ่านช่องทางช่วยเหลือที่ <Link href="/support" className="text-accent-bright hover:underline">/support</Link>
                        </p>
                    </section>
                </Card>
            </div>
        </main>
    );
}
