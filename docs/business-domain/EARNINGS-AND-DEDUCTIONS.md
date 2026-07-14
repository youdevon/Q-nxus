# Earnings and Deductions Domain Specification

## 1. Purpose

Earnings and Deductions define the reusable payroll components applied to Employees during a Pay Run.

An Earning increases an Employee’s gross pay.

A Deduction reduces an Employee’s gross or net pay, depending on its configuration and statutory treatment.

Examples of Earnings:

- Base salary

- Hourly wages

- Overtime

- Acting allowance

- Responsibility allowance

- Transport allowance

- Bonus

- Retroactive payment

- Gratuity

- Honorarium

Examples of Deductions:

- Income tax

- National insurance

- Pension contribution

- Health-plan contribution

- Union dues

- Loan repayment

- Garnishment

- Salary advance recovery

- Voluntary deduction

- Unpaid leave adjustment

Earnings and Deductions belong to the Payroll domain.

---

## 2. Domain Ownership

Primary owner:

- Payroll Domain

Shared consumers:

- Pay Run

- Payroll Profile

- Compensation

- Reporting

- Workflow

- Notifications

- Audit

- Finance integrations

- Administration

The People domain may define approved Compensation and recurring allowances.

Payroll owns the calculation, application and historical result of Earnings and Deductions in a Pay Run.

---

## 3. Definition and Transaction Distinction

An Earning or Deduction Definition describes the rule.

A Pay Run Line records the amount actually applied to an Employee.

Example:

```text

Definition:

Transport Allowance

Recurring

Taxable

TT$1,000.00 monthly