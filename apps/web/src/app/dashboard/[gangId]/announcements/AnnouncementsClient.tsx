'use client';

import { useState } from 'react';
import Image from 'next/image';
import { AnnouncementModal } from '@/components/modals/AnnouncementModal';
import { Plus, Megaphone, Calendar, User, ChevronLeft, ChevronRight } from 'lucide-react';

interface Announcement {
    id: string;
    title: string;
    content: string;
    authorName: string;
    discordMessageId: string | null;
    createdAt: Date;
    authorAvatar: string | null;
    authorDiscordUsername: string | null;
}

interface Props {
    announcements: Announcement[];
    gangId: string;
}

const ITEMS_PER_PAGE = 5;

export function AnnouncementsClient({ announcements, gangId }: Props) {
    const [showModal, setShowModal] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    const totalPages = Math.ceil(announcements.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentAnnouncements = announcements.slice(startIndex, endIndex);

    return (
        <>
            {/* Create Button */}
            <div className="mb-6">
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                    <Plus className="w-5 h-5" />
                    สร้างประกาศใหม่
                </button>
            </div>

            {/* Announcements List */}
            <div className="space-y-4">
                {announcements.length === 0 ? (
                    <div className="bg-[#151515] border border-white/5 rounded-2xl p-12 text-center">
                        <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Megaphone className="w-8 h-8 text-blue-500/50" />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">ยังไม่มีประกาศ</h3>
                        <p className="text-gray-500 text-sm">กดปุ่มด้านบนเพื่อสร้างประกาศใหม่</p>
                    </div>
                ) : (
                    <>
                        {currentAnnouncements.map((announcement) => (
                            <div
                                key={announcement.id}
                                className="bg-[#151515] border border-white/5 rounded-2xl p-6 hover:border-blue-500/20 transition-colors"
                            >
                                <div className="flex items-start justify-between gap-4 mb-3">
                                    <div className="flex items-center gap-2 text-blue-400">
                                        <Megaphone className="w-5 h-5" />
                                        <span className="text-sm font-medium">ประกาศ</span>
                                    </div>
                                    {announcement.discordMessageId && (
                                        <span className="text-xs bg-green-500/10 text-green-400 px-2 py-1 rounded-full border border-green-500/20">
                                            ✓ ส่งแล้ว
                                        </span>
                                    )}
                                </div>

                                <p className="text-gray-300 whitespace-pre-wrap mb-4 text-sm leading-relaxed">
                                    {announcement.content}
                                </p>

                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                    <div className="flex items-center gap-1.5">
                                        {announcement.authorAvatar ? (
                                            <Image
                                                src={announcement.authorAvatar}
                                                alt={announcement.authorName}
                                                width={16}
                                                height={16}
                                                className="w-4 h-4 rounded-full"
                                            />
                                        ) : (
                                            <User className="w-3.5 h-3.5" />
                                        )}
                                        <span>{announcement.authorName}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5" />
                                        <span>
                                            {new Date(announcement.createdAt).toLocaleDateString('th-TH', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 pt-4">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 rounded-lg bg-black/20 border border-white/5 text-gray-400 hover:text-white hover:bg-black/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>

                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                    <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${page === currentPage
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-black/20 border border-white/5 text-gray-400 hover:text-white hover:bg-black/30'
                                            }`}
                                    >
                                        {page}
                                    </button>
                                ))}

                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-2 rounded-lg bg-black/20 border border-white/5 text-gray-400 hover:text-white hover:bg-black/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Modal */}
            <AnnouncementModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                gangId={gangId}
            />
        </>
    );
}
