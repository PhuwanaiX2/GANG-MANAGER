export type BillingPlanId = 'FREE' | 'PREMIUM';

export interface BillingPlan {
    id: BillingPlanId;
    name: string;
    rank: number;
    priceMonthly: number;
    priceYearly: number;
    maxMembers: number;
    popular?: boolean;
    settingsFeatures: string[];
    marketingDescription: string;
    marketingFeatures: string[];
}

export const BILLING_PLANS: BillingPlan[] = [
    {
        id: 'FREE',
        name: 'Free',
        rank: 0,
        priceMonthly: 0,
        priceYearly: 0,
        maxMembers: 15,
        settingsFeatures: [
            'สมาชิกสูงสุด 15 คน',
            'ลงทะเบียน + เช็คชื่อ + แจ้งลา',
            'Audit Log 7 วัน',
        ],
        marketingDescription: 'สำหรับแก๊งเล็ก เริ่มต้นฟรี',
        marketingFeatures: [
            'สมาชิกสูงสุด 15 คน',
            'เช็คชื่อ + แจ้งลา',
            'Audit Log 7 วัน',
        ],
    },
    {
        id: 'PREMIUM',
        name: 'Premium',
        rank: 1,
        priceMonthly: 199,
        priceYearly: 1990,
        maxMembers: 40,
        popular: true,
        settingsFeatures: [
            'สมาชิกสูงสุด 40 คน',
            'ระบบการเงินครบวงจร (ยืม/คืน/ฝาก/เก็บเงินแก๊ง)',
            'Export CSV',
            'สรุปรายเดือน',
            'Analytics Dashboard',
            'Multi-Admin',
            'Backup รายวัน',
            'Webhook Notifications',
            'Audit Log ไม่จำกัด',
            'Priority Support',
        ],
        marketingDescription: 'ฟูลออปชัน ทุกฟีเจอร์',
        marketingFeatures: [
            'สมาชิกสูงสุด 40 คน',
            'ระบบการเงินครบวงจร (ยืม/คืน/ฝาก/เก็บเงินแก๊ง)',
            'Analytics + Export CSV + Audit ไม่จำกัด',
        ],
    },
];

export const BILLING_PLAN_MAP = Object.fromEntries(
    BILLING_PLANS.map((plan) => [plan.id, plan]),
) as Record<BillingPlanId, BillingPlan>;
