# Payroll Period Domain Specification

## 1. Purpose

A Payroll Period defines the date range for which employees are paid.

Examples:

- July 2026 Monthly Payroll

- 1 July 2026 to 31 July 2026

- Fortnight ending 17 July 2026

- Week ending 10 July 2026

A Payroll Period is not the same as a Pay Run.

The Payroll Period defines the time covered. A Pay Run is a processing event performed against that period.

One Payroll Period may contain:

- One main Pay Run

- One or more correction runs

- Adjustment runs

- Final-payment runs

- Supplementary runs

The Payroll Period belongs to the Payroll domain.

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

- Leave

- People

Other domains may reference a Payroll Period but must not directly change its internal Payroll state.

---

## 3. Core Information

A Payroll Period should contain:

### Identity

- Stable internal ID

- Organization ID

- Payroll Period number

- Name

- Payroll year

- Sequence number

- Status

### Calendar information

- Pay Group

- Payment frequency

- Period start date

- Period end date

- Payroll cut-off date

- Timesheet cut-off date

- Leave cut-off date

- Adjustment cut-off date

- Planned processing date

- Planned payment date

- Actual payment date

### Governance

- Opened by

- Opened date

- Closed by

- Closed date

- Reopened by, where applicable

- Reopened date

- Reopen reason

- Notes

- Created date

- Updated date

---

## 4. Payroll Period and Pay Run Distinction

### Payroll Period

Defines the dates and payroll calendar being processed.

Example:

```text

Payroll Period:

July 2026 Monthly Payroll

1 July 2026 to 31 July 2026