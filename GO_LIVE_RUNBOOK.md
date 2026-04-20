# Production Go-Live Runbook

เอกสารนี้คือขั้นตอนปล่อยจริงของโปรเจกต์ตาม production path ปัจจุบัน:

- Web deploy ผ่าน **Vercel**
- Bot deploy ผ่าน **Render**
- Bot ใช้ **Uptime monitor** ยิง `/health` เพื่อกัน service sleep หรือจับอาการดับเร็วขึ้น
- Database production ใช้ **Turso** เท่านั้น

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

ห้าม push ถ้าอย่างใดอย่างหนึ่งไม่ผ่าน

## 2. Production Providers ที่ใช้จริง

### Web: Vercel

- repo นี้ต้องผูกกับ Vercel project ที่ชี้ root ไปที่ `apps/web`
- เมื่อ push branch ที่ผูกกับ production deploy แล้ว Vercel จะ build/deploy web ให้อัตโนมัติ
- ต้องตั้ง env ของ web ใน Vercel ให้ครบตาม `.env.example` และ `validate:env:prod`

ค่าที่สำคัญที่สุดของ web:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_BOT_TOKEN`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PREMIUM`
- `STRIPE_PRICE_PREMIUM_YEARLY`
- `ADMIN_DISCORD_IDS`

### Bot: Render

- bot ต้องรันแบบ long-running process ผ่าน `apps/bot/src/manager.ts`
- Render service ต้องชี้มาที่ `apps/bot/Dockerfile`
- ถ้า Render service เปิด auto-deploy จาก branch ที่ผูกกับ production deploy ไว้ การ push git จะ trigger bot deploy ด้วย
- ถ้าไม่ได้เปิด auto-deploy ต้องกด deploy ใหม่ใน Render หลัง push

ค่าที่สำคัญที่สุดของ bot:

- `DISCORD_BOT_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `BACKUP_CHANNEL_ID`
- `NEXTAUTH_URL`
- `BOT_PORT`
- `ADMIN_DISCORD_IDS`
- `DISCORD_WEBHOOK_URL` (แนะนำอย่างยิ่ง)

## 3. ลำดับ Go-Live จริง

1. ยืนยันว่า local branch พร้อมปล่อย
2. รัน `npm run release:verify`
3. รัน `npm run db:push`
4. ถ้ามีการ rotate secrets ให้ update local / Vercel / Render / CI ให้ครบ
5. push ขึ้น branch ที่ผูกกับ production deploy
6. รอ Vercel deploy web เสร็จ
7. รอ Render deploy bot เสร็จ
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

ต้องได้ผลอย่างน้อย:

- web `/api/health` ตอบ `status: ok`
- web `database` เป็น `up`
- bot `/health` ตอบได้
- bot `/ready` ตอบ `status: ready`

## 5. Uptime Monitor สำหรับ Bot

เพื่อกัน Render sleep หรือจับอาการดับเร็วขึ้น ให้ตั้ง monitor ยิง bot URL สม่ำเสมอ

ค่าที่แนะนำ:

- URL: `https://<bot-host>/health`
- Method: `GET`
- Interval: 5 นาที
- Timeout: ใช้ค่า default ของ provider ได้

ถ้า provider รองรับ alert ให้เปิดแจ้งเตือนเมื่อ:

- bot `/health` ไม่ตอบ
- bot `/ready` กลายเป็น `503`

## 6. Manual Sanity ที่ควรเช็กหลังปล่อย

- Discord bot online
- `/setup` ใช้งานได้
- ปุ่ม Dashboard ใน bot พาไป `NEXTAUTH_URL` ที่ถูกต้อง
- web login ผ่าน Discord ได้
- web dashboard เข้าได้
- backup scheduler ไม่ error ตั้งแต่ startup
- announcements ยัง mention `@everyone` เฉพาะตอนเลือก
- leave request ที่ processed แล้วไม่สามารถกดซ้ำได้
- admin backup route ใช้ได้เฉพาะ admin

## 7. Go / No-Go

**Go** เมื่อ:

- `release:verify` ผ่าน
- `db:push` ผ่าน
- Vercel deploy ผ่าน
- Render deploy ผ่าน
- web health ผ่าน
- bot readiness ผ่าน
- secrets ชุด production ถูก rollout ครบ

**No-Go** เมื่อ:

- Vercel build fail
- Render bot ไม่ขึ้น `ready`
- health probe ตัวใดตัวหนึ่ง fail
- env production ไม่ตรงกับ contract
- ยังมี secret ที่ทราบว่าเคยรั่วแต่ยังไม่ได้ rotate
