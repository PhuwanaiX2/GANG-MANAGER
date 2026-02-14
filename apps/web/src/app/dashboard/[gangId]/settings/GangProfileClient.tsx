
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Info, Key, Edit2, Check, X, Loader2, ImagePlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';
import { ConfirmModal } from '@/components/ConfirmModal';

interface GangProps {
    id: string;
    name: string;
    logoUrl: string | null;
    subscriptionTier: 'FREE' | 'TRIAL' | 'PRO' | 'PREMIUM';
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
            console.error(error);
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
                formData.append('folder', 'gang-logos');

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
                formData.append('folder', 'gang-logos');

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
            console.error(error);
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

    return (
        <div className="bg-[#151515] p-6 rounded-2xl border border-white/5 shadow-xl">
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-white border-b border-white/5 pb-4">
                <Info className="w-5 h-5 text-blue-400" />
                ข้อมูลแก๊ง
            </h3>
            <div className="space-y-4">
                {/* Gang Logo */}
                <div className="flex flex-col gap-3 p-3 rounded-xl bg-black/20">
                    <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">รูปภาพแก๊ง</span>
                        <div className="flex items-center gap-1">
                            {!isEditingLogo ? (
                                <button
                                    onClick={() => setIsEditingLogo(true)}
                                    className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                                    title="แก้ไขรูปภาพ"
                                >
                                    <Edit2 className="w-3.5 h-3.5" />
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={handleSaveLogo}
                                        disabled={isSavingLogo}
                                        className="p-1.5 hover:bg-green-500/20 rounded-lg text-green-400 transition-colors"
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
                                        className="p-1.5 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Logo Preview */}

                    <div className="flex items-center gap-4">
                        <div className="w-20 h-20 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0 relative group">
                            {previewUrl ? (
                                <img
                                    src={previewUrl}
                                    alt="Preview"
                                    className="w-full h-full object-cover"
                                />
                            ) : currentLogo && !logoPreviewError ? (
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
                                    <ImagePlus className="w-6 h-6 text-gray-600 mx-auto" />
                                    <span className="text-[10px] text-gray-600 mt-1">ยังไม่มีรูป</span>
                                </div>
                            )}

                            {/* Overlay for file upload */}
                            {isEditingLogo && (
                                <label className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                    <ImagePlus className="w-5 h-5 text-white mb-1" />
                                    <span className="text-[8px] text-white">เลือกรูป</span>
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleFileSelect}
                                    />
                                </label>
                            )}
                        </div>

                        {isEditingLogo && (
                            <div className="flex-1 space-y-2">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={logoUrl}
                                        onChange={(e) => {
                                            setLogoUrl(e.target.value);
                                            setLogoPreviewError(false);
                                            setSelectedFile(null);
                                            setPreviewUrl(null);
                                        }}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-blue-500/50"
                                        placeholder="วางลิงก์รูปภาพ หรือกดที่รูปเพื่ออัปโหลด"
                                        autoFocus
                                    />
                                </div>

                                {selectedFile ? (
                                    <p className="text-[10px] text-green-400">
                                        ไฟล์ที่เลือก: {selectedFile.name}
                                    </p>
                                ) : (
                                    <p className="text-[10px] text-gray-500">
                                        รองรับ: อัปโหลดจากเครื่อง หรือ วาง URL (Discord CDN จะถูกดูดมาเก็บถาวร)
                                    </p>
                                )}

                                {currentLogo && (
                                    <button
                                        onClick={handleRemoveLogo}
                                        disabled={isSavingLogo}
                                        className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 transition-colors"
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
                <div className="flex flex-col gap-2 p-3 rounded-xl bg-black/20">
                    <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">ชื่อแก๊ง</span>
                        {!isEditing ? (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                                title="แก้ไขชื่อแก๊ง"
                            >
                                <Edit2 className="w-3.5 h-3.5" />
                            </button>
                        ) : (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="p-1.5 hover:bg-green-500/20 rounded-lg text-green-400 transition-colors"
                                >
                                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                    onClick={() => {
                                        setIsEditing(false);
                                        setName(gang.name);
                                    }}
                                    disabled={isSaving}
                                    className="p-1.5 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors"
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
                            className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-white font-medium focus:outline-none focus:border-blue-500/50 w-full"
                            placeholder="ใส่ชื่อแก๊ง..."
                            autoFocus
                        />
                    ) : (
                        <span className="font-medium text-white px-1">{gang.name}</span>
                    )}
                </div>

                {/* Subscription */}
                <div className="flex justify-between items-center p-3 rounded-xl bg-black/20">
                    <span className="text-gray-400 text-sm">แพลน</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${gang.subscriptionTier === 'PRO' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : gang.subscriptionTier === 'PREMIUM' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : gang.subscriptionTier === 'TRIAL' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'}`}>
                        {gang.subscriptionTier}
                    </span>
                </div>

                {/* Gang ID */}
                <div className="flex flex-col gap-2 p-3 rounded-xl bg-black/20">
                    <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">Gang ID</span>
                        <Key className="w-3 h-3 text-gray-500" />
                    </div>
                    <span className="font-mono text-xs text-gray-500 break-all bg-black/30 p-2 rounded border border-white/5 select-all">
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
                icon={<Edit2 className="w-6 h-6 text-blue-400" />}
            />

            <ConfirmModal
                isOpen={showLogoDeleteConfirm}
                onClose={() => setShowLogoDeleteConfirm(false)}
                onConfirm={confirmRemoveLogo}
                title="ลบรูปภาพแก๊ง"
                description="คุณต้องการลบรูปภาพแก๊งใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้"
                confirmText="ลบรูปภาพ"
                variant="danger"
                icon={<Trash2 className="w-6 h-6 text-red-500" />}
            />
        </div>
    );
}
