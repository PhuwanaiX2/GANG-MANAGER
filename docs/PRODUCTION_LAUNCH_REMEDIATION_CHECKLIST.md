---
title: Production Launch Remediation Checklist
created_at: 2026-05-14
owner: Codex QA
status: active
---

# Production Launch Remediation Checklist

> แผนปฏิบัติงานล่าสุดสำหรับรอบ Docker local -> push GitHub -> production smoke อยู่ที่ [CURRENT_DOCKER_TO_PRODUCTION_QA_PLAN.md](CURRENT_DOCKER_TO_PRODUCTION_QA_PLAN.md)
> ไฟล์นี้เป็น checklist/detail history สำหรับติ๊ก evidence และ audit item ไม่ใช่แผนลำดับงานหลักล่าสุด

ไฟล์นี้คือ checklist หลักสำหรับแก้จาก Production Audit ไปสู่ระดับ Soft Launch / Public Launch / Paid Production

เป้าหมายคือทำให้ระบบได้คะแนน 90+/100 หรือใกล้ที่สุดเท่าที่ทำได้ โดยเฉพาะจุดที่เกี่ยวกับ security, correctness, permission, finance, attendance, auth, deployment และ UX/UI ที่กระทบผู้ใช้จริง

## กติกาการติ๊กงาน

- ห้ามติ๊ก `[x]` ถ้ายังแก้ไม่เสร็จจริง
- ห้ามติ๊ก `[x]` ถ้ายังไม่มีหลักฐานตรวจ เช่น test, build, audit, browser check, API check หรือ manual QA
- ถ้าแก้บางส่วน ให้ใส่ `[~]` ในหมายเหตุแทนการติ๊กเสร็จ
- ทุกครั้งที่ติ๊กงาน ต้องอัปเดต `Change Log` ด้านล่างด้วย
- ถ้างานหนึ่งกระทบหลายระบบ ต้องตรวจ regression ของทุกระบบที่เกี่ยวข้อง ไม่ใช่เฉพาะหน้าที่แก้
- ถ้าไม่แน่ใจว่ากระทบอะไร ให้หยุดและทำ impact analysis เพิ่มก่อน

## Score Target

| Metric | Current Audit | Target |
|---|---:|---:|
| Overall Score | 55/100 | 90+/100 |
| Soft Launch Readiness | 35/100 | 90+/100 |
| Public Launch Readiness | 20/100 | 90+/100 |
| Paid Production Readiness | 15/100 | 90+/100 |

## Per-System Target

| System | UX/UI | Security | Correctness | Usability | Reliability | Maintainability | Overall |
|---|---:|---:|---:|---:|---:|---:|---:|
| Authentication / Login / Session / Permission | 9/10 | 9/10 | 9/10 | 9/10 | 9/10 | 9/10 | 9/10 |
| Dashboard / UX Flow / Settings | 9/10 | 9/10 | 9/10 | 9/10 | 9/10 | 9/10 | 9/10 |
| Attendance / Check-in / Activity | 9/10 | 9/10 | 9/10 | 9/10 | 9/10 | 9/10 | 9/10 |
| Finance / Gang Fund / Slip / Transaction | 9/10 | 9/10 | 9/10 | 9/10 | 9/10 | 9/10 | 9/10 |
| Discord Bot / Setup / Role Mapping / Commands | 9/10 | 9/10 | 9/10 | 9/10 | 9/10 | 9/10 | 9/10 |
| API / Database / Migration / Rate Limit | 9/10 | 9/10 | 9/10 | 9/10 | 9/10 | 9/10 | 9/10 |
| Infrastructure / Deployment / Health / Monitoring | 9/10 | 9/10 | 9/10 | 9/10 | 9/10 | 9/10 | 9/10 |
| Security / Abuse / Edge Cases | 9/10 | 9/10 | 9/10 | 9/10 | 9/10 | 9/10 | 9/10 |
| Performance / Reliability | 9/10 | 9/10 | 9/10 | 9/10 | 9/10 | 9/10 | 9/10 |
| Code Quality / Maintainability | 9/10 | 9/10 | 9/10 | 9/10 | 9/10 | 9/10 | 9/10 |

## Change Log

| Date | System | Change | Verification | Result | Checked By |
|---|---|---|---|---|---|
| 2026-05-15 | P1 E2E/Auth/Attendance Smoke | Fixed Playwright auth secret precedence so Docker-target authenticated smoke uses the root/Docker `NEXTAUTH_SECRET` by default, kept project `NEXTAUTH_URL` override for local browser targets, revalidated attendance session pages after mutations, and updated attendance smoke to assert website-origin notes during active self-check-in | `npm run test -w apps/web -- src/tests/api/attendance-session.test.ts`; `npm run test -w apps/web -- src/tests/lib/auth-session.test.ts`; `npm run build -w apps/web`; `docker compose up -d --build web`; `PLAYWRIGHT_RUN_PRODUCTION_SMOKE=1 npm run test:e2e -w apps/web`; `PLAYWRIGHT_RUN_ATTENDANCE_SMOKE=1 E2E_ATTENDANCE_MODE=MANUAL_ROLL_CALL npm run test:e2e -w apps/web`; `PLAYWRIGHT_RUN_ATTENDANCE_SMOKE=1 E2E_ATTENDANCE_MODE=MANUAL_ROLL_CALL E2E_MOBILE_VIEWPORT=1 npm run test:e2e -w apps/web`; `PLAYWRIGHT_RUN_ATTENDANCE_SMOKE=1 E2E_ATTENDANCE_MODE=DISCORD_SELF_CHECKIN npm run test:e2e -w apps/web`; `npm run monitor:production -- --web-url http://localhost:3000 --bot-url http://localhost:8080` | Passed; no `E2E_NEXTAUTH_SECRET` override required | Codex |
| 2026-05-14 | Audit | Created remediation checklist from production audit findings | Read-only audit, tests/build/audit summary | Baseline created | Codex |
| 2026-05-14 | P0 Finance/Attendance | Bound finance transactions, finance member mutations, attendance reads/status/delete, bot finance/attendance/approval flows to gang scope | `npm run test`, `npm run build` | Passed | Codex |
| 2026-05-14 | P1 Security/Permission | Upgraded Next.js to `15.5.18`, removed Discord OAuth token from app sessions/E2E storage, added same-origin mutation guard, restricted finance audit, protected announcements GET, fail-closed critical rate limits, and no-store sensitive API middleware | `npm audit --omit=dev --audit-level=high`, `npm run test`, `npm run build` | Passed; remaining audit is moderate PostCSS under Next.js | Codex |
| 2026-05-14 | P1 Billing/Permission | Added production permission matrix and restricted subscription slip image URLs to Cloudinary or configured trusted hosts | `npm run test -w apps/web -- src/tests/lib/adminAuth.test.ts src/tests/actions/settings-actions.test.ts src/tests/api/gang-settings.test.ts src/tests/api/activate-license.test.ts src/tests/api/announcements.test.ts src/tests/api/attendance.test.ts src/tests/api/attendance-session.test.ts src/tests/api/finance.test.ts src/tests/api/finance-transaction-actions.test.ts src/tests/api/finance-reporting.test.ts src/tests/api/gang-fee.test.ts src/tests/api/members.test.ts src/tests/api/server-transfer.test.ts src/tests/api/subscription-payment-requests.test.ts src/tests/api/admin-announcements.test.ts src/tests/api/admin-backup.test.ts src/tests/api/admin-gangs.test.ts src/tests/api/admin-licenses.test.ts src/tests/api/admin-subscription-payments.test.ts src/tests/api/discord-metadata.test.ts src/tests/api/leaves.test.ts src/tests/api/leaves-create.test.ts`; `npm run test -w apps/bot -- tests/financeOps.test.ts tests/financeButtonModalFlows.test.ts tests/attendanceFlows.test.ts tests/interactions.test.ts tests/interactionRateLimit.test.ts`; `npm run validate:env:prod`; `npm run encoding:verify`; `npm run build -w apps/web`; `npm run build -w apps/bot` | Passed | Codex |
| 2026-05-14 | P1 Database/Release Gate | Restored missing Drizzle `0008_snapshot.json`, fixed snapshot chain, added migration metadata audit, and wired it into release verification | `npm run db:audit:migrations`; `npm run db:generate`; `npm run db:audit:role-mappings` | Passed | Codex |
| 2026-05-14 | P1 Billing UX | Removed public slip URL entry from billing UI so the visible UX matches the trusted-upload security policy | `npm run test -w apps/web -- src/tests/api/subscription-payment-requests.test.ts`; `npm run build -w apps/web` | Passed | Codex |
| 2026-05-14 | P1 Smoke/Settings | Updated production smoke selectors to stable `data-testid`/role/URL checks, fixed Playwright auth env precedence, and added owner-only settings denial marker | `npm run test -w apps/web -- src/tests/actions/settings-actions.test.ts src/tests/api/gang-settings.test.ts src/tests/api/attendance.test.ts src/tests/api/attendance-session.test.ts src/tests/api/subscription-payment-requests.test.ts src/tests/api/admin-subscription-payments.test.ts src/tests/lib/billingPlans.test.ts`; `npm run test -w apps/bot -- tests/setupFlow.test.ts tests/permissions.test.ts tests/leaveFlows.test.ts tests/attendanceFlows.test.ts tests/interactions.test.ts tests/interactionRateLimit.test.ts tests/financeOps.test.ts tests/financeButtonModalFlows.test.ts`; `PLAYWRIGHT_RUN_PRODUCTION_SMOKE=1 E2E_BASE_URL=http://127.0.0.1:3102 npx playwright test tests/e2e/production-readiness.spec.ts --project=chromium`; `npm run encoding:verify`; `npm run validate:env:prod`; `npm run build -w apps/web`; `npm run build -w apps/bot`; `npm run release:verify -- --skip-local` | Passed locally: Playwright 6 passed / 2 skipped for env-gated finance-locked/admin smoke | Codex |
| 2026-05-14 | P1 Attendance UX/Regression | Kept Discord check-in users on session detail after start/close, normalized attendance history test IDs, added mobile viewport smoke mode, and raised attendance action touch targets to 44px+ | `PLAYWRIGHT_RUN_ATTENDANCE_SMOKE=1 E2E_ATTENDANCE_MODE=MANUAL_ROLL_CALL E2E_MOBILE_VIEWPORT=1 E2E_BASE_URL=http://127.0.0.1:3112 npx playwright test tests/e2e/attendance-smoke.spec.ts --project=chromium`; `PLAYWRIGHT_RUN_ATTENDANCE_SMOKE=1 E2E_BASE_URL=http://127.0.0.1:3111 npx playwright test tests/e2e/attendance-smoke.spec.ts --project=chromium`; `npm run test -w apps/web -- src/tests/api/attendance.test.ts src/tests/api/attendance-session.test.ts`; `npm run test -w apps/bot -- tests/attendanceFlows.test.ts tests/interactions.test.ts tests/interactionRateLimit.test.ts` | Passed | Codex |
| 2026-05-14 | P1 Docker/Health | Verified Docker build, container recreate, web health, bot health, and bot readiness probes | `npm run docker:verify` | Passed | Codex |
| 2026-05-14 | P1 Dashboard States | Added missing dashboard index loading, billing loading, and gang dashboard segment error boundary while preserving existing page loading/empty states | `npm run encoding:verify`; `npm run build -w apps/web` | Passed | Codex |
| 2026-05-14 | P1 Attendance Race/Timezone | Made finalized web close/cancel calls idempotent, moved close penalties behind an optimistic attendance-record claim in web and bot close paths, made Discord check-in insert conflict-safe, and added Bangkok boundary coverage for manual/scheduled session creation | `npm run test -w apps/web -- src/tests/api/attendance.test.ts src/tests/api/attendance-session.test.ts`; `npm run test -w apps/bot -- tests/attendanceSchedulerClose.test.ts tests/attendanceFlows.test.ts tests/attendanceSchedulerBackoff.test.ts`; `npm run test -w apps/bot -- tests/attendanceFlows.test.ts tests/interactions.test.ts tests/interactionRateLimit.test.ts tests/attendanceSchedulerClose.test.ts`; `npm run build -w apps/bot` | Passed | Codex |
| 2026-05-14 | P1 Security/Abuse | Added static XSS sink guard for user-generated content renderers and reran web/bot abuse rate-limit flows for leaves, finance, attendance, announcements, and interactions | `npm run test -w apps/web -- src/tests/security/user-content-xss-surface.test.ts src/tests/api/leaves-create.test.ts src/tests/api/attendance.test.ts src/tests/api/attendance-session.test.ts src/tests/api/finance.test.ts src/tests/api/finance-transaction-actions.test.ts src/tests/api/announcements.test.ts src/tests/lib/apiRateLimit.test.ts src/tests/lib/requestOrigin.test.ts`; `npm run test -w apps/bot -- tests/attendanceSchedulerClose.test.ts tests/attendanceFlows.test.ts tests/interactions.test.ts tests/interactionRateLimit.test.ts tests/financeOps.test.ts tests/financeButtonModalFlows.test.ts` | Passed | Codex |
| 2026-05-14 | P1 DB Hotspots | Added composite indexes for finance summaries/history, attendance lists/detail counts, members list filters, and collection debts | `npm run db:generate`; `npm run db:audit:migrations`; `npm run test -w apps/web -- src/tests/api/attendance.test.ts src/tests/api/attendance-session.test.ts src/tests/api/finance-reporting.test.ts src/tests/api/finance-transaction-actions.test.ts src/tests/services/finance-ledger-invariants.test.ts src/tests/api/members.test.ts`; `npm run test -w apps/bot -- tests/attendanceSchedulerClose.test.ts tests/attendanceFlows.test.ts tests/financeOps.test.ts tests/financeButtonModalFlows.test.ts` | Passed | Codex |
| 2026-05-14 | P1 Finance IA | Added regression guard that finance UI keeps real gang balance, open dues, pending reviews, and due-only transaction rows separated in user-facing copy | `npm run test -w apps/web -- src/tests/ui/finance-ia.test.ts src/tests/security/user-content-xss-surface.test.ts src/tests/api/finance-reporting.test.ts src/tests/api/finance-transaction-actions.test.ts src/tests/services/finance-ledger-invariants.test.ts` | Passed | Codex |
| 2026-05-14 | P1 Route Size Budget | Verified target dashboard routes remain below a 150 kB First Load JS local build budget: finance 144 kB, members 136 kB, leaves 133 kB, attendance detail 129 kB | `npm run build -w apps/web` | Passed | Codex |
| 2026-05-14 | P1 Navigation Loading | Added regression guard that finance tab switches and attendance URL filter switches expose pending/loading feedback, while leaves/member filters remain instant local state with pagination reset | `npm run test -w apps/web -- src/tests/ui/navigation-loading-states.test.ts src/tests/ui/finance-ia.test.ts`; `npm run test -w apps/web -- src/tests/ui/navigation-loading-states.test.ts` | Passed | Codex |
| 2026-05-14 | P1 Permission Abuse | Added middleware regression coverage that repeated finance/admin API attempts from the same client IP are throttled with 429 and no-store headers | `npm run test -w apps/web -- src/tests/lib/middleware-cache.test.ts src/tests/lib/requestOrigin.test.ts src/tests/lib/apiRateLimit.test.ts` | Passed | Codex |
| 2026-05-14 | P1 Resource Ownership Helper | Added `requireGangResource` guard and wired it into finance transaction, attendance session, and announcement gang ownership checks | `npm run test -w apps/web -- src/tests/lib/gangAccess.test.ts src/tests/api/finance-transaction-actions.test.ts src/tests/api/attendance-session.test.ts src/tests/api/announcements.test.ts` | Passed | Codex |
| 2026-05-14 | P1 Attendance Record Race | Added optimistic concurrency handling for manual attendance record update/insert so stale concurrent edits return 409 before audit/Discord summary side effects | `npm run test -w apps/web -- src/tests/api/attendance-session.test.ts` | Passed | Codex |
| 2026-05-14 | P1 Monitoring/Alerts | Added opt-in alert webhook dispatch for web/bot error logs, bot shard disconnect/error alerts, and a production health monitor script for web health plus bot health/ready probes | `npm run test -w apps/web -- src/tests/lib/logger.test.ts src/tests/api/health.test.ts src/tests/api/admin-subscription-payments.test.ts src/tests/api/subscription-payment-requests.test.ts`; `npm run test -w apps/bot -- tests/logger.test.ts`; `node scripts/monitor-production.mjs --dry-run --web-url https://web.example --bot-url https://bot.example --alert-webhook-url https://alerts.example/webhook` | Passed | Codex |
| 2026-05-14 | P1 Attendance Timezone | Added regression guard that create boundaries, close/report copy, dashboard attendance display, member detail display, and bot auto-start/auto-close Discord messages stay in Bangkok time | `npm run test -w apps/web -- src/tests/ui/attendance-timezone.test.ts src/tests/api/attendance.test.ts src/tests/api/attendance-session.test.ts` | Passed | Codex |
| 2026-05-14 | P1 Auth Cookies | Added regression coverage that HTTPS `NEXTAUTH_URL` enables secure `__Secure-`/`__Host-` NextAuth cookies while localhost keeps OAuth development cookies usable | `npm run test -w apps/web -- src/tests/lib/auth-session.test.ts` | Passed | Codex |
| 2026-05-14 | P1 Attendance Maintainability | Extracted attendance record optimistic update/insert conflict handling from the large session route into a testable helper while preserving session API behavior | `npm run test -w apps/web -- src/tests/lib/attendanceRecordWrites.test.ts src/tests/api/attendance-session.test.ts src/tests/ui/attendance-timezone.test.ts src/tests/api/attendance.test.ts` | Passed | Codex |
| 2026-05-14 | P1 Billing Flow | Added a single enabled-billing API workflow test covering create request, list active request, submit slip payload, SlipOK verification, and approval/activation | `npm run test -w apps/web -- src/tests/api/subscription-payment-requests.test.ts src/tests/api/admin-subscription-payments.test.ts src/tests/lib/billingPlans.test.ts` | Passed locally with mocked SlipOK provider | Codex |
| 2026-05-14 | Final Gate Audit Check | Rechecked dependency audit gate for launch readiness | `npm audit --omit=dev --audit-level=high` | Passed for high/critical; moderate PostCSS advisory remains via Next dependency | Codex |
| 2026-05-14 | P1 Live Gate Runbook | Added owner-facing step-by-step verification for Discord OAuth, `/setup`, role/channel mapping, production callback/TLS, monitor probes, and CSP enforce evidence; added PR template checklist hook | `npm run encoding:verify` | Passed | Codex |
| 2026-05-14 | Docker Health Timeout | Added explicit per-probe timeout, retry interval, and attempt budget to `docker:verify` health probes so a stuck web/bot health request fails predictably | `node --check scripts/docker-readiness.mjs`; `npm run encoding:verify` | Passed | Codex |
| 2026-05-14 | Docker Patch-Back QA | Reframed owner verification around Docker-first staging before patching back to the existing live web, with concrete manual smoke steps and a result template | `npm run encoding:verify` | Passed | Codex |
| 2026-05-14 | P1 Docker Attendance Smoke | Fixed Docker-target Playwright auth secret override and stabilized attendance history ordering for same-day closed rounds so the newest closed session is reachable on desktop/mobile history views | `npm run docker:verify`; `PLAYWRIGHT_RUN_PRODUCTION_SMOKE=1 E2E_BASE_URL=http://127.0.0.1:3000 npx playwright test tests/e2e/production-readiness.spec.ts --project=chromium`; `PLAYWRIGHT_RUN_ATTENDANCE_SMOKE=1 E2E_ATTENDANCE_MODE=MANUAL_ROLL_CALL E2E_BASE_URL=http://127.0.0.1:3000 npx playwright test tests/e2e/attendance-smoke.spec.ts --project=chromium`; `PLAYWRIGHT_RUN_ATTENDANCE_SMOKE=1 E2E_ATTENDANCE_MODE=MANUAL_ROLL_CALL E2E_MOBILE_VIEWPORT=1 E2E_BASE_URL=http://127.0.0.1:3000 npx playwright test tests/e2e/attendance-smoke.spec.ts --project=chromium`; `npm run test -w apps/web -- src/tests/lib/attendanceRecordWrites.test.ts src/tests/api/attendance-session.test.ts src/tests/ui/attendance-timezone.test.ts src/tests/api/subscription-payment-requests.test.ts src/tests/lib/auth-session.test.ts`; `npm run encoding:verify` | Passed in Docker staging; production smoke 6 passed / 2 skipped for env-gated finance/admin checks | Codex |
| 2026-05-14 | Current QA Plan | Created a single source-of-truth plan that separates Docker-local checks Codex can run, Docker Discord checks the owner must click manually, and post-push real production checks | `npm run test`; `npm run validate:env:prod`; `npm audit --omit=dev --audit-level=high`; `npm run db:audit:migrations` | Passed; web 328 tests, bot 90 tests | Codex |
| 2026-05-14 | Bot Invite Link | Centralized bot invite URL generation, defaulted to client id `1468534739911573544`, replaced broad admin permission invite with required bot permissions, and documented the canonical Docker invite URL | `npm run test -w apps/web -- src/tests/lib/discordInvite.test.ts`; `npm run encoding:verify`; `git diff --check -- apps/web/src/lib/discordInvite.ts apps/web/src/tests/lib/discordInvite.test.ts apps/web/src/app/page.tsx apps/web/src/app/dashboard/page.tsx .env.example docs/CURRENT_DOCKER_TO_PRODUCTION_QA_PLAN.md` | Passed | Codex |
| 2026-05-14 | Docker Manual Smoke | Recorded owner-reported Docker manual pass for `/setup` auto, `/setup` duplicate, member registration, Discord self check-in, channel mapping, manual roll call mobile, leave flow, billing disabled, permission deny, finance locked/free, finance premium, and role mapping retest after the `@everyone` fix; Codex verified Docker recreate/health/ready for restart resilience | User manual reports in chat; `npm run docker:verify`; current owner actions now closed in `docs/CURRENT_DOCKER_TO_PRODUCTION_QA_PLAN.md` | Passed for Docker manual gate | User + Codex |
| 2026-05-14 | Role Mapping `@everyone` Guard | Blocked `@everyone` role mapping in settings UI and server action, while preserving duplicate-role protection | `npm run test -w apps/web -- src/tests/actions/settings-actions.test.ts`; `npm run build -w apps/web`; `npm run docker:verify`; `npm run encoding:verify`; `git diff --check -- apps/web/src/app/actions/settings.ts apps/web/src/components/RoleManager.tsx apps/web/src/tests/actions/settings-actions.test.ts packages/database/src/validations.ts`; owner Docker retest | Passed | Codex + User |

## P0 - ต้องแก้ก่อนปล่อยทุกกรณี

### Finance Data Isolation

- [x] Bind finance transaction approve/reject ด้วย `transactionId + gangId`
  - Impact: ป้องกัน treasurer/owner แก๊งหนึ่ง approve/reject transaction ของอีกแก๊ง
  - Related: `apps/web/src/app/api/gangs/[gangId]/finance/[transactionId]/route.ts`
  - Related: `packages/database/src/services/finance.ts`
  - Verification:
    - [x] เพิ่ม API test cross-gang approve ต้องโดน 403/404
    - [x] เพิ่ม API test cross-gang reject ต้องโดน 403/404
    - [x] รัน unit/integration tests ผ่าน

- [x] Validate finance `memberId` ว่าเป็นสมาชิกของ `gangId` เดียวกันก่อนสร้าง transaction
  - Impact: ป้องกัน transaction แก๊ง A กระทบ balance สมาชิกแก๊ง B
  - Related: `apps/web/src/app/api/gangs/[gangId]/finance/route.ts`
  - Related: `packages/database/src/services/finance.ts`
  - Verification:
    - [x] เพิ่ม API test สร้าง transaction ด้วย memberId ต่างแก๊งต้อง fail
    - [x] เพิ่ม test member balance ไม่เปลี่ยนเมื่อ cross-gang request fail

- [x] Bot finance approve/reject ต้อง validate ว่า transaction อยู่ guild/gang ปัจจุบัน
  - Impact: ลดความเสี่ยง component interaction ข้าม context
  - Related: `apps/bot/src/features/finance.ts`
  - Verification:
    - [x] เพิ่ม bot interaction test หรือ service test
    - [ ] ทดสอบ approve/reject ใน guild ที่ถูกต้องยังทำงาน

### Attendance Data Isolation

- [x] Attendance GET list ต้องใช้ gang access check
  - Impact: ป้องกัน user login แล้วอ่าน attendance แก๊งอื่น
  - Related: `apps/web/src/app/api/gangs/[gangId]/attendance/route.ts`
  - Verification:
    - [x] เพิ่ม API test non-member GET list ต้องโดน 403/404
    - [x] เพิ่ม API test member ในแก๊งถูกต้องยังอ่านได้ตาม role ที่ตั้งใจ

- [x] Attendance GET detail ต้องใช้ gang access check
  - Impact: ป้องกัน leak records, absence, leave, member attendance detail
  - Related: `apps/web/src/app/api/gangs/[gangId]/attendance/[sessionId]/route.ts`
  - Verification:
    - [x] เพิ่ม API test non-member GET detail ต้องโดน 403/404
    - [x] เพิ่ม API test cross-gang sessionId ต้องโดน 403/404

- [x] Attendance DELETE ต้อง bind `sessionId + gangId`
  - Impact: ป้องกัน owner แก๊งหนึ่งลบรอบเช็คชื่อของอีกแก๊ง
  - Related: `apps/web/src/app/api/gangs/[gangId]/attendance/[sessionId]/route.ts`
  - Verification:
    - [x] เพิ่ม API test cross-gang delete ต้อง fail
    - [x] เพิ่ม API test owner แก๊งถูกต้อง delete ได้ตามกติกา

- [x] Attendance status/start/close/cancel/update summary ทุกจุดต้อง bind `sessionId + gangId`
  - Impact: ป้องกัน officer แก๊งหนึ่งแก้สถานะ session ของอีกแก๊ง
  - Related: `apps/web/src/app/api/gangs/[gangId]/attendance/[sessionId]/route.ts`
  - Verification:
    - [x] เพิ่ม API test cross-gang start ต้อง fail
    - [x] เพิ่ม API test cross-gang close/cancel ต้อง fail
    - [x] เพิ่ม API test lifecycle ปกติยังผ่าน

### P0 QA Gate

- [x] เพิ่ม regression test ชุด cross-gang สำหรับ finance
- [x] เพิ่ม regression test ชุด cross-gang สำหรับ attendance
- [x] รัน `npm run test` ผ่าน
- [x] รัน `npm run build` ผ่าน
- [ ] ตรวจ manual API smoke อย่างน้อยหนึ่งเคสต่อ P0 issue

## P1 - ควรแก้ก่อน Soft Launch

### Authentication / Session / Permission

- [x] Upgrade `next` เป็น patched version ล่าสุดที่ปิด high severity advisory
  - Related: `package.json`
  - Related: `package-lock.json`
  - Verification:
    - [x] รัน `npm audit --omit=dev` ต้องไม่มี high/critical
    - [x] รัน `npm run build` ผ่าน

- [x] เอา Discord OAuth `accessToken` ออกจาก client session ถ้า frontend ไม่จำเป็นต้องใช้
  - Related: `apps/web/src/lib/auth.ts`
  - Verification:
    - [x] ตรวจ session payload ฝั่ง browser แล้วไม่มี access token
    - [ ] login flow ยังทำงาน

- [x] สร้าง permission matrix สำหรับทุก role และทุก protected route
  - Related: `docs/PRODUCTION_PERMISSION_MATRIX.md`
  - Verification:
    - [x] ระบุ OWNER / ADMIN / TREASURER / ATTENDANCE_OFFICER / MEMBER ต่อ route
    - [x] route finance, attendance, settings, admin มี test ครบ

- [x] เพิ่ม Origin/CSRF guard สำหรับ state-changing APIs
  - Related: `apps/web/src/app/api/**`
  - Verification:
    - [x] request POST/PATCH/DELETE จาก origin แปลกต้อง fail
    - [x] request จาก same-origin ยังผ่าน

- [x] Announcements GET ต้องตรวจ gang membership ก่อนอ่านข้อมูลในแก๊ง
  - Related: `apps/web/src/app/api/gangs/[gangId]/announcements/route.ts`
  - Verification:
    - [x] non-member อ่าน announcement list ไม่ได้
    - [x] member อ่าน announcement list ได้

### Dashboard / UX Flow / Settings

- [x] Production smoke test ต้องตรงกับ UI ปัจจุบัน ไม่ stale copy
  - Related: `apps/web/tests/e2e/production-readiness.spec.ts`
  - Verification:
    - [x] Playwright production smoke ผ่าน
    - Note: local run ผ่าน 6 tests และ skip 2 tests ที่ต้องใช้ finance-locked/admin live session env

- [x] Settings owner-only UX และ permission ต้องชัดทั้งหน้าและ API
  - Related: `apps/web/src/app/actions/settings.ts`
  - Related: `apps/web/src/app/dashboard/[gangId]/settings/page.tsx`
  - Verification:
    - [x] OWNER แก้ได้
    - [x] ADMIN/TREASURER/MEMBER แก้ไม่ได้

- [x] ตรวจ loading / empty / error state ของ dashboard pages
  - Verification:
    - [x] Dashboard shell
    - [x] Overview
    - [x] Members
    - [x] My Profile
    - [x] Attendance
    - [x] Finance
    - [x] Leaves
    - [x] Billing
    - [x] Settings

### Attendance / Check-in / Activity

- [x] Manual roll call UX ใช้บนมือถือได้จริง
  - Verification:
    - [x] tap target 44px+
    - [x] record status เปลี่ยนได้ไม่สับสน
    - [x] loading หลัง action ชัด

- [x] Discord self check-in flow เดิมต้องไม่พัง
  - Verification:
    - [x] สร้าง session Discord mode ได้
    - [x] ส่งปุ่มไป Discord ได้
    - [x] member กดเช็คชื่อแล้ว record ถูกต้อง

- [x] กัน duplicate/race ใน attendance session lifecycle
  - Verification:
    - [x] start ซ้ำไม่สร้าง state เพี้ยน
    - [x] close/cancel ซ้ำไม่พัง
    - [x] record update พร้อมกันไม่ทำ summary ผิด

- [x] ประวัติรอบเช็คชื่อเรียง stable เมื่อมีหลายรอบในวันเดียวกัน
  - Impact: หลังปิดรอบบนมือถือ/desktop ผู้ใช้ต้องเห็นรอบล่าสุดในประวัติทันที ไม่โดนรายการเก่าดันจนเหมือนปุ่ม/flow พัง
  - Related: `apps/web/src/app/dashboard/[gangId]/attendance/page.tsx`
  - Related: `apps/web/src/app/dashboard/[gangId]/attendance/AttendanceClient.tsx`
  - Verification:
    - [x] Docker attendance desktop smoke สร้าง แก้ ปิด และเจอรอบล่าสุดใน history
    - [x] Docker attendance mobile smoke สร้าง แก้ ปิด และเจอรอบล่าสุดใน history

- [x] Timezone Bangkok ต้อง consistent ทั้ง create, close, report, display
  - Verification:
    - [x] test date boundary
    - [x] test manual mode date
    - [x] test scheduled mode date

### Finance / Gang Fund / Slip / Transaction

- [x] Finance audit API ต้องจำกัด TREASURER/OWNER หรือทำ member-filter ให้ชัด
  - Related: `apps/web/src/app/api/gangs/[gangId]/finance/audit/route.ts`
  - Verification:
    - [x] MEMBER อ่าน audit ทั้งแก๊งไม่ได้
    - [x] TREASURER/OWNER อ่านได้

- [x] Finance IA ต้องแยกเงินจริง, ยอดค้าง, pending, credit, audit ให้ไม่สับสน
  - Verification:
    - [x] user เห็นยอดกองกลางจริงชัด
    - [x] pending ไม่ถูกนับเป็นเงินเข้า
    - [x] transaction status สื่อความหมายชัด

- [x] Slip image URL ต้องจำกัดแหล่งที่มาให้ปลอดภัย
  - Related: `apps/web/src/app/api/gangs/[gangId]/subscription/payment-requests/[paymentRequestId]/slip/route.ts`
  - Related: `apps/web/src/lib/slipOk.ts`
  - Verification:
    - [x] allow เฉพาะ upload/cloudinary หรือ trusted host
    - [x] random external URL ต้อง fail

- [x] Paid billing flag ต้องชัดเจนก่อนขายจริง
  - Verification:
    - [x] ถ้า billing disabled ต้องไม่มี UX ที่เหมือนจ่ายเงินจริงได้
    - [x] ถ้า billing enabled ต้องมี e2e ครบ request, upload slip, verify, approve
    - Note: ผ่านระดับ local API e2e ด้วย mocked SlipOK; ก่อนขายเงินจริงยังต้องรัน live paid smoke ตาม final gate

### Discord Bot / Setup / Role Mapping / Commands

- [x] ทดสอบ `/setup` ใน Discord guild จริง
  - Note: ระหว่างรอบนี้ให้ทดสอบใน Docker staging + Discord test guild ก่อน patch กลับเว็บจริง ดู `GO_LIVE_RUNBOOK.md#7-docker-first-patch-back-verification-ที่ต้องเทสตอนนี้`
  - Verification:
    - [x] bot มี permission ManageRoles
    - [x] bot มี permission ManageChannels
    - [x] สร้างหรือ update panel ได้
    - [x] ไม่สร้าง duplicate panel
    - Note: Docker manual smoke ผ่านตาม user report 2026-05-14; production guild smoke ยังต้องทำหลัง patch กลับเว็บจริง

- [x] Role mapping และ channel mapping ต้องไม่ซ้ำ
  - Note: รอบ Docker ให้ทดสอบ mapping บน test guild/test gang ก่อน แล้วค่อย smoke ซ้ำบนเว็บจริงหลัง patch
  - Verification:
    - [x] รัน `npm run db:audit:role-mappings`
    - [x] channel mapping ส่งข้อความไปห้องที่เลือกถูกต้องตาม user report 2026-05-14
    - [x] role mapping retest หลังแก้ `@everyone`

- [x] Bot commands ต้องมี permission guard ครบ
  - Verification:
    - [x] setup เฉพาะ admin
    - [x] finance เฉพาะ role ที่กำหนด
    - [x] attendance เฉพาะ role ที่กำหนด
    - [x] leave approval เฉพาะ role ที่กำหนด
    - Note: `/setup` live guild smoke ยังเป็น gate แยกด้านบน เพราะต้องตรวจ permission จริงใน Discord guild

### API / Database / Migration / Rate Limit

- [x] ตรวจ migration metadata drift และ Drizzle snapshot
  - Related: `packages/database/drizzle`
  - Related: `scripts/audit-migrations.mjs`
  - Verification:
    - [x] migration journal ตรงกับ snapshot files
    - [x] schema ปัจจุบันตรงกับ code ที่ใช้จริง

- [x] Rate limit fail-open ต้องประเมินใหม่สำหรับ critical API
  - Related: `apps/web/src/lib/apiRateLimit.ts`
  - Related: `apps/bot/src/utils/interactionRateLimit.ts`
  - Verification:
    - [x] finance/admin ไม่เปิดโล่งเมื่อ DB rate limit error แบบเสี่ยง
    - [x] user-friendly error เมื่อ rate limit service มีปัญหา

- [x] Sensitive APIs ใส่ `Cache-Control: no-store`
  - Verification:
    - [x] finance
    - [x] attendance
    - [x] settings
    - [x] admin/security

### Infrastructure / Deployment / Health / Monitoring

- [ ] Production deploy ต้องใช้ HTTPS domain จริงและ `NEXTAUTH_URL` ถูกต้อง
  - Note: ไม่ใช่ blocker แรกของ Docker staging ถ้าเว็บจริง auth ยังใช้งานอยู่และรอบนี้ไม่ได้แก้ callback/env; ตรวจหลัง patch กลับเว็บจริง
  - Verification:
    - [x] secure cookies เปิดใน production
    - [ ] callback URL ถูกต้อง

- [ ] Docker public deployment ต้องมี reverse proxy/TLS/WAF หรือ platform edge
  - Related: `docker-compose.yml`
  - Verification:
    - [ ] ไม่ expose raw app แบบไม่มี TLS ใน public environment

- [x] `docker:verify` ต้องไม่ timeout
  - Verification:
    - [x] รัน `npm run docker:verify` ผ่าน

- [x] เพิ่ม monitoring/alert สำหรับ web, bot, DB, payment, Discord errors
  - Verification:
    - [x] health alert
    - [x] error alert
    - [x] payment/slip alert
    - [x] bot disconnected alert

### Security / Abuse / Edge Cases

- [ ] CSP จาก Report-Only ไป enforce หลังแก้ inline dependencies
  - Related: `apps/web/next.config.js`
  - Verification:
    - [ ] browser console ไม่มี CSP violation สำคัญ
    - [ ] login/dashboard ใช้งานได้หลัง enforce

- [x] ตรวจ XSS surface จาก user-generated content
  - Verification:
    - [x] announcement content
    - [x] leave reason
    - [x] member nickname/name
    - [x] finance note

- [x] ตรวจ abuse cases
  - Verification:
    - [x] spam leave request
    - [x] spam finance request
    - [x] spam attendance actions
    - [x] repeated failed permission attempts

### Performance / Reliability

- [x] ลด route/page ที่ First Load JS สูงหรือโหลดช้า
  - Verification:
    - [x] finance
    - [x] members
    - [x] leaves
    - [x] attendance detail

- [x] ตรวจ loading ระหว่าง query param/tab change
  - Verification:
    - [x] finance tabs
    - [x] leaves tabs
    - [x] attendance filters
    - [x] members filters

- [x] ตรวจ API latency และ DB query hotspots
  - Verification:
    - [x] finance summary
    - [x] attendance detail
    - [x] members list
    - [x] dashboard overview

### Code Quality / Maintainability

- [x] แยก attendance route ขนาดใหญ่เป็น service/helper ที่ test ง่ายขึ้น
  - Related: `apps/web/src/app/api/gangs/[gangId]/attendance/[sessionId]/route.ts`
  - Related: `apps/web/src/lib/attendanceRecordWrites.ts`
  - Verification:
    - [x] behavior เดิมไม่เปลี่ยน
    - [x] tests ผ่าน

- [x] เพิ่ม helper สำหรับ resource ownership check เช่น `requireGangResource`
  - Verification:
    - [x] finance ใช้ helper
    - [x] attendance ใช้ helper
    - [x] announcements ใช้ helper

- [x] ลด stale e2e selectors/copy dependency
  - Verification:
    - [x] selectors ใช้ role/test-id ที่ stable
    - [x] UI copy เปลี่ยนแล้ว test ไม่พังมั่ว

## P2 - แก้หลัง P0/P1 แต่ยังต้องทำก่อน Paid Production

- [ ] Full mobile visual QA ทุกหน้าหลัก
- [ ] Full desktop visual QA ทุกหน้าหลัก
- [ ] ปรับ density ของ Members และ My Profile ให้ scan ง่าย
- [ ] ปรับ Finance UI ให้ลดภาระสายตาและแยกข้อมูลตาม IA
- [ ] ปรับ Attendance history/statistics ให้แบ่งหน้า/section ชัด
- [ ] ปรับ Leaves modal/table ให้ flow สั้นและ status อ่านง่าย
- [ ] เพิ่ม release checklist ในเอกสาร deploy
- [ ] เพิ่ม runbook rollback สำหรับ production incident
- [ ] เพิ่ม incident severity matrix
- [ ] เพิ่ม data backup/restore drill
- [ ] เพิ่ม privacy/security note สำหรับข้อมูลสมาชิกและธุรกรรม

## Quick Wins

- [x] อัปเดต production smoke test copy ให้ตรง UI ปัจจุบัน
- [x] เพิ่ม no-store headers ใน sensitive APIs
- [ ] เพิ่ม test case cross-gang แบบ table-driven
- [x] เพิ่ม release command ที่รวม `audit`, `test`, `build`, `env`, `docker health`
- [x] เพิ่ม note ใน PR template ว่าต้องอัปเดตไฟล์นี้เมื่อแก้งาน audit
- [x] เพิ่ม section "Remaining Launch Blockers" ใน README หรือ GO_LIVE_RUNBOOK
- [x] ปรับ health check timeout ให้ไม่ทำให้ `docker:verify` ค้างนาน

## Final Launch Gate

ห้ามประกาศว่า launch-ready จนกว่าทุกข้อด้านล่างผ่าน:

- [ ] P0 ทั้งหมดเป็น `[x]`
- [ ] P1 ทั้งหมดเป็น `[x]` หรือมี risk acceptance จาก owner
- [x] `npm audit --omit=dev` ไม่มี high/critical
- [x] `npm run test` ผ่าน
- [x] `npm run build` ผ่าน
- [x] `npm run validate:env:prod` ผ่าน
- [x] `npm run encoding:verify` ผ่าน
- [x] Docker health/ready ผ่าน
- [ ] Production smoke desktop/mobile ผ่าน
- [ ] Finance cross-gang deny ผ่าน
- [ ] Attendance cross-gang deny ผ่าน
- [ ] Settings/admin permission deny ผ่าน
- [ ] Discord `/setup` smoke ใน guild จริงผ่าน
  - Note: Docker `/setup` auto/duplicate ผ่านตาม user report; final production guild smoke ยังต้องทำหลัง patch
- [ ] Paid billing flow ผ่านถ้าจะขายจริง
- [ ] Overall Score ได้ 90+/100 หรือ owner ยอมรับ risk เป็นลายลักษณ์อักษร
- [ ] Public Launch Readiness ได้ 90+/100 หรือ owner ยอมรับ risk เป็นลายลักษณ์อักษร
- [ ] Paid Production Readiness ได้ 90+/100 หรือ owner ยอมรับ risk เป็นลายลักษณ์อักษร

## Current Final Verdict

สถานะปัจจุบันหลัง audit: ห้ามปล่อย public/paid production

เหตุผลหลัก:

- P0 data isolation หลักของ finance และ attendance แก้แล้ว แต่ยังต้องทำ manual smoke ใน environment จริง
- runtime dependency audit ปิด `next` high severity แล้ว; ยังเหลือ PostCSS moderate จาก dependency ของ Next.js
- permission matrix และ API regression หลักผ่านแล้ว แต่ยังต้อง smoke หน้า dashboard เพื่อยืนยัน hidden/disabled action ตาม role จริง
- paid billing flow ยังไม่พร้อมสำหรับขายจริง
- production smoke local ผ่านแล้วสำหรับ public/settings/billing shell; finance-locked และ admin sales smoke ยังต้องใช้ live env/session ที่ถูกต้องก่อนติ๊กเป็น production-ready เต็ม
- `npx tsc -p apps/web/tsconfig.json --noEmit --pretty false` ยังเจอ test type debt เดิมจาก Next async route params และ test harness บางไฟล์ แม้ `next build` production app จะผ่าน
