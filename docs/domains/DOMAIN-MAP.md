# Q-NXUS Domain Map

## 1. Purpose

This document defines the major business domains within Q-NXUS and establishes ownership boundaries for data, rules, workflows and services.

Every new feature must be assigned to one primary domain before development begins.

A domain owns the business meaning and rules. Code modules implement those rules.

---

## 2. Domain Structure

Q-NXUS is organized into the following domains:

- Core Platform

- Identity and Security

- People

- Payroll

- Leave

- Recruitment

- Notifications

- Audit

- File Management

- Workflow

- Reporting

- Administration

- Future Enterprise Domains

---

## 3. Core Platform Domain

Core Platform owns shared capabilities required by all domains.

### Responsibilities

- Application identity

- Organization configuration

- Global settings

- Module registry

- Module health

- Shared IDs

- Application events

- Error references

- Search infrastructure

- Shared configuration

- Shared service contracts

### Core rule

Business domains must not recreate shared platform capabilities independently.

### Application chrome

Live product/org branding resolves via `getApplicationChrome()`: prefer
**Organization** for customer org name, short name, and code; use
`appConfig.displayName` only as the generic product/software label. Do not treat
hardcoded “Acme” / “Q-NXUS” defaults as the live sidebar source when a DB org exists.

### FeatureControl and ReferenceData

- **FeatureControl** — runtime flags enforced through `isFeatureEnabled` at
  module entry gates (e.g. payroll access). Admin UI remains the editor for
  those flags.
- **ReferenceData** — used for typed catalogs such as LOCATION_TYPE. Do not
  present unused reference-data sets as fully platform-ready until consumers
  exist.

---

## 4. Identity and Security Domain

Identity and Security owns access to Q-NXUS.

### Responsibilities

- Users

- Roles

- Permissions

- Authentication

- Sessions

- Password policies

- Access policies

- Security events

- Account activation

- Account suspension

- Multi-factor authentication

- Future directory integration

### Ownership examples

- User account: Identity and Security

- Employee record: People

- Payroll access permission: Identity and Security

- Salary data: People or Payroll, depending on purpose

A user account and an employee record are related but must remain separate concepts.

---

## 5. People Domain

The People domain owns the authoritative employee and employment record.

### Responsibilities

- Employee

- Person information

- Departments

- Positions

- Reporting lines

- Employment

- Contracts

- Compensation history

- Work locations

- Qualifications

- Emergency contacts

- Dependants

- Employee documents

- Employment status

- Employee movement history

### Core rule

The People domain is the source of truth for employee identity and employment information.

Other domains reference employees by stable internal ID.

### Examples

- Employee name: People

- Employee number: People

- Department: People

- Position: People

- Contract: People

- Current salary agreement: People

- Historical salary change: People

### Department vs BusinessUnit

**Department (People)** is the operational org structure used by employees,
positions, leave routing, and payroll. It is the source of truth for people
hierarchy.

**BusinessUnit (Administration / Core)** is optional cost/admin structure and
must not be treated as interchangeable with Department. Do not merge the tables
unless a future migration explicitly consolidates them.

---

## 6. Payroll Domain

Payroll owns payroll-specific configuration, calculations, processing and historical pay results.

### Responsibilities

- Payroll profile

- Pay groups

- Payroll periods

- Pay runs

- Earnings

- Allowances

- Deductions

- Statutory deductions

- Contract gratuity policy, settlements, and tax remittance (see `CONTRACT-GRATUITY.md`)

- Overtime

- Adjustments

- Payroll approvals

- Payroll locking

- Payslips

- Bank files / payment batches (payment layer — see `PAYROLL-BANKING.md`)

- Payroll payment snapshots (Calc ≠ Payment)

- Payroll reports

- Year-to-date payroll values

- Payroll snapshots

### Core rule

Payroll consumes approved employee and compensation data from the People domain but must preserve its own immutable historical snapshots.

### Ownership examples

- Employee bank account master record: People

- Payroll payment method: Payroll

- Current salary agreement: People

- Calculated gross pay: Payroll

- Deduction rule: Payroll

- Completed payslip: Payroll

---

## 7. Leave Domain

Leave owns employee absence rules and transactions.

### Responsibilities

- Leave types

- Leave policies

- Leave requests

- Leave approvals

- Leave balances

- Leave accrual

- Leave calendar

- Return-to-work tracking

- Leave-related payroll indicators

### Core rule

Leave references the employee but does not own the employee record.

Leave may publish events that affect People or Payroll, but must not directly modify their internal data.

---

## 8. Recruitment Domain

Recruitment owns pre-employment activity.

### Responsibilities

- Vacancies

- Job postings

- Applicants

- Applications

- Screening

- Interviews

- Assessments

- Offers

- Candidate documents

- Recruitment approvals

- Recruitment status

### Core rule

An applicant becomes an employee only through an approved conversion process into the People domain.

Recruitment must not directly create active payroll records.

---

## 9. Notifications Domain

Notifications owns persistent user notifications and delivery rules.

### Responsibilities

- Notification records

- Recipients

- Read and unread state

- Severity

- Notification rules

- Notification preferences

- Delivery channels

- Reminders

- Escalations

- Expiry

- Notification history

### Core rule

Business domains publish events. Notifications determines who is informed, when and through which channel.

---

## 10. Audit Domain

Audit owns immutable accountability records.

### Responsibilities

- User actions

- Data changes

- Security activity

- Module activity

- Before and after values

- Access to sensitive data

- Error references

- Correlation IDs

- Audit search

- Audit exports

- Retention controls

### Core rule

Business modules request audit recording through a shared audit service. They must not maintain unrelated audit systems.

---

## 11. File Management Domain

File Management owns stored files and attachment metadata.

### Responsibilities

- File storage

- File metadata

- Uploads

- Downloads

- File categories

- Versions

- Retention

- Access control

- Virus scanning

- Storage providers

- Attachment references

### Core rule

Business domains own the meaning of documents. File Management owns storage and retrieval.

Example:

- Employment contract meaning: People

- Contract file storage: File Management

---

## 12. Workflow Domain

Workflow owns configurable approval and task processes.

### Responsibilities

- Workflow definitions

- Steps

- Approvers

- Assignments

- Delegation

- Escalation

- Due dates

- Task status

- Approval history

- Workflow events

### Core rule

A business domain defines when approval is required. Workflow manages the approval process.

---

## 13. Reporting Domain

Reporting owns cross-domain analytical and reporting capabilities.

### Responsibilities

- Report definitions

- Report permissions

- Dashboards

- Exports

- Scheduled reports

- Data aggregation

- Cross-domain analytics

- Historical reporting

- Printable formats

### Core rule

Reporting reads from approved domain views or reporting models. It must not bypass domain security rules.

---

## 14. Administration Domain

Administration owns configurable platform management.

### Responsibilities

- Organization settings

- Branding

- Feature controls

- Module enablement

- Reference data

- Notification settings

- Retention settings

- Integration settings

- System preferences

- Administrative tools

### Core rule

Administration configures the platform but must not contain unrelated business logic.

---

## 15. Future Enterprise Domains

Q-NXUS may later include:

### Procurement

- Requisitions

- RFQs

- Tenders

- Evaluations

- Purchase orders

- Suppliers

- Contracts

- Procurement approvals

### Assets

- Asset register

- Asset assignment

- Maintenance

- Depreciation references

- Asset movement

- Disposal

### Projects

- Projects

- Tasks

- Milestones

- Resources

- Risks

- Budgets

- Status reporting

### Fleet

- Vehicles

- Drivers

- Fuel

- Maintenance

- Inspections

- Assignment

### Finance

- Budgets

- Cost centres

- General ledger integration

- Financial approvals

- Payments

- Financial reporting

These future domains must follow the same ownership and isolation rules.

---

## 16. Domain Interaction Rules

Domains may interact through:

- Shared service contracts

- Application services

- Queries

- Commands

- Events

- Read models

- Approved integration interfaces

Domains must not:

- Reach directly into another domain’s internal repository

- Modify another domain’s tables without an approved service

- Duplicate master data without a clear snapshot requirement

- Embed unrelated business rules in page components

- Depend on another domain’s UI implementation

---

## 17. Example Ownership Decisions

| Business Concept | Owning Domain |

|---|---|

| Employee | People |

| User account | Identity and Security |

| Department | People |

| Position | People |

| Contract | People |

| Current salary agreement | People |

| Payroll profile | Payroll |

| Payroll period | Payroll |

| Pay run | Payroll |

| Payslip | Payroll |

| Leave request | Leave |

| Applicant | Recruitment |

| Notification | Notifications |

| Audit event | Audit |

| Stored file | File Management |

| Approval workflow | Workflow |

| Cross-domain report | Reporting |

| Application branding | Administration |

---

## 18. Payroll Period and Pay Run

### Payroll Period

A Payroll Period is the date range for which payroll is processed.

Example:

- Monthly payroll

- July 2026

- 1 July 2026 to 31 July 2026

A Payroll Period may contain more than one Pay Run.

### Pay Run

A Pay Run is a payroll processing event for a Payroll Period.

Examples:

- Main July 2026 pay run

- Correction run

- Adjustment run

- Final payment run

The Payroll Period defines the time covered.

The Pay Run defines the processing event.

---

## 19. Delete, Archive and Deactivate

These actions are distinct and must not be used interchangeably.

### Delete

Permanently removes eligible data.

Use only where:

- No dependent records exist

- No legal or audit retention applies

- The record is safe to remove

- The user has elevated permission

### Archive

Preserves a record for historical or audit purposes while removing it from normal active workflows.

Archived records may be restorable.

### Deactivate

Temporarily prevents a record from being used in new transactions while preserving it for possible reactivation.

A record may be inactive without being archived.

### Soft-delete matrix (current platform)

There is no generic `deletedAt` column. Prefer status / archive fields:

| Entity family | Prefer | Notes |
| --- | --- | --- |
| Employee / User | Archive / deactivate (`isArchived`, `archivedAt`, account status) | Hard delete only via controlled demo reset |
| Department / Position | Deactivate (`isActive`) | Hard delete only when safe (no dependents) |
| Employment contracts | Lifecycle statuses (SUPERSEDED, TERMINATED, …) | Do not hard-delete posted history |
| Pay runs / Payslips | Draft delete only; POSTED is immutable | Snapshot JSON + denormalized columns freeze together |
| Roles / UserRoles | Revoke (`REVOKED`) with effective window | Do not delete assignment history casually |
| Correspondence | Archive / retention jobs | Keep audit trail |
| Core config (BusinessUnit, FeatureControl, ReferenceData) | `ConfigurationStatus` / `isEnabled` | ReferenceData is used for LOCATION_TYPE; FeatureControl is gated via `isFeatureEnabled` |

---

## 20. Governing Question

Before implementing any feature, ask:

> Which domain owns this business concept and its rules?

If ownership is unclear, development should pause until the boundary is agreed.