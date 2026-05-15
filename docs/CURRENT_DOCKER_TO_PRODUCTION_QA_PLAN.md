---
title: What Owner Must Test Now
created_at: 2026-05-14
owner: User + Codex QA
status: latest-attendance-bot-scope
---

# สิ่งที่คุณต้องเทสจริงตอนนี้

เอกสารนี้เก็บเฉพาะรายการที่คุณต้องเทสเองใน Docker/local ตอนนี้เท่านั้น รายการที่ผ่านแล้วจะไม่เอามาปนในหัวข้อหลัก

## ต้องเทสหลัง rebuild Docker รอบล่าสุด

- [ ] Web Attendance Manual: คนที่มีใบลาหยุดเต็มวันอนุมัติแล้ว เช่น `A` ต้องขึ้นสถานะ `ลา` และ badge ใบลาในตารางเช็คเองทันที ไม่ต้องกดเองก่อน
- [ ] Web Attendance Create: หน้า `attendance/create` ต้องไม่มี step bar หลอก, ไม่มีปุ่มคู่มือการใช้งาน, และไม่มีกล่องอธิบายยาวด้านขวา
- [ ] Web Attendance Manual: สร้างรอบแบบ `เจ้าหน้าที่เช็คเอง` แล้วกด back ของ browser ต้องกลับหน้ารายการเช็คชื่อและรอบนั้นต้องไม่ค้างเป็นรอบเปิดอยู่
- [ ] Web Attendance Manual: ตารางเช็คเองต้องไม่มีคอลัมน์ `รายละเอียด` และสมาชิกที่มีใบลาอนุมัติแล้วต้องเห็น badge `ใบลาอนุมัติแล้ว` พร้อมสถานะ `ลา`
- [ ] Web Attendance: สร้างรอบแบบ `เจ้าหน้าที่เช็คเอง` โดยมีสมาชิกที่มีใบลาอนุมัติแล้ว ต้องเห็นสถานะ `ลา` ตั้งแต่ในตาราง manual และปิดรอบได้โดยไม่ถูกนับเป็นยังไม่เช็ค
- [ ] Web Attendance: ในรอบเดียวกัน กดปิดรอบแล้วดูประวัติ รายการ `ลา` ต้องยังอยู่ถูกต้อง
- [ ] Web Attendance: บันทึกผ่านเว็บแล้วหมายเหตุในตารางต้องไม่ขึ้นว่า `ลงทะเบียนผ่าน Discord`
- [ ] Web Attendance: เปิดรอบเช็คชื่อมากกว่า 1 รอบ หน้าเช็คชื่อหลักต้องแสดงทุกรอบที่เปิดอยู่ ไม่ใช่แค่รอบล่าสุด
- [ ] Web Attendance: ยกเลิกรอบแล้วหน้า `ประวัติ` ต้องไม่แสดงรอบที่ยกเลิก
- [ ] Web Attendance: หน้ารายละเอียดรอบที่ปิดแล้วต้องไม่มีปุ่มหลอก `โหมดแก้ไขย้อนหลัง`
- [ ] Bot Leave: กด `แจ้งเข้าช้า` ต้องเห็นตัวเลือกเป็นเวลา เช่น `19:30`, `20:00`, `20:30` และยังมี `กำหนดเอง`
- [ ] Bot Leave: ถ้ามีใบลาหยุดเต็มวันอยู่แล้ว การกด `แจ้งเข้าช้า` ต้องถูกบล็อก ไม่สร้างคำขอซ้ำ
- [ ] Bot Setup: รัน `/setup` หรือซ่อมแซมอัตโนมัติแล้วต้องมีห้อง `สรุปเช็คชื่อ`
- [ ] Bot Setup: แผงควบคุมหัวหน้าแก๊งต้องไปอยู่ห้อง `แผงควบคุม` ไม่ใช่ `log-ระบบ`

## ยังไม่ต้องเทสตอนนี้

- Discord OAuth login บน domain จริง
- Discord callback URL / HTTPS / secure cookie
- `/setup` บน production guild ที่ชี้ domain จริง
- Production smoke desktop/mobile หลัง patch กลับเว็บจริง
- Paid billing live provider ถ้าจะเปิดรับเงินจริง

## ล่าสุดที่ Codex ตรวจด้วยเครื่องแล้ว

- `npm run test -w apps/web -- attendance-domain` ผ่าน 6/6 รวมเคส manual round วันไทย + ใบลาเต็มวัน
- `npm run test -w apps/web -- attendance-session` ผ่าน 31/31
- `npm run test -w apps/web -- attendance` ผ่าน 53/53
- `npm run build -w apps/web` ผ่าน
- `npm run test -w apps/bot -- leaveFlows` ผ่าน 3/3
- `npm run test -w apps/bot -- attendanceFlows` ผ่าน 4/4
- `npm run test -w apps/bot -- leaveFlows` ผ่าน 3/3
- `npm run test -w apps/bot -- setupFlow` ผ่าน 16/16
- `npm run test -w apps/bot -- leaveFlows attendanceFlows` ผ่าน 7/7
- `npm run build -w apps/bot` ผ่าน
- `docker compose up -d --build` ผ่าน และ `web`/`bot` containers recreate สำเร็จ
- `GET http://localhost:3000/api/health` ได้ 200 database up
- `GET http://localhost:8080/health` ได้ 200 bot ready
- `git diff --check` ผ่านสำหรับไฟล์ที่แตะ
- `npx tsc --noEmit -p apps/web/tsconfig.json` ยัง fail จาก type debt เดิมใน test route params / test env types แต่ไม่พบ error ในไฟล์ attendance ที่แก้เมื่อกรองเฉพาะไฟล์ที่แตะ
