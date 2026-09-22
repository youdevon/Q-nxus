/**
 * Default retention guidance for Trinidad & Tobago employment / payroll records.
 * These are product defaults for notices and file retention seeds — not legal advice.
 * Controllers should confirm periods with counsel for their entity.
 */
export const TT_DATA_RETENTION_GUIDANCE = {
  /** Payslips and payroll registers (tax / labour keep). */
  payrollYears: 7,
  /** Employee master file after employment ends (typical keep window). */
  employeeMasterYearsAfterExit: 7,
  /** Leave / medical attachments after period end. */
  leaveAttachmentYears: 3,
  /** Archived file binaries purged after soft-archive (days). */
  archivedFileBinaryPurgeDays: 30,
} as const;

export const PERSONAL_DATA_PROCESSING_PURPOSES = [
  {
    purpose: "Employment administration",
    examples:
      "Identity, contact details, contracts, assignments, leave, and employee file documents",
  },
  {
    purpose: "Payroll and statutory compliance",
    examples:
      "Salary, allowances, NIS/BIR references, tax calculations, payslips, and bank payment instructions",
  },
  {
    purpose: "Workplace operations",
    examples:
      "Asset custody, correspondence, appraisals, qualifications, and access to this system",
  },
  {
    purpose: "Security and accountability",
    examples:
      "Authentication, role permissions, and audit logs of significant changes",
  },
] as const;
