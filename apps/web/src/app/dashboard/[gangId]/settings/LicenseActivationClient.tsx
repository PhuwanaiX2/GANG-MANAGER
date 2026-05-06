'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, Key, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
    gangId: string;
}

export function LicenseActivationClient({ gangId }: Props) {
    const router = useRouter();
    const [licenseKey, setLicenseKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ tier: string; expiresAt: string } | null>(null);

    const handleActivate = async (event: FormEvent) => {
        event.preventDefault();
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
                toast.error(data.error || 'เปิดใช้งาน License ไม่สำเร็จ');
                return;
            }

            setResult({ tier: data.tier, expiresAt: data.expiresAt });
            toast.success(data.message || 'เปิดใช้งานสำเร็จ');
            setLicenseKey('');
            router.refresh();
        } catch {
            toast.error('เชื่อมต่อระบบ License ไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    };

    if (result) {
        const expDate = new Date(result.expiresAt);
        return (
            <div className="rounded-token-2xl border border-status-success bg-status-success-subtle p-5">
                <div className="flex items-center gap-3">
                    <div className="rounded-token-xl bg-status-success-subtle p-2">
                        <Check className="h-5 w-5 text-fg-success" />
                    </div>
                    <div>
                        <h3 className="font-bold text-fg-success">เปิดใช้งานสำเร็จ</h3>
                        <p className="text-xs text-fg-secondary">
                            แพลน <strong className="text-fg-primary">{result.tier}</strong> หมดอายุ{' '}
                            {expDate.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-token-2xl border border-border-subtle bg-bg-base p-5">
            <h3 className="mb-2 flex items-center gap-2 text-lg font-bold text-fg-primary">
                <Key className="h-5 w-5 text-fg-warning" />
                เปิดใช้งานด้วย License Key
            </h3>
            <p className="mb-5 text-xs text-fg-tertiary">
                ใช้เฉพาะกรณีที่แอดมินออกคีย์ให้เท่านั้น คีย์หนึ่งชุดใช้ได้ครั้งเดียว
            </p>

            <form onSubmit={handleActivate} className="flex flex-col gap-3 sm:flex-row">
                <input
                    type="text"
                    value={licenseKey}
                    onChange={(event) => setLicenseKey(event.target.value.toUpperCase())}
                    placeholder="PREMIUM-XXXXXXXXXXXX"
                    className="min-h-12 flex-1 rounded-token-xl border border-border-subtle bg-bg-muted px-4 py-2.5 font-mono text-sm tracking-wider text-fg-primary outline-none placeholder:text-fg-tertiary focus:border-status-warning focus:ring-2 focus:ring-status-warning"
                    disabled={loading}
                />
                <button
                    type="submit"
                    disabled={loading || !licenseKey.trim()}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-token-xl bg-status-warning px-5 py-2.5 text-sm font-bold text-fg-inverse transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
                    {loading ? 'กำลังตรวจสอบ...' : 'เปิดใช้งาน'}
                </button>
            </form>

            <p className="mt-3 flex items-center gap-1 text-[10px] text-fg-tertiary">
                <AlertCircle className="h-3 w-3" />
                หากไม่มี License Key ให้ใช้การชำระเงินผ่าน PromptPay ด้านบนแทน
            </p>
        </div>
    );
}
