'use client';

import { useState, useRef } from 'react';
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

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                toast.error('ขนาดไฟล์ต้องไม่เกิน 5MB');
                return;
            }
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setLogoUrl(''); // Clear manual URL input
            setLogoPreviewError(false);
        }
    };

    const handleSaveLogo = async () => {
        let finalUrl = logoUrl.trim();

        setIsSavingLogo(true);
        try {
            // 1. If file is selected, upload it first
            if (selectedFile) {
                const formData = new FormData();
                formData.append('file', selectedFile);
                formData.append('gangId', gang.id);

                const uploadRes = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData,
                });

                if (!uploadRes.ok) throw new Error('Failed to upload image');
                const uploadData = await uploadRes.json();
                finalUrl = uploadData.secure_url;
            }
            // 2. If URL is provided (e.g. Discord CDN), upload via URL
            else if (finalUrl && (finalUrl.includes('discordapp') || finalUrl.includes('discord.com'))) {
                const formData = new FormData();
                formData.append('url', finalUrl);
                formData.append('gangId', gang.id);

                const uploadRes = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData,
                });

                if (!uploadRes.ok) throw new Error('Failed to upload image from URL');
                const uploadData = await uploadRes.json();
                finalUrl = uploadData.secure_url;
            }


            // 3. Update Gang Profile with Cloudinary URL
            const res = await fetch(`/api/gangs/${gang.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ logoUrl: finalUrl || null }),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'อัปเดตไม่สำเร็จ');
            }

            toast.success(finalUrl ? 'อัปเดตรูปภาพแก๊งเรียบร้อย' : 'ลบรูปภาพแก๊งเรียบร้อย');
            setIsEditingLogo(false);
            setLogoPreviewError(false);
            setSelectedFile(null);
            setPreviewUrl(null);
            router.refresh();
        } catch (error: any) {
            logClientError('dashboard.settings.gang_logo_update.failed', error, {
                gangId: gang.id,
                hasSelectedFile: Boolean(selectedFile),
            });
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
        setSelectedFile(null);
        setPreviewUrl(null);
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

    // File input ref
    const fileInputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="bg-bg-subtle p-6 rounded-token-2xl border border-border-subtle shadow-token-sm transition-all hover:border-border">
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-fg-primary border-b border-border-subtle pb-4">
                <Info className="w-5 h-5 text-fg-info" />
                ข้อมูลแก๊ง
            </h3>
            <div className="space-y-4">
                {/* Gang Logo Section */}
                <div className="flex flex-col gap-3 p-4 rounded-token-xl bg-bg-muted border border-border-subtle">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-fg-secondary text-sm font-medium">รูปภาพแก๊ง</span>
                        <div className="flex items-center gap-1">
                            {!isEditingLogo ? (
                                <button
                                    onClick={() => setIsEditingLogo(true)}
                                    className="p-1.5 hover:bg-bg-elevated rounded-token-lg text-fg-secondary hover:text-fg-primary transition-colors"
                                    title="แก้ไขรูปภาพ"
                                >
                                    <Edit2 className="w-3.5 h-3.5" />
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={handleSaveLogo}
                                        disabled={isSavingLogo}
                                        className="p-1.5 hover:bg-status-success-subtle rounded-token-lg text-fg-success transition-colors border border-transparent hover:border-status-success"
                                    >
                                        <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsEditingLogo(false);
                                            setLogoUrl(gang.logoUrl || '');
                                            setLogoPreviewError(false);
                                            setSelectedFile(null);
                                            setPreviewUrl(null);
                                        }}
                                        disabled={isSavingLogo}
                                        className="p-1.5 hover:bg-status-danger-subtle rounded-token-lg text-fg-danger transition-colors border border-transparent hover:border-status-danger"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex items-start gap-4">
                        {/* Image Preview / Upload Area */}
                        <div
                            className={`
                                relative w-24 h-24 rounded-token-2xl overflow-hidden border-2 transition-all duration-300 flex-shrink-0 group bg-bg-subtle
                                ${isEditingLogo
                                    ? 'cursor-pointer border-dashed border-status-info hover:border-status-info hover:bg-status-info-subtle hover:shadow-[0_0_15px_-5px_var(--color-info)]'
                                    : 'border-border-subtle'
                                }
                            `}
                            onClick={() => isEditingLogo && !isSavingLogo && fileInputRef.current?.click()}
                        >
                            {/* Main Image */}
                            {previewUrl ? (
                                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                            ) : currentLogo && !logoPreviewError ? (
                                <img
                                    src={isEditingLogo && logoUrl ? logoUrl : currentLogo}
                                    alt="Logo"
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    onError={() => setLogoPreviewError(true)}
                                />
                            ) : isEditingLogo && logoUrl && !logoPreviewError ? (
                                <img
                                    src={logoUrl}
                                    alt="URL Preview"
                                    className="w-full h-full object-cover"
                                    onError={() => setLogoPreviewError(true)}
                                />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-fg-tertiary gap-1">
                                    <ImagePlus className="w-6 h-6 opacity-50" />
                                </div>
                            )}

                            {/* Hover Overlay (Edit Mode) */}
                            {isEditingLogo && !isSavingLogo && (
                                <div className="absolute inset-0 bg-bg-overlay opacity-0 group-hover:opacity-100 transition-all duration-200 flex flex-col items-center justify-center gap-1.5 backdrop-blur-[2px]">
                                    <div className="p-1.5 bg-status-info-subtle rounded-token-full text-fg-info border border-status-info">
                                        <ImagePlus className="w-4 h-4" />
                                    </div>
                                    <span className="text-[9px] font-medium text-fg-primary">เลือกรูป</span>
                                </div>
                            )}

                            {/* Loading Overlay */}
                            {isSavingLogo && (
                                <div className="absolute inset-0 bg-bg-overlay flex flex-col items-center justify-center gap-2 backdrop-blur-sm z-10">
                                    <Loader2 className="w-6 h-6 text-fg-info animate-spin" />
                                    <span className="text-[9px] text-fg-info font-medium animate-pulse">กำลังอัปโหลด...</span>
                                </div>
                            )}

                            {/* Hidden File Input */}
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileSelect}
                                disabled={isSavingLogo}
                            />
                        </div>

                        {/* Controls */}
                        {isEditingLogo && (
                            <div className="flex-1 space-y-3 pt-1">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-fg-tertiary font-medium uppercase tracking-wider pl-1">ลิงก์รูปภาพ (Optional)</label>
                                    <input
                                        type="text"
                                        value={logoUrl}
                                        onChange={(e) => {
                                            setLogoUrl(e.target.value);
                                            setLogoPreviewError(false);
                                            setSelectedFile(null);
                                            setPreviewUrl(null);
                                        }}
                                        className="w-full bg-bg-subtle border border-border-subtle rounded-token-xl px-3 py-2 text-fg-primary text-xs font-mono focus:outline-none focus:border-border-accent focus:bg-bg-elevated transition-all placeholder:text-fg-tertiary"
                                        placeholder="วาง URL รูปภาพที่นี่..."
                                        disabled={isSavingLogo}
                                    />
                                </div>

                                {selectedFile ? (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-status-success-subtle border border-status-success rounded-token-lg">
                                        <div className="w-1.5 h-1.5 rounded-token-full bg-status-success animate-pulse" />
                                        <p className="text-[10px] text-fg-success truncate flex-1">
                                            พร้อมอัปโหลด: <span className="font-mono text-fg-success">{selectedFile.name}</span>
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-fg-tertiary leading-relaxed px-1">
                                        💡 <span className="text-fg-secondary">วิธีใช้:</span> กดที่รูปเพื่ออัปโหลดจากเครื่อง หรือวางลิงก์จาก Discord CDN (ระบบจะดูดมาเก็บถาวรให้)
                                    </p>
                                )}

                                {currentLogo && (
                                    <button
                                        onClick={handleRemoveLogo}
                                        disabled={isSavingLogo}
                                        className="flex items-center gap-1.5 text-[10px] text-fg-danger hover:brightness-110 transition-colors px-1 py-1 group/del"
                                    >
                                        <Trash2 className="w-3 h-3 group-hover/del:scale-110 transition-transform" />
                                        ลบรูปภาพปัจจุบัน
                                    </button>
                                )}
                            </div>
                        )}
                        {!isEditingLogo && (
                            <div className="flex-1 py-2">
                                <p className="text-xs text-fg-secondary leading-relaxed">
                                    รูปภาพประจำแก๊งจะแสดงในหน้า Dashboard และการแจ้งเตือนต่างๆ
                                    <br />
                                    <span className="text-fg-tertiary text-[10px]">ขนาดแนะนำ: 512x512px (Automatic Resize)</span>
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Gang Name */}
                <div className="flex flex-col gap-2 p-3 rounded-token-xl bg-bg-muted border border-border-subtle">
                    <div className="flex justify-between items-center">
                        <span className="text-fg-secondary text-sm">ชื่อแก๊ง</span>
                        {!isEditing ? (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="p-1.5 hover:bg-bg-elevated rounded-token-lg text-fg-secondary hover:text-fg-primary transition-colors"
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
                            className="bg-bg-subtle border border-border-subtle rounded-token-lg px-3 py-1.5 text-fg-primary font-medium focus:outline-none focus:border-border-accent w-full"
                            placeholder="ใส่ชื่อแก๊ง..."
                            autoFocus
                        />
                    ) : (
                        <span className="font-medium text-fg-primary px-1">{gang.name}</span>
                    )}
                </div>

                {/* Subscription */}
                <div className="flex justify-between items-center p-3 rounded-token-xl bg-bg-muted border border-border-subtle">
                    <span className="text-fg-secondary text-sm">แพลน</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getSubscriptionTierBadgeClass(gang.subscriptionTier)}`}>
                        {normalizeSubscriptionTierValue(gang.subscriptionTier)}
                    </span>
                </div>

                {/* Gang ID */}
                <div className="flex flex-col gap-2 p-3 rounded-token-xl bg-bg-muted border border-border-subtle">
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
