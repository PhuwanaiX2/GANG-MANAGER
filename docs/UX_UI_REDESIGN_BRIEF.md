# UX/UI Redesign Brief

Last updated: 2026-05-18

## Goal

Make Gang Manager feel production-ready, easy to press, easy to understand, and comfortable to use for a small FiveM/Discord gang team.

This redesign should not chase trendy screenshots. The product needs a practical operations-console feel: clear actions, low anxiety, strong status signals, and mobile-safe touch targets.

This is not only visual polish. The redesign includes information architecture, navigation, page splitting, action hierarchy, form grouping, empty states, and permission-aware states. If a current page contains too many unrelated jobs, it should be split into clearer pages instead of being decorated in place.

Primary scope is the user-facing web product: landing, dashboard, members, profiles, attendance, leaves, finance, announcements, setup/settings, billing, and all normal gang workflows. Admin pages are internal and can stay rougher for now unless they block payment review or production safety.

## Design Direction

Name: Discord Ops Console

Feeling:
- Calm control room, not flashy SaaS template.
- Buttons are obvious and thumb-friendly.
- Cards breathe more; dense data becomes tables or grouped summaries.
- Tooltips explain secondary details; pages do not shout every instruction at once.
- Dark and light themes both work, with accent colors as preference rather than core navigation.

Visual rules:
- Minimum touch target: 44px height for normal actions, 48px for primary actions.
- Primary buttons use one strong color per surface.
- Secondary buttons are quiet but still visible.
- Dangerous actions require red tone and confirmation.
- Disabled actions must look disabled and explain why.
- Important numbers use tabular spacing and bigger contrast.
- Long helper text becomes `InfoTip`, collapsible guide, or empty-state help.

## Theme Policy

Current behavior:
- Theme is a global user preference stored in `localStorage`.
- Landing page follows the same theme after logout.

Decision:
- Keep global theme persistence.
- Landing page must expose a compact theme toggle because the theme affects it.
- Dashboard keeps full theme/accent controls.

Why:
- This avoids surprise after logout.
- It keeps the site visually consistent between landing and dashboard.
- It prevents users from being stuck in a theme they changed while logged in.

## Button System

Primary action:
- Used once per page section.
- Examples: Add member, create attendance round, create payment request, submit slip, save settings.
- Shape: rounded, 48px height on forms, strong fill.

Secondary action:
- Used for safe alternatives.
- Examples: Export CSV, open dashboard, refresh, view details, copy ref.
- Shape: soft fill or outline, 44px height.

Destructive action:
- Used only for delete, dissolve, reject, irreversible transfer cleanup.
- Shape: red tone, confirmation required.

Ghost action:
- Used for table row actions or navigation.
- Must have visible hover/focus and icon plus text on desktop.

Disabled action:
- Must communicate reason near the button or via tooltip.
- Discord buttons should send a clear "no permission" message if Discord cannot truly disable per-user.

## Page Inventory

## Information Architecture Redesign

Current problem:
- Several user-facing pages mix unrelated jobs in one surface.
- Important actions compete with secondary explanation text.
- Navigation is currently flat, so daily tasks, setup tasks, finance tasks, and billing tasks feel equally important.
- Settings is overloaded with profile, roles, channels, billing, repair, transfer, and danger actions.
- Finance mixes overview, history, member credit, gang fee, pending review, and explanation in one dense surface.
- Member/Profile pages do not yet share one consistent member ledger model.
- Attendance and leave workflows are related but currently feel like separate islands.
- Announcements, dashboard overview, and analytics need a clearer command-center relationship.

Target navigation groups:
- `Command`: overview, announcements, analytics.
- `People`: members, member profiles, my profile.
- `Attendance`: attendance rounds, attendance detail, leave/late requests.
- `Finance`: finance overview, transactions, debtors, pending reviews, member credit.
- `Setup`: setup checklist, gang profile, roles, channels, bot repair.
- `Billing`: plan, payment request, slip upload, payment history, license fallback.
- `Internal Admin`: sales, security, features, data tools. This is not part of the first user-facing redesign pass.

Target route split:
- `/dashboard/[gangId]` remains a clean command overview.
- `/dashboard/[gangId]/members` becomes roster + quick filters only.
- `/dashboard/[gangId]/members/[memberId]` becomes the full member ledger.
- `/dashboard/[gangId]/my-profile` reuses the same member ledger layout in self mode.
- `/dashboard/[gangId]/attendance` becomes rounds list + active round summary.
- `/dashboard/[gangId]/attendance/create` remains create flow, but the form is simplified.
- `/dashboard/[gangId]/leaves` becomes request inbox + submit request split by role.
- `/dashboard/[gangId]/finance` becomes finance command center only.
- `/dashboard/[gangId]/finance/transactions` should hold full transaction history.
- `/dashboard/[gangId]/finance/debtors` should hold gang-fee debtors and unpaid member summary.
- `/dashboard/[gangId]/finance/review` should hold pending finance approval items.
- `/dashboard/[gangId]/settings` becomes setup hub, not a giant all-in-one page.
- `/dashboard/[gangId]/settings/profile` holds gang name/logo/basic identity.
- `/dashboard/[gangId]/settings/roles` holds role mapping.
- `/dashboard/[gangId]/settings/channels` holds channel mapping and repair.
- `/dashboard/[gangId]/billing` holds plan, PromptPay payment, slip status, payment history, license activation.
- `/dashboard/[gangId]/settings/advanced` holds server transfer and danger-zone operations.
- `/admin/*` remains internal. Only fix admin UX when payment review clarity or safety is directly affected.

Route split rule:
- Split a page when it has more than two primary jobs.
- Split a page when the user needs different mental modes: setup, daily operation, payment, danger action.
- Do not split tiny read-only pages unless it reduces confusion.
- Existing URLs may keep redirects or compatibility wrappers if needed.

Sidebar redesign:
- Keep the sidebar short.
- Use grouped nav sections rather than one long flat list.
- Hide rarely used setup/danger pages behind Settings/Setup hub.
- Show role-locked pages as hidden by default; if shown, explain why locked.
- Mobile navigation should show the same groups but with larger tap targets.
- Daily user tasks should appear before setup/billing.
- Billing should not be buried inside settings because buying/renewing is a distinct user job.
- My Profile should remain easy to reach because normal members use it more than settings.

Page shell pattern:
- Header: page title, one-line purpose, one primary action.
- Status strip: only critical metrics and current blockers.
- Main content: one job per section.
- Secondary help: `InfoTip`, collapsible guide, or empty state.
- Footer/danger actions: separated from normal actions.

### Landing Page

Main actions:
- Login with Discord.
- Add bot to server.
- Open support.
- Change theme.

Needs:
- Marketing copy should sound human and practical.
- Login button must clearly say Discord login.
- Add bot button should be distinct from login.
- Theme toggle should appear in nav because landing follows saved theme.

### Dashboard Overview

Main actions:
- Continue setup if incomplete.
- Open main modules.
- View current gang status.

Needs:
- Use fewer large blocks.
- Show only the next useful action.
- Avoid production/debug wording.

### Members

Main actions:
- Add member.
- Edit member.
- Change role.
- Change status.
- Open profile.

Needs:
- Table must be readable on desktop and card-like on mobile.
- Member row should show name, Discord, role, status, finance/attendance summary.
- My Profile and Member Detail should share the same profile pattern.

### Member Detail / My Profile

Main actions:
- Edit self/member where allowed.
- View attendance history.
- View finance balance/history.
- View leave history.

Needs:
- Same visual structure for both pages.
- Member detail should not feel emptier than My Profile.
- Owner/Admin view can show more action buttons.

### Attendance List

Main actions:
- Create attendance round.
- Open round.
- Export/review history.

Needs:
- Time input must allow exact minute, not only 5-minute steps.
- Hide leave data if it makes the attendance page noisy.
- Show active/past rounds clearly.

### Attendance Detail

Main actions:
- Check in/out.
- Mark member status.
- Close round.

Needs:
- If a user already checked in, make the state obvious.
- Admin approval/review controls must appear near pending items, not buried at the bottom.
- Discord-side buttons should be consistent with web permission states.

### Leaves

Main actions:
- Submit leave/late request.
- Approve/reject request.

Needs:
- Pending approvals should appear first for users who can approve.
- Time input must allow exact minute.
- Member-facing form should be short and friendly.

### Finance

Main actions:
- Add transaction.
- Create gang fee.
- Export CSV.
- Review pending requests.
- View debtors.

Needs:
- Important explanation should be InfoTip, not a wall of text.
- Gang fee with many members should collapse into a debtor summary.
- Finance summary page can later merge into Analytics.
- Discord finance outcomes should DM requester when approved/rejected.

### Analytics

Main actions:
- View operational health.
- Inspect attendance/finance/member trends.

Needs:
- More FiveM-specific insights later: active members, debt risk, attendance reliability, leave pressure, finance flow.

### Announcements

Main actions:
- Add announcement.
- Edit/delete/toggle active.

Needs:
- Add button must remain visible in both light/dark.
- Cards/table should avoid bright white-on-white or dark-on-dark clashes.

### Settings

Current issue:
- Too many unrelated jobs live in one page.
- Plan/payment competes with basic settings.
- Roles/channels are cramped and difficult to understand.
- Advanced/danger actions feel too close to normal setup.

New page structure:
- Settings Hub: shows setup completion, profile status, role/channel health, and links to subpages.
- Gang Profile: name, logo, public identity, save button.
- Roles: Owner explanation, Admin/Treasurer/Attendance/Member role mapping, permission preview.
- Channels: announcement/attendance/leave/finance/log channels, repair channel action.
- Advanced: server transfer, dissolve/reset flows, irreversible warnings.

Main actions:
- Save gang profile.
- Map roles/channels.
- Repair channels.
- Start server transfer.

Needs:
- Roles/channels tab is currently too cramped.
- Owner should be derived from Discord server owner, not manually mapped.
- Server transfer must clearly explain that it resets server-specific data.

### Billing

Current issue:
- Plan, payment request, QR, status, payment history, and license activation are too visually mixed.
- User cannot quickly tell whether they need to create a request, pay, upload slip, wait, retry, or contact support.
- Detailed wireframe source: `docs/BILLING_REDESIGN_WIREFRAME.md`.

New page structure:
- Current plan card: tier, member usage, expiry, next action.
- Upgrade cards: Free vs Premium, short feature comparison.
- Payment stepper: create request, pay exact amount, upload slip, verified/rejected/manual review.
- Active request panel: QR/ref/amount/status only.
- Payment history: recent payment requests.
- License activation: collapsed secondary section, not part of normal PromptPay flow.

Main actions:
- Create payment request.
- Copy PromptPay info.
- Upload slip by image file or image URL.
- Retry after rejected payment.
- Activate license code.

Needs:
- Customer UI must not ask users to paste raw QR data from a slip.
- Rejected SlipOK result must close the active failed submission and show a clear retry action.
- Manual review must show a waiting state, not developer/provider wording.
- No Stripe wording on customer-facing surfaces.

### Admin Sales

Main actions:
- Review payment.
- Approve/reject.
- Inspect SlipOK/manual status.

Needs:
- Must not show developer wording.
- Rejected SlipOK items should not look like manual pending review.
- Admin should see enough evidence to decide quickly.

### Admin Security / Features

Main actions:
- Check readiness.
- Review env/deploy risk.
- Confirm Stripe env removed.

Needs:
- Keep admin-only technical details here, not on customer-facing pages.
- Health diagnostics should be temporary and turned off after deploy verification.

## Redesign Execution Order

1. Freeze IA map and route split plan.
2. Create shared button/action/page-shell patterns.
3. Clean landing theme/control behavior and copy.
4. Redesign global dashboard navigation and page shell.
5. Redesign dashboard overview, announcements, and analytics as the Command group.
6. Redesign members + member detail + my profile as the People group.
7. Redesign attendance + leaves as the Attendance group.
8. Split Finance into overview/transactions/debtors/review where needed.
9. Split Settings into hub/profile/roles/channels/advanced.
10. Move Plan/PromptPay/license into Billing.
11. Defer admin redesign except admin sales clarity needed for payment review.

## Acceptance Checklist

- [x] Every page has one obvious primary action.
- [x] Light and dark themes have readable buttons.
- [x] Mobile has no hidden critical action in the checked attendance/dashboard routes.
- [x] No customer-facing page should expose obvious developer/debug/readiness wording in primary navigation and page shells.
- [x] Finance separates daily decisions from deep history at the current tab/summary level.
- [x] Sidebar groups match how a normal user works, not how the codebase is organized.
- [ ] Every destructive action has confirmation. Existing behavior must remain covered in full manual QA.
- [ ] Every disabled/locked action explains why across every edge case.
- [ ] Form fields are shorter, grouped, and use exact-minute time everywhere needed.
- [ ] Manual P0 test can be run without asking "what should I press next?"
- [ ] Settings no longer feels like one overloaded page at route-split level.
- [ ] Billing has a clear payment stepper and one obvious current state after the next billing UX pass.
- [ ] Admin pages are not allowed to delay user-facing redesign unless they block payment, safety, or deploy readiness.

## Implementation Log

| Date | Pass | Scope | Verification | QA Result |
|---|---|---|---|---|
| 2026-05-18 | Friendly Ops Layout pass 1 | Softened shared surfaces, shadows, radii, primary button color, sidebar active state, theme/accent labels, table headers, finance/attendance/leaves/member shells, and reduced developer-style English/uppercase labels across dashboard/admin UI | `npm run lint -w apps/web`; `npm run build -w apps/web`; `npm run test -w apps/web -- src/tests/ui`; local Playwright visual smoke for `/dashboard`, overview, members, attendance, leaves, finance, billing, settings, and mobile attendance | Passed with known non-blocking stale Discord avatar 404 from seed data; visual QA score 9.0/10 for this pass |
