'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
    Clock,
    ChevronLeft,
    ChevronRight,
    User
} from 'lucide-react';

interface AttendanceRecord {
    id: string;
    status: string;
    checkedInAt: Date | null;
    penaltyAmount: number;
    member: {
        id: string;
        name: string;
        discordAvatar?: string | null;
        discordUsername?: string | null;
    };
}

interface Member {
    id: string;
    name: string;
    discordAvatar?: string | null;
    discordUsername?: string | null;
}

interface Props {
    records: AttendanceRecord[];
    notCheckedIn: Member[];
    isSessionActive: boolean;
}

export function AttendanceSessionDetail({ records, notCheckedIn, isSessionActive }: Props) {
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    // Combine records and not checked in members for unified list
    const allItems = [
        ...records.map(r => ({ type: 'record', data: r })),
        ...(isSessionActive ? notCheckedIn.map(m => ({ type: 'member', data: m })) : [])
    ];

    const totalPages = Math.ceil(allItems.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedItems = allItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const statusColors: Record<string, string> = {
        PRESENT: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.2)]',
        ABSENT: 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-[0_0_8px_rgba(244,63,94,0.2)]',
        LEAVE: 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[0_0_8px_rgba(59,130,246,0.2)]',
    };

    const statusLabels: Record<string, string> = {
        PRESENT: 'มา',
        ABSENT: 'ขาด',
        LEAVE: 'ลา',
    };

    return (
        <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 sm:p-5 border-b border-white/5 bg-[#151515]">
                <h3 className="font-semibold text-white tracking-wide">รายชื่อผู้เข้าร่วม</h3>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-white/5 text-left text-zinc-500 text-[11px] font-bold uppercase tracking-wider bg-[#0a0a0a]">
                            <th className="px-5 py-4">สมาชิก</th>
                            <th className="px-5 py-4">สถานะ</th>
                            <th className="px-5 py-4">เวลาเช็คชื่อ</th>
                            <th className="px-5 py-4 text-right">ค่าปรับ</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {paginatedItems.map((item, index) => {
                            if (item.type === 'record') {
                                const record = item.data as AttendanceRecord;
                                return (
                                    <tr key={record.id} className="hover:bg-[#151515] transition-colors group">
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    {record.member.discordAvatar ? (
                                                        <Image
                                                            src={record.member.discordAvatar}
                                                            alt={record.member.name}
                                                            width={32}
                                                            height={32}
                                                            className="w-8 h-8 rounded-full ring-2 ring-white/5 group-hover:ring-white/10 transition-all object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center ring-2 ring-white/5 group-hover:ring-white/10 transition-all">
                                                            <User className="w-4 h-4 text-zinc-500" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-zinc-200 font-medium text-sm group-hover:text-white transition-colors tracking-wide">{record.member.name}</span>
                                                    {record.member.discordUsername && (
                                                        <span className="text-[10px] text-zinc-600 font-medium tracking-wide">@{record.member.discordUsername}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className={`text-[10px] px-2.5 py-1 rounded-md font-bold tracking-widest uppercase border inline-flex items-center justify-center ${statusColors[record.status]}`}>
                                                {statusLabels[record.status]}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-zinc-400 text-[13px] font-medium tracking-wide tabular-nums">
                                            {record.checkedInAt
                                                ? new Date(record.checkedInAt).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false })
                                                : '-'}
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            {record.penaltyAmount > 0 ? (
                                                <span className="text-rose-400 font-bold tabular-nums tracking-tight bg-rose-500/10 px-2.5 py-1 rounded-md border border-rose-500/20 text-xs">
                                                    {record.penaltyAmount.toLocaleString()} ฿
                                                </span>
                                            ) : (
                                                <span className="text-zinc-600 font-medium">-</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            } else {
                                const member = item.data as Member;
                                return (
                                    <tr key={member.id} className="bg-black/20 group">
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-3 opacity-60 group-hover:opacity-100 transition-opacity">
                                                <div className="relative">
                                                    {member.discordAvatar ? (
                                                        <Image
                                                            src={member.discordAvatar}
                                                            alt={member.name}
                                                            width={32}
                                                            height={32}
                                                            className="w-8 h-8 rounded-full ring-2 ring-white/5 grayscale object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center ring-2 ring-white/5">
                                                            <User className="w-4 h-4 text-zinc-600" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-zinc-400 font-medium text-sm tracking-wide">{member.name}</span>
                                                    {member.discordUsername && (
                                                        <span className="text-[10px] text-zinc-600 font-medium tracking-wide">@{member.discordUsername}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className="text-[10px] px-2.5 py-1 rounded-md font-bold tracking-widest uppercase border bg-white/5 text-zinc-400 border-white/10 flex items-center gap-1.5 w-fit">
                                                <Clock className="w-3 h-3 text-zinc-500" />
                                                ยังไม่เข้า
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-zinc-600 text-[13px] font-medium">-</td>
                                        <td className="px-5 py-3.5 text-right text-zinc-600 font-medium">-</td>
                                    </tr>
                                );
                            }
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-4 border-t border-white/5 bg-[#0a0a0a]">
                    <span className="text-[11px] font-medium text-zinc-500 tracking-wide">
                        แสดง <span className="text-zinc-300">{startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, allItems.length)}</span> จาก <span className="text-zinc-300">{allItems.length}</span> รายการ
                    </span>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="p-1.5 rounded-lg bg-[#111] border border-white/5 text-zinc-500 hover:text-zinc-300 hover:bg-[#1a1a1a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>

                        <div className="flex items-center gap-1 bg-[#111] p-1 rounded-xl border border-white/5 shadow-sm">
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
                            className="p-1.5 rounded-lg bg-[#111] border border-white/5 text-zinc-500 hover:text-zinc-300 hover:bg-[#1a1a1a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
