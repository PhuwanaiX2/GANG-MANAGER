export const dynamic = 'force-dynamic';

import { db, FeatureFlagService } from '@gang/database';
import { FeatureFlagManager } from '../AdminClient';

export default async function AdminFeaturesPage() {
    await FeatureFlagService.seed(db);
    const allFeatureFlags = await FeatureFlagService.getAll(db);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-black tracking-tight">Feature Flags</h1>
                <p className="text-gray-500 text-sm mt-1">เปิด/ปิดฟีเจอร์ทั้งระบบ — Kill-Switch สำหรับกรณีฉุกเฉินหรือกำลังพัฒนา</p>
            </div>

            <FeatureFlagManager initialFlags={JSON.parse(JSON.stringify(allFeatureFlags))} />
        </div>
    );
}
