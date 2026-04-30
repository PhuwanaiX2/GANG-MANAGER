'use client';

import { useState } from 'react';
import Image from 'next/image';
import { AnnouncementModal } from '@/components/modals/AnnouncementModal';
import { Plus, Megaphone, Calendar, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, Badge, Button, EmptyState, InfoTip } from '@/components/ui';
import { cn } from '@/lib/cn';

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
            <div className="mb-5 flex flex-col gap-3 rounded-token-2xl border border-border-subtle bg-bg-subtle/95 p-3.5 shadow-token-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-accent-bright">Command Action</p>
                    <InfoTip
                        label="ประกาศ"
                        content="สร้างประกาศใหม่แล้วระบบจะพยายามส่งไปยังห้อง Discord ที่ตั้งค่าไว้ พร้อมเก็บประวัติไว้บนเว็บ"
                    />
                </div>
                <Button
                    variant="primary"
                    size="md"
                    leftIcon={<Plus className="w-4 h-4" />}
                    onClick={() => setShowModal(true)}
                    className="w-full !border-status-danger !bg-status-danger !text-fg-inverse shadow-token-sm hover:!brightness-110 sm:w-auto"
                >
                    สร้างประกาศใหม่
                </Button>
            </div>

            {/* Announcements List */}
            <div className="space-y-4">
                {announcements.length === 0 ? (
                    <Card variant="subtle" padding="none" className="border-dashed">
                        <EmptyState
                            icon={<Megaphone className="w-7 h-7" />}
                            title="ยังไม่มีประกาศ"
                            description="เริ่มสร้างประกาศแรกเพื่อบันทึกประวัติการสื่อสารสำคัญของแก๊ง"
                        />
                    </Card>
                ) : (
                    <>
                        <div className="overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle shadow-token-sm">
                            <div className="overflow-x-auto">
                                <table className="min-w-[900px] w-full text-left">
                                    <thead className="bg-bg-muted border-b border-border-subtle">
                                        <tr>
                                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">ประกาศ</th>
                                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">ผู้สร้าง</th>
                                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">สถานะ</th>
                                            <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-fg-tertiary">วันที่สร้าง</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border-subtle">
                                        {currentAnnouncements.map((announcement) => (
                                            <tr key={announcement.id} className="transition-colors hover:bg-bg-muted">
                                                <td className="px-4 py-4 align-top">
                                                    <div className="flex items-start gap-3">
                                                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-token-lg border border-border-subtle bg-bg-elevated text-fg-tertiary">
                                                            <Megaphone className="w-4 h-4" />
                                                        </span>
                                                        <div className="min-w-0">
                                                            <h2 className="line-clamp-1 text-sm font-black tracking-tight text-fg-primary font-heading">
                                                                {announcement.title}
                                                            </h2>
                                                            <p className="mt-1 line-clamp-2 max-w-2xl whitespace-pre-wrap text-xs leading-relaxed text-fg-secondary">
                                                                {announcement.content}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 align-top">
                                                    <div className="flex items-center gap-2 text-xs">
                                                        {announcement.authorAvatar ? (
                                                            <Image
                                                                src={announcement.authorAvatar}
                                                                alt={announcement.authorName}
                                                                width={22}
                                                                height={22}
                                                                className="h-5 w-5 rounded-token-full border border-border-subtle"
                                                            />
                                                        ) : (
                                                            <span className="flex h-5 w-5 items-center justify-center rounded-token-full border border-border-subtle bg-bg-muted text-fg-tertiary">
                                                                <User className="w-3.5 h-3.5" />
                                                            </span>
                                                        )}
                                                        <div className="min-w-0">
                                                            <div className="max-w-32 truncate font-bold text-fg-secondary">{announcement.authorName}</div>
                                                            {announcement.authorDiscordUsername && (
                                                                <div className="max-w-32 truncate text-[10px] text-fg-tertiary">@{announcement.authorDiscordUsername}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 align-top">
                                                    {announcement.discordMessageId ? (
                                                        <Badge tone="success" variant="soft" size="sm">
                                                            ส่งไป Discord แล้ว
                                                        </Badge>
                                                    ) : (
                                                        <span className="inline-flex rounded-token-full border border-border-subtle bg-bg-muted px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-fg-tertiary">
                                                            Draft
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 align-top text-right text-xs font-medium text-fg-tertiary whitespace-nowrap">
                                                    <div className="inline-flex items-center justify-end gap-1.5 tabular-nums">
                                                        <Calendar className="w-3.5 h-3.5" />
                                                        {new Date(announcement.createdAt).toLocaleDateString('th-TH', {
                                                            timeZone: 'Asia/Bangkok',
                                                            year: 'numeric',
                                                            month: 'short',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 pt-4">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    aria-label="Previous page"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </Button>

                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                    <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        className={cn(
                                            'w-10 h-10 rounded-token-md text-sm font-bold tabular-nums transition-colors duration-token-normal ease-token-standard',
                                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base',
                                            page === currentPage
                                                ? 'bg-accent text-accent-fg shadow-token-sm'
                                                : 'bg-bg-subtle border border-border-subtle text-fg-secondary hover:text-fg-primary hover:bg-bg-muted hover:border-border'
                                        )}
                                    >
                                        {page}
                                    </button>
                                ))}

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    aria-label="Next page"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </Button>
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
