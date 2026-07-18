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

1. Only editable while the run is **mutable** (`DRAFT` / pre-approval).
2. **Recalculate** refreshes statutory math including line items.
3. **Approve → Post** maker-checker freezes figures (including variable lines).
4. Posted history is immutable; further changes need **correction / off-cycle** runs.

## Not yet built (defer unless in go-live scope)

- Timesheet / attendance OT engine
- Loan / garnishment / pension installment masters with declining balances
- Separate input-approval workflow before payroll officer review

Until those exist, treat line items as **officer-entered, dual-controlled via pay-run approval**.

## Operating rule

Do not Approve a run until variable lines are reviewed. Use the Exceptions panel (net variance vs prior period) plus a visual scan of overtime/bonus lines on the run detail.
