'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import Image from 'next/image';
import { Check, X, Clock, Calendar, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface Props {
    requests: (any & { reviewer?: any })[]; // We'll rely on the runtime check/display for member fields
    gangId: string;
}

// Helper to get avatar
const getAvatarUrl = (member: any) => {
    if (member?.discordAvatar) return member.discordAvatar;
    return null;
};

export function LeaveRequestList({ requests, gangId }: Props) {
    const router = useRouter();
    const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    const filteredRequests = requests.filter(r => r.status === filter);
    const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedRequests = filteredRequests.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const handleFilterChange = (newFilter: 'PENDING' | 'APPROVED' | 'REJECTED') => {
        setFilter(newFilter);
        setCurrentPage(1);
    };

    const handleAction = async (requestId: string, action: 'approve' | 'reject', data?: { startDate?: Date, endDate?: Date }) => {
        setProcessingId(requestId);
        try {
            const res = await fetch(`/api/gangs/${gangId}/leaves/${requestId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: action === 'approve' ? 'APPROVED' : 'REJECTED',
                    startDate: data?.startDate,
                    endDate: data?.endDate
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error || 'Failed to update');
            }

            toast.success(action === 'approve' ? 'อนุมัติเรียบร้อย' : 'ปฏิเสธเรียบร้อย');
            router.refresh();
        } catch (error: any) {
            console.error(error);
            toast.error(error?.message || 'เกิดข้อผิดพลาด');
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div>
            {/* Find Tabs */}
            <div className="flex gap-2 mb-6 p-1 bg-white/5 rounded-xl w-fit">
                <button
                    onClick={() => handleFilterChange('PENDING')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === 'PENDING' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
                        }`}
                >
                    รออนุมัติ ({requests.filter(r => r.status === 'PENDING').length})
                </button>
                <button
                    onClick={() => handleFilterChange('APPROVED')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === 'APPROVED' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
                        }`}
                >
                    อนุมัติแล้ว
                </button>
                <button
                    onClick={() => handleFilterChange('REJECTED')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === 'REJECTED' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
                        }`}
                >
                    ปฏิเสธ
                </button>
            </div>

            <div className="space-y-3">
                {filteredRequests.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 border border-dashed border-white/10 rounded-2xl">
                        ไม่พบรายการ
                    </div>
                ) : (
                    paginatedRequests.map((req) => (
                        <div key={req.id} className="bg-[#151515] border border-white/5 rounded-xl p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                            <div className="flex items-start gap-4">
                                {/* Type Icon or Avatar */}
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden ${req.type === 'FULL' ? 'bg-red-500/10 text-red-400' : 'bg-yellow-500/10 text-yellow-400'
                                    }`}>
                                    {getAvatarUrl(req.member) ? (
                                        <Image
                                            src={getAvatarUrl(req.member)}
                                            alt={req.member?.name}
                                            width={40}
                                            height={40}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        req.type === 'FULL' ? <Calendar className="w-5 h-5" /> : <Clock className="w-5 h-5" />
                                    )}
                                </div>

                                <div>
                                    <h3 className="font-bold text-white flex items-center gap-2">
                                        {req.member?.name || 'Unknown Member'}
                                        <span className={`text-xs px-2 py-0.5 rounded-full border ${req.type === 'FULL'
                                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                            : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                            }`}>
                                            {req.type === 'FULL' ? 'ลาหยุด' : 'เข้าช้า'}
                                        </span>
                                    </h3>
                                    <div className="text-sm text-gray-400 mt-1 space-y-1">
                                        {req.type === 'FULL' ? (
                                            <p>📅 {format(new Date(req.startDate), 'dd MMM yyyy', { locale: th })} - {format(new Date(req.endDate), 'dd MMM yyyy', { locale: th })}</p>
                                        ) : (
                                            <p>⏰ จะเข้า {format(new Date(req.startDate), 'HH:mm', { locale: th })} น.</p>
                                        )}
                                        <p className="text-gray-300">📝 "{req.reason}"</p>

                                        {req.reviewer && (filter === 'APPROVED' || filter === 'REJECTED') && (
                                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5">
                                                <span className="text-xs text-gray-500">
                                                    {filter === 'APPROVED' ? 'อนุมัติโดย' : 'ปฏิเสธโดย'}:
                                                </span>
                                                <span className="text-xs text-white bg-white/10 px-2 py-0.5 rounded-full">
                                                    {req.reviewer.name}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">
                                        ส่งเมื่อ {format(new Date(req.requestedAt), 'dd/MM/yy HH:mm', { locale: th })}
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-2 w-full md:w-auto items-end">
                                {filter === 'PENDING' && (
                                    <>
                                        {/* Date editors only for FULL leave */}
                                        {req.type === 'FULL' && (
                                            <>
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">Start</span>
                                                    <input
                                                        type="date"
                                                        className="bg-black/20 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                                                        defaultValue={format(new Date(req.startDate), 'yyyy-MM-dd')}
                                                        id={`start-${req.id}`}
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">End</span>
                                                    <input
                                                        type="date"
                                                        className="bg-black/20 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                                                        defaultValue={format(new Date(req.endDate), 'yyyy-MM-dd')}
                                                        id={`end-${req.id}`}
                                                    />
                                                </div>
                                            </>
                                        )}

                                        <button
                                            onClick={() => handleAction(req.id, 'reject')}
                                            disabled={!!processingId}
                                            className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                                        >
                                            ปฏิเสธ
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (req.type === 'FULL') {
                                                    const startEl = document.getElementById(`start-${req.id}`) as HTMLInputElement;
                                                    const endEl = document.getElementById(`end-${req.id}`) as HTMLInputElement;
                                                    handleAction(req.id, 'approve', {
                                                        startDate: startEl?.value ? new Date(startEl.value) : undefined,
                                                        endDate: endEl?.value ? new Date(endEl.value) : undefined
                                                    });
                                                } else {
                                                    handleAction(req.id, 'approve');
                                                }
                                            }}
                                            disabled={!!processingId}
                                            className="flex items-center gap-1 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-medium shadow-lg shadow-green-500/20 transition-all disabled:opacity-50"
                                        >
                                            {processingId === req.id ? (
                                                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <>
                                                    <Check className="w-3 h-3" />
                                                    อนุมัติ
                                                </>
                                            )}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))
                )}
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
                        {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, filteredRequests.length)} จาก {filteredRequests.length}
                    </span>
                </div>
            )}
        </div>
    );
}
