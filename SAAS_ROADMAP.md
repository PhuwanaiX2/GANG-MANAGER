# 🗺️ FiveM Gang Management — SaaS Roadmap

> ข้อมูลตลาด: แก๊งทั่วไป ~20 คน, แก๊งใหญ่ 25-30 คน

## Tier Pricing (ปรับตามข้อมูลจริง)

| Tier | ราคา/เดือน | สมาชิก | ฟีเจอร์ |
|---|---|---|---|
| 🆓 FREE | ฿0 | 10 คน | ลงทะเบียน, เช็คชื่อ, แจ้งลา, Audit Log 7 วัน |
| ⭐ PRO | ฿149 | 25 คน | ทุกอย่างใน FREE + ระบบการเงิน, Export CSV, Audit Log 90 วัน, Backup รายวัน |
| 💎 PREMIUM | ฿299 | 40 คน | ทุกอย่างใน PRO + Analytics Dashboard, Audit Log ไม่จำกัด, Priority Support, Custom branding |
| 🏢 SERVER | ฿999 | ไม่จำกัดแก๊ง | สำหรับเจ้าของเซิร์ฟ — ทุกแก๊งในเซิร์ฟใช้ได้หมด |

---

## Phase 1: Security Fixes 🔴 (สัปดาห์ที่ 1)

### 1.1 Fix Dissolve API — OWNER permission check
- **ไฟล์**: `apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts`
- **ปัญหา**: ใช้ `OWNER_ROLE_ID_PLACEHOLDER` ไม่ได้ตรวจจริง → สมาชิกใดก็ dissolve ได้
- **แก้**: ใช้ `members.gangRole === 'OWNER'` เหมือนที่อื่นในระบบ

### 1.2 Fix Leave approval — เพิ่ม permission check
- **ไฟล์**: `apps/bot/src/features/leave.ts`
- **ปัญหา**: `handleLeaveAction` ไม่ตรวจ permission → ใครกดปุ่มก็อนุมัติได้
- **แก้**: เพิ่ม `checkPermission(interaction, ['OWNER', 'ADMIN'])`

### 1.3 Fix Repay Full — balanceBefore/After ไม่ถูกต้อง
- **ไฟล์**: `apps/bot/src/features/finance.ts`
- **ปัญหา**: `balanceBefore: 0, balanceAfter: 0` hardcoded
- **แก้**: ดึง gang.balance จริงมาใช้

### 1.4 Fix Penalty Scheduler — ใช้ OCC
- **ไฟล์**: `apps/bot/src/services/attendanceScheduler.ts`
- **ปัญหา**: `set({ balance: balanceAfter })` ไม่ atomic
- **แก้**: เพิ่ม `WHERE balance = currentBalance` (OCC pattern)

---

## Phase 2: Financial Transparency 💰 (สัปดาห์ที่ 2)

### 2.1 หน้า "ยอดของฉัน" สำหรับสมาชิก
- สร้าง `/dashboard/[gangId]/my-profile` 
- แสดง: ยอดหนี้, ประวัติ transaction ของตัวเอง, สถานะเช็คชื่อ

### 2.2 Export CSV
- เพิ่ม API `/api/gangs/[gangId]/finance/export`
- ปุ่ม "ดาวน์โหลด CSV" ในหน้า Finance (PRO+ only)

### 2.3 Monthly Summary
- เพิ่ม API สรุปรายเดือน (income/expense/net per month)
- แสดง chart ใน Finance overview

### 2.4 PENALTY → Session link
- เพิ่ม `sessionId` field ใน transaction เมื่อเป็น PENALTY
- แสดง link กลับไปดู session ที่ถูกปรับ

---

## Phase 3: SaaS Tier Enforcement 🔐 (สัปดาห์ที่ 2-3)

### 3.1 Member Limit Enforcement
- **Bot register**: ตรวจจำนวนสมาชิก active ก่อนสร้าง
- **Web API**: ตรวจเช่นกัน
- แสดง "แก๊งเต็ม กรุณาอัปเกรด" ถ้าเกิน limit

### 3.2 License Validation ตอน /setup
- ตรวจ license key ที่กรอกใน setup modal
- Match กับ `licenses` table → set `subscriptionTier`
- ถ้าไม่มี key → default FREE

### 3.3 Feature Gating
- สร้าง utility `checkTierAccess(gangId, feature)` 
- Gate: Finance (PRO+), Export (PRO+), Analytics (PREMIUM+)
- แสดง upgrade prompt แทน error

### 3.4 License Expiry
- Scheduler ตรวจ license หมดอายุทุกวัน
- Grace period 3 วัน → downgrade เป็น FREE

---

## Phase 4: Payment & Subscription 💳 (สัปดาห์ที่ 3-4)

### 4.1 Payment Integration
- **ตัวเลือก A**: Stripe (สากล, รองรับ card)
- **ตัวเลือก B**: Omise (ไทย, รองรับ PromptPay, TrueMoney)
- **แนะนำ**: Omise — เหมาะกับตลาดไทย, รับ PromptPay ได้

### 4.2 Subscription Management Page
- `/dashboard/[gangId]/settings/subscription`
- แสดง: tier ปัจจุบัน, วันหมดอายุ, ปุ่มอัปเกรด/ต่ออายุ

### 4.3 Webhook Handling
- `/api/webhooks/payment` — รับ callback จาก payment provider
- Auto-activate license เมื่อจ่ายสำเร็จ
- Auto-downgrade เมื่อหมดอายุ

---

## Phase 5: Landing Page & Growth 🚀 (สัปดาห์ที่ 4-5)

### 5.1 Landing Page
- Hero section + feature showcase
- Pricing table (interactive)
- Testimonials / social proof
- CTA → เข้า Dashboard หรือ เพิ่ม Bot

### 5.2 Usage Metrics
- Track: active guilds, DAU/MAU, transactions/day
- ใช้สำหรับ business decisions

### 5.3 Super Admin Dashboard
- `/admin` — เฉพาะ ADMIN_DISCORD_IDS
- ดูภาพรวม: จำนวน gang, revenue, active users

---

## สรุป Timeline

```
สัปดาห์ 1: Phase 1 (Security) ← ทำก่อน ห้ามข้าม
สัปดาห์ 2: Phase 2 (Transparency) + Phase 3 เริ่ม (Tier)
สัปดาห์ 3: Phase 3 (Tier) + Phase 4 เริ่ม (Payment)
สัปดาห์ 4: Phase 4 (Payment) + Phase 5 เริ่ม (Landing)
สัปดาห์ 5: Phase 5 (Landing) + QA + Soft Launch
```
