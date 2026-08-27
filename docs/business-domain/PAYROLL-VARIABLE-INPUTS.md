# Payroll variable inputs (foundation)

## Current model (go-live capable for simple cases)

Variable earnings and deductions on a **draft** pay run use `PayrollLineItem`:

| Code | Use |
|------|-----|
| `OVERTIME` | Manual overtime amount |
| `BONUS` | Bonus |
| `COMMISSION` | Commission |
| `OTHER_EARNING` / `OTHER_DEDUCTION` | Ad-hoc |
| `CORRECTION_*` | Supplemental correction runs |

Controls already wrapping these inputs:

1. Only editable while the run is **draft** (`DRAFT`). Approved paysheets are locked.
2. **Calculate all** refreshes statutory math including line items (also unlocks an approved run back to draft).
3. **Approve paysheet** recalculates everyone, saves the draft snapshots, then locks for posting.
4. **Post** freezes figures (including variable lines). Maker-checker still applies when enabled.
5. Posted history is immutable; further changes need **correction / off-cycle** runs.

### Not a second payslip store

`PayrollLineItem` rows are **draft inputs** only. The authoritative posted
result is `Payslip.snapshot` (plus denormalized statutory columns for
reporting). Do not collapse line items into the snapshot table or invent a
parallel paysheet table — see Architecture §6 “Payroll complementary stores”
and `PAY-RUN.md` (draft snapshots *are* the sheet).

## Not yet built (defer unless in go-live scope)

- Timesheet / attendance OT engine
- Loan / garnishment / pension installment masters with declining balances
- Separate input-approval workflow before payroll officer review

Until those exist, treat line items as **officer-entered, dual-controlled via pay-run approval**.

## Operating rule

Do not Approve a run until variable lines are reviewed. Approving recalculates and locks the sheet — use Exceptions (net variance vs prior period) plus a visual scan of overtime/bonus lines on the run detail first.
