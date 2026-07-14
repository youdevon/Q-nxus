# Core Platform Services Domain Specification

## 1. Purpose

Core Platform Services provides the shared technical capabilities required by every Q-NXUS business domain.

It supports:

- Stable identifiers

- Domain events

- Integration events

- Background jobs

- Queues

- Scheduled processing

- Idempotency

- Distributed locking

- Caching

- Correlation and tracing

- Error references

- Health checks

- Service contracts

- Transaction boundaries

- Configuration access

- Date and time services

- Number formatting

- Pagination

- Search support

- Import and export coordination

- Feature availability

- Platform diagnostics

Core Platform Services must remain business-domain neutral.

It should not own Employee, Payroll, Leave, Recruitment or other business records.

Its purpose is to provide reliable infrastructure that those domains can use consistently.

---

## 2. Domain Ownership

Primary owner:

- Core Platform Domain

Shared consumers:

- Every Q-NXUS domain

- Every background worker

- Every integration

- Every API route

- Every scheduled process

- Every administrative capability

Core Platform owns:

- Platform Identifier

- Domain Event Envelope

- Integration Event Envelope

- Event Outbox

- Event Inbox

- Background Job

- Scheduled Job

- Queue Message

- Idempotency Record

- Distributed Lock

- Cache Entry

- Correlation Context

- Error Reference

- Service Health Record

- Platform Operation

- Domain Service Contract

- Import Operation

- Export Operation

- Platform Feature Dependency

- Platform Diagnostic Record

Business domains own:

- Their business records

- Their business events

- Their validation rules

- Their permissions

- Their workflow decisions

- Their business calculations

---

## 3. Core Principles

Core Platform Services should follow these principles:

- Business domains remain independent.

- Shared services must not become a dumping ground for business logic.

- Domain boundaries must be respected.

- Cross-domain updates must use approved service contracts.

- Important operations must be retry-safe.

- Events must be versioned.

- Failures must be isolated.

- Critical operations must be observable.

- Identifiers must be stable and non-reusable.

- Time handling must be consistent.

- Security must be enforced server-side.

- Infrastructure providers should remain replaceable.

- Platform services should degrade gracefully where possible.

---

## 4. Core Business Objects

The Core Platform domain should include:

- Platform Identifier

- Domain Event

- Integration Event

- Event Outbox Record

- Event Inbox Record

- Event Subscription

- Background Job

- Scheduled Job

- Queue Message

- Dead-Letter Record

- Retry Policy

- Idempotency Record

- Distributed Lock

- Cache Entry

- Correlation Context

- Error Reference

- Service Health Record

- Health Check Result

- Platform Operation

- Domain Service Contract

- Service Contract Version

- Import Operation

- Export Operation

- Platform Exception

- Feature Dependency

- Diagnostic Record

---

## 5. Stable Identifiers

Every authoritative record should have a stable internal identifier.

Recommended identifier characteristics:

- Globally unique

- Non-sequential where external exposure is possible

- Immutable

- Never reused

- Independent of human-readable numbering

- Safe for distributed creation

Possible formats:

- UUID

- ULID

- CUID

- Another approved globally unique format

Rules:

- Internal ID and business display number must remain separate.

- Display numbers may be formatted by Administration.

- Internal IDs must not change when records are moved, renamed or archived.

- Deleted or cancelled record IDs must not be reused.

- Public routes should not expose predictable database sequences where avoidable.

---

## 6. Business Numbers and Internal IDs

Example:

```text

Internal ID:

01JQX9M6VY7T8W4K3A2Z1N5P0R

Business Number:

EMP-2026-00452