import { SalesDashboard } from './SalesDashboard';
import { isPromptPayBillingEnabled, getPromptPayReceiverConfig } from '@/lib/promptPayBilling';
import { isSlipOkAutoVerifyEnabled } from '@/lib/slipOk';

function ReadinessChip({ ok, label }: { ok: boolean; label: string }) {
    return (
        <span className={`inline-flex rounded-token-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
            ok
                ? 'border-status-success bg-status-success-subtle text-fg-success'
                : 'border-status-warning bg-status-warning-subtle text-fg-warning'
        }`}>
            {label}: {ok ? 'พร้อม' : 'ยังไม่พร้อม'}
        </span>
    );
}

export default function AdminSalesPage() {
    const promptPayEnabled = isPromptPayBillingEnabled();
    const promptPayReceiver = getPromptPayReceiverConfig();
    const slipOkEnabled = isSlipOkAutoVerifyEnabled();
    const canCreatePaymentRequests = promptPayEnabled && promptPayReceiver.isConfigured;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-black tracking-tight">ยอดขาย & รายได้</h1>
                <p className="text-fg-tertiary text-sm mt-1">ติดตาม PromptPay / SlipOK payment requests และอนุมัติรายการตรวจมือจากฐานข้อมูลของระบบเอง</p>
            </div>

            <section data-testid="admin-sales-readiness-panel" className="rounded-token-2xl border border-border-subtle bg-bg-subtle p-5 shadow-token-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-fg-tertiary">Billing Readiness</p>
                        <h2 className="mt-1 font-heading text-lg font-black text-fg-primary">
                            สถานะระบบขายแพลนแบบ PromptPay
                        </h2>
                        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-fg-secondary">
                            แผงนี้แสดงเฉพาะสถานะพร้อมใช้งาน ไม่แสดง API key, token, เบอร์ PromptPay หรือข้อมูลลับ เพื่อให้ตรวจ production ได้ปลอดภัยก่อนเปิดรับเงินจริง
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <ReadinessChip ok={promptPayEnabled} label="Billing toggle" />
                        <ReadinessChip ok={promptPayReceiver.isConfigured} label="Receiver" />
                        <ReadinessChip ok={slipOkEnabled} label="SlipOK auto" />
                    </div>
                </div>

                <div className={`mt-4 rounded-token-xl border p-4 text-sm ${
                    canCreatePaymentRequests
                        ? 'border-status-success bg-status-success-subtle text-fg-success'
                        : 'border-status-warning bg-status-warning-subtle text-fg-warning'
                }`}>
                    {canCreatePaymentRequests
                        ? 'พร้อมสร้างคำขอชำระเงินจากหน้าแพลนแล้ว รายการที่ส่งสลิปจะเข้าคิวให้แอดมินตรวจหรือให้ SlipOK ตรวจตามการตั้งค่า'
                        : 'ยังไม่เปิดรับชำระเงินจากผู้ใช้จริง หน้าแพลนจะแสดงสถานะปิดรับชำระชั่วคราวและปุ่มอัปเกรดจะถูกปิดไว้'}
                </div>
            </section>
            <SalesDashboard />
        </div>
    );
}
