# Workflow and Approvals Domain Specification

## 1. Purpose

The Workflow and Approvals domain provides a reusable engine for routing business records through controlled review, approval, rejection, escalation and completion processes.

It supports approval requirements across Q-NXUS without embedding separate approval logic inside every domain.

Examples include:

- Employment Contract approval

- Compensation approval

- Leave approval

- Recruitment Requisition approval

- Offer approval

- Payroll Profile approval

- Pay Run approval

- Access Request approval

- Onboarding exception approval

- Offboarding clearance approval

- Procurement approval

- Asset-disposal approval

The business domain determines when approval is required.

The Workflow domain coordinates how that approval is completed.

---

## 2. Domain Ownership

Primary owner:

- Workflow Domain

Shared consumers:

- People

- Payroll

- Leave

- Recruitment

- Onboarding

- Offboarding

- Identity and Security

- Notifications

- Audit

- File Management

- Reporting

- Administration

- Future enterprise domains

Workflow owns:

- Workflow Definition

- Workflow Version

- Workflow Instance

- Workflow Step

- Approval Task

- Approval Decision

- Assignment

- Delegation

- Escalation

- Workflow Timer

- Workflow Exception

- Workflow History

Business domains continue to own their underlying records.

Examples:

- Leave owns the Leave Request.

- Workflow owns the approval process for that request.

- Payroll owns the Pay Run.

- Workflow owns the approval process for that Pay Run.

---

## 3. Core Business Objects

The Workflow domain should include:

- Workflow Definition

- Workflow Definition Version

- Workflow Trigger

- Workflow Condition

- Workflow Step Definition

- Workflow Transition

- Workflow Instance

- Workflow Step Instance

- Approval Task

- Task Assignment

- Approval Decision

- Delegation

- Escalation Rule

- Workflow Timer

- Workflow Comment

- Workflow Attachment Reference

- Workflow Exception

- Workflow Event

- Workflow History

---

## 4. Workflow Definition

A Workflow Definition describes a reusable business process.

A Workflow Definition should contain:

### Identity

- Stable internal ID

- Organization ID

- Workflow name

- Workflow code

- Description

- Owning domain

- Business object type

- Status

- Version

### Configuration

- Trigger type

- Start conditions

- Steps

- Transitions

- Approval rules

- Assignment rules

- Escalation rules

- Completion rules

- Cancellation rules

- Effective dates

### Governance

- Drafted by

- Approved by

- Approval date

- Published date

- Superseded date

- Created date

- Updated date

---

## 5. Workflow Definition Statuses

### Draft

The Workflow Definition is being prepared.

Rules:

- May be edited

- Must not start new Workflow Instances

- May be deleted where no dependency exists

### Pending Approval

The Definition is awaiting authorization.

### Published

The Definition may start new Workflow Instances.

Rules:

- Published versions should be immutable

- Changes require a new version

### Inactive

The Definition cannot start new Instances.

Existing Workflow Instances may continue.

### Superseded

A newer version has replaced the Definition.

Existing Instances continue using the version under which they started.

### Archived

The Definition is retained for history and audit.

---

## 6. Workflow Versioning

Every material change to a published Workflow Definition should create a new version.

Rules:

- Existing Workflow Instances remain linked to their original version.

- New Instances use the current published version.

- Published versions must not be silently edited.

- A Workflow version should preserve all Steps, Conditions, Transitions and Assignment rules.

- Version activation must be auditable.

- One version should normally be current for a given effective date.

---

## 7. Workflow Trigger

A Workflow may begin through:

- Manual submission

- Business-domain event

- Record creation

- Status change

- Effective date

- Scheduled process

- Threshold condition

- Integration event

- Administrative action

Examples:

- Contract submitted for approval

- Leave Request submitted

- Pay Run submitted for approval

- Access Request submitted

- Compensation exceeds a configured threshold

- Contract expiry reaches 90 days

A Trigger should contain:

- Trigger type

- Source domain

- Source event

- Business object type

- Conditions

- Effective dates

- Status

---

## 8. Workflow Conditions

Conditions determine whether a Workflow starts or which path it follows.

Possible conditions:

- Amount exceeds threshold

- Employee category

- Department

- Position

- Contract type

- Leave Type

- Request duration

- Pay Group

- Payroll value

- Risk level

- User role

- Organization

- Location

- Exception severity

- Record field value

Rules:

- Conditions must be declarative where possible.

- Conditions must not execute arbitrary unsafe code.

- Condition evaluation must be traceable.

- Failed condition evaluation must create a clear error.

- Historical Workflow Instances must preserve the condition result used.

---

## 9. Workflow Step Types

Initial Step types may include:

### Approval

Requires an authorized user to approve or reject.

### Review

Requires review, comment or confirmation without final approval authority.

### Task

Requires completion of an operational action.

### Notification

Sends a notification without requiring a decision.

### Automated Action

Invokes an approved service or system action.

### Wait

Pauses until a date, duration or event.

### Condition

Selects a path based on defined rules.

### Parallel Group

Starts multiple Steps at the same time.

### Sub-Workflow

Starts another Workflow.

### Completion

Marks the Workflow as complete.

### Cancellation

Ends the Workflow without approval.

---

## 10. Step Definition

A Workflow Step Definition should contain:

- Stable internal ID

- Workflow version ID

- Step code

- Step name

- Description

- Step type

- Sequence

- Assignment rule

- Due-date rule

- Escalation rule

- Approval rule

- Required decision

- Required comment

- Required attachment

- Minimum approvers

- Completion condition

- Skip condition

- Rejection transition

- Approval transition

- Timeout transition

- Status

---

## 11. Sequential Workflows

A sequential Workflow processes Steps in order.

Example:

```text

HR Review

  ↓

Department Head Approval

  ↓

Finance Review

  ↓

Chief Executive Approval