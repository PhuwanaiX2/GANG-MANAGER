import { SalesDashboard } from './SalesDashboard';

export default function AdminSalesPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-black tracking-tight">ยอดขาย & รายได้</h1>
                <p className="text-gray-500 text-sm mt-1">ข้อมูลจาก Stripe API แบบ Real-time</p>
            </div>
            <SalesDashboard />
        </div>
    );
}
