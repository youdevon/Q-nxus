# Asset Management Domain Specification

## 1. Purpose

The Asset Management domain controls the lifecycle of physical and selected digital assets owned, leased, assigned or managed by an Organization.

It supports:

- Asset registration

- Asset classification

- Asset identification

- Asset assignment

- Asset custody

- Asset transfer

- Asset return

- Asset condition tracking

- Asset requests

- Asset allocation

- Asset maintenance

- Warranty tracking

- Licence tracking

- Asset audits

- Asset retirement

- Asset disposal

- Lost, stolen and damaged Asset handling

- Asset valuation references

- Onboarding and Offboarding coordination

Asset Management owns the authoritative Asset record and Asset custody history.

It does not own Employee, Department, Position, Financial Ledger or Procurement records.

---

## 2. Domain Ownership

Primary owner:

- Asset Management Domain

Shared consumers:

- People

- Onboarding

- Offboarding

- Identity and Security

- Administration

- Procurement

- Finance

- Facilities

- File Management

- Workflow

- Notifications

- Audit

- Reporting

- Core Platform

Asset Management owns:

- Asset

- Asset Category

- Asset Type

- Asset Model

- Asset Status

- Asset Assignment

- Asset Custody

- Asset Request

- Asset Allocation

- Asset Transfer

- Asset Return

- Asset Condition Record

- Asset Inspection

- Asset Maintenance Record

- Warranty Record

- Asset Incident

- Asset Audit

- Asset Retirement

- Asset Disposal

- Asset Exception

Other domains own:

- Employee: People

- Purchase Order: Procurement

- Supplier: Procurement

- Financial accounting: Finance

- User Account: Identity and Security

- Uploaded evidence: File Management

---

## 3. Core Business Objects

The Asset Management domain should include:

- Asset

- Asset Category

- Asset Type

- Asset Model

- Manufacturer

- Asset Identifier

- Asset Location

- Asset Assignment

- Asset Custody Record

- Asset Request

- Asset Reservation

- Asset Allocation

- Asset Transfer

- Asset Return

- Asset Condition Record

- Asset Inspection

- Asset Maintenance Record

- Maintenance Schedule

- Warranty Record

- Licence Record

- Asset Incident

- Asset Audit

- Asset Retirement

- Asset Disposal

- Asset Exception

- Asset Document Reference

---

## 4. Asset

An Asset represents one identifiable item controlled by the Organization.

An Asset should contain:

### Identity

- Stable internal ID

- Organization ID

- Asset number

- Asset tag

- Serial number

- Barcode

- QR code reference

- Category

- Asset Type

- Asset Model

- Manufacturer

- Description

- Status

### Ownership

- Ownership type

- Owner Organization

- Custodian

- Assigned Employee

- Assigned Department

- Assigned Location

- Cost centre reference

- Responsible manager

### Acquisition

- Acquisition date

- Purchase Order reference

- Supplier reference

- Invoice reference

- Acquisition cost

- Currency

- Funding source

- Received date

- Placed-in-service date

### Technical information

- Model number

- Specification

- Operating system, where applicable

- Hostname, where applicable

- MAC address, where applicable

- IP address reference, where applicable

- Licence information

- Warranty information

### Lifecycle

- Condition

- Last inspection date

- Last maintenance date

- Next maintenance date

- Expected useful life

- Retirement date

- Disposal date

### Governance

- Created by

- Created date

- Updated date

- Archived date

- Notes

- Correlation ID

---

## 5. Asset Categories

Initial categories may include:

- Computer Equipment

- Network Equipment

- Server Equipment

- Mobile Devices

- Telecommunications

- Office Equipment

- Furniture

- Vehicles

- Tools

- Machinery

- Safety Equipment

- Security Equipment

- Building Equipment

- Audio-Visual Equipment

- Software Licence

- Subscription

- Other

Categories should be configurable.

---

## 6. Asset Types

Examples:

### Computer Equipment

- Laptop

- Desktop

- Monitor

- Docking Station

- Keyboard

- Mouse

- Printer

- Scanner

### Network Equipment

- Router

- Firewall

- Switch

- Wireless Access Point

- Patch Panel

- UPS

- PDU

### Telecommunications

- Desk Phone

- Mobile Phone

- Headset

- Conference Phone

- SIM Card

### Security

- Access Card

- Security Token

- CCTV Camera

- Biometric Device

Asset Type should remain separate from Asset Category.

---

## 7. Asset Ownership Types

Possible ownership types:

- Organization Owned

- Leased

- Rented

- Donated

- Borrowed

- Employee Owned

- Supplier Provided

- Government Assigned

- Managed Service Asset

Rules:

- Ownership type must be explicit.

- Employee-owned items should not be treated as Organization property.

- Leased and rented Assets require agreement references and return dates.

- Supplier-provided Assets should identify the responsible supplier.

- Ownership changes must be audited.

---

## 8. Asset Statuses

### Draft

The Asset record is being prepared.

Rules:

- Cannot be assigned

- May be deleted where no dependency exists

### Ordered

The Asset has been ordered but not received.

### Received

The Asset has been physically received.

Rules:

- Receipt date is required

- Condition on receipt should be recorded

### Pending Inspection

The Asset requires inspection or acceptance.

### Available

The Asset is ready for assignment or operational use.

### Reserved

The Asset is reserved for a future Employee, Department, project or task.

### Assigned

The Asset is assigned to a custodian.

### In Use

The Asset is actively operational.

### In Storage

The Asset is retained at a defined storage location.

### In Transfer

The Asset is moving between custodians or Locations.

### Under Maintenance

The Asset is temporarily unavailable due to maintenance.

### Damaged

The Asset is damaged and requires assessment.

### Lost

The Asset cannot be located.

### Stolen

The Asset has been reported stolen.

### Quarantined

The Asset is isolated because of a security, safety or compliance concern.

### Retired

The Asset is no longer approved for operational use.

### Pending Disposal

The Asset is awaiting approved disposal.

### Disposed

The Asset has completed the approved disposal process.

### Returned to Supplier

The Asset was returned to its supplier or lessor.

### Archived

The Asset is retained for historical reporting.

---

## 9. Asset Status Rules

- Draft Assets cannot be assigned.

- Available Assets may be reserved or assigned.

- Assigned Assets must have an active Custody Record.

- Assets under maintenance must not be assigned as operationally available.

- Lost or stolen Assets must not be transferred through ordinary workflows.

- Retired Assets must not return to service without authorized reactivation.

- Disposed Assets must not be reassigned.

- Status changes must be auditable.

- Some statuses should be derived from active lifecycle records.

---

## 10. Asset Number and Tag

Each Asset should have:

- Stable internal ID

- Human-readable Asset number

- Asset tag, where physically tagged

- Serial number, where supplied by manufacturer

Rules:

- Asset number must be unique within its configured scope.

- Asset tag must be unique where required.

- Serial number duplicates should be flagged.

- Asset numbers must not be reused.

- Replacing a damaged physical label must not create a new Asset record.

- Numbering should use Administration numbering sequences.

---

## 11. Asset Model

An Asset Model represents a reusable product definition.

A Model should contain:

- Stable internal ID

- Manufacturer

- Model name

- Model number

- Asset Type

- Description

- Standard specification

- Expected useful life

- Default warranty period

- Maintenance requirements

- Status

Examples:

- Dell Latitude 7450

- Ubiquiti UDM Pro Max

- Kyocera TASKalfa 3554ci

- APC Smart-UPS 3000VA

Rules:

- Multiple physical Assets may reference one Asset Model.

- Model changes must not overwrite Asset-specific information.

- Inactive Models cannot be selected for new Assets.

- Historical Assets retain their Model reference.

---

## 12. Manufacturer

A Manufacturer record may contain:

- Stable internal ID

- Name

- Website

- Support contact

- Country

- Status

- Notes

Manufacturer must remain separate from Supplier.

A Supplier sells or services the Asset.

A Manufacturer produces the Asset.

---

## 13. Asset Locations

An Asset may be located at:

- Organization Location

- Building

- Floor

- Room

- Office

- Rack

- Storage room

- Vehicle

- Vessel

- Employee remote location

- Supplier repair facility

- Project site

An Asset Location assignment should contain:

- Asset ID

- Location ID

- Sub-location description

- Rack or room reference

- Effective start date

- Effective end date

- Assigned by

- Reason

Location history must remain preserved.

---

## 14. Asset Custodian

A Custodian is the person or organizational unit accountable for an Asset.

Possible custodians:

- Employee

- Department

- Location manager

- Project manager

- ICT unit

- Facilities unit

- External contractor

- Supplier

Rules:

- An Asset should have one current primary Custodian.

- Custodian does not necessarily mean exclusive user.

- Custodian changes must create history.

- A deactivated Employee cannot remain the active Custodian after completed Offboarding.

- Shared Assets may be assigned to a Department or Location.

---

## 15. Asset Assignment

An Asset Assignment links an Asset to a Custodian or user.

An Assignment should contain:

- Stable internal ID

- Organization ID

- Asset ID

- Employee ID, where applicable

- Department ID, where applicable

- Location ID

- Assignment type

- Status

- Assigned date

- Expected return date

- Actual return date

- Assigned by

- Approved by

- Business purpose

- Condition at issue

- Acknowledgement status

- Evidence reference

- Notes

---

## 16. Assignment Types

Initial types:

- Permanent

- Temporary

- Shared

- Departmental

- Project

- Loan

- Remote Work

- Replacement

- Testing

- Training

- Emergency

Assignment type may influence:

- Approval

- Expected return date

- Acknowledgement

- Inspection frequency

- Insurance or liability

- Access scope

---

## 17. Assignment Statuses

- Draft

- Pending Approval

- Approved

- Awaiting Issue

- Active

- Return Requested

- Returned

- Transfer Pending

- Transferred

- Cancelled

- Overdue

- Closed

- Archived

Rules:

- One Asset must not have conflicting active Assignments.

- Shared use must be explicitly configured.

- Active Assignment requires Asset eligibility.

- Assignment acknowledgement may be mandatory.

- Returned Assignment must record condition.

- Historical Assignments must remain immutable.

---

## 18. Assignment Rules

- Asset must be Available, Reserved or otherwise eligible.

- Employee must be active or approved for future onboarding.

- Assignment must respect Organization boundaries.

- Restricted Assets may require manager or security approval.

- Assignment date cannot be after expected return date.

- Assignment should create a Custody Record.

- Active Assignment should update the operational Asset status through the Asset domain service.

- Assignment failure must not partially update custody.

---

## 19. Employee Acknowledgement

An Employee may be required to acknowledge:

- Receipt

- Condition

- Asset responsibility

- Acceptable use

- Return obligation

- Loss and damage policy

- Accessories received

Acknowledgement should contain:

- Employee

- Assignment

- Date and time

- Method

- Policy version

- Comments

- Evidence reference

Rules:

- Acknowledgement must identify the exact Asset and accessories.

- Acknowledgement does not replace an Asset inspection.

- Refusal or inability to acknowledge must create an exception.

- Another user must not acknowledge on the Employee’s behalf without permission.

---

## 20. Asset Accessories

An Asset Assignment may include accessories.

Examples:

- Charger

- Docking Station

- Carrying Case

- Keyboard

- Mouse

- Headset

- Power Adapter

- Security Key

- Cable

- Spare Battery

Accessories may be:

- Independent Assets

- Components

- Non-tracked items

- Assignment checklist items

Rules:

- High-value accessories should have their own Asset records.

- Returned accessories must be verified.

- Missing accessories may create a recovery exception.

- Accessory lists must be preserved with Assignment history.

---

## 21. Asset Request

An Asset Request represents a request for equipment or another controlled Asset.

A Request should contain:

- Stable internal ID

- Request number

- Organization ID

- Requested by

- Requested for

- Department

- Position

- Asset Category

- Asset Type

- Quantity

- Required date

- Business justification

- Request type

- Priority

- Status

- Funding reference

- Approval status

- Allocation status

- Notes

---

## 22. Asset Request Types

Possible types:

- New Employee

- Replacement

- Upgrade

- Additional Equipment

- Temporary Loan

- Project Requirement

- Remote Work

- Damaged Asset Replacement

- Lost Asset Replacement

- Departmental Equipment

- Emergency Request

---

## 23. Asset Request Statuses

- Draft

- Submitted

- Pending Approval

- Approved

- Rejected

- Awaiting Stock

- Partially Allocated

- Allocated

- Issued

- Completed

- Cancelled

- Archived

Rules:

- Approval does not guarantee stock availability.

- Rejection requires reason.

- Partial allocation must remain visible.

- Completed Request should reference resulting Assignments.

- Retrying allocation must not duplicate Assignments.

---

## 24. Asset Reservation

A Reservation holds an Available Asset for future assignment.

A Reservation should contain:

- Asset

- Reserved for Employee, Department or purpose

- Reservation date

- Effective start date

- Expiry date

- Status

- Requested by

- Approved by

- Reason

Rules:

- One Asset must not have overlapping active Reservations.

- Reservation should expire automatically.

- Expired Reservation should release the Asset.

- Reservation must not create active custody.

- Onboarding may reserve equipment before the Employee’s start date.

---

## 25. Asset Allocation

Allocation selects a specific Asset to satisfy an approved Request.

An Allocation should contain:

- Asset Request

- Asset

- Quantity relationship

- Allocation date

- Allocated by

- Status

- Condition

- Expected issue date

Rules:

- Asset must meet the requested Type and requirements.

- Allocation must respect availability.

- One Asset must not satisfy multiple exclusive Requests.

- Allocation may be changed before issue with reason.

- Issuing the Asset should create an Assignment.

---

## 26. Onboarding Integration

Onboarding may request:

- Laptop

- Desktop

- Monitor

- Mobile phone

- Desk phone

- Security token

- Access card

- Headset

- Specialized tools

- Uniform

- Protective equipment

Typical flow:

```text

Onboarding Case Created

  ↓

Asset Request Created

  ↓

Request Approved

  ↓

Asset Reserved or Allocated

  ↓

Asset Prepared

  ↓

Asset Issued

  ↓

Employee Acknowledges Receipt

  ↓

Onboarding Task Completed