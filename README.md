# FiveM Gang Management SaaS

ระบบจัดการแก๊ง FiveM ผ่าน Discord Bot และ Web Dashboard

## โครงสร้างโปรเจค

```
PROJECTX/
├── apps/
│   ├── bot/          # Discord Bot (discord.js)
│   └── web/          # Web Dashboard (Next.js)
├── packages/
│   └── database/     # Shared database (Turso + Drizzle)
└── README.md
```

## Tech Stack

- **Bot**: discord.js (Node.js)
- **Web**: Next.js 14+ (App Router)
- **Database**: Turso + Drizzle ORM
- **Auth**: NextAuth.js + Discord OAuth

## เริ่มต้นใช้งาน

```bash
# ติดตั้ง dependencies
npm install

# ตั้งค่า environment
cp .env.example .env

# รัน development
npm run dev
```

## Production Verification

### Current Production Gate Snapshot (2026-05-02)

Latest remote verification passed:

```powershell
npm run release:verify -- --skip-local --web-url https://gang-manager.vercel.app --bot-url https://gang-manager-bot.onrender.com
```

Passed checks:

- Web health: `https://gang-manager.vercel.app/api/health`
- Bot health: `https://gang-manager-bot.onrender.com/health`
- Bot readiness: `https://gang-manager-bot.onrender.com/ready`

Still required before calling the product production-ready:

- Run `npm run validate:env:prod` with the final production env.
- Run manual P0 E2E from `MANUAL_E2E_TEST_PLAN.md`.
- If billing is enabled, rotate SlipOK key and pass one live PromptPay/SlipOK payment test.
- Create a separate production/staging database before destructive or write-heavy tests.

Useful docs:

- `DEPLOY_ENV_SPLIT.md`: Web/Bot env split, where each env comes from, UptimeRobot setup, and abuse checks.
- `MANUAL_E2E_TEST_PLAN.md`: P0/P1 manual test checklist and Playwright commands.
- `USER_FEATURE_GUIDE.md`: user-facing feature guide for owner/admin/member.

```bash
# ตรวจความพร้อมก่อนปล่อยจริง
npm run release:verify

# ตรวจปิดงาน security หลัง rotate secrets / rollout env
npm run security:verify -- --web-url https://<web-host> --bot-url https://<bot-host>
```

- Checklist แบบเต็มอยู่ที่ `PRELAUNCH_CHECKLIST.md`
- Runbook ปล่อยจริงอยู่ที่ `GO_LIVE_RUNBOOK.md`
- คู่มือ deploy อยู่ที่ `DEPLOYMENT.md`

## ฟีเจอร์

- ✅ ระบบสมาชิก (ลงทะเบียนผ่าน Discord)
- ✅ ระบบเช็คชื่อ 
- ✅ ระบบการเงิน (กองกลางแก๊ง)
- ✅ Audit Logs (ตรวจสอบได้)
