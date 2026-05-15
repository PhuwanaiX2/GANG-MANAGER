# Full Regression Round 2 Report

วันที่ตรวจ: 2026-05-15  
Branch: `codex/website-production-redesign`  
Model ที่เหมาะกับรอบนี้: GPT-5.5 xhigh

## สรุปผล

Round 2 ผ่าน regression หลักของระบบแล้วในระดับ soft launch พร้อมใช้งานบน Docker local โดยมีข้อสังเกต production ที่ยังต้องตามก่อน public/paid launch:

- Automated tests: ผ่าน
- Production build: ผ่าน
- Docker build/recreate/health: ผ่าน
- Attendance manual + Discord self-check-in E2E: ผ่าน
- Production smoke ที่เปิด fixture แล้ว: ผ่าน
- Monitoring local probe: ผ่านหลังแก้ monitor ให้รองรับ bot `/health` ที่คืน `ready`
- Remaining risk: dependency audit ยังมี moderate warnings และบาง E2E case ต้องใช้ fixture admin/free-tier เฉพาะ

## Regression Checklist

| Check | Result | Evidence |
| --- | --- | --- |
| Encoding guard | PASS | `npm test` -> encoding guard passed |
| Web unit/integration | PASS | 49 files, 335 tests passed |
| Bot unit/integration | PASS | 19 files, 90 tests passed |
| Workspace build | PASS | `npm run build` passed, Next build compiled 18 static pages |
| Migration metadata audit | PASS | 16 journal entries, 16 SQL files, 16 snapshots |
| Production env contract | PASS | Turso deployment contract passed, PromptPay billing disabled |
| Security closeout | PASS | Local env contract passed |
| Release readiness | PASS with warning | No high/critical runtime vulnerabilities; 2 moderate runtime warnings remain |
| Docker readiness | PASS | Docker image build, force recreate, web health, bot health, bot ready passed |
| Web health | PASS | `GET /api/health` -> `status: ok`, `database: up` |
| Bot health | PASS | `GET /health` -> `status: ready`, shard count 1 |
| Bot readiness | PASS | `GET /ready` -> `status: ready`, shard count 1 |
| Public E2E smoke | PASS | Landing, legal/support, safe 404, health passed |
| Authenticated production smoke | PASS | Settings role/channel panels and billing PromptPay pending surface passed |
| Attendance manual E2E | PASS | Create, mark leave, mark unchecked present, close, redirect history passed |
| Attendance self-check-in E2E | PASS | Create, start, update/reset/leave, close, history passed |
| Attendance mobile manual E2E | PASS | 390x844 mobile viewport manual flow passed |
| Finance locked E2E | SKIPPED | Requires `E2E_FINANCE_LOCKED_GANG_ID` fixture |
| Admin sales E2E | SKIPPED | Requires `E2E_EXPECT_ADMIN=1` and admin storage state |
| Git diff whitespace | PASS with line-ending warnings | No whitespace errors; CRLF/LF warnings only |

## Findings

### P1 - Monitoring health expectation mismatch

- Status: FIXED
- Impact: Production monitor would falsely fail bot health even when bot was healthy.
- Evidence: `monitor-production.mjs` expected bot `/health` status `ok`, but runtime returns `ready`.
- Fix: monitor now accepts bot health `ok` or `ready`.
- Verification: `npm run monitor:production -- --web-url http://localhost:3000 --bot-url http://localhost:8080` passed.

### P1 - E2E secret mismatch can create false auth failures

- Status: FIXED
- Impact: Playwright authenticated smoke can redirect to landing if `apps/web/.env.local` uses a different `NEXTAUTH_SECRET` from Docker root `.env`.
- Reproduction: run production/attendance E2E without overriding `E2E_NEXTAUTH_SECRET`; authenticated routes can fail.
- Fix: Playwright config, global setup, and Playwright dev server no longer override root/Docker `NEXTAUTH_SECRET` from `apps/web/.env.local`; project env can still override `NEXTAUTH_URL`.
- Verification: production smoke, attendance manual, attendance manual mobile, and attendance Discord self-check-in all pass without `E2E_NEXTAUTH_SECRET` override.

### P2 - Moderate dependency warnings remain

- Status: OPEN
- Impact: Not a launch blocker by current gate because no high/critical runtime vulnerabilities, but should be monitored before paid production.
- Evidence: release readiness reports 2 moderate runtime warnings; Docker `npm ci` audit reports 9 moderate in full dependency tree.
- Recommended fix: track upstream Next/PostCSS remediation and upgrade safely when compatible.

## Round 2 Scores

| System | UX/UI | Security | Correctness | Usability | Reliability | Maintainability | Overall |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Authentication / Login / Session / Permission | 8.5 | 8.5 | 8.5 | 8.0 | 8.0 | 8.0 | 8.3 |
| Dashboard / UX Flow / Settings | 8.5 | 8.5 | 8.5 | 8.5 | 8.0 | 8.0 | 8.3 |
| Attendance / Check-in / Activity | 9.0 | 8.5 | 9.0 | 9.0 | 8.8 | 8.5 | 8.9 |
| Finance / กองกลาง / Slip / Transaction | 8.0 | 8.5 | 8.5 | 8.0 | 8.0 | 8.0 | 8.2 |
| Discord Bot / Setup / Role Mapping / Commands | 8.0 | 8.5 | 8.5 | 8.0 | 8.5 | 8.0 | 8.3 |
| API / Database / Migration / Rate Limit | 8.0 | 8.8 | 9.0 | 8.0 | 8.8 | 8.5 | 8.5 |
| Infrastructure / Deployment / Health / Monitoring | 8.0 | 8.0 | 8.5 | 8.0 | 8.5 | 8.0 | 8.2 |
| Security / Abuse / Edge Cases | 8.0 | 8.5 | 8.0 | 8.0 | 8.0 | 8.0 | 8.1 |
| Performance / Reliability | 8.0 | 8.0 | 8.0 | 8.0 | 8.0 | 8.0 | 8.0 |
| Code Quality / Maintainability | 8.0 | 8.0 | 8.5 | 8.0 | 8.0 | 8.2 | 8.1 |

## Readiness

- Overall Score: 86/100
- Soft Launch Readiness: 92/100
- Public Launch Readiness: 86/100
- Paid Production Readiness: 81/100

## Verdict

Soft launch ได้  
Public launch ยังควรปิด dependency warnings และเพิ่ม admin/free-tier E2E fixtures ก่อน  
Paid production ยังไม่ควรประกาศว่าพร้อม 100% จนกว่า admin/free-tier E2E fixtures และ dependency follow-up จะครบ
