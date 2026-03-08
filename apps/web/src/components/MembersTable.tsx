'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { EditMemberModal } from './modals/EditMemberModal';
import { ConfirmModal } from './modals/ConfirmModal';
import { MemberRoleModal } from './modals/MemberRoleModal';
import {
    Edit,
    Trash2,
    UserMinus,
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
    ShieldAlert
} from 'lucide-react';

interface Member {
    id: string;
    name: string;

    discordUsername: string | null;
    discordAvatar: string | null;
    balance: number;
    isActive: boolean;
    gangId: string;
    gangRole?: string;
}

interface Props {
    members: Member[];
    gangId: string;
}

export function MembersTable({ members, gangId }: Props) {
    const router = useRouter();
    const [editingMember, setEditingMember] = useState<Member | null>(null);
    const [kickTarget, setKickTarget] = useState<Member | null>(null);
    const [roleTarget, setRoleTarget] = useState<Member | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });

    // Search & Filter
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('ALL');
    const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');

    const filteredMembers = members.filter(m => {
        const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase()) || (m.discordUsername || '').toLowerCase().includes(search.toLowerCase());
        const matchRole = roleFilter === 'ALL' || m.gangRole === roleFilter;
        const matchStatus = statusFilter === 'ACTIVE' ? m.isActive : !m.isActive;
        return matchSearch && matchRole && matchStatus;
    });

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;
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



    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-[#111] p-4 sm:p-5 border border-white/5 rounded-2xl shadow-sm">
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                    <div className="relative w-full sm:w-72">
                        <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="ค้นหาชื่อสมาชิก หรือ Discord..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                            className="bg-[#0A0A0A] border border-white/5 text-white text-sm rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-white/20 hover:border-white/10 transition-colors w-full placeholder:text-zinc-600 shadow-inner"
                        />
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                    <div className="flex items-center p-1 bg-[#0A0A0A] border border-white/5 rounded-xl shadow-inner">
                        <button
                            onClick={() => { setStatusFilter('ACTIVE'); setCurrentPage(1); }}
                            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${statusFilter === 'ACTIVE' ? 'bg-[#1a1a1a] text-zinc-200 shadow-sm border border-white/5' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}
                        >
                            ประจำการ
                        </button>
                        <button
                            onClick={() => { setStatusFilter('INACTIVE'); setCurrentPage(1); }}
                            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${statusFilter === 'INACTIVE' ? 'bg-[#1a1a1a] text-zinc-200 shadow-sm border border-white/5' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}
                        >
                            ออกแล้ว
                        </button>
                    </div>

                    <select
                        value={roleFilter}
                        onChange={e => { setRoleFilter(e.target.value); setCurrentPage(1); }}
                        className="bg-[#0A0A0A] border border-white/5 text-zinc-300 text-sm font-medium rounded-xl px-4 py-2.5 outline-none focus:border-white/20 hover:border-white/10 transition-colors cursor-pointer appearance-none shadow-sm min-w-[130px]"
                        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2371717a\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundPosition: 'right 0.75rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1rem' }}
                    >
                        <option value="ALL">ทุกยศ ({filteredMembers.length})</option>
                        <option value="OWNER">หัวหน้า</option>
                        <option value="ADMIN">รองหัวหน้า</option>
                        <option value="TREASURER">เหรัญญิก</option>
                        <option value="MEMBER">สมาชิก</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#0A0A0A] border-b border-white/5">
                                <th className="px-5 py-4 text-[11px] font-bold text-zinc-500 uppercase tracking-wider w-[35%]">ข้อมูลสมาชิก</th>
                                <th className="px-5 py-4 text-[11px] font-bold text-zinc-500 uppercase tracking-wider text-center hidden sm:table-cell w-[15%]">ยศ</th>
                                <th className="px-5 py-4 text-[11px] font-bold text-zinc-500 uppercase tracking-wider hidden md:table-cell w-[20%]">Discord</th>
                                <th className="px-5 py-4 text-[11px] font-bold text-zinc-500 uppercase tracking-wider text-right w-[15%]">ยอดสุทธิ</th>
                                <th className="px-5 py-4 text-[11px] font-bold text-zinc-500 uppercase tracking-wider text-center w-[10%]">สถานะ</th>
                                <th className="px-5 py-4 text-[11px] font-bold text-zinc-500 uppercase tracking-wider text-right w-[5%]"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {members.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-24 text-center">
                                        <div className="flex flex-col items-center justify-center text-zinc-500">
                                            <div className="w-16 h-16 bg-[#1a1a1a] rounded-2xl flex items-center justify-center mb-4 border border-white/5 shadow-inner">
                                                <Users className="w-8 h-8 opacity-50 text-zinc-400" />
                                            </div>
                                            <p className="text-sm font-semibold text-zinc-300 tracking-wide">ยังไม่มีสมาชิกในระบบ</p>
                                            <p className="text-xs mt-1.5 text-zinc-500">เชิญสมาชิกเข้าแก๊งของคุณเพื่อเริ่มต้นการจัดการ</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : paginatedMembers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center text-zinc-500">
                                        <p className="text-sm font-medium tracking-wide">ไม่พบข้อมูลที่ตรงกับการค้นหา</p>
                                    </td>
                                </tr>
                            ) : (
                                paginatedMembers.map((member) => (
                                    <tr key={member.id} className="hover:bg-[#151515] transition-colors group">
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className="relative shrink-0">
                                                    {member.discordAvatar ? (
                                                        <Image
                                                            src={member.discordAvatar}
                                                            alt={member.name}
                                                            width={44}
                                                            height={44}
                                                            className="w-11 h-11 rounded-full object-cover ring-2 ring-white/5 group-hover:ring-white/10 transition-all shadow-sm"
                                                        />
                                                    ) : (
                                                        <div className="w-11 h-11 bg-[#1a1a1a] rounded-full flex items-center justify-center ring-2 ring-white/5 group-hover:ring-white/10 transition-all shadow-sm text-zinc-400 font-bold text-lg">
                                                            {member.name[0]?.toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#111] ${member.isActive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-zinc-600'}`} />
                                                </div>
                                                <div className="min-w-0 flex flex-col justify-center">
                                                    <Link
                                                        href={`/dashboard/${gangId}/members/${member.id}`}
                                                        className="font-semibold text-zinc-200 hover:text-white transition-colors truncate block text-sm tracking-wide"
                                                    >
                                                        {member.name}
                                                    </Link>
                                                    <div className="text-[10px] text-zinc-500 font-medium tracking-wider mt-0.5 truncate hidden sm:block uppercase">ID: {member.id.substring(0, 8)}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-center hidden sm:table-cell">
                                            {(() => {
                                                const role = member.gangRole || 'MEMBER';
                                                const roleConfig = {
                                                    OWNER: { label: 'หัวหน้า', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: ShieldAlert },
                                                    ADMIN: { label: 'รองหัวหน้า', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', icon: Shield },
                                                    TREASURER: { label: 'เหรัญญิก', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: Wallet },
                                                    MEMBER: { label: 'สมาชิก', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: User },
                                                }[role] || { label: role, color: 'text-zinc-400', bg: 'bg-zinc-800', border: 'border-white/10', icon: User };
                                                const Icon = roleConfig.icon;
                                                return (
                                                    <span className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border ${roleConfig.bg} ${roleConfig.color} ${roleConfig.border}`}>
                                                        <Icon className="w-3 h-3" />
                                                        {roleConfig.label}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-5 py-4 hidden md:table-cell">
                                            {member.discordUsername ? (
                                                <div className="flex items-center gap-2.5 text-sm text-zinc-400">
                                                    <div className="w-7 h-7 rounded-md bg-[#5865F2]/10 flex items-center justify-center border border-[#5865F2]/20">
                                                        <MessageCircle className="w-3.5 h-3.5 text-[#5865F2]" />
                                                    </div>
                                                    <span className="group-hover:text-zinc-200 transition-colors font-medium cursor-pointer truncate tracking-wide">@{member.discordUsername}</span>
                                                </div>
                                            ) : (
                                                <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md bg-white/5 border border-white/5">ไม่ได้เชื่อมต่อ</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs font-bold tabular-nums tracking-tight ${member.balance >= 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.1)]' : 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-[0_0_8px_rgba(244,63,94,0.1)]'}`}>
                                                <span>{member.balance >= 0 ? '+' : ''}{Math.abs(member.balance).toLocaleString()}</span>
                                                <span className="text-[10px] ml-0.5 opacity-80">฿</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            <span className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-widest uppercase border ${member.isActive
                                                ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/20'
                                                : 'bg-zinc-800 text-zinc-500 border-white/5'
                                                }`}>
                                                <Circle className={`w-1.5 h-1.5 ${member.isActive ? 'fill-emerald-400 text-emerald-400' : 'fill-zinc-500 text-zinc-500'}`} />
                                                {member.isActive ? 'Active' : 'Left'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-right">
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
                                                    className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-[#1a1a1a] rounded-lg transition-colors border border-transparent hover:border-white/5"
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
                                                            className="fixed w-48 bg-[#111] border border-white/10 rounded-xl shadow-xl z-50 py-1.5 animate-in fade-in zoom-in-95 duration-200"
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
                                                                className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-white/5 flex items-center gap-3 transition-colors tracking-wide"
                                                            >
                                                                <UserCog className="w-4 h-4" />
                                                                เปลี่ยนยศ
                                                            </button>

                                                            <Link
                                                                href={`/dashboard/${gangId}/members/${member.id}`}
                                                                className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-white/5 flex items-center gap-3 transition-colors tracking-wide"
                                                            >
                                                                <FileText className="w-4 h-4" />
                                                                ดูโปรไฟล์
                                                            </Link>

                                                            <button
                                                                onClick={() => {
                                                                    setEditingMember(member);
                                                                    setOpenDropdownId(null);
                                                                }}
                                                                className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-white/5 flex items-center gap-3 transition-colors tracking-wide"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                                แก้ไขข้อมูล
                                                            </button>

                                                            {member.gangRole !== 'OWNER' && (
                                                                <>
                                                                    <div className="h-px bg-white/5 my-1.5 mx-3" />
                                                                    <button
                                                                        onClick={() => {
                                                                            setKickTarget(member);
                                                                            setOpenDropdownId(null);
                                                                        }}
                                                                        className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 flex items-center gap-3 transition-colors tracking-wide"
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
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 px-2">
                    <span className="text-[11px] font-medium text-zinc-500 tracking-wide">
                        แสดงข้อมูล <span className="text-zinc-300">{startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, filteredMembers.length)}</span> จากทั้งหมด <span className="text-zinc-300">{filteredMembers.length}</span> รายการ
                    </span>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="p-1.5 rounded-lg bg-[#111] border border-white/5 text-zinc-500 hover:text-zinc-300 hover:bg-[#1a1a1a] hover:border-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>

                        <div className="flex items-center gap-1.5 bg-[#111] p-1 rounded-xl border border-white/5 shadow-sm">
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
                                        className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all ${page === currentPage
                                            ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-white/10'
                                            : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                                            }`}
                                    >
                                        {page}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="p-1.5 rounded-lg bg-[#111] border border-white/5 text-zinc-500 hover:text-zinc-300 hover:bg-[#1a1a1a] hover:border-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Modals */}
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
                description={<span className="text-zinc-400">คุณต้องการไล่ออก "{kickTarget?.name}" ใช่หรือไม่?<br /><br /><ul className="list-disc pl-5 space-y-1"><li>สมาชิกจะถูกลบยศในระบบ Discord</li><li>สถานะจะเปลี่ยนเป็นออกแล้ว</li><li>ประวัติการเงินต่างๆ จะยังคงอยู่</li></ul></span>}
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
