# Production Pre-Launch Checklist

เอกสารนี้ใช้สำหรับเช็กความพร้อมก่อนปล่อยใช้งานจริงของตัว product

## Current Strategy

2026-05-02 update:

- Remote release verification passed against the deployed Web/Bot URLs.
- PromptPay/SlipOK billing implementation exists and can be tested when env is enabled.
- Before real billing, rotate SlipOK credentials and run the live payment checklist in `MANUAL_E2E_TEST_PLAN.md`.
- Redesign/UI polish is not a blocker for the non-UI production gate, but manual P0 E2E still is.

- โฟกัสปัจจุบันคือ `product readiness`
- ยังไม่โฟกัส `commercial launch`
- ยังไม่ทำ payment automation ใหม่ในรอบนี้
- Stripe ให้ถือเป็น removed/legacy billing path ไม่ใช่ active roadmap
- PromptPay QR เป็นงานอนาคตหลัง product พร้อมใช้งานจริง
- readiness bar ของรอบนี้ให้วัดจาก feature completeness, runtime correctness, reliability, authorization, logging, และ docs truth ก่อน

## Latest Hardening Progress

- Done: `npm run release:verify` passed locally on 2026-04-29 after the legal/support page slice; remote probes were skipped because no deployed URLs were supplied.
- Done: public `/privacy`, `/terms`, and `/support` pages exist and are linked from the footer for a soft-launch baseline.
- Current: Docker/local container verification is being checked by the user; treat Docker/deploy/manual smoke evidence as the next gate before soft launch.
- Done: bot finance entitlement checks are now enforced more consistently across slash commands, buttons, modals, and setup panels.
- Done: bot permission source-of-truth is now aligned around the approved member record in the database, and finance permission checks no longer mix runtime DB checks with direct Discord role-map checks.
- Done: bot role sync now resolves `ATTENDANCE_OFFICER` with the same helper used by permission hardening, reducing drift between Discord role mapping and stored member roles.
- Done: legacy billing is paused by default at the runtime level, and the settings subscription UI reflects that payment is unavailable unless PromptPay billing readiness is enabled.
- Done: settings mutations on the web now require server-side owner authorization.
- Done: `/api/discord/roles` and `/api/discord/channels` now require owner access to the target gang instead of only checking whether the requester is logged in.
- Done: `/api/upload` now requires owner access to the target gang, restricts remote uploads to HTTPS Discord CDN image URLs, and no longer exposes environment state via `GET`.
- Done: payment event idempotency/readiness is handled outside in-memory state for the active billing direction.
- Done: bot interaction throttling now uses durable database-backed counters instead of per-process memory.
- Done: critical web routes now use durable route-level throttling for upload, Discord metadata, admin operational surfaces, and core finance mutation routes.
- Done: test coverage now includes the centralized gang access helper, the secured Discord metadata routes, the hardened upload route, and durable throttling regressions for admin announcements, admin licenses, finance mutations, and gang-fee mutations.
- Done: web and bot now have a shared structured logger baseline with secret redaction, and the main finance/upload/leave-review error paths no longer depend only on scattered `console.*` output.
- Done: leave-review and gang-fee notification failures are now logged as best-effort warnings instead of noisy unstructured stderr spam.
- Done: finance approve/reject and server-transfer routes now emit structured logs for Discord side effects and critical operational failures, and finance transaction actions now have regression coverage.
- Done: attendance list/session routes and attendance close/cancel Discord side effects now emit structured logs, replacing the remaining raw `console.*` paths in these production-relevant attendance flows.
- Done: attendance session regression coverage now includes a close-flow case where Discord returns a non-OK response, ensuring the product flow still succeeds while the warning is captured.
- Done: member create/update/delete/status/role routes now emit structured logs for mutation failures and Discord sync side effects, reducing observability gaps in core member-management flows.
- Done: announcements, dissolve, and my-profile routes now emit structured logs for Discord posting/cleanup side effects and key failure paths, and announcement posting has regression coverage for Discord non-OK responses.
- Done: debug DB, Discord metadata, and legacy billing admin routes now emit structured logs for forbidden access and internal failures instead of raw `console.*` output.
- Done: legacy billing checkout/cancel/webhook surfaces were parked and replaced by the PromptPay / SlipOK direction; current production env must not include `STRIPE_*`.
- Done: root `npm run test` now runs both the web and bot suites, and the bot now has regression coverage for centralized permission helpers, feature-entitlement guards, interaction rate-limit/error fallback behavior, and stateful button/modal flows across finance, leave, attendance, setup, approvals, register, and server transfer.
- Done: bot finance, leave, attendance, approvals, register, server transfer, dissolve, role-sync, verify, and slash-command registration flows now emit structured logs instead of raw `console.*` output in their main operational paths.
- Next: clear the remaining setup-heavy bot logging paths in `setupFlow` and `setupLeave`, then keep tightening docs/runtime alignment around PromptPay / SlipOK billing readiness.

## 1. Environment Contract

รันคำสั่ง:

```bash
npm run validate:env:prod
```

ต้องผ่านโดยไม่มี missing required variables และต้อง review warning ให้สอดคล้องกับ feature ที่เปิดใช้จริง

ค่าที่ต้องมีแน่ ๆ:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `DISCORD_BOT_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `ADMIN_DISCORD_IDS`
- `BACKUP_CHANNEL_ID`

ค่าที่เป็น optional / conditional:

- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `BOT_PORT`

ค่ากลุ่ม billing ปัจจุบัน:

- `ENABLE_PROMPTPAY_BILLING=false` ถ้ายังไม่พร้อมเปิดรับเงินจริง
- `ENABLE_SLIPOK_AUTO_VERIFY=false` ถ้ายังไม่พร้อมใช้ SlipOK อัตโนมัติ
- `PROMPTPAY_RECEIVER_NAME`
- `PROMPTPAY_IDENTIFIER`
- `SLIPOK_API_KEY`
- `SLIPOK_BRANCH_ID`

หมายเหตุ:

- Stripe ไม่ใช่ active billing path แล้ว
- ห้ามเหลือ `STRIPE_*` ใน production env เพราะ `npm run validate:env:prod` จะ fail เพื่อกันความสับสน
- ถ้าจะเปิดขายจริง ให้เปิดผ่าน PromptPay / SlipOK readiness gate เท่านั้น

## 2. Database Release Safety

ตรวจ preview ก่อน:

```bash
npm run db:normalize:tiers
```

ถ้ายังมี legacy tier เช่น `TRIAL` หรือ `PRO` ให้ apply ก่อน:

```bash
npm run db:normalize:tiers:apply
```

จากนั้น push schema ล่าสุด:

```bash
npm run db:push
```

## 3. Local Readiness Verification

รันชุดหลัก:

```bash
npm run release:verify
```

ปัจจุบันชุดนี้ช่วยตรวจ:

- production env contract
- subscription tier normalization preview
- workspace test suites for both web and bot
- workspace builds

ข้อจำกัดที่ต้องจำ:

- ยังไม่ได้ครอบคลุม bot business rules ทั้งหมด แต่ตอนนี้มี tests สำหรับ permission helpers, feature guards, finance slash flows, interaction fallback/rate-limit paths, และ button/modal flows สำคัญของ finance, leave, attendance, และ setup แล้ว
- ยังไม่ได้พิสูจน์ว่า finance gating และ authorization ปลอดภัยทุก entry point

## 4. Deploy Targets

### Web

- deploy ผ่าน **Vercel**
- ใช้ root ที่ `apps/web`
- หลัง deploy ต้องเช็ก `/api/health`

### Bot

- deploy ผ่าน **Render**
- bot ต้องรันผ่าน `apps/bot/src/manager.ts`
- หลัง deploy ต้องเช็ก `/health` และ `/ready`
- ควรมี uptime monitor ยิง `/health`

## 5. Post-Deploy Sanity

ถ้ามี public URLs แล้ว ให้รัน:

```bash
npm run release:verify -- --skip-local --web-url https://<web-host> --bot-url https://<bot-host>
```

จากนั้นเช็กด้วยคนอีกครั้ง:

- Discord bot online
- slash command `/setup` ใช้งานได้
- web login ผ่าน Discord ได้
- dashboard เปิดได้จริง
- finance export ยังกันสิทธิ์ถูกต้อง
- leave request ที่ processed แล้วกดซ้ำไม่ได้
- admin-only routes ยังจำกัดสิทธิ์ถูกต้อง

## 6. Secret Rotation Closeout

ถ้ามีการเปิดเผย secrets ใน terminal, logs, screenshots, หรือเอกสาร ต้อง rotate ก่อน go-live

ค่าที่ควร rotate อย่างน้อย:

- `DISCORD_BOT_TOKEN`
- `DISCORD_CLIENT_SECRET`
- `TURSO_AUTH_TOKEN`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

ค่ากลุ่ม legacy billing ที่ควรถูกลบออกจาก provider ถ้ายังมีอยู่:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

## 7. Go / No-Go Rule

ปล่อยใช้งานจริงได้เมื่อ:

- `npm run release:verify` ผ่าน
- `npm run db:push` ผ่าน
- web health ผ่าน
- bot health และ readiness ผ่าน
- ไม่มี missing required secrets
- ไม่มี P0 authorization หรือ plan bypass ที่ยังเปิดอยู่

ให้ถือเป็น `No-Go` ถ้า:

- ยังมี finance flow ที่ bypass entitlement ได้
- ยังมี route/action สำคัญที่ไม่มี authorization ในตัว
- release verification ยังเขียวแต่ business rule สำคัญยังไม่ได้พิสูจน์
- เอกสารกับของจริงยังพูดคนละเรื่อง
- ทีมยังสับสนว่า Stripe เป็น active scope ทั้งที่ policy ปัจจุบัน park ไว้แล้ว
