# Production Payment, Monitoring, and Incident Runbook

This is the current source of truth for the live-payment hardening pass.

## Current Production State

- Web: `https://gang-manager.vercel.app`
- Bot: `https://gang-manager-bot.onrender.com`
- Health command:

```bash
npm run monitor:production -- --web-url https://gang-manager.vercel.app --bot-url https://gang-manager-bot.onrender.com
```

Expected result: `status: ok` with `web health`, `bot health`, and `bot readiness`.

## Permission Deny Meaning

Permission deny means a user without the required role cannot read or mutate protected data.

Minimum checks:

- Non-admin cannot open `/admin/*` or call `/api/admin/*`.
- Non-owner cannot manage billing/payment requests.
- Non-owner/non-admin cannot mutate gang settings.
- Members from another gang cannot read or mutate finance, attendance, leave, member, or settings data for this gang.
- Discord interactions from the wrong guild/gang context cannot approve finance, attendance, or leave actions.

Expected outcome: `401`, `403`, `404`, or a clear forbidden UI state. There must be no data leak and no write side effect.

## Live Payment Rules

ENV is the outer kill switch:

- `ENABLE_PROMPTPAY_BILLING=false` means users cannot create real payment requests.
- `ENABLE_SLIPOK_AUTO_VERIFY=false` means slips go to manual review.

Admin feature flags are the inner operation switches:

- `promptpay_billing`: pause/resume live payment request creation from the web admin UI.
- `slipok_auto_verify`: pause/resume SlipOK auto verification from the web admin UI.

If ENV is off, the admin flag cannot force the feature on.

## SlipOK Decision Policy

Auto-approve only when SlipOK verifies the slip and the amount/reference rules pass.

Auto-reject when SlipOK says the slip is definitively invalid, including:

- QR payload missing or invalid.
- File/image is not a valid slip.
- QR is missing or unsupported.
- QR code expired or no real transaction exists.
- Duplicate slip.
- Amount mismatch.
- Receiver account mismatch.
- Missing transaction reference.

Manual review is only for operational ambiguity, such as:

- SlipOK credentials/config are unavailable.
- SlipOK/bank is delayed.
- SlipOK service/network is unavailable.
- SlipOK returns an invalid or unavailable response.

## Alert Webhook

Configure these on both web and bot runtimes when alerting is ready:

```text
ALERT_WEBHOOK_URL=<your alert receiver>
ALERT_WEBHOOK_TOKEN=<optional bearer token>
```

Send a real success test event:

```bash
npm run monitor:production -- --web-url https://gang-manager.vercel.app --bot-url https://gang-manager-bot.onrender.com --send-test-alert
```

If using a one-off webhook URL instead of env:

```bash
node scripts/monitor-production.mjs --web-url https://gang-manager.vercel.app --bot-url https://gang-manager-bot.onrender.com --alert-webhook-url https://example.com/webhook --send-test-alert
```

## Security Header Check

Automated check:

```bash
npm run security:headers -- --url https://gang-manager.vercel.app
```

Browser check:

1. Open production in a clean browser profile.
2. Open DevTools Console and Network.
3. Visit landing, login, dashboard, attendance, finance, billing, settings.
4. Confirm no critical CSP errors, no blank pages, and no blocked Discord/Cloudinary images.
5. Confirm response headers include `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, and CSP or CSP Report-Only.

CSP is currently allowed to be Report-Only until inline script/style strategy is fully hardened. Do not force enforced CSP if login/dashboard breaks.

## Incident Rollback

Immediate containment:

1. Pause `promptpay_billing` in Admin > Feature Flags.
2. Pause `slipok_auto_verify` if payment verification is suspected.
3. If admin UI is unavailable, set `ENABLE_PROMPTPAY_BILLING=false` in Vercel and redeploy.
4. If bot actions are unsafe, pause the Render bot service or rotate/remove the bot token temporarily.

Web rollback:

1. Open Vercel project deployments.
2. Promote the last known-good deployment, or redeploy the last known-good Git commit.
3. Run health and security header checks.

Bot rollback:

1. Open Render service deployments.
2. Roll back to the last known-good deploy, or redeploy the last known-good Git commit.
3. Run `/health` and `/ready`.
4. Test one low-risk Discord command in the real guild.

Database rollback:

- Do not run destructive rollback unless a backup/restore point is confirmed.
- Prefer forward-fix migrations.
- If payment data is affected, export the affected `subscription_payment_requests` and audit rows before any mutation.

Post-incident evidence:

- Incident start/end time.
- User-facing impact.
- Toggle/env changes made.
- Deployment or commit rolled back to.
- Health check output.
- Payment IDs affected.
- Follow-up fix PR/commit.
