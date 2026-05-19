# UX/UI Redesign Brief

Last updated: 2026-05-19

## Direction

Modern Discord-native SaaS Operations Dashboard

แนวทางคือทำให้เว็บเป็น command center สำหรับจัดการแก๊งผ่าน Discord และเว็บ ไม่ใช่แค่หน้า card หลายใบมารวมกัน ระบบต้องอ่านง่าย กดง่าย และให้ผู้ใช้รู้ทันทีว่าต้องทำอะไรต่อ

## Global Rules

- [x] ใช้ route pattern แบบเดียวกัน: sub page ใช้ path เช่น `/attendance/history`, `/finance/history`, `/settings/roles-channels`
- [x] ใช้ shared sub navigation สำหรับ section ที่มีหลายงาน
- [x] modal ต้องอยู่เหนือ sidebar/mobile nav
- [x] header แก๊งแสดง plan แล้ว ไม่กระจาย plan card ซ้ำเกินจำเป็น
- [x] ปุ่ม theme/accent ถูกทำให้เล็กลง ไม่แย่งสายตา
- [x] ปุ่มช่วยเหลือที่ไม่จำเป็นถูกเอาออกจากหน้าเช็คชื่อ
- [x] copy ที่เป็น dev/debug wording ถูกเก็บออกจาก user-facing surfaces หลัก
- [x] ทำ visual smoke หลัง production deploy ทุกครั้ง

## Dashboard

- [x] หน้าเลือกแก๊งเรียงตามสิทธิ์สูงสุดของผู้ใช้
- [x] card แสดง role/plan ให้เข้าใจว่าเข้าไปแล้วทำอะไรได้
- [x] dashboard gang overview แสดง plan ที่ header
- [ ] รอบ redesign ถัดไป: ลด card รองและจัด attention queue ให้คมขึ้น

## Members

- [x] เพิ่มสมาชิกผ่าน Discord guild member picker
- [x] ซ่อน Discord user ที่ถูกเชื่อมกับสมาชิกแล้ว
- [x] sort สมาชิกตามความสำคัญ: pending, active, role, name
- [x] mobile card/table แยกกันเพื่ออ่านง่าย
- [ ] รอบ redesign ถัดไป: ปรับ roster table density และ row action ให้แน่นขึ้น

## Member Detail / My Profile

- [x] ใช้ shared member activity ledger model
- [x] ลดการซ้ำของ label/description ใน finance activity
- [x] card summary ของตัวเองแสดงเฉพาะข้อมูลที่มีผลกับผู้ใช้
- [ ] รอบ redesign ถัดไป: ทำ profile header/action rail ให้เหมือนกันทุก role

## Attendance

- [x] main page แยก active rounds ออกจาก history
- [x] มีหน้า `/attendance/history`
- [x] closed history ใช้ snapshot/count จาก record ตอนนั้น ไม่ใช้สมาชิกปัจจุบันไปนับย้อนหลัง
- [x] manual round หลังปิด redirect ไป history
- [x] leave status แสดงใน manual roll call
- [x] note/source แยกข้อมูลให้ไม่ซ้ำจนอ่านยาก
- [ ] รอบ redesign ถัดไป: ปรับ detail layout ให้ dense และ log อ่านง่ายขึ้น

## Leaves

- [x] form ส่งคำขอเป็น modal
- [x] admin เห็น approval queue, user เห็นประวัติของตัวเอง
- [x] pending/done ถูกแยกเป็น card/section ชัดขึ้น
- [ ] รอบ redesign ถัดไป: ปรับ mobile empty state และ compact table

## Finance

- [x] finance เป็น gang-money command center ไม่ปน billing
- [x] ค้างเก็บไม่ถูกสื่อว่าเป็นเงินเข้า
- [x] route แยก `/finance`, `/finance/history`, `/finance/summary`
- [x] rule card เห็นบนมือถือ
- [x] plan card ซ้ำถูกเอาออกจาก finance header
- [ ] รอบ redesign ถัดไป: แยก pending review/debtors เป็น route เต็มถ้าข้อมูลเริ่มเยอะ

## Analytics

- [x] copy เปลี่ยนเป็นสถิติแก๊ง ไม่ใช้คำ generic/developer
- [x] เอา decorative texture ภายนอกออก
- [ ] รอบ redesign ถัดไป: ลด generic chart และเพิ่ม insight/action ที่กดต่อได้

## Billing

- [x] มีขั้นตอนชำระเงิน: สร้างบิล -> โอนเงิน -> ส่งสลิป -> เปิดใช้งาน
- [x] rejected slip อธิบายเป็นภาษาผู้ใช้และปิดรายการเดิม
- [x] License Key เป็น fallback ด้านล่าง
- [ ] Live payment smoke จริงยังต้องทำเมื่อพร้อมใช้เงินจริง

## Settings

- [x] settings route แยก profile / roles-channels / advanced ด้วย path
- [x] billing ถูกแยกออกจาก settings
- [x] gang profile เอา plan row ซ้ำออก
- [ ] รอบ redesign ถัดไป: ลด density ของ roles/channels และ danger zone

## QA Gate

- [x] `npm run test -w apps/web -- src/tests/api/members.test.ts src/tests/attendance-domain.test.ts`
- [x] `npm test`
- [x] `npm run lint -w apps/web`
- [x] `npm run build -w apps/web`
- [x] `npm run encoding:verify`
- [x] `git diff --check`
- [x] Deploy production
- [x] Browser visual smoke หลัง deploy
