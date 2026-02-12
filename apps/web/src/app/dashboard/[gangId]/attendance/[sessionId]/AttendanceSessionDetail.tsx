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
        PRESENT: 'bg-green-500/10 text-green-400 border-green-500/20',
        ABSENT: 'bg-red-500/10 text-red-400 border-red-500/20',
        LEAVE: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    };

    const statusLabels: Record<string, string> = {
        PRESENT: 'มา',
        ABSENT: 'ขาด',
        LEAVE: 'ลา',
    };

    return (
        <div className="bg-[#151515] border border-white/5 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/5">
                <h3 className="font-bold text-white">รายชื่อ</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-white/5 text-left text-gray-400 text-sm">
                            <th className="px-4 py-3">สมาชิก</th>
                            <th className="px-4 py-3">สถานะ</th>
                            <th className="px-4 py-3">เวลาเช็คชื่อ</th>
                            <th className="px-4 py-3">ค่าปรับ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedItems.map((item, index) => {
                            if (item.type === 'record') {
                                const record = item.data as AttendanceRecord;
                                return (
                                    <tr key={record.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                                        <td className="px-4 py-3 text-white font-medium">
                                            <div className="flex items-center gap-2">
                                                {record.member.discordAvatar ? (
                                                    <Image
                                                        src={record.member.discordAvatar}
                                                        alt={record.member.name}
                                                        width={24}
                                                        height={24}
                                                        className="w-6 h-6 rounded-full"
                                                    />
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                                                        <User className="w-3 h-3 text-gray-400" />
                                                    </div>
                                                )}
                                                <span>{record.member.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs px-2 py-1 rounded-full border ${statusColors[record.status]}`}>
                                                {statusLabels[record.status]}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-400 text-sm">
                                            {record.checkedInAt
                                                ? new Date(record.checkedInAt).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false })
                                                : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            {record.penaltyAmount > 0 ? (
                                                <span className="text-red-400">{record.penaltyAmount.toLocaleString()} บาท</span>
                                            ) : (
                                                <span className="text-gray-500">-</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            } else {
                                const member = item.data as Member;
                                return (
                                    <tr key={member.id} className="border-b border-white/5 bg-white/[0.01]">
                                        <td className="px-4 py-3 text-gray-400">
                                            <div className="flex items-center gap-2">
                                                {member.discordAvatar ? (
                                                    <Image
                                                        src={member.discordAvatar}
                                                        alt={member.name}
                                                        width={24}
                                                        height={24}
                                                        className="w-6 h-6 rounded-full grayscale opacity-70"
                                                    />
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center">
                                                        <User className="w-3 h-3 text-gray-600" />
                                                    </div>
                                                )}
                                                <span>{member.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-xs px-2 py-1 rounded-full border bg-gray-500/10 text-gray-400 border-gray-500/20 flex items-center gap-1 w-fit">
                                                <Clock className="w-3 h-3" />
                                                ยังไม่เช็คชื่อ
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 text-sm">-</td>
                                        <td className="px-4 py-3 text-gray-500 text-sm">-</td>
                                    </tr>
                                );
                            }
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 py-4 border-t border-white/5">
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
                        {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, allItems.length)} จาก {allItems.length}
                    </span>
                </div>
            )}
        </div>
    );
}
