# Pay Run Domain Specification

## 1. Purpose

A Pay Run is a controlled Payroll processing event performed for a specific Payroll Period and Pay Group.

The Pay Run calculates, validates, reviews and finalizes payroll results for eligible Employees.

A Payroll Period defines the date range being paid.

A Pay Run defines the actual processing event.

One Payroll Period may contain:

- One main Pay Run

- One or more correction Pay Runs

- Adjustment Pay Runs

- Supplementary Pay Runs

- Final-payment Pay Runs

- Off-cycle Pay Runs

The Pay Run belongs to the Payroll domain.

---

## 2. Domain Ownership

Primary owner:

- Payroll Domain

Shared consumers:

- Reporting

- Workflow

- Notifications

- Audit

- Finance integrations

- Banking integrations

- File Management

- Administration

The Pay Run may consume approved information from:

- People

- Compensation

- Payroll Profile

- Leave

- Time and Attendance

- Benefits

- Statutory configuration

The Pay Run must not directly modify authoritative records owned by those domains.

---

## 3. Pay Run and Payroll Period Distinction

### Payroll Period

The time range for which payroll applies.

Example:

```text
July 2026 Monthly Payroll
1 July 2026 to 31 July 2026
```

### Pay Run

The processing event for that period (regular, correction, or off-cycle).

---

## 4. Lifecycle (implemented)

```text
DRAFT → APPROVED → POSTED → RECONCILED → CLOSED
```

| Status | Meaning |
|--------|---------|
| `DRAFT` | Working paysheet. Calculate all employees, adjust line items, exclude/re-include. |
| `APPROVED` | Paysheet locked for posting. Figures and membership are frozen. **Calculate all** unlocks back to `DRAFT` and clears approval. |
| `POSTED` | Amounts frozen permanently; payments and release allowed. |
| `RECONCILED` | Payments matched / returns resolved. |
| `CLOSED` | Terminal. |

### Professional flow

1. **Calculate all** — recomputes every included employee and saves draft payslip snapshots (the paysheet).
2. **Approve paysheet** — runs a fresh full calculation, then locks the run as `APPROVED`.
3. **Post paysheet** — freezes included payslips. A forced pre-post refresh refuses to post if figures changed since approval.

There is no separate paysheet table. Draft `Payslip` snapshots plus pay-run totals are the saved sheet. Variable draft inputs stay on `PayrollLineItem` until calc folds them into the snapshot — complementary stores, not duplicates (Architecture §6).
