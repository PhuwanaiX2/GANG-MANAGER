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
    Wallet,
    Circle,
    MessageCircle,
    MoreHorizontal,
    Shield,
    UserCog,
    ChevronLeft,
    ChevronRight,
    Search
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

    const filteredMembers = members.filter(m => {
        const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase()) || (m.discordUsername || '').toLowerCase().includes(search.toLowerCase());
        const matchRole = roleFilter === 'ALL' || m.gangRole === roleFilter;
        return matchSearch && matchRole;
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
        <>
            <div className="bg-[#151515] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
                <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="ค้นหาชื่อสมาชิก..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                            className="bg-black/40 border border-white/10 text-white text-xs rounded-lg pl-8 pr-3 py-2 outline-none focus:border-white/20 w-full sm:w-56"
                        />
                    </div>
                    <select
                        value={roleFilter}
                        onChange={e => { setRoleFilter(e.target.value); setCurrentPage(1); }}
                        className="bg-black/40 border border-white/10 text-white text-xs rounded-lg px-3 py-2 outline-none"
                    >
                        <option value="ALL">ทุกยศ</option>
                        <option value="MEMBER">สมาชิก</option>
                        <option value="ADMIN">รองหัวหน้า</option>
                        <option value="TREASURER">เหรัญญิก</option>
                    </select>
                    <span className="text-[10px] text-gray-500">{filteredMembers.length} คน</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-black/20 text-gray-400 text-xs uppercase font-semibold tracking-wider">
                            <tr>
                                <th className="px-6 py-4 text-left">สมาชิก</th>
                                <th className="px-6 py-4 text-center hidden sm:table-cell">ยศ</th>
                                <th className="px-6 py-4 text-left hidden md:table-cell">Discord</th>
                                <th className="px-6 py-4 text-right">ยอดเงิน</th>
                                <th className="px-6 py-4 text-center">สถานะ</th>
                                <th className="px-6 py-4 text-right">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {members.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <User className="w-10 h-10 opacity-20" />
                                            <span>ยังไม่มีสมาชิกในแก๊ง</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedMembers.map((member) => (
                                    <tr key={member.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className="relative">
                                                    {member.discordAvatar ? (
                                                        <Image
                                                            src={member.discordAvatar}
                                                            alt={member.name}
                                                            width={40}
                                                            height={40}
                                                            className="rounded-full border-2 border-white/5 group-hover:border-discord-primary/50 transition-colors"
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 bg-discord-primary/10 text-discord-primary rounded-full flex items-center justify-center font-bold border-2 border-transparent">
                                                            {member.name[0]?.toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#151515] ${member.isActive ? 'bg-green-500' : 'bg-gray-500'}`} />
                                                </div>
                                                <div>
                                                    <Link
                                                        href={`/dashboard/${gangId}/members/${member.id}`}
                                                        className="font-medium text-white hover:text-discord-primary transition-colors"
                                                    >
                                                        {member.name}
                                                    </Link>

                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center hidden sm:table-cell">
                                            {(() => {
                                                const role = member.gangRole || 'MEMBER';
                                                const roleConfig = {
                                                    ADMIN: { label: 'แอดมิน', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: Shield },
                                                    TREASURER: { label: 'เหรัญญิก', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', icon: Wallet },
                                                    MEMBER: { label: 'สมาชิก', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: User },
                                                }[role] || { label: role, color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20', icon: User };
                                                const Icon = roleConfig.icon;
                                                return (
                                                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${roleConfig.bg} ${roleConfig.color} ${roleConfig.border}`}>
                                                        <Icon className="w-3 h-3" />
                                                        {roleConfig.label}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-6 py-4 hidden md:table-cell">
                                            {member.discordUsername ? (
                                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                                    <div className="w-6 h-6 rounded-full bg-[#5865F2]/10 flex items-center justify-center">
                                                        <MessageCircle className="w-3 h-3 text-[#5865F2]" />
                                                    </div>
                                                    <span className="hover:text-discord-primary transition-colors cursor-pointer">@{member.discordUsername}</span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-600 text-sm italic">ไม่ได้เชื่อมต่อ</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono">
                                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${member.balance >= 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                                <Wallet className="w-3 h-3" />
                                                <span className="font-bold">฿{member.balance.toLocaleString()}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${member.isActive
                                                ? 'bg-green-500/5 text-green-400 border-green-500/20'
                                                : 'bg-red-500/5 text-red-400 border-red-500/20'
                                                }`}>
                                                <Circle className={`w-2 h-2 ${member.isActive ? 'fill-green-400' : 'fill-red-400'}`} />
                                                {member.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
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
                                                    className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                                                >
                                                    <MoreHorizontal className="w-5 h-5" />
                                                </button>

                                                {openDropdownId === member.id && (
                                                    <>
                                                        <div
                                                            className="fixed inset-0 z-40"
                                                            onClick={() => setOpenDropdownId(null)}
                                                        />
                                                        <div
                                                            className="fixed w-48 bg-[#1A1A1A] border border-white/10 rounded-xl shadow-xl z-50 py-1 animate-in fade-in zoom-in-95 duration-200"
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
                                                                className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 flex items-center gap-2 transition-colors"
                                                            >
                                                                <UserCog className="w-4 h-4" />
                                                                เปลี่ยนยศ
                                                            </button>

                                                            <button
                                                                onClick={() => {
                                                                    setEditingMember(member);
                                                                    setOpenDropdownId(null);
                                                                }}
                                                                className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 flex items-center gap-2 transition-colors"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                                แก้ไขข้อมูล
                                                            </button>

                                                            {member.gangRole !== 'OWNER' && (
                                                                <>
                                                                    <div className="h-px bg-white/5 my-1" />
                                                                    <button
                                                                        onClick={() => {
                                                                            setKickTarget(member);
                                                                            setOpenDropdownId(null);
                                                                        }}
                                                                        className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
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
                <div className="flex items-center justify-center gap-2 mt-4">
                    <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="p-2 rounded-lg bg-black/20 border border-white/5 text-gray-400 hover:text-white hover:bg-black/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-1">
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
                                    className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${page === currentPage
                                        ? 'bg-discord-primary text-white'
                                        : 'bg-black/20 border border-white/5 text-gray-400 hover:text-white hover:bg-black/30'
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
                        className="p-2 rounded-lg bg-black/20 border border-white/5 text-gray-400 hover:text-white hover:bg-black/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>

                    <span className="text-xs text-gray-500 ml-2">
                        {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, members.length)} จาก {members.length}
                    </span>
                </div>
            )}

            {/* Edit Modal */}
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
                title="ยืนยันการไล่ออกพนักงาน? (Kick)"
                description={`คุณต้องการไล่ออก "**${kickTarget?.name}**" หรือไม่?\n\n- สมาชิกจะถูกลบยศใน Discord\n- สถานะจะเปลี่ยนเป็น Rejected\n- สามารถสมัครใหม่ได้ภายหลัง`}
                confirmText="ยืนยัน ไล่ออก"
                cancelText="ยกเลิก"
                type="danger"
                icon={UserMinus}
                isProcessing={isDeleting}
            />

            {/* Role Modal */}
            {roleTarget && (
                <MemberRoleModal
                    isOpen={!!roleTarget}
                    onClose={() => setRoleTarget(null)}
                    member={roleTarget}
                    gangId={gangId}
                />
            )}
        </>
    );
}
