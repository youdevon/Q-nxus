# Payroll Profile Domain Specification

## 1. Purpose

A Payroll Profile defines how an Employee participates in Payroll.

It does not replace the Employee record or Compensation record. It contains the payroll-specific configuration required to determine whether an Employee can be included in a Pay Run.

The Payroll Profile belongs to the Payroll domain.

---

## 2. Domain Ownership

Primary owner:

- Payroll Domain

Shared consumers:

- People

- Reporting

- Workflow

- Notifications

- Audit

- Administration

- Finance integrations

The People domain owns employee and employment information.

Payroll owns payroll eligibility, payment configuration, tax treatment and payroll-processing settings.

---

## 3. Payroll Profile and Employee Distinction

An Employee may exist without a completed Payroll Profile.

Examples:

- Draft Employee

- Unpaid intern

- Consultant paid outside Payroll

- Former Employee retained for historical purposes

- New Employee awaiting payroll setup

A Payroll Profile must reference one Employee using the Employee’s stable internal ID.

Payroll must not create an unrelated duplicate Employee record.

---

## 4. Core Payroll Profile Information

A Payroll Profile should contain:

### Identity

- Stable internal ID

- Organization ID

- Employee ID

- Payroll profile number, where required

- Status

- Effective start date

- Effective end date, where applicable

### Payroll assignment

- Pay group

- Payment frequency

- Payroll calendar

- Payroll location

- Cost centre

- Payroll department reference

- Payroll position reference

- Default currency

### Payment information

- Payment method

- Bank account reference

- Bank name

- Branch

- Account type

- Account number

- Payment distribution rules

- Cheque or cash designation, where permitted

### Statutory information

- Tax identifier

- National insurance or statutory number

- Tax category

- Contribution category

- Pension status

- Exemption status

- Residency or jurisdiction, where required

**Identity source of truth (implemented):** NIS number, BIR number, and government/travel ID (`idType` / `idNumber`) live on the **Employee** record only. Opening payroll setup prefills from Employee. Saving payroll setup writes back to Employee **only** when the actor has `people.manage` (gap-fill for empty fields). Payroll-only actors cannot mutate People identity. Posted payslips freeze the values captured at calculation time.

### Processing controls

- Payroll eligible

- Include in automatic Pay Runs

- Overtime eligible

- Proration method

- Tax calculation method

- Pensionable

- Union deduction applicability

- Garnishment or court-order indicator

- Final payment pending

- Payroll hold status

### Governance

- Approval status

- Approved by

- Approval date

- Effective date

- Notes

- Created by

- Created date

- Updated date

Payroll Profile information must be protected as sensitive data.

---

## 5. Payroll Profile Statuses

### Draft

The profile is incomplete or being prepared.

Rules:

- May be edited

- Employee must not enter a normal Pay Run

- Missing requirements should be clearly displayed

### Pending Approval

The profile has been submitted for payroll review or approval.

Rules:

- Material editing may be restricted

- Approval must be auditable

- Employee remains excluded from normal Pay Runs unless policy permits otherwise

### Active

The profile is complete, approved and available for Payroll processing.

Rules:

- Employee may be included in eligible Pay Runs

- All required validations must pass

- Effective compensation and employment status must still be checked

### On Hold

The profile remains valid but payroll processing is temporarily blocked.

Examples:

- Missing bank confirmation

- Investigation

- Court instruction

- Payroll exception

- Temporary administrative hold

Rules:

- Requires reason

- Requires effective date

- Must generate an alert

- Must be auditable

- Historical Payroll remains available

### Suspended

Payroll participation is stopped for a defined reason.

Rules:

- Employee must not enter new normal Pay Runs

- Suspension does not delete Payroll history

- Reactivation requires authorization

### Closed

The Employee is no longer expected to receive regular Payroll processing.

Examples:

- Termination completed

- Retirement completed

- Contract ended

- Transferred outside Payroll

Rules:

- Historical Payroll remains available

- Final or adjustment payments may still be authorized

- Closed profiles cannot enter normal Pay Runs

### Archived

The profile is retained for long-term history and audit.

Rules:

- Read-only except for authorized administrative correction

- Excluded from normal operational views

- Payroll history must remain intact

---

## 6. Payroll Eligibility

Payroll eligibility is not determined by one field alone.

An Employee is eligible for a normal Pay Run only where:

- Employee status permits payment

- Payroll Profile is Active

- Payroll Profile effective dates cover the Payroll Period

- Valid Compensation exists

- Required statutory information is complete

- Required payment information is complete

- No blocking Payroll hold exists

- Employee belongs to the correct Pay Group

- Contract or employment arrangement is valid

- No policy restriction applies

The application should display a clear Payroll readiness result.

Example:

```text

Payroll Ready: No

Blocking issues:

- Bank account missing

- Tax identifier missing

- Compensation not approved