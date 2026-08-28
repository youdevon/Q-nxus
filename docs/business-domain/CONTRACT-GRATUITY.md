# Contract Gratuity

## Purpose

Contract gratuity is an end-of-contract payment for eligible fixed-term employment. Payroll owns policy configuration, settlement calculation, approval, pay-run scheduling, and tax remittance tracking. The employment contract remains the source of eligibility and optional rate override.

See also [EMPLOYMENT-CONTRACT.md](./EMPLOYMENT-CONTRACT.md).

## Formula (default TT)

Primary formula kind: `PCT_OF_TERM_EARNINGS`.

- Eligible monthly earnings = base salary + allowances marked `includedInGratuity`
- Eligible gross earnings (term) = eligible monthly × inclusive contract months
- Gross gratuity = eligible gross earnings × rate% (contract override, else policy default, typically 20%)

UI label **Gratuity-eligible earnings (term)** on the contract compensation summary and gratuity panel shows this eligible gross (term) total — the same figure settlement uses before applying the rate. It is not a separate calendar-year annualization; without an end date the UI falls back to monthly eligible × 12 as a provisional base.

Other formula kinds (`PCT_OF_FINAL_MONTHLY_YEARS`, `DAYS_PER_YEAR`, `FLAT_AMOUNT`, `MANUAL`) are available on the policy for future use.

## Tax tiers (default TT)

Tax mode `TIERED` (IRD guidance):

| Band | Rate |
|------|------|
| First TTD 1,000,000 | 25% |
| Remainder | 30% |

No personal allowance is applied to gratuity tax. Flat or none modes are also supported on the policy.

## Settlement statuses

| Status | Meaning |
|--------|---------|
| `PENDING_ESTIMATE` | Live estimate only — no settlement row yet |
| `ESTIMATED` | Saved; contract end date still in the future |
| `CALCULATED` | Saved; end date reached or passed |
| `APPROVED` | Ready to schedule onto a draft pay run |
| `SCHEDULED` | Attached to a draft pay run as `GRATUITY` / `GRATUITY_TAX` lines |
| `PAID` | Pay run posted |
| `INELIGIBLE` | Policy or service rules exclude payment |
| `VOID` | Cancelled (reason required) |

Tax remittance on paid settlements: `NOT_APPLICABLE` | `PENDING` | `REMITTED`.

## UI surfaces

- **Settings** — `/payroll/settings/gratuity` — versioned policies (formula, rate, tax bands)
- **Queue** — `/payroll/gratuity?year=&tab=`
  - Year filter keys off each **contract period `endDate`** (not pay date or “active during year”). A contract only contributes an estimated / expected gratuity amount in the calendar year its period ends.
  - **Unpaid** — estimate / recalculate / approve / schedule / void for contracts ending in that year
  - **Paid** — paid amounts for contracts whose period ended in that year, pay-run link, mark tax remitted
  - **Accruals** — monthly accrual ledger (`GratuityAccrualEntry`); managers can post/true-up the current month
  - **Budget** — salary outlay for contracts overlapping the year + expected / committed / paid gratuity for contracts **ending** that year; optional scenario query params (`rateOverride`, `onlyCommitted=1`, `excludePending=1`)
- **Me** — `/me/gratuity` — employee self-service view of eligible contracts and settlement estimates / paid amounts
- **Contract** — People contract detail shows settlement status; when `PAID`, paid figures are source of truth

## Accruals & reminders

- **Monthly accruals** — scheduled job `gratuity-monthly-accruals` (and Accruals tab “Post this month’s accruals”) writes period delta = accrued-to-date − prior cumulative per eligible contract.
- **Ending reminders** — scheduled job `gratuity-ending-reminders` notifies payroll/HR when gratuity-eligible contracts enter 30/60/90-day end windows (or are past end without a `PAID` settlement).

## Workflow

1. Mark contract gratuity-eligible (rate optional override).
2. Recalculate settlement (creates `ESTIMATED` or `CALCULATED`).
   - Before the end date: uses the **contract schedule** (salary × months).
   - On/after the end date: prefers **actual posted payroll** eligible earnings in the contract term, and records variance vs the contract estimate.
3. Approve → schedule onto a draft pay run → post pay run → settlement becomes `PAID`.
4. Posting auto-completes open offboarding `FINAL_PAY_CHECK` tasks linked to that employee.
5. Remit withheld gratuity tax and record the remittance reference.

Tax bands and the default rate live on the versioned org **GratuityPolicy** (not a flat rate on the contract form).
