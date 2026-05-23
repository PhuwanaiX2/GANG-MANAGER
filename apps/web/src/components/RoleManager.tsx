'use client';

import { useMemo, useState } from 'react';
import {
    AlertTriangle,
    BadgeCheck,
    CheckCircle2,
    ClipboardCheck,
    Coins,
    Crown,
    RefreshCw,
    Save,
    ShieldCheck,
    User,
} from 'lucide-react';
import { updateGangRoleNames } from '@/app/actions/settings';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';

interface Role {
    id: string;
    name: string;
    color: number;
    position: number;
    managed: boolean;
}

interface Props {
    gangId: string;
    guildId: string;
    initialMappings: Array<{ permissionLevel: string; discordRoleId: string }>;
    discordRoles: Role[];
}

const SYSTEM_ROLES = [
    {
        key: 'OWNER',
        label: 'หัวหน้าแก๊ง',
        helper: 'ยศแสดงตัวตนของเจ้าของระบบ ส่วนสิทธิ์ Owner ยึดจากเจ้าของเซิร์ฟเวอร์ Discord',
        icon: Crown,
        accent: 'text-fg-warning',
        bg: 'bg-status-warning-subtle',
    },
    {
        key: 'ADMIN',
        label: 'แอดมินแก๊ง',
        helper: 'ดูแลสมาชิก ประกาศ และงานจัดการทั่วไป',
        icon: ShieldCheck,
        accent: 'text-fg-danger',
        bg: 'bg-status-danger-subtle',
    },
    {
        key: 'TREASURER',
        label: 'เหรัญญิก',
        helper: 'จัดการรายการเงินและตรวจคำขอการเงิน',
        icon: Coins,
        accent: 'text-fg-success',
        bg: 'bg-status-success-subtle',
    },
    {
        key: 'ATTENDANCE_OFFICER',
        label: 'เจ้าหน้าที่เช็คชื่อ',
        helper: 'เปิดรอบ ปิดรอบ และดูแลสถานะเช็คชื่อ',
        icon: ClipboardCheck,
        accent: 'text-fg-info',
        bg: 'bg-status-info-subtle',
    },
    {
        key: 'MEMBER',
        label: 'สมาชิก',
        helper: 'สิทธิ์พื้นฐานของสมาชิกที่ผ่านอนุมัติแล้ว',
        icon: User,
        accent: 'text-accent-bright',
        bg: 'bg-accent-subtle',
    },
] as const;

type SystemRolePermission = (typeof SYSTEM_ROLES)[number]['key'];

export function RoleManager({ gangId, guildId, initialMappings, discordRoles }: Props) {
    const router = useRouter();
    const [saving, setSaving] = useState(false);

    const roleById = useMemo(() => new Map(discordRoles.map((role) => [role.id, role])), [discordRoles]);
    const mappingByPermission = useMemo(
        () => new Map(initialMappings.map((mapping) => [mapping.permissionLevel, mapping.discordRoleId])),
        [initialMappings]
    );

    const roleRows = useMemo(() => {
        return SYSTEM_ROLES.map((definition) => {
            const discordRoleId = mappingByPermission.get(definition.key) || null;
            const discordRole = discordRoleId ? roleById.get(discordRoleId) || null : null;
            const isEveryone = discordRoleId === guildId || discordRole?.name === '@everyone';

            return {
                ...definition,
                discordRoleId,
                discordRole,
                isEveryone,
                canRename: Boolean(discordRole && !discordRole.managed && !isEveryone),
            };
        });
    }, [guildId, mappingByPermission, roleById]);

    const verifiedRoleId = mappingByPermission.get('VERIFIED') || null;
    const verifiedRole = verifiedRoleId ? roleById.get(verifiedRoleId) || null : null;

    const [roleNames, setRoleNames] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        for (const definition of SYSTEM_ROLES) {
            const roleId = initialMappings.find((mapping) => mapping.permissionLevel === definition.key)?.discordRoleId;
            const role = roleId ? discordRoles.find((discordRole) => discordRole.id === roleId) : null;
            initial[definition.key] = role?.name || '';
        }
        return initial;
    });

    const normalizedNames = roleRows
        .filter((row) => row.canRename)
        .map((row) => ({
            permission: row.key,
            name: roleNames[row.key]?.trim() || '',
            currentName: row.discordRole?.name || '',
        }));
    const duplicateNameSet = new Set<string>();
    const seenNames = new Map<string, string>();
    for (const row of normalizedNames) {
        if (!row.name) continue;
        const normalized = row.name.toLocaleLowerCase('th-TH');
        const seen = seenNames.get(normalized);
        if (seen && seen !== row.permission) duplicateNameSet.add(normalized);
        seenNames.set(normalized, row.permission);
    }

    const changedUpdates = normalizedNames
        .filter((row) => row.name && row.name !== row.currentName)
        .map((row) => ({ permission: row.permission as SystemRolePermission, name: row.name }));
    const hasDuplicateNames = duplicateNameSet.size > 0;
    const hasInvalidName = normalizedNames.some((row) => row.name.length === 0 || row.name.length > 100 || row.name === '@everyone');
    const hasMissingSystemRole = roleRows.some((row) => !row.discordRole || row.isEveryone);

    const handleSave = async () => {
        if (hasInvalidName) {
            toast.error('ชื่อยศยังไม่ถูกต้อง', {
                description: 'ชื่อยศต้องมี 1-100 ตัวอักษร และห้ามใช้ @everyone',
            });
            return;
        }

        if (hasDuplicateNames) {
            toast.error('ชื่อยศซ้ำกัน', {
                description: 'ชื่อยศระบบแต่ละอันควรไม่ซ้ำ เพื่อให้ทีมดูแลไม่สับสน',
            });
            return;
        }

        if (changedUpdates.length === 0) {
            toast.info('ยังไม่มีชื่อยศที่เปลี่ยน');
            return;
        }

        setSaving(true);
        try {
            const result = await updateGangRoleNames(gangId, changedUpdates);
            if (result.success) {
                toast.success('เปลี่ยนชื่อยศบน Discord แล้ว', {
                    description: `อัปเดต ${result.updatedCount ?? changedUpdates.length} ยศ`,
                });
                router.refresh();
            } else {
                toast.error('เปลี่ยนชื่อยศไม่สำเร็จ', {
                    description: result.error || 'กรุณาตรวจสิทธิ์บอทและลองใหม่อีกครั้ง',
                });
            }
        } catch (error) {
            console.error(error);
            toast.error('เกิดข้อผิดพลาด', {
                description: 'กรุณาลองใหม่อีกครั้ง',
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="rounded-token-xl border border-border-subtle bg-bg-muted/65 p-4">
                <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-token-lg border border-border-accent bg-accent-subtle text-accent-bright">
                        <BadgeCheck className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                        <p className="text-sm font-black text-fg-primary">Discord-native role mode</p>
                        <p className="mt-1 text-xs leading-5 text-fg-secondary">
                            เว็บใช้แก้ชื่อยศระบบที่บอทสร้าง/ซ่อมไว้แล้วเท่านั้น การสร้างหรือซ่อม mapping ให้ทำผ่านคำสั่ง /setup บน Discord เพื่อกันสิทธิ์หลุด
                        </p>
                    </div>
                </div>
            </div>

            {hasMissingSystemRole ? (
                <div className="rounded-token-xl border border-status-warning bg-status-warning-subtle p-3">
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-fg-warning" />
                        <p className="text-xs font-bold leading-5 text-fg-warning">
                            มียศระบบที่หายหรือผูกผิด ให้ใช้ /setup repair ใน Discord ก่อนเปลี่ยนชื่อ
                        </p>
                    </div>
                </div>
            ) : null}

            <div className="overflow-hidden rounded-token-xl border border-border-subtle bg-bg-subtle">
                <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(180px,0.8fr)_minmax(220px,1fr)] gap-3 border-b border-border-subtle bg-bg-muted px-4 py-3 text-[11px] font-black uppercase tracking-wide text-fg-tertiary max-md:hidden">
                    <span>สิทธิ์ในระบบ</span>
                    <span>ยศ Discord ตอนนี้</span>
                    <span>ชื่อยศใหม่</span>
                </div>

                <div className="divide-y divide-border-subtle">
                    {roleRows.map((row) => {
                        const Icon = row.icon;
                        const inputName = roleNames[row.key] || '';
                        const duplicate = inputName && duplicateNameSet.has(inputName.trim().toLocaleLowerCase('th-TH'));
                        const invalid = inputName.trim().length === 0 || inputName.trim().length > 100 || inputName.trim() === '@everyone';

                        return (
                            <section
                                key={row.key}
                                className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1.1fr)_minmax(180px,0.8fr)_minmax(220px,1fr)] md:items-center"
                            >
                                <div className="flex min-w-0 items-start gap-3">
                                    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-token-lg border border-border-subtle', row.bg, row.accent)}>
                                        <Icon className="h-4 w-4" />
                                    </span>
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-black text-fg-primary">{row.label}</span>
                                            <span className="rounded-token-full border border-border-subtle bg-bg-muted px-2 py-0.5 text-[10px] font-black text-fg-tertiary">
                                                {row.key}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-xs leading-5 text-fg-tertiary">{row.helper}</p>
                                    </div>
                                </div>

                                <div className="min-w-0">
                                    <p className="mb-1 text-[11px] font-black text-fg-tertiary md:hidden">ยศ Discord ตอนนี้</p>
                                    {row.discordRole ? (
                                        <div className="flex min-h-11 items-center justify-between gap-3 rounded-token-lg border border-border-subtle bg-bg-muted px-3 py-2">
                                            <span className="min-w-0 truncate text-sm font-bold text-fg-primary">{row.discordRole.name}</span>
                                            <span className={cn(
                                                'shrink-0 rounded-token-full border px-2 py-0.5 text-[10px] font-black',
                                                row.canRename
                                                    ? 'border-status-success text-fg-success'
                                                    : 'border-status-warning text-fg-warning'
                                            )}>
                                                {row.canRename ? 'พร้อม' : row.isEveryone ? 'ผิดยศ' : 'จัดการไม่ได้'}
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="flex min-h-11 items-center rounded-token-lg border border-status-warning bg-status-warning-subtle px-3 py-2 text-xs font-bold text-fg-warning">
                                            ไม่พบยศที่ผูกไว้
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="mb-1 block text-[11px] font-black text-fg-tertiary md:hidden">ชื่อยศใหม่</label>
                                    <input
                                        value={inputName}
                                        onChange={(event) => setRoleNames((prev) => ({ ...prev, [row.key]: event.target.value }))}
                                        disabled={!row.canRename || saving}
                                        maxLength={100}
                                        className={cn(
                                            'min-h-11 w-full rounded-token-lg border bg-bg-base px-3 py-2 text-sm font-bold text-fg-primary outline-none transition-colors placeholder:text-fg-tertiary disabled:cursor-not-allowed disabled:bg-bg-muted disabled:text-fg-tertiary',
                                            invalid || duplicate
                                                ? 'border-status-danger focus:border-status-danger'
                                                : 'border-border-subtle focus:border-border-strong'
                                        )}
                                        placeholder={row.discordRole ? row.discordRole.name : 'ซ่อมยศด้วย /setup ก่อน'}
                                    />
                                    {duplicate ? (
                                        <p className="mt-1 text-xs font-bold text-fg-danger">ชื่อนี้ซ้ำกับยศระบบอื่น</p>
                                    ) : null}
                                </div>
                            </section>
                        );
                    })}
                </div>
            </div>

            <div className="flex flex-col gap-3 rounded-token-xl border border-border-subtle bg-bg-muted/55 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-token-lg border border-border-subtle bg-bg-subtle text-fg-tertiary">
                        <CheckCircle2 className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                        <p className="text-xs font-black text-fg-secondary">ยศยืนยันตัวตน</p>
                        <p className="truncate text-sm font-bold text-fg-primary">
                            {verifiedRole ? verifiedRole.name : verifiedRoleId ? 'ไม่พบยศที่ผูกไว้' : 'ยังไม่ได้ตั้งค่า'}
                        </p>
                    </div>
                </div>
                <p className="text-xs font-semibold text-fg-tertiary">แก้ผ่าน /setup ใน Discord</p>
            </div>

            <div className="flex justify-end pt-1">
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || changedUpdates.length === 0 || hasDuplicateNames || hasInvalidName}
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-token-lg bg-accent px-5 py-2 text-sm font-black text-accent-fg shadow-token-sm transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                    {saving ? (
                        <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            กำลังบันทึก
                        </>
                    ) : (
                        <>
                            <Save className="h-4 w-4" />
                            บันทึกชื่อยศ
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
