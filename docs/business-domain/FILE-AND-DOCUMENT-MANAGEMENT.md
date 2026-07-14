# File and Document Management Domain Specification

## 1. Purpose

The File and Document Management domain provides secure, centralized storage, retrieval, versioning, classification and lifecycle management for files used throughout Q-NXUS.

It supports:

- File uploads

- File downloads

- Document versioning

- Attachment management

- Access control

- Virus and malware scanning

- File classification

- Retention

- Archiving

- Secure links

- Document previews

- Document templates

- Metadata

- Audit integration

- Storage-provider abstraction

- File integrity verification

Business domains own the meaning and business rules of their documents.

File Management owns the secure storage and technical lifecycle of the file.

Examples:

- People owns the meaning of an Employment Contract.

- Payroll owns the meaning of a Payslip.

- Recruitment owns the meaning of a Candidate résumé.

- File Management stores, versions and retrieves those files securely.

---

## 2. Domain Ownership

Primary owner:

- File Management Domain

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

- Reporting

- Administration

- Future enterprise domains

File Management owns:

- File Record

- File Version

- File Metadata

- Storage Object

- Document Reference

- File Classification

- File Category

- Upload Session

- Download Session

- File Access Policy

- File Scan Result

- File Integrity Record

- Secure Link

- File Retention Policy

- File Archive Record

- Document Template

- Document Preview

- File Processing Job

Business domains own:

- Document purpose

- Required document rules

- Approval requirements

- Business status

- Source record

- Business retention category

- Who should have access from a business perspective

---

## 3. Core Business Objects

The domain should include:

- File Record

- File Version

- File Metadata

- Document Reference

- File Category

- File Classification

- Upload Session

- Download Session

- Storage Object

- File Access Policy

- File Access Grant

- File Scan Result

- File Integrity Record

- Secure Link

- File Retention Policy

- File Archive Record

- File Deletion Request

- Document Template

- Template Version

- Document Preview

- File Processing Job

- File Exception

---

## 4. File Record

A File Record represents one logical file within Q-NXUS.

A File Record should contain:

### Identity

- Stable internal ID

- Organization ID

- File number

- Current version ID

- File name

- Display name

- File extension

- MIME type

- File category

- Classification

- Status

### Storage

- Storage provider

- Storage location reference

- Storage object key

- File size

- Checksum

- Encryption status

- Scan status

- Preview status

### Business context

- Source domain

- Source record type

- Source record ID

- Document type

- Document purpose

- Owner user

- Owner department

- Confidentiality level

### Governance

- Created by

- Created date

- Updated date

- Archived date

- Retention category

- Retention expiry date

- Legal hold indicator

- Notes

The File Record must not contain the raw file content directly unless the chosen storage architecture explicitly requires database storage.

---

## 5. File and Document Distinction

A File is the stored binary object.

A Document is the business meaning assigned to that file.

Example:

```text

File:

contract-2026-0041.pdf

Document:

Approved Employment Contract for Employee 00452