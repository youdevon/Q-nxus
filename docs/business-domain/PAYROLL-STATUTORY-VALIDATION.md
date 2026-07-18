# Payroll statutory configuration — validation checklist

**Status:** Rates are effective-dated in the database and used by calc. They are **not** production-certified until a payroll/tax specialist confirms them for your organization and tax year.

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

## Runtime pinning

Payslip snapshots should record which config version was used (`statutory` block on snapshot payload). Changing current settings must not alter posted history.

## Parallel comparison (before live pay)

```bash
npm run payroll:parallel -- --trusted ./path/to/trusted-export.csv --pay-run-id <postedPayRunId>
```

Trusted CSV headers: `employeeNumber,grossPay,totalDeductions,netPay` (optional: `paye,nisEmployee,healthSurcharge`).

Exit code is non-zero if any cent-level mismatch remains. Resolve every unexplained diff before production.
