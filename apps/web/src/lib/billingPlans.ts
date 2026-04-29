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
        marketingDescription: 'แพลนพื้นฐานหลังหมดช่วงทดลองใช้งาน',
        marketingFeatures: [
            'สมาชิกสูงสุด 15 คน',
            'เช็คชื่อ + แจ้งลา',
            'Audit Log 7 วัน',
        ],
    },
    {
        id: 'PREMIUM',
        name: 'Pro',
        rank: 1,
        priceMonthly: 179,
        priceYearly: 1790,
        maxMembers: 40,
        popular: true,
        settingsFeatures: [
            'สมาชิกสูงสุด 40 คน',
            'ทดลองใช้ฟรี 7 วันสำหรับแก๊งใหม่',
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
        marketingDescription: 'ทดลองใช้ฟรี 7 วัน แล้วใช้งานต่อในราคาเดียว',
        marketingFeatures: [
            'ทดลองใช้ฟรี 7 วัน ไม่ต้องผูกบัตร',
            'สมาชิกสูงสุด 40 คน',
            'ระบบการเงินครบวงจร (ยืม/คืน/ฝาก/เก็บเงินแก๊ง)',
            'Analytics + Export CSV + Audit ไม่จำกัด',
        ],
    },
];

export const BILLING_PLAN_MAP = Object.fromEntries(
    BILLING_PLANS.map((plan) => [plan.id, plan]),
) as Record<BillingPlanId, BillingPlan>;
