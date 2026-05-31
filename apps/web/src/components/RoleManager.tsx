'use client';

import { useMemo, useState } from 'react';
import {
    AlertTriangle,
    BadgeCheck,
    Check,
    ClipboardCheck,
    Coins,
    Crown,
    Loader2,
    Save,
    ShieldCheck,
    User,
} from 'lucide-react';
import { updateGangRoleNames, updateGangVerifiedRole } from '@/app/actions/settings';
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
        helper: 'ยศสำหรับแสดงหัวหน้าแก๊งบน Discord ส่วนสิทธิ์สูงสุดยึดจากเจ้าของเซิร์ฟเวอร์',
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
    const [savingPermission, setSavingPermission] = useState<string | null>(null);
    const [savingVerified, setSavingVerified] = useState(false);

    const sortedRoles = useMemo(
        () => [...discordRoles].sort((a, b) => b.position - a.position || a.name.localeCompare(b.name)),
        [discordRoles]
    );
    const roleById = useMemo(() => new Map(discordRoles.map((role) => [role.id, role])), [discordRoles]);
    const mappingByPermission = useMemo(
        () => new Map(initialMappings.map((mapping) => [mapping.permissionLevel, mapping.discordRoleId])),
        [initialMappings]
    );
    const systemRoleIds = useMemo(
        () => new Set(SYSTEM_ROLES.map((role) => mappingByPermission.get(role.key)).filter(Boolean)),
        [mappingByPermission]
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

    const verifiedRoleId = mappingByPermission.get('VERIFIED') || '';
    const [verifiedRoleValue, setVerifiedRoleValue] = useState(verifiedRoleId);

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

    const handleSaveRole = async (permission: SystemRolePermission) => {
        const row = roleRows.find((item) => item.key === permission);
        const name = roleNames[permission]?.trim() || '';
        const duplicate = duplicateNameSet.has(name.toLocaleLowerCase('th-TH'));

        if (!row?.canRename) {
            toast.error('ยังแก้ชื่อยศนี้ไม่ได้', {
                description: 'ถ้ายศหายหรือบอทยังแก้ไม่ได้ ให้ซ่อมจาก Discord ก่อน',
            });
            return;
        }

        if (!name || name.length > 100 || name === '@everyone') {
            toast.error('ชื่อยศยังไม่ถูกต้อง', {
                description: 'ชื่อยศต้องมี 1-100 ตัวอักษร และห้ามใช้ @everyone',
            });
            return;
        }

        if (duplicate) {
            toast.error('ชื่อยศซ้ำกัน', {
                description: 'ชื่อยศแต่ละอันควรไม่ซ้ำ เพื่อให้ทีมดูแลงานได้ชัดเจน',
            });
            return;
        }

        if (name === row.discordRole?.name) {
            toast.info('ชื่อยศนี้ยังไม่เปลี่ยน');
            return;
        }

        setSavingPermission(permission);
        try {
            const result = await updateGangRoleNames(gangId, [{ permission, name }]);
            if (result.success) {
                toast.success('บันทึกชื่อยศแล้ว', { description: row.label });
                router.refresh();
            } else {
                toast.error('บันทึกชื่อยศไม่สำเร็จ', {
                    description: result.error || 'กรุณาตรวจสิทธิ์บอทและลองใหม่อีกครั้ง',
                });
            }
        } catch (error) {
            console.error(error);
            toast.error('เกิดข้อผิดพลาด', { description: 'กรุณาลองใหม่อีกครั้ง' });
        } finally {
            setSavingPermission(null);
        }
    };

    const handleSaveVerifiedRole = async () => {
        setSavingVerified(true);
        try {
            const result = await updateGangVerifiedRole(gangId, verifiedRoleValue || null);
            if (result.success) {
                toast.success('บันทึกยศคนทั่วไปแล้ว');
                router.refresh();
            } else {
                toast.error('บันทึกยศคนทั่วไปไม่สำเร็จ', {
                    description: result.error || 'กรุณาเลือกยศที่ไม่ซ้ำกับยศแก๊งหลัก',
                });
            }
        } catch (error) {
            console.error(error);
            toast.error('เกิดข้อผิดพลาด', { description: 'กรุณาลองใหม่อีกครั้ง' });
        } finally {
            setSavingVerified(false);
        }
    };

    const hasMissingSystemRole = roleRows.some((row) => !row.discordRole || row.isEveryone);

    return (
        <div className="space-y-4">
            <div className="rounded-token-xl border border-border-subtle bg-bg-muted/65 p-4">
                <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-token-lg border border-border-accent bg-accent-subtle text-accent-bright">
                        <BadgeCheck className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                        <p className="text-sm font-black text-fg-primary">เว็บใช้แก้ชื่อยศ ส่วนการสร้าง/ซ่อมให้ทำจาก Discord</p>
                        <p className="mt-1 text-xs leading-5 text-fg-secondary">
                            ยศหลักแต่ละแถวบันทึกแยกกัน เพื่อลดความเสี่ยงจากการแก้หลายยศพร้อมกัน ส่วนยศคนทั่วไป/ผู้เยี่ยมชมเลือกจากรายการ Discord ได้ด้านล่าง
                        </p>
                    </div>
                </div>
            </div>

            {hasMissingSystemRole ? (
                <div className="rounded-token-xl border border-status-warning bg-status-warning-subtle p-3">
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-fg-warning" />
                        <p className="text-xs font-bold leading-5 text-fg-warning">
                            มียศที่บอทยังจัดการไม่ได้ ให้ซ่อมจาก Discord ก่อนเปลี่ยนชื่อ
                        </p>
                    </div>
                </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3">
                {roleRows.map((row) => {
                    const Icon = row.icon;
                    const inputName = roleNames[row.key] || '';
                    const duplicate = inputName && duplicateNameSet.has(inputName.trim().toLocaleLowerCase('th-TH'));
                    const invalid = inputName.trim().length === 0 || inputName.trim().length > 100 || inputName.trim() === '@everyone';
                    const changed = inputName.trim() !== (row.discordRole?.name || '');
                    const saving = savingPermission === row.key;

                    return (
                        <section key={row.key} className="rounded-token-xl border border-border-subtle bg-bg-subtle p-4">
                            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.7fr)_minmax(260px,0.9fr)_auto] lg:items-center">
                                <div className="flex min-w-0 items-start gap-3">
                                    <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-token-lg border border-border-subtle', row.bg, row.accent)}>
                                        <Icon className="h-5 w-5" />
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

                                <div className="min-w-0 rounded-token-lg border border-border-subtle bg-bg-muted px-3 py-2">
                                    <p className="text-[10px] font-black uppercase tracking-wide text-fg-tertiary">Discord role</p>
                                    <div className="mt-1 flex items-center justify-between gap-2">
                                        <span className="min-w-0 truncate text-sm font-bold text-fg-primary">
                                            {row.discordRole?.name || 'ไม่พบยศที่ผูกไว้'}
                                        </span>
                                        <span className={cn(
                                            'shrink-0 rounded-token-full border px-2 py-0.5 text-[10px] font-black',
                                            row.canRename ? 'border-status-success text-fg-success' : 'border-status-warning text-fg-warning'
                                        )}>
                                            {row.canRename ? 'พร้อม' : row.isEveryone ? 'ผิดยศ' : 'ซ่อมก่อน'}
                                        </span>
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-1 block text-[11px] font-black text-fg-tertiary">ชื่อยศใหม่</label>
                                    <input
                                        value={inputName}
                                        onChange={(event) => setRoleNames((prev) => ({ ...prev, [row.key]: event.target.value }))}
                                        disabled={!row.canRename || saving}
                                        maxLength={100}
                                        className={cn(
                                            'min-h-11 w-full rounded-token-lg border bg-bg-base px-3 py-2 text-sm font-bold text-fg-primary outline-none transition-colors placeholder:text-fg-tertiary disabled:cursor-not-allowed disabled:bg-bg-muted disabled:text-fg-tertiary',
                                            invalid || duplicate ? 'border-status-danger focus:border-status-danger' : 'border-border-subtle focus:border-border-strong'
                                        )}
                                        placeholder={row.discordRole ? row.discordRole.name : 'ซ่อมยศด้วย /setup ก่อน'}
                                    />
                                    {duplicate ? <p className="mt-1 text-xs font-bold text-fg-danger">ชื่อนี้ซ้ำกับยศระบบอื่น</p> : null}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => handleSaveRole(row.key)}
                                    disabled={saving || !row.canRename || !changed || invalid || Boolean(duplicate)}
                                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-token-lg bg-accent px-4 py-2 text-sm font-black text-accent-fg shadow-token-sm transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
                                >
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    บันทึก
                                </button>
                            </div>
                        </section>
                    );
                })}
            </div>

            <section className="rounded-token-xl border border-border-subtle bg-bg-subtle p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-token-lg border border-border-subtle bg-bg-muted text-fg-success">
                            <Check className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                            <h4 className="text-sm font-black text-fg-primary">ยศคนทั่วไป / ผู้เยี่ยมชม</h4>
                            <p className="mt-1 text-xs leading-5 text-fg-tertiary">
                                ใช้สำหรับคนนอกหรือผู้เล่นทั่วไปที่ยังไม่ใช่สมาชิกแก๊งจริง เช่น ยศประชาชน, Visitor หรือยศที่ได้หลังพิมพ์จุด
                            </p>
                        </div>
                    </div>

                    <div className="grid w-full gap-2 sm:grid-cols-[minmax(0,1fr)_auto] lg:max-w-xl">
                        <select
                            value={verifiedRoleValue}
                            onChange={(event) => setVerifiedRoleValue(event.target.value)}
                            disabled={savingVerified}
                            className="min-h-11 rounded-token-lg border border-border-subtle bg-bg-base px-3 py-2 text-sm font-bold text-fg-primary outline-none focus:border-border-strong disabled:opacity-60"
                        >
                            <option value="">ไม่ตั้งค่ายศคนทั่วไป</option>
                            {sortedRoles.map((role) => {
                                const isEveryone = role.id === guildId || role.name === '@everyone';
                                const usedBySystemRole = systemRoleIds.has(role.id);
                                const disabled = isEveryone || role.managed || usedBySystemRole;

                                return (
                                    <option key={role.id} value={role.id} disabled={disabled}>
                                        {role.name}{disabled ? ' (ใช้ไม่ได้)' : ''}
                                    </option>
                                );
                            })}
                        </select>
                        <button
                            type="button"
                            onClick={handleSaveVerifiedRole}
                            disabled={savingVerified || verifiedRoleValue === verifiedRoleId}
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-token-lg border border-border-accent bg-accent-subtle px-4 py-2 text-sm font-black text-accent-bright transition-colors hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {savingVerified ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            บันทึก
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
}
