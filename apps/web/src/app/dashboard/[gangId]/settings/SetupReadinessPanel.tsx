import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Hash, RefreshCw, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type GangSettingsSnapshot = {
    logChannelId?: string | null;
    registerChannelId?: string | null;
    attendanceChannelId?: string | null;
    financeChannelId?: string | null;
    announcementChannelId?: string | null;
    leaveChannelId?: string | null;
    requestsChannelId?: string | null;
};

type RoleMappingSnapshot = {
    permissionLevel: string;
    discordRoleId: string;
};

interface Props {
    gangId: string;
    roles: RoleMappingSnapshot[];
    settings?: GangSettingsSnapshot | null;
}

const SYSTEM_ROLES = [
    { key: 'OWNER', label: 'หัวหน้าแก๊ง' },
    { key: 'ADMIN', label: 'แอดมินแก๊ง' },
    { key: 'TREASURER', label: 'เหรัญญิก' },
    { key: 'ATTENDANCE_OFFICER', label: 'เจ้าหน้าที่เช็คชื่อ' },
    { key: 'MEMBER', label: 'สมาชิก' },
] as const;

const CORE_CHANNELS = [
    { key: 'registerChannelId', label: 'ลงทะเบียน' },
    { key: 'requestsChannelId', label: 'คำขอ / อนุมัติ' },
    { key: 'attendanceChannelId', label: 'เช็คชื่อ' },
    { key: 'logChannelId', label: 'บันทึกระบบ' },
] as const;

const OPTIONAL_CHANNELS = [
    { key: 'financeChannelId', label: 'การเงิน' },
    { key: 'announcementChannelId', label: 'ประกาศ' },
    { key: 'leaveChannelId', label: 'แจ้งลา' },
] as const;

export function SetupReadinessPanel({ gangId, roles, settings }: Props) {
    const roleKeys = new Set(roles.map((role) => role.permissionLevel));
    const mappedSystemRoles = SYSTEM_ROLES.filter((role) => roleKeys.has(role.key));
    const missingSystemRoles = SYSTEM_ROLES.filter((role) => !roleKeys.has(role.key));
    const verifiedReady = roleKeys.has('VERIFIED');
    const coreChannelsReady = CORE_CHANNELS.filter((channel) => Boolean(settings?.[channel.key]));
    const optionalChannelsReady = OPTIONAL_CHANNELS.filter((channel) => Boolean(settings?.[channel.key]));
    const roleReady = missingSystemRoles.length === 0;
    const channelReady = coreChannelsReady.length === CORE_CHANNELS.length;
    const overallReady = roleReady && channelReady && verifiedReady;

    return (
        <section className="rounded-token-xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <div className="mb-2 inline-flex items-center gap-2 rounded-token-full border border-border-accent bg-accent-subtle px-3 py-1 text-[10px] font-black uppercase tracking-wide text-accent-bright">
                        Discord Setup Status
                    </div>
                    <h3 className="text-base font-black text-fg-primary">ความพร้อมของระบบ Discord</h3>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-fg-secondary">
                        เว็บใช้ตรวจและปรับค่าที่ปลอดภัย ส่วนการสร้างหรือซ่อมยศ/ห้องให้ใช้คำสั่ง /setup ใน Discord เพื่อให้ bot เป็น source of truth เดียว
                    </p>
                </div>
                <Link
                    href={`/dashboard/${gangId}/settings/advanced`}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-token-lg border border-border-subtle bg-bg-muted px-3 py-2 text-xs font-black text-fg-primary transition-colors hover:bg-bg-elevated"
                >
                    <RefreshCw className="h-4 w-4" />
                    งานซ่อม/ขั้นสูง
                </Link>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
                <StatusCard
                    icon={ShieldCheck}
                    title="ยศระบบ"
                    ready={roleReady && verifiedReady}
                    count={`${mappedSystemRoles.length}/${SYSTEM_ROLES.length}`}
                    description={roleReady ? 'ยศหลักครบแล้ว เปลี่ยนชื่อได้จากหน้านี้' : `ขาด ${missingSystemRoles.map((role) => role.label).join(', ')}`}
                    footer={verifiedReady ? 'มียศยืนยันตัวตนแล้ว' : 'ยังไม่พบยศยืนยันตัวตน ให้ตั้งผ่าน /setup'}
                />
                <StatusCard
                    icon={Hash}
                    title="ช่องหลัก"
                    ready={channelReady}
                    count={`${coreChannelsReady.length}/${CORE_CHANNELS.length}`}
                    description={channelReady ? 'ช่องหลักพร้อมใช้งาน' : `ยังขาด ${CORE_CHANNELS.filter((channel) => !settings?.[channel.key]).map((channel) => channel.label).join(', ')}`}
                    footer={`ช่องเสริมตั้งแล้ว ${optionalChannelsReady.length}/${OPTIONAL_CHANNELS.length}`}
                />
                <StatusCard
                    icon={overallReady ? CheckCircle2 : AlertTriangle}
                    title="ขั้นตอนต่อไป"
                    ready={overallReady}
                    count={overallReady ? 'พร้อม' : 'ต้องตรวจ'}
                    description={overallReady ? 'พร้อมใช้งานสำหรับ flow หลักแล้ว' : 'ถ้าระบบยังส่งผิดห้องหรือยศหาย ให้ใช้ /setup repair ใน Discord'}
                    footer="Owner เท่านั้นที่แก้ Settings ได้"
                />
            </div>
        </section>
    );
}

function StatusCard({
    icon: Icon,
    title,
    ready,
    count,
    description,
    footer,
}: {
    icon: LucideIcon;
    title: string;
    ready: boolean;
    count: string;
    description: string;
    footer: string;
}) {
    return (
        <article className="rounded-token-xl border border-border-subtle bg-bg-muted p-4">
            <div className="flex items-start justify-between gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-token-lg border ${ready ? 'border-status-success bg-status-success-subtle text-fg-success' : 'border-status-warning bg-status-warning-subtle text-fg-warning'}`}>
                    <Icon className="h-5 w-5" />
                </span>
                <span className={`rounded-token-full border px-2 py-1 text-[10px] font-black ${ready ? 'border-status-success text-fg-success' : 'border-status-warning text-fg-warning'}`}>
                    {count}
                </span>
            </div>
            <h4 className="mt-3 text-sm font-black text-fg-primary">{title}</h4>
            <p className="mt-1 min-h-10 text-xs leading-5 text-fg-secondary">{description}</p>
            <p className="mt-3 border-t border-border-subtle pt-3 text-[11px] font-bold text-fg-tertiary">{footer}</p>
        </article>
    );
}
