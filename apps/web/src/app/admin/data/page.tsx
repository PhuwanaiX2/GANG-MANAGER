import { db, gangs } from '@gang/database';
import { eq } from 'drizzle-orm';
import { DataManager } from '../AdminClient';

export default async function AdminDataPage() {
    const allGangs = await db.query.gangs.findMany({
        where: eq(gangs.isActive, true),
        columns: { id: true, name: true },
    });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-black tracking-tight">ข้อมูล & Backup</h1>
                <p className="text-gray-500 text-sm mt-1">ดาวน์โหลด Backup, ลบข้อมูลเก่า, ดูรายงานระบบ</p>
            </div>

            <DataManager gangList={allGangs.map(g => ({ id: g.id, name: g.name }))} />
        </div>
    );
}
