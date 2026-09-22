# Compensation Domain Specification

## 1. Purpose

Compensation represents the approved financial terms associated with an Employee’s employment.

It records what the organization has agreed to pay an Employee, including:

- Base salary

- Hourly or daily rate

- Salary frequency

- Allowances

- Acting payments

- Responsibility allowances

- Approved recurring earnings

- Compensation grade

- Effective dates

- Approval history

Compensation belongs to the People domain.

**Implemented source of truth:** approved base salary and contract allowances live on the current `EmploymentContract` (`isCurrent` + `ACTIVE`). Payroll salaries, payslip preview, and readiness evaluate those fields live — they are not denormalized onto `PayrollProfile` or `Employee`.

Payroll consumes effective compensation information to calculate payments, but Payroll must not own or overwrite the authoritative compensation record.

---

## 2. Domain Ownership

Primary owner:

- People Domain

Shared consumers:

- Payroll

- Employment Contract

- Reporting

- Workflow

- Notifications

- Audit

- Administration

- Finance integrations

### Ownership rule

The People domain owns the approved compensation agreement.

The Payroll domain owns:

- Payroll calculations

- Gross pay

- Net pay

- Taxes

- Deductions

- Overtime calculations

- Payroll adjustments

- Completed payroll results

---

## 3. Compensation and Payroll Distinction

Compensation defines what an Employee is entitled to receive.

Payroll calculates what is actually payable for a specific Payroll Period and Pay Run.

Example:

```text

Approved monthly salary: TT$18,000.00

Owner: People Domain

Calculated gross pay for July 2026: TT$20,450.00

Owner: Payroll Domain