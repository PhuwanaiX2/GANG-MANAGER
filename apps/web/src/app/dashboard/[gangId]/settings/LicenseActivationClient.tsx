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
            <div className="bg-status-success-subtle border border-status-success rounded-token-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-status-success-subtle rounded-token-xl">
                        <Check className="w-5 h-5 text-fg-success" />
                    </div>
                    <div>
                        <h3 className="font-bold text-fg-success">เปิดใช้งานสำเร็จ!</h3>
                        <p className="text-xs text-fg-secondary">
                            แพลน <strong className="text-fg-primary">{result.tier}</strong> — หมดอายุ{' '}
                            {expDate.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok',  day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl p-6 shadow-token-sm">
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2 text-fg-primary">
                <Key className="w-5 h-5 text-fg-warning" />
                CODE License
            </h3>
            <p className="text-xs text-fg-tertiary mb-5">
                กรอกรหัส License Key เพื่อเปิดใช้งานแพลน — รหัสจะใช้ได้ครั้งเดียว
            </p>

            <form onSubmit={handleActivate} className="flex gap-3">
                <input
                    type="text"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                    placeholder="PREMIUM-XXXXXXXXXXXX"
                    className="flex-1 bg-bg-muted border border-border-subtle text-fg-primary rounded-token-xl px-4 py-2.5 text-sm font-mono tracking-wider focus:ring-2 focus:ring-status-warning focus:border-status-warning outline-none placeholder:text-fg-tertiary"
                    disabled={loading}
                />
                <button
                    type="submit"
                    disabled={loading || !licenseKey.trim()}
                    className="px-5 py-2.5 rounded-token-xl text-sm font-bold text-fg-inverse bg-status-warning hover:brightness-110 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                    {loading ? 'กำลังตรวจสอบ...' : 'เปิดใช้งาน'}
                </button>
            </form>

            <p className="text-[10px] text-fg-tertiary mt-3 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                License Key จะถูกปิดใช้งานหลังจากเปิดใช้แล้ว ไม่สามารถใช้ซ้ำได้
            </p>
        </div>
    );
}
