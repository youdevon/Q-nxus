# Identity and Access Management Domain Specification

## 1. Purpose

Identity and Access Management controls how users authenticate to Q-NXUS and what they are authorized to access.

It owns:

- User Accounts

- Authentication

- Sessions

- Roles

- Permissions

- Access Policies

- Account Provisioning

- Account Suspension

- Account Deactivation

- Multi-Factor Authentication

- Password Policies

- Privileged Access

- Service Accounts

- Security Events

- Access Reviews

- Directory Integration

Identity and Access Management is part of the Identity and Security domain.

It does not own the Employee record.

An Employee may exist without a User Account, and a User Account may exist for a person who is not an Employee.

---

## 2. Domain Ownership

Primary owner:

- Identity and Security Domain

Shared consumers:

- Core Platform

- People

- Payroll

- Leave

- Recruitment

- Onboarding

- Offboarding

- Workflow

- Notifications

- Audit

- File Management

- Reporting

- Administration

- Future enterprise domains

Other domains may request access changes but must not directly modify Identity and Security records.

Examples:

- Onboarding requests account creation.

- Offboarding requests account suspension.

- Payroll defines payroll permissions.

- Identity and Security assigns and enforces those permissions.

---

## 3. Core Business Objects

The domain should include:

- User Account

- Authentication Identity

- Role

- Permission

- Role Assignment

- Direct Permission Assignment

- Access Policy

- Organization Membership

- Department Access Scope

- Session

- Authentication Attempt

- Multi-Factor Method

- Password Credential

- Recovery Method

- Privileged Access Assignment

- Service Account

- API Credential

- Access Request

- Access Review

- Security Event

- Account Provisioning Request

- Account Deprovisioning Request

---

## 4. User Account

A User Account represents an identity permitted to access Q-NXUS.

A User Account should contain:

### Identity

- Stable internal ID

- Organization ID

- Username

- Primary email address

- Display name

- Account type

- Status

- Employee ID, where applicable

- External identity reference, where applicable

### Authentication

- Authentication provider

- Password-enabled indicator

- Multi-factor status

- Last password change

- Last successful login

- Last failed login

- Failed login count

- Account lock status

- Account lock expiry

### Access

- Organization memberships

- Assigned roles

- Direct permissions, where permitted

- Department scope

- Location scope

- Data-access scope

- Privileged-access status

### Governance

- Effective start date

- Effective end date

- Created by

- Created date

- Activated by

- Activated date

- Suspended by

- Suspended date

- Deactivated by

- Deactivated date

- Status reason

- Last access review date

- Notes

---

## 5. User Account and Employee Distinction

A User Account and Employee are separate concepts.

Examples:

```text

Employee:

Devon Smith

Senior ICT Officer

User Account:

devon.smith

Roles:

- ICT Administrator

- Employee Self-Service