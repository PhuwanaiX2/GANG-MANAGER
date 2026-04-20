# Production Pre-Launch Checklist

ใช้รายการนี้ก่อนปล่อยจริงทุกครั้ง โดยเฉพาะหลังมีการแก้ schema, auth, payment, scheduler หรือ bot startup

## 1. Environment Contract

รันคำสั่ง:

```bash
npm run validate:env:prod
```

ต้องผ่านโดยไม่มี missing required variables

ค่าที่ต้องเช็กเป็นพิเศษ:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `DISCORD_BOT_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PREMIUM`
- `STRIPE_PRICE_PREMIUM_YEARLY`
- `ADMIN_DISCORD_IDS`
- `BACKUP_CHANNEL_ID`

## 2. Database Release Safety

ตรวจ preview ก่อน:

```bash
npm run db:normalize:tiers
```

ถ้ายังมี legacy tier (`TRIAL` หรือ `PRO`) ให้ apply ก่อน:

```bash
npm run db:normalize:tiers:apply
```

จากนั้น push schema ล่าสุดขึ้น Turso:

```bash
npm run db:push
```

## 3. Local Release Verification

รันชุดตรวจหลัก:

```bash
npm run release:verify
```

ชุดนี้จะตรวจ:

- production env contract
- subscription tier normalization preview
- web test suite
- workspace builds

## 4. Deploy Targets

### Web

- deploy ผ่าน **Vercel** โดยใช้ root `apps/web`
- ถ้า Vercel ผูกกับ Git ไว้แล้ว การ push branch ที่ผูกกับ production deploy จะ trigger deploy อัตโนมัติ
- หลัง deploy ต้องเช็ก `https://<web-host>/api/health`
- response ต้องเป็น `status: ok`
- field `database` ต้องเป็น `up`

### Bot

- deploy ผ่าน **Render**
- bot ต้องรันผ่าน `apps/bot/src/manager.ts`
- ถ้า Render เปิด auto-deploy จาก Git branch ที่ผูกกับ production deploy ไว้ การ push จะ trigger bot deploy ด้วย
- หลัง deploy ต้องเช็ก `https://<bot-host>/health`
- และ `https://<bot-host>/ready`
- `/ready` ต้องตอบ `status: ready`
- ต้องมี Uptime monitor ยิง `https://<bot-host>/health` เป็นระยะ

## 5. Post-Deploy Sanity

ถ้ามี public URLs แล้ว ให้รัน:

```bash
npm run release:verify -- --skip-local --web-url https://<web-host> --bot-url https://<bot-host>
```

จากนั้นเช็กด้วยคนอีกครั้ง:

- Discord bot online
- slash command `/setup` เห็นใน Discord
- web login ผ่าน Discord ได้
- finance export ยังกันสิทธิ์ถูกต้อง
- leave request ที่ processed แล้วไม่สามารถกดซ้ำได้
- announcements จะ mention `@everyone` เฉพาะตอนเลือกเท่านั้น
- admin backup route ใช้งานได้เฉพาะ admin

## 6. Secret Rotation Closeout

ถ้ามีการเปิดเผย secrets ใน terminal, CI logs, screenshots หรือเอกสาร ต้อง rotate ก่อน production go-live

ค่าที่ควร rotate อย่างน้อย:

- `DISCORD_BOT_TOKEN`
- `DISCORD_CLIENT_SECRET`
- `TURSO_AUTH_TOKEN`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

ลำดับ rollout ที่แนะนำ:

1. ออก secret ชุดใหม่จาก provider
2. อัปเดตค่าใน local `.env`
3. อัปเดตค่าใน Vercel / Render / CI secrets ให้ครบทุกที่
4. redeploy web และ bot
5. รันคำสั่งตรวจซ้ำ:

```bash
npm run security:verify -- --web-url https://<web-host> --bot-url https://<bot-host>
```

ถ้า secret เก่ายังใช้งานได้อยู่หลัง rollout ให้ถือว่างาน rotate ยังไม่ปิด

## 7. Go / No-Go Rule

ปล่อยจริงได้เมื่อ:

- `npm run release:verify` ผ่าน
- `npm run db:push` ผ่าน
- `npm run security:verify -- --web-url https://<web-host> --bot-url https://<bot-host>` ผ่าน หลัง rotate secrets
- web health ผ่าน
- bot health และ readiness ผ่าน
- ไม่มี missing required secrets
- ไม่มี legacy paid tier ค้างในฐานข้อมูล

ถ้ามีข้อใดข้อหนึ่งไม่ผ่าน ให้ถือเป็น **No-Go** และแก้ก่อน deploy production
