'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
    Check,
    Edit,
    Loader2,
    Trash2,
    UserMinus,
    UserPlus,
    User,
    Users,
    Wallet,
    Circle,
    MoreHorizontal,
    Shield,
    UserCog,
    ChevronLeft,
    ChevronRight,
    Search,
    FileText,
    ShieldAlert,
    X
} from 'lucide-react';
import { Avatar, Button, InfoTip } from '@/components/ui';
import { DiscordLogo } from '@/components/icons/DiscordLogo';
import { cn } from '@/lib/cn';

const CreateMemberModal = dynamic(() => import('./modals/CreateMemberModal').then((mod) => mod.CreateMemberModal), { ssr: false });
const EditMemberModal = dynamic(() => import('./modals/EditMemberModal').then((mod) => mod.EditMemberModal), { ssr: false });
const ConfirmModal = dynamic(() => import('./modals/ConfirmModal').then((mod) => mod.ConfirmModal), { ssr: false });
const MemberRoleModal = dynamic(() => import('./modals/MemberRoleModal').then((mod) => mod.MemberRoleModal), { ssr: false });

interface Member {
    id: string;
    name: string;
    discordId: string | null;
    discordUsername: string | null;
    discordAvatar: string | null;
    balance: number;
    loanDebt?: number;
    collectionDue?: number;
    isActive: boolean;
    status: string;
    gangId: string;
    gangRole?: string;
}

interface Props {
    members: Member[];
    gangId: string;
    canManageMembers: boolean;
    canAssignRoles: boolean;
}

export function MembersTable({ members, gangId, canManageMembers, canAssignRoles }: Props) {
    const router = useRouter();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingMember, setEditingMember] = useState<Member | null>(null);
    const [kickTarget, setKickTarget] = useState<Member | null>(null);
    const [roleTarget, setRoleTarget] = useState<Member | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [processingStatusId, setProcessingStatusId] = useState<string | null>(null);
    const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });

    // Search & Filter
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('ALL');
    const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'PENDING' | 'INACTIVE'>('ACTIVE');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    const roleRank: Record<string, number> = {
        OWNER: 0,
        ADMIN: 1,
        TREASURER: 2,
        ATTENDANCE_OFFICER: 3,
        MEMBER: 4,
    };

    const statusRank = (member: Member) => {
        if (member.status === 'PENDING') return 0;
        if (member.isActive && member.status === 'APPROVED') return 1;
        return 2;
    };

    const orderedMembers = [...members].sort((a, b) => {
        const statusDiff = statusRank(a) - statusRank(b);
        if (statusDiff !== 0) return statusDiff;
        const roleDiff = (roleRank[a.gangRole || 'MEMBER'] ?? 9) - (roleRank[b.gangRole || 'MEMBER'] ?? 9);
        if (roleDiff !== 0) return roleDiff;
        return a.name.localeCompare(b.name, 'th');
    });

    const filteredMembers = orderedMembers.filter(m => {
        const normalizedSearch = search.toLowerCase();
        const matchSearch = !search
            || m.name.toLowerCase().includes(normalizedSearch)
            || (m.discordUsername || '').toLowerCase().includes(normalizedSearch)
            || (m.discordId || '').includes(normalizedSearch);
        const matchRole = roleFilter === 'ALL' || m.gangRole === roleFilter;
        const matchStatus = statusFilter === 'ACTIVE'
            ? m.isActive && m.status === 'APPROVED'
            : statusFilter === 'PENDING'
                ? m.status === 'PENDING'
                : !m.isActive || m.status === 'REJECTED';
        return matchSearch && matchRole && matchStatus;
    });

    const totalPages = Math.ceil(filteredMembers.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedMembers = filteredMembers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    const roleNames: Record<string, string> = {
        OWNER: 'หัวหน้า',
        ADMIN: 'รองหัวหน้า',
        TREASURER: 'เหรัญญิก',
        ATTENDANCE_OFFICER: 'เช็คชื่อ',
        MEMBER: 'สมาชิก',
    };

    const handleConfirmKick = async () => {
        if (!kickTarget) return;

        setIsDeleting(true);
        try {
            const res = await fetch(`/api/gangs/${gangId}/members/${kickTarget.id}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('ลบสมาชิกไม่สำเร็จ');

            toast.success('ไล่ออกสมาชิกเรียบร้อยแล้ว');
            setKickTarget(null);
            router.refresh();
        } catch (error) {
            console.error(error);
            toast.error('เกิดข้อผิดพลาด ไม่สามารถไล่ออกได้');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleStatusUpdate = async (member: Member, status: 'APPROVED' | 'REJECTED') => {
        setProcessingStatusId(member.id);
        try {
            const res = await fetch(`/api/gangs/${gangId}/members/${member.id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            });
            if (!res.ok) throw new Error('อัปเดตสถานะสมาชิกไม่สำเร็จ');

            toast.success(status === 'APPROVED' ? `อนุมัติ ${member.name} แล้ว` : `ปฏิเสธ ${member.name} แล้ว`);
            router.refresh();
        } catch (error) {
            console.error(error);
            toast.error('เกิดข้อผิดพลาด ไม่สามารถอัปเดตสถานะสมาชิกได้');
        } finally {
            setProcessingStatusId(null);
        }
    };

    return (
        <div className="space-y-3">
            {/* Toolbar */}
            <div className="friendly-panel flex flex-col gap-2 p-2.5 sm:p-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="w-full lg:max-w-sm">
                    <div className="hidden items-center justify-between gap-3 sm:mb-2 sm:flex">
                        <div>
                            <div className="flex items-center gap-2">
                                <p className="text-xs font-bold text-fg-secondary">ค้นสมาชิก</p>
                                <InfoTip
                                    label="ค้นหา"
                                    content="ค้นหาจากชื่อหรือ Discord ID เพื่อกรองรายชื่อสมาชิกทันที โดยไม่เปลี่ยนข้อมูลจริง"
                                />
                            </div>
                        </div>
                        <span className="rounded-token-full border border-border-subtle bg-bg-muted px-2.5 py-1 text-[11px] font-bold text-fg-tertiary tabular-nums">
                            {filteredMembers.length}/{members.length}
                        </span>
                    </div>
                    <div className="relative w-full">
                        <Search className="w-4 h-4 text-fg-tertiary absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="ค้นหาชื่อสมาชิก หรือ Discord..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); }}
                            className="min-h-10 w-full rounded-token-md border border-border-subtle bg-bg-base py-2.5 pl-10 pr-4 text-sm text-fg-primary shadow-inner outline-none transition-colors placeholder:text-fg-tertiary hover:border-border focus:border-border-strong sm:min-h-11"
                        />
                    </div>
                </div>

                <div className="flex w-full flex-col gap-3 lg:w-auto lg:items-end">
                    {canManageMembers && (
                        <Button
                            variant="primary"
                            size="md"
                            leftIcon={<UserPlus className="w-4 h-4" />}
                            onClick={() => setIsCreateModalOpen(true)}
                            className="w-full !min-h-10 !border-status-success !bg-status-success !text-fg-inverse shadow-token-sm hover:!opacity-90 sm:!min-h-11 lg:w-auto"
                        >
                            เพิ่มสมาชิก
                        </Button>
                    )}

                    <div className="flex w-full flex-col gap-2 sm:flex-row sm:gap-3 lg:w-auto">
                        <div className="custom-scrollbar flex min-h-10 items-center overflow-x-auto rounded-token-md border border-border-subtle bg-bg-muted p-1 shadow-inner sm:min-h-11">
                            <button
                                onClick={() => { setStatusFilter('ACTIVE'); }}
                                className={cn(
                                    'min-h-9 px-3 py-1.5 text-xs font-semibold rounded-token-sm transition-colors duration-token-normal ease-token-standard',
                                    statusFilter === 'ACTIVE'
                                        ? 'bg-bg-elevated text-fg-primary shadow-token-sm border border-border-subtle'
                                        : 'text-fg-tertiary hover:text-fg-secondary hover:bg-bg-subtle'
                                )}
                            >
                                ประจำการ
                            </button>
                            {canManageMembers && (
                                <button
                                    onClick={() => { setStatusFilter('PENDING'); }}
                                    className={cn(
                                        'min-h-9 px-3 py-1.5 text-xs font-semibold rounded-token-sm transition-colors duration-token-normal ease-token-standard',
                                        statusFilter === 'PENDING'
                                            ? 'bg-bg-elevated text-fg-warning shadow-token-sm border border-status-warning'
                                            : 'text-fg-tertiary hover:text-fg-secondary hover:bg-bg-subtle'
                                    )}
                                >
                                    รออนุมัติ
                                </button>
                            )}
                            <button
                                onClick={() => { setStatusFilter('INACTIVE'); }}
                                className={cn(
                                    'min-h-9 px-3 py-1.5 text-xs font-semibold rounded-token-sm transition-colors duration-token-normal ease-token-standard',
                                    statusFilter === 'INACTIVE'
                                        ? 'bg-bg-elevated text-fg-primary shadow-token-sm border border-border-subtle'
                                        : 'text-fg-tertiary hover:text-fg-secondary hover:bg-bg-subtle'
                                )}
                            >
                                ออกแล้ว
                            </button>
                        </div>

                        <select
                            value={roleFilter}
                            onChange={e => { setRoleFilter(e.target.value); }}
                            className="min-h-10 w-full min-w-[150px] cursor-pointer appearance-none rounded-token-md border border-border-subtle bg-bg-base px-4 py-2.5 pr-9 text-sm font-medium text-fg-secondary shadow-token-sm outline-none transition-colors hover:border-border focus:border-border-strong sm:min-h-11 sm:w-auto"
                            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2371717a\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundPosition: 'right 0.75rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1rem' }}
                        >
                            <option value="ALL">ทุกยศ ({filteredMembers.length})</option>
                            <option value="OWNER">หัวหน้า</option>
                            <option value="ADMIN">รองหัวหน้า</option>
                            <option value="TREASURER">เหรัญญิก</option>
                            <option value="ATTENDANCE_OFFICER">เจ้าหน้าที่เช็คชื่อ</option>
                            <option value="MEMBER">สมาชิก</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="space-y-2 md:hidden">
                {members.length === 0 ? (
                    <div className="rounded-token-lg border border-border-subtle bg-bg-subtle p-6 text-center shadow-token-sm">
                        <Users className="mx-auto mb-3 h-8 w-8 text-fg-tertiary" />
                        <p className="text-sm font-bold text-fg-primary">ยังไม่มีสมาชิกในระบบ</p>
                        <p className="mt-1 text-xs text-fg-tertiary">เพิ่มหรือเชิญสมาชิกเพื่อเริ่มใช้งาน roster ของแก๊ง</p>
                    </div>
                ) : paginatedMembers.length === 0 ? (
                    <div className="rounded-token-lg border border-dashed border-border-subtle bg-bg-subtle p-6 text-center shadow-token-sm">
                        <Search className="mx-auto mb-3 h-8 w-8 text-fg-tertiary" />
                        <p className="text-sm font-bold text-fg-primary">ไม่พบสมาชิกที่ตรงกับตัวกรอง</p>
                        <p className="mt-1 text-xs text-fg-tertiary">ลองเปลี่ยนคำค้น สถานะ หรือยศที่เลือกอยู่</p>
                    </div>
                ) : (
                    paginatedMembers.map((member) => {
                        const loanDebt = Number(member.loanDebt) || 0;
                        const collectionDue = Number(member.collectionDue) || 0;
                        const totalOutstanding = loanDebt + collectionDue;
                        const availableCredit = Math.max(0, Number(member.balance) || 0);
                        const hasLegacyNegativeBalance = totalOutstanding === 0 && Number(member.balance) < 0;
                        const isOutstanding = totalOutstanding > 0 || hasLegacyNegativeBalance;
                        const emphasisValue = isOutstanding
                            ? totalOutstanding || Math.abs(Number(member.balance) || 0)
                            : availableCredit;

                        return (
                            <article key={member.id} className="overflow-hidden rounded-token-lg border border-border-subtle bg-bg-subtle shadow-token-sm">
                                <div className="flex items-start gap-2.5 p-2.5">
                                    <div className="relative shrink-0">
                                        <Avatar
                                            src={member.discordAvatar}
                                            name={member.name}
                                            alt={member.name}
                                            className="h-10 w-10 rounded-token-lg ring-2 ring-border-subtle"
                                        />
                                        <span className={cn(
                                            'absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-token-full border-2 border-bg-base',
                                            member.isActive ? 'bg-status-success' : 'bg-fg-tertiary'
                                        )} />
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <Link
                                            href={`/dashboard/${gangId}/members/${member.id}`}
                                            className="block truncate text-sm font-black text-fg-primary transition-colors hover:text-accent-bright"
                                        >
                                            {member.name}
                                        </Link>
                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-fg-tertiary">
                                            <span className="rounded-token-full border border-border-subtle bg-bg-muted px-2 py-0.5 text-fg-secondary">
                                                {roleNames[member.gangRole || 'MEMBER'] || member.gangRole || 'สมาชิก'}
                                            </span>
                                            {member.discordUsername && <span className="truncate">@{member.discordUsername}</span>}
                                        </div>
                                    </div>

                                    <span className={cn(
                                        'shrink-0 rounded-token-full border px-2 py-0.5 text-[10px] font-bold',
                                        member.status === 'PENDING'
                                            ? 'border-status-warning bg-status-warning-subtle text-fg-warning'
                                            : member.isActive
                                                ? 'border-status-success bg-status-success-subtle text-fg-success'
                                                : 'border-border-subtle bg-bg-muted text-fg-tertiary'
                                    )}>
                                        {member.status === 'PENDING' ? 'รออนุมัติ' : member.isActive ? 'ใช้งานอยู่' : 'ออกแล้ว'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-1.5 border-y border-border-subtle bg-bg-muted/70 p-2">
                                    <div className="rounded-token-lg border border-border-subtle bg-bg-subtle px-2.5 py-1.5">
                                        <p className="text-[11px] font-bold text-fg-tertiary">การเงิน</p>
                                        <p className={cn(
                                            'mt-1 text-sm font-black tabular-nums',
                                            isOutstanding ? 'text-fg-danger' : availableCredit > 0 ? 'text-fg-success' : 'text-fg-secondary'
                                        )}>
                                            {isOutstanding ? '' : availableCredit > 0 ? '+' : ''}{emphasisValue.toLocaleString()} ฿
                                        </p>
                                    </div>
                                    <div className="rounded-token-lg border border-border-subtle bg-bg-subtle px-2.5 py-1.5">
                                        <p className="text-[11px] font-bold text-fg-tertiary">รายละเอียด</p>
                                        <p className="mt-1 text-[11px] font-semibold leading-relaxed text-fg-secondary">
                                            {loanDebt > 0 || collectionDue > 0
                                                ? `ยืม ${loanDebt.toLocaleString()} / ค้างเก็บ ${collectionDue.toLocaleString()}`
                                                : availableCredit > 0
                                                    ? 'มีเครดิต/สำรองจ่าย'
                                                    : 'ไม่มีหนี้หรือเครดิต'}
                                        </p>
                                    </div>
                                </div>

                                {canManageMembers && member.status === 'PENDING' && (
                                    <div className="flex flex-wrap justify-end gap-2 p-2.5">
                                        <button
                                            onClick={() => handleStatusUpdate(member, 'APPROVED')}
                                            disabled={processingStatusId === member.id}
                                            className="inline-flex min-h-11 items-center gap-1.5 rounded-token-lg border border-status-success bg-status-success-subtle px-3 py-2 text-xs font-bold text-fg-success disabled:opacity-50"
                                        >
                                            {processingStatusId === member.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                            อนุมัติ
                                        </button>
                                        <button
                                            onClick={() => handleStatusUpdate(member, 'REJECTED')}
                                            disabled={processingStatusId === member.id}
                                            className="inline-flex min-h-11 items-center gap-1.5 rounded-token-lg border border-status-danger bg-status-danger-subtle px-3 py-2 text-xs font-bold text-fg-danger disabled:opacity-50"
                                        >
                                            {processingStatusId === member.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                                            ปฏิเสธ
                                        </button>
                                    </div>
                                )}
                            </article>
                        );
                    })
                )}
            </div>

            {/* Table */}
            <div className="hidden overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle shadow-token-xs md:block">
                <div className="flex items-center justify-between gap-3 border-b border-border-subtle bg-bg-muted px-4 py-2.5">
                    <div>
                        <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-fg-secondary">รายชื่อสมาชิก</p>
                            <InfoTip
                                label="ตารางสมาชิก"
                                content="ตารางนี้รวมตัวตน ยศ Discord สถานะสมาชิก และสถานะการเงินแบบย่อ กดชื่อเพื่อดูรายละเอียดลึกของคนนั้น"
                            />
                        </div>
                    </div>
                    <span className="rounded-token-full border border-border-subtle bg-bg-subtle px-3 py-1 text-[11px] font-bold text-fg-tertiary tabular-nums">
                        {filteredMembers.length}/{members.length}
                    </span>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="ops-table w-full text-left">
                        <thead>
                            <tr className="border-b border-border-subtle">
                                <th className="w-[35%] px-4 py-3 text-xs font-bold text-fg-tertiary">ข้อมูลสมาชิก</th>
                                <th className="hidden w-[15%] px-4 py-3 text-center text-xs font-bold text-fg-tertiary sm:table-cell">ยศ</th>
                                <th className="hidden w-[20%] px-4 py-3 text-xs font-bold text-fg-tertiary md:table-cell">Discord</th>
                                <th className="w-[15%] px-4 py-3 text-right text-xs font-bold text-fg-tertiary">สถานะการเงิน</th>
                                <th className="w-[10%] px-4 py-3 text-center text-xs font-bold text-fg-tertiary">สถานะ</th>
                                <th className="w-[5%] px-4 py-3 text-right text-xs font-bold text-fg-tertiary"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle">
                            {members.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-16 text-center">
                                        <div className="flex flex-col items-center justify-center text-fg-tertiary">
                                            <div className="w-12 h-12 bg-bg-muted rounded-token-lg flex items-center justify-center mb-3 border border-border-subtle shadow-inner">
                                                <Users className="w-6 h-6 opacity-60 text-fg-tertiary" />
                                            </div>
                                            <p className="text-sm font-bold text-fg-primary tracking-wide">ยังไม่มีสมาชิกในระบบ</p>
                                            <p className="text-xs mt-1.5 text-fg-tertiary">เพิ่มหรือเชิญสมาชิกเพื่อเริ่มสร้างรายชื่อของแก๊ง</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : paginatedMembers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-14 text-center text-fg-tertiary">
                                        <div className="mx-auto max-w-sm rounded-token-lg border border-dashed border-border-subtle bg-bg-muted px-5 py-6">
                                            <Search className="mx-auto mb-3 h-7 w-7 text-fg-tertiary" />
                                            <p className="text-sm font-bold tracking-wide text-fg-primary">ไม่พบข้อมูลที่ตรงกับตัวกรอง</p>
                                            <p className="mt-1.5 text-xs text-fg-tertiary">ลองเปลี่ยนคำค้น สถานะสมาชิก หรือยศที่เลือกอยู่</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedMembers.map((member) => {
                                    const loanDebt = Number(member.loanDebt) || 0;
                                    const collectionDue = Number(member.collectionDue) || 0;
                                    const totalOutstanding = loanDebt + collectionDue;
                                    const availableCredit = Math.max(0, Number(member.balance) || 0);
                                    const hasLegacyNegativeBalance = totalOutstanding === 0 && Number(member.balance) < 0;
                                    const isOutstanding = totalOutstanding > 0 || hasLegacyNegativeBalance;
                                    const emphasisValue = isOutstanding
                                        ? totalOutstanding || Math.abs(Number(member.balance) || 0)
                                        : availableCredit;

                                    return (
                                        <tr key={member.id} className="group transition-colors hover:bg-bg-subtle">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="relative shrink-0">
                                                        <Avatar
                                                            src={member.discordAvatar}
                                                            name={member.name}
                                                            alt={member.name}
                                                            className="h-9 w-9 ring-1 ring-border-subtle shadow-token-sm transition-colors group-hover:ring-border"
                                                        />
                                                        <div className={cn(
                                                            'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-token-full border-2 border-bg-base',
                                                            member.isActive ? 'bg-status-success' : 'bg-fg-tertiary'
                                                        )} />
                                                    </div>
                                                    <div className="min-w-0 flex flex-col justify-center">
                                                        <Link
                                                            href={`/dashboard/${gangId}/members/${member.id}`}
                                                            className="font-semibold text-fg-primary hover:text-accent-bright transition-colors truncate block text-sm tracking-wide"
                                                        >
                                                            {member.name}
                                                        </Link>
                                                        <div className="mt-0.5 hidden truncate text-[11px] font-medium text-fg-tertiary tabular-nums sm:block">ID: {member.id.substring(0, 8)}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="hidden px-4 py-3 text-center sm:table-cell">
                                                {(() => {
                                                    const role = member.gangRole || 'MEMBER';
                                                    const roleConfig = {
                                                        OWNER: { label: 'หัวหน้า', color: 'text-fg-warning', bg: 'bg-status-warning-subtle', border: 'border-status-warning', icon: ShieldAlert },
                                                        ADMIN: { label: 'รองหัวหน้า', color: 'text-fg-danger', bg: 'bg-status-danger-subtle', border: 'border-status-danger', icon: Shield },
                                                        TREASURER: { label: 'เหรัญญิก', color: 'text-fg-success', bg: 'bg-status-success-subtle', border: 'border-status-success', icon: Wallet },
                                                        ATTENDANCE_OFFICER: { label: 'เช็คชื่อ', color: 'text-fg-warning', bg: 'bg-status-warning-subtle', border: 'border-status-warning', icon: FileText },
                                                        MEMBER: { label: 'สมาชิก', color: 'text-fg-info', bg: 'bg-status-info-subtle', border: 'border-status-info', icon: User },
                                                    }[role] || { label: role, color: 'text-fg-tertiary', bg: 'bg-bg-muted', border: 'border-border-subtle', icon: User };
                                                    const Icon = roleConfig.icon;
                                                    return (
                                                        <span className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-token-md text-[11px] font-bold border ${roleConfig.bg} ${roleConfig.color} ${roleConfig.border}`}>
                                                            <Icon className="w-3 h-3" />
                                                            {roleConfig.label}
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                            <td className="hidden px-4 py-3 md:table-cell">
                                                {member.discordUsername ? (
                                                    <div className="flex items-center gap-2.5 text-sm text-fg-secondary">
                                                        <div className="w-7 h-7 rounded-token-md bg-brand-discord/10 flex items-center justify-center border border-brand-discord/20">
                                                            <DiscordLogo className="w-3.5 h-3.5 text-brand-discord" />
                                                        </div>
                                                        <span className="group-hover:text-fg-primary transition-colors font-medium cursor-pointer truncate tracking-wide">@{member.discordUsername}</span>
                                                    </div>
                                                ) : (
                                                    <span className="rounded-token-md border border-border-subtle bg-bg-muted px-2.5 py-1 text-[11px] font-bold text-fg-tertiary">ไม่ได้เชื่อมต่อ</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex flex-col items-end gap-1.5">
                                                    <div className={cn(
                                                        'inline-flex items-center gap-1 px-2.5 py-1 rounded-token-md border text-xs font-bold tabular-nums tracking-tight',
                                                        isOutstanding
                                                            ? 'bg-status-danger-subtle text-fg-danger border-status-danger'
                                                            : availableCredit > 0
                                                                ? 'bg-status-success-subtle text-fg-success border-status-success'
                                                                : 'bg-bg-muted text-fg-tertiary border-border-subtle'
                                                    )}>
                                                        <span>{isOutstanding ? '' : availableCredit > 0 ? '+' : ''}{emphasisValue.toLocaleString()}</span>
                                                        <span className="text-[10px] ml-0.5 opacity-80">฿</span>
                                                    </div>
                                                    <div className="text-[10px] text-fg-tertiary text-right leading-relaxed max-w-[180px] tabular-nums">
                                                        {loanDebt > 0 && <div>หนี้ยืม ฿{loanDebt.toLocaleString()}</div>}
                                                        {collectionDue > 0 && <div>ค้างเก็บเงิน ฿{collectionDue.toLocaleString()}</div>}
                                                        {!isOutstanding && availableCredit > 0 && <div>เครดิต/สำรองจ่ายคงเหลือ</div>}
                                                        {!isOutstanding && availableCredit === 0 && <div>ไม่มีหนี้หรือเครดิตคงเหลือ</div>}
                                                        {hasLegacyNegativeBalance && <div>ยอดบาลานซ์ติดลบจากรายการเดิม</div>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={cn(
                                                    'inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-token-md text-[11px] font-bold border',
                                                    member.status === 'PENDING'
                                                        ? 'bg-status-warning-subtle text-fg-warning border-status-warning'
                                                        : member.isActive
                                                            ? 'bg-status-success-subtle text-fg-success border-status-success'
                                                            : 'bg-bg-muted text-fg-tertiary border-border-subtle'
                                                )}>
                                                    <Circle className={cn(
                                                        'w-1.5 h-1.5',
                                                        member.status === 'PENDING'
                                                            ? 'fill-status-warning text-status-warning'
                                                            : member.isActive
                                                                ? 'fill-status-success text-status-success'
                                                                : 'fill-fg-tertiary text-fg-tertiary'
                                                    )} />
                                                    {member.status === 'PENDING' ? 'รออนุมัติ' : member.isActive ? 'ใช้งานอยู่' : 'ออกแล้ว'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {canManageMembers && member.status === 'PENDING' ? (
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => handleStatusUpdate(member, 'APPROVED')}
                                                            disabled={processingStatusId === member.id}
                                                            className="inline-flex min-h-10 items-center gap-1.5 rounded-token-md border border-status-success bg-status-success-subtle px-3 py-1.5 text-xs font-semibold text-fg-success transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            {processingStatusId === member.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                                            อนุมัติ
                                                        </button>
                                                        <button
                                                            onClick={() => handleStatusUpdate(member, 'REJECTED')}
                                                            disabled={processingStatusId === member.id}
                                                            className="inline-flex min-h-10 items-center gap-1.5 rounded-token-md border border-status-danger bg-status-danger-subtle px-3 py-1.5 text-xs font-semibold text-fg-danger transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            {processingStatusId === member.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                                                            ปฏิเสธ
                                                        </button>
                                                    </div>
                                                ) : canManageMembers ? (
                                                    <div className="flex justify-end relative">
                                                        <button
                                                            onClick={(e) => {
                                                                const rect = e.currentTarget.getBoundingClientRect();
                                                                setDropdownPos({
                                                                    top: rect.bottom + 8,
                                                                    right: window.innerWidth - rect.right
                                                                });
                                                                setOpenDropdownId(openDropdownId === member.id ? null : member.id);
                                                            }}
                                                            className="flex h-10 w-10 items-center justify-center rounded-token-md border border-transparent text-fg-tertiary transition-colors hover:border-border-subtle hover:bg-bg-subtle hover:text-fg-primary"
                                                        >
                                                            <MoreHorizontal className="w-4 h-4" />
                                                        </button>

                                                        {openDropdownId === member.id && (
                                                            <>
                                                                <div
                                                                    className="fixed inset-0 z-40"
                                                                    onClick={() => setOpenDropdownId(null)}
                                                                />
                                                                <div
                                                                    className="fixed w-48 bg-bg-elevated border border-border rounded-token-lg shadow-token-lg z-50 py-1.5 animate-in fade-in zoom-in-95 duration-200"
                                                                    style={{
                                                                        top: dropdownPos.top,
                                                                        right: dropdownPos.right
                                                                    }}
                                                                >
                                                                    {canAssignRoles && member.gangRole !== 'OWNER' && (
                                                                        <button
                                                                            onClick={() => {
                                                                                setRoleTarget(member);
                                                                                setOpenDropdownId(null);
                                                                            }}
                                                                            className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-fg-secondary hover:text-fg-primary hover:bg-bg-muted flex items-center gap-3 transition-colors tracking-wide"
                                                                        >
                                                                            <UserCog className="w-4 h-4" />
                                                                            เปลี่ยนยศ
                                                                        </button>
                                                                    )}

                                                                    <Link
                                                                        href={`/dashboard/${gangId}/members/${member.id}`}
                                                                        className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-fg-secondary hover:text-fg-primary hover:bg-bg-muted flex items-center gap-3 transition-colors tracking-wide"
                                                                    >
                                                                        <FileText className="w-4 h-4" />
                                                                        ดูโปรไฟล์
                                                                    </Link>

                                                                    <button
                                                                        onClick={() => {
                                                                            setEditingMember(member);
                                                                            setOpenDropdownId(null);
                                                                        }}
                                                                        className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-fg-secondary hover:text-fg-primary hover:bg-bg-muted flex items-center gap-3 transition-colors tracking-wide"
                                                                    >
                                                                        <Edit className="w-4 h-4" />
                                                                        แก้ไขข้อมูล
                                                                    </button>

                                                                    {member.gangRole !== 'OWNER' && (
                                                                        <>
                                                                            <div className="h-px bg-border-subtle my-1.5 mx-3" />
                                                                            <button
                                                                                onClick={() => {
                                                                                    setKickTarget(member);
                                                                                    setOpenDropdownId(null);
                                                                                }}
                                                                                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] font-semibold tracking-wide text-fg-danger transition-colors hover:bg-status-danger-subtle hover:opacity-90"
                                                                            >
                                                                                <UserMinus className="w-4 h-4" />
                                                                                ไล่ออก (Kick)
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <Link
                                                        href={`/dashboard/${gangId}/members/${member.id}`}
                                                        className="inline-flex min-h-10 items-center gap-1.5 rounded-token-md px-2 text-xs text-fg-secondary transition-colors hover:bg-bg-muted hover:text-fg-primary"
                                                    >
                                                        <FileText className="w-3.5 h-3.5" />
                                                        ดูโปรไฟล์
                                                    </Link>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 px-2">
                    <span className="text-[11px] font-medium text-fg-tertiary tracking-wide tabular-nums">
                        แสดงข้อมูล <span className="text-fg-primary">{startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, filteredMembers.length)}</span> จากทั้งหมด <span className="text-fg-primary">{filteredMembers.length}</span> รายการ
                    </span>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="rounded-token-md border border-border-subtle bg-bg-subtle p-1.5 text-fg-tertiary shadow-token-sm transition-colors hover:border-border hover:bg-bg-muted hover:text-fg-primary disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label="Previous page"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>

                        <div className="flex items-center gap-1.5 bg-bg-subtle p-1 rounded-token-md border border-border-subtle shadow-token-sm">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let page;
                                if (totalPages <= 5) {
                                    page = i + 1;
                                } else if (currentPage <= 3) {
                                    page = i + 1;
                                } else if (currentPage >= totalPages - 2) {
                                    page = totalPages - 4 + i;
                                } else {
                                    page = currentPage - 2 + i;
                                }
                                return (
                                    <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        className={cn(
                                            'w-7 h-7 rounded-token-sm text-xs font-bold tabular-nums transition-colors duration-token-normal ease-token-standard',
                                            page === currentPage
                                                ? 'bg-accent text-accent-fg shadow-token-sm'
                                                : 'text-fg-tertiary hover:text-fg-primary hover:bg-bg-muted'
                                        )}
                                    >
                                        {page}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="rounded-token-md border border-border-subtle bg-bg-subtle p-1.5 text-fg-tertiary shadow-token-sm transition-colors hover:border-border hover:bg-bg-muted hover:text-fg-primary disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label="Next page"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Modals */}
            {isCreateModalOpen && (
                <CreateMemberModal
                    isOpen={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                    gangId={gangId}
                />
            )}

            {editingMember && (
                <EditMemberModal
                    isOpen={!!editingMember}
                    onClose={() => setEditingMember(null)}
                    member={editingMember}
                    gangId={gangId}
                />
            )}

            {kickTarget && (
                <ConfirmModal
                isOpen={!!kickTarget}
                onClose={() => setKickTarget(null)}
                onConfirm={handleConfirmKick}
                title="ยืนยันการไล่ออก"
                description={<span className="text-fg-secondary">คุณต้องการไล่ออก "{kickTarget?.name}" ใช่หรือไม่?<br /><br /><ul className="list-disc pl-5 space-y-1"><li>สมาชิกจะถูกลบยศในระบบ Discord</li><li>สถานะจะเปลี่ยนเป็นออกแล้ว</li><li>ประวัติการเงินต่างๆ จะยังคงอยู่</li></ul></span>}
                confirmText="ยืนยัน, ไล่ออก"
                cancelText="ยกเลิก"
                type="danger"
                icon={UserMinus}
                    isProcessing={isDeleting}
                />
            )}

            {canAssignRoles && roleTarget && (
                <MemberRoleModal
                    isOpen={!!roleTarget}
                    onClose={() => setRoleTarget(null)}
                    member={roleTarget}
                    gangId={gangId}
                />
            )}
        </div>
    );
}
