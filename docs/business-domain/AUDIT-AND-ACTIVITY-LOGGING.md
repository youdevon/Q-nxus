# Audit and Activity Logging Domain Specification

## 1. Purpose

The Audit and Activity Logging domain provides a centralized, immutable and searchable record of significant actions performed within Q-NXUS.

It supports:

- Accountability

- Security monitoring

- Regulatory compliance

- Investigation

- Change history

- Administrative oversight

- Error tracing

- User activity review

- Sensitive-data access review

- Cross-domain correlation

The Audit domain records what happened, who or what performed the action, when it occurred, which record was affected and whether the action succeeded.

Audit does not replace operational business history maintained by each domain.

Examples:

- People owns Employment Contract history.

- Payroll owns Pay Run calculation history.

- Workflow owns approval history.

- Audit records the actions performed against those records.

---

## 2. Domain Ownership

Primary owner:

- Audit Domain

Shared consumers:

- Core Platform

- Identity and Security

- People

- Payroll

- Leave

- Recruitment

- Onboarding

- Offboarding

- Workflow

- Notifications

- File Management

- Reporting

- Administration

- Future enterprise domains

Audit owns:

- Audit Event

- Audit Change Set

- Field Change

- Activity Event

- Security Event Reference

- Access Event

- Export Event

- Administrative Event

- Integration Event

- Error Reference

- Correlation Record

- Audit Retention Policy

- Audit Search

- Audit Export

Business domains must not create isolated audit systems unless a specialized operational history is required.

---

## 3. Audit and Business History Distinction

Audit history and business history serve different purposes.

### Business history

Explains how a business object evolved.

Examples:

- Employment Contract version history

- Compensation history

- Leave balance transactions

- Pay Run calculation versions

- Workflow decisions

### Audit history

Explains who performed an action against a record or system capability.

Examples:

- User changed Contract end date

- Payroll Officer viewed bank details

- Administrator revoked a Session

- User exported Employee data

- Background worker failed during Payslip generation

Both may reference the same event, but they must not be treated as identical records.

---

## 4. Core Business Objects

The Audit domain should include:

- Audit Event

- Audit Event Type

- Audit Change Set

- Field Change

- Activity Event

- Sensitive Access Event

- Authentication Event

- Authorization Event

- Export Event

- File Access Event

- Administrative Event

- Background Job Event

- Integration Event

- Error Event

- Correlation Record

- Audit Retention Policy

- Audit Archive

- Audit Export Request

- Audit Review

- Audit Exception

---

## 5. Audit Event

An Audit Event represents one significant action or system occurrence.

An Audit Event should contain:

### Identity

- Stable internal ID

- Organization ID

- Event number

- Event type

- Category

- Severity

- Outcome

### Actor

- Acting User Account ID

- Acting Employee ID, where applicable

- Service Account ID, where applicable

- Background worker ID, where applicable

- Actor type

- Impersonating User ID, where applicable

### Action

- Action code

- Action name

- Description

- Source domain

- Source module

- Source application

- Request method, where applicable

- Route or operation

- Business command

### Target

- Target record type

- Target record ID

- Target record number

- Parent record type

- Parent record ID

- Organization context

- Department context

### Timing

- Event date and time

- Processing duration

- Effective date, where applicable

- Recorded date and time

### Request context

- Session ID

- Correlation ID

- Request ID

- Trace ID

- IP address

- User agent

- Device reference

- Authentication provider

### Governance

- Reason

- Approval reference

- Error reference

- Retention category

- Confidentiality level

- Created by service

---

## 6. Actor Types

Initial Actor types may include:

- User

- Employee

- Administrator

- Service Account

- Integration

- Background Worker

- Scheduled Job

- System Process

- Support User

- Impersonated User

- External Identity

Rules:

- Every Audit Event must identify an Actor type.

- System-generated actions must not be recorded as anonymous where a service identity is available.

- Impersonated actions must identify both the support user and target user.

- Shared accounts should not obscure accountability.

- Service Accounts must have an identified owner.

---

## 7. Audit Event Categories

Initial categories may include:

- Authentication

- Authorization

- Data Creation

- Data Update

- Data Deletion

- Data Archive

- Data Restore

- Approval

- Workflow

- Payroll

- Compensation

- Employee

- Leave

- Recruitment

- Onboarding

- Offboarding

- Notification

- File Access

- Export

- Configuration

- Security

- Integration

- Background Processing

- Error

- Administration

- Reporting

Categories should support filtering and retention policies.

---

## 8. Event Outcomes

Possible outcomes:

### Success

The action completed as intended.

### Partial Success

Some parts completed while others failed.

### Failure

The action did not complete.

### Denied

Authorization or policy prevented the action.

### Cancelled

The action was intentionally stopped.

### Timed Out

The action did not complete within the permitted time.

### Retried

The action was retried after failure.

### Reversed

A later controlled action reversed the earlier business effect.

Outcome must not be inferred only from free-text messages.

---

## 9. Severity Levels

### Informational

Routine significant action.

Examples:

- Record viewed

- Task completed

- Notification read

### Low

Minor concern or non-critical anomaly.

### Medium

Attention may be required.

Examples:

- Repeated failed login

- Overdue administrative action

### High

Significant risk or control failure.

Examples:

- Privileged access change

- Payroll approval override

- Sensitive export

### Critical

Immediate review required.

Examples:

- Deprovisioning failure

- Unauthorized access attempt

- Payroll payment duplication risk

- Audit service failure

Severity must be separate from outcome.

---

## 10. Action Codes

Every audited action should use a stable Action code.

Recommended format:

```text

domain.resource.action