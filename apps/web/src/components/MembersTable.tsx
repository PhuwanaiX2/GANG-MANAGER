'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CreateMemberModal } from './modals/CreateMemberModal';
import { EditMemberModal } from './modals/EditMemberModal';
import { ConfirmModal } from './modals/ConfirmModal';
import { MemberRoleModal } from './modals/MemberRoleModal';
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
    MessageCircle,
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
import { Button, InfoTip } from '@/components/ui';
import { cn } from '@/lib/cn';

interface Member {
    id: string;
    name: string;

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
}

export function MembersTable({ members, gangId, canManageMembers }: Props) {
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

    const filteredMembers = members.filter(m => {
        const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase()) || (m.discordUsername || '').toLowerCase().includes(search.toLowerCase());
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

    const handleConfirmKick = async () => {
        if (!kickTarget) return;

        setIsDeleting(true);
        try {
            const res = await fetch(`/api/gangs/${gangId}/members/${kickTarget.id}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Failed to delete');

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
            if (!res.ok) throw new Error('Failed to update status');

            toast.success(`อัปเดตสถานะสมาชิก "${member.name}" เป็น "${status}" เรียบร้อยแล้ว`);
            router.refresh();
        } catch (error) {
            console.error(error);
            toast.error('เกิดข้อผิดพลาด ไม่สามารถอัปเดตสถานะสมาชิกได้');
        } finally {
            setProcessingStatusId(null);
        }
    };

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col gap-3 bg-bg-subtle/95 p-3.5 sm:p-4 border border-border-subtle rounded-token-2xl shadow-token-sm lg:flex-row lg:items-end lg:justify-between">
                <div className="w-full lg:max-w-sm">
                    <div className="mb-2 flex items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-fg-tertiary">Search Console</p>
                                <InfoTip
                                    label="ค้นหา"
                                    content="ค้นหาจากชื่อหรือ Discord ID เพื่อกรอง roster ledger ทันที โดยไม่เปลี่ยนข้อมูลจริง"
                                />
                            </div>
                        </div>
                        <span className="rounded-token-full border border-border-subtle bg-bg-muted px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-fg-tertiary tabular-nums">
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
                            className="bg-bg-base border border-border-subtle text-fg-primary text-sm rounded-token-md pl-10 pr-4 py-2.5 outline-none focus:border-border-strong hover:border-border transition-colors w-full placeholder:text-fg-tertiary shadow-inner"
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-3 w-full lg:w-auto lg:items-end">
                    {canManageMembers && (
                        <Button
                            variant="primary"
                            size="md"
                            leftIcon={<UserPlus className="w-4 h-4" />}
                            onClick={() => setIsCreateModalOpen(true)}
                            className="w-full !border-status-danger !bg-status-danger !text-fg-inverse shadow-token-sm hover:!brightness-110 lg:w-auto"
                        >
                            เพิ่มสมาชิก
                        </Button>
                    )}

                    <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
                    <div className="flex items-center p-1 bg-bg-muted border border-border-subtle rounded-token-md shadow-inner overflow-x-auto custom-scrollbar">
                        <button
                            onClick={() => { setStatusFilter('ACTIVE'); }}
                            className={cn(
                                'px-4 py-1.5 text-xs font-semibold rounded-token-sm transition-colors duration-token-normal ease-token-standard',
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
                                    'px-4 py-1.5 text-xs font-semibold rounded-token-sm transition-colors duration-token-normal ease-token-standard',
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
                                'px-4 py-1.5 text-xs font-semibold rounded-token-sm transition-colors duration-token-normal ease-token-standard',
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
                        className="bg-bg-base border border-border-subtle text-fg-secondary text-sm font-medium rounded-token-md px-4 py-2.5 pr-9 outline-none focus:border-border-strong hover:border-border transition-colors cursor-pointer appearance-none shadow-token-sm min-w-[150px] w-full sm:w-auto"
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

            {/* Table */}
            <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden shadow-token-sm">
                <div className="flex items-center justify-between gap-3 border-b border-border-subtle bg-bg-muted px-4 py-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-fg-tertiary">Roster Ledger</p>
                            <InfoTip
                                label="ตารางสมาชิก"
                                content="ตารางนี้รวมตัวตน ยศ Discord สถานะสมาชิก และสถานะการเงินแบบย่อ กดชื่อเพื่อดูรายละเอียดลึกของคนนั้น"
                            />
                        </div>
                    </div>
                    <span className="hidden rounded-token-full border border-border-subtle bg-bg-subtle px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-fg-tertiary sm:inline-flex">
                        Scroll X on mobile
                    </span>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-bg-muted border-b border-border-subtle">
                                <th className="px-5 py-4 text-[11px] font-bold text-fg-tertiary uppercase tracking-wider w-[35%]">ข้อมูลสมาชิก</th>
                                <th className="px-5 py-4 text-[11px] font-bold text-fg-tertiary uppercase tracking-wider text-center hidden sm:table-cell w-[15%]">ยศ</th>
                                <th className="px-5 py-4 text-[11px] font-bold text-fg-tertiary uppercase tracking-wider hidden md:table-cell w-[20%]">Discord</th>
                                <th className="px-5 py-4 text-[11px] font-bold text-fg-tertiary uppercase tracking-wider text-right w-[15%]">สถานะการเงิน</th>
                                <th className="px-5 py-4 text-[11px] font-bold text-fg-tertiary uppercase tracking-wider text-center w-[10%]">สถานะ</th>
                                <th className="px-5 py-4 text-[11px] font-bold text-fg-tertiary uppercase tracking-wider text-right w-[5%]"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle">
                            {members.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-24 text-center">
                                        <div className="flex flex-col items-center justify-center text-fg-tertiary">
                                            <div className="w-16 h-16 bg-bg-muted rounded-token-xl flex items-center justify-center mb-4 border border-border-subtle shadow-inner">
                                                <Users className="w-8 h-8 opacity-60 text-fg-tertiary" />
                                            </div>
                                            <p className="text-sm font-bold text-fg-primary tracking-wide">ยังไม่มีสมาชิกในระบบ</p>
                                            <p className="text-xs mt-1.5 text-fg-tertiary">เพิ่มหรือเชิญสมาชิกเพื่อเริ่มสร้าง roster ledger ของแก๊ง</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : paginatedMembers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center text-fg-tertiary">
                                        <div className="mx-auto max-w-sm rounded-token-xl border border-dashed border-border-subtle bg-bg-muted px-6 py-8">
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
                                        <tr key={member.id} className="hover:bg-bg-subtle transition-colors group">
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="relative shrink-0">
                                                        {member.discordAvatar ? (
                                                            <Image
                                                                src={member.discordAvatar}
                                                                alt={member.name}
                                                                width={44}
                                                                height={44}
                                                                className="w-11 h-11 rounded-token-full object-cover ring-2 ring-border-subtle group-hover:ring-border transition-all shadow-token-sm"
                                                            />
                                                        ) : (
                                                            <div className="w-11 h-11 bg-bg-muted rounded-token-full flex items-center justify-center ring-2 ring-border-subtle group-hover:ring-border transition-all shadow-token-sm text-fg-secondary font-bold text-lg">
                                                                {member.name[0]?.toUpperCase()}
                                                            </div>
                                                        )}
                                                        <div className={cn(
                                                            'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-token-full border-2 border-bg-base',
                                                            member.isActive
                                                                ? 'bg-status-success shadow-[0_0_8px_var(--color-success)]'
                                                                : 'bg-fg-tertiary'
                                                        )} />
                                                    </div>
                                                    <div className="min-w-0 flex flex-col justify-center">
                                                        <Link
                                                            href={`/dashboard/${gangId}/members/${member.id}`}
                                                            className="font-semibold text-fg-primary hover:text-accent-bright transition-colors truncate block text-sm tracking-wide"
                                                        >
                                                            {member.name}
                                                        </Link>
                                                        <div className="text-[10px] text-fg-tertiary font-medium tracking-wider mt-0.5 truncate hidden sm:block uppercase tabular-nums">ID: {member.id.substring(0, 8)}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-center hidden sm:table-cell">
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
                                                        <span className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-token-md text-[10px] font-bold uppercase tracking-widest border ${roleConfig.bg} ${roleConfig.color} ${roleConfig.border}`}>
                                                            <Icon className="w-3 h-3" />
                                                            {roleConfig.label}
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-5 py-4 hidden md:table-cell">
                                                {member.discordUsername ? (
                                                    <div className="flex items-center gap-2.5 text-sm text-fg-secondary">
                                                        <div className="w-7 h-7 rounded-token-md bg-brand-discord/10 flex items-center justify-center border border-brand-discord/20">
                                                            <MessageCircle className="w-3.5 h-3.5 text-brand-discord" />
                                                        </div>
                                                        <span className="group-hover:text-fg-primary transition-colors font-medium cursor-pointer truncate tracking-wide">@{member.discordUsername}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-fg-tertiary text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-token-md bg-bg-muted border border-border-subtle">ไม่ได้เชื่อมต่อ</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <div className="flex flex-col items-end gap-1.5">
                                                    <div className={cn(
                                                        'inline-flex items-center gap-1 px-2.5 py-1 rounded-token-md border text-xs font-bold tabular-nums tracking-tight',
                                                        isOutstanding
                                                            ? 'bg-status-danger-subtle text-fg-danger border-status-danger shadow-[0_0_8px_var(--color-danger)]'
                                                            : availableCredit > 0
                                                                ? 'bg-status-success-subtle text-fg-success border-status-success shadow-[0_0_8px_var(--color-success)]'
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
                                            <td className="px-5 py-4 text-center">
                                                <span className={cn(
                                                    'inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-token-md text-[10px] font-bold tracking-widest uppercase border',
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
                                                    {member.status === 'PENDING' ? 'Pending' : member.isActive ? 'Active' : 'Left'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                {canManageMembers && member.status === 'PENDING' ? (
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => handleStatusUpdate(member, 'APPROVED')}
                                                            disabled={processingStatusId === member.id}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-token-md bg-status-success-subtle text-fg-success border border-status-success hover:brightness-110 transition-all text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            {processingStatusId === member.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                                            อนุมัติ
                                                        </button>
                                                        <button
                                                            onClick={() => handleStatusUpdate(member, 'REJECTED')}
                                                            disabled={processingStatusId === member.id}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-token-md bg-status-danger-subtle text-fg-danger border border-status-danger hover:brightness-110 transition-all text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
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
                                                            className="p-1.5 text-fg-tertiary hover:text-fg-primary hover:bg-bg-subtle rounded-token-md transition-colors border border-transparent hover:border-border-subtle"
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
                                                                                className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-fg-danger hover:brightness-110 hover:bg-status-danger-subtle flex items-center gap-3 transition-colors tracking-wide"
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
                                                        className="inline-flex items-center gap-1.5 text-xs text-fg-secondary hover:text-fg-primary transition-colors"
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
                            className="p-1.5 rounded-token-md bg-bg-subtle border border-border-subtle text-fg-tertiary hover:text-fg-primary hover:bg-bg-muted hover:border-border disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-token-sm"
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
                            className="p-1.5 rounded-token-md bg-bg-subtle border border-border-subtle text-fg-tertiary hover:text-fg-primary hover:bg-bg-muted hover:border-border disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-token-sm"
                            aria-label="Next page"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Modals */}
            <CreateMemberModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                gangId={gangId}
            />

            {editingMember && (
                <EditMemberModal
                    isOpen={!!editingMember}
                    onClose={() => setEditingMember(null)}
                    member={editingMember}
                    gangId={gangId}
                />
            )}

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

            {roleTarget && (
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
