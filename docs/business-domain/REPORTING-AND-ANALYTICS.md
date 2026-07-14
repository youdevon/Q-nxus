# Reporting and Analytics Domain Specification

## 1. Purpose

The Reporting and Analytics domain provides controlled access to operational reports, management information, dashboards, exports and cross-domain analytical views.

It supports:

- Operational reports

- Management dashboards

- Cross-domain reporting

- Scheduled reports

- Report exports

- Trend analysis

- Summary indicators

- Drill-down reporting

- Historical reporting

- Employee self-service reports

- Regulatory reports

- Executive reporting

- Report subscriptions

- Report delivery

- Data-quality indicators

Reporting reads approved data from business domains.

It must not bypass domain permissions, alter operational records or become an uncontrolled copy of the production database.

---

## 2. Domain Ownership

Primary owner:

- Reporting Domain

Shared consumers:

- Core Platform

- People

- Payroll

- Leave

- Recruitment

- Onboarding

- Offboarding

- Identity and Security

- Workflow

- Notifications

- Audit

- File Management

- Administration

- Finance integrations

- Future enterprise domains

Reporting owns:

- Report Definition

- Report Version

- Report Parameter

- Report Execution

- Report Result

- Dashboard

- Dashboard Widget

- Metric Definition

- Scheduled Report

- Report Subscription

- Export Request

- Reporting Data Model

- Reporting Snapshot

- Reporting Exception

- Report Access Policy

Business domains continue to own their operational records and business rules.

---

## 3. Reporting Principles

Reporting must follow these principles:

- Source domains remain authoritative.

- Reports must respect authorization.

- Sensitive fields require explicit access.

- Historical results must be reproducible where required.

- Large reports should run in background jobs.

- Exports must be audited.

- Reports must identify their data period and generation time.

- Cross-domain metrics must use agreed definitions.

- Reporting must not silently change business data.

- A report result must not be treated as an operational transaction.

---

## 4. Core Business Objects

The domain should include:

- Report Definition

- Report Definition Version

- Report Parameter

- Report Column

- Report Filter

- Report Sort Rule

- Report Grouping Rule

- Report Access Policy

- Report Execution

- Report Result

- Report Result File

- Dashboard

- Dashboard Widget

- Metric Definition

- Metric Result

- Scheduled Report

- Report Subscription

- Report Delivery

- Reporting Snapshot

- Reporting Data Model

- Reporting Exception

- Export Request

- Report Audit History

---

## 5. Report Definition

A Report Definition describes a reusable report.

A Report Definition should contain:

### Identity

- Stable internal ID

- Organization ID

- Report code

- Report name

- Description

- Owning domain

- Report category

- Status

- Version

### Configuration

- Data source

- Reporting model

- Columns

- Filters

- Parameters

- Grouping

- Sorting

- Totals

- Chart configuration, where applicable

- Drill-down target

- Default format

- Maximum record limit

### Governance

- Created by

- Approved by

- Approval date

- Published date

- Effective dates

- Superseded date

- Updated date

---

## 6. Report Definition Statuses

### Draft

The report is being prepared.

Rules:

- May be edited

- Must not be generally available

- May be deleted where no execution history exists

### Pending Approval

The report is awaiting authorization.

### Published

The report may be executed by authorized users.

Rules:

- Published versions should be immutable

- Material changes require a new version

### Inactive

The report cannot be run for new requests.

Existing results remain available according to retention rules.

### Superseded

A newer version has replaced the report.

### Archived

The report is retained for historical reference.

---

## 7. Report Versioning

Rules:

- Published reports must be versioned.

- Historical executions must preserve the report version used.

- Changing filters, calculations, columns or security rules may require a new version.

- One version should normally be current for a given effective date.

- Draft changes must not affect published reports.

- Scheduled reports must reference a specific published version or an explicitly approved current version.

---

## 8. Report Categories

Initial categories may include:

- People

- Payroll

- Leave

- Recruitment

- Onboarding

- Offboarding

- Identity and Security

- Workflow

- Notifications

- Audit

- Files and Documents

- Administration

- Executive

- Compliance

- Operational

- Financial

- Data Quality

- Self-Service

Categories should support filtering and access control.

---

## 9. Report Types

Initial report types may include:

### Detail Report

Displays individual records and columns.

### Summary Report

Groups and totals data.

### Dashboard Report

Displays metrics and visual summaries.

### Exception Report

Shows records requiring attention.

### Reconciliation Report

Compares related totals or systems.

### Snapshot Report

Preserves values as of a defined point in time.

### Regulatory Report

Uses a controlled structure required by policy or law.

### Self-Service Report

Shows information limited to the current user.

### Export Report

Produces structured files for authorized downstream use.

---

## 10. Report Parameters

Parameters allow users to control a report execution.

Examples:

- Start date

- End date

- Department

- Position

- Employee

- Payroll Period

- Pay Group

- Leave Type

- Recruitment status

- Organization

- Report currency

- Status

A Report Parameter should contain:

- Parameter code

- Label

- Data type

- Required indicator

- Default value

- Allowed values source

- Minimum value

- Maximum value

- Multi-select indicator

- Sensitive indicator

- Validation rules

- Display order

Rules:

- Parameters must be validated server-side.

- Users must not submit unauthorized Organization or Department values.

- Parameter defaults must not widen access.

- Sensitive parameter values should not be exposed in URLs where avoidable.

---

## 11. Report Filters

Filters may be:

- Fixed by the Report Definition

- Selected by the user

- Applied automatically by authorization

- Derived from Organization context

- Derived from Employee or manager scope

Examples:

- Current Organization only

- Direct reports only

- Assigned Pay Group only

- Active Employees only

- Payroll Period within authorized range

- Current user’s Payslips only

Security filters must not be removable by the user.

---

## 12. Report Columns

A Report Column should define:

- Column code

- Label

- Source field

- Data type

- Format

- Sort support

- Filter support

- Grouping support

- Total method

- Sensitive classification

- Masking rule

- Export inclusion

- Display order

Rules:

- Sensitive columns require explicit Permission.

- Unauthorized columns must be omitted from the dataset, not merely hidden in the UI.

- Calculated columns must use approved definitions.

- Column labels should remain understandable over time.

---

## 13. Calculated Fields

Calculated fields may include:

- Age

- Length of service

- Vacancy count

- Payroll variance

- Leave usage percentage

- Recruitment time to hire

- Onboarding completion percentage

- Offboarding clearance percentage

- Approval turnaround time

Rules:

- Calculation formula must be documented.

- Calculation version must be preserved where material.

- Calculations should use approved data types and rounding.

- Reports must not recreate conflicting business rules.

- Complex business calculations should come from the owning domain or approved reporting model.

---

## 14. Metrics

A Metric Definition describes one agreed measurement.

Examples:

- Active Employee Headcount

- Monthly Gross Payroll

- Average Time to Hire

- Leave Utilization Rate

- Contract Expiry Count

- Payroll Exception Rate

- Onboarding Readiness Rate

- User MFA Adoption Rate

A Metric Definition should contain:

- Stable internal ID

- Metric code

- Metric name

- Description

- Business owner

- Formula

- Source data

- Inclusion rules

- Exclusion rules

- Unit

- Frequency

- Effective dates

- Version

- Status

---

## 15. Metric Governance

Rules:

- Every executive metric must have one approved definition.

- Similar metrics must not use conflicting formulas without clear naming.

- Formula changes require versioning.

- Dashboard values must identify the reporting period.

- Users should be able to view the metric definition where appropriate.

- Sensitive metrics must follow access rules.

---

## 16. Reporting Data Models

Reporting should use approved reporting models rather than uncontrolled direct table access.

Possible models:

- People reporting model

- Payroll reporting model

- Leave reporting model

- Recruitment reporting model

- Identity reporting model

- Workflow reporting model

- Cross-domain workforce model

A Reporting Data Model should define:

- Source domains

- Fields

- Relationships

- Refresh strategy

- Security rules

- Historical behavior

- Effective dates

- Data owner

- Quality checks

---

## 17. Operational and Analytical Data

### Operational reporting

Uses near-current domain data.

Examples:

- Pending Leave Requests

- Contracts expiring in 90 days

- Current Payroll exceptions

- Active Onboarding Tasks

### Analytical reporting

Uses historical, aggregated or snapshot data.

Examples:

- Payroll cost trend

- Employee turnover

- Recruitment performance

- Leave patterns

- Approval turnaround over time

Rules:

- Reports must identify whether data is live, delayed or snapshot-based.

- Users must not assume analytical data is current without a timestamp.

- Refresh frequency must be displayed where relevant.

---

## 18. Reporting Snapshots

A Reporting Snapshot preserves approved values at a point in time.

Examples:

- Month-end Employee headcount

- Approved Payroll Period totals

- Year-end Leave balances

- Recruitment pipeline at quarter end

- Access review completion at audit date

A Snapshot should contain:

- Stable internal ID

- Organization ID

- Snapshot type

- Snapshot date

- Reporting period

- Source versions

- Record count

- Totals

- Created by job or user

- Completion status

- Checksum

- Correlation ID

Rules:

- Snapshots must be immutable after publication.

- Corrections require a new snapshot version.

- Snapshot generation must be auditable.

- Source versions must be traceable.

---

## 19. Report Execution

A Report Execution represents one attempt to run a Report Definition.

It should contain:

- Stable internal ID

- Organization ID

- Report Definition ID

- Report version

- Requested by

- Requested date

- Parameters

- Authorization scope

- Status

- Started date

- Completed date

- Duration

- Record count

- Output format

- Result reference

- Expiry date

- Correlation ID

- Error reference

---

## 20. Report Execution Statuses

### Queued

The request is waiting for processing.

### Running

The report is being generated.

### Completed

The report completed successfully.

### Completed with Warnings

The report completed but contains data-quality or completeness warnings.

### Failed

The report could not be generated.

### Cancelled

The user or system cancelled the execution.

### Expired

The generated result is no longer available.

### Archived

The execution metadata is retained historically.

---

## 21. Background Report Processing

Reports should run in a background worker when they:

- Process large datasets

- Generate PDF or Excel files

- Use cross-domain aggregation

- Require snapshots

- Run on a schedule

- Exceed an interactive execution threshold

The UI should display:

- Queued

- Running

- Progress

- Completed

- Failed

- Download ready

The user should not need to keep the browser open.

---

## 22. Interactive Reports

Smaller reports may run interactively.

Requirements:

- Server-side authorization

- Pagination

- Maximum row limits

- Parameter validation

- Query timeout

- Clear loading state

- Cancel support where practical

- No unrestricted full-table queries

Interactive report failure must not affect source domains.

---

## 23. Report Results

A Report Result may be:

- Interactive table

- Dashboard data

- PDF

- Excel workbook

- CSV

- JSON, where authorized

- Printable HTML

A Report Result should preserve:

- Report version

- Parameters

- Authorization scope

- Generation time

- Data-as-of time

- Record count

- Warnings

- Output checksum

- File reference, where applicable

---

## 24. Report Result Security

Rules:

- Results inherit report and data permissions.

- Download links must be short-lived.

- Results must not be publicly accessible.

- Sensitive result files should expire.

- Result access may require reauthentication.

- Sharing a result must not bypass source permissions.

- Cached results must remain scoped to the authorized user or audience.

---

## 25. Dashboards

A Dashboard provides a visual summary of metrics, charts and operational indicators.

A Dashboard should contain:

- Stable internal ID

- Organization ID

- Dashboard code

- Name

- Description

- Audience

- Status

- Layout

- Widgets

- Refresh frequency

- Effective dates

- Version

- Created date

- Updated date

Examples:

- Executive Dashboard

- HR Dashboard

- Payroll Dashboard

- Recruitment Dashboard

- Manager Dashboard

- Employee Self-Service Dashboard

- Security Dashboard

---

## 26. Dashboard Widgets

Widget types may include:

- Metric card

- Trend chart

- Bar chart

- Line chart

- Pie or donut chart

- Table

- Exception list

- Progress indicator

- Status summary

- Calendar

- Timeline

- Geographic view, where appropriate

A Widget should define:

- Metric or Report source

- Title

- Description

- Visualization type

- Filters

- Date range

- Refresh interval

- Drill-down target

- Access rule

- Display order

- Size

---

## 27. Dashboard Rules

- Every Widget must respect authorization.

- Dashboard access does not automatically grant access to drill-down records.

- Hidden data must not be returned to unauthorized users.

- Sensitive Widgets may require additional Permission.

- Refresh failure for one Widget should not fail the entire Dashboard.

- Widgets should display data-as-of time.

- Empty states should be clear.

---

## 28. Drill-Down

Drill-down allows users to move from summary to detail.

Example:

```text

Contracts Expiring: 12

  ↓

List of affected Employees

  ↓

Individual Contract profile