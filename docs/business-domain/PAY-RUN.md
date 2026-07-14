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