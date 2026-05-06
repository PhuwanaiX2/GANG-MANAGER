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
                <p className="text-fg-tertiary text-sm mt-1">ติดตามรายการชำระเงินผ่าน PromptPay ตรวจสลิป และอนุมัติการเปิดแพลนจากจุดเดียว</p>
            </div>

            <section data-testid="admin-sales-readiness-panel" className="rounded-token-2xl border border-border-subtle bg-bg-subtle p-5 shadow-token-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-fg-tertiary">สถานะระบบรับชำระเงิน</p>
                        <h2 className="mt-1 font-heading text-lg font-black text-fg-primary">
                            สถานะระบบขายแพลนแบบ PromptPay
                        </h2>
                        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-fg-secondary">
                            แผงนี้ใช้เช็กว่าหน้าแพลนพร้อมรับชำระเงินหรือยัง โดยไม่แสดงข้อมูลลับของระบบ
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <ReadinessChip ok={promptPayEnabled} label="เปิดรับชำระ" />
                        <ReadinessChip ok={promptPayReceiver.isConfigured} label="บัญชีรับเงิน" />
                        <ReadinessChip ok={slipOkEnabled} label="ตรวจสลิปอัตโนมัติ" />
                    </div>
                </div>

                <div className={`mt-4 rounded-token-xl border p-4 text-sm ${
                    canCreatePaymentRequests
                        ? 'border-status-success bg-status-success-subtle text-fg-success'
                        : 'border-status-warning bg-status-warning-subtle text-fg-warning'
                }`}>
                    {canCreatePaymentRequests
                        ? 'พร้อมสร้างรายการชำระเงินจากหน้าแพลนแล้ว สลิปจะถูกตรวจตามการตั้งค่าปัจจุบัน'
                        : 'ยังไม่เปิดรับชำระเงินจากผู้ใช้จริง หน้าแพลนจะแสดงสถานะปิดรับชำระชั่วคราวและปุ่มอัปเกรดจะถูกปิดไว้'}
                </div>
            </section>
            <SalesDashboard />
        </div>
    );
}
