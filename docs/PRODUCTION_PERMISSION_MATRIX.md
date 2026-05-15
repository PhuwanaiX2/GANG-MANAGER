---
title: Production Permission Matrix
created_at: 2026-05-14
owner: Codex QA
status: active
---

# Production Permission Matrix

This matrix is the launch-time source of truth for protected surfaces. Update it whenever a route, server action, bot command, or dashboard page changes permission behavior.

## Role Model

| Role | Meaning | Effective Access |
|---|---|---|
| System Admin | Discord IDs in `ADMIN_DISCORD_IDS` | Platform admin pages and platform admin APIs only |
| OWNER | Gang owner | Full gang control, billing, settings, finance, attendance, member/admin actions |
| ADMIN | Gang administrator | Member ops, announcements, leave review, attendance management |
| TREASURER | Finance officer | Finance read/write/review and finance-related member views |
| ATTENDANCE_OFFICER | Attendance officer | Attendance session create/update/close/cancel and attendance reads |
| MEMBER | Approved active gang member | Dashboard read access and own/member-safe reads |

`requireGangAccess` inheritance in app code:

| Minimum Role | Allowed Roles |
|---|---|
| OWNER | OWNER |
| ADMIN | OWNER, ADMIN |
| TREASURER | OWNER, TREASURER |
| ATTENDANCE_OFFICER | OWNER, ADMIN, ATTENDANCE_OFFICER |
| MEMBER | OWNER, ADMIN, TREASURER, ATTENDANCE_OFFICER, MEMBER |

## Web Dashboard Pages

| Surface | Required Role | Source | Evidence |
|---|---|---|---|
| `/dashboard/[gangId]` | MEMBER | `apps/web/src/app/dashboard/[gangId]/layout.tsx` | Layout calls `requireGangAccess({ gangId })` |
| `/dashboard/[gangId]/analytics` | OWNER or ADMIN | `apps/web/src/app/dashboard/[gangId]/analytics/page.tsx` | Page permission flags |
| `/dashboard/[gangId]/announcements` | OWNER or ADMIN | `apps/web/src/app/dashboard/[gangId]/announcements/page.tsx` | Page permission flags + API ADMIN |
| `/dashboard/[gangId]/attendance` | MEMBER read, OWNER/ADMIN/ATTENDANCE_OFFICER manage | `apps/web/src/app/dashboard/[gangId]/attendance/page.tsx` | API tests cover read/manage |
| `/dashboard/[gangId]/attendance/create` | OWNER/ADMIN/ATTENDANCE_OFFICER | `apps/web/src/app/dashboard/[gangId]/attendance/create/page.tsx` | Page permission flags |
| `/dashboard/[gangId]/attendance/[sessionId]` | MEMBER read, OWNER/ADMIN/ATTENDANCE_OFFICER manage | `apps/web/src/app/dashboard/[gangId]/attendance/[sessionId]/page.tsx` | API tests cover read/manage |
| `/dashboard/[gangId]/billing` | OWNER | `apps/web/src/app/dashboard/[gangId]/billing/page.tsx` | Billing page owner check + API OWNER |
| `/dashboard/[gangId]/finance` | OWNER or TREASURER | `apps/web/src/app/dashboard/[gangId]/finance/page.tsx` | Finance API TREASURER |
| `/dashboard/[gangId]/leaves` | MEMBER read/request, OWNER/ADMIN review | `apps/web/src/app/dashboard/[gangId]/leaves/page.tsx` | Leave API review ADMIN |
| `/dashboard/[gangId]/members` | MEMBER read, OWNER/ADMIN manage | `apps/web/src/app/dashboard/[gangId]/members/page.tsx` | Member API tests |
| `/dashboard/[gangId]/members/[memberId]` | MEMBER read within gang | `apps/web/src/app/dashboard/[gangId]/members/[memberId]` | Member detail API tests |
| `/dashboard/[gangId]/my-profile` | MEMBER own read | `apps/web/src/app/api/gangs/[gangId]/my-profile/route.ts` | Finance reporting tests |
| `/dashboard/[gangId]/settings` | OWNER edits, others read-limited UI | `apps/web/src/app/dashboard/[gangId]/settings/page.tsx` | Settings actions tests |

## Web API Routes

| Route | Method | Required Role | Source | Test Evidence |
|---|---:|---|---|---|
| `/api/gangs/[gangId]` | PUT | OWNER | `apps/web/src/app/api/gangs/[gangId]/route.ts` | `apps/web/src/tests/api/gang-settings.test.ts` |
| `/api/gangs/[gangId]/activate-license` | POST | OWNER | `apps/web/src/app/api/gangs/[gangId]/activate-license/route.ts` | `apps/web/src/tests/api/activate-license.test.ts` |
| `/api/gangs/[gangId]/announcements` | GET | MEMBER | `apps/web/src/app/api/gangs/[gangId]/announcements/route.ts` | `apps/web/src/tests/api/announcements.test.ts` |
| `/api/gangs/[gangId]/announcements` | POST | ADMIN | `apps/web/src/app/api/gangs/[gangId]/announcements/route.ts` | `apps/web/src/tests/api/announcements.test.ts` |
| `/api/gangs/[gangId]/attendance` | GET | MEMBER | `apps/web/src/app/api/gangs/[gangId]/attendance/route.ts` | `apps/web/src/tests/api/attendance.test.ts` |
| `/api/gangs/[gangId]/attendance` | POST | ATTENDANCE_OFFICER | `apps/web/src/app/api/gangs/[gangId]/attendance/route.ts` | `apps/web/src/tests/api/attendance.test.ts` |
| `/api/gangs/[gangId]/attendance/[sessionId]` | GET | MEMBER | `apps/web/src/app/api/gangs/[gangId]/attendance/[sessionId]/route.ts` | `apps/web/src/tests/api/attendance-session.test.ts` |
| `/api/gangs/[gangId]/attendance/[sessionId]` | PATCH/POST | ATTENDANCE_OFFICER | `apps/web/src/app/api/gangs/[gangId]/attendance/[sessionId]/route.ts` | `apps/web/src/tests/api/attendance-session.test.ts` |
| `/api/gangs/[gangId]/attendance/[sessionId]` | DELETE | OWNER | `apps/web/src/app/api/gangs/[gangId]/attendance/[sessionId]/route.ts` | `apps/web/src/tests/api/attendance-session.test.ts` |
| `/api/gangs/[gangId]/dissolve` | POST | OWNER | `apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts` | `apps/web/src/tests/api/dissolve.test.ts` |
| `/api/gangs/[gangId]/finance` | POST | TREASURER | `apps/web/src/app/api/gangs/[gangId]/finance/route.ts` | `apps/web/src/tests/api/finance.test.ts` |
| `/api/gangs/[gangId]/finance/[transactionId]` | PATCH | TREASURER | `apps/web/src/app/api/gangs/[gangId]/finance/[transactionId]/route.ts` | `apps/web/src/tests/api/finance-transaction-actions.test.ts` |
| `/api/gangs/[gangId]/finance/audit` | GET | TREASURER | `apps/web/src/app/api/gangs/[gangId]/finance/audit/route.ts` | `apps/web/src/tests/api/finance-reporting.test.ts` |
| `/api/gangs/[gangId]/finance/export` | GET | TREASURER | `apps/web/src/app/api/gangs/[gangId]/finance/export/route.ts` | `apps/web/src/tests/api/finance-reporting.test.ts` |
| `/api/gangs/[gangId]/finance/gang-fee` | POST | TREASURER | `apps/web/src/app/api/gangs/[gangId]/finance/gang-fee/route.ts` | `apps/web/src/tests/api/gang-fee.test.ts` |
| `/api/gangs/[gangId]/finance/gang-fee/settle` | POST | TREASURER | `apps/web/src/app/api/gangs/[gangId]/finance/gang-fee/settle/route.ts` | `apps/web/src/tests/api/gang-fee.test.ts` |
| `/api/gangs/[gangId]/finance/summary` | GET | TREASURER | `apps/web/src/app/api/gangs/[gangId]/finance/summary/route.ts` | `apps/web/src/tests/api/finance-reporting.test.ts` |
| `/api/gangs/[gangId]/leaves` | POST | MEMBER | `apps/web/src/app/api/gangs/[gangId]/leaves/route.ts` | `apps/web/src/tests/api/leaves-create.test.ts` |
| `/api/gangs/[gangId]/leaves/[requestId]` | PATCH | ADMIN | `apps/web/src/app/api/gangs/[gangId]/leaves/[requestId]/route.ts` | `apps/web/src/tests/api/leaves.test.ts` |
| `/api/gangs/[gangId]/members` | GET | TREASURER | `apps/web/src/app/api/gangs/[gangId]/members/route.ts` | `apps/web/src/tests/api/members.test.ts` |
| `/api/gangs/[gangId]/members` | POST | ADMIN | `apps/web/src/app/api/gangs/[gangId]/members/route.ts` | `apps/web/src/tests/api/members.test.ts` |
| `/api/gangs/[gangId]/members/[memberId]` | PATCH | ADMIN | `apps/web/src/app/api/gangs/[gangId]/members/[memberId]/route.ts` | `apps/web/src/tests/api/members.test.ts` |
| `/api/gangs/[gangId]/members/[memberId]` | DELETE | ADMIN | `apps/web/src/app/api/gangs/[gangId]/members/[memberId]/route.ts` | `apps/web/src/tests/api/members.test.ts` |
| `/api/gangs/[gangId]/members/[memberId]/role` | PATCH | ADMIN | `apps/web/src/app/api/gangs/[gangId]/members/[memberId]/role/route.ts` | `apps/web/src/tests/api/members.test.ts` |
| `/api/gangs/[gangId]/members/[memberId]/status` | PATCH | ADMIN | `apps/web/src/app/api/gangs/[gangId]/members/[memberId]/status/route.ts` | `apps/web/src/tests/api/members.test.ts` |
| `/api/gangs/[gangId]/server-transfer` | POST/PATCH | OWNER | `apps/web/src/app/api/gangs/[gangId]/server-transfer/route.ts` | `apps/web/src/tests/api/server-transfer.test.ts` |
| `/api/gangs/[gangId]/subscription/payment-requests` | GET/POST | OWNER | `apps/web/src/app/api/gangs/[gangId]/subscription/payment-requests/route.ts` | `apps/web/src/tests/api/subscription-payment-requests.test.ts` |
| `/api/gangs/[gangId]/subscription/payment-requests/[paymentRequestId]/slip` | POST | OWNER | `apps/web/src/app/api/gangs/[gangId]/subscription/payment-requests/[paymentRequestId]/slip/route.ts` | `apps/web/src/tests/api/subscription-payment-requests.test.ts` |
| `/api/discord/channels` | GET | OWNER by guild | `apps/web/src/app/api/discord/channels/route.ts` | `apps/web/src/tests/api/discord-metadata.test.ts` |
| `/api/discord/roles` | GET | OWNER by guild | `apps/web/src/app/api/discord/roles/route.ts` | `apps/web/src/tests/api/discord-metadata.test.ts` |

## Platform Admin Routes

| Route | Method | Required Role | Source | Test Evidence |
|---|---:|---|---|---|
| `/admin/*` | Page | System Admin | `apps/web/src/middleware.ts`, `apps/web/src/app/admin/layout.tsx` | `apps/web/src/tests/lib/adminAuth.test.ts` |
| `/api/admin/announcements` | GET/POST/PATCH/DELETE | System Admin | `apps/web/src/app/api/admin/announcements/route.ts` | `apps/web/src/tests/api/admin-announcements.test.ts` |
| `/api/admin/backup` | GET/POST | System Admin | `apps/web/src/app/api/admin/backup/route.ts` | `apps/web/src/tests/api/admin-backup.test.ts` |
| `/api/admin/feature-flags` | GET/PATCH | System Admin | `apps/web/src/app/api/admin/feature-flags/route.ts` | route-level admin guard |
| `/api/admin/gangs/[gangId]` | PATCH | System Admin | `apps/web/src/app/api/admin/gangs/[gangId]/route.ts` | `apps/web/src/tests/api/admin-gangs.test.ts` |
| `/api/admin/licenses` | GET/POST | System Admin | `apps/web/src/app/api/admin/licenses/route.ts` | `apps/web/src/tests/api/admin-licenses.test.ts` |
| `/api/admin/licenses/[id]` | PATCH/DELETE | System Admin | `apps/web/src/app/api/admin/licenses/[id]/route.ts` | `apps/web/src/tests/api/admin-licenses.test.ts` |
| `/api/admin/reports` | GET | System Admin | `apps/web/src/app/api/admin/reports/route.ts` | route-level admin guard |
| `/api/admin/subscription-payments` | GET/PATCH | System Admin | `apps/web/src/app/api/admin/subscription-payments/route.ts` | `apps/web/src/tests/api/admin-subscription-payments.test.ts` |

## Server Actions

| Action | Required Role | Source | Test Evidence |
|---|---|---|---|
| `updateGangSettings` | OWNER | `apps/web/src/app/actions/settings.ts` | `apps/web/src/tests/actions/settings-actions.test.ts` |
| `updateGangRoles` | OWNER | `apps/web/src/app/actions/settings.ts` | `apps/web/src/tests/actions/settings-actions.test.ts` |

## Discord Bot Commands And Interactions

| Surface | Required Role | Source | Test Evidence |
|---|---|---|---|
| `/setup` command | Discord admin + DB OWNER/ADMIN flow guard | `apps/bot/src/commands/settings.ts`, `apps/bot/src/features/setupFlow.ts` | setup smoke still requires live guild |
| Finance commands/buttons | TREASURER effective permission | `apps/bot/src/features/finance.ts`, `apps/bot/src/commands/financeOps.ts` | `apps/bot/tests/financeOps.test.ts`, `apps/bot/tests/financeButtonModalFlows.test.ts` |
| Attendance close/cancel/manual updates | OWNER/ADMIN/ATTENDANCE_OFFICER | `apps/bot/src/features/attendance.ts` | `apps/bot/tests/attendanceFlows.test.ts` |
| Leave approval/rejection | OWNER/ADMIN | `apps/bot/src/features/leave.ts` | needs expanded targeted test coverage |
| Registration approvals | OWNER/ADMIN | `apps/bot/src/features/approvals.ts` | `apps/bot/tests/attendanceFlows.test.ts` covers adjacent permission-safe flows |

## Known Gaps

- Live Discord `/setup` must still be tested in a real guild with ManageRoles and ManageChannels permissions.
- Leave approval bot tests should be expanded to explicitly cover OWNER/ADMIN allow and non-admin deny.
- Dashboard page-level UX permission states still need browser smoke for hidden/disabled actions.
- This matrix does not replace route-level tests; every permission behavior change must add or update tests.
