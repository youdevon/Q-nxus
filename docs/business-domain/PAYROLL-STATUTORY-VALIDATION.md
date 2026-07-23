# Payroll statutory configuration — validation checklist

**Status:** Rates are effective-dated in the database and used by calc. They are **not** production-certified until a payroll/tax specialist confirms them for your organization and tax year.

## Period-dated resolution (Phase 1)

Live payslip / pay-run calculation resolves PAYE, NIS, and Health schedules **as of the payroll period end date**, not wall-clock “today”. Posted slips keep the statutory pin in `Payslip.snapshot` (`asOf`, `taxYear`, config ids / version labels).

APIs:

- `resolveStatutoryConfigBundle(asOf)` — single entry for calc
- `getPayeTaxConfigAsOf` / `getNisClassesAsOf` / `getHealthSurchargeConfigAsOf`
- Settings UI still uses “current as of today” for the In effect badge

## Employee tax profiles / TD1 (Phase 2)

`EmployeeTaxProfile` is the sole store for per-employee, per-calendar-tax-year PAYE treatment (method, personal allowance override, TD1 flags/amounts, previous-employment declarations).

Calc reads the tax profile for the period’s tax year. Saving TD1 from payroll setup or the tax profile form writes only to `EmployeeTaxProfile` for that year.

## Prior-employer YTD (Phase 3)

`EmployeePriorEmploymentYtd` stores mid-year joiner prior taxable income / PAYE / NIS / Health totals (plus optional TD4 or letter attachments via `StoredFile`).

- Joiners **without** prior employment this tax year need no records.
- Active rows sync `EmployeeTaxProfile.previousEmploymentDeclared` / `Verified`.
- Totals resolve into payslip statutory pins and calc notes; applied when cumulative PAYE is enabled.
- Soft-archived (`ARCHIVED`) rows are hard-deleted after 365 days by
  `npm run purge:prior-employment-archive` (also scheduled as
  `prior-employment-archive-purge`). Override with
  `PRIOR_EMPLOYMENT_ARCHIVE_RETENTION_DAYS`. Supporting documents cascade;
  orphaned `StoredFile` rows follow stored-file retention.

### Canonical mid-year joiner PAYE method

When an employee joins this organization mid tax year from another employer, **Annual PAYE Projection** is the authoritative planning method (validated against TT worksheet practice):

1. **Prior taxable YTD** (verified TD4 / letter) + **prior PAYE deducted**
2. **This employer posted YTD** (taxable + PAYE), if any
3. **Projected remaining** = remaining payroll periods × expected taxable per period  
   (basic + taxable allowances + recurring taxable earnings)
4. **Projected annual taxable** = prior + this-employer YTD + projected remaining
5. **Chargeable income** = annual taxable − personal allowance ($90,000 statutory, or profile override) − qualifying deductions (70% NIS + TD1 other / pension, capped at $60,000)
6. **Annual tax** = progressive bands on chargeable (25% / 30%)
7. **Remaining tax** = annual tax − prior PAYE − this-employer PAYE already paid
8. **Recommended PAYE per period** = remaining tax ÷ remaining periods

Operational flow:

1. Enter / verify prior-employment YTD on payroll setup (or tax-year page).
2. Set tax method `PREVIOUS_INCOME_INCLUDED` (cumulative on).
3. Confirm contract taxable package (allowances marked correctly).
4. Open `/payroll/employees/[id]/tax-year` — review projection.
5. Save → review → approve projection; **Apply** creates a pending statutory PAYE override for the target period so payroll withholds the recommended amount.

Do **not** blind-annualize this employer’s first month × 12 and ignore prior income/PAYE. Unverified prior amounts stay out of applied payroll (hard gate).

## Cumulative PAYE (Phase 4–5)

`STANDARD_CUMULATIVE` / `PREVIOUS_INCOME_INCLUDED` methods use YTD taxable earnings and PAYE already deducted (this employer + optional prior-employer totals) to project annual liability and withhold the period delta. NIS deductible projection uses YTD NIS paid. Period pins live on the payslip snapshot.

For mid-year joiners, set method to **Previous income included**, verify prior YTD, then use the Annual PAYE Projection worksheet (and apply recommended PAYE) so withholding follows the canonical remaining-tax ÷ remaining-periods method above — not a first-month × 12 blind annualization that ignores the prior employer.

## Component tax treatment (Phase 6)

`PayrollComponentDefinition.taxTreatment` (`TAXABLE_EMPLOYMENT` | `NON_TAXABLE` | `NIS_ONLY` | `PAYE_EXEMPT`) refines earnings classification. Saving a definition with `TAXABLE_EMPLOYMENT` sets `isTaxable = true` for legacy calc paths. Manage under **Payroll → Settings → Components**.

## Statutory overrides (Phase 7)

`EmployeePayrollStatutoryOverride` holds period-end absolute PAYE / NIS / Health amounts with maker-checker (`DRAFT` → `PENDING_APPROVAL` → `APPROVED` / `REJECTED`). Approved overrides apply after computed statutory in payslip assembly.

## Employee Annual PAYE Projection (canonical tax-year view)

`/payroll/employees/[id]/tax-year` (optional `?year=`) is the **Employee Annual PAYE Projection** page:

- Employee details, tax profile, prior-employment YTD
- Live annual projection worksheet (previous actual / current YTD / projected remaining / recommended PAYE per remaining period)
- **Print projection** → `/payroll/employees/[id]/tax-year/print?year=` (structured tables: employee, earnings by source, tax calculation, recommended withholding, signature lines; browser print uses printer paper size)
- Versioned save → review → **approve** (auto-applies recommended PAYE as **APPROVED** statutory overrides for all remaining open monthly periods; posted payslips are skipped; draft/approved pay runs recalculate). Maker-checker on projection approve is the correctness gate — no second per-period override approval.
- Optional **Re-apply to open periods** on an already-approved projection refreshes those overrides after worksheet/rate changes.
- Tax-year adjustments (maker-checker) that feed the live projection after approval
  - Additive: previous income/PAYE, taxable YTD, non-taxable (informational), projected earnings/period, NIS, health surcharge (informational), pension, qualifying, manual remaining tax
  - Absolute formula overrides: remaining periods, NIS deductible portion (0–1), approved deduction cap
- Earning treatment overrides (maker-checker) applied on payslip assembly and projected earnings
- Posted payslips for the calendar year + link to month-by-month history (`/payroll/employees/[id]/payroll/[taxYear]`)
- Statutory override request / approve UI still available for one-off manual period amounts

**Cascade after approved tax edits or org rate publish:** live projection refreshes on next load; open `APPROVED` / `REVIEW_REQUIRED` projection versions are superseded with a fresh `CALCULATED` snapshot; mutable (draft/approved) pay runs for the tax year are recalculated. Posted payslips stay frozen.

**When tax law changes:** create a new org `PayeTaxConfig` under Payroll → Settings → PAYE with the new `effectiveFrom` (and close the prior version). Period-end as-of resolution picks the schedule that covers that date — publishing also triggers org-wide draft-run recalculation from that effective date. Same cascade applies to NIS and Health Surcharge version publishes.

**When one employee needs a one-off formula change:** use tax-year adjustments (absolute types above) or a manual period statutory override. For mid-year joiners, approve the Annual PAYE Projection so remaining open periods receive the recommended PAYE automatically.

Unverified prior-employer amounts are excluded from payslip / pay-run PAYE inputs (hard gate). They may still appear on the projection form with warnings when previewing.

Approved projections appear on payslips as **Projected tax-year position** (estimate — not paid), after YTD.

Permissions:

- View: `payroll.employee_year.view`, `payroll.tax_projection.view` (plus setup/manage)
- Save / submit: `payroll.tax_projection.preview`
- Approve: `payroll.tax_projection.approve` (also auto-applies open-period PAYE overrides)
- Re-apply open periods: `payroll.tax_projection.apply`
- Adjustments: `payroll.tax_adjustments.create` / `payroll.tax_adjustments.approve`
- Treatment overrides: `payroll.tax_treatment.override`

Re-run `npm run seed:access` after deploy.

Persistence migrations: `20260721120000_annual_paye_projection_persistence`, `20260721140000_tax_year_formula_override_types`.

## Payslip YTD labels (Phase 9)

When prior-employer records exist, payslip documents (HTML + PDF) show three YTD rows: **Prior employer** / **This employer** / **Combined**. Otherwise the single current-employer YTD strip is unchanged. Assembled via `assemblePayslipYtdBreakdown`.

## Exceptions, permissions, audit (Phase 10)

- Soft PAYE exceptions (`evaluatePayeExceptions`) surface on payslip notes (declared-without-records, unverified prior under cumulative, pending overrides).
- Finer permissions: `payroll.tax_profile.*`, `payroll.prior_employment.*`, `payroll.statutory_override.*`, `payroll.employee_year.view`, `payroll.tax_projection.*`, `payroll.tax_adjustments.*`, `payroll.tax_treatment.override` (seeded on clerk/officer/admin roles). Re-run access role seed to grant them.
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
