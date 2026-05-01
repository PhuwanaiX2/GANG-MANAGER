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

## Where To Get Each ENV

Discord Developer Portal (`https://discord.com/developers/applications`):

- `DISCORD_CLIENT_ID`: Application ID from General Information.
- `DISCORD_CLIENT_SECRET`: OAuth2 client secret. Reset/regenerate if exposed.
- `DISCORD_BOT_TOKEN`: Bot tab token. Reset/regenerate if exposed.
- OAuth redirect URLs must include production callback, for example `https://gang-manager.vercel.app/api/auth/callback/discord`.

Discord app/server:

- `BACKUP_CHANNEL_ID`: enable Developer Mode in Discord, right-click the backup/log channel, Copy Channel ID.
- `ADMIN_DISCORD_IDS`: enable Developer Mode, right-click your Discord user, Copy User ID. Comma-separated if more than one.

Turso:

- `TURSO_DATABASE_URL`: Turso database URL from Turso dashboard/CLI.
- `TURSO_AUTH_TOKEN`: database auth token from Turso dashboard/CLI.
- Web and Bot must use the exact same pair unless intentionally testing a separate staging DB.

NextAuth:

- `NEXTAUTH_SECRET`: generate locally with `openssl rand -base64 32` or another secure random generator.
- `NEXTAUTH_URL`: production web URL on Vercel, currently `https://gang-manager.vercel.app`.

Cloudinary:

- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`: Cloudinary Dashboard > API Keys.
- Do not set `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` in production for this project.

PromptPay / bank:

- `PROMPTPAY_RECEIVER_NAME`: receiver display name shown to users, for example your real account name.
- `PROMPTPAY_IDENTIFIER`: PromptPay phone number or PromptPay ID. If using only bank transfer display, keep the user-facing receiver/bank info consistent with the payment screen.

SlipOK:

- `SLIPOK_API_KEY`: SlipOK dashboard API key. Rotate before live launch because an older key was shared in chat.
- `SLIPOK_BRANCH_ID`: branch/reference number from SlipOK.
- `SLIPOK_API_BASE_URL`: optional. Leave unset unless SlipOK changes the endpoint.

Billing toggles:

- `ENABLE_PROMPTPAY_BILLING=false`: safest default. Users cannot create real payment requests.
- `ENABLE_PROMPTPAY_BILLING=true`: users can create payment requests. Enable only when receiver info is correct.
- `ENABLE_SLIPOK_AUTO_VERIFY=false`: manual admin review only.
- `ENABLE_SLIPOK_AUTO_VERIFY=true`: uploaded slips are sent to SlipOK automatically. Enable only after live test passes.

Diagnostics:

- `EXPOSE_HEALTH_DIAGNOSTICS=false`: production default.
- `EXPOSE_HEALTH_DIAGNOSTICS=true`: temporary only, to compare Web/Bot DB fingerprints with `release:verify`.

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

## UptimeRobot Setup

Free-tier setup:

1. Create a free UptimeRobot account.
2. Add monitor type `HTTP(s)`.
3. Monitor name: `Gang Manager Bot Ready`.
4. URL: `https://gang-manager-bot.onrender.com/ready`.
5. Interval: 5 minutes if available on your plan.
6. Alert contact: your email.
7. Save and wait for the first green check.

Optional second monitor:

- Name: `Gang Manager Web Health`
- URL: `https://gang-manager.vercel.app/api/health`

What to do when alert fires:

1. Open Render logs for the bot.
2. Check whether `/health` works but `/ready` fails. If yes, the process is alive but Discord/database readiness may be broken.
3. Open Vercel logs if web health fails.
4. Run remote verify:

```powershell
npm run release:verify -- --skip-local --web-url https://gang-manager.vercel.app --bot-url https://gang-manager-bot.onrender.com
```

## Security / Abuse Sanity Checks

Run before opening to more users:

1. Open `/admin/security` with admin account and confirm no critical env warning.
2. Open `/admin` with non-admin account. Expected: blocked/redirected, no admin data.
3. Hit `/api/debug/db` in production. Expected: blocked unless debug routes are explicitly enabled, which should not happen in production.
4. Try finance API/action from a FREE or expired gang. Expected: blocked.
5. Try Discord finance buttons from a role without permission. Expected: clear rejection.
6. Try repeated login/API clicks quickly. Expected: rate-limit or safe failures, not crash.
7. Confirm `STRIPE_*` is absent from Vercel and Render env.
8. Confirm `ENABLE_DEBUG_ROUTES` is not set to `true`.

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
