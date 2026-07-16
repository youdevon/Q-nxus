# Roadmap execution status — 2026-07-16

## Sprint 1 — Trust (P0) — DONE

1. **Route-level auth holes** — Gated `/contracts`, `/people/leave/types`, `/leave/new`, structure mutate/read pages via `requireContractViewAccess` / `requireLeaveManageAccess` / `requirePeopleManageAccess` / `requirePeopleDirectoryAccess`.
2. **Split admin permissions** — Added `administration.manage` + fine-grained admin/identity permissions to `seed-access-roles.ts` / `seed.ts`. Admin mutations now require write permissions (not `administration.view` alone). Re-run `npm run seed:access` (and seed if needed) so non-system roles/DB permissions stay in sync. `SYSTEM_ADMINISTRATOR` still bypasses via capability helper.
3. **Leave decision integrity** — Assigned approver only; `leave.manage` may override; `leave.approve` cannot override others’ steps. Workspace pending queue scoped the same way. Optimistic locking on request/step/balance updates. Pure math in `leave-balance-math.ts`.
4. **Automated tests** — Vitest + `npm test` covering contract non-overlap, leave reserve/approve/release math, capability/admin mutation checks (15 tests).

## Sprint 2 — Leave ops (P1) — DONE (email partial)

5. **Leave type + entitlement CRUD** — `/people/leave/types` list/detail/new/edit; entitlement rules on detail; `leave.manage`.
6. **Working calendar / holidays** — `OrganizationHoliday` model + migration; `/people/leave/holidays`; wired into `calculateLeaveDays` / validation / leave form preview.
7. **Leave attachments** — Required when leave type needs documents; stored under `uploads/leave/...`; enforced on create; view/download on leave detail for owner, assigned approver, and `leave.manage`.
8. **Email queue** — Existing admin Process queue kept; added `npm run email:process` (`scripts/process-email-queue.ts`). Requires `SMTP_ENABLED=true` + SMTP env. No background cron (manual/CLI).

## Sprint 3 — Operations (P1/P2) — DONE (reports skipped)

9. **Operational home dashboard** — Replaced placeholder copy with pending leave for me, contracts within 90 days, unread notifications.
10. **Contract expiry reminders** — In-app notifications for HR/contract managers on 30/60/90 windows; deduped 14 days; triggered when managers load the home dashboard.
11. **Vacation use-or-lose alerts** — When a current contract ends within 30 days and available VAC balance > 0, notify reporting officer (reporting-line supervisor), employee (if linked user), and relevant HR (`HR_ADMINISTRATOR` / `leave.manage`; exact HR roles TBD). Deduped 14 days per contract. UI banners on `/me`, `/leave`, and home dashboard. CLI: `npm run notify:vacation-forfeiture`. No auto leave requests.
12. **Reports pack** — Deferred (optional thin item). Documents/Payroll untouched.
13. **Entitlement rebuild** — Saving an entitlement rule can rebuild current-contract balances (checkbox, on by default); explicit **Rebuild balances** on leave type detail. Taken/reserved/adjustments preserved.

## Migrations to run

```bash
npx prisma migrate deploy
npx prisma generate
npm run seed:access   # sync new admin write permissions
```

## Operable ops scripts (no in-app cron)

Run from the repo root with env loaded (`.env` / `dotenv`). Suitable for cron or manual ops:

```bash
# Send queued notification emails (requires SMTP_ENABLED=true + SMTP_* vars)
npm run email:process
# Optional batch size: npm run email:process -- 100

# In-app vacation use-or-lose reminders (employee, reporting officer, HR)
npm run notify:vacation-forfeiture
```

Admin UI still has Process queue for email. Vacation alerts also run opportunistically when `/`, `/me`, or `/leave` load for an employee with a current contract in the window.

## Deferred

- Background email cron / worker (CLI + admin UI exist; use scripts above)
- Reports pack / Documents / Payroll
- Middleware default-deny for all authenticated routes
