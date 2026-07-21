# Payroll statutory configuration — validation checklist

**Status:** Rates are effective-dated in the database and used by calc. They are **not** production-certified until a payroll/tax specialist confirms them for your organization and tax year.

## Period-dated resolution (Phase 1)

Live payslip / pay-run calculation resolves PAYE, NIS, and Health schedules **as of the payroll period end date**, not wall-clock “today”. Posted slips keep the statutory pin in `Payslip.snapshot` (`asOf`, `taxYear`, config ids / version labels).

APIs:

- `resolveStatutoryConfigBundle(asOf)` — single entry for calc
- `getPayeTaxConfigAsOf` / `getNisClassesAsOf` / `getHealthSurchargeConfigAsOf`
- Settings UI still uses “current as of today” for the In effect badge

## Employee tax profiles / TD1 (Phase 2)

`EmployeeTaxProfile` stores per-employee, per-calendar-tax-year PAYE treatment (method, personal allowance override, TD1 flags/amounts, previous-employment declarations).

Calc dual-reads:

1. Tax profile for the period’s tax year (preferred)
2. `PayrollProfile.td1OtherApprovedAnnual` fallback

Dual-write keeps current-year TD1 in sync between payroll setup and the tax profile form on `/payroll/employees/[id]`. Cumulative / prior-employer methods are stored now; full calc arrives in later phases.

## Prior-employer YTD (Phase 3)

`EmployeePriorEmploymentYtd` stores mid-year joiner prior taxable income / PAYE / NIS / Health totals (plus optional TD4 or letter attachments via `StoredFile`).

- Joiners **without** prior employment this tax year need no records.
- Active rows sync `EmployeeTaxProfile.previousEmploymentDeclared` / `Verified`.
- Totals resolve into payslip statutory pins and calc notes; applied when cumulative PAYE is enabled.

## Cumulative PAYE (Phase 4–5)

`STANDARD_CUMULATIVE` / `PREVIOUS_INCOME_INCLUDED` methods use YTD taxable earnings and PAYE already deducted (this employer + optional prior-employer totals) to project annual liability and withhold the period delta. NIS deductible projection uses YTD NIS paid. Period pins live on the payslip snapshot.

## Component tax treatment (Phase 6)

`PayrollComponentDefinition.taxTreatment` (`TAXABLE_EMPLOYMENT` | `NON_TAXABLE` | `NIS_ONLY` | `PAYE_EXEMPT`) refines earnings classification. Saving a definition with `TAXABLE_EMPLOYMENT` sets `isTaxable = true` for legacy calc paths. Manage under **Payroll → Settings → Components**.

## Statutory overrides (Phase 7)

`EmployeePayrollStatutoryOverride` holds period-end absolute PAYE / NIS / Health amounts with maker-checker (`DRAFT` → `PENDING_APPROVAL` → `APPROVED` / `REJECTED`). Approved overrides apply after computed statutory in payslip assembly.

## Employee tax year view (Phase 8)

`/payroll/employees/[id]/tax-year` (optional `?year=`) shows tax profile summary, prior-employment YTD, posted payslips for the calendar year, and statutory override request / approve UI. Linked from employee payroll setup.

## Payslip YTD labels (Phase 9)

When prior-employer records exist, payslip documents (HTML + PDF) show three YTD rows: **Prior employer** / **This employer** / **Combined**. Otherwise the single current-employer YTD strip is unchanged. Assembled via `assemblePayslipYtdBreakdown`.

## Exceptions, permissions, audit (Phase 10)

- Soft PAYE exceptions (`evaluatePayeExceptions`) surface on payslip notes (declared-without-records, unverified prior under cumulative, pending overrides).
- Finer permissions: `payroll.tax_profile.*`, `payroll.prior_employment.*`, `payroll.statutory_override.*`, `payroll.employee_year.view` (seeded on clerk/officer/admin roles). Re-run access role seed to grant them.
- Overrides and tax profile / prior YTD changes continue to write audit events.

## Seeded Trinidad & Tobago configs (reference)

| Config | Where | Notes |
|--------|--------|--------|
| PAYE | `PayeTaxConfig` + brackets | Personal allowance, NIS deductible portion, cap, progressive bands |
| NIS | `NisEarningsClass` I–XVI | Weekly employee/employer × `13/3` weeks/month |
| Health Surcharge | `HealthSurchargeConfig` | Higher/lower weekly; Mondays-in-period weeks; age exemptions |

Migrations that inserted org-wide 2026 defaults:

- `prisma/migrations/20260716153000_nis_earnings_classes`
- `prisma/migrations/20260716160000_paye_and_health_surcharge`

Manage live versions under **Payroll → Settings** (NIS / PAYE / Health).

## Specialist sign-off (required before live pay)

For each tax year / legislative change, record:

1. Official source (Board of Inland Revenue / NIBTT circular, gazette, advisor memo).
2. Effective date and version label in Q-NXUS.
3. Sample employees checked: low/mid/high earner, new hire mid-month, senior HS-exempt, NIS class boundary.
4. Sign-off name, role, date.

Until signed off, treat all nets as **provisional**.

### Pre-go-live checklist (Phases 1–10)

Copy into the tax-year change ticket and tick before first live pay run:

- [ ] **Period-dated rates** — PAYE / NIS / Health schedules match the official circular for the tax year; In effect badge and period-end as-of resolution verified.
- [ ] **Personal allowance & brackets** — sample annual taxable incomes land in the correct band(s).
- [ ] **TD1 dual-read** — tax profile vs payroll-setup TD1 other approved deductions agree for current year.
- [ ] **Mid-year joiner** — prior-employer YTD entered from TD4/letter; payslip shows Prior / This employer / Combined; cumulative / previous-income method withholds the expected period delta.
- [ ] **Unverified prior** — soft exception note appears; payroll does not treat unverified prior as certified.
- [ ] **Statutory overrides** — maker-checker request → approve → approved amounts replace calc for that period end.
- [ ] **Exemptions** — NIS / Health / PAYE exempt flags zero the right deductions and relax readiness.
- [ ] **Parallel comparison** — `npm run payroll:parallel` against a trusted export for at least one posted run (cent-level match).
- [ ] **Access roles** — re-run `npm run seed:access` (or equivalent) so `payroll.tax_profile.*`, `payroll.prior_employment.*`, `payroll.statutory_override.*`, `payroll.employee_year.view` are granted.
- [ ] **Migrations** — all PAYE / prior-YTD / override migrations applied on the target environment (see below).

## Deploy migrations

Local and every deployed environment must apply Prisma migrations before serving this branch:

```bash
npx prisma migrate deploy
# or during local develop:
npx prisma migrate status   # expect "Database schema is up to date!"
```

PAYE-related migrations introduced with Phases 1–10 (apply in order with the rest of the chain):

- `20260720120000_paye_tax_year_metadata`
- `20260720140000_employee_tax_profiles`
- `20260720160000_employee_prior_employment_ytd`
- `20260720180000_paye_tax_treatment_and_overrides`

Do **not** rely on `prisma db push` for production. Confirm `migrate status` is clean after deploy.

## Runtime pinning

Payslip snapshots should record which config version was used (`statutory` block on snapshot payload). Changing current settings must not alter posted history.

## Parallel comparison (before live pay)

```bash
npm run payroll:parallel -- --trusted ./path/to/trusted-export.csv --pay-run-id <postedPayRunId>
```

Trusted CSV headers: `employeeNumber,grossPay,totalDeductions,netPay` (optional: `paye,nisEmployee,healthSurcharge`).

Exit code is non-zero if any cent-level mismatch remains. Resolve every unexplained diff before production.
