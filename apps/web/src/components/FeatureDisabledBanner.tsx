import { Wrench } from 'lucide-react';

interface Props {
    featureName: string;
}

export function FeatureDisabledBanner({ featureName }: Props) {
    return (
        <div className="bg-status-warning-subtle border border-status-warning/20 rounded-token-2xl p-6 mb-8 flex items-start gap-4 animate-fade-in">
            <div className="p-2.5 bg-status-warning-subtle rounded-token-xl shrink-0">
                <Wrench className="w-6 h-6 text-fg-warning" />
            </div>
            <div>
                <h3 className="font-bold text-fg-warning mb-1">
                    {featureName} ถูกปิดใช้งานชั่วคราว
                </h3>
                <p className="text-sm text-fg-secondary">
                    ผู้ดูแลระบบกำลังปรับปรุงฟีเจอร์นี้ กรุณารอสักครู่แล้วลองใหม่อีกครั้ง
                </p>
            </div>
        </div>
    );
}
