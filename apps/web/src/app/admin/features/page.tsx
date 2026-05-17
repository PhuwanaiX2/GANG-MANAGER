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
    const featureEnabled = (key: string) => allFeatureFlags.find((flag: any) => flag.key === key)?.enabled ?? true;
    const promptPayEnabled = process.env.ENABLE_PROMPTPAY_BILLING === 'true';
    const slipOkEnabled = process.env.ENABLE_SLIPOK_AUTO_VERIFY === 'true';
    const promptPayAdminEnabled = featureEnabled('promptpay_billing');
    const slipOkAdminEnabled = featureEnabled('slipok_auto_verify');
    const promptPayReady = Boolean(process.env.PROMPTPAY_RECEIVER_NAME?.trim() && process.env.PROMPTPAY_IDENTIFIER?.trim());
    const slipOkReady = Boolean(process.env.SLIPOK_API_KEY?.trim() && process.env.SLIPOK_BRANCH_ID?.trim());
    const billingReady = promptPayEnabled && promptPayAdminEnabled && promptPayReady;
    const autoVerifyReady = !slipOkEnabled || (slipOkAdminEnabled && slipOkReady);
    const promptPayBillingValue = promptPayEnabled
        ? `ENV on / Admin ${promptPayAdminEnabled ? 'on' : 'off'}`
        : 'ENV off';
    const slipOkVerifyValue = slipOkEnabled
        ? `ENV on / Admin ${slipOkAdminEnabled ? 'on' : 'off'}`
        : 'ENV off';
    const billingPanelDescription = 'ENV เป็นสวิตช์ชั้นนอกของ production ส่วน Feature Flag เป็นสวิตช์แอดมินสำหรับพักหรือเปิดงานรับชำระและตรวจสลิปได้จากหน้าเว็บทันทีเมื่อ ENV เปิดอยู่';
    const billingChecks = [
        {
            label: 'ระบบรับชำระ PromptPay',
            value: promptPayBillingValue,
            pass: promptPayEnabled ? (promptPayAdminEnabled && promptPayReady) : true,
            detail: promptPayEnabled
                ? promptPayReady ? 'ตั้งชื่อบัญชีและ PromptPay identifier แล้ว' : 'เปิด billing แล้ว แต่ข้อมูลบัญชีรับเงินยังไม่ครบ'
                : 'ปิดไว้ได้อย่างปลอดภัย ผู้ใช้จะยังอัปเกรดออนไลน์ไม่ได้',
        },
        {
            label: 'ตรวจสลิปอัตโนมัติ',
            value: slipOkVerifyValue,
            pass: autoVerifyReady,
            detail: slipOkEnabled
                ? slipOkReady ? 'ตั้ง API key และ branch ID แล้ว' : 'เปิดตรวจอัตโนมัติแล้ว แต่ตั้งค่า SlipOK ยังไม่ครบ'
                : 'ปิดอยู่ รายการจะรอแอดมินตรวจจากหน้า Admin Sales',
        },
        {
            label: 'แอดมินตรวจรายการเอง',
            value: 'พร้อมใช้งาน',
            pass: true,
            detail: 'รายการสลิปที่ส่งเข้ามาสามารถอนุมัติหรือปฏิเสธได้จาก Admin Sales',
        },
    ];

    return (
        <div className="min-w-0 space-y-6">
            <div>
                <h1 className="text-2xl font-black tracking-tight">Feature Flags</h1>
                <p className="text-fg-tertiary text-sm mt-1">เปิด/ปิดฟีเจอร์ทั้งระบบ — Kill-Switch สำหรับกรณีฉุกเฉินหรือกำลังพัฒนา</p>
            </div>

            <section className="min-w-0 overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle shadow-token-sm">
                <div className="border-b border-border-subtle p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                            <div className="mb-2 inline-flex items-center gap-2 rounded-token-full border border-border-accent bg-accent-subtle px-3 py-1 text-[10px] font-bold text-accent-bright">
                                <CreditCard className="h-3.5 w-3.5" />
                                ความพร้อมรับชำระเงิน
                            </div>
                            <h2 className="font-heading text-xl font-black text-fg-primary">สถานะการขายและตรวจสลิป</h2>
                            <p className="mt-1 max-w-2xl text-sm leading-7 text-fg-secondary">
                                {billingPanelDescription}
                            </p>
                        </div>
                        <div className={`max-w-full rounded-token-xl border px-4 py-3 text-sm font-bold ${billingReady && autoVerifyReady ? 'border-status-success bg-status-success-subtle text-fg-success' : 'border-status-warning bg-status-warning-subtle text-fg-warning'}`}>
                            {billingReady && autoVerifyReady ? (
                                <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Billing path พร้อม</span>
                            ) : (
                                <span className="inline-flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> ยังไม่ควรเปิดรับชำระเงิน</span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="grid min-w-0 grid-cols-1 gap-3 p-4 sm:p-5 lg:grid-cols-3">
                    {billingChecks.map((check) => (
                        <div key={check.label} className={`min-w-0 rounded-token-xl border p-4 ${readinessTone(check.pass)}`}>
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <span className="min-w-0 break-words text-xs font-bold">{check.label}</span>
                                {check.pass ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                            </div>
                            <p className="text-sm font-black text-fg-primary">{check.value}</p>
                            <p className="mt-2 break-words text-xs leading-6 text-fg-secondary">{check.detail}</p>
                        </div>
                    ))}
                </div>
            </section>

            <FeatureFlagManager initialFlags={JSON.parse(JSON.stringify(allFeatureFlags))} />
        </div>
    );
}
