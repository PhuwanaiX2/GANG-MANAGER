'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Info, Key, Edit2, Check, X, Loader2, ImagePlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';
import { ConfirmModal } from '@/components/ConfirmModal';
import { getSubscriptionTierBadgeClass, normalizeSubscriptionTierValue } from '@/lib/subscriptionTier';
import { logClientError } from '@/lib/clientLogger';

interface GangProps {
    id: string;
    name: string;
    logoUrl: string | null;
    subscriptionTier: string;
    discordGuildId: string;
}

interface Props {
    gang: GangProps;
}

export function GangProfileClient({ gang }: Props) {
    const router = useRouter();
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(gang.name);
    const [isSaving, setIsSaving] = useState(false);

    // Logo state
    const [isEditingLogo, setIsEditingLogo] = useState(false);
    const [logoUrl, setLogoUrl] = useState(gang.logoUrl || '');
    const [isSavingLogo, setIsSavingLogo] = useState(false);
    const [logoPreviewError, setLogoPreviewError] = useState(false);

    // Confirm modals
    const [showNameConfirm, setShowNameConfirm] = useState(false);
    const [showLogoDeleteConfirm, setShowLogoDeleteConfirm] = useState(false);

    const handleSave = async () => {
        if (!name.trim()) return;
        if (name === gang.name) {
            setIsEditing(false);
            return;
        }
        setShowNameConfirm(true);
    };

    const confirmSaveName = async () => {
        setShowNameConfirm(false);
        setIsSaving(true);
        try {
            const res = await fetch(`/api/gangs/${gang.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to update gang name');
            }

            toast.success('อัปเดตชื่อแก๊งเรียบร้อย', { description: `ชื่อใหม่: ${name}` });
            setIsEditing(false);
            router.refresh();
        } catch (error: any) {
            logClientError('dashboard.settings.gang_name_update.failed', error, { gangId: gang.id });
            toast.error(error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveLogo = async () => {
        const urlToSave = logoUrl.trim() || null;

        // Validate URL if provided
        if (urlToSave) {
            try {
                new URL(urlToSave);
            } catch {
                toast.error('URL รูปภาพไม่ถูกต้อง', { description: 'กรุณาใส่ URL ที่ขึ้นต้นด้วย https://' });
                return;
            }
        }

        setIsSavingLogo(true);
        try {
            const res = await fetch(`/api/gangs/${gang.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ logoUrl: urlToSave }),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'อัปเดตไม่สำเร็จ');
            }

            toast.success(urlToSave ? 'อัปเดตรูปภาพแก๊งเรียบร้อย' : 'ลบรูปภาพแก๊งเรียบร้อย');
            setIsEditingLogo(false);
            setLogoPreviewError(false);
            router.refresh();
        } catch (error: any) {
            logClientError('dashboard.settings.gang_logo_update.failed', error, { gangId: gang.id });
            toast.error(error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
        } finally {
            setIsSavingLogo(false);
        }
    };

    const handleRemoveLogo = () => {
        setShowLogoDeleteConfirm(true);
    };

    const confirmRemoveLogo = async () => {
        setShowLogoDeleteConfirm(false);
        setLogoUrl('');
        setIsSavingLogo(true);
        try {
            const res = await fetch(`/api/gangs/${gang.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ logoUrl: null }),
            });
            if (!res.ok) throw new Error();
            toast.success('ลบรูปภาพแก๊งเรียบร้อย');
            setIsEditingLogo(false);
            router.refresh();
        } catch {
            toast.error('ลบรูปภาพไม่สำเร็จ');
        } finally {
            setIsSavingLogo(false);
        }
    };

    const currentLogo = gang.logoUrl;

    return (
        <div className="bg-bg-subtle p-6 rounded-token-2xl border border-border-subtle shadow-token-md">
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-fg-primary border-b border-border-subtle pb-4">
                <Info className="w-5 h-5 text-fg-info" />
                ข้อมูลแก๊ง
            </h3>
            <div className="space-y-4">
                {/* Gang Logo */}
                <div className="flex flex-col gap-3 p-3 rounded-token-xl bg-bg-muted">
                    <div className="flex justify-between items-center">
                        <span className="text-fg-secondary text-sm">รูปภาพแก๊ง</span>
                        <div className="flex items-center gap-1">
                            {!isEditingLogo ? (
                                <button
                                    onClick={() => setIsEditingLogo(true)}
                                    className="p-1.5 hover:bg-bg-subtle rounded-token-lg text-fg-secondary hover:text-fg-primary transition-colors"
                                    title="แก้ไขรูปภาพ"
                                >
                                    <Edit2 className="w-3.5 h-3.5" />
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={handleSaveLogo}
                                        disabled={isSavingLogo}
                                        className="p-1.5 hover:bg-status-success-subtle rounded-token-lg text-fg-success transition-colors"
                                    >
                                        {isSavingLogo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsEditingLogo(false);
                                            setLogoUrl(gang.logoUrl || '');
                                            setLogoPreviewError(false);
                                        }}
                                        disabled={isSavingLogo}
                                        className="p-1.5 hover:bg-status-danger-subtle rounded-token-lg text-fg-danger transition-colors"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Logo Preview */}
                    <div className="flex items-center gap-4">
                        <div className="w-20 h-20 rounded-token-xl bg-bg-subtle border border-border-subtle flex items-center justify-center overflow-hidden flex-shrink-0">
                            {currentLogo && !logoPreviewError ? (
                                <img
                                    src={isEditingLogo && logoUrl ? logoUrl : currentLogo}
                                    alt="โลโก้แก๊ง"
                                    className="w-full h-full object-cover"
                                    onError={() => setLogoPreviewError(true)}
                                />
                            ) : isEditingLogo && logoUrl && !logoPreviewError ? (
                                <img
                                    src={logoUrl}
                                    alt="ตัวอย่าง"
                                    className="w-full h-full object-cover"
                                    onError={() => setLogoPreviewError(true)}
                                />
                            ) : (
                                <div className="text-center">
                                    <ImagePlus className="w-6 h-6 text-fg-tertiary mx-auto" />
                                    <span className="text-[10px] text-fg-tertiary mt-1">ยังไม่มีรูป</span>
                                </div>
                            )}
                        </div>

                        {isEditingLogo && (
                            <div className="flex-1 space-y-2">
                                <input
                                    type="url"
                                    value={logoUrl}
                                    onChange={(e) => {
                                        setLogoUrl(e.target.value);
                                        setLogoPreviewError(false);
                                    }}
                                    className="w-full bg-bg-muted border border-border-subtle rounded-token-lg px-3 py-1.5 text-fg-primary text-xs font-mono focus:outline-none focus:border-status-info/50"
                                    placeholder="https://example.com/logo.png"
                                    autoFocus
                                />
                                <p className="text-[10px] text-fg-tertiary">วาง URL รูปภาพ (รองรับ .png, .jpg, .webp)</p>
                                {currentLogo && (
                                    <button
                                        onClick={handleRemoveLogo}
                                        disabled={isSavingLogo}
                                        className="flex items-center gap-1 text-[10px] text-fg-danger hover:brightness-110 transition-colors"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                        ลบรูปภาพ
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Gang Name */}
                <div className="flex flex-col gap-2 p-3 rounded-token-xl bg-bg-muted">
                    <div className="flex justify-between items-center">
                        <span className="text-fg-secondary text-sm">ชื่อแก๊ง</span>
                        {!isEditing ? (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="p-1.5 hover:bg-bg-subtle rounded-token-lg text-fg-secondary hover:text-fg-primary transition-colors"
                                title="แก้ไขชื่อแก๊ง"
                            >
                                <Edit2 className="w-3.5 h-3.5" />
                            </button>
                        ) : (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="p-1.5 hover:bg-status-success-subtle rounded-token-lg text-fg-success transition-colors"
                                >
                                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                    onClick={() => {
                                        setIsEditing(false);
                                        setName(gang.name);
                                    }}
                                    disabled={isSaving}
                                    className="p-1.5 hover:bg-status-danger-subtle rounded-token-lg text-fg-danger transition-colors"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                    </div>
                    {isEditing ? (
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-bg-muted border border-border-subtle rounded-token-lg px-3 py-1.5 text-fg-primary font-medium focus:outline-none focus:border-status-info/50 w-full"
                            placeholder="ใส่ชื่อแก๊ง..."
                            autoFocus
                        />
                    ) : (
                        <span className="font-medium text-fg-primary px-1">{gang.name}</span>
                    )}
                </div>

                {/* Subscription */}
                <div className="flex justify-between items-center p-3 rounded-token-xl bg-bg-muted">
                    <span className="text-fg-secondary text-sm">แพลน</span>
                    <span className={`px-2 py-0.5 rounded-token-sm text-xs font-bold border ${getSubscriptionTierBadgeClass(gang.subscriptionTier)}`}>
                        {normalizeSubscriptionTierValue(gang.subscriptionTier)}
                    </span>
                </div>

                {/* Gang ID */}
                <div className="flex flex-col gap-2 p-3 rounded-token-xl bg-bg-muted">
                    <div className="flex justify-between items-center">
                        <span className="text-fg-secondary text-sm">Gang ID</span>
                        <Key className="w-3 h-3 text-fg-tertiary" />
                    </div>
                    <span className="font-mono text-xs text-fg-tertiary break-all bg-bg-subtle p-2 rounded-token-sm border border-border-subtle select-all">
                        {gang.id}
                    </span>
                </div>
            </div>

            <ConfirmModal
                isOpen={showNameConfirm}
                onClose={() => setShowNameConfirm(false)}
                onConfirm={confirmSaveName}
                title="เปลี่ยนชื่อแก๊ง"
                description={`คุณต้องการเปลี่ยนชื่อแก๊งเป็น "${name}" ใช่หรือไม่?`}
                confirmText="เปลี่ยนชื่อ"
                variant="info"
                icon={<Edit2 className="w-6 h-6 text-fg-info" />}
            />

            <ConfirmModal
                isOpen={showLogoDeleteConfirm}
                onClose={() => setShowLogoDeleteConfirm(false)}
                onConfirm={confirmRemoveLogo}
                title="ลบรูปภาพแก๊ง"
                description="คุณต้องการลบรูปภาพแก๊งใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้"
                confirmText="ลบรูปภาพ"
                variant="danger"
                icon={<Trash2 className="w-6 h-6 text-fg-danger" />}
            />
        </div>
    );
}
