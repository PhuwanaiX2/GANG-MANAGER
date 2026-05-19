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
            'ลงทะเบียน เช็คชื่อ และแจ้งลา',
            'ประวัติระบบ 7 วัน',
        ],
        marketingDescription: 'แพลนพื้นฐานสำหรับแก๊งเล็ก หรือช่วงที่ยังไม่ต้องใช้ระบบการเงินเต็มรูปแบบ',
        marketingFeatures: [
            'สมาชิกสูงสุด 15 คน',
            'เช็คชื่อและแจ้งลา',
            'ประวัติระบบ 7 วัน',
        ],
    },
    {
        id: 'PREMIUM',
        name: 'Premium',
        rank: 1,
        priceMonthly: 179,
        priceYearly: 1790,
        maxMembers: 40,
        popular: true,
        settingsFeatures: [
            'สมาชิกสูงสุด 40 คน',
            'ระบบการเงินครบวงจร ยืม คืน ฝาก และเก็บเงินแก๊ง',
            'ส่งออก CSV',
            'สรุปรายเดือน',
            'สถิติแก๊ง',
            'ผู้ดูแลหลายคน',
            'สำรองข้อมูลรายวัน',
            'แจ้งเตือนผ่าน Webhook',
            'ประวัติระบบไม่จำกัด',
            'ซัพพอร์ตเร่งด่วน',
        ],
        marketingDescription: 'ปลดล็อกระบบการเงิน รายงาน และเครื่องมือดูแลแก๊งสำหรับใช้งานจริงต่อเนื่อง',
        marketingFeatures: [
            'สมาชิกสูงสุด 40 คน',
            'ระบบการเงินครบวงจร',
            'สถิติแก๊ง ส่งออก CSV และประวัติระบบไม่จำกัด',
            'ต่ออายุด้วย PromptPay เมื่อเปิดรับชำระเงิน',
        ],
    },
];

export const BILLING_PLAN_MAP = Object.fromEntries(
    BILLING_PLANS.map((plan) => [plan.id, plan]),
) as Record<BillingPlanId, BillingPlan>;
