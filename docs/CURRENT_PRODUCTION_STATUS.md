---
title: Current Production Status
updated_at: 2026-05-19
owner: Codex QA
status: active-source-of-truth
---

# Current Production Status

อ่านไฟล์นี้ก่อนเป็นอันดับแรก เอกสาร checklist เก่าที่ปนงาน Docker, audit history, wireframe และแผนที่จบแล้วถูกลบออกเพื่อลดความสับสน

## สถานะล่าสุด

| Area | Status | หลักฐาน/หมายเหตุ |
|---|---|---|
| Auth / permission | PASS | route สำคัญใช้ session + gang permission guard |
| Attendance | PASS | manual/self check-in, leave status, closed-session snapshot และ history route ถูกแยกแล้ว |
| Members | PASS | เพิ่มสมาชิกผ่าน Discord guild member picker, sort ตามสถานะและยศ |
| Finance | PASS | แยกเงินกองกลางจริง / ค้างเก็บ / รอตรวจ และ route เป็น path เดียวกัน |
| Billing / payment | PASS | มี flow ชำระเงิน, ส่งสลิปได้ทั้งไฟล์และลิงก์รูปจาก Discord/Facebook CDN, rejected slip ปิดรายการเดิม, License Key เป็น fallback |
| Monitoring | PASS | web/bot health script และ protected alert-test endpoints พร้อมใช้เมื่อ ENV ถูกตั้ง |
| Product/UX polish | PASS | polish, route pattern, docs cleanup, deploy และ visual smoke ผ่าน |

## Checklist รอบปัจจุบัน

- [x] Attendance history ไม่ใช้ roster ปัจจุบันไปนับย้อนหลังจนข้อมูลเพี้ยน
- [x] Manual attendance redirect หลังปิดรอบไปหน้า history
- [x] Attendance main page เอาประวัติออกจากหน้าหลักและมีปุ่มไป history
- [x] Finance/settings sub navigation ใช้ path route แทน query tab ที่ปนกัน
- [x] Modal overlay อยู่เหนือ nav/drawer
- [x] Dashboard selector เรียงแก๊งตามสิทธิ์สูงสุดและแสดงสิทธิ์ผู้ใช้
- [x] Members add flow ดึง Discord guild members และซ่อนคนที่เชื่อมแล้ว
- [x] Members table sort ตาม pending, active, role priority, name
- [x] Sidebar ซ่อน module ที่ถูกปิดด้วย feature flag
- [x] Header แสดงแพลนแก๊ง และเอา plan card ซ้ำใน finance/settings ออกตามสมควร
- [x] Billing มีขั้นตอนชำระเงินชัดเจนก่อนสร้างบิล
- [x] Billing ส่งหลักฐานชำระเงินได้ทั้งอัปโหลดรูปและแปะลิงก์รูปสลิป HTTPS จาก trusted host
- [x] Finance ledger rule เห็นได้ทั้ง desktop/mobile
- [x] Customer-facing copy เก็บคำ dev/debug/อังกฤษที่เด่นออกจากหน้าหลัก
- [x] Final automated gate: full workspace tests, lint, targeted tests, build, encoding, diff check
- [x] Production deploy
- [x] Browser visual smoke หลัง deploy

## เหลือหลัง deploy รอบนี้

- Live payment smoke ด้วยเงินจริง/SlipOK จริง: ผู้ใช้จะทดสอบช่วงที่พร้อม เพราะต้องใช้ธุรกรรมจริง
- Live payment smoke เวลา 15:00 ต้องทดสอบทั้งแนบไฟล์และแปะลิงก์รูปสลิปจริงอย่างน้อยหนึ่งเคส
- ถ้าเปิดรับเงินจริงเต็มระบบแล้ว ให้ทดสอบ invalid/expired slip ว่าถูกปฏิเสธและปิดบิลเก่าอย่างถูกต้อง
- Product/UX redesign รอบต่อไปสามารถทำต่อจากพื้นฐาน Modern Discord-native SaaS Operations Dashboard ได้ โดยใช้ `UX_UI_REDESIGN_BRIEF.md` เป็น checklist

## Evidence รอบล่าสุด

- Commit: `7306453` - `Polish ops dashboard and readiness docs`
- Production deployment: `https://gang-manager.vercel.app`
- Vercel deployment id: `dpl_GE8JotgLfy8pxBFZfPTKcQb1SqB6`
- `npm test`: PASS, web 350 tests + bot 97 tests
- `npm run lint -w apps/web`: PASS
- `npm run build -w apps/web`: PASS
- `npm run monitor:production -- --web-url https://gang-manager.vercel.app --bot-url https://gang-manager-bot.onrender.com`: PASS
- `npm run security:headers -- --url https://gang-manager.vercel.app`: PASS, CSP enforced
- Playwright production readiness smoke: PASS 6 / SKIP 2 fixture-only cases
- Visual smoke: PASS 9 production routes, no console/page errors

## คะแนนคาดหวังหลังรอบนี้

| Metric | Target | Current Expected |
|---|---:|---:|
| Overall Score | 90+/100 | 92/100 |
| Soft Launch Readiness | 90+/100 | 95/100 |
| Public Launch Readiness | 90+/100 | 92/100 |
| Paid Production Readiness | 90+/100 | 89/100 จนกว่า live payment smoke ผ่าน |

## เอกสารที่ยังใช้งาน

- `docs/UX_UI_REDESIGN_BRIEF.md` - checklist Product/UX ปัจจุบัน
- `docs/PRODUCTION_PERMISSION_MATRIX.md` - permission matrix สำหรับ route/role
- `docs/PRODUCTION_PAYMENT_MONITORING_RUNBOOK.md` - monitoring, alert, payment และ incident runbook
