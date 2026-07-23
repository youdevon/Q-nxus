# Employment Contract Domain Specification

## 1. Purpose

An Employment Contract represents the formal terms under which an Employee is employed by the organization for a defined or indefinite period.

The contract records the approved employment arrangement, including:

- Contract dates

- Position

- Department

- Employment type

- Compensation

- Work arrangements

- Probation

- Notice requirements

- Gratuity or end-of-contract provisions

- Approval and document status

The Employment Contract belongs to the People domain.

Payroll may consume approved contract and compensation information, but Payroll must not own or alter the authoritative contract record.

---

## 2. Domain Ownership

Primary owner:

- People Domain

Shared consumers:

- Payroll

- Leave

- Recruitment

- Workflow

- Notifications

- Reporting

- File Management

- Audit

- Administration

Other domains may reference the contract by stable internal ID.

---

## 3. Contract and Employee Distinction

An Employee and an Employment Contract are separate records.

An Employee may have:

- One current primary contract

- Multiple historical contracts

- A future approved contract

- Approved amendments

- Acting or temporary arrangements

- Contract extensions

- Renewals

Deleting or changing an Employee must not automatically delete historical contract records.

---

## 4. Core Contract Information

An Employment Contract should contain:

### Identity

- Stable internal ID

- Organization ID

- Employee ID

- Contract number

- Contract type

- Contract status

- Version number

### Employment arrangement

- Department

- Position

- Employment type

- Assignment type

- Work location

- Reporting line

- Full-time or part-time status

- Standard working hours

### Dates

- Contract preparation date

- Effective start date

- Effective end date, where applicable

- Probation start date

- Probation end date

- Renewal decision date

- Notice date

- Termination date, where applicable

### Compensation

- Base salary

- Salary frequency

- Currency

- Pay group

- Allowances

- Gratuity terms

- Overtime eligibility

- Benefit eligibility

- Other approved compensation terms

### Governance

- Approval status

- Approved by

- Approval date

- Signing status

- Employee signature date

- Organization signature date

- Contract document reference

- Amendment history

- Notes

Sensitive compensation and contract information must be protected by permissions.

---

## 5. Contract Types

Initial contract types may include:

- Permanent

- Fixed-term

- Temporary

- Part-time

- Internship

- Consultancy

- Acting appointment

- Secondment

- Project-based

- Probationary

Contract types should later be configurable.

Contract type alone must not determine all Payroll or Leave behaviour.

---

## 6. Contract Statuses

Implemented statuses on `EmploymentContract.status`:

| Status | Meaning |
|--------|---------|
| `DRAFT` | Being prepared; not current; does not affect payroll or leave |
| `PENDING_APPROVAL` | Submitted for review (`EmploymentContractApprovalStep`) |
| `APPROVED` | Internally approved; may still need signatures |
| `AWAITING_SIGNATURE` | Native employee and/or organization acceptance outstanding |
| `ACTIVE` | In force; may be `isCurrent` and drive payroll/leave |
| `EXPIRED` | Ended by date |
| `SUPERSEDED` | Replaced by a later activated version |
| `TERMINATED` | Closed early |
| `CANCELLED` | Cancelled before or after use |

### Draft

The contract is being prepared and has not entered the approval process.

Rules:

- May be edited

- May be deleted where no dependent records exist

- Must not affect Payroll

- Must not become the employee’s current contract (`isCurrent` stays false)

### Pending Approval

The contract has been submitted for review.

Rules:

- Editing should be restricted

- Material changes may require resubmission

- Approval workflow must be auditable (`EmploymentContractApprovalStep`)

### Approved

The contract has received the required internal approvals.

Rules:

- May still require signatures

- Must not become active before activation (or Save & activate shortcut)

### Awaiting Signature

The contract is approved but has not been fully executed.

Rules:

- Employee or organizational signature remains outstanding (`employeeSignedAt` / `orgSignedAt`)

- Activation depends on `contracts.workflow` dual-signature setting

### Active

The contract is currently in effect.

Rules:

- May supply approved employment and compensation information

- Must be included in relevant employee history

- Material changes require an amendment or new contract

- Cannot normally be physically deleted

### Expiring

The contract is active and approaching its end date.

Rules:

- Expiry alerts must be generated according to configured rules

- Renewal, extension or conclusion action may be required

- Expiring is generally a derived status (monitoring dashboard)

### Expired

The contract end date has passed.

Rules:

- Remains part of employee history

- Must not be deleted

- Must not automatically delete or archive the Employee

- Final payroll or gratuity processing may still be required

### Terminated

The contract ended before its planned end date.

Rules:

- Requires effective termination date

- Requires reason

- Requires authority or approval

- Historical terms must remain preserved

### Superseded

The contract has been replaced by a newer approved contract.

Rules:

- Remains available historically

- Must reference the succeeding contract where possible

- Must not be used for current calculations

### Cancelled

The contract was withdrawn before becoming active.

Rules:

- Requires reason

- Must remain auditable

- Must not affect active employment or Payroll

### Archived

The contract is preserved for long-term historical or legal retention.

Rules:

- Normally read-only

- Excluded from standard active views

- Remains available for audit and reporting

---

## 7. Contract Life Cycle

A typical fixed-term contract follows:

```text

Draft

  ↓

Pending Approval

  ↓

Approved

  ↓

Awaiting Signature

  ↓

Active

  ↓

Expiring

  ↓

Expired

  ↓

Archived
---

## 8. Paper cutover / historical contracts

When migrating from paper to digital:

1. Enter prior terms with their real `startDate` / `endDate` (dates may be in the past).
2. Use **Save & activate** (or Activate on an existing draft). If `endDate` is before today (UTC), the contract is recorded as **EXPIRED** history:
   - `isCurrent` stays false
   - no leave balances are created
   - the employee’s current active contract is not displaced
   - no activate notifications / payroll-readiness sync
3. Enter the current term last and activate it normally (end date today or later) so it becomes **ACTIVE** / current and receives leave balances.
4. Prefer renew links (`sourceContractId` + RENEWAL/EXTENSION) so completed terms stay in **Previous contracts**. Amendments also keep `sourceContractId` for version history on the current contract, but amended predecessors do **not** appear under Previous contracts.

Do not activate a past-ended term expecting it to become the live current contract — use a current-period end date for the live term.

**Previous contracts** vs **amendments**:

- Previous contracts: employment periods the employee worked through (expired, terminated, or superseded by renewal/extension).
- Amendments / salary / position adjustments: version history of the same employment period — visible on the current contract’s amendment history, not in Previous contracts.
