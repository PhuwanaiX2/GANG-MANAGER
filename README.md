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

## ฟีเจอร์

- ✅ ระบบสมาชิก (ลงทะเบียนผ่าน Discord)
- ✅ ระบบเช็คชื่อ 
- ✅ ระบบการเงิน (กองกลางแก๊ง)
- ✅ Audit Logs (ตรวจสอบได้)
