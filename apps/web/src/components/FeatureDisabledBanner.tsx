import { Wrench } from 'lucide-react';

interface Props {
    featureName: string;
}

export function FeatureDisabledBanner({ featureName }: Props) {
    return (
        <div className="mb-5 flex animate-fade-in items-start gap-3 rounded-token-xl border border-status-warning/20 bg-status-warning-subtle p-4">
            <div className="shrink-0 rounded-token-lg bg-status-warning-subtle p-2">
                <Wrench className="h-5 w-5 text-fg-warning" />
            </div>
            <div>
                <h3 className="mb-1 text-sm font-bold text-fg-warning">
                    {featureName} ถูกปิดใช้งานชั่วคราว
                </h3>
                <p className="text-sm text-fg-secondary">
                    ผู้ดูแลระบบกำลังปรับปรุงฟีเจอร์นี้ กรุณารอสักครู่แล้วลองใหม่อีกครั้ง
                </p>
            </div>
        </div>
    );
}
