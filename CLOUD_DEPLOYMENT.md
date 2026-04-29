# คู่มือการ Deploy ขึ้น Cloud (Vercel & Render)

เนื่องจาก Vercel และ Render (แบบฟรี/มาตรฐาน) จะลบไฟล์ทิ้งทุกครั้งที่ Restart เราจึงต้องย้าย Database ไปไว้ที่อื่นครับ

## 0. นำโค้ดขึ้น GitHub (จำเป็นต้องทำก่อน)

ตอนนี้โค้ดทั้งหมดอยู่แค่ในเครื่องคุณ เราต้องเอาไปฝากไว้บน Cloud (GitHub) ก่อนครับ

### ขั้นตอนที่ 0.1: สมัครและสร้าง Repo
1.  เข้าเว็บ [GitHub.com](https://github.com/) และสมัครสมาชิก (ถ้ายังไม่มี)
2.  ไปที่หน้า **Create a new repository** ([คลิกที่นี่](https://github.com/new))
3.  ช่อง **Repository name**: ตั้งชื่อโปรเจกต์ (เช่น `fivem-gang-bot`)
4.  ส่วนอื่นๆ ปล่อยเป็นค่าเดิม (Public)
5.  กดปุ่มสีเขียว **Create repository**

### ขั้นตอนที่ 0.2: อัพโหลดโค้ด (ผ่าน Terminal)
หลังจากกด Create คุณจะเห็นหน้าที่มีโค้ดเยอะๆ **ไม่ต้องตกใจ** ให้ทำตามนี้ครับ:

1.  กลับมาที่โปรแกรม VS Code ของคุณ
2.  เปิด **Terminal** (กด `Ctrl` + `J` หรือไปที่เมนู View -> Terminal)
3.  **ก๊อปปี้** คำสั่งเหล่านี้ไปวางใน Terminal **ทีละบรรทัด** แล้วกด Enter:

```bash
# 1. เริ่มต้นระบบ Git (ถ้ายังไม่เคยทำ)
git init

# 2. เพิ่มไฟล์ทั้งหมดเข้าไประบบ
git add .

# 3. บันทึกไฟล์ (Create Save Point)
git commit -m "First commit"

# 4. เปลี่ยนชื่อ Branch หลักเป็น main (มาตรฐานใหม่)
git branch -M main

# 5. เชื่อมต่อกับ GitHub (***สำคัญ: เปลี่ยน URL เป็นของคุณ***)
# URL หาได้จากหน้า GitHub ที่คุณเพิ่งสร้างเมื่อกี้ มันจะลงท้ายด้วย .git
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# 6. อัพโหลดขึ้น Cloud
git push -u origin main
```

**ถ้ามีการถามรหัสผ่าน:**
- ให้ดูหน้าต่างที่เด้งขึ้นมา แล้วกด "Sign in with browser" (ง่ายที่สุด)
- แล้วกด Authorize ในเบราว์เซอร์ครับ

เมื่อเสร็จแล้ว ลองรีเฟรชหน้า GitHub ดูครับ จะเห็นไฟล์โปรเจกต์ของคุณขึ้นไปอยู่บนนั้นแล้ว 🎉

### ⚡ ทางลัด: ใช้ GitHub CLI (แนะนำ!)
ผมเห็นว่าคุณมีโปรแกรม `gh` ติดตั้งอยู่แล้ว คุณสามารถใช้คำสั่งนี้แทนการกดเว็บได้เลย งjง่ายกว่ามาก:

1.  พิมพ์ใน Terminal: `gh auth login` (แล้วเลือก GitHub.com -> SSH -> Yes -> Browser -> กดยืนยันในเว็บ)
2.  พิมพ์: `gh repo create`
    - เลือก **Push an existing local repository to GitHub**
    - Path: `.` (จุด)
    - Repository name: ตั้งชื่อ (เช่น `fivem-gang-bot`)
    - Visibility: **Public**
    - Add remote: **Yes** (Origin)
    - Push commits: **Yes**

วิธีนี้จะสร้าง Repo และเอาโค้ดขึ้นให้เสร็จในพริบตาครับ!

---

## 1. เตรียม Database (Turso)

เราจะใช้ **Turso** (LIBQL) ซึ่งเป็น Cloud Database ที่เข้ากับโปรเจกต์นี้ได้ทันที (เพราะเราใช้ `@libsql/client` อยู่แล้ว)

1.  สมัครสมาชิกที่ [Turso.tech](https://turso.tech)
2.  ติดตั้ง Turso CLI (หรือทำผ่านหน้าเว็บ)
3.  สร้าง Database ใหม่
4.  Copy **Database URL** (ควรขึ้นต้นด้วย `libsql://`) และ **Auth Token** เก็บไว้

---

## 2. Deploy Web App (Vercel)

1.  เข้า [Vercel](https://vercel.com) เชื่อมต่อกับ GitHub
2.  Import Project ของคุณ
3.  ในหน้าตั้งค่าก่อน Deploy:
    - **Framework Preset**: Next.js
    - **Root Directory**: `apps/web` (สำคัญ!)
    - **Environment Variables**:
        - `TURSO_DATABASE_URL`: ใส่ URL จาก Turso
        - `TURSO_AUTH_TOKEN`: ใส่ Token จาก Turso
        - `NEXTAUTH_SECRET`: ตั้งรหัสลับสำหรับ login (ใช้คำสั่ง `openssl rand -base64 32` สร้างได้)
        - `NEXTAUTH_URL`: ใส่โดเมนของ Vercel (สำคัญมาก! ต้องตรงกับที่ Deploy จริง)
        - `DISCORD_CLIENT_ID`: Application ID จาก Discord Developer Portal
        - `DISCORD_CLIENT_SECRET`: Client Secret จาก Discord Developer Portal
        - `DISCORD_BOT_TOKEN`: Token ของบอท (สำหรับ fetch ข้อมูลสมาชิก)
        - `ADMIN_DISCORD_IDS`: Discord ID ของ admin ที่ใช้หน้า admin ได้

    ค่าที่เป็น optional / conditional ตาม feature ที่ยังเปิดใช้งาน:
    - `ENABLE_LEGACY_STRIPE_BILLING`: ตั้งเป็น `false` ในรอบ product-readiness ปัจจุบัน
    - `STRIPE_SECRET_KEY`
    - `STRIPE_WEBHOOK_SECRET`
    - `STRIPE_PRICE_PREMIUM`
    - `STRIPE_PRICE_PREMIUM_YEARLY`
    - `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
    - `CLOUDINARY_API_KEY`
    - `CLOUDINARY_API_SECRET`

4.  กด **Deploy**

---

## 3. Deploy Bot (Render) — แบบ Docker

เราจะ Deploy บอทในฐานะ **Web Service** (เพื่อให้มี URL สำหรับยิง Ping กันดับ)

### ขั้นตอนที่ 3.1: สร้าง Web Service
1.  เข้าเว็บ [Render Dashboard](https://dashboard.render.com/)
2.  กดปุ่ม **New +** (มุมบนขวา) → เลือก **Web Service**
3.  เลือก **Build and deploy from a Git repository** → กด **Next**
4.  จะเห็นลิสต์ Repo GitHub ของคุณ → กด **Connect** ที่ `GANG-MANAGER`

### ขั้นตอนที่ 3.2: ตั้งค่า (สำคัญมาก!)

หน้าถัดมาจะมีฟอร์มให้กรอก **ให้ใส่ค่าตามนี้ทุกตัวครับ:**

| ช่อง | ใส่ค่า |
|---|---|
| **Name** | `GANG-MANAGER-BOT` (หรือชื่ออะไรก็ได้) |
| **Language** | `Docker` ✅ |
| **Branch** | `main` |
| **Region** | เลือกอะไรก็ได้ (แนะนำ Virginia หรือ Singapore) |
| **Root Directory** | ⚠️ **เว้นว่าง! ลบออกให้หมด!** |

> ⚠️ **สำคัญมาก:** Root Directory ต้อง **เว้นว่าง** ครับ ห้ามใส่ `apps/bot`
> เพราะ Dockerfile ต้องการเห็นทั้งโปรเจกต์ (รวม packages/database ด้วย)

### ขั้นตอนที่ 3.3: ตั้งค่า Dockerfile Path

เลื่อนลงมาหาส่วน **Docker** หรือกดเปิด **Advanced** จะเห็นช่อง:

| ช่อง | ใส่ค่า |
|---|---|
| **Dockerfile Path** | `./apps/bot/Dockerfile` |

*(ถ้าหาไม่เจอ ลองกดดูในหมวด "Advanced" ข้างล่างสุด)*

### ขั้นตอนที่ 3.4: เพิ่ม Environment Variables

เลื่อนลงมาจนเจอหัวข้อ **Environment Variables**
กดปุ่ม **+ Add Environment Variable** แล้วใส่ค่าทีละคู่ ดังนี้:

| Key | Value |
|---|---|
| `DISCORD_BOT_TOKEN` | (Token บอทของคุณ) |
| `DISCORD_CLIENT_ID` | (Client ID บอทของคุณ) |
| `DISCORD_CLIENT_SECRET` | (Client Secret บอทของคุณ) |
| `TURSO_DATABASE_URL` | (URL ที่ขึ้นต้นด้วย `libsql://...`) |
| `TURSO_AUTH_TOKEN` | (Token ยาวๆ จาก Turso) |
| `BACKUP_CHANNEL_ID` | (ID ช่อง Discord สำหรับแบ็คอัพ) |
| `NEXTAUTH_URL` | (URL ของเว็บ Vercel เพื่อทำปุ่มลิงก์ Dashboard) |
| `ADMIN_DISCORD_IDS` | (Discord ID ของ admin คั่นด้วย comma) |
| `BOT_PORT` | (`8080` หรือ port ตัวเลขที่ Render ใช้จริง) |

> 💡 **Tip:** ค่าทั้งหมดอยู่ในไฟล์ `.env` ในเครื่องคุณ ก๊อปมาวางได้เลยครับ

### ขั้นตอนที่ 3.5: เลือก Plan และ Deploy

1.  เลื่อนลงมาล่างสุด เลือก **Plan** (แนะนำ Free หรือ Starter)
2.  กดปุ่ม **Create Web Service** สีม่วง
3.  **รอ...** Render จะเริ่ม Build Docker Image ให้ (ใช้เวลาประมาณ 2-5 นาที)
4.  ถ้าสำเร็จจะขึ้น **"Live"** สีเขียว 🟢

---

## 4. ตั้งค่ากันดับ (Keep-Alive)

เมื่อ Deploy บน Render (Free Tier) บอทจะหลับถ้าไม่มีใครใช้งาน เราต้องปลุกมันทุกๆ 5-10 นาที

1.  Copy **URL** ของบอทจากหน้า Dashboard ของ Render (เช่น `https://my-bot.onrender.com`)
2.  ไปที่เว็บ [UptimeRobot](https://uptimerobot.com) หรือ [Cron-job.org](https://cron-job.org/en/)
3.  สร้าง Monitor ใหม่:
    - **Type**: HTTP(s)
    - **URL**: ใส่ URL ที่ Copy มา
    - **Interval**: 5 นาที

เท่านี้บอทของคุณก็จะทำงานตลอด 24 ชั่วโมง ฟรี! ครับ
