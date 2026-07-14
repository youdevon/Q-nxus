# Employee Offboarding Domain Specification

## 1. Purpose

Employee Offboarding coordinates the controlled conclusion of an Employee’s employment, assignment or organizational access.

Offboarding ensures that employment, Payroll, system access, Assets, documents, responsibilities and final obligations are handled safely and completely.

Offboarding may apply when an Employee:

- Resigns

- Retires

- Reaches the end of a fixed-term Contract

- Is terminated

- Is made redundant

- Transfers to another Organization

- Completes an internship

- Completes a temporary assignment

- Ends a secondment

- Dies while employed

- Moves to a role requiring removal of previous access

- Leaves under another approved separation reason

Offboarding does not directly own Employment, Payroll, User Account or Asset records.

It coordinates controlled actions across the domains that own those records.

---

## 2. Domain Ownership

Primary owner:

- People Domain

Supporting domains:

- Payroll

- Identity and Security

- Assets

- Leave

- File Management

- Workflow

- Notifications

- Audit

- Administration

- Facilities

- Finance

- Records Management

- Training

- Legal, where applicable

Offboarding owns:

- Offboarding Case

- Offboarding Template

- Offboarding Checklist

- Offboarding Task

- Separation Coordination

- Clearance Status

- Offboarding Exception

- Final Readiness

- Handover Coordination

- Exit Interview

- Completion Record

Other domains retain ownership of their records.

Examples:

- Employment termination: People

- Final Pay Run: Payroll

- User-account suspension: Identity and Security

- Laptop return: Assets

- Access-card revocation: Facilities or Identity and Security

- Leave balance: Leave

- Contract document: People and File Management

---

## 3. Core Business Objects

The Employee Offboarding capability should include:

- Offboarding Case

- Offboarding Template

- Offboarding Checklist

- Offboarding Task

- Task Assignment

- Task Dependency

- Separation Record Reference

- Clearance Record

- Asset Return Requirement

- Access Revocation Requirement

- Knowledge Transfer Record

- Final Payroll Readiness

- Leave Reconciliation

- Exit Interview

- Offboarding Exception

- Completion Record

---

## 4. Offboarding Case

An Offboarding Case represents one coordinated separation or role-exit process.

An Offboarding Case should contain:

### Identity

- Stable internal ID

- Organization ID

- Offboarding case number

- Employee ID

- Employment ID

- Employment Contract ID, where applicable

- Status

- Offboarding type

- Separation reason

### Employment information

- Department

- Position

- Reporting manager

- Employment type

- Contract type

- Work location

- Last working date

- Employment end date

- Notice date

- Notice period

- Effective separation date

### Coordination

- Offboarding owner

- HR representative

- Manager

- Payroll representative

- ICT representative

- Facilities representative

- Asset representative

- Finance representative

- Legal representative, where required

- Target completion date

- Priority

- Progress

- Clearance status

### Governance

- Initiated by

- Initiated date

- Approved by

- Approval date

- Completed date

- Cancelled date

- Cancellation reason

- Notes

- Correlation ID

- Created date

- Updated date

---

## 5. Offboarding Types

Initial Offboarding types may include:

- Resignation

- Retirement

- Fixed-Term Contract Expiry

- Termination

- Redundancy

- Dismissal

- End of Internship

- End of Temporary Assignment

- End of Secondment

- Transfer to Another Organization

- Death in Service

- Abandonment of Employment

- Internal Role Change

- Access-Only Offboarding

Different Offboarding types may require different Templates, approvals and confidentiality controls.

---

## 6. Offboarding Statuses

### Draft

The Offboarding Case is being prepared.

Rules:

- May be edited

- Tasks have not been released

- May be deleted where no dependent actions exist

### Pending Approval

The separation or Offboarding plan is awaiting required approval.

Rules:

- Sensitive actions must not begin prematurely

- Material changes may require resubmission

### Planned

The Offboarding Case is approved and scheduled.

Rules:

- Task owners may be notified

- Time-sensitive activities may be scheduled

- Access revocation may be queued for the effective date

### In Progress

At least one Offboarding Task is active.

Rules:

- Progress must be visible

- Blocking issues must be identified

- Outstanding clearance obligations must be tracked

### At Risk

The Case is likely to miss its target date.

Examples:

- Assets not returned

- Final Payroll data incomplete

- Knowledge transfer incomplete

- Access-revocation request failed

- Outstanding financial obligation unresolved

### Blocked

A critical dependency prevents completion.

Rules:

- Blocking reason is required

- Responsible owner must be identified

- Escalation may be triggered

### Awaiting Final Day

All preparatory actions are complete and the process is waiting for the Employee’s last working date or separation date.

### Separation Effective

The employment separation date has occurred.

Rules:

- Required access changes must be confirmed

- Final Payroll and post-separation actions may continue

- Employment status must be validated

### Clearance Pending

The Employee has separated, but one or more clearance obligations remain open.

### Final Payroll Pending

Employment separation is effective, but final payment processing remains incomplete.

### Completed

All mandatory Offboarding activities are complete.

Rules:

- Clearance must be confirmed or formally excepted

- Required access must be removed

- Final obligations must be recorded

- Completion summary must be retained

### Cancelled

The Offboarding will not proceed.

Examples:

- Resignation withdrawn and accepted

- Contract extended

- Termination decision reversed

- Internal transfer approved

Rules:

- Reason is required

- Cross-domain actions already performed must be reviewed and reversed through their owning domains

- History remains auditable

### Archived

The completed or cancelled Case is retained for history and reporting.

---

## 7. Typical Life Cycle

```text

Draft

  ↓

Pending Approval

  ↓

Planned

  ↓

In Progress

  ↓

Awaiting Final Day

  ↓

Separation Effective

  ↓

Clearance Pending

  ↓

Final Payroll Pending

  ↓

Completed

  ↓

Archived