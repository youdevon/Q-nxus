# Q-NXUS Software Architecture & Design Manual

## 1. Product Identity

- Internal codename: Q-NXUS

- Customer-facing name: Configurable

- Application type: Modular enterprise management platform

- Initial modules: Human Resources and Payroll

- Future modules may include Leave, Recruitment, Assets, Procurement, Projects, Fleet, Finance and other business functions.

Q-NXUS must remain configurable, modular, secure, auditable and easy to extend.

---

## 2. Architecture Strategy

Q-NXUS will begin as a modular monolith with strict module boundaries.

The initial application consists of:

- Core Platform

- HR Module

- Payroll Module

- Notifications Module

- Audit Module

- Administration Module

Modules must not directly depend on one another’s internal implementation.

Shared capabilities belong in Core.

The application should be capable of separating major modules into independent services later without requiring a complete rewrite.

---

## 3. Core Platform Responsibilities

Core owns shared platform services, including:

- Application configuration

- Organization settings

- Authentication

- Users

- Roles

- Permissions

- Module registry

- Module health

- Shared employee identity

- Files and attachments

- Notifications

- Audit logging

- Error handling

- Search

- Common workflows

- Shared UI components

No business module should recreate these capabilities independently.

---

## 4. Module Boundaries

### HR Module

HR owns:

- Employee profiles

- Employment records

- Departments

- Positions

- Contracts

- Employment history

- Leave information

- HR documents

- Emergency contacts

- Qualifications

- Dependants

- Employee status changes

### Payroll Module

Payroll owns:

- Payroll profiles

- Pay periods

- Pay runs

- Earnings

- Allowances

- Deductions

- Statutory deductions

- Overtime

- Adjustments

- Payroll approvals

- Payslips

- Bank exports

- Payroll reports

- Payroll history

Payroll must consume approved employee and compensation data through stable services or shared contracts.

Payroll must preserve historical snapshots used for completed pay runs.

### Notifications Module

Notifications owns:

- Notification records

- Recipients

- Read and unread state

- Notification rules

- Delivery channels

- Notification preferences

- Event reminders

- Notification history

### Audit Module

Audit owns:

- User actions

- Data changes

- Module activity

- Security events

- Error references

- Before and after values

- Date and time

- User and source information

- Correlation identifiers

---

## 5. Failure Isolation

A failure in one module must not make the entire application unavailable.

Examples:

- If Payroll is unavailable, HR must remain accessible.

- If Notifications fail, employee records must still save.

- If reporting fails, transactional modules must continue operating.

- If a background job fails, the main web interface must remain responsive.

Each module must implement:

- Local error boundaries

- Clear health status

- Independent background processing where required

- Graceful fallback messages

- Module-specific logging

- Retry-safe operations where appropriate

---

## 6. Employee Record Principle

The employee record is the primary source of truth for personnel information.

Payroll must not maintain an unrelated duplicate employee directory.

The employee identity must use a stable internal identifier.

Payroll may store immutable snapshots of:

- Employee name

- Employee number

- Department

- Position

- Salary

- Allowances

- Deductions

- Bank information

- Tax information

These snapshots preserve historical payroll accuracy after employee records change.

---

## 7. Event-Driven Communication

Modules should publish business events rather than directly controlling unrelated modules.

Examples:

- EmployeeCreated

- EmployeeUpdated

- ContractExpiring

- LeaveApproved

- SalaryChanged

- PayrollStarted

- PayrollApproved

- PayrollFailed

- PayslipGenerated

The receiving platform service decides what action to take.

For example, HR publishes ContractExpiring. The notification system determines recipients, timing and delivery.

---

## 8. Notification Standards

All modules must use the centralized notification system.

Notification severity levels:

- Success

- Information

- Warning

- Error

- Critical

Notification layers:

1. Toast notifications

2. Persistent notification centre

3. Page-level alerts

4. Background reminders

Standard toast position:

- Top-right

Standard notification structure:

- Icon

- Title

- Short message

- Source module

- Date and time

- Optional action

- Read or unread state

Technical errors must not expose stack traces or internal database details to normal users.

---

## 9. User Interface Principles

The UI must be:

- Clean

- Modern

- Professional

- Responsive

- Accessible

- Consistent

- Task-focused

- Easy for non-technical staff

- Efficient for frequent users

Avoid:

- Excessive rounded cards

- Decorative clutter

- Unnecessary animation

- Crowded pages

- Duplicate controls

- Inconsistent spacing

- Unclear status indicators

Every module should use the same application shell, page structure and component standards.

---

## 10. Standard Page Structure

Each major page should contain:

1. Page title

2. Page description

3. Primary action

4. Secondary actions

5. Search

6. Filters

7. Main content

8. Pagination where required

9. Page-level alerts

10. Loading, empty and error states

---

## 11. Standard Form Behaviour

Forms should consistently provide:

- Save

- Save and continue where appropriate

- Cancel

- Validation messages

- Unsaved-change protection

- Loading state

- Error state

- Success confirmation

- Audit history

- Notes where required

- Attachments where required

Destructive actions require clear confirmation.

---

## 12. Security Principles

Q-NXUS must use:

- Authentication

- Role-based access control

- Permission-based actions

- Least privilege

- Separation of HR and Payroll access

- Audit logging

- Secure password handling

- Secure session handling

- Input validation

- Output encoding

- Rate limiting where appropriate

- Encrypted transport in production

- Protected sensitive fields

- Backup and recovery procedures

Sensitive payroll and employee information must not be exposed through client-side code or logs.

---

## 13. Data Principles

Database conventions:

- PostgreSQL

- Prisma ORM

- Separate database schemas by module boundary

- Stable internal IDs

- Unique employee numbers per organization

- Effective dating for important employment changes

- Historical records must not be overwritten

- Soft deletion or archival for important business records

- Monetary values use decimal types

- Dates and timestamps use consistent timezone handling

- All critical changes are auditable

Current schemas:

- core

- hr

- payroll

- notifications

- audit

---

## 14. Folder Structure

```text

app/

components/

hooks/

lib/

prisma/

src/

  core/

  modules/

    hr/

    payroll/

    notifications/

    audit/

    admin/

  components/

    layout/

    ui/

  config/

  lib/

  types/

docs/