# Production Go-Live Runbook

เอกสารนี้คือขั้นตอนปล่อยใช้งานจริงของระบบในมุม product operations

## Current Scope

- ขอบเขตปัจจุบันคือการทำให้ product ใช้งานจริงได้อย่างปลอดภัยและสม่ำเสมอ
- ขอบเขตปัจจุบันไม่รวมการขายจริงหรือ payment automation ใหม่
- Stripe ให้ถือเป็น legacy / paused billing path
- PromptPay QR เป็น future scope หลัง product พร้อมจริง

## 1. Preconditions ก่อน Push

ให้เช็กตามนี้ก่อนทุกครั้ง:

```bash
npm run release:verify
npm run db:push
```

ถ้ามีการ rotate secrets หรือเปลี่ยน env production ให้รันเพิ่ม:

```bash
npm run security:verify -- --web-url https://<web-host> --bot-url https://<bot-host>
```

ห้าม push ถ้ามีข้อใดข้อหนึ่งไม่ผ่าน

## 2. Production Providers

### Web: Vercel

- project ต้องชี้ root ไปที่ `apps/web`
- ต้องตั้ง env ให้ครบตาม feature ที่ใช้งานจริง
- `NEXTAUTH_URL` ต้องเป็น public web URL จริง

ค่าหลักของ web:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_BOT_TOKEN`
- `ADMIN_DISCORD_IDS`

ค่ากลุ่ม optional:

- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

ค่ากลุ่ม legacy billing:

- `ENABLE_LEGACY_STRIPE_BILLING=false` สำหรับรอบ product-readiness ปัจจุบัน
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PREMIUM`
- `STRIPE_PRICE_PREMIUM_YEARLY`

หมายเหตุ:

- Stripe vars ไม่เป็น blocker ของ `npm run validate:env:prod` ถ้า `ENABLE_LEGACY_STRIPE_BILLING` ไม่ใช่ `true`
- ถ้าตั้ง `ENABLE_LEGACY_STRIPE_BILLING=true` ต้องใส่ Stripe vars ให้ครบ เพราะถือว่าเปิด legacy billing จริง
- ถ้ายังมี legacy routes ที่อ้าง Stripe อยู่ ให้ถือว่าเป็น technical debt ที่ต้องปิด/แยก scope ให้ชัด

### Bot: Render

- bot ต้องรันแบบ long-running process ผ่าน `apps/bot/src/manager.ts`
- production bot ต้องชี้กลับมาที่ public web URL เดียวกับฝั่ง web สำหรับปุ่มลิงก์

ค่าหลักของ bot:

- `DISCORD_BOT_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `BACKUP_CHANNEL_ID`
- `NEXTAUTH_URL`
- `BOT_PORT`
- `ADMIN_DISCORD_IDS`

## 3. ลำดับ Go-Live จริง

1. ยืนยันว่า branch ปัจจุบันพร้อมปล่อย
2. รัน `npm run release:verify`
3. รัน `npm run db:push`
4. อัปเดต secrets ที่เกี่ยวข้องถ้ามีการเปลี่ยนแปลง
5. push ไป branch ที่ใช้ deploy
6. รอ Vercel deploy เสร็จ
7. รอ Render deploy เสร็จ
8. ตรวจ health และ sanity หลัง deploy

## 4. Post-Deploy Verification

หลัง deploy เสร็จให้รัน:

```bash
npm run release:verify -- --skip-local --web-url https://<web-host> --bot-url https://<bot-host>
```

ถ้ามี secret rotation รอบนั้น ให้รันเพิ่ม:

```bash
npm run security:verify -- --web-url https://<web-host> --bot-url https://<bot-host>
```

ผลขั้นต่ำที่ต้องได้:

- web `/api/health` ตอบ `status: ok`
- web `database` เป็น `up`
- bot `/health` ตอบได้
- bot `/ready` ตอบ `status: ready`

## 5. Uptime Monitor สำหรับ Bot

แนะนำให้ตั้ง monitor:

- URL: `https://<bot-host>/health`
- Method: `GET`
- Interval: 5 นาที

ถ้า provider รองรับ alert ให้เปิดแจ้งเตือนเมื่อ:

- bot `/health` ไม่ตอบ
- bot `/ready` กลายเป็น `503`

## 6. Manual Sanity ที่ควรเช็กหลังปล่อย

- Discord bot online
- `/setup` ใช้งานได้
- ปุ่ม dashboard ใน bot ลิงก์ถูกต้อง
- web login ผ่าน Discord ได้
- dashboard เปิดได้จริง
- backup / scheduler ไม่มี error ตอน startup
- finance และ admin routes ยังกันสิทธิ์ถูกต้อง

## 7. Go / No-Go

`Go` เมื่อ:

- `release:verify` ผ่าน
- `db:push` ผ่าน
- Vercel deploy ผ่าน
- Render deploy ผ่าน
- web health ผ่าน
- bot readiness ผ่าน
- ไม่มี P0 authorization หรือ plan bypass ที่ยังเปิดอยู่

`No-Go` เมื่อ:

- build ผ่านแต่ business rule สำคัญยังไม่ถูกพิสูจน์
- มี finance flow ที่ entitlement รั่ว
- ยังมี route/action สำคัญที่ไม่ authorize ในตัว
- เอกสารยังไม่สะท้อนทิศทางจริงของโปรเจค
