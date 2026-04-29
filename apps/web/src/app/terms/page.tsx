import type { Metadata } from 'next';
import Link from 'next/link';
import { Bot, CircleDollarSign, ShieldAlert } from 'lucide-react';
import { Badge, Card } from '@/components/ui';

export const metadata: Metadata = {
    title: 'Terms of Service | Gang Manager',
    description: 'เงื่อนไขการใช้งาน Gang Manager สำหรับช่วง soft launch',
};

const terms = [
    {
        title: 'สถานะบริการ',
        body: 'Gang Manager อยู่ในช่วง soft launch เพื่อทดสอบการใช้งานจริงแบบจำกัด ฟีเจอร์อาจถูกปรับปรุง ปิดชั่วคราว หรือเปลี่ยนข้อความเพื่อความถูกต้องของระบบก่อนเปิดขายจริง',
    },
    {
        title: 'การใช้งานที่รับผิดชอบ',
        body: 'ผู้ใช้ต้องมีสิทธิ์จัดการ Discord server หรือได้รับอนุญาตจากเจ้าของเซิร์ฟเวอร์ก่อนติดตั้งบอทหรือเชื่อมข้อมูลแก๊ง ห้ามใช้ระบบเพื่อ spam, harassment, phishing, ขโมยข้อมูล หรือหลีกเลี่ยงข้อกำหนดของ Discord, FiveM, Cfx.re หรือแพลตฟอร์มที่เกี่ยวข้อง',
    },
    {
        title: 'ข้อมูลและความถูกต้อง',
        body: 'ระบบช่วยบันทึกข้อมูลสมาชิก เช็คชื่อ การลา และธุรกรรมภายในแก๊ง แต่ผู้ดูแลเซิร์ฟเวอร์ยังต้องตรวจสอบข้อมูลสำคัญซ้ำก่อนนำไปใช้ตัดสินใจจริง โดยเฉพาะข้อมูลการเงิน บทลงโทษ หรือสิทธิ์สมาชิก',
    },
    {
        title: 'การชำระเงิน',
        body: 'ช่วง soft launch อาจยังไม่เปิดรับชำระเงินจริง ระบบ PromptPay/SlipOK จะเปิดใช้งานเฉพาะเมื่อหน้าแพลนประกาศอย่างเป็นทางการเท่านั้น ผู้ใช้ไม่ควรโอนเงินนอกช่องทางที่ระบบแสดง หากมีปัญหาเรื่องการชำระเงินให้แจ้งซัพพอร์ตพร้อมหลักฐาน',
    },
    {
        title: 'ความสัมพันธ์กับแพลตฟอร์มอื่น',
        body: 'Gang Manager ไม่ใช่ผลิตภัณฑ์ทางการของ Discord, FiveM, Cfx.re หรือ Rockstar Games การใช้งานต้องเคารพข้อกำหนดของแพลตฟอร์มเหล่านั้นด้วย',
    },
];

export default function TermsPage() {
    return (
        <main className="min-h-screen bg-bg-base text-fg-primary px-5 py-16 sm:px-8">
            <div className="mx-auto max-w-4xl space-y-8">
                <header className="space-y-4">
                    <Badge tone="accent" variant="outline" size="md">Soft-launch terms</Badge>
                    <div className="space-y-3">
                        <h1 className="font-heading text-4xl font-black tracking-tight sm:text-5xl">เงื่อนไขการใช้งาน</h1>
                        <p className="max-w-2xl text-sm leading-7 text-fg-secondary">
                            เอกสารนี้กำหนดขอบเขตการใช้งาน Gang Manager ในช่วง soft launch โดยโฟกัสความปลอดภัย ความถูกต้องของข้อมูล และความชัดเจนว่าระบบยังอยู่ในช่วงทดสอบก่อนเปิดขายจริง
                        </p>
                        <p className="text-xs text-fg-tertiary">ปรับปรุงล่าสุด: 29 เมษายน 2026</p>
                    </div>
                </header>

                <section className="grid gap-4 sm:grid-cols-3">
                    <Card padding="md" variant="subtle">
                        <Bot className="mb-3 h-6 w-6 text-brand-discord" />
                        <h2 className="mb-2 text-sm font-bold">Discord-first</h2>
                        <p className="text-xs leading-6 text-fg-secondary">ใช้ OAuth และ bot เพื่อทำงานกับเซิร์ฟเวอร์ที่ผู้ใช้อนุญาตเท่านั้น</p>
                    </Card>
                    <Card padding="md" variant="subtle">
                        <ShieldAlert className="mb-3 h-6 w-6 text-fg-warning" />
                        <h2 className="mb-2 text-sm font-bold">Beta caution</h2>
                        <p className="text-xs leading-6 text-fg-secondary">ควรตรวจสอบข้อมูลสำคัญซ้ำก่อนนำไปใช้ตัดสินใจจริงในชุมชน</p>
                    </Card>
                    <Card padding="md" variant="subtle">
                        <CircleDollarSign className="mb-3 h-6 w-6 text-fg-success" />
                        <h2 className="mb-2 text-sm font-bold">ยังไม่เก็บเงินอัตโนมัติ</h2>
                        <p className="text-xs leading-6 text-fg-secondary">ระบบจ่ายเงิน production จะเปิดผ่าน PromptPay/SlipOK เมื่อพร้อมขายจริงเท่านั้น</p>
                    </Card>
                </section>

                <Card padding="lg" variant="subtle" className="space-y-6">
                    {terms.map((item) => (
                        <section key={item.title}>
                            <h2 className="mb-2 text-lg font-bold">{item.title}</h2>
                            <p className="text-sm leading-7 text-fg-secondary">{item.body}</p>
                        </section>
                    ))}

                    <section>
                        <h2 className="mb-2 text-lg font-bold">การระงับหรือยุติการใช้งาน</h2>
                        <p className="text-sm leading-7 text-fg-secondary">
                            หากพบการใช้งานที่เสี่ยงต่อความปลอดภัย ละเมิดสิทธิ์ผู้อื่น หรือขัดกับข้อกำหนดของแพลตฟอร์มที่เกี่ยวข้อง เราอาจจำกัด ปิด หรือยกเลิกการเข้าถึงเพื่อปกป้องระบบและผู้ใช้คนอื่น
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-2 text-lg font-bold">ติดต่อ</h2>
                        <p className="text-sm leading-7 text-fg-secondary">
                            หากมีคำถาม แจ้งปัญหา หรือต้องการขอลบข้อมูล โปรดติดต่อผ่าน <Link href="/support" className="text-accent-bright hover:underline">หน้าซัพพอร์ต</Link>
                        </p>
                    </section>
                </Card>
            </div>
        </main>
    );
}
