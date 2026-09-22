# Leave Domain Specification

## 1. Purpose

The Leave domain manages employee absence entitlements, requests, approvals, balances and payroll-impacting leave events.

It owns:

- Leave Types

- Leave Policies

- Leave Entitlements

- Leave Balances

- Leave Requests

- Leave Approvals

- Leave Accruals

- Leave Adjustments

- Leave Calendar

- Return-to-work records

- Leave-related payroll indicators

The Leave domain references Employees from the People domain but does not own Employee records.

Payroll may consume approved leave outcomes, particularly where leave affects pay, but Payroll must not directly edit Leave records.

---

## 2. Domain Ownership

Primary owner:

- Leave Domain

Shared consumers:

- People

- Payroll

- Workflow

- Notifications

- Reporting

- Audit

- Administration

- Employee Self-Service

- Manager Self-Service

The People domain owns:

- Employee identity

- Employment status

- Contract

- Department

- Position

- Employment dates

The Leave domain owns:

- Leave eligibility

- Leave entitlement

- Leave balance

- Leave request status

- Leave approval

- Leave dates

- Leave duration

- Leave-related absence records

Payroll owns:

- Payroll calculation

- Paid and unpaid leave deductions

- Payroll adjustments

- Completed payroll history

---

## 3. Core Business Objects

The Leave domain should include:

- Leave Type

- Leave Policy

- Leave Policy Assignment

- Leave Entitlement

- Leave Balance

- Leave Request

- Leave Approval

- Leave Accrual

- Leave Adjustment

- Leave Transaction

- Leave Calendar Entry

- Return-to-Work Record

- Leave Exception

- Leave Payroll Impact

---

## 4. Leave Type

A Leave Type defines a category of absence.

Examples:

- Vacation Leave

- Sick Leave

- Casual Leave

- Maternity Leave

- Paternity Leave

- Bereavement Leave

- Study Leave

- Unpaid Leave

- Administrative Leave

- Jury Duty

- Compassionate Leave

- Time Off in Lieu

A Leave Type should contain:

- Stable internal ID

- Organization ID

- Code

- Name

- Description

- Status

- Paid or unpaid classification

- Unit of measurement

- Approval requirement

- Documentation requirement

- Minimum request duration

- Maximum request duration

- Advance-notice requirement

- Half-day support

- Hourly support

- Negative balance policy

- Carry-forward policy

- Accrual applicability

- Payroll-impact classification

- Effective start date

- Effective end date

- Created date

- Updated date

---

## 5. Leave Type Statuses

### Draft

The Leave Type is being prepared.

Rules:

- May be edited

- Must not be assigned

- Must not be used in Leave Requests

- May be deleted where no dependency exists

### Active

The Leave Type may be assigned and requested.

### Inactive

The Leave Type cannot be used for new requests.

Historical Leave records remain valid.

### Superseded

The Leave Type has been replaced by a later effective version.

### Archived

The Leave Type is retained for history and audit.

---

## 6. Leave Policy

A Leave Policy defines the rules governing one or more Leave Types for a group of Employees.

A Leave Policy may contain:

- Stable internal ID

- Organization ID

- Policy name

- Policy code

- Description

- Applicable Leave Type

- Eligibility rules

- Entitlement amount

- Accrual method

- Accrual frequency

- Carry-forward limit

- Expiry rule

- Waiting period

- Maximum balance

- Negative-balance rule

- Documentation rule

- Approval workflow

- Payroll treatment

- Effective dates

- Status

- Approval status

Examples of policy groups:

- Permanent Employees

- Fixed-Term Employees

- Monthly-Paid Employees

- Weekly-Paid Employees

- Executives

- Probationary Employees

- Employees covered by a collective agreement

---

## 7. Policy Assignment

A Leave Policy may be assigned based on:

- Employee

- Employment type

- Contract type

- Department

- Position

- Location

- Pay Group

- Employee category

- Length of service

- Collective agreement

- Organization

Rules:

- Policy assignment must be effective-dated.

- An Employee may have more than one applicable Leave Policy.

- Conflicting policies must be resolved using configured priority.

- Manual Employee-level overrides require authorization.

- Historical policy assignments must remain unchanged.

---

## 8. Leave Eligibility

Eligibility should be derived from applicable rules.

Possible eligibility criteria include:

- Employee is active

- Contract is valid

- Required service period has been completed

- Employee belongs to an eligible category

- Leave Type is active

- Applicable Leave Policy exists

- Required balance is available

- Employee is not already on conflicting Leave

- Requested dates fall within eligible employment dates

- Required documentation is present

- Required notice period is satisfied

Eligibility should be evaluated using the requested Leave dates, not only the current date.

---

## 9. Leave Entitlement

A Leave Entitlement defines how much Leave an Employee is permitted to receive for a defined period.

An entitlement should contain:

- Employee ID

- Leave Type ID

- Leave Policy ID

- Entitlement period

- Opening entitlement

- Additional entitlement

- Carried-forward amount

- Accrued amount

- Used amount

- Pending amount

- Adjusted amount

- Expired amount

- Remaining amount

- Unit

- Effective dates

Entitlement must not be stored only as a manually editable balance.

The application should preserve the transactions that created the balance.

---

## 10. Leave Balance

A Leave Balance is the derived amount available to an Employee.

Example:

```text

Opening entitlement: 14 days

Carried forward:       3 days

Accrued:               2 days

Approved leave used:  -5 days

Manual adjustment:     1 day

Available balance:    15 days
---

## 11. Paper cutover / historical leave

Two supported cutover paths:

### Opening balance

On **People → Leave balances**, set **Opening balance** per leave type on the current contract.

Formula:

```text
available = opening + entitlement + accrued + carried forward + adjustments − reserved − taken
```

Use opening balance to match paper remaining without re-entering every past absence. Negative opening is allowed when system entitlement exceeds paper remaining.

### Past approved leave dates

On **People → Leave → Request for employee**, check **Record as past approved leave**:

- Requires `leave.manage` (on-behalf mode)
- End date must be before today
- Skips notice period and approval workflow
- Creates an **APPROVED** request and posts **LEAVE_TAKEN** against the balance
- Optional when the calendar / history of absences is needed; otherwise opening balance alone is enough for remaining days
