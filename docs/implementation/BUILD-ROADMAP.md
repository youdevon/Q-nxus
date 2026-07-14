# Q-NXUS Implementation Roadmap

## Current Objective

Build the secure platform foundation required to support the People, Payroll and workforce-management domains.

---

## Phase 1 — Platform Foundation

### 1. Database Foundation

- [ ] Review existing Prisma schemas

- [ ] Confirm schema ownership boundaries

- [ ] Add shared enum conventions

- [ ] Add Organization model

- [ ] Add timestamps and record versions

- [ ] Add human-readable numbering support

- [ ] Add idempotency records

- [ ] Add event outbox and inbox

- [ ] Add background-job records

- [ ] Apply and test migration

### 2. Organization Administration

- [ ] Organization model

- [ ] Organization profile

- [ ] Organization statuses

- [ ] Locations

- [ ] Business units

- [ ] Work calendars

- [ ] Public holidays

- [ ] Reference-data sets

- [ ] Reference-data values

- [ ] Feature controls

- [ ] Domain settings

- [ ] Numbering sequences

### 3. Identity and Access Management

- [ ] User Account

- [ ] Employee-link-ready architecture

- [ ] Role

- [ ] Permission

- [ ] Role Assignment

- [ ] Organization Membership

- [ ] Account statuses

- [ ] Session management

- [ ] Default-deny authorization

- [ ] Permission-checking service

- [ ] Route protection

- [ ] Administrative user interface

### 4. Audit Logging

- [ ] Audit Event

- [ ] Audit Action codes

- [ ] Change sets

- [ ] Masked field changes

- [ ] Correlation IDs

- [ ] Request context

- [ ] Server-side Audit service

- [ ] Audit search

- [ ] Record-level timeline

### 5. Notifications

- [ ] Notification model

- [ ] Notification recipients

- [ ] Read and unread status

- [ ] Notification bell

- [ ] Unread counter

- [ ] Notification Centre

- [ ] Toast feedback

- [ ] Alert banners

- [ ] Notification service

- [ ] Domain-event-ready integration

### 6. Core Platform Services

- [ ] Stable identifier standard

- [ ] Error-response standard

- [ ] Correlation middleware

- [ ] Event Outbox

- [ ] Event Inbox

- [ ] Background Jobs

- [ ] Idempotency

- [ ] Retry policies

- [ ] Health checks

- [ ] Readiness and liveness endpoints

- [ ] Structured logging

- [ ] Service-contract conventions

---

## Phase 2 — People Foundation

- [ ] Department

- [ ] Position

- [ ] Employee

- [ ] Employment Contract

- [ ] Compensation

- [ ] Employee directory

- [ ] Employee profile

- [ ] Contract monitoring

---

## Phase 3 — Payroll

- [ ] Payroll Profile

- [ ] Payroll Period

- [ ] Earnings and Deductions

- [ ] Pay Run

- [ ] Payroll exceptions

- [ ] Payroll review and approval

- [ ] Payslip generation

- [ ] Payslip release

---

## Phase 4 — Workforce Operations

- [ ] Leave

- [ ] Recruitment

- [ ] Employee Onboarding

- [ ] Employee Offboarding

- [ ] Asset Management

---

## Phase 5 — Shared Enterprise Services

- [ ] Workflow and Approvals

- [ ] File and Document Management

- [ ] Reporting and Analytics

- [ ] Scheduled reports

- [ ] Executive dashboards

---

## Implementation Rules

1. Each domain owns its database records.

2. Cross-domain table updates are prohibited.

3. Server-side permission checks are mandatory.

4. Important writes must create Audit Events.

5. Important asynchronous actions must be idempotent.

6. Historical records must not be overwritten.

7. Draft, active, inactive, archived and deleted states must remain distinct.

8. Sensitive values must never appear in logs.

9. Every error must have a stable reference.

10. Every migration must be tested before moving to the next domain.