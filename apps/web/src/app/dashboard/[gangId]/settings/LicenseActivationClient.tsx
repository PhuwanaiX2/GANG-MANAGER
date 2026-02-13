'use client';

import { useState } from 'react';
import { Key, Loader2, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface Props {
    gangId: string;
}

export function LicenseActivationClient({ gangId }: Props) {
    const router = useRouter();
    const [licenseKey, setLicenseKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ tier: string; expiresAt: string } | null>(null);

    const handleActivate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!licenseKey.trim()) {
            toast.error('กรุณากรอก License Key');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`/api/gangs/${gangId}/activate-license`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ licenseKey: licenseKey.trim() }),
            });

            const data = await res.json();

            if (!res.ok) {
                toast.error(data.error || 'เกิดข้อผิดพลาด');
                return;
            }

            setResult({ tier: data.tier, expiresAt: data.expiresAt });
            toast.success(data.message);
            setLicenseKey('');
            router.refresh();
        } catch {
            toast.error('ไม่สามารถเชื่อมต่อได้');
        } finally {
            setLoading(false);
        }
    };

    if (result) {
        const expDate = new Date(result.expiresAt);
        return (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-emerald-500/10 rounded-xl">
                        <Check className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-emerald-400">เปิดใช้งานสำเร็จ!</h3>
                        <p className="text-xs text-gray-400">
                            แพลน <strong className="text-white">{result.tier}</strong> — หมดอายุ{' '}
                            {expDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[#151515] border border-white/5 rounded-2xl p-6">
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2 text-white">
                <Key className="w-5 h-5 text-yellow-400" />
                CODE License
            </h3>
            <p className="text-xs text-gray-500 mb-5">
                กรอกรหัส License Key เพื่อเปิดใช้งานแพลน — รหัสจะใช้ได้ครั้งเดียว
            </p>

            <form onSubmit={handleActivate} className="flex gap-3">
                <input
                    type="text"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                    placeholder="PRO-XXXXXXXXXXXX"
                    className="flex-1 bg-black/30 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm font-mono tracking-wider focus:ring-2 focus:ring-yellow-500/30 focus:border-yellow-500/30 outline-none placeholder:text-gray-600"
                    disabled={loading}
                />
                <button
                    type="submit"
                    disabled={loading || !licenseKey.trim()}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-black bg-yellow-500 hover:bg-yellow-400 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                    {loading ? 'กำลังตรวจสอบ...' : 'เปิดใช้งาน'}
                </button>
            </form>

            <p className="text-[10px] text-gray-600 mt-3 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                License Key จะถูกปิดใช้งานหลังจากเปิดใช้แล้ว ไม่สามารถใช้ซ้ำได้
            </p>
        </div>
    );
}
