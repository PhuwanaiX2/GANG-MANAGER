# Production Go-Live Runbook

เอกสารนี้คือขั้นตอนปล่อยใช้งานจริงของระบบในมุม product operations

> แผนปฏิบัติงานล่าสุดของรอบนี้อยู่ที่ `docs/CURRENT_DOCKER_TO_PRODUCTION_QA_PLAN.md`
> ให้ใช้ไฟล์นั้นเป็น source of truth สำหรับลำดับ Docker local -> push GitHub -> production smoke ส่วนไฟล์นี้เป็น runbook รายละเอียดประกอบ

## Current Scope

- ขอบเขตปัจจุบันคือการทำให้ product ใช้งานจริงได้อย่างปลอดภัยและสม่ำเสมอ
- Billing ปัจจุบันคือ PromptPay / SlipOK โดยเปิด-ปิดด้วย env guard
- Stripe ให้ถือเป็น legacy / parked path และไม่ควรเหลือ `STRIPE_*` ใน production env
- ถ้ายังไม่พร้อมรับเงินจริง ให้คง `ENABLE_PROMPTPAY_BILLING=false`

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

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `PROMPTPAY_RECEIVER_NAME`
- `PROMPTPAY_IDENTIFIER`
- `SLIPOK_API_KEY`
- `SLIPOK_BRANCH_ID`

ค่ากลุ่ม billing:

- `ENABLE_PROMPTPAY_BILLING=false` จนกว่าจะพร้อมขายจริง
- `ENABLE_SLIPOK_AUTO_VERIFY=false` จนกว่าจะ rotate key และ live test ผ่าน
- `EXPOSE_HEALTH_DIAGNOSTICS=false` ใช้เปิดชั่วคราวเพื่อเทียบ DB fingerprint เท่านั้น

หมายเหตุ:

- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` ห้ามตั้ง เพราะ upload config ต้องเป็น server-only
- `STRIPE_*` จะทำให้ `npm run validate:env:prod` fail เพื่อกันความสับสนของ billing path
- `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` ต้องตรงกับ Bot ทุกตัวอักษร ไม่งั้นจะเห็นอาการเหมือนข้อมูล/แพลนหายหลัง redeploy

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
- `EXPOSE_HEALTH_DIAGNOSTICS=false`

## 3. ลำดับ Go-Live จริง

1. ยืนยันว่า branch ปัจจุบันพร้อมปล่อย
2. รัน `npm run release:verify`
3. รัน `npm run db:push`
4. อัปเดต secrets ที่เกี่ยวข้องถ้ามีการเปลี่ยนแปลง
5. push ไป branch ที่ใช้ deploy
6. รอ Vercel deploy เสร็จ
7. รอ Render deploy เสร็จ
8. ตรวจ health และ sanity หลัง deploy
9. ถ้าสงสัย Web/Bot ชี้คนละ DB ให้เปิด `EXPOSE_HEALTH_DIAGNOSTICS=true` ชั่วคราวทั้งคู่แล้วรัน remote verify เพื่อเทียบ fingerprint จากนั้นปิดกลับทันที

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
- ถ้าเปิด diagnostics ชั่วคราว fingerprint ของ Web/Bot ต้องตรงกัน

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

## 7. Docker-First Patch-Back Verification ที่ต้องเทสตอนนี้

บริบทปัจจุบันคือมีเว็บจริงอยู่แล้ว และใช้ Docker เป็น staging/pre-patch environment เพื่อพิสูจน์ว่าระบบรอบนี้พร้อมก่อน patch กลับไปที่เว็บจริง ดังนั้น Discord OAuth บนเว็บจริงไม่ใช่จุดที่ต้องเทสซ้ำหนักทุกครั้ง ถ้า auth/env ไม่ได้เปลี่ยน สิ่งที่ต้องเทสจริงตอนนี้คือ behavior ของ Docker web + Docker bot + test guild + test DB

### 7.1 Environment ที่ควรใช้

ใช้ Docker เป็นตัวหลัก:

```powershell
npm run release:verify
npm run docker:verify
```

เช็ก health หลัง Docker ขึ้น:

```text
http://localhost:3000/api/health
http://localhost:8080/health
http://localhost:8080/ready
```

Expected:

- web health เป็น `status: ok`, `app: web`, `database: up`
- bot health เป็น `status: ok`, `app: bot`
- bot ready เป็น `status: ready`
- Dashboard link ที่ bot ส่งใน Docker ควรชี้ `http://localhost:3000` เพราะ `docker-compose.yml` ตั้ง `NEXTAUTH_URL` จาก `LOCAL_NEXTAUTH_URL` หรือ fallback เป็น localhost

ข้อควรระวัง:

- ถ้า Docker bot ใช้ `DISCORD_BOT_TOKEN` เดียวกับ bot production ให้หยุด production bot ชั่วคราว หรือใช้ Discord test application/test bot แยก
- อย่าให้ production bot และ Docker bot ใช้ token เดียวกันเพื่อทดสอบ guild เดียวกันพร้อมกัน เพราะ slash command/event/button อาจซ้อนและทำให้ผล QA หลอก
- ใช้ test guild และ test gang ที่ลบทิ้งได้
- ห้ามใช้ production DB กับ write-heavy smoke ถ้า test gang ไม่ disposable

### 7.2 สิ่งที่คุณต้องเทสเองใน Docker รอบนี้

ให้ทำตามลำดับนี้ก่อน patch กลับเว็บจริง:

1. Docker health/readiness
   รัน `npm run docker:verify` และเปิด health URLs ด้านบน

2. Web dashboard shell
   เปิด `http://localhost:3000`, เข้า dashboard ของ test gang, เปิด Overview, Members, Attendance, Finance, Leaves, Billing, Settings อย่างน้อยหน้าละหนึ่งครั้ง

3. Settings role/channel mapping
   เข้า `http://localhost:3000/dashboard/<gangId>/settings?tab=roles-channels`, บันทึก role/channel mapping, refresh แล้วค่าต้องไม่หายหรือสลับ

4. `/setup` auto ใน Discord test guild
   พิมพ์ `/setup`, เลือก auto install/repair, ต้องสร้างหรือซ่อม role/channel/panel ได้ และ dashboard link ต้องเปิด localhost ได้

5. `/setup` duplicate check
   รัน `/setup` ซ้ำอีกครั้งแล้วเลือกซ่อม ต้องไม่สร้าง channel/category/panel ซ้ำจนรก

6. Manual role mapping
   ลอง manual setup หรือ mapping บนเว็บด้วย role แยก Admin/Treasurer/Attendance Officer/Member ต้องไม่ยอมให้ใช้ role ซ้ำหรือ `@everyone`

7. Member registration
   ให้ member account สมัคร/ผูกตัวตนผ่าน Discord panel แล้วตรวจใน web Members ว่าสถานะ/role ถูกต้อง ไม่มี duplicate member

8. Attendance Discord self check-in
   สร้างรอบแบบ Discord self check-in จาก web, ต้องส่งปุ่มไป Discord channel ถูกต้อง, member กดได้ครั้งเดียว, กดซ้ำไม่สร้าง record ซ้ำ, ปิดรอบแล้วกดเพิ่มไม่ได้

9. Attendance manual roll call mobile
   เปิด attendance detail บน mobile viewport, officer/admin กดสถานะให้สมาชิกเองได้ ปุ่มไม่เล็ก ไม่ล้น และ loading/action state ชัด

10. Leave flow
    member ส่งลา, admin approve/reject, ปุ่มเก่ากดซ้ำแล้วต้องไม่ทำซ้ำหรือทำ state เพี้ยน

11. Finance locked/free flow
    ถ้า test gang เป็น FREE/expired ต้องเข้า Finance แล้วไม่เห็น/ทำ action ที่ควรเป็น premium ได้ ทั้งบน web และ Discord button

12. Finance premium happy path
    ถ้าเปิดสิทธิ์ premium/trial ใน test gang ให้ลอง deposit/expense/repay/gang fee แล้วตรวจ pending/approve/reject/balance/audit ถูกต้อง

13. Billing disabled safety
    ถ้า `ENABLE_PROMPTPAY_BILLING=false` ต้องไม่สามารถสร้าง payment request ที่เหมือนจ่ายเงินจริงได้

14. Admin/security permission
    ใช้ account non-admin/non-owner เปิด admin/settings/finance/action sensitive ต้องโดน 401/403 หรือ forbidden state ที่ชัดเจน

15. Restart resilience
    restart Docker แล้ว bot ต้องกลับมา ready, dashboard ยังเปิดได้, scheduler/backup startup ไม่มี error ชัดเจน

### 7.3 Playwright ที่ควรรันกับ Docker

ใช้คำสั่งนี้เมื่อมี `E2E_GANG_ID` และ `E2E_DISCORD_ID` ของ test gang ใน Docker DB แล้ว:

```powershell
$env:PLAYWRIGHT_RUN_PRODUCTION_SMOKE='1'
$env:E2E_GANG_ID='<docker_test_gang_id>'
$env:E2E_DISCORD_ID='<owner_or_admin_discord_id>'
$env:E2E_NEXTAUTH_SECRET='<NEXTAUTH_SECRET used by Docker web runtime>'
$env:NEXTAUTH_URL='http://127.0.0.1:3000'
npm run test:e2e -w apps/web -- production-readiness.spec.ts
```

Attendance desktop:

```powershell
$env:PLAYWRIGHT_RUN_ATTENDANCE_SMOKE='1'
$env:E2E_GANG_ID='<docker_test_gang_id>'
$env:E2E_DISCORD_ID='<attendance_officer_or_owner_discord_id>'
$env:E2E_NEXTAUTH_SECRET='<NEXTAUTH_SECRET used by Docker web runtime>'
$env:E2E_ATTENDANCE_MODE='MANUAL_ROLL_CALL'
$env:NEXTAUTH_URL='http://127.0.0.1:3000'
npm run test:e2e -w apps/web -- attendance-smoke.spec.ts
```

Attendance mobile:

```powershell
$env:PLAYWRIGHT_RUN_ATTENDANCE_SMOKE='1'
$env:E2E_GANG_ID='<docker_test_gang_id>'
$env:E2E_DISCORD_ID='<attendance_officer_or_owner_discord_id>'
$env:E2E_NEXTAUTH_SECRET='<NEXTAUTH_SECRET used by Docker web runtime>'
$env:E2E_ATTENDANCE_MODE='MANUAL_ROLL_CALL'
$env:E2E_MOBILE_VIEWPORT='1'
$env:NEXTAUTH_URL='http://127.0.0.1:3000'
npm run test:e2e -w apps/web -- attendance-smoke.spec.ts
```

ถ้ารันจาก root repo และ Docker ใช้ root `.env` ให้ตั้งค่าแบบไม่พิมพ์ secret ออกหน้าจอได้ด้วย:

```powershell
$env:E2E_NEXTAUTH_SECRET = ((Get-Content .env | Where-Object { $_ -match '^NEXTAUTH_SECRET=' } | Select-Object -Last 1) -replace '^NEXTAUTH_SECRET=', '').Trim().Trim('"').Trim("'")
```

### 7.4 สิ่งที่ไม่ต้องถือเป็น blocker ตอน Docker ถ้าไม่ได้แตะ

- Discord OAuth บนเว็บจริง ถ้า auth/env/callback ไม่ได้เปลี่ยนและเว็บจริง login ใช้งานอยู่แล้ว
- HTTPS secure cookie บน production domain เพราะ Docker ใช้ localhost cookie เป็นปกติ
- CSP enforce เพราะตอนนี้ยัง Report-Only และต้องทำเป็นงานแยก
- Live PromptPay/SlipOK ถ้า billing ยังปิดอยู่
- Public reverse proxy/TLS/WAF เพราะ Docker รอบนี้เป็น staging ก่อน patch ไม่ใช่ public deploy

### 7.5 Format ที่ส่งผล Docker กลับมา

ส่งกลับมาแบบนี้เพื่อให้ QA ติ๊ก checklist ได้ตรงจุด:

```text
Environment: Docker localhost
WEB=http://localhost:3000
BOT_HEALTH=http://localhost:8080/health
BOT_READY=http://localhost:8080/ready
TEST_GUILD_ID=
TEST_GANG_ID=

Docker health: PASS/FAIL
Dashboard pages: PASS/FAIL
/setup auto: PASS/FAIL
/setup duplicate check: PASS/FAIL
Role/channel mapping: PASS/FAIL
Member registration: PASS/FAIL
Attendance Discord mode: PASS/FAIL
Attendance manual mobile: PASS/FAIL
Leave flow: PASS/FAIL
Finance locked/premium: PASS/FAIL
Billing disabled safety: PASS/FAIL
Permission denial: PASS/FAIL
Restart readiness: PASS/FAIL

Top blockers:
1.
2.
3.

Screenshots/logs:
-
```

## 8. Post-Patch Live Verification หลัง patch กลับเว็บจริง

ข้อด้านล่างเป็น final sanity หลัง patch กลับเว็บจริง ไม่ใช่สิ่งแรกที่ต้องให้คุณทำระหว่าง Docker staging ถ้า Docker-first gate ผ่านและ auth/env ไม่ได้เปลี่ยน ให้ตรวจเฉพาะ smoke เพื่อยืนยันว่าเว็บจริงยังไม่ regress

### 8.1 Discord OAuth Login

ทำใน Discord Developer Portal:

1. เปิด Discord Developer Portal > Applications > เลือก application ของโปรเจกต์
2. ไปที่ OAuth2 > General
3. เพิ่ม Redirect URL:

```text
https://<web-domain>/api/auth/callback/discord
```

4. ถ้าจะทดสอบ local ด้วย ให้มีอันนี้แยกต่างหาก:

```text
http://localhost:3000/api/auth/callback/discord
```

5. ตั้ง production env ฝั่ง web ให้ตรง:

```text
NEXTAUTH_URL=https://<web-domain>
DISCORD_CLIENT_ID=<same application client id>
DISCORD_CLIENT_SECRET=<same application client secret>
NEXTAUTH_SECRET=<strong random secret>
```

ตรวจหลัง deploy:

1. เปิด incognito หรือ browser profile สะอาด
2. เข้า `https://<web-domain>`
3. กด Login with Discord
4. authorize ด้วยบัญชีที่อยู่ใน guild ทดสอบ
5. ต้องกลับเข้า dashboard ได้ ไม่วน login ไม่เจอ callback mismatch
6. เปิด `/api/auth/session` แล้วต้องไม่มี Discord OAuth access token ใน JSON
7. ใน browser devtools ให้ดู cookie ว่า session cookie เป็น secure cookie บน HTTPS

หลักฐานที่ต้องส่งกลับมา:

- URL หลัง login สำเร็จ เช่น `/dashboard` หรือ `/dashboard/<gangId>`
- screenshot dashboard หลัง login
- screenshot Discord OAuth redirect URL setting โดยปิด client secret
- ข้อความ error ถ้ามี เช่น `redirect_uri_mismatch`, `OAuthCallback`, หรือ cookie ไม่ติด

### 8.2 Discord Bot Invite และ Permission ก่อน `/setup`

ทำใน Discord Developer Portal:

1. เปิด OAuth2 > URL Generator
2. เลือก scope:

```text
bot
applications.commands
```

3. เลือก bot permissions อย่างน้อย:

```text
Manage Roles
Manage Channels
View Channels
Send Messages
Embed Links
Read Message History
Use Slash Commands
Attach Files
```

4. ใช้ invite URL เชิญ bot เข้า guild ทดสอบ
5. ใน Discord server settings > Roles ให้ลาก role ของ bot ให้อยู่สูงกว่า role ที่ bot ต้องสร้างหรือ assign

ตรวจก่อนรัน `/setup`:

1. bot ต้อง online
2. slash command `/setup` ต้องขึ้นใน guild
3. บัญชีที่กด `/setup` ต้องมี Administrator หรือเป็นคนที่ Discord อนุญาตให้ใช้ command
4. bot role ต้องมี Manage Roles และ Manage Channels ใน server-level permission หรือ channel/category ที่เกี่ยวข้อง

หลักฐานที่ต้องส่งกลับมา:

- screenshot bot role permission
- screenshot bot role position อยู่เหนือ role ที่จะ assign
- screenshot `/setup` command แสดงใน guild

### 8.3 `/setup` Auto Mode

ขั้นตอน:

1. ใน guild ทดสอบ พิมพ์ `/setup`
2. กด `เริ่มเปิดระบบ`
3. ใส่ชื่อแก๊ง
4. เลือก `ติดตั้งอัตโนมัติ`
5. รอจนเจอ success embed
6. กดลิงก์ Dashboard จาก embed

ผลที่ต้องได้:

- ไม่มี error เรื่อง Manage Roles หรือ Manage Channels
- มี success embed ว่าเปิดระบบแก๊งสำเร็จ
- มีห้อง/แผงหลักที่ระบบสร้าง เช่น registration, leave, finance, admin/control panel ตาม flow ปัจจุบัน
- หลัง patch กลับเว็บจริง Dashboard link ต้องชี้ไป `NEXTAUTH_URL` production จริง ไม่ใช่ localhost หรือ domain เก่า

ทดสอบไม่สร้าง duplicate:

1. นับจำนวนห้อง/แผงสำคัญก่อนรันซ้ำ
2. พิมพ์ `/setup` อีกรอบ
3. เลือก auto repair หรือซ่อมแซมห้อง/ยศ
4. ต้อง reuse/update ของเดิม ไม่สร้าง category/channel/panel ซ้ำจนรก

หลักฐานที่ต้องส่งกลับมา:

- screenshot success embed
- screenshot channel list ก่อน/หลังรันซ้ำ
- screenshot panel หลักที่ bot สร้างหรือซ่อม
- ถ้ามี duplicate ให้ส่งชื่อ channel/message ที่ซ้ำ

### 8.4 Manual Role Mapping

ใช้เมื่อ guild มี role เดิมอยู่แล้ว หรืออยากควบคุม role เอง:

1. เตรียม Discord roles แยกกันชัดเจน:

```text
Admin
Treasurer
Attendance Officer
Member
```

2. ห้ามใช้ `@everyone`
3. ห้ามใช้ managed role จาก integration/bot
4. พิมพ์ `/setup`
5. เลือก `เชื่อมยศเอง`
6. เลือก role ให้ครบทีละ permission
7. หลังจบ ให้กด `ซ่อมแซมห้อง/แผงอัตโนมัติ`

ผลที่ต้องได้:

- Owner ถูกยึดจากเจ้าของ Discord server
- แต่ละ permission ใช้ role คนละตัว
- ถ้าเลือก role ซ้ำ ระบบต้องเตือนและไม่บันทึกทับแบบเงียบ
- หลัง mapping แล้ว login dashboard > Settings > Roles & Channels ต้องเห็น mapping ตรงกับ Discord

หลักฐานที่ต้องส่งกลับมา:

- screenshot role select แต่ละ step หรือ screenshot final mapping
- screenshotหน้า `Settings > Roles & Channels`
- output ของคำสั่งนี้หลัง mapping:

```bash
npm run db:audit:role-mappings
```

### 8.5 Channel Mapping บน Dashboard

ขั้นตอน:

1. login ด้วย OWNER
2. เข้า `/dashboard/<gangId>/settings?tab=roles-channels`
3. ตรวจ role mapping ก่อน
4. เลือก channel สำหรับ log, register, attendance, finance, announcement, leave, requests ตามที่ระบบมีให้
5. กดบันทึก
6. refresh หน้า
7. mapping ต้องยังอยู่และไม่สลับ channel

Smoke หลัง mapping:

1. สร้าง attendance Discord self check-in หนึ่งรอบ
2. ต้องส่งปุ่มไป attendance channel ที่เลือกไว้
3. ส่ง leave request หนึ่งรายการ
4. ต้องไปโผล่ใน leave/requests flow ที่ถูกต้อง
5. เปิด finance request หรือ billing request ถ้าเปิด feature
6. ต้องไม่ไปผิด channel

หลักฐานที่ต้องส่งกลับมา:

- screenshot setting หลัง refresh
- screenshot Discord message ไปถูก channel
- รายชื่อ channel ที่ผูกกับแต่ละ function

### 8.6 Production Domain, HTTPS, Callback, Reverse Proxy/TLS/WAF

ถ้าใช้ Vercel/Render:

1. web ต้องเป็น HTTPS public domain
2. `NEXTAUTH_URL` ต้องตรงกับ domain นี้แบบไม่มี slash ท้าย
3. Discord OAuth redirect ต้องตรงกับ callback domain นี้
4. bot `NEXTAUTH_URL` ต้องชี้ web domain เดียวกัน เพื่อให้ปุ่ม Dashboard ไม่หลุดไป localhost
5. ห้าม expose app public แบบ raw HTTP ไม่มี TLS

ตรวจด้วย command:

```bash
npm run release:verify -- --skip-local --web-url https://<web-domain> --bot-url https://<bot-domain>
node scripts/monitor-production.mjs --web-url https://<web-domain> --bot-url https://<bot-domain> --alert-webhook-url <alert-webhook-url>
```

หลักฐานที่ต้องส่งกลับมา:

- output สองคำสั่งด้านบน
- screenshot env ที่แสดง key name ได้ แต่ต้องปิด value/secret
- URL จริงของ web และ bot

### 8.7 CSP Enforce Gate

ตอนนี้ CSP ยังอยู่ Report-Only เพราะ dashboard ยังมี inline style/Next bootstrap ที่ต้องจัดการด้วย nonce/hash strategy ก่อน ถ้าจะ enforce ให้ทำตามนี้:

1. เปิด browser console บน production หรือ staging
2. เข้า landing, login, dashboard, attendance, finance, settings
3. ดู CSP report/console violation
4. แก้ inline dependency ให้รองรับ CSP
5. เปลี่ยน header จาก `Content-Security-Policy-Report-Only` เป็น `Content-Security-Policy`
6. รัน smoke ซ้ำ

ห้าม enforce ถ้ายังเจอ:

- script/style ถูก block
- login หรือ dashboard blank
- Discord OAuth callback กลับมาแล้วหน้าไม่โหลด
- รูป Discord/Cloudinary ไม่ขึ้นเพราะ `img-src`

หลักฐานที่ต้องส่งกลับมา:

- screenshot console ไม่มี critical CSP violation
- screenshot login/dashboard/attendance/finance/settings ใช้งานหลัง enforce
- diff หรือ commit ที่เปลี่ยน CSP header

### 8.8 วิธีส่งผลกลับมาให้ QA ติ๊ก P1

ส่งมาเป็นรายการนี้:

```text
WEB_URL=
BOT_URL=
GANG_ID=
DISCORD_GUILD_ID=
OAuth login: pass/fail + screenshot
/setup auto: pass/fail + screenshot
/setup rerun duplicate check: pass/fail + screenshot
Role mapping: pass/fail + screenshot + db:audit output
Channel mapping: pass/fail + screenshot
release:verify remote: pass/fail + output
monitor-production remote: pass/fail + output
CSP enforce: not attempted/report-only/pass/fail + screenshot
```

## 9. Remaining Launch Blockers

ยังห้ามเรียก Public Launch/Paid Production พร้อมจนกว่าจะปิดหรือรับ risk อย่างชัดเจน:

- Discord OAuth login บน production domain จริง
- `/setup` บน Discord guild จริง พร้อม ManageRoles/ManageChannels และ duplicate check
- Role/channel mapping หลังเปลี่ยน mapping จริง
- Production HTTPS, `NEXTAUTH_URL`, callback URL, bot dashboard link
- Reverse proxy/TLS/WAF หรือ platform edge สำหรับ public deployment
- CSP enforce หลังแก้ inline dependencies และ browser smoke ผ่าน
- Paid billing live smoke ถ้าจะเปิดรับเงินจริง

## 10. Go / No-Go

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
