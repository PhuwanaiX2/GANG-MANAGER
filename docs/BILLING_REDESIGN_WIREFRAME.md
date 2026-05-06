# Billing Redesign Wireframe

Last updated: 2026-05-07

Status: implemented in code, with Figma draft available for future visual refinement.

Figma draft:

- https://www.figma.com/design/GU3pZuBKNnu8s7S2OV6QWp

## Purpose

Fix the plan/payment page so normal users always know:

- What plan they are on.
- Whether they need to create a payment request.
- How much to transfer.
- Where to upload proof.
- Whether the slip is waiting, approved, rejected, or needs admin review.
- How to retry safely without seeing developer/provider wording.

This is an information-architecture redesign, not only a visual polish pass.

## Product Decision

Billing is its own page:

- `/dashboard/[gangId]/billing`

Settings links to Billing. Settings should not contain QR payment, slip upload, or license activation as the normal payment path.

License code activation is a fallback/manual recovery path. It stays collapsed under Billing and should not compete with the PromptPay flow.

## Navigation

Sidebar label:

- `แพลน`

Alternative if the sidebar needs more clarity:

- `แพลน / ชำระเงิน`

## Page Layout

Desktop layout:

- Top grid has two cards only: current plan status and create/continue payment.
- Active payment request gets its own large section.
- Payment history is below the active request.
- License Key is collapsed at the bottom as a fallback path.

Mobile layout:

- Single column.
- Primary actions must be at least 48px high.
- QR, receiver, and slip upload must not fight for the same small row.

## Payment Flow

1. User chooses 30 days or 365 days.
2. User creates a payment request.
3. System shows exact amount, receiver, QR, and reference.
4. User uploads a slip image or provides a public image URL.
5. If SlipOK auto verification passes, Premium activates.
6. If SlipOK is unavailable, the request becomes reviewable by admin.
7. If SlipOK rejects for amount/account/duplicate, the request closes and the user must create a new one.

## UX Rules

- Do not ask users to paste QR data from a slip.
- Do not show `manualReviewRequired`, provider labels, or internal verification wording in customer UI.
- Rejected slips should say the old request is closed and the user should create a new request.
- In-progress requests should clearly say "ส่งสลิปแล้ว ไม่ต้องส่งซ้ำ".
- Copy buttons are allowed only for receiver identifier and request reference.
- Stripe must not appear on customer-facing billing screens.

## Implementation Notes

Implemented files:

- `apps/web/src/app/dashboard/[gangId]/billing/page.tsx`
- `apps/web/src/app/dashboard/[gangId]/settings/SubscriptionClient.tsx`
- `apps/web/src/app/api/gangs/[gangId]/subscription/payment-requests/[paymentRequestId]/slip/route.ts`
- `apps/web/src/lib/billingPlans.ts`
- `apps/web/src/lib/paymentReadiness.ts`

Test anchors kept for E2E:

- `subscription-settings-panel`
- `subscription-payment-status-card`
- `subscription-slip-submit`
- `subscription-payment-history`
