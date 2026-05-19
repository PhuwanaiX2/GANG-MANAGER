'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, Loader2, Save, Search, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, ModalLayer } from '@/components/ui';
import { cn } from '@/lib/cn';

interface DiscordMemberOption {
    id: string;
    username: string;
    displayName: string;
    globalName: string | null;
    avatarUrl: string | null;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    gangId: string;
}

export function CreateMemberModal({ isOpen, onClose, gangId }: Props) {
    const router = useRouter();
    const [name, setName] = useState('');
    const [query, setQuery] = useState('');
    const [discordMembers, setDiscordMembers] = useState<DiscordMemberOption[]>([]);
    const [selectedDiscordMember, setSelectedDiscordMember] = useState<DiscordMemberOption | null>(null);
    const [discordError, setDiscordError] = useState<string | null>(null);
    const [isLoadingDiscord, setIsLoadingDiscord] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        let cancelled = false;
        setIsLoadingDiscord(true);
        setDiscordError(null);
        setSelectedDiscordMember(null);
        setDiscordMembers([]);
        setQuery('');

        fetch(`/api/gangs/${gangId}/discord-members`)
            .then(async (response) => {
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.error || 'โหลดรายชื่อ Discord ไม่สำเร็จ');
                }
                if (!cancelled) {
                    setDiscordMembers(Array.isArray(data.members) ? data.members : []);
                }
            })
            .catch((error: Error) => {
                if (!cancelled) {
                    setDiscordError(error.message);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setIsLoadingDiscord(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [gangId, isOpen]);

    const filteredDiscordMembers = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) return discordMembers.slice(0, 30);

        return discordMembers
            .filter((member) => {
                return (
                    member.displayName.toLowerCase().includes(normalizedQuery) ||
                    member.username.toLowerCase().includes(normalizedQuery) ||
                    member.id.includes(normalizedQuery)
                );
            })
            .slice(0, 30);
    }, [discordMembers, query]);

    if (!isOpen) return null;

    const selectDiscordMember = (member: DiscordMemberOption) => {
        setSelectedDiscordMember(member);
        setQuery(member.displayName);
        if (!name.trim()) {
            setName(member.displayName);
        }
    };

    const clearDiscordMember = () => {
        setSelectedDiscordMember(null);
        setQuery('');
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();

        const trimmedName = name.trim();
        if (!trimmedName) {
            toast.error('กรอกชื่อสมาชิกก่อน');
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch(`/api/gangs/${gangId}/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: trimmedName,
                    discordId: selectedDiscordMember?.id,
                    discordUsername: selectedDiscordMember?.username,
                    discordAvatar: selectedDiscordMember?.avatarUrl,
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'สร้างสมาชิกไม่สำเร็จ');
            }

            toast.success(selectedDiscordMember ? 'เพิ่มสมาชิกและผูก Discord แล้ว' : 'เพิ่มสมาชิกแล้ว ยังไม่ได้ผูก Discord');
            router.refresh();
            setName('');
            setSelectedDiscordMember(null);
            setQuery('');
            onClose();
        } catch (error: any) {
            toast.error('ไม่สามารถเพิ่มสมาชิกได้', {
                description: error.message,
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ModalLayer onClose={isLoading ? undefined : onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-label="เพิ่มสมาชิก"
                className="w-full max-w-3xl overflow-hidden rounded-token-2xl border border-border bg-bg-subtle shadow-token-lg animate-in zoom-in-95 duration-200"
            >
                <div className="flex items-start justify-between gap-3 border-b border-border-subtle p-4 sm:p-5">
                    <div>
                        <h2 className="flex items-center gap-2 text-base font-black text-fg-primary">
                            <span className="flex h-9 w-9 items-center justify-center rounded-token-lg border border-border-accent bg-accent-subtle text-accent-bright">
                                <UserPlus className="h-4 w-4" />
                            </span>
                            เพิ่มสมาชิก
                        </h2>
                        <p className="mt-1 text-xs leading-5 text-fg-tertiary">
                            กรอกชื่อในแก๊งก่อน แล้วค่อยผูก Discord ถ้าคนนี้มีบัญชีอยู่ในเซิร์ฟเวอร์
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-token-lg text-fg-secondary transition-colors hover:bg-bg-muted hover:text-fg-primary"
                        aria-label="ปิด"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-5">
                    <section className="rounded-token-xl border border-border-subtle bg-bg-muted/65 p-4">
                        <label className="mb-1.5 block text-xs font-black text-fg-secondary">ชื่อสมาชิกในแก๊ง</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            className="min-h-12 w-full rounded-token-lg border border-border-subtle bg-bg-base px-3 py-2 text-base font-bold text-fg-primary outline-none transition-colors placeholder:text-fg-tertiary focus:border-border-strong"
                            placeholder="เช่น Alice, jiw.xzy, หัวหน้าโจ"
                            required
                        />
                        <p className="mt-2 text-xs leading-5 text-fg-tertiary">
                            ใช้ชื่อนี้เป็นหลักในตาราง สมาชิกที่ยังไม่ได้ผูก Discord จะยังเพิ่มได้ตามปกติ
                        </p>
                    </section>

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(240px,0.75fr)]">
                        <section className="rounded-token-xl border border-border-subtle bg-bg-muted/55 p-3">
                            <div className="mb-2 flex items-center justify-between gap-3">
                                <label className="block text-xs font-black text-fg-secondary">ผูก Discord (ไม่บังคับ)</label>
                                {selectedDiscordMember ? (
                                    <button
                                        type="button"
                                        onClick={clearDiscordMember}
                                        className="rounded-token-full border border-border-subtle bg-bg-base px-2.5 py-1 text-[11px] font-black text-fg-tertiary transition-colors hover:text-fg-primary"
                                    >
                                        ล้างการผูก
                                    </button>
                                ) : null}
                            </div>
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-tertiary" />
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(event) => {
                                        setQuery(event.target.value);
                                        setSelectedDiscordMember(null);
                                    }}
                                    className="min-h-11 w-full rounded-token-lg border border-border-subtle bg-bg-base py-2 pl-10 pr-3 text-sm text-fg-primary outline-none transition-colors placeholder:text-fg-tertiary focus:border-border-strong"
                                    placeholder="ค้นหาชื่อหรือ username ใน Discord..."
                                    autoComplete="off"
                                />
                            </div>

                            <div className="custom-scrollbar mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                                {isLoadingDiscord ? (
                                    <div className="flex min-h-32 items-center justify-center rounded-token-lg border border-dashed border-border-subtle bg-bg-subtle text-sm font-semibold text-fg-tertiary">
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        กำลังดึงรายชื่อจาก Discord
                                    </div>
                                ) : discordError ? (
                                    <div className="rounded-token-lg border border-status-warning bg-status-warning-subtle p-3 text-xs leading-5 text-fg-warning">
                                        <div className="flex items-center gap-2 font-bold">
                                            <AlertCircle className="h-4 w-4" />
                                            ดึงรายชื่อ Discord ไม่สำเร็จ
                                        </div>
                                        <p className="mt-1">{discordError}</p>
                                        <p className="mt-2 text-fg-tertiary">ยังเพิ่มสมาชิกด้วยชื่ออย่างเดียวได้ แล้วค่อยมาผูกภายหลัง</p>
                                    </div>
                                ) : filteredDiscordMembers.length === 0 ? (
                                    <div className="rounded-token-lg border border-dashed border-border-subtle bg-bg-subtle p-5 text-center text-xs leading-5 text-fg-tertiary">
                                        ไม่พบ Discord user ที่ยังว่างให้ผูก หรือทุกคนถูกเชื่อมกับระบบแล้ว
                                    </div>
                                ) : (
                                    filteredDiscordMembers.map((member) => {
                                        const selected = selectedDiscordMember?.id === member.id;
                                        return (
                                            <button
                                                key={member.id}
                                                type="button"
                                                onClick={() => selectDiscordMember(member)}
                                                className={cn(
                                                    'flex w-full items-center gap-3 rounded-token-lg border p-2.5 text-left transition-colors',
                                                    selected
                                                        ? 'border-border-accent bg-accent-subtle text-accent-bright'
                                                        : 'border-border-subtle bg-bg-subtle text-fg-primary hover:border-border hover:bg-bg-elevated'
                                                )}
                                            >
                                                <Avatar
                                                    src={member.avatarUrl}
                                                    name={member.displayName}
                                                    alt={member.displayName}
                                                    className="h-9 w-9 rounded-token-lg"
                                                />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-black">{member.displayName}</span>
                                                    <span className="block truncate text-[11px] font-semibold text-fg-tertiary">@{member.username}</span>
                                                </span>
                                                {selected ? <Check className="h-4 w-4 shrink-0" /> : null}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </section>

                        <aside className="space-y-3">
                            <div className="rounded-token-xl border border-border-subtle bg-bg-muted/65 p-3">
                                <p className="text-xs font-black text-fg-secondary">สถานะการเชื่อม</p>
                                {selectedDiscordMember ? (
                                    <div className="mt-3 flex items-center gap-3">
                                        <Avatar
                                            src={selectedDiscordMember.avatarUrl}
                                            name={selectedDiscordMember.displayName}
                                            alt={selectedDiscordMember.displayName}
                                            className="h-10 w-10 rounded-token-lg"
                                        />
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-black text-fg-primary">{selectedDiscordMember.displayName}</p>
                                            <p className="truncate text-xs font-semibold text-fg-tertiary">ID {selectedDiscordMember.id}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-3 rounded-token-lg border border-status-warning bg-status-warning-subtle p-3">
                                        <p className="text-xs font-black text-fg-warning">ยังไม่ได้ผูก Discord</p>
                                        <p className="mt-1 text-xs leading-5 text-fg-secondary">
                                            สมาชิกจะถูกเพิ่มด้วยชื่อในแก๊งก่อน แต่จะยังใช้ Discord self check-in, role sync และการอ้างอิงจาก Discord ไม่ได้จนกว่าจะผูกบัญชี
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="rounded-token-xl border border-border-subtle bg-bg-base p-3 text-xs leading-5 text-fg-tertiary">
                                <p className="font-black text-fg-secondary">แนะนำ</p>
                                <p className="mt-1">ถ้าสมาชิกอยู่ใน Discord แล้วให้ผูกเลย จะช่วยลดข้อมูลซ้ำและทำให้ประวัติเช็คชื่อแม่นกว่า</p>
                            </div>
                        </aside>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="min-h-11 rounded-token-lg border border-border-subtle bg-bg-muted px-4 py-2 text-sm font-bold text-fg-primary transition-colors hover:bg-bg-raised disabled:opacity-60"
                            disabled={isLoading}
                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            className="flex min-h-11 items-center justify-center gap-2 rounded-token-lg bg-brand-discord px-4 py-2 text-sm font-bold text-fg-inverse transition-colors hover:bg-brand-discord-hover disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={isLoading || !name.trim()}
                        >
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            เพิ่มสมาชิก
                        </button>
                    </div>
                </form>
            </div>
        </ModalLayer>
    );
}
