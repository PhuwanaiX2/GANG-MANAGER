export const dynamic = 'force-dynamic';

import { db, FeatureFlagService } from '@gang/database';
import { FeatureFlagManager } from '../AdminClient';
import { AlertTriangle, CheckCircle2, CreditCard, ShieldCheck, XCircle } from 'lucide-react';

function readinessTone(pass: boolean) {
    return pass
        ? 'border-status-success bg-status-success-subtle text-fg-success'
        : 'border-status-warning bg-status-warning-subtle text-fg-warning';
}

export default async function AdminFeaturesPage() {
    await FeatureFlagService.seed(db);
    const allFeatureFlags = await FeatureFlagService.getAll(db);
    const promptPayEnabled = process.env.ENABLE_PROMPTPAY_BILLING === 'true';
    const slipOkEnabled = process.env.ENABLE_SLIPOK_AUTO_VERIFY === 'true';
    const promptPayReady = Boolean(process.env.PROMPTPAY_RECEIVER_NAME?.trim() && process.env.PROMPTPAY_IDENTIFIER?.trim());
    const slipOkReady = Boolean(process.env.SLIPOK_API_KEY?.trim() && process.env.SLIPOK_BRANCH_ID?.trim());
    const billingReady = promptPayEnabled && promptPayReady;
    const autoVerifyReady = !slipOkEnabled || slipOkReady;
    const billingChecks = [
        {
            label: 'PromptPay billing',
            value: promptPayEnabled ? 'เปิดจาก ENV' : 'ปิดจาก ENV',
            pass: promptPayEnabled ? promptPayReady : true,
            detail: promptPayEnabled
                ? promptPayReady ? 'ตั้งชื่อบัญชีและ PromptPay identifier แล้ว' : 'เปิด billing แล้ว แต่ข้อมูลบัญชีรับเงินยังไม่ครบ'
                : 'ปิดไว้ได้อย่างปลอดภัย ผู้ใช้จะยังอัปเกรดออนไลน์ไม่ได้',
        },
        {
            label: 'SlipOK auto verify',
            value: slipOkEnabled ? 'เปิดจาก ENV' : 'ปิดจาก ENV',
            pass: autoVerifyReady,
            detail: slipOkEnabled
                ? slipOkReady ? 'ตั้ง API key และ branch ID แล้ว' : 'เปิด auto verify แล้ว แต่ SlipOK config ยังไม่ครบ'
                : 'ปิดอยู่ ระบบยังรองรับ manual review จากหน้า Admin Sales',
        },
        {
            label: 'Manual review fallback',
            value: 'พร้อมใช้งาน',
            pass: true,
            detail: 'รายการสลิปที่ส่งเข้ามาสามารถตรวจมือและอนุมัติ/ปฏิเสธได้จาก Admin Sales',
        },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-black tracking-tight">Feature Flags</h1>
                <p className="text-fg-tertiary text-sm mt-1">เปิด/ปิดฟีเจอร์ทั้งระบบ — Kill-Switch สำหรับกรณีฉุกเฉินหรือกำลังพัฒนา</p>
            </div>

            <section className="overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle shadow-token-sm">
                <div className="border-b border-border-subtle p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <div className="mb-2 inline-flex items-center gap-2 rounded-token-full border border-border-accent bg-accent-subtle px-3 py-1 text-[10px] font-black uppercase tracking-widest text-accent-bright">
                                <CreditCard className="h-3.5 w-3.5" />
                                Billing readiness
                            </div>
                            <h2 className="font-heading text-xl font-black text-fg-primary">สถานะการขายและตรวจสลิป</h2>
                            <p className="mt-1 max-w-2xl text-sm leading-7 text-fg-secondary">
                                หน้านี้เป็น dashboard อ่านค่า ENV เท่านั้น เพื่อกันการเผลอเปิดขายจาก UI ใน production ถ้าจะเปิด/ปิดจริงให้แก้ ENV บน Vercel แล้ว redeploy
                            </p>
                        </div>
                        <div className={`rounded-token-xl border px-4 py-3 text-sm font-bold ${billingReady && autoVerifyReady ? 'border-status-success bg-status-success-subtle text-fg-success' : 'border-status-warning bg-status-warning-subtle text-fg-warning'}`}>
                            {billingReady && autoVerifyReady ? (
                                <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Billing path พร้อม</span>
                            ) : (
                                <span className="inline-flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> ยังไม่ควรเปิดรับชำระเงิน</span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="grid gap-3 p-5 lg:grid-cols-3">
                    {billingChecks.map((check) => (
                        <div key={check.label} className={`rounded-token-xl border p-4 ${readinessTone(check.pass)}`}>
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <span className="text-xs font-black uppercase tracking-widest">{check.label}</span>
                                {check.pass ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                            </div>
                            <p className="text-sm font-black text-fg-primary">{check.value}</p>
                            <p className="mt-2 text-xs leading-6 text-fg-secondary">{check.detail}</p>
                        </div>
                    ))}
                </div>
            </section>

            <FeatureFlagManager initialFlags={JSON.parse(JSON.stringify(allFeatureFlags))} />
        </div>
    );
}
