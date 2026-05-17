---
title: Current Production Status
created_at: 2026-05-17
owner: Codex QA
status: active-source-of-truth
---

# Current Production Status

เอกสารนี้คือ source of truth ล่าสุดสำหรับคำถามว่า "เหลืออะไรจริงก่อนเข้า Product/UX polish"
ไฟล์ checklist ยาวเดิมเก็บไว้เป็น audit history เท่านั้น

## Snapshot

| Area | Status | Evidence | Owner |
|---|---|---|---|
| Code / CI | PASS | Release Gate passed on commit `fbc1f37` | Codex |
| Dependency audit | PASS | `npm run audit:dependencies` passed, 0 vulnerabilities | Codex |
| Full local regression | PASS | `npm test`, `npm run build`, env validation, encoding verification passed | Codex |
| Web production health | PASS | `https://gang-manager.vercel.app/api/health` passed through `npm run monitor:production` | Codex |
| Bot production health | PASS | `https://gang-manager-bot.onrender.com/health` and `/ready` passed | Codex |
| Security headers | PASS | `npm run security:headers -- --url https://gang-manager.vercel.app` passed | Codex |
| Web runtime alert test endpoint | PASS / READY | unauthenticated `POST /api/ops/alert-test` returns `401`, so the route is deployed and protected | Codex |
| Bot runtime alert test endpoint | NEEDS RUNTIME CHECK | unauthenticated `POST /alert-test` returned `404`; expected `401` when latest code and alert token/env are active | User/Render |
| Live payment provider | NEEDS REAL LIVE TEST | code path hardened; real PromptPay/SlipOK money flow still needs live provider smoke | User + Codex |
| Product/UX polish | NEXT PHASE | Modern Discord-native SaaS Operations Dashboard redesign/polish | Codex |

## What Actually Remains

No P0/P1 code blocker remains from local tests, CI, production health, dependency audit, or security header checks.

Before declaring paid production fully ready, only these non-polish gates remain:

- Bot runtime alert endpoint: confirm Render is running commit `fbc1f37` or newer and has `ALERT_WEBHOOK_URL` or `ALERT_TEST_TOKEN`.
- Live payment smoke: test one real PromptPay/SlipOK payment path and confirm failed/expired/invalid slip behavior is correct in production.
- Browser spot check after the latest deploy: Discord OAuth, dashboard entry, billing/payment page, and permission-denied state.

Everything else can move into the Product/UX polish phase.

## Bot Alert Endpoint Check

Current live result:

```text
POST https://gang-manager-bot.onrender.com/alert-test
without token -> 404
```

Expected result after Render deploy/env is correct:

```text
POST https://gang-manager-bot.onrender.com/alert-test
without token -> 401 Unauthorized
with token -> 200 and Discord alert "BOT ERROR: manual.alert_test"
```

Fix checklist:

- [ ] In Render, confirm the bot service deployed commit `fbc1f37` or newer.
- [ ] In Render, confirm `ALERT_WEBHOOK_URL` is present, or set `ALERT_TEST_TOKEN` to a random 32+ character secret.
- [ ] Restart/redeploy the Render bot service.
- [ ] Re-run unauthenticated `POST /alert-test`; it should return `401`.
- [ ] Re-run authenticated `POST /alert-test`; it should return `200` and send the bot alert to Discord.

PowerShell test command:

```powershell
$env:BOT_ALERT_TOKEN="<Render ALERT_TEST_TOKEN or Render ALERT_WEBHOOK_URL>"
Invoke-RestMethod `
  -Uri "https://gang-manager-bot.onrender.com/alert-test" `
  -Method Post `
  -Headers @{ Authorization = "Bearer $env:BOT_ALERT_TOKEN" }
```

## Web Alert Endpoint Check

Current live result:

```text
POST https://gang-manager.vercel.app/api/ops/alert-test
without token -> 401 Unauthorized
```

This means the route is deployed and protected.

Authenticated test:

```powershell
$env:WEB_ALERT_TOKEN="<Vercel ALERT_TEST_TOKEN or Vercel ALERT_WEBHOOK_URL>"
Invoke-RestMethod `
  -Uri "https://gang-manager.vercel.app/api/ops/alert-test" `
  -Method Post `
  -Headers @{ Authorization = "Bearer $env:WEB_ALERT_TOKEN" }
```

Expected Discord alert: `WEB ERROR: manual.alert_test`.

## Current Scores

| Metric | Score | Note |
|---|---:|---|
| Overall Operational Readiness | 92/100 | CI, local regression, health, headers, dependency audit pass |
| Soft Launch Readiness | 94/100 | Safe enough for controlled users after bot alert endpoint is confirmed |
| Public Launch Readiness | 90/100 | Requires final production browser spot check |
| Paid Production Readiness | 88/100 | Requires real payment provider smoke |

## Next Phase

Next work should be Product/UX polish:

- Modern Discord-native SaaS Operations Dashboard direction
- Dashboard density and visual hierarchy
- Finance IA simplification
- Members/Profile density
- Attendance history/statistics split
- Leave UX polish
- Bot user-facing copy polish
