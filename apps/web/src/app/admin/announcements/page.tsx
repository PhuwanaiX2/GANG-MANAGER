export const dynamic = 'force-dynamic';

import { db, systemAnnouncements } from '@gang/database';
import { desc } from 'drizzle-orm';
import { AnnouncementManager } from './AnnouncementManager';

export default async function AdminAnnouncementsPage() {
    let allAnnouncements: any[] = [];
    try {
        allAnnouncements = await db.query.systemAnnouncements.findMany({
            orderBy: desc(systemAnnouncements.createdAt),
        });
    } catch {
        // Table might not exist yet
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-black tracking-tight">ประกาศระบบ</h1>
                <p className="text-gray-500 text-sm mt-1">สร้างประกาศที่จะแสดงบน Dashboard ของทุกแก๊ง — แจ้งปิดซ่อม, อัปเดต, ข้อมูลสำคัญ</p>
            </div>

            <AnnouncementManager initialAnnouncements={JSON.parse(JSON.stringify(allAnnouncements))} />
        </div>
    );
}
