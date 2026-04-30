# Deploy Environment Split

เอกสารนี้แยก env สำหรับ Web และ Bot เพื่อใช้กับ deploy ปัจจุบัน

- Web: `https://gang-manager.vercel.app`
- Bot health: `https://gang-manager-bot.onrender.com`

## Web: Vercel

ตั้งค่าใน Vercel Project Environment Variables

Required:

```env
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_BOT_TOKEN=
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
NEXTAUTH_SECRET=
NEXTAUTH_URL=https://gang-manager.vercel.app
ADMIN_DISCORD_IDS=
BACKUP_CHANNEL_ID=
ENABLE_PROMPTPAY_BILLING=false
ENABLE_SLIPOK_AUTO_VERIFY=false
EXPOSE_HEALTH_DIAGNOSTICS=false
```

Recommended:

```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
PROMPTPAY_RECEIVER_NAME=
PROMPTPAY_IDENTIFIER=
SLIPOK_API_KEY=
SLIPOK_BRANCH_ID=
```

Notes:

- `NEXTAUTH_URL` ต้องเป็น URL เว็บจริงบน Vercel
- ถ้ายังไม่เปิดขายจริง ให้คง `ENABLE_PROMPTPAY_BILLING=false`
- ห้ามตั้ง `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`; Cloudinary ต้องใช้ server-only env
- ห้ามเหลือ `STRIPE_*` ใน production env เพราะย้าย billing path เป็น PromptPay / SlipOK แล้ว
- `TURSO_DATABASE_URL` และ `TURSO_AUTH_TOKEN` ต้องเป็นชุดเดียวกับ Bot ไม่งั้นจะดูเหมือน redeploy แล้วข้อมูล/แพลนหาย เพราะ Web อ่านอีก DB แต่ Bot เขียนอีก DB

## Bot: Render

ตั้งค่าใน Render service environment variables

Required:

```env
DISCORD_BOT_TOKEN=
DISCORD_CLIENT_ID=
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
BACKUP_CHANNEL_ID=
BOT_PORT=8080
NEXTAUTH_URL=https://gang-manager.vercel.app
```

Recommended:

```env
ADMIN_DISCORD_IDS=
ENABLE_PROMPTPAY_BILLING=false
ENABLE_SLIPOK_AUTO_VERIFY=false
EXPOSE_HEALTH_DIAGNOSTICS=false
```

Notes:

- Render health URL ควรตอบ `/health`
- Render readiness URL ควรตอบ `/ready`
- ใช้ UptimeRobot ping `https://gang-manager-bot.onrender.com/ready` ได้ เพื่อช่วยลดโอกาส free instance หลับ
- Bot log เป็น JSON เป็นเรื่องปกติสำหรับ production เพราะ parse/search ง่ายกว่า plain text
- `TURSO_DATABASE_URL` และ `TURSO_AUTH_TOKEN` ต้องตรงกับ Vercel Web ทุกตัวอักษร

## Database Fingerprint Check

เพื่อเช็คว่า Web/Bot ชี้ฐานข้อมูลเดียวกันโดยไม่เปิดเผย URL หรือ token:

1. ตั้ง `EXPOSE_HEALTH_DIAGNOSTICS=true` ชั่วคราวทั้ง Vercel และ Render
2. Redeploy ทั้งคู่
3. รัน:

```powershell
npm run release:verify -- --skip-local --web-url https://gang-manager.vercel.app --bot-url https://gang-manager-bot.onrender.com
```

ถ้า fingerprint ไม่ตรง ให้หยุดเทสทันทีและแก้ env ของ `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` ให้ Web กับ Bot ใช้ DB เดียวกัน

หลังเช็คเสร็จให้ตั้งกลับเป็น `EXPOSE_HEALTH_DIAGNOSTICS=false` แล้ว redeploy อีกครั้ง

## Post Deploy Verify

หลัง deploy เสร็จ ให้รันจาก local:

```powershell
npm run release:verify -- --skip-local --web-url https://gang-manager.vercel.app --bot-url https://gang-manager-bot.onrender.com
```

เช็คด้วย browser:

- `https://gang-manager.vercel.app`
- `https://gang-manager.vercel.app/terms`
- `https://gang-manager.vercel.app/privacy`
- `https://gang-manager.vercel.app/support`
- `https://gang-manager.vercel.app/api/health`
- `https://gang-manager-bot.onrender.com/health`
- `https://gang-manager-bot.onrender.com/ready`

## Anti-Abuse Baseline

ตอนนี้มีการกันเบื้องต้นแล้ว:

- Middleware rate limit สำหรับ `/api/*`
- Admin API limit เข้มกว่า route ทั่วไป
- Finance API limit เข้มกว่า route ทั่วไป
- Route-level durable rate limit ใน API สำคัญบางส่วน
- Discord interaction rate limit ฝั่ง bot
- Permission guard ทั้ง web และ bot
- Feature/tier guard สำหรับ finance
- Admin route จำกัดด้วย `ADMIN_DISCORD_IDS`

สิ่งที่ควรเพิ่มภายหลัง:

- Bot command abuse dashboard
- IP allowlist สำหรับ debug/admin ที่เสี่ยงสูง
- CAPTCHA หรือ challenge ใน public form ถ้ามี
- Web Application Firewall ถ้าย้ายไป paid infra
- Alert เมื่อ 429 หรือ error spike
