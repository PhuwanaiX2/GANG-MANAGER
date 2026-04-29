export const dynamic = 'force-dynamic';

import { db, licenses } from '@gang/database';
import { desc } from 'drizzle-orm';
import { LicenseManager } from '../AdminClient';
import Link from 'next/link';

export default async function AdminLicensesPage({
    searchParams,
}: {
    searchParams?: Promise<{
        search?: string;
        status?: string;
    }>;
}) {
    const resolvedSearchParams = await searchParams;
    const allLicenses = await db.query.licenses.findMany({ orderBy: desc(licenses.createdAt) });
    const initialSearch = typeof resolvedSearchParams?.search === 'string' ? resolvedSearchParams.search : '';
    const initialStatusFilter = ['all', 'active', 'inactive'].includes(resolvedSearchParams?.status || '')
        ? (resolvedSearchParams!.status! as 'all' | 'active' | 'inactive')
        : 'all';
    const activeCount = allLicenses.filter((license) => license.isActive).length;
    const inactiveCount = allLicenses.filter((license) => !license.isActive).length;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-black tracking-tight">License Keys</h1>
                <p className="text-fg-tertiary text-sm mt-1">สร้าง/จัดการ License Key สำหรับเปิดใช้งานแพลน และช่วยกู้เคสลูกค้าที่ต้องใช้คีย์</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Link href="/admin/licenses?status=active" className="inline-flex items-center gap-2 rounded-token-full border border-status-success bg-status-success-subtle px-3 py-1 text-[10px] font-bold text-fg-success hover:brightness-110">
                        พร้อมใช้
                        <span className="rounded-token-full bg-bg-muted px-1.5 py-0.5 text-[9px] tabular-nums">{activeCount}</span>
                    </Link>
                    <Link href="/admin/licenses?status=inactive" className="inline-flex items-center gap-2 rounded-token-full border border-border-subtle bg-bg-muted px-3 py-1 text-[10px] font-bold text-fg-secondary hover:brightness-110">
                        ใช้แล้ว/ปิดแล้ว
                        <span className="rounded-token-full bg-bg-muted px-1.5 py-0.5 text-[9px] tabular-nums">{inactiveCount}</span>
                    </Link>
                </div>
            </div>

            <LicenseManager
                initialLicenses={JSON.parse(JSON.stringify(allLicenses))}
                initialSearch={initialSearch}
                initialStatusFilter={initialStatusFilter}
            />
        </div>
    );
}
