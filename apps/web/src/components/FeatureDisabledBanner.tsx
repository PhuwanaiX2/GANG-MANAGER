import { Wrench } from 'lucide-react';

interface Props {
    featureName: string;
}

export function FeatureDisabledBanner({ featureName }: Props) {
    return (
        <div className="bg-orange-500/5 border border-orange-500/20 rounded-2xl p-6 mb-8 flex items-start gap-4 animate-fade-in">
            <div className="p-2.5 bg-orange-500/10 rounded-xl shrink-0">
                <Wrench className="w-6 h-6 text-orange-400" />
            </div>
            <div>
                <h3 className="font-bold text-orange-400 mb-1">
                    {featureName} ถูกปิดใช้งานชั่วคราว
                </h3>
                <p className="text-sm text-gray-400">
                    ผู้ดูแลระบบกำลังปรับปรุงฟีเจอร์นี้ กรุณารอสักครู่แล้วลองใหม่อีกครั้ง
                </p>
            </div>
        </div>
    );
}
