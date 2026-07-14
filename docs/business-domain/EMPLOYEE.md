# Employee Domain Specification

## 1. Purpose

The Employee represents a person who has, or previously had, a formal employment relationship with the organization.

The Employee record is the central personnel record used by HR, Payroll, Leave, Contracts, Documents, Reporting and future Q-NXUS modules.

Other modules must reference the Employee record rather than create separate employee directories.

---

## 2. Domain Ownership

Primary owner:

- HR Module

Shared consumers:

- Payroll

- Leave

- Contracts

- Documents

- Recruitment

- Benefits

- Reporting

- Audit

- Notifications

HR owns the authoritative employee record.

Other modules may consume approved employee data through stable services, queries or shared contracts.

---

## 3. Employee Identity

Each employee must have:

- A stable internal system ID

- A unique employee number within the organization

- A legal first name

- A legal last name

- An employment status

- An employment type

- A hire date

- An organization

The internal system ID must never change.

The employee number may be visible to users and used in reports, searches, payroll and exports.

---

## 4. Core Employee Information

The Employee record may contain:

### Personal information

- Legal first name

- Middle name

- Legal last name

- Preferred name

- Date of birth

- Gender, where required and legally permitted

- Nationality

- Marital status, where required

- National identification number

- Passport number

- Profile photo

### Contact information

- Personal email

- Work email

- Mobile phone

- Home phone

- Residential address

- Mailing address

### Employment information

- Employee number

- Organization

- Department

- Position

- Reporting manager

- Employment type

- Employment status

- Hire date

- Probation end date

- Retirement date

- Termination date

- Work location

### Related records

- Contracts

- Compensation history

- Payroll profile

- Leave records

- Documents

- Qualifications

- Emergency contacts

- Dependants

- Benefits

- Notes

- Audit history

Sensitive fields must be protected by permissions and must not be exposed unnecessarily.

---

## 5. Employee Statuses

The initial employee statuses are:

### Draft

The record is incomplete and has not yet been activated.

Rules:

- May be edited

- Must not appear in Payroll

- Must not be included in active headcount

- May be deleted only if it has no dependent records

### Active

The employee is currently employed and eligible for normal HR processes.

Rules:

- Included in active headcount

- May be eligible for Payroll

- May submit or receive Leave records

- May have an active contract

- May receive notifications

### On Leave

The employee remains employed but is currently on an approved leave status.

Rules:

- Remains part of active headcount

- Payroll eligibility depends on leave type and policy

- Return-to-work date may be required

### Suspended

The employee remains employed but normal access or duties are temporarily restricted.

Rules:

- Remains in history and reporting

- Payroll treatment depends on policy

- Requires an effective date and reason

- Requires audit logging

### Inactive

The employee record remains valid but is not currently available for normal operational use.

Rules:

- Excluded from active selection lists

- May be reactivated

- Remains visible through filters

- Must not lose historical records

### Terminated

The employment relationship has ended.

Rules:

- Requires termination date

- Requires termination reason

- Payroll must preserve all historical data

- Employee must not be included in future normal pay runs unless a final or adjustment payment is authorized

- Record cannot be deleted

### Retired

The employee has ended employment through retirement.

Rules:

- Requires retirement date

- Remains available for reporting and history

- May retain post-employment benefit records

- Record cannot be deleted

### Archived

The record is preserved for historical, legal or audit purposes and removed from normal active workflows.

Rules:

- Read-only except for authorized restoration or administrative correction

- Excluded from normal searches unless archived records are included

- Must remain available for audit and reporting

- May be restored by an authorized user

- Must not be physically deleted

---

## 6. Employment Types

The initial employment types are:

- Permanent

- Contract

- Temporary

- Part-time

- Intern

- Consultant

Employment types must be configurable later.

An employment type must not determine all payroll rules by itself. Payroll eligibility and treatment must be separately defined.

---

## 7. Life Cycle

The normal Employee life cycle is:

```text

Draft

  ↓

Active

  ↓

On Leave / Suspended / Inactive

  ↓

Active

  ↓

Terminated or Retired

  ↓

Archived