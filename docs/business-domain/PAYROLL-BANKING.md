# Payroll Banking (Phases 1–4 + go-live hardening)

## Purpose

Separate **payroll calculation** (gross → statutory deductions → net) from
**payment destination setup and disbursement** (employee bank accounts,
allocations, payment snapshots, ACH / manual register export).

A disabled banking or ACH feature must never invalidate a calculated or posted
pay run.

## Calc vs Payment

| Layer | Responsibility |
|--------|----------------|
| Payslip calc (`assemblePayslipPreview`) | Earnings, statutory deductions, net pay |
| Bank allocation adapter | Maps `EmployeeBankAccount` + `EmployeePayrollAllocation` → `PayslipBankAccountInput` |
| `applyFixedBankAllocations` | Phase 1 payment shape (FIXED as deductions) — **default** |
| `applyPostNetBankAllocations` | Flagged post-net split (FIXED → % → REMAINDER of full take-home) |
| **Prepare payments** (Phase 2) | Freeze `PayrollPayment` + `PayrollPaymentAllocation` from posted payslip `bankDistribution` |
| **Disbursement export (schema v1)** | Bank CSV + Disbursement Excel for bank-website entry |
| **ACH / register batch** (Phase 3) | `AchPaymentBatch` + `BankExportProfile` adapter engine (gated) |

### Critical Phase 1 formula (do not change when `POST_NET_SPLIT_ENABLED` is off)

Secondary **FIXED** bank amounts are still treated as **deductions** that reduce
`netPay`. The primary **REMAINDER** line **is** `netPay`.

This matches historical payslip snapshots and the bank payment CSV. A true
post-net split (where bank lines sum to full take-home and fixed amounts are
**not** deductions) only runs when `POST_NET_SPLIT_ENABLED` is **ON**.

---

## Go-live SOP (operators)

1. **Seed feature flags** — run platform / financial-institution seed so
   `FeatureControl` rows exist. Missing banking rows use **seed defaults** via
   `isPayrollBankingFeatureEnabled` (ACH / post-net / negative export stay
   **OFF**; banking + manual register stay **ON**).
2. **Confirm bank destinations** — employees must have
   `EmployeeBankAccount` + allocations (legacy `PayrollBankAccount` table
   has been removed).
3. **Encrypt at rest** — `npm run banking:migrate-encrypt` (needs
   `AUTH_SECRET` or `BANK_ACCOUNT_ENCRYPTION_KEY`).
4. **Confirm readiness** — Payroll readiness / salaries read
   `EmployeeBankAccount` + allocations only.
5. **Post pay run** → on the pay-run detail, open **Prepare payments** (manual;
   not automatic on post).
6. **Disburse** — download **Disbursement Excel** (preferred for bank-website
   entry) and/or **Bank CSV** / Manual payment register. Keep
   `ACH_EXPORT_ENABLED` **false** until the bank confirms a direct file layout.
7. **Optional ACH** — after bank confirmation, set institution routing codes,
   edit export profile `configurationJson` if needed, then enable
   `ACH_EXPORT_ENABLED`. Map from the same schema v2 disbursement rows.

Do **not** invent official ACH/NACHA layouts or fake routing codes.

---

## Payroll disbursement export (schema v2)

Stable column schema shared by **Bank CSV** and **Disbursement Excel**
(Office Open XML / `.xlsx`). One row per bank allocation with `amount > 0`.
Prefer prepared `PayrollPaymentAllocation` snapshots; fall back to payslip
`bankDistribution` when payments are not prepared. Not an official First
Citizens import file.

| Group | Columns |
|-------|---------|
| Run | `schemaVersion`, `runNumber`, `periodKey`, `periodEnd`, `paymentDate` |
| Employee | `employeeNumber`, `employeeName`, `nisNumber`, `birNumber` |
| Payroll | `currency`, `grossPay`, `paye`, `nisEmployee`, `healthSurcharge`, `netPay` |
| Bank | `bankName`, `branchName`, `accountNumber`, `accountName`, `accountType`, `splitType`, `allocationAmount` |

- **CSV** — `/payroll/runs/[id]/bank-export` → `{runNumber}-bank-payments.csv`
- **Excel** — `/payroll/runs/[id]/bank-export-xlsx` → `{runNumber}-payroll-disbursement.xlsx`
  (sheets: `Disbursements`, `Summary`)
- Constant: `PAYROLL_DISBURSEMENT_SCHEMA_VERSION = 2` in
  `src/modules/payroll/lib/payroll-disbursement-export.ts`
- `accountType` is `SAVINGS` | `CHEQUING` (ACH Payment Type source).

Do **not** invent official ACH/NACHA layouts or fake routing codes.

---

**Excel** is the primary operator format for entering payments on the bank’s
website. **CSV** uses the same schema for automation / paste. Future
`BankExportProfile` / ISO 20022 adapters should map from these rows — do not
fork a second column model.

Until a bank confirms a direct file layout, keep `ACH_EXPORT_ENABLED` off.

### First Citizens (Business Online)

- **Manual-entry worksheet** (`FIRST_CITIZENS_MANUAL_WORKSHEET`) — shipped.
  Columns match the bank template order:
  Individual Name | Individual ID | ABA Number | Account Number |
  Payment Type | Purpose Code | Amount | Addenda,
  plus a Control Summary sheet with a **Bank ACH header** block (copy onto
  Business Online) clearly labeled as **not** a bank import file.
  Route: `/payroll/runs/[id]/payments/[batchId]/fcb-worksheet`
- **Import file** (`FIRST_CITIZENS_IMPORT`) — adapter present but **disabled**.
  Guides name Default Transactions / NACHA CSV options but do not document
  field layout; request confirmation from
  `businessonlinequeries@firstcitizenstt.com` before enabling.
- Seeded profiles: `FCB_MANUAL_WORKSHEET`, `FCB_IMPORT` (placeholder).
  Re-seed or run `npx tsx --env-file=.env scripts/sync-fcb-ach-compliance.ts`
  to upgrade stored profile JSON / open batches to bank-form defaults.
- Processing notes from bank guides (advisory only): Mon–Fri windows,
  3,000 entry import max, 10 business-day release expiry, dual control.

### First Citizens ACH batch header (Business Online)

Required / expected header fields on the bank form (validated before worksheet
export):

| Bank field | Default / source |
|------------|------------------|
| Effective Date | Pay period end (shown as DD/MM/YYYY on Control Summary) |
| Balance Account | Export profile `balanceAccountMasked` (e.g. `xxx5620 - TTD`) |
| **Global Addenda** | **Required** — default `Payroll` |
| Discretionary Data | Profile override, else payroll period name (e.g. `July 2026`) |
| **Entry Description** | **Required** — default `Salary` |
| Transaction Type | `Credit` (payroll) |
| Purpose Code | Default `COMPENSATION OF EMPLOYEES` |
| Total / Total No of Records | Batch control totals |

Payment Type labels match the bank UI: `Savings Credit` | `Checking Credit`
(internal account type remains `SAVINGS` / `CHEQUING`).

### Employee payment instructions ↔ First Citizens ACH

| FCB entry field | Captured on employee? | Source |
|-----------------|----------------------|--------|
| Individual Name | **Required** | Account holder name |
| Individual ID | No (from HR) | Employee number |
| ABA Number | **Required** | Financial institution + optional `routingNumber` (routing / ACH participant when known) |
| Account Number | **Required** | Encrypted account number |
| Payment Type | **Required** | Account type → Savings Credit / Checking Credit |
| Purpose Code | No | Bank export profile / batch default |
| Amount | No | Payroll calc / allocation |
| Addenda | No | Batch global addenda (default Payroll) |

**Not required for FCB ACH entry:** branch/transit (removed from primary payroll setup UI; optional on import only).

---

## Phase 1 — Setup (shipped)

### Models

- `FinancialInstitution` / `FinancialInstitutionBranch` — configurable directory
- `EmployeeBankAccount` — employee-owned destinations (source of truth)
- `EmployeePayrollAllocation` — FULL_BALANCE / FIXED_AMOUNT / PERCENTAGE / REMAINDER

### Legacy table removed

`PayrollBankAccount` dual-sync and the `payroll.payroll_bank_accounts` table
were retired. Historical backfill lived in
`scripts/backfill-employee-bank-accounts.ts` and is no longer applicable.

### Feature flags (`FeatureControl`)

Seeded with safe defaults (banking ON, ACH OFF, percentage OFF, post-net OFF).
Runtime reads go through `isPayrollBankingFeatureEnabled` so a **missing row**
does **not** enable dangerous flags (unlike the global `isFeatureEnabled`
missing=enabled default used elsewhere).

Key codes: `PAYROLL_BANKING_ENABLED`, `ACH_EXPORT_ENABLED`,
`MANUAL_PAYMENT_ENABLED`, `PAYMENT_BATCH_APPROVAL_REQUIRED`,
`ACH_FILE_APPROVAL_REQUIRED`, `ALLOW_BATCH_SELF_APPROVAL`,
`PERCENTAGE_ALLOCATION_ENABLED`, `POST_NET_SPLIT_ENABLED`,
`BANK_ACCOUNT_VERIFICATION_REQUIRED`, `ALLOW_UNVERIFIED_BANK_ACCOUNTS`,
`ALLOW_ZERO_NET_PAY_EXPORT`, `ALLOW_NEGATIVE_NET_PAY_EXPORT`, allocation
toggles, etc.

### Verification gate (easy-win flags)

When `BANK_ACCOUNT_VERIFICATION_REQUIRED` is on **or**
`ALLOW_UNVERIFIED_BANK_ACCOUNTS` is off, prepare marks unverified destinations
as setup-required, and Bank CSV / payment batches refuse unverified accounts.

Zero / negative net pay lines are omitted from export/batches unless the
matching allow flags are on (seed default **false**).

### Enabling ACH export

1. Confirm bank layout / routing codes with the institution (`REQUIRES_CONFIRMATION`).
2. In **Administration → Feature controls**, set `ACH_EXPORT_ENABLED` to **true**
   for the organization (seed default is **false**).
3. Optionally enable `PAYMENT_BATCH_APPROVAL_REQUIRED` / `ACH_FILE_APPROVAL_REQUIRED`
   for maker-checker.
4. Use **Generate ACH batch** on `/payroll/runs/[id]/payments`.

Until ACH is enabled, operators use **Manual register batch**, **Bank CSV**,
or **Disbursement Excel**. The payments UI shows a banner when ACH is off.

### Account number encryption at rest

- AES-256-GCM with versioned ciphertext prefix `v1:…`
- Key: `BANK_ACCOUNT_ENCRYPTION_KEY` if set (min 16 chars), else `AUTH_SECRET`
- Stored on `EmployeeBankAccount.accountNumber` and
  `PayrollPaymentAllocation.accountNumberEncrypted`
- `accountNumberLastFour` / masked fields stay for display and audit
- Decrypt only for: bank export / ACH file generation, payroll setup editors,
  and users with `payroll.bank_accounts.view_sensitive` (exports require
  `payroll.manage` **or** `payroll.bank_accounts.view_sensitive`)
- Audit payloads stay masked — never log plaintext
- Migrate existing plaintext: `npm run banking:migrate-encrypt`

See `.env.example` for `BANK_ACCOUNT_ENCRYPTION_KEY`.

### Routing / ACH codes

Seeded TT institutions leave `routingCode` and `achParticipantCode` **null**.
Do not invent official codes — mark placeholders `REQUIRES_CONFIRMATION`.

### Permissions

- Profile save still needs `payroll.setup` or `payroll.manage`
- Writing bank destinations also needs
  (`payroll.bank_accounts.create` **or** `update` **or** `manage`) **and**
  (`payroll.allocations.manage` **or** `manage`)
- Verify instruction: `payroll.bank_accounts.verify` or `payroll.manage`
- Deactivate instruction: `payroll.bank_accounts.disable` or `payroll.manage`
- Payment batches:
  - prepare / create / cancel → `payroll.payment_batches.prepare` or `payroll.manage`
  - approve → `payroll.payment_batches.approve` or `payroll.manage`
  - generate / release / reconcile / FCB worksheet →
    `payroll.payment_batches.export` or `payroll.manage`
- Seeded **PAYROLL_CLERK** / **PAYROLL_OFFICER** / **BANK_EXPORT_OFFICER**
  retain the matching grants
- Export profiles: `payroll.bank_export_profiles.manage` or `payroll.manage`

Key banking flags also include `ALLOW_BATCH_SELF_APPROVAL` (seed default
**false** — preparer cannot approve the same batch).
---

## Phase 2 — Payment snapshots (Calc ≠ Payment)

### Models

- `PayrollPayment` — one row per posted payslip: net, allocated/unallocated,
  payment method/status, prepare timestamps
- `PayrollPaymentAllocation` — immutable bank destination lines (beneficiary,
  masked + encrypted snapshot, institution/branch/account-type snapshots,
  amount, sequence, return fields)

### Flow

1. Pay run must be **POSTED** (this app uses DRAFT | POSTED only — POSTED is locked).
2. Action **Prepare payments** creates immutable payment + allocation rows from:
   - Prefer payslip snapshot `bankDistribution` (authoritative historical calc)
   - Enrich with `EmployeeBankAccount` / allocation ids when account numbers match
   - If snapshot has no distribution, resolve live accounts at prepare time and freeze
3. Statuses include `NOT_CONFIGURED`, `PENDING`, `PAYMENT_SETUP_REQUIRED`,
   `PAYMENT_SETUP_ERROR`, `READY`, `INCLUDED_IN_BATCH`, …
4. If `PAYROLL_BANKING_ENABLED` is false → payments are created as
   `NOT_CONFIGURED` stubs (no bank lines).
5. Cheque / cash methods → `READY` with zero bank allocations.
6. **Never mutate** payment rows when employee bank accounts change later.
7. Bank CSV export prefers `PayrollPaymentAllocation` when prepared; falls back
   to payslip `bankDistribution` for unprepared runs.
8. Prepare is audited via `recordAuditEvent` (`PREPARE_PAYMENTS`).
9. Prepare remains **manual** after post — pay-run detail shows guidance when
   POSTED and payments are not prepared.

Idempotent: re-prepare on an already-prepared run returns the existing summary
without rewriting snapshots. Concurrent prepares that race the unique
`payslipId` constraint also resolve to `alreadyPrepared`.

---

## Phase 3 — ACH batch + export adapter engine

### Models

- `BankExportProfile` — configurable adapter kind + `configurationJson`
  (`MANUAL_REGISTER` | `GENERIC_CSV`). Seeded profiles are **placeholders**.
- `AchPaymentBatch` / `AchPaymentBatchDetail` — one detail per payment allocation;
  control total, file name, storage key, SHA-256 hash

### Adapter

`PayrollBankExportAdapter`: `validate`, `generate`, `controlTotal`, `maskPreview`.

One **generic configurable CSV** adapter reads column layout from
`BankExportProfile.configurationJson`. **No invented official bank layouts.**

`GENERIC_CSV` / `MANUAL_REGISTER` are **placeholders requiring bank confirmation**
before production use. UI labels say “Placeholder / requires bank confirmation”.

Admins with `payroll.bank_export_profiles.manage` (or `payroll.manage`) can
activate/deactivate profiles and edit name, description, and
`configurationJson`. The `isPlaceholder` flag stays set for seeded profiles.

### Batch lifecycle

`DRAFT` → (`PENDING_APPROVAL` when approval flags on) → `APPROVED` →
`GENERATED` → `EXPORTED` (or `CANCELLED`).

- Gated by `ACH_EXPORT_ENABLED` for ACH-style batches.
- When ACH is disabled, operators use **Manual payment register**
  (`MANUAL_REGISTER` profile) or Bank CSV.
- `PAYMENT_BATCH_APPROVAL_REQUIRED` / `ACH_FILE_APPROVAL_REQUIRED`: maker ≠ checker
  (preparer cannot approve their own batch).
- Files land under `uploads/ach-exports/…` (not public); hash + fileName on batch.
- Previews mask account numbers; downloadable files include full numbers when
  `maskAccountNumbers` is false (default for seeded profiles).

`/payroll/runs/[id]/ach-export` uses the adapter when enabled; when disabled
returns a clear JSON message pointing at the manual register / Bank CSV paths.

---

## Phase 4 — UI

- Pay run detail: payment status strip, post-run prepare guidance, link to
  payments workspace, Bank CSV (manage / sensitive)
- `/payroll/runs/[id]/payments` — prepare, batch list, employee payment table,
  ACH-off banner, maker-checker note when `ALLOW_BATCH_SELF_APPROVAL` is off
- `/payroll/runs/[id]/payments/[batchId]` — approve / generate / cancel /
  release / reconcile, validation summary, FCB worksheet download,
  return / resolve / regenerate allocation actions
- `/payroll/runs/[id]/payments/[batchId]/fcb-worksheet` — First Citizens
  manual-entry workbook (not a bank import file)
- `/payroll/payment-instructions/import` — CSV payment-instruction import
- `/payroll/settings` → **Financial institutions** + **Bank export profiles**
  (typed First Citizens fields for FCB adapters)
- Employee payroll setup: ACH-aligned destinations, verify / deactivate,
  soft-deactivated instruction history; destinations freeze into payment
  snapshots after prepare; Fixed / % toggle when `PERCENTAGE_ALLOCATION_ENABLED`

---

## Returns / reconciliation

Does **not** reverse the pay run or unrelated payments.

| Field / status | Purpose |
|----------------|---------|
| `RETURNED` / `REJECTED` | Allocation outcome |
| `returnCode`, `returnReason` | Bank / operator reason |
| `returnedAmount`, `returnedAt`, `settledAt` | Amount and timing |
| `RESOLVED` + `resolutionNote` | Manual payment / acknowledged |
| Regenerate | New `READY` allocation; original failed row preserved |

Permission: `payroll.payment_returns.manage` (also granted via `payroll.manage`
on actions). Audited via `recordAuditEvent`.

---

## Percentage + post-net splits (feature-flagged)

| Flag | Seed default | Effect |
|------|--------------|--------|
| `PERCENTAGE_ALLOCATION_ENABLED` | **false** | Allows saving PERCENTAGE allocations + form toggle |
| `POST_NET_SPLIT_ENABLED` | **false** | When ON: net = full take-home after statutory; FIXED by priority, then %, then REMAINDER; % ≤ 100%; fixed cannot exceed net; remainder gets rounding residue. When OFF: Phase 1 FIXED-as-deduction math unchanged |

Example (post-net ON): 20 000 → 3 000 fixed + 25% (5 000) + remainder 12 000.

Engine: `applyPostNetBankAllocations` + unit tests. Gross-to-net for orgs with
post-net OFF must match historical numbers.

---

## Official bank layouts

**Do not invent official ACH layouts.** `GENERIC_CSV` and `MANUAL_REGISTER` are
placeholders. Column layouts and routing codes require bank confirmation
(`REQUIRES_CONFIRMATION`) before production submission.

---

## Rollback notes

1. **Feature flags first** — disable `ACH_EXPORT_ENABLED` and/or
   `PAYROLL_BANKING_ENABLED` without touching posted payslips.
2. Payment / batch tables are additive; dropping them does not rewrite
   `Payslip.snapshot` or pay-run totals.
3. Bank CSV falls back to payslip snapshots when no `PayrollPayment` rows exist.
4. Encryption key rotation requires re-running the migrate-encrypt script with
   decrypt-under-old-key / encrypt-under-new-key (not automated).

---

## Done vs still blocked on bank confirmation

| Shipped for go-live | Still blocked / deferred until bank confirms |
|---------------------|-----------------------------------------------|
| Disbursement Excel + schema **v2** CSV (`accountType`) | Official First Citizens Default Transactions / NACHA import layout |
| EmployeeBankAccount as sole bank SoT + soft history | Confirmed routing / ACH participant codes |
| Safe missing-row feature defaults for banking | Production ACH submission / enabling `ACH_EXPORT_ENABLED` |
| Granular bank/allocation caps on profile write | Payment confirmation emails |
| Editable FCB export profiles (typed fields; import still disabled) | Clearing `isPlaceholder` without bank sign-off |
| Verify / deactivate + instruction history UI | Auto-prepare on post (intentionally manual) |
| Prepare / batch lifecycle UI (approve, cancel, release, reconcile) | Key-rotation helper beyond migrate script |
| Institutions + export profiles in settings | Cross-bank complexity beyond allow flag |
| Manual register + Bank CSV / FCB worksheet path | Dropping unused placeholder adapters after confirmation |
