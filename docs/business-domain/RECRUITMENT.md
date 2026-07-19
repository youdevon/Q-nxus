# Recruitment Domain Specification

## 1. Purpose

The Recruitment domain manages the process of identifying vacancies, attracting candidates, evaluating applicants, issuing offers and converting approved candidates into Employees.

Recruitment owns all pre-employment activity.

It does not own the authoritative Employee record, Employment Contract, Compensation record or Payroll Profile.

Those records are created through controlled handoff processes after an approved candidate accepts an offer.

---

## 2. Domain Ownership

Primary owner:

- Recruitment Domain

Shared consumers:

- People

- Workflow

- Notifications

- Reporting

- Audit

- File Management

- Administration

- Employee Onboarding

- Payroll, indirectly after employment begins

Recruitment owns:

- Vacancy

- Requisition

- Job Posting

- Candidate

- Application

- Screening

- Interview

- Assessment

- Reference Check

- Background Check

- Offer

- Candidate Communication

- Recruitment Decision

- Recruitment Pipeline

People owns:

- Employee

- Employment

- Position assignment

- Employment Contract

- Compensation

- Personal employment history

Payroll owns:

- Payroll Profile

- Payroll eligibility

- Pay Group

- Payroll processing

---

## 3. Core Business Objects

The Recruitment domain should include:

- Recruitment Requisition

- Vacancy

- Job Posting

- Candidate

- Candidate Profile

- Application

- Screening Record

- Interview

- Interview Panel

- Assessment

- Reference Check

- Background Check

- Shortlist

- Recruitment Decision

- Offer

- Candidate Communication

- Candidate Document

- Conversion Record

- Recruitment Exception

---

## 4. Recruitment Requisition

A Recruitment Requisition is the formal request to fill a Position.

A requisition should contain:

### Identity

- Stable internal ID

- Organization ID

- Requisition number

- Status

- Recruitment type

### Position information

- Position ID

- Department ID

- Position

- Number of vacancies

- Employment type

- Contract type

- Work location

- Reporting Position

- Grade or classification

### Business justification

- Reason for recruitment

- Replacement or new Position

- Replaced Employee, where applicable

- Budget confirmation

- Expected start date

- Urgency

- Supporting notes

### Governance

- Requested by

- Request date

- Approval status

- Approved by

- Approval date

- Finance confirmation, where required

- HR review

- Recruitment owner

- Target completion date

- Created date

- Updated date

---

## 5. Requisition Types

Initial recruitment types may include:

- Replacement

- New Position

- Additional Headcount

- Temporary Cover

- Acting Appointment

- Internship

- Graduate Programme

- Project-Based Recruitment

- Contract Renewal Competition

- Succession Recruitment

Recruitment types should later be configurable.

---

## 6. Requisition Statuses

### Draft

The requisition is being prepared.

Rules:

- May be edited

- Must not create a Vacancy

- May be deleted where no dependency exists

### Pending Approval

The requisition has entered the approval process.

Rules:

- Material editing should be restricted

- Changes may require resubmission

### Approved

The requisition is authorized for recruitment activity.

Rules:

- Vacancy and Job Posting may be created

- Approved headcount must be respected

### Rejected

The requisition was not approved.

Rules:

- Rejection reason is required

- Record remains auditable

### On Hold

Recruitment activity is temporarily paused.

Rules:

- Reason is required

- New applications may be disabled where appropriate

- Existing candidate records remain preserved

### In Progress

Recruitment activity has begun.

### Filled

All approved vacancies under the requisition have been filled.

### Partially Filled

Some vacancies have been filled while others remain open.

### Cancelled

The requisition will no longer proceed.

Rules:

- Reason is required

- Existing candidate and application records remain preserved

### Closed

All recruitment activity is complete.

### Archived

The requisition is retained for long-term history and reporting.

---

## 7. Vacancy

A Vacancy represents an approved employment opportunity associated with a Position.

A Vacancy should contain:

- Stable internal ID

- Organization ID

- Vacancy number

- Requisition ID

- Position ID

- Department ID

- Vacancy title

- Number of openings

- Employment type

- Contract type

- Work location

- Grade or classification

- Proposed compensation range

- Expected start date

- Hiring manager

- Recruiter

- Status

- Open date

- Close date

- Filled count

- Remaining count

Rules:

- A Vacancy must reference an approved Recruitment Requisition.

- A Vacancy must reference an active or otherwise approved Position.

- Vacancy count must not exceed approved headcount without authorization.

- Filled count should be derived from successful recruitment outcomes.

- Historical Vacancy data must not be overwritten when Position details later change.

---

## 8. Vacancy Statuses

Initial statuses:

- Draft

- Approved

- Open

- Paused

- Closed

- Filled

- Partially Filled

- Cancelled

- Archived

Rules:

- Draft Vacancies must not accept applications.

- Open Vacancies may receive applications.

- Paused Vacancies may preserve existing applications but block new submissions.

- Filled Vacancies cannot receive new applications.

- Cancelled Vacancies must retain candidate and application history.

---

## 9. Job Posting

A Job Posting is the published representation of a Vacancy.

A Vacancy may have multiple Job Postings.

Examples:

- Internal posting

- External careers page

- Newspaper advertisement

- Recruitment agency listing

- Social-media posting

- Government employment portal

A Job Posting should contain:

- Stable internal ID

- Vacancy ID

- Posting type

- Title

- Description

- Responsibilities

- Qualifications

- Experience requirements

- Skills

- Work location

- Compensation disclosure, where permitted

- Application instructions

- Opening date

- Closing date

- Publication channel

- External reference

- Status

- Version

- Created date

- Updated date

---

## 10. Job Posting Rules

- A Job Posting must reference one Vacancy.

- Publication requires approved content.

- Closing date cannot be earlier than opening date.

- Material changes after publication should create a new version.

- Internal and external postings may use different content.

- Candidate applications must preserve the Job Posting version used.

- Closed Job Postings must not accept new applications.

- Extending a closing date must be audited.

---

## 11. Candidate

A Candidate is a person who may apply for employment.

A Candidate record is not an Employee record.

A Candidate should contain:

### Identity

- Stable internal ID

- Organization scope, where applicable

- Candidate number

- Full name

- Preferred name

- Email

- Telephone

- Address

- Country

- Preferred contact method

### Professional information

- Current employer

- Current position

- Employment history

- Education

- Qualifications

- Certifications

- Skills

- Years of experience

- Professional memberships

### Governance

- Consent status

- Privacy acknowledgement

- Data-retention date

- Candidate source

- Duplicate-detection status

- Created date

- Updated date

Sensitive candidate information must be permission-controlled.

---

## 12. Candidate and Employee Distinction

A Candidate and Employee are separate concepts.

Rules:

- A Candidate may apply for multiple Vacancies.

- A Candidate may never become an Employee.

- An Employee may later become an internal Candidate.

- Candidate data must not automatically overwrite Employee data.

- Candidate conversion must use a controlled process.

- The Employee record should reference the originating Candidate where appropriate.

- Candidate history must remain preserved after conversion.

---

## 13. Candidate Sources

Possible Candidate sources:

- Careers page

- Internal application

- Employee referral

- Recruitment agency

- Job board

- Social media

- Direct application

- Graduate programme

- Professional network

- Talent pool

- Manual entry

- Imported application

Candidate source should be recorded for reporting and recruitment effectiveness.

---

## 14. Application

An Application represents a Candidate’s submission for one Vacancy or Job Posting.

An Application should contain:

### Identity

- Stable internal ID

- Application number

- Candidate ID

- Vacancy ID

- Job Posting ID

- Status

### Submission information

- Application date

- Cover letter

- Résumé or CV reference

- Supporting documents

- Screening answers

- Source

- Internal or external Candidate

- Expected salary, where permitted

- Availability date

- Notice period

- Work authorization status, where relevant

### Governance

- Consent confirmation

- Submitted version

- Assigned recruiter

- Current pipeline stage

- Rejection reason, where applicable

- Withdrawal reason, where applicable

- Created date

- Updated date

---

## 15. Application Statuses

### Draft

The Application is being prepared.

### Submitted

The Application was received.

### Under Review

Recruitment is reviewing eligibility and suitability.

### Screening

The Candidate is undergoing initial screening.

### Shortlisted

The Candidate has been selected for further assessment.

### Assessment

The Candidate is completing an assessment.

### Interview

The Candidate is in the interview stage.

### Reference Check

References are being reviewed.

### Background Check

Approved verification is underway.

### Offer Pending

An Offer is being prepared or approved.

### Offer Issued

An Offer has been sent.

### Offer Accepted

The Candidate accepted the Offer.

### Offer Declined

The Candidate declined the Offer.

### On Hold

The Application remains valid but activity is paused.

### Rejected

The Candidate will not proceed.

### Withdrawn

The Candidate withdrew.

### Hired

The Candidate completed the approved hiring conversion.

### Archived

The Application is retained for history.

---

## 16. Application Business Rules

- One Candidate may have multiple Applications.

- Duplicate Applications to the same Vacancy should be prevented or flagged.

- An Application must preserve the Vacancy and Job Posting details used at submission.

- Closing a Vacancy must not delete existing Applications.

- Rejection requires an approved reason category.

- Candidates should not be rejected solely through free-text without a standardized reason.

- Candidate withdrawal must be distinguished from employer rejection.

- Pipeline movement must be audited.

- Sensitive screening information must have restricted access.

---

## 17. Recruitment Pipeline

A Recruitment Pipeline defines the sequence of stages for a Vacancy.

Example:

```text

Application Received

  ↓

Initial Screening

  ↓

Shortlist

  ↓

Assessment

  ↓

First Interview

  ↓

Final Interview

  ↓

Reference Check

  ↓

Offer

  ↓

Hire