# Department Domain Specification

## 1. Purpose

A Department represents an organizational unit used to group employees, positions, reporting structures, responsibilities and operational functions.

Examples may include:

- Human Resources

- Finance

- Information and Communication Technology

- Procurement

- Operations

- Administration

The Department is owned by the People domain and may be referenced by Payroll, Leave, Reporting, Workflow and future domains.

---

## 2. Domain Ownership

Primary owner:

- People Domain

Shared consumers:

- Employee Management

- Payroll

- Leave

- Recruitment

- Reporting

- Workflow

- Assets

- Procurement

- Finance

Other domains may reference a Department by stable internal ID but must not maintain unrelated duplicate department records.

---

## 3. Core Information

A Department should contain:

- Stable internal ID

- Organization ID

- Department name

- Department code

- Description

- Parent department, where applicable

- Department head, where assigned

- Cost centre reference, where applicable

- Status

- Effective date

- End date, where applicable

- Created date

- Updated date

---

## 4. Statuses

### Draft

The department is being prepared and is not yet available for normal assignment.

### Active

The department may be assigned to employees, positions, workflows and reports.

### Inactive

The department remains historically valid but cannot be used for new assignments.

### Archived

The department is retained for historical and audit purposes and removed from normal operational use.

---

## 5. Business Rules

- Department name must be unique within the same parent structure where required.

- Department code should be unique within the organization.

- An active employee should normally be assigned to an active department.

- A department may contain multiple positions.

- A department may contain sub-departments.

- A department may have one designated head at a time.

- Historical employee assignments must remain linked to the department that existed at the time.

- Renaming a department must not destroy historical references.

- A department with active employees or positions cannot be deleted.

- An inactive department cannot be selected for new employee or position assignments.

- Archiving a department must preserve historical employee, payroll and reporting records.

- A department must belong to one organization.

- A department cannot be its own parent.

- Circular department hierarchies are not allowed.

---

## 6. Department Hierarchy

Departments may support a parent-child structure.

Example:

```text

Corporate Services

├── Human Resources

├── Information and Communication Technology

└── Procurement