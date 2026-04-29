import { SalesDashboard } from './SalesDashboard';

export default function AdminSalesPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-black tracking-tight">ยอดขาย & รายได้</h1>
                <p className="text-fg-tertiary text-sm mt-1">ติดตาม PromptPay / SlipOK payment requests และอนุมัติรายการตรวจมือจากฐานข้อมูลของระบบเอง</p>
            </div>
            <SalesDashboard />
        </div>
    );
}
