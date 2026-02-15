export const dynamic = 'force-dynamic';

import { db, licenses } from '@gang/database';
import { desc } from 'drizzle-orm';
import { LicenseManager } from '../AdminClient';

export default async function AdminLicensesPage() {
    const allLicenses = await db.query.licenses.findMany({ orderBy: desc(licenses.createdAt) });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-black tracking-tight">License Keys</h1>
                <p className="text-gray-500 text-sm mt-1">สร้าง/จัดการ License Key สำหรับเปิดใช้งานแพลน</p>
            </div>

            <LicenseManager initialLicenses={JSON.parse(JSON.stringify(allLicenses))} />
        </div>
    );
}
