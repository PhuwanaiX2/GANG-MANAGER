# Web Rework Page Plan

Last updated: 2026-05-08

Goal: rework the user-facing web app page by page so users know what to press, why they are on each page, and what the next safe action is. This is not a cosmetic redesign pass.

## Core Principle

Each page must answer three questions within the first screen:

- What is this page for?
- What should I do next?
- What needs attention right now?

If a page has more than two unrelated jobs, split it or move secondary jobs behind a clearer hub.

## Navigation IA

Status: active.

Groups:

- Command: overview, announcements, analytics.
- People: my profile, members, member detail.
- Attendance: attendance rounds, leaves/late requests.
- Finance: gang money, transactions, debtor review, pending finance approvals.
- Billing: system plan, PromptPay payment, slip upload, payment history, license fallback.
- Setup: gang profile, roles, channels, advanced/server transfer.

Important separation:

- Finance is for managing gang money.
- Billing is for paying Gang Manager / plan renewal.

They must not be grouped as the same mental job.

## Page-by-Page Rework Order

### 1. Shell / Sidebar / Navigation

Objective:

- Separate user jobs into clear groups.
- Make mobile navigation match desktop.
- Remove confusing or mojibake labels.
- Keep billing outside settings and outside gang finance.

Acceptance:

- Finance and Billing are different groups.
- Sidebar labels are readable Thai.
- Leave badge still works.
- Owner-only Billing remains hidden from non-owner users.

Status:

- First pass complete on 2026-05-08.
- Finance now appears as "การเงินแก๊ง".
- Billing now appears as "แพลนระบบ".
- Attendance and leave have their own group.

### 2. Dashboard Overview

Objective:

- Turn the overview into a command center, not a data dump.
- Show the next action: setup, attendance, finance review, member follow-up.
- Reduce duplicated tables.

Acceptance:

- One primary next action.
- Recent activity is summarized, not overwhelming.
- No debug/readiness wording.

Status:

- First pass complete on 2026-05-08.
- Reworked into command center with primary action, attention queue, quick actions, stats, and compact activity cards.

### 3. Announcements

Objective:

- Make create/edit/delete/toggle actions obvious.
- Fix light/dark button contrast.
- Use compact table or clear card stack depending on screen size.

Acceptance:

- Add announcement button is readable in both themes.
- Active/expired state is easy to scan.
- Empty state explains first action.

Status:

- First pass complete on 2026-05-08.
- Create action now uses an explicit high-contrast button instead of relying on inherited button styling.
- Empty state includes the first-action button.

### 4. Members / My Profile / Member Detail

Objective:

- Use one consistent member ledger model.
- Members list is roster management.
- Member detail and My Profile show attendance, leave, finance, status, and role in the same structure.

Acceptance:

- Member table is readable on desktop and cards on mobile.
- Profile pages are not visually unrelated.
- Admin actions are separated from member history.

Status:

- First pass complete on 2026-05-08.
- Members page header now explains the user job and surfaces active members, debtors, and credit members before the roster table.
- Member detail and My Profile now share a clearer activity ledger model for attendance, leave, and finance history.

### 5. Attendance

Objective:

- Make active rounds, scheduled rounds, and history distinct.
- Exact-minute time input stays available.
- Create round form is shorter and easier to scan.

Acceptance:

- Create round has one primary submit action.
- Time fields accept exact minutes.
- Leave information does not clutter attendance list.

Status:

- First pass started on 2026-05-08.
- Attendance header now has a clear primary action for creating a round and a direct jump to active rounds.
- Existing time field supports exact-minute input such as 12:31.

### 6. Leaves / Late Requests

Objective:

- Split member submission from approver inbox visually.
- Put pending approvals first for users who can approve.
- Keep request form short.

Acceptance:

- Approver can approve/reject without scrolling past the member form.
- Member can submit leave/late without reading admin-only UI.
- Exact-minute time input is available.

Status:

- First pass started on 2026-05-08.
- Header now routes reviewers directly to the approval queue and members directly to the request form.
- Existing layout already keeps reviewer queue before the personal form for owners/admins.

### 7. Finance

Objective:

- Rework finance as a gang-money command center.
- Separate active decisions from deep history.
- Move debtors and pending reviews into clear sections or routes.

Acceptance:

- Add transaction and create gang fee are obvious.
- Pending review and debtor summary are not buried.
- Long explanations are InfoTip/collapsible, not page body.
- Billing/plan payment does not appear as the same job.

Status:

- First pass complete on 2026-05-08.
- Header now says "การเงินแก๊ง" and exposes direct work links for pending reviews, debtors, history, and summary.
- Overview sections have anchors for pending finance review and debtor review.

### 8. Analytics

Objective:

- Focus on FiveM/Discord operational insight.
- Avoid generic charts that do not answer a real question.

Acceptance:

- Shows attendance reliability, finance risk, member activity, and debt pressure.
- Empty states explain what data is needed.

Status:

- First pass complete on 2026-05-08.
- Header now frames the page as operational insight for gang risk, attendance discipline, member follow-up, and trends.
- KPI, charts, and risk sections now have direct anchors from the first screen.

### 9. Settings

Objective:

- Turn settings into a setup hub.
- Split profile, roles, channels, and advanced/danger workflows.
- Keep Billing out of Settings except as a link.

Acceptance:

- Role/channel setup is not cramped.
- Owner is explained as derived from Discord server owner where possible.
- Server transfer clearly explains what is reset.

Status:

- First pass complete on 2026-05-08.
- Settings tabs are now job cards with descriptions instead of a cramped pill bar.
- Billing remains a link-out job, not part of the settings workflow.

### 10. Billing

Objective:

- Make payment flow calm and step-by-step.
- Keep QR, slip upload, status, and history distinct.
- Keep License Key as fallback only.

Acceptance:

- User can tell whether to pay, upload, wait, retry, or contact support.
- No raw QR payload input.
- Rejected payment closes and explains retry.

Status:

- First pass complete on 2026-05-08.
- Finance and billing are now separate navigation jobs.
- Plan comparison is collapsed behind a disclosure to keep the payment flow calmer.
- Slip submission copy now tells users whether they are waiting for review or automatic verification.

## Execution Rule

Work one page group at a time:

1. Inspect current UI/code.
2. Define the user job and primary action.
3. Patch the smallest safe slice.
4. Run build/test relevant to the slice.
5. Move to the next page only after the shell still works.
