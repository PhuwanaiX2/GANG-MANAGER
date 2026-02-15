import { eq } from 'drizzle-orm';
import { featureFlags } from '../schema';
import { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from '../schema';

type DbType = LibSQLDatabase<typeof schema> | any;

// All known feature keys in the system
export const FEATURE_KEYS = [
    'finance',
    'attendance',
    'leave',
    'announcements',
    'gang_fee',
    'export_csv',
    'monthly_summary',
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

// Default feature definitions (used for seeding)
export const DEFAULT_FEATURES: { key: FeatureKey; name: string; description: string; enabled: boolean }[] = [
    { key: 'finance', name: 'ระบบการเงิน', description: 'จัดการรายรับรายจ่าย ยืม/คืน ฝากเงิน', enabled: true },
    { key: 'attendance', name: 'ระบบเช็คชื่อ', description: 'สร้างรอบเช็คชื่อ ติดตามการเข้างาน', enabled: true },
    { key: 'leave', name: 'ระบบแจ้งลา', description: 'แจ้งลางาน ขอเข้าช้า', enabled: true },
    { key: 'announcements', name: 'ระบบประกาศ', description: 'ประกาศข่าวสารภายในแก๊ง', enabled: true },
    { key: 'gang_fee', name: 'เก็บเงินแก๊ง', description: 'เรียกเก็บค่าธรรมเนียมสมาชิก', enabled: true },
    { key: 'export_csv', name: 'Export CSV', description: 'ส่งออกข้อมูลเป็นไฟล์ CSV', enabled: true },
    { key: 'monthly_summary', name: 'สรุปรายเดือน', description: 'ดูสรุปยอดการเงินรายเดือน', enabled: true },
];

// In-memory cache to avoid hitting DB on every request
let _cache: Map<string, boolean> | null = null;
let _cacheTime = 0;
const CACHE_TTL = 30_000; // 30 seconds

export const FeatureFlagService = {
    /**
     * Check if a feature is globally enabled.
     * Returns true if the flag doesn't exist (opt-in: features enabled by default).
     */
    async isEnabled(db: DbType, key: string): Promise<boolean> {
        // Check cache first
        if (_cache && Date.now() - _cacheTime < CACHE_TTL) {
            const cached = _cache.get(key);
            if (cached !== undefined) return cached;
        }

        const flag = await db.query.featureFlags.findFirst({
            where: eq(featureFlags.key, key),
            columns: { enabled: true },
        });

        // If no flag exists, feature is enabled by default
        return flag?.enabled ?? true;
    },

    /**
     * Get all feature flags.
     */
    async getAll(db: DbType) {
        const flags = await db.query.featureFlags.findMany({
            orderBy: featureFlags.key,
        });

        // Refresh cache
        _cache = new Map(flags.map((f: any) => [f.key, f.enabled]));
        _cacheTime = Date.now();

        return flags;
    },

    /**
     * Toggle a feature flag on/off.
     */
    async toggle(db: DbType, key: string, enabled: boolean, updatedBy?: string) {
        await db
            .update(featureFlags)
            .set({ enabled, updatedAt: new Date(), updatedBy: updatedBy || null })
            .where(eq(featureFlags.key, key));

        // Invalidate cache
        _cache = null;
    },

    /**
     * Ensure all default features exist in the database.
     * Idempotent — safe to call on every startup.
     */
    async seed(db: DbType) {
        const existing = await db.query.featureFlags.findMany({
            columns: { key: true },
        });
        const existingKeys = new Set(existing.map((f: any) => f.key));

        for (const feat of DEFAULT_FEATURES) {
            if (!existingKeys.has(feat.key)) {
                const id = `ff_${feat.key}`;
                await db.insert(featureFlags).values({
                    id,
                    key: feat.key,
                    name: feat.name,
                    description: feat.description,
                    enabled: feat.enabled,
                });
            }
        }
    },

    /** Invalidate in-memory cache (useful after admin updates). */
    invalidateCache() {
        _cache = null;
    },
};
