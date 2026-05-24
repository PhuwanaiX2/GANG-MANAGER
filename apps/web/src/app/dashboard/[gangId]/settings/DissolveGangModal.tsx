'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Hash, Loader2, RefreshCw, ShieldAlert, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ModalLayer } from '@/components/ui';
import { logClientError } from '@/lib/clientLogger';

interface Props {
    gangId: string;
    gangName: string;
    isOpen: boolean;
    onClose: () => void;
}

type CleanupChannel = {
    id: string;
    name: string;
    parentName: string | null;
    canPreserve: boolean;
    forceDelete: boolean;
    defaultPreserve: boolean;
};

export function DissolveGangModal({ gangId, gangName, isOpen, onClose }: Props) {
    const router = useRouter();
    const [confirmText, setConfirmText] = useState('');
    const [selectedChannelIds, setSelectedChannelIds] = useState<Set<string>>(new Set());
    const [channels, setChannels] = useState<CleanupChannel[]>([]);
    const [isLoadingChannels, setIsLoadingChannels] = useState(false);
    const [channelLoadError, setChannelLoadError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const selectableChannels = useMemo(() => channels.filter(channel => channel.canPreserve), [channels]);
    const forcedDeleteChannels = useMemo(() => channels.filter(channel => channel.forceDelete), [channels]);
    const selectedCount = selectedChannelIds.size;

    const loadChannels = useCallback(async (signal?: AbortSignal) => {
        setIsLoadingChannels(true);
        setChannelLoadError(null);

        try {
            const res = await fetch(`/api/gangs/${gangId}/dissolve`, { signal });
            if (!res.ok) {
                const error = await res.json().catch(() => ({}));
                throw new Error(error.error || 'โหลดรายการห้อง Discord ไม่สำเร็จ');
            }

            const data = await res.json();
            const nextChannels = Array.isArray(data.channels) ? data.channels as CleanupChannel[] : [];
            setChannels(nextChannels);
            setSelectedChannelIds(new Set(
                nextChannels
                    .filter(channel => channel.canPreserve && channel.defaultPreserve)
                    .map(channel => channel.id)
            ));
        } catch (error) {
            if ((error as { name?: string }).name === 'AbortError') return;
            setChannelLoadError(error instanceof Error ? error.message : 'โหลดรายการห้อง Discord ไม่สำเร็จ');
        } finally {
            setIsLoadingChannels(false);
        }
    }, [gangId]);

    useEffect(() => {
        if (!isOpen) return;

        const controller = new AbortController();
        void loadChannels(controller.signal);
        return () => controller.abort();
    }, [isOpen, loadChannels]);

    if (!isOpen) return null;

    const toggleChannel = (channelId: string) => {
        setSelectedChannelIds(previous => {
            const next = new Set(previous);
            if (next.has(channelId)) {
                next.delete(channelId);
            } else {
                next.add(channelId);
            }
            return next;
        });
    };

    const handleSelectAll = () => {
        setSelectedChannelIds(new Set(selectableChannels.map(channel => channel.id)));
    };

    const handleClearSelection = () => {
        setSelectedChannelIds(new Set());
    };

    const handleDissolve = async () => {
        if (confirmText !== gangName) return;

        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/gangs/${gangId}/dissolve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deleteData: true,
                    confirmationText: confirmText,
                    discordChannelCleanupMode: 'KEEP_SELECTED',
                    preserveDiscordChannelIds: Array.from(selectedChannelIds),
                }),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'ยุบแก๊งไม่สำเร็จ');
            }

            toast.success('ยุบแก๊งเรียบร้อยแล้ว');
            router.push('/dashboard');
            router.refresh();
        } catch (error) {
            logClientError('dashboard.settings.dissolve.failed', error, {
                gangId,
                deleteData: true,
                discordChannelCleanupMode: 'KEEP_SELECTED',
                preserveDiscordChannelIds: Array.from(selectedChannelIds),
            });
            toast.error('เกิดข้อผิดพลาดในการยุบแก๊ง');
            setIsSubmitting(false);
        }
    };

    return (
        <ModalLayer onClose={isSubmitting ? undefined : onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Dissolve gang"
                className="max-h-[calc(100dvh-1rem)] w-full max-w-2xl overflow-y-auto rounded-token-xl border border-status-danger/70 bg-bg-raised shadow-token-lg animate-in zoom-in-95 duration-200"
            >
                <div className="border-b border-border-subtle p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-token-lg bg-status-danger-subtle">
                            <AlertTriangle className="h-5 w-5 text-fg-danger" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-base font-black text-fg-primary">ยืนยันการยุบแก๊ง?</h3>
                            <p className="mt-1 text-sm leading-6 text-fg-secondary">
                                ระบบจะลบยศ Discord ทั้งหมดและลบข้อมูลแก๊งในเว็บทันที เลือกได้เฉพาะห้องข้อความที่ต้องการเก็บไว้
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-4 p-4 sm:p-5">
                    <div className="rounded-token-lg border border-status-danger/70 bg-status-danger-subtle p-3">
                        <div className="flex gap-3">
                            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-fg-danger" />
                            <div>
                                <p className="text-sm font-black text-fg-primary">ลบข้อมูลถาวร</p>
                                <p className="mt-1 text-xs leading-5 text-fg-secondary">
                                    ประวัติการเงิน เช็คชื่อ สมาชิก และการตั้งค่าของแก๊งจะถูกลบออกจากฐานข้อมูลและกู้คืนเองไม่ได้
                                </p>
                            </div>
                        </div>
                    </div>

                    <section className="rounded-token-lg border border-border-subtle bg-bg-subtle p-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <p className="text-xs font-black uppercase tracking-wide text-fg-tertiary">Discord channel cleanup</p>
                                <h4 className="mt-1 text-sm font-black text-fg-primary">เลือกห้องข้อความที่จะเก็บไว้</h4>
                                <p className="mt-1 text-xs leading-5 text-fg-secondary">
                                    ห้องระบบหรือห้องที่มีปุ่มของบอทจะถูกลบเสมอ เพื่อไม่ให้ปุ่มเก่าทำงานผิดหลังยุบแก๊ง
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => loadChannels()}
                                disabled={isLoadingChannels || isSubmitting}
                                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-token-lg border border-border-subtle bg-bg-muted px-3 text-xs font-black text-fg-primary transition hover:bg-bg-elevated disabled:opacity-60"
                            >
                                <RefreshCw className={`h-4 w-4 ${isLoadingChannels ? 'animate-spin' : ''}`} />
                                โหลดใหม่
                            </button>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={handleSelectAll}
                                disabled={selectableChannels.length === 0 || isSubmitting}
                                className="rounded-token-full border border-border-accent bg-accent-subtle px-3 py-1.5 text-xs font-black text-accent-bright disabled:opacity-50"
                            >
                                เลือกทั้งหมดที่เก็บได้
                            </button>
                            <button
                                type="button"
                                onClick={handleClearSelection}
                                disabled={selectedCount === 0 || isSubmitting}
                                className="rounded-token-full border border-border-subtle bg-bg-muted px-3 py-1.5 text-xs font-black text-fg-secondary disabled:opacity-50"
                            >
                                ไม่เก็บห้องแชท
                            </button>
                            <span className="rounded-token-full bg-bg-muted px-3 py-1.5 text-xs font-bold text-fg-secondary">
                                เก็บไว้ {selectedCount} ห้อง
                            </span>
                        </div>

                        {channelLoadError && (
                            <div className="mt-3 rounded-token-lg border border-status-warning bg-status-warning-subtle px-3 py-2 text-xs leading-5 text-fg-secondary">
                                {channelLoadError} ถ้าดำเนินการต่อ ระบบจะลบทุกห้องในหมวดที่บอทดูแล
                            </div>
                        )}

                        <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                            {isLoadingChannels && (
                                <div className="space-y-2">
                                    {[0, 1, 2].map(item => (
                                        <div key={item} className="h-12 animate-pulse rounded-token-lg bg-bg-muted" />
                                    ))}
                                </div>
                            )}

                            {!isLoadingChannels && selectableChannels.length === 0 && !channelLoadError && (
                                <div className="rounded-token-lg border border-dashed border-border-subtle bg-bg-muted p-4 text-center text-xs text-fg-secondary">
                                    ไม่พบห้องข้อความที่เลือกเก็บได้
                                </div>
                            )}

                            {!isLoadingChannels && selectableChannels.map(channel => (
                                <label
                                    key={channel.id}
                                    className="flex cursor-pointer items-center gap-3 rounded-token-lg border border-border-subtle bg-bg-muted px-3 py-2 transition hover:bg-bg-elevated"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedChannelIds.has(channel.id)}
                                        onChange={() => toggleChannel(channel.id)}
                                        disabled={isSubmitting}
                                        className="h-4 w-4"
                                    />
                                    <Hash className="h-4 w-4 shrink-0 text-fg-tertiary" />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-black text-fg-primary">{channel.name}</span>
                                        {channel.parentName && (
                                            <span className="block truncate text-xs text-fg-tertiary">{channel.parentName}</span>
                                        )}
                                    </span>
                                </label>
                            ))}
                        </div>

                        {forcedDeleteChannels.length > 0 && (
                            <div className="mt-3 rounded-token-lg border border-border-subtle bg-bg-muted p-3">
                                <div className="mb-2 flex items-center gap-2 text-xs font-black text-fg-secondary">
                                    <Trash2 className="h-4 w-4 text-fg-danger" />
                                    ห้องระบบที่จะถูกลบเสมอ
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {forcedDeleteChannels.slice(0, 12).map(channel => (
                                        <span key={channel.id} className="rounded-token-full border border-border-subtle bg-bg-subtle px-2 py-1 text-xs font-bold text-fg-tertiary">
                                            #{channel.name}
                                        </span>
                                    ))}
                                    {forcedDeleteChannels.length > 12 && (
                                        <span className="rounded-token-full bg-bg-subtle px-2 py-1 text-xs font-bold text-fg-tertiary">
                                            +{forcedDeleteChannels.length - 12} ห้อง
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </section>

                    <div className="space-y-1.5 text-left">
                        <label className="text-xs font-medium text-fg-secondary">
                            พิมพ์ชื่อแก๊ง <span className="font-bold text-fg-primary">"{gangName}"</span> เพื่อยืนยัน
                        </label>
                        <input
                            type="text"
                            value={confirmText}
                            onChange={(event) => setConfirmText(event.target.value)}
                            className="min-h-11 w-full rounded-token-lg border border-border-subtle bg-bg-subtle px-3 py-2 text-fg-primary placeholder:text-fg-tertiary transition-colors focus:border-status-danger focus:outline-none"
                            placeholder={gangName}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-border-subtle p-4 sm:p-5">
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="min-h-11 rounded-token-lg bg-bg-muted px-4 py-2 font-bold text-fg-primary transition-colors hover:bg-bg-elevated disabled:opacity-60"
                    >
                        ยกเลิก
                    </button>
                    <button
                        onClick={handleDissolve}
                        disabled={confirmText !== gangName || isSubmitting}
                        className="flex min-h-11 items-center justify-center gap-2 rounded-token-lg bg-status-danger px-4 py-2 font-black text-fg-inverse transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                        ยุบแก๊งทันที
                    </button>
                </div>
            </div>
        </ModalLayer>
    );
}
