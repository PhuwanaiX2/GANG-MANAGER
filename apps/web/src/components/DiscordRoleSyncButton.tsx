'use client';

import { useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

type SyncResponse = {
    success?: boolean;
    checkedMembers?: number;
    checkedRoles?: number;
    operations?: number;
    failed?: number;
    error?: string;
};

export function DiscordRoleSyncButton({ gangId }: { gangId: string }) {
    const [isSyncing, setIsSyncing] = useState(false);

    const syncRoles = async () => {
        setIsSyncing(true);
        try {
            const response = await fetch(`/api/gangs/${gangId}/members/sync-discord-roles`, {
                method: 'POST',
            });
            const data = await response.json().catch(() => ({} as SyncResponse));

            if (!response.ok) {
                toast.error(data.error || 'ซิงก์ยศ Discord ไม่สำเร็จ');
                return;
            }

            if (data.failed && data.failed > 0) {
                toast.warning(`ซิงก์เสร็จบางส่วน ยังมี ${data.failed} รายการที่ Discord ปฏิเสธ`, {
                    description: 'ตรวจลำดับยศบอทและสิทธิ์ Manage Roles แล้วลองอีกครั้ง',
                });
                return;
            }

            toast.success('ซิงก์ยศ Discord สำเร็จ', {
                description: `ตรวจสมาชิก ${data.checkedMembers ?? 0} คน จากยศระบบ ${data.checkedRoles ?? 0} รายการ`,
            });
        } catch {
            toast.error('เชื่อมต่อระบบซิงก์ยศไม่สำเร็จ');
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <button
            type="button"
            onClick={syncRoles}
            disabled={isSyncing}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-token-lg border border-border-subtle bg-bg-base px-4 py-2 text-sm font-black text-fg-primary shadow-token-xs transition hover:border-border-accent hover:bg-accent-subtle hover:text-accent-bright disabled:cursor-not-allowed disabled:opacity-60"
        >
            {isSyncing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {isSyncing ? 'กำลังซิงก์ยศ...' : 'ซิงก์ยศ Discord'}
        </button>
    );
}
