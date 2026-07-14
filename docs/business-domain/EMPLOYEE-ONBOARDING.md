# Employee Onboarding Domain Specification

## 1. Purpose

Employee Onboarding coordinates the controlled transition of an accepted Candidate or approved new Employee into active organizational service.

Onboarding does not own the authoritative Employee, Position, Contract, Compensation, Payroll, User Account or Asset records.

It coordinates tasks across those domains and confirms that required activities are completed before the Employee is considered operationally ready.

The onboarding process may include:

- Employee record preparation

- Employment Contract completion

- Compensation approval

- Payroll setup

- User-account provisioning

- Equipment assignment

- Access-card issuance

- Orientation

- Policy acknowledgement

- Training

- Workstation preparation

- Department handover

- Probation setup

- Initial objectives

- Completion confirmation

---

## 2. Domain Ownership

Primary owner:

- People Domain

Supporting domains:

- Recruitment

- Payroll

- Identity and Security

- Assets

- File Management

- Workflow

- Notifications

- Audit

- Leave

- Administration

- Training

- Facilities

Onboarding owns:

- Onboarding Case

- Onboarding Template

- Onboarding Task

- Onboarding Checklist

- Onboarding Assignment

- Onboarding Dependency

- Onboarding Readiness

- Onboarding Exception

- Onboarding Completion

Other domains continue to own their records.

Examples:

- Employee record: People

- Payroll Profile: Payroll

- User account: Identity and Security

- Laptop assignment: Assets

- Access card: Facilities or Identity and Security

- Contract document: People and File Management

---

## 3. Core Business Objects

The Employee Onboarding capability should include:

- Onboarding Case

- Onboarding Template

- Onboarding Checklist

- Onboarding Task

- Task Assignment

- Task Dependency

- Onboarding Milestone

- Onboarding Document Requirement

- Onboarding Exception

- Onboarding Readiness Result

- Orientation Record

- Policy Acknowledgement

- Equipment Request

- Access Request

- Completion Record

---

## 4. Onboarding Case

An Onboarding Case represents one Employee’s onboarding process.

An Onboarding Case should contain:

### Identity

- Stable internal ID

- Organization ID

- Onboarding case number

- Candidate ID, where applicable

- Employee ID

- Recruitment Application ID, where applicable

- Accepted Offer ID, where applicable

- Status

- Onboarding type

### Employment information

- Department

- Position

- Employment type

- Contract type

- Work location

- Reporting manager

- Proposed start date

- Confirmed start date

- Probation requirement

- Payroll eligibility indicator

### Coordination

- Onboarding owner

- Hiring manager

- HR representative

- Payroll representative

- ICT representative

- Facilities representative

- Due date

- Priority

- Overall progress

- Readiness status

### Governance

- Created by

- Created date

- Started date

- Completed date

- Cancelled date

- Cancellation reason

- Notes

- Correlation ID

---

## 5. Onboarding Types

Initial Onboarding types may include:

- New Employee

- Internal Transfer

- Promotion

- Rehire

- Temporary Assignment

- Acting Appointment

- Secondment

- Contractor

- Intern

- Returning Employee

- Executive Appointment

Different onboarding types may use different templates and required tasks.

---

## 6. Onboarding Statuses

### Draft

The Onboarding Case is being prepared.

Rules:

- Tasks may be configured

- Employee start has not been confirmed

- Case may be deleted where no dependent actions exist

### Planned

The Case is approved and scheduled.

Rules:

- Proposed start date is known

- Responsible teams may be notified

- Tasks may be assigned

### In Progress

At least one onboarding task is active.

Rules:

- Progress must be visible

- Blocking issues must be identified

- Responsible users must receive reminders

### At Risk

The Case is likely to miss a required date.

Examples:

- Contract unsigned

- Payroll setup incomplete

- Equipment unavailable

- User account not provisioned

- Mandatory document missing

### Blocked

One or more critical dependencies prevent onboarding progression.

Rules:

- Blocking reason is required

- Responsible owner must be identified

- Escalation may be generated

### Ready for Start

All mandatory pre-start requirements are complete.

Rules:

- Employee may commence work

- Outstanding non-blocking tasks may remain

- Readiness confirmation must be recorded

### Started

The Employee has commenced service.

Rules:

- Actual start date is required

- Day-one tasks may begin

- Payroll and employment effective dates must be validated

### Monitoring

The Employee has started, but post-start onboarding activities remain open.

Examples:

- Probation check-in

- Mandatory training

- Policy acknowledgements

- Equipment confirmation

### Completed

All mandatory onboarding activities are complete.

Rules:

- Completion must be confirmed

- Outstanding optional tasks must be closed or transferred

- Final readiness summary must be stored

### Cancelled

The onboarding will not proceed.

Examples:

- Candidate withdrew

- Offer withdrawn

- Start cancelled

- Position no longer available

Rules:

- Reason is required

- Related domain records must be handled according to their own lifecycle rules

- History must remain auditable

### Archived

The completed or cancelled Case is retained for history and reporting.

---

## 7. Typical Life Cycle

```text

Draft

  ↓

Planned

  ↓

In Progress

  ↓

Ready for Start

  ↓

Started

  ↓

Monitoring

  ↓

Completed

  ↓

Archived