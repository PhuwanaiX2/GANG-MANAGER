# Manual E2E Test Plan Before Production

เอกสารนี้คือ checklist สำหรับเจ้าของโปรเจกต์ใช้ทดสอบเองก่อนปล่อยใช้งานจริง เป้าหมายคือยืนยันว่า core product ใช้ได้จริง ปลอดภัยพอ และไม่มีช่องหลุดระดับ production-critical

สถานะปัจจุบันที่ใช้เป็นฐาน:

- Product focus มาก่อน billing: ระบบซื้อแพลน/รับเงินยังไม่ควรเปิดขายจริงจนกว่า P0 ทั้งหมดผ่าน
- PromptPay/SlipOK ใช้แทน Stripe ในอนาคต แต่ถ้ายังไม่มีเงิน live test ให้ปิด billing ไว้ก่อน
- DB migration ให้เจ้าของโปรเจกต์เป็นคน apply เอง แต่ต้องไม่ตอบ yes กับ prompt ที่เสี่ยงลบข้อมูลโดยไม่ตรวจ
- Manual/E2E test นี้เป็น production gate หลักก่อน soft launch

## 0. Go / No-Go Rule

พร้อมปล่อยแบบ soft launch ได้เมื่อ:

- P0 test cases ผ่านทั้งหมด
- `npm run release:verify` ผ่าน
- `npm run docker:verify` ผ่าน หรือ deploy target health/readiness ผ่านเทียบเท่า
- DB migration apply แล้วไม่มี data loss prompt ที่ยังไม่ได้ตรวจ
- Billing ยังปิดอยู่ หรือถ้าจะเปิด billing ต้อง rotate key และมี SlipOK live test ผ่านก่อน

ห้ามปล่อยถ้าเจออย่างใดอย่างหนึ่ง:

- Login/auth หลุด role หรือข้าม permission ได้
- FREE/expired plan ใช้ finance หรือ approve รายการเงินเก่าได้
- Manual setup map role ซ้ำจน owner/admin/member เพี้ยนได้
- DB migration มี prompt แนว drop/delete/truncate/recreate โดยยังไม่ได้ตรวจ
- Bot error จน command หลักใช้งานไม่ได้
- การย้ายเซิร์ฟเวอร์หรือ dissolve gang ลบ/ย้ายข้อมูลได้โดยไม่ตั้งใจ
- Payment webhook/slip verification เปิดจริงทั้งที่ยังไม่ rotate key และยังไม่ live test

## 1. Pre-Flight

ให้ทำก่อนเริ่ม manual test ทุกครั้ง

```powershell
npm run release:verify
npm run docker:verify
```

ถ้า test ผ่าน ให้เปิด service จาก Docker แล้วเช็ค:

- Web health: `http://localhost:3000/api/health`
- Bot health: `http://localhost:8080/health`
- Bot readiness: `http://localhost:8080/ready`

ข้อมูล test ที่ควรเตรียม:

- Discord server สำหรับทดสอบ 1 server
- Discord account อย่างน้อย 3 บทบาท: owner, admin/treasurer, member
- Role ใน Discord แยกชัดเจน: Owner, Admin, Treasurer, Member, Attendance Officer
- Gang test 1 ก้อนสำหรับ auto setup
- Gang test 1 ก้อนสำหรับ manual setup
- Browser desktop และ mobile viewport

## 2. DB Migration Apply Rule

ก่อน apply migration:

```powershell
npm run db:audit:role-mappings
npm run db:normalize:tiers
```

คำสั่ง apply:

```powershell
npm run db:push
```

ถ้า Drizzle ถามแนวนี้ โดยตรงกับ schema/migration ล่าสุด ให้ตอบ yes ได้:

- Create table
- Add column
- Add index
- Add unique constraint
- Add enum/value

ถ้า Drizzle ถามแนวนี้ ให้หยุดทันทีและส่งข้อความ prompt มาเช็คก่อน:

- Drop table
- Drop column
- Delete column
- Truncate
- Recreate table
- Data loss warning
- Rename ที่ดูเหมือนจะลบของเดิมแล้วสร้างใหม่
- Anything that says existing data may be lost

หลัง apply เสร็จ:

```powershell
npm run db:audit:role-mappings
npm run db:normalize:tiers
```

ถ้า `db:normalize:tiers` บอกว่ามีข้อมูลต้องแก้ ให้เก็บ output ไว้ก่อน ถ้าเป็นแค่ normalize tier จากค่าเก่าไปค่าใหม่ค่อยทำต่อได้ แต่ถ้าแตะข้อมูลเยอะผิดปกติให้หยุดเช็คก่อน

## 3. SlipOK / Billing With Zero Budget

ตอนนี้ไม่มีเงิน live test ไม่ถือว่าเป็น blocker ถ้า billing ยังปิดอยู่

แนวทางที่ปลอดภัย:

- Keep `ENABLE_PROMPTPAY_BILLING=false`
- หน้า/ปุ่มซื้อแพลนต้องแสดงว่า billing ยังไม่เปิด หรือปิด flow จ่ายเงินจริง
- ใช้ manual grant/trial/admin action แทนการขายจริงจนกว่า product core จะผ่าน P0
- ห้ามเปิดรับเงิน public จนกว่าจะ rotate SlipOK key และทดสอบ live slip อย่างน้อย 1 ครั้ง

ก่อนเปิด SlipOK จริง:

- Rotate API key เพราะ key เคยถูก paste ใน chat
- ตั้งค่า env ใหม่ใน production secret manager เท่านั้น
- ทดสอบ slip จริงจำนวนเล็กที่สุดที่ทำได้
- ทดสอบ duplicate slip ต้องไม่ approve ซ้ำ
- ทดสอบ amount mismatch ต้องเข้า manual review หรือ reject
- ทดสอบ disabled billing ต้องไม่แตะ DB/payment state

## 4. P0 Manual Test Cases

ให้บันทึกผลเป็น PASS / FAIL / BLOCKED ในแต่ละข้อ

| ID | Area | Steps | Expected |
| --- | --- | --- | --- |
| P0-01 | Web login | Login เข้าเว็บด้วย Discord account owner | เข้า dashboard ได้ และเห็นเฉพาะ gang ที่มีสิทธิ์ |
| P0-02 | Auth guard | เปิด URL dashboard/admin ด้วย account ที่ไม่มีสิทธิ์ | ถูก redirect หรือขึ้น forbidden ไม่เห็นข้อมูลลับ |
| P0-03 | Auto setup | ใช้ flow ติดตั้ง DC แบบอัตโนมัติ | สร้าง roles/channels/settings ได้ครบ ไม่มี error ใน bot |
| P0-04 | Manual setup unique owner | Manual setup แล้วลอง map role เดียวกันเป็น Owner และ Member/Admin | ระบบต้อง block role ซ้ำ หรือเตือนชัดเจน ห้ามทุกคนกลายเป็น owner |
| P0-05 | Manual setup missing role | Manual setup โดยไม่เลือก role สำคัญบางตัว | ระบบต้องบอกว่าขาดอะไร และไม่บันทึก config ครึ่งๆ กลางๆ |
| P0-06 | Discord permission | Member ใช้ command admin/finance | ต้องถูกปฏิเสธด้วยข้อความชัดเจน |
| P0-07 | Treasurer permission | Treasurer ใช้ finance action ที่ได้รับอนุญาต | ใช้ได้เฉพาะ action การเงิน ไม่ได้สิทธิ์ owner/admin อื่นเกินจำเป็น |
| P0-08 | Member registration | Member สมัคร/ผูก Discord identity | สถานะ member ถูกต้อง role sync ถูกต้อง ไม่มี duplicate member |
| P0-09 | Attendance create | Admin/Attendance Officer สร้าง session เช็คชื่อ | Session เปิดได้ แสดงใน web/bot ถูกต้อง |
| P0-10 | Attendance check-in | Member check-in 1 ครั้ง แล้วลองซ้ำ | ครั้งแรกสำเร็จ ครั้งซ้ำไม่สร้าง duplicate |
| P0-11 | Attendance close | ปิด session แล้ว member พยายาม check-in | ต้องไม่รับ check-in หลังปิด |
| P0-12 | Attendance finance lock | FREE/expired plan ใช้ attendance ที่มี penalty/finance side effect | เช็คชื่อยังไม่ควรทำให้ finance data เปลี่ยนถ้า finance ถูก lock |
| P0-13 | Leave request | Member ส่งลา แล้ว admin approve/reject | สถานะเปลี่ยนถูกต้อง ปุ่มเก่า/กดซ้ำต้องไม่ทำซ้ำ |
| P0-14 | Finance locked web | FREE/expired plan เปิด finance page/API | ไม่เห็นข้อมูลเงินจริง ไม่เห็นยอด balance/debt จริง และ action ถูก block |
| P0-15 | Finance locked Discord | FREE/expired plan กดปุ่มฝาก/จ่าย/สำรองจ่าย/approve จาก Discord | ทุก action การเงินต้องถูกปฏิเสธเหมือนกัน ไม่ใช่ block แค่บางปุ่ม |
| P0-16 | Finance approve old pending | สร้าง pending ตอนมีสิทธิ์ แล้วลด/หมด plan ก่อน approve | Approve ต้องถูก block, Reject ยังใช้ cleanup ได้ |
| P0-17 | Finance premium happy path | เปิดสิทธิ์ finance แล้วสร้าง deposit/loan/repay/gang fee | สถานะ pending/approved/rejected ถูกต้อง balance เปลี่ยนถูกต้อง |
| P0-18 | Finance double click | กด approve/reject transaction เดิมซ้ำ | ต้องไม่ double approve และไม่ทำ balance ซ้ำ |
| P0-19 | Member balance edit | Treasurer แก้ balance ตอน finance locked และตอน finance allowed | Locked ต้อง block, Allowed ต้อง update พร้อม audit |
| P0-20 | Announcements | สร้าง/แก้/ลบประกาศ และดู active/expired label | UI ชัดเจน action ถูกต้อง ไม่ลบผิดรายการ |
| P0-21 | Upload/logo | Owner upload logo จาก Discord CDN และลอง URL/SVG แปลกๆ | รับเฉพาะไฟล์/URL ที่ปลอดภัยและถูกเงื่อนไข |
| P0-22 | Server transfer | เริ่ม transfer/cancel/complete ด้วย owner และ non-owner | Non-owner ถูก block, owner ต้องมี confirmation ชัดเจน |
| P0-23 | Dissolve gang | ลอง flow dissolve โดยไม่ confirm และ confirm test gang เท่านั้น | ไม่มี accidental destructive action |
| P0-24 | Admin routes | Non-admin เปิด admin/payment/admin subscription APIs | ต้อง 401/403/400 ตามกรณี ไม่ leak data |
| P0-25 | Docker bot | Bot commands หลักหลัง restart container | Bot กลับมาพร้อมใช้งาน และ readiness ผ่าน |

## 5. P1 UX / Product Polish Test Cases

P1 ไม่ควร block ถ้า P0 ผ่านทั้งหมด แต่ควรเก็บก่อนขายจริงจัง

| ID | Area | Steps | Expected |
| --- | --- | --- | --- |
| P1-01 | Mobile layout | เปิด dashboard, finance, member, attendance บน mobile viewport | อ่านง่าย ปุ่มไม่ล้น ตารางไม่พัง |
| P1-02 | Empty states | เข้า gang ใหม่ที่ยังไม่มี member/finance/attendance | มีคำอธิบายว่าต้องทำอะไรต่อ ไม่ใช่หน้าว่าง |
| P1-03 | Error copy | ลอง action ที่ไม่มีสิทธิ์/plan ไม่พอ | ข้อความบอกสาเหตุและทางไปต่อ ไม่ใช่ error ดิบ |
| P1-04 | Theme consistency | ไล่หน้า dashboard/admin/legal/contact | สี/spacing/button/table เป็นระบบเดียวกัน |
| P1-05 | Manual setup UX | คนไม่ชำนาญ Discord ลองตั้งค่าเอง | เข้าใจ step, role mapping, warning role ซ้ำ ได้โดยไม่ต้องเดา |
| P1-06 | Finance terminology | อ่านคำว่า deposit/repay/reserve/fine/gang fee | ความหมายไม่สับสน และตรงกับ behavior จริง |
| P1-07 | Data export | ทดลอง export CSV ที่เกี่ยวกับ finance/member | เฉพาะ plan ที่มีสิทธิ์ export ได้ และ column ถูกต้อง |
| P1-08 | Legal/contact | เปิดหน้า legal/contact | อ่านสวย ถูกต้อง ไม่มี link ตาย |

## 6. Test Result Template

ใช้ format นี้เวลาแจ้งผลกลับมา:

```text
Date:
Environment:
Tester:

P0-01 PASS -
P0-02 FAIL - Non-admin still sees admin table row
P0-03 BLOCKED - Bot command returned timeout

Top blockers:
1.
2.
3.

Screenshots/logs:
-
```

## 7. Final Production Gate

ก่อนเปิดให้คนนอกใช้จริง ให้เช็คครั้งสุดท้าย:

- All P0 PASS
- No known critical/high security issue in runtime audit
- Health/readiness pass after deploy
- Bot command smoke test pass after deploy
- DB backup/snapshot exists before migration
- Billing disabled unless SlipOK live test + rotated key pass
- Admin has a manual recovery path for member/role/payment mistakes

ถ้าผ่านทั้งหมดนี้ โปรเจกต์จะถือว่าเข้าเกณฑ์ soft launch ที่ปลอดภัยพอสำหรับการใช้งานจริงแบบจำกัดกลุ่มได้
