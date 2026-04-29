# Gang Manager User Feature Guide

เอกสารนี้คือคู่มือใช้งานสำหรับ owner/admin/member ในช่วง soft launch ใช้คู่กับ `MANUAL_E2E_TEST_PLAN.md` ได้เลย

## 1. เริ่มต้นใช้งาน

สิ่งที่ต้องมี:

- Discord server ที่คุณมีสิทธิ์จัดการ
- Discord account สำหรับ owner
- Bot ถูกเชิญเข้า server แล้ว
- Login เว็บด้วย Discord

ขั้นตอน:

1. กดเพิ่มบอทจากหน้า landing หรือ Discord invite link
2. ใน Discord ใช้คำสั่ง `/setup`
3. เลือกติดตั้งอัตโนมัติถ้าต้องการให้ระบบสร้าง role/channel ให้
4. เลือกติดตั้งเองถ้ามี role/channel อยู่แล้ว
5. เข้าเว็บ dashboard ด้วย Discord account เดียวกัน
6. ตรวจหน้า Settings ว่า role/channel mapping ถูกต้อง

ข้อควรระวัง:

- Discord role เดียวไม่ควรผูกหลาย permission
- Owner role ควรมีเฉพาะคนที่ไว้ใจได้จริง
- ถ้าใช้ manual setup ให้ตรวจ Owner/Admin/Treasurer/Member ก่อนเปิดให้คนอื่นใช้

## 2. สมาชิกและ Discord Identity

ใช้สำหรับดูแลสมาชิกและสิทธิ์ในแก๊ง

Owner/Admin ทำได้:

- ดูรายชื่อสมาชิก
- เพิ่มหรือแก้ไขข้อมูลสมาชิก
- อนุมัติ/ปิดใช้งานสมาชิก
- เปลี่ยน role ของสมาชิกตามสิทธิ์ที่กำหนด
- ตรวจสถานะ Discord identity

Member ทำได้:

- ดูโปรไฟล์ตัวเอง
- ตรวจสถานะการเช็คชื่อ/ลา/ข้อมูลที่เกี่ยวข้องกับตัวเอง

Production note:

- ถ้า role sync ผิด ให้หยุดแก้หลายจุดพร้อมกัน แล้วตรวจ role mapping ใน Settings ก่อน
- ถ้าสมาชิกได้สิทธิ์เกินจริง ให้เช็ค Discord role ซ้ำทันที

## 3. เช็คชื่อ Attendance

ใช้สำหรับสร้างรอบเช็คชื่อและบันทึกสถานะสมาชิก

สิทธิ์ที่ควรใช้:

- Owner
- Admin
- Attendance Officer

Flow ปกติ:

1. ไปที่ Dashboard > Attendance
2. กดสร้างรอบเช็คชื่อ
3. ใส่ชื่อรอบและค่าที่จำเป็น
4. เปิดรอบ
5. สมาชิกหรือทีมดูแลอัปเดตสถานะ
6. ปิดรอบเมื่อจบกิจกรรม
7. ตรวจประวัติในหน้ารายละเอียดรอบ

สถานะที่ควรเข้าใจ:

- รอเริ่ม
- เปิดอยู่
- ปิดแล้ว
- มา
- ลา
- ยังไม่เข้า

ข้อควรระวัง:

- หลังปิดรอบ ถ้ามีการแก้ย้อนหลังต้องทำโดยคนมีสิทธิ์เท่านั้น
- ถ้า finance ถูก lock ระบบไม่ควรสร้างผลกระทบทางการเงินจาก attendance penalty

## 4. การลา Leave Requests

ใช้สำหรับให้สมาชิกแจ้งลาและให้ทีมดูแลอนุมัติ

Member ทำได้:

- ส่งคำขอลา
- ดูสถานะคำขอ

Admin/Owner ทำได้:

- ดูคำขอที่รออนุมัติ
- อนุมัติหรือปฏิเสธ
- ตรวจประวัติคำขอ

ข้อควรระวัง:

- ปุ่มเก่าหรือคำขอที่ประมวลผลแล้วไม่ควรถูกกดซ้ำจนเปลี่ยนสถานะซ้ำ
- ถ้าสถานะผิด ให้เก็บ screenshot และเวลาที่เกิดปัญหา

## 5. การเงิน Finance

ใช้สำหรับจัดการเงินกองกลางและรายการทางการเงินภายในแก๊ง

สิทธิ์ที่ควรใช้:

- Owner
- Treasurer

รายการที่รองรับ:

- Deposit / ฝากเงิน
- Expense / จ่ายเงิน
- Loan / สำรองจ่ายหรือยืม
- Repayment / คืนเงิน
- Gang fee / เก็บเงินแก๊ง

Flow ปกติ:

1. สร้างรายการการเงิน
2. รายการเข้าสถานะ pending
3. Treasurer หรือ Owner ตรวจรายละเอียด
4. กด approve หรือ reject
5. ระบบบันทึกยอดและ audit log

ข้อควรระวังระดับ production:

- FREE/expired plan ต้องใช้ finance ไม่ได้
- ปุ่ม Discord เก่าที่เป็นรายการ pending ต้อง approve ไม่ได้ถ้า plan หมด
- Reject ควรใช้ cleanup รายการที่ไม่ต้องการได้
- กด approve ซ้ำต้องไม่ทำยอดซ้ำ
- ก่อนใช้ข้อมูลการเงินจริง ควรตรวจยอดกับหลักฐานภายนอกเสมอ

## 6. ประกาศ Announcements

ใช้สำหรับประกาศข่าวสารให้สมาชิก

Admin/Owner ทำได้:

- สร้างประกาศ
- แก้ไขประกาศ
- ลบประกาศ
- ดูสถานะ active/expired

ข้อควรระวัง:

- ตรวจช่อง announcement ใน Settings ก่อนใช้งานจริง
- ถ้าลบผิด ให้ใช้ audit/log และ screenshot ช่วยตามเหตุการณ์

## 7. Settings และ Manual Setup

หน้าที่ควรตรวจหลังติดตั้ง:

- General profile
- Roles & Channels
- Subscription
- Advanced

Roles & Channels:

- Owner: สิทธิ์สูงสุด
- Admin: จัดการสมาชิก/ประกาศ/ระบบ
- Treasurer: จัดการการเงิน
- Attendance Officer: จัดการเช็คชื่อ
- Member: สมาชิกทั่วไป

Channel settings:

- Log / Audit
- Register
- Attendance
- Finance
- Announcement
- Leave
- Requests / Approval

Advanced:

- Server transfer
- Dissolve gang

ข้อควรระวัง:

- Advanced actions เป็น destructive หรือกระทบข้อมูลสูง ต้องใช้เฉพาะ owner
- Dissolve gang ต้องทำกับ test gang เท่านั้นระหว่าง soft launch

## 8. Subscription และ Billing

สถานะปัจจุบัน:

- ระบบรองรับ PromptPay/SlipOK architecture แล้ว
- Billing สามารถปิดด้วย `ENABLE_PROMPTPAY_BILLING=false`
- ถ้า billing ปิด ผู้ใช้จะซื้อแพลนจริงไม่ได้
- Admin สามารถตรวจ payment request และ approve/reject ได้เมื่อมีรายการที่ถูก submit

ก่อนเปิดรับเงินจริง:

- ผูก PromptPay กับบัญชีธนาคารให้เรียบร้อย
- ตั้งค่า receiver name และ PromptPay identifier ใน secret/env
- Rotate SlipOK key ถ้าเคยถูกแชร์ใน chat
- ทดสอบ live slip อย่างน้อย 1 ครั้ง
- ทดสอบ duplicate slip และ amount mismatch

กรณีเกิดปัญหา:

- ถ้าโอนไม่เข้า ให้ reject พร้อม note
- ถ้าสลิปต้องตรวจมือ ให้ admin ตรวจหลักฐานก่อน approve
- ถ้า billing มีปัญหา ให้ปิด `ENABLE_PROMPTPAY_BILLING=false` ก่อน

## 9. Admin Console

สำหรับ super admin ของระบบ

ใช้ดู:

- Gangs
- Members
- Licenses
- Sales / subscription payments
- Security
- Logs
- Feature flags
- Data/backup

ข้อควรระวัง:

- Admin route ต้องใช้เฉพาะคนที่อยู่ใน `ADMIN_DISCORD_IDS`
- การ approve payment เปิดแพลนจริง จึงต้องตรวจหลักฐานก่อนเสมอ
- หน้า Security ใช้เช็ค env/readiness ก่อน launch

## 10. Public Pages

หน้าที่ผู้ใช้เห็นก่อน login:

- Landing page `/`
- Terms `/terms`
- Privacy `/privacy`
- Support `/support`

สิ่งที่ควรเทส:

- เปิดได้โดยไม่ login
- ลิงก์ footer ไปถูกหน้า
- Login button ทำงาน
- Discord invite เปิดได้
- อ่านบนมือถือได้

## 11. วิธีแจ้งบัค

ใช้ format นี้จะช่วยแก้เร็ว:

```text
หน้า/ฟีเจอร์:
บัญชีที่ใช้:
Role:
ขั้นตอนที่กด:
ผลที่คาดหวัง:
ผลที่เกิดจริง:
เวลาโดยประมาณ:
Screenshot/log:
ความรุนแรง: P0/P1/P2
```

ระดับความรุนแรง:

- P0: ระบบหลักใช้ไม่ได้, เงิน/สิทธิ์/ข้อมูลผิด, bot crash, data loss
- P1: ใช้งานลำบากมาก, UX สับสน, flow สำคัญติด
- P2: ข้อความ/ดีไซน์/ความเรียบร้อย

## 12. Soft Launch Checklist

ก่อนชวนเพื่อนช่วยเทส:

- `npm run release:verify` ผ่าน
- `npm run docker:verify` หรือ deploy health ผ่าน
- DB migration apply แล้ว
- Billing ปิดอยู่ หรือทดสอบ payment จริงผ่านแล้ว
- Terms/Privacy/Support เปิดดูได้
- Test gang พร้อมสำหรับลอง destructive flow
- มีช่อง Discord Support สำหรับรับ feedback

ถ้าผ่านรายการนี้ ถือว่า soft launch แบบจำกัดกลุ่มได้ แต่ยังไม่ใช่ production 100% จนกว่า P0 manual test ผ่านครบ
