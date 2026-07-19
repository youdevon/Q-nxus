

Then open `docs/business-domain/POSITION.md` and paste:

```md

# Position Domain Specification

## 1. Purpose

A Position represents a defined job within the organization.

A Position describes the organizational role that may be occupied by an employee. It is separate from the employee and may exist whether occupied or vacant.

Examples:

- Senior ICT Officer

- Human Resource Officer

- Payroll Clerk

- Procurement Manager

- Administrative Assistant

The Position belongs to the People domain.

---

## 2. Domain Ownership

Primary owner:

- People Domain

Shared consumers:

- Employee Management

- Recruitment

- Payroll

- Leave

- Reporting

- Workflow

- Administration

Other domains may reference the Position by stable internal ID.

---

## 3. Core Information

A Position should contain:

- Stable internal ID

- Organization ID

- Department ID

- Title

- Position code

- Description

- Reporting position

- Grade or classification

- Employment category

- Authorized headcount

- Occupied headcount

- Work location, where applicable

- Status

- Effective date

- End date, where applicable

- Created date

- Updated date

---

## 4. Position and Employee Distinction

A Position is not an Employee.

Example:

```text

Position: Senior ICT Officer

Employee: Devon Smith